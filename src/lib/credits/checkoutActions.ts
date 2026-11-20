"use server";

import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { shopierOpenFor } from "@/lib/server/shopier";
import { CARD_MAX_OPEN_ROWS, CARD_PENDING_HOURS, CARD_REUSE_HOURS, TEST_PACKAGE_ID, findCardProduct } from "./shopier";
import { settleForMember } from "./shopierSync";

// ÜYE EYLEMLERİ — kartla (Shopier) satın alma. Server action'lar herkese açık
// uç noktalardır: her biri oturumu KENDİ denetler, fiyatı ve jetonu tarayıcıdan
// değil sunucudaki tablodan alır. Üyeler credit_orders'a yazamaz (RLS yalnız
// okutur) → yazma service-role ile, ama DAİMA oturumdaki üyenin kimliğiyle.

export type CardBilling = {
  type: "bireysel" | "kurumsal";
  name: string;
  taxId: string;
  taxOffice: string;
  email: string;
  address: string;
  district: string;
  city: string;
};

export type StartCardResult =
  | { ok: true; orderId: string; payUrl: string; email: string }
  | { ok: false; error: "auth" | "email-unconfirmed" | "not-ready" | "bad-product" | "terms" | "billing" | "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

function makeRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışabilenler (0/O, 1/I) yok
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LC-${s}`;
}

// Fatura bilgilerinin sunucudaki asgari denetimi (asıl, kullanıcıya dönük denetim
// BillingForm'dadır; burası formu atlayıp doğrudan çağıranlara karşıdır).
function cleanBilling(b: unknown) {
  const v = (b ?? {}) as Record<string, unknown>;
  const company = v.type === "kurumsal";
  const name = str(v.name, 200);
  const taxId = str(v.taxId, 11).replace(/\D/g, "");
  const taxOffice = str(v.taxOffice, 60);
  const email = str(v.email, 200);
  const address = str(v.address, 300);
  const district = str(v.district, 60);
  const city = str(v.city, 60);
  if (name.length < 2 || address.length < 5 || district.length < 2 || city.length < 2) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  if (company ? !/^(\d{10}|\d{11})$/.test(taxId) || taxOffice.length < 2 : taxId !== "" && taxId.length !== 11)
    return null;
  return {
    billing_type: company ? "kurumsal" : "bireysel",
    billing_name: name,
    billing_tax_id: taxId || null,
    billing_tax_office: company ? taxOffice : null,
    billing_email: email,
    billing_address: address,
    billing_district: district,
    billing_city: city,
  };
}

// "Kartla öde": üyenin BEKLEYEN siparişini aç (ya da tazesini yeniden kullan) ve
// Shopier ödeme sayfasının adresini döndür. Bu satır olmadan hiçbir Shopier
// ödemesi kendiliğinden jetona çevrilmez.
export async function startCardPayment(
  lang: string,
  packageId: string,
  billing: CardBilling,
  termsAccepted: boolean,
): Promise<StartCardResult> {
  try {
    if (!isLocale(lang)) return { ok: false, error: "failed" };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "auth" };
    // Ödeme alıcının e-postasıyla eşleştiği için adres doğrulanmış olmalı.
    if (!user.email_confirmed_at) return { ok: false, error: "email-unconfirmed" };
    if (!shopierOpenFor(isAdminEmail(user.email))) return { ok: false, error: "not-ready" };

    const found = typeof packageId === "string" ? findCardProduct(packageId) : undefined;
    if (!found) return { ok: false, error: "bad-product" };
    // Deneme paketi yalnız yöneticiye açıktır (herkes için "böyle bir ürün yok").
    if (found.product.id === TEST_PACKAGE_ID && !isAdminEmail(user.email)) return { ok: false, error: "bad-product" };

    if (termsAccepted !== true) return { ok: false, error: "terms" };
    const bill = cleanBilling(billing);
    if (!bill) return { ok: false, error: "billing" };

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const done = (orderId: string): StartCardResult => ({
      ok: true,
      orderId,
      payUrl: found.shopier.url,
      email: user.email as string,
    });

    // Aynı paket için taze (24 saatten genç), henüz ödenmemiş satır varsa onu kullan
    // (üye düğmeye iki kez bastıysa ya da sayfayı yenilediyse sipariş çoğalmasın).
    // Daha eski satır yeniden kullanılmaz: 48 saat sınırına yakın satırla ödeme
    // yapılırsa ödeme eşleşmeden satırın süresi dolardı.
    const cutoff = new Date(Date.now() - CARD_REUSE_HOURS * 3600 * 1000).toISOString();
    const openRows = () =>
      admin
        .from("credit_orders")
        .select("id")
        .eq("user_id", user.id)
        .eq("package_id", found.product.id)
        .eq("payment_method", "shopier")
        .eq("status", "pending")
        .is("provider_ref", null)
        .gte("created_at", cutoff);
    const { data: open } = await admin
      .from("credit_orders")
      .select("id")
      .eq("user_id", user.id)
      .eq("package_id", found.product.id)
      .eq("payment_method", "shopier")
      .eq("status", "pending")
      .is("provider_ref", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);
    if (open && open.length === 1) {
      // Korumalı güncelleme: bu arada ödeme eşleşip satır sahiplenildiyse dokunma.
      const { data: upd } = await admin
        .from("credit_orders")
        .update({ ...bill, terms_accepted_at: now })
        .eq("id", open[0].id)
        .eq("status", "pending")
        .is("provider_ref", null)
        .select("id");
      if (upd && upd.length === 1) return done(upd[0].id as string);
    }

    // Açık sipariş sınırı: bir üye en çok birkaç ödenmemiş kart siparişi tutabilir
    // (uç elle dövülerek satır yığılmasın; her satır Shopier'e sorgu demektir).
    const { count: openCount, error: countErr } = await admin
      .from("credit_orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("payment_method", "shopier")
      .eq("status", "pending")
      .is("provider_ref", null)
      .gte("created_at", new Date(Date.now() - CARD_PENDING_HOURS * 3600 * 1000).toISOString());
    if (countErr || (openCount ?? 0) >= CARD_MAX_OPEN_ROWS) {
      console.error("[shopier] kart siparişi açılmadı: açık sipariş sınırı ya da okuma hatası");
      return { ok: false, error: "failed" };
    }

    const { data: row, error } = await admin
      .from("credit_orders")
      .insert({
        user_id: user.id,
        email: user.email,
        package_id: found.product.id,
        credits: found.product.credits,
        price_try: found.product.priceTry,
        ref_code: makeRefCode(),
        status: "pending",
        product_kind: found.kind,
        payment_method: "shopier",
        created_by: null,
        terms_accepted_at: now,
        ...bill,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[shopier] kart siparişi açılamadı:", error?.message);
      return { ok: false, error: "failed" };
    }
    // Aynı anda gelen iki çağrı ikisi de "açık satır yok" görüp ikişer satır açmış
    // olabilir (kilit yok) → yeniden say; birden çoksa EN ESKİSİ kalır, ötekiler
    // silinir. Bütün çağrılar aynı satırı seçer. Ödemesi eşleşmiş satır silinmez.
    const { data: same } = await openRows().order("created_at", { ascending: true }).order("id", { ascending: true });
    if (same && same.length > 1) {
      const keep = same[0].id as string;
      await admin
        .from("credit_orders")
        .delete()
        .in("id", same.slice(1).map((r) => r.id as string))
        .eq("user_id", user.id)
        .eq("payment_method", "shopier")
        .eq("status", "pending")
        .is("provider_ref", null);
      return done(keep);
    }
    return done(row.id as string);
  } catch (e) {
    console.error("[shopier] kart siparişi açılamadı:", e instanceof Error ? e.message : e);
    return { ok: false, error: "failed" };
  }
}

// Aynı ÜYE için Shopier'e 4 saniyede birden sık sorma (bekleme ekranı 5 sn'de
// bir çağırır; birkaç sekme açıksa ya da uç elle dövülürse Shopier sınırını korur).
// Sipariş başına değil üye başına: çok satır açmak freni çoğaltmasın.
// Sunucu örneği başına tutulur; kaba bir fren olması yeterli.
const lastCheck = new Map<string, number>();
const MIN_GAP_MS = 4000;

// "auth" = oturum kapanmış (sipariş hâlâ bekliyor); "other" = sipariş reddedilmiş/kapatılmış.
export type CardStatus = { status: "pending" | "approved" | "other" | "auth" };

// Bekleme ekranının sorusu: "ödemem geldi mi?" Yalnız üyenin KENDİ siparişine bakar.
export async function checkCardPayment(orderId: string): Promise<CardStatus> {
  try {
    if (typeof orderId !== "string" || !UUID.test(orderId)) return { status: "other" };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Oturum düşmüşse siparişe "kapatılmış" deme: ödeme kaybolmaz, girişten sonra denetlenir.
    if (!user) return { status: "auth" };

    const admin = createAdminClient();
    // Satır bulunamazsa ya da okunamazsa "pending" say: emin olmadan "kapatılmış" denmez.
    const read = async (): Promise<string> => {
      const { data } = await admin
        .from("credit_orders")
        .select("status")
        .eq("id", orderId)
        .eq("user_id", user.id)
        .eq("payment_method", "shopier")
        .maybeSingle();
      return (data?.status as string | undefined) ?? "pending";
    };

    let status = await read();
    if (status === "pending") {
      const t = Date.now();
      if (t - (lastCheck.get(user.id) ?? 0) >= MIN_GAP_MS) {
        if (lastCheck.size > 5000) lastCheck.clear();
        lastCheck.set(user.id, t);
        await settleForMember(user.id);
        status = await read();
      }
    }
    return { status: status === "pending" ? "pending" : status === "approved" ? "approved" : "other" };
  } catch (e) {
    console.error("[shopier] ödeme denetimi başarısız:", e instanceof Error ? e.message : e);
    // Geçici hata: ekran beklemeyi sürdürsün, bir sonraki turda yeniden dener.
    return { status: "pending" };
  }
}
