// AI kapak görseli için stil presetleri.
// Her preset, görsel servisine gönderilecek İNGİLİZCE bir komut (prompt) taşır;
// adı kullanıcıya kendi dilinde gösterilir. Komutlarda bilinçli olarak "metin yok"
// vurgusu var — başlık/yazar yazısını uygulamanın kendisi bindirir.

export type AiStyle = {
  id: string;
  name: { tr: string; en: string };
  prompt: string;
  /** Konsept doğası gereği koyu (gerilim gibi) → "açık palet" kuralı uygulanmaz. */
  dark?: boolean;
};

// Görsel üretim sağlayıcıları. "openai" = ChatGPT görsel modeli (gpt-image);
// yerleşim kurallarını en iyi izleyen, bu yüzden katmanlı komutla kullanılan model.
export type AiModel = "flux" | "nano" | "ideogram" | "openai";

// Her komutun sonuna eklenen ortak kurallar. ÇOK önemli: yapay zekanın bir kitap
// maketi/fotoğrafı değil, düz (flat) ve kenardan kenara dolu bir SANAT ESERİ üretmesi
// ve üstüne yazı koymaması için güçlü negatifler içerir.
export const AI_PROMPT_SUFFIX =
  "flat 2D full-bleed cover artwork filling the entire frame edge to edge, " +
  "painting or illustration only, highly detailed, rich composition, " +
  "absolutely no text, no letters, no words, no title, no typography, no logo, no numbers, " +
  "not a book mockup, not a 3D book, not a product photo, no book object, " +
  "no spine, no frame, no border, leave a calm area near the top for a title";

// Tam sarmal (arka+sırt+ön) üretiminde eklenen kompozisyon ipucu: tek kesintisiz
// sahne, ana odak SAĞ üçte-birde (ön kapak), sol taraf (arka kapak) sakin.
// NOT: Daha ayrıntılı "sağ yarının ortasında + sırt bandı boş" tarifi denendi
// ve FLUX'ta GERİLEME yaptı (özne tam ortaya/sola kaydı) — kullanıcı "önceki
// sürüm daha iyiydi" dedi. Kanıtlanmış kısa kalıp + tek kısa sırt güvencesi.
export const AI_WRAP_HINT =
  "ultra-wide panoramic flat artwork, one continuous seamless scene across the " +
  "full width, cohesive horizon and lighting, main focal subject placed on the " +
  "right third, nothing important at the exact horizontal center, " +
  "calmer simpler open space on the left third, balanced cinematic composition";

// Yalnız ön kapak üretiminde eklenen kompozisyon ipucu: dikkat çekici özne
// kadrajın ortasında (kullanıcının açıklaması aksini söylemedikçe).
export const AI_FRONT_HINT =
  "unless the art direction says otherwise, place the main eye-catching subject " +
  "centered in the frame, slightly below the middle, clearly visible";

export const AI_STYLES: AiStyle[] = [
  {
    id: "literary",
    name: { tr: "Edebi / Roman", en: "Literary" },
    prompt:
      "atmospheric literary novel cover, painterly and evocative, sophisticated " +
      "muted color palette, soft light, emotional and timeless mood",
  },
  {
    id: "thriller",
    name: { tr: "Polisiye / Gerilim", en: "Thriller" },
    prompt:
      "dark moody crime thriller cover, cinematic noir lighting, high contrast, " +
      "mysterious and tense atmosphere, deep shadows",
    dark: true,
  },
  {
    id: "fantasy",
    name: { tr: "Fantastik", en: "Fantasy" },
    prompt:
      "epic fantasy cover, dramatic magical landscape, glowing light, " +
      "rich detailed illustration, sense of wonder and adventure",
  },
  {
    id: "romance",
    name: { tr: "Romantik", en: "Romance" },
    prompt:
      "romantic novel cover, soft dreamy mood, warm golden light, " +
      "delicate and elegant, gentle bokeh",
  },
  {
    id: "children",
    name: { tr: "Çocuk", en: "Children's" },
    prompt:
      "whimsical children's cover art illustration, warm and friendly, " +
      "bright cheerful colors, playful hand-drawn style",
  },
  {
    id: "minimal",
    name: { tr: "Minimalist", en: "Minimalist" },
    prompt:
      "minimalist modern cover art, clean and elegant, lots of negative space, " +
      "refined simple shapes, sophisticated single accent color",
  },
  {
    id: "nonfiction",
    name: { tr: "Kişisel Gelişim / Kurgu Dışı", en: "Non-fiction" },
    prompt:
      "modern non-fiction cover art, bold clean geometric design, " +
      "confident contemporary palette, professional and trustworthy",
  },
  {
    id: "vintage",
    name: { tr: "Vintage / Klasik", en: "Vintage" },
    prompt:
      "vintage classic cover art, aged paper texture, retro illustration, " +
      "warm nostalgic tones, hand-crafted feel",
  },
];

