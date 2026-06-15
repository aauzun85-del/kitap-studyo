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

export type DocxMode = "kdy" | "faithful";

export type DocxResult = {
  blocks: Block[];
  suggestedTitle?: string;
  suggestedAuthor?: string;
  paragraphCount: number;
  headingCount: number;
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
type StyleInfo = { headingLevel: number; isQuote: boolean };

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
    map.set(id, { headingLevel, isQuote });
  }
  return map;
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

function paragraphRuns(p: Element): { runs: Run[]; sizePt: number | null } {
  const runs: Run[] = [];
  let sizePt: number | null = null;
  for (const r of Array.from(p.getElementsByTagName("w:r"))) {
    const text = runText(r);
    if (!text) continue;
    const rpr = directChild(r, "w:rPr");
    const bold = onOff(rpr, "w:b");
    const italic = onOff(rpr, "w:i");
    if (sizePt === null && rpr) {
      const sz = attr(directChild(rpr, "w:sz"), "w:val");
      if (sz) sizePt = Number(sz) / 2; // yarım punto
    }
    runs.push({ text, bold, italic });
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

  // Metin-tabanlı (stilsiz) başlıkları biriktirip birleştirmek için tampon.
  // Word'de bir bölüm başlığı çok satıra bölünmüşse (örn. "BÖLÜM III" /
  // "EGZOTERİK NEFES" / "TEORİSİ" ayrı paragraflar) bunlar tek ana bölüm
  // başlığı olmalı; aksi halde her satır ayrı bölüm sayılır ya da hiç
  // bölüm sayılmaz. Yalnızca KDY modunda devrede.
  let pendingHeading: { runs: Run[]; align: ParaAlign | undefined } | null = null;
  const flushHeading = () => {
    if (!pendingHeading) return;
    headingCount++;
    blocks.push({ type: "heading", level: 1, runs: pendingHeading.runs, align: pendingHeading.align });
    pendingHeading = null;
  };

  for (const p of Array.from(doc.getElementsByTagName("w:p"))) {
    const ppr = directChild(p, "w:pPr");
    const { runs, sizePt } = paragraphRuns(p);
    const hasText = runs.some((r) => r.text.trim().length > 0);

    if (!hasText) {
      if (mode === "faithful") {
        flushHeading();
        blocks.push({ type: "blank" });
      }
      continue;
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
      const plain = runs.map((r) => r.text).join("").trim();
      if (HEADING_KEYWORDS.test(plain)) level = 1;
    }

    // Kapanış sözcüğü ("SON", "BİTTİ" …): Word'de başlık stili olsa bile bölüm
    // sayılmaz — küçük, ortalı kapanış vinyeti; İÇİNDEKİLER'e girmez.
    const plainText = runs.map((r) => r.text).join("").trim();
    if (isClosingWord(plainText)) {
      flushHeading();
      blocks.push({ type: "paragraph", runs, align: "center" });
      continue;
    }

    if (level >= 1) {
      flushHeading();
      headingCount++;
      blocks.push({ type: "heading", level: Math.min(level, 4) as 1 | 2 | 3 | 4, runs, align });
      continue;
    }

    if (styleInfo?.isQuote) {
      flushHeading();
      blocks.push({ type: "blockquote", runs, align });
      continue;
    }

    // KDY modu: Word'de stil atanmamış ama başlık gibi görünen satırları
    // (BÖLÜM…/CHAPTER… ya da tamamı büyük harf) bölüm başlığı say; ardışık
    // olanları tek başlıkta birleştir.
    if (mode === "kdy") {
      // Kalın + kısa + tek satır → ara başlık (subhead): gövde+2 pt, ortalı.
      if (looksLikeSubhead(runs)) {
        flushHeading();
        headingCount++;
        blocks.push({ type: "heading", level: 2, runs, align: "center", subhead: true });
        continue;
      }
      const plain = runs.map((r) => r.text).join("").trim();
      if (looksLikeHeading(plain)) {
        if (pendingHeading) {
          pendingHeading.runs.push({ text: " ", bold: false, italic: false }, ...runs);
        } else {
          pendingHeading = { runs: [...runs], align };
        }
        continue;
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

  return { blocks, suggestedTitle, suggestedAuthor, paragraphCount, headingCount };
}
