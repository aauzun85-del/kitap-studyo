// Typst WASM'ı node_modules'tan public/typst'e kopyalar (dev + build öncesi).
// public/typst gitignore'da (28MB repo'ya girmesin) → bu adım her ortamda üretir.
import { mkdir, copyFile, access } from "fs/promises";

const PAIRS = [
  [
    "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
    "public/typst/compiler.wasm",
  ],
  [
    "node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm",
    "public/typst/renderer.wasm",
  ],
];

await mkdir("public/typst", { recursive: true });
for (const [src, dst] of PAIRS) {
  try {
    await access(src);
    await copyFile(src, dst);
  } catch (e) {
    console.warn(`[typst-wasm] atlandı: ${src} (${e.code || e.message})`);
  }
}
console.log("[typst-wasm] public/typst hazır");
