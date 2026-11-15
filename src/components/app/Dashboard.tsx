"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { listProjects, createProject, renameProject, deleteProject, updateProjectManuscript } from "@/lib/projects/data";
import { docxToText } from "@/lib/editor/docxText";
import { patchSession } from "@/lib/editor/session";
import { signThumbs } from "@/lib/projects/storage";
import { createClient } from "@/lib/supabase/client";
import type { ProjectListItem } from "@/lib/projects/types";
import { WIZARD_PROFILES, STANDARD_PROFILES, profileSizeOptions, type PrintStandard } from "@/lib/layout/standards";
import { GENRES } from "@/lib/projects/genres";
import AppShell, { Icon, type ShellUser } from "./AppShell";

// ── Yerel metinler (Pano'ya özel; tasarım Türkçe, app iki dilli) ──
const COPY = {
  tr: {
    kicker: "Pano",
    greeting: (n: string) => `Merhaba ${n} 👋`,
    subEmpty: "İlk kitabını oluştur ve baştan sona hazırlamaya başla.",
    sub: (n: number) =>
      n === 1 ? "1 kitap üzerinde çalışıyorsun." : `${n} kitap üzerinde çalışıyorsun.`,
    newBook: "Yeni Kitap",
    continueKicker: "KALDIĞIN YERDEN DEVAM ET",
    continueCta: "Devam et",
    whatNext: "Ne yapmak istersin?",
    whatNextSub: "6 modül · tek pakette",
    wizKicker: "KİTAP TASARIM SİHİRBAZI",
    wizTitle: "Kitabını 3 adımda hazırla",
    wizSub: "Birkaç tıkla baştan sona — yapay zekâ editörden baskıya hazır kapağa.",
    wizCta: "Kitabını hazırlamaya başla",
    wizSteps: ["AI Editör", "Mizanpaj", "Kapak"],
    recent: "Son kitaplar",
    colBook: "KİTAP",
    colUpdated: "GÜNCELLEME",
    open: "Aç",
    untitled: "İsimsiz kitap",
    noAuthor: "Yazar belirtilmedi",
    emptyTitle: "Henüz kitabın yok",
    emptyHint: "“Yeni Kitap” ile başla — kapak, mizanpaj ve AI editör seni bekliyor.",
    loadError: "Kitaplar yüklenemedi. Sayfayı yenilemeyi dene.",
    rename: "Yeniden adlandır",
    delete: "Sil",
    renamePrompt: "Yeni kitap adı:",
    deleteConfirm: "Bu kitabı silmek istediğine emin misin? Bu işlem geri alınamaz.",
    creating: "Oluşturuluyor…",
    newHeading: "Yeni kitap",
    newSub: "Birkaç bilgi ver — gerisini 3 adımda birlikte yapacağız.",
    fProfile: "Yayın profili",
    fProfileHint: "Boyut, kenar boşlukları ve kapak baskı ölçüleri buna göre ayarlanır.",
    fSize: "Kitap boyu",
    fSizeHint: "Sonradan Mizanpaj modülünden değiştirebilirsin.",
    fTitle: "Kitap adı",
    fAuthor: "Yazar",
    fGenre: "Tür",
    fTitlePh: "Örn. Sessiz Şehir",
    fAuthorPh: "Örn. Selin Aydın",
    fGenrePick: "Tür seç…",
    fIsbn: "ISBN (isteğe bağlı)",
    fIsbnPh: "978…",
    fIsbnHint: "Verirsen barkod kapağa otomatik eklenir.",
    startCta: "Başla → AI Editör",
    cancel: "Vazgeç",
  },
  en: {
    kicker: "Dashboard",
    greeting: (n: string) => `Hello ${n} 👋`,
    subEmpty: "Create your first book and start preparing it end to end.",
    sub: (n: number) =>
      n === 1 ? "You're working on 1 book." : `You're working on ${n} books.`,
    newBook: "New Book",
    continueKicker: "PICK UP WHERE YOU LEFT OFF",
    continueCta: "Continue",
    whatNext: "What would you like to do?",
    whatNextSub: "6 modules · one package",
    wizKicker: "BOOK DESIGN WIZARD",
    wizTitle: "Build your book in 3 steps",
    wizSub: "End to end in a few clicks — from AI editor to a print-ready cover.",
    wizCta: "Start preparing your book",
    wizSteps: ["AI Editor", "Layout", "Cover"],
    recent: "Recent books",
    colBook: "BOOK",
    colUpdated: "UPDATED",
    open: "Open",
    untitled: "Untitled book",
    noAuthor: "No author yet",
    emptyTitle: "No books yet",
    emptyHint: "Start with “New Book” — cover, layout and AI editor are waiting.",
    loadError: "Couldn't load your books. Try refreshing the page.",
    rename: "Rename",
    delete: "Delete",
    renamePrompt: "New book title:",
    deleteConfirm: "Are you sure you want to delete this book? This cannot be undone.",
    creating: "Creating…",
    newHeading: "New book",
    newSub: "Give a few details — we'll do the rest in 3 steps together.",
    fProfile: "Publishing profile",
    fProfileHint: "Size, margins and cover print dimensions are set to match this.",
    fSize: "Trim size",
    fSizeHint: "You can change it later in the Layout module.",
    fTitle: "Book title",
    fAuthor: "Author",
    fGenre: "Genre",
    fTitlePh: "e.g. The Silent City",
    fAuthorPh: "e.g. Selin Aydın",
    fGenrePick: "Pick a genre…",
    fIsbn: "ISBN (optional)",
    fIsbnPh: "978…",
    fIsbnHint: "If provided, the barcode is added to the cover automatically.",
    startCta: "Start → AI Editor",
    cancel: "Cancel",
  },
} as const;

