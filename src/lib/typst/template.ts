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

// Kesim (kros) işaretleri — pdf.ts drawCropMarks geometrisinin Typst portu.
// Her trim köşesinde, taşma kenarı ile kâğıt kenarı arasındaki DIŞ bantta, trim
// kenarına hizalı dikey + yatay tik. Sayfa arka planına (#place, MediaBox mutlak)
// çizilir. cropMarks kapalıysa "none".
function cropMarksBg(pw: number, ph: number, to: number, bleedMm: number): string {
  const b = to - bleedMm; // dış bant genişliği (kros uzunluğu)
  if (b <= 0) return "none";
  const S = "0.4pt + black";
  const mm = (n: number) => `${n.toFixed(3)}mm`;
  const seg = (x1: number, y1: number, x2: number, y2: number) =>
    `place(top + left, line(start: (${mm(x1)}, ${mm(y1)}), end: (${mm(x2)}, ${mm(y2)}), stroke: ${S}))`;
  const marks = [
    seg(to, 0, to, b), seg(0, to, b, to), // sol-üst
    seg(pw - to, 0, pw - to, b), seg(pw - b, to, pw, to), // sağ-üst
    seg(to, ph - b, to, ph), seg(0, ph - to, b, ph - to), // sol-alt
    seg(pw - to, ph - b, pw - to, ph), seg(pw - b, ph - to, pw, ph - to), // sağ-alt
  ];
  return `{\n  ${marks.join("\n  ")}\n}`;
}

// Statik Typst yardımcıları (başlık seviyeleri + bölüm açılışı + drop-cap + ara
// başlık). String.raw → drop-cap ölçümündeki "\" satır-sonu kaçmasın. JS
// interpolasyonu YOK (hepsi sabit).
const HELPERS = String.raw`#set heading(numbering: none)
#show heading.where(level: 1): it => align(center, text(size: 20pt, weight: 700, it.body))
#show heading.where(level: 2): it => { v(0.7em, weak: true); set par(first-line-indent: 0pt, justify: false); align(center, text(size: 16pt, weight: 700, it.body)); v(14mm, weak: true) }
#show heading.where(level: 3): it => { v(0.6em, weak: true); set par(first-line-indent: 0pt, justify: false); text(size: 14pt, weight: 700, it.body); v(14mm, weak: true) }
#show heading.where(level: 4): it => { v(0.5em, weak: true); set par(first-line-indent: 0pt, justify: false); text(size: 12pt, weight: 700, it.body); v(14mm, weak: true) }
#let _subhead(body) = { v(0.5em, weak: true); set par(first-line-indent: 0pt, justify: false); align(center, text(size: 11pt, weight: 700, body)); v(14mm, weak: true) }
#let _chapter(kicker: none, ornament: "none", right: true, top: 30mm, body) = {
  if right { pagebreak(to: "odd", weak: true) } else { pagebreak(weak: true) }
  v(top)
  if kicker != none { set par(first-line-indent: 0pt, justify: false); align(center, text(size: 11pt, weight: 700, tracking: 0.12em)[#upper(kicker)]); v(0.5em) }
  body
  if ornament == "rule" { v(0.4em); align(center, line(length: 14%, stroke: 0.6pt + black)) }
  if ornament == "dots" { v(0.3em); align(center, text(size: 13pt)[• • •]) }
  v(14mm)
}
#let _dropcap(cap, rest, lines: 2, gap: 0.25em) = layout(bounds => context {
  if rest.trim() == "" { text(size: 1.8em, weight: 700)[#cap] } else {
    let W = bounds.width
    let pitch = measure(box(width: 4cm)[a\ a]).height - measure(box[a]).height
    let cs = lines * pitch
    let capt = text(size: cs, weight: 700, top-edge: "cap-height", bottom-edge: "baseline")[#cap]
    let cw = measure(box(capt)).width
    let iw = cw + gap
    let fw = W - iw
    let words = rest.split(" ")
    let hgt(n) = measure(box(width: fw)[#set par(justify: false); #words.slice(0, calc.min(n, words.len())).join(" ")]).height
    let limit = lines * pitch + pitch * 0.3
    let n = 1
    while n < words.len() and hgt(n + 1) <= limit { n = n + 1 }
    let head = words.slice(0, n).join(" ")
    let tail = if n < words.len() { words.slice(n).join(" ") } else { "" }
    grid(columns: (iw, fw), gutter: 0pt, place(top + left, capt), box(width: fw)[#set par(justify: true, first-line-indent: 0pt); #head])
    if tail != "" { box(width: 100%)[#set par(justify: true, first-line-indent: 0pt); #tail] }
  }
})
#set outline.entry(fill: repeat(gap: 2.5pt)[.])
// Koşu başlığı/sayfa no'yu ön sayfada VE bölüm açılış sayfasında gizle.
#let _suppress() = {
  let p = here().page()
  let bs = query(heading.where(level: 1)).filter(h => h.location().page() <= p)
  bs.len() == 0 or bs.any(h => h.location().page() == p)
}
#let _runHead(bookTitle) = context if not _suppress() {
  set text(size: 9pt, style: "italic")
  if calc.odd(here().page()) {
    let bs = query(heading.where(level: 1)).filter(h => h.location().page() <= here().page())
    if bs.len() > 0 { align(right, bs.last().body) }
  } else { align(left, bookTitle) }
}
#let _pageFoot() = context if not _suppress() {
  set text(size: 9pt)
  let n = counter(page).display()
  if calc.odd(here().page()) { align(right, n) } else { align(left, n) }
}
#let _titlepage(title, author) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt, justify: false)
  #v(32%)
  #align(center, text(size: 22pt, weight: 700, title))
  #v(1.5em)
  #align(center, text(size: 12pt, weight: 700, author))
]
#let _biopage(body) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt, justify: true, leading: 0.6em)
  #set text(size: 9pt)
  #v(18%)
  #body
]
#let _toc(title) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt)
  #align(center, text(size: 11pt, weight: 600, title))
  #v(0.9em)
  #outline(title: none, target: heading.where(level: 1))
]
`;

