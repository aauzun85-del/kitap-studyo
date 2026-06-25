// Typst mizanpaj motoru — dışa açılan tek giriş. İmzası exportBookPdf'i yansıtır
// → çağrı yeri neredeyse hiç değişmez. Akış: bookToTypst (saf) → compilePdf
// (WASM, tembel+mutex) → patchPdfBoxes (Trim/Bleed kutuları).

import { bookToTypst, type TypstBookInput } from "./serialize";
import { compilePdf, compileSvg, prewarmTypst } from "./engine";
import { patchPdfBoxes } from "./patchBoxes";
import { optimizeImagesForPrint } from "./optimizeImage";

export type { TypstBookInput };
export { prewarmTypst };

// Bloklardaki görselleri (Word'den) VFS varlıklarına çevir.
function collectAssets(input: TypstBookInput) {
  return input.blocks
    .filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image")
    .map((b) => ({ path: b.path, data: b.data }));
}

export async function exportBookPdfTypst(input: TypstBookInput): Promise<Uint8Array> {
  // Görselleri baskıya (300 DPI/JPEG) küçült → PDF KDY sınırının altına insin.
  const opt = await optimizeImagesForPrint(input);
  const src = bookToTypst(opt);
  const raw = await compilePdf(src, collectAssets(opt));
  const to = input.cropMarks && input.bleedMm > 0 ? input.markOffsetMm : input.bleedMm;
  return patchPdfBoxes(raw, { size: input.size, to, bleedMm: input.bleedMm });
}

// İleride önizleme için: aynı serializer çıktısını SVG'ye derler (kayma biter).
export async function renderBookSvgTypst(input: TypstBookInput): Promise<string> {
  return compileSvg(bookToTypst(input), collectAssets(input));
}
