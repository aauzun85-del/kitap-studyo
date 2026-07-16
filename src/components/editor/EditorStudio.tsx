"use client";

import { useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { useManuscriptSync } from "@/lib/projects/useSync";
import { genreEditorMode } from "@/lib/projects/genres";
import { chunkText } from "@/lib/editor/chunk";
import { docxToText } from "@/lib/editor/docxText";
import { textToDocx, suggestDocxName } from "@/lib/editor/textToDocx";
import { applyEditsToDocx, type DocxEdit } from "@/lib/editor/docxEdit";
import { TextTIcon, MagicWandIcon, CheckCircleIcon, BookIcon, WarningIcon } from "@/components/PhosphorIcons";

// Aşama 2: yazım ve dilbilgisi kontrolü Claude'a bağlı. Öneriler tek tek
// Kabul/Yoksay edilir; karar her zaman kullanıcıda.
const SAMPLE_TR = `Sabah ışığı perdelerin arasından süzülürken, masanın üstünde duran kahve çoktan soğumuştu. Yinede fincanı eline aldı; sıcaklığından çok, alışkanlığın verdiği o tanıdık ağırlık için.

Pencerenin önünde durup sokağa baktı baktı. Aşağıda, her zamanki gibi, gazeteci çocuk köşeyi dönüyordu. Şehir uyanıyordu ama o, bir süredir uykuya hiç dalmamış gibi hissediyordu kendisini.

Belki de mesele uyku değildi. Belkide mesele, dün gece okuduğu o mektuptu.`;

// "fix" = Claude'un yazım/dilbilgisi önerisi (kabul edilince metin değişir).
// "notice" = yerel uyarı, örn. uzun cümle (otomatik düzeltme yok, bilgilendirir).
type Category =
  | "spelling"
  | "grammar"
  | "long"
  | "repetition"
  | "flow"
  | "tone"
  | "paragraph"
  | "defamation"
  | "privacy"
  | "copyright"
  | "claim"
  | "misinfo"
  | "character"
  | "timeline"
  | "plot"
  | "promise"
  | "action"
  | "citation"
  | "definition"
  | "objectivity"
  | "fluency"
  | "sentence_structure"
  | "diction"
  | "dialogue"
  | "concision"
  | "clarity"
  | "register"
  | "punctuation";

// Editöryal inceleme notlarının önem düzeyi (Gold kural setinden).
type Severity = "hint" | "suggest" | "warn";

type Suggestion = {
  kind: "fix" | "notice";
  original: string;
  suggestion: string;
  category: Category;
  explanation: string;
  wordCount?: number;
  severity?: Severity;
};

// Parçalı kontrolde aynı öneri birden çok parçada çıkabilir; tekilleştir.
// Ayrıca DEĞİŞİKLİK İÇERMEYEN "düzeltme"leri ele: model bazen sorun bulamadığı
// cümleyi aynen geri döndürür ("bu yapı zaten doğru" açıklamasıyla). ESKİ=ÖNERİ
// olan kart kullanıcıya iş yaptırmaz — hiç gösterme (boşluk farkları sayılmaz).
const normalizeForCompare = (s: string) => s.replace(/\s+/g, " ").trim();
function dedupeSuggestions(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of list) {
    if (
      s.kind === "fix" &&
      s.suggestion &&
      normalizeForCompare(s.original) === normalizeForCompare(s.suggestion)
    )
      continue;
    const key = `${s.kind}|${s.category}|${s.original}|${s.suggestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Claude'dan gelen ham yazım/dilbilgisi önerisi (henüz kind eklenmemiş).
type AiSuggestion = {
  original: string;
  suggestion: string;
  category: "spelling" | "grammar";
  explanation: string;
};

// Editöryal inceleme route'undan gelen ham gözlem (Gold kural setiyle).
type ReviewNote = {
  excerpt: string;
  category:
    | "fluency"
    | "sentence_structure"
    | "diction"
    | "grammar"
    | "dialogue"
    | "concision"
    | "clarity"
    | "register"
    | "punctuation";
  severity?: Severity;
  issue: string;
  suggestion: string;
};

// Riskli içerik route'undan gelen ham gözlem.
type RiskNote = {
  excerpt: string;
  category: "defamation" | "privacy" | "copyright" | "claim" | "misinfo";
  issue: string;
  suggestion: string;
};

// Türe göre özel kontrol route'undan gelen ham gözlem.
type GenreNote = {
  excerpt: string;
  category:
    | "character"
    | "timeline"
    | "plot"
    | "promise"
    | "repetition"
    | "action"
    | "citation"
    | "definition"
    | "objectivity";
  issue: string;
  suggestion: string;
};

type Genre = "fiction" | "selfhelp" | "academic";

type Decision = "accepted" | "rejected";

// Bu kelime sayısını aşan cümleler "uzun cümle" olarak uyarılır.
const LONG_SENTENCE_WORDS = 35;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// Fazla boşluk sayısı: çift boşluk, noktalama öncesi boşluk, satır sonu
// boşluğu ve üst üste boş satırlar. Hepsi yerel; API harcaması yok.
function countWhitespace(text: string): number {
  return (
    (text.match(/ {2,}/g)?.length ?? 0) +
    (text.match(/ +([,.;:!?])/g)?.length ?? 0) +
    (text.match(/[ \t]+$/gm)?.length ?? 0) +
    (text.match(/\n{3,}/g)?.length ?? 0)
  );
}

function cleanWhitespace(text: string): string {
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

// Metni cümlelere bölüp uzun olanları "notice" önerisi olarak döndürür.
function findLongSentences(text: string): Suggestion[] {
  const parts = text.split(/(?<=[.!?…])\s+|\n+/);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const sentence = part.trim();
    if (!sentence || seen.has(sentence)) continue;
    const words = sentence.split(/\s+/).length;
    if (words < LONG_SENTENCE_WORDS) continue;
    seen.add(sentence);
    out.push({
      kind: "notice",
      original: sentence,
      suggestion: "",
      category: "long",
      explanation: "",
      wordCount: words,
    });
  }
  return out;
}

// ——— Kitap yapısı (Aşama 3 / Kategori 3): yerel, ücretsiz ———

type HeadingStyle = "bolum" | "numeric" | "caps" | "named" | "plain";
type Chapter = {
  title: string;
  words: number;
  untitled: boolean;
  style: HeadingStyle;
  level: 1 | 2;
};
type StructureIssue =
  | { type: "long"; title: string; words: number; avg: number }
  | { type: "short"; title: string; words: number; avg: number }
  | { type: "gap" }
  | { type: "hierarchy"; title: string }
  | { type: "inconsistent"; styles: HeadingStyle[] }
  | { type: "none" };
type StructureReport = {
  chapters: Chapter[];
  issues: StructureIssue[];
  completeness: { intro: boolean; conclusion: boolean } | null;
};

// Giriş/sonuç bölümlerini tanıyan kalıplar (TR + EN).
// Not: JS'in \b sınırı Türkçe harflerle (ş, ç, ü…) güvenilir değil; bunun
// yerine "ardından harf gelmesin" lookahead'i kullanıyoruz.
const INTRO_RE = /^(önsöz|ön söz|giriş|sunuş|sunum|prolog|introduction|preface|foreword|prologue)(?!\p{L})/iu;
const CONCLUSION_RE = /^(sonuç|sonsöz|son söz|epilog|kapanış|conclusion|epilogue|afterword)(?!\p{L})/iu;

// Bir satırın bölüm başlığı olup olmadığını sezgisel olarak tahmin eder.
function isHeadingLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  const words = s.split(/\s+/).length;
  if (
    /^(bölüm|kısım|chapter|part|ünite|konu|önsöz|giriş|sonuç|epilog|prolog|sonsöz)(?!\p{L})/iu.test(s)
  )
    return true;
  if (
    /^(birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı|yedinci|sekizinci|dokuzuncu|onuncu)\s+(bölüm|kısım)(?!\p{L})/iu.test(s)
  )
    return true;
  if (/^\d+\.\d+\b/.test(s) && words <= 10) return true; // "1.1 Tanımlar" (alt başlık)
  if (/^\d+\s*[.)\-–]?\s*$/.test(s)) return true; // tek başına numara
  if (/^\d+[.)]\s+\S/.test(s) && words <= 8) return true; // "1. Başlangıç"
  // Kısa ve TAMAMEN BÜYÜK HARF satır
  if (
    s.length <= 60 &&
    words <= 8 &&
    /\p{L}/u.test(s) &&
    s === s.toLocaleUpperCase("tr")
  )
    return true;
  return false;
}

// Boş satırlarla çevrili, kısa, cümle gibi bitmeyen satır = muhtemel başlık.
function isSoftHeading(line: string, prevBlank: boolean, nextBlank: boolean): boolean {
  const s = line.trim();
  if (!s || !prevBlank || !nextBlank) return false;
  const words = s.split(/\s+/).length;
  if (words > 6 || s.length > 50) return false;
  if (/[.!?…,;:]$/.test(s)) return false;
  if (!/^[A-ZÇĞİÖŞÜ0-9"«“]/.test(s)) return false;
  return true;
}

// Bir başlığın biçimini ve düzeyini (ana=1, alt=2) belirler.
function classifyHeading(title: string): { style: HeadingStyle; level: 1 | 2 } {
  const s = title.trim();
  if (/^\d+\.\d+/.test(s)) return { style: "numeric", level: 2 };
  if (INTRO_RE.test(s) || CONCLUSION_RE.test(s)) return { style: "named", level: 1 };
  if (
    /^(bölüm|kısım|chapter|part|ünite|konu)(?!\p{L})/iu.test(s) ||
    /^(birinci|ikinci|üçüncü|dördüncü|beşinci|altıncı|yedinci|sekizinci|dokuzuncu|onuncu)\s+(bölüm|kısım)(?!\p{L})/iu.test(s)
  )
    return { style: "bolum", level: 1 };
  if (/^\d+/.test(s)) return { style: "numeric", level: 1 };
  if (/\p{L}/u.test(s) && s === s.toLocaleUpperCase("tr")) return { style: "caps", level: 1 };
  return { style: "plain", level: 1 };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function parseStructure(text: string): StructureReport {
  const lines = text.split(/\r?\n/);
  const chapters: Chapter[] = [];
  let current: { title: string; untitled: boolean; buf: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.buf.join(" ").trim();
    const words = body ? body.split(/\s+/).length : 0;
    if (current.untitled && words === 0) {
      current = null;
      return;
    }
    const { style, level } = current.untitled
      ? { style: "plain" as HeadingStyle, level: 1 as const }
      : classifyHeading(current.title);
    chapters.push({
      title: current.title,
      words,
      untitled: current.untitled,
      style,
      level,
    });
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === "";
    const heading = isHeadingLine(line) || isSoftHeading(line, prevBlank, nextBlank);
    if (heading) {
      flush();
      current = { title: line.trim(), untitled: false, buf: [] };
    } else {
      if (!current) current = { title: "", untitled: true, buf: [] };
      if (line.trim()) current.buf.push(line.trim());
    }
  }
  flush();

  const titled = chapters.filter((c) => !c.untitled);
  if (titled.length < 2) {
    return { chapters: [], issues: [{ type: "none" }], completeness: null };
  }

  const issues: StructureIssue[] = [];

  // Bölüm dengesi (en az 3 bölümde anlamlı).
  if (titled.length >= 3) {
    const med = median(titled.map((c) => c.words));
    const avg = Math.round(
      titled.reduce((sum, c) => sum + c.words, 0) / titled.length,
    );
    for (const c of titled) {
      if (med > 0 && c.words > med * 2.5) {
        issues.push({ type: "long", title: c.title, words: c.words, avg });
      } else if (med > 0 && c.words < med * 0.4) {
        issues.push({ type: "short", title: c.title, words: c.words, avg });
      }
    }
  }

  // Numara atlaması: yalnız ana (level 1) başlıklardaki ilk sayıları topla;
  // alt başlıkların (örn. "1.1") numaraları ardışıklığı bozmasın.
  const numbers = titled
    .filter((c) => c.level === 1)
    .map((c) => {
      const m = c.title.match(/\d+/);
      return m ? Number(m[0]) : null;
    })
    .filter((n): n is number => n !== null);
  if (numbers.length >= 2) {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    if (max - min + 1 !== numbers.length) {
      issues.push({ type: "gap" });
    }
  }

  // Başlık hiyerarşisi: ana başlık görülmeden gelen alt başlık (öksüz).
  let seenLevel1 = false;
  for (const c of titled) {
    if (c.level === 1) {
      seenLevel1 = true;
    } else if (c.level === 2 && !seenLevel1) {
      issues.push({ type: "hierarchy", title: c.title });
      break;
    }
  }

  // Başlık tutarlılığı: gövde başlıkları (alt başlık ve giriş/sonuç hariç)
  // birden çok biçimde yazılmışsa uyar.
  const bodyStyles = Array.from(
    new Set(
      titled
        .filter((c) => c.level === 1 && c.style !== "named")
        .map((c) => c.style),
    ),
  );
  if (bodyStyles.length >= 2) {
    issues.push({ type: "inconsistent", styles: bodyStyles });
  }

  // Giriş–gelişme–sonuç: giriş ve sonuç bölümü var mı (gelişme = gövde).
  const completeness = {
    intro: titled.some((c) => INTRO_RE.test(c.title)),
    conclusion: titled.some((c) => CONCLUSION_RE.test(c.title)),
  };

  return { chapters, issues, completeness };
}

// ——— Eski/Öneri farkı: ortak baş ve son kelimeler aynı kalır, yalnız DEĞİŞEN
// orta kısım renklendirilir — kullanıcı farkı tek bakışta görsün. ———
function splitDiff(a: string, b: string): { pre: string; aMid: string; bMid: string; post: string } {
  const at = a.split(/(\s+)/);
  const bt = b.split(/(\s+)/);
  let i = 0;
  while (i < at.length && i < bt.length && at[i] === bt[i]) i++;
  let j = 0;
  while (j < at.length - i && j < bt.length - i && at[at.length - 1 - j] === bt[bt.length - 1 - j]) j++;
  return {
    pre: at.slice(0, i).join(""),
    aMid: at.slice(i, at.length - j).join(""),
    bMid: bt.slice(i, bt.length - j).join(""),
    post: at.slice(at.length - j).join(""),
  };
}

// ——— Yayına hazırlık (Kategori 4): yerel/ücretsiz tipografi ———

type PrepKind = "spaces" | "blankLines" | "quotes" | "ellipsis" | "dashRange" | "dialogue";
type PrepFix = { kind: PrepKind; count: number };

function countPrep(kind: PrepKind, text: string): number {
  switch (kind) {
    case "spaces":
      // Satır içi art arda boşluk/sekme + satır sonunda kalan boşluklar.
      return (
        (text.match(/[ \t ]{2,}/g) ?? []).length +
        (text.match(/[^ \t \n][ \t ]+$/gm) ?? []).length
      );
    case "blankLines":
      // Art arda 2+ boş satır (paragraf arası tek boş satır normaldir).
      return (text.match(/\n[ \t ]*\n(?:[ \t ]*\n)+/g) ?? []).length;
    case "quotes":
      return (text.match(/"/g) ?? []).length;
    case "ellipsis":
      return (text.match(/\.{3,}/g) ?? []).length;
    case "dashRange":
      return (text.match(/\d\s*-\s*\d/g) ?? []).length;
    case "dialogue":
      return (text.match(/^[ \t]*[-–][ \t]+\S/gm) ?? []).length;
  }
}

function applyPrep(kind: PrepKind, text: string): string {
  switch (kind) {
    case "spaces":
      // Bölünmez boşluk → normal boşluk; satır sonu boşlukları silinir;
      // satır içi art arda boşluk/sekme tek boşluğa iner.
      return text
        .replace(/ /g, " ")
        .replace(/[ \t]+$/gm, "")
        .replace(/[ \t]{2,}/g, " ");
    case "blankLines":
      return text.replace(/\n[ \t ]*\n(?:[ \t ]*\n)+/g, "\n\n");
    case "quotes": {
      // Düz çift tırnağı bağlama göre açılış/kapanış tipografik tırnağa çevir.
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
          const prev = i === 0 ? "" : text[i - 1];
          const opening = prev === "" || /[\s([{«—–-]/.test(prev);
          out += opening ? "“" : "”";
        } else {
          out += ch;
        }
      }
      return out;
    }
    case "ellipsis":
      return text.replace(/\.{3,}/g, "…");
    case "dashRange":
      return text.replace(/(\d)\s*-\s*(\d)/g, "$1–$2");
    case "dialogue":
      return text.replace(/^([ \t]*)[-–]([ \t]+)/gm, "$1—$2");
  }
}

const PREP_KINDS: PrepKind[] = ["spaces", "blankLines", "quotes", "ellipsis", "dashRange", "dialogue"];

function scanPrep(text: string): PrepFix[] {
  return PREP_KINDS.map((kind) => ({ kind, count: countPrep(kind, text) })).filter(
    (f) => f.count > 0,
  );
}

// Yayına hazırlık görünümü: her tipografi düzeltmesi sayısıyla + tek tık uygula.
function PrepView({
  fixes,
  setRaw,
  t,
}: {
  fixes: PrepFix[];
  setRaw: Dispatch<SetStateAction<string>>;
  t: Dictionary["editorStudio"];
}) {
  if (fixes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <CheckCircleIcon className="mx-auto h-10 w-10 text-accent" />
          <p className="mt-3 text-sm text-muted">{t.prepNone}</p>
        </div>
      </div>
    );
  }

  function title(kind: PrepKind): string {
    switch (kind) {
      case "spaces":
        return t.prepSpacesTitle;
      case "blankLines":
        return t.prepBlankTitle;
      case "quotes":
        return t.prepQuotesTitle;
      case "ellipsis":
        return t.prepEllipsisTitle;
      case "dashRange":
        return t.prepDashRangeTitle;
      case "dialogue":
        return t.prepDialogueTitle;
    }
  }

  function desc(kind: PrepKind): string {
    switch (kind) {
      case "spaces":
        return t.prepSpacesDesc;
      case "blankLines":
        return t.prepBlankDesc;
      case "quotes":
        return t.prepQuotesDesc;
      case "ellipsis":
        return t.prepEllipsisDesc;
      case "dashRange":
        return t.prepDashRangeDesc;
      case "dialogue":
        return t.prepDialogueDesc;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fixes.length >= 2 && (
        <button
          onClick={() =>
            setRaw((prev) =>
              PREP_KINDS.reduce((acc, kind) => applyPrep(kind, acc), prev),
            )
          }
          className="self-start rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          {t.prepApplyAll}
        </button>
      )}
      <ul className="flex flex-col gap-3">
        {fixes.map((f) => (
          <li
            key={f.kind}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {title(f.kind)}
              </span>
              <span className="shrink-0 font-mono text-xs text-accent">
                {t.prepCount.replace("{count}", String(f.count))}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted">{desc(f.kind)}</p>
            <button
              onClick={() => setRaw((prev) => applyPrep(f.kind, prev))}
              className="mt-3 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent-soft"
            >
              {t.prepApply}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Kitap yapısı görünümü: içindekiler (uzunluk çubuklarıyla) + yapı notları.
function StructureView({
  report,
  t,
}: {
  report: StructureReport;
  t: Dictionary["editorStudio"];
}) {
  const noneIssue = report.issues.find((iss) => iss.type === "none");
  if (report.chapters.length === 0 || noneIssue) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <BookIcon className="mx-auto h-10 w-10 text-border" />
          <p className="mt-3 text-sm text-muted">{t.structureNone}</p>
        </div>
      </div>
    );
  }

  const maxWords = Math.max(...report.chapters.map((c) => c.words), 1);
  const issues = report.issues.filter((iss) => iss.type !== "none");

  function styleLabel(style: HeadingStyle): string {
    switch (style) {
      case "bolum":
        return t.structureStyleBolum;
      case "numeric":
        return t.structureStyleNumeric;
      case "caps":
        return t.structureStyleCaps;
      default:
        return t.structureStylePlain;
    }
  }

  function issueText(iss: StructureIssue): string {
    switch (iss.type) {
      case "long":
        return t.structureTooLong
          .replace("{title}", iss.title)
          .replace("{words}", String(iss.words))
          .replace("{avg}", String(iss.avg));
      case "short":
        return t.structureTooShort
          .replace("{title}", iss.title)
          .replace("{words}", String(iss.words))
          .replace("{avg}", String(iss.avg));
      case "gap":
        return t.structureGap;
      case "hierarchy":
        return t.structureHierarchy.replace("{title}", iss.title);
      case "inconsistent":
        return t.structureInconsistent.replace(
          "{styles}",
          iss.styles.map(styleLabel).join(" / "),
        );
      default:
        return "";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {t.structureOutline}
          </span>
          <span className="font-mono text-xs text-accent">
            {t.structureFound.replace("{count}", String(report.chapters.length))}
          </span>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {report.chapters.map((c, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {c.untitled ? t.structureUntitled : c.title}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {c.words} {t.statsWords}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-accent/60"
                  style={{ width: `${Math.max(4, (c.words / maxWords) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>

      {report.completeness && (
        <div>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {t.structureCompletenessHeading}
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                [t.structureIntro, report.completeness.intro],
                [t.structureConclusion, report.completeness.conclusion],
              ] as const
            ).map(([label, ok]) => (
              <span
                key={label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  ok
                    ? "border-accent/40 bg-accent-soft text-foreground"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {ok ? (
                  <CheckCircleIcon className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <span className="text-muted">—</span>
                )}
                {label}: {ok ? t.structurePresent : t.structureMissing}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.structureCompletenessHint}</p>
        </div>
      )}

      {issues.length > 0 && (
        <div>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
            {t.structureIssuesHeading}
          </span>
          <ul className="mt-3 flex flex-col gap-2">
            {issues.map((iss, i) => (
              <li
                key={i}
                className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-foreground"
              >
                {issueText(iss)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ——— Esnek pasaj eşleştirme (Yerini göster / context için) ———
// AI'nin verdiği pasaj metinle birebir aynı olmayabilir: tırnak (" ↔ “ ”),
// tire (- ↔ – ↔ —), üç nokta (... ↔ …) ve boşluk/satır-sonu farkları olur.
// Bu yüzden eşleştirmeyi bu farklara toleranslı yaparız.
const QUOTE_CHARS = "\"'‘’“”«»„‚‹›`´";
const DASH_CHARS = "-‐‑‒–—―−";

function escapeReChar(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Bir karakter sınıfı için içeriği güvenli hâle getirir ([ ] \ ^ - kaçışlanır).
function classBody(chars: string): string {
  return chars.replace(/[\]\\^-]/g, "\\$&");
}

// Pasajı, karakter farklarına toleranslı bir düzenli ifadeye çevirir.
function buildFuzzyRegex(needle: string): RegExp | null {
  const n = needle.trim();
  let out = "";
  let i = 0;
  while (i < n.length) {
    const ch = n[i];
    if (/\s/.test(ch)) {
      out += "\\s+";
      while (i < n.length && /\s/.test(n[i])) i++;
      continue;
    }
    if (QUOTE_CHARS.includes(ch)) {
      out += `[${classBody(QUOTE_CHARS)}]`;
      i++;
      continue;
    }
    if (DASH_CHARS.includes(ch)) {
      out += `[${classBody(DASH_CHARS)}]`;
      i++;
      continue;
    }
    // Nokta/üç nokta dizisi: "…" ↔ "..." ↔ ".." hepsi eşleşsin; tek nokta normal.
    if (ch === "…" || ch === ".") {
      let dots = 0;
      let hasEllipsisChar = false;
      while (i < n.length && (n[i] === "." || n[i] === "…")) {
        if (n[i] === "…") hasEllipsisChar = true;
        else dots++;
        i++;
      }
      out += hasEllipsisChar || dots >= 2 ? "(?:\\u2026|\\.{2,})" : "\\.";
      continue;
    }
    out += escapeReChar(ch);
    i++;
  }
  try {
    return new RegExp(out);
  } catch {
    return null;
  }
}

// Pasajı metin içinde bulur: önce birebir, olmazsa karakter-toleranslı.
function fuzzyFind(
  haystack: string,
  needle: string,
): { at: number; len: number } | null {
  const t = needle.trim();
  if (!t) return null;
  const direct = haystack.indexOf(t);
  if (direct !== -1) return { at: direct, len: t.length };
  const re = buildFuzzyRegex(t);
  if (re) {
    const m = re.exec(haystack);
    if (m) return { at: m.index, len: m[0].length };
  }
  return null;
}

export default function EditorStudio({
  lang,
  dict,
  initialProject,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
}) {
  const t = dict.editorStudio;
  const projectId = initialProject?.id ?? null;

  // Editör yalnız paylaşılan kitap METNİNİ tutar (başlık/yazar yok).
  const [raw, setRaw] = useState(initialProject?.data.manuscript.text ?? "");
  useManuscriptSync(projectId, raw, "editor");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [importing, setImporting] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  // Yüklenen orijinal .docx (biçimi korumak için saklanır) + kabul edilen
  // metin düzeltmeleri (dışa aktarırken orijinalin içine işlenir).
  const [originalDocx, setOriginalDocx] = useState<ArrayBuffer | null>(null);
  const [docxEdits, setDocxEdits] = useState<DocxEdit[]>([]);

  const [checking, setChecking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [risking, setRisking] = useState(false);
  const [genreLoading, setGenreLoading] = useState(false);
  // Uzun metinler otomatik parçalanır; ilerleme (parça/toplam) burada tutulur.
  const [checkProgress, setCheckProgress] = useState<{ done: number; total: number } | null>(null);
  // Sihirbazda seçilen kitap türü editörün tür kipine eşlenir (kişisel gelişim →
  // selfhelp; akademik/bilim/tarih → academic; anlatı türleri → fiction).
  const [genre, setGenre] = useState<Genre>(
    genreEditorMode(initialProject?.data.meta.genre) ?? "fiction",
  );
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [checkError, setCheckError] = useState<string | null>(null);
  const [structure, setStructure] = useState<StructureReport | null>(null);
  const [prep, setPrep] = useState(false);
  // Kontrol anındaki metnin sabit kopyası: kabul edince `raw` değişir, ama
  // bağlam (önerinin metindeki yeri) bu kopyadan hesaplanır ki kaymasın.
  const [checkedText, setCheckedText] = useState("");

  const stats = useMemo(
    () => ({ words: countWords(raw), chars: raw.length }),
    [raw],
  );

  const wsIssues = useMemo(() => countWhitespace(raw), [raw]);

  // Yayına hazırlık fişleri canlı: bir düzeltme uygulayınca `raw` değişir,
  // sayımlar kendiliğinden güncellenir.
  const prepFixes = useMemo(() => scanPrep(raw), [raw]);

  const hasText = raw.trim().length > 0;

  // Metin değişince eski öneriler artık geçersiz; paneli sıfırla.
  function resetResults() {
    setSuggestions(null);
    setDecisions({});
    setCheckError(null);
    setCheckedText("");
    setStructure(null);
    setPrep(false);
    setExportInfo(null);
    // Metin elle değişince/silinince yüklenen docx ile bağ kopar.
    setOriginalDocx(null);
    setDocxEdits([]);
  }

  // Önerinin metindeki yerini, çevresindeki birkaç kelimeyle birlikte bulur.
  // Hatalı kısım ayrı döner ki arayüzde vurgulanabilsin.
  function contextFor(original: string): { before: string; match: string; after: string } | null {
    const src = checkedText;
    if (!src) return null;
    const hit = fuzzyFind(src, original);
    if (!hit) return null;
    const { at, len } = hit;
    const PAD = 45;
    const start = Math.max(0, at - PAD);
    const end = Math.min(src.length, at + len + PAD);
    const before = (start > 0 ? "…" : "") + src.slice(start, at).replace(/\s+/g, " ");
    const match = src.slice(at, at + len).replace(/\s+/g, " ");
    const after = src.slice(at + len, end).replace(/\s+/g, " ") + (end < src.length ? "…" : "");
    return { before, match, after };
  }

  // Bir pasajı `raw` içinde bulur. Karakter (tırnak/tire/üç nokta) + boşluk
  // farklarına toleranslı. Tam pasaj bulunamazsa, en azından yakınına götürmek
  // için baştan birkaç kelimelik bir "çapa" ile dener.
  function findInRaw(needle: string): { at: number; len: number } | null {
    const trimmed = needle.trim();
    if (!trimmed) return null;
    const full = fuzzyFind(raw, trimmed);
    if (full) return full;
    // Çapa: ilk 6 kelime (kısa pasajlarda anlamsız, atla).
    const words = trimmed.split(/\s+/);
    if (words.length > 4) {
      const anchor = words.slice(0, 6).join(" ");
      const a = fuzzyFind(raw, anchor);
      if (a) return a;
    }
    return null;
  }

  // Bir karakter konumunun, metin kutusu içindeki gerçek piksel yüksekliğini
  // ölçer. Uzun satırların sarması (word-wrap) da hesaba katılsın diye, kutunun
  // birebir kopyası gizli bir <div> oluşturup işaretçinin offsetTop'unu okuruz.
  function caretTop(ta: HTMLTextAreaElement, index: number): number {
    const div = document.createElement("div");
    const cs = window.getComputedStyle(ta);
    const copy = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "wordSpacing",
      "textTransform",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ] as const;
    for (const p of copy) div.style[p] = cs[p];
    div.style.position = "absolute";
    div.style.visibility = "hidden";
    div.style.left = "-9999px";
    div.style.top = "0";
    div.style.height = "auto";
    div.style.boxSizing = "border-box";
    div.style.border = "0";
    div.style.width = `${ta.clientWidth}px`;
    div.style.whiteSpace = "pre-wrap";
    div.style.overflowWrap = "break-word";
    div.style.wordWrap = "break-word";
    div.textContent = raw.slice(0, index);
    const marker = document.createElement("span");
    marker.textContent = "​";
    div.appendChild(marker);
    document.body.appendChild(div);
    const top = marker.offsetTop;
    document.body.removeChild(div);
    return top;
  }

  // Öneriye karşılık gelen metni sol kutuda bulur, seçer ve o noktaya kaydırır.
  // Öneri kabul edildiyse artık metinde "düzeltilmiş" hâli (suggestion) vardır.
  function revealInText(s: Suggestion, accepted: boolean) {
    const ta = textareaRef.current;
    if (!ta) return;
    const needle = accepted && s.suggestion ? s.suggestion : s.original;
    const found = findInRaw(needle);
    if (!found) return;
    ta.focus();
    ta.setSelectionRange(found.at, found.at + found.len);
    // Eşleşmenin gerçek piksel konumunu ölç (sarma dahil) ve ortala.
    const top = caretTop(ta, found.at);
    ta.scrollTop = Math.max(0, top - ta.clientHeight / 2);
  }

  async function handleDocx(file: File) {
    setImporting(true);
    setImportError(false);
    setImportInfo(null);
    resetResults();
    try {
      const buffer = await file.arrayBuffer();
      const { text, paragraphCount } = docxToText(buffer);
      setRaw(text);
      // Orijinali sakla: dışa aktarırken biçimi koruyup düzeltmeleri içine işleriz.
      setOriginalDocx(buffer);
      setDocxEdits([]);
      setImportInfo(t.wordImportedInfo.replace("{paragraphs}", String(paragraphCount)));
    } catch {
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  // Düzenlenen metni .docx (Word) olarak indir. Tamamen tarayıcıda üretilir.
  // Yüklenen bir docx varsa ONUN biçimi korunur, kabul edilen düzeltmeler içine
  // işlenir (mizanpaj için yapı bozulmaz). Yoksa düz metinden yeni docx üretilir.
  async function handleExportDocx() {
    if (!hasText) return;
    setExporting(true);
    setExportInfo(null);
    try {
      let blob: Blob;
      let info: string;
      if (originalDocx) {
        const result = applyEditsToDocx(originalDocx, docxEdits);
        blob = result.blob;
        info = t.exportDocxDoneKept.replace("{count}", String(result.applied));
      } else {
        blob = await textToDocx(raw);
        info = t.exportDocxDonePlain;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestDocxName(raw, t.exportDocxFilename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportInfo(info);
    } finally {
      setExporting(false);
    }
  }

  function mapError(code: unknown, max?: number): string {
    switch (code) {
      case "no-key":
        return t.errorNoKey;
      case "bad-key":
        return t.errorBadKey;
      case "rate-limit":
        return t.errorRateLimit;
      case "too-long":
        return t.errorTooLong.replace("{max}", String(max ?? 15000));
      default:
        return t.errorGeneric;
    }
  }

  // Uzun metni parçalara böler, her parçayı endpoint'e gönderir (sınırlı
  // eşzamanlılık) ve dönen dizileri birleştirir. Parçalar sunucu sınırının
  // (15000) altında kaldığından "too-long" hiç tetiklenmez → kullanıcı için
  // karakter sınırı pratikte kalkar. Öneriler alıntı-bazlı olduğu için birleştirme
  // basittir (üst üste binme yok).
  const CHUNK_SIZE = 12000;
  const CONCURRENCY = 3;

  async function runChunked<T>(
    endpoint: string,
    extract: (data: unknown) => T[] | undefined,
    extraBody?: Record<string, unknown>,
  ): Promise<{ items: T[]; error: string | null }> {
    const chunks = chunkText(raw, CHUNK_SIZE);
    const total = chunks.length;
    setCheckProgress(total > 1 ? { done: 0, total } : null);
    let done = 0;
    const items: T[] = [];
    let firstError: string | null = null;

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (chunk): Promise<{ ok: T[] } | { err: string }> => {
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Derin kontrol artık STANDART (seçenek değil): her kontrol en
              // güçlü modelle çalışır — kullanıcı kutucuk/karar yükü taşımaz.
              body: JSON.stringify({ text: chunk, lang, mode: "deep", ...extraBody }),
            });
            if (!res.ok) {
              const d = (await res.json().catch(() => ({}))) as { error?: string; max?: number };
              return { err: mapError(d.error, d.max) };
            }
            const d = (await res.json()) as unknown;
            return { ok: extract(d) ?? [] };
          } catch {
            return { err: t.errorGeneric };
          } finally {
            done += 1;
            if (total > 1) setCheckProgress({ done, total });
          }
        }),
      );
      for (const r of results) {
        if ("ok" in r) items.push(...r.ok);
        else if (!firstError) firstError = r.err;
      }
    }
    setCheckProgress(null);
    // Hiç sonuç yoksa ve hata varsa hatayı bildir; bazı parçalar başardıysa göster.
    return { items, error: items.length === 0 ? firstError : null };
  }

  async function handleCheck() {
    setChecking(true);
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setStructure(null);
    setPrep(false);
    try {
      const { items, error } = await runChunked<AiSuggestion>(
        "/api/editor-check",
        (d) => (d as { suggestions?: AiSuggestion[] }).suggestions,
      );
      if (error && items.length === 0) {
        setCheckError(error);
        return;
      }
      const fixes: Suggestion[] = items.map((s) => ({ ...s, kind: "fix" }));
      setSuggestions(dedupeSuggestions([...fixes, ...findLongSentences(raw)]));
      setCheckedText(raw);
    } catch {
      setCheckError(t.errorGeneric);
    } finally {
      setChecking(false);
      setCheckProgress(null);
    }
  }

  // Editöryal inceleme (Aşama 3): akış, tekrar, üslup, paragraf. Gelen her
  // gözlem advisory bir "notice"; otomatik düzeltme yok.
  async function handleReview() {
    setReviewing(true);
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setStructure(null);
    setPrep(false);
    try {
      const { items, error } = await runChunked<ReviewNote>(
        "/api/editor-review",
        (d) => (d as { notes?: ReviewNote[] }).notes,
      );
      if (error && items.length === 0) {
        setCheckError(error);
        return;
      }
      const notes: Suggestion[] = items.map((n) => ({
        kind: "notice",
        original: n.excerpt,
        suggestion: n.suggestion,
        category: n.category,
        explanation: n.issue,
        severity: n.severity,
      }));
      setSuggestions(dedupeSuggestions(notes));
      setCheckedText(raw);
    } catch {
      setCheckError(t.errorGeneric);
    } finally {
      setReviewing(false);
      setCheckProgress(null);
    }
  }

  // Riskli içerik (Kategori 5): yalnız ciddi yayın/hukuk riskleri. Gelen her
  // gözlem advisory bir "notice"; otomatik düzeltme yok.
  async function handleRisk() {
    setRisking(true);
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setStructure(null);
    setPrep(false);
    try {
      const { items, error } = await runChunked<RiskNote>(
        "/api/editor-risk",
        (d) => (d as { notes?: RiskNote[] }).notes,
      );
      if (error && items.length === 0) {
        setCheckError(error);
        return;
      }
      const notes: Suggestion[] = items.map((n) => ({
        kind: "notice",
        original: n.excerpt,
        suggestion: n.suggestion,
        category: n.category,
        explanation: n.issue,
      }));
      setSuggestions(dedupeSuggestions(notes));
      setCheckedText(raw);
    } catch {
      setCheckError(t.errorGeneric);
    } finally {
      setRisking(false);
      setCheckProgress(null);
    }
  }

  // Türe göre özel kontrol (Kategori 6): seçilen türe (roman, kişisel gelişim,
  // akademik) özel başlıklar. Gelen her gözlem advisory bir "notice".
  async function handleGenre() {
    setGenreLoading(true);
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setStructure(null);
    setPrep(false);
    try {
      const { items, error } = await runChunked<GenreNote>(
        "/api/editor-genre",
        (d) => (d as { notes?: GenreNote[] }).notes,
        { genre },
      );
      if (error && items.length === 0) {
        setCheckError(error);
        return;
      }
      const notes: Suggestion[] = items.map((n) => ({
        kind: "notice",
        original: n.excerpt,
        suggestion: n.suggestion,
        category: n.category,
        explanation: n.issue,
      }));
      setSuggestions(dedupeSuggestions(notes));
      setCheckedText(raw);
    } catch {
      setCheckError(t.errorGeneric);
    } finally {
      setGenreLoading(false);
      setCheckProgress(null);
    }
  }

  // Kitap yapısı (Kategori 3): tamamen yerel, API harcaması yok. Metni
  // bölümlere ayırıp içindekiler + denge/numara notları çıkarır.
  function handleStructure() {
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setCheckedText("");
    setPrep(false);
    setStructure(parseStructure(raw));
  }

  // Yayına hazırlık (Kategori 4): yerel tipografi görünümünü aç.
  function handlePrep() {
    setCheckError(null);
    setSuggestions(null);
    setDecisions({});
    setCheckedText("");
    setStructure(null);
    setPrep(true);
  }

  function catLabel(category: Category): string {
    switch (category) {
      case "spelling":
        return t.catSpelling;
      case "grammar":
        return t.catGrammar;
      case "long":
        return t.catLong;
      case "repetition":
        return t.catRepetition;
      case "flow":
        return t.catFlow;
      case "tone":
        return t.catTone;
      case "paragraph":
        return t.catParagraph;
      case "defamation":
        return t.catDefamation;
      case "privacy":
        return t.catPrivacy;
      case "copyright":
        return t.catCopyright;
      case "claim":
        return t.catClaim;
      case "misinfo":
        return t.catMisinfo;
      case "character":
        return t.catCharacter;
      case "timeline":
        return t.catTimeline;
      case "plot":
        return t.catPlot;
      case "promise":
        return t.catPromise;
      case "action":
        return t.catAction;
      case "citation":
        return t.catCitation;
      case "definition":
        return t.catDefinition;
      case "objectivity":
        return t.catObjectivity;
      case "fluency":
        return t.catFluency;
      case "sentence_structure":
        return t.catSentenceStructure;
      case "diction":
        return t.catDiction;
      case "dialogue":
        return t.catDialogue;
      case "concision":
        return t.catConcision;
      case "clarity":
        return t.catClarity;
      case "register":
        return t.catRegister;
      case "punctuation":
        return t.catPunctuation;
    }
  }

  // Önem düzeyi etiketi (yalnız Gold üslup notlarında).
  function severityLabel(s: Severity): string {
    switch (s) {
      case "warn":
        return t.severityWarn;
      case "suggest":
        return t.severitySuggest;
      case "hint":
        return t.severityHint;
    }
  }

  function acceptSuggestion(index: number) {
    const s = suggestions?.[index];
    if (!s) return;
    setRaw((prev) => {
      const at = prev.indexOf(s.original);
      if (at === -1) return prev;
      return prev.slice(0, at) + s.suggestion + prev.slice(at + s.original.length);
    });
    setDecisions((prev) => ({ ...prev, [index]: "accepted" }));
    // Yüklenen docx'e de işlenebilmesi için kabul edilen metin düzeltmesini sakla.
    if (s.kind === "fix" && s.suggestion && originalDocx) {
      setDocxEdits((prev) => [
        ...prev,
        { original: s.original, suggestion: s.suggestion },
      ]);
    }
  }

  function rejectSuggestion(index: number) {
    setDecisions((prev) => ({ ...prev, [index]: "rejected" }));
  }

  const pendingCount = suggestions
    ? suggestions.filter((_, i) => !decisions[i]).length
    : 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-4 px-4 py-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-[380px]">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TextTIcon className="h-5 w-5 text-accent" />
            {t.textHeading}
          </div>

          <label className="mt-3 block text-xs font-medium text-muted">{t.textLabel}</label>
          <textarea
            ref={textareaRef}
            value={raw}
            onChange={(e) => {
              // Elle düzenleme sonuçları SİLMEZ; yalnız metni günceller.
              // (Toptan değişimler — Temizle/Örnek/Word yükleme — resetResults yapar.)
              setRaw(e.target.value);
              setCheckError(null);
              setExportInfo(null);
            }}
            placeholder={t.textPlaceholder}
            rows={14}
            className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition selection:bg-accent/30 selection:text-foreground focus:border-accent"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRaw(SAMPLE_TR);
                  resetResults();
                }}
                className="font-medium text-accent transition hover:underline"
              >
                {t.sampleCta}
              </button>
              <button
                onClick={() => {
                  setRaw("");
                  resetResults();
                }}
                className="font-medium transition hover:text-foreground"
              >
                {t.clearCta}
              </button>
            </div>
            <span>
              {stats.words} {t.statsWords} · {stats.chars} {t.statsChars}
            </span>
          </div>

          {wsIssues > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <div className="text-xs text-muted">
                <span className="font-medium text-foreground">
                  {t.tidyCount.replace("{count}", String(wsIssues))}
                </span>
                <span className="mt-0.5 block">{t.tidyHint}</span>
              </div>
              <button
                onClick={() => {
                  setRaw((prev) => cleanWhitespace(prev));
                  resetResults();
                }}
                className="shrink-0 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent-soft"
              >
                {t.tidyCta}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDocx(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BookIcon className="h-4 w-4 text-accent" />
            {importing ? t.wordImporting : t.wordCta}
          </button>
          {importInfo && (
            <p className="mt-1.5 text-xs text-muted">{importInfo}</p>
          )}
          {importError && (
            <p className="mt-1.5 text-xs text-red-500">{t.wordError}</p>
          )}
          <p className="mt-1.5 text-xs text-muted">{t.wordHint}</p>

          <button
            onClick={handleExportDocx}
            disabled={!hasText || exporting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : (
              <BookIcon className="h-4 w-4 text-accent" />
            )}
            {exporting ? t.exportDocxBusy : t.exportDocxCta}
          </button>
          <p className="mt-1.5 text-xs text-muted">
            {originalDocx ? t.exportDocxHintKept : t.exportDocxHint}
          </p>
          {exportInfo && (
            <p className="mt-1 text-xs text-accent">{exportInfo}</p>
          )}

          {/* KONTROLLER — numaralı adımlar (1-6). Derin kontrol artık standart;
              onay kutusu yok. Her düğmenin solunda sıra rozeti: karmaşa yerine
              yukarıdan aşağı izlenen net bir sıra. */}
          <div className="mt-5 h-px bg-border" />

          <button
            onClick={handleCheck}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-4 flex w-full items-center gap-2.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {checking ? (
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 font-mono text-[11px] font-bold">1</span>
            )}
            {checking ? t.checking : t.checkCta}
          </button>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.checkHint}</p>

          <button
            onClick={handleReview}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reviewing ? (
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">2</span>
            )}
            {reviewing ? t.reviewing : t.reviewCta}
          </button>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.reviewHint}</p>

          <button
            onClick={handleStructure}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">3</span>
            {t.structureCta}
          </button>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.structureHint}</p>

          <button
            onClick={handlePrep}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">4</span>
            {t.prepCta}
          </button>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.prepHint}</p>

          <button
            onClick={handleRisk}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {risking ? (
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">5</span>
            )}
            {risking ? t.risking : t.riskCta}
          </button>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.riskHint}</p>

          <button
            onClick={handleGenre}
            disabled={!hasText || checking || reviewing || risking || genreLoading}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {genreLoading ? (
              <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">6</span>
            )}
            {genreLoading ? t.genreLoading : t.genreCta}
          </button>
          {/* Tür seçimi 6. kontrolün parçası — düğmenin hemen altında, hizalı. */}
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as Genre)}
            className="ml-[30px] mt-1.5 w-[calc(100%-30px)] rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none transition focus:border-accent"
            aria-label={t.genreLabel}
          >
            <option value="fiction">{t.genreFiction}</option>
            <option value="selfhelp">{t.genreSelfhelp}</option>
            <option value="academic">{t.genreAcademic}</option>
          </select>
          <p className="mt-1.5 pl-[30px] text-xs text-muted">{t.genreHint}</p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background lg:sticky lg:top-4 lg:h-[calc(100dvh-12rem)]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
            {t.resultsHeading}
          </span>
          {suggestions && suggestions.length > 0 && (
            <span className="font-mono text-xs text-accent">
              {t.resultsCount.replace("{count}", String(pendingCount))}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {checkError ? (
            <div className="mx-auto mt-6 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {checkError}
            </div>
          ) : structure ? (
            <StructureView report={structure} t={t} />
          ) : prep ? (
            <PrepView fixes={prepFixes} setRaw={setRaw} t={t} />
          ) : checking || reviewing || risking || genreLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
                {genreLoading
                  ? t.genreLoading
                  : risking
                    ? t.risking
                    : reviewing
                      ? t.reviewing
                      : t.checking}
                {checkProgress && checkProgress.total > 1
                  ? ` ${checkProgress.done}/${checkProgress.total}`
                  : ""}
              </div>
            </div>
          ) : suggestions === null ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="max-w-sm text-center">
                <CheckCircleIcon className="mx-auto h-10 w-10 text-border" />
                <p className="mt-3 text-sm text-muted">{t.emptyResults}</p>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="max-w-sm text-center">
                <CheckCircleIcon className="mx-auto h-10 w-10 text-accent" />
                <p className="mt-3 text-sm text-muted">{t.noIssues}</p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {suggestions.map((s, i) => {
                const decision = decisions[i];
                return (
                  <li
                    key={i}
                    className={`rounded-lg border p-3 transition ${
                      decision === "accepted"
                        ? "border-accent/30 bg-accent-soft"
                        : decision === "rejected"
                          ? "border-border bg-surface opacity-60"
                          : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted">
                        {catLabel(s.category)}
                      </span>
                      {s.severity && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.severity === "warn"
                              ? "bg-amber-100 text-amber-700"
                              : s.severity === "suggest"
                                ? "bg-accent-soft text-accent"
                                : "bg-surface text-muted"
                          }`}
                        >
                          {severityLabel(s.severity)}
                        </span>
                      )}
                    </div>

                    {s.kind === "fix" &&
                      (() => {
                        // Yalnız değişen kısım renkli: fark tek bakışta görünsün.
                        const d = splitDiff(s.original, s.suggestion);
                        return (
                          <div className="mt-2 space-y-1 text-sm">
                            <div className="flex gap-2">
                              <span className="shrink-0 font-mono text-[10px] uppercase text-muted">
                                {t.origLabel}
                              </span>
                              <span className="text-foreground">
                                {d.pre}
                                {d.aMid && (
                                  <span className="rounded bg-red-50 px-0.5 text-red-700 line-through decoration-red-400">
                                    {d.aMid}
                                  </span>
                                )}
                                {d.post}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <span className="shrink-0 font-mono text-[10px] uppercase text-muted">
                                {t.fixLabel}
                              </span>
                              <span className="font-medium text-foreground">
                                {d.pre}
                                {d.bMid && (
                                  <span className="rounded bg-emerald-100 px-0.5 font-semibold text-emerald-800">
                                    {d.bMid}
                                  </span>
                                )}
                                {d.post}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                    <p className="mt-2 text-xs text-muted">
                      {s.category === "long"
                        ? t.longExplain.replace("{count}", String(s.wordCount ?? 0))
                        : s.explanation}
                    </p>

                    {s.kind === "notice" && s.category !== "long" && s.suggestion && (
                      <div className="mt-2 flex gap-2 text-sm">
                        <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase text-muted">
                          {t.fixLabel}
                        </span>
                        <span className="text-foreground">{s.suggestion}</span>
                      </div>
                    )}

                    {(() => {
                      const ctx = contextFor(s.original);
                      if (!ctx) return null;
                      return (
                        <div className="mt-2">
                          <span className="font-mono text-[10px] uppercase text-muted">
                            {t.contextLabel}
                          </span>
                          <p className="mt-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed text-muted">
                            {ctx.before}
                            <mark className="rounded bg-accent-soft px-0.5 font-medium text-foreground">
                              {ctx.match}
                            </mark>
                            {ctx.after}
                          </p>
                        </div>
                      );
                    })()}

                    <button
                      onClick={() => revealInText(s, decision === "accepted")}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:underline"
                    >
                      <TextTIcon className="h-3.5 w-3.5" />
                      {t.revealCta}
                    </button>

                    {!decision && s.kind === "fix" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => acceptSuggestion(i)}
                          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                        >
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          {t.acceptCta}
                        </button>
                        <button
                          onClick={() => rejectSuggestion(i)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                        >
                          {t.rejectCta}
                        </button>
                      </div>
                    )}

                    {!decision && s.kind === "notice" && (
                      <div className="mt-3">
                        <button
                          onClick={() => rejectSuggestion(i)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                        >
                          {t.dismissCta}
                        </button>
                      </div>
                    )}

                    {decision === "accepted" && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-accent/30 bg-accent-soft px-3 py-2">
                        <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div className="text-xs">
                          <div className="font-semibold text-accent">{t.accepted}</div>
                          <div className="mt-0.5 text-foreground">
                            «{s.original}» → «<span className="font-medium">{s.suggestion}</span>»
                          </div>
                          <div className="mt-0.5 text-muted">{t.appliedNote}</div>
                        </div>
                      </div>
                    )}

                    {decision === "rejected" && (
                      <div className="mt-3 text-xs text-muted">
                        {s.kind === "notice" ? t.dismissed : t.rejected}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
