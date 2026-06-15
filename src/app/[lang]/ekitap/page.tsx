import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import EkitapStudio from "@/components/publish/EkitapStudio";

export default async function EkitapPage({ params }: PageProps<"/[lang]/ekitap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  return <EkitapStudio lang={lang} dict={dict} />;
}
