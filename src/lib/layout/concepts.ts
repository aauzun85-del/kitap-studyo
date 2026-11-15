// İÇ TASARIM KONSEPTLERİ — kapaktaki "tür → 3 konsept" akışının iç sayfa karşılığı.
// Kitap türü bir İÇ YAPIYA düşer (düz metin / şiir / rehber / araştırma); her
// yapının 3 görünümü vardır. Bir konsept, mizanpajın tipografisini ve bölüm
// açılışını tek pakette belirler. Marjlara ve kitap boyuna DOKUNMAZ (baskı
// profili — KDY/KDP — korunur); yalnız "his"i belirler. Seçildikten sonra her
// ayar Mizanpaj'da elle değiştirilebilir.
//
// Yazı tipleri (src/lib/typst/fonts.ts): EB Garamond, Cormorant Garamond, Libre
// Baskerville, Crimson Pro, Literata, Inter (başlık), Source Serif 4, Vollkorn.

import type { ChapterStyle, SceneBreak } from "./paginate";
import type { ChapterOrnament } from "./themes";
import { resolveGenreId } from "@/lib/projects/genres";

export type InteriorStructureId = "anlati" | "siir" | "rehber" | "arastirma";

export type InteriorConcept = {
  id: string;
  structure: InteriorStructureId;
  name: { tr: string; en: string };
  blurb: { tr: string; en: string };
  /** Kartta küçük etiketler (yazı tipi + belirgin özellik). */
  tags: { tr: string[]; en: string[] };
  // Tipografi
  bodyFontId: string;
  headingFontId: string;
  bodySizePt: number;
  leadingPt: number;
  align: "left" | "justify";
  firstLineIndentMm: number;
  paragraphSpacingMm: number;
  hyphenate: boolean;
  lineBreak: "balanced" | "greedy";
  // Bölüm açılışı
  dropCap: boolean;
  chapterStyle: ChapterStyle;
  chapterOrnament: ChapterOrnament;
  showChapterKicker: boolean;
  chapterNewPage: boolean;
  chapterTitleScale: number;
  firstWordsCaps: boolean;
  // Sayfa öğeleri
  sceneBreak: SceneBreak;
  showRunningHeads: boolean;
  runningHeadStyle: "italic" | "caps";
  showPageNumbers: boolean;
  folioPosition: "outer" | "center";
  subheadStyle: "center" | "left" | "left-caps";
  quoteStyle: "indent" | "box" | "bar";
  // Şiir
  keepLineBreaks: boolean;
  bodyInsetMm: number;
};

export type InteriorStructure = {
  id: InteriorStructureId;
  name: { tr: string; en: string };
  books: { tr: string; en: string };
  concepts: [InteriorConcept, InteriorConcept, InteriorConcept];
};

// Ortak varsayılanlar (her konsept yalnız farkını yazar).
const BASE: Omit<InteriorConcept, "id" | "structure" | "name" | "blurb" | "tags"> = {
  bodyFontId: "sourceserif",
  headingFontId: "sourceserif",
  bodySizePt: 11,
  leadingPt: 15,
  align: "justify",
  firstLineIndentMm: 5,
  paragraphSpacingMm: 0,
  hyphenate: true,
  lineBreak: "balanced",
  dropCap: false,
  chapterStyle: "centered",
  chapterOrnament: "none",
  showChapterKicker: true,
  chapterNewPage: true,
  chapterTitleScale: 1,
  firstWordsCaps: false,
  sceneBreak: "stars",
  showRunningHeads: true,
  runningHeadStyle: "italic",
  showPageNumbers: true,
  folioPosition: "outer",
  subheadStyle: "center",
  quoteStyle: "indent",
  keepLineBreaks: false,
  bodyInsetMm: 0,
};

