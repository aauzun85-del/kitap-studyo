// Baskı için görsel optimizasyonu (yalnız TARAYICI — canvas kullanır). Word'den
// gelen görseller çoğu zaman ham/yüksek çözünürlüklü (1-2 MB PNG); baskıda 300
// DPI yeterli. Görseli yerleştirileceği genişliğin 300 DPI karşılığına küçültüp
// JPEG'e çevirir → PDF küçülür (KDY 10 MB iç-sayfa sınırı). Çözülemeyen ya da
// zaten küçük görseller olduğu gibi kalır.

import type { Block } from "@/lib/layout/paginate";
import type { TypstBookInput } from "./serialize";

const PRINT_DPI = 300;
const JPEG_QUALITY = 0.82;

async function optimizeOne(
  data: Uint8Array,
  path: string,
  maxWidthPx: number,
): Promise<{ data: Uint8Array; path: string }> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(new Blob([data as BlobPart]));
  } catch {
    return { data, path }; // çözülemedi (örn. emf/wmf) → dokunma
  }
  try {
    const scale = bmp.width > maxWidthPx ? maxWidthPx / bmp.width : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { data, path };
    // JPEG'in alfası yok → şeffaf görseller beyaz zemine otursun.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return { data, path };
    const out = new Uint8Array(await blob.arrayBuffer());
    // Yalnız gerçekten küçüldüyse kullan (zaten optimize küçük görseli şişirme).
    if (out.length >= data.length) return { data, path };
    return { data: out, path: path.replace(/\.[^.]+$/, ".jpeg") };
  } finally {
    bmp.close?.();
  }
}

// Tüm görsel bloklarını yerinde optimize eder; metin/tablo blokları aynen geçer.
// path + data BİRLİKTE güncellenir (markup ve mapShadow eşleşmesi korunur).
export async function optimizeImagesForPrint(input: TypstBookInput): Promise<TypstBookInput> {
  const contentWidthMm = Math.max(
    20,
    input.size.width - input.margins.inside - input.margins.outside - input.gutter,
  );
  const blocks: Block[] = await Promise.all(
    input.blocks.map(async (b): Promise<Block> => {
      if (b.type !== "image") return b;
      const renderWidthMm = b.widthMm && b.widthMm <= contentWidthMm ? b.widthMm : contentWidthMm;
      const maxWidthPx = Math.ceil((renderWidthMm / 25.4) * PRINT_DPI);
      try {
        const { data, path } = await optimizeOne(b.data, b.path, maxWidthPx);
        return { ...b, data, path };
      } catch {
        return b;
      }
    }),
  );
  return { ...input, blocks };
}
