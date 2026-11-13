import { createClient } from "@/lib/supabase/server";
import type { OrderRow } from "./orderActions";

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
