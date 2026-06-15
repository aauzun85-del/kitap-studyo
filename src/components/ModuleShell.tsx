import Link from "next/link";
import { CheckCircleIcon } from "./PhosphorIcons";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type ModuleKey = "cover" | "layout" | "editor";

export default function ModuleShell({
  lang,
  dict,
  moduleKey,
}: {
  lang: Locale;
  dict: Dictionary;
  moduleKey: ModuleKey;
}) {
  const copy = dict.modules[moduleKey];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link
        href={`/${lang}`}
        className="text-sm font-medium text-muted transition hover:text-foreground"
      >
        ← {dict.common.back}
      </Link>

      <span className="mt-6 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent">
        {copy.tagline}
      </span>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="font-sans text-4xl font-extrabold tracking-tight">{copy.title}</h1>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-xs font-medium uppercase text-accent">
          {dict.common.comingSoon}
        </span>
      </div>
      <p className="mt-4 text-lg text-muted">{copy.description}</p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {copy.features.map((feature, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-4 text-sm text-foreground/80"
          >
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
        {copy.status}
      </div>
    </div>
  );
}
