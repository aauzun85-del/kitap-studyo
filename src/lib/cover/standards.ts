// KAPAK STANDARTLARI AĞACI — Thema konu koduna bağlı "tür" düğümleri; her türde
// 3 KONSEPT. Kitabın Thema kodu için standart yoksa en yakın ÜST dalınki alınır
// (miras): "FS" → "F" kökü → Roman (FB). Yeni tür = buraya bir düğüm.
//
// Örnek görseller: /public/kurgu/<THEMA>/<1|2|3>.jpg (kullanıcı koyar; yoksa
// kart renk kartelasıyla görünür).

import themaRows from "./thema.json";

export type CoverConcept = {
  id: string;
  name: { tr: string; en: string };
  blurb: { tr: string; en: string };
  /** Görsel modeline giden konsept cümlesi (İngilizce). */
  prompt: string;
  /** Doğası gereği koyu → "açık palet" kuralı uygulanmaz. */
  dark?: boolean;
  /** Örnek görsel yokken kart kartelası [zemin, mürekkep, vurgu]. */
  swatch: [string, string, string];
  /** Konsepte özel yazı yerleşimi (İngilizce) — ChatGPT yazıyı basarken
   *  genel düzenin (yazar üstte, başlık altında, ortalı) yerine geçer. */
  textLayout?: string;
  /** Yazı düzenini GERÇEK metinle kurar (koşulları modele bırakmamak için:
   *  ör. hangi sözcüğün dev basılacağını uygulama seçer). Varsa textLayout'un
   *  yerine geçer (yalnız yazıyı ChatGPT basarken). */
  textLayoutFor?: (t: ConceptText, lang: "tr" | "en") => string;
  /** Kullanıcının kurgu notu kapağa BİREBİR basılır (ör. şiir dizeleri) —
   *  sahne tarifi olarak değil, EXACT TEXT listesinde. */
  noteAsText?: boolean;
  /** Yazar KENDİ fotoğrafını yükleyebilir: kapağı yapay zekâ değil uygulama
   *  kurar ("framed" = çerçeveli portre, "band" = üstte fotoğraf + altta bant). */
  photo?: {
    layout: "framed" | "band" | "side";
    bg: string;
    ink: string;
    /** Fotoğraf varsayılan olarak siyah-beyaz mı (vars. true)? */
    defaultMono?: boolean;
    /** Fotoğraf yuvası varken konseptin yazı düzeninin yerine geçer. */
    textLayout?: string;
    /** Yazar kendi fotoğrafını verdiyse konsept cümlesinin YERİNE geçer: kapak
     *  tasarlanır ama fotoğraf yuvası boş bırakılır (fotoğrafı uygulama oturtur). */
    prompt: string;
  };
};

/** Konseptin yazı düzenini kurarken kullanılan metinler (aiStyles LayeredText ile aynı şekil). */
export type ConceptText = {
  title: string;
  author: string;
  subtitle?: string;
  genreLabel?: string;
  extra?: string;
};

const q = (s: string) => `"${s.replace(/"/g, "'")}"`;
const upper = (s: string, lang: "tr" | "en") => (lang === "tr" ? s.toLocaleUpperCase("tr-TR") : s.toUpperCase());
// Dev basılacak sözcük: dolgu sözcükleri (bir, ve, için…) dışındaki EN UZUN sözcük.
const FILLER = new Set([
  "bir", "ve", "ile", "için", "de", "da", "ki", "bu", "şu", "o", "gibi", "kadar", "en", "ya", "veya", "hem", "mi", "mı", "mu", "mü",
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "is", "at", "by",
]);
const VOWELS = "aeıioöuüâîûAEIİOÖUÜÂÎÛ";
// Sözcüğü hece sınırından ikiye böler (Türkçe: hece, ünlüden önceki ünsüzle başlar);
// ortaya en yakın sınır seçilir. 5 harften kısa ya da sınır yoksa bölünmez.
function splitAtSyllable(w: string): string[] {
  const ch = [...w];
  if (ch.length < 5) return [w];
  let best = -1;
  for (let i = 2; i <= ch.length - 2; i++) {
    if (!VOWELS.includes(ch[i]) && VOWELS.includes(ch[i + 1] ?? "")) {
      if (best === -1 || Math.abs(i - ch.length / 2) < Math.abs(best - ch.length / 2)) best = i;
    }
  }
  return best === -1 ? [w] : [ch.slice(0, best).join(""), ch.slice(best).join("")];
}
function pickGiant(words: string[]): number {
  const bare = (w: string) => w.replace(/[^\p{L}]/gu, "");
  let idx = -1;
  words.forEach((w, i) => {
    if (FILLER.has(bare(w).toLocaleLowerCase("tr-TR"))) return;
    if (idx === -1 || bare(w).length > bare(words[idx]).length) idx = i;
  });
  if (idx !== -1) return idx;
  words.forEach((w, i) => {
    if (idx === -1 || bare(w).length > bare(words[idx]).length) idx = i;
  });
  return Math.max(0, idx);
}

/** Hiciv "Tipografik şaka": dev sözcüğü UYGULAMA seçer ve satırları birebir verir;
 *  önceki sözcükler üstte, sonrakiler altta kalır → başlığın sırası/anlamı bozulmaz. */
function jokeLayout(t: ConceptText, lang: "tr" | "en"): string {
  const words = t.title.trim().split(/\s+/).filter(Boolean);
  const gi = pickGiant(words);
  const before = upper(words.slice(0, gi).join(" "), lang);
  const giant = upper(words[gi] ?? t.title, lang);
  const after = upper(words.slice(gi + 1).join(" "), lang);
  const parts = splitAtSyllable(giant);
  const out: string[] = [
    "NOT a conventional stacked title — the joke is in the scale. Set the title as exactly these pieces, top to bottom, and nothing else from it:",
  ];
  if (before) {
    out.push(`at the upper left, small but clearly legible, in a vermilion accent with moderate tracking: ${q(before)};`);
  }
  out.push(
    `the GIANT word ${q(giant)}` +
      (parts.length === 2 ? `, set as two stacked lines ${q(parts[0])} / ${q(parts[1])} (no hyphen)` : ", on one line") +
      ", in exceptionally heavy broad neo-grotesque uppercase, warm pale contrasting colour, occupying about 75% of the height and about 85% of the width, " +
      "never clipping any letter or Turkish dot, never distorted;",
  );
  if (after) {
    out.push(`directly BELOW the giant word at the bottom left, small but clearly legible, in ivory with moderate tracking: ${q(after)}.`);
  }
  if (!before) out.push("There is NO small line above the giant word and NO vermilion lettering anywhere on this cover.");
  if (!after) out.push("There is NO small line below the giant word.");
  out.push(
    `Read from top to bottom these pieces must form exactly ${q(upper(t.title, lang))} — no piece moved, dropped or repeated.`,
    "The author runs along the right margin as one small ivory line rotated 90° clockwise, with a clear gutter; the tiny genre label sits " +
      "horizontally in the upper right.",
  );
  if (t.subtitle) {
    out.push("The subtitle is one tiny ivory horizontal line at the very top left, level with the genre label, above everything else.");
  }
  out.push("No other rotation, no distortion, no extra punctuation.");
  return out.join(" ");
}

/** Şiir "Tipografik şiir": dize verilmezse başlık BİR KEZ, büyük kademeli italik olarak. */
function poetryLayout(t: ConceptText): string {
  if (t.extra && t.extra.trim()) return POETRY_WITH_EXCERPT;
  return (
    "Warm ivory lettering with one pale blush accent word. Upper quarter, LEFT-aligned about 9% from the edges: the small tracked uppercase author, then " +
    "the tiny tracked genre label — NO small title there. The main expressive element is the title itself, set ONCE in the central and lower-middle area, " +
    "larger in a beautifully drawn literary italic serif: one whole word or short phrase per line, staggered — a line aligned left, the next indented " +
    "noticeably to the right — in exact word order from top to bottom, never split inside a word; one key word in pale blush, the rest ivory; nothing " +
    "else in that area — no excerpt, no verse, no invented lines; every line within the margins and a generous empty lower margin."
  );
}
const POETRY_WITH_EXCERPT =
  "Warm ivory lettering with one pale blush accent word. Upper quarter, LEFT-aligned about 9% from the edges: the small tracked uppercase author, beneath it the " +
  "title on two lines in a refined medium-weight upright literary serif (modest, easily readable), then the tiny tracked genre label. The main expressive " +
  "element is the excerpt in the central and lower-middle area, set larger in a beautifully drawn literary italic serif: break it across staggered lines — " +
  "a phrase aligned left, the next indented noticeably to the right, a generous vertical pause of empty ground between the sentences, then the same again; " +
  "one key word in pale blush, the rest ivory; normal readable letter spacing, grammatical reading order, no repeated words, every line within the margins, " +
  "a generous empty lower margin.";

export type CoverStandard = {
  /** Thema kodu (düğüm). */
  code: string;
  name: { tr: string; en: string };
  /** Kapaktaki küçük tür etiketi ("ROMAN"); başlığın altında basılır. */
  label: { tr: string; en: string };
  concepts: [CoverConcept, CoverConcept, CoverConcept];
};

const c = (
  id: string,
  tr: string,
  en: string,
  blurbTr: string,
  blurbEn: string,
  prompt: string,
  swatch: [string, string, string],
  dark = false,
): CoverConcept => ({ id, name: { tr, en }, blurb: { tr: blurbTr, en: blurbEn }, prompt, swatch, dark });

