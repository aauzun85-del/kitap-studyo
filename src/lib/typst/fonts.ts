// Font eşlemesi — bizim kanonik aile adlarımız ↔ Typst'in eşleştirdiği İÇ font
// adları (font dosyasının name tablosundaki aile adı). Typst dosya adıyla değil
// iç adla eşleştirir; yanlış ad → sessizce varsayılana düşer ve eşliği bozar.

// public/fonts altındaki dosyalar. Typst derleyiciye bunları yüklüyoruz (engine).
// Arno .otf'ler Adobe lisanslı: yerelde var, yayında (gitignore) yok → yükleme
// 404'leri atlanır, fontExpr Arno için Source Serif'e düşer (aşağıda).
//
// İç tasarım konseptleri için eklenen aileler (16 Kas 2026): EB Garamond,
// Cormorant Garamond, Libre Baskerville, Crimson Pro, Literata, Inter — hepsi
// SIL OFL 1.1 (public/fonts/licenses). Google Fonts resmî deposundaki değişken
// fontlardan STATİK örnekler çıkarıldı (Typst değişken eksen uygulamaz) ve
// Latin + Yunanca + noktalama + süs (❦ ⁂) alt kümesine indirildi; kerning,
// bitişik harf ve Türkçe yerelleştirme (locl) tabloları KORUNDU.
export const TYPST_FONT_FILES: string[] = [
  "Vollkorn-Regular.ttf",
  "Vollkorn-Bold.ttf",
  "Vollkorn-Italic.ttf",
  "Vollkorn-BoldItalic.ttf",
  "SourceSerif4-Regular.ttf",
  "SourceSerif4-Bold.ttf",
  "SourceSerif4-Italic.ttf",
  "SourceSerif4-BoldItalic.ttf",
  "SourceSerif4-SemiBold.ttf",
  "Arno-Regular.otf",
  "Arno-Bold.otf",
  "Arno-Italic.otf",
  "Arno-SemiBold.otf",
  "EBGaramond-Regular.ttf",
  "EBGaramond-Italic.ttf",
  "EBGaramond-SemiBold.ttf",
  "EBGaramond-Bold.ttf",
  "EBGaramond-BoldItalic.ttf",
  "CormorantGaramond-Regular.ttf",
  "CormorantGaramond-Italic.ttf",
  "CormorantGaramond-SemiBold.ttf",
  "CormorantGaramond-Bold.ttf",
  "CormorantGaramond-BoldItalic.ttf",
  "LibreBaskerville-Regular.ttf",
  "LibreBaskerville-Italic.ttf",
  "LibreBaskerville-Bold.ttf",
  "CrimsonPro-Regular.ttf",
  "CrimsonPro-Italic.ttf",
  "CrimsonPro-SemiBold.ttf",
  "CrimsonPro-Bold.ttf",
  "CrimsonPro-BoldItalic.ttf",
  "Literata-Regular.ttf",
  "Literata-Italic.ttf",
  "Literata-SemiBold.ttf",
  "Literata-Bold.ttf",
  "Literata-BoldItalic.ttf",
  "Inter-Regular.ttf",
  "Inter-SemiBold.ttf",
  "Inter-Bold.ttf",
  "Inter-Italic.ttf",
  "Inter-BoldItalic.ttf",
];

// Aile → Typst iç adı. Her biri Source Serif 4'e düşer: ailede olmayan bir
// karakter (ör. Libre Baskerville'de Yunanca) boş kalmasın.
const FAMILIES: [RegExp, string][] = [
  [/arno/i, `"Arno Pro"`],
  [/vollkorn/i, `"Vollkorn"`],
  [/eb\s*garamond/i, `"EB Garamond"`],
  [/cormorant/i, `"Cormorant Garamond"`],
  [/baskerville/i, `"Libre Baskerville"`],
  [/crimson/i, `"Crimson Pro"`],
  [/literata/i, `"Literata"`],
  [/inter\b/i, `"Inter"`],
];

/** Typst'te gerçekten yüklenen aileler (Mizanpaj yazı tipi seçicileri bunları gösterir). */
export const TYPST_FAMILY_IDS = [
  "sourceserif",
  "vollkorn",
  "arnopro",
  "ebgaramond",
  "cormorant",
  "baskerville",
  "crimsonpro",
  "literata",
  "inter",
] as const;

// Bizim aile dizgemiz (örn. "Vollkorn", "Source Serif 4", "Arno Pro") → Typst
// `#set text(font: ...)` ifadesi. Bilinen her aile ("X", "Source Serif 4")
// dizisi olarak döner: eksik glif / eksik dosya (Arno yayında yok) Source
// Serif'e düşer (mevcut FontCache'in Arno→Source Serif davranışıyla aynı).
export function typstFontExpr(family: string): string {
  for (const [re, name] of FAMILIES) {
    if (re.test(family)) return `(${name}, "Source Serif 4")`;
  }
  return `"Source Serif 4"`;
}
