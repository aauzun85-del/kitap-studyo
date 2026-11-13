import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chargeCredits } from "@/lib/credits/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// AI Editör — Aşama 7: türe göre özel kontrol. Seçilen türe (roman, kişisel
// gelişim, akademik) göre farklı tutarlılık/kalite başlıkları. Her gözlem
// advisory bir "notice" — otomatik düzeltme yok, karar kullanıcıda.
export const maxDuration = 60;
// Model çağrısının son süresi: fonksiyon süresinden (maxDuration) kısa → Vercel
// isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner ve jeton
// iadesi (finally) çalışır.
const UPSTREAM_TIMEOUT_MS = 50_000;

const MAX_CHARS = 15000;

const Note = z.object({
  excerpt: z
    .string()
    .describe(
      "İlgili kısa pasaj, metinden BİREBİR kopyalanmış (3-12 kelime); sorunun yerini göstermek için.",
    ),
  category: z
    .enum([
      "character",
      "timeline",
      "plot",
      "promise",
      "repetition",
      "action",
      "citation",
      "definition",
      "objectivity",
    ])
    .describe(
      "Roman: character/timeline/plot. Kişisel gelişim: promise/repetition/action. Akademik: citation/definition/objectivity.",
    ),
  issue: z
    .string()
    .describe("Sorunun kısa açıklaması; metnin diliyle, bir-iki cümle."),
  suggestion: z
    .string()
    .describe(
      "Somut iyileştirme önerisi; metnin diliyle, kısa. Öneri yoksa boş bırak.",
    ),
});

const GenreResult = z.object({
  notes: z.array(Note),
});

type Genre = "fiction" | "selfhelp" | "academic";
type Body = { text?: string; lang?: string; mode?: "fast" | "deep"; genre?: string };

function systemPrompt(language: "tr" | "en", genre: Genre): string {
  const langName = language === "tr" ? "Türkçe" : "İngilizce";
  const intro =
    "Sen deneyimli bir kitap editörüsün. Görevin, verilen metni TÜRE ÖZEL " +
    "açıdan değerlendirmek. Yazım, noktalama veya dilbilgisi hatası ARAMA — " +
    "onlar başka aşamada ele alınıyor.";

  let focus: string;
  if (genre === "fiction") {
    focus = [
      "Bu bir ROMAN / ÖYKÜ. Yalnız şu kurgu tutarlılığı başlıklarına bak:",
      "- character: karakter çelişkileri (isim, özellik, ilişki, davranış).",
      "- timeline: zaman çizgisi/olay sırası çelişkisi (zaman, mevsim, yaş, sıra).",
      "- plot: olay örgüsü boşluğu (açık kalan ipucu, çözülmeyen düğüm, mantık boşluğu).",
      "category yalnız: character, timeline veya plot.",
    ].join("\n");
  } else if (genre === "selfhelp") {
    focus = [
      "Bu bir KİŞİSEL GELİŞİM kitabı. Yalnız şu başlıklara bak:",
      "- promise: abartılı/garanti vaat ('kesinlikle', 'herkes', 'asla başarısız').",
      "- repetition: aynı tavsiyenin/fikrin gereksiz tekrarı.",
      "- action: bölüm okura somut bir adım/alıştırma vermeden bitiyorsa.",
      "category yalnız: promise, repetition veya action.",
    ].join("\n");
  } else {
    focus = [
      "Bu bir AKADEMİK metin. Yalnız şu başlıklara bak:",
      "- citation: kaynak/atıf gerektiren ama desteklenmemiş iddia.",
      "- definition: kavram tutarsızlığı veya tanımsız teknik terim.",
      "- objectivity: öznel, desteksiz genelleme.",
      "category yalnız: citation, definition veya objectivity.",
    ].join("\n");
  }

  return [
    intro,
    "",
    focus,
    "",
    "Kurallar:",
    "1) Her gözlem için 'excerpt' alanına, ilgili pasajı metinden BİREBİR",
    "   kopyala (3-12 kelime).",
    `2) 'issue' alanını ${langName} dilinde, bir-iki kısa cümleyle yaz.`,
    `3) 'suggestion' alanına ${langName} dilinde somut bir öneri yaz; yoksa boş bırak.`,
    "4) Yazarın üslubuna saygı göster; öznel zevk meselelerini sorun gibi gösterme.",
    "5) Yalnız gerçekten önemli, türe özgü noktalara değin. Zorlama gözlem üretme.",
    "6) Belirgin bir sorun yoksa boş bir 'notes' listesi döndür.",
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no-key" }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const text = (body.text ?? "").trim();
  const language: "tr" | "en" = body.lang === "en" ? "en" : "tr";
  const deep = body.mode === "deep";
  const genre: Genre =
    body.genre === "selfhelp"
      ? "selfhelp"
      : body.genre === "academic"
        ? "academic"
        : "fiction";

  if (!text) {
    return NextResponse.json({ error: "no-text" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "too-long", max: MAX_CHARS, length: text.length },
      { status: 413 },
    );
  }

  const gate = await chargeCredits("editor-genre");
  if (!gate.ok) return gate.response;

  const client = new Anthropic({ apiKey });

  // Toplam son süre; yeniden deneme yok (SDK beklemesi kesilemiyor). Kullanıcı vazgeçerse de kesilir.
  const deadline = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

  let ok = false;
  try {
    const response = await client.messages.parse({
      model: deep ? "claude-opus-4-7" : "claude-haiku-4-5",
      max_tokens: 16000,
      ...(deep ? { thinking: { type: "adaptive" as const } } : {}),
      output_config: deep
        ? { effort: "high" as const, format: zodOutputFormat(GenreResult) }
        : { format: zodOutputFormat(GenreResult) },
      system: [
        {
          type: "text",
          text: systemPrompt(language, genre),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Aşağıdaki metni türe özel açıdan incele:\n\n${text}`,
        },
      ],
    }, {
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRetries: 0,
      signal: AbortSignal.any([request.signal, deadline]),
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "parse-failed" }, { status: 502 });
    }

    ok = true;
    return NextResponse.json({ notes: parsed.notes });
  } catch (e) {
    // Kullanıcı vazgeçti ya da süre doldu → temiz hata (iade finally'de).
    if (request.signal.aborted) {
      return NextResponse.json({ error: "canceled" }, { status: 504 });
    }
    if (deadline.aborted || e instanceof Anthropic.APIConnectionTimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "bad-key" }, { status: 401 });
    }
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "rate-limit" }, { status: 429 });
    }
    return NextResponse.json(
      { error: "exception", detail: String(e).slice(0, 300) },
      { status: 500 },
    );
  } finally {
    if (!ok) await gate.refund();
  }
}
