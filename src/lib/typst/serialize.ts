// Block[] → Typst markup (ÇEKİRDEK). Saf, deterministik, ölçümsüz (Typst kendi
// ölçer) → golden-string snapshot ile test edilebilir. İçerik hazırlığını
// (akıllı tırnak/tire/meta temizliği) prepare.ts'ten ÖNCE uygular ki iki motor
// ayrışmasın.
//
// İLK DİLİM kapsamı: sayfa/marj/font/yaslama/paragraf/başlık. Bölüm-sağ-sayfa,
// kicker, süs, drop-cap, ön sayfa, içindekiler, koşu başlığı SONRAKİ adımlarda.

import type { Block, BookMeta, LayoutSettings } from "@/lib/layout/paginate";
import type { BookSize, Margins } from "@/lib/layout/page";
import { smartQuoteBlocks, prepareMeta } from "@/lib/layout/prepare";
import { KDY_RULES } from "@/lib/layout/kdy";
import { runsToMarkup, escapeTypst } from "./escape";
import { buildPreamble, typstStr } from "./template";

export type TypstBookInput = {
  meta: BookMeta; // HAM — serializer cleanMeta+smartQuote uygular
  blocks: Block[]; // HAM — serializer smartQuoteBlocks uygular
  settings: LayoutSettings;
  size: BookSize; // mm
  margins: Margins; // mm
  gutter: number; // mm (inside'a eklenir)
  bleedMm: number;
  markOffsetMm: number;
  cropMarks: boolean;
};

// Bölüm açılışı (level-1 ana başlık): sağ-sayfa + üst boşluk + "BÖLÜM N" kicker +
// başlık (gerçek #heading → içindekiler/koşu başlığı görür) + süs.
function chapterOpen(b: Extract<Block, { type: "heading" }>, marker: string, s: LayoutSettings, contentHeightMm: number): string {
  const right = s.chapterStartsOnRightPage;
  const topMm = ((s.chapterTopRatio ?? 0.12) * contentHeightMm).toFixed(2);
  const orn = s.chapterOrnament ?? "none";
  const showKick = s.showChapterKicker ?? true;
  const kick = showKick && b.kicker ? `kicker: ${typstStr(b.kicker)}, ` : "";
  // marker (blok jetonu) sayfa kırılışından SONRA, başlığın yanında → konumu bölüm
  // sayfasını verir (kırılıştan önce olsa önceki sayfayı gösterirdi).
  const title = `${marker} #heading(level: 1, outlined: true)[${runsToMarkup(b.runs)}]`;
  return `#_chapter(${kick}ornament: "${orn}", right: ${right}, top: ${topMm}mm)[${title}]`;
}

// Bölümün İLK paragrafı: drop-cap. İlk grafem büyük baş harf; kalanı düz metin
// (drop-cap paragrafında satır-içi kalın/italik ender → düşürülür, v1).
function dropCapPara(b: Extract<Block, { type: "paragraph" }>): string {
  const plain = b.runs.map((r) => r.text).join("");
  const cap = [...plain][0] ?? "";
  if (!cap.trim()) return runsToMarkup(b.runs);
  const rest = plain.slice(cap.length);
  return `#_dropcap(${typstStr(cap)}, ${typstStr(rest)})`;
}

function blockToTypst(b: Block, contentWidthMm: number): string {
  switch (b.type) {
    case "heading":
      // Ara başlık (subhead): küçük ortalı; içindekilere girmez.
      if (b.subhead) return `#_subhead[${runsToMarkup(b.runs)}]`;
      return `#heading(level: ${b.level})[${runsToMarkup(b.runs)}]`;
    case "paragraph":
      return runsToMarkup(b.runs);
    case "blockquote":
      return `#block(inset: (x: ${KDY_RULES.blockquoteIndentMm}mm))[#emph[${runsToMarkup(b.runs)}]]`;
    case "blank":
      return "#v(0.8em)";
    case "pagebreak":
      // Yazar "sonraki sayfaya at" dedi → sonrasını yeni sayfaya it.
      return "#pagebreak(weak: true)";
    case "spacer":
      // Yazar "boşluk ekle" dedi → dikey boşluk (sayfa kenarında erimesi için weak).
      return `#v(${b.mm}mm, weak: true)`;
    case "image": {
      // Word'deki doğal genişlik; kolonu aşıyorsa ya da bilinmiyorsa kolona sığdır.
      const w =
        b.widthMm && b.widthMm <= contentWidthMm ? `${b.widthMm.toFixed(2)}mm` : "100%";
      return `#figure(image("${b.path}", width: ${w}))`;
    }
    case "table": {
      // Hücreler satır-satır; eksik hücreler boş ile doldurulur (dikdörtgen kalsın).
      const cols = Math.max(1, b.columns);
      const cells: string[] = [];
      for (const row of b.rows) {
        for (let c = 0; c < cols; c++) {
          cells.push(`[${row[c] ? runsToMarkup(row[c]) : ""}]`);
        }
      }
      // Tablo hücrelerinde gövde girintisi/yaslaması olmasın → kendi par'ı.
      return `#[#set par(first-line-indent: 0pt, justify: false); #table(columns: ${cols}, inset: 5pt, stroke: 0.5pt, ${cells.join(", ")})]`;
    }
    default:
      return "";
  }
}

