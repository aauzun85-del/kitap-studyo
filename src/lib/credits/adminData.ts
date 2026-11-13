// Yönetim paneli verisi — Üyeler · Faturası kesilecekler · Siparişler · Ürünler · Jeton kullanımı.
//
// İki katman:
//  - buildAdminData(): SAF hesaplama (ham satırlar → tablolar + özet). Veritabanına
//    dokunmaz; örnek verilerle de çalışır.
//  - loadAdminData(): sunucu tarafı; service-role ile ham satırları çeker
//    (RLS atlanır) ve buildAdminData'ya verir. YALNIZ admin sayfasından çağrılır.

import { CREDIT_ADDONS, CREDIT_PACKAGES, PACKAGE_VALIDITY_DAYS, splitVat } from "./pricing";
import type { OrderRow } from "./orderActions";
import { periodPresets, resolvePeriod, type Period } from "./period";

export type RawUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
};
export type RawLot = {
  user_id: string;
  remaining: number;
  source: string;
  expires_at: string | null;
  product_id?: string | null;
};
export type RawLedger = {
  id: string;
  user_id: string;
  delta: number;
  action: string;
  created_at: string;
  kind?: string;
  actor?: string | null;
  note?: string | null;
  refunded_at?: string | null;
};

export type AdminOrder = OrderRow & {
  productName: string;
  kind: "package" | "addon" | "grant";
  net: number; // KDV hariç
  vat: number;
};

export type AdminCustomer = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  projects: number;
  balance: number; // süresi geçmemiş jetonlar
  packageName: string | null; // aktif paket (yoksa null)
  packageUntil: string | null;
  orders: number;
  paidTotal: number; // ödenen toplam ₺
  spent: number; // dönem içinde harcanan jeton (iadeler düşülmüş)
  lastUseAt: string | null;
};

export type AdminProduct = {
  id: string;
  name: string;
  kind: "package" | "addon";
  credits: number;
  priceTry: number;
  validityDays: number;
  sold: number; // ücretli satış
  gifted: number; // hediye (0 ₺)
  revenue: number;
};

export type UsageByAction = { action: string; label: string; count: number; credits: number };
export type UsageByMember = { id: string; email: string; count: number; credits: number; lastAt: string };
export type UsageRow = {
  id: string;
  at: string;
  userId: string;
  email: string;
  label: string;
  kind: string;
  delta: number;
  actor: string | null;
  note: string | null;
  refunded: boolean;
};

export type AdminStats = {
  monthRevenue: number;
  monthOrders: number;
  totalRevenue: number;
  pending: number;
  customers: number;
  payingCustomers: number;
  invoicesDue: number;
  invoicesDueTotal: number;
  activePackages: number;
  spentInPeriod: number;
};

export type AdminData = {
  orders: AdminOrder[];
  invoicesDue: AdminOrder[];
  customers: AdminCustomer[];
  products: AdminProduct[];
  usage: {
    period: Period;
    presets: { id: string; label: string; from: string; to: string }[];
    byAction: UsageByAction[]; byMember: UsageByMember[]; recent: UsageRow[];
    truncated: boolean;
  };
  stats: AdminStats;
  /** Verinin hesaplandığı an (ISO) — "kaç gün önce" hesapları buna göre. */
  generatedAt: string;
  /** Sipariş/lot tabloları yoksa (SQL çalıştırılmadıysa) true → ekranda uyarı. */
  setupMissing: boolean;
};

// "Ödendi" = approved. Ödeme anı: paid_at → decided_at → created_at.
export const isPaid = (o: OrderRow) => o.status === "approved";
export const paidAt = (o: OrderRow) => o.paid_at ?? o.decided_at ?? o.created_at;

// Defterdeki işlem adlarının okunur karşılıkları.
const ACTION_TR: Record<string, string> = {
  "cover-art": "Kapak görseli (FLUX)",
  "cover-ideogram": "Kapak görseli (Ideogram)",
  "cover-nano": "Kapak görseli (Nano Banana)",
  "cover-edit": "Kapak düzenleme",
  "cover-element": "Tasarım öğesi",
  "cover-tags": "Kapak etiketleri",
  "cover-prompt": "Kapak komutu önerisi",
  "cover-detect": "Kapak öğesi tespiti",
  "promo-image": "Tanıtım görseli",
  "promo-generate": "Tanıtım metni",
  tts: "Seslendirme",
  "editor-review-deep": "Editör — derin inceleme",
  "editor-review": "Editör — hızlı inceleme",
  "editor-check": "Editör — yazım denetimi",
  "editor-genre": "Editör — tür kontrolü",
  "editor-risk": "Editör — risk taraması",
  "elle-jeton": "Elle eklenen jeton",
  "hos-geldin": "Hoş geldin jetonu",
};
const PRODUCT_TR = new Map<string, string>([
  ...CREDIT_PACKAGES.map((p) => [p.id, `${p.name.tr} paketi`] as [string, string]),
  ...CREDIT_ADDONS.map((p) => [p.id, p.name.tr] as [string, string]),
]);

