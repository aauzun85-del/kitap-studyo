"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { CREDIT_PACKAGES, PACKAGE_VALIDITY_DAYS } from "@/lib/credits/pricing";

// Satın alma adımları: paket → sipariş özeti → sözleşme onayı → ödeme.
// Kart ödemesi ödeme kuruluşu onayından sonra son adıma bağlanacak; o güne kadar
// bu ekran hiçbir ücret almaz ve bunu açıkça söyler.
const COPY = {
  tr: {
    title: "Satın al",
    subtitle: "Paketini seç, sipariş özetini kontrol et, sözleşmeyi onayla.",
    step1: "Paket",
    step2: "Sipariş özeti",
    step3: "Onay ve ödeme",
    credits: "jeton",
    days: "gün geçerli",
    item: "Ürün",
    itemValue: (name: string) => `Laycoty ${name} yazılım kullanım paketi`,
    content: "İçerik",
    contentValue: (c: string) => `${c} jeton + ${PACKAGE_VALIDITY_DAYS} gün sınırsız dosya indirme`,
    delivery: "Teslimat",
    deliveryValue: "Dijital hizmet; ödeme onaylanınca hesabına tanımlanır. Kargo yoktur.",
    renewal: "Yenileme",
    renewalValue: "Tek seferlik ödeme; kendiliğinden yenilenmez.",
    total: "Toplam (KDV dahil)",
    agreePre: "",
    info: "Ön Bilgilendirme Formu",
    agreeAnd: "'nu ve ",
    contract: "Mesafeli Satış Sözleşmesi",
    agreePost:
      "'ni okudum, kabul ediyorum. Paket hesabıma tanımlanınca hizmetin onayımla hemen başlayacağını ve bu nedenle cayma hakkımın olmadığını biliyorum; hiç kullanılmamış paketler için ",
    refund: "Teslimat, İptal ve İade Koşulları",
    agreeEnd: " geçerlidir.",
    pay: "Kartla öde",
    needAgree: "Devam etmek için sözleşmeyi onaylamalısın.",
    secure: "Kart bilgilerin ödeme kuruluşunun güvenli ekranına girilecek; Laycoty'ye ulaşmaz.",
    notOpen:
      "Kartla ödeme henüz açık değil: ödeme kuruluşunun onayından sonra güvenli ödeme ekranı tam bu adımda açılacak. Şu anda hiçbir ücret alınmadı.",
    contact: "Soruların için: İletişim",
  },
  en: {
    title: "Checkout",
    subtitle: "Choose your package, review your order and accept the agreement.",
    step1: "Package",
    step2: "Order summary",
    step3: "Agreement and payment",
    credits: "credits",
    days: "days",
    item: "Item",
    itemValue: (name: string) => `Laycoty ${name} software usage package`,
    content: "Includes",
    contentValue: (c: string) => `${c} credits + unlimited downloads for ${PACKAGE_VALIDITY_DAYS} days`,
    delivery: "Delivery",
    deliveryValue: "Digital service; added to your account once payment is approved. No shipping.",
    renewal: "Renewal",
    renewalValue: "One-time payment; never renews automatically.",
    total: "Total (VAT included)",
    agreePre: "I have read and accept the ",
    info: "Preliminary Information Form",
    agreeAnd: " and the ",
    contract: "Distance Sales Agreement",
    agreePost:
      ". I understand the service starts as soon as the package is added to my account, so there is no right of withdrawal; for unused packages the ",
    refund: "Delivery, Cancellation & Refund Policy",
    agreeEnd: " applies.",
    pay: "Pay by card",
    needAgree: "Please accept the agreement to continue.",
    secure: "Your card details are entered on the payment provider's secure page and never reach Laycoty.",
    notOpen:
      "Card payment is not open yet: the secure payment page will open at this step once the payment provider approves us. You have not been charged.",
    contact: "Contact us",
  },
} as const;

export default function Checkout({ lang, initialId }: { lang: Locale; initialId?: string }) {
  const t = COPY[lang];
  const nf = lang === "tr" ? "tr-TR" : "en-US";
  const fallback = CREDIT_PACKAGES.find((p) => p.badge) ?? CREDIT_PACKAGES[0];
  const [id, setId] = useState(
    CREDIT_PACKAGES.some((p) => p.id === initialId) ? (initialId as string) : fallback.id,
  );
  const [accepted, setAccepted] = useState(false);
  const [note, setNote] = useState<"agree" | "closed" | null>(null);
  const pkg = CREDIT_PACKAGES.find((p) => p.id === id) ?? fallback;
  const credits = pkg.credits.toLocaleString(nf);

  const heading = "mb-3 font-sans text-lg font-extrabold";
  const row = "grid gap-0.5 px-4 py-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-4";
  const link = "font-semibold text-accent underline";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h1>
      <p className="mt-2 text-muted">{t.subtitle}</p>

      <section className="mt-8">
        <h2 id="paket-baslik" className={heading}>1. {t.step1}</h2>
        <div role="radiogroup" aria-labelledby="paket-baslik" className="space-y-2">
          {CREDIT_PACKAGES.map((p) => {
            const on = p.id === id;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                  on ? "border-accent bg-accent-soft" : "border-border bg-surface"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paket"
                    checked={on}
                    onChange={() => {
                      setId(p.id);
                      setNote(null);
                    }}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block font-bold">{p.name[lang]}</span>
                    <span className="block text-xs text-muted">
                      {p.credits.toLocaleString(nf)} {t.credits} · {PACKAGE_VALIDITY_DAYS} {t.days}
                    </span>
                  </span>
                </span>
                <span className="whitespace-nowrap font-extrabold">{p.priceTry.toLocaleString(nf)} ₺</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className={heading}>2. {t.step2}</h2>
        <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface text-sm">
          {[
            [t.item, t.itemValue(pkg.name[lang])],
            [t.content, t.contentValue(credits)],
            [t.delivery, t.deliveryValue],
            [t.renewal, t.renewalValue],
          ].map(([k, v]) => (
            <div key={k} className={row}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          <div className={`${row} bg-background`}>
            <dt className="font-bold">{t.total}</dt>
            <dd className="text-xl font-extrabold text-accent">{pkg.priceTry.toLocaleString(nf)} ₺</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className={heading}>3. {t.step3}</h2>
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t.notOpen}
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-base leading-relaxed text-foreground/85">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              setNote(null);
            }}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            {t.agreePre}
            <Link href={`/${lang}/yasal/on-bilgilendirme-formu`} target="_blank" className={link}>
              {t.info}
            </Link>
            {t.agreeAnd}
            <Link href={`/${lang}/yasal/mesafeli-satis-sozlesmesi`} target="_blank" className={link}>
              {t.contract}
            </Link>
            {t.agreePost}
            <Link href={`/${lang}/yasal/iptal-ve-iade`} target="_blank" className={link}>
              {t.refund}
            </Link>
            {t.agreeEnd}
          </span>
        </label>

        <button
          type="button"
          onClick={() => setNote(accepted ? "closed" : "agree")}
          className="mt-4 w-full rounded-full py-3.5 text-sm font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)" }}
        >
          {t.pay} · {pkg.priceTry.toLocaleString(nf)} ₺
        </button>
        <p className="mt-2 text-center text-xs text-muted">{t.secure}</p>

        {note && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {note === "agree" ? t.needAgree : t.notOpen}
            {note === "closed" && (
              <>
                {" "}
                <Link href={`/${lang}/iletisim`} className="font-semibold underline">
                  {t.contact}
                </Link>
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
