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
import EditorStudio from "@/components/editor/EditorStudio";

export default async function EditorPage({ params, searchParams }: PageProps<"/[lang]/editor">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const canExport = await hasActivePackageById(user.id, user.email);
  // Jeton bakiyesi: editör, incelemeye başlamadan önce bedeli bununla kıyaslar.
  // Yönetici jeton harcamaz → null (sınırsız).
  const creditBalance = isAdminEmail(user.email) ? null : await getBalanceById(user.id);
  const shellUser = await toShellUser(user);

  // Tam ekran düzenleyici: kendi üst çubuğu var (marka, Kitaplarım, kayıt durumu,
  // adımlar, geri al, Word indir, Metni incele, hesap) → uygulama menüsü yok.
  return (
    <EditorStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
      canExport={canExport}
      creditBalance={creditBalance}
      user={shellUser ? { name: shellUser.name, initials: shellUser.initials } : null}
      signOut={signOutAction.bind(null, lang)}
    />
  );
}
