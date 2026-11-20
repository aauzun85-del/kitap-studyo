// SHOPIER KART ÖDEMESİ — saf (yan etkisiz) eşleme ve denetim kuralları.
// Bu dosyada gizli anahtar ve ağ çağrısı YOKTUR; hem tarayıcıdan (Checkout)
// hem sunucudan içe aktarılabilir. Shopier'e konuşan kod: src/lib/server/shopier.ts.
//
// Shopier'de ürünleri API ile açamıyoruz (hesabımıza /products kapalı) ve ödeme
// sayfasına sipariş numarası taşıyamıyoruz. Bu yüzden her paket için elle açılmış
// SABİT bir ürün sayfası vardır; üye orada öder, biz ödemeyi alıcının e-postası ve
// ürün numarasıyla üyenin "bekleyen" siparişine bağlarız (shopierSync.ts).

import { findProduct, type CreditPackage, type ProductKind } from "./pricing";

export type ShopierProduct = { productId: string; url: string };

// GİZLİ DENEME PAKETİ — gerçek kartla uçtan uca deneme için. CREDIT_PACKAGES'te
// YOKTUR, hiçbir listede görünmez; yalnız yöneticiler /satin-al?paket=deneme ile
// açabilir. "addon" türündedir: 1 jeton ekler, indirme hakkı AÇMAZ.
export const TEST_PACKAGE_ID = "deneme";
export const TEST_PACKAGE: CreditPackage = {
  id: TEST_PACKAGE_ID,
  name: { tr: "Deneme (1 jeton)", en: "Test (1 credit)" },
  credits: 1,
  priceTry: 20,
};

// Paket → Shopier ürün sayfası. Pro ve Mega için henüz ürün açılmadı; onlar
// bugünkü "bize yaz" yolunda kalır. Yeni ürün açılınca SADECE buraya eklenir.
const SHOPIER_PRODUCTS: Record<string, ShopierProduct> = {
  eco: { productId: "53189572", url: "https://www.shopier.com/Laycoty/53189572" },
  [TEST_PACKAGE_ID]: { productId: "53189711", url: "https://www.shopier.com/Laycoty/53189711" },
};

// Bu paket kartla (Shopier) alınabiliyor mu? Alınamıyorsa null.
export function shopierProductFor(packageId: string): ShopierProduct | null {
  return SHOPIER_PRODUCTS[packageId] ?? null;
}

// Kartla satılabilen ürünü bul (deneme paketi dahil). Yönetici denetimi çağırandadır.
export function findCardProduct(
  packageId: string,
): { product: CreditPackage; kind: ProductKind; shopier: ShopierProduct } | undefined {
  const shopier = shopierProductFor(packageId);
  if (!shopier) return undefined;
  if (packageId === TEST_PACKAGE_ID) return { product: TEST_PACKAGE, kind: "addon", shopier };
  const found = findProduct(packageId);
  return found ? { ...found, shopier } : undefined;
}

// Shopier ürün numarasından pakete (ödeme hangi paket için yapılmış?).
export function cardProductByShopierId(productId: string) {
  const id = Object.keys(SHOPIER_PRODUCTS).find((k) => SHOPIER_PRODUCTS[k].productId === productId);
  return id ? findCardProduct(id) : undefined;
}

// Kartla satılan bütün Shopier ürün numaraları (eşleşmeyen ödeme taraması için).
export function mappedShopierProductIds(): string[] {
  return Object.values(SHOPIER_PRODUCTS).map((p) => p.productId);
}

// Kartla ödemenin açıldığı an. Bundan ÖNCEKİ Shopier siparişleri (deneme
// ödemeleri) "eşleşmeyen ödemeler" listesine hiç girmez.
export const SHOPIER_LAUNCH_AT = "2026-11-20T18:45:00+03:00";

// Bekleyen kart siparişi bu kadar saat ödeme bekler; sonrası kendiliğinden
// eşleşmez (üye yeniden "Kartla öde"ye basar ya da yönetici elle tanımlar).
export const CARD_PENDING_HOURS = 48;
// "Kartla öde"ye yeniden basılınca bu kadar saatten genç satır yeniden kullanılır;
// daha eskisi için TAZE satır açılır (yoksa 47. saatte basıp 49. saatte ödeyen
// üyenin ödemesi 48 saat sınırına takılıp eşleşmezdi).
export const CARD_REUSE_HOURS = 24;
// Bir üyenin aynı anda açık tutabileceği ödenmemiş kart siparişi sayısı.
export const CARD_MAX_OPEN_ROWS = 3;
// Sunucu saatleri arasındaki küçük fark için hoşgörü.
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const SHOPIER_REF_PREFIX = "shopier:";
export const shopierRef = (orderId: string) => `${SHOPIER_REF_PREFIX}${orderId}`;

