// Yüklenen orijinal .docx dosyasının BİÇİMİNİ koruyarak, editörde kabul edilen
// metin düzeltmelerini içine işler. Yalnız metin düğümlerini (<w:t>) değiştirir;
// başlık stilleri, hizalama, kalın/italik, punto, paragraf yapısı vb. dokunulmaz.
// Böylece çıkan docx mizanpaj için hâlâ geçerli kalır.
//
// .docx bir zip'tir; gövde metni word/document.xml içinde <w:p> (paragraf) →
// <w:r> (run) → <w:t> (metin) hiyerarşisindedir. Aynı paragrafın metni birden
// çok run'a bölünmüş olabilir; bu yüzden değiştirmeyi run-duyarlı yaparız.
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export type DocxEdit = { original: string; suggestion: string };

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
  const trimmed = original.trim();
  if (!trimmed) return null;
  const esc = trimmed
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  try {
    return new RegExp(esc);
  } catch {
    return null;
  }
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

// Paragrafın güncel run aralıklarını yeniden hesaplar (değişiklikten sonra).
function collectRanges(tNodes: Element[]): { full: string; ranges: TRange[] } {
  let full = "";
  const ranges: TRange[] = [];
  for (const node of tNodes) {
    const text = node.textContent ?? "";
    ranges.push({ node, start: full.length, end: full.length + text.length, text });
    full += text;
  }
  return { full, ranges };
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

  // Her düzeltme yalnız bir kez uygulanır (belge sırasında ilk eşleşme).
  const pending = edits
    .map((e) => ({ ...e, re: buildSearch(e.original), done: false }))
    .filter((e) => e.re);
  let applied = 0;

  const paragraphs = Array.from(doc.getElementsByTagName("w:p"));
  for (const p of paragraphs) {
    if (pending.every((e) => e.done)) break;
    const tNodes = Array.from(p.getElementsByTagName("w:t"));
    if (!tNodes.length) continue;

    let { full, ranges } = collectRanges(tNodes);
    for (const e of pending) {
      if (e.done || !e.re) continue;
      const m = e.re.exec(full);
      if (!m) continue;
      spliceParagraph(ranges, m.index, m.index + m[0].length, e.suggestion);
      e.done = true;
      applied++;
      // Konumlar kaydığı için aralıkları yeniden hesapla.
      ({ full, ranges } = collectRanges(tNodes));
    }
  }

  const serialized = new XMLSerializer().serializeToString(doc);
  files[DOC_PATH] = strToU8(serialized);

  const blob = new Blob([zipSync(files) as BlobPart], { type: DOCX_MIME });
  return { blob, applied, total: edits.length };
}
