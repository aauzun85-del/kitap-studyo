// Kitap türü: sihirbazda seçilir (meta.genre'ye SEÇİLEN DİLDEKİ ETİKET yazılır,
// ör. "Roman" veya "Novel") ve modüller burada çözümleyip kendine uyarlar:
//   Kapak  → varsayılan AI kapak stili
//   Editör → editörün tür kipi (kurgu / kişisel gelişim / akademik)
//   Mizanpaj → tipografi başlangıçları (şiir sola hizalı, çocuk iri punto)
// Eski projelerde meta.genre farklı dilde/boş olabilir; bu yüzden çözümleme
// v/tr/en üçünü de eşler, bulamazsa null döner (modül kendi varsayılanında kalır).

export const GENRES: { v: string; tr: string; en: string }[] = [
  { v: "roman", tr: "Roman", en: "Novel" },
  { v: "oyku", tr: "Öykü", en: "Short story" },
  { v: "cocuk", tr: "Çocuk kitabı", en: "Children's" },
  { v: "siir", tr: "Şiir", en: "Poetry" },
  { v: "kisisel-gelisim", tr: "Kişisel gelişim", en: "Self-help" },
  { v: "bilim-teknik", tr: "Bilim / Teknik", en: "Science / Technical" },
  { v: "tarih", tr: "Tarih", en: "History" },
  { v: "biyografi", tr: "Biyografi / Anı", en: "Biography / Memoir" },
  { v: "akademik", tr: "Akademik", en: "Academic" },
  { v: "diger", tr: "Diğer", en: "Other" },
];

/** meta.genre (etiket ya da id) → kanonik tür id'si; tanınmazsa null. */
export function resolveGenreId(genre: string | null | undefined): string | null {
  if (!genre) return null;
  const g = genre.trim().toLowerCase();
  const hit = GENRES.find(
    (x) => x.v === g || x.tr.toLowerCase() === g || x.en.toLowerCase() === g,
  );
  return hit ? hit.v : null;
}

// Tür → kapak AI stili (aiStyles.ts id'leri). "diger" bilerek yok: varsayılan kalır.
const GENRE_AI_STYLE: Record<string, string> = {
  roman: "literary",
  oyku: "literary",
  cocuk: "children",
  siir: "minimal",
  "kisisel-gelisim": "nonfiction",
  "bilim-teknik": "nonfiction",
  tarih: "vintage",
  biyografi: "literary",
  akademik: "nonfiction",
};

/** Tür için önerilen kapak AI stil id'si; eşleşme yoksa null (varsayılan kalır). */
export function genreAiStyleId(genre: string | null | undefined): string | null {
  const id = resolveGenreId(genre);
  return id ? (GENRE_AI_STYLE[id] ?? null) : null;
}

/** Tür → AI Editör'ün tür kipi. Kurgu-dışı bilgi türleri akademik denetime gider. */
export function genreEditorMode(
  genre: string | null | undefined,
): "fiction" | "selfhelp" | "academic" | null {
  const id = resolveGenreId(genre);
  if (!id) return null;
  if (id === "kisisel-gelisim") return "selfhelp";
  if (id === "akademik" || id === "bilim-teknik" || id === "tarih") return "academic";
  return "fiction";
}

// Tür → mizanpaj teması (themes.ts id'leri). Roman/öykü bilerek yok: mevcut
// varsayılan zaten klasik roman dizgisine göre ayarlandı, ona dokunmayız.
const GENRE_LAYOUT_THEME: Record<string, string> = {
  siir: "siir",
  "kisisel-gelisim": "kisisel-gelisim",
  akademik: "akademik",
  "bilim-teknik": "akademik",
  tarih: "akademik",
  biyografi: "ani",
};

/** Tür için mizanpaj tema id'si; eşleşme yoksa null (varsayılan düzen kalır). */
export function genreThemeId(genre: string | null | undefined): string | null {
  const id = resolveGenreId(genre);
  return id ? (GENRE_LAYOUT_THEME[id] ?? null) : null;
}

/** Tür → tema-dışı tipografi başlangıçları (kullanıcı sonradan değiştirebilir). */
export function genreLayoutSeed(genre: string | null | undefined): {
  bodySizePt?: number;
  leadingPt?: number;
} | null {
  const id = resolveGenreId(genre);
  // Çocuk kitabı: gövde daha iri ve ferah başlar (ayrı çocuk teması yok).
  if (id === "cocuk") return { bodySizePt: 12.5, leadingPt: 17 };
  return null;
}
