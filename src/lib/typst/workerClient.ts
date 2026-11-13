// Typst işçisinin ANA-KANAL istemcisi. Tek işçi örneği kurar, istekleri id ile
// eşler, cevapları Promise'e çevirir. Çökme (Rust panic) gelirse işçiyi atar ve
// bir SONRAKİ çağrıda tazesini kurar → çökme artık sayfa yenilemeye kalmaz.
// Üst üste çökerse (aynı kitap motoru her seferinde düşürüyorsa) yeniden kurmayı
// bırakır — çökme döngüsüne girilmez; kullanıcıya kalıcı hata gösterilir.

import { TypstCrashError } from "./engine";
import type { TypstWorkerAsset, TypstWorkerRequest, TypstWorkerResponse } from "./workerTypes";

type Pending = {
  resolve: (msg: TypstWorkerResponse) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
// Üst üste çökme sayacı: 2'ye ulaşınca yeni işçi KURULMAZ (sticky çökme).
let consecutiveCrashes = 0;
let stickyCrash: TypstCrashError | null = null;

function failAll(err: Error): void {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  // new URL + import.meta.url: Turbopack/webpack işçiyi ayrı pakete derler.
  const w = new Worker(new URL("./typst.worker.ts", import.meta.url), { type: "module" });
  w.onmessage = (ev: MessageEvent<TypstWorkerResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    p.resolve(msg);
  };
  w.onerror = (ev) => {
    // İşçi betiği yüklenemedi / beklenmedik hata: bekleyenleri düşür, işçiyi at.
    failAll(new Error(ev.message || "Typst işçisi beklenmedik şekilde durdu"));
    w.terminate();
    if (worker === w) worker = null;
  };
  worker = w;
  return w;
}

type RequestBody =
  | { cmd: "svgWithBlocks"; src: string; assets: TypstWorkerAsset[] }
  | { cmd: "svg"; src: string; assets: TypstWorkerAsset[] }
  | { cmd: "pdf"; src: string; assets: TypstWorkerAsset[] }
  | { cmd: "prewarm" };

async function request(req: RequestBody): Promise<TypstWorkerResponse> {
  if (stickyCrash) throw stickyCrash;
  const id = nextId++;
  const w = getWorker();
  const result = new Promise<TypstWorkerResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  const payload: TypstWorkerRequest = { ...req, id };
  w.postMessage(payload);
  const msg = await result;
  if (msg.ok) {
    consecutiveCrashes = 0;
    return msg;
  }
  if (msg.crash) {
    // Bozuk WASM örneği: bu işçi artık kullanılamaz → at. Bir sonraki çağrı
    // taze işçi kurar; üst üste ikinci çökmede kalıcı hataya geç.
    consecutiveCrashes++;
    failAll(new TypstCrashError(msg.panic));
    w.terminate();
    if (worker === w) worker = null;
    const err = new TypstCrashError(msg.panic);
    if (consecutiveCrashes >= 2) stickyCrash = err;
    throw err;
  }
  throw new Error(msg.message);
}

export async function workerSvgWithBlocks(
  src: string,
  assets: TypstWorkerAsset[],
): Promise<{ svg: string; raw: unknown[] }> {
  const msg = await request({ cmd: "svgWithBlocks", src, assets });
  if (msg.ok && msg.cmd === "svgWithBlocks") return { svg: msg.svg, raw: msg.raw };
  throw new Error("Typst işçisinden beklenmedik cevap");
}

export async function workerSvg(src: string, assets: TypstWorkerAsset[]): Promise<string> {
  const msg = await request({ cmd: "svg", src, assets });
  if (msg.ok && msg.cmd === "svg") return msg.svg;
  throw new Error("Typst işçisinden beklenmedik cevap");
}

export async function workerPdf(src: string, assets: TypstWorkerAsset[]): Promise<Uint8Array> {
  const msg = await request({ cmd: "pdf", src, assets });
  if (msg.ok && msg.cmd === "pdf") return msg.pdf;
  throw new Error("Typst işçisinden beklenmedik cevap");
}

// Mizanpaj açılışında çağrılır → 28MB WASM, kullanıcı daha yazarken işçide ısınır.
export function prewarmTypstWorker(): void {
  if (typeof window === "undefined") return;
  void request({ cmd: "prewarm" }).catch(() => undefined);
}
