// Sayfalama motoru v3 — KDY yapısal kitap modeli + satır-içi biçimlendirme.
// Girdi artık önceden ayrıştırılmış Block[] (markdown ya da Word içe aktarma).
// Her blok "run" taşır: {metin, kalın, italik}. Sayfalama satır kaydırmayı
// run'lara göre yapar (kalın/italik kelimeler doğru genişlikte ölçülür) ve her
// satırı stillenmiş segmentlere böler; önizleme bunları span olarak çizer.
//
// Yapı: başlık sayfası → biyografi → İÇİNDEKİLER → bölümler. Ana bölümler sağ
// (tek) sayfada başlar; üst bilgi ve sayfa numarası kenar boşluğunda.

import { mmToPx, pxToMm } from "./page";
import { hyphenPoints } from "./hyphenate";
import { knuthPlass, INFINITY, type KPItem } from "./linebreak";
import {
  KDY_HEADINGS,
  KDY_TITLE,
  KDY_AUTHOR,
  KDY_BIO,
  KDY_TOC,
  KDY_TOC_HEADING,
  KDY_RULES,
} from "./kdy";

// ── Biçimlendirme parçaları ────────────────────────────────────────────────
export type Run = { text: string; bold: boolean; italic: boolean };
export type Segment = { text: string; bold: boolean; italic: boolean };
export type ParaAlign = "left" | "center" | "right" | "justify";

// ── Kullanıcı ayarları ─────────────────────────────────────────────────────
export type LayoutSettings = {
  bodyFontFamily: string;
  bodySizePt: number;
  leadingPt: number; // 0 = otomatik (~%120)
  align: "left" | "justify";
  firstLineIndentMm: number;
  paragraphSpacingMm: number;
  headingFontFamily: string;
  detectHeadings: boolean;
  chapterStartsOnRightPage: boolean;
  showFrontMatter: boolean;
  showRunningHeads: boolean;
  showPageNumbers: boolean;
  hyphenate: boolean; // satır sonlarında Türkçe hece bölme (tireleme)
  dropCap: boolean; // bölüm başlarında büyük baş harf (drop cap)
  // Bölüm açılış stili (tema sistemi). Boş/eski taslaklarda makul varsayılanlar.
  chapterTopRatio?: number; // başlık sayfanın % kaçından başlar (vars. 0.12)
  chapterOrnament?: "none" | "rule" | "dots"; // başlık altı süs (vars. "none")
  showChapterKicker?: boolean; // "BÖLÜM N" üst etiketi (vars. true)
  // Satır kırma yöntemi (yalnız iki yana yaslı paragraflarda etkili):
  //  - "balanced": Knuth–Plass — tüm paragrafa bakıp boşlukları en dengeli
  //    dağıtan kırılma noktalarını seçer (profesyonel, varsayılan).
  //  - "greedy": açgözlü ("saldırgan") — her satıra sığdığı kadar sözcük
  //    yerleştirir; hızlıdır ama dar sütunlarda boşluklar daha düzensiz olur.
  lineBreak: "balanced" | "greedy";
};

export type BookMeta = { title: string; author: string; bio: string };

// Word üst verisinden (docProps/core.xml) sık gelen "yer tutucu" başlık/yazar
// değerleri. Bunlar gerçek bir ad değildir; koşu başlığında ve başlık sayfasında
// asla gösterilmemeli — boş kabul edilir. Karşılaştırma kırpılmış + küçük harf.
const META_PLACEHOLDERS = new Set([
  "un-named", "unnamed", "un named", "untitled", "no title", "name", "title", "author",
  "isimsiz", "adsız", "adsiz", "isimsiz kitap", "adsız kitap", "adsiz kitap",
]);

// Bir başlık/yazar değerini temizler: kırpar; bilinen yer tutucu ya da boşsa ""
// döndürür (çağıran taraf boş diye çizmez).
export function cleanMetaValue(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return META_PLACEHOLDERS.has(t.toLocaleLowerCase("tr")) ? "" : t;
}

// ── Akıllı (tipografik) tırnak dönüşümü ────────────────────────────────────
// Düz tırnakları (" ve ') yayıncılık standardı eğri tırnaklara çevirir. Bağlam
// duyarlı: açılış “ ‘ ile kapanış ” ’ doğru yönlenir; Türkçe kesme işareti
// (KDY'nin, 2023'te, Atatürk'ün) sağ tek tırnağa (’) döner. Fontlar bu gliflerin
// tümünü içeriyor (doğrulandı). Yön bağlamı run sınırlarını aşar (önceki karakter
// hatırlanır), çünkü tırnak çoğu zaman ayrı bir biçim run'ında olur.
const isQuoteWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
const OPENS_BEFORE_QUOTE = "([{‘“<«—–-/"; // bu karakterlerden sonra tırnak açılır

// ── Çizgi (tire/dash) tek-kural normalizasyonu ─────────────────────────────
// Türkçe dizgide cümle/ara çizgisi ARALIKLI em dash (" — ") ile yazılır. Kaynak
// metinde karışık kullanım (bitişik "söz—söz", çift tire "söz--söz", aralıklı
// kısa tire "söz - söz") tek kurala bağlanır. KORUNANLAR: kelime içi tire
// (ara-sıra) ve sayı aralıklarındaki bitişik en dash (1914–1918).
function normalizeDashesText(text: string): string {
  let s = text;
  s = s.replace(/-{2,}/g, "—");          // çift/çoklu tire → em dash
  s = s.replace(/ +[-–] +/g, " — ");     // aralıklı kısa tire / en dash → aralıklı em dash
  s = s.replace(/\s*—\s*/g, " — ");      // tüm em dash'leri tek boşlukla aç (bitişik dahil)
  s = s.replace(/^\s*—\s/, "— ");        // satır/paragraf başı diyalog tiresi: önünde boşluk yok
  return s;
}

function applySmartQuotesToRuns(runs: Run[], prevRef: { prev: string }): Run[] {
  return runs.map((r) => {
    let s = "";
    for (const ch of normalizeDashesText(r.text)) {
      const prev = prevRef.prev;
      if (ch === '"') {
        const open = prev === "" || /\s/.test(prev) || OPENS_BEFORE_QUOTE.includes(prev);
        s += open ? "“" : "”";
      } else if (ch === "'") {
        if (isQuoteWordChar(prev)) s += "’"; // kelime içi/sonu: kesme ’
        else {
          const open = prev === "" || /\s/.test(prev) || OPENS_BEFORE_QUOTE.includes(prev);
          s += open ? "‘" : "’";
        }
      } else {
        s += ch;
      }
      prevRef.prev = ch; // bağlam: dönüşmemiş özgün karakter
    }
    return { ...r, text: s };
  });
}

function smartQuoteText(text: string): string {
  return applySmartQuotesToRuns([{ text, bold: false, italic: false }], { prev: "" })[0].text;
}

function smartQuoteBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    if (b.type === "blank") return b;
    // Her blok kendi bağlamında başlar (önceki blok tırnağı taşımaz).
    return { ...b, runs: applySmartQuotesToRuns(b.runs, { prev: "" }) };
  });
}

// ── Çıktı modeli ───────────────────────────────────────────────────────────
export type LineKind =
  | "title"
  | "author"
  | "bio"
  | "toc-heading"
  | "toc-entry"
  | "heading"
  | "body";

export type Line = {
  segments: Segment[];
  kind: LineKind;
  sizePt: number;
  font: string;
  weight: number; // taban kalınlık (başlık 700, gövde 400); segment.bold ayrıca 700 yapar
  italic: boolean; // taban italik (alıntı); segment.italic ayrıca italik yapar
  align: ParaAlign;
  indentMm: number; // ilk satır girintisi
  blockIndentMm: number; // iki yandan girinti (alıntı)
  leftInsetMm?: number; // soldan ek girinti (drop cap'in açtığı boşluk)
  justify: boolean; // bu satır iki yana yaslansın
  spaceBeforeMm: number;
  heightMm: number;
  blockIndex?: number; // kaynak blok indeksi (canvas düzenleme için); ön sayfalarda yok
  // Bölüm başı büyük baş harf: yalnız ilgili paragrafın ilk satırında dolu.
  dropCap?: { char: string; sizePt: number; font: string; weight: number; widthMm: number };
};

export type PageRole = "title" | "bio" | "toc" | "body" | "blank";

export type Page = {
  number: number;
  showNumber: boolean;
  role: PageRole;
  isRight: boolean;
  runningHead: string;
  lines: Line[];
};

// ── Bloklar ────────────────────────────────────────────────────────────────
// sizePt / spaceBeforeMm / firstLineIndentMm yalnızca "Word'e sadık" modunda
// dolar; KDY modunda boş bırakılır (ayarlardan/KDY'den alınır).
// fontFamily / sizePt blok-bazlı geçersiz kılma: canvas biçim çubuğu doldurur.
// Boşsa ayarlardan/KDY'den gelen varsayılan kullanılır.
export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; runs: Run[]; align?: ParaAlign; fontFamily?: string; sizePt?: number; subhead?: boolean; kicker?: string }
  | {
      type: "paragraph";
      runs: Run[];
      align?: ParaAlign;
      sizePt?: number;
      spaceBeforeMm?: number;
      firstLineIndentMm?: number;
      fontFamily?: string;
    }
  | { type: "blockquote"; runs: Run[]; align?: ParaAlign; fontFamily?: string; sizePt?: number }
  | { type: "blank" };

