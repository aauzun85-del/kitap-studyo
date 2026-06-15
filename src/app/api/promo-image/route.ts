import { NextResponse } from "next/server";

// Kitap Tanıtımı — Aşama 4: Instagram için kare (1:1) tanıtım görseli.
// Kapak modülünün Replicate desenini izler (cover-art): FLUX 1.1 Pro ile kitabın
// konusuna/havasına uygun, yazısız ve atmosferik bir sosyal medya görseli üretir.
const MODEL = "black-forest-labs/flux-1.1-pro";
// Prefer: wait ile senkron bekleme uzun sürebilir → fonksiyon süresini uzat.
export const maxDuration = 60;

const MAX_CHARS = 6000;

type Body = {
  title?: string;
  author?: string;
  genre?: string;
  audience?: string;
  summary?: string;
  tone?: string;
  lang?: string;
};

// Ton → görsel atmosfer eşlemesi (FLUX İngilizce komutla daha iyi sonuç verir).
const MOOD: Record<string, string> = {
  warm: "warm, cozy, hopeful, golden light",
  professional: "clean, refined, sophisticated, minimal",
  inspiring: "uplifting, luminous, aspirational",
  playful: "vibrant, whimsical, energetic, colorful",
  serious: "moody, dramatic, contemplative, cinematic",
};

function buildImagePrompt(b: Body): string {
  const mood = MOOD[b.tone ?? "warm"] ?? MOOD.warm;
  return [
    "A beautiful modern promotional illustration for a book,",
    "square 1:1 composition, elegant editorial poster aesthetic,",
    "tasteful negative space, cinematic lighting, rich harmonious colors,",
    `overall mood: ${mood}.`,
    b.genre ? `Book genre and feel: ${b.genre}.` : "",
    `Scene, atmosphere and themes inspired by this book: ${b.summary}`,
    "Highly detailed, tasteful, gallery quality.",
    "Absolutely no text, no letters, no words, no typography anywhere in the image.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "no-token" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const title = (body.title ?? "").trim();
  const summary = (body.summary ?? "").trim();
  if (!title || !summary) {
    return NextResponse.json({ error: "no-info" }, { status: 400 });
  }
  if (title.length + summary.length > MAX_CHARS) {
    return NextResponse.json({ error: "too-long" }, { status: 413 });
  }

  const input: Record<string, unknown> = {
    prompt: buildImagePrompt({ ...body, title, summary }),
    aspect_ratio: "1:1",
    output_format: "png",
    output_quality: 100,
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
          Prefer: "wait",
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

    // Görseli sunucuda indirip data URL'e çevir: link süresi dolmaz, indirme/önizleme sorunsuz.
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
