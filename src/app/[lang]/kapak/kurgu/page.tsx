import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getSidebarPref } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell, { type AppShellContext } from "@/components/app/AppShell";
import WizardBar from "@/components/app/WizardBar";
import CoverBriefStudio from "@/components/cover/CoverBriefStudio";

// Kapak kurgusu: tuvalden önceki seçim adımı. Proje şart (seçimler projeye yazılır).
export default async function CoverBriefPage({ params, searchParams }: PageProps<"/[lang]/kapak/kurgu">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const isTr = lang === "tr";
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  if (!initialProject) redirect(`/${lang}/projeler`);
  const collapsed = (await getSidebarPref()) ?? true;

  const meta = initialProject.data.meta;
  const context: AppShellContext = {
    backHref: `/${lang}/projeler`,
    backLabel: isTr ? "Kitaplarım" : "My Books",
    title: meta.title?.trim() || (isTr ? "Kapak çalışması" : "Cover draft"),
    meta: meta.author?.trim() || undefined,
    moduleLabel: isTr ? "Kapak kurgusu" : "Cover brief",
  };

  const wizard = initialProject.data.wizard;
  const wizardBar = wizard?.active ? (
    <WizardBar
      lang={lang}
      projectId={initialProject.id}
      current="cover"
      wizard={wizard}
      backHref={`/${lang}/projeler`}
      backLabel={isTr ? "Kitaplarım" : "My Books"}
    />
  ) : undefined;

  return (
    <AppShell
      lang={lang}
      user={await toShellUser(user)}
      signOut={signOutAction.bind(null, lang)}
      active="kapak"
      context={context}
      wizardBar={wizardBar}
      defaultCollapsed={collapsed}
    >
      <CoverBriefStudio
        lang={lang}
        projectId={initialProject.id}
        initial={initialProject.data.cover.brief}
        title={meta.title ?? ""}
        author={meta.author ?? ""}
        genre={meta.genre ?? undefined}
      />
    </AppShell>
  );
}
