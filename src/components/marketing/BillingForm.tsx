"use client";

import type { Locale } from "@/i18n/config";

// FATURA BİLGİLERİ — satın alma ekranının 3. adımı. Ödeme tamamlanınca bu
// bilgilerle e-Arşiv / e-Fatura düzenlenir. Bireyselde TC kimlik no isteğe
// bağlıdır (boşsa faturada 11111111111 kullanılır); kurumsalda unvan, vergi
// dairesi ve vergi no zorunludur.
export type Billing = {
  type: "bireysel" | "kurumsal";
  name: string; // ad soyad ya da şirket unvanı
  taxId: string; // TC kimlik no (11) ya da vergi no (10/11)
  taxOffice: string;
  email: string;
  address: string;
  district: string;
  city: string;
};

export const EMPTY_BILLING: Billing = {
  type: "bireysel",
  name: "",
  taxId: "",
  taxOffice: "",
  email: "",
  address: "",
  district: "",
  city: "",
};

export type BillingErrors = Partial<Record<keyof Billing, string>>;

const COPY = {
  tr: {
    individual: "Bireysel",
    company: "Kurumsal",
    fullName: "Ad soyad",
    title: "Şirket unvanı",
    tc: "TC kimlik no (isteğe bağlı)",
    vkn: "Vergi no",
    taxOffice: "Vergi dairesi",
    email: "Faturanın gönderileceği e-posta",
    address: "Adres",
    district: "İlçe",
    city: "İl",
    hint: "Faturan bu bilgilerle düzenlenir ve e-posta adresine gönderilir.",
    eName: "Ad soyad yaz.",
    eTitle: "Şirket unvanını yaz.",
    eTc: "TC kimlik no 11 haneli olmalı (boş da bırakabilirsin).",
    eVkn: "Vergi no 10 haneli (şahıs işletmesinde 11 haneli TC kimlik no) olmalı.",
    eTaxOffice: "Vergi dairesini yaz.",
    eEmail: "Geçerli bir e-posta adresi yaz.",
    eAddress: "Adresini yaz.",
    eDistrict: "İlçeyi yaz.",
    eCity: "İli yaz.",
  },
  en: {
    individual: "Individual",
    company: "Company",
    fullName: "Full name",
    title: "Company name",
    tc: "Turkish ID no (optional)",
    vkn: "Tax number",
    taxOffice: "Tax office",
    email: "E-mail for the invoice",
    address: "Address",
    district: "District",
    city: "City",
    hint: "Your invoice is issued with these details and e-mailed to you.",
    eName: "Enter your full name.",
    eTitle: "Enter the company name.",
    eTc: "The ID number must be 11 digits (or leave it empty).",
    eVkn: "The tax number must be 10 digits (11 for sole proprietors).",
    eTaxOffice: "Enter the tax office.",
    eEmail: "Enter a valid e-mail address.",
    eAddress: "Enter your address.",
    eDistrict: "Enter the district.",
    eCity: "Enter the city.",
  },
} as const;

export function validateBilling(b: Billing, lang: Locale): BillingErrors {
  const t = COPY[lang];
  const e: BillingErrors = {};
  const company = b.type === "kurumsal";
  if (b.name.trim().length < (company ? 2 : 5) || (!company && !/\S\s+\S/.test(b.name.trim())))
    e.name = company ? t.eTitle : t.eName;
  const id = b.taxId.trim();
  if (company) {
    if (!/^(\d{10}|\d{11})$/.test(id)) e.taxId = t.eVkn;
    if (b.taxOffice.trim().length < 2) e.taxOffice = t.eTaxOffice;
  } else if (id && !/^\d{11}$/.test(id)) e.taxId = t.eTc;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email.trim())) e.email = t.eEmail;
  if (b.address.trim().length < 5) e.address = t.eAddress;
  if (b.district.trim().length < 2) e.district = t.eDistrict;
  if (b.city.trim().length < 2) e.city = t.eCity;
  return e;
}

export default function BillingForm({
  lang,
  value,
  onChange,
  errors,
}: {
  lang: Locale;
  value: Billing;
  onChange: (next: Billing) => void;
  /** Yalnız "Kartla öde"ye basıldıktan sonra dolu gelir. */
  errors: BillingErrors;
}) {
  const t = COPY[lang];
  const company = value.type === "kurumsal";
  const set = (k: keyof Billing, v: string) => onChange({ ...value, [k]: v });

  const field = (
    k: keyof Billing,
    label: string,
    opts: { autoComplete?: string; inputMode?: "numeric" | "email"; maxLength?: number; wide?: boolean } = {},
  ) => {
    const err = errors[k];
    const id = `fatura-${k}`;
    return (
      <div className={opts.wide ? "sm:col-span-2" : undefined}>
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
        <input
          id={id}
          name={id}
          type={opts.inputMode === "email" ? "email" : "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          maxLength={opts.maxLength ?? 200}
          value={value[k]}
          onChange={(e) =>
            set(k, opts.inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value)
          }
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-hata` : undefined}
          className={`w-full rounded-lg border bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:border-accent ${
            err ? "border-red-500" : "border-border"
          }`}
        />
        {err && (
          <p id={`${id}-hata`} className="mt-1 text-xs text-red-600 dark:text-red-400">
            {err}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div role="radiogroup" aria-label={lang === "tr" ? "Fatura türü" : "Invoice type"} className="mb-4 grid grid-cols-2 gap-2">
        {(["bireysel", "kurumsal"] as const).map((k) => {
          const on = value.type === k;
          return (
            <label
              key={k}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition ${
                on ? "border-accent bg-accent-soft text-accent" : "border-border bg-background text-muted"
              }`}
            >
              <input
                type="radio"
                name="fatura-turu"
                className="sr-only"
                checked={on}
                onChange={() => onChange({ ...value, type: k, taxId: "", taxOffice: "" })}
              />
              {k === "bireysel" ? t.individual : t.company}
            </label>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", company ? t.title : t.fullName, {
          autoComplete: company ? "organization" : "name",
          wide: true,
        })}
        {company && field("taxOffice", t.taxOffice, { maxLength: 60 })}
        {field("taxId", company ? t.vkn : t.tc, { inputMode: "numeric", maxLength: 11, wide: !company })}
        {field("email", t.email, { autoComplete: "email", inputMode: "email", wide: true })}
        {field("address", t.address, { autoComplete: "street-address", wide: true })}
        {field("district", t.district, { autoComplete: "address-level2", maxLength: 60 })}
        {field("city", t.city, { autoComplete: "address-level1", maxLength: 60 })}
      </div>
      <p className="mt-3 text-xs text-muted">{t.hint}</p>
    </div>
  );
}
