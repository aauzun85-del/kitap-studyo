// Baskıya hazır PDF dışa aktarma (KDY standardı).
// Sayfalama motorunun ürettiği Page[] modelini pdf-lib ile gerçek PDF'e çizer.
// Ölçüler mm cinsinden (çözünürlükten bağımsız), pt'ye çevrilerek konur.
//
// KDY: 130×195 trim + her kenarda 5 mm taşma (bleed). Sayfa kutusu trim+bleed
// olur; TrimBox/BleedBox işaretlenir ve istenirse köşelere kesim işaretleri
// (crop marks) çizilir. Fontlar ALTKÜME (subset) olarak gömülür — Türkçe
// karakterler dahil. Renk: siyah metin (DeviceRGB). Not: tarayıcıda üretilen
// PDF gerçek DeviceCMYK çıktı amacı taşıyamaz; bu adım sunucu tarafı bir
// dönüştürme gerektirir (bkz. KDY_PDF_SPEC.colorSpace).
//
// ── Performans optimizasyonu ─────────────────────────────────────────────────
// Her page.drawText({font}) çağrısı pdf-lib'in setOrEmbedFont() metodunu
// tetikler ve addRandomSuffix ile YENİ bir font kaydı oluşturur. 966 kelime
// = 966 farklı font alias. Bunun yerine:
//   1. PageFontRegistry: her PDFFont nesnesini sayfaya BİR KEZ kaydeder.
//   2. pushTextLine(): tüm satırı tek BT…ET bloğu içine yazar.
//   3. TJ dizisi: kerning harf çiftlerini ayrı drawText yerine TJ operatörüyle
//      (PDF gömülü kern ayarı) gerçekleştirir.
// Sonuç: sayfa başına ~30 BT/ET (eski: ~966), font alias = unique font türü sayısı.

import { PDFDocument, grayscale, type PDFFont, type PDFName,
  PDFArray, PDFHexString, PDFNumber, PDFOperator, PDFOperatorNames,
  pushGraphicsState, popGraphicsState, setFillingColor,
  beginText, endText, moveText, setFontAndSize, setWordSpacing, showText,
  type Color,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pageGeometry, type BookSize, type Margins } from "./page";
import type { Page } from "./paginate";

const PT_PER_MM = 72 / 25.4; // 2.8346
// Baskı için siyah: DeviceRGB (0,0,0) yerine DeviceGray 0 (K100 muadili).
// Ofset/dijital baskıda metin tek plaka (siyah) basılmalı; RGB siyahı bazı
// RIP'lerde 4-renk zengin siyaha (registration sorunu) çevrilebilir. DeviceGray
// 0 → "0 g" operatörü → tek kanal siyah. MUTED de gri olduğundan DeviceGray.
const BLACK: Color = grayscale(0);
const MUTED: Color = grayscale(0.4);

export type PdfExportInput = {
  pages: Page[];
  size: BookSize;
  margins: Margins;
  gutter: number;
  bleedMm: number; // KDY: 5 (içerik taşması / BleedBox)
  markOffsetMm: number; // KDY: 7.5 (kesim çizgisi → kâğıt kenarı / MediaBox)
  cropMarks: boolean;
  bodyFamily: string; // üst bilgi / sayfa numarası fontu
  kerning: boolean; // belirli harf çiftlerini birbirine yaklaştır (metrik kerning)
};