export const HEADING_KEYWORDS =
  /^(bölüm|bolum|kısım|kisim|chapter|part|önsöz|onsoz|giriş|giris|sonsöz|sonsoz|epilog|prolog|introduction|preface|epilogue)\b/i;

function headingLevel(line: string): 1 | 2 | 3 | 4 | null {
  const m = /^(#{1,4})\s+/.exec(line);
  return m ? (m[1].length as 1 | 2 | 3 | 4) : null;
}

export function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (HEADING_KEYWORDS.test(t)) return true;
  const letters = t.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toLocaleUpperCase("tr");
}

// Kapanış sözcükleri ("SON", "BİTTİ" …). Bunlar bölüm başlığı DEĞİLDİR; büyük
// harf oldukları için yanlışlıkla ana bölüm sanılıp İÇİNDEKİLER'e giriyor ve
// 24 pt diziliyordu. Bunun yerine küçük, ortalı bir kapanış olarak dizilmeli.
const CLOSING_WORDS = new Set(["son", "bitti", "fin", "sonu", "the end", "end", "bitiş"]);
export function isClosingWord(text: string): boolean {
  const t = text.trim().replace(/^[\s.*\-–—_]+|[\s.*\-–—_]+$/g, "").toLocaleLowerCase("tr");
  return t.length > 0 && CLOSING_WORDS.has(t);
}

// Ara başlık (subhead) sezgisi: Word'de "Başlık" stili olmayan ama elle KALIN
// yazılmış, KISA ve tek satırlık satırlar (örn. "İş", "Erkekler", "Dil"). Bunlar
// gövde puntosunda kalın paragraf olarak akıp gidiyordu; hiyerarşi zayıftı.
// Koşullar: tüm metinli run'lar kalın; 1–40 karakter; tamamı büyük harf DEĞİL
// (o ana bölüm sayılır); bölüm anahtarı/kapanış değil; cümle gibi bitmiyor.
export function looksLikeSubhead(runs: Run[]): boolean {
  const plain = runs.map((r) => r.text).join("").trim();
  if (plain.length < 1 || plain.length > 40) return false;
  const letters = plain.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  if (letters === letters.toLocaleUpperCase("tr")) return false; // tamamı BÜYÜK → bölüm
  if (HEADING_KEYWORDS.test(plain) || isClosingWord(plain)) return false;
  if (/[.!?:;]$/.test(plain)) return false; // gerçek cümle gibi durmasın
  const textual = runs.filter((r) => r.text.trim().length > 0);
  return textual.length > 0 && textual.every((r) => r.bold);
}

// ── Başlık hiyerarşisi sezgileri ───────────────────────────────────────────
// "BÖLÜM N" / "KISIM N" / "CHAPTER N" gibi YALNIZCA numaralı bölüm İŞARETİ
// (kendi başına, başlıksız). Bunlar bir sonraki başlığın ÜSTÜNE küçük bir
// "kicker" olarak biner → bölüm tek temiz sayfada açılır, ayrı boş sayfa harcamaz.
const CHAPTER_MARKER = /^(bölüm|bolum|kısım|kisim|chapter|part)\s+([ivxlcdm]+|\d+)\s*[.\-–—:]?\s*$/i;
export function isChapterMarker(text: string): boolean {
  return CHAPTER_MARKER.test(text.trim());
}

// Alt-bölüm sezgisi: numaralı/sıralı küçük başlıklar — "(1) ...", "1. ...",
// "1) ...", "EGZERSİZ I", "ADIM 2" vb. Bunlar AYRI SAYFA AÇMAZ; akış içinde
// kalın ara başlık (level 2) olarak dizilir. Büyük-harf olsalar bile.
const SUBSECTION_PREFIX = /^(\(\s*\d+\s*\)|\d+\s*[.)])\s+/;
const SUBSECTION_KEYWORD = /^(egzersiz|egzersi̇z|alıştırma|alistirma|exercise|adım|adim|aşama|asama|step)\b/i;
export function looksLikeSubsection(text: string): boolean {
  const t = text.trim();
  return SUBSECTION_PREFIX.test(t) || SUBSECTION_KEYWORD.test(t);
}

// "ARKA KAPAK YAZISI" vb. — arka kapağa ait tanıtım metni iç sayfaya sızmış.
// Bu başlık ve SONRASI iç sayfadan atılır (içeriğin sonu sayılır).
const BACK_COVER_HEADING = /^arka\s*kapak/i;
export function isBackCoverHeading(text: string): boolean {
  return BACK_COVER_HEADING.test(text.trim());
}

const plainOf = (runs: Run[]): string => runs.map((r) => r.text).join("").trim();

// Satır-içi **kalın** / *italik* / _italik_ → Run[].
export function inlineRuns(text: string): Run[] {
  const runs: Run[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false, italic: false });
    if (m[2] !== undefined || m[3] !== undefined) {
      runs.push({ text: (m[2] ?? m[3])!, bold: true, italic: false });
    } else {
      runs.push({ text: (m[4] ?? m[5])!, bold: false, italic: true });
    }
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false, italic: false });
  return runs.filter((r) => r.text.length > 0);
}

// Canvas düzenlemesinde eski biçimi (kalın/italik) düzenlenmiş yeni düz metne
// KONUM eşlemesiyle taşır. Markdown ayrıştırmaz. Kullanıcı bir yeri değiştirse
// bile dokunmadığı kısımların biçimi korunur (örn. baştaki noktayı silmek
// paragrafın ortasındaki kalını bozmaz). Eklenen karakterler komşu biçimini alır.
export function reapplyRuns(oldRuns: Run[], newText: string): Run[] {
  type S = { bold: boolean; italic: boolean };
  const oldStyle: S[] = [];
  let oldText = "";
  for (const r of oldRuns) {
    for (let k = 0; k < r.text.length; k++) {
      oldText += r.text[k];
      oldStyle.push({ bold: r.bold, italic: r.italic });
    }
  }
  const oldLen = oldText.length;
  const newLen = newText.length;

  let p = 0; // ortak ön ek uzunluğu
  while (p < oldLen && p < newLen && oldText[p] === newText[p]) p++;
  let s = 0; // ortak son ek (ön ekle çakışmaz)
  while (s < oldLen - p && s < newLen - p && oldText[oldLen - 1 - s] === newText[newLen - 1 - s]) s++;

  const fallback: S = p > 0 ? oldStyle[p - 1] : s > 0 ? oldStyle[oldLen - s] : { bold: false, italic: false };
  const styleAt = (i: number): S => {
    if (i < p) return oldStyle[i];
    if (i >= newLen - s) return oldStyle[oldLen - (newLen - i)];
    return fallback;
  };

  const runs: Run[] = [];
  for (let i = 0; i < newLen; i++) {
    const st = styleAt(i);
    const prev = runs[runs.length - 1];
    if (prev && prev.bold === st.bold && prev.italic === st.italic) prev.text += newText[i];
    else runs.push({ text: newText[i], bold: st.bold, italic: st.italic });
  }
  return runs;
}

