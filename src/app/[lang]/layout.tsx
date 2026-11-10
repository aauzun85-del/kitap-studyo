import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import SiteHeader from "@/components/SiteHeader";
import SiteChrome from "@/components/SiteChrome";
import SiteFooter from "@/components/SiteFooter";
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

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const en = lang === "en";
  return {
    metadataBase: new URL("https://laycoty.com"),
    title: {
      default: en ? "Laycoty — Cover, layout and AI editor" : "Laycoty — Kapak, mizanpaj ve AI editör",
      template: "%s · Laycoty",
    },
    description: en
      ? "Cover, layout and AI-assisted editor — prepare your book professionally from start to finish."
      : "Kapak, mizanpaj ve AI destekli editör — kitabını baştan sona profesyonelce hazırla.",
  };
}

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
          footer={<SiteFooter lang={lang} dict={dict} />}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
