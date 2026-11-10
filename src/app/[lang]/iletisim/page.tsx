import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import InfoPage from "@/components/legal/InfoPage";
import CompanyCard from "@/components/legal/CompanyCard";

export async function generateMetadata({ params }: PageProps<"/[lang]/iletisim">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "Contact" : "İletişim" };
}

export default async function ContactPage({ params }: PageProps<"/[lang]/iletisim">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const tr = lang === "tr";

  return (
    <InfoPage
      lang={lang}
      current="iletisim"
      title={tr ? "İletişim" : "Contact"}
      showUpdated={false}
      intro={
        <p>
          {tr
            ? "Soru, öneri, sipariş ve iade talepleri için bize e-posta ile ya da telefonla ulaşabilirsin."
            : "For questions, orders or refund requests, reach us by email or phone."}
        </p>
      }
    >
      <CompanyCard lang={lang} contact />
      <p className="mt-6 text-sm leading-relaxed text-muted">
        {tr
          ? "Siparişinle ilgili yazıyorsan, üye olduğun e-posta adresinden yaz ve ödeme tarihini belirt; böylece daha hızlı yardımcı olabiliriz."
          : "If you're writing about an order, please use your account email and include the payment date."}
      </p>
    </InfoPage>
  );
}
