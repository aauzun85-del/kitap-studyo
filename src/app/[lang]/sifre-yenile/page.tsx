import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import ResetCard from "@/components/ResetCard";

export default async function NewPasswordPage({
  params,
}: PageProps<"/[lang]/sifre-yenile">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <ResetCard mode="update" lang={lang} dict={dict} />;
}
