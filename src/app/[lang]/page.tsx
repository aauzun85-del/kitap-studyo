import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/supabase/user";
import {
  PaletteIcon,
  LayoutIcon,
  MagicWandIcon,
  BookIcon,
  HeadphonesIcon,
  MegaphoneIcon,
} from "@/components/PhosphorIcons";
import PackageCards from "@/components/marketing/PackageCards";

const moduleIcons = {
  cover: PaletteIcon,
  layout: LayoutIcon,
  editor: MagicWandIcon,
  publish: BookIcon,
  audiobook: HeadphonesIcon,
  promo: MegaphoneIcon,
};

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Giriş yapmış kullanıcı siteye girince pazarlama sayfası yerine doğrudan
  // Pano'ya (kontrol paneli + Kitap Tasarım Sihirbazı) gider.
  const user = await getCurrentUser();
  if (user) redirect(`/${lang}/projeler`);

  const dict = getDictionary(lang);

  const isTr = lang === "tr";

  const cards = [
    { key: "cover" as const,     href: `/${lang}/kapak`,      copy: dict.modules.cover },
    { key: "layout" as const,    href: `/${lang}/mizanpaj`,   copy: dict.modules.layout },
    { key: "editor" as const,    href: `/${lang}/editor`,     copy: dict.modules.editor },
    { key: "publish" as const,   href: `/${lang}/ekitap`,     copy: dict.modules.publish },
    { key: "audiobook" as const, href: `/${lang}/sesli-kitap`,copy: dict.modules.audiobook },
    { key: "promo" as const,     href: `/${lang}/tanitim`,    copy: dict.modules.promo },
  ];

  return (
    <div>

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 rounded-full blur-[140px]"
          style={{
            width: 900,
            height: 600,
            background:
              "radial-gradient(ellipse, color-mix(in srgb, var(--color-accent) 15%, transparent), transparent 70%)",
          }}
        />

        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">

            {/* LEFT – text */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wide text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                {dict.home.badge}
              </span>

              <h1 className="mt-5 font-sans text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                {dict.home.title}
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                {dict.home.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/${lang}/editor`}
                  className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)",
                    boxShadow: "0 4px 20px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                  }}
                >
                  {dict.modules.editor.cta} <span>→</span>
                </Link>
                <Link
                  href={`/${lang}/kapak`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-7 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-foreground/30"
                >
                  {dict.modules.cover.cta}
                </Link>
              </div>

              {/* Stats strip */}
              <div className="mt-12 flex gap-10 border-t border-border pt-8">
                {[
                  { value: "6",              label: isTr ? "Modül" : "Modules" },
                  { value: "300 DPI",        label: isTr ? "Baskı kalitesi" : "Print quality" },
                  { value: "₺0", label: isTr ? "Üyelik" : "Membership" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-extrabold">{s.value}</div>
                    <div className="mt-0.5 text-xs text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT – editor mockup */}
            <div className="hidden lg:flex items-center justify-center relative">
              {/* Glow behind card */}
              <div
                className="absolute inset-0 rounded-3xl blur-3xl"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 70%)",
                }}
              />

              {/* Card */}
              <div
                className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
                style={{ transform: "perspective(1100px) rotateY(-6deg) rotateX(3deg)" }}
              >
                {/* Browser chrome */}
                <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                  <span className="mx-2 flex-1 rounded bg-border" style={{ height: 14 }} />
                  <span className="font-mono text-[9px] text-muted">laycoty.com</span>
                </div>

                {/* Panel tabs */}
                <div className="flex border-b border-border bg-background">
                  {(isTr ? ["Şablon", "AI", "Metin", "Ayar"] : ["Template", "AI", "Text", "Settings"]).map((tab, i) => (
                    <div
                      key={tab}
                      className={`flex-1 py-1.5 text-center font-mono text-[9px] font-semibold ${
                        i === 1
                          ? "border-b-2 border-accent text-accent"
                          : "text-muted"
                      }`}
                    >
                      {tab}
                    </div>
                  ))}
                </div>

                {/* Canvas – book spread */}
                <div className="p-3" style={{ background: "#181818" }}>
                  <div className="flex overflow-hidden rounded" style={{ height: 158 }}>
                    {/* Back cover */}
                    <div
                      className="flex flex-1 flex-col justify-between p-2"
                      style={{
                        background: "linear-gradient(135deg,#1a1a2e,#16213e)",
                      }}
                    >
                      <div className="space-y-1">
                        <div className="h-1 w-8 rounded bg-accent/70" />
                        <div className="h-1.5 w-16 rounded bg-white/80" />
                        <div className="h-1 w-12 rounded bg-white/40" />
                      </div>
                      <div className="space-y-0.5">
                        {[1, 0.8, 0.7, 0.6, 0.8, 0.5].map((o, i) => (
                          <div
                            key={i}
                            className="h-0.5 rounded bg-white"
                            style={{ opacity: o, width: `${58 + i * 6}%` }}
                          />
                        ))}
                      </div>
                      {/* Mini barcode */}
                      <div className="self-end rounded bg-white p-1" style={{ width: 36 }}>
                        {[100, 60, 85, 50, 90].map((w, i) => (
                          <div
                            key={i}
                            className="mb-0.5 bg-gray-800"
                            style={{ height: 1.5, width: `${w}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Spine */}
                    <div
                      className="flex w-3.5 flex-shrink-0 items-center justify-center"
                      style={{ background: "var(--color-accent)" }}
                    >
                      <div className="h-12 w-px rounded bg-white/30" />
                    </div>

                    {/* Front cover */}
                    <div
                      className="flex flex-1 flex-col items-center justify-center gap-1.5 p-2"
                      style={{
                        background: "linear-gradient(145deg, var(--color-accent), #7c3aed)",
                      }}
                    >
                      <div className="h-1 w-16 rounded bg-white/50" />
                      <div className="h-3 w-20 rounded bg-white" />
                      <div className="h-2 w-16 rounded bg-white/70" />
                      <div
                        className="mt-1 rounded border border-white/20"
                        style={{ height: 36, width: 72, background: "rgba(255,255,255,0.12)" }}
                      />
                      <div className="h-1 w-10 rounded bg-white/50 mt-1" />
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div className="flex items-center justify-between border-t border-border bg-background px-3 py-2">
                  <span className="font-mono text-[8px] text-muted">
                    {isTr ? "135×210 mm · 200 sayfa" : "135×210 mm · 200 pages"}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 font-mono text-[8px] font-bold text-white"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {isTr ? "PDF İndir" : "Export PDF"}
                  </span>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-3 -right-3 flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold shadow-lg">
                <span className="text-green-500">✓</span>
                {isTr ? "Baskıya hazır" : "Print ready"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. MODULES ──────────────────────────────────────────────── */}
      <section className="pb-8 mx-auto max-w-6xl px-4">
        <h2 className="mb-8 text-center font-mono text-sm font-medium uppercase tracking-[0.2em] text-muted">
          {dict.home.modulesHeading}
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, href, copy }) => {
            const Icon = moduleIcons[key];
            return (
              <Link
                key={key}
                href={href}
                className="group flex flex-col rounded-2xl border border-border bg-surface p-7 transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/8"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </span>
                </div>
                <h3 className="mt-5 font-sans text-2xl font-extrabold">{copy.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {copy.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  {copy.cta}
                  <span className="transition-transform duration-200 group-hover:translate-x-1.5">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────── */}
      <section className="py-20 mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center font-sans text-3xl font-extrabold">
          {dict.home.flowHeading}
        </h2>
        <ol className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
          {dict.home.flow.map((step, i) => (
            <li
              key={i}
              className="group flex flex-1 flex-col gap-3 rounded-xl border border-border bg-surface p-5 text-sm transition-all duration-200 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                style={{
                  background: "var(--color-accent)",
                  boxShadow: "0 2px 10px color-mix(in srgb, var(--color-accent) 40%, transparent)",
                }}
              >
                {i + 1}
              </span>
              <span className="font-medium text-foreground/80">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 4. PRICING ──────────────────────────────────────────────── */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-10 text-center">
            <span className="mb-4 inline-block rounded-full border border-accent/30 bg-accent-soft px-3 py-1 font-mono text-xs font-medium uppercase tracking-wide text-accent">
              {isTr ? "Fiyatlar" : "Pricing"}
            </span>
            <h2 className="font-sans text-3xl font-extrabold">
              {isTr ? "Abonelik yok, sürpriz yok" : "No subscription, no surprises"}
            </h2>
            <p className="mt-3 text-muted">
              {isTr
                ? "Paketi bir kez al, 30 gün kullan. Kendiliğinden yenilenmez."
                : "Buy a package once and use it for 30 days. It never auto-renews."}
            </p>
          </div>
          <PackageCards lang={lang} />
          <div className="mt-4 text-center">
            <Link href={`/${lang}/fiyatlar`} className="text-sm font-semibold text-accent hover:underline">
              {isTr ? "Jetonlar nereye harcanır? Ayrıntılı fiyatlar →" : "What do credits pay for? Full pricing →"}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. BOTTOM CTA ───────────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-3xl blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%)",
            }}
          />
          <h2 className="font-sans text-4xl font-extrabold leading-tight sm:text-5xl">
            {isTr
              ? "Kitabını bugün hazırlamaya başla"
              : "Start preparing your book today"}
          </h2>
          <p className="mt-5 text-lg text-muted">
            {isTr
              ? "Üye olmak ücretsiz; tüm araçları hemen deneyebilirsin."
              : "Membership is free; try every tool right away."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/${lang}/kayit`}
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)",
                boxShadow: "0 6px 24px color-mix(in srgb, var(--color-accent) 40%, transparent)",
              }}
            >
              {isTr ? "Ücretsiz hesap aç" : "Create free account"} →
            </Link>
            <Link
              href={`/${lang}/fiyatlar`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-8 py-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-foreground/30"
            >
              {isTr ? "Paketleri gör" : "See packages"}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
