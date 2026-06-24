// Typst mizanpaj motoru — dışa açılan tek giriş. İmzası exportBookPdf'i yansıtır
// → çağrı yeri neredeyse hiç değişmez. Akış: bookToTypst (saf) → compilePdf
// (WASM, tembel+mutex) → patchPdfBoxes (Trim/Bleed kutuları).

import { bookToTypst, type TypstBookInput } from "./serialize";
import { compilePdf, compileSvg, prewarmTypst } from "./engine";
import { patchPdfBoxes } from "./patchBoxes";

export type { TypstBookInput };
export { prewarmTypst };

export async function exportBookPdfTypst(input: TypstBookInput): Promise<Uint8Array> {
  const src = bookToTypst(input);
  const raw = await compilePdf(src);
  const to = input.cropMarks && input.bleedMm > 0 ? input.markOffsetMm : input.bleedMm;
  return patchPdfBoxes(raw, { size: input.size, to, bleedMm: input.bleedMm });
}

// İleride önizleme için: aynı serializer çıktısını SVG'ye derler (kayma biter).
export async function renderBookSvgTypst(input: TypstBookInput): Promise<string> {
  return compileSvg(bookToTypst(input));
}
