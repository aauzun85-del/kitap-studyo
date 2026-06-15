// Kapak ölçü ve sırt (spine) matematiği.
// Bir kapak tek parça değildir: arka kapak + sırt + ön kapak yan yana açılmış
// tek bir geniş tuvaldir. Burada o tuvalin gerçek baskı ölçüleri hesaplanır.

export type BindingType = "soft" | "hard";

export type PaperGsm = 70 | 80 | 90 | 100;

export type BookSize = {
  id: string;
  /** Görünen ad (boyut bilgisi içerir) */
  label: string;
  width: number; // mm — tek kapağın (trim) genişliği
  height: number; // mm — tek kapağın (trim) yüksekliği
  category: "kdp" | "tr";
};

// KDP standart kesim payı: 0.125 inç = 3.175 mm (her kenardan).
export const BLEED_MM = 3.175;

// Taşma payı için yaygın seçenekler (mm).
export const BLEED_OPTIONS = [3, 3.175, 5] as const;
export const DEFAULT_BLEED_MM = 3.175;

// Güvenli alan: trim'den içeri, önemli içeriğin (yazı vb.) girmemesi gereken pay.
export const SAFE_ZONE_MM = 6;

// Kağıt kalınlığına göre sayfa başına sırt artışı (mm/sayfa).
export const GSM_PER_PAGE: Record<PaperGsm, number> = {
  70: 0.05,
  80: 0.055,
  90: 0.06,
  100: 0.065,
};

export const PAPER_OPTIONS: PaperGsm[] = [70, 80, 90, 100];

// Ön tanımlı kitap boyutları: inç tabanlı (KDP/Ingram/B&N/Lulu ortak) + Türkiye
// boyları. Etiketler markaya özel değildir; aynı inç boyları tüm bu standartlar
// için geçerlidir, bu yüzden başlarına firma adı yazılmaz.
export const BOOK_SIZES: BookSize[] = [
  { id: "kdp-6x9", label: '6×9" (152×229 mm)', width: 152, height: 229, category: "kdp" },
  { id: "kdp-5x8", label: '5×8" (127×203 mm)', width: 127, height: 203, category: "kdp" },
  { id: "kdp-5.5x8.5", label: '5.5×8.5" (140×216 mm)', width: 140, height: 216, category: "kdp" },
  { id: "kdp-6x9-a", label: '6.14×9.21" (156×234 mm)', width: 156, height: 234, category: "kdp" },
  { id: "tr-135x210", label: "135×210 mm (Cep boy)", width: 135, height: 210, category: "tr" },
  { id: "tr-145x210", label: "145×210 mm", width: 145, height: 210, category: "tr" },
  { id: "tr-160x240", label: "160×240 mm (Büyük boy)", width: 160, height: 240, category: "tr" },
  { id: "tr-170x240", label: "170×240 mm", width: 170, height: 240, category: "tr" },
  { id: "tr-a5", label: "A5 — 148×210 mm", width: 148, height: 210, category: "tr" },
];

export const DEFAULT_SIZE_ID = "kdp-6x9";

/**
 * Sırt kalınlığı (mm). Elle değer verilirse o kullanılır; yoksa sayfa sayısı ve
 * kağıt kalınlığından hesaplanır. Sert kapakta (hardcover) +3 mm pay eklenir.
 */
export function calcSpineWidth(
  pageCount: number,
  paperGsm: PaperGsm,
  binding: BindingType,
  manual: number | null,
): number {
  if (manual !== null && Number.isFinite(manual)) return Math.max(manual, 0);
  const perPage = GSM_PER_PAGE[paperGsm];
  let spine = pageCount * perPage;
  if (binding === "hard") spine += 3;
  return Math.max(spine, 2);
}

export type SpreadDimensions = {
  bookWidth: number; // mm — tek kapak genişliği (trim)
  bookHeight: number; // mm — tek kapak yüksekliği (trim)
  spine: number; // mm
  bleed: number; // mm (her kenardan)
  safeZone: number; // mm
  totalWidth: number; // mm — arka + sırt + ön + iki yandan bleed
  totalHeight: number; // mm — kapak + üst/alt bleed
  // Tam tuval içindeki yatay sınırlar (mm, soldan):
  backStart: number; // arka kapak başlangıcı (= bleed)
  spineStart: number; // sırt başlangıcı
  spineEnd: number; // sırt bitişi
  frontEnd: number; // ön kapak bitişi (= totalWidth - bleed)
  topTrim: number; // üst kesim çizgisi (= bleed)
  bottomTrim: number; // alt kesim çizgisi
  // Merkezler (mm):
  backCenter: number;
  spineCenter: number;
  frontCenter: number;
  midY: number;
  // Güvenli alan kenarları (mm):
  frontSafeLeft: number;
  frontSafeRight: number;
  backSafeLeft: number;
  backSafeRight: number;
  topSafe: number;
  bottomSafe: number;
  // Barkod alanı — arka kapak sağ alt (mm):
  barcodeX: number;
  barcodeY: number;
  barcodeW: number;
  barcodeH: number;
};

/** Tam kapak tuvalinin baskı ölçülerini hesaplar (hepsi mm). */
export function calcSpread(
  size: BookSize,
  pageCount: number,
  paperGsm: PaperGsm,
  binding: BindingType,
  spineManual: number | null,
  bleedMm: number = DEFAULT_BLEED_MM,
): SpreadDimensions {
  const spine = calcSpineWidth(pageCount, paperGsm, binding, spineManual);
  const bleed = Number.isFinite(bleedMm) && bleedMm > 0 ? bleedMm : DEFAULT_BLEED_MM;
  const safeZone = SAFE_ZONE_MM;
  const totalWidth = bleed * 2 + size.width * 2 + spine;
  const totalHeight = bleed * 2 + size.height;
  const backStart = bleed;
  const spineStart = bleed + size.width;
  const spineEnd = spineStart + spine;
  const frontEnd = spineEnd + size.width;
  const topTrim = bleed;
  const bottomTrim = bleed + size.height;

  const barcodeW = Math.min(45, size.width - safeZone * 2);
  const barcodeH = 26;

  return {
    bookWidth: size.width,
    bookHeight: size.height,
    spine,
    bleed,
    safeZone,
    totalWidth,
    totalHeight,
    backStart,
    spineStart,
    spineEnd,
    frontEnd,
    topTrim,
    bottomTrim,
    backCenter: (backStart + spineStart) / 2,
    spineCenter: (spineStart + spineEnd) / 2,
    frontCenter: (spineEnd + frontEnd) / 2,
    midY: totalHeight / 2,
    frontSafeLeft: spineEnd + safeZone,
    frontSafeRight: frontEnd - safeZone,
    backSafeLeft: backStart + safeZone,
    backSafeRight: spineStart - safeZone,
    topSafe: topTrim + safeZone,
    bottomSafe: bottomTrim - safeZone,
    barcodeX: backStart + size.width - safeZone - barcodeW,
    barcodeY: bottomTrim - safeZone - barcodeH,
    barcodeW,
    barcodeH,
  };
}

/** Milimetreyi piksele çevirir (verilen DPI'da). */
export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

// Ekranda gösterim için kullanılan çözünürlük. Baskı çıktısı (PDF) ileride
// 300 DPI olacak; ekran önizlemesi için daha düşük bir değer yeterli.
export const SCREEN_DPI = 96;

/** mm değerini okunur biçimde yuvarlar (örn. 11.3 mm). */
export function formatMm(mm: number): string {
  return `${Math.round(mm * 10) / 10} mm`;
}
