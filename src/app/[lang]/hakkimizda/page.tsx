import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { COMPANY } from "@/lib/legal/company";
import InfoPage from "@/components/legal/InfoPage";
import CompanyCard from "@/components/legal/CompanyCard";

export async function generateMetadata({ params }: PageProps<"/[lang]/hakkimizda">): Promise<Metadata> {
  const { lang } = await params;
  return { title: lang === "en" ? "About us" : "Hakkımızda" };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/hakkimizda">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const tr = lang === "tr";

  const offer = tr
    ? [
        ["Kapak", "Ön kapak, sırt ve arka kapağı baskı ölçülerinde tasarla; istersen yapay zekâ ile görsel üret."],
        ["Mizanpaj", "Word dosyanı yükle; iç sayfalar KDP ve yerli matbaa ölçülerinde otomatik dizilsin."],
        ["AI Editör", "Yazım, dil ve anlatım sorunlarını baskıdan önce yakala."],
        ["E-kitap ve sesli kitap", "Aynı metinden EPUB ve seslendirilmiş bölümler hazırla."],
        ["Tanıtım", "Kitabın için bülten ve sosyal medya içerikleri üret."],
      ]
    : [
        ["Cover", "Design front, spine and back cover at print size; generate artwork with AI if you like."],
        ["Layout", "Upload your Word file and get print-ready interior pages for KDP and local printers."],
        ["AI Editor", "Catch spelling, grammar and style issues before printing."],
        ["E-book & audiobook", "Create EPUB and narrated chapters from the same text."],
        ["Promotion", "Generate newsletters and social media posts for your book."],
      ];

  return (
    <InfoPage
      lang={lang}
      current="hakkimizda"
      title={tr ? "Hakkımızda" : "About us"}
      showUpdated={false}
      intro={
        tr ? (
          <p>
            <strong>{COMPANY.brand}</strong>, {COMPANY.legalName} tarafından geliştirilen ve işletilen
            çevrim içi kitap hazırlama platformudur.
          </p>
        ) : (
          <p>
            <strong>{COMPANY.brand}</strong> is an online book preparation platform developed and operated
            by {COMPANY.legalName}, a printing and publishing company based in Istanbul.
          </p>
        )
      }
    >
      <div className="space-y-8 text-[15px] leading-relaxed text-foreground/85">
        <p>
          {tr
            ? "Basım ve yayıncılık alanında çalışan bir şirket olarak bir kitabı baskıya hazırlamanın ne kadar emek istediğini yakından biliyoruz: kapak, iç sayfa düzeni, dil denetimi, e-kitap, tanıtım… Laycoty, yazarların ve yayınevlerinin bu işleri tek yerde, yapay zekâ desteğiyle ve hızlıca yapabilmesi için var."
            : "As a printing and publishing company we know how much work it takes to get a book ready for print: cover, interior layout, proofreading, e-book, promotion… Laycoty lets authors and publishers do all of this in one place, quickly, with the help of AI."}
        </p>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Ne sunuyoruz?" : "What we offer"}
          </h2>
          <ul className="space-y-2">
            {offer.map(([k, d]) => (
              <li key={k} className="flex gap-2">
                <span className="font-bold text-accent">✓</span>
                <span>
                  <strong className="text-foreground">{k}:</strong> {d}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Adı nereden geliyor?" : "Where does the name come from?"}
          </h2>
          <p>
            {tr
              ? "Laycoty; Layout (mizanpaj), Cover (kapak) ve Typesetting (dizgi) kelimelerinden oluşur."
              : "Laycoty combines Layout, Cover and Typesetting."}
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-sans text-lg font-bold text-foreground">
            {tr ? "Şirket bilgileri" : "Company details"}
          </h2>
          <CompanyCard lang={lang} />
        </section>
      </div>
    </InfoPage>
  );
}
