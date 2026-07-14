"use client";

import { useActionState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { EnvelopeIcon, LockIcon } from "./PhosphorIcons";
import {
  resetRequestAction,
  updatePasswordAction,
  type AuthState,
} from "@/app/[lang]/auth-actions";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

// "request" = e-posta yazıp sıfırlama bağlantısı isteme sayfası,
// "update"  = e-postadaki bağlantıdan gelinen, yeni şifre belirleme sayfası.
type Mode = "request" | "update";

function Field({
  id,
  label,
  type,
  placeholder,
  icon,
  autoComplete = "off",
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground/80">
        {label}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </span>
    </label>
  );
}

export default function ResetCard({
  mode,
  lang,
  dict,
}: {
  mode: Mode;
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.auth;
  const isRequest = mode === "request";

  const baseAction = isRequest ? resetRequestAction : updatePasswordAction;
  const action = baseAction.bind(null, lang);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Link href={`/${lang}`} className="mx-auto mb-6 flex items-center gap-2">
        <Logo className="h-8 w-8" />
        <span className="font-sans text-xl font-extrabold tracking-tight">
          {dict.brand}
        </span>
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <h1 className="font-sans text-2xl font-extrabold">
          {isRequest ? t.forgotTitle : t.newPassTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isRequest ? t.forgotSubtitle : t.newPassSubtitle}
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          {isRequest ? (
            <Field
              id="email"
              label={t.emailLabel}
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              icon={<EnvelopeIcon className="h-4 w-4" />}
            />
          ) : (
            <>
              <Field
                id="password"
                label={t.passwordLabel}
                type="password"
                placeholder={t.passwordPlaceholder}
                autoComplete="new-password"
                icon={<LockIcon className="h-4 w-4" />}
              />
              <Field
                id="confirm"
                label={t.confirmLabel}
                type="password"
                placeholder={t.confirmPlaceholder}
                autoComplete="new-password"
                icon={<LockIcon className="h-4 w-4" />}
              />
            </>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "…" : isRequest ? t.forgotCta : t.newPassCta}
          </button>

          {state.error && (
            <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </p>
          )}
          {state.notice && (
            <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-center text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              {state.notice}
            </p>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link
            href={`/${lang}/giris`}
            className="font-semibold text-accent hover:underline"
          >
            {t.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
