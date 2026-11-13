// Typst derleme İŞÇİSİ (Web Worker) — ağır WASM derlemesi ana ekran kanalının
// DIŞINDA çalışır: kullanıcı 400 sayfalık kitapta yazarken bile arayüz donmaz.
// Motor modülü (engine.ts) ortam-bağımsızdır: dinamik import, fetch ile WASM/font
// yükleme ve panic yakalama işçide de birebir çalışır. Her işçi örneği kendi
// motorunu kurar; WASM çökerse istemci (workerClient) bu örneği atıp YENİSİNİ
// kurar — eskiden çökme "sayfa yenilenene kadar" kalıcıydı, artık değil.

import { compilePdf, compileSvg, compileQuery, getTypstEngine, TypstCrashError } from "./engine";
import type { TypstWorkerRequest, TypstWorkerResponse } from "./workerTypes";

function reply(msg: TypstWorkerResponse, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.onmessage = async (ev: MessageEvent<TypstWorkerRequest>) => {
  const req = ev.data;
  try {
    if (req.cmd === "prewarm") {
      await getTypstEngine();
      reply({ id: req.id, ok: true, cmd: "prewarm" });
      return;
    }
    if (req.cmd === "svg") {
      const svg = await compileSvg(req.src, req.assets);
      reply({ id: req.id, ok: true, cmd: "svg", svg });
      return;
    }
    if (req.cmd === "svgWithBlocks") {
      const svg = await compileSvg(req.src, req.assets);
      // Konum sorgusu başarısız olsa bile SVG döner → önizleme çalışır,
      // yalnız tıklanabilir bölgeler olmaz (index.ts'teki eski davranışla aynı).
      let raw: unknown[] = [];
      try {
        raw = await compileQuery(req.src, "<blk>", req.assets);
      } catch {
        /* yok say */
      }
      reply({ id: req.id, ok: true, cmd: "svgWithBlocks", svg, raw });
      return;
    }
    // cmd === "pdf"
    const pdf = await compilePdf(req.src, req.assets);
    // PDF baytları kopyasız (transfer) döner — büyük kitapta bellek/şi̇şme yok.
    reply({ id: req.id, ok: true, cmd: "pdf", pdf }, [pdf.buffer as ArrayBuffer]);
  } catch (e) {
    const crash = e instanceof TypstCrashError;
    reply({
      id: req.id,
      ok: false,
      crash,
      panic: crash ? (e as TypstCrashError).panic : null,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
