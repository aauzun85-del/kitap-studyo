// Word (.docx) içe aktarma. .docx aslında bir zip; içinde word/document.xml
// (gövde), word/styles.xml (stil tanımları) ve docProps/core.xml (başlık/yazar)
// bulunur. fflate ile açar, tarayıcının DOMParser'ı ile XML'i okur ve mizanpaj
// motorunun Block[] modeline çeviririz.
//
// İki mod:
//   - "kdy"      : yapıyı koru (paragraf bölümleri, başlıklar, ortalı satırlar,
//                  kalın/italik), ama ölçüleri (punto/aralık/girinti) KDY'ye bırak.
//   - "faithful" : Word'deki punto, paragraf-aralığı, ilk-satır girintisi ve boş
//                  paragrafları olabildiğince aynen taşı.

import { unzipSync, strFromU8 } from "fflate";
import { looksLikeHeading, HEADING_KEYWORDS, cleanMetaValue, isClosingWord, looksLikeSubhead } from "./paginate";
import type { Block, Run, ParaAlign } from "./paginate";
import { stripFootnoteMarks } from "./footnotes";

export type DocxMode = "kdy" | "faithful";

export type DocxResult = {
  blocks: Block[];
  suggestedTitle?: string;
  suggestedAuthor?: string;
  paragraphCount: number;
  headingCount: number;
  /** Aktarılan dipnot sayısı (Word sonnotları da dipnot olarak sayılır). */
  footnoteCount: number;
};

const TWIPS_PER_MM = 1440 / 25.4; // 1 inç = 1440 twip = 25.4 mm
function twipsToMm(tw: number): number {
  return tw / TWIPS_PER_MM;
}

function directChild(el: Element, tag: string): Element | null {
  for (const c of Array.from(el.children)) {
    if (c.tagName === tag) return c;
  }
  return null;
}

function attr(el: Element | null, name: string): string | null {
  if (!el) return null;
  // OOXML nitelikleri w: önekli (w:val); DOMParser bunları tam adla saklar.
  return el.getAttribute(name) ?? el.getAttribute(name.replace(/^w:/, ""));
}

// <w:b/> açık; <w:b w:val="false|0|off"/> kapalı sayılır.
function onOff(rpr: Element | null, tag: string): boolean {
  if (!rpr) return false;
  const el = directChild(rpr, tag);
  if (!el) return false;
  const v = attr(el, "w:val");
  if (v === null) return true;
  return !["false", "0", "off", "none"].includes(v.toLowerCase());
}

function mapAlign(val: string | null): ParaAlign | undefined {
  switch (val) {
    case "center":
      return "center";
    case "right":
    case "end":
      return "right";
    case "both":
    case "distribute":
      return "justify";
    case "left":
    case "start":
      return "left";
    default:
      return undefined;
  }
}

// styles.xml → styleId'nin başlık seviyesi (yoksa 0) ve alıntı stili mi.
type StyleInfo = { headingLevel: number; isQuote: boolean; isNoteRef: boolean };

function parseStyles(xml: string | undefined): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>();
  if (!xml) return map;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  for (const style of Array.from(doc.getElementsByTagName("w:style"))) {
    const id = attr(style, "w:styleId");
    if (!id) continue;
    const nameEl = directChild(style, "w:name");
    const name = (attr(nameEl, "w:val") ?? "").toLowerCase();
    const ppr = directChild(style, "w:pPr");
    const outline = ppr ? directChild(ppr, "w:outlineLvl") : null;
    const outlineVal = attr(outline, "w:val");

    let headingLevel = 0;
    const nameMatch = /(?:heading|ba[sş]l[iı]k|balk|outline)\s*([1-4])/i.exec(name);
    const idMatch = /^(?:heading|balk|baslik)([1-4])$/i.exec(id);
    if (nameMatch) headingLevel = Number(nameMatch[1]);
    else if (idMatch) headingLevel = Number(idMatch[1]);
    else if (outlineVal !== null) {
      const lvl = Number(outlineVal);
      if (lvl >= 0 && lvl <= 3) headingLevel = lvl + 1;
    }

    const isQuote = /quote|al[iı]nt[iı]/i.test(name);
    // Dipnot/sonnot başvuru karakter stili (yerelleştirilmiş Word'de styleId
    // farklı olabilir, ör. "DipnotBavurusu"; w:name yerleşik İngilizce addır).
    const isNoteRef = /^(?:footnote|endnote) reference$/i.test(name) || NOTE_REF_STYLE_RE.test(id);
    map.set(id, { headingLevel, isQuote, isNoteRef });
  }
  return map;
}

