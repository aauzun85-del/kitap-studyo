"use client";

// KAPAK KURGUSU — tuvalden önceki soru-cevap adımı.
// Tür (Thema) → 3 Konsept → Yazı stili → Ton → Kapsam + serbest not.
// "Tuvale gönder ve üret": seçimler projeye yazılır, tuval sayfası ?kurgu=1 ile
// açılır ve orada otomatik üretim (bekleme ekranı + Vazgeç) kurguyla çalışır.
// "Kendim tasarlayacağım": kurgu "atlandı" olarak kaydedilir, tuval boş açılır.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import {
  BRIEF_TEXT_STYLES,
  briefExampleSrc,
  defaultBrief,
  type CoverBrief,
  type Tone,
} from "@/lib/cover/brief";
import {
  GENRE_TO_THEMA,
  resolveStandard,
  searchThema,
  themaName,
  themaPath,
} from "@/lib/cover/standards";
import { updateProjectCoverBrief } from "@/lib/projects/data";
import { creditCost } from "@/lib/credits/pricing";

// Kurgu kapağı iki ücretli uç çağırır: kitap asistanı + ChatGPT görseli.
const BRIEF_COVER_COST = creditCost("cover-prompt") + creditCost("cover-openai");

type Props = {
  lang: Locale;
  projectId: string;
  initial?: CoverBrief;
  title: string;
  author: string;
  /** Kitap bilgisindeki tür (genres.ts "v") → Thema ön seçimi. */
  genre?: string;
};

