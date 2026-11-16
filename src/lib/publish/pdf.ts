// Bölümlere ayrılmış kitap metninden okunabilir, "akan" bir e-kitap PDF'i üretir.
// Tamamen tarayıcıda çalışır (pdf-lib + fontkit). Türkçe karakterler için gövde
// fontu olarak Source Serif 4 gömülür (public/fonts altından çekilir; derleme
// zamanında Türkçe/Latin alt kümesine indirilmiştir → subset:false ile bütün
// hâliyle gömülür). Bu dosya bilerek proje içi bir şeye bağlı değildir (yalnız
// pdf-lib + fontkit + bağımsız dipnot işareti yardımcısı), böylece bağımsız da
// test edilebilir.
//
// Dipnotlar: notes doluysa paragraf içindeki noteMark(n) işareti küçük, yukarı
// kaydırılmış rakamla çizilir (font alt kümesinde ⁴⁵… üst simge glifleri yok →
// gövde fontunun normal rakamları küçültülür); notlar bölüm sonunda "Notlar"
// başlığı altında numaralı listelenir. Numara her bölümde 1'den başlar.

import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { NOTE_MARK_RE, hasNoteMark, stripNoteMarks } from "@/lib/layout/footnoteText";

export type PdfChapter = {
  title: string;
  paragraphs: string[];
  notes?: { runs: { text: string }[] }[]; // n. dipnot = notes[n-1]
  heading?: string; // işaretli başlık (başlıkta dipnot varsa); yoksa title
};

export type PdfBook = {
  title: string;
  author: string;
  chapters: PdfChapter[];
  notesTitle?: string; // bölüm sonu notlar başlığı ("Notlar" / "Notes")
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
const NOTE_PT = 9;
const NOTE_LEADING = NOTE_PT * 1.4;
const NOTES_TITLE_PT = 12;
const SUP_SCALE = 0.62; // başvuru rakamı boyu (metin puntosuna oranla)
const SUP_RISE = 0.38; // başvuru rakamının yukarı kayması (metin puntosuna oranla)

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

// Kelimeyi düz metin ve dipnot başvurusu parçalarına ayırır.
type Piece = { text: string; sup: boolean };
function pieces(word: string): Piece[] {
  const out: Piece[] = [];
  const re = new RegExp(NOTE_MARK_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(word))) {
    if (m.index > last) out.push({ text: word.slice(last, m.index), sup: false });
    out.push({ text: m[1], sup: true });
    last = re.lastIndex;
  }
  if (last < word.length) out.push({ text: word.slice(last), sup: false });
  return out;
}

// Kelime genişliği (dipnot başvurusu varsa küçük rakamlarla birlikte).
function wordWidth(w: string, font: PDFFont, size: number): number {
  if (!hasNoteMark(w)) return font.widthOfTextAtSize(w, size);
  return pieces(w).reduce(
    (s, p) => s + font.widthOfTextAtSize(p.text, p.sup ? size * SUP_SCALE : size),
    0,
  );
}

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
    const ww = wordWidth(w, font, size);
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
    const wordsW = words.reduce((s, w) => s + wordWidth(w, font, size), 0);
    const gaps = words.length - 1;
    const avail = CONTENT_WIDTH - leftOffset;
    const gap = justify && gaps > 0 ? (avail - wordsW) / gaps : space;
    const y = PAGE_H - (cursor + size);
    let x = CONTENT_LEFT + leftOffset;
    for (const w of words) {
      if (hasNoteMark(w)) {
        let px = x;
        for (const p of pieces(w)) {
          if (!p.text) continue;
          const ps = p.sup ? size * SUP_SCALE : size;
          page.drawText(p.text, { x: px, y: p.sup ? y + size * SUP_RISE : y, size: ps, font, color: BLACK });
          px += font.widthOfTextAtSize(p.text, ps);
        }
        x = px + gap;
        continue;
      }
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
    const noteCount = ch.notes?.length ?? 0;
    // Notu olmayan (geçersiz) işaretleri temizle; dipnotsuz bölümde metin aynen kalır.
    const prep = (s: string) =>
      noteCount
        ? s.replace(new RegExp(NOTE_MARK_RE.source, "g"), (m, d: string) =>
            Number(d) >= 1 && Number(d) <= noteCount ? m : "",
          )
        : stripNoteMarks(s);

    if (ch.title) {
      const headingLines = wrapParagraph(
        sanitize(prep(noteCount && ch.heading ? ch.heading : ch.title)),
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
      const lines = wrapParagraph(sanitize(prep(para)), fonts.body, BODY_PT, CONTENT_WIDTH, firstIndent);
      lines.forEach((line, li) => {
        const isLast = li === lines.length - 1;
        const leftOffset = li === 0 ? firstIndent : 0;
        drawLine(line, fonts.body, BODY_PT, LINE_LEADING, leftOffset, !isLast);
      });
      cursor += PARA_GAP;
    });

    // Bölüm sonu notları: "Notlar" + numaralı liste (küçük punto, sola yaslı).
    if (noteCount) {
      cursor += BODY_PT;
      // Başlık sayfanın dibinde yalnız kalmasın: başlık + ilk not satırı sığmalı.
      if (cursor + NOTES_TITLE_PT + NOTE_LEADING * 2 > CONTENT_BOTTOM) newPage();
      const notesTitle = sanitize(book.notesTitle || "Notlar");
      drawLine([notesTitle], fonts.bold, NOTES_TITLE_PT, NOTES_TITLE_PT * 1.5, 0, false);
      ch.notes!.forEach((note, i) => {
        const text = sanitize(stripNoteMarks(note.runs.map((r) => r.text).join("")))
          .replace(/\s+/g, " ")
          .trim();
        const lines = wrapParagraph(`${i + 1}. ${text}`, fonts.body, NOTE_PT, CONTENT_WIDTH, 0);
        lines.forEach((line, li) => {
          drawLine(line, fonts.body, NOTE_PT, NOTE_LEADING, 0, li !== lines.length - 1);
        });
        cursor += NOTE_PT * 0.3;
      });
    }
  }

  // Daha geniş okuyucu uyumu için nesne akışlarını kapat.
  const bytes = await doc.save({ useObjectStreams: false });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
