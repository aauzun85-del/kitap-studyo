// Kapak görsellerinin bulut deposu (Supabase Storage) yardımcıları.
//
// KURAL (eleştirmenin 1 nolu tuzağı): JSONB'ye ASLA imzalı (signed) URL yazma —
// onlar süreli, ~1 saat sonra 404 olur. Kalıcı olarak HER ZAMAN storage YOLU
// saklanır. Yükleme anında yol → imzalı URL'e çözülür (fabric render için).
//
// Görsel alanları: CoverDraft.coverImage, .logoImage, .objects[].src.
// coverImage (opak, en büyük) JPEG'e sıkıştırılır; logo + nesne PNG'leri
// (saydam olabilir) olduğu gibi yüklenir.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoverDraft } from "@/lib/cover/coverDraft";

const BUCKET = "cover-images";
const SIGNED_TTL = 60 * 60 * 8; // 8 saat — çalışma oturumu boyunca yeter

function isDataUrl(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith("data:");
}

/** Bir değer zaten storage yolu mu / imzalı URL'den yol çıkarılabilir mi? */
function toStoragePath(value: string): string | null {
  if (value.startsWith("data:")) return null; // yüklenmeli
  // Supabase imzalı/public URL → '/cover-images/<path>?...'
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx !== -1) {
    const after = value.slice(idx + marker.length);
    const path = after.split("?")[0];
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }
  // http(s) ama bizim değil → yol değil
  if (/^https?:\/\//i.test(value)) return null;
  // şema yok → zaten bir yol
  return value;
}

/** data URL'i Blob'a çevirir. */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}

/** Opak büyük görseli JPEG'e indirger (genişlik sınırı + kalite). */
async function compressToJpeg(dataUrl: string, maxW: number, quality: number): Promise<Blob> {
  const img = document.createElement("img");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("img load failed"));
    img.src = dataUrl;
  });
  const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrlToBlob(dataUrl);
  // JPEG saydamlığı desteklemez → beyaz zemin (kapak zaten tam-bleed opaktır)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? new Blob()), "image/jpeg", quality);
  });
}

async function uploadOne(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "application/octet-stream", upsert: true });
  if (error) throw error;
}

// Kısa, deterministik olmayan ek (aynı projede çakışmasın).
function rnd(): string {
  return Math.abs(Date.now() ^ (performance.now() * 1000)).toString(36).slice(0, 8);
}

/**
 * Taslaktaki data: URL görselleri Storage'a yükler ve alanları YOL ile değiştirir.
 * Idempotent: zaten yol/imzalı-URL olan alanlar yola normalleştirilir, yeniden
 * yüklenmez. Döndürülen taslak JSONB'ye yazılmaya HAZIRDIR (yalnız yollar içerir).
 */
export async function uploadDraftImages(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  draft: CoverDraft,
  cache?: Map<string, string>, // data URL -> yüklenmiş yol (aynı görseli tekrar yüklememek için)
): Promise<CoverDraft> {
  const dir = `${userId}/${projectId}`;
  const out: CoverDraft = { ...draft };

  const cached = (dataUrl: string) => cache?.get(dataUrl);
  const remember = (dataUrl: string, path: string) => cache?.set(dataUrl, path);

  // coverImage → JPEG
  const ci = out.coverImage;
  if (ci) {
    if (isDataUrl(ci)) {
      const hit = cached(ci);
      if (hit) {
        out.coverImage = hit;
      } else {
        const blob = await compressToJpeg(ci, 2560, 0.88);
        const path = `${dir}/cover-${rnd()}.jpg`;
        await uploadOne(supabase, path, blob);
        remember(ci, path);
        out.coverImage = path;
      }
    } else {
      out.coverImage = toStoragePath(ci) ?? ci;
    }
  }

  // logoImage → olduğu gibi (saydamlık korunur)
  const li = out.logoImage;
  if (li) {
    if (isDataUrl(li)) {
      const hit = cached(li);
      if (hit) {
        out.logoImage = hit;
      } else {
        const blob = await dataUrlToBlob(li);
        const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const path = `${dir}/logo-${rnd()}.${ext}`;
        await uploadOne(supabase, path, blob);
        remember(li, path);
        out.logoImage = path;
      }
    } else {
      out.logoImage = toStoragePath(li) ?? li;
    }
  }

  // objects[].src → olduğu gibi (AI öğeleri saydam olabilir)
  if (Array.isArray(out.objects)) {
    out.objects = await Promise.all(
      out.objects.map(async (obj) => {
        const src = (obj as { src?: string }).src;
        if (!src) return obj;
        if (isDataUrl(src)) {
          const hit = cached(src);
          if (hit) return { ...obj, src: hit };
          const blob = await dataUrlToBlob(src);
          const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
          const path = `${dir}/obj-${rnd()}.${ext}`;
          await uploadOne(supabase, path, blob);
          remember(src, path);
          return { ...obj, src: path };
        }
        return { ...obj, src: toStoragePath(src) ?? src };
      }),
    );
  }

  return out;
}

/** Taslaktaki storage YOLLARINI imzalı URL'lere çözer (fabric render için). */
export async function resolveDraftImages(
  supabase: SupabaseClient,
  draft: CoverDraft,
): Promise<CoverDraft> {
  const paths = new Set<string>();
  const consider = (v?: string | null) => {
    if (v && !isDataUrl(v) && !/^https?:\/\//i.test(v)) paths.add(v);
  };
  consider(draft.coverImage);
  consider(draft.logoImage);
  if (Array.isArray(draft.objects)) {
    for (const o of draft.objects) consider((o as { src?: string }).src);
  }
  if (paths.size === 0) return draft;

  const list = [...paths];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(list, SIGNED_TTL);
  if (error || !data) return draft;
  const map = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) map.set(list[i], d.signedUrl);
  });

  const sub = (v?: string | null) => (v && map.has(v) ? map.get(v)! : v ?? undefined);
  const out: CoverDraft = {
    ...draft,
    coverImage: sub(draft.coverImage) ?? draft.coverImage,
    logoImage: sub(draft.logoImage) ?? draft.logoImage,
  };
  if (Array.isArray(draft.objects)) {
    out.objects = draft.objects.map((o) => {
      const src = (o as { src?: string }).src;
      return src && map.has(src) ? { ...o, src: map.get(src)! } : o;
    });
  }
  return out;
}

/** Küçük JPEG kapak küçük-resmi üretip yükler, yolunu döndürür. */
export async function uploadThumb(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  dataUrl: string,
): Promise<string> {
  const blob = await compressToJpeg(dataUrl, 360, 0.72);
  const path = `${userId}/${projectId}/thumb.jpg`;
  await uploadOne(supabase, path, blob);
  return path;
}

/** Liste için birden çok thumb yolunu tek seferde imzalar. */
export async function signThumbs(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(clean, SIGNED_TTL);
  data?.forEach((d, i) => {
    if (d.signedUrl) map.set(clean[i], d.signedUrl);
  });
  return map;
}

/** Bir projenin tüm storage dosyalarını siler (silinince çağrılır). */
export async function deleteProjectFolder(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const prefix = `${userId}/${projectId}`;
  // list sayfalı; boşalana dek sürdür.
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (error || !data || data.length === 0) break;
    const paths = data.map((f) => `${prefix}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
    if (data.length < 100) break;
  }
}