// word/_rels/document.xml.rels: görsel ilişkilerini rel-id → zip içi tam yola eşler.
function parseImageRels(xml: Uint8Array | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  const doc = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
  for (const rel of Array.from(doc.getElementsByTagName("Relationship"))) {
    const id = rel.getAttribute("Id");
    const target = rel.getAttribute("Target");
    const type = rel.getAttribute("Type") ?? "";
    if (!id || !target || !/image/i.test(type)) continue;
    const clean = target.replace(/^\//, "").replace(/^(\.\.\/)+/, "");
    map.set(id, clean.startsWith("word/") ? clean : `word/${clean}`);
  }
  return map;
}

// w:tbl → tablo bloğu (satır × hücre × run). Hücre içi paragraflar boşlukla birleşir.
function parseTable(tbl: Element, ctx: NoteCtx): Block {
  const grid = directChild(tbl, "w:tblGrid");
  const colCount = grid
    ? Array.from(grid.children).filter((c) => c.tagName === "w:gridCol").length
    : 0;
  const rows: Run[][][] = [];
  for (const tr of Array.from(tbl.children)) {
    if (tr.tagName !== "w:tr") continue;
    const cells: Run[][] = [];
    for (const tc of Array.from(tr.children)) {
      if (tc.tagName !== "w:tc") continue;
      const cellRuns: Run[] = [];
      for (const cp of Array.from(tc.getElementsByTagName("w:p"))) {
        const { runs } = paragraphRuns(cp, ctx, ctx.opts);
        if (runs.length === 0) continue;
        if (cellRuns.length) cellRuns.push({ text: " ", bold: false, italic: false });
        cellRuns.push(...runs);
      }
      cells.push(cellRuns);
    }
    if (cells.length) rows.push(cells);
  }
  return { type: "table", columns: colCount || Math.max(1, ...rows.map((r) => r.length)), rows };
}

function runText(r: Element): string {
  let out = "";
  for (const c of Array.from(r.children)) {
    if (c.tagName === "w:t") out += c.textContent ?? "";
    else if (c.tagName === "w:tab") out += " ";
    else if (c.tagName === "w:br" || c.tagName === "w:cr") out += " ";
  }
  return out;
}

// ── Dipnot / sonnot ────────────────────────────────────────────────────────
// Word'de başvuru, gövdede <w:footnoteReference w:id="N"/> (sonnot için
// w:endnoteReference) içeren bir run'dır; metni word/footnotes.xml (endnotes.xml)
// içindedir. Ortak metin biçimine çeviririz: başvuru → ayrı, biçimsiz "[^n]"
// run'ı; tanım → başvuran bloğun hemen ardına "[^n]: not metni" paragrafı.
// n, dipnot + sonnot için okuma sırasına göre tek sayaçtır (sonnotlar dipnot olur).
//
// Gerçek dipnotu olan dosyada gövdede ZATEN yazılı "[^" metni (ör. markdown
// örneği) içe aktarılan "[^n]" kimlikleriyle çakışırdı. Bu yüzden böyle bir
// dosyada her yazılı "[^" → "[" + U+2060 (WORD JOINER, görünmez, satır
// kırdırmaz) + "^" olur: ekranda/baskıda aynı görünür ama asla başvuru/tanım
// olarak çözülmez. Dipnotsuz dosyalarda metne dokunulmaz (elle yazılmış
// markdown dipnotları eskisi gibi çalışır). docxEdit.ts bu kaçışı geri çözer.

export const LITERAL_FN_ESC = "[⁠^";
const escapeLiteralRefs = (s: string): string => (s.includes("[^") ? s.split("[^").join(LITERAL_FN_ESC) : s);

/** Word'ün yerleşik başvuru karakter stilleri (styleId). */
const NOTE_REF_STYLE_RE = /^(?:Footnote|Endnote)Reference$/i;

type RunOpts = {
  /** Başvuru-işareti karakter stilleri (styles.xml'den). */
  refStyles: Set<string>;
  /** Yazılı "[^" metnini kaçır (dosyada gerçek dipnot varsa). */
  escape: boolean;
  /** Paragraf başındaki işaret run'larını (özel not işareti) at. */
  dropLeadingMarks?: boolean;
};

type NoteDef = { n: number; runs: Run[] };
type NoteCtx = {
  footnotes: Map<string, Run[]>;
  endnotes: Map<string, Run[]>;
  counter: number;
  /** Henüz bir bloğun ardına yazılmamış tanımlar (başvuru sırasıyla). */
  pending: NoteDef[];
  /** Başvuru run'ları (başlık/kapanış sezgileri bunları yok sayar). */
  markers: Set<Run>;
  opts: RunOpts;
};

// Run, bir dipnot işareti gibi biçimlenmiş mi (başvuru stili ya da üst simge)?
function isMarkRun(r: Element, refStyles: Set<string>): boolean {
  const rpr = directChild(r, "w:rPr");
  if (!rpr) return false;
  const style = attr(directChild(rpr, "w:rStyle"), "w:val");
  if (style && (refStyles.has(style) || NOTE_REF_STYLE_RE.test(style))) return true;
  return attr(directChild(rpr, "w:vertAlign"), "w:val") === "superscript";
}

// İzlenen değişiklik: silinmiş / taşınmış (eski yer) run'lar okunmaz.
function inDeletion(r: Element, stop: Element): boolean {
  for (let el = r.parentElement; el && el !== stop; el = el.parentElement) {
    if (el.tagName === "w:del" || el.tagName === "w:moveFrom") return true;
  }
  return false;
}

// Run'da görünür içerik var mı (metin, sekme, satır sonu, sembol)?
function hasContent(r: Element): boolean {
  for (const c of Array.from(r.children)) {
    if (["w:t", "w:tab", "w:br", "w:cr", "w:sym"].includes(c.tagName)) return true;
  }
  return false;
}

// footnotes.xml / endnotes.xml → Word kimliği → not run'ları. Yalnız ayraç
// girdileri (w:type="separator" | "continuationSeparator" | "continuationNotice")
// atlanır; w:type="normal" geçerli bir nottur. Çok paragraflı not tek boşlukla
// birleşir. Bozuk dosyada boş harita döner.
const SEPARATOR_TYPES = new Set(["separator", "continuationseparator", "continuationnotice"]);
function parseNotes(
  xml: Uint8Array | undefined,
  tag: "w:footnote" | "w:endnote",
  refStyles: Set<string>,
): Map<string, Run[]> {
  const map = new Map<string, Run[]>();
  if (!xml) return map;
  try {
    const doc = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
    for (const note of Array.from(doc.getElementsByTagName(tag))) {
      const type = attr(note, "w:type");
      if (type !== null && SEPARATOR_TYPES.has(type.toLowerCase())) continue;
      const id = attr(note, "w:id");
      if (id === null) continue;
      // Özel işaretli (customMarkFollows) notta <w:footnoteRef/> yoktur; işaret
      // ("*", "†") not metninin başında başvuru stilli/üst simge run olarak durur.
      const custom =
        note.getElementsByTagName("w:footnoteRef").length === 0 &&
        note.getElementsByTagName("w:endnoteRef").length === 0;
      const runs: Run[] = [];
      for (const p of Array.from(note.getElementsByTagName("w:p"))) {
        const { runs: pr } = paragraphRuns(p, null, {
          refStyles,
          escape: true,
          dropLeadingMarks: custom && !runs.some((r) => r.text.trim()),
        });
        if (!pr.some((r) => r.text.trim())) continue;
        if (runs.length) runs.push({ text: " ", bold: false, italic: false });
        runs.push(...pr);
      }
      // Baş/son boşluğu kırp (Word not işaretinin ardına bir boşluk koyar).
      while (runs.length && !runs[0].text.trim()) runs.shift();
      while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop();
      if (!runs.length) continue;
      runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, "") };
      const li = runs.length - 1;
      runs[li] = { ...runs[li], text: runs[li].text.replace(/\s+$/, "") };
      map.set(id, runs);
    }
  } catch {
    // Not dosyası okunamadı → dipnotsuz devam (içe aktarma asla durmasın).
  }
  return map;
}

