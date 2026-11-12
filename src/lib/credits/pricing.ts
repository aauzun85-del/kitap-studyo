// JETON STANDARDI — Kitap Stüdyosu üyelik sistemi.
import type { Locale } from "@/i18n/config";
//
// Her "pahalı" AI işlemi (görsel üretimi, seslendirme, editör incelemesi vb.)
// belli sayıda JETON yakar. Fiyatlar işin bize maliyetiyle orantılıdır:
// AI görsel üretimi en pahalı, kısa metin yardımcıları en ucuz.
//
// TEK KAYNAK: Bir işin fiyatını değiştirmek istersen SADECE bu tabloyu düzenle.
// Uç noktalar (src/app/api/.../route.ts) kendi anahtarlarıyla bu tabloya bakar.
//
// Not: Admin (ADMIN_EMAILS) ve fiyatı 0 olan işler jeton yakmaz.

// Yeni üye kayıt olduğunda hesabına yatan "hoş geldin" jetonu.
// (Supabase tarafında da aynı değer var: supabase/migrations/0002_credits.sql)
export const WELCOME_CREDITS = 100;

// Jeton yakan işlemlerin anahtarları. Her uç nokta kendi anahtarını kullanır.
export type CreditAction =
  // — AI görsel üretimi (en pahalı) —
  | "cover-art" // FLUX 1.1 Pro ile kapak görseli
  | "cover-ideogram" // Ideogram v3 ile kapak görseli
  | "cover-nano" // Nano Banana Pro ile kapak görseli
  | "cover-edit" // FLUX Fill Pro ile kapak düzenleme (inpaint)
  | "cover-element" // AI tasarım öğesi (mühür/rozet) üretimi
  | "promo-image" // Instagram tanıtım görseli
  // — Ses —
  | "tts" // Metni sese çevirme (bölüm başına)
  // — AI editör —
  | "editor-review-deep" // Derin editöryal inceleme (Opus)
  | "editor-review" // Hızlı editöryal inceleme (Haiku)
  | "editor-check" // Yazım/dil denetimi
  // — Kısa metin yardımcıları (en ucuz) —
  | "editor-genre" // Tür tespiti
  | "editor-risk" // KDP risk taraması
  | "cover-tags" // Anahtar kelime/etiket
  | "cover-prompt" // Kapak komutu önerisi
  | "cover-detect" // Kapak öğesi tespiti
  | "promo-generate"; // Tanıtım metni üretimi

// Jeton fiyat tablosu. (Kararlaştırılan standart — 2026)
export const PRICING: Record<CreditAction, number> = {
  // Görsel üretimi
  "cover-art": 10,
  "cover-ideogram": 10,
  "cover-nano": 10,
  "cover-edit": 8,
  "cover-element": 8,
  "promo-image": 8,
  // Ses (uzun/pahalı üretim — jeton başı maliyeti dengelemek için yükseltildi)
  tts: 12,
  // AI editör
  "editor-review-deep": 25, // Opus derin inceleme gerçek maliyeti yüksek → dengelendi
  "editor-review": 1,
  "editor-check": 1,
  // Kısa metin yardımcıları
  "editor-genre": 1,
  "editor-risk": 1,
  "cover-tags": 1,
  "cover-prompt": 1,
  "cover-detect": 1,
  "promo-generate": 1,
};

// Bir işlemin jeton bedelini döndürür (bilinmeyen işlem = 0, yani ücretsiz).
export function creditCost(action: CreditAction): number {
  return PRICING[action] ?? 0;
}

// ───────────────────────── SATIN ALMA / PAKETLER ─────────────────────────

// Satın alınan jetonların geçerlilik süresi (gün). Bu süre sonunda o paketin
// jetonları yanar. Supabase tarafında da aynı sayı kullanılır (approve).
export const PACKAGE_VALIDITY_DAYS = 30;

// İndirme/dışa aktarma yalnız AKTİF paketi olana açık mı?
export const EXPORT_REQUIRES_PACKAGE = true;
// Erişim modeli: true = abonelik (paket süresi geçince indirme tekrar kilitlenir).
// false = ilk alımda kalıcı açılır (jetonlar yine 30 günde yanar). Şimdilik: abonelik.
export const ACCESS_RELOCK_AFTER_EXPIRY = true;

export type CreditPackage = {
  id: string;
  name: Record<Locale, string>;
  credits: number;
  priceTry: number;
  badge?: Record<Locale, string>;
};

// Jeton paketleri. Fiyat/adet değiştirmek için SADECE burayı düzenle.
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "eco", name: { tr: "Eco", en: "Eco" }, credits: 200, priceTry: 2900 },
  {
    id: "pro",
    name: { tr: "Pro", en: "Pro" },
    credits: 700,
    priceTry: 4900,
    badge: { tr: "Popüler", en: "Popular" },
  },
  {
    id: "mega",
    name: { tr: "Mega", en: "Mega" },
    credits: 2000,
    priceTry: 9900,
    badge: { tr: "En avantajlı", en: "Best value" },
  },
];

// EK JETON — aktif paketi olan üyenin, yeni paket almadan bakiyesine eklediği
// jeton. İndirme hakkı vermez (o hak paketle gelir); satın alındığı andan
// itibaren PACKAGE_VALIDITY_DAYS gün geçerlidir. Fiyat/adet için SADECE burası.
export const CREDIT_ADDONS: CreditPackage[] = [
  { id: "ek100", name: { tr: "100 ek jeton", en: "100 extra credits" }, credits: 100, priceTry: 900 },
  { id: "ek500", name: { tr: "500 ek jeton", en: "500 extra credits" }, credits: 500, priceTry: 3500 },
  {
    id: "ek10000",
    name: { tr: "10.000 ek jeton", en: "10,000 extra credits" },
    credits: 10000,
    priceTry: 45000,
  },
];

export function findPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

// Havale/EFT bilgileri — satın alma sayfasında gösterilir.
// TODO: gerçek bilgilerle değiştir (kullanıcı verecek).
export const BANK_INFO = {
  bankName: "— (buraya banka adı gelecek)",
  iban: "TR00 0000 0000 0000 0000 0000 00",
  accountName: "— (hesap sahibi adı soyadı)",
  note: "Açıklamaya referans kodunu yazmayı unutma.",
};
