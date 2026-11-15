// Typst önsöz (preamble) — sayfa geometrisi + #set kuralları + #show yardımcıları.
// Tek dizge döner; tüm "görünüm" buradan okunur (diff'lenebilir).

import type { TypstBookInput } from "./serialize";
import { typstFontExpr } from "./fonts";
import { TYPOGRAPHY_RULES } from "@/lib/layout/typographyRules";

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
// Başlıklar ASLA yaslanmaz + hecelenmez (dizgi kuralı): gövdenin justify/
// hyphenate ayarı başlığa sızarsa kelime araları açılır ve "YÖN-TEMİ" gibi
// heceden bölünmeler çıkar.
//
// TİPOGRAFİ KURALLARI (typographyRules.ts — iki motor ortak):
//  • Önce-boşluğu (_hb / ardışıkta _ht) SERİALİZER emit eder (önceki bloğu o
//    bilir, kural 6); v(weak) sayfa başında kendiliğinden düşer (kural 7).
//  • _hguard: başlık, kullanılabilir yüksekliğin son bölgesinde başlayamaz
//    (kural 3) — sınır _hlim önsözde hesaplanır.
//  • block(sticky, breakable: false): başlık sayfa sonunda tek kalamaz, takip
//    eden bloğa yapışır (kural 2/5); Typst'in dul/yetim maliyeti ilk satırın
//    yalnız kalmasını zaten engeller (kural 4). below: _ha = sonra 1 satır.
// İÇ TASARIM KONSEPTİ: _cfg (önsözde) bölüm/ara başlık/alıntı/üst bilgi/sayfa
// numarası/sahne ayracı biçimini; _hf başlık yazı tipini taşır. Varsayılanlar
// bugünkü görünümün aynısıdır. BÜYÜK HARF dönüşümleri JS'te Türkçe kuralıyla
// yapılır (Typst upper() "i"yi "I" yapar, "İ" değil).
#let _poem = _cfg.chapter == "poem-left" or _cfg.chapter == "poem-center"
#let _chleft = _cfg.chapter in ("left-rule", "minimal-left", "numeral-left", "boxed", "poem-left")
#let _subal = if _cfg.sub == "center" { center } else { left }
#let _subsize = if _cfg.sub == "left-caps" { 10.5pt } else if _cfg.sub == "left" { 14.5pt } else { 16pt }
// Başlıkların yazı tipi: TEK show-set kuralı (biçim çubuğundaki blok-bazlı yazı
// tipi, başlığın yanında yerel bir "show heading" kuralıyla bunu geçer).
#show heading: set text(font: _hf)
#show heading.where(level: 1): it => {
  set par(first-line-indent: 0pt, justify: false)
  set text(hyphenate: false)
  let st = _cfg.chapter
  let k = _cfg.scale
  // Aralıklı büyük harf: görünen başlık, JS'te Türkçe kuralıyla büyük harfe
  // çevrilmiş <chup> kaydından okunur (içindekiler özgün yazımı gösterir).
  if st == "spaced-caps" { context { let ups = query(selector(<chup>).before(here())); align(center, text(size: 15pt * k, weight: 400, tracking: 0.18em, if ups.len() > 0 { ups.last().value } else { it.body })) } }
  else if st == "ornament" { align(center, text(size: 19pt * k, weight: 400, style: "italic", it.body)) }
  else if st == "left-rule" { align(left, text(size: 20pt * k, weight: 700, it.body)); v(0.5em, weak: false); line(length: 100%, stroke: 0.6pt) }
  else if st == "minimal-left" { align(left, text(size: 26pt * k, weight: 400, it.body)) }
  else if st == "numeral-left" or st == "boxed" { align(left, text(size: 21pt * k, weight: 700, it.body)) }
  else if st == "numeral-center" { align(center, text(size: 19pt * k, weight: 600, it.body)) }
  else if st == "poem-left" { align(left, text(size: 12.5pt * k, weight: 600, it.body)) }
  else if st == "poem-center" { align(center, text(size: 13pt * k, weight: 400, style: "italic", it.body)) }
  else { align(center, text(size: 20pt * k, weight: 700, it.body)) }
}
#show heading.where(level: 2): it => block(sticky: true, breakable: false, width: 100%, above: 0pt, below: _ha, { set par(first-line-indent: 0pt, justify: false); set text(hyphenate: false); align(_subal, text(size: _subsize, weight: 700, tracking: if _cfg.sub == "left-caps" { 0.1em } else { 0pt }, it.body)) })
#show heading.where(level: 3): it => block(sticky: true, breakable: false, width: 100%, above: 0pt, below: _ha, { set par(first-line-indent: 0pt, justify: false); set text(hyphenate: false); text(size: 14pt, weight: 700, it.body) })
#show heading.where(level: 4): it => block(sticky: true, breakable: false, width: 100%, above: 0pt, below: _ha, { set par(first-line-indent: 0pt, justify: false); set text(hyphenate: false); text(size: 12pt, weight: 700, it.body) })
#let _subhead(font: _hf, body) = block(sticky: true, breakable: false, width: 100%, above: 0pt, below: _ha, { set par(first-line-indent: 0pt, justify: false); set text(hyphenate: false, font: font); align(_subal, text(size: 11pt, weight: 700, tracking: if _cfg.sub == "left-caps" { 0.1em } else { 0pt }, body)) })
#let _orn = ("EB Garamond", "Cormorant Garamond", "Source Serif 4")
#let _chapter(kicker: none, ornament: "none", right: true, top: 30mm, num: none, body) = {
  let st = _cfg.chapter
  if _cfg.newpage { if right { pagebreak(to: "odd", weak: true) } else { pagebreak(weak: true) } } else { v(2.2em, weak: true) }
  v(top)
  let al = if _chleft { left } else { center }
  let head = {
    set par(first-line-indent: 0pt, justify: false)
    set text(hyphenate: false)
    if st == "numeral-left" and num != none { align(left, text(font: _hf, size: 60pt * _cfg.scale, weight: 400, fill: luma(115), num)); v(0.05em) }
    else if st == "numeral-center" and num != none { align(center, text(font: _hf, size: 54pt * _cfg.scale, weight: 400, num)); v(0.15em) }
    else if st == "boxed" and num != none { box(fill: black, inset: (x: 0.6em, y: 0.4em), radius: 2.5pt, text(font: _hf, size: 18pt, weight: 700, fill: white, num)); v(0.8em) }
    else if st == "ornament" { align(center, text(font: _orn, size: 26pt, fill: luma(70))[❦]); v(0.35em) }
    else if kicker != none and not _poem {
      // Varsayılan (ortalı) biçim bugünkü kicker'ın aynısı; konseptler daha ince.
      if st == "centered" { align(center, text(font: _hf, size: 11pt, weight: 700, tracking: 0.12em, kicker)); v(0.5em) }
      else { align(al, text(font: _hf, size: 9.5pt, weight: if st == "spaced-caps" { 400 } else { 700 }, tracking: 0.16em, kicker)); v(0.6em) }
    }
    body
    if ornament == "rule" { v(0.4em); align(al, line(length: 14%, stroke: 0.6pt + black)) }
    if ornament == "dots" { v(0.3em); align(center, text(size: 13pt)[• • •]) }
    if ornament == "fleuron" { v(0.35em); align(center, text(font: _orn, size: 15pt, fill: luma(60))[❦]) }
  }
  // Akış içindeki başlık (şiir) sayfa sonunda yalnız kalmasın: ilk satırlarla birlikte.
  if _cfg.newpage { head } else { block(sticky: true, breakable: false, width: 100%, head) }
  v(if _poem { 1.1em } else { 14mm })
}
// Sahne ayracı ("* * *" satırı): konseptin seçtiği işaretle ortalı.
#let _scene() = {
  let sc = _cfg.scene
  if sc == "space" { v(1.8em, weak: true) } else {
    block(above: 1.2em, below: 1.2em, width: 100%, align(center, {
      set par(first-line-indent: 0pt, justify: false)
      if sc == "asterism" { text(font: ("Literata", "Cormorant Garamond", "Inter", "Source Serif 4"), size: 1.15em)[⁂] }
      else if sc == "fleuron" { text(font: _orn, size: 1.2em, fill: luma(60))[❦] }
      else if sc == "rule" { line(length: 16%, stroke: 0.5pt) }
      else [\* #h(0.7em) \* #h(0.7em) \*]
    }))
  }
}
// Alıntı (> satırları): girintili italik (bugünkü) / gri kutu / sol çizgi.
#let _quote(indent, body) = {
  let q = _cfg.quote
  if q == "box" { block(width: 100%, fill: luma(242), inset: (x: 0.95em, y: 0.8em), radius: 2pt, { set par(first-line-indent: 0pt); body }) }
  else if q == "bar" { block(inset: (left: 0.95em, y: 0.1em), stroke: (left: 1.6pt + luma(95)), { set par(first-line-indent: 0pt); body }) }
  else { block(inset: (x: indent), emph(body)) }
}
// Bölümün ilk kelimeleri: büyük harf (JS'te), küçük punto + aralık.
#let _lead(body) = text(size: 0.82em, tracking: 0.07em, body)
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
    // Baş (harfin yanı) ile gövde AYNI paragraf → aralarında boşluk OLMAMALI.
    // Paragraf-arası boşluk (par.spacing) buraya sızmasın diye blok boşluğunu
    // sıfırla; sonraki paragrafla arası dış boşlukla korunur.
    set block(spacing: 0pt)
    grid(columns: (iw, fw), gutter: 0pt, place(top + left, capt), box(width: fw)[#set par(justify: true, first-line-indent: 0pt); #head])
    if tail != "" { box(width: 100%)[#set par(justify: true, first-line-indent: 0pt); #tail] }
  }
})
#set outline.entry(fill: repeat(gap: 2.5pt)[.])
// Koşu başlığı/sayfa no'yu ön sayfada VE bölüm açılış sayfasında gizle.
// (Bölümler akış içindeyse — şiir — yalnız ön sayfada gizlenir.)
#let _suppress() = {
  let p = here().page()
  let bs = query(heading.where(level: 1)).filter(h => h.location().page() <= p)
  bs.len() == 0 or (_cfg.newpage and bs.any(h => h.location().page() == p))
}
#let _runHead(bookTitle) = context if not _suppress() {
  let caps = _cfg.rh == "caps"
  set text(size: if caps { 7.5pt } else { 9pt }, style: if caps { "normal" } else { "italic" }, tracking: if caps { 0.15em } else { 0pt })
  if calc.odd(here().page()) {
    let bs = query(heading.where(level: 1)).filter(h => h.location().page() <= here().page())
    if bs.len() > 0 {
      let ups = if caps { query(<chup>).filter(m => m.location().page() <= here().page()) } else { () }
      align(right, if ups.len() > 0 { ups.last().value } else { bs.last().body })
    }
  } else { align(left, bookTitle) }
}
#let _pageFoot() = context if not _suppress() or (_cfg.foliopen and query(heading.where(level: 1)).filter(h => h.location().page() <= here().page()).len() > 0) {
  set text(size: 9pt)
  let n = counter(page).display()
  if _cfg.folio == "center" { align(center, n) } else if calc.odd(here().page()) { align(right, n) } else { align(left, n) }
}
#let _titlepage(title, subtitle, author, publisher) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt, justify: false, leading: 0.4em)
  #set text(hyphenate: false)
  // fr-tabanlı dikey ritim: başlık üst-üçte bir, yazar alta yakın, bol boşluk.
  // Alt başlık (varsa) başlığın hemen altında; yayınevi sayfanın en altında.
  #v(1.4fr)
  #align(center, text(font: _hf, size: 30pt, weight: 700, title))
  #if subtitle != none [
    #v(5mm)
    #align(center, text(font: _hf, size: 15pt, weight: 400, style: "italic", subtitle))
  ]
  #v(2.4fr)
  #align(center, text(font: _hf, size: 12pt, weight: 600, tracking: 0.18em, author))
  #v(1fr)
  #if publisher != none [
    #align(center, text(font: _hf, size: 10pt, weight: 500, tracking: 0.14em, publisher))
    #v(0.3fr)
  ]
]
#let _biopage(body) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt, justify: true, leading: 0.6em)
  #set text(size: 9pt)
  #v(18%)
  #body
]
#let _toc(title) = page(header: none, footer: none)[
  #set par(first-line-indent: 0pt)
  #align(center, text(font: _hf, size: 11pt, weight: 600, title))
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
  // Başlık yazı tipi (bölüm/ara başlık, kapak sayfası). Boşsa gövdeninki.
  const headFontExpr = typstFontExpr(s.headingFontFamily || s.bodyFontFamily);
  const cfg = `#let _hf = ${headFontExpr}
#let _cfg = (chapter: "${s.chapterStyle ?? "centered"}", scale: ${(s.chapterTitleScale ?? 1).toFixed(2)}, newpage: ${s.chapterNewPage !== false}, sub: "${s.subheadStyle ?? "center"}", quote: "${s.quoteStyle ?? "indent"}", rh: "${s.runningHeadStyle ?? "italic"}", folio: "${s.folioPosition ?? "outer"}", scene: "${s.sceneBreak ?? "stars"}", foliopen: ${!!s.keepLineBreaks})`;
  // Koşu başlığında kitap adı: "caps" biçiminde Türkçe kuralıyla büyük harf.
  const headTitle = s.runningHeadStyle === "caps" ? upperTr(meta.title, s.lang) : meta.title;
  // Tireleme/dil işleme kitabın diline göre (EN kitap → İngilizce desenler).
  const lang = s.lang === "en" ? "en" : "tr";
  const region = s.lang === "en" ? "US" : "TR";
  const justify = s.align === "justify";
  const leading = leadingExpr(s.leadingPt, s.bodySizePt);
  const indent = s.firstLineIndentMm;
  const paraSpacing = s.paragraphSpacingMm;
  const linebreaks = s.lineBreak === "greedy" ? '"simple"' : '"optimized"';

  // ── TİPOGRAFİ KURALLARI (typographyRules.ts) — başlık boşlukları + alt bölge ──
  // pitch = taban-taban satır adımı (satır yüksekliği). Kural 1/6/9 boşlukları
  // bunun katı; kural 3 sınırı (_hlim) sayfa MUTLAK y'sinde: üst marj +
  // kullanılabilir yüksekliğin (1 - koruma bölgesi)'i.
  const pitchPt = s.leadingPt > 0 ? s.leadingPt : 1.2 * s.bodySizePt;
  const hb = (TYPOGRAPHY_RULES.headingBeforeLines * pitchPt).toFixed(2);
  const ha = (TYPOGRAPHY_RULES.headingAfterLines * pitchPt).toFixed(2);
  const ht = (TYPOGRAPHY_RULES.tightHeadingGapLines * pitchPt).toFixed(2);
  const contentHmm = size.height - m.top - m.bottom;
  const hlim = (to + m.top + (1 - TYPOGRAPHY_RULES.bottomProtectionZone) * contentHmm).toFixed(2);
  const typoRules = `#let _hb = ${hb}pt
#let _ha = ${ha}pt
#let _ht = ${ht}pt
#let _hlim = ${hlim}mm
// Başlık ÖNCESİ paket (kural 1/3/6/7): çapa + alt-bölge kararı + önce-boşluk.
// DİKKAT — yakınsama tuzakları (CLI taramasıyla test edildi, 17/17 yakınsar):
//  • Karar here() ile verilemez: guard'ın ürettiği pagebreak kendi konumunu
//    sonraki sayfaya "taşıyıp" kararı tersine çevirir → osilasyon.
//  • Çıplak metadata çapası da yetmez: Typst etiketleri sayfa kırılımında takip
//    eden içerikle GÖÇ eder → sınır bandında yine osilasyon.
//  • Çözüm: çapa, göç etmeyen sıfır-yükseklik BLOK içinde; karar "çapa + boşluk
//    > sınır" (boşluğun sayfa sonunda trimlenmesi kararı etkileyemez).
#let _hpre(tight) = {
  block(height: 0pt, above: 0pt, below: 0pt, [#metadata(none) <hg>])
  context {
    let anchors = query(selector(<hg>).before(here(), inclusive: true))
    if anchors.len() > 0 and anchors.last().location().position().y + (if tight { _ht } else { _hb }) > _hlim { pagebreak(weak: true) }
  }
  v(if tight { _ht } else { _hb }, weak: true)
}`;

  return `// otomatik üretilen — Block[] → Typst (mizanpaj motoru)
${typoRules}
${cfg}
${HELPERS}
#set document(title: ${typstStr(meta.title)}, author: ${typstStr(meta.author)})
#set page(
  width: ${pageW}mm,
  height: ${pageH}mm,
  margin: (top: ${mTop}mm, bottom: ${mBot}mm, inside: ${mIn}mm, outside: ${mOut}mm),
  binding: left,
  numbering: none,
  header: ${s.showRunningHeads ? `_runHead(${typstStr(headTitle)})` : "none"},
  footer: ${s.showPageNumbers ? "_pageFoot()" : "none"},
  background: ${background},
)
#set text(font: ${fontExpr}, size: ${s.bodySizePt}pt, lang: "${lang}", region: "${region}", hyphenate: ${s.hyphenate}, costs: (widow: ${s.widowControl === false ? 0 : 100}%, orphan: ${s.widowControl === false ? 0 : 100}%), overhang: ${s.opticalMargins !== false}, ligatures: true, discretionary-ligatures: false)
#set par(justify: ${justify}, leading: ${leading}, first-line-indent: (amount: ${indent}mm, all: true), spacing: ${leading} + ${paraSpacing}mm, linebreaks: ${linebreaks})
#set smartquote(enabled: false)
`;
}

/** Kitabın diline göre BÜYÜK HARF (Türkçe: i → İ, ı → I). */
export function upperTr(s: string, lang?: "tr" | "en"): string {
  return s.toLocaleUpperCase(lang === "en" ? "en" : "tr");
}

// Typst string literali (çift tırnaklı; yalnız \ ve " kaçırılır — içerik kaçışı DEĞİL).
export function typstStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, " ")}"`;
}
