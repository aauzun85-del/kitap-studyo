import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import SesliKitapStudio from "@/components/publish/SesliKitapStudio";

export default async function SesliKitapPage({ params }: PageProps<"/[lang]/sesli-kitap">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <SesliKitapStudio lang={lang} dict={dict} />;
}
