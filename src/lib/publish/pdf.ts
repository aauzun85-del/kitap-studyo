// Bölümlere ayrılmış kitap metninden okunabilir, "akan" bir e-kitap PDF'i üretir.
// Tamamen tarayıcıda çalışır (pdf-lib + fontkit). Türkçe karakterler için gövde
// fontu olarak Source Serif 4 gömülür (public/fonts altından çekilir; derleme
// zamanında Türkçe/Latin alt kümesine indirilmiştir → subset:false ile bütün
// hâliyle gömülür). Bu dosya bilerek proje içi bir şeye bağlı değildir (yalnız
// pdf-lib + fontkit), böylece bağımsız da test edilebilir.

import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type PdfChapter = { title: string; paragraphs: string[] };

export type PdfBook = {
  title: string;
  author: string;
  chapters: PdfChapter[];
};

const PT_PER_MM = 72 / 25.4;
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.45, 0.45, 0.45);

// A5 benzeri, ekranda rahat okunan sayfa + cömert kenar boşlukları.
const PAGE_W = 148 * PT_PER_MM;
const PAGE_H = 210 * PT_PER_MM;
const MARGIN_X = 18 * PT_PER_MM;
const MARGIN_TOP = 20 * PT_PER_MM;
const MARGIN_BOTTOM = 20 * PT_PER_MM;

const BODY_PT = 11;
const LINE_LEADING = BODY_PT * 1.5;
const PARA_INDENT = BODY_PT * 1.2; // ilk satır girintisi (1.2em)
const PARA_GAP = BODY_PT * 0.25;
const HEADING_PT = 18;
const HEADING_LEADING = HEADING_PT * 1.25;

const CONTENT_LEFT = MARGIN_X;
const CONTENT_WIDTH = PAGE_W - 2 * MARGIN_X;
const CONTENT_TOP = MARGIN_TOP;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;

// Gömülü font alt kümesinde bulunmayan tipografik işaretleri güvenli
// karşılıklarına indirger (kırık glif / atılan karakter olmasın).
function sanitize(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/…/g, "...")
    .replace(/[‒–—―]/g, "-");
}

async function loadFont(doc: PDFDocument, file: string): Promise<PDFFont> {
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error(`Font yüklenemedi: ${file}`);
  const buf = await res.arrayBuffer();
  return doc.embedFont(buf, { subset: false });
}

type Fonts = { body: PDFFont; bold: PDFFont };

