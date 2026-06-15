import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import LayoutStudio from "@/components/layout/LayoutStudio";

export default async function LayoutPage({ params }: PageProps<"/[lang]/mizanpaj">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <LayoutStudio lang={lang} dict={dict} />;
}
