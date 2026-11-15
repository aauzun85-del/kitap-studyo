"use client";

// İÇ TASARIM KONSEPTİ ekranı (Mizanpaj'a ilk girişte açılır; "Konsept" düğmesiyle
// her zaman yeniden açılabilir). Kitabın türü bir iç yapıya düşer; o yapının 3
// konsepti, üyenin KENDİ METNİYLE gerçek Typst sayfası olarak gösterilir
// (bölüm açılışı + devam sayfası). Seçilen konsept Mizanpaj ayarlarına paketçe
// uygulanır; marjlara/boyuta dokunulmaz.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Block } from "@/lib/layout/paginate";
import { renderBookSvgTypst, type TypstBookInput } from "@/lib/typst";
import {
  INTERIOR_STRUCTURES,
  conceptLayoutSettings,
  structureForGenre,
  type ConceptSizeAdjust,
  type InteriorConcept,
  type InteriorStructureId,
} from "@/lib/layout/concepts";

type Preview = { pages: string[] } | { error: true };

/** Önizleme için metnin baş kısmı: ilk bölüm başlığından ~2 sayfa. */
function sampleBlocks(blocks: Block[]): Block[] {
  const first = blocks.findIndex((b) => b.type === "heading" && b.level === 1 && !b.subhead);
  const start = first >= 0 ? first : 0;
  const out: Block[] = [];
  let words = 0;
  for (let i = start; i < blocks.length && out.length < 60; i++) {
    const b = blocks[i];
    out.push(b);
    if (b.type === "paragraph" || b.type === "blockquote" || b.type === "heading") {
      words += b.runs.reduce((n, r) => n + r.text.split(/\s+/).filter(Boolean).length, 0);
    }
    if (words > 700) break;
  }
  return out;
}

/** Typst'in dikey yığdığı sayfaları ayrı SVG'lere böler (her biri <img> olur →
 *  glif kimlikleri önizlemeler arasında çakışmaz). */
function splitPages(svg: string, pageHeightPt: number, max: number): string[] {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.querySelector("svg");
  if (!root) return [];
  const vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || !vb.every(Number.isFinite)) return [];
  const [, , w, h] = vb;
  const n = Math.max(1, Math.min(max, Math.round(h / pageHeightPt)));
  const urls: string[] = [];
  for (let k = 0; k < n; k++) {
    root.setAttribute("viewBox", `0 ${k * pageHeightPt} ${w} ${pageHeightPt}`);
    root.setAttribute("width", String(w));
    root.setAttribute("height", String(pageHeightPt));
    const xml = new XMLSerializer().serializeToString(root);
    urls.push(URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" })));
  }
  return urls;
}

