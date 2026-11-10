import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { findLegalDoc } from "@/lib/legal/documents";
import InfoPage from "@/components/legal/InfoPage";
import LegalText from "@/components/legal/LegalText";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/yasal/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const doc = findLegalDoc(slug);
  if (!doc || !isLocale(lang)) return {};
  return { title: doc.title[lang] };
}

export default async function LegalDocPage({ params }: PageProps<"/[lang]/yasal/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const doc = findLegalDoc(slug);
  if (!doc) notFound();

  return (
    <InfoPage
      lang={lang}
      current={doc.slug}
      title={doc.title[lang]}
      intro={
        <>
          {lang === "en" && (
            <p className="mb-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
              This document is provided in Turkish, which is the governing language.
            </p>
          )}
          {doc.intro && (
            <p>
              <LegalText text={doc.intro} lang={lang} />
            </p>
          )}
        </>
      }
    >
      <div className="space-y-7 text-base leading-relaxed text-foreground/85">
        {doc.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h2 className="mb-2 font-sans text-lg font-bold text-foreground">{s.h}</h2>}
            {s.p?.map((t, j) => (
              <p key={j} className="mb-2">
                <LegalText text={t} lang={lang} />
              </p>
            ))}
            {s.list && (
              <ul className="ml-5 list-disc space-y-1.5 marker:text-muted">
                {s.list.map((t, j) => (
                  <li key={j}>
                    <LegalText text={t} lang={lang} />
                  </li>
                ))}
              </ul>
            )}
            {s.after?.map((t, j) => (
              <p key={j} className="mt-2">
                <LegalText text={t} lang={lang} />
              </p>
            ))}
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
