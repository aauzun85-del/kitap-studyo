import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import ResetCard from "@/components/ResetCard";

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[lang]/sifre-sifirla">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <ResetCard mode="request" lang={lang} dict={dict} />;
}
