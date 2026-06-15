// KDY (Kitapyurdu Doğrudan Yayıncılık) iç sayfa standardı.
// Kaynak: ~/Downloads/icsayfa/ — KDY-sablon-130x195.idml + kdy-sablon-kilavuz.pdf.
// Asıl InDesign şablonundan punto/mm olarak çıkarılan kesin ölçüler.
//
// Font notu: KDY orijinalde Arno Pro kullanır (Adobe lisanslı — web'de
// dağıtılamaz). Yerine ÜCRETSİZ muadiller koyuyoruz:
//   - Gövde/başlık (Arno yerine): Source Serif 4 (SIL OFL, Google Fonts)
//   - Kitap adı / yazar / biyografi: Vollkorn (OFL, Google Fonts) — KDY zaten
//     bunları Vollkorn ile kuruyor.

import type { BookSize } from "@/lib/cover/spread";
import type { Margins } from "./page";

// ── Sayfa boyutu ──────────────────────────────────────────────────────────
// 368.50 × 552.76 pt = 130 × 195 mm ("roman boy"). Karşılıklı sayfa (facing).
export const KDY_SIZE: BookSize = {
  id: "kdy-130x195",
  label: "KDY 130×195 mm (Roman boy)",
  width: 130,
  height: 195,
  category: "tr",
};

// ── Kenar boşlukları (mm) ─────────────────────────────────────────────────
// IDML: üst 20, alt 20, iç(cilt) 20, dış 15.
export const KDY_MARGINS: Margins = {
  top: 20,
  bottom: 20,
  inside: 20,
  outside: 15,
};

// Taşma payı (bleed) — her kenarda 5 mm (14.1732 pt). İçerik bu kadar kesim
// çizgisinin dışına taşar; BleedBox bu kenardadır.
export const KDY_BLEED_MM = 5;

// Kesim işareti (cross) alanı — sayfa (MediaBox) kesim çizgisinden bu kadar
// dışarı uzar. KDY şablonunda 21 pt ≈ 7.41 mm; kesim işaretleri bleed'in
// DIŞINDA, bu ek ~2.5 mm'lik bantta durur. Pratikte 7.5 mm kullanıyoruz.
export const KDY_MARK_OFFSET_MM = 7.5;

// ── Ücretsiz font eşlemesi ────────────────────────────────────────────────
// Tuval (canvas) ve CSS bu kanonik adları kullanır; layout.tsx Google Fonts
// <link>'inde yüklenir.
export const KDY_BODY_FONT = "Source Serif 4"; // Arno Pro muadili (gövde/başlık)
export const KDY_TITLE_FONT = "Vollkorn"; // kitap adı / yazar / biyografi

// ── Paragraf stilleri ─────────────────────────────────────────────────────
// KDY adlandırılmış stilleri. Punto, font, hizalama, girinti (mm), paragraf
// sonrası boşluk (mm) ve satır aralığı (leading, pt) ile.
export type KdyAlign = "left" | "center" | "justify";

export type KdyStyle = {
  name: string; // KDY stil adı
  sizePt: number;
  font: string; // canvas font adı
  weight: number; // 400 normal, 600 semibold, 700 bold
  italic?: boolean;
  align: KdyAlign;
  firstLineIndentMm: number; // ilk satır girintisi
  spaceAfterMm: number; // paragraf sonrası boşluk
  leadingPt: number; // satır yüksekliği (mutlak pt; 0 = auto ~ %120)
};

// Gövde metni. Leading 15pt → 11pt punto için ≈ 1.36 satır aralığı.
export const KDY_BODY: KdyStyle = {
  name: "KDY - genel",
  sizePt: 11,
  font: KDY_BODY_FONT,
  weight: 400,
  align: "justify",
  firstLineIndentMm: 5,
  spaceAfterMm: 2,
  leadingPt: 15,
};

