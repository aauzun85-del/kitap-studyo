import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { COMPANY } from "@/lib/legal/company";
import { LEGAL_DOCS } from "@/lib/legal/documents";

// Pazarlama sayfalarının alt bilgisi. Şirket künyesi + kurumsal/yasal
// bağlantılar burada: ödeme kuruluşları siteyi incelerken ilk buraya bakar.
export default function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const tr = lang === "tr";
  const heading = "mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted";
  const link = "text-muted transition hover:text-foreground";

  const columns = [
    {
      title: tr ? "Modüller" : "Modules",
      links: [
        { href: `/${lang}/kapak`, label: dict.nav.cover },
        { href: `/${lang}/mizanpaj`, label: dict.nav.layout },
        { href: `/${lang}/editor`, label: dict.nav.editor },
        { href: `/${lang}/ekitap`, label: dict.nav.publish },
        { href: `/${lang}/sesli-kitap`, label: dict.nav.audiobook },
        { href: `/${lang}/tanitim`, label: dict.nav.promo },
      ],
    },
    {
      title: tr ? "Kurumsal" : "Company",
      links: [
        { href: `/${lang}/hakkimizda`, label: tr ? "Hakkımızda" : "About us" },
        { href: `/${lang}/fiyatlar`, label: tr ? "Fiyatlar" : "Pricing" },
        { href: `/${lang}/iletisim`, label: tr ? "İletişim" : "Contact" },
        { href: `/${lang}/islem-rehberi`, label: tr ? "İşlem Rehberi" : "How to order" },
        { href: `/${lang}/giris`, label: dict.nav.login },
        { href: `/${lang}/kayit`, label: dict.nav.signup },
      ],
    },
    {
      title: tr ? "Yasal" : "Legal",
      links: LEGAL_DOCS.map((d) => ({ href: `/${lang}/yasal/${d.slug}`, label: d.title[lang] })),
    },
  ];

  // Künye satırı: yalnız dolu alanlar.
  const imprint = [
    COMPANY.address,
    COMPANY.taxOffice && COMPANY.taxNumber
      ? `${COMPANY.taxOffice} V.D. ${COMPANY.taxNumber}`
      : "",
    COMPANY.mersis ? `MERSİS ${COMPANY.mersis}` : "",
    COMPANY.tradeRegistry,
    COMPANY.phone,
    COMPANY.email,
  ].filter(Boolean);

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr]">
          <div>
            <span className="font-sans text-xl font-extrabold lowercase tracking-tight">{dict.brand}</span>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {tr
                ? "Yazarlar ve yayınevleri için kapak, iç tasarım ve AI editör — hepsi tek yerde."
                : "Cover, layout and AI editor for authors and publishers — all in one place."}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {tr
                ? `${COMPANY.brand}, ${COMPANY.legalName}'nin markasıdır.`
                : `${COMPANY.brand} is a brand of ${COMPANY.legalName}`}
            </p>
          </div>

          {columns.map((c) => (
            <div key={c.title}>
              <div className={heading}>{c.title}</div>
              <ul className="space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-2 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-foreground/70">{COMPANY.legalName}</p>
          <p>{imprint.join(" · ")}</p>
          <p>
            © {new Date().getFullYear()} {COMPANY.brand}. {tr ? "Tüm hakları saklıdır." : "All rights reserved."}
          </p>
        </div>
      </div>
    </footer>
  );
}
