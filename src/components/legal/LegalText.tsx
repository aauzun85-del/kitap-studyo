import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { COMPANY, REFUND_WINDOW_DAYS } from "@/lib/legal/company";
import { LEGAL_DOCS } from "@/lib/legal/documents";
import {
  CREDIT_PACKAGES,
  PACKAGE_VALIDITY_DAYS,
  WELCOME_CREDITS,
} from "@/lib/credits/pricing";

// Yasal metinlerdeki yer tutucuları doldurur:
//   {unvan} {adres} … → şirket bilgisi (boşsa sarı "[Telefon]" uyarısı)
//   [[slug]]          → ilgili sayfaya bağlantı

const tl = (n: number) => `${n.toLocaleString("tr-TR")} TL`;

export const packagesSummary = CREDIT_PACKAGES.map(
  (p) => `${p.name.tr}: ${p.credits.toLocaleString("tr-TR")} jeton – ${tl(p.priceTry)}`,
).join("; ");

// Yer tutucu → [değer, boşsa gösterilecek etiket]
const TOKENS: Record<string, [string, string]> = {
  unvan: [COMPANY.legalName, "Unvan"],
  kisaUnvan: [COMPANY.shortName, "Kısa unvan"],
  adres: [COMPANY.address, "Adres"],
  vergiDairesi: [COMPANY.taxOffice, "Vergi dairesi"],
  vergiNo: [COMPANY.taxNumber, "Vergi no"],
  mersis: [COMPANY.mersis, "MERSİS no"],
  sicil: [COMPANY.tradeRegistry, "Ticaret sicil no"],
  telefon: [COMPANY.phone, "Telefon"],
  eposta: [COMPANY.email, "E-posta"],
  site: [COMPANY.website, "Site"],
  marka: [COMPANY.brand, "Marka"],
  gecerlilik: [String(PACKAGE_VALIDITY_DAYS), "Geçerlilik"],
  hosgeldin: [String(WELCOME_CREDITS), "Hoş geldin jetonu"],
  iadeGun: [String(REFUND_WINDOW_DAYS), "İade süresi"],
  paketler: [packagesSummary, "Paketler"],
};

const PAGES: Record<string, Record<Locale, string>> = {
  fiyatlar: { tr: "Fiyatlar", en: "Pricing" },
  iletisim: { tr: "İletişim", en: "Contact" },
  "islem-rehberi": { tr: "İşlem Rehberi", en: "How to order" },
  hakkimizda: { tr: "Hakkımızda", en: "About us" },
};

export function linkFor(slug: string, lang: Locale): { href: string; label: string } | null {
  if (PAGES[slug]) return { href: `/${lang}/${slug}`, label: PAGES[slug][lang] };
  const doc = LEGAL_DOCS.find((d) => d.slug === slug);
  if (doc) return { href: `/${lang}/yasal/${slug}`, label: doc.title[lang] };
  return null;
}

// Eksik şirket bilgisi uyarısı — yayına almadan önce hepsi dolu olmalı.
export function Missing({ label }: { label: string }) {
  return (
    <mark className="rounded bg-amber-200 px-1 font-semibold text-amber-900">[{label}]</mark>
  );
}

export function fillText(text: string, lang: Locale): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\{(\w+)\}|\[\[([\w-]+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const tok = TOKENS[m[1]];
      if (!tok) out.push(m[0]);
      else if (tok[0]) out.push(tok[0]);
      else out.push(<Missing key={k++} label={tok[1]} />);
    } else {
      const l = linkFor(m[2], lang);
      out.push(
        l ? (
          <Link key={k++} href={l.href} className="font-semibold text-accent hover:underline">
            {l.label}
          </Link>
        ) : (
          m[0]
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function LegalText({ text, lang }: { text: string; lang: Locale }) {
  return <>{fillText(text, lang)}</>;
}
