// Mizanpaj ayarlarının projeye kaydı (envelope.modules.layout).
//
// Neden: metin/paragraf düzeltmeleri `raw` ile kaydoluyordu ama sol paneldeki
// ayarlar (yazı tipi, punto, satır aralığı, kenar boşlukları, tema…) hiç
// kaydedilmiyordu → sayfa her açılışta varsayılana dönüyor, İndir ekranındaki
// PDF de kullanıcının seçimleri yerine varsayılanlarla çıkıyordu.
//
// Okuma TEMKİNLİ: her alan tek tek tür/aralık denetiminden geçer; bozuk, eski ya
// da bilinmeyen değer sessizce yok sayılır (o alan varsayılandan başlar).

import type { Margins } from "./page";
import type { PrintStandard } from "./standards";
import type { ChapterOrnament } from "./themes";

export const LAYOUT_SETTINGS_VERSION = 1;

export type SavedLayoutSettings = {
  v: number;
  // Sayfa
  standard: PrintStandard;
  bleedOn: boolean;
  sizeId: string;
  margins: Margins;
  presetId: string;
  gutterAuto: boolean;
  gutterManual: number;
  cropMarks: boolean;
  // Yazı
  themeId: string;
  fontId: string;
  headingFontId: string;
  bodySizePt: number;
  leadingPt: number;
  align: "left" | "justify";
  indentMm: number;
  paragraphSpacingMm: number;
  detectHeadings: boolean;
  kerning: boolean;
  // Yapı
  chapterRight: boolean;
  frontMatter: boolean;
  runningHeads: boolean;
  pageNumbers: boolean;
  hyphenate: boolean;
  dropCap: boolean;
  lineBreak: "balanced" | "greedy";
  chapterTopRatio: number;
  chapterOrnament: ChapterOrnament;
  showChapterKicker: boolean;
  tocOverrides: Record<number, string>;
};

const STANDARDS: PrintStandard[] = ["kdy", "akademi", "kdp", "ingram", "bnpress", "lulu", "serbest"];
const ORNAMENTS: ChapterOrnament[] = ["none", "rule", "dots"];

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, min: number, max: number) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max ? x : undefined;
const bool = (x: unknown) => (typeof x === "boolean" ? x : undefined);
const str = (x: unknown) => (typeof x === "string" && x.length <= 80 ? x : undefined);
function oneOf<T extends string>(x: unknown, list: readonly T[]): T | undefined {
  return typeof x === "string" && (list as readonly string[]).includes(x) ? (x as T) : undefined;
}

function margins(x: unknown): Margins | undefined {
  if (!isObj(x)) return undefined;
  const top = num(x.top, 0, 80);
  const bottom = num(x.bottom, 0, 80);
  const inside = num(x.inside, 0, 80);
  const outside = num(x.outside, 0, 80);
  if (top === undefined || bottom === undefined || inside === undefined || outside === undefined) return undefined;
  return { top, bottom, inside, outside };
}

function tocOverrides(x: unknown): Record<number, string> | undefined {
  if (!isObj(x)) return undefined;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(x)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && typeof v === "string" && v.length <= 300) out[i] = v;
  }
  return out;
}

/** Kayıtlı dilimi okur; geçersiz alanlar düşer. Hiç kayıt yoksa `null`. */
export function readSavedLayout(slice: unknown): Partial<SavedLayoutSettings> | null {
  if (!isObj(slice) || typeof slice.v !== "number") return null;
  const s = slice;
  const out: Partial<SavedLayoutSettings> = {
    v: s.v as number,
    standard: oneOf(s.standard, STANDARDS),
    bleedOn: bool(s.bleedOn),
    sizeId: str(s.sizeId),
    margins: margins(s.margins),
    presetId: str(s.presetId),
    gutterAuto: bool(s.gutterAuto),
    gutterManual: num(s.gutterManual, 0, 40),
    cropMarks: bool(s.cropMarks),
    themeId: typeof s.themeId === "string" && s.themeId.length <= 80 ? s.themeId : undefined,
    fontId: str(s.fontId),
    headingFontId: str(s.headingFontId),
    bodySizePt: num(s.bodySizePt, 5, 30),
    leadingPt: num(s.leadingPt, 0, 60),
    align: oneOf(s.align, ["left", "justify"] as const),
    indentMm: num(s.indentMm, 0, 40),
    paragraphSpacingMm: num(s.paragraphSpacingMm, 0, 40),
    detectHeadings: bool(s.detectHeadings),
    kerning: bool(s.kerning),
    chapterRight: bool(s.chapterRight),
    frontMatter: bool(s.frontMatter),
    runningHeads: bool(s.runningHeads),
    pageNumbers: bool(s.pageNumbers),
    hyphenate: bool(s.hyphenate),
    dropCap: bool(s.dropCap),
    lineBreak: oneOf(s.lineBreak, ["balanced", "greedy"] as const),
    chapterTopRatio: num(s.chapterTopRatio, 0, 0.6),
    chapterOrnament: oneOf(s.chapterOrnament, ORNAMENTS),
    showChapterKicker: bool(s.showChapterKicker),
    tocOverrides: tocOverrides(s.tocOverrides),
  };
  return out;
}
