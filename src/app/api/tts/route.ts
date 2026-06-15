import { NextResponse } from "next/server";

// Metni sese çeviren rota (sesli kitap — yapay zekâ sesi). İKİ MOTOR desteklenir,
// ikisi de AYNI Replicate anahtarıyla (REPLICATE_API_TOKEN) çalışır:
//   - "minimax"    → minimax/speech-2.8-hd : stüdyo kalitesi, Türkçeye özel sesler.
//                    Daha hızlı/ucuz için "minimax/speech-2.8-turbo" (şema aynı).
//   - "elevenlabs" → elevenlabs/v3         : çok doğal/anlatımlı, 70+ dil.
// Her ikisi de RESMİ Replicate modeli → model-scoped endpoint + Prefer:wait
// (bkz. /api/cover-nano deseni). Çıktı tek bir URL (mp3) → Buffer → base64.
// Şema doğrulama: curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
//   https://api.replicate.com/v1/models/<owner>/<name>  → latest_version.
const MODELS = {
  minimax: "minimax/speech-2.8-hd",
  elevenlabs: "elevenlabs/v3",
} as const;
type Engine = keyof typeof MODELS;

export const maxDuration = 60;

// Motor başına tek istekte güvenli metin uzunluğu. Uzun bölümler cümle
// sınırından parçalanır, ses parçaları arka arkaya birleştirilir.
const MAX_CHARS: Record<Engine, number> = { minimax: 3500, elevenlabs: 2800 };
// Kazara çok uzun (tüm kitap) istek gelmesin diye toplam üst sınır.
const HARD_CAP = 60000;

type Body = { text?: string; voiceId?: string; speed?: number; engine?: string };

// Metni cümle sınırlarından maxChars'ı aşmayan parçalara böler.
function chunkText(text: string, maxChars: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return [clean];
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const parts: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length + 1 > maxChars) {
      parts.push(cur);
      cur = "";
    }
    cur = cur ? `${cur} ${s}` : s;
    // Tek cümle bile sınırı aşıyorsa zorla böl.
    while (cur.length > maxChars) {
      parts.push(cur.slice(0, maxChars));
      cur = cur.slice(maxChars);
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

// Motor başına Replicate girdisini kurar. Alan adları motora göre FARKLI:
//   MiniMax    : text / voice_id / speed (0.5–2) / language_boost
//   ElevenLabs : prompt / voice / speed (0.7–1.2) / language_code
function buildInput(
  engine: Engine,
  text: string,
  voiceId: string,
  speed: number,
): Record<string, unknown> {
  if (engine === "elevenlabs") {
    const s = Math.min(1.2, Math.max(0.7, speed)); // ElevenLabs v3 hız aralığı dar.
    return { prompt: text, voice: voiceId, speed: s, language_code: "tr" };
  }
  return { text, voice_id: voiceId, speed, language_boost: "Turkish" };
}

type SynthResult =
  | { ok: true; buf: Buffer }
  | { ok: false; error: string; status?: number; detail?: string };

async function synth(
  token: string,
  model: string,
  input: Record<string, unknown>,
): Promise<SynthResult> {
  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return { ok: false, error: "provider", status: res.status, detail };
    }
    const data = (await res.json()) as { status?: string; output?: unknown };
    const out = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!out || typeof out !== "string") {
      return { ok: false, error: "no-output", detail: data.status ?? "unknown" };
    }
    const audioRes = await fetch(out);
    if (!audioRes.ok) return { ok: false, error: "fetch-audio" };
    return { ok: true, buf: Buffer.from(await audioRes.arrayBuffer()) };
  } catch (e) {
    return { ok: false, error: "exception", detail: String(e).slice(0, 300) };
  }
}

export async function POST(request: Request) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return NextResponse.json({ error: "no-token" }, { status: 503 });

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "no-text" }, { status: 400 });
  if (text.length > HARD_CAP) return NextResponse.json({ error: "too-long" }, { status: 413 });

  const engine: Engine = body.engine === "elevenlabs" ? "elevenlabs" : "minimax";
  const model = MODELS[engine];
  const voiceId = body.voiceId || (engine === "elevenlabs" ? "Rachel" : "Calm_Woman");
  const speed =
    typeof body.speed === "number" && body.speed >= 0.5 && body.speed <= 2 ? body.speed : 1;

  const chunks = chunkText(text, MAX_CHARS[engine]);
  const buffers: Buffer[] = [];
  for (const c of chunks) {
    const r = await synth(token, model, buildInput(engine, c, voiceId, speed));
    if (!r.ok) {
      return NextResponse.json(
        { error: r.error, status: r.status, detail: r.detail },
        { status: 502 },
      );
    }
    buffers.push(r.buf);
  }

  // mp3 parçalarını arka arkaya ekle (TTS birleştirmede yaygın, oynatıcılar kabul
  // eder). Parça birleşim yerlerinde küçük pürüz olursa ileride yeniden kodlama
  // ile düzeltilebilir.
  const audio = Buffer.concat(buffers);
  const dataUrl = `data:audio/mpeg;base64,${audio.toString("base64")}`;
  return NextResponse.json({ audio: dataUrl });
}
