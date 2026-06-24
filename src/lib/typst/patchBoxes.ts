// Typst PDF'ine TrimBox + BleedBox damgalar — Typst bunları yazamaz ama KDY
// joboptions/preflight bekler. pdf-lib ile (zaten bağımlı) sayfa açılır, kutular
// bilinen to/bleed ofsetlerinden stamplanır (pdf.ts:399-405 ile birebir). Yeniden
// dizgi yok, ucuz.

import { PDFDocument } from "pdf-lib";

const PT_PER_MM = 72 / 25.4;

export type BoxGeo = {
  size: { width: number; height: number }; // trim, mm
  to: number; // kesim çizgisi → kâğıt kenarı, mm
  bleedMm: number;
};

export async function patchPdfBoxes(pdf: Uint8Array, geo: BoxGeo): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const K = PT_PER_MM;
  const { size, to, bleedMm } = geo;
  const bleedInset = to - bleedMm; // kâğıt kenarı → bleed kenarı
  for (const page of doc.getPages()) {
    // TrimBox = kesim dikdörtgeni (to kadar içeride).
    page.setTrimBox(to * K, to * K, size.width * K, size.height * K);
    if (bleedMm > 0) {
      page.setBleedBox(
        bleedInset * K,
        bleedInset * K,
        (size.width + 2 * bleedMm) * K,
        (size.height + 2 * bleedMm) * K,
      );
    }
  }
  return doc.save();
}
