import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell, { type AppShellContext } from "@/components/app/AppShell";
import TanitimStudio from "@/components/promo/TanitimStudio";

export default async function TanitimPage({ params, searchParams }: PageProps<"/[lang]/tanitim">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const isTr = lang === "tr";

  // Tanıtım sayfası korumalı DEĞİL. ?project ancak giriş yapan kullanıcı için
  // ve satır bulunursa yüklenir; aksi halde anonim mod (yumuşak düşüş).
  const sp = await searchParams;
  const user = await getCurrentUser();
  let initialProject;
  if (sp.project && user) {
    const supabase = await createClient();
    initialProject = await loadInitialProject(supabase, sp.project);
  }

  const shellUser = toShellUser(user);
  const meta = initialProject?.data.meta;
  const context: AppShellContext = {
    backHref: user ? `/${lang}/projeler` : `/${lang}`,
    backLabel: user ? (isTr ? "Kitaplarım" : "My Books") : (isTr ? "Ana sayfa" : "Home"),
    title: meta?.title?.trim() || (isTr ? "Tanıtım çalışması" : "Promo draft"),
    meta:
      meta?.author?.trim() ||
      (user ? undefined : isTr ? "Anonim — giriş yaparak kaydet" : "Anonymous — sign in to save"),
    moduleLabel: isTr ? "Tanıtım modülü" : "Promo module",
    savedLabel: initialProject ? (isTr ? "Otomatik kaydedilir" : "Auto-saved") : undefined,
  };

  return (
    <AppShell
      lang={lang}
      user={shellUser}
      signOut={user ? signOutAction.bind(null, lang) : undefined}
      active="tanitim"
      context={context}
    >
      <TanitimStudio
        key={initialProject?.id ?? "anon"}
        lang={lang}
        dict={dict}
        initialProject={initialProject}
      />
    </AppShell>
  );
}
