// AI Editör — dipnot yardımcıları (saf işlevler; editör ve inceleme kullanır).
// Metin biçimi footnotes.ts ile aynı: gövdede "kelime[^1]", tanım kendi
// satırında "[^1]: Not metni." (paragraftan sonra, boş satırla ayrılmış).

import { FN_DEF_RE, FN_REF_RE } from "@/lib/layout/footnotes";

/** Satır bir dipnot tanımı mı ("[^1]: …")? */
export function isFnDefLine(line: string): boolean {
  return FN_DEF_RE.test(line.trim());
}

/** Metindeki [^id] başvurularının yerleri (yarı açık aralıklar). */
export function refRanges(text: string): { start: number; end: number; id: string }[] {
  if (!text.includes("[^")) return [];
  const out: { start: number; end: number; id: string }[] = [];
  const re = new RegExp(FN_REF_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, id: m[1] });
  return out;
}

/** Başvuruları siler (ölçüm/karşılaştırma için). */
export function stripRefs(s: string): string {
  return s.includes("[^") ? s.replace(new RegExp(FN_REF_RE.source, "g"), "") : s;
}

/** Tanım satırlarını çıkarır (satır yapısı: kalan satırlar aynen). */
export function withoutDefLines(text: string): string {
  if (!text.includes("[^")) return text;
  return text
    .split("\n")
    .filter((l) => !isFnDefLine(l))
    .join("\n");
}

/** Sıradaki dipnot numarası: metindeki en büyük SAYISAL kimlik + 1. */
export function nextFootnoteId(text: string): number {
  let max = 0;
  if (text.includes("[^")) {
    const re = /\[\^(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = Number(m[1]);
      if (Number.isSafeInteger(n) && n > max) max = n;
    }
  }
  return max + 1;
}

const isWordCh = (ch: string | undefined) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch);

/** `off` bir başvurunun İÇİNDEyse (kenarlar hariç) o başvuru. */
function refAround(text: string, off: number, inclusive = false) {
  return refRanges(text).find((r) => (inclusive ? off >= r.start && off <= r.end : off > r.start && off < r.end));
}

/**
 * Kalın/italik için seçim kenarlarını başvurulardan dışarı iter. İmleç bir
 * başvurunun üstündeyse (ya da hemen bitişiğindeyse) başvurunun önüne alınır
 * → kelime genişletmesi önceki kelimeyi bulur.
 */
export function snapOutOfRefs(text: string, a: number, z: number): { a: number; z: number } {
  if (!text.includes("[^")) return { a, z };
  if (a === z) {
    const r = refAround(text, a, true);
    return r ? { a: r.start, z: r.start } : { a, z };
  }
  const ra = refAround(text, a);
  const rz = refAround(text, z);
  return { a: ra ? ra.start : a, z: rz ? rz.end : z };
}

export type FootnotePlan = {
  id: number;
  /** Başvurunun satır içinde ekleneceği yer. */
  refAt: number;
  /** Tanım bu satırdan SONRA eklenir: ["", "[^n]: "] (+ gerekirse ""). */
  afterLine: number;
  trailingBlank: boolean;
};

/**
 * Dipnot ekleme planı. lines = belgenin satırları; line = imlecin satırı;
 * from/to = seçimin o satırdaki ofsetleri (imleçte from === to).
 */
