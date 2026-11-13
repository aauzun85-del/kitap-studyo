import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getBalanceById, hasActivePackageById } from "@/lib/credits/server";
import { isAdminEmail } from "@/lib/admin";
import { getSidebarPref } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell, { type AppShellContext } from "@/components/app/AppShell";
import WizardBar from "@/components/app/WizardBar";
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
  // Tuval sayfası: kullanıcı açıkça seçmediyse menü DARALTILMIŞ başlar (geniş alan).
  const collapsed = (await getSidebarPref()) ?? true;
  const canExport = await hasActivePackageById(user.id, user.email);
  // Jeton bakiyesi (anlık görüntü) — sihirbazın "kapak üretelim mi?" kartı için.
  // Yönetici jeton harcamaz → null (sınırsız).
  const creditBalance = isAdminEmail(user.email) ? null : await getBalanceById(user.id);

  const meta = initialProject?.data.meta;
  const context: AppShellContext = {
    backHref: `/${lang}/projeler`,
    backLabel: isTr ? "Kitaplarım" : "My Books",
    title: meta?.title?.trim() || (isTr ? "Kapak çalışması" : "Cover draft"),
    meta: meta?.author?.trim() || undefined,
    moduleLabel: isTr ? "Kapak modülü" : "Cover module",
    savedLabel: initialProject ? (isTr ? "Otomatik kaydedilir" : "Auto-saved") : undefined,
  };

  // İndirme ekranından "?export=1" ile gelindi → Kapak PDF'ini otomatik üret
  // (kapak yeniden ÜRETİLMEZ, sadece mevcut tasarım PDF'e basılır).
  const exportMode = sp.export === "1";
  const wizard = initialProject?.data.wizard;
  // KAPAK KURGUSU: sihirbazda kapak henüz yoksa ve kurgu hiç yapılmadıysa önce
  // soru-cevap adımına git. ?kurgu=1 → kurgudan geldi (otomatik üret);
  // ?kurgu=0 → kullanıcı kurguyu atladı (tuval boş açılır).
  const briefParam = typeof sp.kurgu === "string" ? sp.kurgu : undefined;
  if (
    initialProject &&
    wizard?.active &&
    !exportMode &&
    briefParam === undefined &&
    !initialProject.data.cover.coverImage &&
    !initialProject.data.cover.brief
  ) {
    redirect(`/${lang}/kapak/kurgu?project=${initialProject.id}`);
  }
  const briefRun = briefParam === "1";
  const wizardBar =
    initialProject && wizard?.active && !exportMode ? (
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
      fitContent
      defaultCollapsed={collapsed}
    >
      <CoverStudio
        key={initialProject?.id ?? "anon"}
        lang={lang}
        dict={dict}
        initialProject={initialProject}
        wizardAuto={!!wizard?.active && !exportMode}
        autoExport={exportMode}
        briefRun={briefRun}
        canExport={canExport}
        creditBalance={creditBalance}
      />
    </AppShell>
  );
}
