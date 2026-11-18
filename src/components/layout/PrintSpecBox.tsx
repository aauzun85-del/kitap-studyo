"use client";

// Baskı kutusu: iç sayfa KÂĞIDI + SIRT (otomatik ya da elle, cm). Konsept
// ekranında ve Mizanpaj "Sayfa" panelinde aynı kutu; seçimler kitap düzeyinde
// saklanır (Kapak ve İndir ekranı aynı sırtı kullanır).

import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { PAPERS, SPINE_TEXT_MIN_MM, formatCm, getPaper, type PaperId } from "@/lib/cover/spread";

/** "1,9" / "1.9" → 19 (mm). Geçersiz/sıfır → null. */
function parseCmToMm(s: string): number | null {
  const n = parseFloat(s.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 10 : null;
}

/** Sırt ölçüsü girişi (cm; virgül ya da nokta). Değer mm olarak bildirilir. */
export function SpineCmInput({
  valueMm,
  onChangeMm,
  lang,
  className = "",
  ariaLabel,
}: {
  valueMm: number;
  onChangeMm: (mm: number) => void;
  lang: Locale;
  className?: string;
  ariaLabel?: string;
}) {
  const fmt = (mm: number) => formatCm(mm, lang === "tr" ? "tr" : "en").replace(/\s*cm$/, "");
  const [text, setText] = useState(() => fmt(valueMm));
  // Dışarıdan değer değişirse (geri al, başka ekran) yazı da güncellensin;
  // yazarken ("1," gibi yarım değer) dokunulmaz.
  const [lastMm, setLastMm] = useState(valueMm);
  if (valueMm !== lastMm) {
    setLastMm(valueMm);
    if (parseCmToMm(text) !== valueMm) setText(fmt(valueMm));
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={ariaLabel}
        onChange={(e) => {
          setText(e.target.value);
          const mm = parseCmToMm(e.target.value);
          if (mm !== null && mm <= 200) {
            setLastMm(mm);
            onChangeMm(mm);
          }
        }}
        onBlur={() => setText(fmt(valueMm))}
        className="h-9 w-20 rounded-lg border border-border bg-background px-2 text-right text-sm font-semibold text-foreground outline-none focus:border-accent"
      />
      <span className="text-sm text-muted">cm</span>
    </span>
  );
}

export default function PrintSpecBox({
  lang,
  paperId,
  onPaperChange,
  autoSpineMm,
  pages,
  approximate,
  spineManualMm,
  onSpineManualChange,
  compact = false,
}: {
  lang: Locale;
  paperId: PaperId;
  onPaperChange: (id: PaperId) => void;
  /** Sayfa × kâğıttan hesaplanan sırt (mm); sayfa sayısı henüz yoksa null. */
  autoSpineMm: number | null;
  /** Baskıdaki sayfa sayısı (biliniyorsa). */
  pages: number | null;
  /** Sayfa sayısı tahmin mi (konsept ekranı)? */
  approximate?: boolean;
  spineManualMm: number | null;
  onSpineManualChange: (mm: number | null) => void;
  /** Dar yan panel düzeni (alt alta). */
  compact?: boolean;
}) {
  const tr = lang === "tr";
  const cm = (mm: number) => formatCm(mm, tr ? "tr" : "en");
  const paper = getPaper(paperId);
  const manual = spineManualMm !== null;
  const shownMm = manual ? spineManualMm : autoSpineMm;
  const segBtn = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"}`;

  return (
    <div className={compact ? "space-y-4" : "grid gap-5 md:grid-cols-2"}>
      {/* Kâğıt */}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-foreground" htmlFor={`ks-paper-${compact ? "p" : "c"}`}>
          {tr ? "İç sayfa kâğıdı" : "Interior paper"}
        </label>
        <select
          id={`ks-paper-${compact ? "p" : "c"}`}
          value={paperId}
          onChange={(e) => onPaperChange(e.target.value as PaperId)}
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-accent"
        >
          <optgroup label={tr ? "KDY ve Türkiye matbaaları" : "KDY and Turkish printers"}>
            {PAPERS.filter((p) => p.group === "tr").map((p) => (
              <option key={p.id} value={p.id}>
                {p.label[lang]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Amazon KDP">
            {PAPERS.filter((p) => p.group === "kdp").map((p) => (
              <option key={p.id} value={p.id}>
                {p.label[lang]}
              </option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {paper.source[lang]} · {tr ? `100 sayfada ${cm(paper.mmPerPage * 100)} sırt` : `${cm(paper.mmPerPage * 100)} spine per 100 pages`}
          {manual && (tr ? " · Sırtı elle girdiğin için kâğıt sırtı değiştirmez." : " · The spine is entered manually, so paper doesn't change it.")}
        </p>
      </div>

      {/* Sırt */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{tr ? "Sırt kalınlığı" : "Spine width"}</span>
          {shownMm !== null && (
            <span className="text-lg font-bold text-accent">
              {manual ? "" : approximate ? "≈ " : ""}
              {cm(shownMm)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label={tr ? "Sırt kalınlığı" : "Spine width"}>
            <button type="button" aria-pressed={!manual} onClick={() => onSpineManualChange(null)} className={segBtn(!manual)}>
              {tr ? "Otomatik" : "Automatic"}
            </button>
            <button
              type="button"
              aria-pressed={manual}
              onClick={() => {
                if (!manual) onSpineManualChange(Math.round((autoSpineMm ?? 10) * 10) / 10 || 10);
              }}
              className={segBtn(manual)}
            >
              {tr ? "Elle gir" : "Enter manually"}
            </button>
          </div>
          {manual && (
            <SpineCmInput
              lang={lang}
              valueMm={spineManualMm}
              onChangeMm={(mm) => onSpineManualChange(mm)}
              ariaLabel={tr ? "Sırt kalınlığı (cm)" : "Spine width (cm)"}
            />
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {manual
            ? tr
              ? "Matbaanın verdiği sırt ölçüsünü yaz. Kapak bu ölçüyle hazırlanır."
              : "Enter the spine your printer gave you. The cover uses this width."
            : pages
              ? tr
                ? `${approximate ? "Yaklaşık " : ""}${pages} sayfa × ${paper.label.tr}. Kapak bu ölçüyle hazırlanır.`
                : `${approximate ? "About " : ""}${pages} pages × ${paper.label.en}. The cover uses this width.`
              : tr
                ? "Sayfa sayısı hesaplanınca gösterilir."
                : "Shown once the page count is known."}
        </p>
        {shownMm !== null && shownMm < SPINE_TEXT_MIN_MM && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            {tr
              ? "Sırt 1 cm'den ince: sırta kitap adı yazısı basılmaz."
              : "Spine is under 1 cm: no title text is printed on it."}
          </p>
        )}
      </div>
    </div>
  );
}
