"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/config";

type Labels = {
  projects: string;
  cover: string;
  layout: string;
  editor: string;
  publish: string;
  audiobook: string;
  promo: string;
};

// Bir proje açıkken (?project=<id>) tüm araç sayfalarında görünen ince çubuk:
// projeyi koruyarak modüller arasında geçiş + Projelerim'e dönüş. Proje yoksa
// hiçbir şey çizmez (anonim/normal kullanımda görünmez).
function Bar({ lang, labels }: { lang: Locale; labels: Labels }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const project = searchParams.get("project");
  if (!project) return null;

  const seg = pathname.split("/")[2] ?? "";
  const mods = [
    { seg: "mizanpaj", label: labels.layout },
    { seg: "editor", label: labels.editor },
    { seg: "kapak", label: labels.cover },
    { seg: "ekitap", label: labels.publish },
    { seg: "sesli-kitap", label: labels.audiobook },
    { seg: "tanitim", label: labels.promo },
  ];

  return (
    <div className="sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-border bg-surface/95 px-3 py-1.5 backdrop-blur">
      <Link
        href={`/${lang}/projeler`}
        className="mr-1 flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-muted transition hover:text-foreground"
      >
        ← {labels.projects}
      </Link>
      <span className="mr-1 h-4 w-px flex-shrink-0 bg-border" />
      {mods.map((m) => {
        const active = seg === m.seg;
        return (
          <Link
            key={m.seg}
            href={`/${lang}/${m.seg}?project=${project}`}
            className={
              "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition " +
              (active
                ? "bg-accent text-white"
                : "text-muted hover:bg-accent-soft hover:text-accent")
            }
          >
            {m.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function ProjectBar({ lang, labels }: { lang: Locale; labels: Labels }) {
  // useSearchParams Suspense sınırı ister.
  return (
    <Suspense fallback={null}>
      <Bar lang={lang} labels={labels} />
    </Suspense>
  );
}