// ── Metrik kerning tablosu ──────────────────────────────────────────────────
// Gömülü font alt kümelerinde GPOS/kern tabloları yok (alt küme çıkarımı sırasında
// atılmış). Bu yüzden en göze batan harf çiftlerini (özellikle V/W/Y/T/F/P gibi
// çıkıntılı büyük harfler ve nokta/virgül) elle yaklaştırıyoruz. Değerler em'in
// kesri (negatif = daha sıkı). Yaklaşık değerlerdir; tipik serif kerningine yakın.
const KERN: Record<string, number> = {
  AV: -0.07, AW: -0.07, AY: -0.07, AT: -0.05, AC: -0.02, AG: -0.02, AO: -0.02, AQ: -0.02, AU: -0.02,
  FA: -0.06, "F.": -0.07, "F,": -0.07, Fa: -0.03, Fe: -0.03, Fi: -0.01, Fo: -0.03, Fr: -0.02, Fu: -0.02,
  LT: -0.06, LV: -0.07, LW: -0.07, LY: -0.07, "L'": -0.05,
  PA: -0.07, "P.": -0.08, "P,": -0.08, Pa: -0.03, Pe: -0.02, Po: -0.02,
  RT: -0.02, RV: -0.02, RW: -0.02, RY: -0.02,
  TA: -0.06, TO: -0.02, Ta: -0.07, Te: -0.06, Ti: -0.03, To: -0.06, Tr: -0.04, Tu: -0.05, Tw: -0.04,
  Ty: -0.04, Ts: -0.05, Tc: -0.05, "T.": -0.07, "T,": -0.07,
  VA: -0.07, Va: -0.05, Ve: -0.05, Vi: -0.02, Vo: -0.05, Vr: -0.02, Vu: -0.03, Vy: -0.02, "V.": -0.07, "V,": -0.07,
  WA: -0.06, Wa: -0.04, We: -0.04, Wi: -0.02, Wo: -0.04, Wr: -0.02, Wu: -0.03, Wy: -0.02, "W.": -0.05, "W,": -0.05,
  YA: -0.07, Ya: -0.07, Ye: -0.06, Yi: -0.03, Yo: -0.06, Yu: -0.05, Yp: -0.05, Yv: -0.04, "Y.": -0.08, "Y,": -0.08,
  "r.": -0.03, "r,": -0.03, "v.": -0.03, "v,": -0.03, "w.": -0.03, "w,": -0.03, "y.": -0.03, "y,": -0.03,
  "f.": -0.02, "P'": -0.04,
};

function kernEmBetween(a: string, b: string): number {
  return KERN[a + b] ?? 0;
}

// Bir kelimenin kerning uygulanmış genişliği (pt). Kerning kapalıysa font'un
// kendi (nominal) ölçüsünü döndürür.
function kernedWordWidth(word: string, font: PDFFont, sizePt: number, kerning: boolean): number {
  if (!kerning) return font.widthOfTextAtSize(word, sizePt);
  const chars = [...word];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    w += font.widthOfTextAtSize(chars[i], sizePt);
    if (i < chars.length - 1) w += kernEmBetween(chars[i], chars[i + 1]) * sizePt;
  }
  return w;
}

// Aile + ağırlık + italik → public/fonts altındaki dosya adı (uzantı dahil).
// Desteklenen aileler: Arno Pro (.otf, kişisel), Vollkorn, Source Serif 4 (.ttf).
// Tanınmayan aileler Source Serif 4'e düşer.
function fontFile(family: string, weight: number, italic: boolean): string {
  const bold = weight >= 700;
  const semi = weight >= 600 && weight < 700;
  if (/arno/i.test(family)) {
    // Arno Pro'da BoldItalic yok; kalın+italik istek Bold'a düşer.
    if (bold) return "Arno-Bold.otf";
    if (semi) return "Arno-SemiBold.otf";
    return italic ? "Arno-Italic.otf" : "Arno-Regular.otf";
  }
  if (/vollkorn/i.test(family)) {
    if (bold || semi) return italic ? "Vollkorn-BoldItalic.ttf" : "Vollkorn-Bold.ttf";
    return italic ? "Vollkorn-Italic.ttf" : "Vollkorn-Regular.ttf";
  }
  if (bold) return italic ? "SourceSerif4-BoldItalic.ttf" : "SourceSerif4-Bold.ttf";
  if (semi) return "SourceSerif4-SemiBold.ttf";
  return italic ? "SourceSerif4-Italic.ttf" : "SourceSerif4-Regular.ttf";
}

// Gömülü fontları tembel yükleyip önbelleğe alır.
class FontCache {
  private cache = new Map<string, PDFFont>();
  private bytes = new Map<string, ArrayBuffer>();
  constructor(private doc: PDFDocument) {}

