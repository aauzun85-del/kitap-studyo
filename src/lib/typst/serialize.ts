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

function blockToTypst(b: Block): string {
  switch (b.type) {
    case "heading":
      return `#heading(level: ${b.level})[${runsToMarkup(b.runs)}]`;
    case "paragraph":
      return runsToMarkup(b.runs);
    case "blockquote":
      return `#block(inset: (x: ${KDY_RULES.blockquoteIndentMm}mm))[#emph[${runsToMarkup(b.runs)}]]`;
    case "blank":
      return "#v(0.8em)";
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
  const body = blocks
    .map(blockToTypst)
    .filter((s) => s.length > 0)
    .join("\n\n");

  return `${preamble}\n${body}\n`;
}
