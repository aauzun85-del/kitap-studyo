// Typst WASM motoru — tembel, tek-örnek (singleton), seri çağrılı.
// @myriaddreamin/typst.ts DİNAMİK import edilir → 28MB WASM ilk paketin DIŞINDA
// kalır, yalnız ilk kullanımda (Mizanpaj) yüklenir. $typst global'i tek-örnek ve
// DURUMLU olduğundan tüm derlemeler bir Promise zinciri (mutex) ile sıralanır.

import { COMPILER_WASM_URL, RENDERER_WASM_URL, loadFontData } from "./assets";

// Görsel varlığı: sanal yol → bayt (Typst VFS'e mapShadow edilir).
export type TypstAsset = { path: string; data: Uint8Array };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWorld = { compile: () => Promise<unknown>; query: (o: { selector: string; field?: string }) => Promise<unknown[]> };
type Snippet = {
  pdf: (o: { mainContent: string }) => Promise<Uint8Array>;
  svg: (o: { mainContent: string }) => Promise<string>;
  mapShadow: (path: string, data: Uint8Array) => Promise<void>;
  // Introspection için düşük seviye: snippet.query() compile ETMİYOR (paged doc
  // yok → "not compiled"). Bu yüzden getCompileOptions + getCompiler.runWithWorld
  // ile world.compile() SONRA world.query() yaparız.
  getCompileOptions: (o: { mainContent: string }) => Promise<unknown>;
  getCompiler: () => Promise<{
    runWithWorld: (opts: unknown, cb: (w: AnyWorld) => Promise<unknown>) => Promise<unknown>;
  }>;
  removeTmp: (opts: unknown) => void;
};

let enginePromise: Promise<Snippet> | null = null;
// Derleme mutex'i: $typst durumlu → çağrıları sıraya diz.
let compileLock: Promise<unknown> = Promise.resolve();

async function init(): Promise<Snippet> {
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

  // unknown üzerinden: getCompileOptions TS'de private ama JS'de erişilebilir
  // (introspection için runWithWorld+compile+query gerekiyor).
  return $typst as unknown as Snippet;
}

export function getTypstEngine(): Promise<Snippet> {
  return (enginePromise ??= init());
}

// Tüm derlemeleri sıraya dizen sarmalayıcı (eşzamanlı çağrı $typst'i bozar).
// Derlemeden önce görselleri VFS'e map'ler (#image bunlara başvurur).
async function serialized<T>(assets: TypstAsset[], fn: (e: Snippet) => Promise<T>): Promise<T> {
  const run = compileLock.then(async () => {
    const e = await getTypstEngine();
    for (const a of assets) await e.mapShadow(a.path, a.data);
    return fn(e);
  });
  compileLock = run.catch(() => undefined);
  return run;
}

export function compilePdf(src: string, assets: TypstAsset[] = []): Promise<Uint8Array> {
  return serialized(assets, (e) => e.pdf({ mainContent: src }));
}

export function compileSvg(src: string, assets: TypstAsset[] = []): Promise<string> {
  return serialized(assets, (e) => e.svg({ mainContent: src }));
}

// Introspection: belgeyi derler ve selector'la eşleşen elemanları döndürür
// (tıklanabilir önizleme için blok konumları). svg/pdf ile AYNI mutex → $typst
// durumu bozulmaz.
export function compileQuery(src: string, selector: string, assets: TypstAsset[] = [], field?: string): Promise<unknown[]> {
  return serialized(assets, async (e) => {
    const opts = await e.getCompileOptions({ mainContent: src });
    const compiler = await e.getCompiler(); // RESET değil → mapShadow/font korunur
    try {
      const out = await compiler.runWithWorld(opts, async (world) => {
        await world.compile(); // paged dökümanı derle (yoksa query "not compiled")
        return world.query({ selector, field });
      });
      return (out as unknown[]) ?? [];
    } finally {
      e.removeTmp(opts);
    }
  });
}

// Mizanpaj açılışında çağrılır → 28MB WASM kullanıcı yazarken arkada ısınır.
export function prewarmTypst(): void {
  void getTypstEngine().catch(() => undefined);
}
