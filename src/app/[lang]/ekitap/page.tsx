import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import EkitapStudio from "@/components/publish/EkitapStudio";

export default async function EkitapPage({ params, searchParams }: PageProps<"/[lang]/ekitap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);

  return (
    <EkitapStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
