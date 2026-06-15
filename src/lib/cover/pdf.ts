import { PDFDocument, rgb } from "pdf-lib";
import type { SpreadDimensions } from "./spread";

const MM_TO_PT = 72 / 25.4;
const CROP_COLOR = rgb(0, 0, 0); // tam siyah — baskı standardı
const CROP_HALO = rgb(1, 1, 1); // beyaz hale — koyu kapakta da görünsün

/**
 * PNG dataURL'den, tam kapak ölçüsünde (taşma payı dahil) baskıya hazır bir PDF
 * üretir ve tarayıcıda indirir. Sayfa boyutu fiziksel mm ölçüsüne birebir eşittir;
 * görselin DPI'ı çağırana (300) bağlıdır. cropMarks=true ise dört trim köşesine
 * kesim işaretleri (cross) çizilir. Yalnızca tarayıcıda çalışır.
 */
export async function exportCoverPdf(
  pngDataUrl: string,
  d: SpreadDimensions,
  fileName: string,
  cropMarks: boolean,
): Promise<void> {
  const pdf = await PDFDocument.create();
  const wPt = d.totalWidth * MM_TO_PT;
  const hPt = d.totalHeight * MM_TO_PT;
  const page = pdf.addPage([wPt, hPt]);

  const pngBytes = await fetch(pngDataUrl).then((r) => r.arrayBuffer());
  const png = await pdf.embedPng(pngBytes);
  page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt });

  if (cropMarks) {
    const gap = 1; // mm
    const reach = Math.max(d.bleed - 0.5, gap + 1); // mm
    // PDF'te y aşağıdan yukarı artar; "üstten" ölçüyü çeviriyoruz.
    const X = (mm: number) => mm * MM_TO_PT;
    const Y = (mmFromTop: number) => hPt - mmFromTop * MM_TO_PT;
    // Her çizgi çift katman: altta kalın beyaz hale, üstte ince siyah çizgi.
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        thickness: 1.6,
        color: CROP_HALO,
      });
      page.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        thickness: 0.5,
        color: CROP_COLOR,
      });
    };
    const mark = (tx: number, ty: number, dx: -1 | 1, dy: -1 | 1) => {
      line(tx + dx * gap, ty, tx + dx * reach, ty); // yatay
      line(tx, ty + dy * gap, tx, ty + dy * reach); // dikey
    };
    mark(d.backStart, d.topTrim, -1, -1);
    mark(d.frontEnd, d.topTrim, 1, -1);
    mark(d.backStart, d.bottomTrim, -1, 1);
    mark(d.frontEnd, d.bottomTrim, 1, 1);

    // Sırt katlama işaretleri — sırt başı/bitişinde, üst ve alt taşma payına
    // doğru kesik (dashed) çizgiler. Cilt katlama hattını gösterir.
    const dline = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        thickness: 1.6,
        color: CROP_HALO,
        dashArray: [2, 2],
      });
      page.drawLine({
        start: { x: X(x1), y: Y(y1) },
        end: { x: X(x2), y: Y(y2) },
        thickness: 0.5,
        color: CROP_COLOR,
        dashArray: [2, 2],
      });
    };
    const spineMark = (xMm: number) => {
      dline(xMm, d.topTrim - gap, xMm, d.topTrim - reach); // üst
      dline(xMm, d.bottomTrim + gap, xMm, d.bottomTrim + reach); // alt
    };
    spineMark(d.spineStart);
    spineMark(d.spineEnd);
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
