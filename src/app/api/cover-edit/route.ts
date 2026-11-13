import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// FLUX Fill Pro: "içini doldurma" (inpainting) modeli. Görsel + maske + açıklama
// alır; maskede BEYAZ olan bölgeyi açıklamaya göre yeniden çizer, siyah olan yeri
// olduğu gibi korur. Kapaktaki bir nesneyi silmek/değiştirmek için kullanılır.
const MODEL = "black-forest-labs/flux-fill-pro";
// Üretim bütçesi + görsel indirme, fonksiyon süresinin (maxDuration) İÇİNDE
// biter → Vercel isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner
// ve jeton iadesi (finally) çalışır.
export const maxDuration = 60;
const RUN_BUDGET_MS = 32_000;
// Üretim + indirme toplamı bu süreyi geçmesin (maxDuration'a ~10 sn pay).
const TOTAL_BUDGET_MS = 50_000;

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

  const gate = await chargeCredits("cover-edit");
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

    // Görseli sunucuda indirip data URL'e çevir: link süresi dolmaz, tuval
    // çapraz-köken (CORS) yüzünden kirlenmez → PDF dışa aktarımı sorunsuz çalışır.
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
