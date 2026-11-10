import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import Checkout from "@/components/marketing/Checkout";

export async function generateMetadata({ params }: PageProps<"/[lang]/satin-al">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Checkout" : "Satın al" };
}

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[lang]/satin-al">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  const paket = typeof sp.paket === "string" ? sp.paket : undefined;
  return <Checkout lang={lang} initialId={paket} />;
}