export function bookToTypst(input: TypstBookInput): string {
  // 1) İçerik hazırlığı (JS motoruyla AYNI) — yoksa tırnak/tire ayrışır.
  const blocks = smartQuoteBlocks(input.blocks);
  const meta = prepareMeta(input.meta);

  // 2) Önsöz + gövde.
  const preamble = buildPreamble({ ...input, meta });
  const contentWidthMm = Math.max(
    20,
    input.size.width - input.margins.inside - input.margins.outside - input.gutter,
  );
  const contentHeightMm = Math.max(
    20,
    input.size.height - input.margins.top - input.margins.bottom,
  );

  const out: string[] = [];

  // Ön sayfa (showFrontMatter): başlık sayfası + biyografi + İÇİNDEKİLER. KDY ilk
  // 2 sayfayı (logo+künye) kendi ekler → iç PDF başlık sayfasıyla başlar. Sayfa
  // numarası ön sayfada gizli; gövdede 1'den başlasın diye sayaç sıfırlanır.
  if (input.settings.showFrontMatter) {
    if (meta.title || meta.author) {
      // Boş alt başlık/yayınevi → Typst `none` (o blok çizilmez).
      const sub = meta.subtitle?.trim() ? `[${escapeTypst(meta.subtitle)}]` : "none";
      const pub = meta.publisher?.trim() ? `[${escapeTypst(meta.publisher)}]` : "none";
      out.push(`#_titlepage([${escapeTypst(meta.title)}], ${sub}, [${escapeTypst(meta.author)}], ${pub})`);
    }
    const bioParas = meta.bio
      .split(/\n{2,}/)
      .map((p) => escapeTypst(p.replace(/\n/g, " ")).trim())
      .filter(Boolean)
      .join("\n\n");
    if (bioParas) out.push(`#_biopage[${bioParas}]`);
    out.push(`#_toc("İÇİNDEKİLER")`);
    out.push("#counter(page).update(1)");
  }

  // Durumlu gez: ana bölüm başlığı → açılış + drop-cap'i sıraya koy; sonraki ilk
  // paragraf drop-cap olur. Boş bloklar bekletmeyi bozmaz; diğerleri iptal eder.
  // Her GÖRÜNÜR bloğa konum-yakalayan görünmez işaret: context ile sayfa + y
  // (pt) bloğun değerine gömülür → query("<blk>") indeks+konum döndürür. idx ===
  // blocks[] dizini (tıklanabilir önizleme overlay'i için). Görünmez+sıfır
  // yükseklik → PDF dizgisini değiştirmez.
  const tag = (i: number) =>
    `#context [#metadata((idx: ${i}, p: here().page(), y: here().position().y / 1pt)) <blk>]`;
  const taggable = (b: Block) =>
    b.type === "heading" || b.type === "paragraph" || b.type === "blockquote" || b.type === "image" || b.type === "table";

  let pendingDropCap = false;
  blocks.forEach((b, i) => {
    const mk = taggable(b) ? tag(i) + "\n" : "";
    if (b.type === "heading" && b.level === 1 && !b.subhead) {
      out.push(chapterOpen(b, tag(i), input.settings, contentHeightMm));
      pendingDropCap = input.settings.dropCap;
      return;
    }
    if (b.type === "paragraph" && pendingDropCap) {
      out.push(mk + dropCapPara(b));
      pendingDropCap = false;
      return;
    }
    if (b.type !== "blank") pendingDropCap = false;
    out.push(mk + blockToTypst(b, contentWidthMm));
  });
  const body = out.filter((s) => s.length > 0).join("\n\n");

  return `${preamble}\n${body}\n`;
}
