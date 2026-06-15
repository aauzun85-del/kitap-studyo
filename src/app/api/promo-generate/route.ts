import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Kitap Tanıtımı — Aşama 2+3: sosyal medya gönderileri + hashtag, basın bülteni
// ve satış sayfası metinleri (Amazon/KDP açıklaması + arka kapak yazısı) üretimi.
// Kullanıcının seçtiği malzemelere (materials) göre dinamik Zod şema + prompt
// kurar; yalnızca istenen malzemeler Claude'dan dönecek şekilde üretilir.
export const maxDuration = 60;

// Özet alanına çok uzun metin gelmesini engelle (maliyet + zaman aşımı koruması).
const MAX_CHARS = 6000;

type MaterialId = "social" | "press" | "sales";
const ALL_MATERIALS: MaterialId[] = ["social", "press", "sales"];

const SocialPost = z.object({
  platform: z
    .enum(["instagram", "x", "facebook"])
    .describe("Gönderinin yayınlanacağı platform."),
  text: z
    .string()
    .describe(
      "Platforma uygun, yayına hazır gönderi metni. Instagram: sıcak ve görsel, " +
        "emoji serbest, ~3-5 satır. X/Twitter: 280 karakteri geçmeyen, vurucu tek " +
        "mesaj. Facebook: orta uzunlukta, akıcı bir paragraf. Hashtag'leri BURAYA " +
        "yazma; onlar ayrı listede dönecek.",
    ),
});

// Tüm olası alanların tanımı; aşağıda yalnızca seçilen malzemelere ait olanlar
// alınarak dinamik bir Zod nesnesi kurulur.
const FIELD_DEFS = {
  posts: z
    .array(SocialPost)
    .describe("Her platform için bir gönderi: instagram, x, facebook."),
  hashtags: z
    .array(z.string())
    .describe(
      "Kitaba uygun 10-15 hashtag. Her biri # ile başlasın, boşluk içermesin.",
    ),
  pressRelease: z
    .string()
    .describe(
      "Yayına hazır, profesyonel bir basın/tanıtım bülteni. Çarpıcı bir başlık " +
        "satırıyla başla; ardından kitabın çıkışını duyuran 2-3 akıcı paragraf " +
        "(konu, tema, kitabı özel kılan yön, hedef okuyucu). Gazete, blog ve " +
        "yayınevlerine gönderilebilecek ölçülü ve güven veren bir dil kullan. " +
        "Paragrafları boş satırla ayır. Uydurma alıntı/istatistik EKLEME.",
    ),
  salesDescription: z
    .string()
    .describe(
      "Amazon/KDP kitap satış sayfası açıklaması. Okuyucuyu yakalayan güçlü bir " +
        "kanca cümlesiyle başla; kısa paragraflarla kitabın vaadini ve havasını " +
        "anlat; sonunda nazik bir okumaya/satın almaya teşvik. Akıcı, satışa " +
        "yönelik ama abartısız. Paragrafları boş satırla ayır.",
    ),
  backCover: z
    .string()
    .describe(
      "Kitabın arka kapağına basılacak kısa tanıtım yazısı (blurb). 2-4 cümle, " +
        "merak uyandıran, şiirsel-vurucu; olay örgüsünü ele vermeden okuru çeken. " +
        "Tek bir kısa paragraf.",
    ),
} as const;

