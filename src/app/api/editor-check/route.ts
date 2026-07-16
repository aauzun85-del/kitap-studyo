import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// AI Editör — Aşama 2: yazım ve dilbilgisi kontrolü.
// Metni Claude'a gönderir; her öneri için "eski ifade + düzeltme + neden"
// döner. Karar kullanıcıda: arayüz her öneriyi tek tek Kabul/Yoksay yapar.
export const maxDuration = 60;

// Tek seferde çok uzun metni engelle (maliyet ve zaman aşımı koruması).
// Daha uzun kitaplar sonraki aşamada parça parça işlenecek.
const MAX_CHARS = 15000;

const Suggestion = z.object({
  original: z
    .string()
    .describe("Metinden BİREBİR kopyalanmış, hatayı içeren kısa ifade (1-8 kelime)."),
  suggestion: z.string().describe("Aynı ifadenin düzeltilmiş hâli."),
  category: z
    .enum(["spelling", "grammar"])
    .describe("Hatanın türü: spelling = yazım, grammar = dilbilgisi."),
  explanation: z
    .string()
    .describe("Düzeltmenin nedeni; metnin diliyle, tek kısa cümle."),
});

const CheckResult = z.object({
  suggestions: z.array(Suggestion),
});

type Body = { text?: string; lang?: string; mode?: "fast" | "deep" };

function systemPrompt(language: "tr" | "en"): string {
  const langName = language === "tr" ? "Türkçe" : "İngilizce";
  return [
    "Sen bir kitap redaktörüsün. Görevin, verilen metni YALNIZCA yazım ve",
    "dilbilgisi açısından kontrol etmek. Üslup, akıcılık ya da içerik önerisi",
    "YAPMA — sadece nesnel yazım ve dilbilgisi hatalarını yakala.",
    "",
    "Metni baştan sona, cümle cümle dikkatle tara. Özellikle şu hata türlerini",
    "kaçırma:",
    "- Yanlışlıkla TEKRARLANMIŞ kelimeler (örn. 'baktı baktı', 'the the').",
    "- Bitişik/ayrı yazım hataları: 'de/da' bağlacı, 'ki', 'mi' soru eki;",
    "  'yine de', 'belki de', 'oysa ki' gibi ayrı yazılması gerekenler.",
    "- Çift veya eksik harf (örn. 'kapıyıı', 'geldii').",
    "- Düşürülmüş/yanlış ek, özne-yüklem uyumsuzluğu.",
    "- Noktalama ve büyük/küçük harf hataları.",
    "",
    "Kurallar:",
    "1) Her hata için 'original' alanına, metinden BİREBİR kopyalanmış kısa",
    "   ifadeyi yaz (1-8 kelime). Harf, noktalama ve büyük/küçük harf aynı olsun.",
    "2) 'suggestion' alanına aynı ifadenin düzeltilmiş hâlini yaz.",
    "3) 'category': yazım hatası ise 'spelling', dilbilgisi hatası ise 'grammar'.",
    `4) 'explanation' alanını ${langName} dilinde, tek kısa cümleyle yaz.`,
    "5) Emin olmadığın yere dokunma. Doğru olanı 'hata' diye işaretleme.",
    "6) Yazarın üslubunu, kelime tercihini, cümle kuruluşunu değiştirme.",
    "7) Hata yoksa boş bir 'suggestions' listesi döndür.",
    "",
    "ÇOK ÖNEMLİ — yalnız KESİN hatalar:",
    "- Bir kullanım zaten dilbilgisi açısından doğruysa DOKUNMA; 'daha yaygın',",
    "  'daha şık' ya da 'bence daha iyi' türü alternatif önerme.",
    "- Anlatım kipini/zamanını değiştirme (örn. 'vermektedir' → 'verdik'):",
    "  bunlar üslup tercihidir, hata değildir.",
    "- İkili/simetrik kalıplarda (örn. 'en yüksekten en düşüğe') tek tarafı",
    "  değiştirip tutarsızlık yaratma; kalıbın bütünü doğruysa hiç önerme.",
    "- Her öneriden önce kendine sor: bu %100 nesnel bir hata mı, yoksa tercih mi?",
    "  Tercihse listeye ALMA. Az ama kesin öneri, çok ama tartışmalı öneriden iyidir.",
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
  // "deep" = en güçlü model (Opus, düşünme açık). Varsayılan "fast" = ekonomik
  // Haiku: yazım/dilbilgisi için yeterli ve çok daha ucuz.
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
      // Haiku 4.5 "effort" ve adaptif düşünmeyi desteklemez; yalnız Opus'ta açıyoruz.
      ...(deep ? { thinking: { type: "adaptive" as const } } : {}),
      output_config: deep
        ? { effort: "high" as const, format: zodOutputFormat(CheckResult) }
        : { format: zodOutputFormat(CheckResult) },
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
          content: `Aşağıdaki metni kontrol et:\n\n${text}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "parse-failed" }, { status: 502 });
    }

    return NextResponse.json({ suggestions: parsed.suggestions });
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
