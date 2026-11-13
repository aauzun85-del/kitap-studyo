import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// Ideogram v3 (Quality). Tipografi/yazıyı en temiz basan modellerden biri →
// başlık/yazar adını görselin içine "gömme" için çok uygun. Sağlayıcı veya
// kademe (turbo/balanced/quality) değişirse yalnız bu satır değişir.
const MODEL = "ideogram-ai/ideogram-v3-quality";
// Yüksek kalite uzun sürebilir; üretim bütçesi + görsel indirme fonksiyon
// süresinin içinde biter → zaman aşımı temiz bir hata olarak döner.
export const maxDuration = 120;
const RUN_BUDGET_MS = 90_000;

type Body = {
  prompt?: string;
  aspectRatio?: string; // Ideogram'ın kabul ettiği oran (ör. "2:3", "16:9")
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

  // Ideogram v3 girdi şeması: prompt, aspect_ratio (enum "W:H"),
  // magic_prompt_option ("Auto" → komutu kendiliğinden zenginleştirir).
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
    magic_prompt_option: "Auto",
  };

  const gate = await chargeCredits("cover-ideogram");
  if (!gate.ok) return gate.response;

  let ok = false;
  try {
    // Ideogram çıktısı çoğunlukla tek URL string; dizi gelirse yardımcı ilkini alır.
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
