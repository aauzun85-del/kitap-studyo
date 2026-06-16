import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // 1) Giriş zorunlu.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris?next=/${lang}/admin`);

  // 2) Yalnız admin. Değilse sayfanın varlığını bile belli etme (404).
  if (!isAdminEmail(user.email)) notFound();

  const tr = lang === "tr";
  const t = {
    heading: tr ? "Üyeler" : "Members",
    total: tr ? "Toplam üye" : "Total members",
    no: "#",
    email: tr ? "E-posta" : "Email",
    joined: tr ? "Kayıt tarihi" : "Joined",
    lastSeen: tr ? "Son giriş" : "Last sign-in",
    projects: tr ? "Proje" : "Projects",
    never: tr ? "—" : "—",
    noKey: tr
      ? "Üye listesini görmek için SUPABASE_SERVICE_ROLE_KEY ortam değişkeni gerekiyor. Supabase → Settings → API → service_role anahtarını alıp Vercel'e (ve .env.local'e) ekleyin."
      : "Listing members requires the SUPABASE_SERVICE_ROLE_KEY env var. Get it from Supabase → Settings → API → service_role and add it to Vercel (and .env.local).",
    empty: tr ? "Henüz üye yok." : "No members yet.",
  };

  // 3) Service key yoksa nazik uyarı (çökme yok).
  if (!hasServiceKey()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="mb-4 font-sans text-3xl font-extrabold">{t.heading}</h1>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {t.noKey}
        </p>
      </div>
    );
  }

  // 4) Tüm üyeleri + proje sayılarını getir (service-role; RLS atlanır).
  const admin = createAdminClient();
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = (usersData?.users ?? []).slice().sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  const { data: projRows } = await admin.from("projects").select("user_id");
  const counts = new Map<string, number>();
  for (const r of (projRows ?? []) as { user_id: string }[]) {
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(tr ? "tr-TR" : "en-US") : t.never;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-sans text-3xl font-extrabold">{t.heading}</h1>
        <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-sm font-semibold text-accent">
          {t.total}: {users.length}
        </span>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-semibold">{t.no}</th>
                <th className="px-4 py-3 font-semibold">{t.email}</th>
                <th className="px-4 py-3 font-semibold">{t.joined}</th>
                <th className="px-4 py-3 font-semibold">{t.lastSeen}</th>
                <th className="px-4 py-3 text-right font-semibold">{t.projects}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-background"
                >
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-muted">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-muted">{fmt(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {counts.get(u.id) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