export function actionLabel(action: string): string {
  const base = action.replace(/:iade$/, "");
  if (base.startsWith("satin-alma:")) return PRODUCT_TR.get(base.slice(11)) ?? base.slice(11);
  const label = ACTION_TR[base] ?? base;
  return action.endsWith(":iade") ? `${label} (iade)` : label;
}

// Türkiye saatine göre "YYYY-AA" (ay cirosu sunucu UTC'de çalışsa da doğru olsun).
function monthKeyTR(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  return `${y}-${m}`;
}

export function buildAdminData(
  users: RawUser[],
  projectUserIds: string[],
  ordersRaw: OrderRow[],
  lots: RawLot[],
  ledger: RawLedger[],
  opts: { now?: Date; period?: Period; ledgerTruncated?: boolean; setupMissing?: boolean } = {},
): AdminData {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  const orders: AdminOrder[] = ordersRaw
    .map((o) => {
      const kind = (o.product_kind ?? "package") as AdminOrder["kind"];
      return {
        ...o,
        kind,
        productName: PRODUCT_TR.get(o.package_id) ?? o.package_id,
        ...splitVat(o.price_try),
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const invoicesDue = orders
    .filter(
      (o) => isPaid(o) && o.price_try > 0 && (o.invoice_status ?? "pending") !== "issued" && o.invoice_status !== "none",
    )
    .sort((a, b) => paidAt(a).localeCompare(paidAt(b))); // en eski ödeme en üstte (7 gün kuralı)

  const projects = new Map<string, number>();
  for (const id of projectUserIds) projects.set(id, (projects.get(id) ?? 0) + 1);

  const balance = new Map<string, number>();
  const pkg = new Map<string, { until: string; product: string | null }>();
  for (const l of lots) {
    const alive = !l.expires_at || new Date(l.expires_at).getTime() > nowMs;
    if (!alive) continue;
    balance.set(l.user_id, (balance.get(l.user_id) ?? 0) + l.remaining);
    if (l.source === "purchase" && l.expires_at) {
      const cur = pkg.get(l.user_id);
      if (!cur || l.expires_at > cur.until) pkg.set(l.user_id, { until: l.expires_at, product: l.product_id ?? null });
    }
  }

  const orderCount = new Map<string, number>();
  const paidTotal = new Map<string, number>();
  for (const o of orders) {
    if (!o.user_id) continue;
    orderCount.set(o.user_id, (orderCount.get(o.user_id) ?? 0) + 1);
    if (isPaid(o)) paidTotal.set(o.user_id, (paidTotal.get(o.user_id) ?? 0) + o.price_try);
  }

  // ── Jeton kullanımı (defter) ──
  // Harcama = kind 'spend' ve iade EDİLMEMİŞ satırlar. (İade edilenler net 0.)
  const spends = ledger.filter((g) => (g.kind ?? "spend") === "spend" && g.delta < 0 && !g.refunded_at);
  const byActionMap = new Map<string, UsageByAction>();
  const byMemberMap = new Map<string, UsageByMember>();
  for (const g of spends) {
    const a = byActionMap.get(g.action) ?? { action: g.action, label: actionLabel(g.action), count: 0, credits: 0 };
    a.count += 1;
    a.credits += -g.delta;
    byActionMap.set(g.action, a);
    const m = byMemberMap.get(g.user_id) ?? {
      id: g.user_id,
      email: emailOf.get(g.user_id) ?? g.user_id,
      count: 0,
      credits: 0,
      lastAt: g.created_at,
    };
    m.count += 1;
    m.credits += -g.delta;
    if (g.created_at > m.lastAt) m.lastAt = g.created_at;
    byMemberMap.set(g.user_id, m);
  }
  const recent: UsageRow[] = [...ledger]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 500)
    .map((g) => ({
      id: g.id,
      at: g.created_at,
      userId: g.user_id,
      email: emailOf.get(g.user_id) ?? g.user_id,
      label: actionLabel(g.action),
      kind: g.kind ?? (g.delta < 0 ? "spend" : "refund"),
      delta: g.delta,
      actor: g.actor ?? null,
      note: g.note ?? null,
      refunded: !!g.refunded_at,
    }));

  // Sıra: önce en çok ödeyenler, sonra en çok kullananlar, sonra en yeni üyeler.
  const customers: AdminCustomer[] = users
    .map((u) => {
      const p = pkg.get(u.id);
      const use = byMemberMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        projects: projects.get(u.id) ?? 0,
        balance: balance.get(u.id) ?? 0,
        packageName: p ? (p.product ? (PRODUCT_TR.get(p.product) ?? p.product) : "Paket") : null,
        packageUntil: p?.until ?? null,
        orders: orderCount.get(u.id) ?? 0,
        paidTotal: paidTotal.get(u.id) ?? 0,
        spent: use?.credits ?? 0,
        lastUseAt: use?.lastAt ?? null,
      };
    })
    .sort(
      (a, b) => b.paidTotal - a.paidTotal || b.spent - a.spent || b.createdAt.localeCompare(a.createdAt),
    );

  const paid = orders.filter(isPaid);
  const product = (p: (typeof CREDIT_PACKAGES)[number], kind: "package" | "addon"): AdminProduct => {
    const mine = paid.filter((o) => o.package_id === p.id);
    const sold = mine.filter((o) => o.price_try > 0);
    return {
      id: p.id,
      name: PRODUCT_TR.get(p.id) ?? p.name.tr,
      kind,
      credits: p.credits,
      priceTry: p.priceTry,
      validityDays: PACKAGE_VALIDITY_DAYS,
      sold: sold.length,
      gifted: mine.length - sold.length,
      revenue: sold.reduce((s, o) => s + o.price_try, 0),
    };
  };
  const products = [
    ...CREDIT_PACKAGES.map((p) => product(p, "package")),
    ...CREDIT_ADDONS.map((p) => product(p, "addon")),
  ];

  const thisMonth = monthKeyTR(now.toISOString());
  const paidMoney = paid.filter((o) => o.price_try > 0);
  const monthPaid = paidMoney.filter((o) => monthKeyTR(paidAt(o)) === thisMonth);
  const stats: AdminStats = {
    monthRevenue: monthPaid.reduce((s, o) => s + o.price_try, 0),
    monthOrders: monthPaid.length,
    totalRevenue: paidMoney.reduce((s, o) => s + o.price_try, 0),
    pending: orders.filter((o) => o.status === "pending").length,
    customers: users.length,
    payingCustomers: new Set(paidMoney.map((o) => o.user_id)).size,
    invoicesDue: invoicesDue.length,
    invoicesDueTotal: invoicesDue.reduce((s, o) => s + o.price_try, 0),
    activePackages: pkg.size,
    spentInPeriod: spends.reduce((s, g) => s - g.delta, 0),
  };

  return {
    orders,
    invoicesDue,
    customers,
    products,
    usage: {
      period: opts.period ?? resolvePeriod(null, null, now),
      presets: periodPresets(now),
      byAction: [...byActionMap.values()].sort((a, b) => b.credits - a.credits),
      byMember: [...byMemberMap.values()].sort((a, b) => b.credits - a.credits),
      recent,
      truncated: !!opts.ledgerTruncated,
    },
    stats,
    generatedAt: now.toISOString(),
    setupMissing: !!opts.setupMissing,
  };
}

// Supabase REST tek sorguda en çok 1000 satır döndürür → sayfa sayfa çek.
const PAGE = 1000;

// Sunucu: ham verileri service-role ile çek. Tablolar henüz yoksa (SQL
// çalıştırılmadıysa) boş liste + setupMissing döner → panel yine açılır.
export async function loadAdminData(period: Period = resolvePeriod(null, null)): Promise<AdminData> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  let setupMissing = false;

  type Res = { data: unknown[] | null; error: { code?: string; message: string } | null };
  async function all<T>(
    run: (from: number, to: number) => PromiseLike<Res>,
    maxRows: number,
  ): Promise<{ rows: T[]; truncated: boolean }> {
    const rows: T[] = [];
    for (let from = 0; from < maxRows; from += PAGE) {
      const { data, error } = await run(from, from + PAGE - 1);
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703") setupMissing = true;
        else console.error("[admin] veri okunamadı:", error.message);
        return { rows, truncated: false };
      }
      rows.push(...((data ?? []) as T[]));
      if ((data ?? []).length < PAGE) return { rows, truncated: false };
    }
    return { rows, truncated: true };
  }

  const users: RawUser[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) break;
    for (const u of data.users)
      users.push({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    if (data.users.length < PAGE) break;
  }

  const [proj, ord, lot, led] = await Promise.all([
    all<{ user_id: string }>((a, b) => admin.from("projects").select("user_id").range(a, b), 50000),
    all<OrderRow>(
      (a, b) => admin.from("credit_orders").select("*").order("created_at", { ascending: false }).range(a, b),
      10000,
    ),
    all<RawLot>(
      (a, b) =>
        admin
          .from("credit_lots")
          .select("user_id, remaining, source, expires_at, product_id")
          .gt("remaining", 0)
          .order("created_at", { ascending: true })
          .range(a, b),
      50000,
    ),
    all<RawLedger>(
      (a, b) =>
        admin
          .from("credit_ledger")
          .select("id, user_id, delta, action, created_at, kind, actor, note, refunded_at")
          .gte("created_at", period.fromIso)
          .lt("created_at", period.toIso)
          .order("created_at", { ascending: false })
          .range(a, b),
      20000,
    ),
  ]);

  return buildAdminData(
    users,
    proj.rows.map((r) => r.user_id),
    ord.rows,
    lot.rows,
    led.rows,
    { period, ledgerTruncated: led.truncated, setupMissing },
  );
}
