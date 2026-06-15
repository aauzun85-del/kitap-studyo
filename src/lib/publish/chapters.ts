// E-kitap / sesli kitap için metni bölümlere ayırır. Mizanpajın blok
// ayrıştırıcısını (parseBlocks) yeniden kullanır: 1. düzey başlıklar yeni bölüm
// başlatır, başlıktan önceki metin "başlıksız giriş" bölümü olur. Çıktı hem
// içindekiler önizlemesi hem de ileride EPUB/PDF/sesli kitap üretimi için ortak
// kaynaktır.

import { parseBlocks } from "@/lib/layout/paginate";

export type PublishChapter = {
  title: string; // boş = başlıksız giriş bloğu
  paragraphs: string[]; // düz metin paragrafları (biçim işaretleri ayıklanmış)
  words: number;
};

function runsToText(runs: { text: string }[]): string {
  return runs
    .map((r) => r.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

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

  const open = (title: string) => {
    current = { title, paragraphs: [], words: 0 };
    chapters.push(current);
  };

  for (const block of blocks) {
    if (block.type === "blank") continue;

    // Yalnız ana başlıklar (1. düzey) yeni bölüm açar; alt başlıklar gövdeye
    // metin olarak girer ki içindekiler sade kalsın.
    if (block.type === "heading" && block.level === 1) {
      open(runsToText(block.runs));
      continue;
    }

    if (!("runs" in block)) continue;
    const text = runsToText(block.runs);
    if (!text) continue;

    // parseBlocks'un başlık saymadığı ama kullanıcının bölüm başlığı olarak
    // yazdığı kısa satırlar (sıra sayılı / numaralı) da yeni bölüm açar.
    if (looksLikeChapterTitle(text)) {
      open(text);
      continue;
    }

    if (!current) open(""); // başlıksız giriş
    current!.paragraphs.push(text);
    current!.words += countWords(text);
  }

  return chapters.filter((c) => c.title || c.paragraphs.length > 0);
}
