import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/supabase/user";
import { toShellUser } from "@/lib/app/identity";
import { getSidebarCollapsed } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell from "@/components/app/AppShell";
import JetonStudio from "@/components/credits/JetonStudio";
import { getMyLedger, getMyLots, getMyOrders } from "@/lib/credits/orders";
import { isAdminEmail } from "@/lib/admin";
import { getBalanceById } from "@/lib/credits/server";

export default async function JetonlarPage({
  params,
}: PageProps<"/[lang]/jetonlar">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Hesap sayfası giriş ister.
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris?next=/${lang}/jetonlar`);

  const shellUser = await toShellUser(user);
  const collapsed = await getSidebarCollapsed();
  const admin = isAdminEmail(user.email);
  const [balance, lots, ledger, orders] = await Promise.all([
    admin ? Promise.resolve(null) : getBalanceById(user.id),
    getMyLots(),
    getMyLedger(),
    getMyOrders(),
  ]);
  // Aktif paketin bitişi: en geç biten "purchase" partisi.
  const packageUntil =
    lots
      .filter((l) => l.source === "purchase" && l.expires_at)
      .map((l) => l.expires_at as string)
      .sort()
      .pop() ?? null;

  return (
    <AppShell
      lang={lang}
      user={shellUser}
      signOut={signOutAction.bind(null, lang)}
      defaultCollapsed={collapsed}
    >
      <JetonStudio
        lang={lang}
        balance={balance}
        packageUntil={packageUntil}
        lots={lots}
        ledger={ledger}
        orders={orders}
      />
    </AppShell>
  );
}
