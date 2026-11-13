import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// FLUX 1.1 Pro (yüksek kalite / sanatsal). Sağlayıcıyı veya modeli değiştirmek
// istersek yalnız bu dosya değişir. Hızlı/ucuz alternatif: "flux-schnell".
const MODEL = "black-forest-labs/flux-1.1-pro";
// Üretim bütçesi + görsel indirme, fonksiyon süresinin (maxDuration) İÇİNDE
// biter → Vercel isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner.
export const maxDuration = 120;
const RUN_BUDGET_MS = 90_000;

type Body = {
  prompt?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
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

  // Modele gönderilecek girdi. "custom" oranında genişlik/yükseklik de gerekir
  // (tam sarmal kapakta kitabın geniş spread oranını yakalamak için).
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    output_format: "png",
    output_quality: 100,
    // Modelin kendi içinde açıklamayı zenginleştirmesi → daha sanatsal sonuç.
    prompt_upsampling: true,
    safety_tolerance: 2,
  };
  if (aspectRatio === "custom") {
    input.width = body.width ?? 1440;
    input.height = body.height ?? 960;
  }

  const gate = await chargeCredits("cover-art");
  if (!gate.ok) return gate.response;

  let ok = false;
  try {
    const run = await runReplicate({
      token,
      model: MODEL,
      input,
      budgetMs: RUN_BUDGET_MS,
      signal: request.signal, // kullanıcı Vazgeç dedi → sağlayıcıda da durdur
    });
    if (!run.ok) {
      // 504 → ön yüz "zaman aşımı" der; diğerleri genel sağlayıcı hatası.
      return NextResponse.json(
        { error: run.error, status: run.status, detail: run.detail },
        { status: run.error === "timeout" || run.error === "canceled" ? 504 : 502 },
      );
    }
    const img = await fetchImageAsDataUrl(run.output);
    if (!img.ok) {
      return NextResponse.json({ error: "fetch-image" }, { status: 502 });
    }
    ok = true;
    return NextResponse.json({ image: img.dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  } finally {
    if (!ok) await gate.refund();
  }
}
