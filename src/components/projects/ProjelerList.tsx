"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
} from "@/lib/projects/data";
import { signThumbs } from "@/lib/projects/storage";
import { createClient } from "@/lib/supabase/client";
import type { ProjectListItem } from "@/lib/projects/types";

export default function ProjelerList({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const t = dict.projelerStudio;
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await listProjects();
      setItems(rows);
      const paths = rows.map((r) => r.thumb_path).filter((p): p is string => !!p);
      if (paths.length) {
        const map = await signThumbs(createClient(), paths);
        setThumbs(map);
      } else {
        setThumbs(new Map());
      }
    } catch (e) {
      console.error(e);
      setError(t.loadError);
    }
  }, [t.loadError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onNew() {
    setBusy(true);
    try {
      const { id } = await createProject();
      router.push(`/${lang}/kapak?project=${id}`);
    } catch (e) {
      console.error(e);
      setError(t.loadError);
      setBusy(false);
    }
  }

  async function onRename(id: string, current: string) {
    const name = window.prompt(t.renamePrompt, current);
    if (name == null) return;
    await renameProject(id, name.trim());
    await refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    await deleteProject(id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-3xl font-extrabold">{t.heading}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        <button
          onClick={onNew}
          disabled={busy}
          className="rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, var(--color-accent) 0%, #f5a623 100%)",
          }}
        >
          {busy ? t.creating : `+ ${t.newProject}`}
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="text-sm text-muted">…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="font-medium">{t.empty}</p>
          <p className="mt-1 text-sm text-muted">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const thumb = p.thumb_path ? thumbs.get(p.thumb_path) : undefined;
            return (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
              >
                <button
                  onClick={() => router.push(`/${lang}/kapak?project=${p.id}`)}
                  className="block aspect-[3/4] w-full overflow-hidden bg-background"
                  title={t.open}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-4xl text-muted/30">
                      📖
                    </span>
                  )}
                </button>
                <div className="flex flex-1 flex-col p-4">
                  <div className="font-sans font-bold leading-tight">
                    {p.title?.trim() || t.untitled}
                  </div>
                  {p.author && <div className="mt-0.5 text-sm text-muted">{p.author}</div>}
                  <div className="mt-4 flex gap-2 text-xs">
                    <button
                      onClick={() => router.push(`/${lang}/kapak?project=${p.id}`)}
                      className="rounded-full bg-accent px-3 py-1.5 font-semibold text-white transition hover:opacity-90"
                    >
                      {t.open}
                    </button>
                    <button
                      onClick={() => onRename(p.id, p.title)}
                      className="rounded-full border border-border px-3 py-1.5 font-semibold text-muted transition hover:text-foreground"
                    >
                      {t.rename}
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="rounded-full border border-border px-3 py-1.5 font-semibold text-muted transition hover:border-red-300 hover:text-red-600"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