function buildSchema(materials: MaterialId[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  if (materials.includes("social")) {
    shape.posts = FIELD_DEFS.posts;
    shape.hashtags = FIELD_DEFS.hashtags;
  }
  if (materials.includes("press")) {
    shape.pressRelease = FIELD_DEFS.pressRelease;
  }
  if (materials.includes("sales")) {
    shape.salesDescription = FIELD_DEFS.salesDescription;
    shape.backCover = FIELD_DEFS.backCover;
  }
  return z.object(shape);
}

type Body = {
  title?: string;
  author?: string;
  genre?: string;
  audience?: string;
  summary?: string;
  tone?: string;
  lang?: string;
  materials?: string[];
};

const TONE_TR: Record<string, string> = {
  warm: "samimi, sıcak ve içten",
  professional: "profesyonel, ölçülü ve güven veren",
  inspiring: "ilham verici, motive edici",
  playful: "eğlenceli, esprili ve enerjik",
  serious: "ciddi, ağırbaşlı ve net",
};

function materialInstructions(materials: MaterialId[]): string[] {
  const lines: string[] = [];
  if (materials.includes("social")) {
    lines.push(
      "SOSYAL MEDYA GÖNDERİLERİ (posts + hashtags):",
      "- Üç platform için BİRER gönderi üret (posts):",
      "  · instagram: sıcak, görsel ve duygusal; okuyucuyu çeken bir kanca ile başla;",
      "    emoji kullanabilirsin; 3-5 kısa satır; sonunda nazik bir eyleme çağrı.",
      "  · x: tek, vurucu mesaj; en fazla 280 karakter; abartısız ama dikkat çekici.",
      "  · facebook: akıcı, orta uzunlukta tek paragraf; biraz daha açıklayıcı.",
      "- Ayrıca 10-15 hashtag üret (hashtags). Her biri tek kelime/öbek, # ile",
      "  başlasın, boşluk içermesin; gönderi metinlerinin içine hashtag KOYMA.",
      "",
    );
  }
  if (materials.includes("press")) {
    lines.push(
      "BASIN / TANITIM BÜLTENİ (pressRelease):",
      "- Çarpıcı bir başlık satırı + kitabın çıkışını duyuran 2-3 akıcı paragraf.",
      "- Gazete/blog/yayınevlerine gönderilebilecek profesyonel, güven veren dil.",
      "",
    );
  }
  if (materials.includes("sales")) {
    lines.push(
      "SATIŞ SAYFASI METİNLERİ (salesDescription + backCover):",
      "- salesDescription: Amazon/KDP açıklaması; güçlü kanca + kısa paragraflar +",
      "  nazik teşvik.",
      "- backCover: arka kapak için 2-4 cümlelik kısa, merak uyandıran tanıtım yazısı.",
      "",
    );
  }
  return lines;
}

// Dil kalitesi kuralları — özellikle Türkçe imla/dilbilgisi için sıkı talimatlar.
// Hafif modellerde görülen yazım hatalarını ve kopuk cümleleri engellemeyi hedefler.
function qualityRules(language: "tr" | "en"): string[] {
  if (language === "tr") {
    return [
      "DİL KALİTESİ — ÇOK ÖNEMLİ (Türkçe):",
      "- Kusursuz Türkçe imla ve dilbilgisi kullan; metni bir editör gözden geçirmiş",
      "  gibi yaz. Yazım hatası, harf düşmesi veya yanlış yazılmış sözcük BIRAKMA",
      "  (ör. doğrusu: gazeteci, sekreter, yalnız, herhangi, yanlış).",
      "- Her cümle tam, dilbilgisel olarak doğru ve anlamlı olsun; yarım, kopuk,",
      "  devrik veya eksik cümle yazma.",
      "- Türkçe karakterleri (ç, ğ, ı, İ, ö, ş, ü) her zaman doğru kullan.",
      "- Özel adları (kişi, kitap, yer) doğru ve tutarlı yaz; harflerini değiştirme.",
      "- Gereksiz yabancı sözcüklerden kaçın; yaygın ve doğru Türkçe karşılığını kullan.",
      "- Noktalama işaretlerini (virgül, nokta, kesme işareti) kurallara uygun kullan.",
      "- Metni teslim etmeden ÖNCE kendi içinde bir kez gözden geçir; hata varsa düzelt.",
      "",
    ];
  }
  return [
    "LANGUAGE QUALITY — IMPORTANT (English):",
    "- Use flawless spelling and grammar; write as if proofread by an editor.",
    "- Every sentence must be complete and correct; no broken or half sentences.",
    "- Proofread your text once before delivering and fix any mistakes.",
    "",
  ];
}

function systemPrompt(
  language: "tr" | "en",
  tone: string,
  materials: MaterialId[],
): string {
  const langName = language === "tr" ? "Türkçe" : "İngilizce";
  const toneDesc = TONE_TR[tone] ?? TONE_TR.warm;
  return [
    "Sen deneyimli bir kitap pazarlama uzmanı ve titiz bir Türkçe editörüsün.",
    "Görevin, verilen kitap bilgilerinden istenen tanıtım malzemelerini üretmek.",
    "",
    `Tüm metinleri ${langName} dilinde yaz.`,
    `İstenen ton: ${toneDesc}.`,
    "",
    ...qualityRules(language),
    "Üreteceğin malzemeler ve kuralları:",
    "",
    ...materialInstructions(materials),
    "Genel kurallar:",
    "1) Yalnızca verilen bilgilere sadık kal; kitapta olmayan olay/özellik UYDURMA.",
    "2) Klişe ve abartılı vaatlerden kaçın; doğal ve inandırıcı yaz.",
    "3) Kitap adını ve (verildiyse) yazar adını uygun yerlerde kullan.",
    "4) YALNIZCA istenen alanları doldur; istenmeyen malzeme için içerik üretme.",
  ].join("\n");
}

// Hashtag'leri kurallı ve tutarlı biçime getir (kod tarafında, modelden bağımsız).
// - Tek '#' ile başlat, boşluk/noktalama/emoji temizle
// - Çok kelimeliyi PascalCase birleştir (özel adları BÖLMEDEN)
// - Zaten birleşik/PascalCase olanların iç büyük harflerini koru
// - Tekrarları (büyük/küçük harf duyarsız) ele, en fazla 15 tane döndür
function normalizeHashtags(raw: unknown, language: "tr" | "en"): string[] {
  if (!Array.isArray(raw)) return [];
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().replace(/^#+/, "").trim();
    if (!cleaned) continue;
    // Harf/rakam dışındaki her şeyi ayraç say (Türkçe harfler dahil korunur).
    const words = cleaned.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (words.length === 0) continue;
    // Her kelimenin yalnız ilk harfini büyüt; gerisini koru (iç büyük harfler kalsın).
    const pascal = words
      .map((w) => w.charAt(0).toLocaleUpperCase(locale) + w.slice(1))
      .join("");
    if (!pascal) continue;
    const key = pascal.toLocaleLowerCase(locale);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push("#" + pascal);
    if (out.length >= 15) break;
  }
  return out;
}

function buildUserPrompt(b: Body): string {
  const lines = [
    `Kitap adı: ${b.title}`,
    b.author ? `Yazar: ${b.author}` : "",
    b.genre ? `Tür: ${b.genre}` : "",
    b.audience ? `Hedef okuyucu: ${b.audience}` : "",
    "",
    "Kısa özet / konu:",
    b.summary,
  ].filter(Boolean);
  return lines.join("\n");
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

  const title = (body.title ?? "").trim();
  const summary = (body.summary ?? "").trim();
  const language: "tr" | "en" = body.lang === "en" ? "en" : "tr";
  const tone = (body.tone ?? "warm").trim();

  // İstenen malzemeleri doğrula; geçersizleri ele, boşsa varsayılan sosyal medya.
  const requested = Array.isArray(body.materials) ? body.materials : [];
  let materials = ALL_MATERIALS.filter((m) => requested.includes(m));
  if (materials.length === 0) materials = ["social"];

  if (!title || !summary) {
    return NextResponse.json({ error: "no-info" }, { status: 400 });
  }
  const totalLen = title.length + summary.length;
  if (totalLen > MAX_CHARS) {
    return NextResponse.json(
      { error: "too-long", max: MAX_CHARS, length: totalLen },
      { status: 413 },
    );
  }

  const client = new Anthropic({ apiKey });
  const schema = buildSchema(materials);

  try {
    const response = await client.messages.parse({
      // Tanıtım metinleri doğrudan satışı etkilediği için en güçlü modeli
      // kullanırız (kusursuz Türkçe imla/dilbilgisi). Hafif Haiku'da görülen
      // yazım hataları (ör. "gazeteçi", kopuk cümleler) bu modelde oluşmaz.
      model: "claude-opus-4-7",
      max_tokens: 6000,
      output_config: { format: zodOutputFormat(schema) },
      system: [
        {
          type: "text",
          text: systemPrompt(language, tone, materials),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt({ ...body, title, summary }),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: "parse-failed" }, { status: 502 });
    }

    // Hashtag'leri kod tarafında kurallı biçime getir (tutarlı, özel adları bölmeyen).
    const result = parsed as Record<string, unknown>;
    if (Array.isArray(result.hashtags)) {
      result.hashtags = normalizeHashtags(result.hashtags, language);
    }

    return NextResponse.json(result);
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
