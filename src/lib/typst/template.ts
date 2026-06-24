// Typst önsöz (preamble) — sayfa geometrisi + #set kuralları + #show yardımcıları.
// Tek dizge döner; tüm "görünüm" buradan okunur (diff'lenebilir).

import type { TypstBookInput } from "./serialize";
import { typstFontExpr } from "./fonts";

// Typst leading = satır KUTULARI arası boşluk; bizim leadingPt = taban-taban
// toplam satır yüksekliği. ÖLÇÜMLE kalibre edildi (Vollkorn 11pt): leading=4pt →
// pitch 11.4pt, yani satır kutusu ≈ 0.67·punto. Hedef pitch = leadingPt →
// leading = leadingPt - 0.67·punto. (Otomatik: ~%120 ≈ 0.53·punto leading.)
const FONT_BOX_RATIO = 0.67;
function leadingExpr(leadingPt: number, bodySizePt: number): string {
  const lead = leadingPt > 0 ? leadingPt - FONT_BOX_RATIO * bodySizePt : 0.53 * bodySizePt;
  return `${Math.max(0, lead).toFixed(2)}pt`;
}

export function buildPreamble(input: TypstBookInput): string {
  const { settings: s, size, margins: m, gutter, bleedMm, markOffsetMm, cropMarks, meta } = input;
  // to = kesim çizgisinin kâğıt kenarına uzaklığı (pdf.ts:377 ile birebir).
  const to = cropMarks && bleedMm > 0 ? markOffsetMm : bleedMm;
  const pageW = (size.width + 2 * to).toFixed(3);
  const pageH = (size.height + 2 * to).toFixed(3);
  const mTop = (to + m.top).toFixed(3);
  const mBot = (to + m.bottom).toFixed(3);
  const mIn = (to + m.inside + gutter).toFixed(3);
  const mOut = (to + m.outside).toFixed(3);

  const fontExpr = typstFontExpr(s.bodyFontFamily);
  const justify = s.align === "justify";
  const leading = leadingExpr(s.leadingPt, s.bodySizePt);
  const indent = s.firstLineIndentMm;
  const paraSpacing = s.paragraphSpacingMm;
  const linebreaks = s.lineBreak === "greedy" ? '"simple"' : '"optimized"';

  return `// otomatik üretilen — Block[] → Typst (mizanpaj motoru)
#set document(title: ${typstStr(meta.title)}, author: ${typstStr(meta.author)})
#set page(
  width: ${pageW}mm,
  height: ${pageH}mm,
  margin: (top: ${mTop}mm, bottom: ${mBot}mm, inside: ${mIn}mm, outside: ${mOut}mm),
  binding: left,
  numbering: ${s.showPageNumbers ? '"1"' : "none"},
)
#set text(font: ${fontExpr}, size: ${s.bodySizePt}pt, lang: "tr", region: "TR", hyphenate: ${s.hyphenate})
#set par(justify: ${justify}, leading: ${leading}, first-line-indent: (amount: ${indent}mm, all: false), spacing: ${leading} + ${paraSpacing}mm, linebreaks: ${linebreaks})
#set smartquote(enabled: false)
#set heading(numbering: none)
#show heading: it => {
  set text(weight: 700)
  set par(first-line-indent: 0pt, justify: false, leading: 0.5em)
  let sz = (24pt, 20pt, 18pt, 16pt).at(it.level - 1, default: 16pt)
  v(0.8em)
  if it.level <= 2 { align(center, text(size: sz, it.body)) } else { text(size: sz, it.body) }
  v(0.4em)
}
`;
}

// Typst string literali (çift tırnaklı; yalnız \ ve " kaçırılır — içerik kaçışı DEĞİL).
export function typstStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}
