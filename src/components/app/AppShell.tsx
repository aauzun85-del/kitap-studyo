"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/**
 * tipostudio uygulama kabuğu — giriş yapmış kullanıcının gördüğü çatı.
 * 250px sol menü + 66px üst bar + kayan içerik alanı. Renk dili indigo→mor
 * (Claude Design "tipostudio Panel" tasarımı). CSS değişkenleri kök div'e
 * gömülüdür → bu kabuğun altındaki her şey indigo temayı kullanır; uygulamanın
 * geri kalanı (pazarlama sayfası, eski araçlar) etkilenmez.
 */

// ── Tema değişkenleri (açık menü) ──
// Not: --accent/--background/... değişkenleri kök div'e gömülür → bu çatının
// İÇİNE giren modüller (Tailwind bg-accent/text-accent/border-border kullananlar)
// uygulamanın turuncu temasından tasarımın indigo/açık paletine OTOMATİK geçer.
// Kapsam yalnız bu çatı: pazarlama sayfası + global tema dokunulmaz.
const SHELL_VARS: CSSProperties = {
  // primary (tasarımın indigo→mor vurgusu)
  ["--pri" as string]: "#4f46e5",
  ["--pri-d" as string]: "#4338ca",
  ["--pri-soft" as string]: "#eef0fd",
  // sidebar
  ["--sb-bg" as string]: "#ffffff",
  ["--sb-fg" as string]: "#5b6275",
  ["--sb-abg" as string]: "#eef0fd",
  ["--sb-afg" as string]: "#4f46e5",
  ["--sb-bd" as string]: "#e9eaf3",
  ["--sb-logo" as string]: "#1d2333",
  ["--sb-muted" as string]: "#9aa1b1",
  // app paleti (çocuk modüller bunları miras alır → kapsamlı yeniden renklendirme)
  ["--accent" as string]: "#4f46e5",
  ["--accent-soft" as string]: "#eef0fd",
  ["--background" as string]: "#f5f6fa",
  ["--surface" as string]: "#ffffff",
  ["--foreground" as string]: "#1d2333",
  ["--muted" as string]: "#6b7280",
  ["--border" as string]: "#e9eaf3",
};

