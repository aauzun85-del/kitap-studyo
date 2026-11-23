import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import {
  CREDIT_ADDONS,
  PACKAGE_VALIDITY_DAYS,
  PAYMENT_OPEN,
  PRICING,
  WELCOME_CREDITS,
} from "@/lib/credits/pricing";
import { REFUND_WINDOW_DAYS } from "@/lib/legal/company";
import PackageCards from "@/components/marketing/PackageCards";
import LegalText from "@/components/legal/LegalText";

export async function generateMetadata({ params }: PageProps<"/[lang]/fiyatlar">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Pricing" : "Fiyatlar" };
}

// Jeton nereye harcanır? — değerler pricing.ts'ten (tek kaynak).
// AI Editör uzun metni ≈12.000 karakterlik parçalara böler ve HER PARÇA için
// ayrı jeton harcar (bkz. EditorStudio → runChunked); satırlar bunu açıkça söyler.
const SPEND = [
  { tr: "AI kapak görseli üretme", en: "AI cover image", cost: PRICING["cover-art"] },
  { tr: "Kapak düzenleme · tasarım öğesi", en: "Cover edit · design element", cost: PRICING["cover-edit"] },
  { tr: "Tanıtım görseli (Instagram vb.)", en: "Promo image (Instagram etc.)", cost: PRICING["promo-image"] },
  { tr: "Seslendirme (bölüm başına)", en: "Narration (per chapter)", cost: PRICING.tts },
  {
    tr: "AI Editör — derin inceleme, parça başına (≈12.000 karakter, yaklaşık 6–7 kitap sayfası)",
    en: "AI Editor — deep review, per part (≈12,000 characters, about 6–7 book pages)",
    cost: PRICING["editor-review-deep"],
  },
  {
    tr: "AI Editör — yazım denetimi · risk taraması · türe özel kontrol (her biri parça başına)",
    en: "AI Editor — spell check · risk scan · genre check (each per part)",
    cost: PRICING["editor-check"],
  },
  {
    tr: "Kısa yardımcılar (etiket, kapak komutu önerisi, tanıtım metni)",
    en: "Small helpers (tags, cover prompt suggestion, promo copy)",
    cost: PRICING["promo-generate"],
  },
];