function noteRefOf(r: Element): Element | null {
  for (const c of Array.from(r.children)) {
    if (c.tagName === "w:footnoteReference" || c.tagName === "w:endnoteReference") return c;
  }
  return null;
}

// Başvuru içeren bir run'ı çocuk sırasıyla gezer: metin parçaları + "[^n]".
// customMarkFollows: özel işaret (*, †) aynı run'da ref'in ardındaki metin ya
// da <w:sym>'dir; aynı run'da yoksa true döner → işaret bir sonraki run'da
// aranır (paragraphRuns yalnız işaret biçimli run'ı yutar).
function noteRunPieces(
  r: Element,
  bold: boolean,
  italic: boolean,
  ctx: NoteCtx,
  out: Run[],
): boolean {
  let buf = "";
  let swallow = false; // özel işaret (*, †) metnini yut
  let swallowNext = false;
  const flush = () => {
    if (buf) out.push({ text: ctx.opts.escape ? escapeLiteralRefs(buf) : buf, bold, italic });
    buf = "";
  };
  for (const c of Array.from(r.children)) {
    const tag = c.tagName;
    if (tag === "w:footnoteReference" || tag === "w:endnoteReference") {
      flush();
      const custom = attr(c, "w:customMarkFollows");
      swallow = custom !== null && !["false", "0", "off"].includes(custom.toLowerCase());
      swallowNext = swallow;
      const id = attr(c, "w:id");
      const notes = tag === "w:footnoteReference" ? ctx.footnotes : ctx.endnotes;
      const noteRuns = id !== null ? notes.get(id) : undefined;
      if (!noteRuns) continue; // tanımsız başvuru → sessizce düşer
      const n = ++ctx.counter;
      const marker: Run = { text: `[^${n}]`, bold: false, italic: false };
      ctx.markers.add(marker);
      out.push(marker);
      ctx.pending.push({ n, runs: noteRuns });
      continue;
    }
    if (tag === "w:sym") {
      if (swallow) swallowNext = false; // işaret sembol olarak bu run'daydı
      continue;
    }
    let piece = "";
    if (tag === "w:t") piece = c.textContent ?? "";
    else if (tag === "w:tab" || tag === "w:br" || tag === "w:cr") piece = " ";
    else continue;
    if (swallow && tag === "w:t") {
      swallowNext = false; // işaret bu run'daydı
      continue;
    }
    buf += piece;
  }
  flush();
  return swallowNext;
}

