// Kapak ölçü ve sırt (spine) matematiği.
// Bir kapak tek parça değildir: arka kapak + sırt + ön kapak yan yana açılmış
// tek bir geniş tuvaldir. Burada o tuvalin gerçek baskı ölçüleri hesaplanır.

export type BindingType = "soft" | "hard";

/** Eski kayıtlardaki kâğıt gramajı (yalnız okuma/geri uyum için). */
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

// ── Kâğıt ve sırt ──────────────────────────────────────────────────────────
// Sırt kalınlığını gramaj değil KÂĞIT CİNSİ belirler: 60 gr Enso (kabarık kitap
// kâğıdı), 80 gr 1. hamurdan bile kalındır. Bu yüzden seçim kâğıt cinsiyle yapılır.
// Kaynaklar:
//  • KDY resmî sırt tablosu (kdy-sirt-olculeri, 2022, "320 sayfa baz alınarak"):
//    Enso 60 gr 19 mm · Enso 55 gr 17 mm · 1. Hamur 70 gr 14 mm · 1. Hamur 80 gr 16 mm.
//  • Amazon KDP formülü: beyaz kâğıt 0,002252 inç/sayfa, krem 0,0025 inç/sayfa.
//  • 1. Hamur 90/100 gr: KDY tablosundaki 70→80 gr artışından orantılı TAHMİN.
export type PaperId =
  | "enso-60"
  | "enso-55"
  | "hamur-70"
  | "hamur-80"
  | "hamur-90"
  | "hamur-100"
  | "kdp-white"
  | "kdp-cream";

export type PaperOption = {
  id: PaperId;
  group: "tr" | "kdp";
  label: { tr: string; en: string };
  /** Sayfa başına sırt artışı (mm/sayfa; 1 yaprak = 2 sayfa). */
  mmPerPage: number;
  /** Değerin dayanağı — seçim kutusunun altında gösterilir. */
  source: { tr: string; en: string };
};

const KDY_SRC = { tr: "KDY resmî sırt tablosu", en: "KDY official spine table" };
const KDP_SRC = { tr: "Amazon KDP sırt formülü", en: "Amazon KDP spine formula" };
const EST_SRC = {
  tr: "Tahmini değer; matbaanla doğrula",
  en: "Estimate; confirm with your printer",
};

export const PAPERS: PaperOption[] = [
  { id: "enso-60", group: "tr", label: { tr: "Enso 60 gr (kitap kâğıdı)", en: "Enso 60 gsm (book paper)" }, mmPerPage: 19 / 320, source: KDY_SRC },
  { id: "enso-55", group: "tr", label: { tr: "Enso 55 gr (kitap kâğıdı)", en: "Enso 55 gsm (book paper)" }, mmPerPage: 17 / 320, source: KDY_SRC },
  { id: "hamur-70", group: "tr", label: { tr: "1. Hamur 70 gr", en: "Uncoated (1. hamur) 70 gsm" }, mmPerPage: 14 / 320, source: KDY_SRC },
  { id: "hamur-80", group: "tr", label: { tr: "1. Hamur 80 gr", en: "Uncoated (1. hamur) 80 gsm" }, mmPerPage: 16 / 320, source: KDY_SRC },
  { id: "hamur-90", group: "tr", label: { tr: "1. Hamur 90 gr", en: "Uncoated (1. hamur) 90 gsm" }, mmPerPage: 18 / 320, source: EST_SRC },
  { id: "hamur-100", group: "tr", label: { tr: "1. Hamur 100 gr", en: "Uncoated (1. hamur) 100 gsm" }, mmPerPage: 20 / 320, source: EST_SRC },
  { id: "kdp-white", group: "kdp", label: { tr: "Beyaz kâğıt (KDP)", en: "White paper (KDP)" }, mmPerPage: 0.002252 * 25.4, source: KDP_SRC },
  { id: "kdp-cream", group: "kdp", label: { tr: "Krem kâğıt (KDP)", en: "Cream paper (KDP)" }, mmPerPage: 0.0025 * 25.4, source: KDP_SRC },
];