// Ham markdown metni bloklara ayırır (manuel giriş yolu).
export function parseBlocks(raw: string, detectHeadings: boolean): Block[] {
  // Bozuk kaynak onarımı: noktalamadan sonra boşluksuz birleşmiş kelimeleri ayır.
  // Bu boşluksuz birleşmeler tek DEV/BÖLÜNEMEZ parça oluşturup yaslamada (Knuth-
  // Plass) çılgın boşluklara yol açıyordu. lookbehind/lookahead → harfler tüketilmez,
  // ardışık birleşmeler de düzelir. Açılış tırnakları (" ' « — U+201C/2018/00AB);
  // KAPANIŞ tırnağı (") kasıtlı dışarıda (öncesine boşluk konmamalı).
  const OQ = "\\u201C\\u2018\\u00AB"; // açılış tırnakları
  const normalized = raw
    .replace(/\r\n?/g, "\n")
    // .!?… + BÜYÜK harf / açılış tırnağı. Küçük-harf öncesi → "3.5"/"T.C."/"v.b." korunur.
    .replace(new RegExp(`(?<=\\p{Ll})([.!?…])(?=[\\p{Lu}${OQ}])`, "gu"), "$1 ")
    // : + BÜYÜK harf / açılış tırnağı ("geliyordu:"Beni", "yatardık:Annem").
    // Saat "10:30"/"http:" (rakam/işaret) korunur.
    .replace(new RegExp(`(?<=\\p{Ll})(:)(?=[\\p{Lu}${OQ}])`, "gu"), "$1 ")
    // , ; iki harf arası ya da harf + açılış tırnağı ("kaçıyorsun,saklanıyorsun").
    // Ondalık "3,5" (rakam) korunur.
    .replace(new RegExp(`(?<=\\p{L})([,;])(?=[\\p{L}${OQ}])`, "gu"), "$1 ");
  const chunks = normalized.split(/\n{2,}/);
  const blocks: Block[] = [];

  for (const chunk of chunks) {
    const rawLines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) continue;
    const first = rawLines[0];

    if (first.startsWith(">")) {
      const text = rawLines.map((l) => l.replace(/^>\s?/, "")).join(" ");
      blocks.push({ type: "blockquote", runs: inlineRuns(text) });
      continue;
    }

    if (detectHeadings) {
      const lvl = headingLevel(first);
      if (lvl) {
        blocks.push({ type: "heading", level: lvl, runs: inlineRuns(first.replace(/^#{1,4}\s*/, "").trim()) });
        const rest = rawLines.slice(1).join(" ");
        if (rest) blocks.push({ type: "paragraph", runs: inlineRuns(rest) });
        continue;
      }
      if (looksLikeHeading(first)) {
        // Çok satırlı başlık: ardışık başlık-benzeri satırları tek bölüm
        // başlığında birleştir (örn. "BÖLÜM III" / "EGZOTERİK NEFES" /
        // "TEORİSİ" → tek ana bölüm). Aksi halde başlık paragraf sanılır ve
        // bölüm yeni (tek) sayfadan başlamaz.
        let i = 1;
        while (i < rawLines.length && looksLikeHeading(rawLines[i])) i++;
        const headingText = rawLines.slice(0, i).join(" ");
        if (isClosingWord(headingText)) {
          // Kapanış vinyeti: ortalı, gövde puntosunda; bölüm değil (TOC'a girmez).
          blocks.push({ type: "paragraph", runs: inlineRuns(headingText), align: "center" });
        } else {
          // Numaralı/sıralı küçük başlıklar (EGZERSİZ I, "(1) ...") AYRI SAYFA
          // AÇMAZ → level 2 (akış içinde kalın ara başlık). Diğerleri tentatif
          // ana bölüm (level 1); kesin hiyerarşi restructureHeadings'te belirlenir.
          const lvl = looksLikeSubsection(headingText) ? 2 : 1;
          blocks.push({ type: "heading", level: lvl, runs: inlineRuns(headingText) });
        }
        const rest = rawLines.slice(i).join(" ");
        if (rest) blocks.push({ type: "paragraph", runs: inlineRuns(rest) });
        continue;
      }
      // Kalın + kısa + tek satır → ara başlık (subhead).
      if (rawLines.length === 1) {
        const sruns = inlineRuns(first);
        if (looksLikeSubhead(sruns)) {
          blocks.push({ type: "heading", level: 2, runs: sruns, align: "center", subhead: true });
          continue;
        }
      }
    }

    blocks.push({ type: "paragraph", runs: inlineRuns(rawLines.join(" ")) });
  }

  return restructureHeadings(blocks);
}

// Başlık hiyerarşisini netleştirir:
//  1) "ARKA KAPAK YAZISI" başlığı ve SONRASINI at (arka kapağa ait, iç sayfada değil).
//  2) "BÖLÜM N" işaretlerini bir SONRAKİ başlığın "kicker"ına çevir → bölüm tek
//     temiz sayfada açılır (üstte küçük "BÖLÜM I", altında büyük başlık); ayrı
//     boş "BÖLÜM N" sayfası + arkasındaki boş sayfa harcanmaz.
//  3) Bölüm işareti KULLANAN kitaplarda, işaret almamış (kicker'sız) ana-bölüm
//     başlıklarını alt-bölüme (level 2 — akış içi kalın başlık, yeni sayfa açmaz)
//     indir. İşaretsiz kitaplarda hiyerarşi DEĞİŞMEZ (geriye dönük uyum).
export function restructureHeadings(input: Block[]): Block[] {
  // 1) Arka kapak metnini kes.
  const bcIdx = input.findIndex(
    (b) => b.type === "heading" && isBackCoverHeading(plainOf(b.runs)),
  );
  const blocks = bcIdx >= 0 ? input.slice(0, bcIdx) : input;

  const hasMarkers = blocks.some(
    (b) => b.type === "heading" && isChapterMarker(plainOf(b.runs)),
  );
  if (!hasMarkers) return blocks;

  // 2) İşaretleri sonraki başlığa kicker olarak bağla.
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "heading" && isChapterMarker(plainOf(b.runs))) {
      const next = blocks[i + 1];
      if (next && next.type === "heading") {
        next.kicker = plainOf(b.runs);
        next.level = 1;
        next.subhead = false;
        continue; // işaret bloğunu at (kicker'a taşındı)
      }
      // Sonraki blok başlık değilse işareti olduğu gibi bırak.
    }
    out.push(b);
  }

  // 3) İşaret almamış ana-bölüm başlıklarını alt-bölüme indir.
  for (const b of out) {
    if (
      b.type === "heading" &&
      b.level === 1 &&
      !b.kicker &&
      !isChapterMarker(plainOf(b.runs))
    ) {
      b.level = 2;
    }
  }
  return out;
}

// ── Ölçüm yardımcıları ─────────────────────────────────────────────────────
function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

function fontStr(weight: number, italic: boolean, sizePx: number, family: string): string {
  return `${italic ? "italic " : ""}${weight} ${sizePx}px "${family}", Georgia, serif`;
}

function autoLeadingPx(sizePt: number, leadingPt: number, dpi: number): number {
  return leadingPt > 0 ? ptToPx(leadingPt, dpi) : ptToPx(sizePt, dpi) * 1.2;
}

type Tok = { text: string; bold: boolean; italic: boolean; spaceBefore: boolean };

// Run'ları sözcüklere böler. Her sözcük, ORİJİNAL metinde önünde boşluk olup
// olmadığını (spaceBefore) taşır. Böylece biçim (italik/kalın) sınırında bölünen
// ama bitişik olan parçalar araya YANLIŞ boşluk almaz: italik "ızdıraptır" +
// normal "." → "ızdıraptır." (boşluksuz). Eskiden her parça boşlukla birleşiyor,
// noktalama öncesi hatalı boşluk ("ızdıraptır .") çıkıyordu.
function tokenize(runs: Run[]): Tok[] {
  const toks: Tok[] = [];
  let openTok: Tok | null = null; // hâlâ eklenebilen (bitişik + aynı stil) sözcük
  let pendingSpace = false; // son karakterden bu yana boşluk görüldü mü
  for (const r of runs) {
    for (const ch of r.text) {
      if (/\s/.test(ch)) {
        pendingSpace = true;
        openTok = null; // sözcük kapandı
        continue;
      }
      if (openTok && !pendingSpace && openTok.bold === r.bold && openTok.italic === r.italic) {
        openTok.text += ch;
      } else {
        openTok = { text: ch, bold: r.bold, italic: r.italic, spaceBefore: pendingSpace && toks.length > 0 };
        toks.push(openTok);
        pendingSpace = false;
      }
    }
  }
  return toks;
}

// Stillenmiş run'ları satırlara böler; her satır Segment[] (komşu aynı stiller
// birleşir, farklı stil segmentleri başına boşluk alır).
function wrapRuns(
  ctx: CanvasRenderingContext2D,
  runs: Run[],
  baseWeight: number,
  baseItalic: boolean,
  sizePx: number,
  family: string,
  firstWidth: number,
  restWidth: number,
  hyphenate = false,
  // Drop cap: ilk `narrowLines` satır, baş harfe yer açmak için `narrowWidth`
  // kadar dar olur; sonraki satırlar tam genişliğe döner.
  narrowWidth?: number,
  narrowLines = 0,
): Segment[][] {
  const toks = tokenize(runs);
  if (toks.length === 0) return [];
  const fontFor = (t: Tok) => fontStr(t.bold ? 700 : baseWeight, t.italic || baseItalic, sizePx, family);
  ctx.font = fontStr(baseWeight, baseItalic, sizePx, family);
  const spaceWidth = ctx.measureText(" ").width;

  const lines: Segment[][] = [];
  let line: Segment[] = [];
  let width = 0;
  let lineIndex = 0;
  const maxW = () => {
    if (narrowWidth !== undefined && narrowLines > 0 && lineIndex < narrowLines) return narrowWidth;
    return lineIndex === 0 ? firstWidth : restWidth;
  };

  // Bir kelime parçasını (boşluksuz) satıra ekler; komşu aynı stil birleşir.
  const pushPiece = (text: string, bold: boolean, italic: boolean, leadingSpace: boolean) => {
    const last = line[line.length - 1];
    if (last && last.bold === bold && last.italic === italic) last.text += (leadingSpace ? " " : "") + text;
    else line.push({ text: (leadingSpace ? " " : "") + text, bold, italic });
  };
  const endLine = () => {
    lines.push(line);
    line = [];
    width = 0;
    lineIndex++;
  };

  // İşlem kuyruğu: tireleme bir kelimenin kalanını yeniden işleme sokabilir.
  const queue: Tok[] = toks.slice();
  let qi = 0;
  while (qi < queue.length) {
    const t = queue[qi];
    ctx.font = fontFor(t);
    const wWidth = ctx.measureText(t.text).width;
    const hasContent = line.length > 0;
    // Boşluk yalnızca orijinalde önünde boşluk olan sözcükten önce konur; bitişik
    // noktalama/parçalar (spaceBefore=false) boşluksuz birleşir.
    const wantSpace = hasContent && t.spaceBefore;
    const sp = wantSpace ? spaceWidth : 0;

    // Sığıyor: olduğu gibi ekle.
    if (width + sp + wWidth <= maxW()) {
      pushPiece(t.text, t.bold, t.italic, wantSpace);
      width += sp + wWidth;
      qi++;
      continue;
    }

    // Sığmıyor: önce hece sınırından bölmeyi dene.
    if (hyphenate) {
      const hyphenW = ctx.measureText("-").width;
      const avail = maxW() - width - sp - hyphenW; // ön ek için kalan genişlik
      let bestCut = 0;
      if (avail > 0) {
        for (const p of hyphenPoints(t.text)) {
          if (ctx.measureText(t.text.slice(0, p)).width <= avail) bestCut = p;
          else break;
        }
      }
      if (bestCut > 0) {
        pushPiece(t.text.slice(0, bestCut) + "-", t.bold, t.italic, wantSpace);
        endLine();
        // Kalan parça yeni satırın başında; önünde boşluk olmaz.
        queue[qi] = { text: t.text.slice(bestCut), bold: t.bold, italic: t.italic, spaceBefore: false };
        continue; // kalanı yeni satırda (gerekirse tekrar bölünerek) işle
      }
    }

    // Hece sınırından bölünemiyor: satır boşsa SON ÇARE harf-harf böl (taşmayı
    // önle), aksi halde satırı kapat ve kelimeyi yeni satırda yeniden değerlendir.
    if (!hasContent) {
      const avail = maxW();
      const chars = [...t.text];
      let acc = 0;
      let cut = 0;
      for (let i = 0; i < chars.length; i++) {
        const cw = ctx.measureText(chars[i]).width;
        if (i > 0 && acc + cw > avail) break;
        acc += cw;
        cut = i + 1;
      }
      if (cut < chars.length) {
        // Sığan kadarını koy (tiresiz), gerisini yeni satıra bırak.
        pushPiece(chars.slice(0, cut).join(""), t.bold, t.italic, false);
        endLine();
        queue[qi] = { text: chars.slice(cut).join(""), bold: t.bold, italic: t.italic, spaceBefore: false };
        continue;
      }
      // Tek karakter bile sığmıyor (dejenere) → taşmayı kabul et, döngüyü kır.
      pushPiece(t.text, t.bold, t.italic, false);
      width += wWidth;
      qi++;
      continue;
    }
    endLine();
  }
  if (line.length) lines.push(line);
  return lines;
}

// İki yana yaslı paragraflar için profesyonel satır kırma (Knuth–Plass).
// Tüm paragrafa bakıp boşlukları en dengeli dağıtan kırılma noktalarını seçer;
// böylece dar sütunlarda açgözlü yöntemin bıraktığı çirkin geniş boşluklar
// oluşmaz. Başarısız olursa (uygun kırılma yoksa) null döner → açgözlü yönteme
// düşülür. `lineWidthFor(n)` 1 tabanlı satır no için kullanılabilir genişliği
// (px) verir (ilk satır girintisi / drop cap dar satırları burada modellenir).
type JMeta =
  | { kind: "box"; text: string; bold: boolean; italic: boolean }
  | { kind: "glue" }
  | { kind: "penalty"; hyphen: boolean };

function layoutJustified(
  ctx: CanvasRenderingContext2D,
  runs: Run[],
  baseWeight: number,
  baseItalic: boolean,
  sizePx: number,
  family: string,
  lineWidthFor: (lineNumber: number) => number,
  hyphenate: boolean,
): Segment[][] | null {
  const toks = tokenize(runs);
  if (toks.length === 0) return [];
  const fontFor = (t: Tok) => fontStr(t.bold ? 700 : baseWeight, t.italic || baseItalic, sizePx, family);

  ctx.font = fontStr(baseWeight, baseItalic, sizePx, family);
  const spaceWidth = ctx.measureText(" ").width;

  const items: KPItem[] = [];
  const meta: JMeta[] = [];
  const HYPHEN_PENALTY = 50;

  // SON ÇARE — satıra sığmayan tek parça (bölünemez upuzun kelime, URL, gözden
  // kaçmış boşluksuz birleşme) gelirse harf-harf böl → yaslamada ASLA çılgın
  // boşluk/taşma olmaz. Eşik = en dar satır genişliği. Gerçek Türkçe kelimeler
  // bu eşiğin çok altında olduğundan yalnızca patolojik parçalar bölünür.
  let maxBoxWidth = lineWidthFor(1);
  for (const ln of [2, 3, 4, 5, 6, 50]) maxBoxWidth = Math.min(maxBoxWidth, lineWidthFor(ln));
  const FORCE_BREAK_PENALTY = 200; // tireden pahalı → yalnız mecbur kalınca, tiresiz

  // Bir kutu (kelime/hece parçası) ekler; eşikten genişse harf-harf, aralara
  // GÖRÜNMEZ (tiresiz) kırılma noktası koyarak böler. ctx.font çağıran tarafça
  // ayarlanmış olmalı.
  const pushBox = (text: string, t: Tok) => {
    const w = ctx.measureText(text).width;
    if (w <= maxBoxWidth || [...text].length <= 1) {
      items.push({ type: "box", width: w });
      meta.push({ kind: "box", text, bold: t.bold, italic: t.italic });
      return;
    }
    let chunk = "";
    let chunkW = 0;
    const flush = (more: boolean) => {
      items.push({ type: "box", width: chunkW });
      meta.push({ kind: "box", text: chunk, bold: t.bold, italic: t.italic });
      if (more) {
        items.push({ type: "penalty", width: 0, penalty: FORCE_BREAK_PENALTY, flagged: false });
        meta.push({ kind: "penalty", hyphen: false });
      }
      chunk = "";
      chunkW = 0;
    };
    for (const ch of [...text]) {
      const cw = ctx.measureText(ch).width;
      if (chunk && chunkW + cw > maxBoxWidth) flush(true);
      chunk += ch;
      chunkW += cw;
    }
    if (chunk) flush(false);
  };

  const lastTi = toks.length - 1;
  toks.forEach((t, ti) => {
    const isLastTok = ti === lastTi;
    // Sözcükler arası esneyen boşluk YALNIZCA orijinalde boşluk varsa. Bitişik
    // parçalar (italik kelime + normal nokta vb.) boşluksuz, bölünmeden birleşir.
    if (ti > 0 && t.spaceBefore) {
      // ÖKSÜZ SON SATIR (runt) ÖNLEME: son kelimenin ÖNÜNDEKİ boşluğu kırılamaz
      // yap (INFINITY ceza → bu boşlukta satır kırılamaz) → son kelime tek başına
      // alt satıra düşemez, önceki kelimeyle birlikte kalır. Yazarın gözüne batan
      // "tek kelime ortada" kusurunu kökten kaldırır.
      if (isLastTok) {
        items.push({ type: "penalty", width: 0, penalty: INFINITY, flagged: false });
        meta.push({ kind: "penalty", hyphen: false });
      }
      // stretch = 1.0·boşluk: KP'ye satırı tireleMEden sığdırma payı verir.
      // (0.5 idi → boşluk azdı, satırlar sığmak için MECBUREN tireleniyordu;
      // ölçümle dar kolonda tire-merdivenini ~4 kat azalttığı doğrulandı.)
      items.push({ type: "glue", width: spaceWidth, stretch: spaceWidth, shrink: spaceWidth * 0.33 });
      meta.push({ kind: "glue" });
    }
    ctx.font = fontFor(t);
    // Son kelimeyi heceleme → kırpılmış parçanın (örn. "tık.") tek başına son
    // satırda kalmasını da engelle.
    const pts = hyphenate && !isLastTok ? hyphenPoints(t.text) : [];
    if (pts.length === 0) {
      pushBox(t.text, t);
    } else {
      const hyphenW = ctx.measureText("-").width;
      const bounds = [...pts, t.text.length];
      let prev = 0;
      for (let i = 0; i < bounds.length; i++) {
        const frag = t.text.slice(prev, bounds[i]);
        pushBox(frag, t);
        if (i < bounds.length - 1) {
          items.push({ type: "penalty", width: hyphenW, penalty: HYPHEN_PENALTY, flagged: true });
          meta.push({ kind: "penalty", hyphen: true });
        }
        prev = bounds[i];
      }
    }
  });

  // Paragraf sonu: sonsuz esneyen tutkal (son satır sola yaslı/serbest kalsın)
  // + zorunlu kırılma.
  items.push({ type: "glue", width: 0, stretch: 100000, shrink: 0 });
  meta.push({ kind: "glue" });
  items.push({ type: "penalty", width: 0, penalty: -10000, flagged: false });
  meta.push({ kind: "penalty", hyphen: false });

  // Kademeli tolerans: önce EN SIKI dağılımı dene (boşluklar az esnesin); o
  // tolerans uygun bir kırılma bulamazsa kademe kademe gevşet. İnce kademeler +
  // düşük tavan (6) → "bir sıkışık nokta yüzünden tüm paragrafı 10'a açma"
  // davranışı azalır, en kötü satır sınırlanır. stretch = 1.0·boşluk olduğundan
  // tolerans 1 ≈ en çok 2× boşluk.
  // flaggedPenalty = 3e6: ardışık tireli satır cezası. Demerit'ler badness'ın
  // KARESİ (~1e6+) olduğundan eski 100 değeri etkisizdi; bu ölçekte ceza ancak
  // ~milyon mertebesinde "ısırıyor" → tire-merdivenleri kırılır.
  let breaks: number[] | null = null;
  for (const tolerance of [1, 2, 3, 4.5, 6]) {
    breaks = knuthPlass(items, lineWidthFor, { tolerance, flaggedPenalty: 3_000_000 });
    if (breaks && breaks.length >= 2) break;
  }
  if (!breaks || breaks.length < 2) return null;

  const pushPiece = (segs: Segment[], text: string, bold: boolean, italic: boolean, space: boolean) => {
    const last = segs[segs.length - 1];
    const chunk = (space && segs.length > 0 ? " " : "") + text;
    if (last && last.bold === bold && last.italic === italic) last.text += chunk;
    else segs.push({ text: chunk, bold, italic });
  };

  const lines: Segment[][] = [];
  for (let k = 0; k < breaks.length - 1; k++) {
    const from = k === 0 ? 0 : breaks[k] + 1; // önceki kırılma öğesini atla
    const to = breaks[k + 1];
    const segs: Segment[] = [];
    let pendingSpace = false;
    for (let i = from; i < to; i++) {
      const m = meta[i];
      if (m.kind === "glue") pendingSpace = true;
      else if (m.kind === "box") {
        pushPiece(segs, m.text, m.bold, m.italic, pendingSpace);
        pendingSpace = false;
      }
      // satır ortasındaki seçilmemiş tireleme cezaları yok sayılır (parçalar
      // boşluksuz birleşir)
    }
    // Satır tireyle kırıldıysa görünür tire ekle.
    const bm = meta[to];
    if (bm && bm.kind === "penalty" && bm.hyphen && segs.length > 0) {
      segs[segs.length - 1].text += "-";
    }
    if (segs.length > 0) lines.push(segs);
  }

  // ── Son satır taşma düzeltmesi ──────────────────────────────────────────
  // Son satır SOLA yaslı çizilir → boşlukları DARALTILMAZ. KP ise boşlukların
  // daralabileceğini (shrink) varsayarak son satıra, doğal genişlikte aslında
  // sığmayan fazladan bir sözcük koymuş olabilir; o sözcük marjı taşar. Son
  // satır doğal genişlikte kutuya sığana dek sondaki sözcüğü alt satıra indir.
  const segWidth = (segs: Segment[]): number => {
    let w = 0;
    for (const s of segs) {
      ctx.font = fontStr(s.bold ? 700 : baseWeight, s.italic || baseItalic, sizePx, family);
      w += ctx.measureText(s.text).width;
    }
    return w;
  };
  let guard = 0;
  while (lines.length > 0 && guard++ < 200) {
    const last = lines[lines.length - 1];
    const limit = lineWidthFor(lines.length); // 1 tabanlı satır no
    if (segWidth(last) <= limit + 0.5) break;
    const seg = last[last.length - 1];
    const sp = seg.text.trimEnd().lastIndexOf(" ");
    let moved: Segment | null = null;
    if (sp >= 0) {
      // Segment içinde boşluk: son sözcüğü ayır.
      const head = seg.text.slice(0, sp);
      const word = seg.text.slice(sp + 1);
      if (head.trim() === "") break; // ayrılamıyor
      seg.text = head;
      moved = { text: word, bold: seg.bold, italic: seg.italic };
    } else if (last.length >= 2 && /^\s/.test(seg.text)) {
      // Segment tek sözcük ve önünde boşluk var: tamamını taşı.
      moved = { text: seg.text.replace(/^\s+/, ""), bold: seg.bold, italic: seg.italic };
      last.pop();
    } else {
      break; // bitişik parça (aynı sözcük) ya da tek sözcüklük satır → taşmayı kabul et
    }
    lines.push([moved]);
  }

  return lines.length > 0 ? lines : null;
}

// ── Sayfalama ──────────────────────────────────────────────────────────────
export type PaginateInput = {
  meta: BookMeta;
  blocks: Block[];
  contentWidthMm: number;
  contentHeightMm: number;
  settings: LayoutSettings;
  ctx: CanvasRenderingContext2D;
  dpi: number;
  // İçindekiler başlık geçersiz kılmaları: bölüm sırasına (0 tabanlı) göre, o
  // bölümün İÇİNDEKİLER'de görünecek metni. Boş/tanımsız → bölümün kendi başlığı.
  // Sayfa numaraları her zaman otomatik hesaplanır (dizgiyle tutarlı kalsın diye).
  tocOverrides?: Record<number, string>;
};

export function paginate(input: PaginateInput): Page[] {
  const { contentWidthMm, contentHeightMm, settings, ctx, dpi } = input;
  // Akıllı tırnak: tüm gövde/başlık metinlerini tipografik tırnağa çevir (düz
  // " ' → " " ' '). Tek noktadan geçtiği için tüm kitabı kapsar; düzenlenebilir
  // kaynak metne dokunmaz (yalnızca dizgi çıktısı eğri tırnak gösterir).
  const blocks = smartQuoteBlocks(input.blocks);
  // Üretim öncesi yer-tutucu temizliği ("Un-named" → boş) + akıllı tırnak.
  const meta: BookMeta = {
    title: smartQuoteText(cleanMetaValue(input.meta.title)),
    author: smartQuoteText(cleanMetaValue(input.meta.author)),
    bio: smartQuoteText(input.meta.bio),
  };

  const contentWidthPx = mmToPx(contentWidthMm, dpi);
  const contentHeightPx = mmToPx(contentHeightMm, dpi);
  const blockIndentPx = mmToPx(KDY_RULES.blockquoteIndentMm, dpi);

  const chapters = blocks.filter(
    (b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.level === 1,
  );

  // İçindekiler sayfa sayısı (bölüm sayısından).
  const tocEntryLeadPx = autoLeadingPx(KDY_TOC.sizePt, 0, dpi);
  const tocHeadLeadPx = autoLeadingPx(KDY_TOC_HEADING.sizePt, 0, dpi);
  const tocEntryHeightPx = tocEntryLeadPx + mmToPx(KDY_TOC.spaceAfterMm, dpi);
  const tocHeadingHeightPx = tocHeadLeadPx + mmToPx(KDY_TOC_HEADING.spaceAfterMm, dpi);

  const wantFront = settings.showFrontMatter;
  const hasBio = wantFront && meta.bio.trim().length > 0;
  const hasToc = wantFront && chapters.length >= 1;

  let tocPageCount = 0;
  if (hasToc) {
    const firstPage = Math.max(1, Math.floor((contentHeightPx - tocHeadingHeightPx) / tocEntryHeightPx));
    const restPage = Math.max(1, Math.floor(contentHeightPx / tocEntryHeightPx));
    let remaining = chapters.length - firstPage;
    tocPageCount = 1;
    while (remaining > 0) {
      tocPageCount++;
      remaining -= restPage;
    }
  }

  const titlePages = wantFront && meta.title.trim().length > 0 ? 1 : 0;
  const bioPages = hasBio ? 1 : 0;
  const frontMatterCount = titlePages + bioPages + tocPageCount;

  // ── Gövde sayfalama ────────────────────────────────────────────────────
  const bodyPages: Page[] = [];
  let counter = frontMatterCount;
  let current: Page | null = null;
  let y = 0;
  let pendingGapPx = 0;
  let currentBlockIndex = -1; // addLine bunu satıra yazar (canvas düzenleme bağı)
  let currentChapterTitle = ""; // recto koşu başlığı: o an işlenen bölümün adı
  const chapterPageOf = new Map<number, number>();

  // ── Baseline grid ──────────────────────────────────────────────────────
  // Tek bir taban-çizgisi ızgarası: tüm gövde satırlarının kutu başlangıcı,
  // gövde satır-aralığının (leading) tam katına hizalanır. Sayfa üstü = grid
  // sıfırı. Böylece gövde satırları her sayfada aynı yüksekliklere oturur,
  // karşılıklı sayfaların satırları çakışır ve sayfa alt kenarları eşitlenir.
  // Başlık/bölüm boşlukları ızgara-dışı yükseklik kaplasa bile, hemen sonraki
  // gövde satırı tekrar ızgaraya çekilir (snapBodyGap).
  const gridPx = autoLeadingPx(settings.bodySizePt, settings.leadingPt, dpi);
  // Geçerli y konumundan, bir sonraki gövde satırı kutusunu ızgaraya hizalamak
  // için gereken (rawGap'ten küçük olmayan) boşluğu döndürür.
  const snapBodyGap = (curY: number, rawGap: number): number => {
    const snapped = Math.ceil((curY + rawGap) / gridPx - 1e-6) * gridPx;
    return snapped - curY;
  };

  // Koşu başlığı kaynağını çöz: kitap adı / yazar / o anki bölüm adı.
  const resolveHead = (which: "title" | "author" | "chapter"): string => {
    if (which === "chapter") return currentChapterTitle;
    if (which === "author") return meta.author;
    return meta.title;
  };
  const runningHeadFor = (pageNo: number): string => {
    if (!settings.showRunningHeads) return "";
    const isRight = pageNo % 2 === 1;
    const which = isRight ? KDY_RULES.runningHeads.recto : KDY_RULES.runningHeads.verso;
    const text = resolveHead(which).trim();
    // Uzun bölüm adı kenar boşluğunu taşırmasın.
    return text.length > 60 ? text.slice(0, 59).trimEnd() + "…" : text;
  };

  const startPage = (role: PageRole, isChapterOpening = false): Page => {
    counter++;
    const page: Page = {
      number: counter,
      showNumber: settings.showPageNumbers && role === "body",
      role,
      isRight: counter % 2 === 1,
      // Bölüm açılış sayfasında (ve boş/ön sayfalarda) koşu başlığı çizilmez.
      runningHead: role === "body" && !isChapterOpening ? runningHeadFor(counter) : "",
      lines: [],
    };
    bodyPages.push(page);
    current = page;
    y = 0;
    return page;
  };

  const addGap = (px: number) => {
    pendingGapPx += px;
  };

  const addLine = (line: Line, heightPx: number) => {
    if (!current) startPage("body");
    let gap = current!.lines.length === 0 ? 0 : pendingGapPx;
    // Gövde satırları taban-çizgisi ızgarasına hizalanır (sayfa başı hariç).
    // Başlık satırları kendi doğal aralığını korur (ızgaraya zorlanmaz).
    if (line.kind === "body" && current!.lines.length > 0) {
      gap = snapBodyGap(y, gap);
    }
    if (current!.lines.length > 0 && y + gap + heightPx > contentHeightPx + 1e-6) {
      startPage("body");
      gap = 0;
    }
    line.spaceBeforeMm = pxToMm(gap, dpi);
    line.heightMm = pxToMm(heightPx, dpi);
    line.blockIndex = currentBlockIndex;
    y += gap + heightPx;
    pendingGapPx = 0;
    current!.lines.push(line);
  };

  const startChapter = () => {
    current = null;
    pendingGapPx = 0;
    if (settings.chapterStartsOnRightPage && (counter + 1) % 2 === 0) {
      startPage("blank");
      current = null;
    }
    startPage("body", true); // bölüm açılış sayfası: koşu başlığı yok
  };

  // Dul/yetim kontrolü: bir paragrafın tek satırı bir sayfanın altında (orphan)
  // ya da üstünde (widow) yalnız kalmasın. Bloğun tüm satırlarını birlikte
  // değerlendirir; gerekirse bloğu ya da son iki satırı sonraki sayfaya taşır.
  const MIN_KEEP = 2;
  const addBlockLines = (entries: { line: Line; heightPx: number }[]) => {
    if (entries.length === 0) return;
    if (!current) startPage("body");

    // Bloğun tamamını (gerekirse yeni sayfada) sırayla yerleştir.
    const placeAll = (forceNewPage: boolean) => {
      if (forceNewPage && current!.lines.length > 0) {
        startPage("body");
        pendingGapPx = 0;
      }
      for (const e of entries) addLine(e.line, e.heightPx);
    };

    // Izgara hizalaması addLine ile aynı olmalı ki sığma/fit hesabı tutarlı kalsın.
    let gap0 = current!.lines.length === 0 ? 0 : pendingGapPx;
    if (current!.lines.length > 0 && entries[0].line.kind === "body") {
      gap0 = snapBodyGap(y, gap0);
    }

    // 1–2 satırlık kısa blok: hiç bölme; sığmıyorsa tamamını sonraki sayfaya taşı.
    if (entries.length <= MIN_KEEP) {
      const need = entries.reduce((s, e) => s + e.heightPx, 0);
      placeAll(current!.lines.length > 0 && y + gap0 + need > contentHeightPx);
      return;
    }

    // Bu sayfaya kaç satır sığıyor?
    const avail = contentHeightPx - y - gap0;
    let fit = 0;
    let used = 0;
    for (const e of entries) {
      if (used + e.heightPx > avail) break;
      used += e.heightPx;
      fit++;
    }

    // Hepsi sığıyor: bölme yok.
    if (fit >= entries.length) {
      placeAll(false);
      return;
    }

    // Orphan: bu sayfaya en az MIN_KEEP satır sığmıyorsa bloğun tamamını taşı.
    if (fit < MIN_KEEP) {
      placeAll(true);
      return;
    }

    // Widow: sonraki sayfaya MIN_KEEP'ten az satır kalacaksa bu sayfadan geri çek.
    let keep = fit;
    if (entries.length - keep < MIN_KEEP) keep = entries.length - MIN_KEEP;

    // Geri çekme sonrası bu sayfada MIN_KEEP'ten az kalıyorsa (örn. 3 satırlık
    // blok, 2 sığıyor) hem dul hem yetim kaçınılmaz olur → bloğun tamamını taşı.
    if (keep < MIN_KEEP) {
      placeAll(true);
      return;
    }

    for (let i = 0; i < keep; i++) addLine(entries[i].line, entries[i].heightPx);
    startPage("body");
    pendingGapPx = 0;
    for (let i = keep; i < entries.length; i++) addLine(entries[i].line, entries[i].heightPx);
  };

  let chapterIndex = -1;
  let pendingDropCap = false; // bir sonraki paragraf bölüm başı drop cap alacak

  for (const block of blocks) {
    currentBlockIndex++;
    if (block.type === "blank") {
      addGap(autoLeadingPx(settings.bodySizePt, settings.leadingPt, dpi));
      continue;
    }

    if (block.type === "heading") {
      const isSub = block.subhead === true;
      const style = KDY_HEADINGS[block.level];
      // Ara başlık: gövde+2 pt, kalın, ortalı, gövde fontu. Ana bölüm/alt başlık:
      // KDY stili. (Ara başlık bölüm değildir → yeni sayfa açmaz, TOC'a girmez.)
      const font = block.fontFamily ?? (isSub ? settings.bodyFontFamily : settings.headingFontFamily);
      const headSizePt = block.sizePt ?? (isSub ? settings.bodySizePt + 2 : style.sizePt);
      const weight = isSub ? 700 : style.weight;
      const sizePx = ptToPx(headSizePt, dpi);
      const headLeadPx = autoLeadingPx(headSizePt, 0, dpi);
      const bodyLeadPx = autoLeadingPx(settings.bodySizePt, settings.leadingPt, dpi);
      const align: ParaAlign = block.align ?? (isSub ? "center" : style.align);

      if (block.level === 1 && !isSub) {
        // recto koşu başlığı bu bölümün adını göstersin (açılıştan sonraki
        // sağ sayfalarda). Açılış sayfasında zaten koşu başlığı çizilmez.
        currentChapterTitle = block.runs.map((r) => r.text).join("").trim();
        startChapter();
        chapterIndex++;
        chapterPageOf.set(chapterIndex, counter);
        addGap(contentHeightPx * (settings.chapterTopRatio ?? 0.12));
        // "BÖLÜM N" kicker'ı: başlığın ÜSTÜNDE küçük, ortalı etiket (aynı açılış
        // sayfasında). Tema "kicker gizle" derse atlanır.
        if (block.kicker && (settings.showChapterKicker ?? true)) {
          const kSizePt = Math.max(settings.bodySizePt, 12);
          const kSizePx = ptToPx(kSizePt, dpi);
          const kLeadPx = autoLeadingPx(kSizePt, 0, dpi);
          const kRuns: Run[] = [
            { text: block.kicker.toLocaleUpperCase("tr"), bold: true, italic: false },
          ];
          wrapRuns(ctx, kRuns, 700, false, kSizePx, settings.headingFontFamily, contentWidthPx, contentWidthPx).forEach(
            (segments) =>
              addLine(
                {
                  segments,
                  kind: "heading",
                  sizePt: kSizePt,
                  font: settings.headingFontFamily,
                  weight: 700,
                  italic: false,
                  align: "center",
                  indentMm: 0,
                  blockIndentMm: 0,
                  justify: false,
                  spaceBeforeMm: 0,
                  heightMm: 0,
                },
                kLeadPx,
              ),
          );
          addGap(kLeadPx * 1.5); // kicker ↔ başlık arası
        }
        pendingDropCap = settings.dropCap; // bölümün ilk paragrafı drop cap alsın
      } else if (isSub) {
        addGap(bodyLeadPx * 2); // üstte ~2 satır boşluk
        pendingDropCap = false;
      } else {
        addGap(headLeadPx * 0.8);
        pendingDropCap = false;
      }

      const segLines = wrapRuns(ctx, block.runs, weight, false, sizePx, font, contentWidthPx, contentWidthPx);
      segLines.forEach((segments) =>
        addLine(
          {
            segments,
            kind: "heading",
            sizePt: headSizePt,
            font,
            weight,
            italic: false,
            align,
            indentMm: 0,
            blockIndentMm: 0,
            justify: false,
            spaceBeforeMm: 0,
            heightMm: 0,
          },
          headLeadPx,
        ),
      );
      // Bölüm açılış süsü (tema): yalnız ANA bölüm başlığının altında, ortalı ince
      // çizgi ("rule") ya da nokta dizisi ("dots"). Metin tabanlı → hem önizleme
      // hem PDF'te aynı görünür.
      if (block.level === 1 && !isSub) {
        const orn = settings.chapterOrnament ?? "none";
        if (orn !== "none") {
          const ornText = orn === "rule" ? "———" : "• • •";
          const ornSizePt = Math.max(settings.bodySizePt, 11);
          const ornSizePx = ptToPx(ornSizePt, dpi);
          const ornLeadPx = autoLeadingPx(ornSizePt, 0, dpi);
          addGap(ornLeadPx * 0.7); // başlık ↔ süs arası
          wrapRuns(
            ctx,
            [{ text: ornText, bold: false, italic: false }],
            400, false, ornSizePx, settings.headingFontFamily, contentWidthPx, contentWidthPx,
          ).forEach((segments) =>
            addLine(
              {
                segments,
                kind: "heading",
                sizePt: ornSizePt,
                font: settings.headingFontFamily,
                weight: 400,
                italic: false,
                align: "center",
                indentMm: 0,
                blockIndentMm: 0,
                justify: false,
                spaceBeforeMm: 0,
                heightMm: 0,
              },
              ornLeadPx,
            ),
          );
        }
      }
      // Ara başlık: altta ~1 satır; diğerleri: KDY spaceAfter.
      addGap(isSub ? bodyLeadPx * 1 : mmToPx(style.spaceAfterMm, dpi) + headLeadPx * 0.4);
      continue;
    }

    if (block.type === "blockquote") {
      pendingDropCap = false;
      const bqSizePt = block.sizePt ?? settings.bodySizePt;
      const bqFont = block.fontFamily ?? settings.bodyFontFamily;
      const sizePx = ptToPx(bqSizePt, dpi);
      const leadPx = autoLeadingPx(bqSizePt, settings.leadingPt, dpi);
      const innerWidth = contentWidthPx - blockIndentPx * 2;
      const align: ParaAlign = block.align ?? (settings.align === "justify" ? "justify" : "left");
      addGap(leadPx * 0.5);
      const segLines =
        (align === "justify" && settings.lineBreak === "balanced"
          ? layoutJustified(ctx, block.runs, 400, true, sizePx, bqFont, () => innerWidth, settings.hyphenate)
          : null) ?? wrapRuns(ctx, block.runs, 400, true, sizePx, bqFont, innerWidth, innerWidth, settings.hyphenate);
      addBlockLines(
        segLines.map((segments, li) => ({
          line: {
            segments,
            kind: "body" as const,
            sizePt: bqSizePt,
            font: bqFont,
            weight: 400,
            italic: true,
            align,
            indentMm: 0,
            blockIndentMm: KDY_RULES.blockquoteIndentMm,
            justify: align === "justify" && li !== segLines.length - 1,
            spaceBeforeMm: 0,
            heightMm: 0,
          },
          heightPx: leadPx,
        })),
      );
      addGap(leadPx * 0.5);
      continue;
    }

    // Paragraf.
    const sizePt = block.sizePt ?? settings.bodySizePt;
    const paraFont = block.fontFamily ?? settings.bodyFontFamily;
    const sizePx = ptToPx(sizePt, dpi);
    const leadPx = block.sizePt ? ptToPx(sizePt, dpi) * 1.2 : autoLeadingPx(settings.bodySizePt, settings.leadingPt, dpi);
    const align: ParaAlign = block.align ?? settings.align;
    const canIndent = align === "left" || align === "justify";
    const indentMm = canIndent ? block.firstLineIndentMm ?? settings.firstLineIndentMm : 0;
    const indentPx = mmToPx(indentMm, dpi);
    const spaceBeforeMm = block.spaceBeforeMm ?? settings.paragraphSpacingMm;

    // Drop cap (bölüm başı büyük baş harf): bekleyen bayrak varsa ve paragrafın
    // ilk görünür karakteri bir harfse uygulanır. Baş harf metinden ayrılıp dev
    // bir glif olarak çizilir; ilk birkaç satır ona yer açmak için sola girintilenir.
    const wantDropCap = pendingDropCap;
    pendingDropCap = false;

    let capChar = "";
    if (wantDropCap) {
      const bodyRuns: Run[] = block.runs.map((r) => ({ ...r }));
      for (const r of bodyRuns) {
        const m = /^(\s*)(\S)([\s\S]*)$/.exec(r.text);
        if (m) {
          capChar = m[2];
          r.text = m[3];
          break;
        }
      }
      if (capChar && /^\p{L}$/u.test(capChar)) {
        const dropLines = 3;
        const leadPt = (leadPx / dpi) * 72;
        // Baş harfin büyük-harf yüksekliği ≈ ilk satırın tepesinden 3. satırın
        // taban çizgisine kadar olan mesafe; oradan em punto'ya çevrilir (~0.7).
        const capCapHeightPt = (dropLines - 1) * leadPt + 0.7 * sizePt;
        const capSizePt = capCapHeightPt / 0.7;
        const capSizePx = ptToPx(capSizePt, dpi);
        ctx.font = fontStr(400, false, capSizePx, paraFont);
        const capWidthPx = ctx.measureText(capChar).width;
        const capGapPx = capSizePx * 0.05;
        const insetPx = capWidthPx + capGapPx;
        const leftInsetMm = pxToMm(insetPx, dpi);
        const narrowWidth = contentWidthPx - insetPx;

        if (spaceBeforeMm > 0) addGap(mmToPx(spaceBeforeMm, dpi));
        const segLines =
          (align === "justify" && settings.lineBreak === "balanced"
            ? layoutJustified(ctx, bodyRuns, 400, false, sizePx, paraFont,
                (n) => (n <= dropLines ? narrowWidth : contentWidthPx), settings.hyphenate)
            : null) ??
          wrapRuns(
            ctx, bodyRuns, 400, false, sizePx, paraFont,
            contentWidthPx, contentWidthPx, settings.hyphenate, narrowWidth, dropLines,
          );
        if (segLines.length >= 2) {
          addBlockLines(
            segLines.map((segments, li) => ({
              line: {
                segments,
                kind: "body" as const,
                sizePt,
                font: paraFont,
                weight: 400,
                italic: false,
                align,
                indentMm: 0,
                blockIndentMm: 0,
                leftInsetMm: li < dropLines ? leftInsetMm : 0,
                justify: align === "justify" && li !== segLines.length - 1,
                spaceBeforeMm: 0,
                heightMm: 0,
                dropCap:
                  li === 0
                    ? { char: capChar, sizePt: capSizePt, font: paraFont, weight: 400, widthMm: pxToMm(capWidthPx, dpi) }
                    : undefined,
              },
              heightPx: leadPx,
            })),
          );
          // Baş harf 3 satır yüksekliğinde; paragraf daha KISA ise (örn. 2 satır)
          // harfin alt kısmı bir sonraki paragrafın/başlığın üstüne taşar (görsel
          // "üst üste binme"). Eksik satır kadar boşluk ekle → sonraki içerik
          // baş harfin altından başlar.
          const capOverhang = dropLines - segLines.length;
          if (capOverhang > 0) addGap(capOverhang * leadPx);
          continue; // drop cap'li paragraf yerleştirildi
        }
        // Çok kısa paragraf: drop cap'i atla, normal akışa düş.
      }
    }

    if (spaceBeforeMm > 0) addGap(mmToPx(spaceBeforeMm, dpi));
    const segLines =
      (align === "justify" && settings.lineBreak === "balanced"
        ? layoutJustified(ctx, block.runs, 400, false, sizePx, paraFont,
            (n) => (n === 1 ? contentWidthPx - indentPx : contentWidthPx), settings.hyphenate)
        : null) ??
      wrapRuns(ctx, block.runs, 400, false, sizePx, paraFont, contentWidthPx - indentPx, contentWidthPx, settings.hyphenate);
    addBlockLines(
      segLines.map((segments, li) => ({
        line: {
          segments,
          kind: "body" as const,
          sizePt,
          font: paraFont,
          weight: 400,
          italic: false,
          align,
          indentMm: li === 0 ? indentMm : 0,
          blockIndentMm: 0,
          justify: align === "justify" && li !== segLines.length - 1,
          spaceBeforeMm: 0,
          heightMm: 0,
        },
        heightPx: leadPx,
      })),
    );
  }

  if (bodyPages.length === 0) startPage("body");

  // ── Yalnız kalmış son satır (yetim/widow) düzeltmesi ────────────────────
  // Paragraf-içi dul/yetim kontrolü (addBlockLines) tek satırlık bir paragrafın
  // tek başına yeni sayfaya kaymasını engelleyemez (bölünemez). Burada bir gövde
  // sayfası tek bir satır içeriyorsa ve önceki sayfanın SON paragrafı bütünüyle o
  // sayfadaysa, o paragrafı TÜMÜYLE bu sayfaya indiririz — böylece yeni bir dul
  // satır oluşmaz (paragraf bölünmez). Güvenli koşullar yoksa dokunulmaz.
  const fixLonelyTrailingLines = (pgs: Page[]) => {
    for (let i = pgs.length - 1; i >= 1; i--) {
      const P = pgs[i];
      const prev = pgs[i - 1];
      if (P.role !== "body" || prev.role !== "body") continue;
      if (P.lines.length !== 1) continue; // yalnızca tek-satır yetim
      if (P.lines[0].kind === "heading") continue; // bölüm açılışı/başlık değil
      if (prev.lines.length < 2) continue;
      const lastBlk = prev.lines[prev.lines.length - 1].blockIndex;
      if (lastBlk == null) continue;
      // prev'in son paragrafının (lastBlk) prev üzerindeki ilk satır indeksi.
      let start = prev.lines.length;
      while (start > 0 && prev.lines[start - 1].blockIndex === lastBlk) start--;
      if (start < 2) continue; // taşırsak prev'de <2 satır kalır
      // Paragraf daha erken bir sayfada başladıysa taşımak onu böler → atla.
      let startedEarlier = false;
      for (let j = 0; j < i - 1 && !startedEarlier; j++) {
        if (pgs[j].lines.some((l) => l.blockIndex === lastBlk)) startedEarlier = true;
      }
      if (startedEarlier) continue;
      // Taşıma sonrası bu sayfaya sığacak mı? (taşan paragraf + mevcut satır)
      const movedLines = prev.lines.slice(start);
      const estMm =
        movedLines.reduce((s, l, idx) => s + l.heightMm + (idx === 0 ? 0 : l.spaceBeforeMm), 0) +
        P.lines.reduce((s, l) => s + l.heightMm + l.spaceBeforeMm, 0);
      if (estMm > contentHeightMm) continue;
      // Taşı: paragrafın tüm satırlarını P'nin başına al; ilk satır sayfa başı.
      const moved = prev.lines.splice(start);
      moved[0] = { ...moved[0], spaceBeforeMm: 0 };
      P.lines = [...moved, ...P.lines];
    }
  };
  fixLonelyTrailingLines(bodyPages);

  // ── Ön bilgi sayfaları ─────────────────────────────────────────────────
  const frontPages: Page[] = [];
  let frontCounter = 0;

  const newFront = (role: PageRole): Page => {
    frontCounter++;
    const page: Page = {
      number: frontCounter,
      showNumber: false,
      role,
      isRight: frontCounter % 2 === 1,
      runningHead: "",
      lines: [],
    };
    frontPages.push(page);
    return page;
  };

  if (titlePages) {
    const page = newFront("title");
    const titleLeadPx = autoLeadingPx(KDY_TITLE.sizePt, 0, dpi);
    const titleSizePx = ptToPx(KDY_TITLE.sizePt, dpi);
    // Uzun başlık tek satıra sığmaz; gövdeyle aynı sarma motoruyla çok satıra böl.
    const titleLines = wrapRuns(
      ctx,
      [{ text: meta.title, bold: false, italic: false }],
      KDY_TITLE.weight,
      false,
      titleSizePx,
      KDY_TITLE.font,
      contentWidthPx,
      contentWidthPx,
    );
    titleLines.forEach((segments, li) => {
      page.lines.push({
        segments,
        kind: "title",
        sizePt: KDY_TITLE.sizePt,
        font: KDY_TITLE.font,
        weight: KDY_TITLE.weight,
        italic: false,
        align: "center",
        indentMm: 0,
        blockIndentMm: 0,
        justify: false,
        // İlk satır dikey ortalama boşluğunu taşır; sonraki satırlar bitişik.
        spaceBeforeMm: li === 0 ? pxToMm(contentHeightPx * 0.32, dpi) : 0,
        heightMm: pxToMm(titleLeadPx, dpi),
      });
    });
    if (meta.author.trim()) {
      page.lines.push({
        segments: plainSegments(meta.author),
        kind: "author",
        sizePt: KDY_AUTHOR.sizePt,
        font: KDY_AUTHOR.font,
        weight: KDY_AUTHOR.weight,
        italic: false,
        align: "center",
        indentMm: 0,
        blockIndentMm: 0,
        justify: false,
        spaceBeforeMm: pxToMm(titleLeadPx * 0.6, dpi),
        heightMm: pxToMm(autoLeadingPx(KDY_AUTHOR.sizePt, 0, dpi), dpi),
      });
    }
  }

  if (bioPages) {
    const page = newFront("bio");
    const bioLeadPx = autoLeadingPx(KDY_BIO.sizePt, 0, dpi);
    if (meta.author.trim()) {
      page.lines.push({
        segments: plainSegments(meta.author),
        kind: "author",
        sizePt: KDY_AUTHOR.sizePt,
        font: KDY_AUTHOR.font,
        weight: KDY_AUTHOR.weight,
        italic: false,
        align: "center",
        indentMm: 0,
        blockIndentMm: 0,
        justify: false,
        spaceBeforeMm: pxToMm(contentHeightPx * 0.1, dpi),
        heightMm: pxToMm(autoLeadingPx(KDY_AUTHOR.sizePt, 0, dpi), dpi),
      });
    }
    const bioSizePx = ptToPx(KDY_BIO.sizePt, dpi);
    const bioIndentPx = mmToPx(KDY_BIO.firstLineIndentMm, dpi);
    meta.bio
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((para, pi) => {
        const segLines =
          (settings.lineBreak === "balanced"
            ? layoutJustified(ctx, inlineRuns(para), KDY_BIO.weight, false, bioSizePx, KDY_BIO.font,
                (n) => (n === 1 ? contentWidthPx - bioIndentPx : contentWidthPx), settings.hyphenate)
            : null) ??
          wrapRuns(ctx, inlineRuns(para), KDY_BIO.weight, false, bioSizePx, KDY_BIO.font, contentWidthPx - bioIndentPx, contentWidthPx, settings.hyphenate);
        segLines.forEach((segments, li) => {
          const isLast = li === segLines.length - 1;
          page.lines.push({
            segments,
            kind: "bio",
            sizePt: KDY_BIO.sizePt,
            font: KDY_BIO.font,
            weight: KDY_BIO.weight,
            italic: false,
            align: "justify",
            indentMm: li === 0 ? KDY_BIO.firstLineIndentMm : 0,
            blockIndentMm: 0,
            justify: !isLast,
            spaceBeforeMm: pi > 0 && li === 0 ? KDY_BIO.spaceAfterMm : 0,
            heightMm: pxToMm(bioLeadPx, dpi),
          });
        });
      });
  }

  if (hasToc) {
    let page = newFront("toc");
    let usedPx = 0;
    page.lines.push({
      segments: plainSegments("İÇİNDEKİLER"),
      kind: "toc-heading",
      sizePt: KDY_TOC_HEADING.sizePt,
      font: KDY_TOC_HEADING.font,
      weight: KDY_TOC_HEADING.weight,
      italic: false,
      align: "center",
      indentMm: 0,
      blockIndentMm: 0,
      justify: false,
      spaceBeforeMm: 0,
      heightMm: pxToMm(tocHeadLeadPx, dpi),
    });
    usedPx += tocHeadingHeightPx;

    // Nokta dolgulu içindekiler: başlık SOLDA, sayfa no SAĞ kenarda, arası nokta
    // (ajans/profesyonel biçim). Nokta sayısı, satırı sağ kenara dolduracak şekilde
    // ölçülerek hesaplanır (ctx ile).
    const tocSizePx = ptToPx(KDY_TOC.sizePt, dpi);
    const tocFontStr = fontStr(KDY_TOC.weight, false, tocSizePx, KDY_TOC.font);
    ctx.font = tocFontStr;
    const dotW = ctx.measureText(".").width || 1;

    chapters.forEach((ch, idx) => {
      if (usedPx + tocEntryHeightPx > contentHeightPx) {
        page = newFront("toc");
        usedPx = 0;
      }
      const pageNo = chapterPageOf.get(idx) ?? 0;
      // Kullanıcı bu bölüm için İçindekiler başlığını elle değiştirdiyse onu
      // kullan (akıllı tırnaktan geçir); yoksa bölümün kendi başlığı.
      const override = input.tocOverrides?.[idx]?.trim();
      const title = override ? smartQuoteText(override) : ch.runs.map((r) => r.text).join("");
      let text = title;
      if (pageNo > 0) {
        ctx.font = tocFontStr;
        const pageStr = String(pageNo);
        const titleW = ctx.measureText(title + " ").width;
        const pageW = ctx.measureText(" " + pageStr).width;
        const dots = Math.max(2, Math.floor((contentWidthPx - titleW - pageW) / dotW));
        text = `${title} ${".".repeat(dots)} ${pageStr}`;
      }
      page.lines.push({
        segments: plainSegments(text),
        kind: "toc-entry",
        sizePt: KDY_TOC.sizePt,
        font: KDY_TOC.font,
        weight: KDY_TOC.weight,
        italic: false,
        align: "left",
        indentMm: 0,
        blockIndentMm: 0,
        justify: false,
        spaceBeforeMm: usedPx === 0 ? 0 : KDY_TOC.spaceAfterMm,
        heightMm: pxToMm(tocEntryLeadPx, dpi),
      });
      usedPx += tocEntryHeightPx;
    });
  }

  return [...frontPages, ...bodyPages];
}

function plainSegments(text: string): Segment[] {
  return [{ text, bold: false, italic: false }];
}
