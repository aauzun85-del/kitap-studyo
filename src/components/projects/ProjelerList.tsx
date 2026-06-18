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
import { BookIcon, TrashIcon } from "@/components/PhosphorIcons";
import type { ProjectListItem } from "@/lib/projects/types";

function relTime(iso: string, lang: Locale): string {
  const tr = lang === "tr";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = 60000,
    hr = 3600000,
    day = 86400000;
  if (diff < min) return tr ? "az önce" : "just now";
  if (diff < hr) {
    const n = Math.floor(diff / min);
    return tr ? `${n} dakika önce` : `${n} min ago`;
  }
  if (diff < day) {
    const n = Math.floor(diff / hr);
    return tr ? `${n} saat önce` : `${n}h ago`;
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day);
    return tr ? `${n} gün önce` : `${n}d ago`;
  }
  return new Date(iso).toLocaleDateString(tr ? "tr-TR" : "en-US");
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z" />
    </svg>
  );
}

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
      setThumbs(paths.length ? await signThumbs(createClient(), paths) : new Map());
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

  const count = items?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      {/* ── Başlık ── */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.heading}
            </h1>
            {items !== null && count > 0 && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-xs font-semibold text-accent">
                {count}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{t.subtitle}</p>
        </div>
        <button
          onClick={onNew}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:opacity-95 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, var(--color-accent) 0%, #f5a623 100%)",
            boxShadow: "0 4px 16px color-mix(in srgb, var(--color-accent) 30%, transparent)",
          }}
        >
          <span className="text-base leading-none">+</span>
          {busy ? t.creating : t.newProject}
        </button>
      </div>

      {error && (
        <p className="mb-6 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* ── İçerik ── */}
      {items === null ? (
        // İskelet yükleme
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="aspect-[3/4] w-full animate-pulse bg-foreground/[0.05]" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-foreground/[0.06]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-foreground/[0.05]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Yeni proje kartı (her zaman ilk hücre) */}
          <button
            onClick={onNew}
            disabled={busy}
            className="group flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface/50 text-muted transition hover:border-accent/50 hover:bg-accent-soft/40 hover:text-accent disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl font-light text-accent transition group-hover:scale-110">
              +
            </span>
            <span className="text-sm font-semibold">{busy ? t.creating : t.newProject}</span>
          </button>

          {/* Proje kartları */}
          {items.map((p) => {
            const thumb = p.thumb_path ? thumbs.get(p.thumb_path) : undefined;
            const title = p.title?.trim() || t.untitled;
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/${lang}/kapak?project=${p.id}`)}
                className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/[0.07]"
              >
                {/* Kapak önizleme */}
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full flex-col items-center justify-center gap-2"
                      style={{
                        background:
                          "linear-gradient(150deg, var(--color-accent-soft), var(--color-background))",
                      }}
                    >
                      <BookIcon className="h-9 w-9 text-accent/40" />
                      <span className="px-4 text-center font-sans text-xs font-semibold text-muted line-clamp-2">
                        {title}
                      </span>
                    </div>
                  )}

                  {/* Hover: "Aç" örtüsü */}
                  <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                    <span className="mb-4 rounded-full bg-white/95 px-4 py-1.5 text-xs font-bold text-gray-900 shadow">
                      {t.open} →
                    </span>
                  </div>

                  {/* Hover: aksiyon ikonları (sağ üst) */}
                  <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRename(p.id, p.title);
                      }}
                      title={t.rename}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm transition hover:bg-white hover:text-accent"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                      title={t.delete}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm transition hover:bg-white hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Bilgi */}
                <div className="flex flex-1 flex-col gap-0.5 p-4">
                  <div className="truncate font-sans font-bold leading-tight">{title}</div>
                  <div className="truncate text-sm text-muted">
                    {p.author?.trim() || "—"}
                  </div>
                  <div className="mt-2 font-mono text-[11px] uppercase tracking-wide text-muted/70">
                    {relTime(p.updated_at, lang)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Boş durum ipucu (yeni-proje kartının altında) */}
      {items !== null && count === 0 && (
        <p className="mt-6 text-center text-sm text-muted">{t.emptyHint}</p>
      )}
    </div>
  );
}