  private async fetchBytes(key: string): Promise<ArrayBuffer | null> {
    const cached = this.bytes.get(key);
    if (cached) return cached;
    const res = await fetch(`/fonts/${key}`);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    this.bytes.set(key, buf);
    return buf;
  }

  async get(family: string, weight: number, italic: boolean): Promise<PDFFont> {
    let key = fontFile(family, weight, italic);
    const cached = this.cache.get(key);
    if (cached) return cached;
    let buf = await this.fetchBytes(key);
    // Arno Pro Adobe lisanslı: dosyalar yalnızca yereldedir, depoda/yayında yok.
    // Bulunamazsa ücretsiz Source Serif 4'e zarif şekilde düşülür.
    if (!buf && key.startsWith("Arno-")) {
      key = fontFile("Source Serif 4", weight, italic);
      const cachedFallback = this.cache.get(key);
      if (cachedFallback) return cachedFallback;
      buf = await this.fetchBytes(key);
    }
    if (!buf) throw new Error(`Font yüklenemedi: ${key}`);
    // subset:false — fontlar derleme zamanında zaten Türkçe/Latin alt kümesine
    // indirildi (public/fonts). Çalışma anında alt küme çıkarma (@pdf-lib/fontkit)
    // bu fontlarda bozuk glif üretiyordu; bu yüzden bütün hâliyle gömüyoruz.
    const font = await this.doc.embedFont(buf, { subset: false });
    this.cache.set(key, font);
    return font;
  }
}

// ── PageFontRegistry ─────────────────────────────────────────────────────────
// Her PDFFont nesnesini sayfanın Resources/Font sözlüğüne BİR KEZ kaydeder
// ve tutarlı bir PDFName anahtarı döndürür. Bu sayede her drawText/pushText
// çağrısı yeni rastgele alias üretmez; sayfa başına yalnızca kullanılan
// benzersiz font türü sayısı kadar kayıt oluşur (genelde 1–4).
class PageFontRegistry {
  private map = new Map<PDFFont, PDFName>();

  getKey(page: ReturnType<PDFDocument["addPage"]>, font: PDFFont): PDFName {
    const hit = this.map.get(font);
    if (hit) return hit;
    // newFontDictionary, sayfanın Resources/Font sözlüğüne yeni bir girdi ekler
    // ve benzersiz isim döndürür. Bunu yalnızca bir kez çağırıyoruz.
    const key = page.node.newFontDictionary(font.name, font.ref);
    this.map.set(font, key);
    return key;
  }
}

// ── TJ dizisi yardımcıları ───────────────────────────────────────────────────

// Tek bir kelime için TJ dizi parçaları üretir.
// Kerning açıksa kern çiftleri arasına negatif boşluk değerleri eklenir.
// PDF TJ'de pozitif sayı → solu yön → harfleri sıkıştırır.
// Bizim KERN tablosunda negatif = daha sıkı; dönüştürme: TJ = -kern * 1000
function wordTJParts(word: string, font: PDFFont, kerning: boolean): (PDFHexString | number)[] {
  if (!kerning) return [font.encodeText(word)];
  const chars = [...word];
  if (chars.length <= 1) return [font.encodeText(word)];
  const out: (PDFHexString | number)[] = [];
  let seg = "";
  for (let i = 0; i < chars.length; i++) {
    seg += chars[i];
    const k = i + 1 < chars.length ? kernEmBetween(chars[i], chars[i + 1]) : 0;
    if (k !== 0) {
      out.push(font.encodeText(seg));
      out.push(-k * 1000); // pozitif = sola = sıkıştır
      seg = "";
    }
  }
  if (seg) out.push(font.encodeText(seg));
  return out;
}

// TJ parça listesinden PDFOperator oluşturur.
function makeTJOp(parts: (PDFHexString | number)[], doc: PDFDocument): PDFOperator {
  const arr = PDFArray.withContext(doc.context);
  for (const p of parts) {
    arr.push(typeof p === "number" ? PDFNumber.of(p) : p);
  }
  return PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [arr]);
}

