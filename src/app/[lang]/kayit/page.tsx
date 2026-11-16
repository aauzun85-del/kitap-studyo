import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import AuthCard from "@/components/AuthCard";
import AuthShowcase from "@/components/auth/AuthShowcase";

export default async function SignupPage({ params }: PageProps<"/[lang]/kayit">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return <AuthCard mode="signup" lang={lang} dict={dict} showcase={<AuthShowcase lang={lang} />} />;
}
