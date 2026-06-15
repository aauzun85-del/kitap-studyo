import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import CoverStudio from "@/components/cover/CoverStudio";

export default async function CoverPage({ params }: PageProps<"/[lang]/kapak">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş gerekli (proxy de korur — bu ikinci güvenlik katmanı).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  return <CoverStudio lang={lang} dict={dict} />;
}
