import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import PackageCards from "@/components/marketing/PackageCards";
import { PACKAGE_VALIDITY_DAYS, WELCOME_CREDITS } from "@/lib/credits/pricing";
import {
  BookIcon,
  HeadphonesIcon,
  LayoutIcon,
  MagicWandIcon,
  MegaphoneIcon,
  PaletteIcon,
} from "@/components/PhosphorIcons";

// Tanıtım (ana) sayfası. Sunucu bileşeni; metinler burada (sözlüğe eklenmedi →
// öteki çalışmalarla çakışmasın). Renkler: sayfaya özel mor (--lp), gerisi
// sitenin ortak tonları. Ekran maketi görsel değil HTML'dir: her genişlikte
// keskin kalır ve ürünün gerçek ekranındaki alanları gösterir.

const COPY = {
  tr: {
    eyebrow: "Yazarlar ve yayınevleri için",
    h1a: "Metninden kitabına.",
    h1b: "Her adım tek yerde.",
    sub: "Metnini gözden geçir, iç sayfalarını düzenle ve kapağını tasarla. Kitabının dosyalarını tek çalışma alanında hazırla.",
    ctaStart: "Kitabını oluşturmaya başla",
    ctaHow: "Nasıl çalışır?",
    chips: ["AI Editör", "Mizanpaj", "Kapak tasarımı"],
    mock: {
      title: "Bir Şehrin Hafızası",
      author: "Deniz Aras",
      saved: "Kaydedildi",
      export: "İndir",
      rail: ["Kapak", "Mizanpaj", "AI Editör", "E-kitap"],
      chapterNo: "I. BÖLÜM",
      chapter: "Şehrin Eşiğinde",
      p1: "ehir, her gelişimde bana aynı duyguyu yaşatıyordu: Tanıdık bir yere dönmenin rahatlığı ile uzun zamandır görmediğin bir dosta rastlamanın hafif tedirginliği. Sokaklar, binalar, meydanlar yerli yerindeydi; ama yine de her seferinde biraz değişmiş gibiydiler.",
      p2: "Bu kez şehrin hafızasını daha yakından dinlemeye karar verdim. Çünkü bazı şehirler yalnızca taştan ve yapıdan ibaret değildir; onlar, içinde yaşayan insanların hikâyeleriyle var olur.",
      p3: "Eski çarşının taş döşeli yolunda yürürken çocukluğumun sesleri birer birer geri geldi. Fırından yayılan ekmek kokusu, küçük bir sahafın tozlu kitapları, meydanda güvercinlere yem atan yaşlı adam… Hepsi, şehrin uzun zamandır biriktirdiği hikâyelerin parçasıydı.",
      p4: "Belki de bir şehri gerçekten anlamak, onun hafızasında iz bırakan küçük ayrıntılara dikkat etmekle başlıyordu. Büyük olaylar, anıtlar ve tarihî yapılar kadar sıradan insanların gündelik hayatı da bu hafızanın değerli parçalarıydı.",
      p5: "O gün, not defterime yalnızca gördüklerimi değil, hissettiklerimi de yazmaya başladım.",
      panel: "Yazı düzeni",
      font: "Yazı karakteri",
      size: "Punto",
      leading: "Satır aralığı",
      align: "Metin hizalama",
      apply: "Tüm kitaba uygula",
      coverAlt: "Örnek kitap kapağı: Bir Şehrin Hafızası, Deniz Aras",
    },
    toolsTitle: "Bir kitap. Birbirini tamamlayan üç araç.",
    tools: [
      {
        title: "Metnini güçlendir",
        text: "Yazım, üslup ve tutarlılık önerilerini incele; değişikliklere sen karar ver.",
      },
      {
        title: "Sayfalarını düzenle",
        text: "Yazı karakterinden bölüm başlıklarına, kitabının iç tasarımını oluştur.",
      },
      {
        title: "Kapağını tasarla",
        text: "Ön kapağı, sırtı ve arka kapağı birlikte tasarla.",
      },
    ],
    editorBefore: "Şehir, bana ",
    editorWrong: "hergelişimde",
    editorAfter: " aynı duyguyu yaşatıyordu.",
    suggestion: "Öneri:",
    suggestionText: "her gelişimde",
    backBlurb:
      "Bir şehrin sokaklarında, çarşılarında ve insanlarında saklı hikâyelerin izini süren bir anlatı.",
    alsoTitle: "Kitabın hazır olunca",
    also: [
      { title: "E-kitap", text: "Kitabını EPUB olarak hazırla." },
      { title: "Sesli kitap", text: "Metnini seslendir, bölüm bölüm dinle." },
      { title: "Tanıtım", text: "Arka kapak yazısı, sosyal medya metinleri ve tanıtım görseli üret." },
    ],
    howTitle: "Nasıl çalışır?",
    how: [
      { title: "Kitabını oluştur", text: "Kitabının adını gir ve metnini yükleyerek çalışmaya başla." },
      {
        title: "Metin, mizanpaj ve kapağı hazırla",
        text: "Metnini gözden geçir, iç sayfalarını düzenle ve kapağını tasarla.",
      },
      { title: "Dosyalarını indir", text: "Hazırladığın kitabın baskıya veya yayına uygun dosyalarını indir." },
    ],
    pricingBadge: "Fiyatlandırma",
    pricingTitle: "Abonelik yok, sürpriz yok",
    pricingSub: `Paketi bir kez al, ${PACKAGE_VALIDITY_DAYS} gün kullan. Kendiliğinden yenilenmez.`,
    pricingMore: "Jetonlar nereye harcanır? Ayrıntılı fiyatlar →",
    finalTitle: "İlk sayfadan arka kapağa.",
    finalSub: `Üye olmak ücretsiz; ${WELCOME_CREDITS} hoş geldin jetonuyla hemen başlarsın. Dosya indirmek için paket gerekir.`,
    finalCta: "Kitabını oluştur",
    finalAlt: "Paketleri gör",
  },
  en: {
    eyebrow: "For authors and publishers",
    h1a: "From manuscript to book.",
    h1b: "Every step in one place.",
    sub: "Review your text, lay out your pages and design your cover. Prepare your book's files in a single workspace.",
    ctaStart: "Start creating your book",
    ctaHow: "How does it work?",
    chips: ["AI Editor", "Layout", "Cover design"],
    mock: {
      title: "Bir Şehrin Hafızası",
      author: "Deniz Aras",
      saved: "Saved",
      export: "Download",
      rail: ["Cover", "Layout", "AI Editor", "E-book"],
      chapterNo: "CHAPTER I",
      chapter: "At the City's Threshold",
      p1: "he city gave me the same feeling every time I arrived: the ease of returning to a familiar place, and the faint unease of meeting a friend you have not seen for years. The streets, the buildings, the squares were all where I had left them; and yet each time they seemed a little changed.",
      p2: "This time I decided to listen to the city's memory more closely. Some cities are not made of stone and structure alone; they exist through the stories of the people who live in them.",
      p3: "As I walked the cobbled lane of the old market, the sounds of my childhood came back one by one. The smell of bread from the bakery, the dusty books of a small second-hand shop, the old man feeding pigeons in the square… All of it belonged to the stories the city had been gathering for so long.",
      p4: "Perhaps truly understanding a city began with noticing the small details that left a mark on its memory. The everyday lives of ordinary people were as much a part of that memory as great events, monuments and historic buildings.",
      p5: "That day I began to write in my notebook not only what I saw, but what I felt.",
      panel: "Typography",
      font: "Typeface",
      size: "Size",
      leading: "Line spacing",
      align: "Text alignment",
      apply: "Apply to whole book",
      coverAlt: "Sample book cover: Bir Şehrin Hafızası by Deniz Aras",
    },
    toolsTitle: "One book. Three tools that complete each other.",
    tools: [
      {
        title: "Strengthen your text",
        text: "Review spelling, style and consistency suggestions; you decide on every change.",
      },
      {
        title: "Lay out your pages",
        text: "From the typeface to chapter headings, shape your book's interior design.",
      },
      {
        title: "Design your cover",
        text: "Work on the front cover, spine and back cover together.",
      },
    ],
    editorBefore: "The city gave me the same feeling ",
    editorWrong: "everytime",
    editorAfter: " I arrived.",
    suggestion: "Suggestion:",
    suggestionText: "every time",
    backBlurb:
      "A narrative that follows the stories hidden in a city's streets, markets and people.",
    alsoTitle: "Once your book is ready",
    also: [
      { title: "E-book", text: "Prepare your book as an EPUB." },
      { title: "Audiobook", text: "Narrate your text and listen chapter by chapter." },
      { title: "Promotion", text: "Generate back-cover copy, social posts and a promo image." },
    ],
    howTitle: "How does it work?",
    how: [
      { title: "Create your book", text: "Enter your book's title and upload your text to get started." },
      {
        title: "Prepare text, layout and cover",
        text: "Review your text, lay out your pages and design your cover.",
      },
      { title: "Download your files", text: "Download files of your book that are ready for print or publishing." },
    ],
    pricingBadge: "Pricing",
    pricingTitle: "No subscription, no surprises",
    pricingSub: `Get a package once and use it for ${PACKAGE_VALIDITY_DAYS} days. It never auto-renews.`,
    pricingMore: "What do credits pay for? Full pricing →",
    finalTitle: "From the first page to the back cover.",
    finalSub: `Membership is free; you start right away with ${WELCOME_CREDITS} welcome credits. Downloading files needs a package.`,
    finalCta: "Create your book",
    finalAlt: "See packages",
  },
} as const;

