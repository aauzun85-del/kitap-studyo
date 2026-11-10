// ŞİRKET KİMLİĞİ — sitedeki tüm yasal sayfalar, İletişim/Hakkımızda ve alt bilgi
// buradan okur. Ödeme kuruluşları (PayTR, iyzico) siteyi incelerken bu bilgilerin
// başvurudaki şirketle BİREBİR aynı olmasını ister.
// Değiştirmek için SADECE burayı düzenle. Boş alan sitede sarı "[…]" olarak görünür.
export const COMPANY = {
  brand: "Laycoty",
  legalName: "MİKYAS BASIM YAYIN MATBAACILIK SANAYİ VE TİCARET LTD. ŞTİ.",
  shortName: "Mikyas Basım Yayın Ltd. Şti.",
  address: "Alemdar Mah. Güzelsanatlar Sk. No: 2/A, Cağaloğlu, Fatih / İstanbul, Türkiye",
  taxOffice: "Hocapaşa",
  taxNumber: "6210530488",
  tradeRegistry: "İstanbul Ticaret Sicili 81917-5",
  mersis: "0621053048800001", // MERSİS no — TTSG 3 Mayıs 2017 / 9318 kuruluş ilanından
  phone: "0532 342 68 56", // Müşteri hizmetleri telefonu
  email: "aauzun85@gmail.com", // Destek e-postası (destek@laycoty.com kurulunca değiştir)
  website: "laycoty.com",
};

export type CompanyField = keyof typeof COMPANY;

// Yasal metinlerin son güncellenme tarihi (metin değişince güncelle).
export const LEGAL_UPDATED = { tr: "10 Kasım 2026", en: "10 November 2026" };

// Gönüllü iade süresi (gün): hiç jeton harcanmamış + hiç indirme yapılmamış paket.
export const REFUND_WINDOW_DAYS = 14;
