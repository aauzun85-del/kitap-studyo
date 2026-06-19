import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell, { type AppShellContext } from "@/components/app/AppShell";
import CoverStudio from "@/components/cover/CoverStudio";

export default async function CoverPage({ params, searchParams }: PageProps<"/[lang]/kapak">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş gerekli (proxy de korur — bu ikinci güvenlik katmanı).
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const isTr = lang === "tr";
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);

  const meta = initialProject?.data.meta;
  const context: AppShellContext = {
    backHref: `/${lang}/projeler`,
    backLabel: isTr ? "Kitaplarım" : "My Books",
    title: meta?.title?.trim() || (isTr ? "Kapak çalışması" : "Cover draft"),
    meta: meta?.author?.trim() || undefined,
    moduleLabel: isTr ? "Kapak modülü" : "Cover module",
    savedLabel: initialProject ? (isTr ? "Otomatik kaydedilir" : "Auto-saved") : undefined,
  };

  return (
    <AppShell
      lang={lang}
      user={toShellUser(user)}
      signOut={signOutAction.bind(null, lang)}
      active="kapak"
      context={context}
      fitContent
    >
      <CoverStudio
        key={initialProject?.id ?? "anon"}
        lang={lang}
        dict={dict}
        initialProject={initialProject}
      />
    </AppShell>
  );
}
