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
import { isBibliographyTitle } from "@/lib/typst/serialize";
import {
  INTERIOR_STRUCTURES,
  conceptLayoutSettings,
  conceptUsesOrnament,
  structureForGenre,
  ORNAMENT_OPTIONS,
  TOC_OPTIONS,
  BIB_OPTIONS,
  type ConceptDetails,
  type ConceptSizeAdjust,
  type InteriorConcept,
  type InteriorStructureId,
} from "@/lib/layout/concepts";

type Preview = { pages: string[] } | { error: true };

const wordsOf = (b: Block): number =>
  b.type === "paragraph" || b.type === "blockquote" || b.type === "heading"
    ? b.runs.reduce((n, r) => n + r.text.split(/\s+/).filter(Boolean).length, 0)
    : 0;
const isChapter = (b: Block) => b.type === "heading" && b.level === 1 && !b.subhead;

/** Önizleme örneği: kitabın İÇİNDEN, dolu bir bölüm (bölüm açılışı + dolu devam
 *  sayfası). Kitabın ilk sayfaları çoğu zaman künye/not/kısa satırlarla dolu
 *  olduğundan, bölümler puanlanır: uzun paragraflar artı, kısa satırlar eksi;
 *  ara başlık/alıntı içeren bölüm biraz öne çıkar (konsept farkları görünsün).
 *  Seçilen bölümün başındaki kısa satırlar yalnız ÖNİZLEMEDE atlanır. Bölüm
 *  başlığı olmayan kitapta ortadan dolu bir parça alınır, başına kitabın adı
 *  başlık olarak konur. Kitabın kendisine dokunulmaz. */
