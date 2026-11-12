// YASAL METİNLER — /[lang]/yasal/[slug] sayfalarının içeriği.
//
// Metinlerdeki yer tutucular sayfada doldurulur (bkz. LegalText):
//   {unvan} {kisaUnvan} {adres} {vergiDairesi} {vergiNo} {mersis} {sicil} {telefon}
//   {eposta} {site} {marka} {gecerlilik} {hosgeldin} {iadeGun} {paketler} {ekJetonlar}
//   [[slug]] → o sayfaya bağlantı (yasal belge, "fiyatlar", "iletisim", "hakkimizda").
//
// Bağlayıcı dil Türkçedir; İngilizce sayfada aynı Türkçe metin bir notla gösterilir.

import type { Locale } from "@/i18n/config";

export type LegalSection = {
  h: string;
  p?: string[];
  list?: string[];
  after?: string[]; // listeden SONRA gelen paragraflar
};

export type LegalDoc = {
  slug: string;
  title: Record<Locale, string>;
  intro?: string;
  sections: LegalSection[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "mesafeli-satis-sozlesmesi",
    title: { tr: "Mesafeli Satış Sözleşmesi", en: "Distance Sales Agreement" },
    sections: [
      {
        h: "1. Taraflar",
        p: ["SATICI:"],
        list: [
          "Unvan: {unvan}",
          "Adres: {adres}",
          "Vergi dairesi / Vergi no: {vergiDairesi} / {vergiNo}",
          "MERSİS no: {mersis}",
          "Ticaret sicil: {sicil}",
          "Telefon: {telefon}",
          "E-posta: {eposta}",
          "Web sitesi: {site}",
        ],
      },
      {
        h: "",
        p: [
          "ALICI: {site} üzerinde üyelik oluşturarak sipariş veren kişidir. ALICI'nın bilgileri, üyelik ve sipariş sırasında verdiği bilgilerdir.",
        ],
      },
      {
        h: "2. Sözleşmenin konusu",
        p: [
          "Bu sözleşmenin konusu, ALICI'nın {site} adresindeki {marka} platformu üzerinden elektronik ortamda sipariş verdiği dijital hizmet paketinin (yazılım kullanım paketi) satışı ve ifasıdır. Tarafların hak ve yükümlülükleri 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümlerine göre belirlenir.",
        ],
      },
      {
        h: "3. Hizmetin temel nitelikleri",
        p: [
          "{marka}, kitap hazırlamak için kullanılan çevrim içi bir yazılım hizmetidir: kapak tasarımı, mizanpaj (iç sayfa düzeni), yapay zekâ destekli editör, e-kitap, sesli kitap ve tanıtım içerikleri.",
          "Yazılım kullanım paketi; satın alındığı andan itibaren {gecerlilik} gün geçerli belirli sayıda jeton ile bu süre boyunca hesabındaki tüm projelerin dosyalarını sınırsız sayıda indirme ve dışa aktarma hakkı sağlar. Süre dolduğunda indirme hakkı sona erer; projeler hesapta kalır. Yapay zekâ işlemlerinin her biri belirli sayıda jeton harcar; güncel jeton bedelleri [[fiyatlar]] sayfasında yayımlanır.",
          "Süresi dolan paketteki kullanılmamış jetonlar geçersiz olur; jetonlar paraya çevrilemez ve başka bir hesaba devredilemez.",
          "Paketler bir yazılım kullanım hizmetidir. Jeton, yalnızca {marka} içindeki yapay zekâ işlemlerini ölçen bir kullanım birimidir; para, elektronik para veya ödeme aracı değildir, üçüncü kişilere satılamaz ve {marka} dışında kullanılamaz.",
        ],
      },
      {
        h: "4. Fiyat ve ödeme",
        p: [
          "Paketlerin adı, jeton miktarı ve satış fiyatı sipariş sırasında ve [[fiyatlar]] sayfasında gösterilir: {paketler}. Aktif paketi olan üyeler ayrıca ek jeton satın alabilir: {ekJetonlar}. Ek jeton, satın alındığı andan itibaren {gecerlilik} gün geçerlidir ve tek başına indirme hakkı vermez. Üst pakete geçmek isteyen üye yeni paketi kendi fiyatından satın alır; kalan jetonları silinmez. Fiyatlar Türk lirasıdır ve KDV dahildir.",
          "Ödeme, banka/kredi kartıyla lisanslı ödeme kuruluşunun güvenli ödeme sayfası üzerinden yapılır. Kart bilgileri SATICI tarafından görülmez ve saklanmaz; doğrudan ödeme kuruluşu tarafından işlenir.",
        ],
      },
      {
        h: "5. İfa (hizmetin sunulması)",
        p: [
          "Hizmet fiziksel teslimat içermez. Ödemenin onaylanmasıyla paket ALICI'nın hesabına hemen tanımlanır.",
        ],
      },
      {
        h: "6. Cayma hakkı",
        p: [
          "Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin birinci fıkrasının (ğ) ve (h) bentleri uyarınca, elektronik ortamda anında ifa edilen hizmetlere, tüketiciye anında teslim edilen gayrimaddi mallara ve cayma hakkı süresi sona ermeden önce tüketicinin onayı ile ifasına başlanan hizmetlere ilişkin sözleşmelerde cayma hakkı kullanılamaz. ALICI, siparişi onaylarken jetonların hesabına tanımlanmasıyla hizmetin ifasına başlanacağını ve bu nedenle cayma hakkının bulunmadığını bildiğini kabul eder.",
          "Buna karşın SATICI, [[iptal-ve-iade]] sayfasında yazılı durumlarda gönüllü olarak iade yapar: paketten hiç jeton harcanmamış ve hiç indirme yapılmamışsa, satın alma tarihinden itibaren {iadeGun} gün içinde {eposta} adresine yazılarak iade istenebilir.",
        ],
      },
      {
        h: "7. Tarafların yükümlülükleri",
        list: [
          "SATICI, hizmeti bu sözleşmede ve sitede belirtilen niteliklere uygun olarak sunar; planlı bakım dışında hizmetin kesintisiz olması için makul özeni gösterir.",
          "Teknik bir arıza nedeniyle tamamlanamayan yapay zekâ işlemlerinin jetonları ALICI'nın hesabına otomatik olarak geri yüklenir.",
          "ALICI, üyelik bilgilerinin doğruluğundan ve hesabının güvenliğinden sorumludur.",
          "ALICI, platforma yüklediği metin, görsel ve diğer içeriklerin kullanım haklarına sahip olduğunu ve hukuka aykırı içerik yüklemeyeceğini kabul eder.",
        ],
      },
      {
        h: "8. Fikri haklar",
        p: [
          "ALICI'nın yüklediği metinler ile platformda hazırladığı kapak, mizanpaj ve diğer çıktılar ALICI'ya aittir. {marka} yazılımı, arayüzü ve markası SATICI'ya aittir.",
        ],
      },
      {
        h: "9. Şikâyet ve uyuşmazlıklar",
        p: [
          "Şikâyet ve talepler için önce {eposta} adresine veya {telefon} numarasına başvurulabilir.",
          "Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar içinde ALICI'nın yerleşim yerindeki ya da işlemin yapıldığı yerdeki Tüketici Hakem Heyetine, bu sınırları aşan uyuşmazlıklarda Tüketici Mahkemesine başvurulabilir. Başvuru e-Devlet üzerinden Tüketici Bilgi Sistemi (TÜBİS) ile de yapılabilir.",
        ],
      },
      {
        h: "10. Yürürlük",
        p: [
          "ALICI, siparişi onaylamadan önce [[on-bilgilendirme-formu]] ile bu sözleşmeyi okuduğunu ve kabul ettiğini elektronik ortamda onaylar. Sözleşme, siparişin onaylanmasıyla yürürlüğe girer. Sözleşme metni bu sayfada her zaman erişilebilir durumdadır; siparişin onaylanmasıyla birlikte Ön Bilgilendirme Formu ve bu sözleşme ALICI'nın e-posta adresine de gönderilir.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "on-bilgilendirme-formu",
    title: { tr: "Ön Bilgilendirme Formu", en: "Preliminary Information Form" },
    intro:
      "Bu form, Mesafeli Sözleşmeler Yönetmeliği uyarınca sipariş vermeden önce bilmen gerekenleri özetler.",
    sections: [
      {
        h: "Satıcı",
        list: [
          "Unvan: {unvan}",
          "Adres: {adres}",
          "Vergi dairesi / Vergi no: {vergiDairesi} / {vergiNo}",
          "MERSİS no: {mersis}",
          "Ticaret sicil: {sicil}",
          "Telefon: {telefon} · E-posta: {eposta}",
          "Web sitesi: {site}",
        ],
      },
      {
        h: "Hizmetin temel nitelikleri",
        p: [
          "{marka} yazılım kullanım paketi: {gecerlilik} gün geçerli jeton + bu süre boyunca hesabındaki tüm projeleri sınırsız sayıda indirme ve dışa aktarma hakkı. Süre dolunca indirme hakkı sona erer; projelerin hesabında kalır. Jetonlar yapay zekâ işlemlerinde (kapak görseli üretimi, seslendirme, editör incelemesi vb.) harcanır. İşlem başına jeton bedelleri [[fiyatlar]] sayfasındadır. Hizmet, güncel bir internet tarayıcısı ve internet bağlantısıyla çalışır; kurulum gerekmez.",
        ],
      },
      {
        h: "Toplam fiyat",
        p: ["Paketler: {paketler}. Ek jeton (aktif paketi olan üyeler için, {gecerlilik} gün geçerli, indirme hakkı içermez): {ekJetonlar}. Fiyatlar Türk lirasıdır ve KDV dahildir. Ek bir ücret (kargo vb.) yoktur."],
      },
      {
        h: "Ödeme ve ifa",
        p: [
          "Ödeme banka/kredi kartıyla (lisanslı ödeme kuruluşunun güvenli ödeme sayfası üzerinden) yapılır. Paket, ödeme onaylanınca hesabına hemen tanımlanır.",
        ],
      },
      {
        h: "Cayma hakkı",
        p: [
          "Hizmet elektronik ortamda, onayınla hemen ifa edilmeye başlandığı için Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin birinci fıkrasının (ğ) ve (h) bentleri gereği cayma hakkı yoktur. Hiç jeton harcanmamış ve hiç indirme yapılmamış paketler için {iadeGun} gün içinde gönüllü iade yapılır; ayrıntılar [[iptal-ve-iade]] sayfasındadır.",
        ],
      },
      {
        h: "Şikâyet",
        p: [
          "{eposta} · {telefon}. Parasal sınırlar içinde Tüketici Hakem Heyetine, sınırları aşan durumlarda Tüketici Mahkemesine başvurabilirsin.",
        ],
      },
      {
        h: "Kişisel veriler",
        p: ["Kişisel verilerin [[kvkk-aydinlatma-metni]] ve [[gizlilik-politikasi]] kapsamında işlenir."],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "iptal-ve-iade",
    title: { tr: "Teslimat, İptal ve İade Koşulları", en: "Delivery, Cancellation & Refund Policy" },
    sections: [
      {
        h: "Teslimat",
        p: [
          "{marka} paketleri dijital hizmettir; kargo veya fiziksel teslimat yoktur. Ödeme onaylandığında paket üye hesabına elektronik ortamda tanımlanır ve {gecerlilik} gün boyunca kullanılabilir. Hazırladığın dosyaları hesabından indirirsin.",
        ],
      },
      {
        h: "Kısaca",
        p: [
          "Yazılım kullanım paketleri dijital hizmettir; ödeme onaylanınca hesabına hemen tanımlanır. Bu yüzden yasal cayma hakkı yoktur (Mesafeli Sözleşmeler Yönetmeliği md. 15/1-ğ ve h). Yine de aşağıdaki durumlarda paranı iade ediyoruz.",
        ],
      },
      {
        h: "Ne zaman iade alırsın?",
        list: [
          "Paketten hiç jeton harcamadıysan ve hiç dosya indirmediysen: satın alma tarihinden itibaren {iadeGun} gün içinde tam iade.",
          "Aynı ödeme yanlışlıkla iki kez alındıysa: fazla alınan tutarın tamamı iade edilir.",
          "Hizmet bizden kaynaklanan bir sorun nedeniyle hiç sunulamadıysa: tam iade.",
        ],
      },
      {
        h: "İade edilmeyen durumlar",
        list: [
          "Paketten jeton harcanmış veya dosya indirilmişse.",
          "Paket süresi ({gecerlilik} gün) dolduğu için yanan jetonlar.",
          "Üyelikte veya kampanyalarda hediye edilen jetonlar (bunlar paraya çevrilemez).",
        ],
        after: ["Hizmetin ayıplı (kusurlu) sunulması hâlinde 6502 sayılı Kanun'dan doğan yasal hakların saklıdır."],
      },
      {
        h: "Başarısız işlemler",
        p: [
          "Bir yapay zekâ işlemi teknik bir arıza nedeniyle tamamlanamazsa, o işlem için düşülen jetonlar hesabına otomatik olarak geri yüklenir; ayrıca bir şey yapmana gerek yoktur.",
        ],
      },
      {
        h: "Nasıl iade istersin?",
        p: [
          "{eposta} adresine üye olduğun e-posta adresinden yaz; ödeme tarihini ve paket adını belirt. Talebini en geç 3 iş günü içinde yanıtlarız. Onaylanan iade, 14 gün içinde ödemede kullandığın karta yapılır. Kart iadesinin hesabına yansıma süresi bankana göre değişebilir.",
        ],
      },
      {
        h: "Siparişi iptal etmek",
        p: [
          "Ödeme tamamlanmadan sipariş oluşmaz ve hiçbir ücret doğmaz. Ödeme yaptıktan sonra iptal için yukarıdaki iade koşulları geçerlidir.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "gizlilik-politikasi",
    title: { tr: "Gizlilik Politikası", en: "Privacy Policy" },
    sections: [
      {
        h: "Kim sorumlu?",
        p: [
          "{site} adresindeki {marka} platformu {unvan} tarafından işletilir ({adres}). Kişisel verilerin bakımından veri sorumlusu bu şirkettir. Ayrıntılı yasal bilgilendirme için [[kvkk-aydinlatma-metni]] sayfasına bakabilirsin.",
        ],
      },
      {
        h: "Hangi bilgileri topluyoruz?",
        list: [
          "Hesap bilgileri: ad, e-posta adresi, şifren (yalnızca şifrelenmiş hâliyle saklanır; biz göremeyiz). Google ile girersen Google'ın paylaştığı ad ve e-posta.",
          "Çalışmaların: yüklediğin kitap metinleri, görseller ve platformda hazırladığın kapak, mizanpaj ve diğer dosyalar.",
          "Satın alma kayıtları: aldığın paket, tutar, tarih, jeton hareketleri. Kart bilgilerin bize hiç ulaşmaz; ödeme kuruluşu tarafından işlenir.",
          "Teknik kayıtlar: IP adresi, tarayıcı bilgisi, giriş zamanları ve hata kayıtları (güvenlik ve hizmetin çalışması için).",
        ],
      },
      {
        h: "Bu bilgileri ne için kullanıyoruz?",
        list: [
          "Hesabını açmak, girişini sağlamak ve hizmeti sunmak.",
          "İstediğin yapay zekâ işlemlerini (kapak görseli, seslendirme, editör incelemesi vb.) yapmak.",
          "Ödemeleri almak, jetonları hesabına tanımlamak, fatura ve yasal kayıtları tutmak.",
          "Destek taleplerini yanıtlamak, güvenliği sağlamak ve kötüye kullanımı önlemek.",
        ],
        after: [
          "Yüklediğin metinleri kendi yapay zekâ modellerimizi eğitmek için kullanmayız ve hiçbir verini satmayız. Reklam amaçlı izleme yapmayız.",
        ],
      },
      {
        h: "Kimlerle paylaşıyoruz?",
        p: [
          "Hizmeti sunabilmek için aşağıdaki hizmet sağlayıcılarla, yalnızca gerektiği kadar veri paylaşırız. Bu sağlayıcıların bir kısmının sunucuları yurt dışındadır:",
        ],
        list: [
          "Supabase — üyelik ve veritabanı (hesap bilgileri, çalışmalar, siparişler).",
          "Vercel — sitenin barındırılması (teknik kayıtlar).",
          "Anthropic — yapay zekâ editör incelemeleri (yalnızca incelettiğin metin).",
          "Replicate — yapay zekâ ile kapak ve tanıtım görseli üretimi ve seslendirme (yalnızca görsel tarifi, gerekli görseller ve seslendirilecek metin).",
          "Lisanslı ödeme kuruluşu — kartla ödeme (kart bilgileri doğrudan ona girilir).",
          "Google Fonts — sitedeki yazı tiplerinin yüklenmesi (IP adresi).",
        ],
      },
      {
        h: "Ne kadar süre saklıyoruz?",
        p: [
          "Hesap ve çalışma verilerini hesabın açık olduğu sürece saklarız. Hesabını silmemizi istersen verilerini silmeye başlarız; satın alma ve fatura kayıtları gibi yasal olarak saklamamız gereken bilgiler, yasal süre boyunca (Türk Ticaret Kanunu gereği 10 yıl) saklanır.",
        ],
      },
      {
        h: "Güvenlik",
        p: [
          "Site yalnızca şifreli bağlantı (HTTPS) ile çalışır. Şifreler şifrelenmiş olarak saklanır. Veritabanında her kullanıcı yalnızca kendi verisini görebilir. Kart ödemeleri lisanslı ödeme kuruluşunun güvenli sayfasında 3D Secure doğrulamasıyla alınır; kart bilgileri bize ulaşmaz ve saklanmaz.",
        ],
      },
      {
        h: "Çerezler",
        p: ["Yalnızca sitenin çalışması için zorunlu çerezler kullanırız; ayrıntılar [[cerez-politikasi]] sayfasında."],
      },
      {
        h: "Haklarını kullanmak",
        p: [
          "Verilerine erişmek, düzeltmek veya silinmesini istemek için {eposta} adresine yazabilirsin. KVKK kapsamındaki tüm hakların [[kvkk-aydinlatma-metni]] sayfasında yazılıdır.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "kvkk-aydinlatma-metni",
    title: { tr: "KVKK Aydınlatma Metni", en: "Personal Data Notice (KVKK)" },
    intro:
      "6698 sayılı Kişisel Verilerin Korunması Kanunu'nun (KVKK) 10. maddesi uyarınca hazırlanmıştır.",
    sections: [
      {
        h: "1. Veri sorumlusu",
        p: [
          "{unvan} — {adres} · Vergi dairesi / no: {vergiDairesi} / {vergiNo} · MERSİS: {mersis} · {sicil} · E-posta: {eposta}",
        ],
      },
      {
        h: "2. İşlenen kişisel veriler",
        list: [
          "Kimlik ve iletişim: ad, e-posta adresi.",
          "Müşteri işlem: sipariş, ödeme tutarı ve tarihi, jeton hareketleri, destek yazışmaları.",
          "İşlem güvenliği: IP adresi, giriş kayıtları, şifrelenmiş şifre.",
          "Kullanıcı içeriği: yüklenen metinler, görseller ve hazırlanan dosyalar (bunların içinde kişisel veri bulunması kullanıcının tercihine bağlıdır).",
        ],
      },
      {
        h: "3. İşleme amaçları",
        list: [
          "Üyelik sözleşmesinin ve satın alınan hizmetin ifası,",
          "Ödemelerin alınması, faturalandırma ve muhasebe kayıtlarının tutulması,",
          "Bilgi güvenliğinin sağlanması ve kötüye kullanımın önlenmesi,",
          "Taleplerin ve şikâyetlerin yanıtlanması,",
          "Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurumların taleplerinin karşılanması.",
        ],
      },
      {
        h: "4. Toplama yöntemi ve hukuki sebep",
        p: [
          "Kişisel veriler; üyelik formu, Google ile giriş, sipariş ve destek talepleri aracılığıyla elektronik ortamda toplanır. Hukuki sebepler: sözleşmenin kurulması ve ifası (KVKK md. 5/2-c), hukuki yükümlülüğün yerine getirilmesi (md. 5/2-ç), bir hakkın tesisi, kullanılması veya korunması (md. 5/2-e) ve temel hak ve özgürlüklere zarar vermemek kaydıyla meşru menfaat (md. 5/2-f).",
        ],
      },
      {
        h: "5. Aktarım",
        p: [
          "Kişisel veriler, yukarıdaki amaçlarla sınırlı olarak; hizmet aldığımız barındırma, veritabanı, yapay zekâ ve ödeme hizmeti sağlayıcılarına (listesi [[gizlilik-politikasi]] sayfasında), muhasebe ve hukuk danışmanlarımıza ve talep hâlinde yetkili kamu kurumlarına aktarılabilir. Hizmet sağlayıcılarımızın bir kısmının sunucuları yurt dışında bulunduğundan, veriler KVKK'nın 9. maddesinde öngörülen şartlara uygun olarak yurt dışına aktarılabilir.",
        ],
      },
      {
        h: "6. Haklarınız (KVKK md. 11)",
        list: [
          "Kişisel verilerinizin işlenip işlenmediğini öğrenme ve işlenmişse buna ilişkin bilgi talep etme,",
          "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,",
          "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,",
          "Eksik veya yanlış işlenmişse düzeltilmesini isteme,",
          "KVKK md. 7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme,",
          "Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,",
          "Münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme,",
          "Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme.",
        ],
      },
      {
        h: "7. Başvuru",
        p: [
          "Taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ'e uygun olarak; yazılı olarak {adres} adresine ya da sistemimizde kayıtlı e-posta adresinizden {eposta} adresine iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "cerez-politikasi",
    title: { tr: "Çerez Politikası", en: "Cookie Policy" },
    sections: [
      {
        h: "Çerez nedir?",
        p: [
          "Çerez, bir sitenin tarayıcına kaydettiği küçük bir metin dosyasıdır. {marka}, yalnızca sitenin çalışması için zorunlu olan çerezleri kullanır. Reklam, takip veya istatistik çerezi kullanmayız; bu yüzden çerez onayı istemeyiz.",
        ],
      },
      {
        h: "Kullandığımız çerezler",
        list: [
          "Oturum çerezleri (sb-… ile başlayanlar): giriş yaptığını hatırlar. Çıkış yapınca silinir.",
          "Arayüz tercihi (sb_collapsed): sol menüyü açık mı kapalı mı bıraktığını hatırlar. 1 yıl saklanır.",
        ],
      },
      {
        h: "Tarayıcı depolaması",
        p: [
          "Çalışmalarının kaybolmaması için bazı taslak bilgileri ve arayüz tercihlerini tarayıcının kendi depolama alanında (localStorage, IndexedDB) tutabiliriz. Bu bilgiler yalnızca senin cihazında kalır.",
        ],
      },
      {
        h: "Üçüncü taraf istekleri",
        p: ["Yazı tipleri Google Fonts'tan yüklenir; bu sırada IP adresin Google'a iletilir, çerez yerleştirilmez."],
      },
      {
        h: "Çerezleri nasıl silersin?",
        p: [
          "Tarayıcının ayarlarından çerezleri silebilir veya engelleyebilirsin. Zorunlu çerezleri engellersen giriş yapamazsın.",
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "kullanim-kosullari",
    title: { tr: "Kullanım Koşulları", en: "Terms of Use" },
    intro:
      "Bu koşullar, {site} adresindeki {marka} platformunun kullanımını düzenleyen üyelik sözleşmesidir. Üye olarak bu koşulları kabul etmiş olursun.",
    sections: [
      {
        h: "1. Hizmet sağlayıcı",
        p: ["{marka}, {unvan} ({adres}) tarafından işletilir."],
      },
      {
        h: "2. Üyelik",
        list: [
          "Üye olmak ücretsizdir. Üye olurken doğru bilgi vermen gerekir.",
          "18 yaşından küçüksen platformu veli veya vasinin izniyle kullanabilirsin; satın alma işlemleri veli veya vasi tarafından yapılmalıdır.",
          "Hesabının ve şifrenin güvenliğinden sen sorumlusun. Hesabının izinsiz kullanıldığını fark edersen hemen {eposta} adresine bildir.",
        ],
      },
      {
        h: "3. Jetonlar ve paketler",
        p: [
          "Üyelik ücretsizdir. Jeton ve dosya indirme hakkı için yazılım kullanım paketi satın alınır. Satın alma koşulları [[mesafeli-satis-sozlesmesi]] ve [[iptal-ve-iade]] sayfalarındadır; güncel fiyatlar [[fiyatlar]] sayfasındadır.",
        ],
      },
      {
        h: "4. İçeriklerin",
        list: [
          "Yüklediğin metinler ve hazırladığın dosyalar sana aittir. Bunları yalnızca sana hizmet vermek için işleriz.",
          "Yüklediğin içeriğin telif ve kullanım haklarına sahip olduğunu kabul edersin.",
          "Hukuka aykırı, başkalarının haklarını ihlal eden, nefret söylemi veya müstehcenlik içeren içerik yükleyemezsin.",
        ],
      },
      {
        h: "5. Yapay zekâ çıktıları",
        p: [
          "Yapay zekâ önerileri ve üretilen görseller hatalı veya eksik olabilir. Kitabını baskıya ya da yayına göndermeden önce son kontrolü yapmak senin sorumluluğundadır. Ürettiğin görsellerin ve metinlerin kullanımında ilgili yapay zekâ hizmet sağlayıcılarının kurallarına da uyman gerekir.",
        ],
      },
      {
        h: "6. Yasak kullanımlar",
        list: [
          "Platformu otomatik araçlarla aşırı yüklemek, güvenlik önlemlerini aşmaya çalışmak.",
          "Başkasının hesabını kullanmak veya hesabını başkalarıyla ticari amaçla paylaşmak.",
          "Platformu yasa dışı amaçlarla kullanmak.",
        ],
        after: ["Bu kurallara uyulmaması hâlinde hesap askıya alınabilir veya kapatılabilir; bu durumda e-postayla bilgi veririz. Tüketici mevzuatından doğan hakların saklıdır."],
      },
      {
        h: "7. Hizmet değişiklikleri",
        p: [
          "Platformu geliştirmek için özellikleri değiştirebilir veya yenilerini ekleyebiliriz. Satın aldığın paketin süresi boyunca paketin temel niteliklerini aleyhine değiştirmeyiz.",
        ],
      },
      {
        h: "8. Hesabın kapatılması",
        p: [
          "Hesabını istediğin zaman kapatabilirsin; bunun için {eposta} adresine yazman yeterli. Kapatılan hesaptaki kullanılmamış jetonlar, [[iptal-ve-iade]] koşulları dışında iade edilmez.",
        ],
      },
      {
        h: "9. Uygulanacak hukuk",
        p: [
          "Bu koşullar Türk hukukuna tabidir. Tüketici uyuşmazlıklarında Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.",
        ],
      },
      {
        h: "10. Değişiklikler",
        p: [
          "Bu koşulları güncelleyebiliriz. Önemli değişiklikleri sitede duyururuz; güncel metin her zaman bu sayfadadır.",
        ],
      },
    ],
  },
];

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
