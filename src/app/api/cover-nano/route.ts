import { NextResponse } from "next/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// Nano Banana Pro (Google Gemini 3 Pro Image). Karmaşık komutları "düşünerek"
// izleyen, yazıyı en iyi basan üst düzey görsel modeli. Burada kapağı SIFIRDAN
// üretmek için kullanıyoruz (konu/açıklama → tam kapak sanatı). RESMİ model →
// model-scoped uç nokta (flux ile aynı desen).
const MODEL = "google/nano-banana-pro";
// "Düşünme" uzun sürebilir; üretim bütçesi + görsel indirme fonksiyon süresinin
// içinde biter → zaman aşımı temiz bir hata olarak döner (bkz. lib/server/replicate).
export const maxDuration = 120;
const RUN_BUDGET_MS = 90_000;

type Body = {
  prompt?: string;
  aspectRatio?: string; // nano'nun kabul ettiği oran (ör. "2:3", "16:9")
};

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
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
  const aspectRatio = body.aspectRatio ?? "2:3";

  // Nano Banana Pro girdi şeması (Replicate openapi'den doğrulandı):
  // prompt, aspect_ratio (enum), resolution ("1K"|"2K"|"4K"), output_format,
  // allow_fallback_model (Google doluysa yedek modele düşer → hata yerine sonuç).
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    resolution: "2K",
    output_format: "png",
    allow_fallback_model: true,
  };

  try {
    // Nano çıktısı tek bir URL string; dizi gelirse yardımcı ilkini alır.
    const run = await runReplicate({
      token,
      model: MODEL,
      input,
      budgetMs: RUN_BUDGET_MS,
      signal: request.signal, // kullanıcı Vazgeç dedi → sağlayıcıda da durdur
    });
    if (!run.ok) {
      return NextResponse.json(
        { error: run.error, status: run.status, detail: run.detail },
        { status: run.error === "timeout" || run.error === "canceled" ? 504 : 502 },
      );
    }
    const img = await fetchImageAsDataUrl(run.output);
    if (!img.ok) {
      return NextResponse.json({ error: "fetch-image" }, { status: 502 });
    }
    return NextResponse.json({ image: img.dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  }
}
