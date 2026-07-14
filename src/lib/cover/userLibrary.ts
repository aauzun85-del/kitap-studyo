// "Yüklemelerim" — kullanıcının kişisel görsel + şablon kütüphanesi.
// Tarayıcının kendi veritabanına (IndexedDB) kaydedilir: sunucu yok, bu
// bilgisayara özel, gizli. aiHistory/coverDraft ile aynı veritabanını
// ("tipostudio" / "kv") paylaşır; yalnızca anahtarlar farklıdır.
//
// İki ayrı koleksiyon:
//  • userImages   → bilgisayardan yüklenen + AI ile üretilen görseller
//  • userTemplates→ kullanıcının kaydettiği tam tasarım anlık görüntüleri
//
// Görseller (data URL) büyük olabildiği için localStorage değil IndexedDB.

import type { CoverDraft } from "./coverDraft";

// --- Görsel kütüphanesi öğesi ---
export type UserImage = {
  id: string;
  image: string; // data URL
  source: "upload" | "ai"; // bilgisayardan mı, AI'dan mı geldi
  createdAt: number;
};

// --- Şablon (tam tasarım anlık görüntüsü) öğesi ---
export type UserTemplate = {
  id: string;
  name: string;
  thumb: string; // küçük önizleme (data URL)
  draft: CoverDraft; // uygulanınca geri yüklenecek tüm tasarım
  createdAt: number;
};

// Tarayıcı kotasını taşırmamak için makul üst sınırlar (en yeniler tutulur).
export const USER_IMAGES_LIMIT = 60;
export const USER_TEMPLATES_LIMIT = 40;

const DB_NAME = "tipostudio"; // eski marka adı — mevcut kullanıcı verisi kaybolmasın diye DEĞİŞTİRME
const STORE = "kv";
const IMAGES_KEY = "userImages";
const TEMPLATES_KEY = "userTemplates";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getKey<T>(key: string): Promise<T[]> {
  if (typeof indexedDB === "undefined") return Promise.resolve([]);
  return openDb()
    .then(
      (db) =>
        new Promise<T[]>((resolve) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(key);
          req.onsuccess = () =>
            resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
          req.onerror = () => resolve([]);
        }),
    )
    .catch(() => []);
}

function putKey<T>(key: string, items: T[]): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return openDb()
    .then(
      (db) =>
        new Promise<void>((resolve) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(items, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        }),
    )
    .catch(() => {
      // yok say (uygulama akışını bozma)
    });
}

/** Kayıtlı görselleri okur. Hata/destek yoksa boş dizi döner. */
export function loadUserImages(): Promise<UserImage[]> {
  return getKey<UserImage>(IMAGES_KEY);
}

/** Görsel listesini kaydeder. Hata olursa sessizce geçer. */
export function saveUserImages(items: UserImage[]): Promise<void> {
  return putKey(IMAGES_KEY, items);
}

/** Kayıtlı şablonları okur. Hata/destek yoksa boş dizi döner. */
export function loadUserTemplates(): Promise<UserTemplate[]> {
  return getKey<UserTemplate>(TEMPLATES_KEY);
}

/** Şablon listesini kaydeder. Hata olursa sessizce geçer. */
export function saveUserTemplates(items: UserTemplate[]): Promise<void> {
  return putKey(TEMPLATES_KEY, items);
}
