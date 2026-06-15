import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import AuthCard from "@/components/AuthCard";

export default async function LoginPage({ params, searchParams }: PageProps<"/[lang]/giris">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <AuthCard mode="login" lang={lang} dict={dict} next={next} />;
}
