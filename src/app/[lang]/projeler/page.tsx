import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/supabase/user";
import ProjelerList from "@/components/projects/ProjelerList";

export default async function ProjelerPage({ params }: PageProps<"/[lang]/projeler">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const dict = getDictionary(lang);
  return <ProjelerList lang={lang} dict={dict} />;
}