export const COVER_STANDARDS: CoverStandard[] = [
  {
    code: "VS",
    name: { tr: "Kişisel gelişim", en: "Self-help" },
    label: { tr: "KİŞİSEL GELİŞİM", en: "SELF-HELP" },
    concepts: [
      {
        ...c("sembol", "Büyük başlık + tek sembol", "Big title + single symbol", "Düz zemin, iri başlık, tek küçük ikon.", "Flat ground, large title, one small icon.",
        "warm light solid matte ground (pistachio, apricot, sand) with subtle fine uncoated paper texture; " +
          "ONE small sculptural conceptual symbol in the lower right (a knot unravelling into an open loop, a folded card, a single leaf) — " +
          "clear silhouette, tactile real-material texture, restrained soft shadow, an intelligent compact visual metaphor; " +
          "huge calm space reserved for a dominant title; rigorously aligned grid, calm contemporary personal-development design; " +
          "no stairs, arrows, lightbulbs, motivational badges, scattered icons, shiny 3D or gradients", ["#e9ecd9", "#3a2436", "#e8612b"]),
        textLayout:
          "Very dark (aubergine or ink) lettering on the light ground, LEFT-aligned text block starting at about 10% from the left. Author small tracked uppercase at the top " +
          "(about 9% of the height), with the tiny widely tracked genre label directly beneath it (about 13%), same left alignment; the title as the dominant element in an elegant bold humanist sans serif (not an ultra-condensed poster font), 2–3 deliberate " +
          "left-aligned lines occupying roughly 22–65% of the height with confident generous leading; the subtitle small and neat in 1–2 lines near the bottom left " +
          "(about 78%), leaving the lower-right corner free for the single symbol.",
      },
      c("metafor", "Metafor fotoğraf", "Metaphor photo", "Yol, kapı, ışık, ufuk; gerçekçi görsel.", "Road, door, light, horizon; photographic.",
        "metaphor through exceptional editorial photography: a quiet sunlit interior or place where ONE simple object (an armchair in a " +
          "rectangle of morning light, an open window with a billowing linen curtain, a single door) carries the idea of making space for oneself; " +
          "carefully composed tactile photography — upholstery, worn limestone floor, plaster microtexture, gentle natural light, restrained analogue grain; " +
          "square-on but asymmetrical editorial framing, no wide-angle distortion, no luxury real-estate look; warm ivory, terracotta, muted olive, honey sunlight; " +
          "upper area mostly quiet warm plaster with faint natural shadow; no people, no stacked stones, no road to the horizon, no fake glow, no stock-photo motivational look", ["#eadfcf", "#2f3a1f", "#b5542b"]),
      c("illustrasyon", "Sıcak illüstrasyon", "Warm illustration", "El çizimi hava, pastel, samimi.", "Hand-drawn feel, pastel, friendly.",
        "warm sophisticated hand-painted editorial illustration for ADULT personal growth, not a children's cartoon: original conceptual gouache and colored-pencil work — " +
          "an adult figure in a quiet everyday moment (e.g. reading, resting, tending a garden) inside a generous clearing framed by large botanical leaves, " +
          "with one small telling detail that carries the book's idea (e.g. garden shears beside a cut vine); richly designed flat shapes, visible dry-brush texture, " +
          "elegant imperfect pencil lines, paper grain, intentional color overlaps; warm natural palette (pale peach, butter yellow, sage and forest green, terracotta); " +
          "figure adult-proportioned with subtle expressive posture, not big-eyed or cute; illustration in the lower 55–60% with substantial breathing space above; " +
          "no clipart, no sticker collage, no stock vector characters, no plant-in-pot cliché, no magical glow", ["#fde3cf", "#1f3a24", "#c75b2a"]),
    ],
  },
  {
    code: "VX",
    name: { tr: "Ezoterik / mistik", en: "Esoteric / mystic" },
    label: { tr: "EZOTERİK", en: "ESOTERIC" },
    concepts: [
      c("amblem", "Koyu zemin + altın amblem", "Dark ground + gold emblem", "Sembol, kutsal geometri, altın çizgi.", "Symbol, sacred geometry, gold line.",
        "dark ground and ONE original restrained gold emblem — a carefully authored instrument or diagram (astrolabe, labyrinth, cartographic rose, sigil) " +
          "with fine concentric rings, delicate radial divisions and a few clean construction lines, exquisitely engraved antique-atlas linework interpreted " +
          "through contemporary editorial design; midnight ink blue almost black with a deep peacock undertone, matte paper texture, restrained uneven pigment; " +
          "muted antique brass and pale champagne-gold ink (never bright yellow or orange), flat print-like metallic-ink simulation with fine etched detail, " +
          "no shiny 3D medallion, no bevels, no cinematic lighting; rich detail inside the emblem and generous calm dark breathing room around it, emblem in the " +
          "lower-middle; no eyes, crescent moons, zodiac icons, random stars, occult alphabets, pyramids, cosmic portals, glow, rectangular borders or corner flourishes", ["#0f1c24", "#efe6cf", "#b89a5a"], true),
      c("gravur", "Gravür / vintage", "Engraving / vintage", "Eski kitap, dokulu kağıt, tek renk.", "Old book, textured paper, single ink.",
        "an original imaginary plate from an old atlas of the inner world: a small anonymous figure or a single engraved scene revealing depth beneath the surface of perception " +
          "(e.g. a lifted map layer revealing hidden contour landscapes, or winding stairs toward a distant sea under a tiny sun) — invent the composition, never reproduce a famous historical engraving; " +
          "exquisite copperplate engraving and fine etched cross-hatching, entirely deep charcoal-brown ink on warm ivory paper, rich stippling, delicate crosshatched shadows, " +
          "broad unprinted highlights, authentic printed-plate sensibility (not a digital pencil sketch, not photorealism); paper with subtle fibers and gentle uneven warm tone, " +
          "no stains, no torn edges, no burnt parchment; the scene occupies the lower half and fades organically into blank paper; a very thin restrained double-rule border " +
          "well inside the edges is allowed — its bottom rule sits at about 89% of the height, leaving a slightly deeper plain strip of paper beneath it; no corner decorations; a single tiny dusty vermilion accent at most; no gold, no navy, no gradients, no glow, no all-seeing eye, " +
          "no zodiac wheel, no skulls, no alchemical lettering", ["#efe4cc", "#2a241c", "#8a4a1f"]),
      c("kozmik", "Kozmik soyut", "Cosmic abstract", "Nebula, ışık, derinlik.", "Nebula, light, depth.",
        "cosmic abstraction: the invisible inner world as layers of luminous space — an original composition of translucent mineral-pigment clouds and fine flowing light " +
          "filaments, as if a distant nebula and an underwater ink painting were becoming an uncharted topographic map (no literal map symbols); softly nested asymmetrical " +
          "contours descending diagonally, opening into a quiet irregular deep-indigo void slightly below center (not a circular portal, eye or black hole); one delicate warm " +
          "pearl filament tracing part of a contour; sparse almost imperceptible points of light; sophisticated experimental photographic abstraction — translucent inks, mineral " +
          "washes, subtle analogue grain, long-exposure light; deep ink indigo, smoky aubergine, muted periwinkle, desaturated teal, a very restrained apricot-pearl accent; matte " +
          "editorial reproduction; detail concentrated in the lower two-thirds, the upper area calm dark indigo; no rainbow saturation, no explosive nebula, no neon vortex, no digital " +
          "fractals, no stock space wallpaper, no lens flares, no planets, astronauts, silhouettes, zodiac signs, gold medallions or engraved ornaments", ["#141a3a", "#eae6ff", "#9b7bff"], true),
    ],
  },
  {
    code: "QR",
    name: { tr: "Din", en: "Religion" },
    label: { tr: "DİN", en: "RELIGION" },
    concepts: [
      {
        ...c("tezhip", "Hat / tezhip dokusu", "Calligraphic ornament", "Klasik süsleme, lacivert-altın.", "Classical ornament, navy and gold.",
        "Ottoman manuscript illumination (tezhip) interpreted as contemporary editorial design: a meticulously hand-painted vertical ornament of classical rumi and hatayi " +
          "vegetal motifs — fine muted gold stems, tiny ivory blossoms, restrained turquoise and lapis petals — forming an elongated open almond-shaped frame around generous dark " +
          "negative space; ornament concentrated in the lower half (two gently rising flowering branches meeting in a small symmetrical base flourish) and climbing delicately " +
          "along the sides, with a small refined crown-like flourish between the author line and the title; the subtle irregularities of a master illuminator's brush, not mechanically repeated " +
          "wallpaper; rich midnight ultramarine navy with gently varied matte pigment on fine paper; antique champagne-gold illumination with small lapis, ivory and muted " +
          "turquoise details, flat restrained metallic-ink effect (no embossed CGI, glitter, luminous gradients or fake leather); the inside of the almond frame carries only the lettering, otherwise quiet dark ground; a thin gold rule " +
          "near the edge is allowed, no heavy decorative frame; no Arabic text, no pseudo-calligraphy, no literal heart, mosque, crescent, stars, astrolabe, occult geometry, " +
          "circular medallion, stock ornament collage or wedding-invitation look", ["#101c3a", "#f3ead2", "#c9a24a"], true),
        textLayout:
          "Warm ivory lettering on one CENTRAL axis, all inside the open upper part of the almond frame. Author at the very top in small widely tracked uppercase at " +
          "about 7–9% of the height; the small crown flourish sits between the author line and the title at about 13–20%; the title on two centered lines in an " +
          "elegant high-contrast serif, roughly 60–70% of the cover width, at about 25–45% of the height; the subtitle in one small italic line just below it at " +
          "about 49–52%; the tiny tracked genre label centered beneath the subtitle at about 55%. The ornament stays below about 58% and along the side margins, " +
          "never behind the lettering.",
      },
      {
        ...c("tipografik", "Sade tipografik", "Plain typographic", "Yazı odaklı, sakin, tek renk zemin.", "Text-led, calm, single-color ground.",
        "restrained typographic spirituality cover: stillness expressed through space, proportion and a quiet vertical pause; warm natural ivory uncoated paper ground, " +
          "tactile softly fibrous cream paper with very subtle natural surface variation; the ONLY graphic element is one very fine muted antique-gold vertical rule on the " +
          "left (around 15% from the left edge, spanning the middle of the height) as a quiet anchor; no illustration, photograph, botanical motif, ornamental frame, mosque, " +
          "emblem, icon, Arabic lettering or pseudo-calligraphy; large uninterrupted ivory space above, below and to the right; no stains, heavy grain, gradients, shadows, " +
          "bevels, embossing or gloss", ["#f3ecdd", "#1f3a2a", "#b8923f"]),
        textLayout:
          "Deep forest-green lettering, an asymmetrical LEFT-aligned text block starting at about 23% from the left (to the right of the thin gold rule), with a generous " +
          "right margin. Author small tracked uppercase at about 13% of the height; the title on two lines with a contemplative gap between them, occupying roughly 32–52% " +
          "of the height in a distinguished humanist old-style serif of medium weight, never oversized; the subtitle in two quiet small lines at about 62–69% in an " +
          "understated sans; the tiny genre label below it. All three share the same left alignment; the bottom 20% stays empty.",
      },
      c("mimari", "Mimari / ışık", "Architecture / light", "Cami, kubbe, ışık huzmesi.", "Mosque, dome, beam of light.",
        "architecture and light: refined architectural editorial photography of an imaginary modest historic Ottoman mosque interior — view from a shaded side arcade through " +
          "gracefully proportioned stone arches toward a quiet prayer hall, a small high arched window admitting soft early-morning sunlight that lays a long luminous patch " +
          "across warm pale stone and a muted woven prayer carpet, a restrained glimpse of the dome's underside, a tiny empty niche deep in the background; subtle carved stone, " +
          "softly weathered plaster, believable architecture, human-scale atmosphere, no people; asymmetrical composition with the main arch on one side guiding the eye inward; " +
          "the upper area a broad calm shadowed deep olive-charcoal plaster surface integrated into the architecture; light moving diagonally in the lower part; deep olive-charcoal " +
          "shadows, warm limestone, muted sand, pale honey sunlight, dusty sage carpet; soft analogue grain, matte photographic reproduction, detail visible in shadow; no chandelier, " +
          "no divine figures, no supernatural glow, no theatrical rays, no orange-and-teal grading, no HDR, no lens flares, no smoke, no travel-postcard look, no Arabic inscriptions", ["#3a3f33", "#f1e9d8", "#c2a56a"], true),
    ],
  },
  {
    code: "QD",
    name: { tr: "Felsefe", en: "Philosophy" },
    label: { tr: "FELSEFE", en: "PHILOSOPHY" },
    concepts: [
      {
        ...c("tipografik", "Tipografik", "Typographic", "Yalnız yazı; başlıkta kasıtlı hizalama oyunu ve boşluk.", "Type only; a deliberate alignment gesture and empty space in the title.",
          "typography is the entire image: a warm pale limestone paper ground with very subtle natural uncoated-paper grain and NOTHING else — no illustration, icon, " +
            "figurative imagery, busts, statues, brains, light bulbs, question marks, borders, flourishes or geometric symbols; flat printed colors (near-black ink plus " +
            "one deep ultramarine accent), no gradients, no shadows, no embossing; an understated contemporary European literary publishing sensibility", ["#ece6d8", "#15140f", "#0b2a8a"]),
        textLayout:
          "Generous outer margins (about 9% of the width), everything LEFT-aligned on the same margin. Author near the upper left in small beautifully tracked uppercase " +
          "humanist sans. The title occupies the middle of the cover with an intellectually engaging gesture: set it in a refined editorial serif, its most important " +
          "word dramatically larger and near-black, and let the final syllable of that word be displaced toward the right in deep ultramarine (same size), ending at the " +
          "right margin with untouched paper between — language approaching an edge; the lines stay one connected title with impeccable kerning, no hyphen, no cut " +
          "letters, dotless Turkish ı preserved. The subtitle well below the title in two small quiet sans lines; the tiny tracked genre label at the bottom left. " +
          "The asymmetric layout must feel optically balanced.",
      },
      {
        ...c("bust", "Klasik büst / gravür", "Classical bust / engraving", "Koyu zemin üzerine fildişi mürekkeple gravür büst; modern kırpım.", "Ivory-ink engraved bust on a deep ground; bold modern crop.",
          "a large original engraved classical marble bust of an anonymous ancient philosopher in contemplative three-quarter profile, occupying the lower two thirds and " +
            "weighted to one side (shoulder and pedestal may run off the edges, face fully visible) — an expert nineteenth-century copperplate drawing printed in warm " +
            "bone-ivory ink on a full-bleed deep oxblood burgundy (or another single deep) ground with restrained matte ink grain: meticulous curved hatching, fine " +
            "cross-hatching, engraved stippling, worn stone, articulated neck and shoulders; one subtle conceptual intervention where the dense contours near the back of " +
            "the head separate into a few unfinished lines fading into the ground (the limit of knowledge); the opposite side stays a calm open field for text; " +
            "no photographic rendering, no smooth CGI statue, no cartoon outlines, no columns, temples, laurels, scrolls, light bulbs, question marks, frames, metallic " +
            "effects, fake aging stains or collage", ["#4a0f14", "#efe6d6", "#b87333"], true),
        textLayout:
          "Warm bone-ivory lettering, LEFT-aligned with generous margins, all in the calm top third / left field, never over the engraving. Author at the upper left in " +
          "small widely tracked uppercase humanist sans; the title on two lines in a large beautiful editorial serif, second line modestly larger, confident and " +
          "carefully kerned; the subtitle beneath the title in two small clean sans lines; the tiny tracked genre label at the bottom left. Hierarchy: title, engraved " +
          "face, author and subtitle.",
      },
      {
        ...c("sembol", "Minimal sembol", "Minimal symbol", "Tek geometrik işaret, tek vurgu rengi, bol boşluk.", "One geometric mark, one accent color, lots of space.",
          "a single minimal geometric symbol on a full-bleed muted single-color ground (sage green, limestone, dusty blue) like softly pigmented uncoated book paper with very " +
            "subtle fine grain; the symbol in deep almost-black ink about 45–50% of the width, placed in the middle-to-lower area: one precise, visually simple emblem " +
            "with a quiet conceptual twist (an almost complete circle with a small deliberate opening and one slender burnt-orange line passing through it — thought moving " +
            "beyond the boundary of the known; or a comparable single geometric gesture), clean confident strokes, no arrowheads, interior the same as the ground; " +
            "flat ink colors, one small warm accent; no eye, compass, clock, orbiting dots, maze, statues, faces, landscapes, photographs, borders, shadows, bevels or glow", ["#9fae8a", "#0f2a1a", "#d9682b"]),
        textLayout:
          "Deep forest-green (near-black) lettering on a disciplined CENTRAL axis with generous margins. Author at the top in small widely tracked uppercase humanist sans; " +
          "the title on two centered lines in a sophisticated medium-weight contemporary serif, substantial yet compact, occupying roughly the upper quarter with ample air; " +
          "the subtitle centered beneath the symbol in two small refined sans lines with substantial breathing room; the tiny tracked genre label at the bottom center.",
      },
    ],
  },
  {
    code: "DN",
    name: { tr: "Biyografi / deneme", en: "Biography / essays" },
    label: { tr: "ANI / DENEME", en: "MEMOIR / ESSAYS" },
    concepts: [
      {
        ...c("portre", "Portre", "Portrait", "Düz zemin, çerçeveli siyah-beyaz portre; klasik yayınevi portre dizisi.", "Solid ground, framed black-and-white portrait; classic publisher portrait series.",
          "traditional publisher portrait-series layout: a deep warm brick-red (or another single deep) solid matte uncoated-paper ground covering the whole cover, no gradients, " +
            "no decoration; centered in the middle a vertical rectangular black-and-white documentary photograph (about 65% of the width, 43% of the height) with a fine ivory " +
            "keyline and a narrow gap inside the frame like a mounted archival print, never touching the edges; the portrait: the author seated in a quiet real environment " +
            "(a writing desk by a window, a softly blurred bookshelf), shown from the waist up with relaxed hands, face about a third of the photo's height, thoughtful " +
            "approachable expression, authentic anatomy, understated clothing, no glamour; delicate silver-gelatin tonal quality with fine grain, no sepia, no damage effects; " +
            "no text over the photograph, no full-bleed face, no ornamental corners, no flowers, no collage, no gold foil, no drop shadows", ["#8b1a1a", "#f3ead2", "#f3ead2"]),
        dark: true,
        photo: {
          layout: "framed",
          bg: "#7d1d1d",
          ink: "#f3ead2",
          prompt:
            "traditional publisher portrait-series layout for a literary memoir: a deep warm brick-red (or another single deep, dignified) solid matte " +
            "uncoated-paper ground covering the whole cover with a subtle tactile texture, no gradients, no decoration; a calm centered composition built " +
            "around an empty rectangular window reserved for the author's own photograph (see LAYOUT); refined, quietly distinguished, warm and serious; " +
            "no ornamental corners, flowers, collage, gold foil, drop shadows or illustrations",
        },
        textLayout:
          "Warm ivory lettering on the solid ground. Title centered in the upper quarter on 1–2 lines in a moderately condensed literary serif, substantial yet restrained; " +
          "small subtitle centered directly below the title; the framed photograph below the subtitle; the author name centered BELOW the photograph in medium uppercase " +
          "humanist sans with refined tracking, with clear breathing room; the tiny tracked genre label centered near the bottom. Hierarchy: title, portrait, author, subtitle, label.",
      },
      {
        ...c("isim", "İsim büyük", "Name as the cover", "Yazar adı kapağın kendisi; portre ya da resim yok.", "The author's name is the design; no portrait or illustration.",
          "a confident typographic publishing design with no portrait or illustration: a deep midnight petrol-blue (or another single deep) ground with an extremely subtle " +
            "matte uncoated-paper texture and nothing else; a clear rectangular grid and generous outer margins; the design is built entirely from typography; " +
            "no faces, photographs, signatures, frames, stripes, icons, emblems, ornaments, gradients, metallic shine, embossing, badges or shadows", ["#0f2a3a", "#f3ead2", "#f2a775"]),
        dark: true,
        textLayout:
          "Warm ivory lettering with one muted apricot accent, everything flush LEFT on the same margin. The AUTHOR NAME is the unmistakable hero occupying roughly the " +
          "upper 60% of the cover: first name on one line and surname immediately beneath, very large bold slightly condensed neo-grotesque uppercase, both lines fitted to " +
          "about the same visual width without distorting letters, first line ivory and second line apricot, no outlines or overlaps. Above the name a very small widely " +
          "tracked genre label. Below the name a substantial pause of empty ground, then the TITLE in an elegant medium-weight literary serif, left-aligned, 1–2 lines, " +
          "clearly secondary but readable in thumbnail; near the bottom left the subtitle small in a clean humanist sans. Hierarchy: author name, title, subtitle, label.",
      },
      {
        ...c("arsiv", "Arşiv fotoğraf + bant", "Archive photo + band", "Üstte eski siyah-beyaz fotoğraf, altta düz renkli yazı bandı.", "Archival black-and-white photo above, solid colored title band below.",
          "a disciplined two-part composition: the upper ~64% is an original fictional black-and-white family-album photograph of ordinary remembered everyday life " +
            "(a 1970s neighborhood street at eye level, small figures walking away, weathered facades, tall wooden windows, a recessed doorway; or a comparable candid " +
            "scene of companionship and passing time), bleeding to the top and both sides, no readable signs, no modern objects, no celebrities; natural overcast light, " +
            "authentic analog softness, gently faded silver-gray midtones, deep charcoal details, delicate film grain, no scratches, stains or torn edges; " +
            "the lower ~36% is a completely opaque flat muted burnt-terracotta (or another single warm) band spanning the full width with a crisp horizontal edge, " +
            "no gradient, no border, no shadow; no text over the photograph; no close-up portraits, frames, scrapbook collage, handwriting, stamps, tape, sepia, sunsets, " +
            "dramatic lighting, famous landmarks or badges; the back cover and spine are the band's flat colour only, no photograph", ["#d9d2c5", "#f3ead2", "#a84a2a"], true),
        photo: {
          layout: "band",
          bg: "#a3472b",
          ink: "#f3ead2",
          prompt:
            "a disciplined two-part memoir cover: the upper part of the front cover is reserved for the author's own archival photograph (see LAYOUT); " +
            "below it a completely opaque flat muted burnt-terracotta (or another single warm, contemporary) band spanning the full width with a crisp " +
            "horizontal edge, fine matte printing texture, no gradient, no border, no shadow; the back cover continues the same calm band color; " +
            "warm contemporary contrast with a cool black-and-white photograph; no illustrations, collage, frames, stamps or badges",
        },
        textLayout:
          "All text sits inside the lower solid band, aligned to one generous LEFT margin (about 8% of the width), in warm ivory. At the top of the band the author in " +
          "small tracked uppercase humanist sans; below it the title on 1–2 lines in a substantial literary serif as the dominant text, comfortably contained in the band; " +
          "below the title the subtitle in small sans; the tiny tracked genre label near the bottom RIGHT of the band with ample clearance. Nothing over the photograph.",
      },
    ],
  },
  {
    code: "DC",
    name: { tr: "Şiir", en: "Poetry" },
    label: { tr: "ŞİİRLER", en: "POEMS" },
    concepts: [
      {
        ...c("motif", "Açık zemin + ince motif", "Light ground + fine motif", "Fildişi kâğıt, tek narin bitkisel çizim, bol boşluk.", "Ivory paper, one delicate botanical drawing, lots of air.",
          "warm pale ivory paper, almost white, with a very fine subtle uncoated-paper texture and no background blocks or gradients; in the lower half ONE exceptionally " +
            "delicate botanical motif — a slightly curved wild branch rising diagonally from the lower right toward the middle left with only a few small narrow leaves " +
            "and one fine bare offshoot, rendered as an original refined drypoint drawing: thin irregular graphite lines, subtle muted-olive pigment, tiny natural " +
            "imperfections, plus one small detached ochre leaf floating apart from it across a meaningful expanse of empty paper (a quiet trace of wind and absence); " +
            "the motif airy and narrow, no more than a quarter of the cover area, never touching the text; no stock-vector branch, no dense foliage, blossoms, bouquet, " +
            "photographs, people, birds, butterflies, frames, flourishes, watercolor washes, gold foil, shadows or stains", ["#f6f1e8", "#3a4a2a", "#c9962d"]),
        textLayout:
          "Deep muted olive-green lettering, all aligned to one LEFT margin at about 12% of the width. The small widely tracked author name near the top (about 12% of the " +
          "height) in an elegant uppercase humanist sans; the title below (from about 24%) on 1–2 lines in a graceful medium-weight literary serif with gently calligraphic " +
          "details, clear and substantial but only about two thirds of the width; directly beneath the title, after a generous gap, the tiny tracked genre label. " +
          "Large untouched ivory between the typography and the motif.",
      },
      {
        ...c("doku", "Soyut doku", "Abstract texture", "Fildişi kâğıt üstünde soyut suluboya; üst üçte bir boş.", "Abstract watercolor on ivory paper; upper third left empty.",
          "an original nonrepresentational watercolor on warm ivory cotton paper: broad translucent washes (smoky blue-gray, faded indigo, muted dusty rose, one small " +
            "earthy rust area) drifting diagonally across the lower two thirds and dissolving into untouched paper — traces carried away without depicting anything " +
            "literally; authentic watercolor behavior (irregular feathered edges, pigment sediment, subtle blooms, overlapping transparent washes, dry-brush " +
            "interruptions, exposed fibers), asymmetrical specific painterly shapes with genuine tonal depth; the upper third predominantly ivory with only extremely " +
            "pale washes near its lower boundary; no landscape, horizon, sea, mountains, flowers, leaves, birds, faces, objects, digital gradients, marbled texture, " +
            "borders, gold foil, splatters, heavy grunge or neon", ["#ece4d8", "#1f3350", "#b7707a"]),
        textLayout:
          "Deep ink-blue lettering entirely over the quiet ivory upper third, all aligned to one LEFT margin at about 10% of the width. Author near the top in small widely " +
          "tracked uppercase humanist sans; the title below on 1–2 lines in an elegant medium-weight literary serif with subtle calligraphic character, substantial and " +
          "legible but never overwhelming the painting; the small tracked genre label below the title after a generous gap; the wash begins farther below, clearly " +
          "separated from all text.",
      },
      {
        ...c("tipografik", "Tipografik şiir", "Typographic poetry", "Kısa bir şiir ve boşluğu kapağın kendisi olur.", "A short poem and its spacing become the cover.",
          "typographic poetry: a flat muted single-color ground (dusty plum, deep moss, ink blue) with very subtle matte paper grain and NOTHING else — no imagery, " +
            "illustration, photograph, branch, watercolor, symbol, border, ornament, oversized quotation marks, handwriting, shadows, embossing, gold foil or gradients; " +
            "the composition is built entirely from the rhythm of language, typography and empty space", ["#4a2a3e", "#f3ead2", "#e8a9b4"], true),
        noteAsText: true,
        textLayout: POETRY_WITH_EXCERPT,
        textLayoutFor: (t) => poetryLayout(t),
      },
    ],
  },
  {
    code: "DB",
    name: { tr: "Klasikler / çeviri dizisi", en: "Classics / translated series" },
    label: { tr: "KLASİKLER", en: "CLASSICS" },
    concepts: [
      {
        ...c("vintage", "Vintage seri", "Vintage series", "Renkli dış çerçeve, fildişi pano, çift çizgi, küçük oval gravür.", "Colored outer field, ivory panel, double rule, small oval engraving.",
          "vintage translated-classics series design: a broad deep single-color outer field (bottle green, oxblood, navy — the series color) surrounding a tall warm-ivory " +
            "inset paper panel (about 82% of the width; its top edge at about 5% and its bottom edge at about 89% of the height, leaving a slightly deeper plain band of the series colour beneath it) with a fine double-rule rectangular frame just inside it, restrained clipped corners, tiny " +
            "symmetric corner joints, no baroque flourishes; authentic subtle uncoated paper grain, clean, not stained; in the lower middle a small oval vignette " +
            "(about 42% of the width) with a very fine double outline containing an exquisite original antique copperplate scene related to the book (an interior " +
            "with a half-open window, a writing table with a letter, a chair; or a comparable quiet scene), no people, fine engraved hatching in dark ink and warm gray " +
            "on ivory, intimate and precise, never a full-page illustration; a repeatable family identity usable with varying series colors; no gold foil, gloss, " +
            "leather simulation, heavy ornament, distressed or torn edges, large portraits, modern icons or gradients", ["#1f4a2e", "#efe6d2", "#1f4a2e"]),
        textLayout:
          "All typography inside the ivory panel in the dark series-color ink, on a precise CENTRAL axis. At the top a very small tracked uppercase series word " +
          "(e.g. the genre label or a series name) with a small number between two short fine rules if a series number is given; below it the author in medium-small " +
          "tracked uppercase old-style serif; beneath the author the title as the main typographic focus in a refined substantial old-style literary serif with " +
          "bracketed serifs on 2–3 balanced centered lines; the oval vignette below the title after generous space; the tiny tracked genre label centered near the " +
          "bottom of the panel with a large lower margin.",
      },
      {
        ...c("gravur", "Gravür", "Engraving", "Büyük dönem gravürü, tek mürekkep rengi; anlatı sahnesi.", "Large period engraving in a single ink; a narrative scene.",
          "a large original nineteenth-century copperplate-style narrative illustration printed in a SINGLE deep ink (Prussian blue, sepia or bottle green) on warm pale " +
            "ivory paper with subtle fine grain — all tonal variation only from engraved line density and stippling; it fills the lower ~65%, extending to the left, right " +
            "and bottom edges with no frame or oval, its uppermost lines tapering naturally into the paper; a scene from the book's world (e.g. a weathered period townhouse " +
            "entrance with a half-open door and worn steps, a solitary figure in period dress seen from behind holding a meaningful object; or a comparable scene built " +
            "around this book's own subject), any figure modest relative to the architecture, " +
            "masterful cross-hatching, curved engraved strokes, delicate stippling, one deep dark area anchoring the composition, strong perspective, natural anatomy; " +
            "no photographic shading, digital painting, CGI, cartoon outlines, vector graphics, second accent color, sepia stains, frames, ornaments or fake aging", ["#efe6d2", "#1c2f55", "#1c2f55"]),
        textLayout:
          "All lettering in the same single ink, LEFT-aligned with margins of about 8% of the width, in the clean upper ~30% paper field. At the top left a very small " +
          "generously tracked series/genre word; beneath it the author in modest uppercase old-style serif; below, the title on two left-aligned lines in a substantial " +
          "elegant literary serif, unmistakable at thumbnail size, never oversized; clear separation from the engraving; the tiny tracked genre label at the lower left " +
          "inside a quiet pale area of the picture, without a banner.",
      },
      {
        ...c("minimal", "Minimal dizi", "Minimal series", "Tek düz seri rengi, disiplinli yazı, küçük anlamlı amblem.", "One flat series color, disciplined type, one small meaningful emblem.",
          "minimal classics-series design: one full-bleed muted flat series color (saffron ochre, teal, brick, slate) with an extremely subtle matte paper grain; one small " +
            "original editorial emblem (about 17% of the width) centered horizontally at about two thirds of the height — a precise simple silhouette in warm ivory with two or " +
            "three fine dark lines, a witty visual metaphor merging two ideas from the book (e.g. an envelope whose flap is a house roof with a tiny doorway); it reads as a " +
            "literary emblem, not an app icon or realistic object; a large amount of uninterrupted flat color around it; no frame, circle, shadow, wax seal, borders, panels, " +
            "landscapes, people, photographs, engravings, flourishes, metallic effects, embossing or fake aging", ["#d99a2b", "#4a1f33", "#f6ecd2"]),
        textLayout:
          "Deep dark ink (aubergine or near-black) lettering on a precise repeatable grid with margins of about 10% of the width, all LEFT-aligned. A discreet series header: " +
          "the tiny tracked uppercase series/genre word at the top left and a small number at the top right on the same baseline (only if a number is given). Around 23% " +
          "down, the author in small refined uppercase humanist sans with generous tracking; beneath it the title in a beautifully drawn medium-weight old-style serif on 1–2 " +
          "left-aligned lines without splitting words, strong and readable, in the upper-middle region; the tiny tracked genre label at the bottom left.",
      },
    ],
  },
  {
    code: "FB",
    name: { tr: "Roman", en: "Novel" },
    label: { tr: "ROMAN", en: "A NOVEL" },
    concepts: [
      c("sahne", "Atmosferik sahne", "Atmospheric scene", "Mekân ve ışık üzerinden hikâye anlatan görsel; güçlü edebî tipografi.", "A place and its light tell the story; strong literary typography.",
        "a single evocative place that carries memory — modest authentic architecture, a shore, a street, a room — at dusk or in quiet light, no people; " +
          "refined photographic collage with fine analogue film grain and delicate hand-painted retouching, tactile matte ink reproduction; " +
          "deep desaturated palette (petrol green, blue-grey, warm limestone, sparse burnt-amber light), low-key subdued tonal gradations; " +
          "no glossy CGI, no HDR, no blockbuster lighting, no moon, no birds, no magical particles; editorial restraint and meaningful quiet", ["#2d3a46", "#f1ece4", "#d49a4a"]),
      c("boyama", "Boyama (painterly)", "Painterly", "Fırça izi, duygu.", "Brushwork, feeling.",
        "an original sophisticated oil and gouache painting — visible dry brush, scraped pigment, canvas tooth, expressive broad painterly shapes, subtle pencil traces; " +
          "an intimate scene where one object or doorway holds the emotion, quiet human memory without people, long soft diagonal light; " +
          "beautiful imperfect painterly surfaces and surprising harmonious colors (dusty coral, burnt sienna, deep ultramarine, sage, warm pale lemon); " +
          "emphatically not photographic, no glossy digital realism, no gold ornament, no artificial glow, no gradients", ["#e9dfcf", "#2b2420", "#8c5a3c"]),
      {
        ...c("tipografik", "Tipografik roman", "Typographic novel", "Resimsiz, başlık tasarımın kendisi.", "No image, the title is the design.",
        "warm very pale ivory uncoated paper ground with subtle print grain and nothing else — a tactile two-ink print aesthetic; " +
          "at most one tiny restrained geometric accent in burnt vermilion near the lower third (a thin threshold line), no illustration, no icon, no ornament", ["#f4efe6", "#102a2e", "#c9472b"]),
        textLayout:
          "The title IS the design: deep petrol-ink high-contrast display serif CAPITALS, left-aligned with margins of about 7% of the width, stacked one word or short " +
          "phrase per line, each line scaled to span the full text width so the shortest word becomes the largest; the title block fills roughly 18% to 84% of the height " +
          "with tight leading. The author small, widely tracked uppercase across the top at about 8%. The single burnt-vermilion accent is a thin threshold line or tiny " +
          "doorway cut into the foot of the largest letter. The tiny tracked genre label at the bottom left, just above the logo strip.",
      },
    ],
  },
  {
    code: "FF",
    name: { tr: "Polisiye / gerilim", en: "Crime / thriller" },
    label: { tr: "POLİSİYE / GERİLİM", en: "CRIME / THRILLER" },
    concepts: [
      {
        ...c("nesne", "Koyu + tek nesne + kırmızı", "Dark + single object + red", "Karanlık zemin, tek ipucu nesne, tek kırmızı vurgu.", "Dark ground, one clue object, one red accent.",
          "a near-black charcoal matte surface almost disappearing into shadow, and ONE clue object related to the book photographed from above in the central " +
            "lower half on a slight diagonal (e.g. an old scratched steel key with a short crimson thread knotted through its bow) — realistic proportions, worn " +
            "edges, subtle oxidation, fine scratches, convincing weight; a narrow raking light from the upper left catching edges and fibers, a restrained soft " +
            "shadow, editorial still-life photography with natural optics and superb texture; cool desaturated steel plus ONE precise crimson accent; emotionally " +
            "suggestive, not overexplained; no city, fog, silhouettes, buildings, secondary props, multiple objects, blood, weapons, hands, evidence tags, police " +
            "tape, smoke, lens flares, CGI shine or fantasy glow", ["#111214", "#efe8da", "#c1121f"], true),
        textLayout:
          "LEFT-aligned with about 9% outer margins. Author at the top left in modest warm off-white uppercase sans with generous tracking; below it, in the upper " +
          "third, the title in very large bold condensed uppercase sans on 1–2 lines with disciplined sharp letterforms and close controlled spacing, first line warm " +
          "off-white and second line deep crimson matching the accent (one line: off-white with the key word crimson); clean solid lettering, not distressed or " +
          "glitchy, readable at thumbnail; a generous dark interval between title and object, never overlapping; the small widely tracked genre label in muted " +
          "off-white at the bottom left.",
      },
      {
        ...c("siluet", "Silüet ve sis", "Silhouette and fog", "Gece sokağı, sis, uzaklaşan küçük bir figür.", "A night street, fog, a small figure walking away.",
          "a narrow believable old-city side street at night photographed at pedestrian eye level: old plaster facades and recessed doorways on both sides " +
            "creating deep perspective, damp paving stones with sparse reflections, cool blue-gray fog obscuring the far end; ONE small anonymous adult figure in a " +
            "plain dark coat walking away, slightly right of center in the middle distance (about 14% of the height), natural stride, no visible face; one distant " +
            "warm amber streetlamp making a dim pool of light and a broken reflection; foreground architecture in rich charcoal shadow; authentic editorial " +
            "photography with subtle film grain and plausible light scattering, not a video-game scene; deep midnight blue, charcoal, desaturated slate, pale fog " +
            "gray and a single subdued amber; no red accent, no landmarks, cars, neon, readable signs, keys, guns, blood, police tape, fedoras, multiple " +
            "silhouettes, giant moons, rain streaks or lens flares", ["#141b26", "#efe8da", "#e0a34a"], true),
        textLayout:
          "CENTERED. The upper third is a calm dark area of the scene for exceptional readability: the author at the top center in modest widely tracked uppercase " +
          "pale-gray sans; below it the title in very large strong condensed uppercase sans on 1–2 centered lines as one compact monumental block, warm off-white, " +
          "clean precise letterforms; the figure fully visible below and never overlapping letters; the small tracked genre label at the bottom center in pale gray " +
          "over a quiet dark area.",
      },
      {
        ...c("tipografik", "Sert tipografi", "Hard typography", "Başlığın kendisi görsel; tek bir kasıtlı kesik.", "The title is the image; one deliberate cut.",
          "hard-edged expressive typographic crime cover: a flat deep vermilion-red (or another single strong) ground with a barely perceptible matte printed-paper " +
            "grain and NOTHING else — no photographs, silhouettes, streets, fog, objects, icons, weapons, blood, fingerprints, police tape, borders, warning stripes, " +
            "gradients, lighting effects, distressed textures, 3D lettering, bevels, shadows, embossing or metallic shine; the emotional effect comes solely from " +
            "scale, weight, contrast and one displaced typographic cut — the impact of a carefully printed two-ink design", ["#c8102e", "#111111", "#f2e8d8"], true),
        textLayout:
          "Strong LEFT alignment with generous safe margins. Author at the upper left in modest warm off-white uppercase grotesque sans, precisely tracked. The title " +
          "is a monumental near-black block occupying the central ~65% of the cover: very heavy strongly condensed uppercase grotesque, rigid stems, tight spacing, " +
          "compact leading, lines balanced to about the same width by size (never distorted, never cropped), every letter and Turkish dot readable. ONE precise " +
          "disruption: a narrow horizontal incision in the ground color crosses the LAST title line at mid-letter height and the parts below it shift slightly to " +
          "the right (about 1% of the width) — a single coherent misalignment; the first line stays intact; no other cuts, glitch noise or broken letters. The tiny " +
          "widely tracked genre label at the bottom left in warm off-white, aligned with the author.",
      },
    ],
  },
  {
    code: "FM",
    name: { tr: "Fantastik / bilimkurgu", en: "Fantasy / sci-fi" },
    label: { tr: "FANTASTİK ROMAN", en: "FANTASY NOVEL" },
    concepts: [
      {
        ...c("manzara", "Epik manzara", "Epic landscape", "Ölçek, mimari, mesafe ve ışık; küçük bir yolcu.", "Scale, architecture, distance and light; one tiny traveler.",
          "an original atmospheric epic landscape painting (fine tempera detail with softly layered oil glazes, subtle hand-painted materiality, not glossy concept " +
            "art): a vast architecturally coherent place from the book's world (e.g. an ancient city carved into a towering limestone cliff — tiered terraces, narrow " +
            "arched openings, worn stairways, a few slender towers) above a mist-filled valley; a long slender stone bridge crossing the gulf from a dark foreground " +
            "ledge toward one luminous entrance as a quiet diagonal; ONE tiny traveler under 3% of the height as a scale cue; massive form on one side, shadowed " +
            "foreground rock opposite, luminous layered mist between, far mountains dissolving into pale atmosphere, late-afternoon light, rich blue-green shadows; " +
            "deep blue-green, weathered limestone, muted slate, pale warm ivory light; the upper third a softly luminous calm overcast sky with nothing intruding; " +
            "no floating islands, dragons, spaceships, giant moons, magic beams, glowing runes, oversaturation, lens flares, excessive stars or stock fantasy spectacle",
          ["#d8d3c6", "#163a3e", "#a35a2e"]),
        textLayout:
          "CENTERED, all lettering inside the calm sky of the upper third. The author at the top center in small widely tracked uppercase, deep blue-green, generous " +
          "top margin; below it the title on 2–3 balanced centered lines in a refined literary display serif with elegant wedge serifs and gently flared terminals, " +
          "about 65% of the width, deep blue-green ink (not gold), feeling authored with the painting; the tiny widely tracked genre label at the bottom center in " +
          "warm ivory on a quiet dark foreground area.",
      },
      {
        ...c("amblem", "Sembol-amblem", "Symbol emblem", "Kitabın dünyasına özgü tek gravür mühür; koyu zemin.", "One engraved seal unique to the book's world; dark ground.",
          "ONE original coherent heraldic seal representing the book's imaginary world (e.g. a forgotten cliff city: a narrow stone bridge rising to a tall arched " +
            "doorway framed by stepped terraces, an incomplete celestial arc above with a small gap at its apex) — a slender vertical oval about 45% of the width and " +
            "35% of the height, centered in the lower middle, drawn with exceptionally precise fine engraved strokes in muted antique-brass ink (flat printed color, " +
            "line-density variation), stronger silhouette lines and delicate interior hatching, clear open spaces readable at thumbnail; full-bleed deep midnight " +
            "petrol-green (or another single deep) paper ground with subtle matte grain; one unified insignia, not a collection of icons; no letters, runes, swords, " +
            "wings, crowns, animals, stars, landscape painting, characters, photographs, outer borders, corner ornaments, sacred geometry, astrological charts, " +
            "filigree, mandalas, shiny gold, foil, embossing, glow or leather texture", ["#0f2a26", "#efe6cf", "#b39a62"], true),
        textLayout:
          "Disciplined CENTRAL axis with generous breathing room, warm ivory lettering. The author at the top center (about 8% down) in small widely tracked uppercase " +
          "serif; below it the title on 2–3 balanced centered lines in a beautifully drawn literary display serif with gently flared terminals and restrained wedge " +
          "serifs (not pseudo-medieval), about 72% of the width, in the upper third; a clear empty interval, then the seal; the tiny tracked genre label at the " +
          "bottom center in muted ivory.",
      },
      {
        ...c("karakter", "Karakter", "Character", "Kahramanın yaşayan portresi; arkada dünyanın sessiz izleri.", "A living portrait of the protagonist; quiet traces of the world behind.",
          "a character-focused literary fantasy painting: an original fine-art work combining precise tempera drawing and softly layered oil glazes — ONE adult " +
            "protagonist from the book shown from the waist up in three-quarter view in the lower right two thirds, a distinctive specific face (not a generic " +
            "glamorous model), expression of resolve mixed with uncertainty, gaze toward the left into the distance (not at the viewer), simple worn clothing with " +
            "carefully painted folds and one small meaningful object held naturally, believable anatomy and hands; behind, faint quiet traces of the world (ancient " +
            "terraces, a narrow bridge receding into mountain mist) — not an epic panorama; a gentle pale sidelight on the face, which stays the main focal point; " +
            "deep blue-green, muted limestone, smoky gray, restrained burnt sienna, soft ivory light; the upper third a calm pale atmospheric field; no armor, crowns, " +
            "weapons, elaborate costume, magical glow, giant moons, flying creatures, glossy digital rendering, beauty retouching, sparks, lens flares or game-poster look",
          ["#cfcac0", "#163a3e", "#9a4a2a"]),
        textLayout:
          "CENTERED, all lettering in the calm upper third and entirely above the character's head (never over hair or face). The author at the top center in small " +
          "widely tracked deep-ink uppercase serif; below it the title on 2–3 balanced centered lines in a refined literary display serif with gently flared terminals, " +
          "deep blue-green ink, elegant and substantial; leave luminous mist to the left of the face for the gaze; the tiny tracked genre label at the bottom center " +
          "in warm ivory over a dark quiet area.",
      },
    ],
  },
  {
    code: "FR",
    name: { tr: "Romantik", en: "Romance" },
    label: { tr: "ROMAN", en: "A NOVEL" },
    concepts: [
      {
        ...c("figur", "Yumuşak ışık + figür", "Soft light + figures", "Pencere ışığında iki insan; aradaki küçük boşluk duygunun merkezi.", "Two people in window light; the small gap between them is the heart.",
          "an original oil-and-tempera illustration with delicate visible brushwork: a quiet old interior beside a tall open window in late afternoon; two adults " +
            "around thirty facing each other from roughly the waist up, close but NOT touching — the small luminous interval between them is the emotional center; " +
            "tender searching expressions, natural unperformed posture, looking at each other not at the viewer, hands mostly below the crop; warm diffused window " +
            "light on faces and clothing edges, interior in muted olive-gray shadow, a soft sheer curtain lifted by air along one edge, only atmospheric shapes " +
            "outside; distinctive real faces, convincing anatomy; warm ivory, dusty rose, restrained terracotta, muted olive, soft honey light; the figures and window " +
            "in the lower ~60%, the upper ~40% a quiet warm ivory plaster wall; no kiss, embrace, melodrama, fashion glamour, pink gradients, hearts, bouquets, " +
            "sparkles, sunsets, beaches, floating petals or stock-photo romance", ["#efe3d0", "#5a1a24", "#c98a7a"]),
        textLayout:
          "Dark burgundy flat lettering, LEFT-aligned, in the quiet wall area above the figures (faces fully below the lettering). Author near the top left in small " +
          "generously tracked uppercase humanist sans; below it the title on 1–3 left-aligned lines in ONE consistent refined UPRIGHT literary serif (same style, " +
          "size and weight on every line, never italic, never stretched), longest line about 40–45% of the width, optically balanced line spacing, generous empty " +
          "wall to the right; the tiny tracked genre label at the bottom left in warm ivory over a quiet darker area.",
      },
      {
        ...c("cicek", "Çiçek + el yazısı", "Flowers + hand lettering", "Birbirine uzanan iki çiçekli dal; zarif el yazısı başlık.", "Two flowering stems reaching toward each other; graceful hand-lettered title.",
          "original hand-painted botanical illustration on warm pale blush-ivory paper with subtle uncoated grain: two gracefully curving flowering stems loosely " +
            "interwoven near the lower third (e.g. a slender garden rose branch with two open pale apricot roses rising along the left edge, and an airy sweet-pea " +
            "stem with dusty-rose blossoms and fine curling tendrils rising along the lower right) — an open asymmetrical embrace around the center, never a closed " +
            "wreath or border; detailed but restrained watercolor and colored-pencil technique, translucent petals, fine veins, botanically believable, no stock " +
            "clip art; substantial warm paper visible, flowers secondary to the lettering; muted olive and eucalyptus greens, dusty rose, faded apricot; no people, " +
            "hearts, ribbons, frames, dense bouquets, floating petals, glitter, gold, neon pink or greeting-card look", ["#f4e4dc", "#5a1f33", "#e8a98a"]),
        textLayout:
          "Dark mulberry ink. The title in the central open paper area on 1–3 lines in ONE consistent custom hand-lettered style: restrained mature gently slanted " +
          "literary pen lettering with moderate stroke variation, open counters and short natural connections (an accomplished writer's handwriting, not wedding " +
          "calligraphy) — same scale, weight and slant on every line, no swashes or flourishes, every letter clearly readable, Turkish letters exact; about 60% of " +
          "the width, optically centered, clear of all stems. The author at the top center in small widely tracked uppercase humanist sans; the tiny tracked genre " +
          "label at the bottom center in the same color.",
      },
      {
        ...c("pastel", "Pastel sahne", "Pastel scene", "Guaj illüstrasyon; bir sokakta karşılaşan iki küçük figür.", "Gouache illustration; two small figures meeting in a lane.",
          "an original gouache and colored-pencil illustration on subtly textured paper — simplified architectural planes, gently irregular painted edges, restrained " +
            "pencil details, matte opaque colors; clearly illustrated, mature and graceful (not photoreal, not childish): a quiet place from the book's world (e.g. a " +
            "coastal town lane curving between a warm cream house and a dusty peach house toward a low seawall and a pale blue sea), sage shutters, a curved doorway, " +
            "one small terracotta pot; two small adult figures (about 13% of the height each, full bodies, minimal facial marks) meeting in the lower middle, facing " +
            "each other at a short distance with understated body language; soft late-afternoon light with lavender shadows; the scene in the lower two thirds framed " +
            "by architecture, the upper third a calm pale warm-cream sky with no buildings behind it; warm cream, faded peach, powder blue, muted sage, dusty lavender, " +
            "tiny coral accents; no embrace, kiss, sunset disc, boats, crowds, birds, hearts, petals, neon, gradients, wreaths, borders or postcard look",
          ["#f3e6d2", "#5a2340", "#e88b6f"]),
        textLayout:
          "CENTERED, deep muted plum, all lettering in the calm sky of the upper third. The author at the top center in small widely tracked uppercase humanist sans; " +
          "below it the title on 1–3 centered lines in ONE consistent upright literary serif (same size and weight on every line, no italics, no handwriting, never " +
          "stretched), within about 60% of the width; a clear visual path from the title down to the figures; the small tracked genre label at the bottom center " +
          "over a clear pale area.",
      },
    ],
  },
  {
    code: "FU",
    name: { tr: "Hiciv / mizah", en: "Satire / humour" },
    label: { tr: "HİCİV / MİZAH", en: "SATIRE / HUMOUR" },
    concepts: [
      {
        ...c("gravur", "Gravür + sert yazı", "Engraving + forceful type", "Ciddi gravür portre + absürt bir ayrıntı; kırmızı-siyah güçlü başlık.", "Serious engraved portrait + one absurd detail; forceful red-and-black title.",
          "one original nineteenth-century satirical copperplate illustration in the lower half on warm ivory uncoated paper (clean, subtle grain, rich black engraved " +
            "lines): a pompous fictional figure tied to the book's target of satire, drawn with the full seriousness of fine engraved portraiture, with ONE elegantly " +
            "understated absurd proportion or detail carrying the joke (e.g. a self-satisfied gentleman in an extravagant frock coat sitting very upright on an absurdly " +
            "small plain stool, chin lifted, hands solemnly on his knees); the entire figure visible with ample ivory around it, slightly right of center, a small " +
            "hatched ground shadow, no scene background; fine curved hatching and delicate cross-hatching, natural anatomy, a fictional face not based on any real " +
            "person; the joke clear but not grotesque; no crown, throne, medals, extra props, extra people, speech bubbles, slapstick, colorful caricature, borders, " +
            "corner flourishes, sepia stains, faux aging, gold foil or vector-cartoon look", ["#efe6d2", "#111111", "#c8102e"]),
        textLayout:
          "LEFT-aligned with generous margins, in the upper ~38%. Author at the upper left in small tracked black uppercase sans; below it an emphatic title of 2–3 " +
          "lines in a masterfully spaced bold condensed grotesque uppercase face forming one compact block without stretching letters — black, with ONE key word/line " +
          "in flat deep vermilion; crisp and disciplined, Turkish dots and accents exact, no distressed or bubble letters; breathing room beneath the title before " +
          "the engraving; the tiny tracked genre label at the bottom left in black, clear of the figure.",
      },
      {
        ...c("karikatur", "Karikatür", "Caricature", "Elle çizilmiş editoryal karikatür; tek, akıllı bir görsel şaka.", "Hand-drawn editorial caricature; one smart visual joke.",
          "an original hand-drawn editorial caricature on a flat muted single-color paper ground (butter yellow, pale mint, dusty peach) with very subtle matte texture: " +
            "ONE fictional pompous contemporary figure tied to the book's target of satire, caught in a single clear absurd situation that IS the joke (e.g. a man " +
            "ceremoniously carrying a framed portrait of himself, the portrait even prouder than he is); elegant caricature proportions (small body, slightly oversized " +
            "head, exaggerated nose, raised chin, thin self-satisfied smile), no resemblance to any real person, coherent hands; the entire figure visible in the lower " +
            "~60%, slightly right of center, generous empty space, a tiny ink ground mark, no room or scenery; confident slightly irregular black pen lines, selective " +
            "flat gouache fills, a few dry-brush accents, lots of open paper — expert magazine illustration; limited palette (charcoal ink, one dusty clothing color, " +
            "restrained brick-red accents, warm ivory); no vector clip art, 3D cartoon, children's-book look, crowds, extra props, medals, crowns, money, speech " +
            "balloons, sound effects, borders or writing inside the picture", ["#f2d98a", "#1f1f1f", "#b23a2a"]),
        textLayout:
          "LEFT-aligned compact block in the upper third. Author at the upper left in small tracked charcoal uppercase humanist sans; below it the title on 2–3 " +
          "left-aligned lines in a substantial beautifully spaced condensed slab-serif display face with slightly softened square serifs — charcoal, with ONE key " +
          "word/line in brick red; mature and highly readable, not bubbly or graffiti-like, never overlapping the illustration; the tiny tracked genre label at the " +
          "bottom left in charcoal sans.",
      },
      {
        ...c("tipografik", "Tipografik şaka", "Typographic joke", "Şaka yazının ölçeğinde: bir sözcük şişer, ötekiler kenara itilir.", "The joke is in the scale: one word inflates, the rest are pushed aside.",
          "a typographic joke where the spatial hierarchy itself is the satire: a flat saturated single-color paper ground (cobalt blue, tomato red, emerald) with very " +
            "subtle matte print texture and NOTHING else — no characters, portraits, caricatures, engravings, icons, crowns, speech balloons, frames, stripes, " +
            "photographic textures, gradients, shadows, bevels or gloss; the cover is built entirely from type in two or three flat colors, with the confidence of a " +
            "carefully art-directed printed poster that still functions as a book cover", ["#1034b8", "#f4e36b", "#e8402a"], true),
        textLayoutFor: (t, lang) => jokeLayout(t, lang),
        textLayout:
          "NOT a conventional stacked title. Pick the ONE word of the title that carries the satire and let it behave like an inflated ego: set it enormous in " +
          "exceptionally heavy broad neo-grotesque uppercase, in a warm pale contrasting color, broken across two lines only at a natural syllable boundary if " +
          "needed (no hyphen, no repeated letters), occupying about 70% of the height and about 75% of the width from the left margin — leaving a clear strip " +
          "along the right edge for the author — without clipping any letter or Turkish dot. All other title words stay deliberately tiny but clearly legible and " +
          "KEEP THEIR PLACE IN THE SENTENCE: every word that comes BEFORE the giant word in the title sits small ABOVE it at the upper left in a vermilion accent; " +
          "every word that comes AFTER it sits small BELOW it at the bottom left in ivory with moderate tracking. If the giant word is the FIRST word of the title, " +
          "nothing sits above it and all the other words go below it in their original order; if it is the LAST word, all the other words go above it. Never move " +
          "a word to the other side of the giant word — read from top to bottom the cover must say exactly the given title, with its meaning unchanged. The author " +
          "MUST appear: one small ivory line running along the right-edge strip, rotated 90° clockwise, with a clear gutter from the giant word; the tiny genre " +
          "label sits horizontally in the upper right. A subtitle, if any, is one tiny ivory horizontal line at the very top left, level with the genre label and " +
          "above everything else — never between the title words. No arbitrary rotation of title words, no distortion, no extra punctuation.",
      },
    ],
  },
  {
    code: "NH",
    name: { tr: "Tarih", en: "History" },
    label: { tr: "TARİH", en: "HISTORY" },
    concepts: [
      {
        ...c("arsiv", "Arşiv görsel + bant", "Archive image + band", "Üstte belgesel havasında siyah-beyaz sahne, altta düz renkli yazı bandı.", "Documentary-style monochrome scene above, solid colored title band below.",
          "a distinguished social-history layout in two parts: the upper ~66% is an original fictional historical reconstruction in the visual language of an early " +
            "twentieth-century monochrome documentary photograph (NOT an actual document) showing the book's subject as working everyday life — e.g. an expansive " +
            "elevated diagonal view along a stone harbor quay with wooden cargo boats, modest warehouses, coiled ropes and a few small distant workers; a strong " +
            "diagonal leading the eye down toward the band; plausible restrained period details, natural anatomy, no prominent faces, famous people, modern objects " +
            "or readable signs; atmospheric silver-gray tones, soft daylight, delicate film grain, gentle fading; bleeding to the top and sides with no text over it; " +
            "the lower ~34% is a full-width flat deep midnight-navy (or another single deep) band with a clean straight edge, no border, shadow or gradient; a sense " +
            "of labor, trade and collective memory rather than picturesque nostalgia; no heavy sepia, scratches, torn edges, archive stamps, frames, maps, seals, " +
            "flags, collage scraps, handwriting or gold foil", ["#c9c9c4", "#f3ead2", "#12203f"]),
        textLayout:
          "All text inside the lower solid band with generous internal margins. The tiny tracked genre label at the top left of the band; beneath it the title on " +
          "1–2 LEFT-aligned lines in a refined substantial old-style serif with bracketed serifs, warm ivory, about 72% of the width, scholarly but welcoming; the " +
          "subtitle beneath in small warm-ivory humanist sans, left-aligned; the author at the bottom RIGHT of the band in modest tracked uppercase sans in muted " +
          "warm ochre, balancing the left-aligned title. Nothing over the image; the author is not at the top.",
      },
      {
        ...c("harita", "Harita / belge dokusu", "Map / document texture", "Özgün gravür harita; açık suda sakin bir başlık alanı.", "An original engraved plan; a calm title field in the open water.",
          "an original fictional plan inspired by nineteenth-century engraved surveys (not a reproduction of any real document) of the place the book is about, on warm " +
            "off-white rag paper with restrained fibers and one very faint natural fold: e.g. a finely engraved coastline curving around a sheltered harbor, small urban " +
            "blocks, warehouse footprints, narrow streets and slender piers clustered along the left half and bottom, cropped boldly at the edges like part of a larger " +
            "sheet, with open water in the upper right and center as a quiet pale field; precise charcoal-gray and subdued slate-blue line work, delicate shoreline " +
            "hatching, lightly washed water boundaries, varied line weights; ONE muted brick-red route line well below the title area and one small exquisitely drawn " +
            "compass rose without letters; scholarly and contemporary, not a pirate map; no labels, handwriting, numbers, stamps, seals, fake archival credentials, " +
            "stains, burned or torn edges, photographs, portraits, ships in perspective, treasure symbols, borders, scrolls, gold foil or sepia overload",
          ["#ece5d6", "#6b1420", "#5a7183"]),
        textLayout:
          "RIGHT-aligned to a margin at about 9% from the right edge, all in the quiet open area (no text box or band, map lines kept out of the title's background). " +
          "The tiny widely tracked genre label near the upper right; beneath it the title on 2–3 right-aligned lines in a refined medium-weight old-style serif, deep " +
          "oxblood burgundy, same size on every line, about 70% of the width; the subtitle below in two small charcoal humanist-sans lines, right-aligned; the author " +
          "near the bottom LEFT in medium-small burgundy tracked uppercase sans on a calm strip of paper, balancing the upper-right title block.",
      },
      {
        ...c("akademik", "Sade akademik", "Plain academic", "Düz koyu zemin, ölçülü serif başlık, tek ince çizgi.", "Solid deep ground, measured serif title, one fine rule.",
          "restrained academic typography on a solid color: a full-bleed muted deep single color (aubergine-brown, bottle green, ink blue) like matte dyed book paper " +
            "with extremely subtle grain and NOTHING else except one thin subdued copper horizontal rule — no photographs, maps, engravings, symbols, anchors, seals, " +
            "borders, panels, extra lines, illustrations, flourishes, leather texture, foil, bevels, shadows or gradients; proportion, alignment, paper color and " +
            "typographic craft provide all the visual interest; complete and intellectually serious, never empty or unfinished", ["#3a1a22", "#f3ead2", "#b87333"], true),
        textLayout:
          "Warm ivory lettering, deliberately paced with substantial empty space in the upper quarter. The tiny widely tracked genre label near the upper left (about " +
          "9% from the left, 8% from the top). The title in the MIDDLE of the cover, beginning around 35% of the height, on 1–2 LEFT-aligned lines (left margin 10%) " +
          "in an exceptionally elegant medium-weight old-style serif, first line about 78% of the width, same size on every line, never stretched; below it, after a " +
          "deliberate interval, the thin copper rule (about 40% of the width, same left margin) and under it the subtitle in two small humanist-sans lines; the " +
          "author near the bottom RIGHT (about 11% above the bottom, right-aligned) in medium-small ivory uppercase serif with restrained tracking, counterbalancing " +
          "the title. No italics, no oversized initials.",
      },
    ],
  },
  {
    code: "K",
    name: { tr: "İş / ekonomi", en: "Business / economics" },
    label: { tr: "İŞ / EKONOMİ", en: "BUSINESS / ECONOMICS" },
    concepts: [
      {
        ...c("ikon", "Düz renk + tek ikon", "Flat color + single icon", "Düz güçlü renk, kalın sans başlık, tek kavramsal ikon.", "Solid strong color, bold sans title, one conceptual icon.",
          "a full-bleed deep single color (cobalt blue, forest green, charcoal) in flat matte ink with nearly imperceptible paper grain, and ONE elegant original flat " +
            "graphic icon in the upper middle (around 28% of the height, about 48% of the width and only ~12% of the height) expressing the book's core idea as a " +
            "single economical visual metaphor — e.g. a finely balanced lever: a long slender ivory beam on a small triangular fulcrum slightly off-center, with one " +
            "small tangerine square on the short end (how one small decision shifts the balance); precise clean geometry in warm ivory with ONE restrained accent " +
            "color, generous empty color around it; not a financial chart or technical diagram; no numbers, arrows, labels, currency signs, photographs, portraits, " +
            "coins, banknotes, stock charts, skyscrapers, light bulbs, multiple icons, 3D objects, shadows, embossing or gradients", ["#0d1f8f", "#f6efdc", "#f26a1b"], true),
        textLayout:
          "Warm ivory lettering, LEFT-aligned with a 9% left margin; the top quarter stays airy. The tiny tracked genre label at the upper left. The title in the " +
          "lower half, beginning around 51% of the height, on 1–2 left-aligned lines in an exceptionally well-drawn bold humanist sans (title case as supplied, not " +
          "all caps; open counters, softened terminals; no condensed poster type, no cartoon rounding), about 76% of the width, same size on every line. Near the " +
          "bottom a quiet two-column footer: the author in modest tracked uppercase sans on the left, the subtitle in small sans on the right broken into 2–3 short " +
          "lines, both top-aligned with generous separation; no separating lines or panels.",
      },
      {
        ...c("grafik", "Grafik / veri motifi", "Graphic / data motif", "Soyut bilgi tasarımı: olası yollar ve seçilen tek yol.", "Abstract information design: possible paths and the one chosen.",
          "an abstract information-design motif (NOT an actual data visualization) on warm off-white paper with subtle fine grain: a delicate very pale square grid over " +
            "the lower and right portions, thinning out toward the title area by fewer printed lines; several fine gray-green possible trajectories starting in a compact " +
            "cluster near the lower left and diverging organically toward the right — smooth thin lines with gentle turns like alternative scenarios, some ending lower " +
            "or bending sideways (uncertainty, not guaranteed growth); ONE slightly heavier burnt-orange trajectory in a graceful sweep ending in a single small filled " +
            "circle near the upper right — the chosen course; flat matte inks, generous white space, about half the visual area; no arrowheads, extra dots, bars, " +
            "numbers, axes, legends, percentages, currency symbols, candlesticks, giant arrows, photographs, coins, light bulbs, panels, gloss, shadows or the look of " +
            "a presentation slide or dashboard", ["#f3eee3", "#12381f", "#e4701e"]),
        textLayout:
          "Asymmetric editorial layout, deep forest-green lettering on clear blank paper (the motif never runs behind text). The title near the upper LEFT (9% left " +
          "margin, 12% top margin) on 1–2 left-aligned lines in an elegant bold Swiss-influenced humanist sans, about 68% of the width, same size on every line; " +
          "below it, after generous space, the subtitle in small sans on two balanced lines. The author at the bottom left in medium-small uppercase sans with " +
          "restrained tracking; the tiny genre label at the bottom right on the same baseline.",
      },
      {
        ...c("portre", "Portre / otorite", "Portrait / authority", "Yazarın editoryal portresi; sakin, güven veren düzen.", "The author's editorial portrait; calm, trustworthy layout.",
          "an authentic editorial author-portrait cover: an original photographic waist-up portrait of the (fictional) author on the RIGHT half, extending to the right " +
            "and bottom edges, head beginning around 27% down — a distinctive real-looking face with natural skin texture, calm slight smile, looking at the viewer, " +
            "shoulders slightly turned, dark tailored jacket over a simple light blouse or shirt, no conspicuous jewelry; soft window light from the left, muted " +
            "realistic color, superb fabric and skin detail; the portrait blends seamlessly into a warm light-gray studio backdrop, and the left half is a clean warm " +
            "off-white field with no dividing line or panel; approachable expertise, composure and clarity; no crossed-arm power pose, glamour retouching, celebrity " +
            "resemblance, office furniture, laptops, bookshelves, props, charts, icons, handshakes, spotlights, vignettes, banners or gold foil", ["#e9e4dc", "#0f1b3d", "#b87333"]),
        textLayout:
          "Deep midnight-navy lettering, LEFT-aligned with a generous left margin, never overlapping the face. The tiny tracked genre label at the upper left; " +
          "beginning around 23% down, the title on 1–2 left-aligned lines in a beautifully drawn bold humanist sans (title case, open counters), about 56% of the " +
          "width; beneath it, after a clear interval, the subtitle in small sans on 2–3 balanced lines; near the lower left the author in substantial but secondary " +
          "tracked uppercase sans with ONE short thin muted-copper rule above it; generous blank space between subtitle and author.",
        photo: {
          layout: "side",
          bg: "#efeae2",
          ink: "#0f1b3d",
          defaultMono: false,
          prompt:
            "an authentic professional author-cover layout: a clean warm off-white matte field covering the whole cover with a subtle fine paper texture and nothing " +
            "else except one short thin muted-copper rule; calm, composed and trustworthy; the lower right is reserved for the author's own portrait photograph (see " +
            "LAYOUT), and the cover must look complete and balanced with a photograph there; no charts, icons, borders, banners, illustrations, gradients or gold foil",
          textLayout:
            "Deep midnight-navy lettering, LEFT-aligned with a generous left margin, never touching the photo placeholder. The tiny tracked genre label at the upper " +
            "left; ABOVE the placeholder, in the top third, the title on 1–2 left-aligned lines in a beautifully drawn bold humanist sans (title case), up to about " +
            "80% of the width; in the left column beside the placeholder, the subtitle in small sans on 2–4 short lines; near the lower left the author in " +
            "substantial but secondary tracked uppercase sans with ONE short thin muted-copper rule above it.",
        },
      },
    ],
  },
  {
    code: "YF",
    name: { tr: "Çocuk", en: "Children's" },
    label: { tr: "", en: "" }, // çocuk kitabında kapakta tür etiketi yok
    concepts: [
      {
        ...c("karakter", "Karakter", "Character", "Akılda kalan tek bir karakter; bol boşluk, el çizimi başlık.", "One memorable character; lots of air, hand-drawn title.",
          "a publication-quality children's picture-book illustration in gouache and colored pencil on subtly textured warm ivory paper — confident shapes, selective " +
            "dry-brush marks, sensitive color relationships; ONE small memorable character from the book (e.g. a curious little fox with a tiny satchel) with a " +
            "distinctive tender personality (modest-sized lively eyes, no exaggerated grin), entire body in a slight three-quarter pose, absorbed in one small " +
            "wonder (e.g. inspecting a single raindrop hanging from an enormous leaf that arches over him like a canopy); correct coherent anatomy; the character " +
            "about 45% of the height in the lower-middle and right, a strong clear silhouette, one large simple element guiding the eye between title and " +
            "character, a very spare ground patch; generous warm ivory negative space, no forest or scattered decorations; rich but restrained printed pigments; " +
            "no other characters, stock clip art, emoji-flat vectors, oversized shiny eyes, plastic 3D mascots, neon colors, rainbows, frames, heavy outlines, " +
            "crowded scenery or generic watercolor haze", ["#f6ecd9", "#1f4a56", "#e07a2f"]),
        textLayout:
          "The title integrated into the clear upper-left and upper-middle negative space in distinctive dark hand-drawn ROUNDED lettering (one lettering family, " +
          "one color): the first word or name as the largest line, the rest below on 1–2 compact balanced lines slightly smaller; substantial, readable at " +
          "thumbnail size, gentle controlled baseline movement, Turkish letters exact, no mixed scripts, no stretched or multicolored letters, generous separation " +
          "from the illustration. The author discreetly along the bottom left in small dark uppercase sans. No genre label, age badge or other words.",
      },
      {
        ...c("dunya", "Oyun dünyası", "Playful world", "Ayrıntılı ama düzenli bir oyun dünyası; başlık ortadaki aydınlık açıklıkta.", "A detailed but organized play world; the title in a sunlit central clearing.",
          "a lively imaginative play world in richly layered gouache and colored pencil with tactile paper grain and beautifully designed silhouettes — bright, joyful, " +
            "artistically sophisticated children's publishing: the book's main character in the lower-middle foreground as the most noticeable figure (warm color, " +
            "scale, placement), caught in a moment of delight; around it an inviting, intricate but clearly ORGANIZED miniature world built from natural materials " +
            "(e.g. a hollow-tree house with a round window, a rope bridge between platforms, a narrow turquoise stream with stepping stones) and at most three " +
            "supporting animal characters each doing ONE readable activity; the world forms an irregular organic frame around a large quiet sunlit buttery-cream " +
            "clearing in the central upper-middle (about 30–55% down), integrated into the scene, never a pasted label or rectangle; nothing crosses the clearing; " +
            "fresh turquoise, sage and emerald greens, buttery cream light, warm coral accents, muted ochre wood; depth by painted overlap, not lens blur; no dozens " +
            "of incidental animals, clip art, plastic 3D rendering, glassy oversized eyes, neon rainbow colors, repetitive foliage, chaotic clutter, borders or banners",
          ["#f4e9b8", "#17485a", "#e07a2f"]),
        textLayout:
          "The title sits INSIDE the sunlit central clearing (about 30–55% down), embedded in the world rather than in an empty top header: 2–3 optically balanced " +
          "centered lines in ONE family of beautifully hand-drawn substantial rounded lettering, deep petrol blue, lively but controlled contours, Turkish letters " +
          "exact, no outlines or shadows, nothing crossing the letters. The author discreetly at the bottom right on a calm light patch of ground in small clean " +
          "deep-petrol uppercase sans. No genre label, badges or other words.",
      },
      {
        ...c("etkinlik", "Büyük yazılı etkinlik", "Big-type activity", "Etkinlik kitabı: renkli başlık panosu, küçük etkinlik örnekleri, maskot.", "Activity book: colored title panel, small activity samples, a mascot.",
          "a premium children's activity-workbook cover — a strong graphic composition, not a story scene: warm pale butter-yellow paper ground with generous margins; " +
            "a broad deep petrol-blue irregular rectangular title field with very gently rounded corners and subtle printed texture occupying the upper-middle ~48%; " +
            "below it an open, carefully art-directed arrangement of three small activity motifs separated by comfortable space (not boxed screenshots): e.g. two " +
            "painted leaves of the same shape in different colors joined by a delicate dotted curve (matching), a simple sequence of five large colored shapes ending " +
            "in one empty outlined shape (pattern completion), and the book's small mascot character at the lower right (about 24% of the height, never larger than " +
            "the title) looking toward the shapes and holding a short pencil; hand-painted gouache and colored-pencil character and objects with restrained " +
            "dry-brush texture, flat ink colors, subtle paper grain; harmonious petrol blue, warm yellow, coral, apricot and sage; cheerful and refined, not " +
            "infantile, not a school textbook; no numbers or lettering inside the motifs, complex mazes, scribbles, clutter, photographs, glossy 3D characters, neon " +
            "rainbow palette, stickers, extra badges, borders or drop shadows", ["#f7e08a", "#17485a", "#f26b5b"]),
        textLayout:
          "The title dominates, set INSIDE the petrol title field on 2–3 LEFT-aligned lines in ONE family of beautiful large substantial rounded sans lettering: warm " +
          "ivory, with the LAST line in warm apricot; the middle/key line largest; never distorted or rotated, readable as a tiny thumbnail. If a subtitle is given, " +
          "set it small in ivory sans beneath the title inside the field. The author at the bottom left in small dark-petrol uppercase sans. Do NOT invent a series " +
          "label, age badge or any other words — only the supplied text appears.",
      },
    ],
  },
  {
    code: "A",
    name: { tr: "Sanat", en: "Art" },
    label: { tr: "", en: "" }, // sanat kitabında kapakta tür etiketi yok
    concepts: [
      {
        ...c("gorsel", "Görsel tam kapak", "Full-bleed artwork", "Eser kapağın tamamı; yazı küçük ve sol altta.", "The artwork is the whole cover; small type at the lower left.",
          "an original materially convincing artwork filling the entire cover to all four edges as the unmistakable protagonist — e.g. an abstract painting with a " +
            "deliberate asymmetrical composition: a broad imperfect cobalt sweep curving from the upper left through the center toward the lower right, partly " +
            "interrupted by scraped warm-white passages, a substantial quiet burnt-sienna plane in the upper right, small exposed ochre underpainting and a few precise " +
            "charcoal marks; physically worked surface (opaque oil pigment, thin translucent glazes, palette-knife scraping, restrained impasto ridges, dry-brush " +
            "interruptions, occasional exposed linen weave), varied density and scale of marks; a relatively quiet deep region in the lower-left quarter, organically " +
            "part of the painting (never a banner or rectangle), for type; the top two thirds contain only art; saturated mineral blue, earthy red-brown, warm chalk, " +
            "sparing black; faithful high-resolution reproduction, museum-bookshop quality; no equal-sized color blocks, regular geometry, centered circles, digital " +
            "splatter, marbling, fluid-art swirls, watercolor clouds, wallpaper patterns, imitation of any particular artist or existing artwork, frames, white " +
            "borders or gallery walls", ["#1f3f9a", "#f3ead2", "#a8481f"], true),
        textLayout:
          "Small restrained typography in warm ivory with about 6% safe margins, all in the quiet lower area; the artwork stays the protagonist. The title on 1–2 " +
          "modest LEFT-aligned lines near the lower left, beginning around 77% down, in a beautifully proportioned medium-weight contemporary serif (no italics), no " +
          "wider than about 44% of the cover and no taller than about 10%; directly below it the subtitle in very small clean sans; at the lower RIGHT the author in " +
          "small tracked uppercase sans on the same baseline as the subtitle, over a calm dark area. No genre label, rules, shadows or outlines.",
      },
      {
        ...c("galeri", "Beyaz galeri", "White gallery", "Bol beyaz boşluk, sağ ortada tek küçük eser; solda ölçülü yazı.", "Lots of white space, one small artwork middle-right; measured type on the left.",
          "a white-gallery art-monograph cover: an almost-white warm paper ground with extremely subtle uncoated texture occupying most of the cover, and ONE small " +
            "rectangular reproduction of an original artwork in the middle-right (about 48% of the width and 34% of the height, right edge about 9% from the cover " +
            "edge, top beginning around 43% down) with crisp reproduction edges printed directly on the cover — no physical frame, shadow, mat or wall; within it an " +
            "exquisite original abstract study on linen (e.g. a dense mineral cobalt-blue vertical form slightly left of center, a warm burnt-sienna plane in the " +
            "upper right, broad chalk-white scraped passages, tiny exposed ochre underlayers, irregular painterly boundaries, restrained impasto, thin glazes, " +
            "delicate charcoal traces) rich enough to reward close viewing yet readable at its modest size; the white space is an active part of the composition, " +
            "balanced through asymmetry rather than a centered stack; no imitation of any particular artist or existing artwork, multiple pictures, full-bleed " +
            "painting, centered symmetry, borders, banners, fake gallery labels, rules, gradients or gold foil", ["#f3f0ea", "#1a1a1a", "#1f3f9a"]),
        textLayout:
          "Soft near-black lettering on one consistent LEFT axis (9% left margin). The title at the upper left (about 10% top margin) on 1–2 left-aligned lines in " +
          "an elegant medium-weight contemporary serif (normal width, no italics), about 43% of the width — clearly readable but not oversized; immediately below, " +
          "after a restrained gap, the subtitle in very small charcoal sans on one line; the author at the lower left on the same left axis (about 88% down) in " +
          "small charcoal uppercase sans with restrained tracking. The artwork's right edge aligns with the opposite safe margin. No genre label, rules or ornaments.",
      },
      {
        ...c("katalog", "Pastel dokulu tipografi", "Pastel-textured typography", "Başlığın kendisi eser: harflerin içi pastel boya dokusu.", "The title is the artwork: letters filled with pastel paint textures.",
          "artistic typography as the artwork: a warm off-white matte paper ground with subtle grain and NOTHING outside the letters — no separate painting, floral " +
            "decoration, colored blobs, rectangles, geometric ornaments, underlines, visible grid, rainbow gradients or gold; all visual richness comes from painted " +
            "color INSIDE the title's letterforms: sophisticated pastel gouache and cut-paper textures in overlapping softly edged planes (dusty peach, muted sage, " +
            "powder lavender, pale apricot, with occasional darker desaturated terracotta or eucalyptus for definition), colors flowing through the whole title as one " +
            "intentional abstract artwork clipped within the letters, saturated enough to read clearly on the ivory paper; crisp outer contours, no outlines, shadows " +
            "or 3D effects; a refined contemporary art monograph", ["#f6ecdc", "#2a2a2a", "#e89a7a"]),
        textLayout:
          "The TITLE itself is the artwork: enormous beautifully drawn HEAVY contemporary serif letters (generous thick strokes, refined curved terminals, moderate " +
          "contrast — not a thin fashion serif) filled with the pastel painted textures, set on exactly 1–2 complete horizontal lines occupying about 80% of the width " +
          "and up to ~57% of the height, starting about 22% down; the first line slightly left, the second extending a little farther right (subtle asymmetry); never " +
          "split, crop, distort or overlap words; same lettering family on both lines. The author at the top left (about 9% from top and left) in small restrained " +
          "dark-charcoal uppercase sans; the subtitle at the lower left (about 87% down, same left edge) in small dark-charcoal sans on one line. No genre label.",
      },
    ],
  },
];

