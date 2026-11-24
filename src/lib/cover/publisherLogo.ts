// YAYINEVİ LOGOSU — hesap düzeyinde (kitaptan bağımsız) tek logo.
//
// Kapak kurgusunda bir kez yüklenir, sonraki her kitapta hazır gelir. Depo:
// cover-images kovası, "<kullanıcı>/brand/publisher-logo.png" (kova kuralı ilk
// klasörün kullanıcı kimliği olmasını ister; üzerine yazma = upsert). Kitabın
// kapağına konan kopya kapak taslağıyla birlikte kitabın kendi klasörüne
// yüklenir → logo sonradan değişse/silinse de eski kapaklar bozulmaz.

import { createClient } from "@/lib/supabase/client";

const BUCKET = "cover-images";

/** Uygulamanın kendi KDY logo dosyası mı ("/kdy/dicon-white.png" vb.)? Kullanıcının
 *  yüklediği görselin adında "/kdy/" geçse de eşleşmez. */
export function isKdyAsset(src?: string | null): boolean {
  return !!src && /^(https?:\/\/[^/]+)?\/kdy\/[a-z-]+\.png(\?.*)?$/.test(src);
}
/** "auto": tuvalde zemine göre beyaz ya da siyah (açık zeminde siyah, koyuda beyaz). */
export type LogoColor = "auto" | "original" | "white" | "black";

async function logoPath(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user ? `${data.user.id}/brand/publisher-logo.png` : null;
}

/** Kayıtlı logonun kısa süreli adresi (önizleme için) ya da null (logo yok). */
export async function loadPublisherLogoUrl(): Promise<string | null> {
  try {
    const path = await logoPath();
    if (!path) return null;
    const { data, error } = await createClient().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return error || !data?.signedUrl ? null : data.signedUrl;
  } catch {
    return null;
  }
}

/** Kayıtlı logo (data URL) — kapağa yerleştirmek için. Yoksa null. */
export async function loadPublisherLogoDataUrl(): Promise<string | null> {
  const url = await loadPublisherLogoUrl();
  if (!url) return null;
  try {
    const blob = await (await fetch(url, { cache: "no-store" })).blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function savePublisherLogo(dataUrl: string): Promise<void> {
  const path = await logoPath();
  if (!path) throw new Error("not signed in");
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await createClient()
    .storage.from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "0" });
  if (error) throw error;
}

export async function deletePublisherLogo(): Promise<void> {
  const path = await logoPath();
  if (!path) throw new Error("not signed in");
  const { error } = await createClient().storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Yüklenen dosyayı logoya hazırlar: en çok 1600 px; saydamlığı olmayan
 * (JPG ya da beyaz zeminli PNG) logolarda beyaza yakın zemin saydam yapılır;
 * çevredeki boşluk kırpılır (kapağa ölçüyle oturtmak için). Çıktı: PNG.
 */
export async function preparePublisherLogo(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImg(await fileToDataUrl(file));
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const px = id.data;
  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] < 250) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha) {
    // Yalnız KENARA BAĞLI beyaz zemin silinir (taşma doldurma): logonun içindeki
    // beyaz yazı/şekiller korunur. 235 üstü tamamen saydam; 215–235 arası
    // yumuşak geçiş (kenar tırtılı olmasın).
    const minOf = (p: number) => Math.min(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const push = (p: number) => {
      if (!seen[p] && minOf(p) > 215) {
        seen[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop()!;
      const m = minOf(p);
      px[p * 4 + 3] = m >= 235 ? 0 : Math.round((px[p * 4 + 3] * (235 - m)) / 20);
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }
  }
  // Boş kenarları kırp.
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("empty");
  ctx.putImageData(id, 0, 0);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return { dataUrl: out.toDataURL("image/png"), width: cw, height: ch };
}

/** Logoyu tek renge çevirir (saydamlık korunur): koyu kapakta beyaz, açıkta siyah. */
export async function recolorLogo(dataUrl: string, color: LogoColor): Promise<string> {
  if (color === "original" || color === "auto") return dataUrl;
  const img = await loadImg(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color === "white" ? "#ffffff" : "#000000";
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** En/boy oranı (genişlik ÷ yükseklik). */
export async function logoAspect(dataUrl: string): Promise<number> {
  const img = await loadImg(dataUrl);
  return img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1;
}