const SERIF = '"EB Garamond", "Source Serif 4", Georgia, serif';
// Kitap sayfaları her temada kâğıt rengidir (koyu temada da).
const PAPER = "#fdfcf9";
const INK = "#26232b";

const LANDING_CSS = `
.lp { --lp: #6a3de8; --lp-btn: #6a3de8; --lp-soft: #f1ecfe; --lp-line: #ddd3fb; }
@media (prefers-color-scheme: dark) {
  .lp { --lp: #a78bfa; --lp-btn: #6d4fe6; --lp-soft: #2a2350; --lp-line: #3d3470; }
}
.lp-spread { container-type: inline-size; }
.lp-page { font-size: 1.76cqw; line-height: 1.5; }
.lp-book { transform: perspective(1400px) rotateY(-24deg) rotateX(3deg); transform-origin: left center; }
`;

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.2v7.6l6-3.8-6-3.8Z" fill="currentColor" />
    </svg>
  );
}

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.6, background: "var(--lp-btn)" }}
      aria-hidden="true"
    >
      L
    </span>
  );
}

/** Kitabın iki sayfası (I. bölüm açılışı). Yazı boyu kabın genişliğine bağlıdır.
 *  Giriş/kayıt ekranının sağ panelinde de kullanılır (AuthCard). */
