import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chargeCredits } from "@/lib/credits/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// "Kitap asistanı": kitap bilgisinden (ad/yazar/tür/özet) bir KAPAK GÖRSEL
// art-direction'ı (İngilizce, metin/tipografi İÇERMEZ) + en uygun stil önerisi
// üretir. Bu çıktı sonra buildAiPrompt() ile Flux'a beslenir; başlık/yazar
// yazısını uygulamanın kendisi kapağın üstüne bindirir (görsele metin gömülmez).
export const maxDuration = 60;
// Model çağrısının son süresi: fonksiyon süresinden (maxDuration) kısa → Vercel
// isteği ortadan kesmez; zaman aşımı temiz bir hata olarak döner ve jeton
// iadesi (finally) çalışır.
const UPSTREAM_TIMEOUT_MS = 50_000;

const MAX_CHARS = 8000;

const STYLE_IDS = [
  "literary",
  "thriller",
  "fantasy",
  "romance",
  "children",
  "minimal",
  "nonfiction",
  "vintage",
] as const;

const ART_FREE =
  "A vivid ENGLISH art-direction for the cover ILLUSTRATION ONLY: the imagery/subject, " +
  "mood, lighting, color palette and composition to paint. Describe a single evocative " +
  "scene or symbol that fits the book. ABSOLUTELY NO text, no typography, no title, no " +
  "lettering, no book-mockup wording — only what the picture shows. 1-3 sentences.";
// Kapak kurgusu: konsept (teknik/palet/kompozisyon) ZATEN seçili → asistan yalnız
// kitaba özgü ÖZNEYİ yazar; ayrı bir sahne/palet/ışık tarif ederse konsepti ezer.
const ART_IN_CONCEPT =
  "ENGLISH, 1-2 short sentences: ONLY the book-specific SUBJECT that should fill the given cover " +
  "concept — which single object, figure, place, plant, animal or symbol from THIS book goes where the " +
  "concept has its subject (replacing the concept's own example subject). Do NOT describe medium, " +
  "style, palette, colours, lighting, background or composition — the concept already fixes them. " +
  "If the concept is built around one symbol, emblem, mark or icon, that symbol IS the subject: describe this " +
  "book's own simple symbol (its shape) expressing the book's central idea — never the concept's example. " +
  "If the concept is purely typographic, pattern-based or abstract with no pictorial subject, write exactly " +
  "'No scene.' followed by one short clause on the book's mood. No text, title or lettering wording.";

const makeSchema = (inConcept: boolean) => z.object({
  artDirection: z.string().describe(inConcept ? ART_IN_CONCEPT : ART_FREE),
  suggestedStyle: z
    .enum(STYLE_IDS)
    .describe(
      "The best matching cover style preset id for this book: literary, thriller, fantasy, " +
        "romance, children, minimal, nonfiction, or vintage.",
    ),
  backCover: z
    .string()
    .describe(
      "A short back-cover blurb (2-4 sentences) IN THE BOOK'S OWN LANGUAGE (Turkish if the " +
        "book is Turkish): evocative and curiosity-evoking, hints at the theme without spoiling " +
        "the plot, polished and natural. A single short paragraph — this is printed on the back cover.",
    ),
});
const SchemaFree = makeSchema(false);
const SchemaInConcept = makeSchema(true);

type Body = {
  title?: string;
  author?: string;
  genre?: string;
  summary?: string;
  lang?: string;
  /** Kapak kurgusunda seçilen konseptin komutu (İngilizce). Varsa asistan
   *  sahne değil, konseptin içine girecek kitaba özgü ÖZNEYİ yazar. */
  concept?: string;
};

