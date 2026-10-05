// AI Editör oturum deposu — kontrol işinin ve sonuçlarının EKRANDAN BAĞIMSIZ
// yaşadığı yer.
//
// Neden: sonuçlar eskiden EditorStudio'nun kendi state'indeydi. Kullanıcı
// inceleme sürerken Mizanpaj/Kapak'a bakıp dönünce bileşen yeniden kurulup her
// şey sıfırlanıyordu; arka planda gönderilmiş istekler ise boşuna sürüyordu.
// Artık iş + ilerleme + sonuçlar proje başına bu modül düzeyindeki depoda durur:
// sayfa geçişlerinde (istemci tarafı gezinme) yaşamaya devam eder, geri
// dönünce kaldığı yerden görünür. Tam sayfa yenilemede (F5) bellek sıfırlanır.
//
// Durdur: her işin bir AbortController'ı var. stopJob → gönderilmemiş parçalar
// hiç gönderilmez, beklenenler bırakılır; o ana kadar bulunanlar korunur.
// cancelJob (yeni dosya / Temizle) → iş sessizce iptal, sonuçlar yazılmaz.

import { useSyncExternalStore } from "react";
import type { Suggestion, Decision } from "@/components/editor/EditorStudio";
import type { DocxEdit } from "./docxEdit";

export type CheckKind = "check" | "review" | "risk" | "genre";

export type Progress = { done: number; total: number };

export type EditorSession = {
  /** Şu an çalışan AI kontrolü (yoksa null). */
  running: CheckKind | null;
  /** Parça ilerlemesi (tek parçalık metinde null). */
  progress: Progress | null;
  suggestions: Suggestion[] | null;
  decisions: Record<number, Decision>;
  checkError: string | null;
  /** Kontrol anındaki metnin sabit kopyası (öneri bağlamı bundan hesaplanır). */
  checkedText: string;
  /** Kullanıcı durdurduysa: kaç parça incelenmişti. */
  stopped: Progress | null;
  /** Yüklenen orijinal .docx + kabul edilen düzeltmeler (biçimi koruyarak dışa aktarım için). */
  originalDocx: ArrayBuffer | null;
  docxEdits: DocxEdit[];
};

const EMPTY: EditorSession = {
  running: null,
  progress: null,
  suggestions: null,
  decisions: {},
  checkError: null,
  checkedText: "",
  stopped: null,
  originalDocx: null,
  docxEdits: [],
};

const sessions = new Map<string, EditorSession>();
const listeners = new Map<string, Set<() => void>>();
const controllers = new Map<string, AbortController>();

export function getSession(key: string): EditorSession {
  return sessions.get(key) ?? EMPTY;
}

export function patchSession(
  key: string,
  patch: Partial<EditorSession> | ((s: EditorSession) => Partial<EditorSession>),
): void {
  const cur = getSession(key);
  const p = typeof patch === "function" ? patch(cur) : patch;
  sessions.set(key, { ...cur, ...p });
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

const noop = () => () => {};

/** Bir oturuma abone olur; key null ise boş oturum döner. */
export function useEditorSession(key: string | null): EditorSession {
  return useSyncExternalStore(
    key ? (fn) => subscribe(key, fn) : noop,
    () => (key ? getSession(key) : EMPTY),
    () => EMPTY,
  );
}

/** Yeni bir AI kontrolü başlatır (çalışan varsa iptal eder). */
export function beginJob(key: string, kind: CheckKind): AbortSignal {
  controllers.get(key)?.abort();
  const c = new AbortController();
  controllers.set(key, c);
  patchSession(key, {
    running: kind,
    progress: null,
    stopped: null,
    checkError: null,
    suggestions: null,
    decisions: {},
    checkedText: "",
  });
  return c.signal;
}

/** Bu sinyal hâlâ oturumun güncel işi mi? (Değilse sonuç yazılmaz.) */
export function isCurrentJob(key: string, signal: AbortSignal): boolean {
  return controllers.get(key)?.signal === signal;
}

/** İş bitti (normal ya da durdurulmuş) — güncelse kaydı kapatır. */
export function finishJob(key: string, signal: AbortSignal, patch: Partial<EditorSession>): void {
  if (!isCurrentJob(key, signal)) return;
  controllers.delete(key);
  patchSession(key, { ...patch, running: null, progress: null });
}

/** "Durdur": kalan parçalar gönderilmez; o ana kadar bulunanlar korunur. */
export function stopJob(key: string): void {
  controllers.get(key)?.abort();
}

/** Sessiz iptal (yeni metin yüklendi vb.): iş düşer, sonuç yazılmaz. */
export function cancelJob(key: string): void {
  const c = controllers.get(key);
  if (!c) return;
  controllers.delete(key);
  c.abort();
  patchSession(key, { running: null, progress: null });
}

/** Oturumu tamamen unutur (projesiz/anonim editörden çıkarken). */
export function dropSession(key: string): void {
  cancelJob(key);
  sessions.delete(key);
  listeners.delete(key);
}
