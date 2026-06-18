import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import TanitimStudio from "@/components/promo/TanitimStudio";

export default async function TanitimPage({ params, searchParams }: PageProps<"/[lang]/tanitim">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  // Tanıtım sayfası korumalı DEĞİL. ?project ancak giriş yapan kullanıcı için
  // ve satır bulunursa yüklenir; aksi halde anonim mod (yumuşak düşüş).
  const sp = await searchParams;
  let initialProject;
  if (sp.project) {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createClient();
      initialProject = await loadInitialProject(supabase, sp.project);
    }
  }

  return (
    <TanitimStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
