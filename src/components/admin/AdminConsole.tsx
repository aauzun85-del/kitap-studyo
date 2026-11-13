// Yönetim paneli: Üyeler · Faturası kesilecekler · Siparişler · Ürünler · Jeton kullanımı.
// Sunucu bileşeni; sekme ve süzgeçler adres çubuğundaki parametrelerden gelir
// (?tab=…, ?durum=…, ?musteri=<id> sipariş süzgeci, ?uye=<id> üye ayrıntısı) →
// sayfa yenilense de aynı görünüm kalır. Yalnız düğmeler istemcide çalışır.

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { AdminData, AdminOrder } from "@/lib/credits/adminData";
import { VAT_RATE } from "@/lib/credits/pricing";
import OrderActions from "./OrderActions";
import MemberActions from "./MemberActions";
import InvoiceActions from "./InvoiceActions";

export type AdminTab = "uyeler" | "faturalar" | "siparisler" | "urunler" | "jeton";
const STATUSES = ["approved", "pending", "failed", "rejected", "refunded"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_TR: Record<Status, string> = {
  approved: "Ödendi",
  pending: "Bekliyor",
  failed: "Başarısız",
  rejected: "Reddedildi",
  refunded: "İade",
};
const STATUS_CLASS: Record<Status, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-700",
  rejected: "bg-gray-100 text-gray-600",
  refunded: "bg-sky-100 text-sky-800",
};
const METHOD_TR: Record<string, string> = {
  havale: "Havale",
  paytr: "Kart",
  kart: "Kart",
  elden: "Elle girildi",
  hediye: "Hediye",
};
const KIND_TR: Record<string, string> = {
  spend: "Harcama",
  refund: "İade",
  purchase: "Paket",
  addon: "Ek jeton",
  grant: "Elle eklendi",
  welcome: "Hoş geldin",
};

