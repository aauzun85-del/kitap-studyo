import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { closeDigitalOrder, getOrder, listOrders, shopierReady } from "@/lib/server/shopier";
import { PACKAGE_VALIDITY_DAYS } from "./pricing";
import {
  CARD_PENDING_HOURS,
  CLOCK_SKEW_MS,
  SHOPIER_LAUNCH_AT,
  SHOPIER_REF_PREFIX,
  checkShopierOrder,
  findCardProduct,
  mappedShopierProductIds,
  normEmail,
  shopierDateMs,
  shopierRef,
  type ShopierOrder,
} from "./shopier";

// SHOPIER ÖDEMELERİNİ JETONA ÇEVİRME — YALNIZ SUNUCUDA.
//
// Üye "Kartla öde"ye basınca credit_orders'a BEKLEYEN bir satır açılır
// (checkoutActions.ts). Ödeme Shopier'de yapılır; Shopier bize sipariş numarası
// taşımadığı için ödemeyi şu üçlüyle buluruz: alıcı e-postası = üyenin e-postası,
// ürün = paketin ürünü, ödeme zamanı = satır açıldıktan sonra.
//
// PARA GÜVENLİĞİ: "Bu ödeme işlendi mi?" sorusunun TEK cevabı
// credit_orders.provider_ref = 'shopier:<sipariş no>' satırının varlığıdır
// (veritabanında tekil dizin var). Önce bu numara satıra yazılır ("sahiplenme"),
// SONRA jeton verilir. Aynı anda üç yer tetikleyebilir (üyenin bekleme ekranı,
// Shopier bildirimi, yönetim sayfası); tekil dizin ikisini durdurur. Shopier'deki
// "teslim edildi" durumu kuyruk olarak KULLANILMAZ.

type Admin = ReturnType<typeof createAdminClient>;

type PendingRow = {
  id: string;
  user_id: string;
  email: string;
  package_id: string;
  created_at: string;
  provider_ref: string | null;
};

const ROW_COLS = "id, user_id, email, package_id, created_at, provider_ref";
const CLOSE_NOTE = "Laycoty hesabına tanımlandı";
const MAX_ROWS = 40;

const cutoffIso = () => new Date(Date.now() - CARD_PENDING_HOURS * 3600 * 1000).toISOString();

// Bekleyen kart satırları: son 48 saatte açılanlar + numarası yazılmış ama onayı
// yarım kalmış olanlar (yaşı ne olursa olsun; aşağıda "yarım kalan" dalı tamamlar).
async function loadPendingRows(admin: Admin, userId: string | null): Promise<PendingRow[]> {
  let q = admin
    .from("credit_orders")
    .select(ROW_COLS)
    .eq("payment_method", "shopier")
    .eq("status", "pending")
    .or(`created_at.gte.${cutoffIso()},provider_ref.not.is.null`);
  if (userId) q = q.eq("user_id", userId);
  // En eski önce: yeni açılan satırlar yığılsa bile eskiler sıra dışı kalmasın.
  const { data, error } = await q.order("created_at", { ascending: true }).limit(MAX_ROWS);
  if (error) {
    console.error("[shopier] bekleyen siparişler okunamadı:", error.message);
    return [];
  }
  return (data ?? []) as PendingRow[];
}

// Jetonu ver (approve_credit_order satırı kilitler; iki kez çağrılsa da bir kez verir).
async function approve(admin: Admin, rowId: string): Promise<boolean> {
  const { error } = await admin.rpc("approve_credit_order", {
    p_order_id: rowId,
    p_valid_days: PACKAGE_VALIDITY_DAYS,
  });
  if (!error) return true;
  if (/order-not-pending/.test(error.message)) {
    // Başka bir tetikleyici bizden önce onaylamış olabilir → gerçekten onaylı mı bak.
    const { data } = await admin.from("credit_orders").select("status").eq("id", rowId).maybeSingle();
    if (data?.status === "approved") return true;
    console.error(`[shopier] sipariş ${rowId} ödendi ama durumu "${data?.status ?? "?"}"; elle bakılmalı`);
    return false;
  }
  console.error(`[shopier] sipariş ${rowId} onaylanamadı:`, error.message);
  return false;
}

