// TİPOGRAFİ KURALLARI — Başlık & Sayfa Düzeni (kullanıcı spesifikasyonu, 2026-07).
// Kitap iç sayfa mizanpajında profesyonel tipografi kurallarının TEK doğruluk
// kaynağı. Her iki dizgi motoru da (Typst: template.ts+serialize.ts; JS:
// paginate.ts) değerleri buradan okur — ayrışırlarsa önizleme/PDF sessizce
// farklılaşır.
//
// Kural özeti (öncelik sırası — alttaki üsttekini bozamaz):
//  1. Alt Bölge Koruması: başlık, kullanılabilir yüksekliğin son %20'sinde
//     BAŞLAYAMAZ → sonraki sayfaya taşınır. (Keep-with-next'ten ÖNCE bakılır.)
//  2. Başlık + Devamı Birlikte: başlıktan sonra aynı sayfada en az 2 paragraf
//     satırı bulunmalı; sığmıyorsa başlık paragraf ile birlikte taşınır.
//     (Sonuç: bir sayfa asla başlıkla bitemez.)
//  3. Dul/Yetim: paragraf bölünüyorsa her iki tarafta en az 2 satır kalmalı.
//  4. Başlık boşlukları: önce 2 satır, sonra 1 satır (gövde satır yüksekliği).
//     Sayfa başına gelen başlıkta ÖNCE boşluğu uygulanmaz; SONRA normal.
//  5. Ardışık başlıklar (H2→H3 gibi) arasında tam "önce" boşluğu değil dar
//     boşluk kullanılır.
// Genel ilke: hiçbir kural gereksiz beyaz alan üretmemeli.

export const TYPOGRAPHY_RULES = {
  /** Başlık ÖNCESİ boşluk (gövde satır yüksekliği katı). Kural 1/9. */
  headingBeforeLines: 2,
  /** Başlık SONRASI boşluk (gövde satır yüksekliği katı). Kural 1/9. */
  headingAfterLines: 1,
  /** Ardışık başlıklar arası dar boşluk (gövde satır yüksekliği katı). Kural 6. */
  tightHeadingGapLines: 0.5,
  /** Alt koruma bölgesi: başlık, kullanılabilir yüksekliğin son bu ORANINDA başlayamaz. Kural 3. */
  bottomProtectionZone: 0.2,
  /** Başlıktan sonra aynı sayfada kalması gereken en az paragraf satırı. Kural 2. */
  minParaLinesAfterHeading: 2,
  /** Sayfa sonundan önce paragrafın en az satırı (yetim koruması). Kural 4. */
  minLinesBeforeBreak: 2,
  /** Yeni sayfa başında paragrafın en az satırı (dul koruması). Kural 4. */
  minLinesAfterBreak: 2,
} as const;
