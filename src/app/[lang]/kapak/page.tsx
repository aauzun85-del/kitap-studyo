import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
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

  return (
    <CoverStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
