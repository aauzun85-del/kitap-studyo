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
      c("sembol", "Büyük başlık + tek sembol", "Big title + single symbol", "Düz zemin, iri başlık, tek küçük ikon.", "Flat ground, large title, one small icon.",
        "warm light solid matte ground (pistachio, apricot, sand) with subtle fine uncoated paper texture; " +
          "ONE small sculptural conceptual symbol in the lower right (a knot unravelling into an open loop, a folded card, a single leaf) — " +
          "clear silhouette, tactile real-material texture, restrained soft shadow, an intelligent compact visual metaphor; " +
          "huge calm space reserved for a dominant title; rigorously aligned grid, calm contemporary personal-development design; " +
          "no stairs, arrows, lightbulbs, motivational badges, scattered icons, shiny 3D or gradients", ["#e9ecd9", "#3a2436", "#e8612b"]),
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
      c("tipografik", "Sade tipografik", "Plain typographic", "Yazı odaklı, sakin, tek renk zemin.", "Text-led, calm, single-color ground.",
        "restrained typographic spirituality cover: stillness expressed through space, proportion and a quiet vertical pause; warm natural ivory uncoated paper ground, " +
          "tactile softly fibrous cream paper with very subtle natural surface variation; the ONLY graphic element is one very fine muted antique-gold vertical rule on the " +
          "left (around 15% from the left edge, spanning the middle of the height) as a quiet anchor; no illustration, photograph, botanical motif, ornamental frame, mosque, " +
          "emblem, icon, Arabic lettering or pseudo-calligraphy; large uninterrupted ivory space above, below and to the right; no stains, heavy grain, gradients, shadows, " +
          "bevels, embossing or gloss", ["#f3ecdd", "#1f3a2a", "#b8923f"]),
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
      c("tipografik", "Tipografik", "Typographic", "Yalnız yazı, güçlü düzen.", "Type only, strong grid.",
        "plain muted ground with a faint grid or rule texture, no imagery — a typographic cover where the title is the design", ["#ece9e3", "#15140f", "#8c1d18"]),
      c("bust", "Klasik büst / gravür", "Classical bust / engraving", "Antik heykel, çizgi.", "Antique statue, line.",
        "classical marble bust rendered as a fine line engraving or soft studio photograph, neutral stone tones, timeless", ["#f0ede6", "#222", "#5a6b7a"]),
      c("sembol", "Minimal sembol", "Minimal symbol", "Tek geometrik işaret.", "One geometric mark.",
        "one minimal geometric mark — a circle, a cut line, a fold — on a calm ground, extremely restrained", ["#f7f5f1", "#141414", "#3a6ea5"]),
    ],
  },
  {
    code: "DN",
    name: { tr: "Biyografi / deneme", en: "Biography / essays" },
    label: { tr: "BİYOGRAFİ", en: "BIOGRAPHY" },
    concepts: [
      c("portre", "Portre", "Portrait", "Yüz ağırlıklı, siyah-beyaz ya da renkli.", "Face-led, mono or color.",
        "expressive portrait photograph or painted portrait, face in soft light, quiet background, dignified", ["#e8e4dc", "#1b1b1b", "#9c3b2a"]),
      c("isim", "İsim büyük", "Name as the cover", "Yazar adı kapağın kendisi.", "The author's name is the design.",
        "uniform elegant ground with a subtle paper texture and nothing else — built for very large typography", ["#f3ece0", "#2b2a27", "#b8923f"]),
      c("arsiv", "Arşiv fotoğraf + bant", "Archive photo + band", "Eski foto, renkli şerit.", "Old photo, colored band.",
        "vintage archival photograph with film grain and faded tones, composed so a solid color band can sit across the lower third", ["#d9d2c5", "#222", "#c0392b"]),
    ],
  },
  {
    code: "DC",
    name: { tr: "Şiir", en: "Poetry" },
    label: { tr: "ŞİİR", en: "POETRY" },
    concepts: [
      c("motif", "Açık zemin + ince motif", "Light ground + fine motif", "Bol boşluk, tek çizgi.", "Lots of air, single line.",
        "pale airy ground with one delicate single-line drawing or small botanical motif, vast negative space", ["#f8f5ef", "#1f1d1a", "#c9672d"]),
      c("doku", "Soyut doku", "Abstract texture", "Suluboya, kâğıt, leke.", "Watercolor, paper, stain.",
        "abstract watercolor wash and paper texture, soft stains and bleeding edges, quiet muted colors, no objects", ["#ece4d8", "#2a2a2a", "#7a8c8f"]),
      c("tipografik", "Tipografik şiir", "Typographic poetry", "Yazı kapağın kendisi, zarif font.", "Type-led, elegant.",
        "soft uniform ground with a faint handmade-paper grain, nothing else — space for elegant typography", ["#f4efe8", "#2b2a27", "#9c6b3c"]),
    ],
  },
  {
    code: "DB",
    name: { tr: "Klasikler / çeviri dizisi", en: "Classics / translated series" },
    label: { tr: "KLASİK", en: "CLASSIC" },
    concepts: [
      c("vintage", "Vintage seri", "Vintage series", "Çerçeve, dokulu kağıt, seri rengi.", "Frame, textured paper, series color.",
        "vintage book-series look: aged paper texture, a classical ornamental frame border, one period illustration vignette in the center", ["#efe6d2", "#2a241c", "#8a2f1f"]),
      c("gravur", "Gravür", "Engraving", "Dönem gravürü, tek renk.", "Period engraving, single ink.",
        "period copperplate engraving of a scene or figure, fine cross-hatching, sepia ink on cream paper", ["#efe4cc", "#2a241c", "#5a4632"]),
      c("minimal", "Minimal dizi", "Minimal series", "Tek renk zemin + küçük motif.", "Single-color ground + small motif.",
        "single flat series color ground with one small centered symbolic motif in a contrasting ink, very restrained", ["#2f6f6a", "#f6f2ea", "#f6f2ea"], true),
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
    label: { tr: "POLİSİYE", en: "CRIME" },
    concepts: [
      c("nesne", "Koyu + tek nesne + kırmızı", "Dark + single object + red", "Karanlık zemin, tek ipucu.", "Dark ground, one clue.",
        "near-black ground with a single small object as a clue, one red accent, cold dramatic light, high contrast", ["#0f1216", "#e8e2d6", "#c0392b"], true),
      c("siluet", "Silüet ve sis", "Silhouette and fog", "Figür, sokak, gece.", "Figure, street, night.",
        "a figure in silhouette in fog on a night street, faint glow, noir atmosphere, deep shadows", ["#1a2028", "#dfe3e8", "#b03a2e"], true),
      c("tipografik", "Sert tipografi", "Hard typography", "Büyük, kesik, gerilimli yazı.", "Big, cut, tense type.",
        "dark gritty textured ground — concrete, scratches, grain — nothing else; built for huge aggressive typography", ["#14161a", "#f2f2f2", "#e63946"], true),
    ],
  },
  {
    code: "FM",
    name: { tr: "Fantastik / bilimkurgu", en: "Fantasy / sci-fi" },
    label: { tr: "FANTASTİK", en: "FANTASY" },
    concepts: [
      c("manzara", "Epik manzara", "Epic landscape", "Geniş dünya, ışık.", "Vast world, light.",
        "epic fantasy landscape, towering scale, dramatic glowing light, rich detailed illustration, sense of wonder", ["#1f2b48", "#f3ead2", "#e0b85a"], true),
      c("amblem", "Sembol-amblem", "Symbol emblem", "Kılıç, mühür, geometri.", "Sword, seal, geometry.",
        "a single ornate emblem — a sigil, a sword, a crest — in metallic gold on a dark ground, intricate linework", ["#1a1a2e", "#efe6cf", "#c9a24a"], true),
      c("karakter", "Karakter", "Character", "Kahraman figürü.", "Hero figure.",
        "a heroic character figure in dynamic pose within a dramatic environment, painted illustration style", ["#2a2233", "#efe6ce", "#caa44a"], true),
    ],
  },
  {
    code: "FR",
    name: { tr: "Romantik", en: "Romance" },
    label: { tr: "ROMAN", en: "A NOVEL" },
    concepts: [
      c("figur", "Yumuşak ışık + figür", "Soft light + figure", "Çift ya da tek figür, sıcak ton.", "Couple or single figure, warm tones.",
        "romantic scene with a figure or couple in soft golden light, dreamy bokeh, warm delicate palette", ["#f6eef0", "#3a2e33", "#b06a86"]),
      c("cicek", "Çiçek + tipografi", "Flowers + typography", "Botanik, el yazısı.", "Botanical, hand lettering.",
        "lush botanical arrangement — roses, peonies, leaves — framing an empty center, soft painterly style", ["#fbeef0", "#3a2e33", "#c45c7a"]),
      c("pastel", "Pastel sahne", "Pastel scene", "İllüstrasyon, hafif.", "Illustration, light.",
        "light pastel illustrated scene, gentle shapes and warm light, tender and airy", ["#fff2ea", "#3a2f2a", "#ff9a8b"]),
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
