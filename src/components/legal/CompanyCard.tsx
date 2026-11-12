import type { Locale } from "@/i18n/config";
import { COMPANY } from "@/lib/legal/company";
import { Missing } from "./LegalText";

// Şirket künyesi kutusu — Hakkımızda ve İletişim sayfalarında.
export default function CompanyCard({
  lang,
  contact = false,
}: {
  lang: Locale;
  contact?: boolean; // true → telefon/e-posta üstte ve tıklanabilir
}) {
  const tr = lang === "tr";
  const v = (value: string, label: string) => value || <Missing label={label} />;

  const contactRows = [
    {
      k: tr ? "E-posta" : "Email",
      v: COMPANY.email ? (
        <a href={`mailto:${COMPANY.email}`} className="font-semibold text-accent hover:underline">
          {COMPANY.email}
        </a>
      ) : (
        <Missing label="E-posta" />
      ),
    },
    {
      k: tr ? "Telefon" : "Phone",
      v: COMPANY.phone ? (
        <a href={`tel:${COMPANY.phone.replace(/[^\d+]/g, "")}`} className="font-semibold text-accent hover:underline">
          {COMPANY.phone}
        </a>
      ) : (
        <Missing label="Telefon" />
      ),
    },
  ];
  const companyRows = [
    { k: tr ? "Unvan" : "Company", v: v(COMPANY.legalName, "Unvan") },
    { k: tr ? "Adres" : "Address", v: v(COMPANY.address, "Adres") },
    {
      k: tr ? "Vergi dairesi / no" : "Tax office / no",
      v: (
        <>
          {v(COMPANY.taxOffice, "Vergi dairesi")} / {v(COMPANY.taxNumber, "Vergi no")}
        </>
      ),
    },
    { k: "MERSİS", v: v(COMPANY.mersis, "MERSİS no") },
    { k: tr ? "Ticaret sicil" : "Trade registry", v: v(COMPANY.tradeRegistry, "Ticaret sicil no") },
    {
      k: tr ? "Meslek odası" : "Chamber",
      v: (
        <a href={COMPANY.chamberUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {COMPANY.chamber}
        </a>
      ),
    },
  ];
  const rows = contact ? [...contactRows, ...companyRows] : [...companyRows, ...contactRows];

  return (
    <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface text-sm">
      {rows.map((r) => (
        <div key={r.k} className="grid gap-1 px-5 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-muted">{r.k}</dt>
          <dd className="font-medium text-foreground">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
