// İç tasarım temaları (Atticus/Vellum tarzı). Bir tema, mizanpajın TİPOGRAFİ +
// BÖLÜM AÇILIŞ stilini tek pakette toplar; kullanıcı ayarlarla boğuşmadan güzel
// bir varsayılan alır. Tema, platform profilinden (KDY/KDP — trim/marj/bleed)
// BAĞIMSIZDIR: marjlara dokunmaz (baskı uyumu korunur), yalnız "his"i belirler.
// İstenirse seçildikten sonra her ayar elle ince ayarlanabilir.

export type ChapterOrnament = "none" | "rule" | "dots";

// Paragraf sonrası boşluk VARSAYILANI (~1 satır). Kullanıcı isteği: "her
// paragraftan sonra varsayılan olarak bir boşluk". Tüm temalar bunu kullanır
// ki türe göre otomatik seçilen tema boşluğu sıfırlamasın; kitap bazında
// "Yazı" panelinden değiştirilebilir.
export const DEFAULT_PARAGRAPH_SPACING_MM = 5;

export type LayoutTheme = {
  id: string;
  name: { tr: string; en: string };
  description: { tr: string; en: string };
  // Tipografi
  bodyFontId: string;
  headingFontId: string;
  bodySizePt: number;
  leadingPt: number; // 0 = otomatik (~%120)
  align: "left" | "justify";
  firstLineIndentMm: number;
  paragraphSpacingMm: number;
  hyphenate: boolean;
  lineBreak: "balanced" | "greedy";
  // Bölüm açılışı
  dropCap: boolean;
  // Bölüm başlığının sayfanın % kaçından başladığı. Kullanıcı isteği (5 Eki 2026):
  // bölüm başlarında üst boşluk YOK → tüm temalarda 0 (başlık en üstten başlar).
  chapterTopRatio: number;
  chapterOrnament: ChapterOrnament; // başlık altı süs
  showChapterKicker: boolean; // "BÖLÜM N" üst etiketi
};

export const LAYOUT_THEMES: LayoutTheme[] = [
  {
    id: "klasik-roman",
    name: { tr: "Klasik Roman", en: "Classic Novel" },
    description: {
      tr: "Ferah satır arası, drop-cap, ince çizgi. Geleneksel roman havası.",
      en: "Airy leading, drop cap, hairline rule. Traditional novel feel.",
    },
    bodyFontId: "vollkorn",
    headingFontId: "vollkorn",
    bodySizePt: 11,
    leadingPt: 15.5,
    align: "justify",
    firstLineIndentMm: 5,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: true,
    lineBreak: "balanced",
    dropCap: true,
    chapterTopRatio: 0,
    chapterOrnament: "rule",
    showChapterKicker: true,
  },
  {
    id: "akademik",
    name: { tr: "Akademik", en: "Academic" },
    description: {
      tr: "Sıkı, sade, hızlı içeriğe geçen düzen. Drop-cap yok.",
      en: "Tight, clean, gets to content fast. No drop cap.",
    },
    bodyFontId: "sourceserif",
    headingFontId: "sourceserif",
    bodySizePt: 10.5,
    leadingPt: 14,
    align: "justify",
    firstLineIndentMm: 5,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: true,
    lineBreak: "balanced",
    dropCap: false,
    chapterTopRatio: 0,
    chapterOrnament: "none",
    showChapterKicker: true,
  },
  {
    id: "kisisel-gelisim",
    name: { tr: "Kişisel Gelişim", en: "Self-help" },
    description: {
      tr: "Blok paragraf (girinti yok), rahat satır arası, nokta süsü. Modern + erişilebilir.",
      en: "Block paragraphs (no indent), relaxed leading, dot ornament. Modern + accessible.",
    },
    bodyFontId: "sourceserif",
    headingFontId: "sourceserif",
    bodySizePt: 11,
    leadingPt: 16,
    align: "justify",
    firstLineIndentMm: 0,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: true,
    lineBreak: "balanced",
    dropCap: false,
    chapterTopRatio: 0,
    chapterOrnament: "dots",
    showChapterKicker: true,
  },
  {
    id: "siir",
    name: { tr: "Şiir", en: "Poetry" },
    description: {
      tr: "Sola yaslı (yaslama yok), tireleme yok, bol üst boşluk. Dizeler bozulmaz.",
      en: "Left-aligned (no justify), no hyphenation, generous air. Verse stays intact.",
    },
    bodyFontId: "vollkorn",
    headingFontId: "vollkorn",
    bodySizePt: 11.5,
    leadingPt: 17,
    align: "left",
    firstLineIndentMm: 0,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: false,
    lineBreak: "balanced",
    dropCap: false,
    chapterTopRatio: 0,
    chapterOrnament: "none",
    showChapterKicker: false,
  },
  {
    id: "ani",
    name: { tr: "Anı", en: "Memoir" },
    description: {
      tr: "Sıcak serif, drop-cap, ince çizgi, ferah açılış. Kişisel ton.",
      en: "Warm serif, drop cap, hairline rule, airy openings. Personal tone.",
    },
    bodyFontId: "arnopro",
    headingFontId: "arnopro",
    bodySizePt: 11,
    leadingPt: 16,
    align: "justify",
    firstLineIndentMm: 5,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: true,
    lineBreak: "balanced",
    dropCap: true,
    chapterTopRatio: 0,
    chapterOrnament: "rule",
    showChapterKicker: true,
  },
  {
    id: "minimal",
    name: { tr: "Minimal", en: "Minimal" },
    description: {
      tr: "Süs yok, drop-cap yok, sade ve dingin. Yalın okuma.",
      en: "No ornament, no drop cap, calm and bare. Pure reading.",
    },
    bodyFontId: "sourceserif",
    headingFontId: "sourceserif",
    bodySizePt: 11,
    leadingPt: 15,
    align: "justify",
    firstLineIndentMm: 4,
    paragraphSpacingMm: DEFAULT_PARAGRAPH_SPACING_MM,
    hyphenate: true,
    lineBreak: "balanced",
    dropCap: false,
    chapterTopRatio: 0,
    chapterOrnament: "none",
    showChapterKicker: false,
  },
];

export function getTheme(id: string): LayoutTheme {
  return LAYOUT_THEMES.find((t) => t.id === id) ?? LAYOUT_THEMES[0];
}
