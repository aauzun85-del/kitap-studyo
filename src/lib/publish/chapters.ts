// E-kitap / sesli kitap için metni bölümlere ayırır. Mizanpajın blok
// ayrıştırıcısını (parseBlocks) yeniden kullanır: 1. düzey başlıklar yeni bölüm
// başlatır, başlıktan önceki metin "başlıksız giriş" bölümü olur. Çıktı hem
// içindekiler önizlemesi hem de ileride EPUB/PDF/sesli kitap üretimi için ortak
// kaynaktır.

import { parseBlocks, type Run } from "@/lib/layout/paginate";
import { withoutFootnotes } from "@/lib/layout/footnotes";
import { noteMark } from "@/lib/layout/footnoteText";

/** Bölüm sonu dipnotu (numarası = notes dizisindeki sırası + 1; her bölümde 1'den başlar). */
export type PublishNote = { runs: Run[] };

export type PublishChapter = {
  title: string; // boş = başlıksız giriş bloğu
  paragraphs: string[]; // düz metin paragrafları (biçim işaretleri ayıklanmış; dipnotsuz)
  words: number;
  // Yalnız bölümde dipnot varsa dolu (dipnotsuz metinde alanlar hiç yoktur):
  notes?: PublishNote[];
  // paragraphs ile AYNI sırada/uzunlukta; dipnot başvurusunun yerinde noteMark(n)
  // işareti taşır (EPUB/PDF üreticileri için — sesli okuma paragraphs'ı kullanır).
  noteParagraphs?: string[];
  // Başlığın kendisinde dipnot başvurusu varsa işaretli başlık (EPUB/PDF h1 için).
  noteTitle?: string;
};

function runsToText(runs: { text: string }[]): string {
  return runs
    .map((r) => r.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// Dipnot başvurularını noteMark işaretiyle yazar; notları bölüme ekler.
function runsToMarked(runs: Run[], notes: PublishNote[]): string {
  return runs
    .map((r) => {
      if (!r.fn) return r.text;
      notes.push({ runs: withoutFootnotes(r.fn.runs) });
      return noteMark(notes.length);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const hasFn = (runs: Run[]) => runs.some((r) => r.fn);

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// "Bölüm", "Önsöz", "Giriş", "Sonuç" gibi adlandırılmış bölüm başlıkları (TR + EN).
const NAMED_RE =
  /^(bölüm|bolum|kısım|kisim|chapter|part|ünite|unite|konu|önsöz|ön söz|onsoz|giriş|giris|sunuş|sunum|prolog|introduction|preface|foreword|prologue|sonuç|sonuc|sonsöz|son söz|sonsoz|epilog|kapanış|kapanis|conclusion|epilogue|afterword)(?!\p{L})/iu;
// "Birinci Bölüm", "İkinci Kısım" gibi sıra sayılı başlıklar.
const ORDINAL_RE =
  /^(birinci|ikinci|üçüncü|ucuncu|dördüncü|dorduncu|beşinci|besinci|altıncı|altinci|yedinci|sekizinci|dokuzuncu|onuncu)\s+(bölüm|bolum|kısım|kisim)(?!\p{L})/iu;

// Türkçe büyük "İ" harfi, küçük "i" tabanlı kalıplarla Unicode küçültmede
// eşleşmez (İ → "i̇"). Bu yüzden hem ham metni hem de Türkçe yerele göre
// küçültülmüş metni dener.
function matchesHeading(re: RegExp, s: string): boolean {
  return re.test(s) || re.test(s.toLocaleLowerCase("tr"));
}

// parseBlocks başlık saymadığı ama kullanıcının bölüm başlığı olarak yazdığı
// kısa satırları yakalar (örn. "Birinci Bölüm", "İkinci Bölüm", "1. Başlangıç").
function looksLikeChapterTitle(text: string): boolean {
  const s = text.trim();
  if (!s || s.length > 60) return false;
  const words = s.split(/\s+/).length;
  if (matchesHeading(NAMED_RE, s)) return true;
  if (matchesHeading(ORDINAL_RE, s)) return true;
  if (/^\d+[.)]\s+\S/.test(s) && words <= 8) return true; // "1. Başlangıç"
  return false;
}

export function splitChapters(raw: string): PublishChapter[] {
  const blocks = parseBlocks(raw, true);
  const chapters: PublishChapter[] = [];
  let current: PublishChapter | null = null;
  // Bölüm başına işaretli paragraflar (yalnız dipnotlu bölümlere eklenir).
  const marked = new Map<PublishChapter, string[]>();
  const notesOf = new Map<PublishChapter, PublishNote[]>();

  const open = (title: string, runs?: Run[]) => {
    // Başlıktaki dipnot run'larının metni boştur → başlık zaten dipnotsuz.
    const ch: PublishChapter = { title, paragraphs: [], words: 0 };
    current = ch;
    chapters.push(ch);
    marked.set(ch, []);
    notesOf.set(ch, []);
    if (runs && hasFn(runs)) ch.noteTitle = runsToMarked(runs, notesOf.get(ch)!);
  };

  for (const block of blocks) {
    if (block.type === "blank") continue;

    // Yalnız ana başlıklar (1. düzey) yeni bölüm açar; alt başlıklar gövdeye
    // metin olarak girer ki içindekiler sade kalsın.
    if (block.type === "heading" && block.level === 1) {
      open(runsToText(block.runs), block.runs);
      continue;
    }

    if (!("runs" in block)) continue;
    const text = runsToText(block.runs);
    if (!text) continue;

    // parseBlocks'un başlık saymadığı ama kullanıcının bölüm başlığı olarak
    // yazdığı kısa satırlar (sıra sayılı / numaralı) da yeni bölüm açar.
    if (looksLikeChapterTitle(text)) {
      open(text, block.runs);
      continue;
    }

    if (!current) open(""); // başlıksız giriş
    const ch: PublishChapter = current!;
    ch.paragraphs.push(text);
    ch.words += countWords(text);
    marked.get(ch)!.push(hasFn(block.runs) ? runsToMarked(block.runs, notesOf.get(ch)!) : text);
  }

  // Dipnotlu bölümlere notları ve işaretli paragrafları ekle.
  for (const ch of chapters) {
    const notes = notesOf.get(ch)!;
    if (!notes.length) continue;
    ch.notes = notes;
    ch.noteParagraphs = marked.get(ch)!;
  }

  return chapters.filter((c) => c.title || c.paragraphs.length > 0);
}
