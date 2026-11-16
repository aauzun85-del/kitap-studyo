"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import {
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/[lang]/auth-actions";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Mode = "login" | "signup";

const AUTH_CSS = `
.au { --au: #5b3fe4; --au-ink: #141827; --au-sub: #4b5365; --au-panel: #ece9fd; --au-panel-hi: rgba(255,255,255,.55); --au-line: #d9dbe6; --au-field: #fff; }
@media (prefers-color-scheme: dark) {
  .au { --au: #a78bfa; --au-ink: #f4f2ff; --au-sub: #b9b6cf; --au-panel: #211c3f; --au-panel-hi: rgba(255,255,255,.04); --au-line: #34324a; --au-field: #15141f; }
}
`;

function Field({
  id,
  label,
  type,
  placeholder,
  autoComplete = "off",
  aside,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  /** Etiketin sağındaki bağlantı (ör. "Şifreni mi unuttun?"). */
  aside?: React.ReactNode;
}) {
  const isPw = type === "password";
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-bold text-[var(--au-ink)]">
          {label}
        </label>
        {aside}
      </div>
      <span className="relative block">
        <input
          id={id}
          name={id}
          type={isPw && show ? "text" : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border border-[var(--au-line)] bg-[var(--au-field)] px-4 py-3.5 text-[15.5px] text-[var(--au-ink)] outline-none transition placeholder:text-[#9aa1b1] focus:border-[var(--au)] focus:ring-4 focus:ring-[var(--au)]/15 ${isPw ? "pr-12" : ""}`}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Şifreyi gizle / Hide password" : "Şifreyi göster / Show password"}
            aria-pressed={show}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#6b7280] transition hover:text-[var(--au-ink)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
              {show && <path d="M4 4l16 16" strokeLinecap="round" />}
            </svg>
          </button>
        )}
      </span>
    </div>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function LangSwitch({ lang, href }: { lang: Locale; href: (l: Locale) => string }) {
  return (
    <div className="flex items-center rounded-full border border-[var(--au-line)] bg-[var(--au-field)] p-1 text-[14px] font-bold">
      {(["tr", "en"] as const).map((l) => (
        <Link
          key={l}
          href={href(l)}
          aria-current={l === lang ? "true" : undefined}
          className={`rounded-full px-3.5 py-1.5 transition ${l === lang ? "bg-[var(--au)] text-white" : "text-[var(--au-sub)] hover:text-[var(--au-ink)]"}`}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export default function AuthCard({
  mode,
  lang,
  dict,
  next,
  showcase,
}: {
  mode: Mode;
  lang: Locale;
  dict: Dictionary;
  next?: string;
  /** Sağ panel (sunucuda çizilen kitap maketi). */
  showcase?: React.ReactNode;
}) {
  const t = dict.auth;
  const isSignup = mode === "signup";

  // Server action'ı dile bağla; useActionState onu (prevState, formData) ile çağırır.
  const baseAction = isSignup ? signUpAction : signInAction;
  const action = baseAction.bind(null, lang);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  // Google girişi: tarayıcıdan Supabase'e yönlendirir; dönüşte /auth/callback
  // oturumu çerezlere yazar. Supabase panelinde Google sağlayıcısı açık olmalı.
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  async function signInWithGoogle() {
    setGooglePending(true);
    setGoogleError(false);
    const supabase = createClient();
    const target = next && next.startsWith(`/${lang}/`) ? next : `/${lang}/projeler`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
      },
    });
    // Hata yoksa tarayıcı Google'a yönlenir; buraya yalnız hata durumunda düşülür.
    if (error) {
      setGooglePending(false);
      setGoogleError(true);
    }
  }

  const tr = lang === "tr";
  const selfSeg = isSignup ? "kayit" : "giris";
  const langHref = (l: Locale) => `/${l}/${selfSeg}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const legalLink = "underline underline-offset-2 hover:text-[var(--au-ink)]";

  return (
    <div className="au grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-4 lg:p-4">
      <style>{AUTH_CSS}</style>

      {/* ── Sol: form ── */}
      <section className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:min-h-0 lg:px-12 lg:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href={`/${lang}`} className="flex items-center gap-2.5 text-[var(--au-ink)]">
            <Logo className="h-10 w-10" />
            <span className="font-sans text-[26px] font-extrabold tracking-tight">{dict.brand}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/${lang}`} className="flex items-center gap-2 text-[15.5px] text-[var(--au-sub)] transition hover:text-[var(--au-ink)]">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[18px] w-[18px]" aria-hidden="true">
                <path d="M16 10H4M9 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="hidden sm:inline">{tr ? "Ana sayfaya dön" : "Back to home"}</span>
            </Link>
            <span className="lg:hidden">
              <LangSwitch lang={lang} href={langHref} />
            </span>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[440px]">
            <h1 className="m-0 font-sans text-[34px] font-extrabold leading-tight tracking-[-0.03em] text-[var(--au-ink)] sm:text-[40px]">
              {isSignup ? t.signupTitle : t.loginTitle}
            </h1>
            <p className="mt-2 text-[16.5px] text-[var(--au-sub)]">
              {isSignup ? t.signupSubtitle : tr ? "Kitabına kaldığın yerden devam et." : "Pick up your book where you left off."}
            </p>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googlePending}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--au-line)] bg-[var(--au-field)] py-3.5 text-[16px] font-bold text-[var(--au-ink)] transition hover:border-[var(--au)] disabled:opacity-60"
            >
              <GoogleG />
              {t.googleCta}
            </button>
            {googleError && (
              <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">
                {tr
                  ? "Google girişi şu an kullanılamıyor. E-posta ile devam edebilirsin."
                  : "Google sign-in is currently unavailable. You can continue with email."}
              </p>
            )}

            <div className="my-6 flex items-center gap-4 text-[15px] text-[var(--au-sub)]">
              <span className="h-px flex-1 bg-[var(--au-line)]" />
              {tr ? "veya e-posta ile" : "or with email"}
              <span className="h-px flex-1 bg-[var(--au-line)]" />
            </div>

            <form action={formAction} className="flex flex-col gap-5">
              {next && <input type="hidden" name="next" value={next} />}
              {isSignup && (
                <Field id="name" label={t.nameLabel} type="text" placeholder={t.namePlaceholder} autoComplete="name" />
              )}
              <Field
                id="email"
                label={t.emailLabel}
                type="email"
                placeholder={tr ? "E-posta adresin" : "Your email address"}
                autoComplete="email"
              />
              <Field
                id="password"
                label={t.passwordLabel}
                type="password"
                placeholder={t.passwordPlaceholder}
                autoComplete={isSignup ? "new-password" : "current-password"}
                aside={
                  !isSignup && (
                    <Link href={`/${lang}/sifre-sifirla`} className="text-[15px] font-semibold text-[var(--au)] hover:underline">
                      {t.forgot}
                    </Link>
                  )
                }
              />
              {isSignup && (
                <Field id="confirm" label={t.confirmLabel} type="password" placeholder={t.confirmPlaceholder} autoComplete="new-password" />
              )}

              <button
                type="submit"
                disabled={pending}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#5b3fe4] py-3.5 text-[16.5px] font-bold text-white shadow-[0_8px_20px_rgba(91,63,228,0.28)] transition hover:bg-[#4f34d6] disabled:opacity-60"
              >
                {pending ? "…" : isSignup ? t.signupCta : t.loginCta}
                {!pending && (
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden="true">
                    <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {isSignup && (
                <p className="text-center text-[13px] leading-relaxed text-[var(--au-sub)]">
                  {tr ? (
                    <>
                      Üye olarak{" "}
                      <Link href={`/${lang}/yasal/kullanim-kosullari`} className={legalLink}>
                        Kullanım Koşulları
                      </Link>
                      &apos;nı kabul etmiş olursun. Kişisel verilerin{" "}
                      <Link href={`/${lang}/yasal/kvkk-aydinlatma-metni`} className={legalLink}>
                        KVKK Aydınlatma Metni
                      </Link>{" "}
                      kapsamında işlenir.
                    </>
                  ) : (
                    <>
                      By signing up you accept the{" "}
                      <Link href={`/${lang}/yasal/kullanim-kosullari`} className={legalLink}>
                        Terms of Use
                      </Link>
                      . Your data is processed under our{" "}
                      <Link href={`/${lang}/yasal/kvkk-aydinlatma-metni`} className={legalLink}>
                        Personal Data Notice
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}

              {state.error && (
                <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {state.error}
                </p>
              )}
              {state.notice && (
                <p className="rounded-xl border border-green-300 bg-green-50 p-3 text-center text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                  {state.notice}
                </p>
              )}
            </form>

            <p className="mt-7 text-center text-[16px] text-[var(--au-sub)]">
              {isSignup ? t.haveAccount : t.noAccount}{" "}
              <Link href={isSignup ? `/${lang}/giris` : `/${lang}/kayit`} className="font-bold text-[var(--au)] hover:underline">
                {isSignup ? t.loginLink : t.signupLink}
              </Link>
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-[var(--au-sub)]">
          <Link href={`/${lang}/yasal/gizlilik-politikasi`} className="hover:text-[var(--au-ink)]">
            {tr ? "Gizlilik" : "Privacy"}
          </Link>
          <Link href={`/${lang}/yasal/kullanim-kosullari`} className="hover:text-[var(--au-ink)]">
            {tr ? "Kullanım koşulları" : "Terms of use"}
          </Link>
        </footer>
      </section>

      {/* ── Sağ: tanıtım paneli (yalnız geniş ekranda) ── */}
      <aside className="relative hidden flex-col overflow-hidden rounded-[28px] bg-[var(--au-panel)] px-[5%] pb-10 pt-24 lg:flex">
        <div className="absolute right-6 top-6">
          <LangSwitch lang={lang} href={langHref} />
        </div>
        {showcase}
      </aside>
    </div>
  );
}