// Kök dallar için yedek: alt dalda standart yoksa buraya düşer.
const ROOT_FALLBACK: Record<string, string> = {
  F: "FB", D: "DN", V: "VS", Y: "YF", Q: "QD", N: "NH", K: "K", A: "A",
  FH: "FF", FK: "FF", FL: "FM", FD: "FM", FV: "NH", X: "FU", YB: "YF", J: "NH", C: "DC",
};

const BY_CODE = new Map(COVER_STANDARDS.map((s) => [s.code, s]));

/** Thema koduna en yakın standart düğümü (önek üzerinden yukarı yürür). */
export function resolveStandard(themaCode: string | null | undefined): CoverStandard {
  let code = (themaCode ?? "").trim().toUpperCase();
  while (code) {
    const hit = BY_CODE.get(code) ?? BY_CODE.get(ROOT_FALLBACK[code] ?? "");
    if (hit) return hit;
    code = code.slice(0, -1);
  }
  return BY_CODE.get("FB")!;
}

export function getConceptOf(standard: CoverStandard, conceptId: string): CoverConcept {
  return standard.concepts.find((k) => k.id === conceptId) ?? standard.concepts[0];
}

/** Uygulamanın tür listesi (genres.ts "v") → Thema kodu. */
export const GENRE_TO_THEMA: Record<string, string> = {
  roman: "FB",
  oyku: "FB",
  cocuk: "YF",
  siir: "DC",
  "kisisel-gelisim": "VS",
  "bilim-teknik": "P",
  tarih: "NH",
  biyografi: "DN",
  akademik: "J",
  diger: "FB",
};

