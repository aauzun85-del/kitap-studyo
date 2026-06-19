import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/supabase/user";
import { toShellUser } from "@/lib/app/identity";
import { signOutAction } from "@/app/[lang]/auth-actions";
import Dashboard from "@/components/app/Dashboard";

export default async function ProjelerPage({ params }: PageProps<"/[lang]/projeler">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const shellUser = toShellUser(user)!;

  return <Dashboard lang={lang} user={shellUser} signOut={signOutAction.bind(null, lang)} />;
}
