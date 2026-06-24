// Ortam soyutlaması — tek dosya "tarayıcı mı sunucu mu" bilir; engine/serialize/
// template ortam-bağımsız kalır. İleride bir API route'u (sunucu) burada
// fetch yerine fs.readFile koyarak aynı çekirdeği yeniden kullanır.

import { TYPST_FONT_FILES } from "./fonts";

// public/typst altındaki WASM URL'leri (build adımı node_modules'tan kopyalar).
export const COMPILER_WASM_URL = "/typst/compiler.wasm";
export const RENDERER_WASM_URL = "/typst/renderer.wasm";

// Fontları bayt olarak getir; 404 (örn. yayında Arno yok) atlanır → null filtrelenir.
export async function loadFontData(): Promise<Uint8Array[]> {
  const results = await Promise.all(
    TYPST_FONT_FILES.map(async (file) => {
      try {
        const res = await fetch(`/fonts/${file}`);
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    }),
  );
  return results.flatMap((x) => (x ? [x] : []));
}
