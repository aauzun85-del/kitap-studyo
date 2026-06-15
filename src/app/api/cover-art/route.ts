import { NextResponse } from "next/server";

// FLUX 1.1 Pro (yüksek kalite / sanatsal). Sağlayıcıyı veya modeli değiştirmek
// istersek yalnız bu dosya değişir. Hızlı/ucuz alternatif: "flux-schnell".
const MODEL = "black-forest-labs/flux-1.1-pro";
// Prefer: wait ile senkron bekleme uzun sürebilir → fonksiyon süresini uzat.
export const maxDuration = 60;

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

  try {
    const res = await fetch(
      `https://api.replicate.com/v1/models/${MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait", // sonucu doğrudan bu istekte bekle
        },
        body: JSON.stringify({ input }),
      },
    );

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", status: res.status, detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { status?: string; output?: unknown };
    const out = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!out || typeof out !== "string") {
      return NextResponse.json(
        { error: "no-output", status: data.status ?? "unknown" },
        { status: 502 },
      );
    }

    // Görseli sunucuda indirip data URL'e çevir: link süresi dolmaz, tuval
    // çapraz-köken (CORS) yüzünden kirlenmez → PDF dışa aktarımı sorunsuz çalışır.
    const imgRes = await fetch(out);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "fetch-image" }, { status: 502 });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    return NextResponse.json({ image: dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  }
}