export const DEFAULT_AI_STYLE_ID = "literary";

export function getAiStyle(id: string): AiStyle {
  return AI_STYLES.find((s) => s.id === id) ?? AI_STYLES[0];
}

// Stil + kullanıcı açıklaması + ortak kuralları tek komutta birleştirir.
// wrap=true ise sarmal kompozisyon ipucu da eklenir.
export function buildAiPrompt(
  styleId: string,
  description: string,
  wrap = false,
): string {
  const style = getAiStyle(styleId);
  const desc = description.trim();
  const parts = [style.prompt];
  if (desc) parts.push(desc);
  parts.push(wrap ? AI_WRAP_HINT : AI_FRONT_HINT);
  parts.push(AI_PROMPT_SUFFIX);
  return parts.join(". ");
}

// Nano Banana Pro için TAM kapak komutu: başlık/yazar/altbaşlık METNİNİ görselin
// İÇİNE okunaklı tipografiyle bastırır (Nano'nun en güçlü yanı yazı). "Yazı yok"
// negatifleri YOK; yerine net, doğru yazılmış, iyi yerleştirilmiş metin istenir.
export function buildNanoCoverPrompt(opts: {
  styleId: string;
  description: string;
  title: string;
  author: string;
  subtitle?: string;
  wrap?: boolean;
}): string {
  const style = getAiStyle(opts.styleId);
  const desc = opts.description.trim();
  const title = opts.title.trim();
  const author = opts.author.trim();
  const subtitle = (opts.subtitle ?? "").trim();

  // ÖNEMLİ: Düz (flat), kenardan kenara dolu, MAKET DEĞİL bir kapak sanatı.
  // Lider cümle bunu en başta net söyler; en sonda güçlü negatiflerle pekiştirilir.
  // "the artwork itself extends to all four edges" → Nano'nun tasarımı küçük bir
  // dikdörtgen olarak zemine oturtup etrafına renkli paspartu/çerçeve koymasını engeller.
  const parts = [
    "Flat 2D book cover artwork, full-bleed: the illustration and background " +
      "extend all the way to all four edges with no surrounding mat, no colored " +
      "border band, no passe-partout, no inner panel or inset rectangle. " +
      "The art fills 100% of the canvas edge to edge",
  ];

  // Kullanıcının açıklaması SADECE görsel/atmosfer yönlendirmesidir (metin değil).
  // Olumlu çerçeve: "şunu çiz" deriz; "bu cümleyi kapağa basma" demeyi beyaz listeye
  // bırakırız. Böylece açıklama metin olarak sızmaz ama negatif yığını görseli bozmaz.
  if (desc)
    parts.push(
      `art direction describing the imagery, mood and colors to paint (not text): ${desc}`,
    );

  // Hazır stil yalnızca genel sanat yönü olarak; açıklama varsa ona tabi.
  parts.push(`overall art direction: ${style.prompt}`);
  if (desc) {
    parts.push(
      "if the instructions specify colors, mood or details, prioritize them over the general style",
    );
  }
  if (opts.wrap) parts.push(AI_WRAP_HINT);

  // Metin talimatları — tırnak içinde BİREBİR yazılması istenir (çeviri YOK).
  // Konumlar da net verilir: sarmal üretimde tüm yazılar SAĞ YARIDA (ön kapak);
  // en alt-orta şerit yayınevi logosuna AYRILIR (sonradan uygulama bindirir).
  const front = opts.wrap ? "of the right half (the front cover)" : "of the cover";
  if (title) {
    parts.push(
      `the book title "${title}" displayed prominently, horizontally centered in the upper third ${front}, ` +
        `in large, elegant, perfectly legible typography that matches the mood`,
    );
  }
  if (subtitle) {
    parts.push(`a smaller subtitle "${subtitle}" directly beneath the title, centered`);
  }
  if (author) {
    parts.push(
      `the author name "${author}" in smaller refined type, horizontally centered in the lower quarter ${front} — ` +
        `but NOT at the very bottom edge`,
    );
  }
  parts.push(
    `keep the bottom strip ${front} (roughly the bottom 8 percent) completely free of text ` +
      `and busy detail — the publisher's logo will be placed there afterwards`,
  );
  if (opts.wrap) {
    parts.push(
      "no text at all on the left half (the back cover) or on the narrow center spine strip",
    );
  }

  // Beyaz liste (olumlu): yalnızca başlık/altbaşlık/yazar metin olarak yazılsın,
  // geri kalan her yer yazısız kalsın. Açıklamanın metne dönüşmesini bu önler.
  const allowed = [title, subtitle, author]
    .filter(Boolean)
    .map((s) => `"${s}"`)
    .join(", ");
  if (allowed) {
    parts.push(
      `render only these words as text, spelled exactly: ${allowed}; ` +
        `keep the rest of the cover free of any other writing`,
    );
  }

  parts.push(
    "crisp, correctly spelled typography well integrated with the art, balanced composition. " +
      "A single flat full-bleed illustration that fills the whole canvas and bleeds off all " +
      "four edges — not a 3D book mockup, not a product photo, not a framed inset on a backdrop, " +
      "no border, no margins, no watermark",
  );
  return parts.join(". ");
}

