// Typst mizanpaj motoru — dışa açılan tek giriş. İmzası exportBookPdf'i yansıtır
// → çağrı yeri neredeyse hiç değişmez. Akış: bookToTypst (saf) → compilePdf
// (WASM, tembel+mutex) → patchPdfBoxes (Trim/Bleed kutuları).

import { bookToTypst, type TypstBookInput } from "./serialize";
import { compilePdf, compileSvg, compileQuery, prewarmTypst } from "./engine";
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

// Tıklanabilir önizleme: SVG + her bloğun (idx, sayfa, y) konumu (introspection).
// AYNI src üzerinde compileSvg + compileQuery → konumlar SVG ile birebir.
export type BlockPos = { idx: number; page: number; yPt: number };
export async function renderBookSvgWithBlocks(
  input: TypstBookInput,
): Promise<{ svg: string; blocks: BlockPos[] }> {
  const src = bookToTypst(input);
  const assets = collectAssets(input);
  const svg = await compileSvg(src, assets);
  // Konum sorgusu (introspection) BAŞARISIZ olsa bile SVG'yi döndür → önizleme
  // çalışır, yalnız tıklanabilir bölgeler olmaz.
  let raw: unknown[] = [];
  try {
    raw = await compileQuery(src, "<blk>", assets);
  } catch {
    /* yok say */
  }
  const blocks: BlockPos[] = [];
  for (const el of raw as Array<{ value?: { idx?: number; p?: number; y?: number } }>) {
    const v = el?.value;
    if (v && typeof v.idx === "number" && typeof v.p === "number" && typeof v.y === "number") {
      blocks.push({ idx: v.idx, page: v.p, yPt: v.y });
    }
  }
  blocks.sort((a, b) => a.idx - b.idx);
  return { svg, blocks };
}
