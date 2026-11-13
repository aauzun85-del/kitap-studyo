// OpenAI görsel üretimi (ChatGPT'nin gpt-image modeli) için ortak yardımcı.
// Tek istek: POST /v1/images/generations → base64 PNG. Zaman aşımı + istemci
// iptali (request.signal) desteklenir; hiçbir fetch sonsuza kadar asılı kalmaz.
// Yanıttaki token sayımından yaklaşık maliyet (USD) hesaplanır → ön yüz gösterir.

const API = "https://api.openai.com/v1/images/generations";

// Belgedeki liste fiyatı (USD / 1M token): görsel çıktı 30, metin girdi 5,
// görsel girdi 8. Değişirse yalnız burası güncellenir.
const USD_PER_M = { imageOut: 30, textIn: 5, imageIn: 8 };

export type OpenAiImageUsage = {
  inputTokens: number;
  outputTokens: number;
  estUsd: number;
};

export type OpenAiImageRun =
  | { ok: true; dataUrl: string; usage: OpenAiImageUsage | null }
  | {
      ok: false;
      error: "provider" | "timeout" | "no-output" | "canceled";
      status?: number;
      detail?: string;
    };

type Response = {
  data?: { b64_json?: string }[];
  output_format?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { image_tokens?: number; text_tokens?: number };
  };
};

export async function generateOpenAiImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  /** "WIDTHxHEIGHT" (16'nın katı) ya da sabit boyutlar. */
  size: string;
  quality?: "low" | "medium" | "high";
  timeoutMs: number;
  /** İstemcinin isteği: kullanıcı vazgeçerse bekleme kesilir. */
  signal?: AbortSignal;
}): Promise<OpenAiImageRun> {
  const timeout = AbortSignal.timeout(opts.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
  let res: globalThis.Response;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        size: opts.size,
        quality: opts.quality ?? "high",
        output_format: "png",
        n: 1,
      }),
      signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) return { ok: false, error: "canceled" };
    if (timeout.aborted) return { ok: false, error: "timeout" };
    return { ok: false, error: "provider", detail: String(e).slice(0, 300) };
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    return { ok: false, error: "provider", status: res.status, detail };
  }
  const data = (await res.json()) as Response;
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: "no-output" };
  const mime = data.output_format === "jpeg" ? "image/jpeg" : "image/png";

  let usage: OpenAiImageUsage | null = null;
  if (data.usage) {
    const inTok = data.usage.input_tokens ?? 0;
    const outTok = data.usage.output_tokens ?? 0;
    const imgIn = data.usage.input_tokens_details?.image_tokens ?? 0;
    const txtIn = inTok - imgIn;
    const estUsd =
      (outTok * USD_PER_M.imageOut + txtIn * USD_PER_M.textIn + imgIn * USD_PER_M.imageIn) /
      1_000_000;
    usage = { inputTokens: inTok, outputTokens: outTok, estUsd: Math.round(estUsd * 1000) / 1000 };
  }
  return { ok: true, dataUrl: `data:${mime};base64,${b64}`, usage };
}