// Shopier panelinde siparişi kapat. Olmazsa yalnız günlüğe düşer (ikinci jeton
// verilmesine yol açmaz: işlendi kaydı provider_ref'tir).
// Yanıtı BEKLETMEZ: jeton verilmiştir, üyenin ekranı Shopier'in yavaşlığını
// beklemesin → kapatma yanıt gönderildikten sonra çalışır (next/server `after`).
function closeAtShopier(orderId: string): void {
  const run = async () => {
    const r = await closeDigitalOrder(orderId, CLOSE_NOTE, 3000);
    if (!r.ok) console.error(`[shopier] sipariş ${orderId} Shopier'de kapatılamadı (${r.error}); jeton verildi`);
  };
  try {
    after(run);
  } catch {
    // İstek bağlamı dışında çağrıldıysa (after kullanılamaz) arka planda dene.
    void run().catch(() => undefined);
  }
}

// Tek bekleyen satırı, verilen Shopier siparişleri arasında eşini bulup sonuçlandır.
// Dönen değer: jetona çevrilen Shopier sipariş numarası ya da null.
async function settleRow(
  admin: Admin,
  row: PendingRow,
  orders: ShopierOrder[],
  deadline: number,
): Promise<string | null> {
  // YARIM KALAN: numara yazılmış ama onay tamamlanmamış (araya hata girmiş).
  // Yeniden deneme saatler sonra olabilir; bu arada ödeme iade/iptal edilmiş
  // olabilir → siparişi Shopier'den YENİDEN oku, kurallar hâlâ tutuyorsa onayla.
  if (row.provider_ref) {
    if (!row.provider_ref.startsWith(SHOPIER_REF_PREFIX)) return null;
    const orderId = row.provider_ref.slice(SHOPIER_REF_PREFIX.length);
    const leftMs = deadline - Date.now();
    if (leftMs < 500) return null;
    const got = await getOrder(orderId, Math.min(8000, leftMs));
    if (!got.ok) return null; // Shopier'e ulaşılamadı → sonra yeniden denenir.
    const c = checkShopierOrder(got.order);
    if (!c.ok || c.packageId !== row.package_id) {
      console.error(
        `[shopier] sipariş ${row.id}: Shopier #${orderId} artık geçerli değil (${c.ok ? "package" : c.reason}); jeton verilmedi, elle bakılmalı`,
      );
      return null;
    }
    if (!(await approve(admin, row.id))) return null;
    closeAtShopier(orderId);
    return orderId;
  }

  if (!findCardProduct(row.package_id)) return null;
  const rowEmail = normEmail(row.email);
  const createdMs = Date.parse(row.created_at);
  if (!rowEmail || !Number.isFinite(createdMs)) return null;

  // 1. ve 2. kural: geçerli ödeme + aynı paket + aynı e-posta + satırdan SONRA ödenmiş.
  const candidates: { id: string; paidAtMs: number; paidAtIso: string }[] = [];
  for (const o of orders) {
    const c = checkShopierOrder(o);
    if (!c.ok) continue;
    if (c.packageId !== row.package_id || c.email !== rowEmail) continue;
    if (c.paidAtMs < createdMs - CLOCK_SKEW_MS) continue;
    candidates.push({ id: o.id, paidAtMs: c.paidAtMs, paidAtIso: c.paidAtIso });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.paidAtMs - b.paidAtMs);

  // Daha önce işlenmiş ödemeleri ele (asıl güvence aşağıdaki tekil dizindir).
  const { data: used, error: usedErr } = await admin
    .from("credit_orders")
    .select("provider_ref")
    .in("provider_ref", candidates.map((c) => shopierRef(c.id)));
  if (usedErr) return null;
  const usedRefs = new Set((used ?? []).map((r) => r.provider_ref as string));
  const free = candidates.filter((c) => !usedRefs.has(shopierRef(c.id)));
  if (free.length === 0) return null;

  // 3. kural: üyenin e-postası DOĞRULANMIŞ olmalı ve satırdaki adresle aynı olmalı
  // (doğrulanmamış adresle başkasının ödemesi sahiplenilemesin).
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(row.user_id);
  if (uErr || !u?.user?.email_confirmed_at || normEmail(u.user.email) !== rowEmail) return null;

  for (const c of free) {
    if (Date.now() > deadline) return null;
    // 4. kural — ÖNCE SAHİPLEN: numarayı yalnız hâlâ bekleyen ve boş satıra yaz.
    const { data: claimed, error: cErr } = await admin
      .from("credit_orders")
      .update({ provider_ref: shopierRef(c.id), paid_at: c.paidAtIso })
      .eq("id", row.id)
      .eq("status", "pending")
      .is("provider_ref", null)
      .select("id");
    if (cErr) {
      // 23505 = bu ödemeyi başka bir satır almış → jeton verme; varsa sıradaki ödemeye bak.
      if (cErr.code === "23505") continue;
      console.error(`[shopier] sipariş ${row.id} sahiplenilemedi:`, cErr.message);
      return null;
    }
    // Satır artık bekleyen/boş değil → başkası işliyor; dur.
    if (!claimed || claimed.length !== 1) return null;
    if (!(await approve(admin, row.id))) return null;
    closeAtShopier(c.id);
    return c.id;
  }
  return null;
}