// Tam sarmal üretim için kitabın gerçek spread oranına en yakın görsel boyutunu
// hesaplar. FLUX 1.1 Pro "custom" modunda 256–1440 px arası, 32'nin katı boyut
// kabul eder; en uzun kenarı 1440'a sabitleyip diğerini orana göre buluruz.
export function spreadCustomDims(
  widthMm: number,
  heightMm: number,
): { width: number; height: number } {
  const MAX = 1440;
  const MIN = 256;
  const STEP = 32;
  const clamp32 = (n: number) =>
    Math.max(MIN, Math.min(MAX, Math.round(n / STEP) * STEP));
  const ratio = heightMm > 0 ? widthMm / heightMm : 1;
  if (ratio >= 1) {
    return { width: MAX, height: clamp32(MAX / ratio) };
  }
  return { width: clamp32(MAX * ratio), height: MAX };
}

// flux modeli yalnız belirli en-boy oranlarını kabul eder; kitabın trim oranına
// en yakın dikey oranı seçer.
const ALLOWED_RATIOS: { label: string; value: number }[] = [
  { label: "9:16", value: 9 / 16 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:5", value: 4 / 5 },
  { label: "1:1", value: 1 },
];

export function nearestAspectRatio(widthMm: number, heightMm: number): string {
  const target = heightMm > 0 ? widthMm / heightMm : 2 / 3;
  let best = ALLOWED_RATIOS[1];
  let bestDiff = Infinity;
  for (const r of ALLOWED_RATIOS) {
    const diff = Math.abs(r.value - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best.label;
}

// Nano Banana Pro daha geniş bir oran kümesi kabul eder (yatay dahil). Tam sarmal
// (geniş) kapaklarda da uygun oranı seçebilmek için ayrı liste.
const NANO_RATIOS: { label: string; value: number }[] = [
  { label: "9:16", value: 9 / 16 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "4:5", value: 4 / 5 },
  { label: "1:1", value: 1 },
  { label: "5:4", value: 5 / 4 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
];

export function nearestNanoAspect(widthMm: number, heightMm: number): string {
  const target = heightMm > 0 ? widthMm / heightMm : 2 / 3;
  let best = NANO_RATIOS[1];
  let bestDiff = Infinity;
  for (const r of NANO_RATIOS) {
    const diff = Math.abs(r.value - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best.label;
}

// ── ChatGPT (gpt-image) için KATMANLI komut ──────────────────────────────────
// Kapağın gerçek ölçülerinden (mm) hesaplanan bölge kurallarıyla, bölümlere
// ayrılmış bir komut üretir. gpt-image yerleşim kısıtlarını harfiyen izler;
// bu yüzden "nereye ne gelecek" yüzde olarak açıkça söylenir:
//   • Başlık bandı (üst): sade, düşük ayrıntı, düz ton → başlık sonradan basılır.
//   • Logo bandı (alt): açık tonlu, ayrıntısız → yayınevi logosu + yazar adı.
//   • Sarmalda arka kapak: sahnenin çok daha açık/sakin devamı (koyu yazı basılır);
//     sırt: düz şerit; ön kapak: ana özne.
//   • Konsept koyu değilse açık-orta palet.
// Metin ASLA görsele basılmaz; başlık/yazar/logo uygulamanın kendi katmanlarıdır.
export type CoverGeometry = {
  bookWidth: number;
  bookHeight: number;
  spine: number;
  bleed: number;
  safeZone: number;
  totalWidth: number;
  totalHeight: number;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export type LayeredStyleOverride = {
  /** Konsept + özne cümlesi (kurgudan); stil presetinin yerine geçer. */
  stylePrompt: string;
  dark: boolean;
  /** Palet kuralı metni (TONE_PROMPTS); yoksa dark'a göre varsayılan. */
  tonePrompt?: string;
};

// Yazıyı ChatGPT bassın istenirse: BİREBİR yazılacak metinler. Yoksa görsel
// yazısızdır (uygulama bindirir).
export type LayeredText = {
  title: string;
  author: string;
  subtitle?: string;
  genreLabel?: string;
};

export function buildLayeredPrompt(opts: {
  styleId: string;
  description: string;
  wrap: boolean;
  geo: CoverGeometry;
  override?: LayeredStyleOverride;
  text?: LayeredText;
}): string {
  const preset = getAiStyle(opts.styleId);
  const style = {
    prompt: opts.override?.stylePrompt ?? preset.prompt,
    dark: opts.override?.dark ?? !!preset.dark,
  };
  const desc = opts.description.trim();
  const g = opts.geo;
  const H = g.totalHeight;
  // Başlık bandı: üst güvenli çizgiden kapak boyunun %26'sı kadar aşağı (~%30).
  const titleBottom = (g.bleed + g.safeZone + g.bookHeight * 0.26) / H;
  // Logo bandı: alt güvenli çizginin 10 mm üstünden alt kenara (~%9-10).
  const logoBand = (g.bleed + g.safeZone + 10) / H;
  const focalTop = titleBottom + 0.02;
  const focalBottom = 1 - logoBand - 0.08;
  const front = opts.wrap ? "the FRONT COVER section" : "the cover";

  const lines: string[] = [
    // Çerçeve: ciddi yayıncılık işi, jenerik AI görseli değil (kullanıcının
    // kendi komutlarından; farkı yaratan cümle).
    "Design ONE exceptionally art-directed book cover ARTWORK: a serious commercial " +
      "publishing cover, carefully composed like a commissioned literary jacket, not " +
      "generic AI art, not stock art, not a template. Image and (future) typography " +
      "must read as one purposeful design.",
    "FORMAT: flat 2D full-bleed artwork — fills 100% of the canvas edge to edge. " +
      "Not a book mockup, not a 3D book, not a product photo, no frame, no border, " +
      "no inset panel, no margins, no badges.",
  ];
  if (desc) lines.push(`SCENE: ${desc}`);
  lines.push(
    `STYLE: ${style.prompt}. Gallery-quality, striking and memorable; rich detail and ` +
      "depth concentrated in the focal subject, elegant restraint everywhere else.",
  );
  lines.push("LAYOUT (strict, follow exactly):");
  if (opts.wrap) {
    const backEnd = (g.bleed + g.bookWidth) / g.totalWidth;
    const spineEnd = backEnd + g.spine / g.totalWidth;
    lines.push(
      `- One continuous wraparound scene. The left ${pct(backEnd)} of the width is the ` +
        "BACK COVER: a much lighter, paler and calmer continuation of the scene in soft " +
        "low-contrast tones (pale enough to print dark paragraph text over it); no focal " +
        "subject there.",
    );
    lines.push(
      `- Between ${pct(backEnd)} and ${pct(spineEnd)} of the width is the SPINE zone: the ` +
        "scene flows continuously through it (no hard band, no seam), but keep it calm, " +
        "low-detail and uniform in tone — nothing important sits or crosses there.",
    );
    lines.push(
      `- The right ${pct(1 - spineEnd)} of the width is the FRONT COVER section: the main ` +
        "subject lives here, horizontally centered within this section.",
    );
  }
  const tx = opts.text;
  const q = (s: string) => `"${s.replace(/"/g, "'")}"`;
  if (tx) {
    // Yazı görsele gömülür: konum/ölçü senin örnek komutlarındaki düzen.
    const parts = [
      `- Typography zone: the top ${pct(titleBottom)} of ${front} is quiet negative space ` +
        "(sky, wall, mist, paper) blending naturally into the image, never a boxed panel; " +
        "it carries ALL the text:",
      `  · author ${q(tx.author)} — small, widely tracked uppercase, centered at about 8% of the height;`,
      `  · title ${q(tx.title)} — between about 15% and ${pct(titleBottom)} of the height, ` +
        "distinctive elegant editorial typeface matching the concept, substantial weight, " +
        "beautifully balanced across 1–3 lines, roughly 60–70% of the cover width, optical " +
        "kerning, correct Turkish diacritics (İ ı Ş ş Ğ ğ Ü ü Ö ö Ç ç), compact professional " +
        "leading, not stretched, not swashy;",
    ];
    if (tx.subtitle) {
      parts.push(
        `  · subtitle ${q(tx.subtitle)} — small neat text in 1–2 lines directly below the title, ` +
          "clearly subordinate to it;",
      );
    }
    if (tx.genreLabel) {
      parts.push(`  · tiny genre label ${q(tx.genreLabel)} just below the title with generous tracking.`);
    }
    parts.push("  Large usable text margins; image and typography share one purposeful design.");
    lines.push(parts.join("\n"));
  } else {
    lines.push(
      `- Title zone: the top ${pct(titleBottom)} of ${front} is quiet negative space — ` +
        "soft, even, low-detail tone that blends NATURALLY into the image (sky, wall, " +
        "mist, paper), never a boxed panel — the author name, title and a tiny genre " +
        "label will be printed there later.",
    );
  }
  lines.push(
    `- Logo zone: the bottom ${pct(logoBand)} of ${front} must be light-toned, plain and ` +
      "free of detail — a publisher logo and the author name go there.",
  );
  lines.push(
    `- Main subject: between ${pct(focalTop)} and ${pct(focalBottom)} of the height of ` +
      `${front}, clearly visible, not touching the edges; placed slightly off-center ` +
      "to avoid dull perfect symmetry; strong composition with purposeful negative space.",
  );
  lines.push(
    opts.override?.tonePrompt
      ? `- ${opts.override.tonePrompt}`
      : style.dark
        ? "- Palette may be dark, but keep the title zone and logo zone smoother and a little " +
          "lighter so printed text stays readable."
        : "- Palette: light to mid tones overall; avoid large very dark or black areas.",
  );
  if (tx) {
    const allowed = [tx.author, tx.title, tx.subtitle, tx.genreLabel]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .map(q)
      .join(", ");
    lines.push(
      `EXACT TEXT: render only these words, spelled exactly: ${allowed}. No other words, ` +
        "no publisher name, no logo, no badges, no watermark, no signature. Keep all text " +
        "legible and exact." +
        (opts.wrap
          ? " All text lives on the FRONT COVER section only; the back cover and the spine carry no text."
          : ""),
    );
    lines.push(
      "CONSTRAINTS: no book object, no spine shadow, no page edges. No floating objects, " +
        "no magical particles, no cosmic effects, no artificial glow, no stock-art clichés.",
    );
  } else {
    lines.push(
      "CONSTRAINTS: absolutely no text, no letters, no words, no title, no logo, no numbers, " +
        "no watermark, no signature. No book object, no spine shadow, no page edges. " +
        "No floating objects, no magical particles, no cosmic effects, no artificial glow, " +
        "no stock-art clichés.",
    );
  }
  return lines.join("\n");
}

// gpt-image-2.x özel boyut kabul eder: her kenar 16'nın katı, oran 1:3–3:1.
// Kapağın GERÇEK oranını kullanırız (kırpma yok). Ön kapak = trim + iki yandan
// taşma; sarmal = tüm tuval. Uzun kenar sabit; piksel sayısı maliyeti belirler.
export function openaiSize(geo: CoverGeometry, wrap: boolean): string {
  const LONG = wrap ? 2048 : 1536;
  const w = wrap ? geo.totalWidth : geo.bookWidth + geo.bleed * 2;
  const h = geo.totalHeight;
  const ratio = Math.min(3, Math.max(1 / 3, h > 0 ? w / h : 2 / 3));
  const r16 = (n: number) => Math.max(256, Math.round(n / 16) * 16);
  return ratio >= 1 ? `${LONG}x${r16(LONG / ratio)}` : `${r16(LONG * ratio)}x${LONG}`;
}