// ── Bir satırı tek BT…ET bloğu içinde çiz ──────────────────────────────────
// • fontReg: mevcut sayfanın font kaydı (yeni kayıt yalnızca ilk kullanımda)
// • toks   : WordTok | {gap} dizisi — lineTokens() çıktısıyla aynı format
// • x/y    : satır sol-başı ve taban çizgisi (pt, PDF koordinatları)
// • spaceW : sözcük arası boşluğun doğal genişliği (pt)
// • extraGap: iki yana yaslama için ek boşluk (pt; negatif olabilir)
//
// Her çağrı → 1 adet BT…ET; font değişikliği durumunda BT içinde Tf geçişi.
// Sözcük konumları Td ile takip edilir; Tw kullanılmaz (font kodlaması sorunu).
type WordTok = { word: string; font: PDFFont };
type Tok = WordTok | { gap: true };

function pushTextLine(
  page: ReturnType<PDFDocument["addPage"]>,
  doc: PDFDocument,
  fontReg: PageFontRegistry,
  toks: Tok[],
  x: number,
  y: number,
  sizePt: number,
  spaceW: number,
  extraGap: number,
  kerning: boolean,
  color: Color,
): void {
  const ops: PDFOperator[] = [];
  ops.push(pushGraphicsState());
  ops.push(setFillingColor(color));
  ops.push(beginText());
  ops.push(setWordSpacing(0)); // Tw her satırda sıfırla (önceki bloktan kalmasın)

  let first = true;
  let prevFont: PDFFont | null = null;
  let pendingGap = false;
  let prevAdvance = 0;

  for (const tok of toks) {
    if ("gap" in tok) {
      pendingGap = true;
    } else {
      const { word, font } = tok as WordTok;

      // Konumlandırma: ilk sözcük mutlak (x,y); sonrakiler T_lm'e göreli
      if (first) {
        ops.push(moveText(x, y));
        first = false;
      } else {
        const gap = pendingGap ? spaceW + extraGap : 0;
        ops.push(moveText(prevAdvance + gap, 0));
      }
      pendingGap = false;

      // Font değişikliği varsa Tf operatörü ekle
      if (font !== prevFont) {
        ops.push(setFontAndSize(fontReg.getKey(page, font), sizePt));
        prevFont = font;
      }

      // Sözcüğü çiz: kerning yoksa basit showText (Tj), varsa TJ dizisi
      const parts = wordTJParts(word, font, kerning);
      if (parts.length === 1) {
        ops.push(showText(parts[0] as PDFHexString));
      } else {
        ops.push(makeTJOp(parts, doc));
      }

      prevAdvance = kernedWordWidth(word, font, sizePt, kerning);
    }
  }

  ops.push(endText());
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
}

// Bir satırın Tok listesinin doğal genişliğini hesaplar (pt).
type LineTokenResult = { toks: Tok[]; gapCount: number };

async function lineTokens(
  fonts: FontCache,
  line: Page["lines"][number],
): Promise<LineTokenResult> {
  const toks: Tok[] = [];
  let gapCount = 0;
  for (const seg of line.segments) {
    const weight = seg.bold ? 700 : line.weight;
    const italic = seg.italic || line.italic;
    const font = await fonts.get(line.font, weight, italic);
    const parts = seg.text.split(" ");
    parts.forEach((part, i) => {
      if (i > 0) {
        toks.push({ gap: true });
        gapCount++;
      }
      if (part) toks.push({ word: part, font });
    });
  }
  return { toks, gapCount };
}

function widthOf(toks: Tok[], sizePt: number, spaceW: number, kerning: boolean): number {
  let w = 0;
  for (const t of toks) {
    if ("gap" in t) w += spaceW;
    else w += kernedWordWidth((t as WordTok).word, (t as WordTok).font, sizePt, kerning);
  }
  return w;
}

