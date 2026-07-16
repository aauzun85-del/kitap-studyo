// Word içe-aktarımındaki RESİM ve TABLO'yu markdown `raw` içinde kaybetmeden
// taşıyan jeton biçimi — hem yazıcı (blocksToMarkdown) hem okuyucu (parseBlocks)
// buradan okur. Yalnız TİP import'u (Block/Run erased → döngüsel çalışma-zamanı yok).

import type { Block, Run } from "./paginate";

// Resim bloğunun ikili verisini taşıyan oturum haritası (ID → resim bloğu).
// İkili veri markdown'a sığmaz → jeton + harita. (Kalıcılık: Faz 2.)
export type MediaMap = Map<string, Extract<Block, { type: "image" }>>;

export const TABLE_FENCE = "kitap-tablo";
export const IMG_PREFIX = "kitap-gorsel:";

// ── Yazıcı (encode) ─────────────────────────────────────────────────────────
export function imageToken(id: string): string {
  return `![](${IMG_PREFIX}${id})`;
}

// Tablo bloğunu ```kitap-tablo fence'ine kodla (tek satır JSON → boş satır yok →
// parseBlocks'un tek "chunk"u olarak kalır, raw'a KALICI yazılır).
export function tableToFence(block: Extract<Block, { type: "table" }>): string {
  const json = JSON.stringify({ columns: block.columns, rows: block.rows });
  return "```" + TABLE_FENCE + "\n" + json + "\n```";
}

// ── Okuyucu (decode) ────────────────────────────────────────────────────────
// Bir "chunk" resim jetonu mu? → ID (yoksa null).
export function matchImageToken(chunk: string): string | null {
  const m = /^!\[[^\]]*\]\(kitap-gorsel:([^)]+)\)$/.exec(chunk.trim());
  return m ? m[1] : null;
}

// ── Sayfa düzeni işaretleri (Yaz görünümü: sayfa sonu / boşluk) ──────────────
export const PAGEBREAK_TOKEN = "[[sayfa-sonu]]";
export const DEFAULT_SPACER_MM = 8;

export function spacerToken(mm: number): string {
  return `[[bosluk:${mm}]]`;
}

// Bir "chunk" sayfa-sonu jetonu mu?
export function matchPageBreak(chunk: string): boolean {
  return chunk.trim() === PAGEBREAK_TOKEN;
}

// Bir "chunk" boşluk jetonu mu? → mm (yoksa null). "[[bosluk]]" = varsayılan.
export function matchSpacer(chunk: string): number | null {
  const m = /^\[\[bosluk(?::(\d+(?:\.\d+)?))?\]\]$/.exec(chunk.trim());
  if (!m) return null;
  return m[1] ? parseFloat(m[1]) : DEFAULT_SPACER_MM;
}

// ── Paragraf biçimi işareti (biçim çubuğu: yazı tipi / punto) ────────────────
// Bloğun İLK satırı olarak yazılır: "[[stil:font=arnopro;punto=12.5]]".
// blocksToMarkdown yazar, parseBlocks okuyup bloğa uygular → blok-bazlı
// font/punto raw'da KALICI olur (kaydet/yenile/PDF hepsinde yaşar).
// Bilinmeyen alanlar yok sayılır → ileriye uyumlu.
export type FmtMark = { fontId?: string; sizePt?: number };

export function fmtToken(m: FmtMark): string | null {
  const parts: string[] = [];
  if (m.fontId) parts.push(`font=${m.fontId}`);
  if (m.sizePt != null && Number.isFinite(m.sizePt)) parts.push(`punto=${m.sizePt}`);
  return parts.length ? `[[stil:${parts.join(";")}]]` : null;
}

// Bir satır stil işareti mi? → FmtMark (yoksa null).
export function matchFmtLine(line: string): FmtMark | null {
  const m = /^\[\[stil:([^\]]*)\]\]$/.exec(line.trim());
  if (!m) return null;
  const out: FmtMark = {};
  for (const kv of m[1].split(";")) {
    const eq = kv.indexOf("=");
    if (eq <= 0) continue;
    const k = kv.slice(0, eq);
    const v = kv.slice(eq + 1);
    if (k === "font" && v) out.fontId = v;
    if (k === "punto") {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) out.sizePt = n;
    }
  }
  return out.fontId || out.sizePt != null ? out : null;
}

// Bir "chunk" tablo fence'i mi? → table bloğu (yoksa null).
export function matchTableFence(chunk: string): Extract<Block, { type: "table" }> | null {
  const t = chunk.trim();
  if (!t.startsWith("```" + TABLE_FENCE)) return null;
  const body = t.replace(/^```kitap-tablo\s*/, "").replace(/```$/, "").trim();
  try {
    const obj = JSON.parse(body) as { columns: number; rows: Run[][][] };
    if (typeof obj.columns === "number" && Array.isArray(obj.rows)) {
      return { type: "table", columns: obj.columns, rows: obj.rows };
    }
  } catch {
    /* bozuk fence → yok say */
  }
  return null;
}
