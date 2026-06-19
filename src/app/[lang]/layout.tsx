import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import SiteHeader from "@/components/SiteHeader";
import SiteChrome from "@/components/SiteChrome";
import ProjectBar from "@/components/ProjectBar";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "tipostudio",
  description:
    "Kapak, mizanpaj ve AI destekli editör — kitabını baştan sona profesyonelce hazırla.",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Kapak tuvalinin kullandığı yazı tipleri — gerçek (kanonik) adlarıyla
            yüklenir ki fabric.js metni doğru fontla çizebilsin. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Source Serif 4 ve Vollkorn BİLEREK çıkarıldı: globals.css'te yerel
            /fonts/*.ttf ile tanımlılar (PDF'in gömdüğü aynı dosyalar). Google'ın
            daha dar variable sürümü sayfalama/PDF metrik uyuşmazlığına yol açıyordu. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;600;800&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;600;700&family=Oswald:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Lora:wght@400;600;700&family=Merriweather:wght@400;700&family=EB+Garamond:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&family=Libre+Baskerville:wght@400;700&family=Bebas+Neue&family=Abril+Fatface&family=Cinzel:wght@400;600;700&family=Dancing+Script:wght@400;600;700&family=Great+Vibes&family=IBM+Plex+Mono:wght@400;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteChrome
          projectBar={<ProjectBar lang={lang} labels={dict.nav} />}
          header={<SiteHeader lang={lang} dict={dict} />}
          footer={
            <footer className="border-t border-border bg-surface">
              <div className="mx-auto max-w-6xl px-4 py-12">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Brand */}
                  <div className="lg:col-span-1">
                    <span className="font-sans text-xl font-extrabold lowercase tracking-tight">
                      {dict.brand}
                    </span>
                    <p className="mt-3 text-xs leading-relaxed text-muted">
                      {lang === "tr"
                        ? "Yazarlar için kapak, iç tasarım ve AI editör — hepsi tek yerde."
                        : "Cover, layout and AI editor for authors — all in one place."}
                    </p>
                  </div>

                  {/* Modüller */}
                  <div>
                    <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {lang === "tr" ? "Modüller" : "Modules"}
                    </div>
                    <ul className="space-y-2 text-sm">
                      {[
                        { href: `/${lang}/kapak`,       label: dict.nav.cover },
                        { href: `/${lang}/mizanpaj`,    label: dict.nav.layout },
                        { href: `/${lang}/editor`,      label: dict.nav.editor },
                        { href: `/${lang}/ekitap`,      label: dict.nav.publish },
                        { href: `/${lang}/sesli-kitap`, label: dict.nav.audiobook },
                        { href: `/${lang}/tanitim`,     label: dict.nav.promo },
                      ].map((l) => (
                        <li key={l.href}>
                          <a href={l.href} className="text-muted transition hover:text-foreground">
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Hesap */}
                  <div>
                    <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {lang === "tr" ? "Hesap" : "Account"}
                    </div>
                    <ul className="space-y-2 text-sm">
                      {[
                        { href: `/${lang}/giris`,  label: dict.nav.login },
                        { href: `/${lang}/kayit`,  label: dict.nav.signup },
                      ].map((l) => (
                        <li key={l.href}>
                          <a href={l.href} className="text-muted transition hover:text-foreground">
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Destek */}
                  <div>
                    <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {lang === "tr" ? "Destek" : "Support"}
                    </div>
                    <ul className="space-y-2 text-sm text-muted">
                      <li>KDP &amp; KDY {lang === "tr" ? "uyumlu" : "compatible"}</li>
                      <li>300 DPI {lang === "tr" ? "baskı çıkışı" : "print output"}</li>
                      <li>{lang === "tr" ? "ISBN barkod otomatik" : "Auto ISBN barcode"}</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
                  <p className="text-xs text-muted">
                    © 2025 {dict.brand}. {lang === "tr" ? "Tüm hakları saklıdır." : "All rights reserved."}
                  </p>
                  <p className="text-xs text-muted">
                    {lang === "tr"
                      ? "KDP ve KDY uyumlu baskıya hazır çıkışlar"
                      : "Print-ready output compatible with KDP & KDY"}
                  </p>
                </div>
              </div>
            </footer>
          }
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