// ── İkonlar (tasarımdaki birebir SVG yolları) ──
const ICON_PATHS: Record<string, ReactNode> = {
  home: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  books: (<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16" /></>),
  cover: (<><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m5 17 4-4 4 4 3-3 3 3" /></>),
  layout: (<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 4v16" /><path d="M7 8h2M7 12h2M15 8h2M15 12h2" /></>),
  ai: <path d="M12 5l1.7 4.3L18 11l-4.3 1.7L12 17l-1.7-4.3L6 11l4.3-1.7z" />,
  book: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>),
  audio: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />,
  promo: (<><path d="m3 11 14-6v14L3 13z" /><path d="M7 13v4a1 1 0 0 0 1 1h2" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2 12h3M19 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 0 0 4 0" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 18l-6-6 6-6" />,
  check: <path d="M4 12l5 5L20 6" />,
  logout: (<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>),
};

export function Icon({
  name,
  size = 20,
  sw = 1.8,
  style,
}: {
  name: keyof typeof ICON_PATHS;
  size?: number;
  sw?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

// ── Modüller (sol menü + Pano başlatıcı ortak kaynak) ──
export type ModuleDef = {
  seg: string; // uygulama rota parçası
  icon: keyof typeof ICON_PATHS;
  label: Record<Locale, string>;
  desc: Record<Locale, string>;
  tileBg: string;
  tileFg: string;
};

export const MODULES: ModuleDef[] = [
  {
    seg: "kapak",
    icon: "cover",
    label: { tr: "Kapak", en: "Cover" },
    desc: { tr: "KDP ölçülü kapak tasarla — sırt & barkod otomatik.", en: "Design a KDP-sized cover — spine & barcode automatic." },
    tileBg: "#f3edfe",
    tileFg: "#7c3aed",
  },
  {
    seg: "mizanpaj",
    icon: "layout",
    label: { tr: "Mizanpaj", en: "Layout" },
    desc: { tr: "Metni baskıya hazır iç sayfalara dönüştür.", en: "Turn your text into print-ready interior pages." },
    tileBg: "#fef3e2",
    tileFg: "#d97706",
  },
  {
    seg: "editor",
    icon: "ai",
    label: { tr: "AI Editör", en: "AI Editor" },
    desc: { tr: "Dilbilgisi, üslup ve tutarlılık önerileri.", en: "Grammar, style and consistency suggestions." },
    tileBg: "#eef0fd",
    tileFg: "#4f46e5",
  },
  {
    seg: "ekitap",
    icon: "book",
    label: { tr: "E-kitap", en: "E-book" },
    desc: { tr: "EPUB, Kindle ve akan PDF olarak üret.", en: "Generate EPUB, Kindle and reflowable PDF." },
    tileBg: "#e3f6f4",
    tileFg: "#0d9488",
  },
  {
    seg: "sesli-kitap",
    icon: "audio",
    label: { tr: "Sesli Kitap", en: "Audiobook" },
    desc: { tr: "Bölümleri doğal sesle seslendir ve indir.", en: "Narrate chapters with a natural voice and download." },
    tileBg: "#fdeef2",
    tileFg: "#e11d48",
  },
  {
    seg: "tanitim",
    icon: "promo",
    label: { tr: "Tanıtım", en: "Promo" },
    desc: { tr: "Sosyal medya, bülten ve satış metni üret.", en: "Generate social posts, newsletters and sales copy." },
    tileBg: "#e6f1fe",
    tileFg: "#2563eb",
  },
];

export type ShellUser = {
  name: string;
  initials: string;
  email: string;
  isAdmin: boolean;
};

const COPY = {
  tr: {
    home: "Ana Sayfa",
    myBooks: "Kitaplarım",
    modules: "MODÜLLER",
    admin: "Yönetim",
    plan: "Eco plan",
    upgrade: "Yükselt",
    search: "Kitap, modül veya ayar ara…",
    signOut: "Çıkış yap",
    signIn: "Giriş yap",
    langLabel: "Dil",
  },
  en: {
    home: "Home",
    myBooks: "My Books",
    modules: "MODULES",
    admin: "Admin",
    plan: "Eco plan",
    upgrade: "Upgrade",
    search: "Search books, modules or settings…",
    signOut: "Sign out",
    signIn: "Sign in",
    langLabel: "Language",
  },
} as const;

// Bağlam çubuğu: çalışma alanında hangi kitap + hangi modül olduğunu gösterir.
export type AppShellContext = {
  backHref: string;
  backLabel: string;
  title: string;
  meta?: string;
  moduleLabel: string;
  spine?: string;
  savedLabel?: string;
};

const AVATAR_GRADIENT = "linear-gradient(135deg,#f0a,#a0f)";

export default function AppShell({
  lang,
  user,
  signOut,
  active,
  context,
  children,
}: {
  lang: Locale;
  user?: ShellUser | null;
  signOut?: () => Promise<void>;
  active?: "home" | "books" | string;
  context?: AppShellContext;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const seg = pathname.split("/")[2] ?? "";
  const t = COPY[lang];
  const other: Locale = lang === "tr" ? "en" : "tr";
  const [menuOpen, setMenuOpen] = useState(false);

  // Aktif menü öğesi: dışarıdan "active" verilirse onu, yoksa rotadan çıkar.
  const isHome = active === "home" || (!active && (seg === "" || seg === "projeler"));
  const moduleActive = (s: string) => active === s || (!active && seg === s);
  const isBooks = active === "books" || (!active && !isHome && !MODULES.some((m) => m.seg === seg) && seg === "projeler");

  const navRow = (
    key: string,
    href: string,
    icon: keyof typeof ICON_PATHS,
    label: string,
    on: boolean,
  ) => (
    <Link
      key={key}
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 12px",
        borderRadius: 11,
        cursor: "pointer",
        fontSize: 14.5,
        fontWeight: 600,
        textDecoration: "none",
        color: on ? "var(--sb-afg)" : "var(--sb-fg)",
        background: on ? "var(--sb-abg)" : "transparent",
      }}
    >
      <Icon name={icon} />
      {label}
    </Link>
  );

  return (
    <div
      style={{
        ...SHELL_VARS,
        fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        display: "flex",
        height: "100dvh",
        width: "100%",
        background: "#f5f6fa",
        color: "#1d2333",
        WebkitFontSmoothing: "antialiased",
        overflow: "hidden",
      }}
    >
      {/* ===================== SIDEBAR ===================== */}
      <aside
        style={{
          width: 250,
          flex: "none",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--sb-bg)",
          borderRight: "1px solid var(--sb-bd)",
          padding: "18px 14px",
          gap: 3,
        }}
      >
        <Link
          href={`/${lang}/projeler`}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px", textDecoration: "none" }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg,var(--pri),#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            t
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.3px", color: "var(--sb-logo)" }}>
            tipostudio
          </div>
        </Link>

        {navRow("home", `/${lang}/projeler`, "home", t.home, isHome)}
        {navRow("books", `/${lang}/projeler`, "books", t.myBooks, isBooks)}

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", color: "var(--sb-muted)", padding: "18px 12px 7px" }}>
          {t.modules}
        </div>

        {MODULES.map((m) => navRow(m.seg, `/${lang}/${m.seg}`, m.icon, m.label[lang], moduleActive(m.seg)))}

        <div style={{ flex: 1 }} />

        {user?.isAdmin && navRow("admin", `/${lang}/admin`, "gear", t.admin, seg === "admin")}

        {/* dil değiştirici */}
        <Link
          href={`/${other}/projeler`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 12px",
            borderRadius: 11,
            cursor: "pointer",
            fontSize: 14.5,
            fontWeight: 600,
            textDecoration: "none",
            color: "var(--sb-fg)",
          }}
        >
          <Icon name="globe" />
          {t.langLabel}: {other.toUpperCase()}
        </Link>

        {/* kullanıcı kartı + çıkış (giriş yapılmışsa) / giriş bağlantısı (anonim) */}
        {user ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "10px 8px",
              marginTop: 6,
              borderTop: "1px solid var(--sb-bd)",
              paddingTop: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: AVATAR_GRADIENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                flex: "none",
              }}
            >
              {user.initials}
            </div>
            <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
              <div
                style={{ fontSize: 13.5, fontWeight: 700, color: "var(--sb-logo)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                title={user.email}
              >
                {user.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--sb-muted)" }}>{t.plan}</div>
            </div>
            {signOut && (
              <form action={signOut}>
                <button
                  type="submit"
                  title={t.signOut}
                  style={{
                    width: 30,
                    height: 30,
                    border: "none",
                    borderRadius: 8,
                    background: "transparent",
                    color: "var(--sb-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="logout" size={17} />
                </button>
              </form>
            )}
          </div>
        ) : (
          <Link
            href={`/${lang}/giris`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px",
              marginTop: 6,
              borderTop: "1px solid var(--sb-bd)",
              paddingTop: 14,
              textDecoration: "none",
              color: "var(--pri)",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <Icon name="logout" size={18} />
            {t.signIn}
          </Link>
        )}
      </aside>

      {/* ===================== MAIN ===================== */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* topbar */}
        <header
          style={{
            height: 66,
            flex: "none",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "0 26px",
            background: "#fff",
            borderBottom: "1px solid #e9eaf3",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: 340,
              maxWidth: "34vw",
              height: 40,
              padding: "0 14px",
              background: "#f5f6fa",
              border: "1px solid #eceef5",
              borderRadius: 11,
              color: "#9aa1b1",
              fontSize: 14,
            }}
          >
            <Icon name="search" size={18} sw={1.9} />
            {t.search}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 13px",
              border: "1px solid #e3e5f0",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              color: "#4b5365",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pri)" }} />
            {t.plan}
            <span style={{ color: "var(--pri)", fontWeight: 700, marginLeft: 2 }}>{t.upgrade}</span>
          </div>
          <button
            style={{
              width: 40,
              height: 40,
              border: "1px solid #e9eaf3",
              borderRadius: 11,
              background: "#fff",
              color: "#4b5365",
              cursor: "pointer",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bell" size={20} />
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 9,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#e11d48",
                border: "1.5px solid #fff",
              }}
            />
          </button>

          {/* avatar + menü (giriş yapılmışsa) / giriş bağlantısı (anonim) */}
          {user ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 40,
                height: 40,
                border: "none",
                borderRadius: 11,
                background: AVATAR_GRADIENT,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {user.initials}
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={() => setMenuOpen(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 48,
                    right: 0,
                    width: 230,
                    zIndex: 41,
                    background: "#fff",
                    border: "1px solid #e9eaf3",
                    borderRadius: 13,
                    boxShadow: "0 14px 36px rgba(20,24,40,.16)",
                    padding: 8,
                  }}
                >
                  <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #f0f1f7" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "#9aa1b1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.email}
                    </div>
                  </div>
                  {user.isAdmin && (
                    <Link
                      href={`/${lang}/admin`}
                      onClick={() => setMenuOpen(false)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "#3a4154", textDecoration: "none" }}
                    >
                      <Icon name="gear" size={17} style={{ color: "#6b7280" }} />
                      {t.admin}
                    </Link>
                  )}
                  <Link
                    href={`/${other}/projeler`}
                    onClick={() => setMenuOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, fontSize: 13.5, color: "#3a4154", textDecoration: "none" }}
                  >
                    <Icon name="globe" size={17} style={{ color: "#6b7280" }} />
                    {t.langLabel}: {other.toUpperCase()}
                  </Link>
                  {signOut && (
                    <form action={signOut}>
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          borderRadius: 9,
                          fontSize: 13.5,
                          color: "#e11d48",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Icon name="logout" size={17} />
                        {t.signOut}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
          ) : (
            <Link
              href={`/${lang}/giris`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px",
                borderRadius: 11,
                background: "var(--pri)",
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t.signIn}
            </Link>
          )}
        </header>

        {/* bağlam çubuğu (çalışma alanı): hangi kitap + hangi modül */}
        {context && (
          <div
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 26px",
              background: "#fff",
              borderBottom: "1px solid #e9eaf3",
            }}
          >
            <Link
              href={context.backHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 13px",
                border: "1px solid #e9eaf3",
                borderRadius: 10,
                background: "#fff",
                color: "#4b5365",
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "none",
                flex: "none",
              }}
            >
              <Icon name="arrowLeft" size={16} sw={2.1} />
              {context.backLabel}
            </Link>
            <span
              style={{
                width: 30,
                height: 38,
                borderRadius: 5,
                flex: "none",
                background: context.spine || "linear-gradient(160deg,#6366f1,#7c3aed)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {context.title}
              </div>
              {context.meta && (
                <div style={{ fontSize: 12.5, color: "#9aa1b1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {context.meta}
                </div>
              )}
            </div>
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 99,
                fontSize: 12.5,
                fontWeight: 700,
                background: "var(--pri-soft)",
                color: "var(--pri)",
                flex: "none",
              }}
            >
              {context.moduleLabel}
            </span>
            <div style={{ flex: 1 }} />
            {context.savedLabel && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#16a34a", fontWeight: 600, flex: "none" }}>
                <Icon name="check" size={16} sw={2.4} style={{ color: "#16a34a" }} />
                {context.savedLabel}
              </span>
            )}
          </div>
        )}

        {/* scroll area */}
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