// ÜYENİN bekleyen kart siparişlerini denetle (bekleme ekranı 5 sn'de bir çağırır).
// Shopier'e yalnız bu üyenin e-postası + ürünüyle sorar; başka alıcı verisi dönmez.
export async function settleForMember(userId: string): Promise<{ settled: string[]; pending: boolean }> {
  const settled: string[] = [];
  if (!shopierReady()) return { settled, pending: false };
  try {
    const admin = createAdminClient();
    const rows = await loadPendingRows(admin, userId);
    let left = rows.length;
    // Ürün başına TEK liste çağrısı (üyenin tek e-postası var): satır sayısı
    // ne olursa olsun Shopier'e ürün sayısı kadar soru gider.
    const lists = new Map<string, ShopierOrder[] | null>();
    for (const row of rows) {
      let orders: ShopierOrder[] = [];
      if (!row.provider_ref) {
        const product = findCardProduct(row.package_id);
        if (!product) continue;
        const pid = product.shopier.productId;
        if (!lists.has(pid)) {
          const sinceMs = Math.min(
            ...rows
              .filter((x) => !x.provider_ref && x.package_id === row.package_id)
              .map((x) => Date.parse(x.created_at))
              .filter(Number.isFinite),
          );
          const r = Number.isFinite(sinceMs)
            ? await listOrders({
                email: normEmail(row.email),
                productId: pid,
                dateStart: new Date(sinceMs - CLOCK_SKEW_MS),
                limit: 50,
              })
            : null;
          lists.set(pid, r && r.ok ? r.orders : null);
        }
        const list = lists.get(pid);
        if (!list) continue;
        orders = list;
      }
      const id = await settleRow(admin, row, orders, Date.now() + 60_000);
      if (id) {
        settled.push(id);
        left--;
      }
    }
    return { settled, pending: left > 0 };
  } catch (e) {
    console.error("[shopier] üye denetimi başarısız:", e instanceof Error ? e.message : e);
    return { settled, pending: true };
  }
}

// BÜTÜN bekleyen kart siparişlerini denetle (Shopier bildirimi + yönetim sayfası).
// Ürün başına tek liste çağrısı yapar; `budgetMs` dolunca YENİ satıra başlamaz
// (başlanmış sahiplenme → onay yarıda kesilmez; kesilirse "yarım kalan" dalı tamamlar).
export async function settleAllPending(budgetMs = 8000): Promise<{ settled: string[] }> {
  const settled: string[] = [];
  if (!shopierReady()) return { settled };
  const deadline = Date.now() + budgetMs;
  const left = () => deadline - Date.now();
  try {
    const admin = createAdminClient();
    const rows = await loadPendingRows(admin, null);
    if (rows.length === 0) return { settled };

    // Ürün başına: en eski bekleyen satırdan bu yana gelen siparişler (en çok 2 sayfa).
    const byProduct = new Map<string, ShopierOrder[]>();
    const oldest = new Map<string, number>();
    for (const row of rows) {
      if (row.provider_ref) continue;
      const product = findCardProduct(row.package_id);
      const createdMs = Date.parse(row.created_at);
      if (!product || !Number.isFinite(createdMs)) continue;
      const pid = product.shopier.productId;
      oldest.set(pid, Math.min(oldest.get(pid) ?? Infinity, createdMs));
    }
    for (const [pid, sinceMs] of oldest) {
      const list: ShopierOrder[] = [];
      for (let page = 1; page <= 2; page++) {
        if (left() < 500) break;
        const r = await listOrders({
          productId: pid,
          dateStart: new Date(sinceMs - CLOCK_SKEW_MS),
          limit: 50,
          page,
          timeoutMs: Math.min(8000, left()),
        });
        if (!r.ok) break;
        list.push(...r.orders);
        if (r.orders.length < 50) break;
      }
      byProduct.set(pid, list);
    }

    for (const row of rows) {
      if (left() <= 0) break;
      const product = findCardProduct(row.package_id);
      const orders = product ? (byProduct.get(product.shopier.productId) ?? []) : [];
      const id = await settleRow(admin, row, orders, deadline);
      if (id) settled.push(id);
    }
  } catch (e) {
    console.error("[shopier] toplu denetim başarısız:", e instanceof Error ? e.message : e);
  }
  return { settled };
}

