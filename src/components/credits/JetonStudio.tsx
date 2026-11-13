import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { OrderRow } from "@/lib/credits/orderActions";
import type { MyLedgerRow, MyLot } from "@/lib/credits/orders";
import { actionLabel } from "@/lib/credits/adminData";
import { COMPANY } from "@/lib/legal/company";

// JETONLARIM — üyenin hesabı: bakiye, paket durumu, jetonların son kullanma
// tarihleri, son hareketler ve siparişler. Satın alma buradan değil, Fiyatlar →
// Satın al adımlarından yapılır (tek satın alma yolu).
const SOURCE_TR: Record<string, string> = {
  welcome: "Hoş geldin jetonu",
  purchase: "Paket",
  addon: "Ek jeton",
  grant: "Tanımlanan jeton",
  refund: "İade",
};
const SOURCE_EN: Record<string, string> = {
  welcome: "Welcome credits",
  purchase: "Package",
  addon: "Extra credits",
  grant: "Granted credits",
  refund: "Refund",
};

export default function JetonStudio({
  lang,
  balance,
  packageUntil,
  lots,
  ledger,
  orders,
}: {
  lang: Locale;
  balance: number | null; // null = sınırsız (yönetici)
  packageUntil: string | null;
  lots: MyLot[];
  ledger: MyLedgerRow[];
  orders: OrderRow[];
}) {
  const tr = lang === "tr";
  const L = (a: string, b: string) => (tr ? a : b);
  const loc = tr ? "tr-TR" : "en-US";
  const num = (n: number) => n.toLocaleString(loc);
  const date = (iso: string) => new Date(iso).toLocaleDateString(loc, { timeZone: "Europe/Istanbul" });
  const dateTime = (iso: string) =>
    new Date(iso).toLocaleString(loc, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const paidOrders = orders.filter((o) => o.status === "approved");
  const card = "rounded-2xl border border-border bg-surface p-5";
  const h2 = "mb-3 font-sans text-lg font-extrabold";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{L("Jetonlarım", "My credits")}</h1>
      <p className="mt-1 text-sm text-muted">
        {L(
          "Yapay zekâ işlemleri jeton harcar; dosya indirmek için aktif bir paket gerekir.",
          "AI actions use credits; downloading files requires an active package.",
        )}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className={card}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{L("Bakiye", "Balance")}</div>
          <div className="mt-1 text-4xl font-extrabold text-accent">
            {balance == null ? "∞" : num(balance)}{" "}
            <span className="text-base font-semibold text-muted">{L("jeton", "credits")}</span>
          </div>
          {balance != null && balance <= 0 && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {L("Jetonun bitti. Yapay zekâ işlemleri için jeton alman gerekiyor.", "You are out of credits.")}
            </p>
          )}
        </div>
        <div
          className={`${card} ${
            packageUntil ? "border-emerald-400/60" : "border-amber-400/60"
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{L("Paket", "Package")}</div>
          {packageUntil ? (
            <>
              <div className="mt-1 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                {L("İndirme açık", "Downloads unlocked")}
              </div>
              <p className="mt-1 text-sm text-muted">
                {L(`Paketin ${date(packageUntil)} tarihine kadar geçerli.`, `Your package is valid until ${date(packageUntil)}.`)}
              </p>
            </>
          ) : (
            <>
              <div className="mt-1 text-lg font-extrabold text-amber-700 dark:text-amber-400">
                {L("Aktif paket yok", "No active package")}
              </div>
              <p className="mt-1 text-sm text-muted">
                {L(
                  "Dosya indirme ve dışa aktarma kapalı. Bir paket alınca 30 gün boyunca açılır.",
                  "Downloads and exports are locked. A package unlocks them for 30 days.",
                )}
              </p>
            </>
          )}
        </div>
      </div>

      <div className={`${card} mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center`}>
        <div className="text-sm">
          <div className="font-bold">{L("Paket ya da ek jeton al", "Get a package or extra credits")}</div>
          <div className="text-muted">
            {L(
              `Fiyatları gör ve satın alma adımlarını izle. Sorun olursa: ${COMPANY.email}`,
              `See prices and follow the checkout steps. Questions: ${COMPANY.email}`,
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/${lang}/fiyatlar`}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            {L("Fiyatlar", "Pricing")}
          </Link>
          <Link
            href={`/${lang}/iletisim`}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-bold transition hover:border-foreground/30"
          >
            {L("İletişim", "Contact")}
          </Link>
        </div>
      </div>

      <section className="mt-8">
        <h2 className={h2}>{L("Jetonlarımın süresi", "Credit expiry")}</h2>
        {lots.length === 0 ? (
          <p className="text-sm text-muted">{L("Kullanılabilir jeton yok.", "No usable credits.")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody>
                {lots.map((l, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-semibold">
                      {num(l.remaining)} {L("jeton", "credits")}
                    </td>
                    <td className="px-4 py-3 text-muted">{(tr ? SOURCE_TR : SOURCE_EN)[l.source] ?? l.source}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      {l.expires_at
                        ? L(`${date(l.expires_at)} tarihine kadar`, `until ${date(l.expires_at)}`)
                        : L("süresiz", "never expires")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className={h2}>{L("Son hareketler", "Recent activity")}</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted">{L("Henüz hareket yok.", "No activity yet.")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody>
                {ledger.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{dateTime(g.created_at)}</td>
                    <td className="px-4 py-3">{actionLabel(g.action)}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono font-semibold ${
                        g.delta > 0 ? "text-emerald-700 dark:text-emerald-400" : ""
                      }`}
                    >
                      {g.delta > 0 ? "+" : ""}
                      {num(g.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paidOrders.length > 0 && (
        <section className="mt-8">
          <h2 className={h2}>{L("Satın aldıklarım", "My purchases")}</h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <tbody>
                {paidOrders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{date(o.paid_at ?? o.created_at)}</td>
                    <td className="px-4 py-3 font-semibold">{actionLabel(`satin-alma:${o.package_id}`)}</td>
                    <td className="px-4 py-3 text-muted">
                      {num(o.credits)} {L("jeton", "credits")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      {o.price_try > 0 ? `${o.price_try.toLocaleString("tr-TR")} ₺` : L("hediye", "gift")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