export default async function PricingPage({ params }: PageProps<"/[lang]/fiyatlar">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const tr = lang === "tr";

  const faq = tr
    ? [
        {
          q: "Abonelik mi?",
          a: `Hayır. Paketi bir kez ödersin, ${PACKAGE_VALIDITY_DAYS} gün geçerli olur ve kendiliğinden yenilenmez. İstersen süre bitince yeni paket alırsın.`,
        },
        {
          q: "Jetonlarım bitmeden süre dolarsa?",
          a: `Paketin ${PACKAGE_VALIDITY_DAYS}. günün sonunda kullanılmayan jetonlar geçersiz olur.`,
        },
        {
          q: "Hoş geldin jetonlarının süresi var mı?",
          a: `Hayır. Üye olunca hesabına gelen ${WELCOME_CREDITS} jetonun süresi dolmaz. Bu jetonlar paraya çevrilemez ve tek başına indirme hakkı vermez; indirmek için aktif paket gerekir.`,
        },
        {
          q: "Hangi işler jeton harcamaz?",
          a: "Mizanpaj (iç sayfa düzeni), kapağı elle tasarlamak, önizleme ve projelerini kaydetmek jeton harcamaz. Yalnızca yapay zekâ işlemleri jeton harcar.",
        },
        {
          q: "Nasıl ödeyebilirim?",
          a: PAYMENT_OPEN
            ? "Kredi veya banka kartınla, güvenli ödeme ekranından ödersin; kart bilgilerin bize ulaşmaz. Ödeme onaylanınca paketin hesabına tanımlanır. Kargo yoktur."
            : "Sitede kartla ödeme henüz açık değil. Şimdilik paket için bize yaz ([[iletisim]]); ödeme adımlarını sana bildiririz, paketi hesabına biz tanımlarız ve faturanı e-postayla göndeririz. Kartla ödeme açılınca kredi veya banka kartınla güvenli ödeme ekranından ödersin; kart bilgilerin bize ulaşmaz. Kargo yoktur.",
        },
        {
          q: "İade alabilir miyim?",
          a: `Paketten hiç jeton harcamadıysan ve dosya indirmediysen ${REFUND_WINDOW_DAYS} gün içinde paranı iade ediyoruz. Ayrıntılar: [[iptal-ve-iade]].`,
        },
      ]
    : [
        {
          q: "Is it a subscription?",
          a: `No. You pay once, the package is valid for ${PACKAGE_VALIDITY_DAYS} days and does not renew automatically.`,
        },
        {
          q: "What if the package expires before I use my credits?",
          a: `Unused credits expire at the end of day ${PACKAGE_VALIDITY_DAYS}.`,
        },
        {
          q: "Do the welcome credits expire?",
          a: `No. The ${WELCOME_CREDITS} credits you get when you sign up never expire. They cannot be converted to money and do not unlock downloads on their own; downloading needs an active package.`,
        },
        {
          q: "What is free?",
          a: "Layout, manual cover design, previews and saving projects are free. Only AI actions use credits.",
        },
        {
          q: "How can I pay?",
          a: PAYMENT_OPEN
            ? "By credit or debit card on a secure payment page; your card details never reach us. Your package is added to your account once the payment is approved. There is no shipping."
            : "Card payment is not open on the site yet. For now, contact us ([[iletisim]]) to get a package; we tell you how to pay, add the package to your account and e-mail your invoice. Once card payment opens you pay by credit or debit card on a secure payment page; your card details never reach us. There is no shipping.",
        },
        {
          q: "Can I get a refund?",
          a: `If you haven't used any credits or downloaded files, we refund within ${REFUND_WINDOW_DAYS} days. Details: [[iptal-ve-iade]].`,
        },
      ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <div className="mb-10 text-center">
        <h1 className="font-sans text-4xl font-extrabold tracking-tight sm:text-5xl">
          {tr ? "Fiyatlar" : "Pricing"}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          {tr
            ? `Üyelik ücretsiz; ${WELCOME_CREDITS} hoş geldin jetonuyla başlarsın. Yapay zekâ işlemleri jeton harcar. Dosyalarını indirmek için aktif bir paket gerekir.`
            : `Membership is free and starts with ${WELCOME_CREDITS} welcome credits. AI actions use credits. Downloading your files needs an active package.`}
          {!PAYMENT_OPEN && (
            <>
              {" "}
              {tr
                ? "Kartla ödeme henüz açık değil; paket için "
                : "Card payment is not open yet; to get a package, "}
              <Link href={`/${lang}/iletisim`} className="font-semibold text-accent hover:underline">
                {tr ? "bize yaz" : "contact us"}
              </Link>
              {tr ? ", hesabına tanımlayalım." : " and we will add it to your account."}
            </>
          )}
        </p>
      </div>

      <PackageCards lang={lang} />

      {/* Jeton nereye harcanır */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="mb-4 font-sans text-2xl font-extrabold">
          {tr ? "Jetonlar nereye harcanır?" : "What uses credits?"}
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {SPEND.map((s) => (
                <tr key={s.en} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground/85">{tr ? s.tr : s.en}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                    {s.cost} {tr ? "jeton" : "credits"}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface">
                <td className="px-4 py-3 text-foreground/85">
                  {tr
                    ? "Mizanpaj, elle kapak tasarımı, önizleme, proje kaydı"
                    : "Layout, manual cover design, previews, saving projects"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {tr ? "ücretsiz" : "free"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          {tr
            ? "Teknik bir hata yüzünden tamamlanamayan işlemin jetonu otomatik olarak geri yüklenir. Paketler yazılım kullanım hizmetidir; jeton yalnızca Laycoty içindeki işlemleri ölçen bir kullanım birimidir, para yerine geçmez ve başkasına devredilemez."
            : "If an action fails due to a technical error, its credits are restored automatically. Packages are a software service; credits only measure usage inside Laycoty, are not money and cannot be transferred."}
        </p>
      </section>

      {/* Ek jeton */}
      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-1 font-sans text-2xl font-extrabold">{tr ? "Ek jeton" : "Extra credits"}</h2>
        <p className="mb-4 text-sm text-muted">
          {tr
            ? `Paketindeki jeton bittiyse yeni paket almadan üstüne ekleyebilirsin. Aktif paketi olan üyeler içindir; ${PACKAGE_VALIDITY_DAYS} gün geçerlidir, indirme hakkı paketle gelir. Üst pakete geçmek istersen yeni paketi kendi fiyatından alırsın; kalan jetonların silinmez.`
            : `Out of credits? Top up without buying a new package. For members with an active package; valid for ${PACKAGE_VALIDITY_DAYS} days; download rights come with a package. To upgrade, buy the higher package at its own price; your remaining credits are kept.`}
        </p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <tbody>
              {CREDIT_ADDONS.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold">
                    {a.credits.toLocaleString(tr ? "tr-TR" : "en-US")} {tr ? "jeton" : "credits"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                    {a.priceTry.toLocaleString(tr ? "tr-TR" : "en-US")} ₺
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/${lang}/satin-al?paket=${a.id}`} className="font-semibold text-accent hover:underline">
                      {tr ? "Satın al" : "Buy"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">{tr ? "Fiyatlara KDV dahildir." : "Prices include VAT."}</p>
      </section>

      {/* SSS */}
      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="mb-4 font-sans text-2xl font-extrabold">
          {tr ? "Sık sorulanlar" : "FAQ"}
        </h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          {faq.map((f) => (
            <div key={f.q} className="px-5 py-4">
              <div className="font-semibold">{f.q}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                <LegalText text={f.a} lang={lang} />
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
