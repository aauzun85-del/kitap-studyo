// Block[] → Typst markup (ÇEKİRDEK). Saf, deterministik, ölçümsüz (Typst kendi
// ölçer) → golden-string snapshot ile test edilebilir. İçerik hazırlığını
// (akıllı tırnak/tire/meta temizliği) prepare.ts'ten ÖNCE uygular ki iki motor
// ayrışmasın.
//
// İLK DİLİM kapsamı: sayfa/marj/font/yaslama/paragraf/başlık. Bölüm-sağ-sayfa,
// kicker, süs, drop-cap, ön sayfa, içindekiler, koşu başlığı SONRAKİ adımlarda.

import type { Block, BookMeta, LayoutSettings, Run } from "@/lib/layout/paginate";
import type { BookSize, Margins } from "@/lib/layout/page";
import { smartQuoteBlocks, prepareMeta } from "@/lib/layout/prepare";
import { countFootnotes } from "@/lib/layout/footnotes";
import { KDY_RULES } from "@/lib/layout/kdy";
import { runsToMarkup, escapeTypst } from "./escape";
import { buildPreamble, typstStr, upperTr } from "./template";
import { typstFontExpr } from "./fonts";

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
function chapterOpen(
  b: Extract<Block, { type: "heading" }>,
  marker: string,
  s: LayoutSettings,
  contentHeightMm: number,
  num: number | null,
  label: string,
): string {
  const right = s.chapterStartsOnRightPage;
  // Bölüm başında üst boşluk yok (kullanıcı isteği): başlık sayfanın en üstünden.
  const topMm = ((s.chapterTopRatio ?? 0) * contentHeightMm).toFixed(2);
  const orn = s.chapterOrnament ?? "none";
  const showKick = s.showChapterKicker ?? true;
  // Kicker BÜYÜK HARFE JS'te çevrilir (Türkçe i/İ doğru olsun).
  const kick = showKick && b.kicker ? `kicker: ${typstStr(upperTr(b.kicker, s.lang))}, ` : "";
  const numArg = num != null ? `num: "${num}", ` : "";
  // Bölüm adının Türkçe BÜYÜK HARF hâli (JS'te): "aralıklı büyük harf" başlık
  // biçimi ve "büyük harf" koşu başlığı bunu gösterir. Başlığın kendisi (içindekiler)
  // özgün yazımıyla kalır.
  const plainTitle = b.runs.map((r) => r.text).join("");
  // Aralıklı büyük harf başlık <chup>'ı GÖSTERİR (dipnot işareti dahil — başlığın
  // kendisi gösterilmez, dipnot bir kez basılır).
  const chup =
    s.chapterStyle === "spaced-caps"
      ? ` #metadata([${runsToMarkup(upperRuns(b.runs, s.lang))}]) <chup>`
      : "";
  // Koşu başlığı kaydı: dipnotsuz düz + büyük harf hâli. Bölüm adı (sonnot grupları).
  const chrh = ` #metadata((plain: [${runsToMarkup(b.runs, { noFn: true })}], up: ${typstStr(upperTr(plainTitle, s.lang))})) <chrh> #_chs.update(${typstStr(plainTitle.trim())})`;
  const runs = b.runs;
  // marker (blok jetonu) sayfa kırılışından SONRA, başlığın yanında → konumu bölüm
  // sayfasını verir (kırılıştan önce olsa önceki sayfayı gösterirdi).
  // Etiket: konsept içindekiler düzenleri sayfa numarasını buradan bulur.
  const title = `${marker}${chup}${chrh} #heading(level: 1, outlined: true)[${runsToMarkup(runs)}] <${label}>`;
  return `#_chapter(${kick}${numArg}ornament: "${orn}", right: ${right}, top: ${topMm}mm)[${title}]`;
}

/** Run metinlerini kitabın diline göre büyük harfe çevirir (biçim korunur). */
function upperRuns(runs: Run[], lang?: "tr" | "en"): Run[] {
  return runs.map((r) => ({ ...r, text: upperTr(r.text, lang) }));
}

// Numara almayan bölümler (ön söz, giriş, sonsöz…): "iri numara" biçiminde boş kalır.
// Türkçe küçük harfe indirilmiş metinde, sözcük sınırıyla aranır ("GİRİŞ" eşleşir,
// "Girişimcilik" eşleşmez).
const UNNUMBERED =
  /^(önsöz|ön söz|giriş|sunuş|takdim|sonsöz|son söz|sonuç|epilog|prolog|teşekkür|kaynakça|kaynaklar|dizin|ek|ekler|notlar|sözlük|preface|foreword|introduction|epilogue|afterword|acknowledgements?|bibliography|references|index|notes|appendix)(?!\p{L})/u;

