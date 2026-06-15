// Kapak tasarımının otomatik kaydı ("taslak").
// Kullanıcının üzerinde çalıştığı tasarımın TÜM girdileri (başlık, renkler,
// görseller, nesne konumları, katmanlar, kitap ayarları…) tarayıcının kendi
// veritabanına (IndexedDB) kaydedilir. Böylece sayfa yenilense veya sekme
// kapanıp açılsa bile tasarım kaybolmaz; açılışta geri yüklenir.
//
// Neden IndexedDB (localStorage değil)? Kapak görselleri data URL olarak
// megabaytlarca yer kaplayabilir; localStorage ~5 MB ile sınırlıdır. aiHistory
// ile aynı veritabanını ("tipostudio" / "kv") paylaşırız.

import type { CoverColors } from "./templates";
import type { PaperGsm, BindingType } from "./spread";
import type {
  PositionMap,
  LayerMap,
  TextStyleMap,
  CustomObject,
} from "@/components/cover/CoverCanvas";

// Kaydedilen taslağın tam şekli. Tüm alanlar opsiyonel okunur (eski/eksik
// taslaklar uygulamayı bozmasın diye geri yüklerken her alan ayrı kontrol edilir).
export type CoverDraft = {
  v: number; // şema sürümü (ileride göç gerekirse)
  // İçerik
  title?: string;
  author?: string;
  subtitle?: string;
  isbn?: string;
  templateId?: string;
  colorOverrides?: Partial<CoverColors>;
  showGuides?: boolean;
  // Görseller
  coverImage?: string | null;
  coverDarken?: number;
  coverOpacity?: number;
  coverScope?: "front" | "wrap";
  coverFit?: "fill" | "fit";
  autoContrast?: boolean;
  coverPanX?: number;
  coverZoom?: number;
  logoImage?: string | null;
  logoSize?: number;
  logoPos?: "top" | "bottom";
  // AI ayarları (üretilen görsel geçmişi ayrı kaydedilir)
  aiStyle?: string;
  aiModel?: "flux" | "nano" | "ideogram";
  aiEmbedText?: boolean;
  aiDesc?: string;
  aiScope?: "front" | "wrap";
  // Kitap ayarları
  sizeId?: string;
  pageCount?: number;
  paperGsm?: PaperGsm;
  binding?: BindingType;
  spineManualOn?: boolean;
  spineManualValue?: number;
  bleedMm?: number;
  // PDF
  cropMarks?: boolean;
  // Editör
  positions?: PositionMap;
  layers?: LayerMap;
  hidden?: Record<string, boolean>;
  locked?: Record<string, boolean>;
  selectedAngle?: number;
  textStyles?: TextStyleMap;
  objects?: CustomObject[];
};

export const COVER_DRAFT_VERSION = 1;

const DB_NAME = "tipostudio";
const STORE = "kv";
const KEY = "coverDraft";

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

/** Kayıtlı taslağı okur. Yoksa/desteklenmiyorsa/hata olursa null döner. */
export async function loadCoverDraft(): Promise<CoverDraft | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<CoverDraft | null>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => {
        const r = req.result;
        resolve(r && typeof r === "object" ? (r as CoverDraft) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Taslağı kaydeder. Hata olursa sessizce geçer (uygulama akışını bozmaz). */
export async function saveCoverDraft(draft: CoverDraft): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(draft, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // yok say
  }
}

/** Kayıtlı taslağı siler ("yeni tasarım" için). */
export async function clearCoverDraft(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // yok say
  }
}
