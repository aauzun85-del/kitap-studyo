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
import { updateProjectMeta, updateProjectManuscript } from "./data";
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
