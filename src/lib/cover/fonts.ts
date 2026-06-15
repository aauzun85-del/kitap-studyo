// Kapak metinleri için kullanılabilir yazı tipleri.
// Hepsi Google Fonts — açık kaynak, ticari kullanım (KDP dahil) ücretsiz.
// Tuval (canvas) gerçek font adlarını kullanır; bu yüzden fontlar layout'ta
// Google Fonts <link>'i ile kanonik adlarıyla (örn. "Playfair Display") yüklenir.

export type FontCategory = "serif" | "sans" | "display" | "script" | "mono";

export type CoverFont = {
  id: string; // saklanan kimlik
  label: string; // menüde görünen ad
  family: string; // tuvalde kullanılan gerçek font adı
  category: FontCategory;
};

// Menüde görünecek sıra ile.
export const COVER_FONTS: CoverFont[] = [
  // ── Serif (edebi / klasik) ──
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", category: "serif" },
  { id: "lora", label: "Lora", family: "Lora", category: "serif" },
  { id: "merriweather", label: "Merriweather", family: "Merriweather", category: "serif" },
  { id: "ebgaramond", label: "EB Garamond", family: "EB Garamond", category: "serif" },
  { id: "cormorant", label: "Cormorant Garamond", family: "Cormorant Garamond", category: "serif" },
  { id: "baskerville", label: "Libre Baskerville", family: "Libre Baskerville", category: "serif" },
  { id: "sourceserif", label: "Source Serif 4", family: "Source Serif 4", category: "serif" },
  { id: "vollkorn", label: "Vollkorn", family: "Vollkorn", category: "serif" },
  // Arno Pro: KDY'nin orijinal gövde fontu (Adobe lisanslı). Font dosyaları
  // depoda değildir; yalnızca yerelde varsa çalışır, yoksa Source Serif'e düşer.
  { id: "arnopro", label: "Arno Pro (kişisel)", family: "Arno Pro", category: "serif" },
  // ── Sans (modern) ──
  { id: "sans", label: "Manrope", family: "Manrope", category: "sans" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", category: "sans" },
  { id: "poppins", label: "Poppins", family: "Poppins", category: "sans" },
  { id: "oswald", label: "Oswald", family: "Oswald", category: "sans" },
  // ── Display (gösterişli / başlık) ──
  { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", category: "display" },
  { id: "abril", label: "Abril Fatface", family: "Abril Fatface", category: "display" },
  { id: "cinzel", label: "Cinzel", family: "Cinzel", category: "display" },
  // ── El yazısı ──
  { id: "dancing", label: "Dancing Script", family: "Dancing Script", category: "script" },
  { id: "greatvibes", label: "Great Vibes", family: "Great Vibes", category: "script" },
  // ── Mono ──
  { id: "mono", label: "IBM Plex Mono", family: "IBM Plex Mono", category: "mono" },
];

export const FONT_CATEGORY_ORDER: FontCategory[] = [
  "serif",
  "sans",
  "display",
  "script",
  "mono",
];

export const DEFAULT_COVER_FONT = "sans";

function genericFor(category: FontCategory): string {
  switch (category) {
    case "serif":
    case "display":
      return "Georgia, serif";
    case "script":
      return "cursive";
    case "mono":
      return "monospace";
    default:
      return "system-ui, sans-serif";
  }
}

// Tuval/CSS için tam font yığını (fallback dahil).
export function fontFamilyOf(id?: string): string {
  const f = COVER_FONTS.find((x) => x.id === id) ?? COVER_FONTS[0];
  return `"${f.family}", ${genericFor(f.category)}`;
}

// document.fonts.load için gereken font adları.
export const COVER_FONT_FAMILIES = COVER_FONTS.map((f) => f.family);
