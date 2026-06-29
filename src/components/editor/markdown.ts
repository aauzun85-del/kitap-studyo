// Editör (TipTap/ProseMirror) belgesi ↔ MARKDOWN köprüsü. Markdown, kayıt
// kaynağıdır (manuscript.text) ve parseBlocks'un okuduğu biçimdir → editör bu
// markdown'ı düzenler, kayıt/uyumluluk değişmez.
//
// Desteklenen (parseBlocks ile birebir): "# " başlık (1-3), "**kalın**",
// "*italik*", boş-satır ayraçlı paragraf. (v1: kalın+italik birlikte = kalın.)

import { matchPageBreak, matchSpacer, PAGEBREAK_TOKEN, spacerToken } from "@/lib/layout/mediaTokens";

type TextNode = { type: "text"; text?: string; marks?: { type: string }[] };
type Node = { type: string; attrs?: { level?: number; id?: string; json?: string; mm?: number }; content?: TextNode[] };
type Doc = { content?: Node[] };

// HTML öznitelik değeri için kaçış (resim ID / tablo JSON'unu div'e gömerken).
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Markdown → HTML (editöre ilk içerik) ───────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMdToHtml(s: string): string {
  let h = escapeHtml(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_]+)__/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/_([^_]+)_/g, "<em>$1</em>");
  return h;
}
export function markdownToHtml(md: string): string {
  const blocks = md.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const html = blocks
    .map((b) => {
      const line = b.trim();
      if (!line) return "";
      // Sayfa düzeni: sayfa sonu / boşluk kartı.
      if (matchPageBreak(line)) return `<div data-pagebreak></div>`;
      const sp = matchSpacer(line);
      if (sp != null) return `<div data-spacer data-mm="${sp}"></div>`;
      // Word'den gelen tablo (```kitap-tablo fence) → tablo kartı.
      if (line.startsWith("```kitap-tablo")) {
        const json = line.replace(/^```kitap-tablo\s*/, "").replace(/```\s*$/, "").trim();
        return `<div data-table-embed data-json="${escapeAttr(json)}"></div>`;
      }
      // Word'den gelen resim jetonu → resim kartı.
      const im = /^!\[[^\]]*\]\(kitap-gorsel:([^)]+)\)$/.exec(line);
      if (im) return `<div data-image-embed data-id="${escapeAttr(im[1])}"></div>`;
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const level = Math.min(h[1].length, 3);
        return `<h${level}>${inlineMdToHtml(h[2].trim())}</h${level}>`;
      }
      return `<p>${inlineMdToHtml(line.replace(/\n/g, " "))}</p>`;
    })
    .filter(Boolean)
    .join("");
  return html || "<p></p>";
}

// ── TipTap JSON → Markdown (kayıt + render) ────────────────────────────────
function inlineToMd(content: TextNode[] | undefined): string {
  if (!content) return "";
  return content
    .map((n) => {
      if (n.type !== "text") return "";
      let t = n.text ?? "";
      if (!t) return "";
      const marks = (n.marks ?? []).map((m) => m.type);
      // Kalın işaretleri metnin İÇİNDE değil DIŞINDA olmalı (boşlukları taşı).
      if (marks.includes("bold")) t = wrapMark(t, "**");
      else if (marks.includes("italic")) t = wrapMark(t, "*");
      return t;
    })
    .join("");
}
function wrapMark(t: string, mark: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
  if (!m || !m[2]) return t;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}
export function docToMarkdown(doc: Doc): string {
  const blocks = (doc.content ?? [])
    .map((node) => {
      // Word kartları → jeton/fence (raw'a geri yazılır, motor geri okur).
      if (node.type === "imageEmbed") {
        return node.attrs?.id ? `![](kitap-gorsel:${node.attrs.id})` : "";
      }
      if (node.type === "tableEmbed") {
        return node.attrs?.json ? "```kitap-tablo\n" + node.attrs.json + "\n```" : "";
      }
      if (node.type === "pageBreakEmbed") return PAGEBREAK_TOKEN;
      if (node.type === "spacerEmbed") return spacerToken(node.attrs?.mm ?? 8);
      const inner = inlineToMd(node.content);
      if (node.type === "heading") {
        const level = Math.min(node.attrs?.level ?? 1, 3);
        return inner ? `${"#".repeat(level)} ${inner}` : "";
      }
      return inner; // paragraph (boş paragraf = boş satır bloğu)
    })
    .join("\n\n");
  return blocks.replace(/\n{3,}/g, "\n\n").trim();
}
