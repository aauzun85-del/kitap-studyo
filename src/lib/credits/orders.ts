import { createClient } from "@/lib/supabase/server";
import type { OrderRow } from "./orderActions";
import { CARD_PENDING_HOURS } from "./shopier";

// Sipariş OKUMA yardımcıları (sunucu tarafı; sayfa render'ında kullanılır).

// Giriş yapan kullanıcının kendi siparişleri (RLS: yalnız kendi satırları).
export async function getMyOrders(): Promise<OrderRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("credit_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as OrderRow[];
}

const RESUME_HOURS = 2;

// Üyenin ödeme bekleyen en son KART (Shopier) siparişi — satın alma sayfası
// "Ödemeni bekliyoruz" ekranını sayfa yenilenince geri getirmek için kullanır.
// packageId verilirse yalnız o pakete bakar. Yalnız SON 2 SAATTE açılmış ya da
// yeniden onaylanmış ("Kartla öde"ye yeniden basılmış) satırlar sayılır: yarıda
// bırakılmış bir sipariş üyeyi iki gün boyunca her girişte bekleme ekranına
// (ve 5 sn'de bir Shopier sorgusuna) düşürmesin. (RLS: yalnız kendi satırları.)
export async function getMyPendingCardOrder(
  packageId?: string,
): Promise<{ orderId: string; packageId: string } | null> {
  const supabase = await createClient();
  const recent = new Date(Date.now() - RESUME_HOURS * 3600 * 1000).toISOString();
  let q = supabase
    .from("credit_orders")
    .select("id, package_id")
    .eq("payment_method", "shopier")
    .eq("status", "pending")
    .gte("created_at", new Date(Date.now() - CARD_PENDING_HOURS * 3600 * 1000).toISOString())
    .or(`created_at.gte.${recent},terms_accepted_at.gte.${recent}`);
  if (packageId) q = q.eq("package_id", packageId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1);
  const row = data?.[0];
  return row ? { orderId: row.id as string, packageId: row.package_id as string } : null;
}

// Admin tarafı tüm sipariş/müşteri/ürün verisi: adminData.ts (loadAdminData).

export type MyLot = { remaining: number; source: string; expires_at: string | null; product_id: string | null };
export type MyLedgerRow = { id: string; delta: number; action: string; kind: string; created_at: string };

// Üyenin kendi jeton partileri (süresi geçmemiş, içinde jeton kalan).
export async function getMyLots(): Promise<MyLot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_lots")
    .select("remaining, source, expires_at, product_id")
    .gt("remaining", 0)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(50);
  const now = Date.now();
  return ((data ?? []) as MyLot[]).filter((l) => !l.expires_at || new Date(l.expires_at).getTime() > now);
}

// Üyenin son jeton hareketleri (RLS: yalnız kendi satırları).
export async function getMyLedger(limit = 30): Promise<MyLedgerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_ledger")
    .select("id, delta, action, kind, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MyLedgerRow[];
}