// Örnek görsel: varsa resim, yoksa renk kartelası (onError ile düşer).
function ExampleArt({ src, swatch, alt }: { src: string; swatch: [string, string, string]; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        aria-hidden
        className="h-full w-full"
        style={{
          background: `linear-gradient(160deg, ${swatch[0]} 0%, ${swatch[0]} 55%, ${swatch[2]} 56%, ${swatch[2]} 62%, ${swatch[1]} 63%)`,
        }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

export default function CoverBriefStudio({ lang, projectId, initial, title, author, genre }: Props) {
  const router = useRouter();
  const tr = lang === "tr";
  const [brief, setBrief] = useState<CoverBrief>(() => {
    const seed = defaultBrief(GENRE_TO_THEMA[genre ?? ""] ?? "FB");
    const prev = initial && !initial.skipped && initial.v === 2 ? initial : null;
    return { ...seed, ...(prev ?? {}), skipped: undefined };
  });
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState<"none" | "run" | "skip">("none");
  const [error, setError] = useState<string | null>(null);

  const standard = resolveStandard(brief.themaCode);
  const results = useMemo(() => searchThema(query), [query]);
  const patch = (p: Partial<CoverBrief>) => setBrief((b) => ({ ...b, ...p }));
  const pickThema = (code: string) => {
    const std = resolveStandard(code);
    patch({ themaCode: code, conceptId: std.concepts[0].id });
    setPickerOpen(false);
    setQuery("");
  };

  const submit = async (mode: "run" | "skip") => {
    if (saving !== "none") return;
    setSaving(mode);
    setError(null);
    try {
      const payload: CoverBrief = {
        ...brief,
        skipped: mode === "skip" ? true : undefined,
        createdAt: new Date().toISOString(),
      };
      await updateProjectCoverBrief(projectId, payload);
      router.push(`/${lang}/kapak?project=${projectId}&kurgu=${mode === "run" ? "1" : "0"}`);
    } catch {
      setSaving("none");
      setError(tr ? "Kaydedilemedi — bağlantını kontrol edip tekrar dene." : "Couldn't save — check your connection and try again.");
    }
  };

  const stepTitle = "text-sm font-semibold text-foreground";
  const stepHint = "text-xs text-muted";
  const card = (active: boolean) =>
    `group flex flex-col overflow-hidden rounded-xl border text-left transition ${
      active ? "border-accent ring-2 ring-accent/30" : "border-foreground/10 hover:border-foreground/30"
    } bg-background`;
  const pill = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm font-semibold transition ${
      active ? "border-accent bg-accent text-white" : "border-foreground/15 bg-background text-foreground hover:bg-accent-soft"
    }`;

  const path = themaPath(brief.themaCode);
  const standardIsExact = standard.code === brief.themaCode;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">{tr ? "Kapak kurgusu" : "Cover brief"}</h1>
        <p className="text-sm text-muted">
          {tr
            ? "Önce kitabın türünü seç; o türün kapak standardından bir konsept, sonra yazı stili, ton ve kapsam. Yapay zekâ kapağı bu kurguya göre üretir; başlık, yazar ve logo yerleri görselde boş bırakılır, uygulama onları kendi basar."
            : "Pick the book's genre first; then a concept from that genre's cover standard, a type style, tone and scope. AI paints the cover from this brief; title, author and logo areas stay clear in the art and the app prints them."}
        </p>
        {(title || author) && (
          <p className="text-xs text-muted">
            {title}
            {author ? ` · ${author}` : ""}
          </p>
        )}
      </header>

      {/* 1 — Tür (Thema) */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "1 · Tür" : "1 · Genre"}</h2>
          <p className={stepHint}>
            {tr
              ? "Thema konu kodu (Kitapyurdu/KDY kataloğundaki tür). Yazarak ara; alt tür seçersen en yakın üst türün standardı uygulanır."
              : "Thema subject code. Type to search; a sub-genre inherits the nearest parent's standard."}
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent-soft px-2 py-1 font-mono text-xs font-semibold text-accent">{brief.themaCode}</span>
            <span className="text-sm font-semibold text-foreground">{themaName(brief.themaCode)}</span>
            {path.length > 1 && <span className="text-xs text-muted">· {path.slice(0, -1).join(" › ")}</span>}
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="ml-auto rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent-soft"
            >
              {pickerOpen ? (tr ? "Kapat" : "Close") : tr ? "Türü değiştir" : "Change genre"}
            </button>
          </div>
          {!standardIsExact && (
            <p className="mt-2 text-xs text-muted">
              {tr
                ? `Bu türün kendi standardı yok → "${standard.name.tr}" (${standard.code}) standardı uygulanır.`
                : `No standard for this code → using "${standard.name.en}" (${standard.code}).`}
            </p>
          )}
          {pickerOpen && (
            <div className="mt-3 space-y-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr ? "Tür adı ya da kod yaz: roman, şiir, VS, FF…" : "Type a genre name or code…"}
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <ul className="max-h-64 divide-y divide-foreground/5 overflow-y-auto rounded-lg border border-foreground/10">
                {results.map((n) => (
                  <li key={n.code}>
                    <button
                      type="button"
                      onClick={() => pickThema(n.code)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent-soft"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-muted">{n.code}</span>
                      <span className="text-foreground">{n.name}</span>
                    </button>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-2 text-xs text-muted">{tr ? "Eşleşme yok." : "No match."}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* 2 — Konsept */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "2 · Konsept" : "2 · Concept"}</h2>
          <p className={stepHint}>
            {tr
              ? `"${standard.name.tr}" türünün kapak standardı: üç konsept. Örnek yön verir; birebir kopyalanmaz.`
              : `Cover standard for "${standard.name.en}": three concepts. Examples set a direction; nothing is copied.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {standard.concepts.map((k, i) => {
            const active = k.id === brief.conceptId;
            return (
              <button key={k.id} type="button" onClick={() => patch({ conceptId: k.id })} className={card(active)} aria-pressed={active}>
                <div className="aspect-[2/3] w-full overflow-hidden bg-foreground/5">
                  <ExampleArt src={briefExampleSrc(standard.code, i)} swatch={k.swatch} alt={k.name[lang]} />
                </div>
                <div className="space-y-1 p-3">
                  <div className="text-sm font-semibold text-foreground">{k.name[lang]}</div>
                  <div className="text-[11px] leading-snug text-muted">{k.blurb[lang]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 — Yazı */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "3 · Yazı" : "3 · Text"}</h2>
          <p className={stepHint}>
            {tr
              ? "Başlık, yazar adı ve tür etiketini kim bassın? ChatGPT: örnek kapaklardaki kalite, yazı görsele gömülür (sonradan değiştirmek = yeniden üretmek). Uygulama: kendi fontlarımız, tuvalde düzenlenebilir."
              : "Who prints the title, author and genre label? ChatGPT: example-quality typography baked into the art (changing it = regenerate). App: our fonts, editable on the canvas."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              ["ai", tr ? "ChatGPT bassın (önerilen)" : "ChatGPT prints it (recommended)"],
              ["app", tr ? "Uygulama bassın" : "App prints it"],
            ] as ["ai" | "app", string][]
          ).map(([v, label]) => (
            <button key={v} type="button" onClick={() => patch({ textBy: v })} aria-pressed={(brief.textBy ?? "ai") === v} className={pill((brief.textBy ?? "ai") === v)}>
              {label}
            </button>
          ))}
        </div>
        {(brief.textBy ?? "ai") === "ai" && (
          <p className={stepHint}>
            {tr
              ? "Tipografiyi ChatGPT konsepte göre tasarlar: yazar üstte küçük, başlık altında, tür etiketi başlığın altında."
              : "ChatGPT designs the typography to match the concept: author small on top, title below, genre label under the title."}
          </p>
        )}
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${(brief.textBy ?? "ai") === "ai" ? "hidden" : ""}`}>
          {BRIEF_TEXT_STYLES.map((s) => {
            const active = s.id === brief.textStyleId;
            const sample = title.trim() || (tr ? "Kitabın Adı" : "Book Title");
            return (
              <button key={s.id} type="button" onClick={() => patch({ textStyleId: s.id })} className={card(active)} aria-pressed={active}>
                <div className="flex h-28 items-center justify-center bg-foreground/[0.04] px-3">
                  <span
                    className="line-clamp-2 text-center leading-tight text-foreground"
                    style={{
                      fontFamily: s.previewFamily,
                      fontWeight: s.previewWeight,
                      fontSize: s.upper ? 26 : 24,
                      letterSpacing: s.spacing ? `${s.spacing / 1000}em` : undefined,
                      textTransform: s.upper ? "uppercase" : undefined,
                    }}
                  >
                    {sample}
                  </span>
                </div>
                <div className="p-3 text-sm font-semibold text-foreground">{s.name[lang]}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4 — Ton · 5 — Kapsam */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className={stepTitle}>{tr ? "4 · Ton" : "4 · Tone"}</h2>
            <p className={stepHint}>{tr ? "Genel renk ağırlığı. Açık ton yazı okunurluğu için en güvenlisi." : "Overall color weight. Light is the safest for readable text."}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["light", tr ? "Açık" : "Light"],
                ["mid", tr ? "Orta" : "Mid"],
                ["dark", tr ? "Koyu" : "Dark"],
              ] as [Tone, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => patch({ tone: v })} aria-pressed={brief.tone === v} className={pill(brief.tone === v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h2 className={stepTitle}>{tr ? "5 · Kapsam" : "5 · Scope"}</h2>
            <p className={stepHint}>{tr ? "Tam sarmal: arka kapak açık tonlu, sırt boş üretilir." : "Full wrap: back cover is generated pale, spine left plain."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["wrap", tr ? "Tam sarmal (arka + sırt + ön)" : "Full wrap (back + spine + front)"],
                ["front", tr ? "Yalnız ön kapak" : "Front cover only"],
              ] as ["wrap" | "front", string][]
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => patch({ scope: v })} aria-pressed={brief.scope === v} className={pill(brief.scope === v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Not */}
      <section className="space-y-2">
        <h2 className={stepTitle}>{tr ? "İsteğe bağlı not" : "Optional note"}</h2>
        <textarea
          value={brief.note ?? ""}
          onChange={(e) => patch({ note: e.target.value.slice(0, 300) })}
          rows={2}
          placeholder={tr ? "Örn. ‘kapakta eski bir fener olsun, deniz kenarı, akşam ışığı’" : "e.g. ‘an old lantern by the sea at dusk’"}
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </section>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <footer className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-5">
        <button
          type="button"
          onClick={() => void submit("run")}
          disabled={saving !== "none"}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === "run" ? (tr ? "Kaydediliyor…" : "Saving…") : tr ? "Tuvale gönder ve üret" : "Send to canvas & generate"}
          {saving !== "run" && BRIEF_COVER_COST > 0 && (
            <span className="ml-2 font-normal opacity-80">
              · {BRIEF_COVER_COST} {tr ? "jeton" : "credits"}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void submit("skip")}
          disabled={saving !== "none"}
          className="rounded-lg border border-foreground/15 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft disabled:opacity-60"
        >
          {tr ? "Kendim tasarlayacağım" : "I'll design it myself"}
        </button>
        <p className="text-xs text-muted">
          {tr ? "Üretim tuvalde başlar; istersen oradan vazgeçebilirsin." : "Generation starts on the canvas; you can cancel there."}
        </p>
      </footer>
    </div>
  );
}
