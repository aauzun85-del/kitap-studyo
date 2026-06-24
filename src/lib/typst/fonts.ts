// Font eşlemesi — bizim kanonik aile adlarımız ↔ Typst'in eşleştirdiği İÇ font
// adları (font dosyasının name tablosundaki aile adı). Typst dosya adıyla değil
// iç adla eşleştirir; yanlış ad → sessizce varsayılana düşer ve eşliği bozar.

// public/fonts altındaki 13 dosya. Typst derleyiciye bunları yüklüyoruz (engine).
// Arno .otf'ler Adobe lisanslı: yerelde var, yayında (gitignore) yok → yükleme
// 404'leri atlanır, fontExpr Arno için Source Serif'e düşer (aşağıda).
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
];

// Bizim aile dizgemiz (örn. "Vollkorn", "Source Serif 4", "Arno Pro") → Typst
// `#set text(font: ...)` ifadesi. Arno için ("Arno Pro", "Source Serif 4")
// fallback dizisi: Arno yoksa Typst kendiliğinden Source Serif'e geçer
// (mevcut FontCache'in Arno→Source Serif davranışıyla aynı).
export function typstFontExpr(family: string): string {
  if (/arno/i.test(family)) return `("Arno Pro", "Source Serif 4")`;
  if (/vollkorn/i.test(family)) return `"Vollkorn"`;
  return `"Source Serif 4"`;
}
