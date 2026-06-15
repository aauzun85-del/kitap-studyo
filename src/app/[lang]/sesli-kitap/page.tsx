import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { loadInitialProject } from "@/lib/projects/server";
import SesliKitapStudio from "@/components/publish/SesliKitapStudio";

export default async function SesliKitapPage({ params, searchParams }: PageProps<"/[lang]/sesli-kitap">) {
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
    <SesliKitapStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
