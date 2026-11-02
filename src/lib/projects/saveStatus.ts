"use client";

// Kayıt durumu deposu — "Kaydediliyor… / Kaydedildi · 21:14 / Kaydedilmemiş
// değişiklik / Kayıt başarısız" bilgisinin EKRANDAN bağımsız yaşadığı yer.
//
// Neden: üst çubuktaki (AppShell) yeşil "Otomatik kaydedilir" yazısı sunucudan
// gelen SABİT bir etiketti; kullanıcı gerçekten kaydedilip kaydedilmediğini
// göremiyordu ("save edip edemediğini anlamıyorum"). Modül (ör. AI Editör)
// buraya yayınlar, üst çubuk buradan okur. Sayfada tek modül olduğundan tek
// küresel değer yeter; modül kapanınca null yayınlar → sabit etiket geri gelir.

import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n/config";

export type SaveState = "dirty" | "saving" | "saved" | "error";
export type SaveStatus = { state: SaveState; savedAt: string | null } | null;

let status: SaveStatus = null;
const listeners = new Set<() => void>();

export function publishSaveStatus(next: SaveStatus): void {
  status = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribe, () => status, () => null);
}

/** "21:14" biçiminde yerel saat (geçersizse boş). */
export function formatSavedTime(iso: string | null, lang: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(lang === "tr" ? "tr-TR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Durum metinleri — AppShell'in sözlüğü yok, bu yüzden burada iki dilde.
export const SAVE_LABELS: Record<Locale, Record<SaveState, string>> = {
  tr: {
    dirty: "Kaydedilmemiş değişiklik",
    saving: "Kaydediliyor…",
    saved: "Kaydedildi",
    error: "Kayıt başarısız — tekrar dene",
  },
  en: {
    dirty: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    error: "Save failed — try again",
  },
};
