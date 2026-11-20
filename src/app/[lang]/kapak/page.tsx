import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getBalanceById, hasActivePackageById } from "@/lib/credits/server";
import { isAdminEmail } from "@/lib/admin";
import { signOutAction } from "@/app/[lang]/auth-actions";
import CoverStudio from "@/components/cover/CoverStudio";

export default async function CoverPage({ params, searchParams }: PageProps<"/[lang]/kapak">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş gerekli (proxy de korur — bu ikinci güvenlik katmanı).
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const canExport = await hasActivePackageById(user.id, user.email);
  // Jeton bakiyesi (anlık görüntü) — sihirbazın "kapak üretelim mi?" kartı için.
  // Yönetici jeton harcamaz → null (sınırsız).
  const creditBalance = isAdminEmail(user.email) ? null : await getBalanceById(user.id);

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
  const shellUser = await toShellUser(user);

  // Tam ekran düzenleyici: kendi üst çubuğu var (marka, Kitaplarım, kayıt
  // durumu, geri al, Önizleme, İndir, hesap) → uygulama menüsü/sihirbaz çubuğu yok.
  return (
    <CoverStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
      wizardAuto={!!wizard?.active && !exportMode}
      autoExport={exportMode}
      briefRun={briefRun}
      fromBrief={briefParam !== undefined && !exportMode}
      canExport={canExport}
      creditBalance={creditBalance}
      user={shellUser ? { name: shellUser.name, initials: shellUser.initials } : null}
      signOut={signOutAction.bind(null, lang)}
      startPreview={sp.onizle === "1" && !exportMode}
    />
  );
}