// Bir paragrafı, font genişliklerini ölçerek satırlara böler. İlk satıra
// (firstIndent) girinti uygulanır. Her satır kelime dizisi olarak döner.
function wrapParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  firstIndent: number,
): string[][] {
  const words = text.split(/\s+/).filter(Boolean);
  const space = font.widthOfTextAtSize(" ", size);
  const lines: string[][] = [];
  let cur: string[] = [];
  let curW = 0;
  let lineMax = maxWidth - firstIndent; // ilk satır girinti kadar dar

  for (const w of words) {
    const ww = font.widthOfTextAtSize(w, size);
    const add = (cur.length ? space : 0) + ww;
    if (cur.length && curW + add > lineMax) {
      lines.push(cur);
      cur = [w];
      curW = ww;
      lineMax = maxWidth; // sonraki satırlar girintisiz, tam genişlik
    } else {
      cur.push(w);
      curW += add;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// pdf-lib sayfası için yalın tip (addPage dönüşü).
type Page = ReturnType<PDFDocument["addPage"]>;

export async function buildPdfBlob(book: PdfBook): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(book.title);
  if (book.author) doc.setAuthor(book.author);

  const fonts: Fonts = {
    body: await loadFont(doc, "SourceSerif4-Regular.ttf"),
    bold: await loadFont(doc, "SourceSerif4-Bold.ttf"),
  };

  // Akış durumu: geçerli sayfa, üstten imleç (pt) ve numaralandırma.
  let page: Page = doc.addPage([PAGE_W, PAGE_H]);
  let cursor = CONTENT_TOP; // üstten uzaklık (pt)
  let pageNo = 0; // gövde sayfaları için (kapak sayfası numarasız)
  let numbering = false;

  const drawPageNumber = () => {
    if (!numbering) return;
    const label = String(pageNo);
    const w = fonts.body.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: CONTENT_LEFT + (CONTENT_WIDTH - w) / 2,
      y: MARGIN_BOTTOM / 2,
      size: 9,
      font: fonts.body,
      color: MUTED,
    });
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    cursor = CONTENT_TOP;
    if (numbering) pageNo++;
    drawPageNumber();
  };

  // Tek bir satırı çizer (gerekirse yeni sayfaya geçer). justify=true ise son
  // satır hariç fazla boşluk kelime aralarına dağıtılır.
  const drawLine = (
    words: string[],
    font: PDFFont,
    size: number,
    leading: number,
    leftOffset: number,
    justify: boolean,
  ) => {
    if (cursor + size > CONTENT_BOTTOM) newPage();
    const space = font.widthOfTextAtSize(" ", size);
    const wordsW = words.reduce((s, w) => s + font.widthOfTextAtSize(w, size), 0);
    const gaps = words.length - 1;
    const avail = CONTENT_WIDTH - leftOffset;
    const gap = justify && gaps > 0 ? (avail - wordsW) / gaps : space;
    const y = PAGE_H - (cursor + size);
    let x = CONTENT_LEFT + leftOffset;
    for (const w of words) {
      page.drawText(w, { x, y, size, font, color: BLACK });
      x += font.widthOfTextAtSize(w, size) + gap;
    }
    cursor += leading;
  };

  // Kapak sayfası: ortalı başlık + yazar.
  {
    const title = sanitize(book.title);
    const titleSize = 26;
    const titleLines = wrapParagraph(title, fonts.bold, titleSize, CONTENT_WIDTH, 0);
    cursor = PAGE_H * 0.32;
    for (const line of titleLines) {
      const text = line.join(" ");
      const w = fonts.bold.widthOfTextAtSize(text, titleSize);
      page.drawText(text, {
        x: CONTENT_LEFT + (CONTENT_WIDTH - w) / 2,
        y: PAGE_H - (cursor + titleSize),
        size: titleSize,
        font: fonts.bold,
        color: BLACK,
      });
      cursor += titleSize * 1.25;
    }
    if (book.author) {
      const author = sanitize(book.author);
      cursor += titleSize;
      const aSize = 13;
      const w = fonts.body.widthOfTextAtSize(author, aSize);
      page.drawText(author, {
        x: CONTENT_LEFT + (CONTENT_WIDTH - w) / 2,
        y: PAGE_H - (cursor + aSize),
        size: aSize,
        font: fonts.body,
        color: MUTED,
      });
    }
  }

  // Bölümler: her biri yeni sayfada başlar, numaralandırma buradan açılır.
  numbering = true;
  for (const ch of book.chapters) {
    newPage();

    if (ch.title) {
      const headingLines = wrapParagraph(
        sanitize(ch.title),
        fonts.bold,
        HEADING_PT,
        CONTENT_WIDTH,
        0,
      );
      for (const line of headingLines) {
        drawLine(line, fonts.bold, HEADING_PT, HEADING_LEADING, 0, false);
      }
      cursor += HEADING_PT * 0.5;
    }

    ch.paragraphs.forEach((para, pi) => {
      // Başlıktan hemen sonraki ilk paragraf girintisiz (kitap geleneği).
      const firstIndent = pi === 0 ? 0 : PARA_INDENT;
      const lines = wrapParagraph(sanitize(para), fonts.body, BODY_PT, CONTENT_WIDTH, firstIndent);
      lines.forEach((line, li) => {
        const isLast = li === lines.length - 1;
        const leftOffset = li === 0 ? firstIndent : 0;
        drawLine(line, fonts.body, BODY_PT, LINE_LEADING, leftOffset, !isLast);
      });
      cursor += PARA_GAP;
    });
  }

  // Daha geniş okuyucu uyumu için nesne akışlarını kapat.
  const bytes = await doc.save({ useObjectStreams: false });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
