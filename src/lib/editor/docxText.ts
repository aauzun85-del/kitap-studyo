// Editör için .docx → düz metin. Mizanpajın parseDocx'ini yeniden kullanır,
// ama editör yalnızca metni kontrol edeceği için biçim/başlık ayrımına gerek
// yoktur: tüm blokları paragraflara (boş satırla ayrılmış) düzleştirir.

import { parseDocx } from "@/lib/layout/docx";

export type DocxTextResult = {
  text: string;
  paragraphCount: number;
};

export function docxToText(buffer: ArrayBuffer): DocxTextResult {
  // "faithful" modu paragraf yapısını en sadık biçimde korur.
  const { blocks } = parseDocx(buffer, "faithful");

  const paragraphs: string[] = [];
  for (const block of blocks) {
    if (block.type === "blank") continue;
    if (!("runs" in block)) continue;
    const line = block.runs
      .map((r) => r.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (line) paragraphs.push(line);
  }

  return { text: paragraphs.join("\n\n"), paragraphCount: paragraphs.length };
}
