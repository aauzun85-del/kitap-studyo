import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import Checkout from "@/components/marketing/Checkout";
import { getCurrentUser } from "@/lib/supabase/user";
import { getMyPendingCardOrder } from "@/lib/credits/orders";
import { isAdminEmail } from "@/lib/admin";
import { shopierOpenFor } from "@/lib/server/shopier";
import { TEST_PACKAGE_ID, shopierProductFor } from "@/lib/credits/shopier";

export async function generateMetadata({ params }: PageProps<"/[lang]/satin-al">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Checkout" : "Satın al" };
}

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[lang]/satin-al">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const sp = await searchParams;
  let paket = typeof sp.paket === "string" ? sp.paket : undefined;

  // Sayfa herkese açık kalır (adımlar girişsiz de görülür); kartla ödeme için
  // gereken bilgiler yalnız giriş yapmış üyeye hesaplanır.
  const user = await getCurrentUser();
  const isAdmin = isAdminEmail(user?.email);
  // Gizli deneme paketi yalnız yöneticiye açılır; başkası için böyle bir paket
  // yoktur (bilinmeyen paket adı gibi davranır → varsayılan paket seçilir).
  if (paket === TEST_PACKAGE_ID && !isAdmin) paket = undefined;

  const cardReady = shopierOpenFor(isAdmin);

  // Üyenin ödeme bekleyen kart siparişi varsa "Ödemeni bekliyoruz" ekranı sayfa
  // yenilense ya da telefonda sekme değişse de geri gelsin. Adreste kartla
  // alınabilen bir paket yazıyorsa yalnız o pakete bakılır.
  let resume: { orderId: string; packageId: string } | null = null;
  if (user && cardReady) {
    const row = await getMyPendingCardOrder(paket);
    if (row && shopierProductFor(row.packageId) && (row.packageId !== TEST_PACKAGE_ID || isAdmin)) resume = row;
  }

  return (
    <Checkout
      lang={lang}
      initialId={paket}
      cardReady={cardReady}
      allowTest={isAdmin && paket === TEST_PACKAGE_ID}
      loggedIn={!!user}
      email={user?.email ?? null}
      emailConfirmed={!!user?.email_confirmed_at}
      resume={resume}
    />
  );
}