export function buildPreamble(input: TypstBookInput): string {
  const { settings: s, size, margins: m, gutter, bleedMm, markOffsetMm, cropMarks, meta } = input;
  // to = kesim çizgisinin kâğıt kenarına uzaklığı (pdf.ts:377 ile birebir).
  const to = cropMarks && bleedMm > 0 ? markOffsetMm : bleedMm;
  const pageWnum = size.width + 2 * to;
  const pageHnum = size.height + 2 * to;
  const pageW = pageWnum.toFixed(3);
  const pageH = pageHnum.toFixed(3);
  const background = cropMarks && bleedMm > 0 ? cropMarksBg(pageWnum, pageHnum, to, bleedMm) : "none";
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
${HELPERS}
#set document(title: ${typstStr(meta.title)}, author: ${typstStr(meta.author)})
#set page(
  width: ${pageW}mm,
  height: ${pageH}mm,
  margin: (top: ${mTop}mm, bottom: ${mBot}mm, inside: ${mIn}mm, outside: ${mOut}mm),
  binding: left,
  numbering: none,
  header: ${s.showRunningHeads ? `_runHead(${typstStr(meta.title)})` : "none"},
  footer: ${s.showPageNumbers ? "_pageFoot()" : "none"},
  background: ${background},
)
#set text(font: ${fontExpr}, size: ${s.bodySizePt}pt, lang: "tr", region: "TR", hyphenate: ${s.hyphenate})
#set par(justify: ${justify}, leading: ${leading}, first-line-indent: (amount: ${indent}mm, all: true), spacing: ${leading} + ${paraSpacing}mm, linebreaks: ${linebreaks})
#set smartquote(enabled: false)
`;
}

// Typst string literali (çift tırnaklı; yalnız \ ve " kaçırılır — içerik kaçışı DEĞİL).
export function typstStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}
