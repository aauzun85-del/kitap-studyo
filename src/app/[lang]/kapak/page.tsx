import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import CoverStudio from "@/components/cover/CoverStudio";

export default async function CoverPage({ params }: PageProps<"/[lang]/kapak">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <CoverStudio lang={lang} dict={dict} />;
}
