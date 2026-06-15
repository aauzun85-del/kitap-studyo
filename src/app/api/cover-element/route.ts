import { NextResponse } from "next/server";

// AI ile TASARIM ÖĞESİ üretimi (kapağın üstüne konacak şeffaf nesne):
// ör. "25. yıl mührü", rozet, amblem, süsleme, monogram.
// İKİ ADIM:
//   1) Nano Banana Pro (yazıyı en iyi basan model) öğeyi DÜZ BEYAZ zeminde üretir.
//   2) 851-labs/background-remover beyaz zemini siler → SAYDAM (rgba) PNG.
// Böylece öğe kapağın üzerine doğal/yapışık olmadan oturur.
const GEN_MODEL = "google/nano-banana-pro";
const BG_MODEL = "851-labs/background-remover";
// İki ardışık model çağrısı → süreyi uzat.
export const maxDuration = 120;

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

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "wait", // sonucu doğrudan bu istekte bekle
  };

  try {
    // --- 1) Öğeyi düz beyaz zeminde üret (Nano Banana Pro) ---
    const genRes = await fetch(
      `https://api.replicate.com/v1/models/${GEN_MODEL}/predictions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: {
            prompt: buildPrompt(desc),
            aspect_ratio: "1:1",
            // Tek bir öğe (mühür/rozet) için 1K fazlasıyla yeterli; 2K dosyayı
            // ~4× büyütüp autosave'i ağırlaştırır. Hafif + hızlı için 1K.
            resolution: "1K",
            output_format: "png",
            allow_fallback_model: true,
          },
        }),
      },
    );
    if (!genRes.ok) {
      const detail = (await genRes.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", stage: "generate", status: genRes.status, detail },
        { status: 502 },
      );
    }
    const genData = (await genRes.json()) as {
      status?: string;
      output?: unknown;
    };
    const genOut = Array.isArray(genData.output)
      ? genData.output[0]
      : genData.output;
    if (!genOut || typeof genOut !== "string") {
      return NextResponse.json(
        { error: "no-output", stage: "generate", status: genData.status ?? "unknown" },
        { status: 502 },
      );
    }

    // --- 2) Beyaz zemini sil → saydam (rgba) PNG ---
    // 851-labs/... bir TOPLULUK modeli; resmi modeller gibi model-scoped uç noktayı
    // (models/.../predictions) DESTEKLEMEZ → 404. Bunun yerine sürüm (version) ile
    // /v1/predictions çağrılır. Sürümü çalışma anında çözeriz (ileride değişirse
    // kod kendini onarır, sabit hash bayatlamaz).
    const verRes = await fetch(
      `https://api.replicate.com/v1/models/${BG_MODEL}`,
      { headers: { Authorization: `Bearer ${token}` } },
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

    const bgRes = await fetch(`https://api.replicate.com/v1/predictions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        version,
        input: {
          image: genOut, // 1. adımın çıktı URL'i (taze, doğrudan kabul edilir)
          format: "png",
          background_type: "rgba", // saydam zemin
        },
      }),
    });
    if (!bgRes.ok) {
      const detail = (await bgRes.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", stage: "background", status: bgRes.status, detail },
        { status: 502 },
      );
    }
    const bgData = (await bgRes.json()) as {
      status?: string;
      output?: unknown;
    };
    const bgOut = Array.isArray(bgData.output)
      ? bgData.output[0]
      : bgData.output;
    if (!bgOut || typeof bgOut !== "string") {
      return NextResponse.json(
        { error: "no-output", stage: "background", status: bgData.status ?? "unknown" },
        { status: 502 },
      );
    }

    // Saydam PNG'yi sunucuda indirip data URL'e çevir: link süresi dolmaz, tuval
    // çapraz-köken (CORS) yüzünden kirlenmez → PDF dışa aktarımı sorunsuz.
    const imgRes = await fetch(bgOut);
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
