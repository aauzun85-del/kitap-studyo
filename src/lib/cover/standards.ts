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
  /** Kullanıcının kurgu notu kapağa BİREBİR basılır (ör. şiir dizeleri) —
   *  sahne tarifi olarak değil, EXACT TEXT listesinde. */
  noteAsText?: boolean;
  /** Yazar KENDİ fotoğrafını yükleyebilir: kapağı yapay zekâ değil uygulama
   *  kurar ("framed" = çerçeveli portre, "band" = üstte fotoğraf + altta bant). */
  photo?: {
    layout: "framed" | "band";
    bg: string;
    ink: string;
    /** Yazar kendi fotoğrafını verdiyse konsept cümlesinin YERİNE geçer: kapak
     *  tasarlanır ama fotoğraf yuvası boş bırakılır (fotoğrafı uygulama oturtur). */
    prompt: string;
  };
};

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
          "(about 9% of the height); the title as the dominant element in an elegant bold humanist sans serif (not an ultra-condensed poster font), 2–3 deliberate " +
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
          "an adult figure in a quiet everyday moment (reading, resting, tending a garden) inside a generous clearing framed by large botanical leaves, " +
          "with one small telling detail that carries the idea (garden shears beside a cut vine); richly designed flat shapes, visible dry-brush texture, " +
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
          "(a lifted map layer, hidden contour landscapes, winding stairs, a distant sea, a tiny sun) — invent the composition, never reproduce a famous historical engraving; " +
          "exquisite copperplate engraving and fine etched cross-hatching, entirely deep charcoal-brown ink on warm ivory paper, rich stippling, delicate crosshatched shadows, " +
          "broad unprinted highlights, authentic printed-plate sensibility (not a digital pencil sketch, not photorealism); paper with subtle fibers and gentle uneven warm tone, " +
          "no stains, no torn edges, no burnt parchment; the scene occupies the lower half and fades organically into blank paper; a very thin restrained double-rule border " +
          "well inside the edges is allowed, no corner decorations; a single tiny dusty vermilion accent at most; no gold, no navy, no gradients, no glow, no all-seeing eye, " +
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
      c("tezhip", "Hat / tezhip dokusu", "Calligraphic ornament", "Klasik süsleme, lacivert-altın.", "Classical ornament, navy and gold.",
        "Ottoman manuscript illumination (tezhip) interpreted as contemporary editorial design: a meticulously hand-painted vertical ornament of classical rumi and hatayi " +
          "vegetal motifs — fine muted gold stems, tiny ivory blossoms, restrained turquoise and lapis petals — forming an elongated open almond-shaped frame around generous dark " +
          "negative space; ornament concentrated in the lower half (two gently rising flowering branches meeting in a small symmetrical base flourish) and climbing delicately " +
          "along the sides, with a small refined crown-like flourish above the title zone; the subtle irregularities of a master illuminator's brush, not mechanically repeated " +
          "wallpaper; rich midnight ultramarine navy with gently varied matte pigment on fine paper; antique champagne-gold illumination with small lapis, ivory and muted " +
          "turquoise details, flat restrained metallic-ink effect (no embossed CGI, glitter, luminous gradients or fake leather); the center stays quiet and empty; a thin gold rule " +
          "near the edge is allowed, no heavy decorative frame; no Arabic text, no pseudo-calligraphy, no literal heart, mosque, crescent, stars, astrolabe, occult geometry, " +
          "circular medallion, stock ornament collage or wedding-invitation look", ["#101c3a", "#f3ead2", "#c9a24a"], true),
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
            "dramatic lighting, famous landmarks or badges", ["#d9d2c5", "#f3ead2", "#a84a2a"]),
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
        textLayout:
          "Warm ivory lettering with one pale blush accent word. Upper quarter, LEFT-aligned about 9% from the edges: the small tracked uppercase author, beneath it the " +
          "title on two lines in a refined medium-weight upright literary serif (modest, easily readable), then the tiny tracked genre label. The main expressive " +
          "element is the excerpt in the central and lower-middle area, set larger in a beautifully drawn literary italic serif: break it across staggered lines — " +
          "a phrase aligned left, the next indented noticeably to the right, a generous vertical pause of empty ground between the sentences, then the same again; " +
          "one key word in pale blush, the rest ivory; normal readable letter spacing, grammatical reading order, no repeated words, every line within the margins, " +
          "a generous empty lower margin. If no excerpt is supplied, set the title itself as the large staggered italic element instead.",
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
            "inset paper panel (about 82% of the width, 88% of the height) with a fine double-rule rectangular frame just inside it, restrained clipped corners, tiny " +
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
            "and bottom edges with no frame or oval, its uppermost lines tapering naturally into the paper; a scene from the book's world (a weathered period townhouse " +
            "entrance, a half-open door, worn steps, a solitary figure in period dress seen from behind holding a meaningful object, modest relative to the architecture), " +
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
      c("tipografik", "Tipografik roman", "Typographic novel", "Resimsiz, başlık tasarımın kendisi.", "No image, the title is the design.",
        "warm very pale ivory uncoated paper ground with subtle print grain and nothing else — a tactile two-ink print aesthetic; " +
          "at most one tiny restrained geometric accent in burnt vermilion near the lower third (a thin threshold line), no illustration, no icon, no ornament", ["#f4efe6", "#102a2e", "#c9472b"]),
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
            "scale, weight, contrast and one displaced typographic cut — the impact of a carefully printed two-ink design", ["#c8102e", "#111111", "#f2e8d8"]),
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
    label: { tr: "HİCİV", en: "SATIRE" },
    concepts: [
      c("gravur", "Gravür + sert yazı", "Engraving + sharp type", "Züppeler düzeni: gravür + keskin serif.", "Engraving + crisp serif.",
        "satirical period engraving of a character or scene, fine cross-hatching, single ink on cream paper, witty", ["#efe6d2", "#2a241c", "#8a2f1f"]),
      c("karikatur", "Karikatür", "Caricature", "Çizgi, abartı.", "Line, exaggeration.",
        "bold caricature illustration with exaggerated features, confident ink line and flat color, playful", ["#fff5d6", "#1a1a1a", "#e8552d"]),
      c("tipografik", "Tipografik şaka", "Typographic joke", "Yazı oyunlu, renkli.", "Playful type, color.",
        "bright flat color ground with a single small playful icon, lots of empty space for witty typography", ["#ffd166", "#1a1a1a", "#ef476f"]),
    ],
  },
  {
    code: "NH",
    name: { tr: "Tarih", en: "History" },
    label: { tr: "TARİH", en: "HISTORY" },
    concepts: [
      c("arsiv", "Arşiv görsel + bant", "Archive image + band", "Belge/foto, renkli şerit.", "Document/photo, colored band.",
        "archival historical photograph or painting, faded tones and grain, composed to leave the lower third for a solid band", ["#d9d2c5", "#222", "#8a2f1f"]),
      c("harita", "Harita / belge dokusu", "Map / document texture", "Eski harita, mühür.", "Old map, seal.",
        "antique map and manuscript texture, sepia ink, wax seal detail, scholarly and evocative", ["#efe4cc", "#2a241c", "#8a4a1f"]),
      c("akademik", "Sade akademik", "Plain academic", "Düz zemin, ciddi serif.", "Flat ground, serious serif.",
        "plain deep-colored ground with a very subtle linen texture, nothing else — for a serious typographic cover", ["#1e2a3a", "#f0e9d8", "#c9a24a"], true),
    ],
  },
  {
    code: "K",
    name: { tr: "İş / ekonomi", en: "Business / economics" },
    label: { tr: "İŞ", en: "BUSINESS" },
    concepts: [
      c("ikon", "Düz renk + tek ikon", "Flat color + single icon", "Kalın sans, tek işaret.", "Bold sans, one mark.",
        "flat bold color ground with one simple geometric icon, crisp and modern, lots of empty space", ["#1b2a41", "#f2e8d5", "#e76f51"], true),
      c("grafik", "Grafik / veri motifi", "Graphic / data motif", "Çizgi, ok, ızgara.", "Lines, arrows, grid.",
        "abstract data motif — rising lines, arrows, a clean grid — minimal, confident, two-color", ["#f2f2f2", "#15140f", "#2a9d8f"]),
      c("portre", "Portre / otorite", "Portrait / authority", "Yazar fotoğrafı.", "Author photo.",
        "professional portrait photograph with a clean neutral background and soft studio light", ["#e6e6e6", "#1b1b1b", "#3a6ea5"]),
    ],
  },
  {
    code: "YF",
    name: { tr: "Çocuk", en: "Children's" },
    label: { tr: "ÇOCUK", en: "CHILDREN" },
    concepts: [
      c("karakter", "Karakter", "Character", "Tek sevimli kahraman.", "One lovable hero.",
        "one lovable children's book character with an expressive face in a simple warm setting, soft hand-drawn style", ["#fff3d6", "#2b2b2b", "#ff8c42"]),
      c("dunya", "Oyun dünyası", "Playful world", "Kalabalık, parlak sahne.", "Busy bright scene.",
        "a playful imaginative world full of small delightful details — hills, clouds, little houses — bright cheerful colors", ["#dff3ff", "#2b2b2b", "#ffb703"]),
      c("etkinlik", "Büyük yazılı etkinlik", "Big-type activity", "Etkinlik kitabı düzeni, bol boşluk.", "Activity-book layout, airy.",
        "bright flat color ground with a few simple playful shapes at the edges, large empty center for big friendly typography", ["#ffe066", "#1a1a1a", "#06d6a0"]),
    ],
  },
  {
    code: "A",
    name: { tr: "Sanat", en: "Art" },
    label: { tr: "SANAT", en: "ART" },
    concepts: [
      c("gorsel", "Görsel tam kapak", "Full-bleed artwork", "Eser ön planda, yazı küçük.", "Artwork first, small type.",
        "a striking full-bleed artwork detail — painting texture, color and composition — rich and museum-quality", ["#2a2a2a", "#f2f2f2", "#d49a4a"], true),
      c("galeri", "Beyaz galeri", "White gallery", "Beyaz zemin, küçük görsel.", "White ground, small image.",
        "pure white gallery ground with one small centered artwork or object, generous white space", ["#ffffff", "#111", "#111"]),
      c("katalog", "Tipografik katalog", "Typographic catalogue", "Yazı ızgarası.", "Type grid.",
        "plain light ground with a faint typographic grid texture and nothing else", ["#f4f4f4", "#111", "#e8552d"]),
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
