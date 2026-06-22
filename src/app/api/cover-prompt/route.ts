import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// "Kitap asistanı": kitap bilgisinden (ad/yazar/tür/özet) bir KAPAK GÖRSEL
// art-direction'ı (İngilizce, metin/tipografi İÇERMEZ) + en uygun stil önerisi
// üretir. Bu çıktı sonra buildAiPrompt() ile Flux'a beslenir; başlık/yazar
// yazısını uygulamanın kendisi kapağın üstüne bindirir (görsele metin gömülmez).
export const maxDuration = 60;

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

const Schema = z.object({
  artDirection: z
    .string()
    .describe(
      "A vivid ENGLISH art-direction for the cover ILLUSTRATION ONLY: the imagery/subject, " +
        "mood, lighting, color palette and composition to paint. Describe a single evocative " +
        "scene or symbol that fits the book. ABSOLUTELY NO text, no typography, no title, no " +
        "lettering, no book-mockup wording — only what the picture shows. 1-3 sentences.",
    ),
  suggestedStyle: z
    .enum(STYLE_IDS)
    .describe(
      "The best matching cover style preset id for this book: literary, thriller, fantasy, " +
        "romance, children, minimal, nonfiction, or vintage.",
    ),
});

type Body = {
  title?: string;
  author?: string;
  genre?: string;
  summary?: string;
  lang?: string;
};

function systemPrompt(): string {
  return [
    "You are an experienced book-cover art director.",
    "From the given book info, write a single strong ART DIRECTION for the cover IMAGE.",
    "",
    "RULES:",
    "1) Output describes ONLY the picture: subject/imagery, mood, lighting, color palette, composition.",
    "2) NEVER include any text, words, title, author name, letters, typography or book-mockup wording in the art direction — the app draws the title/author separately on top.",
    "3) Pick a single clear, evocative focal idea that fits the book's genre and theme; avoid clutter.",
    "4) Leave a calm, simpler area near the top so a title can sit over it.",
    "5) Write the art direction in ENGLISH (image models follow English best), even if the book is Turkish.",
    "6) Also choose the single best matching style preset id from the allowed list.",
    "7) Do not invent specific plot facts; stay evocative and general if the summary is thin.",
  ].join("\n");
}

function buildUserPrompt(b: Body): string {
  return [
    `Book title: ${b.title}`,
    b.author ? `Author: ${b.author}` : "",
    b.genre ? `Genre: ${b.genre}` : "",
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
  // Özeti sınırla (maliyet + zaman aşımı koruması).
  const summary = (body.summary ?? "").trim().slice(0, MAX_CHARS);

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-7",
      max_tokens: 1200,
      output_config: { format: zodOutputFormat(Schema) },
      system: [
        {
          type: "text",
          text: systemPrompt(),
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
    return NextResponse.json(parsed);
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
