"use client";

// KAPAK KURGUSU — tuvalden önceki soru-cevap adımı.
// Tür (Thema) → 3 Konsept → Yazı stili → Ton → Kapsam + serbest not.
// "Tuvale gönder ve üret": seçimler projeye yazılır, tuval sayfası ?kurgu=1 ile
// açılır ve orada otomatik üretim (bekleme ekranı + Vazgeç) kurguyla çalışır.
// "Kendim tasarlayacağım": kurgu "atlandı" olarak kaydedilir, tuval boş açılır.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import {
  BRIEF_TEXT_STYLES,
  briefExampleSrc,
  defaultBrief,
  effectiveTone,
  type CoverBrief,
  type Tone,
} from "@/lib/cover/brief";
import {
  COVER_STANDARDS,
  GENRE_TO_THEMA,
  resolveStandard,
  searchThema,
  themaName,
  themaPath,
} from "@/lib/cover/standards";
import { updateProjectCoverBrief } from "@/lib/projects/data";
import { resolveGenreId } from "@/lib/projects/genres";
import { creditCost } from "@/lib/credits/pricing";
import {
  deleteBriefPhoto,
  loadBriefPhoto,
  MIN_PHOTO_WIDTH,
  prepareBriefPhoto,
  saveBriefPhoto,
} from "@/lib/cover/briefPhoto";
import {
  deletePublisherLogo,
  loadPublisherLogoUrl,
  preparePublisherLogo,
  savePublisherLogo,
  type LogoColor,
} from "@/lib/cover/publisherLogo";

// Kurgu kapağı iki ücretli uç çağırır: kitap asistanı + ChatGPT görseli.
const BRIEF_COVER_COST = creditCost("cover-prompt") + creditCost("cover-openai");

type Props = {
  lang: Locale;
  projectId: string;
  initial?: CoverBrief;
  title: string;
  author: string;
  /** Kitap bilgisindeki tür (genres.ts "v") → Thema ön seçimi. */
  genre?: string;
  /** Sırt özeti ("Sırt: 1,9 cm (320 sayfa · Enso 60 gr)") — Kapsam adımında gösterilir. */
  spineNote?: string;
  /** Baskı profili: KDY / KDY Akademi dışında "Yayınevi logosu" adımı gösterilir. */
  platform?: string;
};

