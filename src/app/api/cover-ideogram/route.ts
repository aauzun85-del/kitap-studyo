import { NextResponse } from "next/server";

// Ideogram v3 (Quality). Tipografi/yazıyı en temiz basan modellerden biri →
// başlık/yazar adını görselin içine "gömme" için çok uygun. Sağlayıcı veya
// kademe (turbo/balanced/quality) değişirse yalnız bu satır değişir.
const MODEL = "ideogram-ai/ideogram-v3-quality";
// Senkron bekleme (Prefer: wait) + yüksek kalite uzun sürebilir → süreyi uzat.
export const maxDuration = 60;

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
    // Ideogram çıktısı çoğunlukla tek URL string; dizi gelirse ilkini al.
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
