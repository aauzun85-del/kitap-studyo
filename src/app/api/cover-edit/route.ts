import { NextResponse } from "next/server";

// FLUX Fill Pro: "içini doldurma" (inpainting) modeli. Görsel + maske + açıklama
// alır; maskede BEYAZ olan bölgeyi açıklamaya göre yeniden çizer, siyah olan yeri
// olduğu gibi korur. Kapaktaki bir nesneyi silmek/değiştirmek için kullanılır.
const MODEL = "black-forest-labs/flux-fill-pro";
// Senkron bekleme (Prefer: wait) uzun sürebilir → fonksiyon süresini uzat.
export const maxDuration = 60;

type Body = {
  image?: string; // data URL (orijinal kapak görseli)
  mask?: string; // data URL (beyaz = değiştir, siyah = koru)
  prompt?: string; // boyanan yere ne gelsin
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
  const image = (body.image ?? "").trim();
  const mask = (body.mask ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  if (!image || !mask) {
    return NextResponse.json({ error: "no-image" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ error: "no-prompt" }, { status: 400 });
  }

  // Modele gönderilecek girdi. image ve mask, data URL olarak doğrudan kabul edilir.
  const input: Record<string, unknown> = {
    image,
    mask,
    prompt,
    output_format: "png",
    // Açıklamayı modelin kendi içinde zenginleştirmesi → daha tutarlı sonuç.
    prompt_upsampling: true,
    safety_tolerance: 2,
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
