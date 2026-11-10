import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { PRICING, PACKAGE_VALIDITY_DAYS } from "@/lib/credits/pricing";
import { REFUND_WINDOW_DAYS } from "@/lib/legal/company";
import PackageCards from "@/components/marketing/PackageCards";
import LegalText from "@/components/legal/LegalText";

export async function generateMetadata({ params }: PageProps<"/[lang]/fiyatlar">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Pricing" : "Fiyatlar" };
}

// Jeton nereye harcanır? — değerler pricing.ts'ten (tek kaynak).
const SPEND = [
  { tr: "AI kapak görseli üretme", en: "AI cover image", cost: PRICING["cover-art"] },
  { tr: "Kapak düzenleme · tasarım öğesi", en: "Cover edit · design element", cost: PRICING["cover-edit"] },
  { tr: "Tanıtım görseli (Instagram vb.)", en: "Promo image (Instagram etc.)", cost: PRICING["promo-image"] },
  { tr: "Seslendirme (bölüm başına)", en: "Narration (per chapter)", cost: PRICING.tts },
  { tr: "AI Editör — derin inceleme", en: "AI Editor — deep review", cost: PRICING["editor-review-deep"] },
  { tr: "AI Editör — hızlı inceleme · yazım denetimi", en: "AI Editor — quick review · spell check", cost: PRICING["editor-review"] },
  {
    tr: "Kısa yardımcılar (tür tespiti, risk taraması, etiket, tanıtım metni)",
    en: "Small helpers (genre, risk scan, tags, promo copy)",
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
          q: "Hangi işler jeton harcamaz?",
          a: "Mizanpaj (iç sayfa düzeni), kapağı elle tasarlamak, önizleme ve projelerini kaydetmek jeton harcamaz. Yalnızca yapay zekâ işlemleri jeton harcar.",
        },
        {
          q: "Nasıl ödeyebilirim?",
          a: "Kredi veya banka kartınla, güvenli ödeme ekranından ödersin; kart bilgilerin bize ulaşmaz. Ödeme onaylanınca paketin hesabına tanımlanır. Kargo yoktur. Kartla ödeme, ödeme kuruluşu onayından sonra açılacak.",
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
          q: "What is free?",
          a: "Layout, manual cover design, previews and saving projects are free. Only AI actions use credits.",
        },
        {
          q: "How can I pay?",
          a: "By credit or debit card on a secure payment page; your card details never reach us. Your package is added to your account once the payment is approved. There is no shipping. Card payment opens once our payment provider approves us.",
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
            ? "Üyelik ücretsiz. Kitabın hazır olup indirmek istediğinde bir kullanım paketi al. Kartla ödeme açılana kadar tüm araçlar üyelere ücretsizdir; paketler ödeme açıldığında yürürlüğe girer."
            : "Membership is free. Buy a usage package when your book is ready to download. Until card payment opens, all tools are free for members; packages take effect when payment opens."}
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
