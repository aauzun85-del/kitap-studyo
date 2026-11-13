import Link from "next/link";
import type { Locale } from "@/i18n/config";
import {
  CREDIT_PACKAGES,
  PACKAGE_VALIDITY_DAYS,
  PAYMENT_OPEN,
  PRICING,
  WELCOME_CREDITS,
} from "@/lib/credits/pricing";

// Jeton paketleri — ana sayfa ve Fiyatlar sayfası AYNI kartları gösterir.
// Tek kaynak pricing.ts: fiyat/jeton değişince burası kendiliğinden güncellenir.
export default function PackageCards({ lang }: { lang: Locale }) {
  const tr = lang === "tr";
  const nf = tr ? "tr-TR" : "en-US";
  const coverCost = PRICING["cover-art"];
  const deepCost = PRICING["editor-review-deep"];
  // Derin inceleme PARÇA başına ücretlenir (≈12.000 karakter ≈ 6 kitap sayfası);
  // kartta "kaç inceleme" değil, yaklaşık kaç SAYFA incelenebileceği yazılır.
  const PAGES_PER_PART = 6;

  return (
    <div>
      {/* Ücretsiz başlangıç */}
      <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-center sm:flex-row sm:text-left">
        <div>
          <div className="font-sans text-base font-extrabold">
            {tr ? "Ücretsiz üyelik" : "Free membership"}
          </div>
          <div className="text-sm text-muted">
            {tr
              ? `Üye olmak ücretsiz; ${WELCOME_CREDITS} hoş geldin jetonuyla araçları dene. Dosya indirmek için paket gerekir.`
              : `Membership is free; try the tools with ${WELCOME_CREDITS} welcome credits. Downloading files needs a package.`}
          </div>
        </div>
        <Link
          href={`/${lang}/kayit`}
          className="shrink-0 rounded-full border border-border bg-background px-5 py-2 text-sm font-bold transition hover:border-foreground/30"
        >
          {tr ? "Ücretsiz üye ol" : "Sign up free"}
        </Link>
      </div>

      <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
        {CREDIT_PACKAGES.map((p) => {
          const featured = p.id === "pro";
          const badge = p.badge?.[lang];
          return (
            <div
              key={p.id}
              className="relative flex flex-col gap-5 rounded-2xl border p-7"
              style={{
                borderColor: featured ? "var(--color-accent)" : "var(--color-border)",
                background: featured ? "var(--color-accent-soft)" : "var(--color-surface)",
                boxShadow: featured
                  ? "0 10px 40px color-mix(in srgb, var(--color-accent) 22%, transparent)"
                  : undefined,
              }}
            >
              {badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#4f46e5] px-4 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-white">
                  {badge}
                </span>
              )}

              <div className="pt-1">
                <div className="font-sans text-lg font-extrabold">{p.name[lang]}</div>
                <div className="mt-1 text-sm text-muted">
                  <span className="font-bold text-foreground">
                    {p.credits.toLocaleString(nf)}
                  </span>{" "}
                  {tr ? "jeton" : "credits"} · {PACKAGE_VALIDITY_DAYS} {tr ? "gün geçerli" : "days"}
                </div>
              </div>

              <div className="border-b border-border pb-5">
                <div className="text-4xl font-extrabold text-accent">
                  {p.priceTry.toLocaleString(nf)} ₺
                </div>
                <div className="mt-1 text-xs text-muted">
                  {tr ? "KDV dahil · tek seferlik ödeme" : "VAT included · one-time payment"}
                </div>
              </div>

              <ul className="flex-1 space-y-2.5 text-sm text-foreground/80">
                <li className="flex gap-2">
                  <span className="font-bold text-accent">✓</span>
                  {tr
                    ? `${PACKAGE_VALIDITY_DAYS} gün boyunca sınırsız indirme (PDF, EPUB, Word, MP3, kapak)`
                    : `Unlimited downloads for ${PACKAGE_VALIDITY_DAYS} days (PDF, EPUB, Word, MP3, cover)`}
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">✓</span>
                  {tr
                    ? `≈ ${Math.floor(p.credits / coverCost)} AI kapak görseli ya da ≈ ${(Math.floor(p.credits / deepCost) * PAGES_PER_PART).toLocaleString(nf)} sayfalık derin editör incelemesi`
                    : `≈ ${Math.floor(p.credits / coverCost)} AI cover images or a deep editor review of ≈ ${(Math.floor(p.credits / deepCost) * PAGES_PER_PART).toLocaleString(nf)} pages`}
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-accent">✓</span>
                  {tr ? "Otomatik yenilenmez, abonelik yok" : "No auto-renewal, no subscription"}
                </li>
              </ul>

              <Link
                href={`/${lang}/satin-al?paket=${p.id}`}
                className={`rounded-full py-3 text-center text-sm font-bold transition hover:-translate-y-0.5 hover:opacity-90 ${
                  featured ? "text-white" : "border border-border bg-background"
                }`}
                style={
                  featured
                    ? {
                        background: "linear-gradient(135deg, var(--color-accent) 0%, #7c3aed 100%)",
                        boxShadow: "0 3px 14px color-mix(in srgb, var(--color-accent) 35%, transparent)",
                      }
                    : undefined
                }
              >
                {tr ? "Satın al" : "Buy"}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Kartla ödeme kapalıyken paketin BUGÜN nasıl alınacağını söyle. */}
      {!PAYMENT_OPEN && (
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed text-muted">
          {tr ? "Kartla ödeme henüz açık değil. Paket için " : "Card payment is not open yet. To get a package, "}
          <Link href={`/${lang}/iletisim`} className="font-semibold text-accent hover:underline">
            {tr ? "bize yaz" : "contact us"}
          </Link>
          {tr ? "; hesabına biz tanımlarız, faturan e-postana gelir." : "; we add it to your account and e-mail your invoice."}
        </p>
      )}

      <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-muted">
        {tr ? (
          <>
            Satın alma koşulları:{" "}
            <Link href={`/${lang}/yasal/mesafeli-satis-sozlesmesi`} className="underline hover:text-foreground">
              Mesafeli Satış Sözleşmesi
            </Link>{" "}
            ·{" "}
            <Link href={`/${lang}/yasal/iptal-ve-iade`} className="underline hover:text-foreground">
              Teslimat, İptal ve İade Koşulları
            </Link>
          </>
        ) : (
          <>
            Terms of sale:{" "}
            <Link href={`/${lang}/yasal/mesafeli-satis-sozlesmesi`} className="underline hover:text-foreground">
              Distance Sales Agreement
            </Link>{" "}
            ·{" "}
            <Link href={`/${lang}/yasal/iptal-ve-iade`} className="underline hover:text-foreground">
              Delivery, Cancellation &amp; Refund Policy
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
