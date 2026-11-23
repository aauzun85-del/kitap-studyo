"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { findProduct, PACKAGE_VALIDITY_DAYS } from "./pricing";

// YÖNETİCİ EYLEMLERİ — sipariş onayı, elle jeton/paket tanımlama, fatura işareti.
// Hepsi sunucuda çalışır ve HER BİRİ çağıranın yönetici olduğunu yeniden denetler
// (server action'lar herkese açık uç noktalardır). Yazma DAİMA service-role ile.

export type OrderRow = {
  id: string;
  user_id: string | null;
  email: string;
  package_id: string;
  credits: number;
  price_try: number;
  ref_code: string;
  // approved = ödendi.
  status: "pending" | "approved" | "rejected" | "failed" | "refunded";
  created_at: string;
  decided_at: string | null;
  // 0004
  payment_method?: string;
  provider_ref?: string | null;
  paid_at?: string | null;
  failure_reason?: string | null;
  terms_accepted_at?: string | null;
  // 0005
  product_kind?: "package" | "addon" | "grant";
  billing_type?: "bireysel" | "kurumsal" | null;
  billing_name?: string | null;
  billing_tax_id?: string | null;
  billing_tax_office?: string | null;
  billing_email?: string | null;
  billing_address?: string | null;
  billing_district?: string | null;
  billing_city?: string | null;
  invoice_status?: "none" | "pending" | "issued" | "error";
  invoice_no?: string | null;
  invoice_url?: string | null;
  invoice_error?: string | null;
  invoiced_at?: string | null;
  created_by?: string | null;
  admin_note?: string | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

// Kısa, okunması kolay referans kodu.
function makeRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışabilenler (0/O, 1/I) yok
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `LC-${s}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

// Çağıran yönetici mi? Değilse null. (E-posta sunucudaki oturumdan okunur.)
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email && isAdminEmail(user.email) ? user.email : null;
}

function refresh() {
  revalidatePath("/[lang]/admin", "page");
}

// Bekleyen siparişi onayla → jeton lotu açılır (paketse indirme de açılır).
export async function approveOrder(orderId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  if (!UUID.test(orderId)) return { ok: false, error: "bad-id" };
  const admin = createAdminClient();
  const { error } = await admin.rpc("approve_credit_order", {
    p_order_id: orderId,
    p_valid_days: PACKAGE_VALIDITY_DAYS,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Bekleyen siparişi reddet.
export async function rejectOrder(orderId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  if (!UUID.test(orderId)) return { ok: false, error: "bad-id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_orders")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ELLE JETON: üyeye sipariş açmadan jeton ekle (telafi, deneme, hediye).
// days = null → süresiz.
export async function adminGrantCredits(input: {
  userId: string;
  credits: number;
  days: number | null;
  note: string;
}): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "forbidden" };
  const credits = Math.floor(Number(input.credits));
  if (!UUID.test(input.userId)) return { ok: false, error: "bad-id" };
  if (!Number.isFinite(credits) || credits <= 0 || credits > 100000) return { ok: false, error: "bad-credits" };
  const days = input.days == null ? null : Math.floor(Number(input.days));
  if (days != null && (!Number.isFinite(days) || days < 1 || days > 366)) return { ok: false, error: "bad-days" };
  const note = clean(input.note, 300);
  if (!note) return { ok: false, error: "note-required" };

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_grant_credits", {
    p_uid: input.userId,
    p_credits: credits,
    p_days: days,
    p_actor: actor,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export type BillingInput = {
  type?: "bireysel" | "kurumsal";
  name?: string;
  taxId?: string;
  taxOffice?: string;
  email?: string;
  address?: string;
  district?: string;
  city?: string;
};

// ELLE ÜRÜN: üyeye paket ya da ek jeton tanımla. Kart ödemesi açılana kadar
// satışlar (havale, elden) ve hediye paketler buradan girilir. Ücretliyse
// sipariş "Faturası kesilecekler" listesine düşer; hediye (0 ₺) düşmez.
export async function adminAssignProduct(input: {
  userId: string;
  productId: string;
  paid: boolean;
  note: string;
  billing?: BillingInput;
}): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { ok: false, error: "forbidden" };
  if (!UUID.test(input.userId)) return { ok: false, error: "bad-id" };
  const found = findProduct(input.productId);
  if (!found) return { ok: false, error: "bad-product" };
  const note = clean(input.note, 300);
  if (!note) return { ok: false, error: "note-required" };

  const admin = createAdminClient();
  const { data: u, error: uErr } = await admin.auth.admin.getUserById(input.userId);
  if (uErr || !u?.user) return { ok: false, error: "user-not-found" };

  const b = input.billing ?? {};
  const taxId = (clean(b.taxId, 11) ?? "").replace(/\D/g, "") || null;
  const { data: row, error: insErr } = await admin
    .from("credit_orders")
    .insert({
      user_id: input.userId,
      email: u.user.email ?? "",
      package_id: found.product.id,
      credits: found.product.credits,
      price_try: input.paid ? found.product.priceTry : 0,
      ref_code: makeRefCode(),
      status: "pending",
      product_kind: found.kind,
      payment_method: input.paid ? "elden" : "hediye",
      created_by: actor,
      admin_note: note,
      billing_type: b.type === "kurumsal" ? "kurumsal" : b.type === "bireysel" ? "bireysel" : null,
      billing_name: clean(b.name, 200),
      billing_tax_id: taxId,
      billing_tax_office: clean(b.taxOffice, 60),
      billing_email: clean(b.email, 200) ?? u.user.email ?? null,
      billing_address: clean(b.address, 300),
      billing_district: clean(b.district, 60),
      billing_city: clean(b.city, 60),
    })
    .select("id")
    .single();
  if (insErr || !row) return { ok: false, error: insErr?.message ?? "db" };

  const { error: apErr } = await admin.rpc("approve_credit_order", {
    p_order_id: row.id,
    p_valid_days: PACKAGE_VALIDITY_DAYS,
  });
  if (apErr) {
    // Onay olmadıysa yarım siparişi bırakma.
    await admin.from("credit_orders").delete().eq("id", row.id).eq("status", "pending");
    return { ok: false, error: apErr.message };
  }
  refresh();
  return { ok: true };
}

// Siparişin fatura bilgilerini düzelt (fatura kesmeden önce).
export async function updateOrderBilling(orderId: string, b: BillingInput): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  if (!UUID.test(orderId)) return { ok: false, error: "bad-id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_orders")
    .update({
      billing_type: b.type === "kurumsal" ? "kurumsal" : "bireysel",
      billing_name: clean(b.name, 200),
      billing_tax_id: (clean(b.taxId, 11) ?? "").replace(/\D/g, "") || null,
      billing_tax_office: clean(b.taxOffice, 60),
      billing_email: clean(b.email, 200),
      billing_address: clean(b.address, 300),
      billing_district: clean(b.district, 60),
      billing_city: clean(b.city, 60),
    })
    .eq("id", orderId)
    .neq("invoice_status", "issued");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Fatura kesildi olarak işaretle (fatura no elle girilir; BizimHesap bağlanınca otomatik).
export async function markInvoiceIssued(orderId: string, invoiceNo: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  if (!UUID.test(orderId)) return { ok: false, error: "bad-id" };
  const no = clean(invoiceNo, 40);
  if (!no) return { ok: false, error: "no-required" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_orders")
    .update({
      invoice_status: "issued",
      invoice_no: no,
      invoice_error: null,
      invoiced_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "approved");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Yanlışlıkla işaretlendiyse geri al → yeniden "kesilecek" olur.
export async function undoInvoiceIssued(orderId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "forbidden" };
  if (!UUID.test(orderId)) return { ok: false, error: "bad-id" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("credit_orders")
    .update({ invoice_status: "pending", invoice_no: null, invoiced_at: null })
    .eq("id", orderId)
    .eq("invoice_status", "issued");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