// "Kaynakça" bölümü (konsept kaynakça düzeni bu bölümün paragraflarına uygulanır).
const BIBLIOGRAPHY = /^(kaynakça|kaynaklar|kaynak listesi|bibliyografya|bibliography|references|works cited)(?!\p{L})/u;
/** Başlık bir kaynakça adı mı? Türkçe ve İngilizce küçük harfe çevirerek
 *  denenir ("BIBLIOGRAPHY" Türkçe kuralla "bıblıography" olur). */
export function isBibliographyTitle(text: string): boolean {
  const t = text.trim();
  return BIBLIOGRAPHY.test(t.toLocaleLowerCase("tr")) || BIBLIOGRAPHY.test(t.toLocaleLowerCase("en"));
}

// Kicker'daki bölüm numarası ("BÖLÜM 3", "BÖLÜM XII", "Üçüncü Bölüm") → sayı.
const ORDINALS: Record<string, number> = {
  birinci: 1, ikinci: 2, üçüncü: 3, dördüncü: 4, beşinci: 5, altıncı: 6, yedinci: 7, sekizinci: 8, dokuzuncu: 9,
  onuncu: 10, yirminci: 20, otuzuncu: 30, kırkıncı: 40, ellinci: 50,
};
const TENS: Record<string, number> = { on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50 };
function romanToInt(r: string): number | null {
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let n = 0;
  const s = r.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]];
    const b = v[s[i + 1]] ?? 0;
    if (!a) return null;
    n += a < b ? -a : a;
  }
  return n > 0 && n < 400 ? n : null;
}
function kickerNumber(kicker: string | undefined): number | null {
  if (!kicker) return null;
  const t = kicker.toLocaleLowerCase("tr");
  const d = /\d+/.exec(t);
  if (d) return Number(d[0]);
  const r = /(?:^|\s)([ivxlcdm]+)(?:\s|$|[.:])/.exec(t);
  if (r) {
    const n = romanToInt(r[1]);
    if (n) return n;
  }
  const words = t.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (ORDINALS[w] != null) {
      const prev = i > 0 ? TENS[words[i - 1]] : undefined;
      return (prev && ORDINALS[w] < 10 ? prev : 0) + ORDINALS[w];
    }
  }
  return null;
}

