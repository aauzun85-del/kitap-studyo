"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import WizardGuide from "@/components/app/WizardGuide";
import { completeWizardStep } from "@/lib/projects/data";
import {
  ManuscriptEditor,
  setBlockStyle,
  toggleInline,
  insertTokenLine,
  insertFootnote,
  type BlockStyle,
  type ManuscriptApi,
  type ManuscriptMark,
  type ManuscriptState,
} from "@/components/editor/ManuscriptEditor";
import type { Dispatch, SetStateAction } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { requireExport } from "@/lib/credits/exportGate";
import { creditCost, type CreditAction } from "@/lib/credits/pricing";
import CreditNotice, {
  creditProblemFrom,
  creditProblemText,
  type CreditProblem,
} from "@/components/credits/CreditNotice";
import { useManuscriptSync } from "@/lib/projects/useSync";
import { useSaveStatus, formatSavedTime, SAVE_LABELS } from "@/lib/projects/saveStatus";
import { genreEditorMode } from "@/lib/projects/genres";
import { chunkText } from "@/lib/editor/chunk";
import { docxToText } from "@/lib/editor/docxText";
import { textToDocx, suggestDocxName } from "@/lib/editor/textToDocx";
import { applyEditsToDocx, type DocxEdit } from "@/lib/editor/docxEdit";
/** Dipnot tanımı satırına düşen düzeltme (Word gövdesine işlenmez). */
type DocxEditNote = DocxEdit & { inNote?: boolean };
import { isFnDefLine, preserveFootnoteRefs, refRanges, stripRefs, withoutDefLines } from "@/lib/editor/footnoteEdit";
import {
  useEditorSession,
  patchSession,
  beginJob,
  isCurrentJob,
  finishJob,
  stopJob,
  cancelJob,
  dropSession,
  type CheckKind,
  type EditorSession,
  type FixAction,
  type TextChange,
} from "@/lib/editor/session";
import {
  TextTIcon,
  CheckCircleIcon,
  BookIcon,
  SlidersIcon,
  MagicWandIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  CaretDownIcon,
  ArrowsOutIcon,
} from "@/components/PhosphorIcons";

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

export type Suggestion = {
  kind: "fix" | "notice";
  original: string;
  suggestion: string;
  category: Category;
  explanation: string;
  wordCount?: number;
  severity?: Severity;
  /** Not kartları için: pasajın yerine konabilecek düzeltilmiş hâli. Varsa
   *  kart "Uygula" düğmesi gösterir (yoksa yalnız tavsiye). */
  rewrite?: string;
};

// Parçalı kontrolde aynı öneri birden çok parçada çıkabilir; tekilleştir.
// Ayrıca DEĞİŞİKLİK İÇERMEYEN "düzeltme"leri ele: model bazen sorun bulamadığı
// cümleyi aynen geri döndürür ("bu yapı zaten doğru" açıklamasıyla). ESKİ=ÖNERİ
// olan kart kullanıcıya iş yaptırmaz — hiç gösterme (boşluk farkları sayılmaz).
const normalizeForCompare = (s: string) => s.replace(/\s+/g, " ").trim();
// Notun "rewrite"ı ancak gerçek bir değişiklikse ve makul uzunluktaysa kullanılır.
function usableRewrite(excerpt: string, rewrite: string | undefined): string | undefined {
  const r = (rewrite ?? "").trim();
  if (!r || normalizeForCompare(r) === normalizeForCompare(excerpt)) return undefined;
  if (r.length > Math.max(400, excerpt.length * 3)) return undefined;
  return r;
}
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
  /** Pasajın yerine konacak düzeltilmiş hâli (yoksa boş). */
  rewrite?: string;
};

// Riskli içerik route'undan gelen ham gözlem.
type RiskNote = {
  excerpt: string;
  category: "defamation" | "privacy" | "copyright" | "claim" | "misinfo";
  issue: string;
  suggestion: string;
  /** Pasajın yerine konacak düzeltilmiş hâli (yoksa boş). */
  rewrite?: string;
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
  /** Pasajın yerine konacak düzeltilmiş hâli (yoksa boş). */
  rewrite?: string;
};

type Genre = "fiction" | "selfhelp" | "academic";

export type Decision = "accepted" | "rejected";

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
  // Dipnot tanım satırları ölçülmez; [^1] işaretleri kelime sayılmaz.
  const parts = withoutDefLines(text).split(/(?<=[.!?…])\s+|\n+/);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const sentence = part.trim();
    if (!sentence || seen.has(sentence)) continue;
    const words = stripRefs(sentence).trim().split(/\s+/).length;
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
  // mdLevel: başlık markdown ile işaretlendiyse ("# …" / "## …") düzeyi.
  let current: { title: string; untitled: boolean; buf: string[]; mdLevel?: number } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.buf.join(" ").trim();
    const words = body ? body.split(/\s+/).length : 0;
    if (current.untitled && words === 0) {
      current = null;
      return;
    }
    const cls = current.untitled
      ? { style: "plain" as HeadingStyle, level: 1 as const }
      : classifyHeading(current.title);
    const style = cls.style;
    const level: 1 | 2 = current.mdLevel ? (current.mdLevel === 1 ? 1 : 2) : cls.level;
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
    // Dipnot tanımı ("[^1]: …") başlık sayılmaz, bölüm kelimesine katılmaz;
    // [^1] işaretleri ölçmeden önce silinir.
    if (isFnDefLine(lines[i])) continue;
    const line = stripRefs(lines[i]);
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextBlank = i === lines.length - 1 || lines[i + 1].trim() === "";
    // Sayfa görünümünde "Bölüm başlığı / Alt başlık" ile işaretlenen başlıklar.
    const md = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    const heading = !!md || isHeadingLine(line) || isSoftHeading(line, prevBlank, nextBlank);
    if (heading) {
      flush();
      current = md
        ? { title: md[2].replace(/\*+/g, "").trim(), untitled: false, buf: [], mdLevel: md[1].length }
        : { title: line.trim(), untitled: false, buf: [] };
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

// ——— Toplu düzeltme + geri alma yardımcıları ———

// Toplu düzeltmeye uygun mu? Yalnız YAZIM hatası ve tek kelimelik değişiklik
// ("birşey" → "bir şey", "yinede" → "yine de"). Dilbilgisi düzeltmeleri bağlama
// bağlıdır (aynı kelime başka cümlede doğru olabilir) → toplu sunulmaz.
function bulkPair(s: Suggestion): { from: string; to: string } | null {
  if (s.kind !== "fix" || s.category !== "spelling" || !s.suggestion) return null;
  // Dipnot işaretleri ([^1]) farka girmez: toplu değiştirme yalnız kelimeye dokunur.
  const d = splitDiff(stripRefs(s.original), stripRefs(s.suggestion));
  const from = d.aMid.trim();
  const to = d.bMid.trim();
  if (from.length < 3 || /\s/.test(from) || !/\p{L}/u.test(from) || !to || from === to) return null;
  if (from.includes("[^") || to.includes("[^")) return null;
  return { from, to };
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isUpperTr = (ch: string) => ch !== ch.toLocaleLowerCase("tr");
const capTr = (x: string) => x.charAt(0).toLocaleUpperCase("tr") + x.slice(1);

// Kelimenin metindeki tüm geçişleri: kelime sınırlı; ilk harf büyük/küçük
// fark etmez (cümle başı "Birşey" de yakalanır; Türkçe İ/i doğru eşlenir).
function wordRegex(word: string): RegExp {
  const f = word.charAt(0);
  const first = `[${escapeRe(f.toLocaleLowerCase("tr"))}${escapeRe(f.toLocaleUpperCase("tr"))}]`;
  return new RegExp(`(?<![\\p{L}\\p{N}])${first}${escapeRe(word.slice(1))}(?![\\p{L}\\p{N}])`, "gu");
}

// `near` konumuna en yakın `needle` geçişi (araya başka düzeltmeler girip
// metin kaydıysa da doğru yeri bulmak için).
function nearestIndexOf(text: string, needle: string, near: number): number {
  if (text.startsWith(needle, near)) return near;
  const after = text.indexOf(needle, near);
  const before = text.lastIndexOf(needle, near);
  if (after === -1) return before;
  if (before === -1) return after;
  return near - before <= after - near ? before : after;
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
  onPick,
}: {
  report: StructureReport;
  t: Dictionary["editorStudio"];
  /** Bölüme tıklanınca metinde o başlığa git. */
  onPick?: (title: string) => void;
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
              onClick={onPick && !c.untitled ? () => onPick(c.title) : undefined}
              onKeyDown={
                onPick && !c.untitled
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPick(c.title);
                      }
                    }
                  : undefined
              }
              tabIndex={onPick && !c.untitled ? 0 : undefined}
              className={`rounded-lg border border-border bg-surface px-3 py-2 ${
                onPick && !c.untitled ? "cursor-pointer transition hover:border-accent/50" : ""
              }`}
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
  // AI pasajı dipnot işaretini ([^1]) atlamış olabilir: kelime sonlarında
  // isteğe bağlı işarete izin ver (metinde işaret yoksa eşleşme aynıdır).
  const ref = n.includes("[^") ? "" : "(?:\\[\\^[^\\]\\s]+\\])?";
  let out = "";
  let i = 0;
  while (i < n.length) {
    const ch = n[i];
    if (/\s/.test(ch)) {
      out += ref + "\\s+";
      while (i < n.length && /\s/.test(n[i])) i++;
      continue;
    }
    if (QUOTE_CHARS.includes(ch)) {
      out += ref + `[${classBody(QUOTE_CHARS)}]`;
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
      out += ref + (hasEllipsisChar || dots >= 2 ? "(?:\\u2026|\\.{2,})" : "\\.");
      continue;
    }
    if (/[,;:!?)]/.test(ch)) out += ref;
    out += escapeReChar(ch);
    i++;
  }
  out += ref;
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

type SuggestionContext = { before: string; match: string; after: string };

