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