function c(
  structure: InteriorStructureId,
  id: string,
  name: [string, string],
  blurb: [string, string],
  tags: [string[], string[]],
  spec: Partial<InteriorConcept>,
): InteriorConcept {
  return {
    ...BASE,
    ...spec,
    id,
    structure,
    name: { tr: name[0], en: name[1] },
    blurb: { tr: blurb[0], en: blurb[1] },
    tags: { tr: tags[0], en: tags[1] },
  };
}

export const INTERIOR_STRUCTURES: InteriorStructure[] = [
  {
    id: "anlati",
    name: { tr: "Düz metin / anlatı", en: "Narrative prose" },
    books: { tr: "Roman, öykü, biyografi, deneme", en: "Novel, short story, biography, essay" },
    concepts: [
      c(
        "anlati",
        "anlati-klasik",
        ["Klasik", "Classic"],
        [
          "Garamond harfleri, girintili paragraflar, büyük baş harf ve süslü bölüm başı. Geleneksel roman sayfası.",
          "Garamond type, indented paragraphs, drop cap and an ornamented chapter opening. The traditional novel page.",
        ],
        [["EB Garamond", "Büyük baş harf", "❦ süs"], ["EB Garamond", "Drop cap", "❦ ornament"]],
        {
          bodyFontId: "ebgaramond",
          headingFontId: "ebgaramond",
          bodySizePt: 11.5,
          leadingPt: 15.5,
          dropCap: true,
          chapterStyle: "spaced-caps",
          chapterOrnament: "fleuron",
          sceneBreak: "fleuron",
          runningHeadStyle: "caps",
        },
      ),
      c(
        "anlati",
        "anlati-cagdas",
        ["Çağdaş", "Contemporary"],
        [
          "Literata gövde, sade başlık yazısı, iri bölüm numarası; ilk kelimeler büyük harf. Bugünün edebiyat sayfası.",
          "Literata body, clean sans titles, a large chapter number and capitalised opening words. Today's literary page.",
        ],
        [["Literata + Inter", "İri numara", "⁂ ayraç"], ["Literata + Inter", "Large numeral", "⁂ break"]],
        {
          bodyFontId: "literata",
          headingFontId: "inter",
          bodySizePt: 10.5,
          leadingPt: 15,
          firstLineIndentMm: 4,
          chapterStyle: "numeral-left",
          showChapterKicker: false,
          firstWordsCaps: true,
          sceneBreak: "asterism",
          folioPosition: "center",
          subheadStyle: "left",
        },
      ),
      c(
        "anlati",
        "anlati-ferah",
        ["Ferah", "Airy"],
        [
          "İri harf, geniş satır arası, paragraflar arasında boşluk. Uzun okumada gözü yormayan, nefes alan sayfa.",
          "Larger type, generous leading and space between paragraphs. An open page that is easy on the eyes.",
        ],
        [["Crimson Pro", "Geniş satır arası", "Paragraf boşluğu"], ["Crimson Pro", "Generous leading", "Paragraph space"]],
        {
          bodyFontId: "crimsonpro",
          headingFontId: "crimsonpro",
          bodySizePt: 12,
          leadingPt: 17.5,
          align: "left",
          firstLineIndentMm: 0,
          paragraphSpacingMm: 3.5,
          hyphenate: false,
          chapterStyle: "minimal-left",
          sceneBreak: "space",
          showRunningHeads: false,
          folioPosition: "center",
          subheadStyle: "left",
        },
      ),
    ],
  },
  {
    id: "siir",
    name: { tr: "Şiir", en: "Poetry" },
    books: { tr: "Şiir, kısa edebî metinler", en: "Poetry, short literary pieces" },
    concepts: [
      c(
        "siir",
        "siir-sade",
        ["Sade", "Simple"],
        [
          "Sola yaslı dizeler, küçük başlıklar; şiirler sayfada art arda akar. Kalabalık olmayan, dürüst bir şiir kitabı.",
          "Left-aligned lines and small titles; poems flow one after another. An honest, uncluttered poetry book.",
        ],
        [["Source Serif", "Şiirler akışta", "Sola yaslı"], ["Source Serif", "Poems flow", "Left aligned"]],
        {
          bodyFontId: "sourceserif",
          headingFontId: "sourceserif",
          bodySizePt: 10.5,
          leadingPt: 15,
          align: "left",
          firstLineIndentMm: 0,
          paragraphSpacingMm: 4,
          hyphenate: false,
          chapterStyle: "poem-left",
          showChapterKicker: false,
          chapterNewPage: false,
          sceneBreak: "space",
          showRunningHeads: false,
          folioPosition: "center",
          subheadStyle: "left",
          keepLineBreaks: true,
        },
      ),
      c(
        "siir",
        "siir-zarif",
        ["Zarif", "Elegant"],
        [
          "Cormorant harfleri, her şiir kendi sayfasında; başlığın üstünde ❦ süsü ve italik başlık.",
          "Cormorant type, each poem on its own page, with a ❦ ornament and an italic title.",
        ],
        [["Cormorant", "Her şiir yeni sayfa", "❦ süs"], ["Cormorant", "One poem per page", "❦ ornament"]],
        {
          bodyFontId: "cormorant",
          headingFontId: "cormorant",
          bodySizePt: 12.5,
          leadingPt: 17,
          align: "left",
          firstLineIndentMm: 0,
          paragraphSpacingMm: 4.5,
          hyphenate: false,
          chapterStyle: "ornament",
          showChapterKicker: false,
          sceneBreak: "fleuron",
          showRunningHeads: false,
          folioPosition: "center",
          subheadStyle: "center",
          keepLineBreaks: true,
          bodyInsetMm: 8,
        },
      ),
      c(
        "siir",
        "siir-deneysel",
        ["Deneysel", "Experimental"],
        [
          "İri şiir numaraları, sade büyük harfli başlıklar ve sağa kaydırılmış dizeler. Cesur, çağdaş bir düzen.",
          "Large poem numbers, plain capitalised titles and lines shifted to the right. A bold, contemporary layout.",
        ],
        [["Literata + Inter", "İri numara", "Kaydırılmış metin"], ["Literata + Inter", "Large numeral", "Offset text"]],
        {
          bodyFontId: "literata",
          headingFontId: "inter",
          bodySizePt: 10.5,
          leadingPt: 15,
          align: "left",
          firstLineIndentMm: 0,
          paragraphSpacingMm: 4,
          hyphenate: false,
          chapterStyle: "numeral-left",
          chapterTitleScale: 0.75,
          showChapterKicker: false,
          sceneBreak: "rule",
          showRunningHeads: false,
          subheadStyle: "left-caps",
          keepLineBreaks: true,
          bodyInsetMm: 14,
        },
      ),
    ],
  },
  {
    id: "rehber",
    name: { tr: "Rehber / öğretici", en: "Guide / how-to" },
    books: { tr: "Kişisel gelişim, iş, popüler bilim", en: "Self-help, business, popular science" },
    concepts: [
      c(
        "rehber",
        "rehber-sakin",
        ["Sakin", "Calm"],
        [
          "Sola yaslı, çizgili bölüm başlıkları; paragraflar arasında boşluk ve sol çizgili alıntılar. Okuru yormayan rehber.",
          "Left-aligned titles with a rule, space between paragraphs and bar-marked quotes. A calm, readable guide.",
        ],
        [["Literata", "Çizgili başlık", "Sol çizgili alıntı"], ["Literata", "Ruled title", "Bar quote"]],
        {
          bodyFontId: "literata",
          headingFontId: "literata",
          bodySizePt: 10.5,
          leadingPt: 15.5,
          firstLineIndentMm: 0,
          paragraphSpacingMm: 3,
          chapterStyle: "left-rule",
          subheadStyle: "left",
          quoteStyle: "bar",
          runningHeadStyle: "caps",
        },
      ),
      c(
        "rehber",
        "rehber-dinamik",
        ["Dinamik", "Dynamic"],
        [
          "İri bölüm numarası, güçlü sade başlıklar, gri kutulu alıntılar. Enerjik, hızlı taranan bir sayfa.",
          "Large chapter numbers, strong sans headings and shaded quote boxes. An energetic, scannable page.",
        ],
        [["Source Serif + Inter", "İri numara", "Kutulu alıntı"], ["Source Serif + Inter", "Large numeral", "Boxed quote"]],
        {
          bodyFontId: "sourceserif",
          headingFontId: "inter",
          bodySizePt: 10.5,
          leadingPt: 15,
          firstLineIndentMm: 0,
          paragraphSpacingMm: 3,
          chapterStyle: "numeral-left",
          showChapterKicker: false,
          subheadStyle: "left-caps",
          quoteStyle: "box",
        },
      ),
      c(
        "rehber",
        "rehber-calisma",
        ["Çalışma kitabı", "Workbook"],
        [
          "Kutulu bölüm numarası, sade başlıklar, gri kutularda notlar; sola yaslı, rahat okunan metin.",
          "Boxed chapter numbers, plain headings, notes in shaded boxes and easy-to-read left-aligned text.",
        ],
        [["Libre Baskerville + Inter", "Kutulu numara", "Not kutuları"], ["Libre Baskerville + Inter", "Boxed number", "Note boxes"]],
        {
          bodyFontId: "baskerville",
          headingFontId: "inter",
          bodySizePt: 10,
          leadingPt: 15.5,
          align: "left",
          firstLineIndentMm: 0,
          paragraphSpacingMm: 3.5,
          hyphenate: false,
          chapterStyle: "boxed",
          showChapterKicker: false,
          subheadStyle: "left",
          quoteStyle: "box",
          showRunningHeads: false,
        },
      ),
    ],
  },
  {
    id: "arastirma",
    name: { tr: "Araştırma / inceleme", en: "Research / study" },
    books: { tr: "Tarih, felsefe, din, akademik metin", en: "History, philosophy, religion, academic" },
    concepts: [
      c(
        "arastirma",
        "arastirma-geleneksel",
        ["Geleneksel", "Traditional"],
        [
          "Garamond, iki yana yaslı sıkı metin, ortalı bölüm başı ve ince çizgi; büyük harfli üst bilgi. Klasik inceleme kitabı.",
          "Garamond, tight justified text, centred chapter openings with a hairline and capitalised running heads.",
        ],
        [["EB Garamond", "Ortalı başlık", "Büyük harf üst bilgi"], ["EB Garamond", "Centred title", "Caps running head"]],
        {
          bodyFontId: "ebgaramond",
          headingFontId: "ebgaramond",
          bodySizePt: 11,
          leadingPt: 14.5,
          chapterStyle: "centered",
          chapterTitleScale: 0.9,
          chapterOrnament: "rule",
          runningHeadStyle: "caps",
          subheadStyle: "center",
        },
      ),
      c(
        "arastirma",
        "arastirma-modern",
        ["Modern akademik", "Modern academic"],
        [
          "Source Serif gövde, sade sola yaslı başlıklar ve çizgi; paragraflar arasında boşluk. Güncel akademik yayın düzeni.",
          "Source Serif body, plain left-aligned headings with a rule and space between paragraphs. A current academic layout.",
        ],
        [["Source Serif + Inter", "Sola yaslı başlık", "Sol çizgili alıntı"], ["Source Serif + Inter", "Left titles", "Bar quote"]],
        {
          bodyFontId: "sourceserif",
          headingFontId: "inter",
          bodySizePt: 10,
          leadingPt: 14,
          firstLineIndentMm: 0,
          paragraphSpacingMm: 2.5,
          chapterStyle: "left-rule",
          chapterTitleScale: 0.9,
          subheadStyle: "left",
          quoteStyle: "bar",
        },
      ),
      c(
        "arastirma",
        "arastirma-aciklamali",
        ["Açıklamalı", "Annotated"],
        [
          "Crimson Pro, aralıklı büyük harfli bölüm başı, küçük büyük harfli ara başlıklar ve girintili kaynak alıntıları.",
          "Crimson Pro, spaced-capital chapter openings, small capital subheads and indented source quotations.",
        ],
        [["Crimson Pro", "Aralıklı başlık", "Kaynak alıntıları"], ["Crimson Pro", "Spaced title", "Source quotes"]],
        {
          bodyFontId: "crimsonpro",
          headingFontId: "crimsonpro",
          bodySizePt: 11,
          leadingPt: 15,
          firstLineIndentMm: 4.5,
          chapterStyle: "spaced-caps",
          chapterOrnament: "rule",
          subheadStyle: "left-caps",
          runningHeadStyle: "caps",
        },
      ),
    ],
  },
];