// Sahne ayracı satırı: "* * *", "***", "#", "~", "•••", "⁂", "❦", "---" …
// (prepare.ts "---"yi "—"ya çevirir → tek tire de ayraçtır.)
const SCENE_BREAK = /^\s*(?:(?:\*\s*){1,3}|#{1,3}|~{1,3}|•(?:\s*•){0,2}|⁂|❦|§|[—–]|[-–—](?:\s*[-–—]){2,})\s*$/u;

/** Bölümün ilk paragrafı: ilk kelimeler (en çok 4, ilk virgül/noktaya kadar)
 *  büyük harf + küçük punto. Satır içi kalın/italik korunur. */
function leadCapsPara(runs: Run[], lang?: "tr" | "en"): string {
  const plain = runs.map((r) => r.text).join("");
  // Baştaki kelimeleri say: 4 kelime ya da ilk noktalama.
  const m = /^\s*(\S+(?:\s+\S+){0,3})/u.exec(plain);
  if (!m) return runsToMarkup(runs);
  let leadLen = m[0].length;
  const punct = m[0].search(/[,.;:!?…]/u);
  if (punct > 0) leadLen = punct + 1;
  // Run'ları baş / kalan olarak böl.
  const lead: Run[] = [];
  const rest: Run[] = [];
  let used = 0;
  for (const r of runs) {
    if (r.fn) {
      // Dipnot işareti yerinde kalır (baş kısmın içindeyse başla birlikte).
      (used >= leadLen ? rest : lead).push(r);
      continue;
    }
    if (used >= leadLen) {
      rest.push(r);
      continue;
    }
    const take = Math.min(r.text.length, leadLen - used);
    if (take > 0) lead.push({ ...r, text: upperTr(r.text.slice(0, take), lang) });
    if (take < r.text.length) rest.push({ ...r, text: r.text.slice(take) });
    used += r.text.length;
  }
  // "]" sonrası "(" ";" "." Typst'te çağrı/alan sanılır → kaçır (runsToMarkup'taki tuzak).
  let restMarkup = runsToMarkup(rest);
  if (/^[(;.]/.test(restMarkup)) restMarkup = "\\" + restMarkup;
  return `#_lead[${runsToMarkup(lead)}]${restMarkup}`;
}

// Bölümün İLK paragrafı: drop-cap. İlk grafem büyük baş harf; kalanı düz metin
// (drop-cap paragrafında satır-içi kalın/italik ender → düşürülür, v1).
function dropCapPara(b: Extract<Block, { type: "paragraph" }>): string {
  // Dipnotlu paragrafta büyük baş harf yapılmaz (baş harf düz metinle çizilir,
  // dipnot kaybolurdu).
  if (b.runs.some((r) => r.fn)) return runsToMarkup(b.runs);
  const plain = b.runs.map((r) => r.text).join("");
  const cap = [...plain][0] ?? "";
  if (!cap.trim()) return runsToMarkup(b.runs);
  const rest = plain.slice(cap.length);
  return `#_dropcap(${typstStr(cap)}, ${typstStr(rest)})`;
}

// Blok-bazlı yazı tipi/punto geçersiz kılması (biçim çubuğundan): içerik bir
// #set text(...) kapsamına sarılır. Geçersiz kılma yoksa içerik aynen döner.
function fmtWrap(
  b: Extract<Block, { type: "paragraph" | "heading" | "blockquote" }>,
  inner: string,
): string {
  const sets: string[] = [];
  if (b.fontFamily) sets.push(`font: ${typstStr(b.fontFamily)}`);
  if (b.sizePt != null) sets.push(`size: ${b.sizePt}pt`);
  if (!sets.length) return inner;
  return `#[#set text(${sets.join(", ")}); ${inner}]`;
}

function blockToTypst(b: Block, contentWidthMm: number, s?: LayoutSettings): string {
  // Deneysel şiir düzeni: gövde soldan içeri alınır.
  const inset = (inner: string) =>
    s?.bodyInsetMm && s.bodyInsetMm > 0 ? `#pad(left: ${s.bodyInsetMm.toFixed(1)}mm)[${inner}]` : inner;
  switch (b.type) {
    case "heading": {
      // "Sola, büyük harf" ara başlık biçimi: metin JS'te büyük harfe çevrilir.
      const runs = s?.subheadStyle === "left-caps" ? upperRuns(b.runs, s.lang) : b.runs;
      // Blok-bazlı yazı tipi (biçim çubuğu) başlığın kendi yazı tipi kuralını
      // geçmeli: ara başlığa argüman, başlığa yerel "show heading" kuralı.
      const fontArg = b.fontFamily ? `font: ${typstFontExpr(b.fontFamily)}, ` : "";
      const sizeOnly = { ...b, fontFamily: undefined };
      // Ara başlık (subhead): küçük ortalı; içindekilere girmez.
      if (b.subhead) return fmtWrap(sizeOnly, `#_subhead(${fontArg}[${runsToMarkup(runs)}])`);
      const h = `#heading(level: ${b.level})[${runsToMarkup(runs)}]`;
      return fmtWrap(sizeOnly, b.fontFamily ? `#[#show heading: set text(font: ${typstFontExpr(b.fontFamily)}); ${h}]` : h);
    }
    case "paragraph": {
      // Sahne ayracı satırı → konseptin işareti, ortalı.
      const plain = b.runs.map((r) => r.text).join("");
      if (SCENE_BREAK.test(plain)) return "#_scene()";
      return fmtWrap(b, inset(runsToMarkup(b.runs)));
    }
    case "blockquote":
      return fmtWrap(b, inset(`#_quote(${KDY_RULES.blockquoteIndentMm}mm)[${runsToMarkup(b.runs)}]`));
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

/** Bölüm başlıklarının numaraları (yazarın kicker'ı öncelikli; ön söz/giriş
 *  numarasız) — gövde ve konsept içindekiler AYNI numarayı kullanır. */
function chapterNumbers(blocks: Block[]): Map<number, number | null> {
  const out = new Map<number, number | null>();
  let n = 0;
  blocks.forEach((b, i) => {
    if (!(b.type === "heading" && b.level === 1 && !b.subhead)) return;
    const plain = b.runs.map((r) => r.text).join("").trim();
    const k = kickerNumber(b.kicker);
    if (k != null) out.set(i, (n = k));
    else out.set(i, UNNUMBERED.test(plain.toLocaleLowerCase("tr")) ? null : ++n);
  });
  return out;
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

  // Dipnotlar: kitap sonu "Notlar" bölümü (varsa kaynakçadan ÖNCE).
  const fnPlace = input.settings.footnotePlacement ?? "page";
  const hasNotes = countFootnotes(blocks) > 0;
  const notesChapter = hasNotes && fnPlace === "book";
  const notesTitle = input.settings.lang === "en" ? "Notes" : "Notlar";
  // Kitabın SONUNDAKİ kaynakça bölüm(ler)inden önce; sonda kaynakça yoksa en sona.
  let notesAt = -1;
  if (notesChapter) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.type !== "heading" || b.level !== 1 || b.subhead) continue;
      if (isBibliographyTitle(b.runs.map((r) => r.text).join(""))) notesAt = i;
      else break;
    }
  }
  // Notlar bölümü sıradan bir bölüm gibi açılır (başlık biçimi, koşu başlığı kaydı).
  const notesOpen = () =>
    chapterOpen(
      { type: "heading", level: 1, runs: [{ text: notesTitle, bold: false, italic: false }] },
      "",
      input.settings,
      contentHeightMm,
      null,
      "ks-notes",
    ) + "\n#_endnotesAll()";

  // Ön sayfa (showFrontMatter): başlık sayfası + biyografi + İÇİNDEKİLER. KDY ilk
  // 2 sayfayı (logo+künye) kendi ekler → iç PDF başlık sayfasıyla başlar. Sayfa
  // numarası ön sayfada gizli; gövdede 1'den başlasın diye sayaç sıfırlanır.
  if (input.settings.showFrontMatter) {
    if (meta.title || meta.author) {
      // Boş alt başlık/yayınevi → Typst `none` (o blok çizilmez).
      const sub = meta.subtitle?.trim() ? `[${escapeTypst(meta.subtitle)}]` : "none";
      // Yazar/yayınevi BÜYÜK HARF (JS'te, Türkçe kuralıyla).
      const pubU = meta.publisher?.trim() ? `[${escapeTypst(upperTr(meta.publisher, input.settings.lang))}]` : "none";
      out.push(
        `#_titlepage([${escapeTypst(meta.title)}], ${sub}, [${escapeTypst(upperTr(meta.author, input.settings.lang))}], ${pubU})`,
      );
    }
    const bioParas = meta.bio
      .split(/\n{2,}/)
      .map((p) => escapeTypst(p.replace(/\n/g, " ")).trim())
      .filter(Boolean)
      .join("\n\n");
    if (bioParas) out.push(`#_biopage[${bioParas}]`);
    const tocTitle = input.settings.lang === "en" ? "CONTENTS" : "İÇİNDEKİLER";
    const tocStyle = input.settings.tocStyle ?? "classic";
    // Başlıkta dipnot varsa veya "Notlar" bölümü eklenecekse klasik içindekiler
    // de liste ile çizilir (Typst outline'ı dipnotu ikinci kez basardı).
    const headFn = blocks.some((b) => b.type === "heading" && b.level === 1 && b.runs.some((r) => r.fn));
    if (tocStyle === "none") {
      // İçindekiler istenmedi: sayfa basılmaz.
    } else if (tocStyle === "classic" && !headFn && !notesChapter) out.push(`#_toc("${tocTitle}")`);
    else {
      // Konsept düzeni: (etiket, numara, özgün başlık) listesi; sayfa no Typst'ten.
      const nums = chapterNumbers(blocks);
      const entries = blocks
        .map((b, i) =>
          b.type === "heading" && b.level === 1 && !b.subhead
            ? (i === notesAt ? `("ks-notes", "", [${notesTitle}]), ` : "") +
              `("ks-ch-${i}", "${nums.get(i) ?? ""}", [${runsToMarkup(b.runs, { noFn: true })}])`
            : null,
        )
        .filter(Boolean);
      if (notesChapter && notesAt === -1) entries.push(`("ks-notes", "", [${notesTitle}])`);
      out.push(`#_toc2("${tocTitle}", (${entries.join(", ")}${entries.length === 1 ? "," : ""}))`);
    }
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
  // Bölümün ilk paragrafı: ilk kelimeler büyük harf (drop-cap yoksa).
  let pendingLead = false;
  // Bölüm numarası ("iri numara" biçimleri): ön söz/giriş gibi bölümler sayılmaz.
  const chapterNums = chapterNumbers(blocks);
  // Kaynakça bölümündeyiz mi (konsept kaynakça düzeni açıksa)? Giriş sayacı.
  const bibOn = !["none", "off"].includes(input.settings.bibStyle ?? "none");
  let inBib = false;
  // Kaynakçayı açan başlığın seviyesi: altındaki ara başlıklar ("Kitaplar",
  // "Makaleler") kaynakçayı bitirmez; aynı/üst seviyeden başlık bitirir.
  let bibLevel = 0;
  let bibNo = 0;
  // TİPOGRAFİ kural 6: ardışık akış-içi başlıklar arasında tam önce-boşluğu
  // (_hb) değil dar boşluk (_ht) kullanılır — önceki bloğu serializer bilir.
  let prevInlineHeading = false;
  blocks.forEach((b, i) => {
    const mk = taggable(b) ? tag(i) + "\n" : "";
    if (b.type === "heading" && b.level === 1 && !b.subhead) {
      // Bölüm sonu notları: önceki bölümün notları yeni bölüm açılmadan basılır.
      if (hasNotes && fnPlace === "chapter") out.push(`#_endnotes(${typstStr(notesTitle)})`);
      if (notesChapter && i === notesAt) out.push(notesOpen());
      const plain = b.runs.map((r) => r.text).join("").trim();
      const num = chapterNums.get(i) ?? null;
      inBib = bibOn && isBibliographyTitle(plain);
      bibLevel = 1;
      bibNo = 0;
      out.push(chapterOpen(b, tag(i), input.settings, contentHeightMm, num, `ks-ch-${i}`));
      // Kaynakça bölümünde ilk girişe büyük baş harf / büyük harf açılış gelmez.
      pendingDropCap = input.settings.dropCap && !inBib;
      pendingLead = !input.settings.dropCap && !!input.settings.firstWordsCaps && !inBib;
      prevInlineHeading = false;
      return;
    }
    if (b.type === "paragraph" && pendingDropCap) {
      out.push(mk + dropCapPara(b));
      pendingDropCap = false;
      prevInlineHeading = false;
      return;
    }
    if (b.type === "paragraph" && pendingLead && !b.fontFamily && b.sizePt == null) {
      out.push(mk + leadCapsPara(b.runs, input.settings.lang));
      pendingLead = false;
      prevInlineHeading = false;
      return;
    }
    if (b.type !== "blank") {
      pendingDropCap = false;
      pendingLead = false;
    }
    if (b.type === "heading") {
      // Kaynakça, kitabın yapısına göre ara başlık da olabilir ("BÖLÜM N"li
      // kitaplarda bölüm sayılmayan başlıklar ara başlığa iner): başlık bir
      // kaynakça adıysa bölümden sonraki girişler kaynakça düzenini alır; başka
      // bir başlık gelince biter.
      const hPlain = b.runs.map((r) => r.text).join("");
      // Ara başlık (subhead) kaynakça içinde alt grup sayılır.
      const hLevel = b.subhead ? 9 : b.level;
      if (bibOn && isBibliographyTitle(hPlain)) {
        inBib = true;
        bibLevel = hLevel;
        bibNo = 0;
      } else if (inBib && hLevel <= bibLevel) {
        inBib = false;
      }
      // Akış-içi başlık (L2+/ara başlık). _hpre = çapa + alt-bölge kararı +
      // önce-boşluk (kural 1/3/6/7; ardışıkta dar boşluk). Konum işareti (mk)
      // _hpre'den SONRA → sayfa kırılırsa tıkla-düzenle bandı doğru sayfayı
      // görür. Başlığın show kuralı: sticky blok + sonra-boşluk (kural 2/5).
      out.push(`#_hpre(${prevInlineHeading})\n` + mk + blockToTypst(b, contentWidthMm, input.settings));
      prevInlineHeading = true;
      return;
    }
    if (b.type !== "blank" && b.type !== "spacer") prevInlineHeading = false;
    // Kaynakça girişi: konseptin kaynakça düzeni (asılı girinti / numaralı / sade).
    if (
      inBib &&
      b.type === "paragraph" &&
      b.runs.some((r) => r.text.trim()) &&
      !SCENE_BREAK.test(b.runs.map((r) => r.text).join(""))
    ) {
      out.push(mk + fmtWrap(b, `#_bib(${++bibNo})[${runsToMarkup(b.runs)}]`));
      return;
    }
    out.push(mk + blockToTypst(b, contentWidthMm, input.settings));
  });
  if (hasNotes && fnPlace === "chapter") out.push(`#_endnotes(${typstStr(notesTitle)})`);
  if (notesChapter && notesAt === -1) out.push(notesOpen());
  const body = out.filter((s) => s.length > 0).join("\n\n");

  return `${preamble}\n${body}\n`;
}
