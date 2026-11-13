import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";
import { runReplicate, fetchImageAsDataUrl } from "@/lib/server/replicate";

// AI ile TASARIM ÖĞESİ üretimi (kapağın üstüne konacak şeffaf nesne):
// ör. "25. yıl mührü", rozet, amblem, süsleme, monogram.
// İKİ ADIM:
//   1) Nano Banana Pro (yazıyı en iyi basan model) öğeyi DÜZ BEYAZ zeminde üretir.
//   2) 851-labs/background-remover beyaz zemini siler → SAYDAM (rgba) PNG.
// Böylece öğe kapağın üzerine doğal/yapışık olmadan oturur.
const GEN_MODEL = "google/nano-banana-pro";
const BG_MODEL = "851-labs/background-remover";
// İki ardışık model çağrısı → süreyi uzat. Bütün adımlar ortak bir bütçeyi
// paylaşır ve fonksiyon süresinin (maxDuration) İÇİNDE biter → Vercel isteği
// ortadan kesmez; zaman aşımı temiz bir hata olarak döner, jeton iadesi çalışır.
export const maxDuration = 120;
const TOTAL_BUDGET_MS = 108_000; // bütün adımların toplamı
const GEN_BUDGET_MS = 55_000; // 1. adım (üretim)
const BG_BUDGET_MS = 30_000; // 2. adım (zemin silme) üst sınırı

type Body = {
  prompt?: string; // öğenin tarifi (kullanıcının yazdığı, ör. "25. yıl mührü")
  lang?: string;
};

// Kullanıcının (genelde Türkçe) tarifini, izole/şeffafa hazır güçlü bir İngilizce
// komuta sarmala. Tarifin kendisi AYNEN korunur ki üstündeki yazı (ör. "25. YIL")
// doğru yazılsın.
function buildPrompt(desc: string): string {
  return [
    `A single isolated graphic design element: ${desc}.`,
    "Centered composition, the element fully visible with generous empty margin around it.",
    "Plain solid flat WHITE background (#FFFFFF) — no scene, no surrounding objects,",
    "no drop shadow on the background, no gradient, no photo, no border frame around the canvas.",
    "Clean crisp vector-like edges, professional emblem / badge / seal / ornament quality,",
    "balanced and symmetrical, print-ready.",
    "If any text is specified, render it exactly as written, legibly and with correct spelling.",
  ]
    .filter(Boolean)
    .join(" ");
}

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
  const desc = (body.prompt ?? "").trim();
  if (!desc) {
    return NextResponse.json({ error: "no-prompt" }, { status: 400 });
  }

  const gate = await chargeCredits("cover-element");
  if (!gate.ok) return gate.response;

  // Ortak bütçe: her adım, kalan süreye göre kendi sınırını alır.
  const startedAt = Date.now();
  const left = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);
  // runReplicate sonucunu bu rotanın hata biçimine (stage ile) çevirir.
  const fail = (
    stage: string,
    run: { error: string; status?: number | string; detail?: string },
  ) =>
    NextResponse.json(
      { error: run.error, stage, status: run.status, detail: run.detail },
      { status: run.error === "timeout" || run.error === "canceled" ? 504 : 502 },
    );

  let ok = false;
  try {
    // --- 1) Öğeyi düz beyaz zeminde üret (Nano Banana Pro) ---
    const gen = await runReplicate({
      token,
      model: GEN_MODEL,
      input: {
        prompt: buildPrompt(desc),
        aspect_ratio: "1:1",
        // Tek bir öğe (mühür/rozet) için 1K fazlasıyla yeterli; 2K dosyayı
        // ~4× büyütüp autosave'i ağırlaştırır. Hafif + hızlı için 1K.
        resolution: "1K",
        output_format: "png",
        allow_fallback_model: true,
      },
      budgetMs: GEN_BUDGET_MS,
      signal: request.signal, // kullanıcı Vazgeç dedi → sağlayıcıda da durdur
    });
    if (!gen.ok) return fail("generate", gen);

    // --- 2) Beyaz zemini sil → saydam (rgba) PNG ---
    // 851-labs/... bir TOPLULUK modeli; resmi modeller gibi model-scoped uç noktayı
    // (models/.../predictions) DESTEKLEMEZ → 404. Bunun yerine sürüm (version) ile
    // /v1/predictions çağrılır. Sürümü çalışma anında çözeriz (ileride değişirse
    // kod kendini onarır, sabit hash bayatlamaz).
    const verRes = await fetch(
      `https://api.replicate.com/v1/models/${BG_MODEL}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!verRes.ok) {
      const detail = (await verRes.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", stage: "bg-version", status: verRes.status, detail },
        { status: 502 },
      );
    }
    const verData = (await verRes.json()) as {
      latest_version?: { id?: string };
    };
    const version = verData.latest_version?.id;
    if (!version) {
      return NextResponse.json(
        { error: "no-output", stage: "bg-version" },
        { status: 502 },
      );
    }

    // İkinci adıma yetecek süre kalmadıysa hiç başlatma (boşa para yakmayalım).
    if (left() < 30_000) {
      return NextResponse.json(
        { error: "timeout", stage: "background" },
        { status: 504 },
      );
    }
    const bg = await runReplicate({
      token,
      version,
      input: {
        image: gen.output, // 1. adımın çıktı URL'i (taze, doğrudan kabul edilir)
        format: "png",
        background_type: "rgba", // saydam zemin
      },
      // İndirmeye de süre kalsın diye kalan sürenin tamamını vermiyoruz.
      budgetMs: Math.min(BG_BUDGET_MS, left() - 25_000),
      signal: request.signal,
    });
    if (!bg.ok) return fail("background", bg);

    // Saydam PNG'yi sunucuda indirip data URL'e çevir: link süresi dolmaz, tuval
    // çapraz-köken (CORS) yüzünden kirlenmez → PDF dışa aktarımı sorunsuz.
    // İndirme, kalan süreyle sınırlı.
    const img = await fetchImageAsDataUrl(bg.output, Math.max(2_000, left()));
    if (!img.ok) {
      return NextResponse.json({ error: "fetch-image" }, { status: 502 });
    }
    ok = true;
    return NextResponse.json({ image: img.dataUrl });
  } catch (e) {
    // Sürüm sorgusu zaman aşımına uğradı → temiz "timeout".
    if ((e as Error)?.name === "TimeoutError") {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  } finally {
    if (!ok) await gate.refund();
  }
}
