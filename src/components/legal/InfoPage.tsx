import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { LEGAL_DOCS } from "@/lib/legal/documents";
import { LEGAL_UPDATED } from "@/lib/legal/company";
import { linkFor } from "./LegalText";

// Kurumsal ve yasal sayfaların ortak çatısı: solda başlık + metin,
// sağda (mobilde altta) tüm kurumsal/yasal sayfaların listesi.
export default function InfoPage({
  lang,
  current,
  title,
  intro,
  showUpdated = true,
  children,
}: {
  lang: Locale;
  current: string;
  title: string;
  intro?: ReactNode;
  showUpdated?: boolean;
  children: ReactNode;
}) {
  const tr = lang === "tr";
  const groups = [
    {
      label: tr ? "Kurumsal" : "Company",
      items: ["hakkimizda", "fiyatlar", "iletisim", "islem-rehberi"],
    },
    {
      label: tr ? "Yasal" : "Legal",
      items: LEGAL_DOCS.map((d) => d.slug),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <article className="min-w-0 max-w-3xl">
          <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {showUpdated && (
            <p className="mt-2 font-mono text-xs text-muted">
              {tr ? "Son güncelleme" : "Last updated"}: {LEGAL_UPDATED[lang]}
            </p>
          )}
          {intro && <div className="mt-5 text-base leading-relaxed text-foreground/80">{intro}</div>}
          <div className="mt-8">{children}</div>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          {groups.map((g) => (
            <nav key={g.label} className="mb-6">
              <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                {g.label}
              </div>
              <ul className="space-y-1 text-sm">
                {g.items.map((slug) => {
                  const l = linkFor(slug, lang);
                  if (!l) return null;
                  const active = slug === current;
                  return (
                    <li key={slug}>
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={`block rounded-md px-2 py-1 transition ${
                          active
                            ? "bg-accent-soft font-semibold text-accent"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </aside>
      </div>
    </div>
  );
}
