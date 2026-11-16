// Düz metni geçerli bir .docx (Word) dosyasına çevirir. Tamamen tarayıcıda
// çalışır (JSZip); bir .docx aslında belirli XML parçaları içeren bir ZIP'tir.
// Editörde düzenlenen metni dışa aktarmak için kullanılır.
import JSZip from "jszip";
import { extractFootnotes, FN_DEF_RE, FN_PH_RE } from "@/lib/layout/footnotes";

// XML'de özel anlamı olan karakterleri güvenli hâle getirir.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Bir metin satırını tek bir Word paragrafına (<w:p>) çevirir.
// Boş satır = boş paragraf (aradaki boşluğu korur).
function paragraphXml(line: string): string {
  if (line.trim() === "") return "<w:p/>";
  return (
    "<w:p><w:r><w:t xml:space=\"preserve\">" +
    escapeXml(line) +
    "</w:t></w:r></w:p>"
  );
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// ── Dipnotlar ──────────────────────────────────────────────────────────────
// Metindeki "[^id]" başvuruları + "[^id]: not" tanım satırları GERÇEK Word
// dipnotlarına çevrilir (word/footnotes.xml). Tanım satırları gövdeye yazılmaz.
// Dipnot yoksa çıktı eskisiyle aynıdır (ek parça eklenmez).

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Başvuru run'ı: Word'ün kendi biçimi (stil + doğrudan üst simge; styles.xml
// yazmadığımız için üst simge doğrudan verilir).
function footnoteRefRun(id: number): string {
  return (
    `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr>` +
    `<w:footnoteReference w:id="${id}"/></w:r>`
  );
}

// Yer tutucu içeren satır → paragraf (metin run'ları + dipnot başvuruları).
// Yer tutucular metinde dipnot sırasıyla geçer → next() k. dipnotun Word kimliği.
function paragraphWithRefsXml(line: string, next: () => number): string {
  if (line.trim() === "") return "<w:p/>";
  const re = new RegExp(FN_PH_RE.source, "g");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  const textRun = (t: string) =>
    t ? `<w:r><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>` : "";
  while ((m = re.exec(line))) {
    out += textRun(line.slice(last, m.index));
    out += footnoteRefRun(next());
    last = re.lastIndex;
  }
  out += textRun(line.slice(last));
  return `<w:p>${out}</w:p>`;
}

function footnotesXml(notes: { text: string }[]): string {
  const sep = (type: string, id: number, tag: string) =>
    `<w:footnote w:type="${type}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${tag}/></w:r></w:p></w:footnote>`;
  const items = notes
    .map(
      (n, i) =>
        `<w:footnote w:id="${i + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/><w:spacing w:after="0"/></w:pPr>` +
        `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/><w:sz w:val="20"/></w:rPr><w:footnoteRef/></w:r>` +
        `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve"> ${escapeXml(n.text)}</w:t></w:r></w:p></w:footnote>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="${W_NS}">${sep("separator", -1, "separator")}${sep("continuationSeparator", 0, "continuationSeparator")}${items}</w:footnotes>`;
}

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W_NS}"><w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr></w:settings>`;

const CONTENT_TYPES_FN = CONTENT_TYPES.replace(
  "</Types>",
  `<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`,
);

const DOC_RELS_FN = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

// Dipnotları ayıklar: tanım satırlarını (ve öncesindeki boş ayraç satırını)
// gövdeden çıkarır, başvuruları yer tutucuya çevirir. Dipnot yoksa null.
function splitFootnotes(text: string): { lines: string[]; notes: { text: string }[] } | null {
  if (!text.includes("[^")) return null;
  const src = text.split("\n");
  // Tanımdan önceki boş satırı tanıma kat: tanım silinince arda boş paragraf kalmasın.
  const joined = src.filter((l, i) => !(l.trim() === "" && i + 1 < src.length && FN_DEF_RE.test(src[i + 1].trim())));
  const { text: out, notes } = extractFootnotes(joined.join("\n"));
  if (!notes.length) return null;
  return { lines: out.split("\n"), notes };
}

// Metni .docx içeriğine (Blob) çevirir. Her satır bir paragraf olur.
export function textToDocx(text: string): Promise<Blob> {
  const normalized = text.replace(/\r\n/g, "\n");
  const fn = splitFootnotes(normalized);
  const lines = fn ? fn.lines : normalized.split("\n");
  let refId = 0;
  const nextRef = () => ++refId;
  const body = fn
    ? lines.map((l) => paragraphWithRefsXml(l, nextRef)).join("")
    : lines.map(paragraphXml).join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", fn ? CONTENT_TYPES_FN : CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", ROOT_RELS);
  zip.folder("word")!.file("document.xml", documentXml);
  if (fn) {
    zip.folder("word")!.file("footnotes.xml", footnotesXml(fn.notes));
    zip.folder("word")!.file("settings.xml", SETTINGS_XML);
    zip.folder("word")!.folder("_rels")!.file("document.xml.rels", DOC_RELS_FN);
  }

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// Dosya adı için metinden güvenli bir taban üretir (ilk birkaç kelime).
// `stamp` verilirse sonuna GünAyYıl_SaatDakika eklenir → "Kriptid_19102026_2300.docx":
// aynı kitabın sürümleri masaüstünde karışmaz, hangisinin yeni olduğu belli olur.
export function suggestDocxName(text: string, fallback: string, stamp?: Date): string {
  const firstLine = text.trim().split("\n")[0] ?? "";
  const base = firstLine
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 40);
  const name = base || fallback;
  if (!stamp) return name + ".docx";
  const p = (n: number) => String(n).padStart(2, "0");
  const d = `${p(stamp.getDate())}${p(stamp.getMonth() + 1)}${stamp.getFullYear()}`;
  const t = `${p(stamp.getHours())}${p(stamp.getMinutes())}`;
  return `${name}_${d}_${t}.docx`;
}
