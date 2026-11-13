// Typst mizanpaj motoru — dışa açılan tek giriş. İmzası exportBookPdf'i yansıtır
// → çağrı yeri neredeyse hiç değişmez. Akış: bookToTypst (saf, ana kanal) →
// İŞÇİDE derleme (WASM ağır işi ayrı kanalda; arayüz donmaz — "önizleme = baskı"
// ilkesinin ön şartı) → patchPdfBoxes (Trim/Bleed kutuları, ana kanal).

import { bookToTypst, type TypstBookInput } from "./serialize";
import { TypstCrashError } from "./engine";
import { workerSvgWithBlocks, workerSvg, workerPdf, prewarmTypstWorker } from "./workerClient";
import { patchPdfBoxes } from "./patchBoxes";
import { optimizeImagesForPrint } from "./optimizeImage";

export type { TypstBookInput };
export { TypstCrashError };
// Mizanpaj açılışında çağrılabilir: 28MB WASM işçide önceden ısınır.
export const prewarmTypst = prewarmTypstWorker;

// Bloklardaki görselleri (Word'den) VFS varlıklarına çevir.
function collectAssets(input: TypstBookInput) {
  return input.blocks
    .filter((b): b is Extract<typeof b, { type: "image" }> => b.type === "image")
    .map((b) => ({ path: b.path, data: b.data }));
}

export async function exportBookPdfTypst(input: TypstBookInput): Promise<Uint8Array> {
  // Görselleri baskıya (300 DPI/JPEG) küçült → PDF KDY sınırının altına insin.
  // (canvas kullanır → ana kanalda kalmak ZORUNDA; derleme işçiye gider.)
  const opt = await optimizeImagesForPrint(input);
  const src = bookToTypst(opt);
  const raw = await workerPdf(src, collectAssets(opt));
  const to = input.cropMarks && input.bleedMm > 0 ? input.markOffsetMm : input.bleedMm;
  return patchPdfBoxes(raw, { size: input.size, to, bleedMm: input.bleedMm });
}

// Yazma editörünün canlı önizlemesi: aynı serializer çıktısını SVG'ye derler
// (işçide; konum sorgusu yok → tek derleme, hızlı).
export async function renderBookSvgTypst(input: TypstBookInput): Promise<string> {
  return workerSvg(bookToTypst(input), collectAssets(input));
}

// Tıklanabilir önizleme: SVG + her bloğun (idx, sayfa, y) konumu (introspection).
// AYNI src üzerinde svg + query (işçide, aynı mutex) → konumlar SVG ile birebir.
export type BlockPos = { idx: number; page: number; yPt: number };
export async function renderBookSvgWithBlocks(
  input: TypstBookInput,
): Promise<{ svg: string; blocks: BlockPos[] }> {
  const src = bookToTypst(input);
  const { svg, raw } = await workerSvgWithBlocks(src, collectAssets(input));
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
