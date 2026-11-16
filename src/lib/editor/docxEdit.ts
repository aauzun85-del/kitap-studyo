// Yüklenen orijinal .docx dosyasının BİÇİMİNİ koruyarak, editörde kabul edilen
// metin düzeltmelerini içine işler. Yalnız metin düğümlerini (<w:t>) değiştirir;
// başlık stilleri, hizalama, kalın/italik, punto, paragraf yapısı vb. dokunulmaz.
// Böylece çıkan docx mizanpaj için hâlâ geçerli kalır.
//
// .docx bir zip'tir; gövde metni word/document.xml içinde <w:p> (paragraf) →
// <w:r> (run) → <w:t> (metin) hiyerarşisindedir. Aynı paragrafın metni birden
// çok run'a bölünmüş olabilir; bu yüzden değiştirmeyi run-duyarlı yaparız.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { FN_DEF_RE, FN_REF_RE } from "@/lib/layout/footnotes";

export type DocxEdit = {
  original: string;
  suggestion: string;
  /** Düzeltme bir dipnot METNİNDE (editördeki "[^n]: …" tanım satırında).
   *  Not metni word/footnotes.xml'dedir; gövdeye (document.xml) asla
   *  uygulanmaz → uygulanmadı sayılır. */
  inNote?: boolean;
};

export type DocxEditResult = {
  blob: Blob;
  applied: number; // kaç düzeltme belgeye işlendi
  total: number; // kaç düzeltme denendi
};

const DOC_PATH = "word/document.xml";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// "original" metnini, aradaki boşluk farklarına toleranslı bir aramaya çevirir.
function buildSearch(original: string): RegExp | null {
  const trimmed = unescapeLiteralRefs(original).trim();
  if (!trimmed) return null;
  const esc = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  try {
    return new RegExp(esc, "g");
  } catch {
    return null;
  }
}

// ── Dipnot başvurulu düzeltmeler ───────────────────────────────────────────
// Editör metninde dipnot başvurusu "[^n]" metnidir; Word'de ise metni olmayan
// bir <w:footnoteReference> run'ıdır. Bu yüzden düzeltme, başvurulardan bölünen
// parçalar hâlinde aranır ve her parça ayrı yerleştirilir → Word'deki dipnot
// işareti yerinde kalır. Eşleşmenin parça sınırları paragraftaki GERÇEK başvuru
// konumlarına denk gelmelidir (aynı metin başvurusuz başka bir yerde de olabilir).
// Başvurusuz düzeltme ise bir başvurunun üstünden geçen eşleşmeye uygulanmaz
// (yoksa başvuru yerinden kayardı). Başvuru sayısı iki tarafta farklıysa ya da
// düzeltme bir dipnot TANIM satırına / not metnine aitse (not metni
// footnotes.xml'dedir) düzeltme uygulanmaz (uygulanmadı sayılır).

