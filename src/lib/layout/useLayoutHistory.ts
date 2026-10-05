// Mizanpaj "Geri al / Yinele" geçmişi.
//
// Mizanpajdaki her kalıcı değişiklik (boşluk, sonraki/önceki sayfaya atma,
// paragraf düzeltme, yazı tipi/punto, Word içe aktarma, elle yazma) TEK
// KAYNAĞA — markdown `raw` + Word resim haritası `media` — yazılır. Bu yüzden
// geçmiş yalnızca bu ikiliyi izler: geri almak = eski ikiliyi geri koymak;
// sayfalama ve otomatik kayıt kendiliğinden takip eder.
//
// Adım kuralı: tek tıklık işlemler (Boşluk vb.) her zaman AYRI adımdır.
// Metin kutusunda art arda yazılan harfler ise 1 sn içindeyse TEK adımda
// birleşir (yoksa her harf ayrı adım olurdu).

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaMap } from "./mediaTokens";

type Snap = { raw: string; media: MediaMap };
type Step = { before: Snap; label: string };

const MERGE_MS = 1000;
const LIMIT = 100;

function mediaEqual(a: MediaMap, b: MediaMap): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export function useLayoutHistory(
  raw: string,
  media: MediaMap,
  restore: (raw: string, media: MediaMap) => void,
  fallbackLabel: string,
) {
  const past = useRef<Step[]>([]);
  const future = useRef<Step[]>([]);
  const last = useRef<Snap>({ raw, media });
  const lastAt = useRef(0);
  const lastWasTyping = useRef(false);
  // Bir sonraki değişikliğin adı + yazma (birleşebilir) mı?
  const pendingLabel = useRef<string | null>(null);
  const pendingTyping = useRef(false);
  // Düğmelerin gördüğü özet (ref'ler render'da okunmaz).
  const [view, setView] = useState<{
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  }>({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null });
  const sync = useCallback(() => {
    setView({
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
      undoLabel: past.current[past.current.length - 1]?.label ?? null,
      redoLabel: future.current[future.current.length - 1]?.label ?? null,
    });
  }, []);

  useEffect(() => {
    const prev = last.current;
    if (prev.raw === raw && mediaEqual(prev.media, media)) return;
    const now = Date.now();
    const typing = pendingTyping.current;
    const merge = typing && lastWasTyping.current && now - lastAt.current < MERGE_MS && past.current.length > 0;
    if (!merge) {
      past.current.push({ before: prev, label: pendingLabel.current ?? fallbackLabel });
      if (past.current.length > LIMIT) past.current.shift();
    }
    future.current = [];
    last.current = { raw, media };
    lastAt.current = now;
    lastWasTyping.current = typing;
    pendingLabel.current = null;
    pendingTyping.current = false;
    sync();
  }, [raw, media, fallbackLabel, sync]);

  /** Tek tıklık bir işlemden ÖNCE çağır: adımın adını koyar (ayrı adım olur). */
  const label = useCallback((text: string) => {
    pendingLabel.current = text;
    pendingTyping.current = false;
  }, []);

  /** Metin kutusunda yazarken çağır: art arda yazımlar tek adımda birleşir. */
  const typing = useCallback((text: string) => {
    pendingLabel.current = text;
    pendingTyping.current = true;
  }, []);

  const undo = useCallback((): string | null => {
    const step = past.current.pop();
    if (!step) return null;
    future.current.push({ before: last.current, label: step.label });
    last.current = step.before; // efekt bu geri yüklemeyi yeni adım saymasın
    lastWasTyping.current = false;
    restore(step.before.raw, step.before.media);
    sync();
    return step.label;
  }, [restore, sync]);

  const redo = useCallback((): string | null => {
    const step = future.current.pop();
    if (!step) return null;
    past.current.push({ before: last.current, label: step.label });
    last.current = step.before;
    lastWasTyping.current = false;
    restore(step.before.raw, step.before.media);
    sync();
    return step.label;
  }, [restore, sync]);

  return { ...view, undo, redo, label, typing };
}