// Yönetim sayfasında gösterilen sade görünüm (telefon, ad, adres YOK).
export type UnmatchedPayment = {
  id: string;
  date: string; // ISO
  title: string;
  amount: number;
  email: string;
  // Kendiliğinden tanımlanmaya engel bir durum varsa (ör. "price", "discount").
  issue: string | null;
};

// EŞLEŞMEYEN ÖDEMELER — Shopier'de ödenmiş ama hiçbir siparişimize bağlanmamış
// ödemeler (üye başka e-posta yazmış, "Kartla öde"ye basmadan ödemiş vb.).
// Salt okunur; veritabanında saklanmaz, her seferinde Shopier'den canlı okunur.
export async function listUnmatchedPayments(): Promise<
  { ok: true; items: UnmatchedPayment[] } | { ok: false }
> {
  if (!shopierReady()) return { ok: false };
  try {
    const launchMs = new Date(SHOPIER_LAUNCH_AT).getTime();
    const since = new Date(Math.max(launchMs, Date.now() - 30 * 24 * 3600 * 1000));
    const paid: ShopierOrder[] = [];
    for (const productId of mappedShopierProductIds()) {
      for (let page = 1; page <= 2; page++) {
        const r = await listOrders({ productId, dateStart: since, limit: 50, page, timeoutMs: 4000 });
        if (!r.ok) return { ok: false };
        paid.push(...r.orders.filter((o) => o.paymentStatus === "paid" && shopierDateMs(o.dateCreated) > launchMs));
        if (r.orders.length < 50) break;
      }
    }
    if (paid.length === 0) return { ok: true, items: [] };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("credit_orders")
      .select("provider_ref, status")
      .in("provider_ref", paid.map((o) => shopierRef(o.id)));
    if (error) return { ok: false };
    // Reddedilmiş satırdaki numara "işlendi" sayılmaz: ödeme alınmış ama jeton
    // verilmemiştir → listede görünsün ki yönetici tanımlayabilsin.
    const done = new Set(
      (data ?? []).filter((r) => r.status !== "rejected").map((r) => r.provider_ref as string),
    );

    const seen = new Set<string>();
    const items: UnmatchedPayment[] = [];
    for (const o of paid) {
      if (done.has(shopierRef(o.id)) || seen.has(o.id)) continue;
      seen.add(o.id);
      const c = checkShopierOrder(o);
      items.push({
        id: o.id,
        date: new Date(shopierDateMs(o.dateCreated)).toISOString(),
        title: o.lineItems?.[0]?.title ?? "—",
        amount: Number(o.totals?.total) || 0,
        email: normEmail(o.shippingInfo?.email) || normEmail(o.billingInfo?.email),
        issue: c.ok ? null : c.reason,
      });
    }
    items.sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true, items };
  } catch (e) {
    console.error("[shopier] eşleşmeyen ödemeler okunamadı:", e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

// E-postadan üyeyi bul (auth şemasına sorgu atılamadığı için sayfa sayfa taranır;
// adminData.ts ile aynı yol). Yalnız yönetici eyleminde kullanılır.
async function findUserByEmail(admin: Admin, email: string): Promise<{ id: string; email: string } | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => normEmail(u.email) === email);
    if (hit) return { id: hit.id, email: hit.email ?? email };
    if (data.users.length < 1000) break;
  }
  return null;
}

function makeRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışabilenler (0/O, 1/I) yok
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LC-${s}`;
}

// ELLE EŞLEŞTİR (yalnız yönetici; çağıran yöneticiliği DENETLEMİŞ olmalı):
// eşleşmeyen bir Shopier ödemesini seçilen üyeye tanımla. Tutar ve ürün
// tarayıcıdan gelen bilgiye güvenilmeden Shopier'den YENİDEN okunur. Numara
// satıra INSERT/UPDATE anında yazılır → aynı ödeme iki kez tanımlanamaz.
export async function assignPayment(
  shopierOrderId: string,
  memberEmail: string,
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!shopierReady()) return { ok: false, error: "not-ready" };
  const orderId = String(shopierOrderId ?? "").trim();
  if (!/^\d{1,20}$/.test(orderId)) return { ok: false, error: "bad-id" };
  const email = normEmail(memberEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return { ok: false, error: "bad-email" };

  try {
    const got = await getOrder(orderId);
    if (!got.ok) return { ok: false, error: "shopier-unreachable" };
    const check = checkShopierOrder(got.order);
    if (!check.ok) return { ok: false, error: `order-invalid:${check.reason}` };
    // Kart ödemesi açılmadan önceki (deneme) ödemeler jetona çevrilemez.
    if (check.paidAtMs <= new Date(SHOPIER_LAUNCH_AT).getTime()) {
      return { ok: false, error: "order-invalid:before-launch" };
    }

    const admin = createAdminClient();
    const ref = shopierRef(orderId);
    const { data: dup, error: dupErr } = await admin
      .from("credit_orders")
      .select("id, status")
      .eq("provider_ref", ref)
      .limit(1);
    if (dupErr) return { ok: false, error: "db" };
    if (dup && dup.length > 0) {
      if (dup[0].status !== "rejected") return { ok: false, error: "already-assigned" };
      // Numara REDDEDİLMİŞ bir satırda kalmış (ödeme alınmış, jeton verilmemiş):
      // tekil dizin yeniden tanımlamayı engellemesin diye numarayı o satırdan kaldır.
      const { error: freeErr } = await admin
        .from("credit_orders")
        .update({ provider_ref: null })
        .eq("id", dup[0].id)
        .eq("status", "rejected")
        .eq("provider_ref", ref);
      if (freeErr) return { ok: false, error: "db" };
    }

    const member = await findUserByEmail(admin, email);
    if (!member) return { ok: false, error: "user-not-found" };

    const note = `Shopier #${orderId} elle eşleştirildi`;
    let rowId: string | null = null;
    let inserted = false;

    // Üyenin bu paket için bekleyen kart siparişi varsa ONU sahiplen: fatura
    // bilgileri ve sözleşme onayı o satırdadır, üyenin bekleme ekranı da onu izler.
    const { data: own } = await admin
      .from("credit_orders")
      .select("id")
      .eq("user_id", member.id)
      .eq("package_id", check.packageId)
      .eq("payment_method", "shopier")
      .eq("status", "pending")
      .is("provider_ref", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (own && own.length === 1) {
      const { data: claimed, error: cErr } = await admin
        .from("credit_orders")
        .update({ provider_ref: ref, paid_at: check.paidAtIso, created_by: actor, admin_note: note })
        .eq("id", own[0].id)
        .eq("status", "pending")
        .is("provider_ref", null)
        .select("id");
      if (cErr) return { ok: false, error: cErr.code === "23505" ? "already-assigned" : cErr.message };
      if (claimed && claimed.length === 1) rowId = claimed[0].id as string;
    }

    if (!rowId) {
      const buyer = got.order.shippingInfo ?? got.order.billingInfo ?? {};
      const buyerName = [buyer.firstName, buyer.lastName].filter(Boolean).join(" ").trim().slice(0, 200);
      const { data: row, error: insErr } = await admin
        .from("credit_orders")
        .insert({
          user_id: member.id,
          email: member.email,
          package_id: check.packageId,
          credits: check.product.credits,
          price_try: check.product.priceTry,
          ref_code: makeRefCode(),
          status: "pending",
          product_kind: check.kind,
          payment_method: "shopier",
          provider_ref: ref,
          paid_at: check.paidAtIso,
          created_by: actor,
          admin_note: note,
          billing_name: buyerName || null,
          billing_email: check.email,
        })
        .select("id")
        .single();
      if (insErr || !row) {
        return { ok: false, error: insErr?.code === "23505" ? "already-assigned" : (insErr?.message ?? "db") };
      }
      rowId = row.id as string;
      inserted = true;
    }

    if (!(await approve(admin, rowId))) {
      // Yeni açtığımız satır onaylanamadıysa yarım bırakma (numara da boşa çıksın,
      // yönetici yeniden deneyebilsin). Üyenin kendi satırı silinmez: numarası
      // yazılı kalır, bir sonraki denetim onayı tamamlar.
      if (inserted) await admin.from("credit_orders").delete().eq("id", rowId).eq("status", "pending");
      return { ok: false, error: "approve-failed" };
    }
    closeAtShopier(orderId);
    return { ok: true };
  } catch (e) {
    console.error("[shopier] elle eşleştirme başarısız:", e instanceof Error ? e.message : e);
    return { ok: false, error: "failed" };
  }
}