function systemPrompt(language: "tr" | "en", inConcept = false): string {
  const blurbLang = language === "tr" ? "Türkçe" : "English";
  if (inConcept) {
    return [
      "You are an experienced book-cover art director and copywriter.",
      "A COVER CONCEPT has already been chosen for this book. It fixes the medium, palette, lighting and composition of the cover.",
      "From the given book info, produce three things: the book-specific SUBJECT for that concept (artDirection), a style choice, and a BACK-COVER BLURB.",
      "",
      "RULES:",
      "1) artDirection names ONLY what this particular book contributes to the concept: the one object, figure, place or symbol that should stand where the concept has its subject. If the concept gives an example subject (\"e.g. …\"), propose this book's own equivalent of the SAME kind (a figure for a figure, a plant for a plant, a place for a place, an object for an object) in the same role and scale.",
      "2) NEVER describe medium, style, palette, colours, lighting, background or composition, and never propose a different kind of picture than the concept — the concept is fixed.",
      "3) A concept built around ONE symbol, emblem, mark, seal or icon is NOT abstract — the symbol is its subject: describe THIS book's own symbol (its simple shape and the idea it carries, e.g. for a book on patience: one long slow arc settling onto a single small point), in the concept's own visual language, and never reuse the concept's example symbol. Only if the concept has no pictorial subject at all (purely typographic, pattern-based or abstract — it says things like 'nothing else', 'no imagery', 'no objects'), write exactly 'No scene.' followed by one short clause on the book's mood, naming NO object.",
      "4) NEVER include any text, words, title, author name, letters or typography in artDirection.",
      "5) Write artDirection in ENGLISH, 1-2 short sentences, concrete and specific to this book; do not invent plot facts — if the summary is thin, derive the subject from the title and genre.",
      "6) Choose the single best matching style preset id from the allowed list.",
      `7) Write the backCover blurb in ${blurbLang} (the book's own language): 2-4 polished sentences, evocative, ` +
        "curiosity-evoking, no plot spoilers, flawless spelling and grammar. A single short paragraph.",
    ].join("\n");
  }
  return [
    "You are an experienced book-cover art director and copywriter.",
    "From the given book info, produce three things: a cover ART DIRECTION, a style choice, and a BACK-COVER BLURB.",
    "",
    "RULES:",
    "1) artDirection describes ONLY the picture: subject/imagery, mood, lighting, color palette, composition.",
    "2) NEVER include any text, words, title, author name, letters, typography or book-mockup wording in the art direction — the app draws the title/author separately on top.",
    "3) Pick a single clear, evocative focal idea that fits the book's genre and theme; avoid clutter.",
    "4) Leave a calm, simpler area near the top so a title can sit over it.",
    "5) Write the artDirection in ENGLISH (image models follow English best), even if the book is Turkish.",
    "6) Choose the single best matching style preset id from the allowed list.",
    `7) Write the backCover blurb in ${blurbLang} (the book's own language): 2-4 polished sentences, evocative, ` +
      "curiosity-evoking, no plot spoilers, flawless spelling and grammar. A single short paragraph.",
    "8) Do not invent specific plot facts; stay evocative and general if the summary is thin.",
  ].join("\n");
}

function buildUserPrompt(b: Body): string {
  return [
    `Book title: ${b.title}`,
    b.author ? `Author: ${b.author}` : "",
    b.genre ? `Genre: ${b.genre}` : "",
    b.concept ? `\nCHOSEN COVER CONCEPT (fixed — do not restate or alter it):\n${b.concept}` : "",
    b.summary ? "\nOpening / excerpt of the book (for theme only):\n" + b.summary : "",
  ]
    .filter(Boolean)
    .join("\n");
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
  if (!title) {
    return NextResponse.json({ error: "no-info" }, { status: 400 });
  }
  const language: "tr" | "en" = body.lang === "en" ? "en" : "tr";
  // Özeti sınırla (maliyet + zaman aşımı koruması).
  const summary = (body.summary ?? "").trim().slice(0, MAX_CHARS);
  const concept = (typeof body.concept === "string" ? body.concept : "").trim().slice(0, 3000);
  const inConcept = concept.length > 0;

  const gate = await chargeCredits("cover-prompt");
  if (!gate.ok) return gate.response;

  const client = new Anthropic({ apiKey });

  // Toplam son süre; yeniden deneme yok (SDK beklemesi kesilemiyor). Kullanıcı vazgeçerse de kesilir.
  const deadline = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

  let ok = false;
  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-7",
      max_tokens: 1200,
      output_config: { format: zodOutputFormat(inConcept ? SchemaInConcept : SchemaFree) },
      system: [
        {
          type: "text",
          text: systemPrompt(language, inConcept),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt({ ...body, title, summary, concept: inConcept ? concept : undefined }),
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
    return NextResponse.json(parsed);
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