// Shopier sipariş yanıtının kullandığımız kadarı (gerçek yanıttan doğrulandı).
export type ShopierOrder = {
  id: string;
  status?: string;
  paymentStatus?: string;
  dateCreated?: string;
  currency?: string;
  totals?: { subtotal?: string; shipping?: string; discount?: string; total?: string };
  shippingInfo?: { firstName?: string; lastName?: string; email?: string } | null;
  billingInfo?: { firstName?: string; lastName?: string; email?: string } | null;
  lineItems?: { productId?: string | number; title?: string; quantity?: number | string; price?: string; total?: string }[];
  refunds?: unknown[];
  returns?: unknown[];
};

// Shopier tarihi "2026-11-20T18:15:53+0300" biçimindedir (saat farkında iki
// nokta yok); her JS motoru bunu çözmez → önce "+03:00" hâline getir.
export function shopierDateMs(s: string | undefined | null): number {
  if (!s) return NaN;
  return new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime();
}

export const normEmail = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Alıcının e-postası: teslimat bilgisinden, yoksa fatura bilgisinden.
export function shopierBuyerEmail(o: ShopierOrder): string {
  return normEmail(o.shippingInfo?.email) || normEmail(o.billingInfo?.email);
}

export type ShopierCheck =
  | {
      ok: true;
      packageId: string;
      product: CreditPackage;
      kind: ProductKind;
      email: string;
      paidAtMs: number;
      paidAtIso: string;
    }
  | { ok: false; reason: string };

// PARA GÜVENLİĞİ — bir Shopier siparişi jetona çevrilebilir mi? (1. kural)
// Ödenmiş, TL, TEK kalem, TEK adet, bildiğimiz ürün, fiyat paket fiyatına eşit,
// indirimsiz, iadesiz. totals.total fiyattan BÜYÜK olabilir (taksit farkını alıcı
// öder) → eşitlik aranmaz. Kurallardan biri tutmazsa sipariş kendiliğinden
// tanımlanmaz; yönetici bakar.
export function checkShopierOrder(o: ShopierOrder): ShopierCheck {
  if (!o || typeof o.id !== "string" || !/^\d{1,20}$/.test(o.id)) return { ok: false, reason: "bad-id" };
  if (o.paymentStatus !== "paid") return { ok: false, reason: "not-paid" };
  // Sipariş durumu yalnız bildiğimiz iki değerden biri olabilir (iptal vb. → yönetici bakar).
  if (o.status !== "unfulfilled" && o.status !== "fulfilled") return { ok: false, reason: "status" };
  if (o.currency !== "TRY") return { ok: false, reason: "currency" };
  const items = Array.isArray(o.lineItems) ? o.lineItems : [];
  if (items.length !== 1) return { ok: false, reason: "line-items" };
  const item = items[0];
  if (Number(item.quantity) !== 1) return { ok: false, reason: "quantity" };
  const found = cardProductByShopierId(String(item.productId ?? ""));
  if (!found) return { ok: false, reason: "unknown-product" };
  // Boş/eksik alan "0" sayılmasın: Number(null) ve Number("") sıfırdır.
  const num = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  if (num(item.price) !== found.product.priceTry) return { ok: false, reason: "price" };
  if (num(o.totals?.discount) !== 0) return { ok: false, reason: "discount" };
  // Alan yoksa ya da dizi değilse "boş" sayma: emin olamadığımız siparişi tanımlama.
  if (!Array.isArray(o.refunds) || o.refunds.length > 0) return { ok: false, reason: "refunded" };
  if (!Array.isArray(o.returns) || o.returns.length > 0) return { ok: false, reason: "returned" };
  const paidAtMs = shopierDateMs(o.dateCreated);
  if (!Number.isFinite(paidAtMs)) return { ok: false, reason: "bad-date" };
  const email = shopierBuyerEmail(o);
  if (!email) return { ok: false, reason: "no-email" };
  return {
    ok: true,
    packageId: found.product.id,
    product: found.product,
    kind: found.kind,
    email,
    paidAtMs,
    paidAtIso: new Date(paidAtMs).toISOString(),
  };
}