const SPINES = [
  "linear-gradient(160deg,#6366f1,#7c3aed)",
  "linear-gradient(160deg,#f59e0b,#ef4444)",
  "linear-gradient(160deg,#0ea5e9,#14b8a6)",
  "linear-gradient(160deg,#ec4899,#8b5cf6)",
  "linear-gradient(160deg,#0d9488,#15803d)",
];
function spineFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SPINES[h % SPINES.length];
}


export default function Dashboard({
  lang,
  user,
  signOut,
  previewItems,
  defaultCollapsed,
  openNew = false,
}: {
  lang: Locale;
  user: ShellUser;
  signOut: () => Promise<void>;
  /** Yalnız görsel doğrulama içindir; verildiğinde Supabase'e gidilmez. */
  previewItems?: ProjectListItem[];
  defaultCollapsed?: boolean;
  /** İndirme ekranındaki "Yeni kitap oluştur" → başlangıç formu açık gelir. */
  openNew?: boolean;
}) {
  const t = COPY[lang];
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[] | null>(previewItems ?? null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Yeni kitap sihirbazı başlangıç formu
  const [newOpen, setNewOpen] = useState(openNew);
  const [nProfile, setNProfile] = useState<PrintStandard>("kdy");
  // Seçilen kitap boyu — yalnız çok-boylu profillerde (KDP/Ingram/Serbest) anlamlı.
  const [nSizeId, setNSizeId] = useState<string>("");
  const [nTitle, setNTitle] = useState("");
  const [nAuthor, setNAuthor] = useState("");
  const [nGenre, setNGenre] = useState("");
  const [nIsbn, setNIsbn] = useState("");
  // Pano: arama, tüm kitaplar, kart menüsü, "Nasıl çalışır?"
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);
  // "Word yükle": dosya önce okunur, kitap formu adıyla açılır; kitap oluşunca
  // metin kitaba yazılır ve AI Editör'de açılır (orijinal .docx biçimiyle).
  const wordInputRef = useRef<HTMLInputElement>(null);
  const [wordDoc, setWordDoc] = useState<{ name: string; text: string; buffer: ArrayBuffer; paragraphs: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listProjects();
      setItems(rows);
      const paths = rows.map((r) => r.thumb_path).filter((p): p is string => !!p);
      setThumbs(paths.length ? await signThumbs(createClient(), paths) : new Map());
    } catch (e) {
      console.error(e);
      setError(t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => {
    if (previewItems) return; // önizleme modunda ağ çağrısı yok
    void refresh();
  }, [refresh, previewItems]);


  // "Yeni Kitap" → önce başlangıç formunu aç (ad/yazar/tür).
  async function pickWord(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const { text, paragraphCount } = docxToText(buffer);
      if (!text.trim()) throw new Error("empty");
      onNew();
      setWordDoc({ name: file.name, text, buffer, paragraphs: paragraphCount });
      setNTitle(file.name.replace(/\.docx$/i, "").replace(/[_-]+/g, " ").trim());
    } catch {
      setError(lang === "tr" ? "Word dosyası okunamadı. .docx biçiminde, metin içeren bir dosya seç." : "Couldn't read the Word file. Choose a .docx file with text.");
    }
  }

  function onNew() {
    setWordDoc(null);
    setNProfile("kdy");
    setNSizeId("");
    setNTitle("");
    setNAuthor("");
    setNGenre("");
    setNIsbn("");
    setNewOpen(true);
  }

  // Form gönderilince: proje oluştur ve sihirbazın 1. adımına (AI Editör) geç.
  async function startWizard() {
    if (!nTitle.trim()) return;
    setBusy(true);
    try {
      // Çok-boylu profillerde seçilen (ya da varsayılan) boy projeye yazılır;
      // sabit boylu profillerde (KDY/Akademi) profil zaten boyu belirler.
      const sizeOpts = profileSizeOptions(nProfile);
      const sizeId = sizeOpts.length ? (nSizeId || STANDARD_PROFILES[nProfile].defaultSizeId) : undefined;
      const { id } = await createProject(nTitle.trim(), nAuthor.trim(), nGenre, nIsbn.trim(), nProfile, sizeId);
      if (wordDoc) {
        // Word metni kitaba yazılır; orijinal dosya AI Editör oturumuna verilir
        // (Word indirirken biçim korunsun diye).
        await updateProjectManuscript(id, wordDoc.text, "editor", new Date().toISOString());
        patchSession(id, { originalDocx: wordDoc.buffer, docxEdits: [], manualEdit: false });
      }
      router.push(`/${lang}/editor?project=${id}`);
    } catch (e) {
      console.error(e);
      setError(t.loadError);
      setBusy(false);
    }
  }

  async function onRename(id: string, current: string) {
    const name = window.prompt(t.renamePrompt, current);
    if (name == null) return;
    await renameProject(id, name.trim());
    await refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    await deleteProject(id);
    await refresh();
  }

  const count = items?.length ?? 0;
  const recent = items?.[0] ?? null;
  const tr = lang === "tr";
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  // ── Kitabın adımları (sihirbaz) → ilerleme çubuğu, durum rozeti, sıradaki adım ──
  type Step = { key: "editor" | "mizanpaj" | "kapak" | "indir"; label: string; done: boolean };
  const stepsOf = (p: ProjectListItem): Step[] => {
    const w = p.wizard ?? {};
    const e = !!w.editorCompleted;
    const l = !!w.layoutCompleted;
    const c = !!w.coverCompleted;
    return [
      { key: "editor", label: tr ? "Metin" : "Text", done: e },
      { key: "mizanpaj", label: tr ? "Mizanpaj" : "Layout", done: l },
      { key: "kapak", label: tr ? "Kapak" : "Cover", done: c },
      { key: "indir", label: tr ? "Baskı" : "Print", done: false },
    ];
  };
  const nextStep = (p: ProjectListItem): Step => stepsOf(p).find((s) => !s.done) ?? stepsOf(p)[3];
  const statusOf = (p: ProjectListItem): { label: string; cls: string } => {
    const st = stepsOf(p);
    const doneCount = st.filter((s) => s.done).length;
    if (doneCount >= 3) return { label: tr ? "Baskıya hazır" : "Print ready", cls: "bg-emerald-50 text-emerald-700" };
    if (doneCount > 0 || Date.now() - new Date(p.updated_at).getTime() < 86400000)
      return { label: tr ? "Düzenleniyor" : "In progress", cls: "bg-[var(--pri-soft)] text-[var(--pri)]" };
    return { label: tr ? "Taslak" : "Draft", cls: "bg-[#f1f2f6] text-[#5b6273]" };
  };
  const continueLabel = (p: ProjectListItem): string => {
    const n = nextStep(p).key;
    if (tr)
      return n === "editor" ? "Metne devam et" : n === "mizanpaj" ? "Mizanpaja devam et" : n === "kapak" ? "Kapağa devam et" : "Dosyaları indir";
    return n === "editor" ? "Continue text" : n === "mizanpaj" ? "Continue layout" : n === "kapak" ? "Continue cover" : "Download files";
  };
  const hrefOf = (p: ProjectListItem) => `/${lang}/${nextStep(p).key}?project=${p.id}`;

  // "bugün, 18.42" / "dün, 09.10" / "12 Kasım"
  const editedLabel = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const hm = d.toLocaleTimeString(tr ? "tr-TR" : "en-US", { hour: "2-digit", minute: "2-digit" });
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return tr ? `bugün, ${hm}` : `today, ${hm}`;
    if (sameDay(d, y)) return tr ? `dün, ${hm}` : `yesterday, ${hm}`;
    return d.toLocaleDateString(tr ? "tr-TR" : "en-US", { day: "numeric", month: "long" });
  };
  const shortDate = (iso: string): string => {
    const l = editedLabel(iso);
    return l.startsWith("bugün") ? "Bugün" : l.startsWith("dün") ? "Dün" : l.startsWith("today") ? "Today" : l.startsWith("yesterday") ? "Yesterday" : l;
  };

  const hour = new Date().getHours();
  const greet = tr
    ? hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Arama: kitap adı ya da yazar (Türkçe harf duyarlı).
  const q = query.trim().toLocaleLowerCase("tr");
  const others = (items ?? []).filter((p) => p.id !== recent?.id);
  const matches = q
    ? (items ?? []).filter((p) => `${p.title} ${p.author}`.toLocaleLowerCase("tr").includes(q))
    : others;
  const shown = q || showAll ? matches : matches.slice(0, 3);

  // Kapak: küçük resim varsa o, yoksa adıyla üretilmiş sade bir kapak.
  const cover = (p: ProjectListItem, w: number, h: number) => {
    const thumb = p.thumb_path ? thumbs.get(p.thumb_path) : undefined;
    const title = p.title?.trim() || t.untitled;
    return thumb ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumb}
        alt={title}
        width={w}
        height={h}
        className="shrink-0 rounded-md object-cover shadow-[0_6px_16px_rgba(20,24,40,.18)]"
        style={{ width: w, height: h }}
      />
    ) : (
      <div
        className="flex shrink-0 flex-col justify-between overflow-hidden rounded-md p-2.5 text-center shadow-[0_6px_16px_rgba(20,24,40,.16)]"
        style={{ width: w, height: h, background: spineFor(p.id) }}
        aria-label={title}
      >
        <div className="font-serif font-semibold uppercase leading-tight text-white" style={{ fontSize: Math.max(9, w / 8) }}>
          {title}
        </div>
        <div className="truncate text-[8px] uppercase tracking-wider text-white/80">{p.author?.trim()}</div>
      </div>
    );
  };

  const btnPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--pri)] px-5 py-3 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(79,70,229,.28)] transition hover:opacity-90 disabled:opacity-60";
  const btnOutline =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[#dcdfea] bg-white px-5 py-3 text-[15px] font-semibold text-[#1d2333] transition hover:border-[var(--pri)] hover:text-[var(--pri)] disabled:opacity-60";
  const card = "rounded-2xl border border-[#eceef5] bg-white shadow-[0_1px_2px_rgba(20,24,40,.04)]";

  const TOOLS = [
    {
      icon: "ai" as const,
      title: tr ? "Metni incele" : "Review text",
      titleEmpty: tr ? "Metnini düzenle" : "Edit your text",
      desc: tr ? "Yazım, üslup ve tutarlılık" : "Spelling, style and consistency",
      descEmpty: tr ? "Yazım, üslup ve tutarlılığı gözden geçir." : "Check spelling, style and consistency.",
      seg: "editor",
    },
    {
      icon: "layout" as const,
      title: tr ? "Mizanpaj oluştur" : "Create layout",
      titleEmpty: tr ? "Sayfalarını tasarla" : "Design your pages",
      desc: tr ? "Metnini kitap sayfalarına dönüştür" : "Turn your text into book pages",
      descEmpty: tr ? "Metnini baskıya hazır sayfalara dönüştür." : "Turn your text into print-ready pages.",
      seg: "mizanpaj",
    },
    {
      icon: "cover" as const,
      title: tr ? "Kapak tasarla" : "Design a cover",
      titleEmpty: tr ? "Kapağını hazırla" : "Prepare your cover",
      desc: tr ? "Ön kapak, sırt ve arka kapak" : "Front, spine and back cover",
      descEmpty: tr ? "Ön kapak, sırt ve arka kapağı birlikte tasarla." : "Design front, spine and back together.",
      seg: "kapak",
    },
  ];

  const empty = items !== null && count === 0;

  return (
    <AppShell lang={lang} user={user} signOut={signOut} active="home" defaultCollapsed={defaultCollapsed}>
      <input
        ref={wordInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void pickWord(f);
        }}
      />
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-7 sm:px-8">
        {/* ── başlık ── */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[28px] font-extrabold tracking-tight text-[#141827] sm:text-[32px]" suppressHydrationWarning>
              {empty ? (tr ? `Hoş geldin, ${firstName}` : `Welcome, ${firstName}`) : `${greet}, ${firstName}`}
            </h1>
            <p className="mt-1.5 text-[15.5px] text-[#6b7280]">
              {empty
                ? tr
                  ? "İlk kitabın için çalışma alanın hazır."
                  : "Your workspace is ready for your first book."
                : tr
                  ? "Kitabına kaldığın yerden devam et."
                  : "Pick up your book where you left off."}
            </p>
          </div>
          {!empty && (
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <label className="relative w-full sm:w-64">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1b1]">
                  <Icon name="search" size={18} />
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr ? "Kitaplarında ara…" : "Search your books…"}
                  aria-label={tr ? "Kitaplarında ara" : "Search your books"}
                  className="tipo-input w-full rounded-xl border border-[#dcdfea] bg-white py-3 pl-10 pr-3 text-[15px] text-[#1d2333]"
                />
              </label>
              <button onClick={onNew} disabled={busy} className={btnPrimary}>
                <Icon name="plus" size={18} sw={2.1} />
                {busy ? t.creating : tr ? "Yeni kitap" : "New book"}
              </button>
              <button onClick={() => wordInputRef.current?.click()} disabled={busy} className={btnOutline} title={tr ? "Bir Word (.docx) dosyasından yeni kitap başlat" : "Start a new book from a Word (.docx) file"}>
                <WordGlyph />
                {tr ? "Word yükle" : "Upload Word"}
              </button>
            </div>
          )}
        </div>

        {/* ── yükleniyor ── */}
        {items === null && (
          <div className={`${card} flex items-center gap-6 p-6`}>
            <div className="tipo-pulse h-[150px] w-[108px] rounded-md bg-[#eef0f6]" />
            <div className="flex-1 space-y-3">
              <div className="tipo-pulse h-5 w-1/2 rounded bg-[#eef0f6]" />
              <div className="tipo-pulse h-4 w-1/3 rounded bg-[#eef0f6]" />
            </div>
          </div>
        )}

        {/* ── BOŞ DURUM: ilk kitap ── */}
        {empty && (
          <>
            <div className={`${card} flex flex-col items-center px-6 py-12 text-center sm:py-14`}>
              <OpenBookArt />
              <h2 className="mt-6 text-[28px] font-extrabold tracking-tight text-[#141827] sm:text-[34px]">
                {tr ? "İlk kitabını oluşturalım" : "Let's create your first book"}
              </h2>
              <p className="mt-3 max-w-xl text-[16.5px] leading-relaxed text-[#5b6273]">
                {tr
                  ? "Metnini düzenle, sayfalarını tasarla ve kapağını hazırla. Tüm çalışmalarını tek bir kitap altında topla."
                  : "Edit your text, design your pages and prepare your cover — all in one book."}
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <button onClick={onNew} disabled={busy} className={btnPrimary}>
                  <Icon name="plus" size={18} sw={2.1} />
                  {busy ? t.creating : tr ? "İlk kitabımı oluştur" : "Create my first book"}
                </button>
                <button onClick={() => wordInputRef.current?.click()} disabled={busy} className={btnOutline}>
                  <WordGlyph />
                  {tr ? "Word'den başla" : "Start from Word"}
                </button>
                <button onClick={() => setHowOpen(true)} className={btnOutline}>
                  <QuestionGlyph />
                  {tr ? "Nasıl çalışır?" : "How does it work?"}
                </button>
              </div>
              <p className="mt-4 text-[14px] text-[#8a90a0]">
                {tr ? "Kitap adını belirleyerek başlayabilirsin." : "Start by naming your book."}
              </p>
            </div>
            <h2 className="mb-4 mt-9 text-[21px] font-extrabold tracking-tight text-[#141827]">
              {tr ? "Laycoty ile neler yapabilirsin?" : "What you can do with Laycoty"}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {TOOLS.map((x) => (
                <button key={x.seg} onClick={onNew} className={`${card} tipo-launch flex items-center gap-4 p-5 text-left`}>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--pri-soft)] text-[var(--pri)]">
                    <Icon name={x.icon} size={23} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[16.5px] font-bold text-[#141827]">{x.titleEmpty}</span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-[#6b7280]">{x.descEmpty}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── KALDIĞIN YERDEN DEVAM ET ── */}
        {recent && !q && (
          <>
            <h2 className="mb-4 text-[21px] font-extrabold tracking-tight text-[#141827]">
              {tr ? "Kaldığın yerden devam et" : "Pick up where you left off"}
            </h2>
            <div className={`${card} flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-7`}>
              <button onClick={() => router.push(hrefOf(recent))} className="self-center sm:self-auto" aria-label={recent.title?.trim() || t.untitled}>
                {cover(recent, 118, 164)}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[24px] font-extrabold tracking-tight text-[#141827] sm:text-[27px]">
                  {recent.title?.trim() || t.untitled}
                </div>
                <div className="mt-1 text-[15px] text-[#6b7280]">
                  {recent.author?.trim() || t.noAuthor} · {tr ? "Son düzenleme" : "Last edited"} {editedLabel(recent.updated_at)}
                </div>
                {/* adımlar */}
                <ol className="mt-6 flex max-w-xl">
                  {stepsOf(recent).map((s, i, arr) => {
                    const cur = nextStep(recent).key === s.key;
                    return (
                      <li key={s.key} className="relative flex flex-1 flex-col items-center">
                        {i < arr.length - 1 && (
                          <span className={`absolute left-1/2 top-[11px] h-0.5 w-full ${s.done ? "bg-[var(--pri)]" : "bg-[#dfe1ea]"}`} />
                        )}
                        <span
                          className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                            s.done
                              ? "border-[var(--pri)] bg-[var(--pri)] text-white"
                              : cur
                                ? "border-[var(--pri)] bg-white"
                                : "border-[#c9ccd8] bg-white"
                          }`}
                        >
                          {s.done ? <Icon name="check" size={14} sw={2.6} /> : cur ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--pri)]" /> : null}
                        </span>
                        <span className={`mt-2 text-[14px] ${cur ? "font-bold text-[var(--pri)]" : s.done ? "text-[#1d2333]" : "text-[#8a90a0]"}`}>
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <button
                onClick={() => router.push(hrefOf(recent))}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-[var(--pri)] bg-white px-6 py-3 text-[15.5px] font-bold text-[var(--pri)] transition hover:bg-[var(--pri-soft)]"
              >
                {continueLabel(recent)}
                <Icon name="arrow" size={18} sw={2.1} />
              </button>
            </div>
          </>
        )}

        {/* ── SON KİTAPLARIN ── */}
        {!empty && items !== null && (q ? true : others.length > 0) && (
          <>
            <div className="mb-4 mt-9 flex items-center justify-between gap-3">
              <h2 className="m-0 text-[21px] font-extrabold tracking-tight text-[#141827]">
                {q ? (tr ? `Arama sonuçları (${matches.length})` : `Search results (${matches.length})`) : tr ? "Son kitapların" : "Recent books"}
              </h2>
              {!q && others.length > 3 && (
                <button onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--pri)] hover:underline">
                  {showAll ? (tr ? "Daha az göster" : "Show less") : tr ? `Tüm kitaplar (${count})` : `All books (${count})`}
                  <Icon name="arrow" size={16} sw={2.1} />
                </button>
              )}
            </div>
            {q && matches.length === 0 && (
              <p className="text-[15px] text-[#6b7280]">{tr ? "Bu aramayla eşleşen kitap yok." : "No books match this search."}</p>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => {
                const st = statusOf(p);
                return (
                  <div
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(hrefOf(p))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(hrefOf(p));
                    }}
                    className={`${card} tipo-launch relative flex cursor-pointer gap-4 p-4`}
                  >
                    {cover(p, 92, 128)}
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="truncate text-[17px] font-bold text-[#141827]">{p.title?.trim() || t.untitled}</div>
                      <div className="mt-1 truncate text-[14.5px] text-[#6b7280]">{p.author?.trim() || t.noAuthor}</div>
                      <span className={`mt-3 inline-block rounded-lg px-2.5 py-1 text-[13.5px] font-semibold ${st.cls}`}>{st.label}</span>
                      <div className="mt-3 text-[14px] text-[#6b7280]">{shortDate(p.updated_at)}</div>
                    </div>
                    <div className="absolute right-2 top-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor((m) => (m === p.id ? null : p.id));
                        }}
                        aria-label={tr ? "Kitap seçenekleri" : "Book options"}
                        aria-haspopup="menu"
                        aria-expanded={menuFor === p.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a90a0] transition hover:bg-[#f1f2f6] hover:text-[#1d2333]"
                      >
                        <DotsGlyph />
                      </button>
                      {menuFor === p.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                          <div role="menu" className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-xl border border-[#eceef5] bg-white py-1 shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <button role="menuitem" onClick={() => { setMenuFor(null); router.push(hrefOf(p)); }} className="block w-full px-4 py-2.5 text-left text-[14px] text-[#1d2333] hover:bg-[var(--pri-soft)]">
                              {continueLabel(p)}
                            </button>
                            <button role="menuitem" onClick={() => { setMenuFor(null); void onRename(p.id, p.title); }} className="block w-full px-4 py-2.5 text-left text-[14px] text-[#1d2333] hover:bg-[var(--pri-soft)]">
                              {t.rename}
                            </button>
                            <button role="menuitem" onClick={() => { setMenuFor(null); void onDelete(p.id); }} className="block w-full px-4 py-2.5 text-left text-[14px] text-red-600 hover:bg-red-50">
                              {t.delete}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── HIZLI ARAÇLAR ── */}
        {!empty && items !== null && (
          <>
            <h2 className="mb-4 mt-9 text-[21px] font-extrabold tracking-tight text-[#141827]">{tr ? "Hızlı araçlar" : "Quick tools"}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {TOOLS.map((x) => (
                <Link
                  key={x.seg}
                  href={recent ? `/${lang}/${x.seg}?project=${recent.id}` : `/${lang}/${x.seg}`}
                  className={`${card} tipo-launch flex items-center gap-4 p-5 text-inherit no-underline`}
                  title={recent ? (tr ? `“${recent.title?.trim() || t.untitled}” kitabında açılır` : `Opens in “${recent.title?.trim() || t.untitled}”`) : undefined}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--pri-soft)] text-[var(--pri)]">
                    <Icon name={x.icon} size={23} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16.5px] font-bold text-[#141827]">{x.title}</span>
                    <span className="mt-0.5 block text-[14px] text-[#6b7280]">{x.desc}</span>
                  </span>
                  <span className="text-[#8a90a0]">
                    <Icon name="arrow" size={20} />
                  </span>
                </Link>
              ))}
            </div>
            <button
              onClick={() => setHowOpen(true)}
              className="mt-6 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-[#e3e1fb] bg-[linear-gradient(120deg,#f1f0fe,#f6f2fe)] px-5 py-4 text-left"
            >
              <span className="text-[#5b6273]">
                <Icon name="books" size={22} />
              </span>
              <span className="text-[16px] font-semibold text-[#1d2333]">{tr ? "İlk kitabını mı hazırlıyorsun?" : "Preparing your first book?"}</span>
              <span className="inline-flex items-center gap-1.5 text-[15.5px] font-bold text-[var(--pri)]">
                {tr ? "Adım adım rehber" : "Step-by-step guide"}
                <Icon name="arrow" size={17} sw={2.1} />
              </span>
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[13.5px] text-red-700">{error}</p>
        )}
      </div>

      {/* ── Nasıl çalışır? (adım adım rehber) ── */}
      {howOpen && (
        <div onClick={() => setHowOpen(false)} className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(20,24,40,.45)] p-5">
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="w-[520px] max-w-full rounded-2xl bg-white p-7 shadow-[0_24px_60px_rgba(20,24,40,.28)]">
            <div className="text-[22px] font-extrabold tracking-tight text-[#141827]">{tr ? "Laycoty nasıl çalışır?" : "How Laycoty works"}</div>
            <p className="mt-1 text-[15px] text-[#6b7280]">
              {tr ? "Bir kitap, üç adımda baskıya hazır olur. Her adımı istediğin zaman yeniden açabilirsin." : "A book becomes print-ready in three steps. You can reopen any step at any time."}
            </p>
            <ol className="mt-5 space-y-4">
              {(tr
                ? [
                    ["AI Editör", "Metnini yapıştır ya da Word dosyanı yükle. Yapay zekâ yazım ve üslup önerileri verir; her birini sen onaylarsın."],
                    ["Mizanpaj", "Metnin baskıya hazır kitap sayfalarına dökülür. Boyutu, yazı tipini ve kenar boşluklarını seçersin."],
                    ["Kapak", "Ön kapak, sırt ve arka kapak birlikte tasarlanır; sırt kalınlığı sayfa sayısına göre ayarlanır."],
                    ["Baskı", "İç sayfa ve kapak PDF'lerini indirip matbaaya ya da yayın platformuna gönderirsin."],
                  ]
                : [
                    ["AI Editor", "Paste your text or upload a Word file. AI suggests spelling and style fixes; you approve each one."],
                    ["Layout", "Your text flows into print-ready pages. Choose size, font and margins."],
                    ["Cover", "Front, spine and back are designed together; the spine matches the page count."],
                    ["Print", "Download the interior and cover PDFs for your printer or platform."],
                  ]
              ).map(([h, d], i) => (
                <li key={h} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pri)] text-[13px] font-extrabold text-white">{i + 1}</span>
                  <span>
                    <span className="block text-[16px] font-bold text-[#141827]">{h}</span>
                    <span className="block text-[14.5px] leading-relaxed text-[#5b6273]">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <button onClick={() => setHowOpen(false)} className={btnOutline}>
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  setHowOpen(false);
                  onNew();
                }}
                className={btnPrimary}
              >
                <Icon name="plus" size={18} sw={2.1} />
                {tr ? "Yeni kitapla başla" : "Start a new book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Yeni kitap başlangıç formu (sihirbazın girişi) ── */}
      {newOpen && (
        <div
          onClick={() => !busy && setNewOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(20,24,40,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 460, maxWidth: "100%", background: "#fff", borderRadius: 18, boxShadow: "0 24px 60px rgba(20,24,40,.28)", padding: 26 }}
          >
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.3px" }}>{t.newHeading}</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>{t.newSub}</div>
            {wordDoc && (
              <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 11, background: "var(--pri-soft)", color: "#1d2333", fontSize: 13.5, lineHeight: 1.45 }}>
                <b>{wordDoc.name}</b> · {lang === "tr" ? `${wordDoc.paragraphs} paragraf okundu. Kitap oluşunca metin AI Editör'de açılır.` : `${wordDoc.paragraphs} paragraphs read. The text opens in the AI Editor once the book is created.`}
              </div>
            )}

            <label style={{ ...dlgLabel, marginTop: 0 }}>{t.fProfile}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {WIZARD_PROFILES.map((p) => {
                const active = nProfile === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setNProfile(p.id); setNSizeId(""); }}
                    style={{
                      flex: "1 1 calc(50% - 4px)",
                      minWidth: 132,
                      textAlign: "left",
                      padding: "9px 12px",
                      borderRadius: 11,
                      cursor: "pointer",
                      border: active ? "1px solid var(--pri)" : "1px solid #e1e3ee",
                      background: active ? "var(--pri-soft)" : "#fff",
                      fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--pri)" : "#1d2333" }}>{p[lang]}</div>
                    <div style={{ fontSize: 11.5, color: "#9aa1b1", marginTop: 2 }}>{p.note[lang]}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: "#9aa1b1", marginTop: 6 }}>{t.fProfileHint}</div>

            {/* Çok-boylu profillerde (KDP/Ingram/Serbest) kitap boyu seçici */}
            {(() => {
              const sizeOpts = profileSizeOptions(nProfile);
              if (!sizeOpts.length) return null;
              const current = nSizeId || STANDARD_PROFILES[nProfile].defaultSizeId;
              return (
                <>
                  <label style={dlgLabel}>{t.fSize}</label>
                  <select
                    className="tipo-input"
                    value={current}
                    onChange={(e) => setNSizeId(e.target.value)}
                    style={{ ...dlgInput, cursor: "pointer" }}
                  >
                    {sizeOpts.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 12, color: "#9aa1b1", marginTop: 6 }}>{t.fSizeHint}</div>
                </>
              );
            })()}

            <label style={dlgLabel}>{t.fTitle}</label>
            <input
              className="tipo-input"
              value={nTitle}
              onChange={(e) => setNTitle(e.target.value)}
              placeholder={t.fTitlePh}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && nTitle.trim() && !busy) void startWizard(); }}
              style={dlgInput}
            />

            <label style={dlgLabel}>{t.fAuthor}</label>
            <input
              className="tipo-input"
              value={nAuthor}
              onChange={(e) => setNAuthor(e.target.value)}
              placeholder={t.fAuthorPh}
              style={dlgInput}
            />

            <label style={dlgLabel}>{t.fGenre}</label>
            <select
              className="tipo-input"
              value={nGenre}
              onChange={(e) => setNGenre(e.target.value)}
              style={{ ...dlgInput, cursor: "pointer" }}
            >
              <option value="">{t.fGenrePick}</option>
              {GENRES.map((g) => (
                <option key={g.v} value={g[lang]}>{g[lang]}</option>
              ))}
            </select>

            <label style={dlgLabel}>{t.fIsbn}</label>
            <input
              className="tipo-input"
              value={nIsbn}
              onChange={(e) => setNIsbn(e.target.value)}
              placeholder={t.fIsbnPh}
              inputMode="numeric"
              style={dlgInput}
            />
            <div style={{ fontSize: 12, color: "#9aa1b1", marginTop: 6 }}>{t.fIsbnHint}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button
                onClick={() => setNewOpen(false)}
                disabled={busy}
                style={{ padding: "11px 18px", borderRadius: 11, border: "1px solid #e1e3ee", background: "#fff", color: "#4b5365", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => void startWizard()}
                disabled={busy || !nTitle.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 11, border: "none", background: "var(--pri)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: busy || !nTitle.trim() ? "default" : "pointer", opacity: busy || !nTitle.trim() ? 0.55 : 1, boxShadow: "0 6px 16px rgba(79,70,229,.28)" }}
              >
                {busy ? t.creating : t.startCta}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* hover + nabız efektleri (inline ile yapılamayanlar) */}
      <style>{`
        .tipo-launch { transition: transform .15s, box-shadow .15s, border-color .15s; }
        .tipo-launch:hover { transform: translateY(-3px); box-shadow: 0 12px 26px rgba(20,24,40,.10); border-color: #dfe0fb; }
        .tipo-row { transition: background .12s; }
        .tipo-row:hover { background: #fafbff; }
        .tipo-actions { opacity: 0; transition: opacity .12s; }
        .tipo-row:hover .tipo-actions { opacity: 1; }
        @keyframes tipoPulse { 0%,100% { opacity: 1; } 50% { opacity: .5; } }
        .tipo-pulse { animation: tipoPulse 1.3s ease-in-out infinite; }
        .tipo-input { outline: none; transition: border-color .12s; }
        .tipo-input:focus { border-color: var(--pri); }
      `}</style>
    </AppShell>
  );
}

const dlgLabel: CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#6b7280",
  margin: "12px 0 6px",
};

const dlgInput: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e1e3ee",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  color: "#1d2333",
  background: "#fff",
  boxSizing: "border-box",
};

function WordGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m8.5 12 1.2 5 1.8-4 1.8 4 1.2-5" />
    </svg>
  );
}

function QuestionGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function DotsGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

// Boş durum çizimi: açık kitap + ayraç + iki sayfa kâğıdı (sade, marka renkli).
function OpenBookArt() {
  return (
    <svg viewBox="0 0 340 170" width={340} height={170} className="max-w-full" aria-hidden="true">
      <defs>
        <linearGradient id="ob-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1eefb" />
        </linearGradient>
      </defs>
      <g transform="rotate(-14 70 70)">
        <rect x="22" y="22" width="88" height="110" rx="8" fill="#f4f3fd" stroke="#dcd8f6" />
        <path d="M38 50h52M38 64h44M38 78h50" stroke="#d3cff2" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="rotate(13 270 70)">
        <rect x="228" y="18" width="88" height="110" rx="8" fill="#f4f3fd" stroke="#dcd8f6" />
        <path d="M244 46h52M244 60h44M244 74h50" stroke="#d3cff2" strokeWidth="3" strokeLinecap="round" />
      </g>
      <ellipse cx="170" cy="156" rx="112" ry="9" fill="#e9e6f8" />
      <path d="M70 52c34-10 70-8 100 8v94c-30-14-66-16-100-6z" fill="url(#ob-page)" stroke="#6b5fb5" strokeWidth="3" strokeLinejoin="round" />
      <path d="M270 52c-34-10-70-8-100 8v94c30-14 66-16 100-6z" fill="url(#ob-page)" stroke="#6b5fb5" strokeWidth="3" strokeLinejoin="round" />
      <path d="M62 60v96c36-10 74-8 108 6 34-14 72-16 108-6V60" fill="none" stroke="#6b5fb5" strokeWidth="3" strokeLinejoin="round" />
      <path d="M220 46v42l11-9 11 9V42z" fill="#7c5cf2" />
    </svg>
  );
}
