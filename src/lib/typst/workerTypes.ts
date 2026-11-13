// Typst işçisi (Web Worker) ile ana kanal arasındaki mesaj sözleşmesi.
// AYRI dosyada: istemci yalnız TİPLERİ import eder; işçi kodu ana pakete girmez.

export type TypstWorkerAsset = { path: string; data: Uint8Array };

export type TypstWorkerRequest =
  | { id: number; cmd: "svgWithBlocks"; src: string; assets: TypstWorkerAsset[] }
  // Yalın SVG (konum sorgusu YOK) — yazma editörünün canlı önizlemesi için
  // (sorgu ikinci bir derleme ister; sık tetiklenen yolda israf olur).
  | { id: number; cmd: "svg"; src: string; assets: TypstWorkerAsset[] }
  | { id: number; cmd: "pdf"; src: string; assets: TypstWorkerAsset[] }
  | { id: number; cmd: "prewarm" };

export type TypstWorkerResponse =
  | { id: number; ok: true; cmd: "svgWithBlocks"; svg: string; raw: unknown[] }
  | { id: number; ok: true; cmd: "svg"; svg: string }
  | { id: number; ok: true; cmd: "pdf"; pdf: Uint8Array }
  | { id: number; ok: true; cmd: "prewarm" }
  | {
      id: number;
      ok: false;
      // Rust panic (WASM çökmesi): işçi örneği artık bozuk → istemci yenisini kurar.
      crash: boolean;
      panic: string | null;
      message: string;
    };
