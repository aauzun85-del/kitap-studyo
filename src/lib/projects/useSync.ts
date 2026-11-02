"use client";

// Metin modüllerinin paylaşılan kitap bilgisini (meta) ve gövdesini (manuscript)
// aktif projeye debounce ile yazması için küçük yardımcılar.
//
// KURALLAR (eleştirmen):
// - projectId yoksa (anonim mod) HİÇBİR şey yapma → mevcut davranış aynen korunur.
// - State zaten projeden TOHUMLANDIĞI için (useState ilk değeri), ilk render'daki
//   değer = yüklenen değer; lastRef ona eşitlenir → açılışta gereksiz/boş yazım OLMAZ.
// - Yalnız kullanıcı gerçekten değiştirince yazar.

import { useCallback, useEffect, useRef } from "react";
import { updateProjectMeta, updateProjectManuscript, updateProjectModule } from "./data";
import { publishSaveStatus } from "./saveStatus";
import type { ProjectMeta, ModuleKey } from "./types";

const DEBOUNCE = 700;

export function useMetaSync(projectId: string | null, meta: Partial<ProjectMeta>) {
  const cur = JSON.stringify(meta);
  const lastRef = useRef(cur); // ilk render = tohumlanan (yüklenen) değer
  useEffect(() => {
    if (!projectId) return;
    if (cur === lastRef.current) return;
    const tm = setTimeout(() => {
      void updateProjectMeta(projectId, meta).then(() => {
        lastRef.current = cur;
      });
    }, DEBOUNCE);
    return () => clearTimeout(tm);
    // meta, cur'dan türetilir; closure doğru meta'yı yakalar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, cur]);
}

// Bir modülün kendi ayar dilimini (envelope.modules.<key>) debounce ile yazar.
// `disabled` (örn. İndir ekranının salt-okunur dışa aktarım modu) iken hiç
// yazmaz. Sayfadan çıkarken (başka adıma geçiş / sekme kapanışı) bekleyen son
// değişiklik hemen gönderilir → son ayar kaybolmasın.
export function useModuleSync(
  projectId: string | null,
  key: Exclude<ModuleKey, "cover">,
  slice: unknown,
  disabled = false,
) {
  const cur = JSON.stringify(slice);
  const lastRef = useRef(cur); // ilk render = yüklenen ya da varsayılan değer
  const pendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || disabled) return;
    if (cur === lastRef.current) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = cur;
    const tm = setTimeout(() => {
      const v = cur;
      void updateProjectModule(projectId, key, JSON.parse(v)).then(() => {
        lastRef.current = v;
        if (pendingRef.current === v) pendingRef.current = null;
      });
    }, DEBOUNCE);
    return () => clearTimeout(tm);
  }, [projectId, key, cur, disabled]);
  useEffect(() => {
    if (!projectId || disabled) return;
    const flush = () => {
      const v = pendingRef.current;
      if (!v || v === lastRef.current) return;
      pendingRef.current = null;
      lastRef.current = v;
      void updateProjectModule(projectId, key, JSON.parse(v));
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [projectId, key, disabled]);
}

// Kitap metnini debounce ile yazar + kayıt durumunu yayınlar (saveStatus).
// - Sayfadan çıkarken (adım değişimi / sekme kapanışı) bekleyen son metin HEMEN
//   gönderilir → son 0,7 sn'de yazılanlar kaybolmaz (eskiden kayboluyordu).
// - Hata yutulmaz: durum "error" olur, kullanıcı Kaydet ile yeniden dener.
// - `saveNow()` → bekleme olmadan kaydet ("Kaydet" düğmesi / ⌘S). Değişiklik
//   yoksa ağa gitmez, yalnız "Kaydedildi" güvencesini tazeler.
export function useManuscriptSync(
  projectId: string | null,
  text: string,
  moduleKey: ModuleKey,
  initialSavedAt: string | null = null,
) {
  const lastRef = useRef(text);
  const pendingRef = useRef<string | null>(null);
  // Son metni event handler'ların (saveNow) görmesi için ref'te tut; render
  // sırasında değil, commit sonrası (effect) güncellenir.
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);
  const savedAtRef = useRef<string | null>(initialSavedAt);

  const write = useCallback(
    async (v: string) => {
      if (!projectId) return;
      publishSaveStatus({ state: "saving", savedAt: savedAtRef.current });
      const now = new Date().toISOString();
      try {
        await updateProjectManuscript(projectId, v, moduleKey, now);
        lastRef.current = v;
        if (pendingRef.current === v) pendingRef.current = null;
        savedAtRef.current = now;
        // Bu arada yeni yazı geldiyse "dirty" kalsın, "saved" demeyelim.
        publishSaveStatus({
          state: textRef.current === v ? "saved" : "dirty",
          savedAt: now,
        });
      } catch {
        publishSaveStatus({ state: "error", savedAt: savedAtRef.current });
      }
    },
    [projectId, moduleKey],
  );

  // Açılışta son bulut kaydının saatini göster (varsa).
  useEffect(() => {
    if (!projectId) return;
    publishSaveStatus({ state: "saved", savedAt: savedAtRef.current });
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (text === lastRef.current) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = text;
    publishSaveStatus({ state: "dirty", savedAt: savedAtRef.current });
    const tm = setTimeout(() => void write(text), DEBOUNCE);
    return () => clearTimeout(tm);
  }, [projectId, text, write]);

  useEffect(() => {
    if (!projectId) return;
    const flush = () => {
      const v = pendingRef.current;
      if (!v || v === lastRef.current) return;
      pendingRef.current = null;
      lastRef.current = v;
      void updateProjectManuscript(projectId, v, moduleKey, new Date().toISOString());
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
      publishSaveStatus(null); // modül kapandı → üst çubuk sabit etikete döner
    };
  }, [projectId, moduleKey]);

  const saveNow = useCallback(() => {
    if (!projectId) return;
    const v = textRef.current;
    if (v === lastRef.current) {
      // Değişiklik yok: güvence ver, ağa gitme.
      publishSaveStatus({ state: "saved", savedAt: savedAtRef.current ?? new Date().toISOString() });
      return;
    }
    void write(v);
  }, [projectId, write]);

  return { saveNow, canSave: !!projectId };
}
