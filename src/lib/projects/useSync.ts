"use client";

// Metin modüllerinin paylaşılan kitap bilgisini (meta) ve gövdesini (manuscript)
// aktif projeye debounce ile yazması için küçük yardımcılar.
//
// KURALLAR (eleştirmen):
// - projectId yoksa (anonim mod) HİÇBİR şey yapma → mevcut davranış aynen korunur.
// - State zaten projeden TOHUMLANDIĞI için (useState ilk değeri), ilk render'daki
//   değer = yüklenen değer; lastRef ona eşitlenir → açılışta gereksiz/boş yazım OLMAZ.
// - Yalnız kullanıcı gerçekten değiştirince yazar.

import { useEffect, useRef } from "react";
import { updateProjectMeta, updateProjectManuscript, updateProjectModule } from "./data";
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

export function useManuscriptSync(
  projectId: string | null,
  text: string,
  moduleKey: ModuleKey,
) {
  const lastRef = useRef(text);
  useEffect(() => {
    if (!projectId) return;
    if (text === lastRef.current) return;
    const tm = setTimeout(() => {
      void updateProjectManuscript(projectId, text, moduleKey, new Date().toISOString()).then(
        () => {
          lastRef.current = text;
        },
      );
    }, DEBOUNCE);
    return () => clearTimeout(tm);
  }, [projectId, text, moduleKey]);
}