// Başlık seviyeleri 1–4 (24/20/18/16 pt, Bold). Başlık-1 ve -2 ortalı.
export const KDY_HEADINGS: Record<1 | 2 | 3 | 4, KdyStyle> = {
  1: {
    name: "KDY - baslik - 1",
    sizePt: 24,
    font: KDY_BODY_FONT,
    weight: 700,
    align: "center",
    firstLineIndentMm: 0,
    spaceAfterMm: 3,
    leadingPt: 0,
  },
  2: {
    name: "KDY - baslik - 2",
    sizePt: 20,
    font: KDY_BODY_FONT,
    weight: 700,
    align: "center",
    firstLineIndentMm: 0,
    spaceAfterMm: 3,
    leadingPt: 0,
  },
  3: {
    name: "KDY - baslik - 3",
    sizePt: 18,
    font: KDY_BODY_FONT,
    weight: 700,
    align: "left",
    firstLineIndentMm: 0,
    spaceAfterMm: 3,
    leadingPt: 0,
  },
  4: {
    name: "KDY - baslik - 4",
    sizePt: 16,
    font: KDY_BODY_FONT,
    weight: 700,
    align: "left",
    firstLineIndentMm: 0,
    spaceAfterMm: 3,
    leadingPt: 0,
  },
};

// Başlık (kapak/künye) sayfası stilleri.
export const KDY_TITLE: KdyStyle = {
  name: "KDY - kitap adi",
  sizePt: 22,
  font: KDY_TITLE_FONT,
  weight: 700,
  align: "center",
  firstLineIndentMm: 0,
  spaceAfterMm: 4,
  leadingPt: 0,
};

export const KDY_AUTHOR: KdyStyle = {
  name: "KDY - yazar",
  sizePt: 12,
  font: KDY_TITLE_FONT,
  weight: 700,
  align: "center",
  firstLineIndentMm: 0,
  spaceAfterMm: 3,
  leadingPt: 0,
};

// Yazar biyografisi sayfası.
export const KDY_BIO: KdyStyle = {
  name: "KDY - biyografi",
  sizePt: 9,
  font: KDY_TITLE_FONT,
  weight: 400,
  align: "justify",
  firstLineIndentMm: 5,
  spaceAfterMm: 2,
  leadingPt: 0,
};

// İçindekiler (otomatik) — girişler ortalı 9pt, başlığı 11pt Semibold ortalı.
export const KDY_TOC: KdyStyle = {
  name: "KDY - icindekiler",
  sizePt: 9,
  font: KDY_BODY_FONT,
  weight: 400,
  align: "center",
  firstLineIndentMm: 0,
  spaceAfterMm: 1,
  leadingPt: 0,
};

export const KDY_TOC_HEADING: KdyStyle = {
  name: "KDY - icindekiler - baslik",
  sizePt: 11,
  font: KDY_BODY_FONT,
  weight: 600,
  align: "center",
  firstLineIndentMm: 0,
  spaceAfterMm: 3,
  leadingPt: 0,
};

// Dipnot.
export const KDY_FOOTNOTE: KdyStyle = {
  name: "KDY - dipnot",
  sizePt: 9,
  font: KDY_BODY_FONT,
  weight: 400,
  align: "justify",
  firstLineIndentMm: 5,
  spaceAfterMm: 1,
  leadingPt: 0,
};

// ── İç sayfa düzen kuralları ──────────────────────────────────────────────
export const KDY_RULES = {
  // Alıntı (blockquote) bloğunun iki yandan girintisi (mm).
  blockquoteIndentMm: 10,
  // Her ana bölüm SAĞ (tek numaralı) sayfada başlar; gerekirse boş sayfa eklenir.
  chapterStartsOnRightPage: true,
  // KDY ilk 2 sayfayı (künye vb.) sistem ekler — biz künye sayfası koymayız.
  systemAddsImprintPages: true,
  // İçindekiler madde ayıracı: "Başlık • sayfa".
  tocLeader: " • ",
  // Sayfa numarası dış alt köşede.
  pageNumberPosition: "outer-bottom" as const,
  // Üst bilgi (KDY standardı): kitap adı (verso = sol/çift sayfa) — bölüm adı
  // (recto = sağ/tek sayfa). Bölüm açılış sayfalarında koşu başlığı yoktur.
  runningHeads: { verso: "title" as const, recto: "chapter" as const },
};

// ── PDF dışa-aktarma spesifikasyonu (KDY-icsayfa.joboptions) ───────────────
export const KDY_PDF_SPEC = {
  colorSpace: "CMYK" as const, // DocumentCMYK output intent
  pdfVersion: "1.4" as const, // CompatibilityLevel
  imageDpi: 300, // renkli/gri görüntü
  monoDpi: 1200, // tek bit (line art)
  bleedMm: KDY_BLEED_MM,
  pdfX: false, // PDF/X uyumu kapalı (düz CMYK)
  maxInteriorMb: 10,
  maxCoverMb: 20,
};
