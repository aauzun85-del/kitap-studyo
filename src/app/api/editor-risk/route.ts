import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// AI Editör — Aşama 6: riskli içerik. Yazım/üslup DEĞİL; yalnız YAYIN/HUKUK
// açısından ciddi riskler. Her gözlem advisory bir "notice" — düzeltme yok,
// karar kullanıcıda. Hafif küfür/argo/gündelik hakaret BİLEREK göz ardı edilir.
export const maxDuration = 60;

const MAX_CHARS = 15000;

const Note = z.object({
  excerpt: z
    .string()
    .describe(
      "İlgili kısa pasaj, metinden BİREBİR kopyalanmış (3-12 kelime); riskin yerini göstermek için.",
    ),
  category: z
    .enum(["defamation", "privacy", "copyright", "claim", "misinfo"])
    .describe(
      "defamation = ağır hakaret/iftira, privacy = kişisel veri/mahremiyet, copyright = telifli uzun alıntı, claim = tıbbi/hukuki/finansal kesin iddia, misinfo = doğrulanmamış olgusal iddia.",
    ),
  issue: z
    .string()
    .describe("Riskin kısa açıklaması; metnin diliyle, bir-iki cümle."),
  suggestion: z
    .string()
    .describe(
      "Somut öneri (kaynak ekle, yumuşat, izin al, çıkar); metnin diliyle, kısa. Yoksa boş bırak.",
    ),
});

const RiskResult = z.object({
  notes: z.array(Note),
});

type Body = { text?: string; lang?: string; mode?: "fast" | "deep" };

function systemPrompt(language: "tr" | "en"): string {
  const langName = language === "tr" ? "Türkçe" : "İngilizce";
  return [
    "Sen deneyimli bir kitap yayın editörüsün. Görevin, verilen metni YAYIN ve",
    "HUKUK açısından RİSKLİ içerik için taramak. Yazım, üslup, akış veya kalite",
    "ARAMA — onlar başka aşamalarda ele alınıyor. Yalnız şu CİDDİ riskleri bildir:",
    "- Hakaret/iftira: GERÇEK ve tanınabilir bir kişi ya da kuruma yönelik,",
    "  kanıtlanmamış ağır suçlama veya küçük düşürme.",
    "- Kişisel veri: gerçek bir kişinin telefonu, adresi, kimlik/TC no, e-postası",
    "  veya özel sağlık bilgisi gibi mahremiyet ihlali.",
    "- Telif: başka bir eserden, şarkı sözünden vb. uzun, izinsiz birebir alıntı.",
    "- Kesin iddia: tıbbi, hukuki ya da finansal GARANTİ/kesinlik içeren iddialar",
    "  (örn. 'kesin iyileştirir', 'kesin kazandırır') — kaynak ya da uyarı ister.",
    "- Yanlış bilgi: kesinmiş gibi sunulan, doğrulanması gereken olgusal iddia.",
    "",
    "ÇOK ÖNEMLİ — şunları ASLA bildirme (bunlar risk DEĞİL):",
    "- 'salak', 'aptal', 'gerizekâlı' gibi gündelik, hafif hakaret veya argo.",
    "- Kurgusal karakterlere ya da genel/soyut ifadelere yönelik sözler.",
    "- Sıradan küfür veya kaba dil. Edebî/üslup tercihleri.",
    "Yalnız gerçekten yayımlanınca hukuki ya da etik sorun çıkarabilecek,",
    "önemli noktalara değin. Emin değilsen ve önemsizse BİLDİRME.",
    "",
    "Kurallar:",
    "1) Her gözlem için 'excerpt' alanına, ilgili pasajı metinden BİREBİR",
    "   kopyala (3-12 kelime).",
    "2) 'category': defamation, privacy, copyright, claim veya misinfo.",
    `3) 'issue' alanını ${langName} dilinde, bir-iki kısa cümleyle yaz.`,
    `4) 'suggestion' alanına ${langName} dilinde somut bir öneri yaz; yoksa boş bırak.`,
    "5) Belirgin bir risk yoksa boş bir 'notes' listesi döndür.",
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
        ? { effort: "high" as const, format: zodOutputFormat(RiskResult) }
        : { format: zodOutputFormat(RiskResult) },
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
          content: `Aşağıdaki metni riskli içerik açısından tara:\n\n${text}`,
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
