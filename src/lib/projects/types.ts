// Çoklu proje ("Projelerim") veri tipleri.
//
// Bir proje, Supabase'teki `projects` tablosunda bir satırdır. Tüm kitap içeriği
// `data` (jsonb) içinde bir "envelope" olarak durur. Şema sürümlüdür: schema=2
// bütün-kitap envelope'u (meta + manuscript + modül ayarları + kapak). Eski/eksik
// veriler migrateEnvelope() ile sürüme yükseltilir.

import type { CoverDraft } from "@/lib/cover/coverDraft";
import type { PrintStandard } from "@/lib/layout/standards";

export const PROJECT_SCHEMA = 2 as const;

export type ModuleKey =
  | "cover"
  | "layout"
  | "editor"
  | "ekitap"
  | "audiobook"
  | "promo";

// Tüm modüllerin paylaştığı kitap kimliği (tek doğru kaynak).
export type ProjectMeta = {
  title: string;
  author: string;
  subtitle?: string;
  publisher?: string; // yayınevi adı — başlık sayfasının altında görünür
  isbn?: string;
  bio?: string;
  genre?: string; // tür — sihirbazda sorulur, kapak promtunu yönlendirir
  platform?: PrintStandard; // yayın profili (KDY/KDP/Ingram/Serbest…) — boyut+marj+kapak speci
  sizeId?: string; // kitap boyu (BOOK_SIZES id) — sihirbazda seçilir; yoksa profilin varsayılanı
};

// 3 adımlı "otomatik kitap" sihirbazının durumu (proje ile saklanır).
// active=true ise modül ekranlarında üretim-hattı çubuğu görünür.
export type WizardStepKey = "editor" | "layout" | "cover";

export type WizardState = {
  active: boolean;
  editorCompleted: boolean;
  layoutCompleted: boolean;
  coverCompleted: boolean;
};

// Paylaşılan kitap gövdesi (düz metin — editör/e-kitap/sesli doğrudan kullanır).
export type ProjectManuscript = {
  text: string;
  updatedBy?: ModuleKey;
  updatedAt?: string;
};

// Modüllerin kendi ayarları (Aşama 2'de doldurulur; hepsi opsiyonel).
export type ProjectModules = {
  layout?: unknown;
  editor?: unknown;
  ekitap?: unknown;
  audiobook?: unknown;
  promo?: unknown;
};

export type ProjectEnvelope = {
  schema: 2;
  meta: ProjectMeta;
  manuscript: ProjectManuscript;
  modules: ProjectModules;
  cover: CoverDraft;
  wizard?: WizardState;
};

// Yeni projeler sihirbazla başlar (active). Eski/migre projeler pasif.
const ACTIVE_WIZARD: WizardState = {
  active: true,
  editorCompleted: false,
  layoutCompleted: false,
  coverCompleted: false,
};
const INACTIVE_WIZARD: WizardState = {
  active: false,
  editorCompleted: false,
  layoutCompleted: false,
  coverCompleted: false,
};

// Tablodan dönen ham satır.
export type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  thumb_path: string | null;
  data: ProjectEnvelope;
  created_at: string;
  updated_at: string;
};

// Liste görünümü için hafif tip.
export type ProjectListItem = {
  id: string;
  title: string;
  author: string;
  thumb_path: string | null;
  updated_at: string;
};

const EMPTY_COVER: CoverDraft = { v: 1 };

export function emptyEnvelope(): ProjectEnvelope {
  return {
    schema: PROJECT_SCHEMA,
    meta: { title: "", author: "" },
    manuscript: { text: "" },
    modules: {},
    cover: EMPTY_COVER,
    wizard: { ...ACTIVE_WIZARD }, // yeni projeler sihirbazla başlar
  };
}

function normalizeWizard(w: unknown): WizardState {
  const x = (w as Partial<WizardState>) ?? {};
  return {
    active: !!x.active,
    editorCompleted: !!x.editorCompleted,
    layoutCompleted: !!x.layoutCompleted,
    coverCompleted: !!x.coverCompleted,
  };
}

/**
 * Ham jsonb'yi geçerli bir schema-2 envelope'a yükseltir. Boş satır, eski
 * kapak-only ({schema:1, cover}) ya da doğrudan CoverDraft kaydı gelse de
 * veri kaybı olmadan normalleştirir; meta kapaktan tohumlanır.
 */
export function migrateEnvelope(data: unknown): ProjectEnvelope {
  const base = emptyEnvelope();
  if (!data || typeof data !== "object") return base;
  const d = data as Record<string, unknown>;

  // Zaten schema-2 ise alanları güvenle birleştir.
  if (d.schema === 2) {
    const meta = (d.meta as ProjectMeta) ?? base.meta;
    const manuscript = (d.manuscript as ProjectManuscript) ?? base.manuscript;
    const modules = (d.modules as ProjectModules) ?? {};
    const cover = (d.cover as CoverDraft) ?? base.cover;
    return {
      schema: 2,
      meta: { title: meta.title ?? "", author: meta.author ?? "", subtitle: meta.subtitle, publisher: meta.publisher, isbn: meta.isbn, bio: meta.bio, genre: meta.genre, platform: meta.platform, sizeId: meta.sizeId },
      manuscript: { text: manuscript.text ?? "", updatedBy: manuscript.updatedBy, updatedAt: manuscript.updatedAt },
      modules,
      cover,
      // wizard alanı yoksa eski projedir → pasif (üretim-hattı çubuğu çıkmaz).
      wizard: "wizard" in d ? normalizeWizard(d.wizard) : { ...INACTIVE_WIZARD },
    };
  }

  // Eski: { schema:1, cover } veya doğrudan bir CoverDraft.
  const cover: CoverDraft =
    (d.cover as CoverDraft) ?? (("v" in d ? (d as unknown as CoverDraft) : base.cover));
  return {
    schema: PROJECT_SCHEMA,
    meta: {
      title: cover.title ?? "",
      author: cover.author ?? "",
      subtitle: cover.subtitle,
      isbn: cover.isbn,
    },
    manuscript: { text: "" },
    modules: {},
    cover,
    wizard: { ...INACTIVE_WIZARD },
  };
}

/** meta'yı kapaktan üretir (liste sütunları title/author için). */
export function deriveListFields(env: ProjectEnvelope): { title: string; author: string } {
  return {
    title: env.meta.title || env.cover.title || "",
    author: env.meta.author || env.cover.author || "",
  };
}
