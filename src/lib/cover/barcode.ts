import JsBarcode from "jsbarcode";

/** ISBN/EAN-13 girişinden yalnızca rakamları alır. */
export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** İlk 12 haneden EAN-13 kontrol (sağlama) hanesini hesaplar. */
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** 13 haneli EAN-13 sağlama (kontrol) hanesini doğrular. */
export function isValidEan13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  return ean13CheckDigit(digits.slice(0, 12)) === Number(digits[12]);
}

/**
 * Kullanıcı girişini tamamlar: tam 12 rakam girilmişse doğru kontrol hanesini
 * sonuna ekleyip geçerli 13 haneye çevirir. Diğer durumlarda yalnız rakamları
 * döndürür (değiştirmeden).
 */
export function completeIsbn(raw: string): string {
  const digits = normalizeIsbn(raw);
  if (digits.length === 12) return digits + ean13CheckDigit(digits);
  return digits;
}

/** Tek tıkla denemek için her zaman geçerli rastgele bir test ISBN-13 üretir. */
export function randomTestIsbn(): string {
  // 978 ön eki + 9 rastgele hane + hesaplanmış kontrol hanesi
  let twelve = "978";
  for (let i = 0; i < 9; i++) twelve += Math.floor(Math.random() * 10);
  return twelve + ean13CheckDigit(twelve);
}

/**
 * Geçerli bir ISBN-13 / EAN-13 numarasından taranabilir barkodu PNG dataURL
 * olarak üretir. Geçersizse null döner (yanlış barkod basılmasını önler).
 * Yalnızca tarayıcıda çalışır (document gerektirir).
 */
export function generateBarcodeDataUrl(raw: string): string | null {
  if (typeof document === "undefined") return null;
  const digits = normalizeIsbn(raw);
  if (!isValidEan13(digits)) return null;
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, digits, {
      format: "EAN13",
      width: 2,
      height: 70,
      displayValue: true,
      margin: 8,
      background: "#ffffff",
      lineColor: "#000000",
      fontSize: 16,
      textMargin: 2,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
