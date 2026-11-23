import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import InfoPage from "@/components/legal/InfoPage";
import { PAYMENT_OPEN } from "@/lib/credits/pricing";

export async function generateMetadata({ params }: PageProps<"/[lang]/islem-rehberi">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "How to order" : "İşlem Rehberi" };
}

// 6563 sayılı Kanun md. 3 ve ilgili yönetmelik gereği: sipariş adımları,
// sözleşmenin saklanması/erişimi, hata düzeltme ve gizlilik kuralları.
export default async function GuidePage({ params }: PageProps<"/[lang]/islem-rehberi">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const tr = lang === "tr";
  const a = "font-semibold text-accent hover:underline";

  // Kartla ödeme kapalıyken (PAYMENT_OPEN = false) paketin BUGÜN nasıl alındığı.
  const stepsNow = tr
    ? [
        "Ücretsiz üye ol ya da giriş yap.",
        "Fiyatlar sayfasından sana uyan paketi seç.",
        "İletişim sayfasındaki e-posta ya da telefondan bize yaz; üye olduğun e-posta adresini, paketin adını ve fatura bilgilerini belirt.",
        "Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'ni oku; mesajında kabul ettiğini yaz.",
        "Sana ödeme adımlarını bildiririz.",
        "Paketi hesabına biz tanımlarız; jetonların ve indirme hakkın hemen açılır. Faturan ve bu iki metin e-posta adresine gönderilir.",
      ]
    : [
        "Sign up for free or log in.",
        "Choose the package that suits you on the Pricing page.",
        "Write to us by e-mail or phone (see the Contact page); tell us your member e-mail address, the package name and your invoice details.",
        "Read the Preliminary Information Form and the Distance Sales Agreement; say in your message that you accept them.",
        "We tell you how to pay.",
        "We add the package to your account; your credits and download rights open immediately. Your invoice and these two texts are e-mailed to you.",
      ];

  const steps = tr
    ? [
        "Ücretsiz üye ol ya da giriş yap.",
        "Fiyatlar sayfasından bir paket seç ve “Satın al”a bas.",
        "Sipariş özetini kontrol et: paket, içerik, KDV dahil toplam tutar.",
        "Fatura bilgilerini gir (bireysel ya da kurumsal).",
        "Ön Bilgilendirme Formu ile Mesafeli Satış Sözleşmesi'ni oku ve onay kutusunu işaretle.",
        "“Kartla öde”ye bas; kart bilgilerini ödeme kuruluşunun güvenli (3D Secure) sayfasında gir.",
        "Ödeme onaylanınca paket hesabına hemen tanımlanır; onay ve sözleşme metni e-posta adresine gönderilir.",
      ]
    : [
        "Sign up for free or log in.",
        "Choose a package on the Pricing page and press “Buy”.",
        "Review the order summary: package, contents, total including VAT.",
        "Enter your invoice details (individual or company).",
        "Read the Preliminary Information Form and the Distance Sales Agreement and tick the box.",
        "Press “Pay by card”; enter your card details on the payment provider's secure (3D Secure) page.",
        "Once the payment is approved the package is added to your account immediately; the confirmation and agreement text are e-mailed to you.",
      ];

  return (
    <InfoPage
      lang={lang}
      current="islem-rehberi"
      title={tr ? "İşlem Rehberi" : "How to order"}
      showUpdated={false}
      intro={
        <p>
          {tr
            ? "Laycoty'de satın alma nasıl yapılır, sözleşme nerede saklanır, bir hata yaparsan ne olur?"
            : "How a purchase works on Laycoty, where the agreement is kept, and what happens if you make a mistake."}
        </p>
      }
    >
      <div className="space-y-8 text-base leading-relaxed text-foreground/85">
        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Sipariş adımları" : "Order steps"}
          </h2>
          {!PAYMENT_OPEN && (
            <>
              <p className="mb-3">
                {tr
                  ? "Sitede kartla ödeme henüz açık değil. Şu an paket şöyle alınır:"
                  : "Card payment is not open on the site yet. For now, this is how you get a package:"}
              </p>
              <ol className="ml-5 list-decimal space-y-1.5 marker:text-muted">
                {stepsNow.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mt-3">
                <Link href={`/${lang}/iletisim`} className={a}>
                  {tr ? "İletişim sayfası" : "Contact page"}
                </Link>
              </p>
              <h3 className="mb-3 mt-6 font-sans text-base font-bold text-foreground">
                {tr ? "Kartla ödeme açıldığında" : "Once card payment opens"}
              </h3>
            </>
          )}
          <ol className="ml-5 list-decimal space-y-1.5 marker:text-muted">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {!PAYMENT_OPEN && (
            <p className="mt-3 text-sm text-muted">
              {tr
                ? "Kartla ödeme, ödeme kuruluşunun onayından sonra açılacak. O zamana kadar sitede karttan ödeme alınmaz."
                : "Card payment opens after our payment provider's approval. Until then no card payment is taken on the site."}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Hata yaparsan" : "If you make a mistake"}
          </h2>
          <p>
            {tr
              ? "Ödeme düğmesine basana kadar paketi dilediğin gibi değiştirebilir ya da sayfadan çıkabilirsin; ödeme tamamlanmadan sipariş oluşmaz. Ödemeden sonraki iptal ve iadeler için "
              : "Until you press the pay button you can change the package or leave the page; no order exists before payment. For cancellations and refunds after payment see the "}
            <Link href={`/${lang}/yasal/iptal-ve-iade`} className={a}>
              {tr ? "Teslimat, İptal ve İade Koşulları" : "Delivery, Cancellation & Refund Policy"}
            </Link>
            {tr ? " geçerlidir." : "."}
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Sözleşmenin saklanması" : "Keeping the agreement"}
          </h2>
          <p>
            <Link href={`/${lang}/yasal/mesafeli-satis-sozlesmesi`} className={a}>
              {tr ? "Mesafeli Satış Sözleşmesi" : "Distance Sales Agreement"}
            </Link>
            {tr ? " ve " : " and the "}
            <Link href={`/${lang}/yasal/on-bilgilendirme-formu`} className={a}>
              {tr ? "Ön Bilgilendirme Formu" : "Preliminary Information Form"}
            </Link>
            {tr
              ? " bu sitede sürekli yayındadır; dilediğin zaman okuyabilir, tarayıcından yazdırabilir ya da kaydedebilirsin. "
              : " are always available on this site; you can read, print or save them at any time. "}
            {/* Kartla ödeme kapalıyken onay sitede kaydedilmez; kayıt, üyeyle yazışmadır. */}
            {PAYMENT_OPEN
              ? tr
                ? "Siparişinle birlikte onayladığın metin e-posta adresine de gönderilir; sipariş kaydın ve onay zamanı tarafımızca yasal süre boyunca saklanır."
                : "The text you accepted is also e-mailed with your order; your order record and acceptance time are kept by us for the legal period."
              : tr
                ? "Paketi tanımlarken bu iki metni faturanla birlikte e-postayla göndeririz; yazışman onay kaydı olarak yasal süre boyunca saklanır."
                : "When we add the package we e-mail you these two texts together with your invoice; your message is kept as the record of your acceptance for the legal period."}
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Gizlilik ve uyuşmazlık" : "Privacy and disputes"}
          </h2>
          <p>
            {tr ? "Kişisel verilerin " : "Your personal data is processed under our "}
            <Link href={`/${lang}/yasal/gizlilik-politikasi`} className={a}>
              {tr ? "Gizlilik Politikası" : "Privacy Policy"}
            </Link>
            {tr ? " ve " : " and "}
            <Link href={`/${lang}/yasal/kvkk-aydinlatma-metni`} className={a}>
              {tr ? "KVKK Aydınlatma Metni" : "Personal Data Notice"}
            </Link>
            {tr
              ? " kapsamında işlenir. Şikâyetlerin için önce bize yazabilir (İletişim sayfası); çözülmezse Tüketici Hakem Heyetine ya da Tüketici Mahkemesine başvurabilirsin."
              : ". For complaints, write to us first (Contact page); if unresolved you may apply to the Consumer Arbitration Committee or the Consumer Court."}
          </p>
        </section>
      </div>
    </InfoPage>
  );
}
