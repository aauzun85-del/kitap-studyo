import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/supabase/user";
import { hasServiceKey } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { loadAdminData } from "@/lib/credits/adminData";
import { resolvePeriod } from "@/lib/credits/period";
import AdminConsole, { type AdminTab } from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";

const TABS: AdminTab[] = ["uyeler", "faturalar", "siparisler", "urunler", "jeton"];
const STATUSES = ["approved", "pending", "failed", "rejected", "refunded"] as const;

export default async function AdminPage({ params, searchParams }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 1) Giriş zorunlu.
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris?next=/${lang}/admin`);

  // 2) Yalnız admin. Değilse sayfanın varlığını bile belli etme (404).
  if (!isAdminEmail(user.email)) notFound();

  const tr = lang === "tr";

  // 3) Service key yoksa nazik uyarı (çökme yok).
  if (!hasServiceKey()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-4 font-sans text-3xl font-extrabold">{tr ? "Yönetim" : "Admin"}</h1>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {tr
            ? "Yönetim verilerini görmek için SUPABASE_SERVICE_ROLE_KEY ortam değişkeni gerekiyor. Supabase → Settings → API → service_role anahtarını alıp Vercel'e (ve .env.local'e) ekleyin."
            : "The admin data requires the SUPABASE_SERVICE_ROLE_KEY env var. Get it from Supabase → Settings → API → service_role and add it to Vercel (and .env.local)."}
        </p>
      </div>
    );
  }

  // 4) Sekme + süzgeçler adres çubuğundan (?tab=, ?durum=, ?musteri=).
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tabParam = one(sp.tab);
  const tab: AdminTab = TABS.includes(tabParam as AdminTab) ? (tabParam as AdminTab) : "uyeler";
  const durum = one(sp.durum);
  const status = STATUSES.includes(durum as (typeof STATUSES)[number])
    ? (durum as (typeof STATUSES)[number])
    : null;
  const customerId = one(sp.musteri) ?? null;
  const memberId = one(sp.uye) ?? null;

  // Jeton hareketleri için tarih aralığı (?bas=&bit=); boşsa son 30 gün.
  const period = resolvePeriod(one(sp.bas), one(sp.bit));
  const data = await loadAdminData(period);

  return (
    <AdminConsole
      lang={lang}
      data={data}
      tab={tab}
      status={status}
      customerId={customerId}
      memberId={memberId}
      basePath={`/${lang}/admin`}
    />
  );
}