// ── Thema ağacı (seviye 1–3, Türkçe adlar) ──────────────────────────────────
export type ThemaNode = { code: string; name: string };
export const THEMA_NODES: ThemaNode[] = (themaRows as [string, string][]).map(([code, name]) => ({ code, name }));
const THEMA_BY_CODE = new Map(THEMA_NODES.map((n) => [n.code, n]));

export function themaName(code: string): string {
  return THEMA_BY_CODE.get(code)?.name ?? code;
}

/** Kök → düğüm yolu (adlar). */
export function themaPath(code: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= code.length; i++) {
    const n = THEMA_BY_CODE.get(code.slice(0, i));
    if (n) out.push(n.name);
  }
  return out;
}

const fold = (s: string) =>
  s.toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/İ/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");

/** Aramalı seçici: kod ya da ad eşleşmesi; kısa kodlar (üst dallar) önce. */
export function searchThema(query: string, limit = 12): ThemaNode[] {
  const q = fold(query.trim());
  if (!q) return THEMA_NODES.filter((n) => n.code.length <= 2).slice(0, limit);
  const qc = q.toUpperCase();
  const hits = THEMA_NODES.filter((n) => n.code.startsWith(qc) || fold(n.name).includes(q));
  hits.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
  return hits.slice(0, limit);
}
