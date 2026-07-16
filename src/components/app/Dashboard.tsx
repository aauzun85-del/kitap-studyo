"use client";

import { Fragment, useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { listProjects, createProject, renameProject, deleteProject } from "@/lib/projects/data";
import { signThumbs } from "@/lib/projects/storage";
import { createClient } from "@/lib/supabase/client";
import type { ProjectListItem } from "@/lib/projects/types";
import { WIZARD_PROFILES, STANDARD_PROFILES, profileSizeOptions, type PrintStandard } from "@/lib/layout/standards";
import AppShell, { Icon, MODULES, type ShellUser } from "./AppShell";

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

const GENRES: { v: string; tr: string; en: string }[] = [
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

function relTime(iso: string, lang: Locale): string {
  const tr = lang === "tr";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = 60000, hr = 3600000, day = 86400000;
  if (diff < min) return tr ? "az önce" : "just now";
  if (diff < hr) {
    const n = Math.floor(diff / min);
    return tr ? `${n} dakika önce` : `${n} min ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hr);
    return tr ? `${n} saat önce` : `${n}h ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return tr ? `${n} gün önce` : `${n}d ago`;
  }
  return new Date(iso).toLocaleDateString(tr ? "tr-TR" : "en-US");
}

export default function Dashboard({
  lang,
  user,
  signOut,
  previewItems,
  defaultCollapsed,
}: {
  lang: Locale;
  user: ShellUser;
  signOut: () => Promise<void>;
  /** Yalnız görsel doğrulama içindir; verildiğinde Supabase'e gidilmez. */
  previewItems?: ProjectListItem[];
  defaultCollapsed?: boolean;
}) {
  const t = COPY[lang];
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[] | null>(previewItems ?? null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Yeni kitap sihirbazı başlangıç formu
  const [newOpen, setNewOpen] = useState(false);
  const [nProfile, setNProfile] = useState<PrintStandard>("kdy");
  // Seçilen kitap boyu — yalnız çok-boylu profillerde (KDP/Ingram/Serbest) anlamlı.
  const [nSizeId, setNSizeId] = useState<string>("");
  const [nTitle, setNTitle] = useState("");
  const [nAuthor, setNAuthor] = useState("");
  const [nGenre, setNGenre] = useState("");
  const [nIsbn, setNIsbn] = useState("");

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

  const openProject = (id: string) => router.push(`/${lang}/kapak?project=${id}`);

  // "Yeni Kitap" → önce başlangıç formunu aç (ad/yazar/tür).
  function onNew() {
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

  // ── küçük yardımcı stiller ──
  const sectionTitle: CSSProperties = { margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-.3px" };
  const cardBase: CSSProperties = {
    background: "#fff",
    border: "1px solid #eceef5",
    borderRadius: 16,
    boxShadow: "0 1px 2px rgba(20,24,40,.04)",
  };

  function spineChip(p: ProjectListItem, w: number, h: number) {
    const thumb = p.thumb_path ? thumbs.get(p.thumb_path) : undefined;
    return (
      <span
        style={{
          width: w,
          height: h,
          borderRadius: 5,
          flex: "none",
          background: thumb ? `center/cover no-repeat url(${thumb})` : spineFor(p.id),
        }}
      />
    );
  }

  return (
    <AppShell lang={lang} user={user} signOut={signOut} active="home" defaultCollapsed={defaultCollapsed}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 34px 60px" }}>
        {/* ── başlık ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#9aa1b1", marginBottom: 4 }}>{t.kicker}</div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.6px" }}>{t.greeting(user.name)}</h1>
            <div style={{ fontSize: 15, color: "#6b7280", marginTop: 5 }}>
              {count === 0 ? t.subEmpty : t.sub(count)}
            </div>
          </div>
          <button
            onClick={onNew}
            disabled={busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 20px",
              border: "none",
              borderRadius: 12,
              background: "var(--pri)",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 14.5,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.65 : 1,
              boxShadow: "0 6px 16px rgba(79,70,229,.28)",
            }}
          >
            <Icon name="plus" size={18} sw={2.1} />
            {busy ? t.creating : t.newBook}
          </button>
        </div>

        {/* ── kaldığın yerden devam et ── */}
        {recent && (
          <div
            style={{
              borderRadius: 18,
              padding: "26px 28px",
              background: "linear-gradient(120deg,var(--pri),#7c3aed 92%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 26,
              boxShadow: "0 14px 30px rgba(79,70,229,.25)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", right: -40, top: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
            <div style={{ position: "absolute", right: 90, bottom: -90, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />
            {/* mini kapak */}
            <div
              style={{
                width: 84,
                height: 116,
                borderRadius: 8,
                background: recent.thumb_path && thumbs.get(recent.thumb_path)
                  ? `center/cover no-repeat url(${thumbs.get(recent.thumb_path)})`
                  : "linear-gradient(160deg,#fff,#e7e9ff)",
                flex: "none",
                boxShadow: "0 8px 18px rgba(0,0,0,.22)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "11px 10px",
                zIndex: 1,
              }}
            >
              {!(recent.thumb_path && thumbs.get(recent.thumb_path)) && (
                <>
                  <div style={{ fontFamily: "'Lora',serif", fontSize: 13, fontWeight: 600, color: "#3a3360", lineHeight: 1.1, overflow: "hidden", maxHeight: 42 }}>
                    {recent.title?.trim() || t.untitled}
                  </div>
                  <div style={{ fontSize: 8, color: "#8a85ad", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>
                    {recent.author?.trim() || ""}
                  </div>
                </>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".6px", opacity: 0.85 }}>{t.continueKicker}</div>
              <div style={{ fontSize: 24, fontWeight: 800, margin: "5px 0 3px", letterSpacing: "-.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {recent.title?.trim() || t.untitled}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>
                {(recent.author?.trim() || t.noAuthor) + " · " + relTime(recent.updated_at, lang)}
              </div>
            </div>
            <button
              onClick={() => openProject(recent.id)}
              style={{
                zIndex: 1,
                flex: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 22px",
                border: "none",
                borderRadius: 12,
                background: "#fff",
                color: "var(--pri)",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 18px rgba(0,0,0,.18)",
              }}
            >
              {t.continueCta}
              <Icon name="arrow" size={18} sw={2.1} />
            </button>
          </div>
        )}

        {/* ── Kitap Tasarım Sihirbazı (asıl başlangıç noktası) ── */}
        <div
          style={{
            marginTop: recent ? 28 : 8,
            borderRadius: 18,
            padding: "22px 26px",
            background: "linear-gradient(120deg, #eef0fd, #f3edfe)",
            border: "1px solid #dfe0fb",
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: ".6px", color: "var(--pri)" }}>
              <Icon name="ai" size={15} />
              {t.wizKicker}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.3px", marginTop: 6 }}>{t.wizTitle}</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>{t.wizSub}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {t.wizSteps.map((s, i) => (
                <Fragment key={s}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 99, background: "#fff", border: "1px solid #e1e3ee", fontSize: 13, fontWeight: 600 }}>
                    <span style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", background: "var(--pri)", color: "#fff", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    {s}
                  </span>
                  {i < t.wizSteps.length - 1 && <Icon name="arrow" size={15} style={{ color: "#b6bbcb" }} />}
                </Fragment>
              ))}
            </div>
          </div>
          <button
            onClick={onNew}
            disabled={busy}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "14px 24px", border: "none", borderRadius: 13, background: "linear-gradient(135deg, var(--pri), #7c3aed)", color: "#fff", fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 8px 20px rgba(79,70,229,.30)", flex: "none" }}
          >
            {t.wizCta}
            <Icon name="arrow" size={18} sw={2.1} />
          </button>
        </div>

        {/* ── modül başlatıcı ── */}
        <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={sectionTitle}>{t.whatNext}</h2>
          <div style={{ fontSize: 13.5, color: "#9aa1b1" }}>{t.whatNextSub}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {MODULES.map((m) => (
            <Link
              key={m.seg}
              href={`/${lang}/${m.seg}`}
              className="tipo-launch"
              style={{ ...cardBase, padding: 20, cursor: "pointer", textDecoration: "none", color: "inherit", display: "block" }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  background: m.tileBg,
                  color: m.tileFg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Icon name={m.icon} size={23} />
              </div>
              <div style={{ fontSize: 16.5, fontWeight: 700, marginBottom: 5 }}>{m.label[lang]}</div>
              <div style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.45 }}>{m.desc[lang]}</div>
            </Link>
          ))}
        </div>

        {/* ── son kitaplar ── */}
        <div style={{ marginTop: 32, ...cardBase, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #f0f1f7" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.3px" }}>{t.recent}</h2>
          </div>

          {/* başlık satırı */}
          {count > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) 150px 72px",
                padding: "11px 22px",
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: ".5px",
                color: "#9aa1b1",
                borderBottom: "1px solid #f0f1f7",
              }}
            >
              <div>{t.colBook}</div>
              <div style={{ textAlign: "right" }}>{t.colUpdated}</div>
              <div />
            </div>
          )}

          {/* yükleniyor iskeleti */}
          {items === null &&
            [0, 1, 2].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 22px", borderBottom: "1px solid #f4f5fa" }}>
                <span style={{ width: 34, height: 44, borderRadius: 5, background: "#eef0f6" }} className="tipo-pulse" />
                <span style={{ flex: 1, height: 12, borderRadius: 4, background: "#eef0f6" }} className="tipo-pulse" />
              </div>
            ))}

          {/* boş durum */}
          {items !== null && count === 0 && (
            <div style={{ padding: "44px 22px", textAlign: "center" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--pri-soft)", color: "var(--pri)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                <Icon name="books" size={26} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{t.emptyTitle}</div>
              <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 6, maxWidth: 360, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>{t.emptyHint}</div>
              <button
                onClick={onNew}
                disabled={busy}
                style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", border: "none", borderRadius: 11, background: "var(--pri)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                <Icon name="plus" size={17} sw={2.1} />
                {busy ? t.creating : t.newBook}
              </button>
            </div>
          )}

          {/* satırlar */}
          {items?.map((p, i) => {
            const title = p.title?.trim() || t.untitled;
            return (
              <div
                key={p.id}
                className="tipo-row"
                onClick={() => openProject(p.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 150px 72px",
                  alignItems: "center",
                  padding: "14px 22px",
                  fontSize: 14,
                  cursor: "pointer",
                  borderBottom: i === items.length - 1 ? "none" : "1px solid #f4f5fa",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  {spineChip(p, 34, 44)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
                    <div style={{ fontSize: 12.5, color: "#9aa1b1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.author?.trim() || t.noAuthor}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", color: "#9aa1b1", fontSize: 13 }}>{relTime(p.updated_at, lang)}</div>
                <div className="tipo-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); void onRename(p.id, p.title); }}
                    title={t.rename}
                    style={iconBtn}
                  >
                    <PencilSvg />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void onDelete(p.id); }}
                    title={t.delete}
                    style={iconBtn}
                  >
                    <TrashSvg />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: 13.5 }}>{error}</p>
        )}
      </div>

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

const iconBtn: CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid #ececf4",
  background: "#fff",
  color: "#6b7280",
  cursor: "pointer",
};

function PencilSvg() {
  return (
    <svg viewBox="0 0 256 256" width={15} height={15} fill="currentColor" aria-hidden="true">
      <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z" />
    </svg>
  );
}

function TrashSvg() {
  return (
    <svg viewBox="0 0 256 256" width={15} height={15} fill="currentColor" aria-hidden="true">
      <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
    </svg>
  );
}
