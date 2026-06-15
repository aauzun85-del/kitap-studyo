import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import EkitapStudio from "@/components/publish/EkitapStudio";

export default async function EkitapPage({ params }: PageProps<"/[lang]/ekitap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <EkitapStudio lang={lang} dict={dict} />;
}
