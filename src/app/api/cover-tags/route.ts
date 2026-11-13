import { NextResponse } from "next/server";
import { chargeCredits } from "@/lib/credits/server";

// RAM (Recognize Anything) + Grounded SAM: görseldeki nesneleri otomatik tanır ve
// virgülle ayrılmış etiketler (İngilizce) döndürür. Biz yalnız "tags" çıktısını
// kullanırız; kullanıcı bir etikete tıklayınca o etiket /api/cover-detect'e
// (translate:false) gönderilip maskelenir.
//
// Topluluk modeli → /v1/predictions + sabit versiyon hash. Güncellenirse yenile:
//   curl https://api.replicate.com/v1/models/idea-research/ram-grounded-sam \
//     -H "Authorization: Bearer $TOKEN"  → latest_version.id
const MODEL_VERSION =
  "80a2aede4cf8e3c9f26e96c308d45b23c350dd36f1c381de790715007f1ac0ad";
export const maxDuration = 60;
// Senkron bekleme (sn) ve toplam bütçe, fonksiyon süresinin (maxDuration) İÇİNDE
// kalır → Vercel isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner
// ve jeton iadesi (finally) çalışır.
const WAIT_SECONDS = 40;
const TOTAL_BUDGET_MS = 50_000;

type Body = { image?: string };

// Etiket listesini tek çağrıda İngilizceden Türkçeye çevirir (satır satır hizalı).
// Çeviri gelmezse İngilizce etiketler aynen kullanılır → özellik kırılmaz.
async function translateTags(tags: string[]): Promise<string[]> {
  if (tags.length === 0) return tags;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=" +
      encodeURIComponent(tags.join("\n"));
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return tags;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return tags;
    const joined = (data[0] as unknown[])
      .map((seg) => (Array.isArray(seg) ? String(seg[0] ?? "") : ""))
      .join("");
    const lines = joined.split("\n").map((s) => s.trim());
    // Satır sayısı tutmazsa güvenli tarafta kal: İngilizceyi döndür.
    return lines.length === tags.length ? lines : tags;
  } catch {
    return tags;
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
  if (!image) {
    return NextResponse.json({ error: "no-image" }, { status: 400 });
  }

  const gate = await chargeCredits("cover-tags");
  if (!gate.ok) return gate.response;

  // Bütün ağ çağrıları için ortak son süre; kullanıcı vazgeçerse de kesilir.
  const deadline = AbortSignal.timeout(TOTAL_BUDGET_MS);

  let ok = false;
  try {
    const signal = AbortSignal.any([request.signal, deadline]);
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: `wait=${WAIT_SECONDS}`,
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: { input_image: image },
      }),
      signal,
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return NextResponse.json(
        { error: "provider", status: res.status, detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      status?: string;
      output?: { tags?: string } | null;
      urls?: { cancel?: string };
    };

    // Senkron bekleme doldu ama iş hâlâ sürüyor → sağlayıcıda durdur (boşa
    // çalışmasın) ve temiz bir "zaman aşımı" dön.
    if (data.status === "starting" || data.status === "processing") {
      if (data.urls?.cancel) {
        await fetch(data.urls.cancel, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {});
      }
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }

    const raw = data.output?.tags ?? "";
    // "black, dog, floor" → ["black","dog","floor"] (tekrarları ve boşları ele).
    const seen = new Set<string>();
    const en: string[] = [];
    for (const part of raw.split(",")) {
      const tag = part.trim().toLowerCase();
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        en.push(tag);
      }
    }
    if (en.length === 0) {
      return NextResponse.json(
        { error: "no-output", status: data.status ?? "unknown" },
        { status: 502 },
      );
    }

    const tr = await translateTags(en);
    const tags = en.map((e, i) => ({ en: e, tr: tr[i] || e }));
    ok = true;
    return NextResponse.json({ tags });
  } catch (e) {
    // Kullanıcı vazgeçti ya da süre doldu → temiz hata (iade finally'de).
    if (request.signal.aborted) {
      return NextResponse.json({ error: "canceled" }, { status: 504 });
    }
    if (deadline.aborted || (e as Error)?.name === "TimeoutError") {
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
