// Replicate'te bir tahmin (prediction) çalıştırıp sonucunu bekleyen ortak
// yardımcı. Görsel üreten rotalar (cover-art / cover-nano / cover-ideogram)
// bunu kullanır.
//
// NEDEN tek bir "Prefer: wait" isteği değil?
// - "Prefer: wait" Replicate'i 60 sn'ye kadar bekletir; sunucu fonksiyonunun
//   kendi süresi (maxDuration) dolunca Vercel isteği ORTADAN keser → kullanıcı
//   düzgün hata yerine kopuk bağlantı görür, jeton iadesi (finally) çalışmaz.
// - Burada: kısa bir senkron bekleme (fast path) + sonra sorgulama (poll).
//   Bütçe (budgetMs) dolunca tahmini Replicate'te İPTAL ederiz ve temiz bir
//   "timeout" döneriz → rota iadeyi yapıp kullanıcıya "zaman aşımı" diyebilir.
// - Her ağ çağrısının kendi zaman aşımı var; hiçbir fetch sonsuza kadar asılı
//   kalmaz.

const API = "https://api.replicate.com/v1";
const WAIT_SECONDS = 30; // ilk istekte senkron bekleme (çoğu üretim buna sığar)
const POLL_MS = 1500;
const CALL_TIMEOUT_MS = 15_000; // tekil ağ çağrısı (poll / iptal) için

export type ReplicateRun =
  | { ok: true; output: string }
  | {
      ok: false;
      // "canceled": istemci bağlantıyı kesti (Vazgeç) → tahmin sağlayıcıda da durduruldu.
      error: "provider" | "timeout" | "no-output" | "canceled";
      status?: number | string;
      detail?: string;
    };

type Prediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
  urls?: { get?: string; cancel?: string };
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function firstOutput(output: unknown): string | null {
  const out = Array.isArray(output) ? output[0] : output;
  return typeof out === "string" && out ? out : null;
}

export async function runReplicate(opts: {
  token: string;
  /** Resmi model ("owner/name") → /models/{model}/predictions ucu. */
  model?: string;
  /** Topluluk modeli sürüm hash'i → /predictions ucu. */
  version?: string;
  input: Record<string, unknown>;
  /** Bu süre (ms) içinde sonuç yoksa tahmin iptal edilir, "timeout" döner. */
  budgetMs: number;
  /** İstemcinin isteği (request.signal): kullanıcı vazgeçerse tahmini iptal et. */
  signal?: AbortSignal;
}): Promise<ReplicateRun> {
  const { token, input, budgetMs, signal } = opts;
  const deadline = Date.now() + budgetMs;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const url = opts.model
    ? `${API}/models/${opts.model}/predictions`
    : `${API}/predictions`;
  const body = opts.model
    ? { input }
    : { version: opts.version, input };

  // 1) Oluştur + kısa senkron bekleme. Bekleme süresi bütçeyi aşmasın.
  const wait = Math.max(5, Math.min(WAIT_SECONDS, Math.floor(budgetMs / 1000) - 5));
  let pred: Prediction;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, Prefer: `wait=${wait}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(wait * 1000 + CALL_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { ok: false, error: "provider", status: res.status, detail };
    }
    pred = (await res.json()) as Prediction;
  } catch (e) {
    return { ok: false, error: "provider", detail: String(e).slice(0, 300) };
  }

  // 2) Bitmediyse bütçe dolana dek sorgula.
  const pollUrl = pred.urls?.get ?? (pred.id ? `${API}/predictions/${pred.id}` : null);
  while (pred.status === "starting" || pred.status === "processing") {
    if (!pollUrl) break;
    if (signal?.aborted) {
      await cancel(pred, headers);
      return { ok: false, error: "canceled", status: pred.status };
    }
    const left = deadline - Date.now();
    if (left <= 0) {
      await cancel(pred, headers);
      return { ok: false, error: "timeout", status: pred.status };
    }
    await sleep(Math.min(POLL_MS, left));
    try {
      const res = await fetch(pollUrl, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      if (!res.ok) continue; // geçici hata → bir sonraki turda yeniden dene
      pred = (await res.json()) as Prediction;
    } catch {
      // ağ takılması → bütçe izin verdikçe yeniden dene
    }
  }

  if (pred.status === "succeeded") {
    const out = firstOutput(pred.output);
    return out
      ? { ok: true, output: out }
      : { ok: false, error: "no-output", status: pred.status };
  }
  return {
    ok: false,
    error: "provider",
    status: pred.status ?? "unknown",
    detail: pred.error ? String(pred.error).slice(0, 300) : undefined,
  };
}

// Bütçe dolan tahmini sağlayıcıda da durdur: boşa süre/para harcanmasın.
// Başarısız olsa da sorun değil (en kötü ihtimalle Replicate kendi bitirir).
async function cancel(pred: Prediction, headers: Record<string, string>) {
  const url = pred.urls?.cancel ?? (pred.id ? `${API}/predictions/${pred.id}/cancel` : null);
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // yut
  }
}

// Üretilen görseli sunucuda indirip data URL'e çevirir: link süresi dolmaz,
// tuval çapraz-köken (CORS) yüzünden kirlenmez → PDF dışa aktarımı sorunsuz.
export async function fetchImageAsDataUrl(
  url: string,
  timeoutMs = 20_000,
): Promise<{ ok: true; dataUrl: string } | { ok: false }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false };
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
  } catch {
    return { ok: false };
  }
}
