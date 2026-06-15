import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { migrateEnvelope, type ProjectEnvelope } from "@/lib/projects/types";
import CoverStudio from "@/components/cover/CoverStudio";

export default async function CoverPage({ params, searchParams }: PageProps<"/[lang]/kapak">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş gerekli (proxy de korur — bu ikinci güvenlik katmanı).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);

  // ?project=<id> verildiyse o projeyi sunucuda getir (RLS sahipliği garanti eder)
  // ve CoverStudio'ya başlangıç verisi olarak geç. Bulunamazsa anonim moda düş.
  const sp = await searchParams;
  const projectId = typeof sp.project === "string" ? sp.project : undefined;
  let initialProject: { id: string; data: ProjectEnvelope } | undefined;
  if (projectId) {
    const { data } = await supabase
      .from("projects")
      .select("data")
      .eq("id", projectId)
      .single();
    if (data) {
      initialProject = { id: projectId, data: migrateEnvelope(data.data) };
    }
  }

  return (
    <CoverStudio
      key={initialProject?.id ?? "anon"}
      lang={lang}
      dict={dict}
      initialProject={initialProject}
    />
  );
}
