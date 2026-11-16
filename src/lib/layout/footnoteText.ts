// Dipnotlu ham metin için küçük yardımcılar (footnotes.ts'teki sözleşmenin
// "düz metin" tarafı):
//   - stripFootnotesFromRaw: yapay zekâ istemleri, özetler ve sesli okuma için
//     "[^id]: …" tanım satırlarını ve "[^id]" başvurularını ham metinden siler.
//   - noteMark / NOTE_MARK_RE: e-kitap (EPUB/PDF) çıktısında paragraf içindeki
//     dipnot başvurusunun yerini taşıyan görünmez işaret (Private Use karakterleri
//     arasında bölüm içi dipnot numarası). Düz metin hiçbir zaman bu işareti
//     taşımaz; yalnız chapters.ts → epub.ts/pdf.ts arasında kullanılır.

import { extractFootnotes, FN_PH_RE } from "./footnotes";

/**
 * Ham metinden dipnotları ayıklar: tanım satırları ("[^1]: Not.") tümüyle,
 * başvurular ("kelime[^1]") iz bırakmadan silinir. Dipnot yoksa metin AYNEN döner.
 */
export function stripFootnotesFromRaw(raw: string): string {
  if (!raw || !raw.includes("[^")) return raw;
  // Kitaptaki çözümle AYNI: yalnız gerçekten bağlanan dipnotlar silinir; tanımı
  // olmayan "[^x]" ya da kullanılmayan tanım baskıdaki gibi metinde kalır.
  const fx = extractFootnotes(raw);
  if (!fx.notes.length) return raw;
  return fx.text.replace(FN_PH_RE, "").replace(/\n{3,}/g, "\n\n");
}

const MARK_OPEN = "";
const MARK_CLOSE = "";

/** Bölüm içi n. dipnotun başvuru işareti (görünmez, yalnız EPUB/PDF üreticileri için). */
export function noteMark(n: number): string {
  return MARK_OPEN + String(n) + MARK_CLOSE;
}

/** noteMark işaretlerini yakalar; 1. grup = dipnot numarası. */
export const NOTE_MARK_RE = /(\d+)/g;

/** Metin bir noteMark işareti içeriyor mu? */
export function hasNoteMark(s: string): boolean {
  return s.includes(MARK_OPEN);
}

/** noteMark işaretlerini siler (başlık/nav gibi düz metin gereken yerler için). */
export function stripNoteMarks(s: string): string {
  return hasNoteMark(s) ? s.replace(NOTE_MARK_RE, "") : s;
}
