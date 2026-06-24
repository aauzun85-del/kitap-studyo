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
import { runsToMarkup } from "./escape";
import { buildPreamble } from "./template";

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

function blockToTypst(b: Block, contentWidthMm: number): string {
  switch (b.type) {
    case "heading":
      return `#heading(level: ${b.level})[${runsToMarkup(b.runs)}]`;
    case "paragraph":
      return runsToMarkup(b.runs);
    case "blockquote":
      return `#block(inset: (x: ${KDY_RULES.blockquoteIndentMm}mm))[#emph[${runsToMarkup(b.runs)}]]`;
    case "blank":
      return "#v(0.8em)";
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
  const body = blocks
    .map((b) => blockToTypst(b, contentWidthMm))
    .filter((s) => s.length > 0)
    .join("\n\n");

  return `${preamble}\n${body}\n`;
}
