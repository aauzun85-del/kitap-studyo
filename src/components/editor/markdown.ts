// Editör (TipTap/ProseMirror) belgesi ↔ MARKDOWN köprüsü. Markdown, kayıt
// kaynağıdır (manuscript.text) ve parseBlocks'un okuduğu biçimdir → editör bu
// markdown'ı düzenler, kayıt/uyumluluk değişmez.
//
// Desteklenen (parseBlocks ile birebir): "# " başlık (1-3), "**kalın**",
// "*italik*", boş-satır ayraçlı paragraf. (v1: kalın+italik birlikte = kalın.)

type TextNode = { type: "text"; text?: string; marks?: { type: string }[] };
type Node = { type: string; attrs?: { level?: number }; content?: TextNode[] };
type Doc = { content?: Node[] };

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
