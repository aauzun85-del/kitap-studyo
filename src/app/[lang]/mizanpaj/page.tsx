import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { hasActivePackageById } from "@/lib/credits/server";
import { signOutAction } from "@/app/[lang]/auth-actions";
import LayoutStudio from "@/components/layout/LayoutStudio";

export default async function LayoutPage({ params, searchParams }: PageProps<"/[lang]/mizanpaj">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const canExport = await hasActivePackageById(user.id, user.email);
  // İndirme ekranından "?export=1" ile gelindi → İç sayfa PDF'ini otomatik üret.
  const exportMode = sp.export === "1";
  const shellUser = await toShellUser(user);

  // Tam ekran düzenleyici: kendi üst çubuğu var (marka, Kitaplarım, kayıt durumu,
  // geri al, Baskı denetimi, PDF indir, hesap) → uygulama menüsü/sihirbaz çubuğu yok.
  return (
    <LayoutStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
      autoExport={exportMode}
      canExport={canExport}
      user={shellUser ? { name: shellUser.name, initials: shellUser.initials } : null}
      signOut={signOutAction.bind(null, lang)}
    />
  );
}