function paragraphRuns(p: Element, ctx: NoteCtx | null, opts: RunOpts): { runs: Run[]; sizePt: number | null } {
  const runs: Run[] = [];
  let sizePt: number | null = null;
  let swallowNext = false;
  for (const r of Array.from(p.getElementsByTagName("w:r"))) {
    if (inDeletion(r, p)) continue;
    const ref = ctx ? noteRefOf(r) : null;
    if (ref && ctx) {
      const rpr = directChild(r, "w:rPr");
      swallowNext = noteRunPieces(r, onOff(rpr, "w:b"), onOff(rpr, "w:i"), ctx, runs);
      continue;
    }
    if (swallowNext) {
      // İçeriksiz run (yalnız biçim / alan karakteri) → işareti beklemeye devam.
      if (!hasContent(r)) continue;
      swallowNext = false;
      // customMarkFollows: işaret, ref'ten sonraki işaret biçimli run'dadır.
      // Biçimsiz run metindir; uzunluğu ne olursa olsun yutulmaz.
      if (isMarkRun(r, opts.refStyles)) continue;
    }
    if (opts.dropLeadingMarks && !runs.some((x) => x.text.trim()) && isMarkRun(r, opts.refStyles)) continue;
    const text = runText(r);
    if (!text) continue;
    const rpr = directChild(r, "w:rPr");
    const bold = onOff(rpr, "w:b");
    const italic = onOff(rpr, "w:i");
    if (sizePt === null && rpr) {
      const sz = attr(directChild(rpr, "w:sz"), "w:val");
      if (sz) sizePt = Number(sz) / 2; // yarım punto
    }
    runs.push({ text: opts.escape ? escapeLiteralRefs(text) : text, bold, italic });
  }
  return { runs, sizePt };
}

