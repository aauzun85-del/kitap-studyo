import { NextResponse } from "next/server";

// Nano Banana Pro (Google Gemini 3 Pro Image). Karmaşık komutları "düşünerek"
// izleyen, yazıyı en iyi basan üst düzey görsel modeli. Burada kapağı SIFIRDAN
// üretmek için kullanıyoruz (konu/açıklama → tam kapak sanatı). RESMİ model →
// model-scoped uç nokta (flux ile aynı desen).
const MODEL = "google/nano-banana-pro";
// Senkron bekleme (Prefer: wait) + "düşünme" uzun sürebilir → süreyi uzat.
export const maxDuration = 60;

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
    // Nano çıktısı tek bir URL string; yine de dizi gelirse ilkini al.
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
