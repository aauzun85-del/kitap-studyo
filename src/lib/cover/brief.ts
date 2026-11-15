// KAPAK KURGUSU: tuvalden önceki soru-cevap adımının verisi.
// Kullanıcı önce kitabın TÜRÜNÜ (Thema kodu) seçer → o türün kapak standardı
// (3 KONSEPT) gelir → konsept, YAZI STİLİ, TON ve KAPSAM seçilir. Bunlar ChatGPT
// görsel modeline giden katmanlı komutun "konsept + palet" katmanlarını doldurur;
// yazı stili tuvalde şablon + başlık konumu olarak uygulanır. Metin asla görsele
// basılmaz. Tür/konsept ağacı: ./standards.ts

import { getConceptOf, resolveStandard } from "./standards";

// "concept" = konseptin KENDİ paleti (varsayılan). Açık/Orta/Koyu yalnız kullanıcı
// bilerek seçerse devreye girer ve konseptin paletini o yöne kaydırır.
export type Tone = "concept" | "light" | "mid" | "dark";
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
  /** Tonu kullanıcı BİLEREK seçti. Yoksa (eski kurgularda varsayılan "light"
   *  kaydedilmişti ve konsepti eziyordu) ton = konseptin kendi paleti sayılır. */
  toneChosen?: boolean;
  scope: BriefScope;
  /** Yazar kendi fotoğrafını yükledi (fotoğraf IndexedDB'de bekler, bkz.
   *  briefPhoto.ts). Varsa kapağı yapay zekâ değil uygulama kurar. */
  photo?: { mono: boolean };
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

// Yalnız kullanıcı tonu bilerek seçtiyse komuta girer: konseptin paletini
// DEĞİŞTİRMEZ, aynı renk ailesini açık/orta/koyu anahtara kaydırır.
export const TONE_PROMPTS: Record<Exclude<Tone, "concept">, string> = {
  light:
    "Tone adjustment (requested): keep the CONCEPT's medium, hues and composition, but play it in a LIGHT key — " +
    "paler grounds, softer mid-tone details; avoid large dark or black areas.",
  mid:
    "Tone adjustment (requested): keep the CONCEPT's medium, hues and composition, but play it in a balanced " +
    "MID-TONE key with gentle contrast; neither washed-out nor heavy; avoid large pure-black areas.",
  dark:
    "Tone adjustment (requested): keep the CONCEPT's medium, hues and composition, but play it in a DEEP, DARK key; " +
    "keep the text areas and the logo zone smoother and slightly lighter so printed text stays readable.",
};

/** Geçerli ton: kullanıcı bilerek seçmediyse konseptin kendi paleti. */
export function effectiveTone(brief: Pick<CoverBrief, "tone" | "toneChosen">): Tone {
  // Bu alan eklenmeden önce kaydedilen kurgularda varsayılan "light" idi; kayıtlı
  // "mid"/"dark" ancak bilerek seçilmiş olabilir → korunur.
  const chosen = brief.toneChosen ?? (brief.tone === "mid" || brief.tone === "dark");
  return chosen ? brief.tone : "concept";
}

export function getTextStyle(id: string): BriefTextStyle {
  return BRIEF_TEXT_STYLES.find((s) => s.id === id) ?? BRIEF_TEXT_STYLES[0];
}

/** Kurgudan katmanlı komutun "konsept" katmanı: tür standardı + konsept + ton. */
export function briefStyleOverride(brief: CoverBrief): {
  stylePrompt: string;
  dark: boolean;
  tone: Tone;
  /** Yalnız ton bilerek seçildiyse dolu; yoksa palet = konseptin kendi paleti. */
  tonePrompt?: string;
  textLayout?: string;
  noteAsText: boolean;
} {
  const standard = resolveStandard(brief.themaCode);
  const concept = getConceptOf(standard, brief.conceptId);
  const tone = effectiveTone(brief);
  return {
    stylePrompt: concept.prompt,
    // Koyu/açık zemin kuralları (arka kapak, logo bandı): ton seçilmediyse
    // konseptin doğası, seçildiyse kullanıcının tonu belirler.
    dark: tone === "concept" ? !!concept.dark : tone === "dark",
    tone,
    tonePrompt: tone === "concept" ? undefined : TONE_PROMPTS[tone],
    textLayout: concept.textLayout,
    noteAsText: !!concept.noteAsText,
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
    tone: "concept",
    scope: "wrap",
    createdAt: new Date().toISOString(),
  };
}
