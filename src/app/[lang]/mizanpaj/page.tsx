import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getSidebarCollapsed } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell, { type AppShellContext } from "@/components/app/AppShell";
import LayoutStudio from "@/components/layout/LayoutStudio";

export default async function LayoutPage({ params, searchParams }: PageProps<"/[lang]/mizanpaj">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const isTr = lang === "tr";
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const collapsed = await getSidebarCollapsed();

  const meta = initialProject?.data.meta;
  const context: AppShellContext = {
    backHref: `/${lang}/projeler`,
    backLabel: isTr ? "Kitaplarım" : "My Books",
    title: meta?.title?.trim() || (isTr ? "Mizanpaj çalışması" : "Layout draft"),
    meta: meta?.author?.trim() || undefined,
    moduleLabel: isTr ? "Mizanpaj modülü" : "Layout module",
    savedLabel: initialProject ? (isTr ? "Otomatik kaydedilir" : "Auto-saved") : undefined,
  };

  return (
    <AppShell
      lang={lang}
      user={toShellUser(user)}
      signOut={signOutAction.bind(null, lang)}
      active="mizanpaj"
      context={context}
      defaultCollapsed={collapsed}
    >
      <LayoutStudio
        key={initialProject?.id ?? "anon"}
        lang={lang}
        dict={dict}
        initialProject={initialProject}
      />
    </AppShell>
  );
}
