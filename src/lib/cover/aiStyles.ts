// AI kapak görseli için stil presetleri.
// Her preset, görsel servisine gönderilecek İNGİLİZCE bir komut (prompt) taşır;
// adı kullanıcıya kendi dilinde gösterilir. Komutlarda bilinçli olarak "metin yok"
// vurgusu var — başlık/yazar yazısını uygulamanın kendisi bindirir.

export type AiStyle = {
  id: string;
  name: { tr: string; en: string };
  prompt: string;
};

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
