// Baskı standardı profilleri: KDY (Kitapyurdu) ve Amazon KDP.
// Her standardın boyut, kenar boşluğu, cilt payı (gutter), taşma (bleed) ve
// kesim işareti kuralları farklıdır. LayoutStudio en üstte bir seçici gösterir;
// seçilince bu profilin varsayılanları uygulanır ve PDF çıkışı buna göre kurulur.
//
// Tipografi (font/punto) standarda bağlı DEĞİLDİR — KDP yazı tipi dayatmaz; o
// yüzden gövde/başlık stilleri ortak kalır, yalnızca ÖLÇÜLER değişir.

import { KDY_SIZE, KDY_MARGINS, KDY_BLEED_MM, KDY_MARK_OFFSET_MM } from "./kdy";
import { recommendedGutter, type Margins } from "./page";

export type PrintStandard = "kdy" | "akademi" | "kdp" | "ingram" | "bnpress" | "lulu" | "serbest";

// Sihirbazda kullanıcıya sunulan yayın profilleri (sırayla).
export const WIZARD_PROFILES: { id: PrintStandard; tr: string; en: string; note: { tr: string; en: string } }[] = [
  { id: "kdy", tr: "KDY", en: "KDY", note: { tr: "Roman · 13×19,5 cm", en: "Novel · 130×195 mm" } },
  { id: "akademi", tr: "KDY Akademi", en: "KDY Academic", note: { tr: "Akademik · 15×22,5 cm", en: "Academic · 150×225 mm" } },
  { id: "kdp", tr: "KDP", en: "KDP", note: { tr: "Amazon · 6×9 inç", en: "Amazon · 6×9 in" } },
  { id: "ingram", tr: "Ingram", en: "Ingram", note: { tr: "IngramSpark · 6×9 inç", en: "IngramSpark · 6×9 in" } },
  { id: "serbest", tr: "Serbest", en: "Free", note: { tr: "Boyutu sen seç", en: "You pick the size" } },
];

export type StandardProfile = {
  id: PrintStandard;
  defaultSizeId: string;
  defaultMargins: Margins;
  // Önizleme/dışa-aktarmada cilt payı (mm). pageCount ve mevcut iç kenara göre.
  gutterMm: (pageCount: number, insideMargin: number) => number;
  // PDF taşma payı (mm) — taşma açıkken kullanılacak içerik taşması.
  bleedMm: number;
  // Kesim işaretleri (crop marks) destekleniyor mu (KDY: evet, KDP: hayır).
  cropMarksAllowed: boolean;
  // Kesim işareti açıkken kâğıt kenarının kesim çizgisine uzaklığı (mm).
  markOffsetMm: number;
  // Kullanıcı taşmayı aç/kapat yapabilsin mi (KDP: evet, KDY: hep açık).
  bleedToggle: boolean;
  // Taşma varsayılan durumu (KDP düz metin: kapalı).
  bleedDefaultOn: boolean;
};

// ── KDP (Amazon) kenar boşluğu kuralları ───────────────────────────────────
// KDP, sayfa sayısına göre MİNİMUM iç (cilt) kenarı zorunlu tutar. Aşağıdaki
// değerler resmî tablodan (inç → mm) alınmıştır. Etkin iç kenar bu minimumun
// altına düşerse Amazon dosyayı reddeder; bu yüzden cilt payını otomatik ekleriz.
//   ≤150 sayfa : 0.375" = 9.53 mm
//   151–300    : 0.5"   = 12.70 mm
//   301–500    : 0.625" = 15.88 mm
//   501–700    : 0.75"  = 19.05 mm
//   701–828    : 0.875" = 22.23 mm
export function kdpMinInsideMm(pageCount: number): number {
  if (pageCount <= 150) return 9.53;
  if (pageCount <= 300) return 12.7;
  if (pageCount <= 500) return 15.88;
  if (pageCount <= 700) return 19.05;
  return 22.23;
}

// KDP cilt payı: etkin iç kenar (taban + pay) en az minimumu karşılasın.
// Taban iç kenar zaten minimumu aşıyorsa pay 0 olur.
function kdpGutter(pageCount: number, insideMargin: number): number {
  const need = kdpMinInsideMm(pageCount) - insideMargin;
  return need > 0 ? Math.round(need * 10) / 10 : 0;
}

// KDP standart kesim payı: 0.125 inç = 3.175 mm.
export const KDP_BLEED_MM = 3.175;

// KDP varsayılan kenar boşlukları (mm). 6×9 için ferah, okunur bir düzen;
// düşük sayfa sayılarında KDP minimumunu rahatça aşar.
export const KDP_MARGINS: Margins = {
  top: 19,
  bottom: 19,
  inside: 19,
  outside: 16,
};

export const KDP_DEFAULT_SIZE_ID = "kdp-6x9";

