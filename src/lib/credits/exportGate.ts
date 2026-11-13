import { PAYMENT_OPEN } from "./pricing";

// İndirme/dışa aktarma kilidi (istemci tarafı).
// canExport false ise indirmeyi engeller ve üyeye ne yapacağını söyler.
// Her indirme fonksiyonunun BAŞINDA çağrılır:
//   if (!requireExport(canExport, lang)) return;
// `silent`: otomatik indirme (?export=1) gibi üyenin düğmeye basmadığı
// durumlarda onay kutusu AÇMA; çağıran kendi "paket gerekli" notunu gösterir.
export function requireExport(canExport: boolean, lang: string, silent = false): boolean {
  if (canExport) return true;
  if (silent || typeof window === "undefined") return false;
  const tr = lang === "tr";
  const msg = tr
    ? PAYMENT_OPEN
      ? "Dosya indirmek için aktif bir paket gerekir. Paketleri görmek ister misin?"
      : "Dosya indirmek için aktif bir paket gerekir. Kartla ödeme henüz açılmadı; paket tanımlatmak için bize yazabilirsin. Paketleri görmek ister misin?"
    : PAYMENT_OPEN
      ? "Downloading files requires an active package. View packages?"
      : "Downloading files requires an active package. Card payment isn't open yet; contact us to have one added. View packages?";
  if (window.confirm(msg)) window.location.href = `/${lang}/fiyatlar`;
  return false;
}