// Köşelere kesim işaretleri (crop marks): trim kenarına hizalı, bleed'in DIŞINDA.
// İşaretler bleed kenarından (trim'den `bleed` kadar dışarı) başlar ve kâğıt
// kenarına (trim'den `to` kadar dışarı) kadar uzar.
function drawCropMarks(
  page: ReturnType<PDFDocument["addPage"]>,
  to: number, // trim offset (kesim çizgisinin kâğıt kenarına uzaklığı)
  bleed: number,
  w: number,
  h: number,
) {
  const K = PT_PER_MM;
  const L = to * K;
  const R = (to + w) * K;
  const B = to * K; // alt (pdf y, aşağıdan)
  const T = (to + h) * K; // üst
  const inner = bleed * K; // işaret başı: bleed kenarı
  const outer = to * K; // işaret sonu: kâğıt kenarı
  const th = 0.4;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: th, color: BLACK });

  // Her köşede biri dikey (trim x'ine hizalı), biri yatay (trim y'sine hizalı).
  // Sol-üst
  line(L, T + inner, L, T + outer);
  line(L - inner, T, L - outer, T);
  // Sağ-üst
  line(R, T + inner, R, T + outer);
  line(R + inner, T, R + outer, T);
  // Sol-alt
  line(L, B - inner, L, B - outer);
  line(L - inner, B, L - outer, B);
  // Sağ-alt
  line(R, B - inner, R, B - outer);
  line(R + inner, B, R + outer, B);
}

