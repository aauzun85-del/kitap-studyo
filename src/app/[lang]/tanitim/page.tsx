import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import TanitimStudio from "@/components/promo/TanitimStudio";

export default async function TanitimPage({ params }: PageProps<"/[lang]/tanitim">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <TanitimStudio lang={lang} dict={dict} />;
}
