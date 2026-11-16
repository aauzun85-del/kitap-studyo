// Block[] → markdown (parseBlocks'un TERSİ). Word'den içe aktarılan içeriği,
// editörün düzenlediği + projeye kaydedilen tek kaynağa (markdown `raw`) çevirir.
//
// Metin/başlık/alıntı doğrudan markdown'a iner. Resim/tablo kaybolmasın diye
// mediaTokens.ts'teki jeton biçimi kullanılır (tablo raw'a kalıcı, resim oturum
// haritasıyla). parseBlocks (paginate.ts) bu jetonları geri okur.

import type { Block, Run } from "./paginate";
import { type MediaMap, imageToken, tableToFence, PAGEBREAK_TOKEN, spacerToken, fmtToken } from "./mediaTokens";
import { COVER_FONTS } from "@/lib/cover/fonts";

// Blok-bazlı yazı tipi/punto geçersiz kılması varsa "[[stil:…]]" ön satırı üret.
// Font, aile adıyla değil KISA id ile yazılır (boşluksuz, kararlı).
function fmtPrefix(b: Extract<Block, { type: "paragraph" | "heading" | "blockquote" }>): string {
  const fontId = b.fontFamily
    ? COVER_FONTS.find((f) => f.family === b.fontFamily)?.id
    : undefined;
  const tok = fmtToken({ fontId, sizePt: b.sizePt });
  return tok ? tok + "\n" : "";
}

// Tek satıra inen kalın/italik markdown (inlineRuns'ın tersi). Boşluklar işaretin
// DIŞINA taşınır (parseBlocks'taki inlineRuns "** x **" gibi şeyleri çözemez).
function runsToMarkdown(runs: Run[]): string {
  return runs
    .map((r) => {
      // Dipnot başvurusu: biçim işaretlerinin DIŞINDA "[^id]" (tanımı blok sonrası).
      if (r.fn) return `[^${r.fn.id}]`;
      const t = r.text;
      if (!t) return "";
      const mark = r.bold && r.italic ? "***" : r.bold ? "**" : r.italic ? "*" : "";
      if (!mark) return t;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
      if (!m || !m[2]) return t;
      return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
    })
    .join("");
}

// Bloğun dipnotları → "[^id]: metin" satırları (bloğun hemen ardına, her biri
// kendi paragrafı). Dipnot metni tek satıra iner (dize sonu/satır sonu → boşluk).
function footnoteDefs(b: Block): string[] {
  const runs =
    b.type === "paragraph" || b.type === "heading" || b.type === "blockquote"
      ? b.runs
      : [];
  return runs
    .filter((r) => r.fn)
    .map((r) => `[^${r.fn!.id}]: ${runsToMarkdown(r.fn!.runs).replace(/[\u2028\n]+/g, " ").trim()}`);
}

export function blocksToMarkdown(blocks: Block[]): { markdown: string; media: MediaMap } {
  const media: MediaMap = new Map();
  const parts: string[] = [];

  blocks.forEach((b, i) => {
    pushBlock(b, i);
    parts.push(...footnoteDefs(b));
  });

  function pushBlock(b: Block, i: number) {
    switch (b.type) {
      case "heading": {
        const lvl = Math.min(b.level, 4);
        // Kicker'ı AYRI bir "BÖLÜM N" başlığı olarak yaz → parseBlocks'taki
        // restructureHeadings onu tekrar bir sonraki başlığın kicker'ına katlar
        // (aynı chunk'a koymak başlığı blockquote sanılmasına yol açardı).
        if (b.kicker) parts.push("# " + b.kicker);
        parts.push(fmtPrefix(b) + "#".repeat(lvl) + " " + runsToMarkdown(b.runs));
        break;
      }
      // Şiir dize sonları (LINE_SEP, U+2028) metne GERÇEK satır sonu olarak
      // döner: kayıtta görünmez karakter kalmaz; okuma kipini keepLineBreaks seçer.
      case "paragraph":
        parts.push(fmtPrefix(b) + runsToMarkdown(b.runs).replace(/\u2028/g, "\n"));
        break;
      case "blockquote":
        parts.push(fmtPrefix(b) + "> " + runsToMarkdown(b.runs).replace(/\u2028/g, "\n> "));
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
  }

  // Bloklar boş satırla ayrılır (parseBlocks \n{2,} ile böler).
  return { markdown: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), media };
}
