import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { loadInitialProject } from "@/lib/projects/server";
import LayoutStudio from "@/components/layout/LayoutStudio";

export default async function LayoutPage({ params, searchParams }: PageProps<"/[lang]/mizanpaj">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  const sp = await searchParams;
  const initialProject = await loadInitialProject(supabase, sp.project);

  return (
    <LayoutStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