export function sampleBlocks(blocks: Block[], title: string, verse = false): Block[] {
  const heads = blocks.map((b, i) => (isChapter(b) ? i : -1)).filter((i) => i >= 0);
  const take = (from: number, lead: Block[] = []): Block[] => {
    const out: Block[] = [...lead];
    let words = 0;
    let skipping = true;
    for (let i = from; i < blocks.length && out.length < 70; i++) {
      const b = blocks[i];
      if (out.length > lead.length + 1 && isChapter(b) && words > 300) break;
      // Bölüm başındaki kısa satırları (künye, not, alt başlık) atla.
      // (Şiirde kısa kıtalar şiirin kendisidir → atlanmaz.)
      if (!verse && skipping && i > from && b.type === "paragraph" && wordsOf(b) < 10) continue;
      if (i > from && b.type !== "blank") skipping = false;
      out.push(b);
      words += wordsOf(b);
      if (words > 760) break;
    }
    return out;
  };
  if (heads.length === 0) {
    // Bölümsüz kitap: metnin ~%35'inden itibaren ilk uzun paragraf.
    let start = Math.floor(blocks.length * 0.35);
    while (start < blocks.length && !(blocks[start].type === "paragraph" && wordsOf(blocks[start]) >= 25)) start++;
    if (start >= blocks.length) start = 0;
    const synthetic: Block = { type: "heading", level: 1, runs: [{ text: title || "Bölüm", bold: false, italic: false }] };
    return take(start, [synthetic]);
  }
  let best = heads[0];
  let bestScore = -Infinity;
  heads.slice(0, 40).forEach((h, n) => {
    let score = 0;
    let extras = 0;
    for (let i = h + 1, k = 0; i < blocks.length && k < 40 && !isChapter(blocks[i]); i++, k++) {
      const b = blocks[i];
      const w = wordsOf(b);
      if (b.type === "paragraph") score += verse ? w : w >= 25 ? Math.min(w, 160) : w < 10 ? -35 : 0;
      if (b.type === "blockquote" || (b.type === "heading" && b.level > 1)) extras++;
    }
    score = Math.min(score, 1100) + Math.min(extras, 2) * 120 - (n === 0 && heads.length > 2 ? 60 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  return take(best);
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
  currentDetails,
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
  /** Kitabın şu anki süs / içindekiler / kaynakça seçimi (mevcut konsept açılınca korunur). */
  currentDetails?: ConceptDetails;
  /** İlk giriş: "Şimdilik geç" gösterilir; değilse "Kapat". */
  firstTime: boolean;
  onApply: (concept: InteriorConcept, adjust: ConceptSizeAdjust, details: ConceptDetails) => void;
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
  // "Ayrıntılar": süs / içindekiler / kaynakça (seçili konsept için; boş = konseptinki).
  // Kitabın mevcut konsepti seçiliyse kitabın şu anki seçimleriyle başlar.
  const detailsFor = (id: string): ConceptDetails => (id === currentConceptId ? (currentDetails ?? {}) : {});
  const [details, setDetails] = useState<ConceptDetails>(() => detailsFor(selected));
  const [previews, setPreviews] = useState<Record<string, Preview>>({});

  // Sayfa yüksekliği (pt): önizlemede taşma payı yok.
  const pageHeightPt = (baseInput.size.height * 72) / 25.4;

  // Yapı değişince seçim o yapının ilk konseptine geçer (kullanıcı tıklamasıyla).
  const pickStructure = (id: InteriorStructureId) => {
    setStructureId(id);
    const st = INTERIOR_STRUCTURES.find((s) => s.id === id);
    const next = st ? (current && current.structure === id ? current.id : st.concepts[0].id) : selected;
    setSelected(next);
    setDetails(detailsFor(next));
  };
  const pickConcept = (id: string) => {
    if (id !== selected) setDetails(detailsFor(id));
    setSelected(id);
  };
  // Kart anahtarı: seçili kartın önizlemesi seçilen süsle çizilir.
  const cardKey = (id: string) => `${id}|${adjust}|${id === selected ? (details.ornamentKind ?? "") : ""}`;

  // Önizleme blokları (normal + şiir) bir kez hesaplanır.
  const samples = useMemo(
    () => ({
      prose: sampleBlocks(blocksFor(false), baseInput.meta.title),
      verse: sampleBlocks(blocksFor(true), baseInput.meta.title, true),
    }),
    [blocksFor, baseInput.meta.title],
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
        const key = cardKey(k.id);
        if (cancelled || gen !== genRef.current) return;
        // Bu konsept/boyut zaten hazırsa yeniden derleme (sekme/boyut gezinmesi).
        if (doneRef.current.has(key)) continue;
        try {
          const settings = {
            ...baseInput.settings,
            ...conceptLayoutSettings(k, familyOf, adjust, k.id === selected ? { ornamentKind: details.ornamentKind } : {}),
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
    // cardKey seçim + süse bağlı; React Compiler bağımlılıkları buradan izler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, adjust, baseInput, familyOf, samples, pageHeightPt, selected, details.ornamentKind]);

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
  const tocNow = details.tocStyle ?? chosen.tocStyle;
  const bibNow = details.bibStyle ?? chosen.bibStyle;
  const ornNow = details.ornamentKind ?? chosen.ornamentKind;

  // İçindekiler + kaynakça önizlemesi (seçili konsept + ayrıntılar). Kitabın
  // bölüm adları kullanılır; kaynakçası yoksa örnek kaynakça gösterilir.
  const detailSample = useMemo(() => {
    const all = blocksFor(false);
    const chapters: Block[] = [];
    let found = 0;
    for (let i = 0; i < all.length && found < 6; i++) {
      const b = all[i];
      if (b.type === "heading" && b.level === 1 && !b.subhead) {
        found++;
        chapters.push(b);
        const p = all.slice(i + 1, i + 6).find((x) => x.type === "paragraph");
        if (p && p.type === "paragraph") {
          const text = p.runs.map((r) => r.text).join("").split(/\s+/).slice(0, 30).join(" ");
          chapters.push({ type: "paragraph", runs: [{ text, bold: false, italic: false }] });
        }
      }
    }
    const synthetic = found === 0;
    if (synthetic) {
      for (const t of tr ? ["Birinci Bölüm", "İkinci Bölüm", "Üçüncü Bölüm", "Dördüncü Bölüm"] : ["Chapter One", "Chapter Two", "Chapter Three", "Chapter Four"]) {
        chapters.push({ type: "heading", level: 1, runs: [{ text: t, bold: false, italic: false }] });
        chapters.push({ type: "paragraph", runs: [{ text: "…", bold: false, italic: false }] });
      }
    }
    const bi = all.findIndex((b) => b.type === "heading" && isBibliographyTitle(b.runs.map((r) => r.text).join("")));
    let bib: Block[];
    let sampleBib = false;
    if (bi >= 0) {
      bib = [{ ...(all[bi] as Extract<Block, { type: "heading" }>), level: 1, subhead: false, kicker: undefined }];
      for (let i = bi + 1; i < all.length && bib.length < 8; i++) {
        const b = all[i];
        if (b.type === "heading") break;
        if (b.type === "paragraph") bib.push(b);
      }
    } else {
      sampleBib = true;
      const R = (text: string): Block => ({ type: "paragraph", runs: [{ text, bold: false, italic: false }] });
      bib = [
        { type: "heading", level: 1, runs: [{ text: tr ? "Kaynakça" : "Bibliography", bold: false, italic: false }] },
        R("Aydın, Selin. Şehrin Hafızası: Mahalle, Hatıra ve Mekân. İstanbul: Örnek Yayınları, 2019."),
        R("Demir, Kemal. “Osmanlı Şehirlerinde Mahalle Örgütlenmesi.” Tarih Araştırmaları Dergisi 12, sayı 2 (2015): 45–78."),
        R("Kaya, Ayşe, ve Mert Yılmaz. Kent ve Kimlik: Toplumsal Bellek Üzerine Denemeler. Ankara: Örnek Kitap, 2021."),
      ];
    }
    return { blocks: [...chapters, ...bib], synthetic, sampleBib };
  }, [blocksFor, tr]);

  const [detailPv, setDetailPv] = useState<Record<string, Preview>>({});
  const detailKey = `${chosen.id}|${adjust}|${tocNow}|${bibNow}|${ornNow}`;
  const detailDoneRef = useRef(new Set<string>());
  useEffect(() => {
    if (detailDoneRef.current.has(detailKey)) return;
    let cancelled = false;
    (async () => {
      try {
        const settings = {
          ...baseInput.settings,
          ...conceptLayoutSettings(chosen, familyOf, adjust, { ornamentKind: ornNow, tocStyle: tocNow, bibStyle: bibNow }),
          showFrontMatter: true,
          chapterStartsOnRightPage: false,
        };
        const svg = await renderBookSvgTypst({
          ...baseInput,
          meta: { ...baseInput.meta, bio: "" },
          blocks: detailSample.blocks,
          settings,
        });
        if (cancelled) return;
        const pages = splitPages(svg, pageHeightPt, 40);
        // 1. sayfa kapak sayfası, 2. sayfa içindekiler; kaynakça son sayfa.
        const pick = [pages[1], pages[pages.length - 1]].filter(Boolean);
        urlsRef.current.push(...pages);
        detailDoneRef.current.add(detailKey);
        setDetailPv((p) => ({ ...p, [detailKey]: { pages: pick } }));
      } catch {
        if (!cancelled) setDetailPv((p) => ({ ...p, [detailKey]: { error: true } }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailKey, detailSample, baseInput, familyOf, pageHeightPt]);
  const dpv = detailPv[detailKey];

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
              const pv = previews[cardKey(k.id)];
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => pickConcept(k.id)}
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

          {/* ── Ayrıntılar: süs, içindekiler, kaynakça ── */}
          <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="ks-details-title">
            <h3 id="ks-details-title" className="text-lg font-bold text-foreground">
              {tr ? `Ayrıntılar — ${chosen.name.tr}` : `Details — ${chosen.name.en}`}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {tr ? "Seçtiğin konseptin süsünü, içindekiler ve kaynakça düzenini belirle." : "Choose the ornament, contents and bibliography layout for this concept."}
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
              <div className="space-y-5">
                {conceptUsesOrnament(chosen) && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-foreground">{tr ? "Süs" : "Ornament"}</div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={tr ? "Süs" : "Ornament"}>
                      {ORNAMENT_OPTIONS.map((o) => (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => setDetails((d) => ({ ...d, ornamentKind: o.v }))}
                          aria-pressed={ornNow === o.v}
                          className={`flex min-w-[84px] flex-col items-center gap-1 rounded-xl border px-3 py-2 transition ${
                            ornNow === o.v ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40"
                          }`}
                        >
                          <span className="text-xl leading-7 text-foreground" style={{ fontFamily: "'EB Garamond', 'Cormorant Garamond', serif" }}>
                            {o.glyph}
                          </span>
                          <span className="text-xs font-medium text-foreground/80">{o[lang]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-2 text-sm font-semibold text-foreground">{tr ? "İçindekiler" : "Contents page"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr ? "İçindekiler" : "Contents page"}>
                    {TOC_OPTIONS.map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setDetails((d) => ({ ...d, tocStyle: o.v }))}
                        aria-pressed={tocNow === o.v}
                        className={`rounded-xl border p-2.5 text-left transition ${
                          tocNow === o.v ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40"
                        }`}
                      >
                        <TocMini kind={o.v} />
                        <span className="mt-1.5 block text-xs font-semibold text-foreground">{o[lang]}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-foreground">{tr ? "Kaynakça" : "Bibliography"}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr ? "Kaynakça" : "Bibliography"}>
                    {BIB_OPTIONS.map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setDetails((d) => ({ ...d, bibStyle: o.v }))}
                        aria-pressed={bibNow === o.v}
                        className={`rounded-xl border p-2.5 text-left transition ${
                          bibNow === o.v ? "border-accent bg-accent-soft" : "border-border hover:border-accent/40"
                        }`}
                      >
                        <BibMini kind={o.v} />
                        <span className="mt-1.5 block text-xs font-semibold text-foreground">{o[lang]}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {tr
                      ? "Kitapta “Kaynakça”, “Kaynaklar” ya da “Bibliyografya” başlıklı bölüm varsa girişleri bu düzende dizilir; yazımlarına dokunulmaz."
                      : "If the book has a “Bibliography” or “References” section, its entries use this layout; their wording is untouched."}
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 rounded-xl bg-[#e9eaf0] p-3 dark:bg-[#20222b]">
                  {dpv && "pages" in dpv && dpv.pages.length > 0 ? (
                    dpv.pages.map((u, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={u}
                        src={u}
                        alt={i === 0 ? (tr ? "İçindekiler önizlemesi" : "Contents preview") : tr ? "Kaynakça önizlemesi" : "Bibliography preview"}
                        className="w-[calc(50%-4px)] rounded-[2px] bg-white shadow-[0_2px_10px_rgba(20,24,40,.18)]"
                      />
                    ))
                  ) : dpv && "error" in dpv ? (
                    <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-muted">{tr ? "Önizleme gösterilemedi" : "Preview unavailable"}</div>
                  ) : (
                    [0, 1].map((i) => <div key={i} className="aspect-[2/3] w-[calc(50%-4px)] animate-pulse rounded-[2px] bg-white/70" />)
                  )}
                </div>
                <p className="mt-2 text-center text-xs text-muted">
                  {tr ? "Solda içindekiler, sağda kaynakça sayfası" : "Contents page left, bibliography right"}
                  {detailSample.sampleBib || detailSample.synthetic ? (tr ? " (kitapta olmayanlar örnek metinle gösterildi)" : " (sample text where the book has none)") : ""}
                </p>
              </div>
            </div>
          </section>

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
            onClick={() => onApply(chosen, adjust, { ornamentKind: ornNow, tocStyle: tocNow, bibStyle: bibNow })}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            {tr ? `“${chosen.name.tr}” düzenini uygula →` : `Apply “${chosen.name.en}” →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Küçük çizimler (seçenek kartlarında): içindekiler ve kaynakça düzeninin özeti.
function TocMini({ kind }: { kind: "classic" | "plain" | "numbered" | "elegant" }) {
  const bar = "h-[3px] rounded-full bg-foreground/45";
  return (
    <div className="flex h-12 flex-col justify-center gap-1.5 rounded-md bg-white px-2 dark:bg-white/90" aria-hidden="true">
      {[0, 1, 2].map((i) =>
        kind === "elegant" ? (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className={`${bar} w-1/2`} />
          </div>
        ) : (
          <div key={i} className="flex items-center gap-1">
            {kind === "numbered" && <span className="h-[3px] w-1.5 rounded-full bg-foreground/30" />}
            <span className={`${bar} ${i === 1 ? "w-2/5" : "w-1/2"}`} />
            <span className={`h-px flex-1 ${kind === "classic" ? "border-t border-dotted border-foreground/50" : ""}`} />
            <span className="h-[3px] w-1.5 rounded-full bg-foreground/45" />
          </div>
        ),
      )}
    </div>
  );
}

function BibMini({ kind }: { kind: "hanging" | "numbered" | "plain" | "none" }) {
  const bar = "h-[3px] rounded-full bg-foreground/45";
  return (
    <div className="flex h-12 flex-col justify-center gap-1 rounded-md bg-white px-2 dark:bg-white/90" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-1">
          {kind === "numbered" && <span className="mt-[1px] h-[3px] w-1.5 rounded-full bg-foreground/30" />}
          <div className="flex flex-1 flex-col gap-[3px]">
            <span className={`${bar} ${kind === "none" ? "ml-2" : ""} w-full`} />
            <span className={`${bar} ${kind === "hanging" ? "ml-2.5" : ""} w-3/4`} />
          </div>
        </div>
      ))}
    </div>
  );
}