export async function exportBookPdf(input: PdfExportInput): Promise<Uint8Array> {
  const { pages, size, margins, gutter, bleedMm, markOffsetMm, cropMarks, bodyFamily, kerning } = input;
  const K = PT_PER_MM;
  // to = kesim çizgisinin kâğıt kenarına uzaklığı. Kesim işaretleri açıkken
  // sayfa, işaretlere yer açmak için bleed'in ötesine (markOffsetMm) uzar;
  // kapalıyken kâğıt kenarı = bleed kenarı.
  const to = cropMarks && bleedMm > 0 ? markOffsetMm : bleedMm;
  const bleedInset = to - bleedMm; // kâğıt kenarı → bleed kenarı

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = new FontCache(doc);

  const mediaWmm = size.width + 2 * to;
  const mediaHmm = size.height + 2 * to;
  const mediaW = mediaWmm * K;
  const mediaH = mediaHmm * K;

  // from-top mm → pdf y (alttan, pt).
  const yTop = (fromTopMm: number) => (mediaHmm - fromTopMm) * K;

  for (const pg of pages) {
    const page = doc.addPage([mediaW, mediaH]);
    // Her sayfa için taze font kaydı — PDFName'ler sayfanın Resources/Font
    // sözlüğüne bağlı; farklı sayfalarda farklı anahtarlar üretilir.
    const fontReg = new PageFontRegistry();

    // Trim/Bleed kutuları: kesim çizgisi trim (to), taşma bleed kenarı (bleedInset).
    page.setTrimBox(to * K, to * K, size.width * K, size.height * K);
    page.setBleedBox(
      bleedInset * K,
      bleedInset * K,
      (size.width + 2 * bleedMm) * K,
      (size.height + 2 * bleedMm) * K,
    );

    if (cropMarks && bleedMm > 0) drawCropMarks(page, to, bleedMm, size.width, size.height);

    const geo = pageGeometry(size, margins, gutter, pg.isRight);
    const contentX0 = to + geo.left; // mm, soldan
    let cursorTop = to + geo.top; // mm, üstten

    for (const line of pg.lines) {
      cursorTop += line.spaceBeforeMm;
      const sizePt = line.sizePt;
      const baseFont = await fonts.get(line.font, line.weight, line.italic);
      const spaceW = baseFont.widthOfTextAtSize(" ", sizePt);

      const { toks, gapCount } = await lineTokens(fonts, line);
      const naturalW = widthOf(toks, sizePt, spaceW, kerning); // pt

      const boxLeftMm = contentX0 + line.blockIndentMm;
      const insetPt = (line.leftInsetMm ?? 0) * K; // drop cap'in açtığı sol boşluk
      const boxLeftPt = boxLeftMm * K + insetPt;
      const boxWidthPt = (geo.contentWidth - 2 * line.blockIndentMm) * K - insetPt;
      const indentPt = line.indentMm * K;

      // Hizalama.
      let startXpt: number;
      let extraGap = 0;
      if (line.justify && gapCount > 0) {
        startXpt = boxLeftPt + indentPt;
        // Boşluk başına eklenecek (veya çıkarılacak) pay. Satır pdf-lib ölçüsünde
        // kutudan biraz genişse (sayfalama tarayıcı/canvas ölçüsüyle dizdiği için
        // olabilir) boşlukları SIKIŞTIR — taşma yerine. En çok boşluğun ~1/3'ü
        // kadar daraltılır; böylece metin dış metin kenarını (marjı) aşmaz ve
        // folyoyla hizalı kalır.
        const raw = (boxWidthPt - indentPt - naturalW) / gapCount;
        extraGap = Math.max(raw, -spaceW * 0.33);
      } else if (line.align === "center") {
        startXpt = boxLeftPt + (boxWidthPt - naturalW) / 2;
      } else if (line.align === "right") {
        startXpt = boxLeftPt + (boxWidthPt - naturalW);
      } else {
        startXpt = boxLeftPt + indentPt;
      }

      // Taban çizgisi: kutu içinde dikey ortalamaya yakın.
      const sizeMm = sizePt * 0.352778;
      const baselineFromTop = cursorTop + (line.heightMm + sizeMm * 0.7) / 2;
      const yPt = yTop(baselineFromTop);

      // Drop cap: dev baş harfi sol boşluğa çiz; tepesi ilk satırın büyük-harf
      // tepesiyle hizalı, tabanı birkaç satır aşağı sarkar.
      if (line.dropCap) {
        const cap = line.dropCap;
        const capSizeMm = cap.sizePt * 0.352778;
        const capBaselineFromTop = baselineFromTop - 0.7 * sizeMm + 0.7 * capSizeMm;
        const capFont = await fonts.get(cap.font, cap.weight, false);
        const capToks: Tok[] = [{ word: cap.char, font: capFont }];
        pushTextLine(page, doc, fontReg, capToks, boxLeftMm * K, yTop(capBaselineFromTop), cap.sizePt, 0, 0, kerning, BLACK);
      }

      // Satırı tek BT…ET bloğuyla çiz.
      pushTextLine(page, doc, fontReg, toks, startXpt, yPt, sizePt, spaceW, extraGap, kerning, BLACK);

      cursorTop += line.heightMm;
    }

    // Üst bilgi (yazar / kitap adı) — dış kenara hizalı, italik 9pt.
    if (pg.runningHead) {
      const hf = await fonts.get(bodyFamily, 400, true);
      const sz = 9;
      const tw = hf.widthOfTextAtSize(pg.runningHead, sz);
      const xRight = (contentX0 + geo.contentWidth) * K - tw;
      const xLeft = contentX0 * K;
      const x = pg.isRight ? xRight : xLeft;
      const y = yTop(to + margins.top / 2);
      const rhToks: Tok[] = [{ word: pg.runningHead, font: hf }];
      pushTextLine(page, doc, fontReg, rhToks, x, y, sz, 0, 0, false, MUTED);
    }

    // Sayfa numarası — dış alt köşe.
    if (pg.showNumber) {
      const nf = await fonts.get(bodyFamily, 400, false);
      const sz = 9;
      const label = String(pg.number);
      const tw = nf.widthOfTextAtSize(label, sz);
      const xRight = (contentX0 + geo.contentWidth) * K - tw;
      const xLeft = contentX0 * K;
      const x = pg.isRight ? xRight : xLeft;
      const y = (to + margins.bottom / 2.4) * K;
      const pnToks: Tok[] = [{ word: label, font: nf }];
      pushTextLine(page, doc, fontReg, pnToks, x, y, sz, 0, 0, false, MUTED);
    }
  }

  // Nesne akışlarını kapat: daha eski PDF okuyucularıyla (KDY hedefi PDF 1.4)
  // geniş uyumluluk için.
  return doc.save({ useObjectStreams: false });
}
