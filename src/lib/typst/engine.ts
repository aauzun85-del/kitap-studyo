// Typst WASM motoru — tembel, tek-örnek (singleton), seri çağrılı.
// @myriaddreamin/typst.ts DİNAMİK import edilir → 28MB WASM ilk paketin DIŞINDA
// kalır, yalnız ilk kullanımda (Mizanpaj) yüklenir. $typst global'i tek-örnek ve
// DURUMLU olduğundan tüm derlemeler bir Promise zinciri (mutex) ile sıralanır.

import { COMPILER_WASM_URL, RENDERER_WASM_URL, loadFontData } from "./assets";

type Engine = {
  compilePdf: (src: string) => Promise<Uint8Array>;
  compileSvg: (src: string) => Promise<string>;
};

let enginePromise: Promise<Engine> | null = null;
// Derleme mutex'i: $typst durumlu → çağrıları sıraya diz.
let compileLock: Promise<unknown> = Promise.resolve();

async function init(): Promise<Engine> {
  const mod = await import("@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs");
  const $typst = mod.$typst;
  const TypstSnippet = mod.TypstSnippet;

  $typst.setCompilerInitOptions({ getModule: () => fetch(COMPILER_WASM_URL) });
  $typst.setRendererInitOptions({ getModule: () => fetch(RENDERER_WASM_URL) });

  // Varsayılan (CDN) fontları kapat, yalnız bizim fontlarımızı yükle → offline,
  // ağ bağımsız, deterministik. Yüklenebilen (var olan) dosyalar veri olarak verilir.
  const fontData = await loadFontData();
  $typst.use(
    TypstSnippet.disableDefaultFontAssets(),
    TypstSnippet.preloadFonts(fontData),
  );

  return {
    compilePdf: (src: string) => $typst.pdf({ mainContent: src }) as Promise<Uint8Array>,
    compileSvg: (src: string) => $typst.svg({ mainContent: src }) as Promise<string>,
  };
}

export function getTypstEngine(): Promise<Engine> {
  return (enginePromise ??= init());
}

// Tüm derlemeleri sıraya dizen sarmalayıcı (eşzamanlı çağrı $typst'i bozar).
async function serialized<T>(fn: (e: Engine) => Promise<T>): Promise<T> {
  const run = compileLock.then(async () => fn(await getTypstEngine()));
  // zincir kırılmasın diye hatayı yut (çağıran asıl run'dan alır)
  compileLock = run.catch(() => undefined);
  return run;
}

export function compilePdf(src: string): Promise<Uint8Array> {
  return serialized((e) => e.compilePdf(src));
}

export function compileSvg(src: string): Promise<string> {
  return serialized((e) => e.compileSvg(src));
}

// Mizanpaj açılışında çağrılır → 28MB WASM kullanıcı yazarken arkada ısınır.
export function prewarmTypst(): void {
  void getTypstEngine().catch(() => undefined);
}
