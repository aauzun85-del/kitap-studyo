import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { getCurrentUser } from "@/lib/supabase/user";
import { isAdminEmail } from "@/lib/admin";
import { signOutAction } from "@/app/[lang]/auth-actions";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export default async function SiteHeader({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const user = await getCurrentUser();
  const links = [
    { href: `/${lang}`, label: dict.nav.home },
    { href: `/${lang}/kapak`, label: dict.nav.cover },
    { href: `/${lang}/mizanpaj`, label: dict.nav.layout },
    { href: `/${lang}/editor`, label: dict.nav.editor },
    { href: `/${lang}/ekitap`, label: dict.nav.publish },
    { href: `/${lang}/sesli-kitap`, label: dict.nav.audiobook },
    { href: `/${lang}/tanitim`, label: dict.nav.promo },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={`/${lang}`} className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-accent), #7c3aed)" }}
          >
            t
          </span>
          <span className="font-sans text-xl font-extrabold lowercase tracking-tight">
            {dict.brand}
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href={`/${lang}/projeler`}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent-soft"
              >
                {dict.nav.projects}
              </Link>
              {isAdminEmail(user.email) && (
                <Link
                  href={`/${lang}/admin`}
                  className="hidden rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-foreground sm:block"
                >
                  {lang === "tr" ? "Yönetim" : "Admin"}
                </Link>
              )}
              <span
                title={dict.auth.loggedInAs}
                className="hidden max-w-[160px] truncate text-sm font-medium text-muted sm:block"
              >
                {user.email}
              </span>
              <form action={signOutAction.bind(null, lang)}>
                <button
                  type="submit"
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
                >
                  {dict.auth.signOut}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href={`/${lang}/giris`}
                className="hidden text-sm font-medium text-muted transition hover:text-foreground sm:block"
              >
                {dict.nav.login}
              </Link>
              <Link
                href={`/${lang}/kayit`}
                className="rounded-full px-5 py-2 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)",
                  boxShadow:
                    "0 2px 10px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                }}
              >
                {dict.nav.signup}
              </Link>
            </>
          )}
          <LanguageSwitcher current={lang} />
        </div>
      </div>
    </header>
  );
}
