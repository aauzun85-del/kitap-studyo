import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import SesliKitapStudio from "@/components/publish/SesliKitapStudio";

export default async function SesliKitapPage({ params }: PageProps<"/[lang]/sesli-kitap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  return <SesliKitapStudio lang={lang} dict={dict} />;
}
