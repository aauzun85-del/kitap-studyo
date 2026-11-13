import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// Kitap Tanıtımı — Aşama 4: Instagram için kare (1:1) tanıtım görseli.
// Kapak modülünün Replicate desenini izler (cover-art): FLUX 1.1 Pro ile kitabın
// konusuna/havasına uygun, yazısız ve atmosferik bir sosyal medya görseli üretir.
const MODEL = "black-forest-labs/flux-1.1-pro";
// Üretim bütçesi + görsel indirme, fonksiyon süresinin (maxDuration) İÇİNDE
// biter → Vercel isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner
// ve jeton iadesi (finally) çalışır.
export const maxDuration = 60;
const RUN_BUDGET_MS = 32_000;
// Üretim + indirme toplamı bu süreyi geçmesin (maxDuration'a ~10 sn pay).
const TOTAL_BUDGET_MS = 50_000;

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

  const gate = await chargeCredits("promo-image");
  if (!gate.ok) return gate.response;

  const startedAt = Date.now();
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

    // Görseli sunucuda indirip data URL'e çevir: link süresi dolmaz, indirme/önizleme sorunsuz.
    // İndirme, kalan süreyle sınırlı.
    const left = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    const img = await fetchImageAsDataUrl(run.output, Math.max(2_000, left));
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