// docx.ts, gerçek dipnotlu dosyada yazılı "[^" metnini "[" + U+2060 + "^" diye
// kaçırır (içe aktarılan dipnot kimlikleriyle çakışmasın). document.xml'de bu
// metin kaçışsızdır → arama ve yazılacak metin için geri çözülür.
const LITERAL_FN_ESC_RE = /\[⁠\^/g;
function unescapeLiteralRefs(s: string): string {
  return s.replace(LITERAL_FN_ESC_RE, "[^");
}

type Segmented = { re: RegExp; parts: string[] };

function splitRefs(s: string): string[] {
  return s.split(new RegExp(FN_REF_RE.source, "g")).filter((_, i) => i % 2 === 0);
}

function buildSegmented(original: string, suggestion: string): Segmented | null {
  if (FN_DEF_RE.test(original.trim()) || FN_DEF_RE.test(suggestion.trim())) return null;
  const oParts = splitRefs(original.trim()).map(unescapeLiteralRefs);
  const sParts = splitRefs(suggestion).map(unescapeLiteralRefs);
  if (oParts.length !== sParts.length) return null;
  if (!oParts.join("").trim()) return null;
  const src = oParts
    .map((p) => "(" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + ")")
    .join("");
  try {
    return { re: new RegExp(src, "g"), parts: sParts };
  } catch {
    return null;
  }
}

function hasRef(s: string): boolean {
  return new RegExp(FN_REF_RE.source).test(s);
}

type TRange = { node: Element; start: number; end: number; text: string };

// Bir <w:t> düğümünün metnini ayarlar; baş/son boşluk varsa xml:space=preserve.
function setRunText(node: Element, text: string): void {
  node.textContent = text;
  if (text !== text.trim()) {
    node.setAttribute("xml:space", "preserve");
  }
}

// Bir paragrafın run'larını [start,end) aralığında verilen metinle değiştirir.
// Yeni metin, aralığın başladığı run'a yerleştirilir; aradaki run'lar boşaltılır.
function spliceParagraph(
  ranges: TRange[],
  start: number,
  end: number,
  replacement: string,
): void {
  for (const r of ranges) {
    if (r.end <= start || r.start >= end) continue; // bu run aralık dışında
    const localStart = Math.max(start, r.start) - r.start;
    const localEnd = Math.min(end, r.end) - r.start;
    const containsStart = r.start <= start && start < r.end;
    const insert = containsStart ? replacement : "";
    const newText =
      r.text.slice(0, localStart) + insert + r.text.slice(localEnd);
    setRunText(r.node, newText);
  }
}

// İzlenen değişiklikte silinmiş / taşınmış (eski yer) öğe mi?
function inDeletion(el: Element, stop: Element): boolean {
  for (let e = el.parentElement; e && e !== stop; e = e.parentElement) {
    if (e.tagName === "w:del" || e.tagName === "w:moveFrom") return true;
  }
  return false;
}

// Paragrafın güncel run aralıklarını + dipnot başvurularının metin içindeki
// konumlarını (belge sırasıyla) hesaplar (her değişiklikten sonra yeniden).
function collectRanges(p: Element): { full: string; ranges: TRange[]; refs: number[] } {
  let full = "";
  const ranges: TRange[] = [];
  const refs: number[] = [];
  for (const node of Array.from(p.getElementsByTagName("*"))) {
    if (node.tagName === "w:t") {
      const text = node.textContent ?? "";
      ranges.push({ node, start: full.length, end: full.length + text.length, text });
      full += text;
    } else if (node.tagName === "w:footnoteReference" || node.tagName === "w:endnoteReference") {
      if (!inDeletion(node, p)) refs.push(full.length);
    }
  }
  return { full, ranges, refs };
}

// Segmentli eşleşmenin parça aralıkları (gruplar ardışık, eşleşmeyi kaplar).
function spansOf(m: RegExpExecArray, parts: string[]): [number, number, string][] {
  const spans: [number, number, string][] = [];
  let at = m.index;
  parts.forEach((rep, k) => {
    const len = (m[k + 1] ?? "").length;
    spans.push([at, at + len, rep]);
    at += len;
  });
  return spans;
}

// Orijinal docx'i alır, düzeltmeleri biçimi bozmadan işler, yeni docx (Blob) verir.
export function applyEditsToDocx(
  buffer: ArrayBuffer,
  edits: DocxEdit[],
): DocxEditResult {
  const files = unzipSync(new Uint8Array(buffer));
  const docFile = files[DOC_PATH];
  if (!docFile) {
    // document.xml yoksa hiçbir şey yapamayız; orijinali olduğu gibi paketle.
    const blob = new Blob([zipSync(files) as BlobPart], { type: DOCX_MIME });
    return { blob, applied: 0, total: edits.length };
  }

  const xml = strFromU8(docFile);
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  // Her düzeltme yalnız bir kez uygulanır (belge sırasında ilk geçerli eşleşme).
  // Not metnindeki düzeltmeler gövdeye uygulanmaz (uygulanmadı sayılır).
  const pending = edits
    .filter((e) => !e.inNote)
    .map((e) => {
      const withRefs = hasRef(e.original) || hasRef(e.suggestion);
      const seg = withRefs ? buildSegmented(e.original, e.suggestion) : null;
      const re = withRefs ? (seg ? seg.re : null) : buildSearch(e.original);
      return { suggestion: unescapeLiteralRefs(e.suggestion), re, seg, done: false };
    })
    .filter((e) => e.re);
  let applied = 0;

  const paragraphs = Array.from(doc.getElementsByTagName("w:p"));
  for (const p of paragraphs) {
    if (pending.every((e) => e.done)) break;
    if (!p.getElementsByTagName("w:t").length) continue;

    let { full, ranges, refs } = collectRanges(p);
    for (const e of pending) {
      if (e.done || !e.re) continue;
      const re = e.re;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      let found: { m: RegExpExecArray; spans: [number, number, string][] | null } | null = null;
      while ((m = re.exec(full))) {
        if (m[0].length === 0) re.lastIndex++;
        if (e.seg) {
          const spans = spansOf(m, e.seg.parts);
          // Parça sınırları başvuru konumlarında olmalı (k. sınır = k. başvuru).
          const bounds = spans.slice(0, -1).map(([, b]) => b);
          const refsIn = refs.filter((o) => o > m!.index && o < m!.index + m![0].length);
          const ok =
            bounds.every((b) => refs.includes(b)) &&
            // Eşleşmenin içinde, sınır olmayan bir başvuru kalmasın.
            refsIn.every((o) => bounds.includes(o)) &&
            // Boş parçaya eklenecek metnin konacağı bir run yoksa (paragraf
            // sonu) yeri belirsiz → bu eşleşme kullanılmaz.
            spans.every(([a, b, rep]) => a < b || !rep || ranges.some((r) => r.start <= a && a < r.end));
          if (ok) {
            found = { m, spans };
            break;
          }
          continue;
        }
        const s = m.index;
        const t = s + m[0].length;
        if (refs.some((o) => o > s && o < t)) continue; // başvurunun üstünden geçer
        found = { m, spans: null };
        break;
      }
      if (!found) continue;
      if (found.spans) {
        // Sondan başa: öndeki konumlar kaymasın.
        for (let k = found.spans.length - 1; k >= 0; k--) {
          const [a, b, rep] = found.spans[k];
          if (a < b) spliceParagraph(ranges, a, b, rep);
          else if (rep) {
            // Boş parçaya ekleme: a'da BAŞLAYAN/içeren run'a (başvurudan sonraki run).
            const r = ranges.find((x) => x.start <= a && a < x.end);
            if (r) setRunText(r.node, r.text.slice(0, a - r.start) + rep + r.text.slice(a - r.start));
          }
          ({ full, ranges, refs } = collectRanges(p));
        }
      } else {
        spliceParagraph(ranges, found.m.index, found.m.index + found.m[0].length, e.suggestion);
      }
      e.done = true;
      applied++;
      // Konumlar kaydığı için aralıkları yeniden hesapla.
      ({ full, ranges, refs } = collectRanges(p));
    }
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  files[DOC_PATH] = strToU8(serialized);

  const blob = new Blob([zipSync(files) as BlobPart], { type: DOCX_MIME });
  return { blob, applied, total: edits.length };
}