// Örnek görsel: varsa resim, yoksa renk kartelası (onError ile düşer).
function ExampleArt({ src, swatch, alt }: { src: string; swatch: [string, string, string]; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        aria-hidden
        className="h-full w-full"
        style={{
          background: `linear-gradient(160deg, ${swatch[0]} 0%, ${swatch[0]} 55%, ${swatch[2]} 56%, ${swatch[2]} 62%, ${swatch[1]} 63%)`,
        }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
}

export default function CoverBriefStudio({ lang, projectId, initial, title, author, genre, spineNote, platform }: Props) {
  const router = useRouter();
  const tr = lang === "tr";
  const [brief, setBrief] = useState<CoverBrief>(() => {
    // Kitap bilgisindeki tür (id ya da etiket olabilir) → Thema ön seçimi.
    const seed = defaultBrief(GENRE_TO_THEMA[resolveGenreId(genre) ?? ""] ?? "FB");
    const prev = initial && !initial.skipped && initial.v === 2 ? initial : null;
    return { ...seed, ...(prev ?? {}), skipped: undefined };
  });
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState<"none" | "run" | "skip">("none");
  const [error, setError] = useState<string | null>(null);
  // Yazarın kendi fotoğrafı (anı/biyografi konseptleri): önizleme + çözünürlük.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoWidth, setPhotoWidth] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Daha önce yüklenmiş (henüz tuvale gitmemiş) fotoğraf varsa göster.
  useEffect(() => {
    let alive = true;
    void loadBriefPhoto(projectId).then((d) => {
      if (alive && d) setPhotoPreview(d);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Yayınevi logosu (hesaba kayıtlı): KDY kitaplarında KDY logosu kendiliğinden
  // geldiği için bu adım yalnız öteki profillerde (serbest, KDP…) görünür.
  const showLogoStep = platform !== "kdy" && platform !== "akademi";
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined); // undefined = yükleniyor
  const [logoBusy, setLogoBusy] = useState(false);
  useEffect(() => {
    if (!showLogoStep) return;
    let alive = true;
    void loadPublisherLogoUrl().then((u) => {
      if (alive) setLogoUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [showLogoStep]);
  // Seçim yapılmadıysa kayıtlı logo varsayılan olarak kullanılır.
  const logoUse = brief.logo ? brief.logo.use : true;
  const logoColor: LogoColor = brief.logo?.color ?? "auto";
  // Logo yüklenirken / kayıtlı logo okunurken kurgu gönderilmez (seçim kaybolmasın).
  const logoPending = showLogoStep && (logoBusy || logoUrl === undefined);
  const onLogoFile = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const p = await preparePublisherLogo(file);
      await savePublisherLogo(p.dataUrl);
      setLogoUrl(p.dataUrl);
      patch({ logo: { use: true, color: logoColor } });
    } catch {
      setError(tr ? "Logo yüklenemedi — PNG ya da JPG dosyası dene." : "Couldn't upload the logo — try a PNG or JPG file.");
    } finally {
      setLogoBusy(false);
    }
  };
  const removeSavedLogo = async () => {
    if (
      !window.confirm(
        tr
          ? "Kayıtlı logo hesabından silinsin mi? Daha önce kapaklara konmuş logolar yerinde kalır."
          : "Remove the saved logo from your account? Logos already placed on covers stay.",
      )
    )
      return;
    setLogoBusy(true);
    try {
      await deletePublisherLogo();
      setLogoUrl(null);
      patch({ logo: undefined });
    } catch {
      setError(tr ? "Logo silinemedi — tekrar dene." : "Couldn't remove the logo — try again.");
    } finally {
      setLogoBusy(false);
    }
  };

  const standard = resolveStandard(brief.themaCode);
  const results = useMemo(() => searchThema(query), [query]);
  const patch = (p: Partial<CoverBrief>) => setBrief((b) => ({ ...b, ...p }));
  const pickThema = (code: string) => {
    const std = resolveStandard(code);
    patch({ themaCode: code, conceptId: std.concepts[0].id });
    setPickerOpen(false);
    setQuery("");
  };

  const submit = async (mode: "run" | "skip") => {
    if (saving !== "none" || logoPending) return;
    setSaving(mode);
    setError(null);
    try {
      const payload: CoverBrief = {
        ...brief,
        // Ton: bilerek seçilmediyse "konsepte göre" kaydedilir (gösterilenle aynı).
        tone,
        toneChosen: tone !== "concept",
        photo: usingPhoto ? { mono } : undefined,
        // Logo yalnız hesapta kayıtlı logo varsa (ve KDY dışı kitapta) kaydedilir.
        logo: !showLogoStep
          ? undefined
          : logoUrl
            ? { use: logoUse, color: logoColor }
            : logoUrl === undefined
              ? brief.logo // yükleme durumu bilinmiyor: önceki seçim korunur
              : undefined,
        skipped: mode === "skip" ? true : undefined,
        createdAt: new Date().toISOString(),
      };
      await updateProjectCoverBrief(projectId, payload);
      router.push(`/${lang}/kapak?project=${projectId}&kurgu=${mode === "run" ? "1" : "0"}`);
    } catch {
      setSaving("none");
      setError(tr ? "Kaydedilemedi — bağlantını kontrol edip tekrar dene." : "Couldn't save — check your connection and try again.");
    }
  };

  const stepTitle = "text-sm font-semibold text-foreground";
  const stepHint = "text-xs text-muted";
  const card = (active: boolean) =>
    `group flex flex-col overflow-hidden rounded-xl border text-left transition ${
      active ? "border-accent ring-2 ring-accent/30" : "border-foreground/10 hover:border-foreground/30"
    } bg-background`;
  const pill = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-sm font-semibold transition ${
      active ? "border-accent bg-accent text-white" : "border-foreground/15 bg-background text-foreground hover:bg-accent-soft"
    }`;

  const path = themaPath(brief.themaCode);
  const standardIsExact = standard.code === brief.themaCode;
  const currentConcept = standard.concepts.find((k) => k.id === brief.conceptId) ?? standard.concepts[0];
  // Konsept yazarın kendi fotoğrafını kabul ediyorsa: kapağı yine yapay zekâ
  // tasarlar ama fotoğraf yuvasını boş bırakır; fotoğraf oraya birebir oturur.
  const photoMode = currentConcept.photo?.layout ?? null;
  const usingPhoto = !!photoMode && !!photoPreview;
  const textBy: "ai" | "app" = brief.textBy ?? "ai";
  // Ton: kullanıcı bilerek seçmediyse konseptin kendi paleti (eski kurgulardaki
  // varsayılan "Açık" konsepti eziyordu → artık seçim sayılmaz).
  const tone = effectiveTone(brief);
  // Varsayılan: anı/biyografide siyah-beyaz; iş kitabı portresinde renkli.
  const mono = brief.photo?.mono ?? currentConcept.photo?.defaultMono ?? true;
  // Seçili konsept notu kapağa birebir basıyorsa (şiir dizeleri) alanın adı değişir.
  const noteIsText = !!currentConcept.noteAsText && textBy === "ai";

  const onPhotoFile = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const p = await prepareBriefPhoto(file);
      await saveBriefPhoto(projectId, p.dataUrl);
      setPhotoPreview(p.dataUrl);
      setPhotoWidth(p.width);
    } catch {
      setError(tr ? "Fotoğraf okunamadı — JPG ya da PNG dene." : "Couldn't read the photo — try a JPG or PNG.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = () => {
    void deleteBriefPhoto(projectId);
    setPhotoPreview(null);
    setPhotoWidth(null);
    patch({ photo: undefined });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">{tr ? "Kapak kurgusu" : "Cover brief"}</h1>
        <p className="text-sm text-muted">
          {tr
            ? "Önce kitabın türünü seç; o türün kapak standardından bir konsept, sonra yazı stili, ton ve kapsam. Yapay zekâ kapağı bu kurguya göre üretir; başlık, yazar ve logo yerleri görselde boş bırakılır, uygulama onları kendi basar."
            : "Pick the book's genre first; then a concept from that genre's cover standard, a type style, tone and scope. AI paints the cover from this brief; title, author and logo areas stay clear in the art and the app prints them."}
        </p>
        {(title || author) && (
          <p className="text-xs text-muted">
            {title}
            {author ? ` · ${author}` : ""}
          </p>
        )}
      </header>

      {/* 1 — Tür: kapak standardı olan türler listeden; ayrıntılı Thema araması isteğe bağlı */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "1 · Tür" : "1 · Genre"}</h2>
          <p className={stepHint}>
            {tr
              ? "Kitabının türünü seç; her türün kendi kapak standardı ve üç konsepti var."
              : "Pick your book's genre; each genre has its own cover standard and three concepts."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COVER_STANDARDS.map((st) => {
            const active = st.code === standard.code;
            return (
              <button
                key={st.code}
                type="button"
                onClick={() => pickThema(st.code)}
                aria-pressed={active}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-foreground/15 bg-background text-foreground hover:bg-accent-soft"
                }`}
              >
                {st.name[lang]}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {pickerOpen
              ? tr ? "Ayrıntılı tür aramasını kapat" : "Close detailed genre search"
              : tr ? "Listede yok mu? Ayrıntılı tür (Thema) ara" : "Not listed? Search a detailed genre (Thema)"}
          </button>
          {!standardIsExact && (
            <p className="text-xs text-muted">
              {tr
                ? `Seçilen ayrıntılı tür: ${themaName(brief.themaCode)} (${brief.themaCode})${path.length > 1 ? ` · ${path.slice(0, -1).join(" › ")}` : ""} → "${standard.name.tr}" standardı uygulanır.`
                : `Detailed genre: ${themaName(brief.themaCode)} (${brief.themaCode}) → using "${standard.name.en}".`}
            </p>
          )}
          {pickerOpen && (
            <div className="space-y-2 rounded-xl border border-foreground/10 bg-background p-3">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr ? "Tür adı yaz: polisiye, tarih, çocuk, deneme…" : "Type a genre: crime, history, children…"}
                className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              {query.trim() && (
                <ul className="max-h-64 divide-y divide-foreground/5 overflow-y-auto rounded-lg border border-foreground/10">
                  {results.map((n) => (
                    <li key={n.code}>
                      <button
                        type="button"
                        onClick={() => pickThema(n.code)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent-soft"
                      >
                        <span className="w-14 shrink-0 font-mono text-xs text-muted">{n.code}</span>
                        <span className="text-foreground">{n.name}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted">→ {resolveStandard(n.code).name[lang]}</span>
                      </button>
                    </li>
                  ))}
                  {results.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted">{tr ? "Eşleşme yok." : "No match."}</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2 — Konsept */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "2 · Konsept" : "2 · Concept"}</h2>
          <p className={stepHint}>
            {tr
              ? `"${standard.name.tr}" türünün kapak standardı: üç konsept. Örnek yön verir; birebir kopyalanmaz.`
              : `Cover standard for "${standard.name.en}": three concepts. Examples set a direction; nothing is copied.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {standard.concepts.map((k, i) => {
            const active = k.id === brief.conceptId;
            const src = briefExampleSrc(standard.code, i);
            // Anahtar tür+konsept: aynı konsept adı başka türde de olabilir
            // ("tipografik"); yoksa "yüklenemedi" durumu türler arası taşınır.
            return (
              <button key={`${standard.code}-${k.id}`} type="button" onClick={() => patch({ conceptId: k.id })} className={card(active)} aria-pressed={active}>
                <div className="aspect-[2/3] w-full overflow-hidden bg-foreground/5">
                  <ExampleArt key={src} src={src} swatch={k.swatch} alt={k.name[lang]} />
                </div>
                <div className="space-y-1 p-3">
                  <div className="text-sm font-semibold text-foreground">{k.name[lang]}</div>
                  <div className="text-[11px] leading-snug text-muted">{k.blurb[lang]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Kendi fotoğrafın — yalnız fotoğraf kabul eden konseptlerde (anı/biyografi) */}
      {photoMode && (
        <section className="space-y-3 rounded-xl border border-foreground/10 p-4">
          <div>
            <h2 className={stepTitle}>{tr ? "Kendi fotoğrafın (isteğe bağlı)" : "Your own photo (optional)"}</h2>
            <p className={stepHint}>
              {photoMode === "framed"
                ? tr
                  ? "Yazarın portresini yükle: kapağı yapay zekâ tasarlar (zemin, yazılar, arka kapak) ve ortada bir çerçeve yeri boş bırakır; senin fotoğrafın o yere birebir oturur — yüz değişmez."
                  : "Upload the author's portrait: AI designs the cover (ground, type, back cover) leaving a framed window empty; your photo is placed there exactly — the face never changes."
                : photoMode === "side"
                  ? tr
                    ? "Yazarın portresini yükle: yapay zekâ başlığı, yazıları ve arka kapağı tasarlar, ön kapağın sağ altını boş bırakır; senin fotoğrafın o yere birebir oturur — yüz değişmez."
                    : "Upload the author's portrait: AI designs the title, text and back cover leaving the lower right of the front cover empty; your photo is placed there exactly — the face never changes."
                : tr
                  ? "Aile albümünden bir fotoğraf yükle (bir sokak, bir ev, bir an): yapay zekâ alttaki renkli bandı, yazıları ve arka kapağı tasarlar; fotoğrafın ön kapağın üst kısmına birebir oturur."
                  : "Upload a family-album photo (a street, a house, a moment): AI designs the colored band, the type and the back cover; your photo fills the top of the front cover exactly."}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt={tr ? "Yüklenen fotoğraf" : "Uploaded photo"}
                className="h-40 w-auto rounded-md border border-foreground/10 object-cover"
                style={{ filter: mono ? "grayscale(1) contrast(1.06)" : undefined }}
              />
            ) : (
              <div className="flex h-40 w-28 items-center justify-center rounded-md border border-dashed border-foreground/20 text-center text-[11px] text-muted">
                {tr ? "Fotoğraf yok" : "No photo"}
              </div>
            )}
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent-soft">
                {photoBusy ? (tr ? "Hazırlanıyor…" : "Preparing…") : photoPreview ? (tr ? "Fotoğrafı değiştir" : "Replace photo") : (tr ? "Fotoğraf yükle" : "Upload photo")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={photoBusy}
                  onChange={(e) => {
                    void onPhotoFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {photoPreview && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => patch({ photo: { mono: true } })} aria-pressed={mono} className={pill(mono)}>
                      {tr ? "Siyah-beyaz" : "Black & white"}
                    </button>
                    <button type="button" onClick={() => patch({ photo: { mono: false } })} aria-pressed={!mono} className={pill(!mono)}>
                      {tr ? "Renkli" : "Color"}
                    </button>
                  </div>
                  <button type="button" onClick={removePhoto} className="text-xs font-medium text-accent hover:underline">
                    {tr ? "Fotoğrafı kaldır (fotoğrafı da yapay zekâ çizsin)" : "Remove photo (let AI draw the picture too)"}
                  </button>
                </>
              )}
              {photoWidth != null && photoWidth < MIN_PHOTO_WIDTH && (
                <p className="max-w-xs rounded-md border border-amber-500/40 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                  {tr
                    ? `Fotoğraf küçük (${photoWidth} piksel genişlik). Baskıda bulanık çıkabilir; en az ${MIN_PHOTO_WIDTH} piksel önerilir.`
                    : `The photo is small (${photoWidth}px wide) and may print blurry; at least ${MIN_PHOTO_WIDTH}px is recommended.`}
                </p>
              )}
              <p className="max-w-xs text-[11px] text-muted">
                {tr
                  ? "Fotoğraf sana ait olmalı ya da kullanım iznin bulunmalı."
                  : "The photo must be yours or you must have permission to use it."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3 — Yazı */}
      <section className="space-y-3">
        <div>
          <h2 className={stepTitle}>{tr ? "3 · Yazı" : "3 · Text"}</h2>
          <p className={stepHint}>
            {tr
              ? "Başlık, yazar adı ve tür etiketini kim bassın? ChatGPT: örnek kapaklardaki kalite, yazı görsele gömülür (sonradan değiştirmek = yeniden üretmek). Uygulama: kendi fontlarımız, tuvalde düzenlenebilir."
              : "Who prints the title, author and genre label? ChatGPT: example-quality typography baked into the art (changing it = regenerate). App: our fonts, editable on the canvas."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {(
            [
              ["ai", tr ? "ChatGPT bassın (önerilen)" : "ChatGPT prints it (recommended)"],
              ["app", tr ? "Uygulama bassın" : "App prints it"],
            ] as ["ai" | "app", string][]
          ).map(([v, label]) => (
            <button key={v} type="button" onClick={() => patch({ textBy: v })} aria-pressed={textBy === v} className={pill(textBy === v)}>
              {label}
            </button>
          ))}
        </div>
        {textBy === "ai" && (
          <p className={stepHint}>
            {tr
              ? "Tipografiyi ChatGPT konsepte göre tasarlar: yazar üstte küçük, başlık altında, tür etiketi başlığın altında."
              : "ChatGPT designs the typography to match the concept: author small on top, title below, genre label under the title."}
          </p>
        )}
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${textBy === "ai" ? "hidden" : ""}`}>
          {BRIEF_TEXT_STYLES.map((s) => {
            const active = s.id === brief.textStyleId;
            const sample = title.trim() || (tr ? "Kitabın Adı" : "Book Title");
            return (
              <button key={s.id} type="button" onClick={() => patch({ textStyleId: s.id })} className={card(active)} aria-pressed={active}>
                <div className="flex h-28 items-center justify-center bg-foreground/[0.04] px-3">
                  <span
                    className="line-clamp-2 text-center leading-tight text-foreground"
                    style={{
                      fontFamily: s.previewFamily,
                      fontWeight: s.previewWeight,
                      fontSize: s.upper ? 26 : 24,
                      letterSpacing: s.spacing ? `${s.spacing / 1000}em` : undefined,
                      textTransform: s.upper ? "uppercase" : undefined,
                    }}
                  >
                    {sample}
                  </span>
                </div>
                <div className="p-3 text-sm font-semibold text-foreground">{s.name[lang]}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4 — Ton · 5 — Kapsam */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h2 className={stepTitle}>{tr ? "4 · Ton" : "4 · Tone"}</h2>
            <p className={stepHint}>{tr ? "\"Konsepte göre\" seçili kalırsa kapak, örnekteki konseptin kendi renkleriyle üretilir. Açık/Orta/Koyu aynı konsepti o yöne kaydırır." : "With \"As the concept\" the cover keeps the concept's own colours. Light/Mid/Dark shift the same concept in that direction."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["concept", tr ? "Konsepte göre" : "As the concept"],
                ["light", tr ? "Açık" : "Light"],
                ["mid", tr ? "Orta" : "Mid"],
                ["dark", tr ? "Koyu" : "Dark"],
              ] as [Tone, string][]
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => patch({ tone: v, toneChosen: v !== "concept" })} aria-pressed={tone === v} className={pill(tone === v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <h2 className={stepTitle}>{tr ? "5 · Kapsam" : "5 · Scope"}</h2>
            <p className={stepHint}>{tr ? "Tam sarmal: arka kapak açık tonlu, sırt boş üretilir." : "Full wrap: back cover is generated pale, spine left plain."}</p>
            {spineNote && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-medium text-foreground/80">
                {spineNote}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["wrap", tr ? "Tam sarmal (arka + sırt + ön)" : "Full wrap (back + spine + front)"],
                ["front", tr ? "Yalnız ön kapak" : "Front cover only"],
              ] as ["wrap" | "front", string][]
            ).map(([v, label]) => (
              <button key={v} type="button" onClick={() => patch({ scope: v })} aria-pressed={brief.scope === v} className={pill(brief.scope === v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 6 — Yayınevi logosu (KDY dışı kitaplar) */}
      {showLogoStep && (
        <section className="space-y-3 rounded-xl border border-foreground/10 p-4">
          <div>
            <h2 className={stepTitle}>{tr ? "6 · Yayınevi logosu (isteğe bağlı)" : "6 · Publisher logo (optional)"}</h2>
            <p className={stepHint}>
              {tr
                ? "Logon ön kapağın altına, arka kapağın sol altına ve sırta (sırt 0,6 cm'den kalınsa) yerleşir; tuvalde taşıyıp büyütebilirsin. Logo hesabına kaydedilir, sonraki kitaplarında hazır gelir."
                : "Your logo goes at the bottom of the front cover, bottom-left of the back cover and on the spine (if it's over 0.6 cm); you can move and resize it on the canvas. It's saved to your account for your next books."}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {logoUrl ? (
              <div className="flex overflow-hidden rounded-md border border-foreground/10">
                {(["#f4f1ea", "#1f2230"] as const).map((bg, bi) => (
                  <div key={bg} className="flex h-24 w-32 items-center justify-center p-3" style={{ background: bg }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={tr ? "Yayınevi logosu" : "Publisher logo"}
                      className="max-h-full max-w-full object-contain"
                      style={{
                        filter:
                          logoColor === "white" || (logoColor === "auto" && bi === 1)
                            ? "brightness(0) invert(1)"
                            : logoColor === "black" || (logoColor === "auto" && bi === 0)
                              ? "brightness(0)"
                              : undefined,
                        opacity: logoUse ? 1 : 0.35,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-24 w-32 items-center justify-center rounded-md border border-dashed border-foreground/20 text-center text-[11px] text-muted">
                {logoUrl === undefined ? (tr ? "Yükleniyor…" : "Loading…") : tr ? "Kayıtlı logo yok" : "No saved logo"}
              </div>
            )}
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent-soft">
                {logoBusy
                  ? tr ? "Hazırlanıyor…" : "Preparing…"
                  : logoUrl
                    ? tr ? "Logoyu değiştir" : "Replace logo"
                    : tr ? "Logo yükle" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={logoBusy}
                  onChange={(e) => {
                    void onLogoFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {logoUrl && (
                <>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={logoUse}
                      onChange={(e) => patch({ logo: { use: e.target.checked, color: logoColor } })}
                      className="h-4 w-4 accent-accent"
                    />
                    {tr ? "Bu kitabın kapağında kullan" : "Use on this book's cover"}
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={tr ? "Logo rengi" : "Logo colour"}>
                    {(
                      [
                        ["auto", tr ? "Otomatik" : "Auto"],
                        ["original", tr ? "Olduğu gibi" : "As is"],
                        ["white", tr ? "Beyaz" : "White"],
                        ["black", tr ? "Siyah" : "Black"],
                      ] as [LogoColor, string][]
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        disabled={!logoUse}
                        onClick={() => patch({ logo: { use: true, color: v } })}
                        aria-pressed={logoColor === v}
                        className={`${pill(logoColor === v)} disabled:opacity-50`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => void removeSavedLogo()} className="text-xs font-medium text-accent hover:underline">
                    {tr ? "Kayıtlı logoyu hesabımdan sil" : "Remove saved logo from my account"}
                  </button>
                </>
              )}
              <p className="max-w-xs text-[11px] text-muted">
                {tr
                  ? "En iyisi saydam zeminli PNG. Beyaz zeminli logolarda beyaz zemin kendiliğinden silinir. Otomatik: kapak koyuysa beyaz, açıksa siyah olur. Renkli logon için Olduğu gibi."
                  : "A transparent PNG works best; a white background is removed automatically. Auto: white on dark covers, black on light ones. Use As is for a coloured logo."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Not */}
      <section className="space-y-2">
        <h2 className={stepTitle}>
          {noteIsText
            ? tr ? "Kapağa basılacak dizeler / kısa alıntı" : "Lines / short excerpt to print on the cover"
            : tr ? "İsteğe bağlı not" : "Optional note"}
        </h2>
        {noteIsText && (
          <p className={stepHint}>
            {tr
              ? "Bu konseptte metin kapağın kendisidir: 2–4 kısa dize yaz (satır satır). Boş bırakırsan yalnız başlık kullanılır."
              : "In this concept the text is the cover: write 2–4 short lines. Leave empty to use only the title."}
          </p>
        )}
        <textarea
          value={brief.note ?? ""}
          onChange={(e) => patch({ note: e.target.value.slice(0, 300) })}
          rows={noteIsText ? 4 : 2}
          placeholder={
            noteIsText
              ? tr ? "Bir ses bıraktım rüzgâra,\nbana sessizlik döndü." : "I left a voice to the wind,\nsilence came back to me."
              : tr ? "Örn. ‘kapakta eski bir fener olsun, deniz kenarı, akşam ışığı’" : "e.g. ‘an old lantern by the sea at dusk’"
          }
          className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </section>

      {error && <p className="rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <footer className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-5">
        <button
          type="button"
          onClick={() => void submit("run")}
          disabled={saving !== "none" || logoPending}
          className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === "run" ? (tr ? "Kaydediliyor…" : "Saving…") : tr ? "Tuvale gönder ve üret" : "Send to canvas & generate"}
          {saving !== "run" && BRIEF_COVER_COST > 0 && (
            <span className="ml-2 font-normal opacity-80">
              · {BRIEF_COVER_COST} {tr ? "jeton" : "credits"}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void submit("skip")}
          disabled={saving !== "none" || logoPending}
          className="rounded-lg border border-foreground/15 px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent-soft disabled:opacity-60"
        >
          {tr ? "Kendim tasarlayacağım" : "I'll design it myself"}
        </button>
        <p className="text-xs text-muted">
          {tr ? "Üretim tuvalde başlar; istersen oradan vazgeçebilirsin." : "Generation starts on the canvas; you can cancel there."}
        </p>
      </footer>
    </div>
  );
}
