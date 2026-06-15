"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { EnvelopeIcon, LockIcon, UserIcon } from "./PhosphorIcons";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Mode = "login" | "signup";

function Field({
  id,
  label,
  type,
  placeholder,
  icon,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  icon: React.ReactNode;
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
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </span>
    </label>
  );
}

export default function AuthCard({
  mode,
  lang,
  dict,
}: {
  mode: Mode;
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.auth;
  const [submitted, setSubmitted] = useState(false);

  const isSignup = mode === "signup";

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
          {isSignup ? t.signupTitle : t.loginTitle}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isSignup ? t.signupSubtitle : t.loginSubtitle}
        </p>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          {isSignup && (
            <Field
              id="name"
              label={t.nameLabel}
              type="text"
              placeholder={t.namePlaceholder}
              icon={<UserIcon className="h-4 w-4" />}
            />
          )}
          <Field
            id="email"
            label={t.emailLabel}
            type="email"
            placeholder={t.emailPlaceholder}
            icon={<EnvelopeIcon className="h-4 w-4" />}
          />
          <Field
            id="password"
            label={t.passwordLabel}
            type="password"
            placeholder={t.passwordPlaceholder}
            icon={<LockIcon className="h-4 w-4" />}
          />
          {isSignup && (
            <Field
              id="confirm"
              label={t.confirmLabel}
              type="password"
              placeholder={t.confirmPlaceholder}
              icon={<LockIcon className="h-4 w-4" />}
            />
          )}

          {!isSignup && (
            <div className="text-right">
              <span className="cursor-not-allowed text-sm font-medium text-accent/70">
                {t.forgot}
              </span>
            </div>
          )}

          <button
            type="submit"
            className="mt-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {isSignup ? t.signupCta : t.loginCta}
          </button>

          {submitted && (
            <p className="rounded-lg border border-dashed border-border bg-accent-soft/50 p-3 text-center text-xs text-muted">
              {t.notConnected}
            </p>
          )}
        </form>

        <div className="my-5 flex items-center gap-3 text-xs uppercase text-muted">
          <span className="h-px flex-1 bg-border" />
          {t.orContinue}
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-sm font-semibold transition hover:border-foreground/30"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          {t.googleCta}
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? t.haveAccount : t.noAccount}{" "}
          <Link
            href={isSignup ? `/${lang}/giris` : `/${lang}/kayit`}
            className="font-semibold text-accent hover:underline"
          >
            {isSignup ? t.loginLink : t.signupLink}
          </Link>
        </p>
      </div>

      {isSignup && (
        <p className="mt-4 text-center text-xs text-muted/80">{t.terms}</p>
      )}
    </div>
  );
}