export const ALL_INTERIOR_CONCEPTS: InteriorConcept[] = INTERIOR_STRUCTURES.flatMap((s) => s.concepts);

export function getInteriorConcept(id: string | null | undefined): InteriorConcept | null {
  return ALL_INTERIOR_CONCEPTS.find((c) => c.id === id) ?? null;
}

// Tür → iç yapı. Çocuk kitabı, görsel ağırlıklı ve soru/alıştırma yapıları
// sonraki aşamada; o zamana kadar en yakın yapı (düz metin) önerilir.
const GENRE_STRUCTURE: Record<string, InteriorStructureId> = {
  roman: "anlati",
  oyku: "anlati",
  biyografi: "anlati",
  cocuk: "anlati",
  diger: "anlati",
  siir: "siir",
  "kisisel-gelisim": "rehber",
  "bilim-teknik": "rehber",
  tarih: "arastirma",
  akademik: "arastirma",
};

export function structureForGenre(genre: string | null | undefined): InteriorStructureId {
  const id = resolveGenreId(genre);
  return (id && GENRE_STRUCTURE[id]) || "anlati";
}

export function getStructure(id: InteriorStructureId): InteriorStructure {
  return INTERIOR_STRUCTURES.find((s) => s.id === id) ?? INTERIOR_STRUCTURES[0];
}

