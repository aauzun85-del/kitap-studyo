// Üretilen AI kapak görsellerinin "son üretimler" geçmişi.
// Tarayıcının kendi veritabanına (IndexedDB) kaydedilir: sunucu yok, bu
// bilgisayara özel, gizli. localStorage yerine IndexedDB kullanıyoruz çünkü
// görseller (data URL) büyük olabilir ve localStorage ~5 MB ile sınırlı.

export type AiHistoryItem = {
  id: string;
  image: string; // data URL
  scope: "front" | "wrap";
  createdAt: number;
};

export const AI_HISTORY_LIMIT = 6;

const DB_NAME = "tipostudio";
const STORE = "kv";
const KEY = "aiHistory";

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

/** Kayıtlı geçmişi okur. Hata/destek yoksa boş dizi döner. */
export async function loadAiHistory(): Promise<AiHistoryItem[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return await new Promise<AiHistoryItem[]>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as AiHistoryItem[]) : []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Geçmişi kaydeder. Hata olursa sessizce geçer (uygulama akışını bozmaz). */
export async function saveAiHistory(items: AiHistoryItem[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(items, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // yok say
  }
}
