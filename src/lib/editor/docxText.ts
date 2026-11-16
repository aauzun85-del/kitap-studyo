// Editör için .docx → düz metin. Mizanpajın parseDocx'ini yeniden kullanır,
// ama editör yalnızca metni kontrol edeceği için biçim/başlık ayrımına gerek
// yoktur: tüm blokları paragraflara (boş satırla ayrılmış) düzleştirir.
//
// Dipnotlar: parseDocx başvuruları "[^n]" metni, tanımları "[^n]: not" paragrafı
// olarak verir; ikisi de buradan aynen geçer. Tablolar burada düşürüldüğü için
// tablo hücresindeki başvuruların tanımları da düşürülür (yetim kalmasın).

import { parseDocx } from "@/lib/layout/docx";
import { FN_DEF_RE, FN_REF_RE } from "@/lib/layout/footnotes";

export type DocxTextResult = {
  text: string;
  paragraphCount: number;
  /** Metne aktarılan dipnot sayısı (sonnotlar dahil). */
  footnoteCount: number;
};

export function docxToText(buffer: ArrayBuffer): DocxTextResult {
  // "faithful" modu paragraf yapısını en sadık biçimde korur.
  const { blocks, footnoteCount: total } = parseDocx(buffer, "faithful");

  // Düşürülen tabloların içindeki dipnot kimlikleri.
  const tableNoteIds = new Set<string>();
  if (total > 0) {
    for (const block of blocks) {
      if (block.type !== "table") continue;
      for (const row of block.rows)
        for (const cell of row)
          for (const r of cell)
            for (const m of r.text.matchAll(new RegExp(FN_REF_RE.source, "g"))) tableNoteIds.add(m[1]);
    }
  }

  const paragraphs: string[] = [];
  let defCount = 0;
  for (const block of blocks) {
    if (block.type === "blank") continue;
    if (!("runs" in block)) continue;
    const line = block.runs
      .map((r) => r.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) continue;
    if (total > 0) {
      const def = FN_DEF_RE.exec(line);
      if (def) {
        if (tableNoteIds.has(def[1])) continue;
        defCount++;
      }
    }
    paragraphs.push(line);
  }

  return {
    text: paragraphs.join("\n\n"),
    paragraphCount: paragraphs.length - defCount,
    footnoteCount: defCount,
  };
}