export function Spread({ m }: { m: (typeof COPY)[Locale]["mock"] }) {
  const page = "lp-page relative flex-1 px-[7%] pb-[9%] pt-[11%]";
  const para = "text-justify [hyphens:auto] indent-[1.4em]";
  return (
    <div className="lp-spread w-full">
      <div
        className="flex aspect-[1.42/1] w-full overflow-hidden rounded-[3px] shadow-[0_10px_30px_rgba(40,30,80,0.14)]"
        style={{ background: PAPER, color: INK, fontFamily: SERIF }}
      >
        <div className={page}>
          <p className="text-center text-[0.72em] tracking-[0.18em]">{m.chapterNo}</p>
          <p className="mb-[9%] mt-[7%] text-center text-[1.5em] italic leading-tight">{m.chapter}</p>
          <p className="text-justify [hyphens:auto]">
            <span className="float-left mr-[0.08em] mt-[0.06em] text-[3.1em] leading-[0.8]">
              {m.chapterNo.startsWith("I.") ? "Ş" : "T"}
            </span>
            {m.p1}
          </p>
          <p className={para}>{m.p2}</p>
          <span className="absolute inset-x-0 bottom-[4.5%] text-center text-[0.8em]">12</span>
        </div>
        <div
          className={page}
          style={{ boxShadow: "inset 14px 0 18px -14px rgba(40,30,60,0.28)" }}
        >
          <p className={para}>{m.p3}</p>
          <p className={para}>{m.p4}</p>
          <p className={para}>{m.p5}</p>
          <span className="absolute inset-x-0 bottom-[4.5%] text-center text-[0.8em]">13</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium text-muted">{label}</div>
      <div className="flex items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold">
        {value}
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-muted" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function AlignGlyph({ kind, active }: { kind: 0 | 1 | 2 | 3; active?: boolean }) {
  // 0 sola, 1 orta, 2 sağa, 3 iki yana
  const widths = kind === 3 ? [14, 14, 14, 14] : [14, 9, 12, 7];
  const x = (w: number) => (kind === 1 ? (14 - w) / 2 : kind === 2 ? 14 - w : 0);
  return (
    <span
      className="flex h-7 flex-1 items-center justify-center rounded-md border"
      style={
        active
          ? { background: "var(--lp-soft)", borderColor: "var(--lp-line)", color: "var(--lp)" }
          : { borderColor: "var(--color-border)", color: "var(--color-muted)" }
      }
    >
      <svg viewBox="0 0 14 12" className="h-3 w-3.5" aria-hidden="true">
        {widths.map((w, i) => (
          <rect key={i} x={x(w)} y={i * 3 + 0.5} width={w} height="1.4" rx="0.7" fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}

/** Ürün ekranı maketi: üst çubuk + sol araçlar + kitap sayfaları + yazı paneli. */
function ProductMock({ m }: { m: (typeof COPY)[Locale]["mock"] }) {
  const railIcons = [PaletteIcon, LayoutIcon, MagicWandIcon, BookIcon];
  return (
    <div className="relative mx-auto w-full max-w-5xl" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgba(70,40,160,0.28)]">
        {/* pencere çubuğu */}
        <div className="flex items-center gap-1.5 border-b border-border bg-background px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        {/* uygulama üst çubuğu */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-5">
          <span className="flex items-center gap-2">
            <LogoMark />
            <span className="hidden text-sm font-extrabold lowercase tracking-tight sm:inline">laycoty</span>
          </span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="truncate text-xs font-bold sm:text-sm">{m.title}</span>
          <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {m.saved}
          </span>
          <span
            className="ml-auto whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-bold text-white sm:text-xs"
            style={{ background: "var(--lp-btn)" }}
          >
            {m.export}
          </span>
        </div>
        <div className="flex bg-background">
          {/* sol araç çubuğu */}
          <div className="hidden w-[76px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 md:flex">
            {m.rail.map((label, i) => {
              const Icon = railIcons[i];
              return (
                <span
                  key={label}
                  className="flex flex-col items-center gap-1 rounded-lg py-2.5 text-[10px] font-semibold"
                  style={
                    i === 1
                      ? { background: "var(--lp-soft)", color: "var(--lp)" }
                      : { color: "var(--color-muted)" }
                  }
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </span>
              );
            })}
          </div>
          {/* kitap sayfaları */}
          <div className="min-w-0 flex-1 p-3 sm:p-6">
            <Spread m={m} />
            <div className="mt-3 hidden items-center justify-center gap-4 text-[11px] font-semibold text-muted sm:flex">
              <span>‹</span>
              <span>12 – 13</span>
              <span>›</span>
            </div>
          </div>
          {/* yazı düzeni paneli */}
          <div className="hidden w-[200px] shrink-0 flex-col gap-3 border-l border-border bg-surface p-4 lg:flex">
            <div className="text-sm font-extrabold">{m.panel}</div>
            <Field label={m.font} value="EB Garamond" />
            <div className="grid grid-cols-2 gap-2">
              <Field label={m.size} value="11" />
              <Field label={m.leading} value="14,5" />
            </div>
            <div>
              <div className="mb-1 text-[10px] font-medium text-muted">{m.align}</div>
              <div className="flex gap-1.5">
                <AlignGlyph kind={0} />
                <AlignGlyph kind={3} active />
              </div>
            </div>
            <span
              className="mt-1 rounded-lg py-2 text-center text-xs font-bold text-white"
              style={{ background: "var(--lp-btn)" }}
            >
              {m.apply}
            </span>
          </div>
        </div>
      </div>

      {/* basılmış kitap: maketin sağ alt köşesine oturur */}
      <div className="pointer-events-none absolute -bottom-[17%] right-2 w-[21%] min-w-[84px] max-w-[230px] sm:right-4 lg:-bottom-16 lg:right-3 lg:max-w-[190px] xl:-bottom-14 xl:-right-6 xl:max-w-[230px]">
        <div className="lp-book relative">
          <span
            className="absolute inset-y-0 -left-[9%] w-[9%] origin-right"
            style={{
              background: "linear-gradient(90deg, #cfc6b3, #e9e2d2)",
              transform: "rotateY(62deg)",
            }}
          />
          <Image
            src="/landing/kapak-ornek.jpg"
            alt=""
            width={800}
            height={1182}
            sizes="(max-width: 640px) 25vw, 230px"
            preload
            className="block h-auto w-full rounded-r-[3px] shadow-[18px_24px_40px_-12px_rgba(40,25,90,0.45)]"
          />
          <span className="absolute inset-y-0 left-0 w-[3%] bg-gradient-to-r from-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

/** Araç kartlarının içindeki küçük önizleme çerçevesi. */
function Preview({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex min-h-[190px] items-center justify-center rounded-2xl border border-border bg-surface p-5 shadow-[0_12px_30px_-18px_rgba(70,40,160,0.35)]">
      {children}
    </div>
  );
}

/** Örnek kitabın metinleri (giriş/kayıt ekranındaki maket için). */
export function landingMock(lang: Locale) {
  return COPY[lang].mock;
}

export default function Landing({ lang }: { lang: Locale }) {
  const c = COPY[lang];
  const m = c.mock;
  // Sayfayı yalnız giriş yapmamış ziyaretçi görür; araç sayfaları giriş ister →
  // kartlar kayıt sayfasına götürür (Tanıtım herkese açık).
  const signup = `/${lang}/kayit`;
  const toolHrefs = [signup, signup, signup];
  const alsoMeta = [
    { href: signup, Icon: LayoutIcon },
    { href: signup, Icon: HeadphonesIcon },
    { href: `/${lang}/tanitim`, Icon: MegaphoneIcon },
  ];
  const primaryBtn =
    "inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold text-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="lp bg-surface">
      <style>{LANDING_CSS}</style>

      {/* ── 1. GİRİŞ ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -left-40 top-24 h-[420px] w-[420px] rounded-full"
          style={{ background: "var(--lp-soft)", opacity: 0.7 }}
        />
        <div
          className="pointer-events-none absolute -right-48 top-[46%] h-[520px] w-[520px] rounded-full"
          style={{ background: "var(--lp-soft)", opacity: 0.7 }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-14 sm:pb-40 sm:pt-20 lg:pb-36">
          <div className="text-center">
            <p
              className="flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.14em] sm:text-sm"
              style={{ color: "var(--lp)" }}
            >
              <span className="h-px w-8 sm:w-10" style={{ background: "var(--lp-line)" }} />
              {c.eyebrow}
              <span className="h-px w-8 sm:w-10" style={{ background: "var(--lp-line)" }} />
            </p>
            <h1 className="mt-5 text-balance font-sans text-[2.6rem] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl xl:text-7xl">
              {c.h1a}
              <br />
              <span style={{ color: "var(--lp)" }}>{c.h1b}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-foreground/75 sm:text-xl">
              {c.sub}
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href={`/${lang}/kayit`}
                className={primaryBtn}
                style={{
                  background: "var(--lp-btn)",
                  boxShadow: "0 10px 26px -8px color-mix(in srgb, var(--lp-btn) 65%, transparent)",
                  outlineColor: "var(--lp)",
                }}
              >
                {c.ctaStart} <Arrow />
              </Link>
              <a
                href="#nasil-calisir"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl border-2 bg-surface px-7 py-3 text-base font-bold transition hover:-translate-y-0.5"
                style={{ borderColor: "var(--lp)", color: "var(--color-foreground)" }}
              >
                <span style={{ color: "var(--lp)" }}>
                  <PlayIcon />
                </span>
                {c.ctaHow}
              </a>
            </div>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted">
              {c.chips.map((chip, i) => (
                <span key={chip} className="flex items-center gap-3">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {chip}
                </span>
              ))}
            </p>
          </div>

          <div className="mt-12 sm:mt-14">
            <ProductMock m={m} />
            <p className="sr-only">{m.coverAlt}</p>
          </div>
        </div>
      </section>

      {/* ── 2. ÜÇ ARAÇ ───────────────────────────────────────────────── */}
      <section id="ozellikler" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-balance text-center font-sans text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            {c.toolsTitle}
          </h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border">
            {/* Metin */}
            <Link href={toolHrefs[0]} className="group block lg:px-7 lg:first:pl-0">
              <h3 className="font-sans text-xl font-extrabold tracking-tight">{c.tools[0].title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">{c.tools[0].text}</p>
              <Preview>
                <div className="w-full">
                  <p className="text-[19px] leading-relaxed" style={{ fontFamily: SERIF }}>
                    {c.editorBefore}
                    <span className="rounded-sm bg-red-500/15 px-0.5 text-red-700 line-through decoration-red-500 dark:text-red-300">
                      {c.editorWrong}
                    </span>
                    {c.editorAfter}
                  </p>
                  <div
                    className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                    style={{ background: "var(--lp-soft)" }}
                  >
                    <span style={{ color: "var(--lp)" }}>
                      <MagicWandIcon className="h-4 w-4" />
                    </span>
                    <span>
                      <b>{c.suggestion}</b> {c.suggestionText}
                    </span>
                    <svg
                      viewBox="0 0 20 20"
                      className="ml-auto h-4 w-4"
                      fill="none"
                      stroke="var(--lp)"
                      strokeWidth="2.4"
                      aria-hidden="true"
                    >
                      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </Preview>
            </Link>

            {/* Mizanpaj */}
            <Link href={toolHrefs[1]} className="group block lg:px-7">
              <h3 className="font-sans text-xl font-extrabold tracking-tight">{c.tools[1].title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">{c.tools[1].text}</p>
              <Preview>
                <div
                  className="w-full max-w-[250px] rounded-[3px] px-6 pb-5 pt-6 shadow-[0_6px_18px_rgba(40,30,80,0.14)]"
                  style={{ background: PAPER, color: INK, fontFamily: SERIF }}
                >
                  <p className="text-center text-[10px] tracking-[0.18em]">{m.chapterNo}</p>
                  <p className="mb-4 mt-2.5 text-center text-xl italic leading-tight">{m.chapter}</p>
                  <p className="line-clamp-3 text-justify text-[13px] leading-snug">
                    <span className="float-left mr-1 text-[40px] leading-[0.8]">
                      {m.chapterNo.startsWith("I.") ? "Ş" : "T"}
                    </span>
                    {m.p1}
                  </p>
                </div>
              </Preview>
            </Link>

            {/* Kapak */}
            <Link href={toolHrefs[2]} className="group block lg:px-7 lg:last:pr-0">
              <h3 className="font-sans text-xl font-extrabold tracking-tight">{c.tools[2].title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/75">{c.tools[2].text}</p>
              <Preview>
                {/* arka kapak + sırt + ön kapak (açık kapak) */}
                <div className="flex w-full max-w-[290px] overflow-hidden rounded-[3px] shadow-[0_6px_18px_rgba(40,30,80,0.18)]">
                  <div
                    className="flex flex-1 flex-col justify-between p-3"
                    style={{ background: "#ece5d5", color: INK, fontFamily: SERIF }}
                  >
                    <p className="text-[8.5px] leading-snug">{c.backBlurb}</p>
                    <span className="flex h-5 w-9 items-end gap-px self-end bg-white p-0.5">
                      {[3, 1, 2, 1, 3, 2, 1, 2, 3, 1].map((w, i) => (
                        <span key={i} className="h-full bg-neutral-900" style={{ width: w }} />
                      ))}
                    </span>
                  </div>
                  <div
                    className="flex w-[7%] items-center justify-center"
                    style={{ background: "#e2dac7", color: INK, fontFamily: SERIF }}
                  >
                    <span className="whitespace-nowrap text-[6px] tracking-[0.12em] [writing-mode:vertical-rl]">
                      BİR ŞEHRİN HAFIZASI
                    </span>
                  </div>
                  <Image
                    src="/landing/kapak-ornek.jpg"
                    alt={m.coverAlt}
                    width={800}
                    height={1182}
                    sizes="150px"
                    className="block h-auto w-[46.5%]"
                  />
                </div>
              </Preview>
            </Link>
          </div>

          {/* öteki modüller: kaybolmasın, ama geri planda */}
          <div className="mt-14 rounded-2xl border border-border bg-background px-5 py-5 sm:px-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{c.alsoTitle}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {c.also.map((a, i) => {
                const { href, Icon } = alsoMeta[i];
                return (
                  <Link key={a.title} href={href} className="group flex items-start gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--lp-soft)", color: "var(--lp)" }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-extrabold group-hover:underline">{a.title}</span>
                      <span className="block text-sm text-muted">{a.text}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. NASIL ÇALIŞIR ─────────────────────────────────────────── */}
      <section
        id="nasil-calisir"
        className="scroll-mt-20"
        style={{ background: "color-mix(in srgb, var(--lp-soft) 55%, var(--color-surface))" }}
      >
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-center font-sans text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            {c.howTitle}
          </h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {c.how.map((step, i) => (
              <li key={step.title} className="relative flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold"
                  style={{ background: "var(--lp-soft)", color: "var(--lp)", border: "1px solid var(--lp-line)" }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-sans text-lg font-extrabold leading-snug tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-foreground/75">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 4. FİYATLANDIRMA ─────────────────────────────────────────── */}
      <section id="fiyatlandirma" className="scroll-mt-20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--lp)" }}>
              {c.pricingBadge}
            </p>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              {c.pricingTitle}
            </h2>
            <p className="mt-3 text-foreground/75">{c.pricingSub}</p>
          </div>
          <PackageCards lang={lang} />
          <div className="mt-5 text-center">
            <Link
              href={`/${lang}/fiyatlar`}
              className="text-sm font-bold hover:underline"
              style={{ color: "var(--lp)" }}
            >
              {c.pricingMore}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. KAPANIŞ ───────────────────────────────────────────────── */}
      <section className="px-4 pb-16 sm:pb-20">
        <div
          className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-3xl px-6 py-10 sm:px-12 sm:py-12 lg:flex-row lg:items-center lg:justify-between"
          style={{ background: "var(--lp-soft)", border: "1px solid var(--lp-line)" }}
        >
          <div className="max-w-2xl">
            <h2 className="font-sans text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{c.finalTitle}</h2>
            <p className="mt-3 text-base leading-relaxed text-foreground/75">{c.finalSub}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
            <Link
              href={`/${lang}/kayit`}
              className={primaryBtn}
              style={{ background: "var(--lp-btn)", outlineColor: "var(--lp)" }}
            >
              {c.finalCta} <Arrow />
            </Link>
            <Link
              href={`/${lang}/fiyatlar`}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-7 py-3.5 text-base font-bold transition hover:-translate-y-0.5"
            >
              {c.finalAlt}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