export default function AdminConsole({
  lang,
  data,
  tab,
  status,
  customerId,
  memberId,
  basePath,
}: {
  lang: Locale;
  data: AdminData;
  tab: AdminTab;
  status: Status | null;
  customerId: string | null;
  memberId: string | null;
  basePath: string; // örn. "/tr/admin"
}) {
  const loc = lang === "tr" ? "tr-TR" : "en-US";
  const num = (n: number) => n.toLocaleString("tr-TR");
  const money = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;
  const date = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(loc, { timeZone: "Europe/Istanbul" }) : "—";
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(loc, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const { stats, usage } = data;
  const customRange = usage.period.label !== "son 30 gün";
  const nowMs = new Date(data.generatedAt).getTime();
  const href = (q: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    // Seçili tarih aralığı sekme/üye değişince kaybolmasın.
    if (customRange && !("bas" in q)) {
      p.set("bas", usage.period.from);
      p.set("bit", usage.period.to);
    }
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const member = memberId ? data.customers.find((c) => c.id === memberId) : undefined;
  const customer = customerId ? data.customers.find((c) => c.id === customerId) : undefined;
  let orders: AdminOrder[] = data.orders;
  if (customerId) orders = orders.filter((o) => o.user_id === customerId);
  if (status) orders = orders.filter((o) => o.status === status);

  const tabs: { id: AdminTab; label: string; count: number | null; warn?: boolean }[] = [
    { id: "uyeler", label: "Üyeler", count: data.customers.length },
    { id: "faturalar", label: "Faturası kesilecekler", count: data.invoicesDue.length, warn: data.invoicesDue.length > 0 },
    { id: "siparisler", label: "Siparişler", count: data.orders.length },
    { id: "urunler", label: "Ürünler", count: data.products.length },
    { id: "jeton", label: "Jeton kullanımı", count: null },
  ];

  const th = "px-4 py-3 font-semibold whitespace-nowrap";
  const td = "px-4 py-3";
  const table = "mt-4 overflow-x-auto rounded-2xl border border-border bg-surface";
  const thead = "border-b border-border text-xs uppercase tracking-wide text-muted";
  const tr = "border-b border-border last:border-0 hover:bg-background";

  // Tarih aralığı seçici: hazır düğmeler + iki tarih kutusu (sayfayı yeniden yükler).
  const periodPicker = (keep: Record<string, string | null>) => (
    <div className="mt-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        {usage.presets.map((ps) => {
          const on = usage.period.from === ps.from && usage.period.to === ps.to;
          return (
            <Link
              key={ps.id}
              href={href({ ...keep, bas: ps.from, bit: ps.to })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                on ? "bg-foreground text-background" : "bg-background text-muted hover:text-foreground"
              }`}
            >
              {ps.label}
            </Link>
          );
        })}
      </div>
      <form method="get" action={basePath} className="mt-3 flex flex-wrap items-end gap-2">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label className="text-xs text-muted">
          Başlangıç
          <input
            type="date"
            name="bas"
            defaultValue={usage.period.from}
            max={usage.period.to > usage.presets[0].to ? usage.period.to : usage.presets[0].to}
            className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted">
          Bitiş
          <input
            type="date"
            name="bit"
            defaultValue={usage.period.to}
            max={usage.presets[0].to}
            className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
          Göster
        </button>
        <span className="pb-2 text-xs text-muted">
          Gösterilen: <strong className="text-foreground">{usage.period.label}</strong> ({usage.period.days} gün)
        </span>
      </form>
    </div>
  );

  // Faturaya yapıştırılacak hazır metin.
  const invoiceText = (o: AdminOrder) =>
    [
      `Alıcı: ${o.billing_name ?? "-"} (${o.billing_type === "kurumsal" ? "Kurumsal" : "Bireysel"})`,
      o.billing_type === "kurumsal"
        ? `Vergi dairesi / no: ${o.billing_tax_office ?? "-"} / ${o.billing_tax_id ?? "-"}`
        : `TC kimlik no: ${o.billing_tax_id || "11111111111"}`,
      `Adres: ${[o.billing_address, o.billing_district, o.billing_city].filter(Boolean).join(", ") || "-"}`,
      `E-posta: ${o.billing_email || o.email}`,
      `Ürün: Laycoty ${o.productName} (${num(o.credits)} jeton)`,
      `KDV hariç: ${money(o.net)} · KDV %${VAT_RATE}: ${money(o.vat)} · Toplam: ${money(o.price_try)}`,
      `Ödeme tarihi: ${o.paid_at ? dateTime(o.paid_at) : "-"} · Sipariş: ${o.ref_code}`,
      "Bu satış internet üzerinden yapılmıştır. (www.laycoty.com)",
    ].join("\n");

  const billingMissing = (o: AdminOrder) =>
    !o.billing_name ||
    !o.billing_address ||
    (o.billing_type === "kurumsal" && (!o.billing_tax_id || !o.billing_tax_office));

  const orderRows = (list: AdminOrder[], showCustomer: boolean) => (
    <div className={table}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className={thead}>
            <th className={th}>Tarih</th>
            {showCustomer && <th className={th}>Üye</th>}
            <th className={th}>Ürün</th>
            <th className={`${th} text-right`}>Jeton</th>
            <th className={`${th} text-right`}>Tutar</th>
            <th className={th}>Ödeme</th>
            <th className={th}>Durum</th>
            <th className={th}>Fatura</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id} className={tr}>
              <td className={`${td} whitespace-nowrap text-muted`}>{dateTime(o.created_at)}</td>
              {showCustomer && (
                <td className={`${td} font-medium`}>
                  {o.user_id ? (
                    <Link href={href({ tab: "uyeler", uye: o.user_id })} className="hover:text-accent">
                      {o.email || o.user_id}
                    </Link>
                  ) : (
                    o.email || "—"
                  )}
                </td>
              )}
              <td className={td}>
                {o.productName}
                {o.admin_note && <div className="text-xs text-muted">{o.admin_note}</div>}
              </td>
              <td className={`${td} text-right font-mono`}>{num(o.credits)}</td>
              <td className={`${td} whitespace-nowrap text-right font-mono font-semibold`}>
                {o.price_try > 0 ? money(o.price_try) : <span className="font-normal text-muted">hediye</span>}
              </td>
              <td className={`${td} whitespace-nowrap text-muted`}>
                {METHOD_TR[o.payment_method ?? "havale"] ?? o.payment_method}
                <div className="font-mono text-[11px]">{o.provider_ref || o.ref_code}</div>
              </td>
              <td className={td}>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[o.status] ?? "bg-gray-100 text-gray-600"}`}
                  title={o.failure_reason ?? undefined}
                >
                  {STATUS_TR[o.status] ?? o.status}
                </span>
              </td>
              <td className={`${td} whitespace-nowrap text-xs`}>
                {o.status !== "approved" || o.price_try <= 0 ? (
                  <span className="text-muted">—</span>
                ) : o.invoice_status === "issued" ? (
                  <span className="text-emerald-700">
                    Kesildi{o.invoice_no ? ` · ${o.invoice_no}` : ""}
                  </span>
                ) : (
                  <Link href={href({ tab: "faturalar" })} className="font-semibold text-amber-700 hover:underline">
                    Kesilecek
                  </Link>
                )}
              </td>
              <td className={`${td} text-right`}>
                {o.status === "pending" && <OrderActions orderId={o.id} tr />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-sans text-3xl font-extrabold">Yönetim</h1>
      <p className="mt-1 text-sm text-muted">
        Üyeler, satışlar, kesilecek faturalar ve jeton kullanımı tek yerde.
      </p>

      {data.setupMissing && (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Sipariş ve jeton tabloları veritabanında henüz kurulmamış; aşağıdaki listelerin bir kısmı boş görünür.
          Kurulum için Supabase panelinde SQL dosyasının çalıştırılması gerekiyor.
        </p>
      )}

      {/* Özet */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "Bu ay ciro", v: money(stats.monthRevenue), s: `${stats.monthOrders} satış · toplam ${money(stats.totalRevenue)}` },
          {
            k: "Faturası kesilecek",
            v: String(stats.invoicesDue),
            s: stats.invoicesDue ? `${money(stats.invoicesDueTotal)} · 7 gün içinde kesilmeli` : "bekleyen yok",
            warn: stats.invoicesDue > 0,
            to: href({ tab: "faturalar" }),
          },
          {
            k: "Aktif paketli üye",
            v: String(stats.activePackages),
            s: `${stats.customers} üyeden · ${stats.payingCustomers} ödeme yapan`,
            to: href({ tab: "uyeler" }),
          },
          {
            k: `Harcanan jeton (${usage.period.label})`,
            v: num(stats.spentInPeriod),
            s: `${usage.byMember.length} üye kullandı`,
            to: href({ tab: "jeton" }),
          },
        ].map((c) => {
          const body = (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">{c.k}</div>
              <div className="mt-1 font-mono text-2xl font-bold">{c.v}</div>
              <div className="text-xs text-muted">{c.s}</div>
            </>
          );
          const cls = `block rounded-2xl border bg-surface p-4 ${c.warn ? "border-amber-400" : "border-border"}`;
          return c.to ? (
            <Link key={c.k} href={c.to} className={`${cls} transition hover:border-accent`}>
              {body}
            </Link>
          ) : (
            <div key={c.k} className={cls}>
              {body}
            </div>
          );
        })}
      </div>

      {/* Sekmeler */}
      <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={href({ tab: t.id })}
            className={`-mb-px whitespace-nowrap rounded-t-lg border px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-border border-b-surface bg-surface text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 font-mono text-xs ${
                  t.warn ? "bg-amber-200 text-amber-900" : "text-muted"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* ───────── ÜYE AYRINTISI ───────── */}
      {tab === "uyeler" && memberId && (
        <section className="mt-5">
          <Link href={href({ tab: "uyeler" })} className="text-sm font-semibold text-accent hover:underline">
            ← Tüm üyeler
          </Link>
          {!member ? (
            <p className="mt-4 text-sm text-muted">Üye bulunamadı.</p>
          ) : (
            <>
              <h2 className="mt-3 break-all font-sans text-2xl font-extrabold">{member.email}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Jeton bakiyesi", num(member.balance)],
                  [
                    "Paket",
                    member.packageUntil ? `${member.packageName} · ${date(member.packageUntil)} bitiyor` : "Paket yok (indirme kapalı)",
                  ],
                  [`Harcanan (${usage.period.label})`, `${num(member.spent)} jeton`],
                  ["Toplam ödeme", member.paidTotal > 0 ? money(member.paidTotal) : "—"],
                  ["Kayıt", date(member.createdAt)],
                  ["Son giriş", date(member.lastSignInAt)],
                  ["Kitap", String(member.projects)],
                  ["Son kullanım", member.lastUseAt ? dateTime(member.lastUseAt) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border bg-surface px-4 py-3">
                    <div className="text-xs text-muted">{k}</div>
                    <div className="mt-0.5 text-sm font-semibold">{v}</div>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 font-sans text-lg font-extrabold">Elle işlem</h3>
              <div className="mt-3">
                <MemberActions
                  userId={member.id}
                  email={member.email}
                  products={data.products.map((p) => ({
                    id: p.id,
                    name: p.name,
                    kind: p.kind,
                    credits: p.credits,
                    priceTry: p.priceTry,
                  }))}
                />
              </div>

              <h3 className="mt-8 font-sans text-lg font-extrabold">Siparişleri</h3>
              {data.orders.some((o) => o.user_id === member.id) ? (
                orderRows(data.orders.filter((o) => o.user_id === member.id), false)
              ) : (
                <p className="mt-2 text-sm text-muted">Henüz sipariş yok.</p>
              )}

              <h3 className="mt-8 font-sans text-lg font-extrabold">Jeton hareketleri ({usage.period.label})</h3>
              {periodPicker({ tab: "uyeler", uye: member.id })}
              {usage.recent.some((r) => r.userId === member.id) ? (
                <div className={table}>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={thead}>
                        <th className={th}>Zaman</th>
                        <th className={th}>İşlem</th>
                        <th className={th}>Tür</th>
                        <th className={`${th} text-right`}>Jeton</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.recent
                        .filter((r) => r.userId === member.id)
                        .map((r) => (
                          <tr key={r.id} className={tr}>
                            <td className={`${td} whitespace-nowrap text-muted`}>{dateTime(r.at)}</td>
                            <td className={td}>
                              {r.label}
                              {(r.note || r.actor) && (
                                <div className="text-xs text-muted">{[r.note, r.actor].filter(Boolean).join(" · ")}</div>
                              )}
                            </td>
                            <td className={`${td} text-muted`}>
                              {KIND_TR[r.kind] ?? r.kind}
                              {r.refunded ? " (iade edildi)" : ""}
                            </td>
                            <td
                              className={`${td} text-right font-mono font-semibold ${r.delta < 0 ? "" : "text-emerald-700"}`}
                            >
                              {r.delta > 0 ? "+" : ""}
                              {num(r.delta)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">Bu dönemde hareket yok.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* ───────── ÜYELER ───────── */}
      {tab === "uyeler" && !memberId && (
        <section className="mt-5">
          <p className="text-sm text-muted">
            Laycoty&apos;ye üye olan herkes. Bir üyeye tıklayınca ayrıntısı açılır; oradan jeton ekleyebilir, paket
            tanımlayabilirsin.
          </p>
          <div className={table}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={thead}>
                  <th className={th}>Üye</th>
                  <th className={th}>Paket</th>
                  <th className={`${th} text-right`}>Jeton</th>
                  <th className={`${th} text-right`}>Harcanan</th>
                  <th className={`${th} text-right`}>Kitap</th>
                  <th className={`${th} text-right`}>Toplam ödeme</th>
                  <th className={th}>Son giriş</th>
                  <th className={th}>Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} className={tr}>
                    <td className={`${td} font-medium`}>
                      <Link href={href({ tab: "uyeler", uye: c.id })} className="text-accent hover:underline">
                        {c.email || c.id}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {c.packageUntil ? (
                        <span className="text-emerald-700">
                          {c.packageName} · {date(c.packageUntil)}
                        </span>
                      ) : (
                        <span className="text-muted">Paket yok</span>
                      )}
                    </td>
                    <td className={`${td} text-right font-mono`}>{num(c.balance)}</td>
                    <td className={`${td} text-right font-mono`}>{c.spent ? num(c.spent) : <span className="text-muted">0</span>}</td>
                    <td className={`${td} text-right font-mono`}>{c.projects}</td>
                    <td className={`${td} whitespace-nowrap text-right font-mono font-semibold`}>
                      {c.paidTotal > 0 ? money(c.paidTotal) : <span className="font-normal text-muted">—</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{date(c.lastSignInAt)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{date(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ───────── FATURASI KESİLECEKLER ───────── */}
      {tab === "faturalar" && (
        <section className="mt-5">
          <p className="text-sm text-muted">
            Parası alınmış ama faturası henüz kesilmemiş satışlar; en eski ödeme en üstte. Fatura, ödemeden sonra en
            geç 7 gün içinde kesilmeli. Faturayı kestikten sonra numarasını yazıp “Fatura kesildi”ye bas.
          </p>
          {data.invoicesDue.length === 0 ? (
            <p className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Kesilecek fatura yok.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.invoicesDue.map((o) => {
                const days = o.paid_at ? Math.max(0, Math.floor((nowMs - new Date(o.paid_at).getTime()) / 86400000)) : 0;
                const late = days >= 5;
                return (
                  <div key={o.id} className={`rounded-2xl border bg-surface p-4 ${late ? "border-red-400" : "border-border"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-sans text-base font-extrabold">
                          {o.productName} · {money(o.price_try)}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {o.user_id ? (
                            <Link href={href({ tab: "uyeler", uye: o.user_id })} className="text-accent hover:underline">
                              {o.email}
                            </Link>
                          ) : (
                            o.email
                          )}{" "}
                          · ödeme {o.paid_at ? dateTime(o.paid_at) : "—"} ·{" "}
                          <span className={late ? "font-bold text-red-600" : ""}>
                            {days === 0 ? "bugün" : `${days} gün önce`}
                            {late ? " — acele et" : ""}
                          </span>{" "}
                          · {METHOD_TR[o.payment_method ?? ""] ?? o.payment_method} · {o.ref_code}
                        </div>
                      </div>
                      <InvoiceActions orderId={o.id} issued={false} copyText={invoiceText(o)} />
                    </div>
                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {[
                        ["Fatura türü", o.billing_type === "kurumsal" ? "Kurumsal" : "Bireysel"],
                        [o.billing_type === "kurumsal" ? "Unvan" : "Ad soyad", o.billing_name],
                        o.billing_type === "kurumsal"
                          ? ["Vergi dairesi / no", [o.billing_tax_office, o.billing_tax_id].filter(Boolean).join(" / ")]
                          : ["TC kimlik no", o.billing_tax_id || "vermedi (11111111111 yazılır)"],
                        ["Adres", [o.billing_address, o.billing_district, o.billing_city].filter(Boolean).join(", ")],
                        ["E-posta", o.billing_email || o.email],
                        ["KDV hariç", money(o.net)],
                        [`KDV %${VAT_RATE}`, money(o.vat)],
                        ["Toplam (KDV dahil)", money(o.price_try)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="w-36 shrink-0 text-muted">{k}</dt>
                          <dd className="min-w-0 break-words font-medium">
                            {v || <span className="font-semibold text-red-600">eksik</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {billingMissing(o) && (
                      <p className="mt-2 text-xs text-red-600">
                        Fatura bilgileri eksik: faturayı kesmeden önce üyeden tamamlamasını iste.
                      </p>
                    )}
                    {o.admin_note && <p className="mt-2 text-xs text-muted">Not: {o.admin_note}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ───────── SİPARİŞLER ───────── */}
      {tab === "siparisler" && (
        <section className="mt-5">
          <p className="text-sm text-muted">
            Bütün satışlar ve elle tanımlanan paketler. Kartla ödeme açılınca ödenenler kendiliğinden “Ödendi” olur.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={href({ tab: "siparisler", musteri: customerId })}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${!status ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground"}`}
            >
              Tümü
            </Link>
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={href({ tab: "siparisler", durum: s, musteri: customerId })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${status === s ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground"}`}
              >
                {STATUS_TR[s]}
              </Link>
            ))}
            {customer && (
              <Link
                href={href({ tab: "siparisler", durum: status })}
                className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
                title="Üye süzgecini kaldır"
              >
                {customer.email} ✕
              </Link>
            )}
          </div>
          {orders.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Bu süzgeçte sipariş yok.</p>
          ) : (
            orderRows(orders, true)
          )}
        </section>
      )}

      {/* ───────── ÜRÜNLER ───────── */}
      {tab === "urunler" && (
        <section className="mt-5">
          <p className="text-sm text-muted">
            Satıştaki paketler ve ek jetonlar; her birinden kaç tane satıldı, ne getirdi. Fiyat ya da jeton miktarını
            değiştirmek istersen bana yazman yeterli.
          </p>
          <div className={table}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={thead}>
                  <th className={th}>Ürün</th>
                  <th className={th}>Tür</th>
                  <th className={`${th} text-right`}>Jeton</th>
                  <th className={`${th} text-right`}>Fiyat</th>
                  <th className={`${th} text-right`}>Süre</th>
                  <th className={`${th} text-right`}>Satılan</th>
                  <th className={`${th} text-right`}>Hediye</th>
                  <th className={`${th} text-right`}>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id} className={tr}>
                    <td className={`${td} font-semibold`}>{p.name}</td>
                    <td className={`${td} text-muted`}>{p.kind === "package" ? "Paket (indirme açar)" : "Ek jeton"}</td>
                    <td className={`${td} text-right font-mono`}>{num(p.credits)}</td>
                    <td className={`${td} whitespace-nowrap text-right font-mono`}>{money(p.priceTry)}</td>
                    <td className={`${td} whitespace-nowrap text-right text-muted`}>{p.validityDays} gün</td>
                    <td className={`${td} text-right font-mono`}>{p.sold}</td>
                    <td className={`${td} text-right font-mono text-muted`}>{p.gifted}</td>
                    <td className={`${td} whitespace-nowrap text-right font-mono font-semibold`}>{money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ───────── JETON KULLANIMI ───────── */}
      {tab === "jeton" && (
        <section className="mt-5">
          <p className="text-sm text-muted">
            Seçtiğin tarihlerde kim, hangi işlemde, kaç jeton harcadı. Başarısız olup iade edilen işlemler toplamlara
            girmez. Yöneticinin kendi kullanımı jeton düşmez, burada görünmez.
          </p>
          {periodPicker({ tab: "jeton" })}
          {usage.truncated && (
            <p className="mt-2 text-xs text-amber-700">
              Kayıt çok fazla olduğu için yalnız en yeni kısmı gösteriliyor.
            </p>
          )}

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-sans text-base font-extrabold">İşleme göre</h3>
              {usage.byAction.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Bu dönemde harcama yok.</p>
              ) : (
                <div className={table}>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={thead}>
                        <th className={th}>İşlem</th>
                        <th className={`${th} text-right`}>Kez</th>
                        <th className={`${th} text-right`}>Jeton</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.byAction.map((a) => (
                        <tr key={a.action} className={tr}>
                          <td className={td}>{a.label}</td>
                          <td className={`${td} text-right font-mono`}>{num(a.count)}</td>
                          <td className={`${td} text-right font-mono font-semibold`}>{num(a.credits)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-sans text-base font-extrabold">Üyeye göre</h3>
              {usage.byMember.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Bu dönemde harcama yok.</p>
              ) : (
                <div className={table}>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={thead}>
                        <th className={th}>Üye</th>
                        <th className={`${th} text-right`}>İşlem</th>
                        <th className={`${th} text-right`}>Jeton</th>
                        <th className={th}>Son</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.byMember.map((m) => (
                        <tr key={m.id} className={tr}>
                          <td className={`${td} font-medium`}>
                            <Link href={href({ tab: "uyeler", uye: m.id })} className="text-accent hover:underline">
                              {m.email}
                            </Link>
                          </td>
                          <td className={`${td} text-right font-mono`}>{num(m.count)}</td>
                          <td className={`${td} text-right font-mono font-semibold`}>{num(m.credits)}</td>
                          <td className={`${td} whitespace-nowrap text-muted`}>{dateTime(m.lastAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <h3 className="mt-8 font-sans text-base font-extrabold">Son hareketler</h3>
          {usage.recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Henüz hareket yok.</p>
          ) : (
            <div className={table}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={thead}>
                    <th className={th}>Zaman</th>
                    <th className={th}>Üye</th>
                    <th className={th}>İşlem</th>
                    <th className={th}>Tür</th>
                    <th className={`${th} text-right`}>Jeton</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.recent.map((r) => (
                    <tr key={r.id} className={tr}>
                      <td className={`${td} whitespace-nowrap text-muted`}>{dateTime(r.at)}</td>
                      <td className={`${td} font-medium`}>
                        <Link href={href({ tab: "uyeler", uye: r.userId })} className="hover:text-accent">
                          {r.email}
                        </Link>
                      </td>
                      <td className={td}>
                        {r.label}
                        {(r.note || r.actor) && (
                          <div className="text-xs text-muted">{[r.note, r.actor].filter(Boolean).join(" · ")}</div>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-muted`}>
                        {KIND_TR[r.kind] ?? r.kind}
                        {r.refunded ? " (iade edildi)" : ""}
                      </td>
                      <td className={`${td} text-right font-mono font-semibold ${r.delta < 0 ? "" : "text-emerald-700"}`}>
                        {r.delta > 0 ? "+" : ""}
                        {num(r.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
