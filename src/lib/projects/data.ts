// Projelerim veri erişim katmanı (tarayıcı tarafı).
//
// Tarayıcı Supabase istemcisini kullanır — oturum çerezi otomatik taşınır, RLS
// her sorguyu kullanıcının kendi satırlarıyla sınırlar.
//
// EŞZAMANLILIK (eleştirmenin blocker'ı): birden çok modül aynı `data` jsonb'sini
// güncelleyebilir. Naif read-merge-write kardeş dilimleri ezebilir. Çözüm:
// proje başına SIRALI yazma kuyruğu + bellekte son-bilinen envelope önbelleği;
// her yazım bir öncekinin TAMAMLANMASINI bekler ve taze state üstüne birleştirir.

import { createClient } from "@/lib/supabase/client";
import type { CoverDraft } from "@/lib/cover/coverDraft";
import {
  type ProjectEnvelope,
  type ProjectListItem,
  type ProjectMeta,
  type ModuleKey,
  type WizardStepKey,
  emptyEnvelope,
  migrateEnvelope,
  deriveListFields,
} from "./types";
import { uploadDraftImages, uploadThumb, deleteProjectFolder } from "./storage";

const writeQueue = new Map<string, Promise<unknown>>();
const envCache = new Map<string, ProjectEnvelope>();
// Aynı oturumda eklenen bir görseli her kayıtta yeniden yüklememek için
// data URL -> storage yolu önbelleği (içerik bazlı; çakışmaz).
const uploadCache = new Map<string, string>();

/** id başına yazımları sıraya dizer (read-merge-write yarışını önler). */
function enqueue<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueue.get(id) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeQueue.set(
    id,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not-authenticated");
  return user.id;
}

async function fetchEnvelope(id: string): Promise<ProjectEnvelope> {
  const supabase = createClient();
  const { data, error } = await supabase.from("projects").select("data").eq("id", id).single();
  if (error) throw error;
  return migrateEnvelope(data?.data);
}

// ── Okuma ───────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, author, thumb_path, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectListItem[];
}

export async function getProject(id: string): Promise<{ id: string; data: ProjectEnvelope }> {
  const env = await fetchEnvelope(id);
  envCache.set(id, env);
  return { id, data: env };
}

// ── Oluştur / yeniden adlandır / sil ─────────────────────────────────────────

export async function createProject(
  seedTitle = "",
  seedAuthor = "",
  seedGenre = "",
  seedIsbn = "",
): Promise<{ id: string; data: ProjectEnvelope }> {
  const supabase = createClient();
  const userId = await requireUserId();
  const env = emptyEnvelope();
  env.meta.title = seedTitle;
  env.meta.author = seedAuthor;
  if (seedGenre) env.meta.genre = seedGenre;
  if (seedIsbn) env.meta.isbn = seedIsbn;
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, title: seedTitle, author: seedAuthor, data: env })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: string }).id;
  envCache.set(id, env);
  return { id, data: env };
}

/** Sihirbaz adımını "tamamlandı" işaretler (kuyruklu — kardeş yazımı ezmez). */
export async function completeWizardStep(id: string, step: WizardStepKey): Promise<void> {
  return enqueue(id, async () => {
    const supabase = createClient();
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const wizard = env.wizard ?? {
      active: true,
      editorCompleted: false,
      layoutCompleted: false,
      coverCompleted: false,
    };
    const key =
      step === "editor" ? "editorCompleted" : step === "layout" ? "layoutCompleted" : "coverCompleted";
    const merged: ProjectEnvelope = {
      ...env,
      wizard: { ...wizard, active: true, [key]: true },
    };
    const { error } = await supabase.from("projects").update({ data: merged }).eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}

export async function renameProject(id: string, title: string): Promise<void> {
  return enqueue(id, async () => {
    const supabase = createClient();
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const merged: ProjectEnvelope = { ...env, meta: { ...env.meta, title } };
    const { error } = await supabase.from("projects").update({ data: merged, title }).eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const userId = await requireUserId();
  // Önce dosyalar (başarısız olursa satır kalır, yetim dosya kalmaz), sonra satır.
  try {
    await deleteProjectFolder(supabase, userId, id);
  } catch {
    // dosya temizliği hata verse de satırı silmeye devam
  }
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  envCache.delete(id);
  writeQueue.delete(id);
}

// ── Dilim yazıcıları (alan-kapsamlı, kuyruklu) ───────────────────────────────

/**
 * Kapak modülü: kapak taslağı + paylaşılan meta'yı TEK yazımda günceller
 * (iki ayrı çağrı yapmaz → kardeş dilim ezme yok). Görseller önce (kilit dışı,
 * yavaş) Storage'a yüklenir; sonra hızlı satır güncellemesi kuyrukta yapılır.
 */
export async function saveProjectCover(
  id: string,
  draft: CoverDraft,
  thumbDataUrl?: string,
): Promise<void> {
  const supabase = createClient();
  const userId = await requireUserId();
  const storedDraft = await uploadDraftImages(supabase, userId, id, draft, uploadCache);
  let thumbPath: string | undefined;
  if (thumbDataUrl) {
    try {
      thumbPath = await uploadThumb(supabase, userId, id, thumbDataUrl);
    } catch {
      // küçük resim olmazsa önemli değil
    }
  }
  return enqueue(id, async () => {
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const merged: ProjectEnvelope = {
      ...env,
      cover: storedDraft,
      meta: {
        ...env.meta,
        title: draft.title ?? "",
        author: draft.author ?? "",
        subtitle: draft.subtitle ?? env.meta.subtitle,
        isbn: draft.isbn ?? env.meta.isbn,
      },
    };
    const { title, author } = deriveListFields(merged);
    const { error } = await supabase
      .from("projects")
      .update({ data: merged, title, author, ...(thumbPath ? { thumb_path: thumbPath } : {}) })
      .eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}

/** Paylaşılan kitap bilgisini günceller (metin modülleri — Aşama 1b). */
export async function updateProjectMeta(id: string, partial: Partial<ProjectMeta>): Promise<void> {
  return enqueue(id, async () => {
    const supabase = createClient();
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const merged: ProjectEnvelope = { ...env, meta: { ...env.meta, ...partial } };
    const { title, author } = deriveListFields(merged);
    const { error } = await supabase.from("projects").update({ data: merged, title, author }).eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}

/** Paylaşılan kitap metnini günceller (Aşama 1b). */
export async function updateProjectManuscript(
  id: string,
  text: string,
  updatedBy: ModuleKey,
  nowIso: string,
): Promise<void> {
  return enqueue(id, async () => {
    const supabase = createClient();
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const merged: ProjectEnvelope = {
      ...env,
      manuscript: { text, updatedBy, updatedAt: nowIso },
    };
    const { error } = await supabase.from("projects").update({ data: merged }).eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}

/** Bir modülün kendi ayar dilimini günceller (Aşama 2). */
export async function updateProjectModule(
  id: string,
  key: Exclude<ModuleKey, "cover">,
  slice: unknown,
): Promise<void> {
  return enqueue(id, async () => {
    const supabase = createClient();
    const env = envCache.get(id) ?? (await fetchEnvelope(id));
    const merged: ProjectEnvelope = {
      ...env,
      modules: { ...env.modules, [key]: slice },
    };
    const { error } = await supabase.from("projects").update({ data: merged }).eq("id", id);
    if (error) throw error;
    envCache.set(id, merged);
  });
}