// Önerinin kontrol metnindeki yerini, çevresindeki birkaç kelimeyle bulur
// (hatalı kısım ayrı döner ki vurgulanabilsin). SAF fonksiyon: bileşen dışında,
// böylece sonuçları kontrol metni değişince BİR kez hesaplayıp saklayabiliriz.
function contextIn(src: string, original: string): SuggestionContext | null {
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

// Her AI kontrolünün sunucuda yaktığı jeton kalemi (uç noktalardaki
// chargeCredits ile aynı). Kontroller hep "deep" gönderildiği için editöryal
// inceleme derin fiyattan düşer. Bedel PARÇA başınadır.
const CHECK_ACTION: Record<CheckKind, CreditAction> = {
  check: "editor-check",
  review: "editor-review-deep",
  risk: "editor-risk",
  genre: "editor-genre",
};
// Toplam bedel bunu aşarsa başlamadan önce sorulur.
const CONFIRM_OVER = 10;
// "Kitabın ilk ~N sayfası" tahmini için: bir kitap sayfası ≈ 1800 karakter.
const CHARS_PER_PAGE = 1800;

/** Jeton yüzünden yarıda kalan / bilerek kısaltılan inceleme. `problem` null =
 *  üye "yalnız jetonumun yettiği kadarını incele" dedi. */
type CreditStop = { problem: CreditProblem | null; done: number; total: number };

export default function EditorStudio({
  lang,
  dict,
  initialProject,
  canExport,
  creditBalance,
  user,
  signOut,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
  /** Aktif jeton paketi var mı? false ise Word indirme kilitli. */
  canExport: boolean;
  /** Sayfa açılırkenki jeton bakiyesi; yönetici için null (sınırsız). */
  creditBalance: number | null;
  /** Üst çubuktaki hesap menüsü için. */
  user?: { name: string; initials: string } | null;
  signOut?: () => Promise<void>;
}) {
  const t = dict.editorStudio;
  const isTr = lang === "tr";
  const projectId = initialProject?.id ?? null;

  // Editör yalnız paylaşılan kitap METNİNİ tutar (başlık/yazar yok).
  const [raw, setRaw] = useState(initialProject?.data.manuscript.text ?? "");
  // Ertelenmiş metin: ağır sayımlar (kelime, boşluk, tipografi fişleri, toplu
  // düzeltme adetleri) tuş vuruşunu bloklamasın; yazma durunca güncellenir.
  const deferredRaw = useDeferredValue(raw);
  const { saveNow, canSave } = useManuscriptSync(
    projectId,
    raw,
    "editor",
    initialProject?.data.manuscript.updatedAt ?? null,
  );
  const saveStatus = useSaveStatus();
  // ⌘S / Ctrl+S → tarayıcının "sayfayı kaydet"i yerine kitabı buluta kaydet.
  useEffect(() => {
    if (!canSave) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, saveNow]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState<string | null>(null);
  // AI kontrollerinin işi, ilerlemesi ve sonuçları bileşende DEĞİL, proje
  // başına oturum deposunda yaşar (src/lib/editor/session.ts): kullanıcı
  // inceleme sürerken Mizanpaj/Kapak'a bakıp dönerse iş sürer, sonuçlar
  // kaybolmaz. Projesiz (anonim) editörde oturum bu ekrana özeldir.
  const [anonKey] = useState(() => `anon-${Math.random().toString(36).slice(2)}`);
  const sessionKey = projectId ?? anonKey;
  const session = useEditorSession(sessionKey);
  const {
    running,
    progress: checkProgress,
    suggestions,
    decisions,
    checkError,
    stopped,
    // Kontrol anındaki metnin sabit kopyası: kabul edince `raw` değişir, ama
    // bağlam (önerinin metindeki yeri) bu kopyadan hesaplanır ki kaymasın.
    checkedText,
    // Yüklenen orijinal .docx (biçimi korumak için saklanır) + kabul edilen
    // metin düzeltmeleri (dışa aktarırken orijinalin içine işlenir).
    originalDocx,
    docxEdits,
    fixActions,
    // Word'den gelen metinde ELLE değişiklik yapıldı mı? (Yapıldıysa Word indirme,
    // orijinal dosyaya yalnız önerileri işleyemez → metnin son hâlinden üretir.)
    manualEdit,
  } = session;
  const reviewing = running === "review";
  const risking = running === "risk";
  const genreLoading = running === "genre";

  const patch = (p: Partial<EditorSession>) => patchSession(sessionKey, p);
  const setDecisions = (v: SetStateAction<Record<number, Decision>>) =>
    patchSession(sessionKey, (s) => ({ decisions: typeof v === "function" ? v(s.decisions) : v }));
  const setDocxEdits = (v: SetStateAction<DocxEdit[]>) =>
    patchSession(sessionKey, (s) => ({ docxEdits: typeof v === "function" ? v(s.docxEdits) : v }));
  // Yalnız Word'den gelen metin için anlamlı; değişmediyse depoya yazma.
  const setManualEdit = (v: boolean) => {
    if (v !== manualEdit) patch({ manualEdit: v });
  };
  const setFixActions = (v: SetStateAction<FixAction[]>) =>
    patchSession(sessionKey, (s) => ({ fixActions: typeof v === "function" ? v(s.fixActions) : v }));

  // Anonim editörden çıkınca iş durur ve oturum unutulur (metin de kaybolduğu
  // için sonuçları saklamanın anlamı yok). Projeli editörde iş SÜRER.
  useEffect(() => {
    if (projectId) return;
    return () => dropSession(sessionKey);
  }, [projectId, sessionKey]);

  // Sihirbazda seçilen kitap türü editörün tür kipine eşlenir (kişisel gelişim →
  // selfhelp; akademik/bilim/tarih → academic; anlatı türleri → fiction).
  const [genre, setGenre] = useState<Genre>(
    genreEditorMode(initialProject?.data.meta.genre) ?? "fiction",
  );

  // JETON — bakiyenin yerel kopyası: başarılı her parçadan sonra düşülür, sunucu
  // 402 ile bakiye bildirirse o sayı esas alınır. null = yönetici (sınırsız).
  const [balance, setBalance] = useState<number | null>(creditBalance);
  // Başlamadan önce bedeli onaylatılan kontrol (yoksa null).
  const [pendingKind, setPendingKind] = useState<CheckKind | null>(null);
  // Jeton/oturum yüzünden yarıda kalan ya da bilerek kısaltılan son inceleme.
  const [creditStop, setCreditStop] = useState<CreditStop | null>(null);

  // Sunucudan yeni bakiye gelirse (sayfa yenilendi, yönetici jeton tanımladı)
  // yerel kopya ona eşitlenir.
  const [seenBalance, setSeenBalance] = useState<number | null>(creditBalance);
  if (seenBalance !== creditBalance) {
    setSeenBalance(creditBalance);
    setBalance(creditBalance);
  }

  // Bedel onayı dar ekranda düğmelerin altında kalır: açılınca görünür yere
  // kaydırılır ve odak ilk düğmesine taşınır (üye "düğme çalışmadı" sanmasın).
  const confirmRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  function revealConfirm() {
    confirmRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    confirmBtnRef.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (pendingKind) revealConfirm();
  }, [pendingKind]);

  // Bu üç sayım tüm metin üzerinde ~11 geçiş yapar; her tuşta değil, yazma
  // durunca (ertelenmiş metinle) hesaplanır → tuş vuruşu takılmaz.
  const stats = useMemo(
    () => ({ words: countWords(deferredRaw), chars: deferredRaw.length }),
    [deferredRaw],
  );

  const wsIssues = useMemo(() => countWhitespace(deferredRaw), [deferredRaw]);

  // Yayına hazırlık fişleri canlı: bir düzeltme uygulayınca metin değişir,
  // sayımlar (kısa bir gecikmeyle) kendiliğinden güncellenir.
  const prepFixes = useMemo(() => scanPrep(deferredRaw), [deferredRaw]);

  const hasText = raw.trim().length > 0;

  // Metin değişince eski öneriler artık geçersiz; paneli sıfırla. Süren bir
  // kontrol varsa o da sessizce iptal edilir (yeni metne eski sonuç yazılmasın).
  function resetResults() {
    cancelJob(sessionKey);
    patch({
      suggestions: null,
      decisions: {},
      fixActions: [],
      checkError: null,
      checkedText: "",
      stopped: null,
      // Metin elle değişince/silinince yüklenen docx ile bağ kopar.
      originalDocx: null,
      docxEdits: [],
    });
    setExportInfo(null);
    setPendingKind(null);
    setCreditStop(null);
    setManualEdit(false);
  }

  // PERFORMANS (29 bin kelimelik kitapta donma): eskiden her kart her render'da
  // kontrol metnini (200 bin karakter) baştan tarıyordu → her tuşta N kart × tam
  // tarama. Kontrol metni yazarken DEĞİŞMEZ; bağlamlar ve farklar yalnız
  // öneriler / kontrol metni değişince BİR kez hesaplanıp saklanır.
  const contexts = useMemo<(SuggestionContext | null)[]>(
    () => (suggestions ?? []).map((s) => contextIn(checkedText, s.original)),
    [suggestions, checkedText],
  );
  const diffs = useMemo(
    () =>
      (suggestions ?? []).map((s) =>
        s.kind === "fix"
          ? splitDiff(s.original, s.suggestion)
          : s.rewrite
            ? splitDiff(s.original, s.rewrite)
            : null,
      ),
    [suggestions],
  );


  async function handleDocx(file: File) {
    setImporting(true);
    setImportError(false);
    setImportInfo(null);
    resetResults();
    try {
      const buffer = await file.arrayBuffer();
      const res = docxToText(buffer);
      const { text, paragraphCount } = res;
      const footnoteCount = (res as { footnoteCount?: number }).footnoteCount ?? 0;
      setRaw(text);
      setManualEdit(false);
      // Orijinali sakla: dışa aktarırken biçimi koruyup düzeltmeleri içine işleriz.
      patch({ originalDocx: buffer, docxEdits: [] });
      setImportInfo(
        t.wordImportedInfo.replace("{paragraphs}", String(paragraphCount)) +
          (footnoteCount > 0 ? (isTr ? ` ${footnoteCount} dipnot da alındı.` : ` ${footnoteCount} footnotes imported too.`) : ""),
      );
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
    if (!requireExport(canExport, lang)) return;
    setExporting(true);
    setExportInfo(null);
    try {
      let blob: Blob;
      let info: string;
      if (originalDocx && !manualEdit) {
        const result = applyEditsToDocx(originalDocx, docxEdits);
        blob = result.blob;
        info = t.exportDocxDoneKept.replace("{count}", String(result.applied));
      } else {
        blob = await textToDocx(raw);
        // Word'den gelen metinde elle değişiklik yapıldıysa orijinal dosyaya
        // yalnız öneriler işlenebildiği için, hiçbir değişiklik kaybolmasın diye
        // dosya metnin SON hâlinden yeniden üretilir.
        info = originalDocx
          ? isTr
            ? "Word dosyası metnin son hâliyle oluşturuldu (elle yaptığın değişiklikler dahil). Orijinal dosyanın yazı biçimi bu yüzden korunmadı."
            : "The Word file was rebuilt from the current text (including your own edits), so the original file's formatting was not kept."
          : t.exportDocxDonePlain;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestDocxName(raw, t.exportDocxFilename, new Date());
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

  // İlerleme ve sonuçlar oturum deposuna yazılır; bu yüzden kullanıcı başka
  // adıma geçse de (bileşen kapansa da) iş sürer. `signal` iptal edilince
  // ("Durdur") kalan parçalar HİÇ gönderilmez — boşa istek ve maliyet yok.
  // Bir parça 402/401 dönerse (jeton bitti / oturum kapandı) sonraki parçalar da
  // gönderilmez; o ana kadar dönenler korunur ve `credit` ile bildirilir.
  // `limit`: yalnız ilk N parça gönderilir (üyenin jetonu o kadarına yetiyorsa).
  async function runChunked<T>(
    text: string,
    signal: AbortSignal,
    endpoint: string,
    extract: (data: unknown) => T[] | undefined,
    unit: number,
    extraBody?: Record<string, unknown>,
    limit?: number,
  ): Promise<{
    items: T[];
    error: string | null;
    aborted: boolean;
    done: number;
    /** Sonucu gerçekten dönen (jetonu düşen) parça sayısı. */
    reviewed: number;
    total: number;
    credit: CreditProblem | null;
  }> {
    const all = chunkText(text, CHUNK_SIZE);
    const chunks = limit ? all.slice(0, limit) : all;
    const total = chunks.length;
    let done = 0;
    let reviewed = 0;
    const report = () => {
      if (total > 1 && isCurrentJob(sessionKey, signal)) patch({ progress: { done, total } });
    };
    report();
    const items: T[] = [];
    let firstError: string | null = null;
    let credit: CreditProblem | null = null;

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      if (signal.aborted || credit) break;
      const batch = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (chunk): Promise<{ ok: T[] } | { err: string } | { aborted: true } | { credit: CreditProblem }> => {
          try {
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // Derin kontrol artık STANDART (seçenek değil): her kontrol en
              // güçlü modelle çalışır — kullanıcı kutucuk/karar yükü taşımaz.
              body: JSON.stringify({ text: chunk, lang, mode: "deep", ...extraBody }),
              signal,
            });
            // Jeton yetmedi / oturum kapandı: bu parça incelenmedi sayılır.
            // (401 her zaman oturum değildir: AI anahtarı geçersizse de 401
            // "bad-key" döner → o, aşağıdaki olağan hata yoluna düşer.)
            const authLike =
              res.status !== 401 ||
              ((await res.clone().json().catch(() => ({}))) as { error?: string }).error === "auth";
            const problem = authLike ? await creditProblemFrom(res) : null;
            if (problem) return { credit: problem };
            let out: { ok: T[] } | { err: string };
            if (!res.ok) {
              const d = (await res.json().catch(() => ({}))) as { error?: string; max?: number };
              out = { err: mapError(d.error, d.max) };
            } else {
              const d = (await res.json()) as unknown;
              out = { ok: extract(d) ?? [] };
              reviewed += 1;
              // Bu parçanın jetonu düştü → yerel bakiyeyi güncelle.
              setBalance((b) => (b === null ? b : Math.max(0, b - unit)));
            }
            done += 1;
            report();
            return out;
          } catch {
            // Durdurulduysa bu parça "incelendi" sayılmaz.
            if (signal.aborted) return { aborted: true };
            done += 1;
            report();
            return { err: t.errorGeneric };
          }
        }),
      );
      for (const r of results) {
        if ("ok" in r) items.push(...r.ok);
        else if ("credit" in r) credit = credit ?? r.credit;
        else if ("err" in r && !firstError) firstError = r.err;
      }
    }
    // Sunucu bakiyeyi bildirdiyse (402) yerel tahmin yerine o sayı geçerli.
    const hit = credit as CreditProblem | null; // (döngüde atanıyor; TS daraltmasın)
    const reported = hit?.kind === "no-credits" ? hit.balance : undefined;
    if (typeof reported === "number") setBalance((b) => (b === null ? b : reported));
    // Hiç sonuç yoksa ve hata varsa hatayı bildir; bazı parçalar başardıysa göster.
    return {
      items,
      error: items.length === 0 ? firstError : null,
      aborted: signal.aborted,
      done,
      reviewed,
      total: all.length,
      credit,
    };
  }

  // Dört AI kontrolünün ortak akışı: işi başlat → parçaları gönder → sonucu
  // oturuma yaz. Kullanıcı durdurduysa o ana kadar bulunanlar korunur.
  async function runAiCheck<T>(
    kind: CheckKind,
    endpoint: string,
    extract: (data: unknown) => T[] | undefined,
    toSuggestions: (items: T[], text: string) => Suggestion[],
    extraBody?: Record<string, unknown>,
    limit?: number,
  ) {
    const text = raw;
    const signal = beginJob(sessionKey, kind);
    setPendingKind(null);
    setCreditStop(null);
    try {
      const r = await runChunked<T>(
        text,
        signal,
        endpoint,
        extract,
        creditCost(CHECK_ACTION[kind]),
        extraBody,
        limit,
      );
      if (!isCurrentJob(sessionKey, signal)) return;
      if (r.aborted) {
        const found = r.items.length > 0 ? dedupeSuggestions(toSuggestions(r.items, text)) : null;
        finishJob(sessionKey, signal, {
          stopped: { done: r.done, total: r.total },
          suggestions: found,
          checkedText: found ? text : "",
        });
      } else if (r.credit && r.reviewed === 0) {
        // Hiçbir parça incelenemedi: sonuç yok, yalnız ortak jeton uyarısı.
        // (Metin hâli oturumda da durur: ekrandan çıkıp dönünce kaybolmasın.)
        setCreditStop({ problem: r.credit, done: 0, total: r.total });
        finishJob(sessionKey, signal, { checkError: creditProblemText(r.credit, lang) });
      } else if (r.credit) {
        // Yarıda kaldı: o ana kadar bulunanlar gösterilir, üstünde kalıcı uyarı.
        setCreditStop({ problem: r.credit, done: r.reviewed, total: r.total });
        finishJob(sessionKey, signal, {
          stopped: { done: r.reviewed, total: r.total },
          suggestions: dedupeSuggestions(toSuggestions(r.items, text)),
          checkedText: text,
        });
      } else if (r.error && r.items.length === 0) {
        finishJob(sessionKey, signal, { checkError: r.error });
      } else {
        // Bilerek kısaltılan incelemede (limit) kalan kısım açıkça belirtilir.
        // Sayaç = sonucu gerçekten dönen parçalar (hata verip iade edilenler değil).
        const partial = r.reviewed < r.total;
        if (partial) setCreditStop({ problem: null, done: r.reviewed, total: r.total });
        finishJob(sessionKey, signal, {
          suggestions: dedupeSuggestions(toSuggestions(r.items, text)),
          checkedText: text,
          ...(partial ? { stopped: { done: r.reviewed, total: r.total } } : {}),
        });
      }
    } catch {
      finishJob(sessionKey, signal, { checkError: t.errorGeneric });
    }
  }

  // Genel Kontrol (Kategori 1-2): yazım/dilbilgisi düzeltmeleri + yerel uzun
  // cümle uyarıları.
  function startCheck(limit?: number) {
    void runAiCheck<AiSuggestion>(
      "check",
      "/api/editor-check",
      (d) => (d as { suggestions?: AiSuggestion[] }).suggestions,
      (items, text) => [
        ...items.map((s): Suggestion => ({ ...s, kind: "fix" })),
        ...findLongSentences(text),
      ],
      undefined,
      limit,
    );
  }

  // Editöryal inceleme (Aşama 3): akış, tekrar, üslup, paragraf. Gelen her
  // gözlem advisory bir "notice"; otomatik düzeltme yok.
  function startReview(limit?: number) {
    void runAiCheck<ReviewNote>(
      "review",
      "/api/editor-review",
      (d) => (d as { notes?: ReviewNote[] }).notes,
      (items) =>
        items.map((n): Suggestion => ({
          kind: "notice",
          original: n.excerpt,
          suggestion: n.suggestion,
          rewrite: usableRewrite(n.excerpt, n.rewrite),
          category: n.category,
          explanation: n.issue,
          severity: n.severity,
        })),
      undefined,
      limit,
    );
  }

  // Riskli içerik (Kategori 5): yalnız ciddi yayın/hukuk riskleri. Gelen her
  // gözlem advisory bir "notice"; otomatik düzeltme yok.
  function startRisk(limit?: number) {
    void runAiCheck<RiskNote>(
      "risk",
      "/api/editor-risk",
      (d) => (d as { notes?: RiskNote[] }).notes,
      (items) =>
        items.map((n): Suggestion => ({
          kind: "notice",
          original: n.excerpt,
          suggestion: n.suggestion,
          rewrite: usableRewrite(n.excerpt, n.rewrite),
          category: n.category,
          explanation: n.issue,
        })),
      undefined,
      limit,
    );
  }

  // Türe göre özel kontrol (Kategori 6): seçilen türe (roman, kişisel gelişim,
  // akademik) özel başlıklar. Gelen her gözlem advisory bir "notice".
  function startGenre(limit?: number) {
    void runAiCheck<GenreNote>(
      "genre",
      "/api/editor-genre",
      (d) => (d as { notes?: GenreNote[] }).notes,
      (items) =>
        items.map((n): Suggestion => ({
          kind: "notice",
          original: n.excerpt,
          suggestion: n.suggestion,
          rewrite: usableRewrite(n.excerpt, n.rewrite),
          category: n.category,
          explanation: n.issue,
        })),
      { genre },
      limit,
    );
  }

  function launch(kind: CheckKind, limit?: number) {
    if (kind === "check") startCheck(limit);
    else if (kind === "review") startReview(limit);
    else if (kind === "risk") startRisk(limit);
    else startGenre(limit);
  }

  // Bir kontrolün bedeli: parça sayısı × parça başı jeton. `affordable` =
  // bakiyenin yettiği parça sayısı (yöneticide hepsi).
  function costOf(kind: CheckKind) {
    const unit = creditCost(CHECK_ACTION[kind]);
    const parts = chunkText(raw, CHUNK_SIZE).length;
    const affordable =
      balance === null || unit === 0 ? parts : Math.min(parts, Math.floor(balance / unit));
    return { unit, parts, total: parts * unit, affordable };
  }

  // Ücretli kontrol düğmeleri buradan geçer: bedel küçükse ve bakiye yetiyorsa
  // hemen başlar; değilse sonuç panelinde önce bedel gösterilip onay istenir.
  // Yönetici jeton harcamaz → sorulmaz.
  function requestRun(kind: CheckKind) {
    const c = costOf(kind);
    if (balance === null || (c.total <= CONFIRM_OVER && c.affordable >= c.parts)) {
      launch(kind);
      return;
    }
    // Aynı onay zaten açıksa effect yeniden çalışmaz → burada göster.
    if (pendingKind === kind) revealConfirm();
    setPendingKind(kind);
  }

  // Düğmelerin altındaki kısa bedel notu.
  function costHint(kind: CheckKind): string {
    const unit = creditCost(CHECK_ACTION[kind]);
    return isTr
      ? `parça başına ${unit} jeton`
      : `${unit} ${unit === 1 ? "credit" : "credits"} per part`;
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

  /** Kart önerisini metne uygular. `override`: kullanıcının kartta düzenlediği metin. */
  function acceptSuggestion(index: number, override?: string) {
    const s = suggestions?.[index];
    if (!s) return;
    const proposed = override ?? (s.kind === "fix" ? s.suggestion : s.rewrite);
    if (proposed == null) return;
    if (proposed === s.original) {
      // Değişiklik yok: kartı "atlandı" say.
      rejectSuggestion(index);
      return;
    }
    const action: FixAction = { indices: [index], changes: [], docx: [] };
    // Önce birebir, olmazsa tırnak/tire/boşluk farklarına toleranslı ara.
    const exact = raw.indexOf(s.original);
    const hit = exact !== -1 ? { at: exact, len: s.original.length } : fuzzyFind(raw, s.original);
    if (!hit) {
      // Metin bu arada değişmiş (elle düzeltme, Bul/değiştir…): "uygulandı" deme.
      window.alert(
        isTr
          ? "Bu önerinin geçtiği yer metinde artık bulunamadı (metin değişmiş olabilir). Öneri uygulanmadı; istersen Atla."
          : "The passage for this suggestion can no longer be found in the text. It was not applied; you can Skip it.",
      );
      return;
    }
    const from = raw.slice(hit.at, hit.at + hit.len);
    // Öneri dipnot işaretini ([^1]) düşürdüyse aynı kelimenin arkasına geri koy
    // (metin, geri alma kaydı ve Word düzeltmesi aynı son metni kullanır).
    const replacement = preserveFootnoteRefs(from, proposed);
    if (replacement === from) {
      rejectSuggestion(index); // öneri yalnız dipnot işaretini siliyordu → değişiklik yok
      return;
    }
    setRaw(raw.slice(0, hit.at) + replacement + raw.slice(hit.at + hit.len));
    action.changes.push({ at: hit.at, from, to: replacement });
    setDecisions((prev) => ({ ...prev, [index]: "accepted" }));
    // Yüklenen docx'e de işlenebilmesi için kabul edilen metin düzeltmesini sakla.
    // [^n] işaretleri KORUNUR: docxEdit bunları Word'ün dipnot başvurularına
    // eşleyip işaretleri yerinde bırakır. Dokunulan satır(lar)dan biri dipnot
    // tanımıysa ("[^1]: …", metni Word'de ayrı dosyada) düzeltme inNote
    // olarak işaretlenir ve gövdeye işlenmez.
    if (originalDocx) {
      const lineFrom = raw.lastIndexOf("\n", hit.at - 1) + 1;
      const nl = raw.indexOf("\n", hit.at + hit.len);
      const lineTo = nl === -1 ? raw.length : nl;
      const inNote = raw.slice(lineFrom, lineTo).split("\n").some(isFnDefLine);
      const edit: DocxEditNote = { original: from, suggestion: replacement, ...(inNote ? { inNote: true } : {}) };
      action.docx.push(edit);
      setDocxEdits((prev) => [...prev, edit]);
    }
    setFixActions((prev) => [...prev, action]);
  }

  // Aynı yazım hatasını metnin TAMAMINDA düzeltir ("birşey" 25 yerde → hepsi).
  // Aynı değişikliği öneren diğer bekleyen kartlar da "Düzeltildi" olur.
  function bulkFix(index: number) {
    const pair = suggestions?.[index] ? bulkPair(suggestions[index]) : null;
    if (!suggestions || !pair) return;
    const changes: TextChange[] = [];
    const docx: DocxEdit[] = [];
    let out = "";
    let last = 0;
    let shift = 0;
    const refs = refRanges(raw);
    for (const m of raw.matchAll(wordRegex(pair.from))) {
      const from = m[0];
      // Dipnot işaretinin ([^…]) içindeki eşleşmeye asla dokunma.
      if (refs.some((r) => m.index < r.end && m.index + from.length > r.start)) continue;
      const to = isUpperTr(from.charAt(0)) ? capTr(pair.to) : pair.to;
      out += raw.slice(last, m.index) + to;
      changes.push({ at: m.index + shift, from, to });
      shift += to.length - from.length;
      last = m.index + from.length;
      if (originalDocx) {
        // Dipnot tanımı satırındaki eşleşme Word gövdesinde değil (notlar ayrı dosyada).
        const ls = raw.lastIndexOf("\n", m.index - 1) + 1;
        const le = raw.indexOf("\n", m.index);
        const inNote = isFnDefLine(raw.slice(ls, le === -1 ? raw.length : le));
        const edit: DocxEditNote = { original: from, suggestion: to, ...(inNote ? { inNote: true } : {}) };
        docx.push(edit);
      }
    }
    if (changes.length === 0) return;
    setRaw(out + raw.slice(last));
    const key = pair.from.toLocaleLowerCase("tr");
    const indices = suggestions.flatMap((x, j) => {
      if (decisions[j] && j !== index) return [];
      const q = bulkPair(x);
      return q && q.from.toLocaleLowerCase("tr") === key && q.to.toLocaleLowerCase("tr") === pair.to.toLocaleLowerCase("tr")
        ? [j]
        : [];
    });
    setDecisions((prev) => {
      const next = { ...prev };
      for (const j of indices) next[j] = "accepted";
      return next;
    });
    if (docx.length) setDocxEdits((prev) => [...prev, ...docx]);
    setFixActions((prev) => [...prev, { indices, changes, docx }]);
  }

  function rejectSuggestion(index: number) {
    setDecisions((prev) => ({ ...prev, [index]: "rejected" }));
  }

  // Kararı geri al: düzeltme uygulandıysa metin eski hâline döner (toplu
  // düzeltmede tüm yerler), Word dışa aktarımından da çıkarılır; kart yeniden
  // "bekliyor" olur. Yoksayılan kart için yalnız karar silinir.
  function undoDecision(index: number) {
    const action = fixActions.find((a) => a.indices.includes(index));
    const indices = action ? action.indices : [index];
    if (action) {
      let text = raw;
      // Sondan başa: öndeki değişikliklerin konumu kaymasın.
      for (const c of [...action.changes].sort((a, b) => b.at - a.at)) {
        const at = nearestIndexOf(text, c.to, c.at);
        if (at === -1) continue;
        text = text.slice(0, at) + c.from + text.slice(at + c.to.length);
      }
      if (text !== raw) setRaw(text);
      if (action.docx.length) setDocxEdits((prev) => prev.filter((e) => !action.docx.includes(e)));
      setFixActions((prev) => prev.filter((a) => a !== action));
    }
    setDecisions((prev) => {
      const next = { ...prev };
      for (const j of indices) delete next[j];
      return next;
    });
  }

  // Toplu düzeltme önerisi için: her yazım hatasının metinde kaç kez geçtiği.
  // Yazarken her tuşta yeniden saymasın diye ertelenmiş metinle hesaplanır.
  const bulkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    suggestions?.forEach((s, i) => {
      if (decisions[i]) return;
      const pair = bulkPair(s);
      if (!pair || counts.has(pair.from)) return;
      counts.set(pair.from, deferredRaw.match(wordRegex(pair.from))?.length ?? 0);
    });
    return counts;
  }, [suggestions, decisions, deferredRaw]);


  // Başlamadan önce onay bekleyen kontrolün bedeli (yalnız onay ekranı açıkken
  // hesaplanır). `pendingShort` = bakiye tamamına yetmiyor.
  const pendingCost = pendingKind && !running ? costOf(pendingKind) : null;
  const pendingShort = pendingCost !== null && pendingCost.affordable < pendingCost.parts;
  const pendingPages = pendingCost
    ? Math.max(1, Math.round((pendingCost.affordable * CHUNK_SIZE) / CHARS_PER_PAGE))
    : 0;

  // Jeton uyarısı yalnız ait olduğu sonuç hâlâ ekrandayken gösterilir.
  const creditInfo = creditStop && (stopped || checkError) ? creditStop : null;
  // Yarıda kalan / kısaltılan incelemenin sonuçların üstündeki kalıcı uyarısı.
  const creditBanner =
    creditInfo && !checkError ? (
      <div className="mb-3 space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          {(() => {
            const d = String(creditInfo.done);
            const n = String(creditInfo.total);
            if (creditInfo.problem?.kind === "auth")
              return isTr
                ? `Oturumun kapandı: ${d}/${n} parça incelendi, kalan kısım incelenmedi.`
                : `Your session expired: ${d} of ${n} parts reviewed; the rest was not reviewed.`;
            if (creditInfo.problem)
              return isTr
                ? `Jetonun bitti: ${d}/${n} parça incelendi, kalan kısım incelenmedi.`
                : `Out of credits: ${d} of ${n} parts reviewed; the rest was not reviewed.`;
            return isTr
              ? `Jetonun yettiği kadarı incelendi: ${d}/${n} parça. Kalan kısım incelenmedi.`
              : `Reviewed as far as your credits allowed: ${d} of ${n} parts. The rest was not reviewed.`;
          })()}
        </div>
        {creditInfo.problem && <CreditNotice lang={lang} problem={creditInfo.problem} />}
      </div>
    ) : null;

  // ═══════════════ Tam ekran düzen (Kapak / Mizanpaj ile aynı dil) ═══════════════
  const router = useRouter();
  const docTitle = initialProject?.data.meta.title?.trim() || (isTr ? "Editör çalışması" : "Editor draft");
  const wizard = initialProject?.data.wizard;
  const wizardActive = !!wizard?.active && !!projectId;
  const wizardSteps: [string, string, boolean][] = wizard
    ? [
        ["editor", isTr ? "AI Editör" : "AI Editor", wizard.editorCompleted],
        ["mizanpaj", isTr ? "Mizanpaj" : "Layout", wizard.layoutCompleted],
        ["kapak", isTr ? "Kapak" : "Cover", wizard.coverCompleted],
      ]
    : [];
  const [stepsOpen, setStepsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [checksMenuOpen, setChecksMenuOpen] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  const finishWizard = async () => {
    if (!projectId || wizardBusy) return;
    setWizardBusy(true);
    if (canSave) saveNow();
    try {
      await completeWizardStep(projectId, "editor");
    } catch {
      // kaydedilemese de ilerle
    }
    router.push(`/${lang}/mizanpaj?project=${projectId}`);
  };

  // ── Sağ panel ──
  type PanelId = "oneriler" | "bolumler" | "bul" | "gecmis" | "ayarlar" | "hazirlik";
  const [panel, setPanel] = useState<PanelId>("oneriler");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  // Ekran tercihleri (yalnız bu tarayıcıda; kitaba etki etmez).
  const [fontPx, setFontPx] = useState(18);
  const [fontFamily, setFontFamily] = useState("Merriweather");
  useEffect(() => {
    try {
      const hidden = localStorage.getItem("editor-panel-gizli") === "1";
      const px = Number(localStorage.getItem("editor-ekran-punto"));
      const fam = localStorage.getItem("editor-ekran-font");
      // Tercihler tek seferde, yüklemeden hemen sonra uygulanır.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (hidden) setSidePanelOpen(false);
      if (px >= 14 && px <= 28) setFontPx(px);
      if (fam && SCREEN_FONTS.includes(fam)) setFontFamily(fam);
    } catch {
      /* localStorage kapalıysa varsayılanlar kalır */
    }
  }, []);
  const remember = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* yok say */
    }
  };
  const setPanelOpen = (open: boolean) => {
    setSidePanelOpen(open);
    remember("editor-panel-gizli", open ? "0" : "1");
  };
  const openPanel = (p: PanelId) => {
    setPanel(p);
    if (!sidePanelOpen) setPanelOpen(true);
    setFocusMode(false);
  };
  // Ücretli kontroller hep öneri panelinde başlar (bedel onayı orada görünür).
  const runCheck = (kind: CheckKind) => {
    openPanel("oneriler");
    requestRun(kind);
  };

  // ── Yazma yüzeyi (sayfa görünümü) ──
  const [api, setApi] = useState<ManuscriptApi | null>(null);
  const [edState, setEdState] = useState<ManuscriptState>({
    canUndo: false,
    canRedo: false,
    block: "paragraph",
    bold: false,
    italic: false,
  });
  const onEdState = useCallback((s: ManuscriptState) => {
    setEdState((p) =>
      p.canUndo === s.canUndo && p.canRedo === s.canRedo && p.block === s.block && p.bold === s.bold && p.italic === s.italic
        ? p
        : s,
    );
  }, []);
  const [activeMark, setActiveMark] = useState<number | null>(null);
  // Yeni bir inceleme önerileri değiştirince eski seçim geçersiz.
  const [seenSuggestions, setSeenSuggestions] = useState(suggestions);
  // Kartta düzenlenen öneri metni (Düzenle).
  const [editing, setEditing] = useState<{ i: number; text: string } | null>(null);
  if (seenSuggestions !== suggestions) {
    setSeenSuggestions(suggestions);
    setActiveMark(null);
    setEditing(null);
  }
  const [filter, setFilter] = useState<"all" | "yazim" | "uslup" | "diger">("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);

  // Bekleyen öneriler metinde işaretlenir (dalgalı çizgi / sarı vurgu).
  const marks = useMemo<ManuscriptMark[]>(
    () =>
      (suggestions ?? []).flatMap((s, i) =>
        decisions[i] || !s.original.trim() ? [] : [{ id: i, needle: s.original, kind: s.kind }],
      ),
    [suggestions, decisions],
  );

  const onEditorChange = useCallback(
    (md: string) => {
      // Elle düzenleme sonuçları SİLMEZ; yalnız metni günceller.
      setRaw(md);
      // Tek güncelleme: hata mesajı silinir; Word'den gelen metinse "elle
      // değiştirildi" işaretlenir (Word indirme metnin son hâlini kullansın).
      patchSession(sessionKey, (st) => ({
        checkError: null,
        ...(st.originalDocx && !st.manualEdit ? { manualEdit: true } : {}),
      }));
      setExportInfo(null);
      // Metin değişti → gösterilen bedel artık eski; yeniden sorulsun.
      setPendingKind(null);
    },
    [sessionKey],
  );

  const focusCard = (i: number) => {
    setActiveMark(i);
    const s = suggestions?.[i];
    if (!s) return;
    // İşaret bir düzenlemeyle kaybolduysa pasajı yeniden ara.
    if (api && !api.reveal(i)) api.revealText(decisions[i] === "accepted" && s.suggestion ? s.suggestion : s.original);
  };
  const onMarkClick = (id: number) => {
    setActiveMark(id);
    setFocusMode(false);
    setPanel("oneriler");
    setSidePanelOpen(true);
    setFilter("all");
    requestAnimationFrame(() =>
      document.getElementById(`ks-card-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
  };

  // ⌘F → Bul paneli; Esc → odak modundan çık.
  const findInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setPanel("bul");
        setSidePanelOpen(true);
        setFocusMode(false);
        requestAnimationFrame(() => findInputRef.current?.focus());
      } else if (e.key === "Escape") {
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Bul / değiştir ──
  const [findQuery, setFindQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findPos, setFindPos] = useState<{ index: number; total: number } | null>(null);
  const [findTotal, setFindTotal] = useState(0);
  const findCount = findTotal;
  useEffect(() => {
    if (!api) return;
    if (panel !== "bul") {
      api.clearFind();
      return;
    }
    const n = api.find(findQuery);
    // Arama sonucu sayısı editörden okunur (dış sistem); metin değişince de güncellenir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFindTotal(n);
    setFindPos(null);
  }, [api, panel, findQuery, deferredRaw]);
  const findStep = (dir: 1 | -1) => setFindPos(api?.findStep(dir) ?? null);
  const replaceAll = () => {
    const q = findQuery.trim();
    if (!q || findCount === 0 || !api) return;
    api.replaceAll(q, replaceText);
    setFindTotal(api.find(q));
    setFindPos(null);
  };

  // Bölümler paneli canlıdır (yazdıkça güncellenir; API harcaması yok).
  const liveStructure = useMemo(
    () => (panel === "bolumler" && sidePanelOpen ? parseStructure(deferredRaw) : null),
    [panel, sidePanelOpen, deferredRaw],
  );
  const goToText = (needle: string) => {
    api?.revealText(needle);
  };

  // ── Word yükle (mevcut metnin yerini alır → onay) ──
  const pickWord = () => {
    if (
      hasText &&
      !window.confirm(
        isTr
          ? "Word dosyası yüklenince şu anki metnin yerini alır. Devam edilsin mi?"
          : "Uploading a Word file replaces the current text. Continue?",
      )
    )
      return;
    fileInputRef.current?.click();
  };

  // Öneri grupları (sağ paneldeki sekmeler).
  const groupOf = (c: Category): "yazim" | "uslup" | "diger" =>
    c === "spelling" || c === "grammar" || c === "punctuation"
      ? "yazim"
      : STYLE_CATEGORIES.has(c)
        ? "uslup"
        : "diger";
  const groupCounts = { all: 0, yazim: 0, uslup: 0, diger: 0 };
  suggestions?.forEach((s, i) => {
    if (decisions[i]) return;
    groupCounts.all++;
    groupCounts[groupOf(s.category)]++;
  });
  const decidedCount = suggestions ? suggestions.length - groupCounts.all : 0;

  const jobLabel = running
    ? `${genreLoading ? t.genreLoading : risking ? t.risking : reviewing ? t.reviewing : t.checking}${
        checkProgress && checkProgress.total > 1 ? ` ${checkProgress.done}/${checkProgress.total}` : ""
      }`
    : null;
  const busy = running !== null;

  // ── Adım adım kontroller (1–6) ──
  const STEPS: { n: number; kind: CheckKind | "structure" | "prep"; title: string; hint: string; paid: boolean }[] = [
    { n: 1, kind: "check", title: t.checkCta, hint: t.checkHint, paid: true },
    { n: 2, kind: "review", title: t.reviewCta, hint: t.reviewHint, paid: true },
    { n: 3, kind: "structure", title: t.structureCta, hint: t.structureHint, paid: false },
    { n: 4, kind: "prep", title: t.prepCta, hint: t.prepHint, paid: false },
    { n: 5, kind: "risk", title: t.riskCta, hint: t.riskHint, paid: true },
    { n: 6, kind: "genre", title: t.genreCta, hint: t.genreHint, paid: true },
  ];
  const startStep = (kind: (typeof STEPS)[number]["kind"]) => {
    setChecksMenuOpen(false);
    if (kind === "structure") openPanel("bolumler");
    else if (kind === "prep") openPanel("hazirlik");
    else if (kind === "genre") {
      // Türe göre kontrol önce türü sorar: kontrol listesini açıp gösterir.
      openPanel("oneriler");
      setChecksOpen(true);
    } else runCheck(kind);
  };
  const stepsList = (
    <ol className="flex flex-col gap-2">
      {STEPS.map((st) => {
        const isRunning = running === st.kind;
        return (
          <li key={st.n} className="rounded-xl border border-border bg-background/60 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">
                {st.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{st.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  {st.hint}
                  {st.paid && <span className="whitespace-nowrap opacity-80"> · {costHint(st.kind as CheckKind)}</span>}
                </p>
                {st.kind === "genre" && (
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value as Genre)}
                    className="mt-2 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-accent"
                    aria-label={t.genreLabel}
                  >
                    <option value="fiction">{t.genreFiction}</option>
                    <option value="selfhelp">{t.genreSelfhelp}</option>
                    <option value="academic">{t.genreAcademic}</option>
                  </select>
                )}
              </div>
              <button
                type="button"
                onClick={() => startStep(st.kind)}
                disabled={!hasText || busy}
                className="shrink-0 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRunning ? (
                  <span className="block h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                ) : st.paid ? (
                  isTr ? "Başlat" : "Run"
                ) : isTr ? (
                  "Aç"
                ) : (
                  "Open"
                )}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );

  // ── Öneri kartı ──
  const renderCard = (s: Suggestion, i: number) => {
    const group = groupOf(s.category);
    const active = activeMark === i;
    const target = s.kind === "fix" ? s.suggestion : s.rewrite;
    const d = target != null ? (diffs[i] ?? splitDiff(s.original, target)) : null;
    const isEditing = editing?.i === i;
    const compact = d && d.aMid.length > 0 && d.bMid.length > 0 && d.aMid.length <= 42 && d.bMid.length <= 42;
    const ctx = contexts[i] ?? null;
    return (
      <li
        key={i}
        id={`ks-card-${i}`}
        onClick={() => focusCard(i)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            focusCard(i);
          }
        }}
        tabIndex={0}
        aria-label={`${catLabel(s.category)}: ${s.original.slice(0, 80)}`}
        title={isTr ? "Metindeki yerini göster" : "Show in text"}
        className={`cursor-pointer rounded-xl border bg-surface p-3.5 transition ${
          active ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border hover:border-accent/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              group === "yazim" ? "bg-rose-500" : group === "uslup" ? "bg-amber-400" : "bg-sky-500"
            }`}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{catLabel(s.category)}</span>
          {s.severity && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                s.severity === "warn"
                  ? "bg-amber-100 text-amber-700"
                  : s.severity === "suggest"
                    ? "bg-accent-soft text-accent"
                    : "bg-background text-muted"
              }`}
            >
              {severityLabel(s.severity)}
            </span>
          )}
        </div>

        {d &&
          (compact ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[15px]">
              <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700 line-through decoration-rose-400 dark:bg-rose-500/10 dark:text-rose-300">
                {d.aMid}
              </span>
              <span aria-hidden="true" className="text-muted">
                →
              </span>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                {d.bMid}
              </span>
            </div>
          ) : (
            <div className="mt-2.5 space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase text-muted">{t.origLabel}</span>
                <span className="text-foreground">
                  {d.pre}
                  {d.aMid && (
                    <span className="rounded bg-rose-50 px-0.5 text-rose-700 line-through decoration-rose-400 dark:bg-rose-500/10 dark:text-rose-300">
                      {d.aMid}
                    </span>
                  )}
                  {d.post}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase text-muted">{t.fixLabel}</span>
                <span className="font-medium text-foreground">
                  {d.pre}
                  {d.bMid && (
                    <span className="rounded bg-emerald-50 px-0.5 font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {d.bMid}
                    </span>
                  )}
                  {d.post}
                </span>
              </div>
            </div>
          ))}

        <p className="mt-2 text-sm leading-relaxed text-muted">
          {s.category === "long" ? t.longExplain.replace("{count}", String(s.wordCount ?? 0)) : s.explanation}
        </p>

        {s.kind === "notice" && s.category !== "long" && s.suggestion && (
          <p className="mt-2 rounded-lg bg-background px-2.5 py-2 text-sm text-foreground">
            <span className="mr-1.5 font-mono text-[10px] uppercase text-muted">{t.fixLabel}</span>
            {s.suggestion}
          </p>
        )}

        {ctx && (
          <p className="mt-2 line-clamp-3 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed text-muted">
            {ctx.before}
            <mark className="rounded bg-accent-soft px-0.5 font-medium text-foreground">{ctx.match}</mark>
            {ctx.after}
          </p>
        )}

        {s.kind === "fix" &&
          (() => {
            const pair = bulkPair(s);
            const n = pair ? (bulkCounts.get(pair.from) ?? 0) : 0;
            if (!pair || n < 2) return null;
            return (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {t.bulkInfo.replace("{word}", pair.from).replace("{count}", String(n))}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    bulkFix(i);
                  }}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {t.bulkCta.replace("{count}", String(n))}
                </button>
              </div>
            );
          })()}

        {isEditing ? (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <label className="text-xs font-semibold text-muted" htmlFor={`ks-edit-${i}`}>
              {isTr ? "Metne bu hâliyle girecek:" : "This will go into the text:"}
            </label>
            <textarea
              id={`ks-edit-${i}`}
              autoFocus
              value={editing.text}
              onChange={(e) => setEditing({ i, text: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  acceptSuggestion(i, editing.text);
                  setEditing(null);
                  setActiveMark(null);
                } else if (e.key === "Escape") setEditing(null);
              }}
              rows={Math.min(8, Math.max(2, Math.ceil(editing.text.length / 38)))}
              className="mt-1 w-full resize-y rounded-lg border border-accent/50 bg-background px-3 py-2 text-[15px] leading-relaxed text-foreground outline-none focus:border-accent"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  acceptSuggestion(i, editing.text);
                  setEditing(null);
                  setActiveMark(null);
                }}
                disabled={!editing.text.trim()}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-40"
              >
                {t.acceptCta}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:border-accent/50 hover:text-foreground"
              >
                {isTr ? "Vazgeç" : "Cancel"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {target != null && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  acceptSuggestion(i);
                  setActiveMark(null);
                }}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {t.acceptCta}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing({ i, text: target ?? s.original });
                focusCard(i);
              }}
              title={
                isTr
                  ? "Önerilen metni istediğin gibi değiştirip öyle uygula"
                  : "Change the suggested text, then apply it"
              }
              className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent-soft"
            >
              {isTr ? "Düzenle" : "Edit"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                rejectSuggestion(i);
                setActiveMark(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground/80 transition hover:border-accent/50 hover:text-foreground"
            >
              {target != null ? t.rejectCta : t.dismissCta}
            </button>
          </div>
        )}
      </li>
    );
  };

  // Uygulanan / atlanan kart (Tamamlananlar ve Geçmiş'te kısa satır).
  const renderDone = (s: Suggestion, i: number) => {
    const decision = decisions[i];
    const action = decision === "accepted" ? fixActions.find((a) => a.indices.includes(i)) : undefined;
    const many = action && action.changes.length > 1 ? action.changes.length : 0;
    const pair = many ? bulkPair(s) : null;
    return (
      <li key={i} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
        {decision === "accepted" ? (
          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-muted">–</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-muted">
            {catLabel(s.category)} ·{" "}
            {decision === "accepted" ? t.accepted : s.kind === "notice" ? t.dismissed : t.rejected}
          </div>
          {decision === "accepted" && action ? (
            <div className="mt-0.5 line-clamp-2 text-foreground">
              «{pair ? pair.from : (action.changes[0]?.from ?? s.original)}» → «
              <span className="font-medium">{pair ? pair.to : (action.changes[0]?.to ?? s.suggestion)}</span>»
              {many ? <span className="text-muted"> · {t.bulkDone.replace("{count}", String(many))}</span> : null}
            </div>
          ) : (
            <div className="mt-0.5 line-clamp-2 text-foreground/80">{s.original}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => undoDecision(i)}
          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
        >
          {t.undoCta}
        </button>
      </li>
    );
  };

  // ── Paneller ──
  const PANEL_META: Record<PanelId, { title: string; sub: string }> = {
    oneriler: {
      title: isTr ? "Editör önerileri" : "Editor suggestions",
      sub: isTr ? "Değişiklikler onayınla uygulanır." : "Changes apply only when you approve.",
    },
    bolumler: {
      title: isTr ? "Bölümler" : "Chapters",
      sub: isTr ? "Kitabın yapısı; bir bölüme tıkla, metinde oraya git." : "Book structure; click a chapter to jump to it.",
    },
    bul: {
      title: isTr ? "Bul ve değiştir" : "Find & replace",
      sub: isTr ? "Metinde bir kelimeyi ara, istersen hepsini değiştir." : "Search the text and replace if you like.",
    },
    gecmis: {
      title: isTr ? "Geçmiş" : "History",
      sub: isTr ? "Uyguladığın ve atladığın öneriler; hepsi geri alınabilir." : "Suggestions you applied or skipped; all undoable.",
    },
    ayarlar: {
      title: isTr ? "Ayarlar" : "Settings",
      sub: isTr ? "Görünüm, metin ve kayıt." : "View, text and saving.",
    },
    hazirlik: {
      title: t.prepCta,
      sub: t.prepHint,
    },
  };

  const suggestionsPanel = (
    <div className="flex flex-col gap-3">
      {pendingCost && pendingKind && (
        // BAŞLAMADAN ÖNCE BEDEL — kaç jeton gideceği ve bakiye; onay üyede.
        <div ref={confirmRef} role="status" className="rounded-xl border border-accent/40 bg-accent-soft/50 p-4 text-sm text-foreground">
          <p className="leading-relaxed">
            {isTr
              ? `Bu inceleme ${pendingCost.parts} parça × ${pendingCost.unit} = ${pendingCost.total} jeton harcar.`
              : `This review uses ${pendingCost.parts} ${pendingCost.parts === 1 ? "part" : "parts"} × ${pendingCost.unit} = ${pendingCost.total} credits.`}
            {balance !== null && (isTr ? ` Bakiyen: ${balance}.` : ` Your balance: ${balance}.`)}
          </p>
          {pendingShort && pendingCost.affordable > 0 && (
            <p className="mt-2 font-semibold leading-relaxed">
              {isTr
                ? `Jetonun ${pendingCost.affordable} parçaya yetiyor (kitabın ilk ~${pendingPages} sayfası). Yalnız o kadarını incele?`
                : `Your credits cover ${pendingCost.affordable} ${pendingCost.affordable === 1 ? "part" : "parts"} (about the first ${pendingPages} pages of the book). Review only that much?`}
            </p>
          )}
          {pendingShort && (
            <CreditNotice
              lang={lang}
              className="mt-3"
              problem={{ kind: "no-credits", cost: pendingCost.total, balance: balance ?? undefined }}
            />
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!pendingShort || pendingCost.affordable > 0 ? (
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => launch(pendingKind, pendingShort ? pendingCost.affordable : undefined)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {pendingShort
                  ? isTr
                    ? `İlk ${pendingCost.affordable} parçayı incele`
                    : `Review the first ${pendingCost.affordable} ${pendingCost.affordable === 1 ? "part" : "parts"}`
                  : isTr
                    ? "Başlat"
                    : "Start"}
              </button>
            ) : (
              // Yerel bakiye bayat olabilir: tek parça denenir; sunucu 402 dönerse
              // jeton harcanmaz ve gerçek bakiye yerel kopyayı düzeltir.
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => launch(pendingKind, 1)}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
              >
                {isTr ? "Yine de dene" : "Try anyway"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingKind(null)}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              {isTr ? "Vazgeç" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {running && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-5 text-center">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
            {jobLabel}
          </div>
          {checkProgress && checkProgress.total > 1 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.round((checkProgress.done / checkProgress.total) * 100)}%` }}
              />
            </div>
          )}
          {/* Yanlış dosya vb. için: kalan parçalar gönderilmez. */}
          <button
            type="button"
            onClick={() => stopJob(sessionKey)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-1.5 text-sm font-semibold text-foreground transition hover:border-red-300 hover:text-red-600"
          >
            <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
            {t.stopCta}
          </button>
          {projectId && <p className="text-xs text-muted">{t.stopHint}</p>}
        </div>
      )}

      {checkError &&
        !running &&
        (creditInfo?.problem ? (
          <CreditNotice lang={lang} problem={creditInfo.problem} />
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {checkError}
          </div>
        ))}

      {!running && !checkError && creditBanner}
      {!running && !checkError && stopped && !creditBanner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="font-semibold">{t.stoppedTitle}</span>{" "}
          {suggestions && suggestions.length > 0
            ? stopped.total > 1
              ? t.stoppedPartial.replace("{done}", String(stopped.done)).replace("{total}", String(stopped.total))
              : ""
            : t.stoppedEmpty}
        </div>
      )}

      {!running && suggestions && suggestions.length > 0 && (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-background p-1" role="tablist">
            {(
              [
                ["all", isTr ? "Tümü" : "All"],
                ["yazim", isTr ? "Yazım" : "Spelling"],
                ["uslup", isTr ? "Üslup" : "Style"],
                ["diger", isTr ? "Diğer" : "Other"],
              ] as const
            )
              .filter(([k]) => k === "all" || groupCounts[k] > 0 || filter === k)
              .map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
                    filter === k ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-[11px] ${
                      filter === k ? "bg-accent text-white" : "border border-border text-muted"
                    }`}
                  >
                    {groupCounts[k]}
                  </span>
                </button>
              ))}
          </div>
          {groupCounts.all === 0 ? (
            <div className="rounded-xl border border-border bg-background/60 px-4 py-5 text-center">
              <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-2 text-sm text-muted">
                {isTr ? "Bütün önerileri gözden geçirdin." : "You've reviewed every suggestion."}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {suggestions.map((s, i) =>
                !decisions[i] && (filter === "all" || groupOf(s.category) === filter) ? renderCard(s, i) : null,
              )}
              {filter !== "all" && groupCounts[filter] === 0 && (
                <li className="px-1 py-3 text-center text-sm text-muted">
                  {isTr ? "Bu grupta bekleyen öneri yok." : "Nothing pending in this group."}
                </li>
              )}
            </ul>
          )}
          {decidedCount > 0 && (
            <div className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setDoneOpen((o) => !o)}
                aria-expanded={doneOpen}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-foreground"
              >
                {isTr ? `Tamamlananlar (${decidedCount})` : `Done (${decidedCount})`}
                <CaretDownIcon className={`h-4 w-4 text-muted transition ${doneOpen ? "rotate-180" : ""}`} />
              </button>
              {doneOpen && (
                <ul className="flex flex-col gap-2 border-t border-border p-2">
                  {suggestions.map((s, i) => (decisions[i] ? renderDone(s, i) : null))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {!running && !checkError && suggestions && suggestions.length === 0 && !creditBanner && !stopped && (
        <div className="rounded-xl border border-border bg-background/60 px-4 py-5 text-center">
          <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 text-sm text-muted">{t.noIssues}</p>
        </div>
      )}
      {!running && !checkError && creditBanner && suggestions && suggestions.length === 0 && (
        <p className="text-center text-sm text-muted">{t.noIssues}</p>
      )}

      {/* Adım adım kontroller: öneri yokken açık liste, varken katlanır. */}
      {suggestions === null && !running && !pendingKind ? (
        <>
          <p className="text-sm leading-relaxed text-muted">{t.emptyResults}</p>
          {stepsList}
        </>
      ) : (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setChecksOpen((o) => !o)}
            aria-expanded={checksOpen}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold text-foreground"
          >
            <SlidersIcon className="h-4 w-4 text-muted" />
            <span className="flex-1 text-left">{isTr ? "Adım adım kontroller" : "Step-by-step checks"}</span>
            <CaretDownIcon className={`h-4 w-4 text-muted transition ${checksOpen ? "rotate-180" : ""}`} />
          </button>
          {checksOpen && <div className="border-t border-border p-2">{stepsList}</div>}
        </div>
      )}
    </div>
  );

  const historyItems = suggestions ? suggestions.map((s, i) => (decisions[i] ? renderDone(s, i) : null)).filter(Boolean) : [];

  const panelBody =
    panel === "oneriler" ? (
      suggestionsPanel
    ) : panel === "bolumler" ? (
      liveStructure ? (
        <StructureView report={liveStructure} t={t} onPick={goToText} />
      ) : null
    ) : panel === "hazirlik" ? (
      <div className="flex flex-col gap-3">
        {wsIssues > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="text-xs text-muted">
              <span className="font-semibold text-foreground">{t.tidyCount.replace("{count}", String(wsIssues))}</span>
              <span className="mt-0.5 block">{t.tidyHint}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setRaw((prev) => cleanWhitespace(prev));
                resetResults();
                setManualEdit(true);
              }}
              className="shrink-0 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent-soft"
            >
              {t.tidyCta}
            </button>
          </div>
        )}
        <PrepView
          fixes={prepFixes}
          setRaw={(v) => {
            setRaw(v);
            setManualEdit(true);
          }}
          t={t}
        />
      </div>
    ) : panel === "bul" ? (
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">
          {isTr ? "Aranan" : "Find"}
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                findStep(e.shiftKey ? -1 : 1);
              }
            }}
            placeholder={isTr ? "Kelime ya da ifade" : "Word or phrase"}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none transition focus:border-accent"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-muted">
            {findQuery.trim()
              ? findCount === 0
                ? isTr
                  ? "Bulunamadı"
                  : "No matches"
                : findPos
                  ? `${findPos.index + 1} / ${findPos.total}`
                  : isTr
                    ? `${findCount} sonuç`
                    : `${findCount} matches`
              : ""}
          </span>
          <button
            type="button"
            onClick={() => findStep(-1)}
            disabled={findCount === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:opacity-40"
            aria-label={isTr ? "Önceki" : "Previous"}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => findStep(1)}
            disabled={findCount === 0}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition enabled:hover:border-accent disabled:opacity-40"
          >
            {isTr ? "Sonraki ↓" : "Next ↓"}
          </button>
        </div>
        <label className="mt-2 text-sm font-medium text-foreground">
          {isTr ? "Yerine yazılacak" : "Replace with"}
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder={isTr ? "Boş bırakırsan silinir" : "Leave empty to delete"}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none transition focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={replaceAll}
          disabled={!findQuery.trim() || findCount === 0}
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {isTr ? `Tümünü değiştir${findCount ? ` (${findCount})` : ""}` : `Replace all${findCount ? ` (${findCount})` : ""}`}
        </button>
        <p className="text-xs leading-relaxed text-muted">
          {isTr
            ? "Büyük/küçük harf fark etmez. Değiştirdikten sonra geri al düğmesiyle (↶) ya da ⌘Z ile geri alabilirsin."
            : "Not case-sensitive. Undo with the undo button (↶) or ⌘Z."}
        </p>
      </div>
    ) : panel === "gecmis" ? (
      historyItems.length > 0 ? (
        <ul className="flex flex-col gap-2">{historyItems}</ul>
      ) : (
        <div className="rounded-xl border border-border bg-background/60 px-4 py-6 text-center text-sm leading-relaxed text-muted">
          {isTr
            ? "Henüz uyguladığın ya da atladığın bir öneri yok. Yazarken yaptığın değişiklikleri üstteki geri al düğmesiyle geri alabilirsin."
            : "No applied or skipped suggestions yet. Undo your own typing with the undo button above."}
        </div>
      )
    ) : (
      // Ayarlar
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="text-sm font-semibold text-foreground">{isTr ? "Sayfadaki işaretler" : "Marks on the page"}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {isTr
              ? "Sayfada gördüğün metin, kitabın kaydedilen metninin birebir aynısıdır. Soluk renkli işaretler kitapta görünmez, yalnız biçimi belirler: # bölüm başlığı, ## alt başlık, > alıntı/şiir, **kalın**, *italik*, [[sayfa-sonu]] yeni sayfa, kelime[^1] dipnot işareti; [^1]: ile başlayan satır o dipnotun metnidir (kitapta sayfa altına iner). Enter yeni paragraf açar. Shift+Enter yalnız ekranda alt satıra geçer; kitapta satırlar aynı paragraf içinde akar."
              : "The page shows the book's saved text exactly. Faint marks don't print; they set the format: # chapter title, ## subtitle, > quote/verse, **bold**, *italic*, [[sayfa-sonu]] page break, word[^1] footnote mark; a line starting with [^1]: is that footnote's text (printed at the foot of the page). Enter starts a new paragraph. Shift+Enter breaks the line on screen only; in the book the lines flow on in the same paragraph."}
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">{isTr ? "Metin" : "Text"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (hasText && !window.confirm(isTr ? "Örnek metin şu anki metnin yerini alır. Devam edilsin mi?" : "The sample replaces the current text. Continue?"))
                  return;
                setRaw(SAMPLE_TR);
                resetResults();
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent"
            >
              {t.sampleCta}
            </button>
            <button
              type="button"
              disabled={!hasText}
              onClick={() => {
                if (!window.confirm(isTr ? "Kitabın bütün metni silinecek. Emin misin?" : "This deletes the whole text. Are you sure?")) return;
                setRaw("");
                resetResults();
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-red-600 transition enabled:hover:border-red-300 disabled:opacity-40"
            >
              {t.clearCta}
            </button>
          </div>
        </section>

        {canSave && (
          <section>
            <h3 className="text-sm font-semibold text-foreground">{isTr ? "Kayıt" : "Saving"}</h3>
            <button
              type="button"
              onClick={saveNow}
              disabled={saveStatus?.state === "saving"}
              className="mt-2 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {saveStatus?.state === "saving" ? SAVE_LABELS[lang].saving : t.saveCta}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t.saveHint}</p>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold text-foreground">Word</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.wordHint}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{originalDocx ? t.exportDocxHintKept : t.exportDocxHint}</p>
        </section>
      </div>
    );

  const RAIL: { id: PanelId; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
    { id: "oneriler", label: isTr ? "Metin" : "Text", Icon: TextTIcon },
    { id: "bolumler", label: isTr ? "Bölümler" : "Chapters", Icon: ListIcon },
    { id: "bul", label: isTr ? "Bul" : "Find", Icon: SearchIcon },
    { id: "gecmis", label: isTr ? "Geçmiş" : "History", Icon: HistoryIcon },
    { id: "ayarlar", label: isTr ? "Ayarlar" : "Settings", Icon: GearIcon },
  ];

  const toast = importError
    ? { text: t.wordError, tone: "error" as const }
    : importInfo
      ? { text: importInfo, tone: "info" as const }
      : exportInfo
        ? { text: exportInfo, tone: "info" as const }
        : null;
  // Bildirim 12 sn sonra kendiliğinden kalkar (sonraki işlemin mesajını örtmesin).
  useEffect(() => {
    if (!importInfo && !exportInfo && !importError) return;
    const id = window.setTimeout(() => {
      setImportInfo(null);
      setExportInfo(null);
      setImportError(false);
    }, 12000);
    return () => window.clearTimeout(id);
  }, [importInfo, exportInfo, importError]);

  const reviewStatus = running
    ? { dot: "bg-amber-400 animate-pulse", text: jobLabel ?? "" }
    : checkError
      ? { dot: "bg-red-500", text: isTr ? "İnceleme tamamlanamadı" : "Review failed" }
      : stopped
        ? { dot: "bg-amber-400", text: isTr ? "İnceleme yarıda kaldı" : "Review stopped" }
        : suggestions
          ? { dot: "bg-emerald-500", text: isTr ? "Son inceleme tamamlandı" : "Last review complete" }
          : { dot: "bg-border", text: isTr ? "Henüz incelenmedi" : "Not reviewed yet" };

  const tbBtn =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition disabled:opacity-35";
  const tbIdle = "text-foreground/75 enabled:hover:bg-accent-soft enabled:hover:text-foreground";
  const canFormat = !!api;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleDocx(file);
          e.target.value = "";
        }}
      />

      {/* ── Üst çubuk ── */}
      {!focusMode && (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 lg:px-5">
          <Link href={`/${lang}/projeler`} className="flex shrink-0 items-center gap-2" aria-label="Laycoty">
            <Logo className="h-9 w-9 text-base" />
            <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline">laycoty</span>
          </Link>
          <span className="hidden h-7 w-px shrink-0 bg-border md:block" />
          <Link
            href={`/${lang}/projeler`}
            aria-label={isTr ? "Kitaplarım" : "My books"}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-foreground md:flex"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden 2xl:inline">{isTr ? "Kitaplarım" : "My books"}</span>
          </Link>
          <span className="hidden h-7 w-px shrink-0 bg-border md:block" />
          <span
            className="hidden h-8 w-8 shrink-0 rounded-lg sm:block"
            style={{ background: "linear-gradient(135deg, var(--color-accent), #7c3aed)" }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground sm:max-w-[16rem] sm:flex-none xl:max-w-[22rem]" title={docTitle}>
            {docTitle}
          </span>
          {canSave && (
            <button
              type="button"
              onClick={saveNow}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-1.5 py-1 text-sm transition hover:bg-accent-soft ${
                saveStatus?.state === "error" ? "font-semibold text-red-600" : "text-muted"
              }`}
              aria-live="polite"
              title={`${isTr ? "Şimdi kaydet (⌘S)" : "Save now (⌘S)"}${
                saveStatus?.state === "saved" && saveStatus.savedAt ? ` · ${formatSavedTime(saveStatus.savedAt, lang)}` : ""
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  saveStatus?.state === "error"
                    ? "bg-red-500"
                    : saveStatus?.state === "dirty" || saveStatus?.state === "saving"
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                }`}
              />
              <span className={saveStatus?.state === "error" ? "" : "hidden 2xl:inline"}>
                {saveStatus ? SAVE_LABELS[lang][saveStatus.state] : isTr ? "Kaydedildi" : "Saved"}
              </span>
            </button>
          )}

          {wizardActive && wizard && (
            <nav className="ml-2 hidden shrink-0 items-center gap-1 2xl:flex" aria-label={isTr ? "Adımlar" : "Steps"}>
              {wizardSteps.map(([seg, label, done], i) => (
                <Link
                  key={seg}
                  href={`/${lang}/${seg}?project=${projectId}`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    seg === "editor" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  {seg === "editor" && busy ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
                  ) : (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        done ? "bg-emerald-600 text-white" : seg === "editor" ? "bg-accent text-white" : "border border-border"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                  )}
                  {label}
                </Link>
              ))}
            </nav>
          )}
          {wizardActive && wizard && (
            <div className="relative shrink-0 2xl:hidden">
              <button
                type="button"
                onClick={() => setStepsOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={stepsOpen}
                className="flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {isTr ? "Adım 1/3" : "Step 1/3"} <span aria-hidden="true">▾</span>
              </button>
              {stepsOpen && (
                <>
                  <button type="button" aria-label="×" className="fixed inset-0 z-30 cursor-default" onClick={() => setStepsOpen(false)} />
                  <div role="menu" className="absolute left-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                    {wizardSteps.map(([seg, label, done], i) => (
                      <Link
                        key={seg}
                        href={`/${lang}/${seg}?project=${projectId}`}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent"
                      >
                        <span className="w-4 text-center text-xs">{done ? "✓" : i + 1}</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="hidden flex-1 sm:block" />
          <button
            type="button"
            onClick={() => api?.editor.chain().focus().undo().run()}
            disabled={!canFormat || !edState.canUndo}
            title={isTr ? "Geri al (⌘Z)" : "Undo (⌘Z)"}
            aria-label={isTr ? "Geri al" : "Undo"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition enabled:hover:bg-accent-soft enabled:hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => api?.editor.chain().focus().redo().run()}
            disabled={!canFormat || !edState.canRedo}
            title={isTr ? "Yinele (⌘⇧Z)" : "Redo (⌘⇧Z)"}
            aria-label={isTr ? "Yinele" : "Redo"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition enabled:hover:bg-accent-soft enabled:hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpRightIcon className="h-5 w-5" />
          </button>
          <span className="hidden h-7 w-px shrink-0 bg-border sm:block" />
          <button
            type="button"
            onClick={() => void handleExportDocx()}
            disabled={!hasText || exporting}
            title={originalDocx ? t.exportDocxHintKept : t.exportDocxHint}
            className="hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-semibold text-accent transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 md:flex"
          >
            {exporting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            ) : (
              <DownloadIcon className="h-4 w-4" />
            )}
            {exporting ? t.exportDocxBusy : isTr ? "Word indir" : "Download Word"}
          </button>
          {/* Metni incele ▾ — ana düğme 1. kontrolü başlatır, menüde altısı da var. */}
          <div className="relative shrink-0">
            <div className="flex overflow-hidden rounded-xl bg-accent text-white shadow-sm">
              <button
                type="button"
                onClick={() => runCheck("check")}
                disabled={!hasText || busy}
                title={`${t.checkHint} · ${costHint("check")}`}
                aria-label={isTr ? "Metni incele" : "Review text"}
                className="flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <MagicWandIcon className="h-4 w-4 sm:hidden" />
                )}
                <span className="hidden sm:inline">{busy ? jobLabel : isTr ? "Metni incele" : "Review text"}</span>
              </button>
              <button
                type="button"
                onClick={() => setChecksMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={checksMenuOpen}
                aria-label={isTr ? "Tüm kontroller" : "All checks"}
                className="border-l border-white/25 px-2.5 transition hover:bg-white/10"
              >
                <CaretDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {checksMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setChecksMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl">
                  {STEPS.map((st) => (
                    <button
                      key={st.n}
                      type="button"
                      role="menuitem"
                      onClick={() => startStep(st.kind)}
                      disabled={!hasText || busy}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition enabled:hover:bg-accent-soft disabled:opacity-40"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-bold text-accent">
                        {st.n}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{st.title}</span>
                        <span className="block text-xs text-muted">
                          {st.paid ? costHint(st.kind as CheckKind) : isTr ? "ücretsiz · hemen açılır" : "free · opens instantly"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {wizardActive && (
            <button
              type="button"
              onClick={() => void finishWizard()}
              disabled={wizardBusy}
              title={isTr ? "Editör adımını tamamla ve mizanpaja geç" : "Finish this step and go to layout"}
              className="shrink-0 whitespace-nowrap rounded-xl border border-emerald-600/40 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              <span className="hidden sm:inline">{isTr ? "Tamamla →" : "Finish →"}</span>
              <span className="sm:hidden">✓</span>
            </button>
          )}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              title={user?.name}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #d946ef, #9333ea)" }}
            >
              {user?.initials ?? "?"}
            </button>
            {accountOpen && (
              <>
                <button type="button" aria-label="×" className="fixed inset-0 z-30 cursor-default" onClick={() => setAccountOpen(false)} />
                <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                  {user?.name && <div className="truncate px-4 py-2 text-sm font-semibold text-foreground">{user.name}</div>}
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      void handleExportDocx();
                    }}
                    disabled={!hasText || exporting}
                    className="block w-full px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent disabled:opacity-40 md:hidden"
                  >
                    {isTr ? "Word indir" : "Download Word"}
                  </button>
                  <Link href={`/${lang}/projeler`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {isTr ? "Kitaplarım" : "My books"}
                  </Link>
                  <Link href={`/${lang}/jetonlar`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {isTr ? "Jetonlarım" : "My credits"}
                    {balance !== null && <span className="ml-1.5 text-muted">({balance})</span>}
                  </Link>
                  {signOut && (
                    <form action={signOut} className="border-t border-border">
                      <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                        {isTr ? "Çıkış yap" : "Sign out"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ── Sol araç şeridi ── */}
        {!focusMode && (
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:w-[92px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
            {RAIL.map(({ id, label, Icon }) => {
              const active = panel === id && sidePanelOpen;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openPanel(id)}
                  aria-pressed={active}
                  className={`relative flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition lg:w-full [@media(max-height:820px)]:py-2 ${
                    active ? "bg-accent-soft text-accent" : "text-foreground/70 hover:bg-background hover:text-foreground"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {label}
                  {id === "oneriler" && groupCounts.all > 0 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-white">
                      {groupCounts.all}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={pickWord}
              disabled={importing}
              title={t.wordHint}
              className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium text-foreground/70 transition hover:bg-background hover:text-foreground disabled:opacity-50 lg:mt-auto lg:w-full lg:border lg:border-border [@media(max-height:820px)]:py-2"
            >
              {importing ? (
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              ) : (
                <UploadIcon className="h-6 w-6" />
              )}
              <span className="text-center leading-tight">{importing ? t.wordImporting : isTr ? "Word yükle" : "Upload Word"}</span>
            </button>
          </nav>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
            {/* ── Yazma alanı ── */}
            <section className="flex h-[80dvh] min-w-0 shrink-0 flex-col gap-2 p-2 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink lg:p-3">
              <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-2xl border border-border bg-surface px-2 py-1.5 shadow-sm">
                <select
                  value={edState.block}
                  onChange={(e) => api && setBlockStyle(api.editor, e.target.value as BlockStyle)}
                  disabled={!canFormat}
                  aria-label={isTr ? "Paragraf stili" : "Paragraph style"}
                  className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition focus:border-accent disabled:opacity-40"
                >
                  <option value="paragraph">{isTr ? "Gövde metni" : "Body text"}</option>
                  <option value="h1">{isTr ? "Bölüm başlığı" : "Chapter title"}</option>
                  <option value="h2">{isTr ? "Alt başlık" : "Subtitle"}</option>
                  <option value="h3">{isTr ? "Ara başlık" : "Section heading"}</option>
                  <option value="h4">{isTr ? "Küçük başlık" : "Minor heading"}</option>
                  <option value="quote">{isTr ? "Alıntı / şiir" : "Quote / verse"}</option>
                </select>
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    remember("editor-ekran-font", e.target.value);
                  }}
                  title={isTr ? "Yalnız ekranda okuma kolaylığı içindir; kitabın yazı tipi Mizanpaj'da seçilir." : "Screen only; the book's font is chosen in Layout."}
                  aria-label={isTr ? "Ekran yazı tipi" : "Screen font"}
                  className="hidden h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none transition focus:border-accent sm:block"
                >
                  {SCREEN_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <select
                  value={fontPx}
                  onChange={(e) => {
                    setFontPx(Number(e.target.value));
                    remember("editor-ekran-punto", e.target.value);
                  }}
                  title={isTr ? "Ekran yazı boyutu (kitaba etki etmez)" : "Screen text size (doesn't affect the book)"}
                  aria-label={isTr ? "Ekran yazı boyutu" : "Screen text size"}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-accent"
                >
                  {[15, 16, 17, 18, 20, 22, 24, 26].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api && toggleInline(api.editor, "**")}
                  disabled={!canFormat}
                  aria-pressed={edState.bold}
                  title={isTr ? "Kalın (⌘B)" : "Bold (⌘B)"}
                  className={`${tbBtn} ${edState.bold && canFormat ? "bg-accent-soft text-accent" : tbIdle}`}
                >
                  <b className="text-base">B</b>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api && toggleInline(api.editor, "*")}
                  disabled={!canFormat}
                  aria-pressed={edState.italic}
                  title={isTr ? "İtalik (⌘I)" : "Italic (⌘I)"}
                  className={`${tbBtn} ${edState.italic && canFormat ? "bg-accent-soft text-accent" : tbIdle}`}
                >
                  <i className="font-serif text-base">I</i>
                </button>
                <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api && insertTokenLine(api.editor, "[[sayfa-sonu]]")}
                  disabled={!canFormat}
                  title={isTr ? "Buradan sonrası kitapta yeni sayfadan başlasın (⌘⏎)" : "Start a new page here in the book (⌘⏎)"}
                  className={`${tbBtn} ${tbIdle} hidden md:flex`}
                >
                  {isTr ? "⤓ Sayfa sonu" : "⤓ Page break"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api && insertTokenLine(api.editor, "[[bosluk:8]]")}
                  disabled={!canFormat}
                  title={isTr ? "Kitapta buraya dikey boşluk ekle" : "Add vertical space here in the book"}
                  className={`${tbBtn} ${tbIdle} hidden md:flex`}
                >
                  {isTr ? "␣ Boşluk" : "␣ Space"}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => api && insertFootnote(api.editor)}
                  disabled={!canFormat}
                  title={isTr ? "İmlecin olduğu kelimeye dipnot ekle; not metnini altına yaz (⌘⌥F)" : "Add a footnote to the word at the cursor; type the note below it (⌘⌥F)"}
                  className={`${tbBtn} ${tbIdle} hidden md:flex`}
                >
                  {isTr ? "¹ Dipnot" : "¹ Footnote"}
                </button>
                <button
                  type="button"
                  onClick={() => api?.editor.chain().focus().undo().run()}
                  disabled={!canFormat || !edState.canUndo}
                  aria-label={isTr ? "Geri al" : "Undo"}
                  className={`${tbBtn} ${tbIdle} sm:hidden`}
                >
                  <ArrowUUpLeftIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => api?.editor.chain().focus().redo().run()}
                  disabled={!canFormat || !edState.canRedo}
                  aria-label={isTr ? "Yinele" : "Redo"}
                  className={`${tbBtn} ${tbIdle} sm:hidden`}
                >
                  <ArrowUUpRightIcon className="h-4 w-4" />
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setFocusMode((v) => !v)}
                  title={focusMode ? (isTr ? "Odak modundan çık (Esc)" : "Exit focus mode (Esc)") : isTr ? "Yalnız metin kalsın" : "Show only the text"}
                  className={`${tbBtn} gap-2 px-3 ${focusMode ? "bg-accent text-white hover:opacity-90" : tbIdle}`}
                >
                  <ArrowsOutIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{focusMode ? (isTr ? "Odaktan çık" : "Exit focus") : isTr ? "Odak modu" : "Focus mode"}</span>
                </button>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
                    <ManuscriptEditor
                      value={raw}
                      onChange={onEditorChange}
                      marks={marks}
                      activeMark={activeMark}
                      onMarkClick={onMarkClick}
                      finder={fuzzyFind}
                      onReady={setApi}
                      onState={onEdState}
                      fontPx={fontPx}
                      fontFamily={fontFamily}
                      placeholder={t.textPlaceholder}
                    />
                    {!hasText && (
                      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto max-w-md px-6 text-center text-base text-[#8a8a96]">
                        {isTr
                          ? "Kitabının metnini buraya yaz ya da yapıştır. Soldaki “Word yükle” ile bir Word dosyası da açabilirsin."
                          : "Type or paste your manuscript here, or open a Word file with “Upload Word” on the left."}
                      </div>
                    )}
              </div>
            </section>

            {/* ── Sağ panel ── */}
            {!focusMode && (
              <aside
                className={`flex shrink-0 flex-col border-t border-border bg-surface lg:min-h-0 lg:border-l lg:border-t-0 ${
                  sidePanelOpen ? "lg:w-[400px]" : "lg:w-14"
                }`}
              >
                {sidePanelOpen ? (
                  <>
                    <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
                      {panel === "hazirlik" ? (
                        <button
                          type="button"
                          onClick={() => setPanel("oneriler")}
                          aria-label={isTr ? "Önerilere dön" : "Back to suggestions"}
                          className="-ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/70 transition hover:bg-accent-soft"
                        >
                          ←
                        </button>
                      ) : (
                        <MagicWandIcon className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
                          {PANEL_META[panel].title}
                          {panel === "oneriler" && groupCounts.all > 0 && (
                            <span className="rounded-full bg-accent px-2 text-xs font-bold leading-5 text-white">{groupCounts.all}</span>
                          )}
                        </h2>
                        <p className="mt-0.5 text-sm text-muted">{PANEL_META[panel].sub}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPanelOpen(false)}
                        title={isTr ? "Paneli gizle" : "Hide panel"}
                        aria-label={isTr ? "Paneli gizle" : "Hide panel"}
                        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition hover:bg-accent-soft hover:text-foreground lg:flex"
                      >
                        ›
                      </button>
                    </div>
                    <div key={panel} className="overflow-y-auto px-4 py-4 max-lg:max-h-[75vh] lg:min-h-0 lg:flex-1">
                      {panelBody}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPanelOpen(true)}
                    title={isTr ? "Paneli göster" : "Show panel"}
                    className="hidden h-full flex-col items-center gap-3 px-2 py-4 text-foreground/70 transition hover:bg-accent-soft hover:text-foreground lg:flex"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">‹</span>
                    <MagicWandIcon className="h-6 w-6 text-accent" />
                    {groupCounts.all > 0 && (
                      <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold leading-5 text-white">{groupCounts.all}</span>
                    )}
                  </button>
                )}
              </aside>
            )}
          </div>

          {/* ── Durum çubuğu ── */}
          {!focusMode && (
            <footer
              className={`mx-2 mb-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-muted lg:mx-3 lg:mb-3 ${
                wizardActive ? "mr-32 sm:mr-36 lg:mr-36" : ""
              }`}
            >
              <span className="whitespace-nowrap">
                {stats.words.toLocaleString(isTr ? "tr-TR" : "en-US")} {t.statsWords} ·{" "}
                {stats.chars.toLocaleString(isTr ? "tr-TR" : "en-US")} {t.statsChars}
              </span>
              {toast && (
                <span className={`min-w-0 truncate text-xs ${toast.tone === "error" ? "text-red-600" : "text-accent"}`} title={toast.text}>
                  {toast.text}
                </span>
              )}
              <span className="flex-1" />
              <span className="whitespace-nowrap rounded-lg border border-border px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                {isTr ? "Türkçe" : "English"}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className={`h-2 w-2 rounded-full ${reviewStatus.dot}`} />
                {reviewStatus.text}
              </span>
            </footer>
          )}
        </div>
      </div>
      {wizardActive && !focusMode && <WizardGuide lang={lang} step="editor" projectId={projectId!} />}
    </div>
  );
}

// Ekran (yalnız okuma) yazı tipleri — sayfada zaten yüklü Google yazı tipleri.
const SCREEN_FONTS = ["Merriweather", "Lora", "EB Garamond", "Libre Baskerville", "Cormorant Garamond"];

// Üslup sekmesine giren kategoriler (yazım = spelling/grammar/punctuation;
// gerisi risk ve türe özel notlar → "Diğer").
const STYLE_CATEGORIES = new Set<Category>([
  "fluency",
  "sentence_structure",
  "diction",
  "dialogue",
  "concision",
  "clarity",
  "register",
  "long",
  "repetition",
  "flow",
  "tone",
  "paragraph",
]);

type SvgProps = { className?: string };
function Svg({ className, children }: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
function ListIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 8.5h6M9 12h6M9 15.5h4" />
    </Svg>
  );
}
function SearchIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </Svg>
  );
}
function HistoryIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4" />
      <path d="M12 8v4.5l3 2" />
    </Svg>
  );
}
function GearIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Svg>
  );
}
function UploadIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}
function DownloadIcon({ className }: SvgProps) {
  return (
    <Svg className={className}>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}