export function getPaper(id: PaperId): PaperOption {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

function isPaperId(x: unknown): x is PaperId {
  return typeof x === "string" && PAPERS.some((p) => p.id === x);
}

/**
 * Eski kayıt (yalnız gramaj) → aynı gramajlı 1. hamur. 80 gr burada YOK: eski
 * sürümün dokunulmamış varsayılanıydı (seçilmiş mi bilinemez) → platformun
 * varsayılanına düşer (KDY → Enso 60 gr, KDP → beyaz).
 */
const LEGACY_GSM: Record<number, PaperId> = { 70: "hamur-70", 90: "hamur-90", 100: "hamur-100" };

/**
 * Kâğıt seçilmemişse varsayılan: Amazon/yurt dışı platformlarda KDP beyaz,
 * KDY ve Türkiye boylarında 60 gr Enso (KDY'nin standart kâğıdı).
 */
export function defaultPaperId(platform?: string | null, sizeId?: string | null): PaperId {
  if (platform === "kdp" || platform === "ingram" || platform === "bnpress" || platform === "lulu") return "kdp-white";
  if (platform === "kdy" || platform === "akademi" || platform === "serbest") return "enso-60";
  return resolveCoverSize(sizeId).category === "kdp" ? "kdp-white" : "enso-60";
}

/**
 * Baskıdaki sayfa sayısı (sırt bunun üzerinden hesaplanır): iç sayfa PDF'i +
 * KDY/KDY Akademi'nin kendi eklediği 2 künye sayfası, çift sayıya tamamlanmış
 * (bir yaprak = 2 sayfa).
 */
export const KDY_EXTRA_PAGES = 2;
export function printedPageCount(pdfPages: number, platform?: string | null): number {
  const extra = platform === "kdy" || platform === "akademi" ? KDY_EXTRA_PAGES : 0;
  const n = Math.max(1, Math.round(pdfPages)) + extra;
  return n % 2 ? n + 1 : n;
}

/** Ölçüyü kullanıcıya cm olarak yaz: "1,9 cm" / "1.9 cm". */
export function formatCm(mm: number, lang: "tr" | "en" = "tr"): string {
  // 0,1 mm duyarlılık (en çok 2 ondalık; sondaki sıfırlar atılır): 26,3 mm → "2,63 cm".
  const s = String(Math.round(mm * 10) / 100);
  return `${lang === "tr" ? s.replace(".", ",") : s} cm`;
}

/** Sırta yazı basılabilmesi için gereken en az kalınlık (kapak şablonu kuralı). */
export const SPINE_TEXT_MIN_MM = 10;

/**
 * Kitabın sırt özeti — kapak, kapak kurgusu ve İndir ekranı AYNI sonucu alsın.
 * Sayfa: Mizanpajın kaydettiği baskı sayısı (kapakta elle girilmediyse) →
 * kapak taslağındaki sayı → 200. Kâğıt: kitap düzeyi seçim → kapak taslağı →
 * platform varsayılanı.
 */
export type SpineInfo = {
  pages: number;
  /** Sayfa sayısı Mizanpajdan mı geldi? */
  fromLayout: boolean;
  /** Mizanpajdaki iç sayfa PDF'inin sayfa sayısı (biliniyorsa). */
  pdfPages: number | null;
  paperId: PaperId;
  spineMm: number;
  manual: boolean;
};

type MetaLike = {
  platform?: string | null;
  sizeId?: string | null;
  paperId?: unknown;
  pdfPageCount?: unknown;
  printPageCount?: unknown;
};
type CoverLike = {
  pageCount?: unknown;
  pageCountManual?: unknown;
  paperId?: unknown;
  paperGsm?: unknown;
  binding?: unknown;
  spineManualOn?: unknown;
  spineManualValue?: unknown;
};

export function layoutPrintPages(meta: MetaLike | null | undefined): number | null {
  const n = meta?.printPageCount;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveBookPaper(meta: MetaLike | null | undefined, cover: CoverLike | null | undefined): PaperId {
  return resolvePaperId(
    { paperId: meta?.paperId ?? cover?.paperId, paperGsm: cover?.paperGsm },
    defaultPaperId(meta?.platform, meta?.sizeId),
  );
}

export function resolveBookPages(
  meta: MetaLike | null | undefined,
  cover: CoverLike | null | undefined,
): { pages: number; fromLayout: boolean } {
  const fromLayout = layoutPrintPages(meta);
  if (fromLayout && cover?.pageCountManual !== true) return { pages: fromLayout, fromLayout: true };
  const own = typeof cover?.pageCount === "number" && cover.pageCount > 0 ? cover.pageCount : null;
  return { pages: own ?? fromLayout ?? 200, fromLayout: !own && !!fromLayout };
}

export function bookSpineInfo(meta: MetaLike | null | undefined, cover: CoverLike | null | undefined): SpineInfo {
  const { pages, fromLayout } = resolveBookPages(meta, cover);
  const paperId = resolveBookPaper(meta, cover);
  const manualVal =
    cover?.spineManualOn === true && typeof cover.spineManualValue === "number" ? cover.spineManualValue : null;
  const binding: BindingType = cover?.binding === "hard" ? "hard" : "soft";
  const pdf = meta?.pdfPageCount;
  return {
    pages,
    fromLayout,
    pdfPages: typeof pdf === "number" && pdf > 0 ? pdf : null,
    paperId,
    spineMm: calcSpineWidth(pages, paperId, binding, manualVal),
    manual: manualVal !== null,
  };
}

/**
 * Sırt kalınlığı değişince (Mizanpajda sayfa sayısı değişti, kâğıt değişti)
 * elle yerleştirilmiş öğeleri kaydır: konumlar tuvalin sol kenarından mm olarak
 * saklanır → ön kapaktakiler sırt farkı kadar, sırttakiler yarısı kadar
 * kayar; arka kapak yerinde kalır. Böylece tasarım ön kapağa göre korunur.
 */
export function shiftForSpine<T extends { leftMm: number }>(
  positions: Record<string, T> | undefined,
  photoRect: { x: number; y: number; w: number; h: number } | null | undefined,
  from: { spineStart: number; spineEnd: number; spine: number },
  to: { spine: number },
): {
  positions: Record<string, T> | undefined;
  photoRect: { x: number; y: number; w: number; h: number } | null | undefined;
} {
  const delta = to.spine - from.spine;
  if (!delta || Math.abs(delta) < 0.05) return { positions, photoRect };
  const move = (x: number) => (x >= from.spineEnd ? x + delta : x >= from.spineStart ? x + delta / 2 : x);
  const nextPos = positions
    ? Object.fromEntries(Object.entries(positions).map(([k, v]) => [k, { ...v, leftMm: move(v.leftMm) }]))
    : positions;
  let nextRect = photoRect;
  if (photoRect) {
    if (photoRect.x >= from.spineEnd) nextRect = { ...photoRect, x: photoRect.x + delta };
    else if (photoRect.x + photoRect.w > from.spineEnd) nextRect = { ...photoRect, w: Math.max(1, photoRect.w + delta) };
  }
  return { positions: nextPos, photoRect: nextRect };
}

/** Kayıtlı kapak ayarından kâğıdı çöz: yeni alan → eski gramaj → varsayılan. */
export function resolvePaperId(
  saved: { paperId?: unknown; paperGsm?: unknown } | null | undefined,
  fallback: PaperId,
): PaperId {
  if (saved && isPaperId(saved.paperId)) return saved.paperId;
  const legacy = saved && typeof saved.paperGsm === "number" ? LEGACY_GSM[saved.paperGsm] : undefined;
  return legacy ?? fallback;
}

// Ön tanımlı kitap boyutları: inç tabanlı (KDP/Ingram/B&N/Lulu ortak) + Türkiye
// boyları. Etiketler markaya özel değildir; aynı inç boyları tüm bu standartlar
// için geçerlidir, bu yüzden başlarına firma adı yazılmaz.
// KDY roman boyu (130 × 195 mm). Kapak ölçüleri listesinde YOKTU → KDY
// kitaplarının kapağı sessizce ilk ölçüye (127 × 203) düşüyordu. Tek kaynak
// burası; iç sayfa tarafı (layout/kdy.ts KDY_SIZE) da bunu kullanır.
export const KDY_ROMAN_SIZE: BookSize = {
  id: "kdy-130x195",
  label: "KDY 130×195 mm (Roman boy)",
  width: 130,
  height: 195,
  category: "tr",
};

export const BOOK_SIZES: BookSize[] = [
  // KDP'nin resmî dikey (portrait) boyları — küçükten büyüğe. Aynı liste
  // Ingram/B&N/Lulu için de geçerlidir. 6×9 en yaygını olduğundan varsayılandır.
  { id: "kdp-5x8", label: '5×8" (127×203 mm)', width: 127, height: 203, category: "kdp" },
  { id: "kdp-5.06x7.81", label: '5.06×7.81" (129×198 mm)', width: 129, height: 198, category: "kdp" },
  { id: "kdp-5.25x8", label: '5.25×8" (133×203 mm)', width: 133, height: 203, category: "kdp" },
  { id: "kdp-5.5x8.5", label: '5.5×8.5" (140×216 mm)', width: 140, height: 216, category: "kdp" },
  { id: "kdp-6x9", label: '6×9" (152×229 mm)', width: 152, height: 229, category: "kdp" },
  { id: "kdp-6x9-a", label: '6.14×9.21" (156×234 mm)', width: 156, height: 234, category: "kdp" },
  { id: "kdp-6.69x9.61", label: '6.69×9.61" (170×244 mm)', width: 170, height: 244, category: "kdp" },
  { id: "kdp-7x10", label: '7×10" (178×254 mm)', width: 178, height: 254, category: "kdp" },
  { id: "kdp-7.44x9.69", label: '7.44×9.69" (189×246 mm)', width: 189, height: 246, category: "kdp" },
  { id: "kdp-7.5x9.25", label: '7.5×9.25" (190×235 mm)', width: 190, height: 235, category: "kdp" },
  { id: "kdp-8x10", label: '8×10" (203×254 mm)', width: 203, height: 254, category: "kdp" },
  { id: "kdp-8.5x11", label: '8.5×11" (216×279 mm)', width: 216, height: 279, category: "kdp" },
  { id: "tr-135x210", label: "135×210 mm (Cep boy)", width: 135, height: 210, category: "tr" },
  { id: "tr-145x210", label: "145×210 mm", width: 145, height: 210, category: "tr" },
  { id: "tr-150x225", label: "150×225 mm (KDY Akademi)", width: 150, height: 225, category: "tr" },
  { id: "tr-160x240", label: "160×240 mm (Büyük boy)", width: 160, height: 240, category: "tr" },
  { id: "tr-170x240", label: "170×240 mm", width: 170, height: 240, category: "tr" },
  { id: "tr-a5", label: "A5 — 148×210 mm", width: 148, height: 210, category: "tr" },
];

export const DEFAULT_SIZE_ID = "kdp-6x9";

/**
 * Sırt kalınlığı (mm). Elle değer verilirse o kullanılır; yoksa sayfa sayısı ×
 * kâğıt cinsinin sayfa başına kalınlığı. Sert kapakta (hardcover) +3 mm pay eklenir.
 */
export function calcSpineWidth(
  pageCount: number,
  paperId: PaperId,
  binding: BindingType,
  manual: number | null,
): number {
  if (manual !== null && Number.isFinite(manual)) return Math.max(manual, 0);
  const perPage = getPaper(paperId).mmPerPage;
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

/** Kapakta seçilebilen boylar: KDY roman boyu + KDP/Türkiye boyları. */
export const COVER_SIZES: BookSize[] = [KDY_ROMAN_SIZE, ...BOOK_SIZES];

/** Boy kimliğinden kapak boyu (bilinmiyorsa ilk boy) — tuval ve indirme ekranı aynı sonucu alır. */
export function resolveCoverSize(id: string | undefined | null): BookSize {
  return COVER_SIZES.find((s) => s.id === id) ?? BOOK_SIZES[0];
}

/** Tam kapak tuvalinin baskı ölçülerini hesaplar (hepsi mm). */
export function calcSpread(
  size: BookSize,
  pageCount: number,
  paperId: PaperId,
  binding: BindingType,
  spineManual: number | null,
  bleedMm: number = DEFAULT_BLEED_MM,
): SpreadDimensions {
  const spine = calcSpineWidth(pageCount, paperId, binding, spineManual);
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
