// Kapak kurgusunda yazarın KENDİ fotoğrafı (anı/biyografi konseptleri).
// Kurgu sayfası fotoğrafı tarayıcıda küçültüp burada (IndexedDB, proje başına)
// bekletir; tuval sayfası açılınca alır, kapağa yerleştirir ve siler. Kalıcı
// kayıt tuvalin normal kapak-görseli yolundan (Storage) geçer.
//
// Yapay zekâ bu fotoğrafa DOKUNMAZ: yüz birebir kalır, jeton harcanmaz.

const DB_NAME = "tipostudio-brief";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveBriefPhoto(projectId: string, dataUrl: string): Promise<void> {
  await tx("readwrite", (s) => s.put(dataUrl, projectId));
}

export async function loadBriefPhoto(projectId: string): Promise<string | null> {
  const v = await tx<unknown>("readonly", (s) => s.get(projectId));
  return typeof v === "string" ? v : null;
}

export async function deleteBriefPhoto(projectId: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(projectId));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

// Baskı için yeterli mi? Çerçeveli portre ön kapağın ~%65'i (13 cm kitapta
// ~8,5 cm) → 300 dpi'da ~1000 piksel genişlik gerekir.
export const MIN_PHOTO_WIDTH = 1000;

/** Dosyayı oku, uzun kenarı en çok 2400 px'e indir, JPEG data URL döndür. */
export async function prepareBriefPhoto(
  file: File,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await loadImage(src);
  const MAX = 2400;
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * k);
  const h = Math.round(img.height * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  g.drawImage(img, 0, 0, w, h);
  return { dataUrl: c.toDataURL("image/jpeg", 0.9), width: img.width, height: img.height };
}

/** Siyah-beyaz baskı: hafif kontrastlı gri ton (gümüş jelatin havası). */
export async function toMonoPhoto(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  if (!g) return dataUrl;
  g.filter = "grayscale(1) contrast(1.06)";
  g.drawImage(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.9);
}
