// Bölümlere ayrılmış kitap metninden geçerli bir EPUB 3 dosyası (.epub) üretir.
// Tamamen tarayıcıda çalışır (JSZip); sunucu/servis gerekmez. EPUB 3 nav.xhtml
// ile birlikte EPUB 2 toc.ncx de yazılır — Amazon KDP ve eski okuyucularla
// uyum için. Bu dosya bilerek proje içi bir şeye bağlı değildir (yalnız jszip),
// böylece bağımsız olarak da test edilebilir.

import JSZip from "jszip";

export type EpubChapter = { title: string; paragraphs: string[] };

// Kapak görseli: ham bayt + MIME türü. mime'den dosya uzantısı türetilir.
export type EpubCover = { bytes: ArrayBuffer; mime: string };

export type EpubBook = {
  title: string;
  author: string;
  lang: string; // "tr" | "en" gibi
  tocTitle: string; // "İçindekiler" / "Table of Contents"
  chapters: EpubChapter[];
  cover?: EpubCover; // opsiyonel kapak görseli
};

// MIME türünden EPUB içindeki kapak dosyasının adını üretir.
function coverFileName(mime: string): string {
  if (mime === "image/png") return "cover.png";
  return "cover.jpg"; // image/jpeg ve bilinmeyenler için varsayılan
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Başlıktan güvenli bir dosya adı türetir (Türkçe harfler sadeleştirilir).
export function suggestFilename(title: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  const base = (title || "")
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "kitap") + ".epub";
}

function chapterXhtml(ch: EpubChapter, lang: string): string {
  const body = ch.paragraphs.map((p) => `    <p>${esc(p)}</p>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${esc(lang)}" lang="${esc(lang)}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <section epub:type="chapter" xmlns:epub="http://www.idpf.org/2007/ops">
    <h1>${esc(ch.title)}</h1>
${body}
  </section>
</body>
</html>`;
}

// Kapak sayfası: görseli sayfaya ortalı, taşmadan sığacak şekilde gösterir.
function coverXhtml(book: EpubBook, coverFile: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${esc(book.lang)}" lang="${esc(book.lang)}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(book.title)}</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    .cover { margin: 0; padding: 0; text-align: center; }
    .cover img { max-width: 100%; max-height: 100vh; }
  </style>
</head>
<body>
  <div class="cover">
    <img src="${coverFile}" alt="${esc(book.title)}"/>
  </div>
</body>
</html>`;
}

function titleXhtml(book: EpubBook): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${esc(book.lang)}" lang="${esc(book.lang)}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(book.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <div class="titlepage">
    <h1 class="booktitle">${esc(book.title)}</h1>
    ${book.author ? `<p class="bookauthor">${esc(book.author)}</p>` : ""}
  </div>
</body>
</html>`;
}

function navXhtml(book: EpubBook, files: string[]): string {
  const items = book.chapters
    .map((ch, i) => `      <li><a href="${files[i]}">${esc(ch.title)}</a></li>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(book.lang)}" lang="${esc(book.lang)}">
<head>
  <meta charset="utf-8"/>
  <title>${esc(book.tocTitle)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${esc(book.tocTitle)}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

function tocNcx(book: EpubBook, uuid: string, files: string[]): string {
  const points = book.chapters
    .map(
      (ch, i) =>
        `    <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${esc(ch.title)}</text></navLabel>
      <content src="${files[i]}"/>
    </navPoint>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${esc(book.title)}</text></docTitle>
  <navMap>
${points}
  </navMap>
</ncx>`;
}

function contentOpf(book: EpubBook, uuid: string, modified: string, files: string[]): string {
  const manifestItems = book.chapters
    .map(
      (_, i) =>
        `    <item id="chap${i + 1}" href="${files[i]}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const spineItems = book.chapters
    .map((_, i) => `    <itemref idref="chap${i + 1}"/>`)
    .join("\n");

  // Kapak varsa: görseli (properties="cover-image" — EPUB 3) ve onu gösteren
  // cover.xhtml sayfasını manifeste ekle; ayrıca eski okuyucular/Kindle için
  // <meta name="cover"> ve <guide> referansı yaz. Spine'da en başa koy.
  const cover = book.cover;
  const coverFile = cover ? coverFileName(cover.mime) : "";
  const coverMeta = cover ? `\n    <meta name="cover" content="cover-image"/>` : "";
  const coverManifest = cover
    ? `\n    <item id="cover-image" href="${coverFile}" media-type="${esc(cover.mime)}" properties="cover-image"/>` +
      `\n    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`
    : "";
  const coverSpine = cover ? `    <itemref idref="cover" linear="yes"/>\n` : "";
  const coverGuide = cover
    ? `\n  <guide>\n    <reference type="cover" title="Cover" href="cover.xhtml"/>\n  </guide>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${esc(book.lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${uuid}</dc:identifier>
    <dc:title>${esc(book.title)}</dc:title>
    <dc:creator>${esc(book.author || "")}</dc:creator>
    <dc:language>${esc(book.lang)}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>${coverManifest}
${manifestItems}
  </manifest>
  <spine toc="ncx">
${coverSpine}    <itemref idref="title"/>
${spineItems}
  </spine>${coverGuide}
</package>`;
}

const STYLE_CSS = `body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; margin: 5%; }
h1 { font-size: 1.5em; line-height: 1.2; margin: 1em 0 0.75em; }
p { margin: 0 0 0.2em; text-indent: 1.2em; text-align: justify; }
p:first-of-type, h1 + p { text-indent: 0; }
.titlepage { text-align: center; margin-top: 30%; }
.booktitle { font-size: 2em; }
.bookauthor { font-size: 1.1em; margin-top: 1em; text-indent: 0; }
`;

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

export async function buildEpubBlob(book: EpubBook): Promise<Blob> {
  const uuid = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = book.chapters.map((_, i) => `chap${i + 1}.xhtml`);

  const zip = new JSZip();
  // mimetype İLK ve sıkıştırmasız (STORE) olmalı — EPUB şartı.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", contentOpf(book, uuid, modified, files));
  zip.file("OEBPS/nav.xhtml", navXhtml(book, files));
  zip.file("OEBPS/toc.ncx", tocNcx(book, uuid, files));
  zip.file("OEBPS/style.css", STYLE_CSS);
  zip.file("OEBPS/title.xhtml", titleXhtml(book));
  if (book.cover) {
    const coverFile = coverFileName(book.cover.mime);
    zip.file(`OEBPS/${coverFile}`, book.cover.bytes);
    zip.file("OEBPS/cover.xhtml", coverXhtml(book, coverFile));
  }
  book.chapters.forEach((ch, i) => {
    zip.file(`OEBPS/${files[i]}`, chapterXhtml(ch, book.lang));
  });

  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
}
