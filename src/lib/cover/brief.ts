// KAPAK KURGUSU: tuvalden önceki soru-cevap adımının verisi.
// Kullanıcı önce kitabın TÜRÜNÜ (Thema kodu) seçer → o türün kapak standardı
// (3 KONSEPT) gelir → konsept, YAZI STİLİ, TON ve KAPSAM seçilir. Bunlar ChatGPT
// görsel modeline giden katmanlı komutun "konsept + palet" katmanlarını doldurur;
// yazı stili tuvalde şablon + başlık konumu olarak uygulanır. Metin asla görsele
// basılmaz. Tür/konsept ağacı: ./standards.ts

import { getConceptOf, resolveStandard } from "./standards";

export type Tone = "light" | "mid" | "dark";
export type BriefScope = "front" | "wrap";

export type CoverBrief = {
  v: 2;
  /** Thema konu kodu (tür). */
  themaCode: string;
  /** Türün standardındaki konsept id'si. */
  conceptId: string;
  textStyleId: string;
  /** Başlık/yazar/tür etiketini kim bassın: "ai" = ChatGPT görsele gömer
   *  (örnek kapaklardaki kalite; sonradan düzenlenemez), "app" = uygulama kendi
   *  fontuyla bindirir (düzenlenebilir). Varsayılan "ai". */
  textBy?: "ai" | "app";
  tone: Tone;
  scope: BriefScope;
  /** Kullanıcının serbest notu ("kapakta bir fener olsun" gibi) — sahneye eklenir. */
  note?: string;
  /** Kullanıcı "kendim tasarlayacağım" dedi → otomatik üretim/yönlendirme yok. */
  skipped?: boolean;
  createdAt: string;
};

// Yazı stili = tuvalde bir şablon tarifi (font/ağırlık/büyük harf) + başlık yeri.
// Önizleme için CSS font ailesi ve büyük harf bilgisi de burada.
export type BriefTextStyle = {
  id: string;
  name: { tr: string; en: string };
  templateId: string; // TEMPLATE_RECIPES id'si (font/ağırlık/büyük harf oradan)
  previewFamily: string; // CSS önizleme
  previewWeight: number;
  upper?: boolean;
  spacing?: number; // harf aralığı (em*1000)
};

export const BRIEF_TEXT_STYLES: BriefTextStyle[] = [
  { id: "edebi", name: { tr: "Edebi serif", en: "Literary serif" }, templateId: "edebi", previewFamily: '"Cormorant Garamond", Georgia, serif', previewWeight: 600 },
  { id: "modern", name: { tr: "Modern kalın", en: "Modern bold" }, templateId: "sade", previewFamily: '"Manrope", system-ui, sans-serif', previewWeight: 800 },
  { id: "klasik", name: { tr: "Klasik", en: "Classic" }, templateId: "klasik", previewFamily: '"Playfair Display", Georgia, serif', previewWeight: 700 },
  { id: "buyuk-tipo", name: { tr: "Büyük tipografi", en: "Big type" }, templateId: "tipo", previewFamily: '"Bebas Neue", Impact, sans-serif', previewWeight: 400, upper: true, spacing: 30 },
  { id: "mistik", name: { tr: "Mistik büyük harf", en: "Mystic caps" }, templateId: "mistik", previewFamily: '"Cinzel", Georgia, serif', previewWeight: 600, upper: true, spacing: 40 },
  { id: "panelli", name: { tr: "Panelli (yoğun görsel için)", en: "Panelled (for busy art)" }, templateId: "sahne", previewFamily: '"EB Garamond", Georgia, serif', previewWeight: 600 },
];

export const TONE_PROMPTS: Record<Tone, string> = {
  light: "Palette: light and airy overall — pale grounds, soft mid-tone details; avoid large dark or black areas.",
  mid: "Palette: balanced mid-tones with gentle contrast; neither washed-out nor heavy; avoid large pure-black areas.",
  dark: "Palette: deep and dark overall with a single luminous focal light; keep the title zone and logo zone smoother and slightly lighter so printed text stays readable.",
};

export function getTextStyle(id: string): BriefTextStyle {
  return BRIEF_TEXT_STYLES.find((s) => s.id === id) ?? BRIEF_TEXT_STYLES[0];
}

/** Kurgudan katmanlı komutun "stil" katmanı: tür standardı + konsept + ton. */
export function briefStyleOverride(brief: CoverBrief): {
  stylePrompt: string;
  dark: boolean;
  tone: Tone;
} {
  const standard = resolveStandard(brief.themaCode);
  const concept = getConceptOf(standard, brief.conceptId);
  return {
    stylePrompt: concept.prompt,
    dark: !!concept.dark || brief.tone === "dark",
    tone: brief.tone,
  };
}

/** Örnek görsel yolu: public/kurgu/<THEMA>/<1|2|3>.jpg (konsept sırası). */
export function briefExampleSrc(themaCode: string, conceptIndex: number): string {
  return `/kurgu/${themaCode}/${conceptIndex + 1}.jpg`;
}

export function defaultBrief(themaCode = "FB"): CoverBrief {
  const standard = resolveStandard(themaCode);
  return {
    v: 2,
    themaCode: standard.code,
    conceptId: standard.concepts[0].id,
    textStyleId: BRIEF_TEXT_STYLES[0].id,
    textBy: "ai",
    tone: "light",
    scope: "wrap",
    createdAt: new Date().toISOString(),
  };
}