export default function InteriorConceptPicker({
  lang,
  genre,
  baseInput,
  blocksFor,
  familyOf,
  currentConceptId,
  firstTime,
  onApply,
  onSkip,
  onClose,
}: {
  lang: Locale;
  genre: string | null | undefined;
  /** Mizanpaj'ın güncel Typst girdisi (boyut, marj, kitap bilgisi). */
  baseInput: TypstBookInput;
  /** Metnin bloklara ayrılmış hâli (şiirde satır sonları korunarak). */
  blocksFor: (keepLineBreaks: boolean) => Block[];
  familyOf: (fontId: string) => string;
  currentConceptId?: string;
  /** İlk giriş: "Şimdilik geç" gösterilir; değilse "Kapat". */
  firstTime: boolean;
  onApply: (concept: InteriorConcept, adjust: ConceptSizeAdjust) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const tr = lang === "tr";
  const suggested = structureForGenre(genre);
  const current = INTERIOR_STRUCTURES.flatMap((s) => s.concepts).find((c) => c.id === currentConceptId);
  const [structureId, setStructureId] = useState<InteriorStructureId>(current?.structure ?? suggested);
  const structure = INTERIOR_STRUCTURES.find((s) => s.id === structureId) ?? INTERIOR_STRUCTURES[0];
  const [selected, setSelected] = useState<string>(
    current && current.structure === structureId ? current.id : structure.concepts[0].id,
  );
  const [adjust, setAdjust] = useState<ConceptSizeAdjust>(0);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});

  // Sayfa yüksekliği (pt): önizlemede taşma payı yok.
  const pageHeightPt = (baseInput.size.height * 72) / 25.4;

  // Yapı değişince seçim o yapının ilk konseptine geçer (kullanıcı tıklamasıyla).
  const pickStructure = (id: InteriorStructureId) => {
    setStructureId(id);
    const st = INTERIOR_STRUCTURES.find((s) => s.id === id);
    if (st) setSelected(current && current.structure === id ? current.id : st.concepts[0].id);
  };

  // Önizleme blokları (normal + şiir) bir kez hesaplanır.
  const samples = useMemo(
    () => ({ prose: sampleBlocks(blocksFor(false)), verse: sampleBlocks(blocksFor(true)) }),
    [blocksFor],
  );

  // Görünen 3 konsepti SIRAYLA derle (tek Typst işçisi). Eski sonuçlar atılır.
  const genRef = useRef(0);
  const doneRef = useRef(new Set<string>());
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    const gen = ++genRef.current;
    let cancelled = false;
    (async () => {
      for (const k of structure.concepts) {
        const key = `${k.id}|${adjust}`;
        if (cancelled || gen !== genRef.current) return;
        // Bu konsept/boyut zaten hazırsa yeniden derleme (sekme/boyut gezinmesi).
        if (doneRef.current.has(key)) continue;
        try {
          const settings = {
            ...baseInput.settings,
            ...conceptLayoutSettings(k, familyOf, adjust),
            showFrontMatter: false,
            chapterStartsOnRightPage: false,
          };
          const blocks = k.keepLineBreaks ? samples.verse : samples.prose;
          const svg = await renderBookSvgTypst({ ...baseInput, blocks, settings });
          if (cancelled || gen !== genRef.current) return;
          const pages = splitPages(svg, pageHeightPt, 2);
          urlsRef.current.push(...pages);
          doneRef.current.add(key);
          setPreviews((p) => ({ ...p, [key]: { pages } }));
        } catch {
          if (cancelled || gen !== genRef.current) return;
          setPreviews((p) => ({ ...p, [key]: { error: true } }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [structure, adjust, baseInput, familyOf, samples, pageHeightPt]);

  // Kapanınca önizleme dosyalarını bırak.
  useEffect(
    () => () => {
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
    },
    [],
  );

  // Kapat (× / Esc): ilk girişte "şimdilik geç" sayılır → her girişte yeniden
  // açılıp üyeyi bekletmez (soldaki "Konsept" düğmesiyle her zaman açılabilir).
  const dismiss = firstTime ? onSkip : onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const chosen = structure.concepts.find((c) => c.id === selected) ?? structure.concepts[0];

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-labelledby="ks-concept-title">
      {/* ── başlık ── */}
      <div className="shrink-0 border-b border-border bg-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="ks-concept-title" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {tr ? "İç tasarım konsepti" : "Interior design concept"}
            </h2>
            <p className="mt-1 text-sm text-muted sm:text-[15px]">
              {tr
                ? "Kitabının türüne göre üç sayfa düzeni önerdik. Her biri senin metninle, gerçek kitap sayfası olarak gösteriliyor."
                : "Three page designs suggested for your book's genre, each shown as a real page with your own text."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={tr ? "Kapat" : "Close"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-foreground/60 transition hover:bg-accent-soft hover:text-foreground"
          >
            ×
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
        <div className="mx-auto max-w-[1400px]">
          {/* ── iç yapı sekmeleri ── */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {INTERIOR_STRUCTURES.map((s) => {
              const active = s.id === structureId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStructure(s.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    active ? "border-accent bg-accent-soft shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border bg-surface hover:border-accent/40"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    {s.name[lang]}
                    {s.id === suggested && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                        {tr ? "Önerilen" : "Suggested"}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{s.books[lang]}</span>
                </button>
              );
            })}
          </div>

          {/* ── 3 konsept ── */}
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {structure.concepts.map((k) => {
              const active = k.id === selected;
              const pv = previews[`${k.id}|${adjust}`];
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSelected(k.id)}
                  aria-pressed={active}
                  className={`overflow-hidden rounded-2xl border bg-surface text-left transition ${
                    active ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 bg-[#e9eaf0] p-3 sm:p-4 dark:bg-[#20222b]">
                    {pv && "pages" in pv && pv.pages.length > 0 ? (
                      pv.pages.map((u, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={u}
                          src={u}
                          alt={tr ? `${k.name.tr} — sayfa ${i + 1}` : `${k.name.en} — page ${i + 1}`}
                          className="w-[calc(50%-4px)] rounded-[2px] bg-white shadow-[0_2px_10px_rgba(20,24,40,.18)]"
                        />
                      ))
                    ) : pv && "error" in pv ? (
                      <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-muted">
                        {tr ? "Önizleme gösterilemedi" : "Preview unavailable"}
                      </div>
                    ) : (
                      [0, 1].map((i) => (
                        <div
                          key={i}
                          className="aspect-[2/3] w-[calc(50%-4px)] animate-pulse rounded-[2px] bg-white/70"
                          aria-label={tr ? "Önizleme hazırlanıyor" : "Preparing preview"}
                        />
                      ))
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          active ? "border-accent bg-accent text-white" : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                      <span className="text-lg font-bold text-foreground">{k.name[lang]}</span>
                      {k.id === currentConceptId && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted">
                          {tr ? "Şu anki" : "Current"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{k.blurb[lang]}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {k.tags[lang].map((tg) => (
                        <span key={tg} className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-foreground/75">
                          {tg}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs text-muted">
            {tr
              ? "Görsel ağırlıklı, çocuk ve soru/alıştırma kitapları için düzenler yakında eklenecek. Seçtikten sonra yazı tipi, punto, satır aralığı gibi ayarları Mizanpaj'da değiştirebilir, konsepti soldaki “Konsept” düğmesiyle istediğin zaman yenileyebilirsin."
              : "Layouts for illustrated, children's and exercise books are coming soon. After choosing you can still adjust font, size and leading in Layout, and switch concept any time with the “Concept” button."}
          </p>
        </div>
      </div>

      {/* ── alt çubuk ── */}
      <div className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">{tr ? "Yazı büyüklüğü" : "Text size"}</span>
          <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label={tr ? "Yazı büyüklüğü" : "Text size"}>
            {(
              [
                [-1, tr ? "Küçük" : "Small"],
                [0, tr ? "Normal" : "Normal"],
                [1, tr ? "Büyük" : "Large"],
              ] as [ConceptSizeAdjust, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setAdjust(v)}
                aria-pressed={adjust === v}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  adjust === v ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={firstTime ? onSkip : onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/80 transition hover:border-accent/50 hover:text-foreground"
          >
            {firstTime ? (tr ? "Şimdilik geç, kendim ayarlayacağım" : "Skip, I'll set it myself") : tr ? "Vazgeç" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => onApply(chosen, adjust)}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            {tr ? `“${chosen.name.tr}” düzenini uygula →` : `Apply “${chosen.name.en}” →`}
          </button>
        </div>
      </div>
    </div>
  );
}