export function parseDocx(buffer: ArrayBuffer, mode: DocxMode): DocxResult {
  const files = unzipSync(new Uint8Array(buffer));
  const docXml = files["word/document.xml"];
  if (!docXml) throw new Error("Geçerli bir .docx değil (word/document.xml bulunamadı).");

  const styles = parseStyles(files["word/styles.xml"] ? strFromU8(files["word/styles.xml"]) : undefined);
  const doc = new DOMParser().parseFromString(strFromU8(docXml), "application/xml");

  const blocks: Block[] = [];
  let paragraphCount = 0;
  let headingCount = 0;

  const refStyles = new Set([...styles].filter(([, s]) => s.isNoteRef).map(([id]) => id));
  const footnotes = parseNotes(files["word/footnotes.xml"], "w:footnote", refStyles);
  const endnotes = parseNotes(files["word/endnotes.xml"], "w:endnote", refStyles);
  const ctx: NoteCtx = {
    footnotes,
    endnotes,
    counter: 0,
    pending: [],
    markers: new Set(),
    opts: { refStyles, escape: footnotes.size + endnotes.size > 0 },
  };
  let footnoteCount = 0;
  // Tanım paragrafları (yetim başvuru işareti bunlara EKLENMEZ).
  const defBlocks = new Set<Block>();
  // Tanımları "[^n]: not" paragrafı olarak yazar (başvuran bloğun hemen ardına).
  const emitDefs = (defs: NoteDef[]): void => {
    for (const d of defs) {
      footnoteCount++;
      const b: Block = { type: "paragraph", runs: [{ text: `[^${d.n}]: `, bold: false, italic: false }, ...d.runs] };
      defBlocks.add(b);
      blocks.push(b);
    }
  };
  const takePending = (): NoteDef[] => {
    const defs = ctx.pending;
    ctx.pending = [];
    return defs;
  };
  // Sezgiler (başlık/kapanış/ara başlık) başvuru işaretlerini görmesin.
  const noMarkers = (runs: Run[]): Run[] =>
    ctx.markers.size ? runs.filter((r) => !ctx.markers.has(r)) : runs;
  const plainOf = (runs: Run[]): string => {
    const t = runs.map((r) => r.text).join("");
    return (ctx.markers.size ? stripFootnoteMarks(noMarkers(runs).map((r) => r.text).join("")) : t).trim();
  };

  // Metin-tabanlı (stilsiz) başlıkları biriktirip birleştirmek için tampon.
  // Word'de bir bölüm başlığı çok satıra bölünmüşse (örn. "BÖLÜM III" /
  // "EGZOTERİK NEFES" / "TEORİSİ" ayrı paragraflar) bunlar tek ana bölüm
  // başlığı olmalı; aksi halde her satır ayrı bölüm sayılır ya da hiç
  // bölüm sayılmaz. Yalnızca KDY modunda devrede.
  let pendingHeading: { runs: Run[]; align: ParaAlign | undefined; defs: NoteDef[] } | null = null;
  const flushHeading = () => {
    if (!pendingHeading) return;
    headingCount++;
    blocks.push({ type: "heading", level: 1, runs: pendingHeading.runs, align: pendingHeading.align });
    const defs = pendingHeading.defs;
    pendingHeading = null;
    emitDefs(defs);
  };

  // Metinsiz paragrafın başvuru işaretlerini önceki metin bloğuna bağlar.
  // Geriye doğru görsel/boş satır/tanım paragraflarını atlar; tabloya ya da
  // belge başına varırsa işaretler kendi paragrafında kalır.
  const attachOrphanMarks = (marks: Run[], defs: NoteDef[]): void => {
    if (pendingHeading) {
      pendingHeading.runs.push(...marks);
      pendingHeading.defs.push(...defs);
      return;
    }
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (defBlocks.has(b) || b.type === "image" || b.type === "blank") continue;
      if (b.type === "paragraph" || b.type === "heading" || b.type === "blockquote") {
        b.runs.push(...marks);
        emitDefs(defs);
        return;
      }
      break;
    }
    blocks.push({ type: "paragraph", runs: marks });
    emitDefs(defs);
  };

  const processPara = (p: Element): void => {
    const ppr = directChild(p, "w:pPr");
    const { runs, sizePt } = paragraphRuns(p, ctx, ctx.opts);
    // Bu paragrafın dipnot tanımları: blok yazıldıktan HEMEN sonra eklenir.
    const defs = takePending();
    const hasText = noMarkers(runs).some((r) => r.text.trim().length > 0);

    if (!hasText) {
      // Görünür metni olmayan paragraftaki başvuru (görsel paragrafı, yalnız
      // işaretten oluşan satır) kaybolmasın: işaret önceki metin bloğunun sonuna
      // eklenir (yoksa kendi paragrafı olur), tanımı hemen ardından yazılır.
      const marks = runs.filter((r) => ctx.markers.has(r));
      if (marks.length) attachOrphanMarks(marks, defs);
      if (mode === "faithful") {
        flushHeading();
        blocks.push({ type: "blank" });
      }
      return;
    }
    paragraphCount++;

    const styleId = ppr ? attr(directChild(ppr, "w:pStyle"), "w:val") : null;
    const styleInfo = styleId ? styles.get(styleId) : undefined;
    const paraOutline = ppr ? attr(directChild(ppr, "w:outlineLvl"), "w:val") : null;
    const align = mapAlign(ppr ? attr(directChild(ppr, "w:jc"), "w:val") : null);

    // Başlık seviyesi: önce paragraf outlineLvl, sonra stil.
    let level = 0;
    if (paraOutline !== null) {
      const lvl = Number(paraOutline);
      if (lvl >= 0 && lvl <= 3) level = lvl + 1;
    }
    if (level === 0 && styleInfo) level = styleInfo.headingLevel;

    // KDY: "BÖLÜM…/CHAPTER…/Önsöz…" ile başlayan başlıklar, Word'de hangi
    // başlık seviyesinde olursa olsun ANA bölüm sayılır (yeni tek sayfadan
    // başlar). Çoğu kitapta bölüm başlıkları "Başlık 2" stilindedir; bu olmadan
    // sayfa ortasında akıp giderler. Hemen ardından gelen başlık satırı (örn.
    // bölüm adı) seviye-2 alt başlık olarak aynı sayfada kalır.
    if (mode === "kdy" && level >= 1) {
      const plain = plainOf(runs);
      if (HEADING_KEYWORDS.test(plain)) level = 1;
    }

    // Kapanış sözcüğü ("SON", "BİTTİ" …): Word'de başlık stili olsa bile bölüm
    // sayılmaz — küçük, ortalı kapanış vinyeti; İÇİNDEKİLER'e girmez.
    const plainText = plainOf(runs);
    if (isClosingWord(plainText)) {
      flushHeading();
      blocks.push({ type: "paragraph", runs, align: "center" });
      emitDefs(defs);
      return;
    }

    if (level >= 1) {
      flushHeading();
      headingCount++;
      blocks.push({ type: "heading", level: Math.min(level, 4) as 1 | 2 | 3 | 4, runs, align });
      emitDefs(defs);
      return;
    }

    if (styleInfo?.isQuote) {
      flushHeading();
      blocks.push({ type: "blockquote", runs, align });
      emitDefs(defs);
      return;
    }

    // KDY modu: Word'de stil atanmamış ama başlık gibi görünen satırları
    // (BÖLÜM…/CHAPTER… ya da tamamı büyük harf) bölüm başlığı say; ardışık
    // olanları tek başlıkta birleştir.
    if (mode === "kdy") {
      // Kalın + kısa + tek satır → ara başlık (subhead): gövde+2 pt, ortalı.
      if (looksLikeSubhead(noMarkers(runs))) {
        flushHeading();
        headingCount++;
        blocks.push({ type: "heading", level: 2, runs, align: "center", subhead: true });
        emitDefs(defs);
        return;
      }
      const plain = plainOf(runs);
      if (looksLikeHeading(plain)) {
        if (pendingHeading) {
          pendingHeading.runs.push({ text: " ", bold: false, italic: false }, ...runs);
          pendingHeading.defs.push(...defs);
        } else {
          pendingHeading = { runs: [...runs], align, defs };
        }
        return;
      }
    }

    flushHeading();

    if (mode === "faithful") {
      const spacing = ppr ? directChild(ppr, "w:spacing") : null;
      const before = attr(spacing, "w:before");
      const ind = ppr ? directChild(ppr, "w:ind") : null;
      const firstLine = attr(ind, "w:firstLine");
      blocks.push({
        type: "paragraph",
        runs,
        align,
        sizePt: sizePt ?? undefined,
        spaceBeforeMm: before ? twipsToMm(Number(before)) : undefined,
        firstLineIndentMm: firstLine ? twipsToMm(Number(firstLine)) : undefined,
      });
    } else {
      // KDY modu: yalnızca yapısal hizalamayı (ortalı/sağa) koru.
      const keepAlign = align === "center" || align === "right" ? align : undefined;
      blocks.push({ type: "paragraph", runs, align: keepAlign });
    }
    emitDefs(defs);
  };

  // Görselleri (w:drawing/a:blip) çıkar: rel id → media yolu → zip'ten bayt.
  const relMap = parseImageRels(files["word/_rels/document.xml.rels"]);
  let imgCounter = 0;
  const emitImages = (p: Element): void => {
    for (const drawing of Array.from(p.getElementsByTagName("w:drawing"))) {
      const blip = drawing.getElementsByTagName("a:blip")[0];
      const id = blip ? blip.getAttribute("r:embed") ?? blip.getAttribute("embed") : null;
      const media = id ? relMap.get(id) : undefined;
      const data = media ? files[media] : undefined;
      if (!media || !data) continue;
      const ext = (media.split(".").pop() || "png").toLowerCase();
      const extent = drawing.getElementsByTagName("wp:extent")[0];
      const cx = extent ? Number(extent.getAttribute("cx")) : 0;
      const cy = extent ? Number(extent.getAttribute("cy")) : 0;
      blocks.push({
        type: "image",
        // Mutlak VFS yolu (/main.typ köküne göre) — mapShadow ile #image eşleşmeli.
        path: `/media/img${++imgCounter}.${ext}`,
        data,
        widthMm: cx > 0 ? cx / 36000 : undefined, // EMU → mm (36000 EMU = 1 mm)
        heightMm: cy > 0 ? cy / 36000 : undefined,
        align: "center",
      });
    }
  };

  // Gövde çocuklarını SIRAYLA gez: paragraf (görsel + metin) ve tablo. Eski hâl
  // tüm w:p'leri düz tarıyordu → tablo hücre metni gevşek paragraf olarak sızıyor,
  // tablo yapısı + görseller tamamen kayboluyordu.
  const bodyEl = doc.getElementsByTagName("w:body")[0];
  for (const child of Array.from(bodyEl ? bodyEl.children : [])) {
    if (child.tagName === "w:p") {
      emitImages(child);
      processPara(child);
    } else if (child.tagName === "w:tbl") {
      flushHeading();
      blocks.push(parseTable(child, ctx));
      // Hücre içi dipnotların tanımları tablonun ardına.
      emitDefs(takePending());
    }
  }

  flushHeading();

  // Başlık/yazar önerisi (docProps/core.xml).
  let suggestedTitle: string | undefined;
  let suggestedAuthor: string | undefined;
  if (files["docProps/core.xml"]) {
    const core = new DOMParser().parseFromString(strFromU8(files["docProps/core.xml"]), "application/xml");
    // Yer-tutucu üst veriyi (örn. "Un-named") boşa çevir; alanları kirletmesin.
    suggestedTitle = cleanMetaValue(core.getElementsByTagName("dc:title")[0]?.textContent) || undefined;
    suggestedAuthor = cleanMetaValue(core.getElementsByTagName("dc:creator")[0]?.textContent) || undefined;
  }

  return { blocks, suggestedTitle, suggestedAuthor, paragraphCount, headingCount, footnoteCount };
}
