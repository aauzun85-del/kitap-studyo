import "server-only";

import { hasServiceKey } from "@/lib/supabase/admin";
import type { ShopierOrder } from "@/lib/credits/shopier";

// SHOPIER API istemcisi — YALNIZ SUNUCUDA. Mağaza anahtarı (SHOPIER_PAT) çok
// gizlidir: tarayıcıya gitmez, günlüğe yazılmaz. Çağıranlara asla hata fırlatmaz;
// her işlev { ok: true, … } ya da { ok: false, error } döndürür (replicate.ts gibi).
//
// Kullandığımız uçlar (gerçek hesapta doğrulandı): GET /orders, GET /orders/{id},
// PUT /orders/{id} (dijital teslim). Liste yanıtı düz dizidir; e-posta süzgeci
// büyük/küçük harfe bakmaz; tarih "2026-11-20T15:10:00Z" biçiminde (milisaniyesiz).

const BASE = "https://api.shopier.com/v1";
const TIMEOUT_MS = 8000;

export type ShopierErr = { ok: false; error: "no-token" | "timeout" | "provider" | "bad-response"; status?: number };

// Kart ödemesi çalışabilir mi? Mağaza anahtarı + yazma için service-role gerekir.
// Aşamalı açılış: SHOPIER_PUBLIC=1 olana kadar kartla ödeme YALNIZ yöneticiye
// açıktır (canlıda gerçek bir deneme ödemesiyle sınamak için). Sınama geçince
// Vercel'de SHOPIER_PUBLIC=1 yapılır ve herkese açılır.
export function shopierOpenFor(isAdmin: boolean): boolean {
  return shopierReady() && (process.env.SHOPIER_PUBLIC === "1" || isAdmin);
}

export function shopierReady(): boolean {
  return !!process.env.SHOPIER_PAT && hasServiceKey();
}

async function call(
  method: "GET" | "PUT",
  path: string,
  body?: unknown,
  timeoutMs = TIMEOUT_MS,
): Promise<{ ok: true; json: unknown } | ShopierErr> {
  const token = process.env.SHOPIER_PAT;
  if (!token) return { ok: false, error: "no-token" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(500, timeoutMs)),
    });
    if (!res.ok) {
      // Gövdeyi günlüğe yazma (alıcı bilgisi içerebilir); durum kodu yeter.
      console.error(`[shopier] ${method} ${path.split("?")[0]} → ${res.status}`);
      return { ok: false, error: "provider", status: res.status };
    }
    const json: unknown = await res.json().catch(() => undefined);
    if (json === undefined) return { ok: false, error: "bad-response", status: res.status };
    return { ok: true, json };
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`[shopier] ${method} ${path.split("?")[0]} → ${timeout ? "zaman aşımı" : "ağ hatası"}`);
    return { ok: false, error: timeout ? "timeout" : "provider" };
  }
}

const isOrder = (v: unknown): v is ShopierOrder =>
  !!v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string";

// Tek sipariş (yönetici elle tanımlarken tutarı/ürünü HEP buradan yeniden okuruz).
export async function getOrder(
  id: string,
  timeoutMs?: number,
): Promise<{ ok: true; order: ShopierOrder } | ShopierErr> {
  if (!/^\d{1,20}$/.test(id)) return { ok: false, error: "bad-response" };
  const r = await call("GET", `/orders/${id}`, undefined, timeoutMs);
  if (!r.ok) return r;
  return isOrder(r.json) ? { ok: true, order: r.json } : { ok: false, error: "bad-response" };
}

// Shopier'in istediği tarih biçimi: milisaniyesiz UTC ("…:00Z").
const shopierDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

// Sipariş listesi (en yeni önce). E-posta yalnız Shopier'e giden sorguda kullanılır.
export async function listOrders(q: {
  email?: string;
  productId?: string;
  dateStart?: Date;
  limit?: number;
  page?: number;
  timeoutMs?: number;
}): Promise<{ ok: true; orders: ShopierOrder[] } | ShopierErr> {
  const p = new URLSearchParams();
  if (q.email) p.set("customerEmail", q.email);
  if (q.productId) p.set("productId", q.productId);
  if (q.dateStart) p.set("dateStart", shopierDate(q.dateStart));
  p.set("limit", String(Math.min(50, Math.max(1, q.limit ?? 50))));
  if (q.page && q.page > 1) p.set("page", String(q.page));
  p.set("sort", "dateDesc");
  const r = await call("GET", `/orders?${p.toString()}`, undefined, q.timeoutMs);
  if (!r.ok) return r;
  if (!Array.isArray(r.json)) return { ok: false, error: "bad-response" };
  return { ok: true, orders: r.json.filter(isOrder) };
}

// Siparişi Shopier'de "dijital teslim edildi" diye kapat. Bu yalnız Shopier
// panelini temiz tutar; jetonun verilip verilmediğinin kaydı DEĞİLDİR (o kayıt
// credit_orders.provider_ref'tir) → başarısız olursa yalnız günlüğe düşer.
export async function closeDigitalOrder(
  id: string,
  note: string,
  timeoutMs?: number,
): Promise<{ ok: true } | ShopierErr> {
  if (!/^\d{1,20}$/.test(id)) return { ok: false, error: "bad-response" };
  const r = await call("PUT", `/orders/${id}`, { fulfillments: { productType: "digital", note } }, timeoutMs);
  return r.ok ? { ok: true } : r;
}
