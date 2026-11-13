import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { generateOpenAiImage } from "@/lib/server/openaiImage";

// ChatGPT görsel modeli (gpt-image). Yerleşim kurallarını (başlık/logo bandı,
// açık arka kapak, sırt) en iyi izleyen sağlayıcı; komut ön yüzde katmanlı
// kurulur (lib/cover/aiStyles buildLayeredPrompt). Model değişecekse yalnız
// bu satır: "sunburst" = ayrıntı/hassasiyet, "flare" = hız.
const MODEL = "gpt-image-2.5-sunburst";
// Üretim + yanıt, fonksiyon süresinin içinde biter → zaman aşımı temiz hata.
export const maxDuration = 120;
const TIMEOUT_MS = 100_000;

type Body = {
  prompt?: string;
  /** "WIDTHxHEIGHT" — ön yüz kapağın gerçek oranından hesaplar (openaiSize). */
  size?: string;
  quality?: "low" | "medium" | "high";
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Anahtar henüz eklenmemiş → ön yüz buna özel mesaj gösterir.
    return NextResponse.json({ error: "no-token" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "no-prompt" }, { status: 400 });
  }
  const size = /^\d{3,4}x\d{3,4}$/.test(body.size ?? "") ? body.size! : "1024x1536";
  const quality = body.quality ?? "high";

  // Jeton: önce düş; üretim başarısız/iptal/zaman aşımı olursa iade et.
  const gate = await chargeCredits("cover-openai");
  if (!gate.ok) return gate.response;

  let ok = false;
  try {
    const run = await generateOpenAiImage({
      apiKey,
      model: MODEL,
      prompt,
      size,
      quality,
      timeoutMs: TIMEOUT_MS,
      signal: request.signal, // kullanıcı Vazgeç dedi → beklemeyi bırak
    });
    if (!run.ok) {
      return NextResponse.json(
        { error: run.error, status: run.status, detail: run.detail },
        { status: run.error === "timeout" || run.error === "canceled" ? 504 : 502 },
      );
    }
    ok = true;
    return NextResponse.json({ image: run.dataUrl, usage: run.usage });
  } catch (e) {
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  } finally {
    if (!ok) await gate.refund();
  }
}
