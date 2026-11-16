import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/supabase/user";
import Landing from "@/components/landing/Landing";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş yapmış kullanıcı siteye girince pazarlama sayfası yerine doğrudan
  // Pano'ya (kontrol paneli + Kitap Tasarım Sihirbazı) gider.
  const user = await getCurrentUser();
  if (user) redirect(`/${lang}/projeler`);

  return <Landing lang={lang} />;
}
