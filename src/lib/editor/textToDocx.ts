// Düz metni geçerli bir .docx (Word) dosyasına çevirir. Tamamen tarayıcıda
// çalışır (JSZip); bir .docx aslında belirli XML parçaları içeren bir ZIP'tir.
// Editörde düzenlenen metni dışa aktarmak için kullanılır.
import JSZip from "jszip";

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

// Metni .docx içeriğine (Blob) çevirir. Her satır bir paragraf olur.
export function textToDocx(text: string): Promise<Blob> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const body = lines.map(paragraphXml).join("");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", ROOT_RELS);
  zip.folder("word")!.file("document.xml", documentXml);

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// Dosya adı için metinden güvenli bir taban üretir (ilk birkaç kelime).
export function suggestDocxName(text: string, fallback: string): string {
  const firstLine = text.trim().split("\n")[0] ?? "";
  const base = firstLine
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .slice(0, 40);
  return (base || fallback) + ".docx";
}
