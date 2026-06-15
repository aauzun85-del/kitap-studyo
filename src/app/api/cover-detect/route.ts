import { NextResponse } from "next/server";

// Grounded SAM: metinle nesne bulma + maskeleme. Kullanıcı "piggy bank" gibi bir
// nesne adı yazar; model görselde o nesneyi bulup BEYAZ olduğu bir maske döndürür.
// Bu maske sonra "boya & değiştir" (flux-fill) akışına verilir → fırçasız seçim.
//
// Bu bir TOPLULUK modeli (resmi değil) → resmi modellerin /v1/models/.../predictions
// adresi 404 verir. Bunun yerine /v1/predictions + sabit versiyon hash kullanılır.
// Model güncellenirse bu hash'i yenilemek gerekir:
//   curl https://api.replicate.com/v1/models/schananas/grounded_sam \
//     -H "Authorization: Bearer $TOKEN"  → latest_version.id
const MODEL_VERSION =
  "ee871c19efb1941f55f66a3d7d960428c8a5afcb77449547fe8e5a3ab9ebc21c";
export const maxDuration = 60;

type Body = {
  image?: string; // data URL (kapak görseli)
  label?: string; // aranan nesne (Türkçe de olabilir; arka planda çevrilir)
  adjustment?: number; // maske büyüt(+)/küçült(-) faktörü
  translate?: boolean; // false → label zaten İngilizce, çeviri atlanır (etiket tıklaması)
};

// Kullanıcı Türkçe yazabilsin diye nesne adını sessizce İngilizceye çevirir.
// Model (Grounding DINO) İngilizce kelimelerle çok daha iyi buluyor. Google'ın
// anahtarsız çeviri ucu kullanılır (tek kelimelerde isabetli). Yanıt gelmezse
// orijinal kelimeyle devam ederiz → özellik asla kırılmaz.
async function translateToEnglish(text: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=en&dt=t&q=" +
      encodeURIComponent(text);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return text;
    // Yanıt iç içe dizidir: [[["dog","köpek",...]], ...] → segmentlerin [0]'ını birleştir.
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return text;
    const out = (data[0] as unknown[])
      .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? "") : ""))
      .join("")
      .trim();
    return out.length > 0 ? out : text;
  } catch {
    return text;
  }
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
  const image = (body.image ?? "").trim();
  const label = (body.label ?? "").trim();
  if (!image) {
    return NextResponse.json({ error: "no-image" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "no-label" }, { status: 400 });
  }

  // Türkçe yazıldıysa İngilizceye çevir (model İngilizcede çok daha isabetli).
  // Etiket tıklamasında label zaten İngilizce → translate:false ile çeviri atlanır.
  const englishLabel =
    body.translate === false ? label : await translateToEnglish(label);
  // Maske büyüt/küçült: -ve erozyon, +ve genişletme. Makul aralığa sıkıştır.
  const adjustment = Math.max(-30, Math.min(60, Math.round(body.adjustment ?? 0)));

  const input: Record<string, unknown> = {
    image,
    mask_prompt: englishLabel,
    negative_mask_prompt: "",
    adjustment_factor: adjustment,
  };

  try {
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ version: MODEL_VERSION, input }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", status: res.status, detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { status?: string; output?: unknown };
    // Çıktı dizisi: [annotated, neg_annotated, mask, inverted_mask].
    // 3. eleman (index 2) bizim istediğimiz ikili maske (beyaz = bulunan nesne).
    const arr = Array.isArray(data.output)
      ? (data.output as unknown[])
      : data.output
        ? [data.output]
        : [];
    const maskUrl = (arr.length >= 3 ? arr[2] : arr[arr.length - 1]) as
      | string
      | undefined;
    if (!maskUrl || typeof maskUrl !== "string") {
      return NextResponse.json(
        { error: "no-output", status: data.status ?? "unknown" },
        { status: 502 },
      );
    }

    // Maskeyi sunucuda indirip data URL'e çevir (link süresi/CORS sorunsuz).
    const imgRes = await fetch(maskUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "fetch-image" }, { status: 502 });
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const ct = imgRes.headers.get("content-type") || "image/png";
    const dataUrl = `data:${ct};base64,${buf.toString("base64")}`;
    return NextResponse.json({ mask: dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  }
}
