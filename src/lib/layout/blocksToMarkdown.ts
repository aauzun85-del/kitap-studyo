// Block[] → markdown (parseBlocks'un TERSİ). Word'den içe aktarılan içeriği,
// editörün düzenlediği + projeye kaydedilen tek kaynağa (markdown `raw`) çevirir.
//
// Metin/başlık/alıntı doğrudan markdown'a iner. Resim/tablo kaybolmasın diye
// mediaTokens.ts'teki jeton biçimi kullanılır (tablo raw'a kalıcı, resim oturum
// haritasıyla). parseBlocks (paginate.ts) bu jetonları geri okur.

import type { Block, Run } from "./paginate";
import { type MediaMap, imageToken, tableToFence, PAGEBREAK_TOKEN, spacerToken } from "./mediaTokens";

// Tek satıra inen kalın/italik markdown (inlineRuns'ın tersi). Boşluklar işaretin
// DIŞINA taşınır (parseBlocks'taki inlineRuns "** x **" gibi şeyleri çözemez).
function runsToMarkdown(runs: Run[]): string {
  return runs
    .map((r) => {
      const t = r.text;
      if (!t) return "";
      const mark = r.bold ? "**" : r.italic ? "*" : "";
      if (!mark) return t;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
      if (!m || !m[2]) return t;
      return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
    })
    .join("");
}

export function blocksToMarkdown(blocks: Block[]): { markdown: string; media: MediaMap } {
  const media: MediaMap = new Map();
  const parts: string[] = [];

  blocks.forEach((b, i) => {
    switch (b.type) {
      case "heading": {
        const lvl = Math.min(b.level, 4);
        // Kicker'ı AYRI bir "BÖLÜM N" başlığı olarak yaz → parseBlocks'taki
        // restructureHeadings onu tekrar bir sonraki başlığın kicker'ına katlar
        // (aynı chunk'a koymak başlığı blockquote sanılmasına yol açardı).
        if (b.kicker) parts.push("# " + b.kicker);
        parts.push("#".repeat(lvl) + " " + runsToMarkdown(b.runs));
        break;
      }
      case "paragraph":
        parts.push(runsToMarkdown(b.runs));
        break;
      case "blockquote":
        parts.push("> " + runsToMarkdown(b.runs));
        break;
      case "blank":
        parts.push("");
        break;
      case "image": {
        const id = `img-${i}`;
        media.set(id, b);
        parts.push(imageToken(id));
        break;
      }
      case "table":
        parts.push(tableToFence(b));
        break;
      case "pagebreak":
        parts.push(PAGEBREAK_TOKEN);
        break;
      case "spacer":
        parts.push(spacerToken(b.mm));
        break;
    }
  });

  // Bloklar boş satırla ayrılır (parseBlocks \n{2,} ile böler).
  return { markdown: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), media };
}
