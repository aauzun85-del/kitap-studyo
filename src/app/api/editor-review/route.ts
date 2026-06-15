import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildRulesBlock, buildMetaBlock } from "@/lib/editor/editorRules";

// AI Editör — Aşama 3: editöryal kalite + akıcı Türkçe üslup. Yazım/dilbilgisi
// DEĞİL; akış, paragraf mantığı, tekrar, üslup-ton VE Gold Translation Lab'den
// damıtılmış üslup kuralları (editor_rules_v1). Her gözlem bir "öneri"
// (advisory) — otomatik düzeltme yok; karar kullanıcıda.
export const maxDuration = 60;

const MAX_CHARS = 15000;

const Note = z.object({
  excerpt: z
    .string()
    .describe(
      "İlgili kısa pasaj, metinden BİREBİR kopyalanmış (3-12 kelime); sorunun yerini göstermek için.",
    ),
  category: z
    .enum([
      "fluency",
      "sentence_structure",
      "diction",
      "grammar",
      "dialogue",
      "concision",
      "clarity",
      "register",
      "punctuation",
    ])
    .describe(
      "Gözlemin ait olduğu kural kategorisi. fluency = doğal akış, sentence_structure = cümle yapısı, diction = sözcük seçimi, grammar = zaman/kip, dialogue = diyalog, concision = sadeleştirme/tekrar, clarity = netlik/gönderim, register = hitap/üslup düzeyi, punctuation = noktalama.",
    ),
  severity: z
    .enum(["hint", "suggest", "warn"])
    .describe(
      "Önem: warn = tutarlılık/netlik sorunu (önemli), suggest = iyileştirme önerisi, hint = hafif/opsiyonel dokunuş. İlgili kuralın önem düzeyini kullan.",
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

const ReviewResult = z.object({
  notes: z.array(Note),
});

type Body = { text?: string; lang?: string; mode?: "fast" | "deep" };

function systemPrompt(language: "tr" | "en"): string {
  const langName = language === "tr" ? "Türkçe" : "İngilizce";
  return [
    "Sen deneyimli bir kitap editörüsün. Görevin, verilen metni EDİTÖRYAL",
    "KALİTE ve AKICI ÜSLUP açısından değerlendirmek. Yazım, noktalama veya",
    "dilbilgisi YAZIM HATASI ARAMA — onlar başka bir aşamada ele alınıyor.",
    "",
    "Aşağıdaki kurallar, usta bir çeviri profilinden damıtılmış ve kör testle",
    "doğrulanmıştır. Her kural bir kategoriye ve önem düzeyine sahiptir; metinde",
    "bu kuralların tetiklendiği yerleri ara:",
    "",
    buildRulesBlock(),
    "",
    "ÇOK ÖNEMLİ — doku-duyarlı kalibrasyon (META):",
    buildMetaBlock(),
    "Yani: sade, yalın, gerilimi düşük pasajlarda üslup önerilerini KIS; her",
    "cümleye dokunma. Yazarın bilinçli üslubuna ve sesine saygı göster. Amaç",
    "metni süslemek değil, gerçekten güçlendirecek az sayıda isabetli dokunuş.",
    "",
    "Çıktı kuralları:",
    "1) Her gözlem için 'excerpt' alanına, ilgili pasajı metinden BİREBİR",
    "   kopyala (3-12 kelime). Yerini bulmaya yetecek kadar olsun.",
    "2) 'category': gözlemin ait olduğu kural kategorisi (fluency,",
    "   sentence_structure, diction, grammar, dialogue, concision, clarity,",
    "   register, punctuation).",
    "3) 'severity': ilgili kuralın önem düzeyi (hint, suggest veya warn).",
    `4) 'issue' alanını ${langName} dilinde, bir-iki kısa cümleyle yaz.`,
    `5) 'suggestion' alanına ${langName} dilinde somut bir iyileştirme öner;`,
    "   kuralın 'öneri yönü'nü temel al ama bu pasaja göre somutlaştır. Net",
    "   bir önerin yoksa boş bırak.",
    "6) Öneriler ZORLAMA değildir; gerekçeli birer ipucu olarak sun.",
    "7) Yalnız okunurluğu veya kaliteyi gerçekten artıracak, önemli noktalara",
    "   değin. Zorlama gözlem üretme.",
    "8) Belirgin bir sorun yoksa boş bir 'notes' listesi döndür.",
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

  if (!text) {
    return NextResponse.json({ error: "no-text" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "too-long", max: MAX_CHARS, length: text.length },
      { status: 413 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: deep ? "claude-opus-4-7" : "claude-haiku-4-5",
      max_tokens: 16000,
      ...(deep ? { thinking: { type: "adaptive" as const } } : {}),
      output_config: deep
        ? { effort: "high" as const, format: zodOutputFormat(ReviewResult) }
        : { format: zodOutputFormat(ReviewResult) },
      system: [
        {
          type: "text",
          text: systemPrompt(language),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Aşağıdaki metni editöryal kalite açısından incele:\n\n${text}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "parse-failed" }, { status: 502 });
    }

    return NextResponse.json({ notes: parsed.notes });
  } catch (e) {
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
  }
}