export const STANDARD_PROFILES: Record<PrintStandard, StandardProfile> = {
  kdy: {
    id: "kdy",
    defaultSizeId: KDY_SIZE.id,
    defaultMargins: { ...KDY_MARGINS },
    // KDY: mevcut sayfa-sayısı tablosu (iç kenardan bağımsız ek pay).
    gutterMm: (pageCount) => recommendedGutter(pageCount),
    bleedMm: KDY_BLEED_MM,
    cropMarksAllowed: true,
    markOffsetMm: KDY_MARK_OFFSET_MM,
    bleedToggle: false,
    bleedDefaultOn: true,
  },
  // KDY Akademi: KDY ailesinin akademik baskısı. Daha büyük trim (15×22,5 cm),
  // biraz daha ferah kenar boşlukları; taşma + kesim işaretleri KDY gibi açık.
  akademi: {
    id: "akademi",
    defaultSizeId: "tr-150x225",
    defaultMargins: { top: 22, bottom: 22, inside: 22, outside: 18 },
    gutterMm: (pageCount) => recommendedGutter(pageCount),
    bleedMm: KDY_BLEED_MM,
    cropMarksAllowed: true,
    markOffsetMm: KDY_MARK_OFFSET_MM,
    bleedToggle: false,
    bleedDefaultOn: true,
  },
  kdp: {
    id: "kdp",
    defaultSizeId: KDP_DEFAULT_SIZE_ID,
    defaultMargins: { ...KDP_MARGINS },
    gutterMm: (pageCount, inside) => kdpGutter(pageCount, inside),
    bleedMm: KDP_BLEED_MM,
    cropMarksAllowed: false,
    markOffsetMm: 0,
    bleedToggle: true,
    bleedDefaultOn: false,
  },
  // IngramSpark baskı: iç sayfa ölçü davranışı KDP ile aynıdır (gömülü font,
  // tam kesim boyutu, dış kenarlarda 0.125" ≈ 3,175 mm taşma, sayfa-sayısına
  // bağlı cilt payı). Tek fark, Ingram'in PDF/X-1a / PDF/X-3 istemesidir —
  // bu, tarayıcıda üretilen düz PDF için ayrı bir sunucu dönüşümü gerektirir
  // (KDY'nin CMYK isteğiyle aynı sınır). Standart ölçüleri burada karşılarız.
  ingram: {
    id: "ingram",
    defaultSizeId: KDP_DEFAULT_SIZE_ID,
    defaultMargins: { ...KDP_MARGINS },
    gutterMm: (pageCount, inside) => kdpGutter(pageCount, inside),
    bleedMm: KDP_BLEED_MM,
    cropMarksAllowed: false,
    markOffsetMm: 0,
    bleedToggle: true,
    bleedDefaultOn: false,
  },
  // Barnes & Noble Press: iç sayfa ölçü davranışı KDP ile aynıdır (standart
  // boyutlar, sayfa-sayısına bağlı cilt payı, 0.125" ≈ 3,175 mm taşma, tam kesim
  // boyutu, gömülü font). Ingram'in aksine özel PDF/X istemez — normal PDF kabul
  // eder, yani KDP ile aynı çıkış borusunu kullanır.
  bnpress: {
    id: "bnpress",
    defaultSizeId: KDP_DEFAULT_SIZE_ID,
    defaultMargins: { ...KDP_MARGINS },
    gutterMm: (pageCount, inside) => kdpGutter(pageCount, inside),
    bleedMm: KDP_BLEED_MM,
    cropMarksAllowed: false,
    markOffsetMm: 0,
    bleedToggle: true,
    bleedDefaultOn: false,
  },
  // Lulu: küresel talep-üzerine baskı. İç sayfa ölçüleri yine KDP ailesiyle
  // aynıdır (standart boyutlar, sayfa-sayısına bağlı cilt payı, 0.125" taşma,
  // tam kesim, gömülü font). Normal PDF kabul eder.
  lulu: {
    id: "lulu",
    defaultSizeId: KDP_DEFAULT_SIZE_ID,
    defaultMargins: { ...KDP_MARGINS },
    gutterMm: (pageCount, inside) => kdpGutter(pageCount, inside),
    bleedMm: KDP_BLEED_MM,
    cropMarksAllowed: false,
    markOffsetMm: 0,
    bleedToggle: true,
    bleedDefaultOn: false,
  },
  // Serbest: belirli bir platforma bağlı değil. Esnek, makul bir varsayılan
  // (13,5×21 cm); kullanıcı boyutu/marjları dilediğince değiştirir, taşmayı açıp
  // kapatabilir, kesim işaretlerini kullanabilir.
  serbest: {
    id: "serbest",
    defaultSizeId: "tr-135x210",
    defaultMargins: { top: 18, bottom: 18, inside: 18, outside: 15 },
    gutterMm: (pageCount) => recommendedGutter(pageCount),
    bleedMm: 3,
    cropMarksAllowed: true,
    markOffsetMm: 5,
    bleedToggle: true,
    bleedDefaultOn: false,
  },
};

// Dışa-aktarma için etkin taşma payı: KDP'de taşma kapalıysa 0 (PDF tam kesim
// boyutunda), aksi halde profilin taşma payı.
export function effectiveBleedMm(standard: PrintStandard, bleedOn: boolean): number {
  const p = STANDARD_PROFILES[standard];
  if (p.bleedToggle && !bleedOn) return 0;
  return p.bleedMm;
}