/** Yazı büyüklüğü ince ayarı (konsept ekranı): -1 küçük, 0 normal, +1 büyük. */
export type ConceptSizeAdjust = -1 | 0 | 1;

/** Konseptin Mizanpaj ayarları (aile adları çözülmüş; boyut ayarı uygulanmış). */
export function conceptLayoutSettings(
  k: InteriorConcept,
  familyOf: (fontId: string) => string,
  adjust: ConceptSizeAdjust = 0,
) {
  const dSize = adjust === 1 ? 1 : adjust === -1 ? -0.5 : 0;
  const dLead = adjust === 1 ? 1.5 : adjust === -1 ? -0.8 : 0;
  return {
    conceptId: k.id,
    bodyFontFamily: familyOf(k.bodyFontId),
    headingFontFamily: familyOf(k.headingFontId),
    bodySizePt: Math.round((k.bodySizePt + dSize) * 10) / 10,
    leadingPt: Math.round((k.leadingPt + dLead) * 10) / 10,
    align: k.align,
    firstLineIndentMm: k.firstLineIndentMm,
    paragraphSpacingMm: k.paragraphSpacingMm,
    hyphenate: k.hyphenate,
    lineBreak: k.lineBreak,
    dropCap: k.dropCap,
    chapterOrnament: k.chapterOrnament,
    showChapterKicker: k.showChapterKicker,
    showRunningHeads: k.showRunningHeads,
    showPageNumbers: k.showPageNumbers,
    chapterStyle: k.chapterStyle,
    chapterNewPage: k.chapterNewPage,
    chapterTitleScale: k.chapterTitleScale,
    firstWordsCaps: k.firstWordsCaps,
    sceneBreak: k.sceneBreak,
    runningHeadStyle: k.runningHeadStyle,
    folioPosition: k.folioPosition,
    subheadStyle: k.subheadStyle,
    quoteStyle: k.quoteStyle,
    keepLineBreaks: k.keepLineBreaks,
    bodyInsetMm: k.bodyInsetMm,
  };
}