export function planFootnote(lines: string[], line: number, from: number, to: number): FootnotePlan {
  const text = lines[line] ?? "";
  // Başlık ("# ") / alıntı ("> ") işaretinin önüne asla: imleç işaretin
  // içinde ya da önündeyse işaretin arkasına alınır.
  const marker = /^\s*(?:#{1,6}\s+|>\s*)/.exec(text)?.[0].length ?? 0;
  if (from < marker) from = marker;
  if (to < marker) to = marker;
  let at = Math.max(0, Math.min(text.length, to));
  if (to > from) {
    // Seçimin sonu: sondaki boşluklar başvurunun DIŞINDA kalsın.
    while (at > from && /\s/.test(text[at - 1])) at--;
    const r = refAround(text, at);
    if (r) at = r.end;
  } else {
    const r = refAround(text, at, true);
    if (r) at = r.end;
    else while (at < text.length && isWordCh(text[at])) at++; // kelimenin sonu
  }
  // Hemen ardından başka başvuru(lar) varsa onların arkasına.
  for (;;) {
    const r = refRanges(text).find((x) => x.start === at);
    if (!r) break;
    at = r.end;
  }
  // Paragrafın son satırı (boş satıra kadar) + ardındaki mevcut tanım blokları.
  const paraEnd = (k: number) => {
    let j = k;
    while (j + 1 < lines.length && lines[j + 1] !== "") j++;
    return j;
  };
  let end = paraEnd(line);
  for (;;) {
    let k = end + 1;
    while (k < lines.length && lines[k] === "") k++;
    if (k < lines.length && isFnDefLine(lines[k])) end = paraEnd(k);
    else break;
  }
  return {
    id: nextFootnoteId(lines.join("\n")),
    refAt: at,
    afterLine: end,
    trailingBlank: end + 1 < lines.length && lines[end + 1] !== "",
  };
}

/**
 * AI önerisi kabul edilirken: özgün pasajdaki [^id] başvurularından değişiklikte
 * EKSİK olanları geri koyar. Yer, işaretsiz metinlerin farkından bulunur:
 * değişmeyen baş/son kısımdaysa aynı yere; değişen kısımdaysa önündeki
 * kelimenin değişiklikteki aynısının arkasına, o da yoksa değişen kısmın
 * sonuna. İşaret asla bir kelimenin ortasına girmez.
 */
export function preserveFootnoteRefs(original: string, replacement: string): string {
  const oRefs = refRanges(original);
  // 1) Değişiklikte özgünde OLMAYAN (ya da özgündekinden fazla) işaretler
  //    atılır: öneri [^1]'i [^2] yaptıysa sonunda iki işaret kalmasın.
  const allow = new Map<string, number>();
  for (const r of oRefs) allow.set(r.id, (allow.get(r.id) ?? 0) + 1);
  if (replacement.includes("[^")) {
    let cleaned = "";
    let last = 0;
    for (const r of refRanges(replacement)) {
      const n = allow.get(r.id) ?? 0;
      if (n > 0) {
        allow.set(r.id, n - 1);
        continue;
      }
      cleaned += replacement.slice(last, r.start);
      last = r.end;
    }
    replacement = cleaned + replacement.slice(last);
  }
  if (!oRefs.length) return replacement;
  // 2) Değişiklikte zaten bulunan işaretler (adet adet) eksik sayılmaz.
  const have = new Map<string, number>();
  const rRefs = refRanges(replacement);
  for (const r of rRefs) have.set(r.id, (have.get(r.id) ?? 0) + 1);
  const toPlace: { id: string; p: number }[] = [];
  let removed = 0;
  for (const r of oRefs) {
    const p = r.start - removed; // işaretsiz özgündeki konum
    removed += r.end - r.start;
    const n = have.get(r.id) ?? 0;
    if (n > 0) have.set(r.id, n - 1);
    else toPlace.push({ id: r.id, p });
  }
  if (!toPlace.length) return replacement;

  const O = stripRefs(original);
  const R = stripRefs(replacement);
  let pre = 0;
  while (pre < O.length && pre < R.length && O[pre] === R[pre]) pre++;
  // Ortak baş kısım bir kelimenin ortasında bitmesin (kelime başına çekilir).
  while (pre > 0 && isWordCh(O[pre - 1]) && (isWordCh(O[pre]) || isWordCh(R[pre]))) pre--;
  let suf = 0;
  while (suf < O.length - pre && suf < R.length - pre && O[O.length - 1 - suf] === R[R.length - 1 - suf]) suf++;
  // Ortak son kısım da kelime ortasında başlamasın.
  while (suf > 0 && isWordCh(O[O.length - suf]) && (isWordCh(O[O.length - suf - 1]) || isWordCh(R[R.length - suf - 1])))
    suf--;
  const rEnd = R.length - suf; // R'de değişen kısmın sonu
  const notInWord = (q: number) => {
    while (q < R.length && isWordCh(R[q - 1]) && isWordCh(R[q])) q++;
    return q;
  };
  const target = (p: number): number => {
    if (p <= pre) return notInWord(p);
    if (p >= O.length - suf) return notInWord(R.length - (O.length - p));
    // Değişen kısım: önündeki kelimeyi değişiklikte ara.
    const w = /([\p{L}\p{N}'’-]+)[^\p{L}\p{N}\s]*$/u.exec(O.slice(0, p));
    if (w) {
      for (const needle of [w[0], w[1]]) {
        let k = R.indexOf(needle, Math.max(0, pre - needle.length));
        while (k !== -1 && k <= rEnd) {
          const end = k + needle.length;
          if (!isWordCh(R[k - 1]) && !isWordCh(R[end])) return end;
          k = R.indexOf(needle, k + 1);
        }
      }
    }
    let q = rEnd;
    // Özgünde işaret noktalamadan önceyse, değişen kısmın sonundaki noktalamadan da önce dursun.
    if (!/[.,;:!?…]$/.test(O.slice(0, p))) while (q > pre && /[.,;:!?…"'”’»)]/.test(R[q - 1])) q--;
    // İşaretin taşıdığı kelime silindiyse boşluğun arkasına düşmesin
    // ("çok [^1]bir") → önceki kelimenin sonuna yapışsın ("çok[^1] bir").
    // Satır başına/pasaj başına kadar geri gidilemiyorsa yer değişmez.
    let b = q;
    while (b > 0 && /[ \t\u00a0]/.test(R[b - 1])) b--;
    if (b < q && b > 0 && R[b - 1] !== "\n") q = b;
    return notInWord(q);
  };

  // Değişiklikteki mevcut işaretler + geri konanlar, işaretsiz metne konumlarıyla.
  const marks: { q: number; tok: string; order: number }[] = [];
  removed = 0;
  rRefs.forEach((r, k) => {
    marks.push({ q: r.start - removed, tok: replacement.slice(r.start, r.end), order: k });
    removed += r.end - r.start;
  });
  toPlace.forEach((x, k) => marks.push({ q: target(x.p), tok: `[^${x.id}]`, order: rRefs.length + k }));
  marks.sort((a, b) => a.q - b.q || a.order - b.order);
  let out = "";
  let last = 0;
  for (const m of marks) {
    out += R.slice(last, m.q) + m.tok;
    last = m.q;
  }
  return out + R.slice(last);
}
