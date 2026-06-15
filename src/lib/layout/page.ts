// İç sayfa (mizanpaj) ölçü ve kenar boşluğu matematiği.
// Kapak modülündeki trim boyutlarını yeniden kullanırız; iç sayfa, tek kapağın
// (trim) ölçüsüyle aynı kağıt boyutudur. Buradaki asıl iş kenar boşluklarıdır:
// ciltte kaybolmaması için iç kenara fazladan "cilt payı" (gutter) eklenir.

import { BOOK_SIZES, type BookSize } from "@/lib/cover/spread";

export type { BookSize };

// İç sayfa için aynı boyut listesini kullanıyoruz (KDP + Türkiye boyları).
export const INTERIOR_SIZES: BookSize[] = BOOK_SIZES;
export const DEFAULT_INTERIOR_SIZE_ID = "kdp-6x9";

export function getInteriorSize(id: string): BookSize {
  return INTERIOR_SIZES.find((s) => s.id === id) ?? INTERIOR_SIZES[0];
}

// Kenar boşlukları (mm). inside = cilt (iç) kenar, outside = dış kenar.
export type Margins = {
  top: number;
  bottom: number;
  inside: number; // cilde bakan kenar
  outside: number; // dışa bakan kenar
};

// Cilt payı (gutter): sayfa sayısı arttıkça cilt daha çok "yutar", bu yüzden iç
// kenara eklenen ekstra pay. KDP sayfa-sayısına göre minimum gutter önerir.
export function recommendedGutter(pageCount: number): number {
  if (pageCount <= 150) return 0; // 3.2mm temel iç boşluk yeterli
  if (pageCount <= 300) return 3.2;
  if (pageCount <= 500) return 4.8;
  if (pageCount <= 700) return 6.4;
  return 8;
}

// Hazır kenar boşluğu ön ayarları (mm). gutter ile birleşir.
export type MarginPreset = {
  id: string;
  label: string;
  margins: Margins;
};

export const MARGIN_PRESETS: MarginPreset[] = [
  {
    id: "comfortable",
    label: "Ferah",
    margins: { top: 22, bottom: 22, inside: 19, outside: 16 },
  },
  {
    id: "standard",
    label: "Standart",
    margins: { top: 19, bottom: 19, inside: 16, outside: 13 },
  },
  {
    id: "compact",
    label: "Sıkışık",
    margins: { top: 16, bottom: 16, inside: 14, outside: 11 },
  },
];

export const DEFAULT_MARGIN_PRESET_ID = "standard";

// Verilen sayfanın (tek/çift) etkin kenar boşlukları. Kitapta sağ sayfa (tek
// numara) cilt solda, sol sayfa (çift numara) cilt sağda olur; bu yüzden iç/dış
// kenarlar sayfaya göre yer değiştirir. gutter her zaman iç kenara eklenir.
export type PageGeometry = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  contentWidth: number;
  contentHeight: number;
};

export function pageGeometry(
  size: BookSize,
  margins: Margins,
  gutter: number,
  isRightPage: boolean,
): PageGeometry {
  const inside = margins.inside + gutter;
  const left = isRightPage ? inside : margins.outside;
  const right = isRightPage ? margins.outside : inside;
  const top = margins.top;
  const bottom = margins.bottom;
  return {
    left,
    right,
    top,
    bottom,
    contentWidth: size.width - left - right,
    contentHeight: size.height - top - bottom,
  };
}

// mm → px (belirli bir DPI'da). Ekran önizlemesi için düşük DPI kullanırız.
export function mmToPx(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi;
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * 25.4;
}

// Sayfa numarası tek mi (sağ sayfa)? 1. sayfa sağ sayfadır.
export function isRightPageNumber(pageNumber: number): boolean {
  return pageNumber % 2 === 1;
}
