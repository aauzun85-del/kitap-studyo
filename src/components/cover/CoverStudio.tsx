"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { completeWizardStep } from "@/lib/projects/data";
import WizardGuide from "@/components/app/WizardGuide";
import { useEditorSession } from "@/lib/editor/session";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  BOOK_SIZES,
  DEFAULT_SIZE_ID,
  DEFAULT_BLEED_MM,
  BLEED_OPTIONS,
  PAPER_OPTIONS,
  calcSpread,
  formatMm,
  type BindingType,
  type PaperGsm,
} from "@/lib/cover/spread";
import {
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  photoSlotMm,
  type CoverColors,
  type PhotoLayout,
} from "@/lib/cover/templates";
import { STANDARD_PROFILES } from "@/lib/layout/standards";
import {
  normalizeIsbn,
  isValidEan13,
  completeIsbn,
  randomTestIsbn,
} from "@/lib/cover/barcode";
import { exportCoverPdf } from "@/lib/cover/pdf";
import ExportOverlay from "@/components/app/ExportOverlay";
import {
  EyeIcon,
  EyeSlashIcon,
  LockIcon,
  LockOpenIcon,
  DragHandleIcon,
  LayoutIcon,
  PaletteIcon,
  TextTIcon,
  ImageIcon,
  SlidersIcon,
  StackIcon,
  BarcodeIcon,
  ShapesIcon,
  TrashIcon,
  CopyIcon,
  MagicWandIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  FolderIcon,
  ArrowsOutIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  CaretDownIcon,
} from "@/components/PhosphorIcons";
import {
  AI_STYLES,
  DEFAULT_AI_STYLE_ID,
  buildAiPrompt,
  buildLayeredPrompt,
  buildNanoCoverPrompt,
  nearestAspectRatio,
  nearestNanoAspect,
  openaiSize,
  spreadCustomDims,
  type AiModel,
  type LayeredStyleOverride,
  type LayeredText,
  type PhotoSlot,
} from "@/lib/cover/aiStyles";
import {
  briefStyleOverride,
  getTextStyle,
  briefExampleSrc,
  type CoverBrief,
} from "@/lib/cover/brief";
import { getConceptOf, resolveStandard } from "@/lib/cover/standards";
import { deleteBriefPhoto, loadBriefPhoto, toMonoPhoto } from "@/lib/cover/briefPhoto";
import { findChromaRect, spineColorFromImage } from "@/lib/cover/palette";
import {
  AI_HISTORY_LIMIT,
  loadAiHistory,
  saveAiHistory,
  type AiHistoryItem,
} from "@/lib/cover/aiHistory";
import {
  COVER_DRAFT_VERSION,
  loadCoverDraft,
  saveCoverDraft,
  clearCoverDraft,
  type CoverDraft,
} from "@/lib/cover/coverDraft";
import { saveProjectCover } from "@/lib/projects/data";
import { resolveDraftImages } from "@/lib/projects/storage";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { genreAiStyleId } from "@/lib/projects/genres";
import { requireExport } from "@/lib/credits/exportGate";
import { creditCost } from "@/lib/credits/pricing";
import CreditNotice, {
  creditProblemFrom,
  type CreditProblem,
} from "@/components/credits/CreditNotice";
import {
  loadUserImages,
  saveUserImages,
  loadUserTemplates,
  saveUserTemplates,
  USER_IMAGES_LIMIT,
  USER_TEMPLATES_LIMIT,
  type UserImage,
  type UserTemplate,
} from "@/lib/cover/userLibrary";
import CoverEditModal from "./CoverEditModal";
import CoverCanvas, {
  type CoverImages,
  type CoverCanvasHandle,
  type PositionMap,
  type ObjTransform,
  type ObjGeometry,
  type LayerMap,
  type AlignMode,
  type CustomObject,
  type DividerVariant,
  type TextStyle,
  type TextStyleMap,
  type ViewFocus,
} from "./CoverCanvas";
import {
  COVER_FONTS,
  DEFAULT_COVER_FONT,
  FONT_CATEGORY_ORDER,
  type FontCategory,
} from "@/lib/cover/fonts";

const PRINT_DPI = 300;

type PanelId =
  | "ai"
  | "content"
  | "objects"
  | "colors"
  | "barcode"
  | "images"
  | "setup"
  | "layers"
  | "library";

// AI üretim seçenekleri (panel düğmesi ve sihirbaz aynı yolu kullanır).
type AiGenOpts = {
  styleId?: string;
  desc?: string;
  model?: AiModel;
  scope?: "front" | "wrap";
  embedText?: boolean;
  /** Kurgudan gelen konsept/özne/ton katmanı (yalnız ChatGPT yolu kullanır). */
  override?: LayeredStyleOverride;
  /** Verilirse ChatGPT başlık/yazar/tür etiketini GÖRSELE basar (yazı katmanları gizlenir). */
  text?: LayeredText;
  /** Yazarın fotoğrafı için boş bırakılacak yuva (ChatGPT yolu). null = bu
   *  üretimde fotoğraf YOK (tuvaldeki eski yuvaya düşme); undefined = tuvaldeki. */
  photoSlot?: PhotoSlot | null;
};
// Tarayıcı tarafı SON ÇARE zaman aşımları. Sunucu 120 sn içinde kendi temiz
// hatasını döndürür; bunlar ancak bağlantı tamamen koparsa devreye girer.
const CLIENT_AI_TIMEOUT_MS = 135_000;
// Geri alma geçmişi: iki taslak TASARIM olarak aynı mı? (Görünüm/AI form alanları
// adım sayılmaz; değerler değişmez nesneler olduğundan referans karşılaştırması yeter.)
const HISTORY_IGNORE = new Set(["showGuides", "aiDesc", "aiModel", "aiStyle", "aiScope", "aiEmbedText", "selectedAngle"]);
function sameDesign(a: CoverDraft, b: CoverDraft): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (HISTORY_IGNORE.has(k)) continue;
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}

// Tuval ekran büyütme basamakları (1 = ekrana sığdır). Yalnız görünüm; baskı
// çıktısı mm ölçüsünden üretilir, etkilenmez.
const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];
function zoomStep(z: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.findIndex((v) => v >= z - 1e-6);
  const cur = i === -1 ? ZOOM_STEPS.length - 1 : i;
  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, cur + dir))];
}
const WIZARD_PROMPT_TIMEOUT_MS = 45_000;
// Sihirbazın otomatik kapak akışı iki ücretli uç çağırır: kitap asistanı
// (cover-prompt) + FLUX görseli (cover-art). Onay kartındaki bedel buradan gelir.
const WIZARD_COVER_COST = creditCost("cover-prompt") + creditCost("cover-art");

// Seçili üretim modelinin jeton bedeli (uç nokta ↔ fiyat anahtarı).
function aiModelCost(model: AiModel): number {
  return creditCost(
    model === "openai"
      ? "cover-openai"
      : model === "nano"
        ? "cover-nano"
        : model === "ideogram"
          ? "cover-ideogram"
          : "cover-art",
  );
}

export default function CoverStudio({
  lang,
  dict,
  initialProject,
  wizardAuto,
  autoExport,
  canExport,
  creditBalance = null,
  briefRun,
  user = null,
  signOut,
  startPreview = false,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
  /** Sihirbaz modunda: kapağı kitap bilgisinden otomatik üret + AI panelini aç. */
  wizardAuto?: boolean;
  /** İndirme ekranından "?export=1" ile gelindi: tuval hazır olunca Kapak PDF'ini
   *  otomatik indir + üstte durum katmanı göster. */
  autoExport?: boolean;
  /** Aktif jeton paketi var mı? false ise indirme (PNG/PDF) kilitli. */
  canExport: boolean;
  /** Sayfa açılırkenki jeton bakiyesi (anlık görüntü). null = sınırsız (yönetici). */
  creditBalance?: number | null;
  /** Kurgu sayfasından "Tuvale gönder ve üret" ile gelindi → kayıtlı kurguyla üret. */
  briefRun?: boolean;
  /** Üst çubuktaki hesap rozeti (tam ekran düzende uygulama menüsü yok). */
  user?: { name: string; initials: string } | null;
  signOut?: () => Promise<void>;
  /** İndirme ekranındaki "Önizle" → kapak doğrudan önizlemede (tam ekran, kılavuzsuz) açılır. */
  startPreview?: boolean;
}) {
  const t = dict.coverStudio;
  // Bulut projesi modu: ?project=<id> ile açıldıysa kayıt/yükleme buluta gider.
  // Yoksa (anonim/yerel) mevcut IndexedDB davranışı aynen korunur.
  const projectId = initialProject?.id ?? null;
  const lastThumbRef = useRef(0);

  // İçerik
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [isbn, setIsbn] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  // Başlık bloğu yeri: "auto" şablona bırakır; "top" üst banda alır (ChatGPT
  // görseli üst bandı başlık için sade bıraktığından üretim sonrası otomatik).
  const [titlePos, setTitlePos] = useState<"auto" | "top" | "center">("auto");
  // Kapak kurgusu (tuval öncesi seçimler); kurgu sayfası yazar, burada okunur.
  const [brief, setBrief] = useState<CoverBrief | null>(null);
  // Sırt bandı (hex | null). Sarmal AI üretiminden sonra görselin paletinden
  // otomatik dolar; Renkler panelinden kapatılır/değiştirilir.
  const [spineBand, setSpineBand] = useState<string | null>(null);
  // Yazarın kendi fotoğrafı için yerleşim (anı/biyografi kurgusu): null = tam kapak.
  const [photoLayout, setPhotoLayout] = useState<PhotoLayout | null>(null);
  // Yazarın kendi fotoğrafı (kapak görselinden AYRI katman; yuvaya oturur).
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  // Fotoğrafın ölçülmüş yeri (mm) — yapay zekânın yeşil yer tutucusundan.
  const [photoRect, setPhotoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // En son uygulanan kurgunun damgası — yeni kurgu (farklı damga) yeniden üretir.
  const [briefAppliedAt, setBriefAppliedAt] = useState<string | null>(null);
  // Kullanıcının değiştirdiği renkler (yalnız değişenler). Boşsa şablon paleti kullanılır.
  const [colorOverrides, setColorOverrides] = useState<Partial<CoverColors>>({});
  // Baskı kılavuzları varsayılan AÇIK gelir (kesim/sırt/güvenli alan görünür).
  const [showGuides, setShowGuides] = useState(true);

  // Görseller
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverDarken, setCoverDarken] = useState(0); // varsayılan kapalı (karartma yok)
  const [coverOpacity, setCoverOpacity] = useState(1);
  const [coverScope, setCoverScope] = useState<"front" | "wrap">("front");
  const [coverFit, setCoverFit] = useState<"fill" | "fit">("fill");
  // Başlık/yazar/altbaşlık/sırt yazısını arka plana göre otomatik beyaz/siyah +
  // gölge yap (kapak görseli üstünde okunurluk garantisi). Varsayılan AÇIK.
  const [autoContrast, setAutoContrast] = useState(true);
  // Kapak görselini kadraj içinde konumlama: yatay kaydırma (-1..1) + yakınlaştırma (1..2.5).
  const [coverPanX, setCoverPanX] = useState(0);
  const [coverZoom, setCoverZoom] = useState(1);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState(22);
  const [logoPos, setLogoPos] = useState<"top" | "bottom">("bottom");

  // AI kapak görseli üretimi
  // Kitabın türü bir kapak stiline eşleşiyorsa (roman→edebi, çocuk→çocuk…)
  // AI paneli o stille açılır; kullanıcı dilediğinde değiştirir.
  const [aiStyle, setAiStyle] = useState(
    genreAiStyleId(initialProject?.data.meta.genre) ?? DEFAULT_AI_STYLE_ID,
  );
  // Üretim modeli: "flux" (mevcut, hızlı/sanatsal) | "nano" (Nano Banana Pro,
  // komutları daha iyi izler). Varsayılan flux → mevcut davranış korunur.
  const [aiModel, setAiModel] = useState<AiModel>("flux");
  // Son ChatGPT üretiminin yaklaşık maliyeti (USD; sunucu token sayımından).
  const [aiLastCost, setAiLastCost] = useState<number | null>(null);
  // Nano: başlık/yazar metnini görselin içine bastırsın mı? (Nano yazıyı iyi basar)
  const [aiEmbedText, setAiEmbedText] = useState(true);
  const [aiDesc, setAiDesc] = useState("");
  // AI üretiminin kapsamı: sadece ön kapak mı, tüm kapağı saran tek görsel mi.
  const [aiScope, setAiScope] = useState<"front" | "wrap">("wrap");
  // Son üretilen görseller (tarayıcıya kalıcı kaydedilir).
  const [aiHistory, setAiHistory] = useState<AiHistoryItem[]>([]);
  // "Yüklemelerim": kişisel görsel + şablon kütüphanesi (tarayıcıya kalıcı).
  const [userImages, setUserImages] = useState<UserImage[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  // Sihirbaz otomatik üretiminde tuval üstünde gösterilecek yükleme mesajı.
  const [coverGenMsg, setCoverGenMsg] = useState<string | null>(null);
  // Bekleme ekranı sayacı (sn) — kullanıcı "takıldı mı" diye kuşkulanmasın.
  const [aiElapsed, setAiElapsed] = useState(0);
  // Süren AI isteğini iptal etmek için (Vazgeç düğmesi + zaman aşımı).
  const aiAbortRef = useRef<AbortController | null>(null);
  // Üretim sürerken ikinci tetiklemeyi engeller (state asenkron; ref anında).
  const aiBusyRef = useRef(false);
  // "Tekrar dene" için son üretim seçenekleri.
  const lastAiOptsRef = useRef<AiGenOpts | null>(null);
  const [aiError, setAiError] = useState<
    "none" | "token" | "generic" | "timeout" | "credits"
  >("none");
  // Üretim sonrası bilgilendirme (ör. başlık görsele gömülünce yazı katmanları gizlendi).
  const [aiNotice, setAiNotice] = useState<"none" | "embed">("none");
  // AI ile TASARIM ÖĞESİ üretimi (mühür/rozet/amblem… → saydam PNG nesnesi).
  const [elemDesc, setElemDesc] = useState("");
  const [elemBusy, setElemBusy] = useState(false);
  const [elemError, setElemError] = useState<
    "none" | "token" | "generic" | "credits"
  >("none");
  // Jeton yetmedi (402) / oturum kapandı (401) → ortak uyarı bunu gösterir.
  const [aiCredit, setAiCredit] = useState<CreditProblem | null>(null);
  const [elemCredit, setElemCredit] = useState<CreditProblem | null>(null);
  // Bakiyenin yerel kopyası (null = sınırsız). Sunucudaki gerçek bakiye değil;
  // onay kartı/uyarı kabaca doğru kalsın diye başarılı üretimde düşülür.
  const [balance, setBalance] = useState<number | null>(creditBalance);
  const spendCredits = (n: number) =>
    setBalance((b) => (b == null ? b : Math.max(0, b - n)));
  // Sunucu 402'de güncel bakiyeyi de yollar → yerel kopyayı onunla eşitle.
  const noteCreditProblem = (p: CreditProblem) => {
    if (p.kind === "no-credits" && p.balance != null) setBalance((b) => (b == null ? b : p.balance!));
  };
  // Sihirbaz: otomatik kapak üretimi ÖNCE sorulur (jeton harcar).
  const [wizardChoice, setWizardChoice] = useState<"none" | "run" | "skip">("none");
  // "Kendim tasarlayacağım" kararı proje başına hatırlanır (adıma her dönüşte sorma).
  const wizardSkipKey = `cover-wizard-skip:${initialProject?.id ?? "local"}`;
  const skipWizardCover = () => {
    setWizardChoice("skip");
    try {
      localStorage.setItem(wizardSkipKey, "1");
    } catch {
      // depolama kapalı → karar yalnız bu oturumda geçerli
    }
  };
  useEffect(() => {
    try {
      if (localStorage.getItem(wizardSkipKey) === "1")
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWizardChoice((c) => (c === "none" ? "skip" : c));
    } catch {
      // depolama kapalı → her girişte sorulur
    }
  }, [wizardSkipKey]);
  // "Boya & değiştir" penceresi açık mı.
  const [editOpen, setEditOpen] = useState(false);

  // Kitap ayarları — yayın profili seçilmişse boyut+taşma o profile göre başlar
  // (kapak baskı speci platformla uyumlu olsun). Eski/profilsiz projede varsayılan.
  const seedCoverPlatform = initialProject?.data.meta.platform;
  const seedCoverProfile = seedCoverPlatform ? STANDARD_PROFILES[seedCoverPlatform] : null;
  // Sihirbazda seçilen kitap boyu (meta.sizeId) öncelikli — kapak, iç sayfayla
  // aynı trim'de açılsın. Yoksa profil varsayılanı.
  const [sizeId, setSizeId] = useState(
    initialProject?.data.meta.sizeId ?? seedCoverProfile?.defaultSizeId ?? DEFAULT_SIZE_ID,
  );
  const [pageCount, setPageCount] = useState(200);
  const [paperGsm, setPaperGsm] = useState<PaperGsm>(80);
  const [binding, setBinding] = useState<BindingType>("soft");
  const [spineManualOn, setSpineManualOn] = useState(false);
  const [spineManualValue, setSpineManualValue] = useState(11);
  const [bleedMm, setBleedMm] = useState<number>(seedCoverProfile?.bleedMm ?? DEFAULT_BLEED_MM);
  // İndirme ekranından "?export=1" ile gelince: tuval hazır olunca Kapak PDF'i
  // otomatik indirilir; üstteki durum katmanı bunu izler.
  const [autoExportStatus, setAutoExportStatus] = useState<
    "working" | "done" | "error" | "locked"
  >(autoExport && !canExport ? "locked" : "working");
  const autoExportFiredRef = useRef(false);
  const autoExportTimerRef = useRef<number | null>(null);
  const autoExportSafetyRef = useRef<number | null>(null);

  // PDF çıktısı
  const canvasRef = useRef<CoverCanvasHandle>(null);
  const [exporting, setExporting] = useState(false);
  // Tek "İndir" düğmesinin açılır menüsü
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [cropMarks, setCropMarks] = useState(true);

  // Editör: elle taşınan nesne konumları + katman sırası + seçili nesne.
  const [positions, setPositions] = useState<PositionMap>({});
  const [layers, setLayers] = useState<LayerMap>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [layerIds, setLayerIds] = useState<string[]>([]); // ön→arka, tuvalden gelir
  const [dragRow, setDragRow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Tuval görünümü: büyütme ve "büyük görünüm" (paneller gizli, tam ekran).
  const [zoom, setZoom] = useState(1);
  const [bigView, setBigView] = useState(startPreview);
  // Yeni düzen: görünüm odağı, sağ panel açık mı, önizleme, hesap menüsü.
  const [viewFocus, setViewFocus] = useState<ViewFocus>("all");
  const [panelOpen, setPanelOpen] = useState(true);
  const [preview, setPreview] = useState(startPreview);
  const [accountOpen, setAccountOpen] = useState(false);
  const [viewInfo, setViewInfo] = useState<{ realPercent: number; maxZoom: number }>({ realPercent: 100, maxZoom: 3 });
  const [wizardBusy, setWizardBusy] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  // AI Editör kontrolü başka adımdayken de sürer → adım çipinde dönen gösterge.
  const editorJob = useEditorSession(initialProject?.id ?? null);
  const router = useRouter();
  // Geri al / ileri al geçmişi (taslak anlık görüntüleri).
  const undoStackRef = useRef<CoverDraft[]>([]);
  const redoStackRef = useRef<CoverDraft[]>([]);
  // Geri alma/ileri almayla uygulanan anlık görüntü: ondan sonra gelen ilk
  // otomatik kayıt AYNI tasarımsa adım sayılmaz (farklıysa gerçek düzenlemedir).
  const appliedHistoryRef = useRef<CoverDraft | null>(null);
  // Düğmelerin açık/kapalı hâli için yığın boyları (render'da ref okunmasın).
  const [histLen, setHistLen] = useState({ undo: 0, redo: 0 });
  const syncHist = () => setHistLen({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  const rootRef = useRef<HTMLDivElement>(null);
  // Büyük görünüm sayfayı kendisi kaplar; tarayıcı tam ekranı yalnız EK bir
  // kazançtır. İkisi birbirine bağlı değil: tam ekran (Esc ya da bir onay
  // kutusu yüzünden) kapansa da büyük görünüm sürer; kapatmak için düğme/Esc.
  const bigViewRef = useRef(startPreview);
  const toggleBigView = async () => {
    const el = rootRef.current;
    if (!bigViewRef.current) {
      bigViewRef.current = true;
      setBigView(true);
      try {
        if (el && !document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
      } catch {
        // tam ekran desteklenmiyor → sayfa içi büyük görünüm yeter
      }
      // Bu arada (çift tık) kapatıldıysa tam ekranı da bırak.
      if (!bigViewRef.current && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } else {
      bigViewRef.current = false;
      setBigView(false);
      setPreview(false);
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        // önemli değil
      }
    }
  };
  // Esc: büyük görünümden / önizlemeden çık (tam ekrandayken Esc'i tarayıcı
  // tam ekrandan çıkmak için kullanır; ikinci Esc görünümü kapatır). Yazı
  // yazarken ya da İndir menüsü açıkken dokunma.
  useEffect(() => {
    if (!bigView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.fullscreenElement || downloadMenuOpen) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      bigViewRef.current = false;
      setBigView(false);
      setPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bigView, downloadMenuOpen]);
  const [selectedAngle, setSelectedAngle] = useState(0);
  // Yapısal metinlerin (başlık/yazar/altbaşlık/sırt) öğe bazlı stilleri +
  // seçili metnin tuvalden bildirilen canlı stili (panel varsayılanları için).
  const [textStyles, setTextStyles] = useState<TextStyleMap>({});
  const [selectedTextLive, setSelectedTextLive] = useState<TextStyle | null>(null);
  // Seçili nesnenin tuvalden bildirilen canlı ölçü/konumu (mm) + oran kilidi.
  const [selectedGeoLive, setSelectedGeoLive] = useState<ObjGeometry | null>(null);
  const [lockAspect, setLockAspect] = useState(false);
  const updateTextStyle = (id: string, patch: Partial<TextStyle>) =>
    setTextStyles((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const resetTextStyle = (id: string) =>
    setTextStyles((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });

  // Kullanıcının "Nesne" panelinden eklediği serbest nesneler.
  const [objects, setObjects] = useState<CustomObject[]>([]);
  const objCounter = useRef(0);

  // Canva tarzı sol ikon şeridi: o an açık olan grup. Sihirbaz modunda doğrudan
  // AI paneliyle açılır (kapak burada otomatik üretilip düzenlenir).
  // Şablon paneli kaldırıldı: tipografi Kapak kurgusundaki "yazı stili"nden gelir.
  const [activePanel, setActivePanel] = useState<PanelId>("ai");

  // --- Otomatik kayıt (taslak) ---
  // Tasarım her değişiklikte tarayıcıya kaydedilir; yenilemede kaybolmaz.
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [draftRestored, setDraftRestored] = useState(false);
  // "Önceki tasarım geri yüklendi" bildirimi birkaç saniye sonra kendiliğinden kapanır.
  useEffect(() => {
    if (!draftRestored) return;
    const id = window.setTimeout(() => setDraftRestored(false), 6000);
    return () => window.clearTimeout(id);
  }, [draftRestored]);
  const hydratedRef = useRef(false); // ilk yükleme bitti mi (öncesinde kayıt yapma)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<CoverDraft | null>(null); // sekme kapanınca yazmak için

  const handlePositionChange = useCallback((id: string, t: ObjTransform) => {
    setPositions((prev) => ({ ...prev, [id]: t }));
  }, []);
  const handleAlign = (mode: AlignMode) => canvasRef.current?.alignSelected(mode);
  // Derece girişinden seçili nesneyi döndür (kutu + tuval birlikte güncellenir).
  const handleSetAngle = (deg: number) => {
    const norm = ((Math.round(deg) % 360) + 360) % 360; // 0..359
    setSelectedAngle(norm);
    canvasRef.current?.setSelectedAngle(norm);
  };

  // Tuval o anki katman listesini (ön→arka) bildirir; aynıysa state'i değiştirme (döngü olmasın).
  const handleLayersChange = useCallback((ids: string[]) => {
    setLayerIds((prev) =>
      prev.length === ids.length && prev.every((v, i) => v === ids[i]) ? prev : ids,
    );
  }, []);
  const toggleHidden = (id: string) =>
    setHidden((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleLocked = (id: string) =>
    setLocked((prev) => ({ ...prev, [id]: !prev[id] }));
  // Satırı from→to taşı; yeni ön→arka sırasına göre seviye ata (ön = en yüksek).
  const reorderLayer = (from: number, to: number) => {
    const ids = layerIds;
    const n = ids.length;
    // Sınır güvenliği: geçersiz/aynı index → hiçbir şey yapma (render döngüsü riski yok).
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= n ||
      to >= n
    )
      return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    // İki state'i AYRI AYRI güncelle (iç içe setState yok) — React Compiler dostu
    // ve reorder'ı bir render döngüsüne sokmaz.
    const nl: Record<string, number> = {};
    next.forEach((id, i) => (nl[id] = n - i));
    setLayerIds(next);
    setLayers((pl) => ({ ...pl, ...nl }));
  };
  // Z-sırası: seçili nesneyi katman listesinde (ön→arka) öne/arkaya taşı.
  // layerIds index 0 = en önde. reorderLayer seviyeleri yeniden atar.
  const selLayerIdx = selectedId ? layerIds.indexOf(selectedId) : -1;
  const canBringForward = selLayerIdx > 0;
  const canSendBackward =
    selLayerIdx >= 0 && selLayerIdx < layerIds.length - 1;
  const bringToFront = () => {
    if (canBringForward) reorderLayer(selLayerIdx, 0);
  };
  const bringForward = () => {
    if (canBringForward) reorderLayer(selLayerIdx, selLayerIdx - 1);
  };
  const sendBackward = () => {
    if (canSendBackward) reorderLayer(selLayerIdx, selLayerIdx + 1);
  };
  const sendToBack = () => {
    if (canSendBackward) reorderLayer(selLayerIdx, layerIds.length - 1);
  };

  // Düzeni sıfırla: konum, sıra, görünürlük, kilit ve açı şablon varsayılanına döner.
  const resetLayout = () => {
    setPositions({});
    setLayers({});
    setHidden({});
    setLocked({});
    setTextStyles({});
    setSelectedAngle(0);
  };
  const layoutDirty =
    Object.keys(positions).length > 0 ||
    Object.keys(layers).length > 0 ||
    Object.keys(textStyles).length > 0 ||
    Object.values(hidden).some(Boolean) ||
    Object.values(locked).some(Boolean);

  // Şablonun varsayılan paleti + kullanıcının değiştirdiği renkler = etkin renkler.
  const palette = getTemplate(templateId).palette;
  const colors: CoverColors = useMemo(
    () => ({ ...palette, ...colorOverrides }),
    [palette, colorOverrides],
  );
  const colorsDirty = Object.keys(colorOverrides).length > 0;
  // Şablon değişince renk seçimlerini sıfırla → yeni şablonun kendi renkleri görünsün.
  const setColor = (key: keyof CoverColors, value: string) =>
    setColorOverrides((prev) => ({ ...prev, [key]: value }));

  // Nesne ekle/güncelle/sil — her nesne benzersiz "obj-<n>" kimliğiyle saklanır.
  const addObject = (partial: Omit<CustomObject, "id">) => {
    objCounter.current += 1;
    setObjects((prev) => [...prev, { ...partial, id: `obj-${objCounter.current}` }]);
  };
  const addText = () =>
    addObject({
      type: "text",
      text: t.objTextDefault,
      fill: colors.ink,
      fontSizeMm: 8,
      fontId: DEFAULT_COVER_FONT,
    });
  // Sihirbaz: AI'nın yazdığı arka kapak yazısını ARKA KAPAĞA (sol bölge merkezi)
  // düzenlenebilir bir metin nesnesi olarak ekler — okuma paneli + otomatik kontrast
  // ile okunur. Kullanıcı sonra seçip değiştirebilir, taşıyabilir veya silebilir.
  const addBackCoverBlurb = (blurb: string) => {
    const text = blurb.trim();
    if (!text) return;
    objCounter.current += 1;
    const id = `obj-${objCounter.current}`;
    // Önceki asistan yazısı (yeni kurgu/yeniden üretim) yenisiyle değişir.
    setObjects((prev) => [
      ...prev.filter((o) => o.role !== "blurb"),
      {
        role: "blurb",
        id,
        type: "text",
        text,
        fill: colors.ink,
        fontSizeMm: 4.2,
        fontId: DEFAULT_COVER_FONT,
        align: "left",
        lineHeightMul: 1.32,
        autoColor: true,
        panel: true,
      },
    ]);
    setPositions((prev) => ({
      ...prev,
      [id]: {
        leftMm: spread.backCenter,
        topMm: spread.topSafe + (spread.bottomSafe - spread.topSafe) * 0.4,
      },
    }));
  };
  // Seçili metin nesnesini büyüt/küçült (0,5 mm adımlarla, 3–40 mm arası).
  const bumpFontSize = (id: string, delta: number, current?: number) => {
    const next = Math.min(40, Math.max(3, (current ?? 8) + delta));
    updateObject(id, { fontSizeMm: Math.round(next * 2) / 2 });
  };
  // Satır aralığı çarpanını güvenli aralığa kıs (0,8–2,5; geçersizse varsayılan).
  const clampLineSpacing = (v: number): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) return 1.16;
    return Math.round(Math.min(2.5, Math.max(0.8, v)) * 100) / 100;
  };
  const bumpLineSpacing = (id: string, delta: number, current?: number) => {
    updateObject(id, { lineHeightMul: clampLineSpacing((current ?? 1.16) + delta) });
  };
  const addRect = () => addObject({ type: "rect", fill: colors.accent });
  const addCircle = () => addObject({ type: "circle", fill: colors.accent });
  const addLine = () => addObject({ type: "line", fill: colors.ink });
  const addTriangle = () => addObject({ type: "triangle", fill: colors.accent });
  const addStar = () => addObject({ type: "star", fill: colors.accent });
  const addDiamond = () => addObject({ type: "diamond", fill: colors.accent });
  const addDivider = (variant: DividerVariant) =>
    addObject({ type: "divider", variant, fill: colors.ink });
  const updateObject = (id: string, patch: Partial<CustomObject>) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const deleteObject = (id: string) => {
    setObjects((prev) => prev.filter((o) => o.id !== id));
    const drop = (m: Record<string, unknown>) => {
      const n = { ...m };
      delete n[id];
      return n;
    };
    setPositions((p) => drop(p) as PositionMap);
    setLayers((p) => drop(p) as LayerMap);
    setHidden((p) => drop(p) as Record<string, boolean>);
    setLocked((p) => drop(p) as Record<string, boolean>);
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedAngle(0);
    }
  };

  // Tuvalde seçili nesneyi sil. Kullanıcı nesnesi (obj-) TAMAMEN silinir; şablon
  // nesnesi (başlık/yazar/görsel/logo…) gizlenir → "Katman" panelinden geri açılabilir.
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    if (selectedId.startsWith("obj-")) {
      deleteObject(selectedId);
    } else {
      setHidden((p) => ({ ...p, [selectedId]: true }));
      setSelectedId(null);
      setSelectedAngle(0);
    }
  };

  // Delete/Backspace ile seçili nesneyi sil — yazı yazarken (input/textarea) tetiklenmez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedId) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      if (selectedId.startsWith("obj-")) {
        deleteObject(selectedId);
      } else {
        setHidden((p) => ({ ...p, [selectedId]: true }));
        setSelectedId(null);
        setSelectedAngle(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const size = useMemo(
    () => BOOK_SIZES.find((s) => s.id === sizeId) ?? BOOK_SIZES[0],
    [sizeId],
  );

  const spread = useMemo(
    () =>
      calcSpread(
        size,
        Math.max(1, pageCount || 1),
        paperGsm,
        binding,
        spineManualOn ? spineManualValue : null,
        bleedMm,
      ),
    [size, pageCount, paperGsm, binding, spineManualOn, spineManualValue, bleedMm],
  );

  // Kullanıcı nesnesini (obj-) çoğalt: tüm özellikleriyle bir kopya oluştur,
  // hafifçe kaydır (görünür olsun) ve kopyayı seç. Konum/katman/açı kopyalanır.
  // (spread'e bağlı olduğu için onun ardında tanımlı.)
  const duplicateObject = (id: string) => {
    const src = objects.find((o) => o.id === id);
    if (!src) return;
    objCounter.current += 1;
    const newId = `obj-${objCounter.current}`;
    setObjects((prev) => [...prev, { ...src, id: newId }]);
    const base = positions[id] ?? {
      leftMm: spread.frontCenter,
      topMm: spread.midY,
    };
    const OFFSET = 6; // mm — kopya orijinalin biraz sağ-altına düşsün
    setPositions((p) => ({
      ...p,
      [newId]: {
        ...base,
        leftMm: base.leftMm + OFFSET,
        topMm: base.topMm + OFFSET,
      },
    }));
    if (layers[id] != null) setLayers((p) => ({ ...p, [newId]: layers[id] }));
    setSelectedId(newId);
    setSelectedAngle(base.angle ?? 0);
  };

  // --- Sayısal konum & boyut (mm) --- (spread'e bağlı olduğu için onun ardında.)
  // GÜVENLİ SINIRLAR: geçersiz (NaN/∞) ya da uç (0 / çok büyük) sayısal girişler
  // ölçek çarpanını patlatıp render'ı dondurabilir. Her değeri makul aralığa kıs.
  const SCALE_MIN = 0.02; // taban ölçeğin 1/50'sinden küçük olamaz
  const SCALE_MAX = 60; // taban ölçeğin 60 katından büyük olamaz
  const clampNum = (v: number, lo: number, hi: number): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) return lo;
    return Math.min(hi, Math.max(lo, v));
  };
  // Seçili nesnenin konum override'ını güncelle; yoksa canlı ölçüden tohumla.
  // Tüm sayısal alanlar yazılmadan önce güvenli aralığa kısılır.
  const patchGeo = (patch: Partial<ObjTransform>) => {
    if (!selectedId || !selectedGeoLive) return;
    const safe: Partial<ObjTransform> = { ...patch };
    // Konum merkezini spread alanı + bir miktar payın içinde tut.
    const padX = spread.totalWidth;
    const padY = spread.totalHeight;
    if (safe.leftMm !== undefined)
      safe.leftMm = clampNum(safe.leftMm, -padX, spread.totalWidth + padX);
    if (safe.topMm !== undefined)
      safe.topMm = clampNum(safe.topMm, -padY, spread.totalHeight + padY);
    if (safe.scaleX !== undefined)
      safe.scaleX = clampNum(safe.scaleX, SCALE_MIN, SCALE_MAX);
    if (safe.scaleY !== undefined)
      safe.scaleY = clampNum(safe.scaleY, SCALE_MIN, SCALE_MAX);
    if (safe.angle !== undefined)
      safe.angle = clampNum(safe.angle, -360, 360);
    setPositions((prev) => {
      const cur: ObjTransform = prev[selectedId] ?? {
        leftMm: selectedGeoLive.leftMm,
        topMm: selectedGeoLive.topMm,
      };
      return { ...prev, [selectedId]: { ...cur, ...safe } };
    });
  };
  const setGeoX = (mm: number) => patchGeo({ leftMm: mm });
  const setGeoY = (mm: number) => patchGeo({ topMm: mm });
  // Genişlik/yükseklik mm cinsinden → şablon ölçeğine göre çarpan.
  // Hedef mm makul aralığa kısılır (0 / NaN / dev değerler engellenir).
  const setGeoWidth = (mm: number) => {
    if (!selectedId || !selectedGeoLive || selectedGeoLive.widthMm <= 0) return;
    const target = clampNum(mm, 0.5, spread.totalWidth * 2);
    const factor = target / selectedGeoLive.widthMm;
    const curX = positions[selectedId]?.scaleX ?? 1;
    const patch: Partial<ObjTransform> = { scaleX: curX * factor };
    if (lockAspect) {
      const curY = positions[selectedId]?.scaleY ?? 1;
      patch.scaleY = curY * factor;
    }
    patchGeo(patch);
  };
  const setGeoHeight = (mm: number) => {
    if (!selectedId || !selectedGeoLive || selectedGeoLive.heightMm <= 0) return;
    const target = clampNum(mm, 0.5, spread.totalHeight * 2);
    const factor = target / selectedGeoLive.heightMm;
    const curY = positions[selectedId]?.scaleY ?? 1;
    const patch: Partial<ObjTransform> = { scaleY: curY * factor };
    if (lockAspect) {
      const curX = positions[selectedId]?.scaleX ?? 1;
      patch.scaleX = curX * factor;
    }
    patchGeo(patch);
  };

  // Hızlı: tam sayfa yüksekliği (taşma dahil) + dikey ortala. (spread'e bağlı.)
  const fitFullHeight = () => {
    if (!selectedId || !selectedGeoLive || selectedGeoLive.heightMm <= 0) return;
    const factor = spread.totalHeight / selectedGeoLive.heightMm;
    const curY = positions[selectedId]?.scaleY ?? 1;
    patchGeo({ scaleY: curY * factor, topMm: spread.totalHeight / 2 });
  };
  // Hızlı: görselin TAMAMINI güvenli alanın içine sığdır (oranı koru) + ortala.
  // Math.min → en-boy oranı korunarak küçülür; hiçbir kenar güvenli alanı taşmaz,
  // kenarda boşluk kalabilir. Yazı/kesim alanının dışına çıkmaması istenince ideal.
  const fitToSafeArea = () => {
    if (
      !selectedId ||
      !selectedGeoLive ||
      selectedGeoLive.widthMm <= 0 ||
      selectedGeoLive.heightMm <= 0
    )
      return;
    const safeW = spread.frontSafeRight - spread.frontSafeLeft;
    const safeH = spread.bottomSafe - spread.topSafe;
    const factor = Math.min(
      safeW / selectedGeoLive.widthMm,
      safeH / selectedGeoLive.heightMm,
    );
    const curX = positions[selectedId]?.scaleX ?? 1;
    const curY = positions[selectedId]?.scaleY ?? 1;
    patchGeo({
      scaleX: curX * factor,
      scaleY: curY * factor,
      leftMm: spread.frontCenter,
      topMm: spread.midY,
    });
  };
  // Hızlı: görsel ön kapağı TAMAMEN doldursun (oranı koru) + ortala.
  // Math.max → en-boy oranı korunarak büyür; alan tamamen kaplanır, taşan kenarlar
  // kırpılır. "Doldur" davranışı (kapak görselindeki Doldur ile aynı mantık).
  const fillFrontCover = () => {
    if (
      !selectedId ||
      !selectedGeoLive ||
      selectedGeoLive.widthMm <= 0 ||
      selectedGeoLive.heightMm <= 0
    )
      return;
    const frontW = spread.frontEnd - spread.spineEnd; // ön kapak genişliği (trim)
    const frontH = spread.totalHeight; // bleed dahil tam yükseklik
    const factor = Math.max(
      frontW / selectedGeoLive.widthMm,
      frontH / selectedGeoLive.heightMm,
    );
    const curX = positions[selectedId]?.scaleX ?? 1;
    const curY = positions[selectedId]?.scaleY ?? 1;
    patchGeo({
      scaleX: curX * factor,
      scaleY: curY * factor,
      leftMm: spread.frontCenter,
      topMm: spread.midY,
    });
  };
  // Kaybolan nesneyi kurtar: tam ortaya getir (ön kapak ortası).
  const centerSelected = () => {
    patchGeo({ leftMm: spread.frontCenter, topMm: spread.midY });
  };

  // 12 rakam girilirse son hane otomatik tamamlanır → barkod buna göre üretilir.
  const isbnDigits = normalizeIsbn(isbn);
  const isbnComplete = completeIsbn(isbn);
  const isbnState: "empty" | "valid" | "invalid" =
    isbnDigits.length === 0
      ? "empty"
      : isValidEan13(isbnComplete)
        ? "valid"
        : "invalid";
  // Kullanıcı 12 rakam yazdı, sistem 13.'yü ekledi → küçük bilgi notu göster.
  const isbnAutoCompleted = isbnDigits.length === 12 && isbnState === "valid";

  // Kurgu kapağı: tür etiketi ("ROMAN") standarttan gelir; yazar üstte düzeni.
  const briefActive = !!brief && !brief.skipped;
  // Tür etiketini uygulama yalnız yazıyı kendisi basıyorsa çizer (ChatGPT
  // bastıysa görselde zaten var).
  const genreLabel =
    briefActive && (brief.textBy ?? "ai") === "app"
      ? resolveStandard(brief.themaCode).label[lang]
      : undefined;
  const content = useMemo(
    () => ({
      title: title || t.titlePlaceholder,
      author: author || t.authorPlaceholder,
      subtitle,
      isbn: isbnComplete,
      genreLabel,
    }),
    [title, author, subtitle, isbnComplete, genreLabel, t.titlePlaceholder, t.authorPlaceholder],
  );

  const images: CoverImages = useMemo(
    () => ({
      cover: coverImage,
      coverDarken,
      coverOpacity,
      coverScope,
      coverFit,
      coverPanX,
      coverZoom,
      logo: logoImage,
      logoSize,
      logoPos,
      spineBand,
      photoLayout,
      photo: photoImage,
      photoRect,
    }),
    [coverImage, coverDarken, coverOpacity, coverScope, coverFit, coverPanX, coverZoom, logoImage, logoSize, logoPos, spineBand, photoLayout, photoImage, photoRect],
  );

  // labels'ı sabit referansa al → seçim değişince tuval gereksiz yere yeniden çizilmesin.
  const labels = useMemo(
    () => ({ backCover: t.backCover, spine: t.spine, frontCover: t.frontCover }),
    [t.backCover, t.spine, t.frontCover],
  );

  const readFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setter(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Tuvalin yüksek çözünürlüklü PNG çıktısını doğrudan indir (baskı için 300 DPI).
  const handleExportPng = () => {
    if (!requireExport(canExport, lang)) return;
    const dataUrl = canvasRef.current?.getPrintDataUrl(PRINT_DPI);
    if (!dataUrl) return;
    const safeTitle =
      (title || t.titlePlaceholder)
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 60) || "kapak";
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeTitle}-kapak.png`;
    a.click();
  };

  // silent: otomatik indirme (?export=1) — paket yoksa onay kutusu AÇMA.
  const handleExportPdf = async (silent = false): Promise<boolean> => {
    if (!requireExport(canExport, lang, silent)) return false;
    // Export başladı → bekleyen otomatik-export debounce'unu iptal et (tekrar
    // tetiklenmesin). Not: getPrintDataUrl zaten yakalamadan ÖNCE senkron
    // canvas.renderAll() yapar → kuyruktaki kare basılır.
    if (autoExportTimerRef.current) window.clearTimeout(autoExportTimerRef.current);
    const dataUrl = canvasRef.current?.getPrintDataUrl(PRINT_DPI);
    if (!dataUrl) {
      // Sessiz kalma: düğmeye basan kullanıcı neden inmediğini görsün.
      if (!silent && typeof window !== "undefined") {
        window.alert(
          lang === "tr"
            ? "Kapak dışa aktarılamadı. Sayfayı yenileyip tekrar dene; sürerse bize yaz."
            : "The cover couldn't be exported. Reload the page and try again; contact us if it persists.",
        );
      }
      return false;
    }
    setExporting(true);
    try {
      const safeTitle = (title || t.titlePlaceholder)
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 60) || "kapak";
      await exportCoverPdf(dataUrl, spread, `${safeTitle}-kapak.pdf`, cropMarks);
      return true;
    } catch (e) {
      console.warn("[kapak] PDF dışa aktarma başarısız", e);
      return false;
    } finally {
      setExporting(false);
    }
  };

  // Export modu: tuval HAZIR olunca (CoverCanvas onReady) Kapak PDF'ini bir kez
  // otomatik indir.
  //  (a) KRİTİK: hidrasyon (taslağın yüklenip uygulanması) bitene kadar onReady'yi
  //      YOK SAY. Aksi halde ilk (BOŞ) render export'u tetikler → boş kapak PDF'i.
  //      hydratedRef ancak applyDraft (başlık/yazar/görsel/logolar) uygulandıktan
  //      SONRA açılır; bulut modunda resolveDraftImages (ağ) bekler.
  //  (b) Hidrasyon SONRASI render'ın (kapak görseli + logo fromURL await'leri,
  //      autoContrast yeniden çizimleri) oturması için ~700ms debounce; her yeni
  //      onReady timer'ı sıfırlar → en son, dolu render baz alınır.
  const handleCanvasReady = () => {
    if (!autoExport || autoExportFiredRef.current || !hydratedRef.current) return;
    // Aktif paket yok → indirme hiç başlamaz, onay kutusu da açılmaz; katman
    // "paket gerekli" (locked) durumunda kalır.
    if (!requireExport(canExport, lang, true)) return;
    if (autoExportTimerRef.current) window.clearTimeout(autoExportTimerRef.current);
    autoExportTimerRef.current = window.setTimeout(async () => {
      if (autoExportFiredRef.current) return;
      // Savunma: tuval gerçekten doluysa bas. Beklenmedik şekilde her şey boşsa
      // SESSİZCE boş PDF üretme → "error"a düş (kullanıcı elle "Tekrar dene"yle
      // dolu içeriği indirir).
      const hasContent = !!title || !!author || !!images.cover || objects.length > 0;
      if (!hasContent) {
        autoExportFiredRef.current = true;
        if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
        setAutoExportStatus("error");
        return;
      }
      autoExportFiredRef.current = true;
      if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
      const ok = await handleExportPdf(true);
      setAutoExportStatus(ok ? "done" : "error");
    }, 700);
  };

  // SAFETY: hidrasyon/render asılı kalırsa overlay sonsuza dek "hazırlanıyor"
  // kalmasın. ~12 sn içinde export tetiklenmediyse "error"a düş → kullanıcı elle
  // "Tekrar dene"ye basabilir; o ana kadar gerçek içerik yüklenmiş olur, böylece
  // manuel export DOLU PDF üretir.
  useEffect(() => {
    if (!autoExport || !canExport) return; // paket yoksa "locked" kalır
    autoExportSafetyRef.current = window.setTimeout(() => {
      if (autoExportFiredRef.current) return;
      autoExportFiredRef.current = true;
      setAutoExportStatus("error");
    }, 12000);
    return () => {
      if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
    };
  }, [autoExport, canExport]);

  // Kapağı PNG olarak cihazın paylaşım menüsüyle paylaş (telefon/tablet ve
  // destekleyen masaüstü tarayıcılar). Desteklenmiyorsa PNG indirmeye düşer.
  const handleShare = async () => {
    const dataUrl = canvasRef.current?.getPrintDataUrl(PRINT_DPI);
    if (!dataUrl) return;
    const safeTitle =
      (title || t.titlePlaceholder)
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 60) || "kapak";
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${safeTitle}-kapak.png`, {
        type: "image/png",
      });
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: title || t.titlePlaceholder });
        return;
      }
    } catch {
      // Paylaşım iptal/başarısız → sessizce PNG indirmeye düş.
    }
    // Desteklenmiyor: PNG indir + kullanıcıyı bilgilendir.
    handleExportPng();
    if (typeof window !== "undefined") window.alert(t.downloadShareUnsupported);
  };

  // "İndir" menüsü açıkken dışarı tıklayınca ya da Esc'e basınca kapat.
  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!downloadMenuRef.current?.contains(e.target as Node))
        setDownloadMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDownloadMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadMenuOpen]);

  // Sayfa açılınca kayıtlı "son üretimler" geçmişini tarayıcıdan yükle.
  useEffect(() => {
    let alive = true;
    loadAiHistory().then((items) => {
      if (alive) setAiHistory(items);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Sayfa açılınca "Yüklemelerim" (görseller + şablonlar) kütüphanesini yükle.
  useEffect(() => {
    let alive = true;
    loadUserImages().then((items) => {
      if (alive) setUserImages(items);
    });
    loadUserTemplates().then((items) => {
      if (alive) setUserTemplates(items);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Bir taslağın (CoverDraft) TÜM alanlarını mevcut tasarıma uygular.
  // İki yerde kullanılır: (1) açılışta kayıtlı taslağı geri yüklerken,
  // (2) "Şablonlarım"dan kayıtlı bir şablonu uygularken. setState'ler kararlı
  // olduğundan bağımlılık listesi boş bırakılabilir.
  const applyDraft = useCallback((d: CoverDraft) => {
    // İçerik
    if (typeof d.title === "string") setTitle(d.title);
    if (typeof d.author === "string") setAuthor(d.author);
    if (typeof d.subtitle === "string") setSubtitle(d.subtitle);
    if (typeof d.isbn === "string") setIsbn(d.isbn);
    if (typeof d.templateId === "string") setTemplateId(d.templateId);
    if (d.titlePos) setTitlePos(d.titlePos);
    if (d.brief) setBrief(d.brief);
    if (typeof d.spineBand === "string" || d.spineBand === null) setSpineBand(d.spineBand);
    if (d.photoLayout === "framed" || d.photoLayout === "band" || d.photoLayout === "side") setPhotoLayout(d.photoLayout);
    if (typeof d.photoImage === "string") setPhotoImage(d.photoImage);
    if (d.photoRect) setPhotoRect(d.photoRect);
    if (typeof d.briefAppliedAt === "string") setBriefAppliedAt(d.briefAppliedAt);
    if (d.colorOverrides) setColorOverrides(d.colorOverrides);
    if (typeof d.showGuides === "boolean") setShowGuides(d.showGuides);
    // Görseller
    if (d.coverImage !== undefined) setCoverImage(d.coverImage);
    if (typeof d.coverDarken === "number") setCoverDarken(d.coverDarken);
    if (typeof d.coverOpacity === "number") setCoverOpacity(d.coverOpacity);
    if (d.coverScope) setCoverScope(d.coverScope);
    if (d.coverFit) setCoverFit(d.coverFit);
    if (typeof d.autoContrast === "boolean") setAutoContrast(d.autoContrast);
    if (typeof d.coverPanX === "number") setCoverPanX(d.coverPanX);
    if (typeof d.coverZoom === "number") setCoverZoom(d.coverZoom);
    if (d.logoImage !== undefined) setLogoImage(d.logoImage);
    if (typeof d.logoSize === "number") setLogoSize(d.logoSize);
    if (d.logoPos) setLogoPos(d.logoPos);
    // AI ayarları
    if (typeof d.aiStyle === "string") setAiStyle(d.aiStyle);
    if (d.aiModel) setAiModel(d.aiModel);
    if (typeof d.aiEmbedText === "boolean") setAiEmbedText(d.aiEmbedText);
    if (typeof d.aiDesc === "string") setAiDesc(d.aiDesc);
    if (d.aiScope) setAiScope(d.aiScope);
    // Kitap ayarları
    if (typeof d.sizeId === "string") setSizeId(d.sizeId);
    if (typeof d.pageCount === "number") setPageCount(d.pageCount);
    if (typeof d.paperGsm === "number") setPaperGsm(d.paperGsm);
    if (d.binding) setBinding(d.binding);
    if (typeof d.spineManualOn === "boolean") setSpineManualOn(d.spineManualOn);
    if (typeof d.spineManualValue === "number")
      setSpineManualValue(d.spineManualValue);
    if (typeof d.bleedMm === "number") setBleedMm(d.bleedMm);
    // PDF
    if (typeof d.cropMarks === "boolean") setCropMarks(d.cropMarks);
    // Editör
    if (d.positions) setPositions(d.positions);
    if (d.layers) setLayers(d.layers);
    if (d.hidden) setHidden(d.hidden);
    if (d.locked) setLocked(d.locked);
    if (typeof d.selectedAngle === "number") setSelectedAngle(d.selectedAngle);
    if (d.textStyles) setTextStyles(d.textStyles);
    if (Array.isArray(d.objects)) {
      setObjects(d.objects);
      // Yeni nesne kimlikleri çakışmasın diye sayacı en yükseğe çek.
      let maxN = 0;
      for (const o of d.objects) {
        const m = /^obj-(\d+)$/.exec(o.id);
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
      objCounter.current = maxN;
    }
  }, []);

  // --- Açılışta kayıtlı taslağı geri yükle ---
  // Tarayıcıdaki taslağı okuyup tüm alanları doldurur. Bittiğinde hydratedRef
  // açılır; ondan SONRA otomatik kayıt başlar (yoksa boş state'i kaydederdik).
  useEffect(() => {
    let alive = true;

    // BULUT MODU: ?project ile açıldıysa IndexedDB'ye DOKUNMA (anonim yerel taslak
    // korunur). Projenin kapağını uygula; meta başlık/yazar kapağın üstüne yazılır
    // (tek doğru kaynak meta). Görsel YOLLARI imzalı URL'e çözülür (render için).
    if (projectId && initialProject) {
      const env = initialProject.data;
      const reconciled: CoverDraft = {
        ...env.cover,
        title: env.meta.title || env.cover.title || "",
        author: env.meta.author || env.cover.author || "",
        subtitle: env.meta.subtitle ?? env.cover.subtitle,
        isbn: env.meta.isbn ?? env.cover.isbn,
      };
      resolveDraftImages(createBrowserSupabase(), reconciled)
        .then((d) => {
          if (alive) applyDraft(d);
        })
        .catch(() => {
          if (alive) applyDraft(reconciled);
        })
        .finally(() => {
          if (alive) hydratedRef.current = true;
        });
      return () => {
        alive = false;
      };
    }

    // ESCAPE HATCH: ?reset=1 ile açılırsa taslağı temizle, geri yükleme yapma,
    // URL'i sadeleştir. (Bozuk bir taslak boot-loop'a sokarsa kurtarma yolu.)
    let forceReset = false;
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("reset") === "1") {
        forceReset = true;
        sp.delete("reset");
        const qs = sp.toString();
        const clean =
          window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        window.history.replaceState(null, "", clean);
      }
    } catch {
      // URL erişilemezse sorun değil; normal yükleme yoluna devam et.
    }
    if (forceReset) {
      clearCoverDraft().finally(() => {
        if (alive) hydratedRef.current = true;
      });
      return () => {
        alive = false;
      };
    }
    loadCoverDraft()
      .then((d) => {
        if (!alive) return;
        if (!d) return;
        // VALİDASYON: taslağı uygularken hata olursa geri yükleme deme — AMA
        // taslağı DİSKTEN SİLME. Eskiden burada clearCoverDraft() vardı; geçici
        // bir hata kullanıcının tüm tasarımını kalıcı siliyordu (VERİ KAYBI).
        // Gerçek boot-loop için ?reset=1 çıkış kapısı zaten var; kullanıcı verisi
        // asla otomatik silinmemeli.
        try {
        applyDraft(d);
        // Geri yüklenecek anlamlı bir şey varsa kullanıcıya bildir.
        const hasContent =
          !!d.title ||
          !!d.author ||
          !!d.coverImage ||
          (Array.isArray(d.objects) && d.objects.length > 0);
        if (hasContent) setDraftRestored(true);
        } catch {
          // Hatalı uygulama: taslağı KORU (silme), sadece "geri yüklendi" deme.
          setDraftRestored(false);
        }
      })
      .catch(() => {
        // loadCoverDraft'ın kendisi patlarsa sessizce boş tasarımla devam et.
      })
      .finally(() => {
        if (alive) hydratedRef.current = true;
      });
    return () => {
      alive = false;
    };
  }, [applyDraft, projectId, initialProject]);

  // --- Geri al / ileri al ---
  // Her otomatik kayıt bir adım olur (son 40). Geri alınca o adımın taslağı
  // applyDraft ile uygulanır; bu uygulama yeni bir adım SAYILMAZ.
  const pushHistory = (d: CoverDraft) => {
    const applied = appliedHistoryRef.current;
    appliedHistoryRef.current = null;
    if (applied && sameDesign(applied, d)) return;
    const past = undoStackRef.current;
    const prev = past[past.length - 1];
    if (prev && sameDesign(prev, d)) return;
    past.push(d);
    if (past.length > 40) past.shift();
    redoStackRef.current = [];
    syncHist();
  };
  // Henüz kayda düşmemiş (600 ms beklemedeki) son düzenlemeyi geçmişe yaz —
  // yoksa hemen ardından basılan "Geri al" onu kaybeder ve iki adım geri gider.
  const flushPendingHistory = () => {
    const pending = latestDraftRef.current;
    const past = undoStackRef.current;
    const top = past[past.length - 1];
    const applied = appliedHistoryRef.current;
    if (pending && top && !sameDesign(pending, top) && !(applied && sameDesign(applied, pending))) {
      past.push(pending);
      if (past.length > 40) past.shift();
      redoStackRef.current = [];
    }
  };
  // Anlık görüntüyü BİREBİR geri yükle: applyDraft boş (null) alanları atlar
  // (kayıtlı taslak yüklerken doğru), geri almada ise onlar da geri gelmeli.
  // AI form alanları ve kılavuz anahtarı geçmişin parçası değil → şimdiki değer kalır.
  const restoreSnapshot = (d: CoverDraft) => {
    const merged: CoverDraft = { ...d, aiDesc, aiModel, aiStyle, aiScope, aiEmbedText, showGuides, selectedAngle };
    appliedHistoryRef.current = merged;
    applyDraft(merged);
    setBrief(d.brief ?? null);
    setPhotoLayout(d.photoLayout ?? null);
    setPhotoImage(d.photoImage ?? null);
    setPhotoRect(d.photoRect ?? null);
    setBriefAppliedAt(d.briefAppliedAt ?? null);
    setSelectedId(null);
  };
  const undo = () => {
    if (editOpen) return;
    flushPendingHistory();
    const past = undoStackRef.current;
    if (past.length < 2) return;
    redoStackRef.current.push(past.pop()!);
    restoreSnapshot(past[past.length - 1]);
    syncHist();
  };
  const redo = () => {
    if (editOpen) return;
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(next);
    restoreSnapshot(next);
    syncHist();
  };
  const canUndo = histLen.undo > 1;
  const canRedo = histLen.redo > 0;
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const pushHistoryRef = useRef(pushHistory);
  const editOpenRef = useRef(false);
  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
    pushHistoryRef.current = pushHistory;
    editOpenRef.current = editOpen;
  });
  // Kısayol: ⌘/Ctrl+Z geri, ⌘/Ctrl+Shift+Z (ya da Ctrl+Y) ileri. Yazı yazarken dokunma.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || editOpenRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement | null)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Değişiklikleri otomatik kaydet (debounce) ---
  // hydratedRef açılana kadar (ilk yükleme) kayıt yapma. Her değişiklikten
  // ~0,6 sn sonra diske yaz; arada yeni değişiklik gelirse zamanlayıcı sıfırlanır.
  useEffect(() => {
    // SALT-OKUNUR EXPORT MODU: indirme ekranından "?export=1" ile açıldıysa kapağı
    // YALNIZCA basıyoruz — kullanıcının kayıtlı tasarımının üzerine ASLA yazma
    // (yoksa geçici/yeniden-hesaplanmış geometri kaydedilip tasarım "dağılır").
    if (!hydratedRef.current || autoExport) return;
    // VERİ KAYBI KORUMASI: tamamen boş (varsayılan) bir state'i ASLA otomatik
    // kaydetme. Bir yükleme/render hatası state'i sıfırlarsa, bu kayıt kullanıcının
    // diskteki iyi taslağını boşla ezerdi. Gerçek "Yeni tasarım" taslağı zaten
    // ayrıca (clearCoverDraft ile) siler; bu yüzden burada boşu atlamak güvenli.
    const isEmptyDesign =
      !title &&
      !author &&
      !subtitle &&
      !isbn &&
      !coverImage &&
      !logoImage &&
      objects.length === 0;
    if (isEmptyDesign) return;
    const draft: CoverDraft = {
      v: COVER_DRAFT_VERSION,
      title,
      author,
      subtitle,
      isbn,
      templateId,
      titlePos,
      brief: brief ?? undefined,
      spineBand,
      photoLayout,
      photoImage,
      photoRect,
      briefAppliedAt,
      colorOverrides,
      showGuides,
      coverImage,
      coverDarken,
      coverOpacity,
      coverScope,
      coverFit,
      autoContrast,
      coverPanX,
      coverZoom,
      logoImage,
      logoSize,
      logoPos,
      aiStyle,
      aiModel,
      aiEmbedText,
      aiDesc,
      aiScope,
      sizeId,
      pageCount,
      paperGsm,
      binding,
      spineManualOn,
      spineManualValue,
      bleedMm,
      cropMarks,
      positions,
      layers,
      hidden,
      locked,
      selectedAngle,
      textStyles,
      objects,
    };
    latestDraftRef.current = draft;
    // Kasıtlı: "kaydediliyor" göstergesi. draftStatus hiçbir effect'in bağımlılığı
    // değil → döngü yapmaz; kural fazla temkinli olduğundan bu satırda kapatıyoruz.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      pushHistoryRef.current(draft);
      if (projectId) {
        // Buluta kaydet. Küçük resmi her ~4 sn'de bir, düşük DPI ile üret (ucuz).
        let thumb: string | undefined;
        const now = Date.now();
        if (now - lastThumbRef.current > 4000) {
          thumb = canvasRef.current?.getPrintDataUrl(72) ?? undefined;
          lastThumbRef.current = now;
        }
        void saveProjectCover(projectId, draft, thumb)
          .then(() => setDraftStatus("saved"))
          .catch(() => setDraftStatus("saved"));
      } else {
        void saveCoverDraft(draft).then(() => setDraftStatus("saved"));
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    title,
    author,
    subtitle,
    isbn,
    templateId,
    titlePos,
    brief,
    spineBand,
    photoLayout,
    photoImage,
    photoRect,
    briefAppliedAt,
    colorOverrides,
    showGuides,
    coverImage,
    coverDarken,
    coverOpacity,
    coverScope,
    coverFit,
    autoContrast,
    coverPanX,
    coverZoom,
    logoImage,
    logoSize,
    logoPos,
    aiStyle,
    aiModel,
    aiEmbedText,
    aiDesc,
    aiScope,
    sizeId,
    pageCount,
    paperGsm,
    binding,
    spineManualOn,
    spineManualValue,
    bleedMm,
    cropMarks,
    positions,
    layers,
    hidden,
    locked,
    selectedAngle,
    textStyles,
    objects,
    projectId,
    autoExport,
  ]);

  // --- Sekme kapanırken/gizlenirken bekleyen kaydı hemen yaz ---
  // Debounce penceresinde sayfa kapanırsa son değişiklikler kaybolmasın.
  useEffect(() => {
    // Salt-okunur export modunda dinleyici BAĞLAMA → geri dönerken bile yazma yok.
    if (autoExport) return;
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (latestDraftRef.current) {
        if (projectId) void saveProjectCover(projectId, latestDraftRef.current);
        else void saveCoverDraft(latestDraftRef.current);
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [projectId, autoExport]);

  // "Yeni tasarım": kayıtlı taslağı sil + tüm alanları varsayılana döndür.
  const startNewDesign = () => {
    if (typeof window !== "undefined" && !window.confirm(t.draftNewConfirm))
      return;
    // Bekleyen otomatik-kaydı iptal et + son taslak referansını temizle: aksi halde
    // debounce penceresindeki ya da sekme-gizlenince çalışan flush, SİLDİĞİMİZ eski
    // taslağı geri yazıp "tam temizlenmedi" hatasına yol açabilir.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    latestDraftRef.current = null;
    void clearCoverDraft();
    // İçerik
    setTitle("");
    setAuthor("");
    setSubtitle("");
    setIsbn("");
    setTemplateId(DEFAULT_TEMPLATE_ID);
    setColorOverrides({});
    setShowGuides(true);
    // Görseller
    setCoverImage(null);
    setCoverDarken(0);
    setCoverOpacity(1);
    setCoverScope("front");
    setCoverFit("fill");
    setAutoContrast(true);
    setCoverPanX(0);
    setCoverZoom(1);
    setLogoImage(null);
    setLogoSize(22);
    setLogoPos("bottom");
    // AI ayarları
    setAiStyle(DEFAULT_AI_STYLE_ID);
    setAiModel("flux");
    setAiEmbedText(true);
    setAiDesc("");
    setAiScope("wrap");
    // Kitap ayarları
    setSizeId(DEFAULT_SIZE_ID);
    setPageCount(200);
    setPaperGsm(80);
    setBinding("soft");
    setSpineManualOn(false);
    setSpineManualValue(11);
    setBleedMm(DEFAULT_BLEED_MM);
    // PDF
    setCropMarks(true);
    // Editör
    setPositions({});
    setLayers({});
    setHidden({});
    setLocked({});
    setTextStyles({});
    setSelectedAngle(0);
    setSelectedId(null);
    setObjects([]);
    objCounter.current = 0;
    setDraftRestored(false);
  };

  // Geçmişe yeni görsel ekle (başa al, son AI_HISTORY_LIMIT taneyi tut) + kaydet.
  const pushAiHistory = (image: string, scope: "front" | "wrap") => {
    setAiHistory((prev) => {
      const item: AiHistoryItem = {
        id: `ai-${Date.now()}`,
        image,
        scope,
        createdAt: Date.now(),
      };
      const next = [item, ...prev].slice(0, AI_HISTORY_LIMIT);
      void saveAiHistory(next);
      return next;
    });
  };

  // Geçmişteki bir görseli kapağa geri yükle.
  const restoreAiHistory = (item: AiHistoryItem) => {
    setCoverImage(item.image);
    setCoverScope(item.scope);
    setCoverPanX(0);
    setCoverZoom(1);
    showCoverLayer();
  };

  // Geçmişi temizle (tarayıcıdan da sil).
  const clearAiHistory = () => {
    setAiHistory([]);
    void saveAiHistory([]);
  };

  // ── "Yüklemelerim" — görsel kütüphanesi ──
  // Görseli kütüphaneye ekle (aynısı zaten varsa tekrar ekleme). En yeniler başta.
  const pushUserImage = (image: string, source: "upload" | "ai") => {
    setUserImages((prev) => {
      if (prev.some((it) => it.image === image)) return prev; // çift kayıt yok
      const item: UserImage = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        image,
        source,
        createdAt: Date.now(),
      };
      const next = [item, ...prev].slice(0, USER_IMAGES_LIMIT);
      void saveUserImages(next);
      return next;
    });
  };

  // Bilgisayardan doğrudan kütüphaneye görsel yükle (kapağa uygulamadan).
  const handleLibraryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") pushUserImage(reader.result, "upload");
      };
      reader.readAsDataURL(file);
    }
  };

  // Kütüphanedeki görseli kapak görseli yap.
  // Bir kapak görseli atandığında kapak katmanının "göz"ünü aç (gizliyse).
  // Kullanıcı bir görseli açıkça kapak yaptıysa onu GÖRMEK ister; daha önce
  // (ör. katman panelinden) gizlenip taslağa yazılmış bir görünürlük bayrağı
  // yüzünden tuvalin boş görünmesini engeller.
  const showCoverLayer = () =>
    setHidden((p) => {
      if (!p.cover) return p;
      const next = { ...p };
      delete next.cover;
      return next;
    });

  const applyLibraryImageAsCover = (img: UserImage) => {
    setCoverImage(img.image);
    setCoverPanX(0);
    setCoverZoom(1);
    showCoverLayer();
  };

  // Kütüphanedeki görseli serbest "görsel nesne" olarak tuvale ekle.
  const addLibraryImageAsObject = (img: UserImage) => {
    addObject({ type: "image", src: img.image, fill: colors.ink });
  };

  // Kütüphaneden bir görseli sil.
  const deleteUserImage = (id: string) => {
    setUserImages((prev) => {
      const next = prev.filter((it) => it.id !== id);
      void saveUserImages(next);
      return next;
    });
  };

  // ── "Yüklemelerim" — kendi şablonlarım ──
  // O anki tasarımı isimli bir şablon olarak kaydet (küçük önizlemesiyle).
  const saveCurrentAsTemplate = () => {
    const name = (
      typeof window !== "undefined"
        ? window.prompt(t.libraryTemplateNamePrompt, t.libraryDefaultTemplateName)
        : t.libraryDefaultTemplateName
    )?.trim();
    if (!name) return; // iptal edildi
    // Tasarımın tam anlık görüntüsü = en güncel taslak (yoksa şimdi kurulanı kullan).
    const draft: CoverDraft = latestDraftRef.current ?? {
      v: COVER_DRAFT_VERSION,
      title,
      author,
      subtitle,
      isbn,
      templateId,
      titlePos,
      brief: brief ?? undefined,
      spineBand,
      photoLayout,
      photoImage,
      photoRect,
      briefAppliedAt,
      colorOverrides,
      showGuides,
      coverImage,
      coverDarken,
      coverOpacity,
      coverScope,
      coverFit,
      autoContrast,
      coverPanX,
      coverZoom,
      logoImage,
      logoSize,
      logoPos,
      aiStyle,
      aiModel,
      aiEmbedText,
      aiDesc,
      aiScope,
      sizeId,
      pageCount,
      paperGsm,
      binding,
      spineManualOn,
      spineManualValue,
      bleedMm,
      cropMarks,
      positions,
      layers,
      hidden,
      locked,
      selectedAngle,
      textStyles,
      objects,
    };
    // Düşük DPI'da küçük önizleme (liste karesi için yeterli, yer kaplamaz).
    const thumb = canvasRef.current?.getPrintDataUrl(24) ?? "";
    setUserTemplates((prev) => {
      const item: UserTemplate = {
        id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        thumb,
        draft,
        createdAt: Date.now(),
      };
      const next = [item, ...prev].slice(0, USER_TEMPLATES_LIMIT);
      void saveUserTemplates(next);
      return next;
    });
  };

  // Kayıtlı bir şablonu uygula (mevcut tasarımın yerine geçer).
  const applyUserTemplate = (tpl: UserTemplate) => {
    if (typeof window !== "undefined" && !window.confirm(t.libraryApplyConfirm))
      return;
    applyDraft(tpl.draft);
    setSelectedId(null);
  };

  // Kayıtlı bir şablonu sil.
  const deleteUserTemplate = (id: string) => {
    setUserTemplates((prev) => {
      const next = prev.filter((it) => it.id !== id);
      void saveUserTemplates(next);
      return next;
    });
  };

  // AI kapak görseli üret → mevcut "kapak görseli" boru hattına aktar.
  // Başarıyla görsel yerleştiyse true döner (sihirbaz arka kapak yazısını
  // yalnız o zaman ekler).
  // Kapakta yazarın fotoğrafı varsa onun yuvası (yeniden üretimde de boş kalsın).
  const currentPhotoSlot = (): PhotoSlot | undefined => {
    if (!photoImage || !photoLayout) return undefined;
    const sl = photoSlotMm(spread, photoLayout);
    return { layout: photoLayout, xMm: sl.x, yMm: sl.y, wMm: sl.w, hMm: sl.h };
  };
  // KURGU KONSEPTİ → ChatGPT komutunun konsept + yazı katmanları. Hem kurgudan
  // gelen ilk üretim hem de tuvaldeki "Üret" düğmesi bunu kullanır (yoksa
  // yeniden üretimde konsept düşer, hazır stil ön ayarı devreye girerdi).
  const conceptGenOpts = (
    b: CoverBrief,
    photoSlot: PhotoSlot | undefined,
  ): Pick<AiGenOpts, "override" | "text"> => {
    const standard = resolveStandard(b.themaCode);
    const concept = getConceptOf(standard, b.conceptId);
    const ov = briefStyleOverride(b);
    const usePhoto = !!photoSlot && concept.photo?.layout === photoSlot.layout;
    const note = (b.note ?? "").trim();
    const byAi = (b.textBy ?? "ai") === "ai";
    // Yazıyı ChatGPT bassın (varsayılan): başlık/yazar/tür etiketi birebir.
    const text: LayeredText | undefined = byAi
      ? {
          title,
          author,
          subtitle: subtitle.trim() || undefined,
          genreLabel: standard.label[lang] || undefined,
          // Konsept "notu bas" diyorsa (şiir dizeleri) not kapağa birebir basılır.
          extra: ov.noteAsText && note ? note : undefined,
        }
      : undefined;
    // Konsept yazı düzenini gerçek metinle kurabiliyorsa (ör. dev sözcüğü uygulama
    // seçer) onu kullan — koşulları modele bırakmak başlığın sırasını bozuyordu.
    const layout = text && concept.textLayoutFor ? concept.textLayoutFor(text, lang) : ov.textLayout;
    return {
      text,
      override: {
        // Fotoğraflı kapakta konsept cümlesi yerine "yuvayı boş bırak" tarifi;
        // zemin rengi konsepte aittir → ton seçimi komuta girmez.
        stylePrompt: usePhoto && concept.photo ? concept.photo.prompt : ov.stylePrompt,
        dark: usePhoto ? !!concept.dark : ov.dark,
        tonePrompt: usePhoto ? undefined : ov.tonePrompt,
        // Fotoğraf yuvası varken konsept kendi "yuvalı" yazı düzenini verebilir.
        textLayout: usePhoto && concept.photo?.textLayout ? concept.photo.textLayout : layout,
        bookTitle: title,
      },
    };
  };
  // Tuvalde geçerli (atlanmamış) bir kurgu var mı → ChatGPT üretimi konseptle yapılır.
  const activeBrief = brief && !brief.skipped ? brief : null;
  const slotFor = (opts?: AiGenOpts): PhotoSlot | undefined =>
    opts?.photoSlot === undefined ? currentPhotoSlot() : (opts.photoSlot ?? undefined);
  const generateAiCover = async (opts?: AiGenOpts): Promise<boolean> => {
    if (aiBusyRef.current) return false; // zaten üretiliyor → çift istek yok
    aiBusyRef.current = true;
    lastAiOptsRef.current = opts ?? {};
    const ctrl = new AbortController();
    aiAbortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort("timeout"), CLIENT_AI_TIMEOUT_MS);
    setAiBusy(true);
    setAiElapsed(0);
    setAiError("none");
    setAiCredit(null);
    setAiNotice("none");
    try {
      // Sihirbaz otomatik üretimi taze değerleri override ile geçer (state
      // güncellemesi asenkron olduğundan); override yoksa mevcut state kullanılır.
      const useStyle = opts?.styleId ?? aiStyle;
      const useDesc = opts?.desc ?? aiDesc;
      const useModel = opts?.model ?? aiModel;
      const useScope = opts?.scope ?? aiScope;
      const useEmbed = opts?.embedText ?? aiEmbedText;
      const wrap = useScope === "wrap";
      // Nano/Ideogram + "metni göm" açıksa: başlık/yazar görselin İÇİNE basılsın
      // diye metinli komut (bu iki model yazıyı iyi basar). Aksi halde (FLUX veya
      // göm kapalı): yazısız sanat komutu.
      // ChatGPT'de yazı yalnız kurgu "ChatGPT bassın" dediyse gömülür (opts.text).
      const embed =
        useModel === "openai"
          ? !!opts?.text
          : (useModel === "nano" || useModel === "ideogram") && useEmbed;
      // ChatGPT: ölçülerden hesaplanan bölge kurallarıyla KATMANLI komut
      // (başlık bandı sade, logo bandı açık, arka kapak açık, sırt boş; yazı
      // ya görsele gömülür ya da uygulama bindirir).
      const prompt =
        useModel === "openai"
          ? buildLayeredPrompt({
              styleId: useStyle,
              description: useDesc,
              wrap,
              geo: spread,
              override: opts?.override,
              text: opts?.text,
              // Fotoğraf zaten yerleştirildiyse yeniden üretimde de yuva boş kalsın.
              photoSlot: slotFor(opts),
            })
          : embed
            ? buildNanoCoverPrompt({
                styleId: useStyle,
                description: useDesc,
                title,
                author,
                subtitle,
                wrap,
              })
            : buildAiPrompt(useStyle, useDesc, wrap);
      // Nano Banana Pro: tek URL üretir, "custom" boyut desteklemez → kitabın
      // oranına en yakın izinli oranı seçeriz (yatay sarmal dahil).
      // FLUX: tam sarmalda özel boyut, sadece önde en yakın dikey oran.
      // ChatGPT: her iki kapsamda kapağın GERÇEK oranında özel boyut.
      const endpoint =
        useModel === "openai"
          ? "/api/cover-openai"
          : useModel === "nano"
            ? "/api/cover-nano"
            : useModel === "ideogram"
              ? "/api/cover-ideogram"
              : "/api/cover-art";
      // Nano ve Ideogram aynı oran kümesini (yatay sarmal dahil) kabul eder →
      // ikisi de nearestNanoAspect kullanır; özel boyut desteklemezler.
      const payload =
        useModel === "openai"
          ? { prompt, size: openaiSize(spread, wrap) }
          : useModel === "nano" || useModel === "ideogram"
            ? {
                prompt,
                aspectRatio: wrap
                  ? nearestNanoAspect(spread.totalWidth, spread.totalHeight)
                  : nearestNanoAspect(spread.bookWidth, spread.bookHeight),
              }
            : wrap
              ? {
                  prompt,
                  aspectRatio: "custom",
                  ...spreadCustomDims(spread.totalWidth, spread.totalHeight),
                }
              : {
                  prompt,
                  aspectRatio: nearestAspectRatio(
                    spread.bookWidth,
                    spread.bookHeight,
                  ),
                };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (res.status === 504) {
        setAiError("timeout"); // sunucu bütçesi doldu, üretim iptal edildi
        return false;
      }
      if (res.status === 503) {
        setAiError("token");
        return false;
      }
      // 402 jeton yetmedi / 401 oturum kapandı → ortak uyarı (ayrı ayrı).
      const problem = res.ok ? null : await creditProblemFrom(res);
      if (problem) {
        noteCreditProblem(problem);
        setAiCredit(problem);
        setAiError("credits");
        return false;
      }
      if (!res.ok) {
        setAiError("generic");
        return false;
      }
      const data = (await res.json()) as {
        image?: string;
        usage?: { estUsd?: number } | null;
      };
      if (!data.image) {
        setAiError("generic");
        return false;
      }
      spendCredits(aiModelCost(useModel));
      setAiLastCost(typeof data.usage?.estUsd === "number" ? data.usage.estUsd : null);
      // ChatGPT görseli üst bandı başlık için sade bırakır → başlığı oraya al.
      if (useModel === "openai") setTitlePos("top");
      // Fotoğraf yuvası istendiyse: yapay zekânın bıraktığı YEŞİL yer tutucunun
      // gerçek yerini ölç → fotoğraf tam oraya oturur (yazılarla hizalı kalır).
      const slotUsed = useModel === "openai" ? slotFor(opts) : undefined;
      if (!slotUsed) {
        if (!photoImage) setPhotoLayout(null); // fotoğraf yoksa tam kapak
      } else {
        const img = data.image;
        void findChromaRect(img).then((cr) => {
          if (!cr) {
            setPhotoRect(null); // bulunamadı → varsayılan yuva
            return;
          }
          const r = wrap
            ? { x: 0, y: 0, w: spread.totalWidth, h: spread.totalHeight }
            : { x: spread.spineEnd, y: 0, w: spread.totalWidth - spread.spineEnd, h: spread.totalHeight };
          // Tuval görseli "doldur" ile çizer: aynı ölçek ve ortalama.
          const sc = Math.max(r.w / cr.iw, r.h / cr.ih);
          const dw = cr.iw * sc, dh = cr.ih * sc;
          const left = r.x + r.w / 2 - dw / 2, top = r.y + r.h / 2 - dh / 2;
          const pad = 0.6; // kenar yumuşatmasındaki yeşili de kapat
          if (slotUsed.layout === "band") {
            // Bant: fotoğraf ön kapağın tepesinden (taşma dahil) yeşilin altına.
            const bottom = top + (cr.fy + cr.fh) * dh + pad;
            setPhotoRect({ x: spread.spineEnd, y: 0, w: spread.totalWidth - spread.spineEnd, h: bottom });
          } else if (slotUsed.layout === "side") {
            // Sağ alt: yeşilin sol-üst köşesinden sağ ve alt kenara (taşma dahil).
            const x = Math.max(spread.spineEnd, left + cr.fx * dw - pad);
            const y = top + cr.fy * dh - pad;
            setPhotoRect({ x, y, w: spread.totalWidth - x, h: spread.totalHeight - y });
          } else {
            setPhotoRect({
              x: left + cr.fx * dw - pad,
              y: top + cr.fy * dh - pad,
              w: cr.fw * dw + pad * 2,
              h: cr.fh * dh + pad * 2,
            });
          }
        });
      }
      // Sarmal üretimde sırt bandı: görselin koyu tonundan otomatik renk.
      if (wrap) {
        void spineColorFromImage(data.image).then((c) => {
          if (c) setSpineBand(c);
        });
      }
      setCoverImage(data.image);
      setCoverScope(wrap ? "wrap" : "front");
      setCoverPanX(0);
      setCoverZoom(1);
      showCoverLayer(); // gizlenmiş "kapak" katmanı varsa aç ki üretilen görsel görünsün
      pushAiHistory(data.image, wrap ? "wrap" : "front");
      pushUserImage(data.image, "ai"); // "Yüklemelerim" kütüphanesine de ekle
      // Başlık görsele gömüldüyse, kendi başlık/yazar/altbaşlık yazı katmanlarını
      // gizle ki çift yazı olmasın (Katman panelinden geri açılabilir).
      if (embed) {
        setHidden((p) => ({
          ...p,
          title: true,
          author: true,
          subtitle: true,
        }));
        setAiNotice("embed");
      }
      return true;
    } catch {
      // Vazgeç: sessiz. Zaman aşımı: özel mesaj. Diğer: genel hata.
      const reason = ctrl.signal.aborted ? ctrl.signal.reason : null;
      if (reason === "user") setAiError("none");
      else setAiError(reason === "timeout" ? "timeout" : "generic");
      return false;
    } finally {
      clearTimeout(timer);
      if (aiAbortRef.current === ctrl) aiAbortRef.current = null;
      aiBusyRef.current = false;
      setAiBusy(false);
    }
  };
  // Süren AI üretimini kullanıcı isteğiyle durdur (bekleme ekranı → Vazgeç).
  const cancelAiGeneration = () => {
    aiAbortRef.current?.abort("user");
  };
  // Tuval üstündeki hata şeridinin metni.
  const aiErrorText =
    aiError === "token"
      ? t.aiErrorToken
      : aiError === "timeout"
        ? t.aiErrorTimeout
        : t.aiErrorGeneric;
  // Sihirbaz kapak adımı, kitap adı boşken SESSİZCE atlıyordu → açıkla.
  // (title state'i yüklemeden önce boş olabilir; meta'daki ad da boşsa gerçekten boştur.)
  const wizardMissingTitle =
    !!wizardAuto &&
    !autoExport &&
    !title.trim() &&
    !(initialProject?.data.meta.title ?? "").trim();

  // ── SİHİRBAZ: kapak adımında kitap bilgisinden kapak üretimi ──
  // Kitap asistanı (tür+bilgi → art-direction promtu) → Flux arka plan → başlık/
  // yazar kapağın kendi katmanlarıyla üstüne biner.
  // Üretim jeton harcadığı için KENDİLİĞİNDEN başlamaz: önce onay kartı çıkar
  // (wizardOffer); üye "Üret" derse bir kez çalışır. Export modunda asla sorulmaz.
  const wizardOffer =
    !!wizardAuto &&
    !autoExport &&
    wizardChoice === "none" &&
    !brief && // kurgu sayfası yönetiyor (ya da kullanıcı kurguyu atladı)
    !!title.trim() && // başlık hazır
    !coverImage && // + henüz kapak yok
    objects.length === 0; // + üye elle tasarlamaya başlamamış
  // Bakiye biliniyor ve yetmiyorsa üretim önerilmez (null = sınırsız → hep yeter).
  const wizardAffordable = balance == null || balance >= WIZARD_COVER_COST;
  const runWizardCover = () => {
    if (wizardChoice !== "none") return; // çift tık → tek üretim
    setWizardChoice("run");
    void (async () => {
      const genre = initialProject?.data.meta.genre ?? "";
      const summary = (initialProject?.data.manuscript.text ?? "").slice(0, 1500);
      let desc = "";
      let styleId = aiStyle;
      let blurb = "";
      // 1. aşama (kitap asistanı): iptal edilebilir + zaman aşımlı.
      const ctrl = new AbortController();
      aiAbortRef.current = ctrl;
      const timer = setTimeout(() => ctrl.abort("timeout"), WIZARD_PROMPT_TIMEOUT_MS);
      setAiElapsed(0);
      setCoverGenMsg(lang === "tr" ? "Kitap asistanı kapak fikrini yazıyor…" : "The book assistant is sketching your cover…");
      try {
        const res = await fetch("/api/cover-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, author, genre, summary, lang }),
          signal: ctrl.signal,
        });
        // Jeton yetmedi / oturum kapandı → görsel adımına hiç geçme, uyarıyı göster.
        let problem = res.ok ? null : await creditProblemFrom(res);
        // Bu uç, asistan anahtarı geçersizken de 401 döner ({error:"bad-key"}).
        // O oturum hatası değildir → asistan hatası say, stil presetiyle devam et.
        if (problem?.kind === "auth") {
          const j = (await res.clone().json().catch(() => null)) as { error?: unknown } | null;
          if (j?.error !== "auth") problem = null;
        }
        if (problem) {
          noteCreditProblem(problem);
          setAiCredit(problem);
          setAiError("credits");
          setCoverGenMsg(null);
          return;
        }
        if (res.ok) {
          spendCredits(creditCost("cover-prompt"));
          const data = (await res.json()) as {
            artDirection?: string;
            suggestedStyle?: string;
            backCover?: string;
          };
          if (data.artDirection) desc = data.artDirection;
          if (data.suggestedStyle) styleId = data.suggestedStyle;
          if (data.backCover) blurb = data.backCover;
        }
      } catch {
        // asistan başarısız / zaman aşımı olsa da stil presetiyle bir kapak üretelim
      } finally {
        clearTimeout(timer);
        if (aiAbortRef.current === ctrl) aiAbortRef.current = null;
      }
      try {
        if (ctrl.signal.aborted && ctrl.signal.reason === "user") return; // Vazgeç
        setAiStyle(styleId);
        setAiDesc(desc);
        setAiModel("flux");
        setAiScope("wrap");
        setCoverGenMsg(lang === "tr" ? "Kapak görseli üretiliyor…" : "Generating cover artwork…");
        const done = await generateAiCover({ styleId, desc, model: "flux", scope: "wrap", embedText: false });
        // Arka kapak yazısını arka kapağa düzenlenebilir metin olarak ekle.
        if (done && blurb) addBackCoverBlurb(blurb);
      } finally {
        setCoverGenMsg(null); // ne olursa olsun bekleme ekranı kapanır
      }
    })();
  };

  // ── KAPAK KURGUSU: kurgu sayfasından "Tuvale gönder ve üret" ile gelindi ──
  // Kayıtlı kurgu (konsept/küme/yazı/ton/kapsam) → kitap asistanı sahneyi yazar
  // → ChatGPT katmanlı komutla üretir → yazı stili şablon olarak uygulanır,
  // başlık üst banda alınır. Bir kez çalışır (kapak yoksa).
  const briefFiredRef = useRef(false);
  useEffect(() => {
    if (!briefRun || autoExport || briefFiredRef.current) return;
    if (!brief || brief.skipped || !title.trim()) return;
    // Bu kurgu zaten uygulandıysa (sayfa yenilendi) tekrar üretme; yeni kurgu
    // (kurgu sayfasından yeniden gönderildi) mevcut kapağın üstüne yeniden üretir.
    if (brief.createdAt && brief.createdAt === briefAppliedAt) return;
    briefFiredRef.current = true;
    const b = brief;
    // Tek seferlik (briefFiredRef korur): damgayı işaretle → taslakla kaydedilir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBriefAppliedAt(b.createdAt ?? null);
    // Yenilemede tekrar tetiklenmesin: adres çubuğundan ?kurgu=1'i kaldır.
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("kurgu");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {
      // önemli değil
    }
    void (async () => {
      // Yazarın KENDİ fotoğrafı (anı/biyografi): kapağı yine yapay zekâ tasarlar
      // ama fotoğraf yuvasını BOŞ bırakır; fotoğraf o yuvaya birebir oturur
      // (yapay zekâ fotoğrafa dokunmaz, yüz aynı kalır).
      const concept = getConceptOf(resolveStandard(b.themaCode), b.conceptId);
      let photoSlot: PhotoSlot | undefined;
      if (concept.photo && b.photo && projectId) {
        const raw = await loadBriefPhoto(projectId);
        if (raw) {
          const img = b.photo.mono ? await toMonoPhoto(raw) : raw;
          const sl = photoSlotMm(spread, concept.photo.layout);
          photoSlot = { layout: concept.photo.layout, xMm: sl.x, yMm: sl.y, wMm: sl.w, hMm: sl.h };
          setPhotoImage(img);
          setPhotoLayout(concept.photo.layout);
          setHidden((p) => ({ ...p, photo: false }));
          // Yazıyı uygulama basacaksa açık renk mürekkep (koyu zemin üstünde).
          if ((b.textBy ?? "ai") === "app") {
            setColorOverrides({ bg: concept.photo.bg, ink: concept.photo.ink, accent: concept.photo.ink });
          }
          pushUserImage(img, "upload");
          void deleteBriefPhoto(projectId);
        }
      }
      // Yazıyı uygulama basacaksa (önceki kurguda ChatGPT basmış olabilir) katmanları aç.
      if ((b.textBy ?? "ai") === "app") {
        setHidden((p) => ({ ...p, title: false, author: false, subtitle: false }));
      }
      if (!photoSlot) {
        // Bu kurguda fotoğraf yok → önceki kurgunun fotoğrafı kalmasın.
        setPhotoImage(null);
        setPhotoLayout(null);
        setPhotoRect(null);
      }
      const genre = initialProject?.data.meta.genre ?? "";
      const summary = (initialProject?.data.manuscript.text ?? "").slice(0, 1500);
      let desc = "";
      let blurb = "";
      const ctrl = new AbortController();
      aiAbortRef.current = ctrl;
      const timer = setTimeout(() => ctrl.abort("timeout"), WIZARD_PROMPT_TIMEOUT_MS);
      setAiElapsed(0);
      setCoverGenMsg(lang === "tr" ? "Kitap asistanı kapak fikrini yazıyor…" : "The book assistant is sketching your cover…");
      try {
        const res = await fetch("/api/cover-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Konsepti de gönder: asistan ayrı bir sahne/palet değil, konseptin
          // içine girecek kitaba özgü ÖZNEYİ yazsın (yoksa konsepti ezer).
          body: JSON.stringify({ title, author, genre, summary, lang, concept: concept.prompt }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { artDirection?: string; backCover?: string };
          if (data.artDirection) desc = data.artDirection;
          if (data.backCover) blurb = data.backCover;
        }
      } catch {
        // asistan başarısız / zaman aşımı olsa da kurgu tek başına yeterli
      } finally {
        clearTimeout(timer);
        if (aiAbortRef.current === ctrl) aiAbortRef.current = null;
      }
      try {
        if (ctrl.signal.aborted && ctrl.signal.reason === "user") return; // Vazgeç
        const ov0 = briefStyleOverride(b);
        const note = (b.note ?? "").trim();
        // Not: ya sahne tarifine eklenir ya da (konsept "notu bas" diyorsa, ör.
        // şiir dizeleri) kapağa birebir basılacak metin olur.
        const noteAsText = ov0.noteAsText && (b.textBy ?? "ai") === "ai" && !!note;
        // Kullanıcının notu açık istektir → asistanın öznesinden önce gelir.
        if (note && !noteAsText) {
          const ask = `Explicit request from the author (must be honoured): ${note}.`;
          // Asistan "No scene." dediyse (resimsiz konsept) yalnız kullanıcının isteği kalır.
          desc = desc && !/^\s*no scene\b/i.test(desc) ? `${ask} ${desc}` : ask;
        }
        const ts = getTextStyle(b.textStyleId);
        setTemplateId(ts.templateId);
        setTitlePos("top");
        setAiModel("openai");
        setAiScope(b.scope);
        // Asistanın iç işareti ("No scene. …") kullanıcının düzenlediği kutuya
        // yazılmaz; ilk üretim yine tam metni kullanır.
        setAiDesc(/^\s*no scene\b/i.test(desc) ? "" : desc);
        setCoverGenMsg(lang === "tr" ? "Kapak görseli üretiliyor…" : "Generating cover artwork…");
        const done = await generateAiCover({
          styleId: aiStyle,
          desc,
          model: "openai",
          scope: b.scope,
          embedText: false,
          photoSlot: photoSlot ?? null,
          ...conceptGenOpts(b, photoSlot),
        });
        if (done && blurb) addBackCoverBlurb(blurb);
      } finally {
        setCoverGenMsg(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefRun, brief, briefAppliedAt, title]);

  // Bekleme ekranı sayacı: üretim (asistan + görsel) sürerken her saniye artar.
  const aiWaiting = aiBusy || !!coverGenMsg;
  useEffect(() => {
    if (!aiWaiting) return;
    const t0 = Date.now();
    const id = setInterval(
      () => setAiElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [aiWaiting]);

  // ── KDY logosu ──
  // Akademi profilinde Akademi logosu, diğer her durumda KDY marka logosu.
  const kdyLogoBase = initialProject?.data.meta.platform === "akademi" ? "akademi" : "wordmark";
  // KDY logo SETİNİ (ön + arka + sırt) KDY kılavuzuna göre yerleştirir. Hem
  // otomatik (KDY profili) hem de panelde tek-tık "KDY logosu" butonları bunu
  // çağırır → eski/profilsiz kitaplar dahil HER kitapta çalışır.
  const applyKdyLogo = (variant: "white" | "black") => {
    // 1) ÖN KAPAK — mevcut logoImage yolu (yatayda ortalı, alt güvenli çizgi).
    setLogoImage(`/kdy/${kdyLogoBase}-${variant}.png`);
    setLogoSize(Math.round((20 / spread.bookWidth) * 1000) / 10); // ≈20mm genişlik
    setLogoPos("bottom");

    // 2) ARKA KAPAK + SIRT — taşınabilir "image" nesneleri olarak. Görsel nesnenin
    //    taban genişliği min(bookWidth*0.45, 60)mm; istenen genişliğe ulaşmak için
    //    scale = istenenGenişlik / tabanGenişlik. Konum nesnenin MERKEZİDİR.
    const baseWmm = Math.min(spread.bookWidth * 0.45, 60);
    const WORDMARK_ASPECT = 2.21; // KDY marka logosu en/boy
    const DICON_ASPECT = 0.79; // D-İkon en/boy
    const newObjs: CustomObject[] = [];
    const newPos: Record<string, ObjTransform> = {};
    const place = (src: string, wMm: number, aspect: number, cxMm: number) => {
      objCounter.current += 1;
      const id = `obj-${objCounter.current}`;
      newObjs.push({ id, type: "image", src, fill: colors.ink });
      const hMm = wMm / aspect;
      const scale = wMm / baseWmm;
      newPos[id] = {
        leftMm: cxMm,
        topMm: spread.bottomSafe - hMm / 2, // alt kenar = alt güvenli çizgi
        scaleX: scale,
        scaleY: scale,
      };
    };

    // Arka kapak: KDY marka logosu, güvenli alanın SOL-ALTINA, 20mm.
    place(`/kdy/wordmark-${variant}.png`, 20, WORDMARK_ASPECT, spread.backSafeLeft + 10);

    // Sırt: <6mm → logo YOK; 6–22mm → D-İkon (5–18mm); >22mm → KDY logosu (20mm).
    // Sırtta yatayda ortalı, alt güvenli çizgide, dik (döndürülmez).
    if (spread.spine >= 22) {
      place(`/kdy/wordmark-${variant}.png`, 20, WORDMARK_ASPECT, spread.spineCenter);
    } else if (spread.spine >= 6) {
      const wMm = Math.min(Math.max(spread.spine - 2, 5), 18);
      place(`/kdy/dicon-${variant}.png`, wMm, DICON_ASPECT, spread.spineCenter);
    }

    // Önceki KDY logo nesnelerini temizle (renk değişince kopya birikmesin), yenile.
    setObjects((prev) => [
      ...prev.filter((o) => !(o.type === "image" && o.src?.includes("/kdy/"))),
      ...newObjs,
    ]);
    setPositions((prev) => ({ ...prev, ...newPos }));
  };

  // KDY/KDY Akademi profilli kitaplarda, henüz logo yoksa markayı otomatik koy.
  const kdyLogoFiredRef = useRef(false);
  useEffect(() => {
    // Salt-okunur export modunda nesne/logo MUTASYONU yapma → kayıtlı tasarım
    // değişmez (bu efekt, autosave'i tetikleyip "dağılma"ya yol açan asıl sebepti).
    if (autoExport) return;
    const platform = initialProject?.data.meta.platform;
    if (platform !== "kdy" && platform !== "akademi") return;
    if (kdyLogoFiredRef.current || logoImage) return;
    kdyLogoFiredRef.current = true;
    applyKdyLogo("white");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject, logoImage]);

  // AI ile tasarım ÖĞESİ üret (mühür/rozet/amblem…): saydam PNG döner, tuvale
  // yeni bir "görsel" nesnesi olarak eklenir ve seçilir. Öteki nesneler gibi
  // taşınır/boyutlanır/çoğaltılır/silinir; autosave'e dahildir.
  const generateElement = async () => {
    const desc = elemDesc.trim();
    if (!desc) return;
    setElemBusy(true);
    setElemError("none");
    setElemCredit(null);
    try {
      const res = await fetch("/api/cover-element", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: desc, lang }),
      });
      if (res.status === 503) {
        setElemError("token");
        return;
      }
      const problem = res.ok ? null : await creditProblemFrom(res);
      if (problem) {
        noteCreditProblem(problem);
        setElemCredit(problem);
        setElemError("credits");
        return;
      }
      if (!res.ok) {
        setElemError("generic");
        return;
      }
      const data = (await res.json()) as { image?: string };
      if (!data.image) {
        setElemError("generic");
        return;
      }
      spendCredits(creditCost("cover-element"));
      objCounter.current += 1;
      const newId = `obj-${objCounter.current}`;
      setObjects((prev) => [
        ...prev,
        { id: newId, type: "image", src: data.image, fill: colors.ink },
      ]);
      setSelectedId(newId);
    } catch {
      setElemError("generic");
    } finally {
      setElemBusy(false);
    }
  };

  // "Boya & değiştir" sonucu: yeni görseli kapağa koy, kadrajı sıfırla, geçmişe ekle.
  const handleEditApply = (newImage: string) => {
    setCoverImage(newImage);
    setCoverPanX(0);
    setCoverZoom(1);
    pushAiHistory(newImage, coverScope);
    pushUserImage(newImage, "ai"); // düzenlenen görseli de kütüphaneye al
    spendCredits(creditCost("cover-edit"));
    setEditOpen(false);
  };

  const kdpSizes = BOOK_SIZES.filter((s) => s.category === "kdp");
  const trSizes = BOOK_SIZES.filter((s) => s.category === "tr");

  // Seçili nesne kullanıcı nesnesiyse onu bul (araç çubuğunda renk/boyut/sil için).
  const selectedObj =
    selectedId ? objects.find((o) => o.id === selectedId) ?? null : null;

  // Şablonun hazır yazıları (başlık/yazar/alt başlık/sırt) — bunlar `objects`
  // dizisinde değil; seçilince font/boyut/renk panelini bunlar için açarız.
  const STRUCT_TEXT_IDS = ["title", "author", "subtitle", "spineText"] as const;
  const isStructText =
    !!selectedId &&
    (STRUCT_TEXT_IDS as readonly string[]).includes(selectedId);
  // Seçili hazır yazının geçerli stili: kullanıcı değişikliği > tuvalden okunan
  // canlı değer > varsayılan. Panelde bunları başlangıç değeri olarak gösteririz.
  const structOverride = selectedId ? textStyles[selectedId] : undefined;
  const structFontId =
    structOverride?.fontId ?? selectedTextLive?.fontId ?? DEFAULT_COVER_FONT;
  const structSizeMm =
    structOverride?.fontSizeMm ?? selectedTextLive?.fontSizeMm ?? 8;
  const structColor =
    structOverride?.color ?? selectedTextLive?.color ?? "#111111";
  const structHasOverride = !!structOverride;
  // Seçili hazır yazının METNİ — müfettişten doğrudan düzenlenebilsin diye
  // ilgili içerik state'ine bağla (sırt yazısı başlık+yazardan türediği için
  // elle düzenlenmez, not gösterilir).
  const structTextValue =
    selectedId === "title"
      ? title
      : selectedId === "author"
        ? author
        : selectedId === "subtitle"
          ? subtitle
          : "";
  const setStructText = (v: string) => {
    if (selectedId === "title") setTitle(v);
    else if (selectedId === "author") setAuthor(v);
    else if (selectedId === "subtitle") setSubtitle(v);
  };

  // Sol ikon şeridi grupları.
  const panels: { id: PanelId; label: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
    { id: "ai", label: t.navAi, Icon: MagicWandIcon },
    { id: "content", label: t.navContent, Icon: TextTIcon },
    { id: "objects", label: t.navObjects, Icon: ShapesIcon },
    { id: "colors", label: t.navColors, Icon: PaletteIcon },
    { id: "barcode", label: t.navBarcode, Icon: BarcodeIcon },
    { id: "images", label: t.navImages, Icon: ImageIcon },
    { id: "setup", label: t.navSetup, Icon: SlidersIcon },
    { id: "layers", label: t.navLayers, Icon: StackIcon },
  ];

  // Seçili nesnenin ayarları. Eskiden tuvalin sağında HEP 300px yer kaplayan
  // ayrı bir paneldi (çoğu zaman boş) → tuval küçük kalıyordu. Artık soldaki
  // ayar panelinin YERİNE açılır (aynı genişlik → seçimde tuval kaymaz);
  // büyük görünümde tuvalin sol üstünde yüzer.
  const inspectorNode = selectedId ? (
            <section className="space-y-4 rounded-xl border border-accent/40 bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {selectedName(selectedId, t, objects)}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  title={t.inspectorClose}
                  aria-label={t.inspectorClose}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-accent-soft hover:text-accent"
                >
                  ×
                </button>
              </div>

              {/* ── Serbest metin ── */}
              {selectedObj && selectedObj.type === "text" && (
                <div className="space-y-3">
                  <Field label={t.objTextLabel}>
                    <textarea
                      value={selectedObj.text ?? ""}
                      onChange={(e) =>
                        updateObject(selectedObj.id, { text: e.target.value })
                      }
                      placeholder={t.objTextDefault}
                      rows={3}
                      className={`${inputClass} resize-y leading-snug`}
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      {t.objTextMultilineHint}
                    </p>
                  </Field>
                  <Field label={t.objFont}>
                    <select
                      value={selectedObj.fontId ?? DEFAULT_COVER_FONT}
                      onChange={(e) =>
                        updateObject(selectedObj.id, { fontId: e.target.value })
                      }
                      aria-label={t.objFont}
                      className={inputClass}
                      style={{
                        fontFamily: COVER_FONTS.find(
                          (f) => f.id === (selectedObj.fontId ?? DEFAULT_COVER_FONT),
                        )?.family,
                      }}
                    >
                      {FONT_CATEGORY_ORDER.map((cat) => (
                        <optgroup key={cat} label={fontCatLabel(cat, t)}>
                          {COVER_FONTS.filter((f) => f.category === cat).map((f) => (
                            <option
                              key={f.id}
                              value={f.id}
                              style={{ fontFamily: f.family }}
                            >
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.objSize}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          bumpFontSize(selectedObj.id, -0.5, selectedObj.fontSizeMm)
                        }
                        title={t.objSizeDown}
                        aria-label={t.objSizeDown}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={3}
                        max={40}
                        step={0.5}
                        value={selectedObj.fontSizeMm ?? 8}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            fontSizeMm: parseFloat(e.target.value) || 8,
                          })
                        }
                        className={`${inputClass} w-20 text-center`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          bumpFontSize(selectedObj.id, 0.5, selectedObj.fontSizeMm)
                        }
                        title={t.objSizeUp}
                        aria-label={t.objSizeUp}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                      >
                        +
                      </button>
                    </div>
                  </Field>
                  <Field label={t.objColor}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedObj.fill}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            fill: e.target.value,
                            autoColor: false, // elle renk → otomatik kontrastı kapat
                          })
                        }
                        aria-label={t.objColor}
                        className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      />
                      <HexInput
                        value={selectedObj.fill}
                        onCommit={(hex) =>
                          updateObject(selectedObj.id, {
                            fill: hex,
                            autoColor: false,
                          })
                        }
                      />
                    </div>
                    {/* Kapak görseli varken metin rengi okunurluk için otomatik
                        yönetilebilir; kullanıcı elle seçince geri dönüş sunulur. */}
                    {coverImage &&
                      (selectedObj.autoColor === false ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateObject(selectedObj.id, { autoColor: true })
                          }
                          className="mt-1.5 text-xs font-medium text-accent transition hover:opacity-80"
                        >
                          {t.textAutoColorRevert}
                        </button>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-muted">
                          {t.textAutoColorNote}
                        </p>
                      ))}
                  </Field>

                  {/* Arkasına okuma paneli (scrim) — parlak/bölünmüş zeminde
                      garanti okunurluk; metne göre boyutlanır. */}
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={!!selectedObj.panel}
                      onChange={(e) =>
                        updateObject(selectedObj.id, { panel: e.target.checked })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>
                      {t.textPanelLabel}
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {t.textPanelHint}
                      </span>
                    </span>
                  </label>

                  {/* İkincil: hizalama + satır aralığı */}
                  <div className="space-y-3 border-t border-border pt-3">
                    <Field label={t.objAlign}>
                      <div className="flex gap-1.5">
                        {(
                          [
                            ["left", t.objAlignLeft, AlignLeftIcon],
                            ["center", t.objAlignCenter, AlignCenterIcon],
                            ["right", t.objAlignRight, AlignRightIcon],
                          ] as const
                        ).map(([val, label, Icon]) => {
                          const active = (selectedObj.align ?? "center") === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateObject(selectedObj.id, { align: val })}
                              title={label}
                              aria-label={label}
                              aria-pressed={active}
                              className={`flex h-9 flex-1 items-center justify-center rounded-lg border transition ${
                                active
                                  ? "border-accent bg-accent/10 text-accent"
                                  : "border-border bg-surface text-foreground/70 hover:border-accent/40 hover:text-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label={t.objLineSpacing}>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            bumpLineSpacing(
                              selectedObj.id,
                              -0.05,
                              selectedObj.lineHeightMul,
                            )
                          }
                          title={t.objLineSpacingDown}
                          aria-label={t.objLineSpacingDown}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0.8}
                          max={2.5}
                          step={0.05}
                          value={selectedObj.lineHeightMul ?? 1.16}
                          onChange={(e) =>
                            updateObject(selectedObj.id, {
                              lineHeightMul: clampLineSpacing(parseFloat(e.target.value)),
                            })
                          }
                          aria-label={t.objLineSpacing}
                          className={`${inputClass} w-20 text-center`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            bumpLineSpacing(
                              selectedObj.id,
                              0.05,
                              selectedObj.lineHeightMul,
                            )
                          }
                          title={t.objLineSpacingUp}
                          aria-label={t.objLineSpacingUp}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                        >
                          +
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>
              )}

              {/* ── Hazır yazı (başlık/yazar/alt başlık/sırt) ── */}
              {isStructText && (
                <div className="space-y-3">
                  {/* Metin — sırt hariç doğrudan buradan düzenlenebilir. */}
                  {selectedId === "spineText" ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted">
                      {t.spineAutoNote}
                    </p>
                  ) : (
                    <Field label={t.objTextLabel}>
                      <textarea
                        value={structTextValue}
                        onChange={(e) => setStructText(e.target.value)}
                        rows={selectedId === "title" ? 2 : 1}
                        placeholder={
                          selectedId === "title"
                            ? t.titlePlaceholder
                            : selectedId === "author"
                              ? t.authorPlaceholder
                              : t.subtitlePlaceholder
                        }
                        className={`${inputClass} resize-y leading-snug`}
                      />
                    </Field>
                  )}
                  <p className="text-xs text-muted">{t.structTextHint}</p>
                  <Field label={t.objFont}>
                    <select
                      value={structFontId}
                      onChange={(e) =>
                        updateTextStyle(selectedId, { fontId: e.target.value })
                      }
                      aria-label={t.objFont}
                      className={inputClass}
                      style={{
                        fontFamily: COVER_FONTS.find((f) => f.id === structFontId)
                          ?.family,
                      }}
                    >
                      {FONT_CATEGORY_ORDER.map((cat) => (
                        <optgroup key={cat} label={fontCatLabel(cat, t)}>
                          {COVER_FONTS.filter((f) => f.category === cat).map((f) => (
                            <option
                              key={f.id}
                              value={f.id}
                              style={{ fontFamily: f.family }}
                            >
                              {f.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label={t.objSize}>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateTextStyle(selectedId, {
                            fontSizeMm: Math.max(3, structSizeMm - 0.5),
                          })
                        }
                        title={t.objSizeDown}
                        aria-label={t.objSizeDown}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={3}
                        max={60}
                        step={0.5}
                        value={structSizeMm}
                        onChange={(e) =>
                          updateTextStyle(selectedId, {
                            fontSizeMm: parseFloat(e.target.value) || structSizeMm,
                          })
                        }
                        className={`${inputClass} w-20 text-center`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateTextStyle(selectedId, {
                            fontSizeMm: Math.min(60, structSizeMm + 0.5),
                          })
                        }
                        title={t.objSizeUp}
                        aria-label={t.objSizeUp}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                      >
                        +
                      </button>
                    </div>
                  </Field>
                  <Field label={t.objColor}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={structColor}
                        onChange={(e) =>
                          updateTextStyle(selectedId, { color: e.target.value })
                        }
                        aria-label={t.objColor}
                        className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      />
                      <HexInput
                        value={structColor}
                        onCommit={(hex) => updateTextStyle(selectedId, { color: hex })}
                      />
                    </div>
                  </Field>
                  {structHasOverride && (
                    <button
                      type="button"
                      onClick={() => resetTextStyle(selectedId)}
                      className={ghostBtn}
                    >
                      {t.structTextReset}
                    </button>
                  )}
                </div>
              )}

              {/* ── Şekil rengi (kutu/daire/çizgi) ── */}
              {selectedObj &&
                selectedObj.type !== "text" &&
                selectedObj.type !== "image" && (
                  <Field label={t.objColor}>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedObj.fill}
                        onChange={(e) =>
                          updateObject(selectedObj.id, { fill: e.target.value })
                        }
                        aria-label={t.objColor}
                        className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      />
                      <HexInput
                        value={selectedObj.fill}
                        onCommit={(hex) => updateObject(selectedObj.id, { fill: hex })}
                      />
                    </div>
                  </Field>
                )}

              {/* ── Şekil stili: dolu/çerçeve · çerçeve kalınlığı · köşe · saydamlık ── */}
              {selectedObj &&
                (selectedObj.type === "rect" ||
                  selectedObj.type === "circle" ||
                  selectedObj.type === "triangle" ||
                  selectedObj.type === "star" ||
                  selectedObj.type === "diamond") && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <Field label={t.shapeStyleLabel} hint={t.shapeStyleHint}>
                      <div className="grid grid-cols-2 gap-2">
                        <SegButton
                          active={(selectedObj.shapeStyle ?? "fill") === "fill"}
                          onClick={() =>
                            updateObject(selectedObj.id, { shapeStyle: "fill" })
                          }
                        >
                          {t.shapeStyleFill}
                        </SegButton>
                        <SegButton
                          active={selectedObj.shapeStyle === "outline"}
                          onClick={() =>
                            updateObject(selectedObj.id, { shapeStyle: "outline" })
                          }
                        >
                          {t.shapeStyleOutline}
                        </SegButton>
                      </div>
                    </Field>
                    {selectedObj.shapeStyle === "outline" && (
                      <Field
                        label={`${t.strokeWidthLabel} — ${(
                          selectedObj.strokeWidthMm ?? 0.8
                        ).toFixed(1)} mm`}
                      >
                        <input
                          type="range"
                          min={2}
                          max={40}
                          value={Math.round((selectedObj.strokeWidthMm ?? 0.8) * 10)}
                          onChange={(e) =>
                            updateObject(selectedObj.id, {
                              strokeWidthMm: Number(e.target.value) / 10,
                            })
                          }
                          className="w-full accent-accent"
                        />
                      </Field>
                    )}
                    {selectedObj.type === "rect" && (
                      <Field
                        label={`${t.cornerRadiusLabel} — ${(
                          selectedObj.cornerRadiusMm ?? 0
                        ).toFixed(1)} mm`}
                      >
                        <input
                          type="range"
                          min={0}
                          max={120}
                          value={Math.round((selectedObj.cornerRadiusMm ?? 0) * 10)}
                          onChange={(e) =>
                            updateObject(selectedObj.id, {
                              cornerRadiusMm: Number(e.target.value) / 10,
                            })
                          }
                          className="w-full accent-accent"
                        />
                      </Field>
                    )}
                    <Field
                      label={`${t.opacityShapeLabel} — %${Math.round(
                        (selectedObj.opacity ?? 1) * 100,
                      )}`}
                    >
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={Math.round((selectedObj.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            opacity: Number(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-accent"
                      />
                    </Field>
                  </div>
                )}

              {/* ── Çizgi / ayraç: kalınlık · saydamlık ── */}
              {selectedObj &&
                (selectedObj.type === "line" ||
                  selectedObj.type === "divider") && (
                <div className="space-y-3 border-t border-border pt-3">
                  <Field
                    label={`${t.strokeWidthLabel} — ${(
                      selectedObj.strokeWidthMm ?? 0.6
                    ).toFixed(1)} mm`}
                  >
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={Math.round((selectedObj.strokeWidthMm ?? 0.6) * 10)}
                      onChange={(e) =>
                        updateObject(selectedObj.id, {
                          strokeWidthMm: Number(e.target.value) / 10,
                        })
                      }
                      className="w-full accent-accent"
                    />
                  </Field>
                  <Field
                    label={`${t.opacityShapeLabel} — %${Math.round(
                      (selectedObj.opacity ?? 1) * 100,
                    )}`}
                  >
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={Math.round((selectedObj.opacity ?? 1) * 100)}
                      onChange={(e) =>
                        updateObject(selectedObj.id, {
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-accent"
                    />
                  </Field>
                </div>
              )}

              {/* ── Konum (serbest metin) — mm cinsinden X/Y + ortala ──
                  Boyut alanları bilinçli olarak yok: metnin boyutu yazı boyutuyla
                  yönetilir; ölçekle büyütmek harfleri bozar. */}
              {selectedObj && selectedObj.type === "text" && selectedGeoLive && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t.geoX}>
                      <NumInput value={selectedGeoLive.leftMm} onCommit={setGeoX} />
                    </Field>
                    <Field label={t.geoY}>
                      <NumInput value={selectedGeoLive.topMm} onCommit={setGeoY} />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={centerSelected}
                    className={`${ghostBtn} text-xs`}
                  >
                    {t.geoCenter}
                  </button>
                </div>
              )}

              {/* ── Boyut & konum (şekil + AI öğe/görsel) ── */}
              {selectedObj && selectedObj.type !== "text" && selectedGeoLive && (
                <div className="space-y-3 border-t border-border pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t.geoWidth}>
                      <NumInput
                        value={selectedGeoLive.widthMm}
                        min={0.5}
                        onCommit={setGeoWidth}
                      />
                    </Field>
                    <Field label={t.geoHeight}>
                      <NumInput
                        value={selectedGeoLive.heightMm}
                        min={0.5}
                        onCommit={setGeoHeight}
                      />
                    </Field>
                    <Field label={t.geoX}>
                      <NumInput value={selectedGeoLive.leftMm} onCommit={setGeoX} />
                    </Field>
                    <Field label={t.geoY}>
                      <NumInput value={selectedGeoLive.topMm} onCommit={setGeoY} />
                    </Field>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={(e) => setLockAspect(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    {t.geoLockAspect}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={fitToSafeArea}
                      className={`${ghostBtn} text-xs`}
                    >
                      {t.geoFitSafe}
                    </button>
                    <button
                      type="button"
                      onClick={fillFrontCover}
                      className={`${ghostBtn} text-xs`}
                    >
                      {t.geoFillFront}
                    </button>
                    <button
                      type="button"
                      onClick={fitFullHeight}
                      className={`${ghostBtn} text-xs`}
                    >
                      {t.geoFullHeight}
                    </button>
                    <button
                      type="button"
                      onClick={centerSelected}
                      className={`${ghostBtn} text-xs`}
                    >
                      {t.geoCenter}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Ortak: hizala (tuvalde) · döndür · dizim · çoğalt · sil ── */}
              <div className="space-y-3 border-t border-border pt-3">
                <Field label={t.alignLabel}>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAlign("left")}
                      className={`${ghostBtn} flex-1 text-xs`}
                    >
                      {t.alignLeft}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlign("center")}
                      className={`${ghostBtn} flex-1 text-xs`}
                    >
                      {t.alignCenter}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAlign("right")}
                      className={`${ghostBtn} flex-1 text-xs`}
                    >
                      {t.alignRight}
                    </button>
                  </div>
                </Field>
                <Field label={t.rotateLabel}>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={359}
                      value={selectedAngle}
                      onChange={(e) => handleSetAngle(Number(e.target.value))}
                      className="min-w-0 flex-1 accent-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      max={359}
                      value={selectedAngle}
                      onChange={(e) => handleSetAngle(Number(e.target.value) || 0)}
                      className={`${inputClass} w-16`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSetAngle(0)}
                      disabled={selectedAngle === 0}
                      className={`${ghostBtn} px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      0°
                    </button>
                  </div>
                </Field>
                <Field label={t.zOrderLabel}>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={sendToBack}
                      disabled={!canSendBackward}
                      title={t.zSendToBack}
                      className={`${ghostBtn} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ⤓
                    </button>
                    <button
                      type="button"
                      onClick={sendBackward}
                      disabled={!canSendBackward}
                      title={t.zSendBackward}
                      className={`${ghostBtn} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={bringForward}
                      disabled={!canBringForward}
                      title={t.zBringForward}
                      className={`${ghostBtn} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={bringToFront}
                      disabled={!canBringForward}
                      title={t.zBringToFront}
                      className={`${ghostBtn} flex-1 disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      ⤒
                    </button>
                  </div>
                </Field>
                <div className="flex gap-2">
                  {selectedId.startsWith("obj-") && (
                    <button
                      type="button"
                      onClick={() => duplicateObject(selectedId)}
                      title={t.objDuplicateHint}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground"
                    >
                      <CopyIcon className="h-4 w-4" />
                      {t.objDuplicate}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    title={t.deleteSelectedHint}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent/40 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft"
                  >
                    <TrashIcon className="h-4 w-4" />
                    {t.objDelete}
                  </button>
                </div>
              </div>
            </section>
  ) : null;

  // Sağ panelin başlığı (ikon + ad + kısa açıklama).
  const PANEL_META: Record<PanelId, { title: string; sub: string; Icon: (p: { className?: string }) => React.ReactElement }> = {
    ai: { title: lang === "tr" ? "AI ile kapak görseli" : "AI cover image", sub: lang === "tr" ? "Kitabına uygun bir görsel oluştur." : "Create an image that fits your book.", Icon: MagicWandIcon },
    content: { title: lang === "tr" ? "Metin" : "Text", sub: lang === "tr" ? "Başlık, yazar ve serbest yazılar." : "Title, author and free text.", Icon: TextTIcon },
    images: { title: lang === "tr" ? "Görsel ve logo" : "Image and logo", sub: lang === "tr" ? "Kapak görseli, yerleşimi ve logo." : "Cover image, placement and logo.", Icon: ImageIcon },
    objects: { title: lang === "tr" ? "Nesneler" : "Objects", sub: lang === "tr" ? "Şekil ve süs ayracı ekle." : "Add shapes and dividers.", Icon: ShapesIcon },
    colors: { title: lang === "tr" ? "Renkler" : "Colors", sub: lang === "tr" ? "Zemin, yazı ve sırt bandı renkleri." : "Ground, text and spine band colors.", Icon: PaletteIcon },
    barcode: { title: lang === "tr" ? "Barkod" : "Barcode", sub: lang === "tr" ? "ISBN ile taranabilir barkod." : "A scannable ISBN barcode.", Icon: BarcodeIcon },
    layers: { title: lang === "tr" ? "Katmanlar" : "Layers", sub: lang === "tr" ? "Sırala, gizle, kilitle." : "Order, hide, lock.", Icon: StackIcon },
    setup: { title: lang === "tr" ? "Kitap ayarları" : "Book settings", sub: lang === "tr" ? "Boyut, sayfa sayısı, kağıt ve sırt." : "Size, page count, paper and spine.", Icon: SlidersIcon },
    library: { title: lang === "tr" ? "Görsellerim" : "My images", sub: lang === "tr" ? "Yüklediğin görseller ve şablonların." : "Your uploads and saved templates.", Icon: FolderIcon },
  };
  const RAIL_MAIN: PanelId[] = ["ai", "content", "images", "objects", "colors", "barcode", "layers"];
  const RAIL_BOTTOM: PanelId[] = ["setup", "library"];
  const railLabel = (id: PanelId) =>
    id === "library" ? PANEL_META.library.title : (panels.find((p) => p.id === id)?.label ?? PANEL_META[id].title);
  const meta = PANEL_META[activePanel];
  // Seçim, Katmanlar listesinden yapıldıysa liste görünür kalsın (inspector altta).
  const inspectorReplaces = !!selectedId && activePanel !== "layers";
  const wizard = initialProject?.data.wizard;
  const wizardActive = !!wizard?.active && !autoExport;
  const wizardSteps: [string, string, boolean][] = wizard
    ? [
        ["editor", lang === "tr" ? "AI Editör" : "AI Editor", wizard.editorCompleted],
        ["mizanpaj", lang === "tr" ? "Mizanpaj" : "Layout", wizard.layoutCompleted],
        ["kapak", lang === "tr" ? "Kapak" : "Cover", wizard.coverCompleted],
      ]
    : [];
  const docTitle = title.trim() || (lang === "tr" ? "Kapak çalışması" : "Cover draft");
  const togglePreview = () => {
    if (!preview) {
      setPreview(true);
      setSelectedId(null);
      if (!bigView) void toggleBigView();
    } else {
      setPreview(false);
      if (bigView) void toggleBigView();
    }
  };
  const finishWizard = async () => {
    if (!projectId || wizardBusy) return;
    setWizardBusy(true);
    try {
      await completeWizardStep(projectId, "cover");
    } catch {
      // kaydedilemese de ilerle; taslak zaten otomatik kaydediliyor
    }
    router.push(`/${lang}/indir?project=${projectId}`);
  };
  // Büyük görünümde yüzen ayar kutusu, seçili nesnenin KARŞI tarafında durur.
  const floatOnRight = !!selectedGeoLive && selectedGeoLive.leftMm < spread.spineStart;
  const zoomNext = zoomStep(zoom, 1);
  const canZoomIn = zoom < ZOOM_STEPS[ZOOM_STEPS.length - 1] && zoomNext <= viewInfo.maxZoom + 0.01;

  return (
    <div
      ref={rootRef}
      className={`flex w-full flex-col bg-background ${
        bigView ? "fixed inset-0 z-[70] h-dvh overflow-hidden" : "h-dvh overflow-y-auto lg:overflow-hidden"
      }`}
    >
      {/* ── Üst çubuk: marka · Kitaplarım · kitap adı · kayıt · geri/ileri · Önizleme · İndir · hesap ── */}
      {!bigView && (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 lg:px-5">
          <Link href={`/${lang}/projeler`} className="flex shrink-0 items-center gap-2" aria-label="Laycoty">
            <Logo className="h-9 w-9 text-base" />
            <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline">laycoty</span>
          </Link>
          <span className="hidden h-7 w-px shrink-0 bg-border md:block" />
          <Link
            href={`/${lang}/projeler`}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-foreground md:flex"
          >
            <span aria-hidden="true">←</span>
            {lang === "tr" ? "Kitaplarım" : "My books"}
          </Link>
          <span className="hidden h-7 w-px shrink-0 bg-border md:block" />
          <span
            className="hidden h-8 w-8 shrink-0 rounded-lg sm:block"
            style={{ background: "linear-gradient(135deg, var(--color-accent), #7c3aed)" }}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate text-base font-semibold text-foreground" title={docTitle}>
            {docTitle}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted lg:flex">
            <span className={`h-2 w-2 rounded-full ${draftStatus === "saving" ? "bg-amber-400" : "bg-emerald-500"}`} />
            {draftStatus === "saving" ? t.draftSaving : t.draftSaved}
          </span>
          {wizardActive && wizard && projectId && (
            <nav className="ml-2 hidden shrink-0 items-center gap-1 xl:flex" aria-label={lang === "tr" ? "Adımlar" : "Steps"}>
              {wizardSteps.map(([seg, label, done], i) => (
                <Link
                  key={seg}
                  href={`/${lang}/${seg}?project=${projectId}`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    seg === "kapak" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  {seg === "editor" && editorJob.running !== null ? (
                    <span
                      className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
                      title={lang === "tr" ? "AI Editör kontrolü arka planda sürüyor" : "AI Editor check running"}
                    />
                  ) : (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        done ? "bg-emerald-600 text-white" : seg === "kapak" ? "bg-accent text-white" : "border border-border"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                  )}
                  {label}
                </Link>
              ))}
            </nav>
          )}
          {wizardActive && wizard && projectId && (
            <div className="relative shrink-0 xl:hidden">
              <button
                type="button"
                onClick={() => setStepsOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={stepsOpen}
                className="flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {lang === "tr" ? "Adım 3/3" : "Step 3/3"} <span aria-hidden="true">▾</span>
              </button>
              {stepsOpen && (
                <>
                  <button type="button" aria-label="×" className="fixed inset-0 z-30 cursor-default" onClick={() => setStepsOpen(false)} />
                  <div role="menu" className="absolute left-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                    {wizardSteps.map(([seg, label, done], i) => (
                      <Link
                        key={seg}
                        href={`/${lang}/${seg}?project=${projectId}`}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent"
                      >
                        <span className="w-4 text-center text-xs">{done ? "✓" : i + 1}</span>
                        {label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title={lang === "tr" ? "Geri al (⌘Z)" : "Undo (⌘Z)"}
            aria-label={lang === "tr" ? "Geri al" : "Undo"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title={lang === "tr" ? "İleri al (⇧⌘Z)" : "Redo (⇧⌘Z)"}
            aria-label={lang === "tr" ? "İleri al" : "Redo"}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpRightIcon className="h-5 w-5" />
          </button>
          <span className="hidden h-7 w-px shrink-0 bg-border sm:block" />
          <button
            type="button"
            onClick={togglePreview}
            className="hidden shrink-0 rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent-soft md:block"
          >
            {lang === "tr" ? "Önizleme" : "Preview"}
          </button>
          {/* Tek "İndir" düğmesi → açılır menü: PDF · PNG · Paylaş · Şablona kaydet */}
          <div className="relative" ref={downloadMenuRef}>
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((o) => !o)}
              disabled={exporting}
              aria-haspopup="menu"
              aria-expanded={downloadMenuOpen}
              className="flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? t.exportBusy : t.downloadMenuCta}
              <span
                className={`text-xs transition ${downloadMenuOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            {downloadMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    void handleExportPdf();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-accent"
                >
                  {t.downloadPdf}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    handleExportPng();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-accent"
                >
                  {t.downloadPng}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    void handleShare();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-accent"
                >
                  {t.downloadShare}
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    saveCurrentAsTemplate();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground/80 transition hover:bg-accent-soft hover:text-accent"
                >
                  {t.downloadSaveTemplate}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDownloadMenuOpen(false);
                    startNewDesign();
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-foreground/60 transition hover:bg-accent-soft hover:text-accent"
                >
                  {lang === "tr" ? "Baştan başla" : "Start over"}
                </button>
              </div>
            )}
          </div>
          {wizardActive && projectId && (
            <button
              type="button"
              onClick={() => void finishWizard()}
              disabled={wizardBusy}
              title={lang === "tr" ? "Kapağı tamamla ve indirme sayfasına geç" : "Finish the cover and go to downloads"}
              className="shrink-0 whitespace-nowrap rounded-xl border border-emerald-600/40 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              <span className="hidden sm:inline">{lang === "tr" ? "Tamamla →" : "Finish →"}</span>
              <span className="sm:hidden">✓</span>
            </button>
          )}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setAccountOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              title={user?.name}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #d946ef, #9333ea)" }}
            >
              {user?.initials ?? "?"}
            </button>
            {accountOpen && (
              <>
                <button
                  type="button"
                  aria-label={lang === "tr" ? "Menüyü kapat" : "Close menu"}
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setAccountOpen(false)}
                />
                <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                  {user?.name && <div className="truncate px-4 py-2 text-sm font-semibold text-foreground">{user.name}</div>}
                  <Link href={`/${lang}/projeler`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {lang === "tr" ? "Kitaplarım" : "My books"}
                  </Link>
                  <Link href={`/${lang}/jetonlar`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {lang === "tr" ? "Jetonlarım" : "My credits"}
                    {balance != null ? ` · ${balance}` : ""}
                  </Link>
                  {signOut && (
                    <form action={signOut} className="border-t border-border">
                      <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                        {lang === "tr" ? "Çıkış yap" : "Sign out"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {autoExport && (
        <ExportOverlay
          lang={lang}
          kind="kapak"
          status={autoExportStatus}
          backHref={projectId ? `/${lang}/indir?project=${projectId}` : `/${lang}/projeler`}
          onDownload={() => void handleExportPdf()}
        />
      )}
      {draftRestored && (
        <div className="fixed left-1/2 top-20 z-[80] flex -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 shadow-lg">
          <span>{t.draftRestored}</span>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            className="shrink-0 font-medium text-emerald-700/70 transition hover:text-emerald-700"
            aria-label="×"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── Sol araç şeridi ── */}
        {!bigView && (
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:w-[92px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
            {[...RAIL_MAIN, ...RAIL_BOTTOM].map((id, idx) => {
              const Icon = PANEL_META[id].Icon;
              const active = activePanel === id && !inspectorReplaces;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActivePanel(id);
                    setSelectedId(null);
                    setPanelOpen(true);
                  }}
                  aria-pressed={active}
                  className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition lg:w-full [@media(max-height:820px)]:gap-1 [@media(max-height:820px)]:py-2 ${
                    idx === RAIL_MAIN.length ? "lg:mt-auto" : ""
                  } ${active ? "bg-accent-soft text-accent" : "text-foreground/70 hover:bg-background hover:text-foreground"}`}
                >
                  <Icon className="h-6 w-6" />
                  {railLabel(id)}
                </button>
              );
            })}
          </nav>
        )}

        {/* ── Tuval ── */}
        <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col p-2 lg:min-h-0 lg:p-3">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {preview ? (
              <div className="absolute right-3 top-3 z-30">
                <button
                  type="button"
                  onClick={togglePreview}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                >
                  {lang === "tr" ? "Önizlemeden çık (Esc)" : "Exit preview (Esc)"}
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2.5 py-1.5 sm:gap-3 sm:px-3">
                <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label={lang === "tr" ? "Görünüm" : "View"}>
                  {(
                    [
                      ["all", lang === "tr" ? "Tam kapak" : "Full cover"],
                      ["front", lang === "tr" ? "Ön kapak" : "Front"],
                      ["back", lang === "tr" ? "Arka kapak" : "Back"],
                    ] as [ViewFocus, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setViewFocus(v)}
                      aria-pressed={viewFocus === v}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        viewFocus === v ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="hidden whitespace-nowrap text-sm text-muted xl:inline" title={t.totalSizeLabel}>
                  {formatMm(spread.totalWidth)} × {formatMm(spread.totalHeight)}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-0.5 rounded-xl border border-border bg-surface px-1 py-0.5" role="group" aria-label={lang === "tr" ? "Yakınlaştırma" : "Zoom"}>
                <button
                  type="button"
                  onClick={() => setZoom((z) => zoomStep(z, -1))}
                  disabled={zoom <= ZOOM_STEPS[0]}
                  aria-label={lang === "tr" ? "Küçült" : "Zoom out"}
                  title={lang === "tr" ? "Küçült" : "Zoom out"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                >
                  −
                </button>
                <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
                  {viewInfo.realPercent}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => zoomStep(z, 1))}
                  disabled={!canZoomIn}
                  aria-label={lang === "tr" ? "Büyüt" : "Zoom in"}
                  title={lang === "tr" ? "Büyüt" : "Zoom in"}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                >
                  +
                </button>
                <span className="mx-1 h-6 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setViewFocus("all");
                  }}
                  title={lang === "tr" ? "Ekrana sığdır" : "Fit to screen"}
                  className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-foreground/80 transition hover:bg-accent-soft"
                >
                  <ArrowsOutIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{lang === "tr" ? "Ekrana sığdır" : "Fit to screen"}</span>
                </button>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground/80" title={t.bleedNote}>
                  <span className="relative inline-flex">
                    <input
                      type="checkbox"
                      checked={showGuides}
                      onChange={(e) => setShowGuides(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-foreground/25 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </span>
                  {lang === "tr" ? "Kılavuzlar" : "Guides"}
                </label>
                <button
                  type="button"
                  onClick={() => void toggleBigView()}
                  title={
                    bigView
                      ? lang === "tr" ? "Büyük görünümü kapat (Esc)" : "Close big view (Esc)"
                      : lang === "tr" ? "Büyük görünüm" : "Big view"
                  }
                  className={`flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold transition ${
                    bigView ? "bg-accent text-white hover:opacity-90" : "text-foreground/70 hover:bg-accent-soft hover:text-foreground"
                  }`}
                >
                  <ArrowsOutIcon className="h-5 w-5" />
                  {bigView && (lang === "tr" ? "Büyük görünümü kapat" : "Close big view")}
                </button>
              </div>
            )}

            <div className="relative flex min-h-0 flex-1 flex-col">
            {/* Tuval, kalan yüksekliği doldurur; içinde hem ene hem boya sığar. */}
            <div className="relative min-h-0 flex-1">
              {aiWaiting && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-[2px]">
                  <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-accent/25 border-t-accent" />
                  <div className="text-sm font-semibold text-foreground">
                    {coverGenMsg ?? (lang === "tr" ? "Kapak görseli üretiliyor…" : "Generating cover…")}
                  </div>
                  <div className="max-w-[260px] text-center text-xs text-muted">
                    {aiElapsed >= 45
                      ? t.aiSlowHint
                      : lang === "tr"
                        ? "Yapay zekâ kapağını çiziyor — genelde 20-40 sn sürer."
                        : "AI is painting your cover — usually 20-40s."}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-muted">
                    {aiElapsed} {lang === "tr" ? "sn" : "s"}
                  </div>
                  <button
                    type="button"
                    onClick={cancelAiGeneration}
                    className="mt-1 rounded-lg border border-foreground/15 bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-accent-soft"
                  >
                    {t.aiCancel}
                  </button>
                </div>
              )}
              {/* Üretim bitti ama hata var → tuvalin üstünde görünür şerit (eskiden
                  yalnız sağ paneldeki küçük yazıydı; kullanıcı fark etmiyordu). */}
              {/* Jeton / oturum sorunu: "Tekrar dene" anlamsız → ortak uyarı. */}
              {!aiWaiting && aiError === "credits" && aiCredit && (
                <CreditNotice
                  lang={lang}
                  problem={aiCredit}
                  onClose={() => setAiError("none")}
                  className="absolute left-1/2 top-3 z-20 w-[min(92%,480px)] -translate-x-1/2 shadow-lg"
                />
              )}
              {!aiWaiting && aiError !== "none" && aiError !== "credits" && (
                <div className="absolute left-1/2 top-3 z-20 flex w-[min(92%,480px)] -translate-x-1/2 items-start gap-2 rounded-lg border border-accent/40 bg-background px-4 py-3 text-xs shadow-lg">
                  <p className="flex-1 text-foreground">{aiErrorText}</p>
                  {aiError !== "token" && (
                    <button
                      type="button"
                      onClick={() => void generateAiCover(lastAiOptsRef.current ?? undefined)}
                      className="rounded-md bg-accent px-3 py-1.5 font-semibold text-white transition hover:opacity-90"
                    >
                      {t.aiRetry}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setAiError("none")}
                    className="rounded-md border border-foreground/15 px-3 py-1.5 font-semibold text-foreground transition hover:bg-accent-soft"
                  >
                    {t.aiDismiss}
                  </button>
                </div>
              )}
              {/* Sihirbaz: yapay zekâ kapağı jeton harcar → üretmeden önce sor. */}
              {!aiWaiting && aiError === "none" && wizardOffer && wizardAffordable && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute left-1/2 top-3 z-20 w-[min(92%,480px)] -translate-x-1/2 rounded-lg border border-accent/40 bg-background px-4 py-3 text-sm shadow-lg"
                >
                  <p className="text-foreground">
                    {lang === "tr"
                      ? `Kitabın için yapay zekâ ile kapak üretelim mi? ${WIZARD_COVER_COST} jeton harcar${balance != null ? ` (bakiyen: ${balance})` : ""}.`
                      : `Generate an AI cover for your book? Uses ${WIZARD_COVER_COST} credits${balance != null ? ` (balance: ${balance})` : ""}.`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={runWizardCover}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      {lang === "tr" ? "Üret" : "Generate"}
                    </button>
                    <button
                      type="button"
                      onClick={skipWizardCover}
                      className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent-soft"
                    >
                      {lang === "tr" ? "Kendim tasarlayacağım" : "I'll design it myself"}
                    </button>
                  </div>
                </div>
              )}
              {/* Bakiye yetmiyor → üretim önerme; kapak yine de elle tasarlanabilir. */}
              {!aiWaiting && aiError === "none" && wizardOffer && !wizardAffordable && (
                <div className="absolute left-1/2 top-3 z-20 w-[min(92%,480px)] -translate-x-1/2 shadow-lg">
                  <CreditNotice
                    lang={lang}
                    problem={{ kind: "no-credits", cost: WIZARD_COVER_COST, balance: balance ?? undefined }}
                    onClose={skipWizardCover}
                  />
                  <p className="mt-1 rounded-lg bg-background px-4 py-2 text-xs text-muted">
                    {lang === "tr"
                      ? "Kapağını yine de elle tasarlayabilirsin: soldaki şablonlar, yazılar ve kendi görsellerin jeton harcamaz."
                      : "You can still design the cover by hand: templates, text and your own images on the left cost no credits."}
                  </p>
                </div>
              )}
              {!aiWaiting && aiError === "none" && wizardMissingTitle && (
                <div className="absolute left-1/2 top-3 z-20 w-[min(92%,480px)] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-3 text-xs text-amber-800 shadow-lg">
                  {t.aiNoTitle}
                </div>
              )}
              <CoverCanvas
                ref={canvasRef}
                spread={spread}
                labels={labels}
                lang={lang}
                templateId={templateId}
                colors={colors}
                content={content}
                showGuides={showGuides && !preview}
                images={images}
                objects={objects}
                positions={positions}
                layers={layers}
                hidden={hidden}
                locked={locked}
                autoContrast={autoContrast}
                titlePos={titlePos === "auto" ? undefined : titlePos}
                authorPos={briefActive ? "top" : undefined}
                textStyles={textStyles}
                selectedId={selectedId}
                onTextSelect={setSelectedTextLive}
                onGeometrySelect={setSelectedGeoLive}
                onPositionChange={handlePositionChange}
                onSelect={setSelectedId}
                onAngleChange={setSelectedAngle}
                onLayersChange={handleLayersChange}
                onReady={handleCanvasReady}
                zoom={zoom}
                focus={viewFocus}
                rulers={!preview}
                onView={(v) =>
                  setViewInfo((p) =>
                    p.realPercent === v.realPercent && Math.abs(p.maxZoom - v.maxZoom) < 0.01 ? p : v,
                  )
                }
              />
              {(bigView || !panelOpen) && !preview && inspectorNode && (
                // Büyük görünümde ayar kutusu seçili nesnenin KARŞI tarafında yüzer;
                // dar ekranda alttan açılan şerit olur.
                <div
                  className={`absolute inset-x-2 bottom-2 z-30 max-h-[45%] overflow-y-auto rounded-xl shadow-xl lg:inset-x-auto lg:bottom-auto lg:top-3 lg:max-h-[calc(100%-24px)] lg:w-[320px] ${
                    floatOnRight ? "lg:right-3" : "lg:left-3"
                  }`}
                >
                  {inspectorNode}
                </div>
              )}
            </div>

            </div>

          </div>
        </section>

        {/* ── Sağ panel: seçili aracın ayarları (ya da seçili nesne) ── */}
        {!bigView && (
          <aside
            className={`flex shrink-0 flex-col border-t border-border bg-surface lg:min-h-0 lg:border-l lg:border-t-0 ${
              panelOpen ? "lg:w-[380px]" : "lg:w-14"
            }`}
          >
            {panelOpen ? (
              <>
                {!inspectorReplaces && (
                  <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setPanelOpen(false)}
                      title={lang === "tr" ? "Paneli kapat (tuval büyür)" : "Collapse panel"}
                      aria-label={lang === "tr" ? "Paneli kapat" : "Collapse panel"}
                      className="-ml-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/70 transition hover:bg-accent-soft hover:text-foreground lg:flex"
                    >
                      ›
                    </button>
                    <meta.Icon className="mt-1 h-6 w-6 shrink-0 text-accent" />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold leading-tight text-foreground">{meta.title}</h2>
                      <p className="mt-0.5 text-sm text-muted">{meta.sub}</p>
                    </div>
                  </div>
                )}
                <div
                  key={inspectorReplaces ? "sel" : activePanel}
                  className="min-h-0 flex-1 overflow-y-auto px-5 py-4 max-lg:max-h-[70vh]"
                >
                  {inspectorReplaces ? (
                    inspectorNode
                  ) : (
                    <>
                    {/* AI Kapak */}
                    {activePanel === "ai" && (
                    <section className="space-y-5">
                      <h2 className={headingClass}>{t.aiHeading}</h2>

                      {/* Kurgu yoksa model seçilir; kurgu varsa konsept ChatGPT ile üretilir. */}
                      {!activeBrief && (
                        <Field label={lang === "tr" ? "Model" : "Model"}>
                          <select
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value as AiModel)}
                            className={selectClass}
                          >
                            <option value="openai">{t.aiModelOpenai}</option>
                            <option value="flux">{t.aiModelFlux}</option>
                            <option value="nano">{t.aiModelNano}</option>
                            <option value="ideogram">{t.aiModelIdeogram}</option>
                          </select>
                        </Field>
                      )}

                      <Field label={lang === "tr" ? "Görseli tarif et" : "Describe the image"}>
                        <textarea
                          value={aiDesc}
                          onChange={(e) => setAiDesc(e.target.value)}
                          placeholder={
                            lang === "tr"
                              ? "Ör: eski bir şehrin sokakları, ince gravür çizgileri, krem kâğıt dokusu"
                              : "e.g. old city streets, fine engraving lines, cream paper texture"
                          }
                          rows={3}
                          className={`${inputClass} resize-none`}
                        />
                      </Field>

                      {activeBrief ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-foreground">{lang === "tr" ? "Konsept" : "Concept"}</span>
                            {projectId && (
                              <a
                                href={`/${lang}/kapak/kurgu?project=${projectId}`}
                                className="text-xs font-semibold text-accent hover:underline"
                              >
                                {lang === "tr" ? "Kurguyu değiştir →" : "Change brief →"}
                              </a>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {resolveStandard(activeBrief.themaCode).concepts.map((k, i) => {
                              const sel = k.id === activeBrief.conceptId;
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => setBrief({ ...activeBrief, conceptId: k.id })}
                                  aria-pressed={sel}
                                  className={`relative overflow-hidden rounded-xl border-2 bg-background text-left transition ${
                                    sel ? "border-accent" : "border-border hover:border-accent/50"
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={briefExampleSrc(resolveStandard(activeBrief.themaCode).code, i)}
                                    alt=""
                                    className="aspect-[2/3] w-full object-cover"
                                  />
                                  <span className="line-clamp-2 block px-1.5 py-1.5 text-center text-xs font-medium leading-tight text-foreground" title={k.name[lang]}>
                                    {k.name[lang]}
                                  </span>
                                  {sel && <CheckBadge />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-foreground">{t.aiStyleLabel}</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            {AI_STYLES.map((s) => {
                              const sel = s.id === aiStyle;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => setAiStyle(s.id)}
                                  aria-pressed={sel}
                                  className={`relative overflow-hidden rounded-xl border-2 bg-background text-left transition ${
                                    sel ? "border-accent" : "border-border hover:border-accent/50"
                                  }`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={STYLE_EXAMPLE[s.id] ?? STYLE_EXAMPLE.literary}
                                    alt=""
                                    className="aspect-[4/3] w-full object-cover object-top"
                                    style={{ background: STYLE_SWATCH[s.id] ?? STYLE_SWATCH.literary }}
                                  />
                                  <span className="block truncate px-2 py-1.5 text-center text-xs font-medium text-foreground">
                                    {s.name[lang]}
                                  </span>
                                  {sel && <CheckBadge />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <Field label={t.aiScopeLabel}>
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
                          <SegButton active={aiScope === "wrap"} onClick={() => setAiScope("wrap")}>
                            {lang === "tr" ? "Tam kapak" : "Full cover"}
                          </SegButton>
                          <SegButton active={aiScope === "front"} onClick={() => setAiScope("front")}>
                            {lang === "tr" ? "Ön kapak" : "Front cover"}
                          </SegButton>
                        </div>
                      </Field>

                      <button
                        type="button"
                        onClick={() => {
                          // Kurgu varsa üretim HER ZAMAN seçili konseptle (ChatGPT) yapılır.
                          // Tuvaldeki fotoğraf yuvası konseptin düzenine uymuyorsa eski yol.
                          // Fotoğraf yuvası yalnız seçili konseptin fotoğraf düzeniyle eşleşirse ayrılır.
                          const slot = currentPhotoSlot();
                          const matching =
                            activeBrief && slot &&
                            getConceptOf(resolveStandard(activeBrief.themaCode), activeBrief.conceptId).photo?.layout === slot.layout
                              ? slot
                              : undefined;
                          void generateAiCover(
                            activeBrief
                              ? {
                                  model: "openai",
                                  desc: aiDesc,
                                  scope: aiScope,
                                  embedText: false,
                                  photoSlot: matching ?? null,
                                  ...conceptGenOpts(activeBrief, matching),
                                }
                              : undefined,
                          );
                        }}
                        disabled={aiBusy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MagicWandIcon className="h-5 w-5" />
                        {aiBusy ? t.aiBusy : lang === "tr" ? "Görsel oluştur" : "Generate image"}
                        {!aiBusy && balance != null && (
                          <span className="font-normal opacity-80">
                            · {aiModelCost(activeBrief ? "openai" : aiModel)} {lang === "tr" ? "jeton" : "credits"}
                          </span>
                        )}
                      </button>

                      {aiError === "token" && (
                        <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">
                          {t.aiErrorToken}
                        </p>
                      )}
                      {aiError === "generic" && (
                        <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">
                          {t.aiErrorGeneric}
                        </p>
                      )}
                      {aiError === "timeout" && (
                        <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">
                          {t.aiErrorTimeout}
                        </p>
                      )}
                      {aiError === "credits" && aiCredit && (
                        <CreditNotice lang={lang} problem={aiCredit} className="text-xs" />
                      )}
                      {aiNotice === "embed" && (
                        <p className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
                          {t.aiEmbedNotice}
                        </p>
                      )}

                      {coverImage && (
                        <button
                          type="button"
                          onClick={() => setEditOpen(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-surface px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent-soft"
                        >
                          <MagicWandIcon className="h-4 w-4" />
                          {lang === "tr" ? "Bir yerini düzelt" : "Fix one area"}
                        </button>
                      )}

                      <div className="divide-y divide-border border-t border-border">
                        <Accordion icon={<LayoutIcon className="h-5 w-5" />} title={lang === "tr" ? "Yerleşim ayarları" : "Layout settings"}>
                          <Field label={t.titlePosLabel} hint={t.titlePosHint}>
                            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
                              <SegButton active={titlePos === "top"} onClick={() => setTitlePos("top")}>
                                {t.titlePosTop}
                              </SegButton>
                              <SegButton active={titlePos !== "top"} onClick={() => setTitlePos("auto")}>
                                {t.titlePosAuto}
                              </SegButton>
                            </div>
                          </Field>
                          {coverImage && (
                            <Field
                              label={lang === "tr" ? "Fotoğraf yerleşimi" : "Photo layout"}
                              hint={
                                lang === "tr"
                                  ? "Kendi fotoğrafın için: çerçeveli portre, üstte fotoğraf + altta bant ya da sağ altta portre."
                                  : "For your own photo: framed portrait, photo on top with a band, or a portrait at the lower right."
                              }
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <SegButton active={!photoLayout} onClick={() => { setPhotoLayout(null); setPhotoRect(null); }}>
                                  {lang === "tr" ? "Fotoğraf yok" : "No photo"}
                                </SegButton>
                                <SegButton active={photoLayout === "framed"} onClick={() => { setPhotoLayout("framed"); setPhotoRect(null); if (!photoImage) setCoverScope("front"); }}>
                                  {lang === "tr" ? "Çerçeveli" : "Framed"}
                                </SegButton>
                                <SegButton active={photoLayout === "band"} onClick={() => { setPhotoLayout("band"); setPhotoRect(null); if (!photoImage) setCoverScope("front"); }}>
                                  {lang === "tr" ? "Üstte + bant" : "Top + band"}
                                </SegButton>
                                <SegButton active={photoLayout === "side"} onClick={() => { setPhotoLayout("side"); setPhotoRect(null); if (!photoImage) setCoverScope("front"); }}>
                                  {lang === "tr" ? "Sağ altta" : "Lower right"}
                                </SegButton>
                              </div>
                            </Field>
                          )}
                          {coverImage && (
                            <Field label={t.coverFitLabel} hint={t.coverFitHint}>
                              <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
                                <SegButton active={coverFit === "fill"} onClick={() => setCoverFit("fill")}>
                                  {t.coverFitFill}
                                </SegButton>
                                <SegButton active={coverFit === "fit"} onClick={() => setCoverFit("fit")}>
                                  {t.coverFitContain}
                                </SegButton>
                              </div>
                            </Field>
                          )}
                          {coverImage && (
                            <Field label={`${t.opacityLabel} — %${Math.round(coverOpacity * 100)}`} hint={t.opacityHint}>
                              <input
                                type="range"
                                min={20}
                                max={100}
                                value={Math.round(coverOpacity * 100)}
                                onChange={(e) => setCoverOpacity(Number(e.target.value) / 100)}
                                className="w-full accent-accent"
                              />
                            </Field>
                          )}
                        </Accordion>

                        <Accordion icon={<SlidersIcon className="h-5 w-5" />} title={lang === "tr" ? "Gelişmiş ayarlar" : "Advanced settings"}>
                          {activeBrief && (
                            <p className="text-xs text-muted">
                              {lang === "tr"
                                ? "Kurgulu kapaklar seçili konseptle ChatGPT'de üretilir."
                                : "Briefed covers are generated with ChatGPT using the chosen concept."}
                            </p>
                          )}
                          {aiLastCost != null && (
                            <p className="text-xs text-muted">
                              {t.aiLastCost}: ≈ {aiLastCost.toFixed(3)} $
                            </p>
                          )}
                          {!activeBrief && projectId && (
                            <a
                              href={`/${lang}/kapak/kurgu?project=${projectId}`}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                            >
                              {lang === "tr" ? "Kapak kurgusu ile başla →" : "Start with the cover brief →"}
                            </a>
                          )}
                          {!activeBrief && (aiModel === "nano" || aiModel === "ideogram") && (
                            <Field label={t.aiEmbedLabel} hint={t.aiEmbedHint}>
                              <div className="grid grid-cols-2 gap-2">
                                <SegButton active={aiEmbedText} onClick={() => setAiEmbedText(true)}>
                                  {t.aiEmbedOn}
                                </SegButton>
                                <SegButton active={!aiEmbedText} onClick={() => setAiEmbedText(false)}>
                                  {t.aiEmbedOff}
                                </SegButton>
                              </div>
                            </Field>
                          )}

                          {aiHistory.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">
                                  {lang === "tr" ? "Önceki denemeler" : "Earlier attempts"}
                                </span>
                                <button
                                  type="button"
                                  onClick={clearAiHistory}
                                  className="text-xs font-medium text-accent transition hover:opacity-80"
                                >
                                  {t.aiHistoryClear}
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {aiHistory.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => restoreAiHistory(item)}
                                    title={t.aiHistoryRestore}
                                    className={`group relative aspect-[4/3] overflow-hidden rounded-md border transition ${
                                      coverImage === item.image
                                        ? "border-accent ring-2 ring-accent/40"
                                        : "border-border hover:border-accent"
                                    }`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.image} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-muted">{lang === "tr" ? "Birine tıkla, kapağa geri gelsin." : "Click one to bring it back."}</p>
                            </div>
                          )}

                          {/* AI ile TASARIM ÖĞESİ — saydam PNG nesnesi (mühür/rozet/amblem…) */}
                          <div className="space-y-3">
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{t.elemHeading}</h3>
                              <p className="mt-1 text-xs text-muted">{t.elemHint}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  [t.elemPresetSeal, t.elemPresetSealEx],
                                  [t.elemPresetBadge, t.elemPresetBadgeEx],
                                  [t.elemPresetEmblem, t.elemPresetEmblemEx],
                                  [t.elemPresetOrnament, t.elemPresetOrnamentEx],
                                ] as const
                              ).map(([label, example]) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setElemDesc(example)}
                                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={elemDesc}
                              onChange={(e) => setElemDesc(e.target.value)}
                              placeholder={t.elemDescPlaceholder}
                              rows={2}
                              aria-label={t.elemDescLabel}
                              className={`${inputClass} resize-none`}
                            />
                            <button
                              type="button"
                              onClick={generateElement}
                              disabled={elemBusy || !elemDesc.trim()}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <MagicWandIcon className="h-4 w-4" />
                              {elemBusy ? t.elemBusyLabel : t.elemGenerate}
                              {!elemBusy && balance != null && (
                                <span className="font-normal opacity-80">
                                  · {creditCost("cover-element")} {lang === "tr" ? "jeton" : "credits"}
                                </span>
                              )}
                            </button>
                            {elemError === "token" && (
                              <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">{t.aiErrorToken}</p>
                            )}
                            {elemError === "generic" && (
                              <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">{t.aiErrorGeneric}</p>
                            )}
                            {elemError === "credits" && elemCredit && (
                              <CreditNotice lang={lang} problem={elemCredit} className="text-xs" />
                            )}
                          </div>
                        </Accordion>
                      </div>
                    </section>
                    )}

                    {/* Renkler */}
                    {activePanel === "colors" && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className={headingClass}>{t.colorsHeading}</h2>
                        <button
                          type="button"
                          onClick={() => setColorOverrides({})}
                          disabled={!colorsDirty}
                          className="text-xs font-medium text-accent transition disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50"
                        >
                          {t.colorsReset}
                        </button>
                      </div>
                      <p className="text-xs text-muted">{t.colorsHint}</p>

                      {/* Sırt bandı: sarmal görselde sırtı mm'de kapatan düz şerit. */}
                      {coverImage && coverScope === "wrap" && (
                        <div className="space-y-2 rounded-lg border border-foreground/10 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">
                              {lang === "tr" ? "Sırt bandı" : "Spine band"}
                            </span>
                            <div className="grid grid-cols-2 gap-1">
                              <SegButton
                                active={!!spineBand}
                                onClick={() => {
                                  if (spineBand) return;
                                  void spineColorFromImage(coverImage).then((c) => setSpineBand(c ?? colors.ink));
                                }}
                              >
                                {lang === "tr" ? "Açık" : "On"}
                              </SegButton>
                              <SegButton active={!spineBand} onClick={() => setSpineBand(null)}>
                                {lang === "tr" ? "Kapalı" : "Off"}
                              </SegButton>
                            </div>
                          </div>
                          {spineBand && (
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => void spineColorFromImage(coverImage).then((c) => c && setSpineBand(c))}
                                className="text-xs font-medium text-accent hover:underline"
                              >
                                {lang === "tr" ? "Rengi görselden al" : "Pick color from image"}
                              </button>
                              <span className="flex items-center gap-2">
                                <span className="w-24">
                                  <HexInput value={spineBand} onCommit={(hex) => setSpineBand(hex)} />
                                </span>
                                <input
                                  type="color"
                                  value={spineBand}
                                  onChange={(e) => setSpineBand(e.target.value)}
                                  aria-label={lang === "tr" ? "Sırt bandı rengi" : "Spine band color"}
                                  className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                                />
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-muted">
                            {lang === "tr"
                              ? "Yapay zekâ sırtı yaklaşık bırakır; bu şerit sırtı tam ölçüsünde kapatır, sırt yazısı üstüne gelir."
                              : "AI leaves the spine approximate; this band covers it at exact size, spine text sits on top."}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {([
                          { key: "bg" as const, label: t.colorBg },
                          { key: "ink" as const, label: t.colorInk },
                          { key: "accent" as const, label: t.colorAccent },
                        ]).map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-sm text-foreground">{label}</span>
                            <span className="flex items-center gap-2">
                              <span className="w-24">
                                <HexInput
                                  value={colors[key]}
                                  onCommit={(hex) => setColor(key, hex)}
                                />
                              </span>
                              <input
                                type="color"
                                value={colors[key]}
                                onChange={(e) => setColor(key, e.target.value)}
                                aria-label={label}
                                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>
                    )}

                    {/* İçerik */}
                    {activePanel === "content" && (
                    <section className="space-y-4">
                      <h2 className={headingClass}>{t.contentHeading}</h2>

                      {/* Okunurluk: yazıyı arka plana göre otomatik beyaz/siyah + gölge */}
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface p-3">
                        <input
                          type="checkbox"
                          checked={autoContrast}
                          onChange={(e) => setAutoContrast(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-accent"
                        />
                        <span className="text-xs leading-relaxed">
                          <span className="block font-medium text-foreground">
                            {t.autoContrastLabel}
                          </span>
                          <span className="block text-muted">{t.autoContrastHint}</span>
                        </span>
                      </label>

                      <Field label={t.titleLabel}>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={t.titlePlaceholder}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={t.authorLabel}>
                        <input
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          placeholder={t.authorPlaceholder}
                          className={inputClass}
                        />
                      </Field>
                      <Field label={t.subtitleLabel}>
                        <input
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          placeholder={t.subtitlePlaceholder}
                          className={inputClass}
                        />
                      </Field>

                      {/* Serbest metin — kendi metnini ekle ve düzenle */}
                      <div className="space-y-3 border-t border-border pt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {t.freeTextHeading}
                        </h3>
                        <button type="button" onClick={addText} className={addObjBtn}>
                          <TextTIcon className="h-5 w-5" />
                          {t.objAddText}
                        </button>

                        {/* Eklenen yazının ayarları sağdaki "Seçim" panelinde görünür. */}
                        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted">
                          {t.freeTextHint}
                        </p>
                      </div>

                      {/* Hazır yazı (başlık/yazar/alt başlık/sırt) ayarları sağdaki "Seçim" panelinde. */}
                    </section>
                    )}

                    {/* Nesneler — serbest metin + şekiller */}
                    {activePanel === "objects" && (
                    <section className="space-y-3">
                      <h2 className={headingClass}>{t.objectsHeading}</h2>
                      <p className="text-xs text-muted">{t.objectsHint}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={addRect} className={addObjBtn}>
                          <span className="h-4 w-5 rounded-[3px] bg-current" />
                          {t.objAddRect}
                        </button>
                        <button type="button" onClick={addCircle} className={addObjBtn}>
                          <span className="h-5 w-5 rounded-full bg-current" />
                          {t.objAddCircle}
                        </button>
                        <button type="button" onClick={addLine} className={addObjBtn}>
                          <span className="h-0.5 w-6 rounded-full bg-current" />
                          {t.objAddLine}
                        </button>
                        <button type="button" onClick={addTriangle} className={addObjBtn}>
                          <span
                            className="h-0 w-0 border-x-[10px] border-b-[16px] border-x-transparent"
                            style={{ borderBottomColor: "currentColor" }}
                          />
                          {t.objAddTriangle}
                        </button>
                        <button type="button" onClick={addStar} className={addObjBtn}>
                          <span aria-hidden className="text-lg leading-none">
                            ★
                          </span>
                          {t.objAddStar}
                        </button>
                        <button type="button" onClick={addDiamond} className={addObjBtn}>
                          <span className="h-3.5 w-3.5 rotate-45 bg-current" />
                          {t.objAddDiamond}
                        </button>
                      </div>

                      {/* Hazır süs / ayraçlar */}
                      <p className="pt-1 text-xs font-medium text-muted">{t.dividersHeading}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => addDivider("double")}
                          className={addObjBtn}
                          title={t.dividerDouble}
                        >
                          <span aria-hidden className="flex flex-col gap-1">
                            <span className="h-0.5 w-7 rounded bg-current" />
                            <span className="h-0.5 w-7 rounded bg-current" />
                          </span>
                          {t.dividerDouble}
                        </button>
                        <button
                          type="button"
                          onClick={() => addDivider("dotline")}
                          className={addObjBtn}
                          title={t.dividerDot}
                        >
                          <span aria-hidden className="flex items-center gap-1">
                            <span className="h-0.5 w-2.5 rounded bg-current" />
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            <span className="h-0.5 w-2.5 rounded bg-current" />
                          </span>
                          {t.dividerDot}
                        </button>
                        <button
                          type="button"
                          onClick={() => addDivider("diamond")}
                          className={addObjBtn}
                          title={t.dividerDiamond}
                        >
                          <span aria-hidden className="flex items-center gap-1">
                            <span className="h-0.5 w-2.5 rounded bg-current" />
                            <span className="h-2 w-2 rotate-45 bg-current" />
                            <span className="h-0.5 w-2.5 rounded bg-current" />
                          </span>
                          {t.dividerDiamond}
                        </button>
                      </div>

                      {/* Seçili şeklin ayarları sağdaki "Seçim" panelinde görünür. */}
                      <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted">
                        {t.objectsTip}
                      </p>
                    </section>
                    )}

                    {/* Barkod (ISBN) */}
                    {activePanel === "barcode" && (
                    <section className="space-y-4">
                      <h2 className={headingClass}>{t.barcodeHeading}</h2>
                      <p className="text-xs text-muted">{t.barcodeHint}</p>
                      <Field label={t.isbnLabel} hint={t.isbnHint}>
                        <input
                          value={isbn}
                          onChange={(e) => setIsbn(e.target.value)}
                          placeholder={t.isbnPlaceholder}
                          inputMode="numeric"
                          className={inputClass}
                        />
                        {isbnAutoCompleted ? (
                          <p className="text-xs font-medium text-emerald-600">
                            {t.isbnAutoComplete} {isbnComplete}
                          </p>
                        ) : isbnState === "valid" ? (
                          <p className="text-xs font-medium text-emerald-600">{t.isbnValid}</p>
                        ) : isbnState === "invalid" ? (
                          <p className="text-xs font-medium text-accent">{t.isbnInvalid}</p>
                        ) : null}
                      </Field>
                      <button
                        type="button"
                        onClick={() => setIsbn(randomTestIsbn())}
                        className={ghostBtn}
                      >
                        {t.isbnRandomCta}
                      </button>
                    </section>
                    )}

                    {/* Görsel ve logo */}
                    {activePanel === "images" && (
                    <section className="space-y-4">
                      <h2 className={headingClass}>{t.imagesHeading}</h2>

                      {/* Kapak görseli */}
                      <Field label={t.coverImageLabel}>
                        <div className="flex gap-2">
                          <UploadButton
                            label={coverImage ? t.changeCta : t.uploadCta}
                            onChange={(e) =>
                              readFile(e, (v) => {
                                setCoverImage(v);
                                // Yüklenen kapak görselini "Yüklemelerim" kütüphanesine de al.
                                if (v) pushUserImage(v, "upload");
                              })
                            }
                          />
                          {coverImage && (
                            <button type="button" onClick={() => setCoverImage(null)} className={ghostBtn}>
                              {t.removeCta}
                            </button>
                          )}
                        </div>
                      </Field>

                      {coverImage && (
                        <>
                          <Field label={t.scopeLabel}>
                            <div className="grid grid-cols-2 gap-2">
                              <SegButton active={coverScope === "front"} onClick={() => setCoverScope("front")}>
                                {t.scopeFront}
                              </SegButton>
                              <SegButton active={coverScope === "wrap"} onClick={() => setCoverScope("wrap")}>
                                {t.scopeWrap}
                              </SegButton>
                            </div>
                          </Field>
                          <Field label={t.coverFitLabel} hint={t.coverFitHint}>
                            <div className="grid grid-cols-2 gap-2">
                              <SegButton active={coverFit === "fill"} onClick={() => setCoverFit("fill")}>
                                {t.coverFitFill}
                              </SegButton>
                              <SegButton active={coverFit === "fit"} onClick={() => setCoverFit("fit")}>
                                {t.coverFitContain}
                              </SegButton>
                            </div>
                          </Field>
                          <Field label={t.coverFrameLabel} hint={t.coverFrameHint}>
                            <div className="space-y-2">
                              <div>
                                <span className="text-xs text-muted">{t.coverPanLabel}</span>
                                <input
                                  type="range"
                                  min={-100}
                                  max={100}
                                  value={Math.round(coverPanX * 100)}
                                  onChange={(e) => setCoverPanX(Number(e.target.value) / 100)}
                                  className="w-full accent-accent"
                                />
                              </div>
                              <div>
                                <span className="text-xs text-muted">
                                  {t.coverZoomLabel} — {coverZoom.toFixed(2)}×
                                </span>
                                <input
                                  type="range"
                                  min={100}
                                  max={250}
                                  value={Math.round(coverZoom * 100)}
                                  onChange={(e) => setCoverZoom(Number(e.target.value) / 100)}
                                  className="w-full accent-accent"
                                />
                              </div>
                              {(coverPanX !== 0 || coverZoom !== 1) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCoverPanX(0);
                                    setCoverZoom(1);
                                  }}
                                  className="text-xs font-medium text-accent transition hover:opacity-80"
                                >
                                  {t.coverFrameReset}
                                </button>
                              )}
                            </div>
                          </Field>
                          <Field label={`${t.darkenLabel} — %${Math.round(coverDarken * 100)}`}>
                            <input
                              type="range"
                              min={0}
                              max={70}
                              value={Math.round(coverDarken * 100)}
                              onChange={(e) => setCoverDarken(Number(e.target.value) / 100)}
                              className="w-full accent-accent"
                            />
                            {coverDarken > 0 && (
                              <button
                                type="button"
                                onClick={() => setCoverDarken(0)}
                                className="mt-1.5 text-xs font-medium text-accent transition hover:opacity-80"
                              >
                                {t.darkenRemove}
                              </button>
                            )}
                          </Field>
                          <Field
                            label={`${t.opacityLabel} — %${Math.round(coverOpacity * 100)}`}
                            hint={t.opacityHint}
                          >
                            <input
                              type="range"
                              min={20}
                              max={100}
                              value={Math.round(coverOpacity * 100)}
                              onChange={(e) => setCoverOpacity(Number(e.target.value) / 100)}
                              className="w-full accent-accent"
                            />
                          </Field>
                        </>
                      )}

                      {/* Logo */}
                      <Field label={t.logoLabel}>
                        <div className="flex gap-2">
                          <UploadButton
                            label={logoImage ? t.changeCta : t.uploadCta}
                            onChange={(e) => readFile(e, setLogoImage)}
                          />
                          {logoImage && (
                            <button type="button" onClick={() => setLogoImage(null)} className={ghostBtn}>
                              {t.removeCta}
                            </button>
                          )}
                        </div>
                      </Field>

                      {/* Tek tık KDY logosu: alt-ortaya, güvenli çizgiye, ~20mm. Her kitapta
                          çalışır; kapağın altı koyuysa Beyaz, açıksa Siyah seç. */}
                      <Field label={t.kdyLogoLabel}>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => applyKdyLogo("white")}
                            title={t.kdyLogoWhite}
                            className="flex h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-neutral-800 transition hover:opacity-90"
                            style={{
                              backgroundImage: `url(/kdy/${kdyLogoBase}-white.png)`,
                              backgroundSize: "auto 44%",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          >
                            <span className="sr-only">{t.kdyLogoWhite}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => applyKdyLogo("black")}
                            title={t.kdyLogoBlack}
                            className="flex h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-white transition hover:opacity-90"
                            style={{
                              backgroundImage: `url(/kdy/${kdyLogoBase}-black.png)`,
                              backgroundSize: "auto 44%",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                            }}
                          >
                            <span className="sr-only">{t.kdyLogoBlack}</span>
                          </button>
                        </div>
                      </Field>

                      {logoImage && (
                        <>
                          <Field label={t.logoPosLabel}>
                            <div className="grid grid-cols-2 gap-2">
                              <SegButton active={logoPos === "top"} onClick={() => setLogoPos("top")}>
                                {t.logoPosTop}
                              </SegButton>
                              <SegButton active={logoPos === "bottom"} onClick={() => setLogoPos("bottom")}>
                                {t.logoPosBottom}
                              </SegButton>
                            </div>
                          </Field>
                          <Field label={`${t.logoSizeLabel} — %${logoSize}`}>
                            <input
                              type="range"
                              min={8}
                              max={50}
                              value={logoSize}
                              onChange={(e) => setLogoSize(Number(e.target.value))}
                              className="w-full accent-accent"
                            />
                          </Field>
                        </>
                      )}
                    </section>
                    )}

                    {/* Kitap ayarları */}
                    {activePanel === "setup" && (
                    <section className="space-y-4">
                      <h2 className={headingClass}>{t.setupHeading}</h2>

                      <Field label={t.sizeLabel}>
                        <select value={sizeId} onChange={(e) => setSizeId(e.target.value)} className={selectClass}>
                          <optgroup label={t.sizeGroupKdp}>
                            {kdpSizes.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={t.sizeGroupTr}>
                            {trSizes.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </Field>

                      <Field label={t.pageCountLabel} hint={t.pageCountHint}>
                        <input
                          type="number"
                          min={1}
                          value={pageCount}
                          onChange={(e) => setPageCount(parseInt(e.target.value, 10) || 0)}
                          className={inputClass}
                        />
                      </Field>

                      <Field label={t.paperLabel}>
                        <select
                          value={paperGsm}
                          onChange={(e) => setPaperGsm(Number(e.target.value) as PaperGsm)}
                          className={selectClass}
                        >
                          {PAPER_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g} {t.paperUnit}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label={t.bindingLabel}>
                        <div className="grid grid-cols-2 gap-2">
                          <SegButton active={binding === "soft"} onClick={() => setBinding("soft")}>
                            {t.bindingSoft}
                          </SegButton>
                          <SegButton active={binding === "hard"} onClick={() => setBinding("hard")}>
                            {t.bindingHard}
                          </SegButton>
                        </div>
                      </Field>

                      <Field label={t.bleedLabel} hint={t.bleedHint}>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={bleedMm}
                            onChange={(e) => setBleedMm(parseFloat(e.target.value) || 0)}
                            className={`${inputClass} flex-1`}
                          />
                          <span className="text-sm text-muted">mm</span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          {BLEED_OPTIONS.map((b) => (
                            <SegButton key={b} active={bleedMm === b} onClick={() => setBleedMm(b)}>
                              {b} mm
                            </SegButton>
                          ))}
                        </div>
                      </Field>

                      <div className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex items-baseline justify-between">
                          <span className={headingClass}>{t.spineHeading}</span>
                          <span className="font-sans text-lg font-bold text-accent">
                            {formatMm(spread.spine)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {spineManualOn ? t.spineManualLabel : t.spineAuto}
                        </p>
                        <label className="mt-3 flex items-center gap-2 text-sm text-foreground/80">
                          <input
                            type="checkbox"
                            checked={spineManualOn}
                            onChange={(e) => setSpineManualOn(e.target.checked)}
                            className="h-4 w-4 accent-accent"
                          />
                          {t.spineManualToggle}
                        </label>
                        {spineManualOn && (
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={spineManualValue}
                            onChange={(e) => setSpineManualValue(parseFloat(e.target.value) || 0)}
                            className={`${inputClass} mt-3`}
                          />
                        )}
                      </div>

                      {/* PDF kesim işaretleri — baskı ayarı, ölçülerin yanında dursun */}
                      <label className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-foreground/80">
                        <input
                          type="checkbox"
                          checked={cropMarks}
                          onChange={(e) => setCropMarks(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-accent"
                        />
                        <span>
                          {t.cropMarksLabel}
                          <span className="mt-0.5 block text-xs text-muted">{t.cropMarksHint}</span>
                        </span>
                      </label>
                    </section>
                    )}

                    {/* Katmanlar */}
                    {activePanel === "layers" && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className={headingClass}>{t.layersHeading}</h2>
                        <button
                          type="button"
                          onClick={resetLayout}
                          disabled={!layoutDirty}
                          className="text-xs font-medium text-accent transition disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50"
                        >
                          {t.resetPositions}
                        </button>
                      </div>
                      <p className="text-xs text-muted">{t.layersHint}</p>
                      {layerIds.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                          {t.layersEmpty}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {layerIds.map((id, i) => {
                            const isHidden = !!hidden[id];
                            const isLocked = !!locked[id];
                            return (
                              <li
                                key={id}
                                draggable
                                onDragStart={() => setDragRow(i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (dragRow !== null) reorderLayer(dragRow, i);
                                  setDragRow(null);
                                }}
                                onDragEnd={() => setDragRow(null)}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-2 transition ${
                                  dragRow === i
                                    ? "border-accent bg-accent-soft"
                                    : "border-border bg-surface hover:border-accent/40"
                                } ${isHidden ? "opacity-50" : ""}`}
                              >
                                <DragHandleIcon className="h-4 w-4 shrink-0 cursor-grab text-muted" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(id)}
                                  className="flex-1 truncate text-left text-sm text-foreground transition hover:text-accent"
                                  title={t.layerSelectHint}
                                >
                                  {selectedName(id, t, objects)}
                                </button>
                                <div className="flex shrink-0 flex-col">
                                  <button
                                    type="button"
                                    onClick={() => reorderLayer(i, i - 1)}
                                    disabled={i === 0}
                                    title={t.zBringForward}
                                    aria-label={t.zBringForward}
                                    className="leading-none text-muted transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => reorderLayer(i, i + 1)}
                                    disabled={i === layerIds.length - 1}
                                    title={t.zSendBackward}
                                    aria-label={t.zSendBackward}
                                    className="leading-none text-muted transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
                                  >
                                    ▼
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleHidden(id)}
                                  title={isHidden ? t.layerShow : t.layerHide}
                                  aria-label={isHidden ? t.layerShow : t.layerHide}
                                  className="rounded-md p-1.5 text-muted transition hover:bg-accent-soft hover:text-accent"
                                >
                                  {isHidden ? (
                                    <EyeSlashIcon className="h-4 w-4" />
                                  ) : (
                                    <EyeIcon className="h-4 w-4" />
                                  )}
                                </button>
                                {id !== "darken" && id !== "background" && id !== "spineBand" && id !== "photo" && id !== "photoFrame" && (
                                  <button
                                    type="button"
                                    onClick={() => toggleLocked(id)}
                                    title={isLocked ? t.layerUnlock : t.layerLock}
                                    aria-label={isLocked ? t.layerUnlock : t.layerLock}
                                    className={`rounded-md p-1.5 transition hover:bg-accent-soft hover:text-accent ${
                                      isLocked ? "text-accent" : "text-muted"
                                    }`}
                                  >
                                    {isLocked ? (
                                      <LockIcon className="h-4 w-4" />
                                    ) : (
                                      <LockOpenIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                    )}

                    {/* Yüklemelerim — kişisel görsel + şablon kütüphanesi */}
                    {activePanel === "library" && (
                    <section className="space-y-6">
                      {/* ── Görsellerim ── */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className={headingClass}>{t.libraryImagesHeading}</h2>
                          <label className="shrink-0 cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground">
                            {t.libraryUploadCta}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleLibraryUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="text-xs text-muted">{t.libraryImagesHint}</p>
                        {userImages.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                            {t.libraryEmptyImages}
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {userImages.map((img) => (
                              <li
                                key={img.id}
                                className="flex gap-3 rounded-xl border border-border bg-surface p-2"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.image}
                                  alt=""
                                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                                    {img.source === "ai" ? "AI" : t.libraryUploadCta}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => applyLibraryImageAsCover(img)}
                                    className="rounded-md border border-accent/40 px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft"
                                  >
                                    {t.libraryUseAsCover}
                                  </button>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => addLibraryImageAsObject(img)}
                                      className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
                                    >
                                      {t.libraryAddAsObject}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteUserImage(img.id)}
                                      title={t.libraryDelete}
                                      aria-label={t.libraryDelete}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-accent-soft hover:text-accent"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* ── Şablonlarım ── */}
                      <div className="space-y-3 border-t border-border pt-5">
                        <h2 className={headingClass}>{t.libraryTemplatesHeading}</h2>
                        <p className="text-xs text-muted">{t.libraryTemplatesHint}</p>
                        <button
                          type="button"
                          onClick={saveCurrentAsTemplate}
                          className="w-full rounded-lg border border-accent/40 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent-soft"
                        >
                          {t.librarySaveTemplateCta}
                        </button>
                        {userTemplates.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                            {t.libraryEmptyTemplates}
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {userTemplates.map((tpl) => (
                              <li
                                key={tpl.id}
                                className="flex gap-3 rounded-xl border border-border bg-surface p-2"
                              >
                                {tpl.thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={tpl.thumb}
                                    alt=""
                                    className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover"
                                  />
                                ) : (
                                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted">
                                    <LayoutIcon className="h-5 w-5" />
                                  </div>
                                )}
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <span className="truncate text-sm font-medium text-foreground">
                                    {tpl.name}
                                  </span>
                                  <div className="mt-auto flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => applyUserTemplate(tpl)}
                                      className="flex-1 rounded-md border border-accent/40 px-2 py-1 text-xs font-medium text-accent transition hover:bg-accent-soft"
                                    >
                                      {t.libraryApplyTemplate}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteUserTemplate(tpl.id)}
                                      title={t.libraryDelete}
                                      aria-label={t.libraryDelete}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-accent-soft hover:text-accent"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <p className="rounded-lg bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
                        {t.libraryLocalNote}
                      </p>
                    </section>
                    )}
                      {activePanel === "layers" && inspectorNode && <div className="mt-5">{inspectorNode}</div>}
                    </>
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                title={lang === "tr" ? "Paneli aç" : "Open panel"}
                className="hidden h-full flex-col items-center gap-3 px-2 py-4 text-foreground/70 transition hover:bg-accent-soft hover:text-foreground lg:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">‹</span>
                <meta.Icon className="h-6 w-6 text-accent" />
                {selectedId && <span className="h-2 w-2 rounded-full bg-accent" aria-label={lang === "tr" ? "Seçili öğe var" : "Item selected"} />}
              </button>
            )}
          </aside>
        )}
      </div>


      {wizardActive && projectId && !bigView && <WizardGuide lang={lang} step="cover" projectId={projectId} />}

      {editOpen && coverImage && (
        <CoverEditModal
          image={coverImage}
          t={{
            title: t.aiEditTitle,
            hint: t.aiEditHint,
            brushLabel: t.aiEditBrush,
            promptLabel: t.aiEditPromptLabel,
            promptHint: t.aiEditPromptHint,
            promptPlaceholder: t.aiEditPromptPlaceholder,
            undo: t.aiEditUndo,
            clear: t.aiEditClear,
            cancel: t.aiEditCancel,
            apply: t.aiEditApply,
            busy: t.aiEditBusy,
            needMask: t.aiEditNeedMask,
            needPrompt: t.aiEditNeedPrompt,
            errorToken: t.aiErrorToken,
            errorGeneric: t.aiErrorGeneric,
            modeFind: t.aiEditModeFind,
            modePaint: t.aiEditModePaint,
            findLabel: t.aiEditFindLabel,
            findHint: t.aiEditFindHint,
            findPlaceholder: t.aiEditFindPlaceholder,
            findCta: t.aiEditFindCta,
            finding: t.aiEditFinding,
            findNotFound: t.aiEditFindNotFound,
            findFound: t.aiEditFindFound,
            findAdjust: t.aiEditFindAdjust,
            findAdjustHint: t.aiEditFindAdjustHint,
            tagsCta: t.aiEditTagsCta,
            tagsBusy: t.aiEditTagsBusy,
            tagsHint: t.aiEditTagsHint,
            tagsHeading: t.aiEditTagsHeading,
            tagsEmpty: t.aiEditTagsEmpty,
          }}
          lang={lang}
          onClose={() => setEditOpen(false)}
          onApply={handleEditApply}
        />
      )}
    </div>
  );
}

const headingClass = "sr-only";
const selectClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent";
const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent";
const ghostBtn =
  "rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground/70 transition hover:border-accent/40 hover:text-foreground";
const addObjBtn =
  "flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground";

function UploadButton({
  label,
  onChange,
}: {
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-accent bg-accent-soft px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10">
      {label}
      <input type="file" accept="image/*" onChange={onChange} className="hidden" />
    </label>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Hex renk kutusu: kullanıcı elle #RRGGBB yazabilir; geçerli olduğunda
// (blur veya Enter) commit eder. Renk seçicinin "yapışmama" sorununa
// güvenilir bir alternatif giriş yolu.
function HexInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Dışarıdaki renk değişince (örn. renk seçiciyle) kutuyu render sırasında
  // senkronla — React'in "render sırasında state ayarla" yöntemi.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }
  const commit = () => {
    let v = draft.trim();
    if (!v.startsWith("#")) v = "#" + v;
    // 3 haneli kısa hex'i 6 haneye genişlet.
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onCommit(v.toLowerCase());
    } else {
      setDraft(value); // geçersizse eski değere dön
    }
  };
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      spellCheck={false}
      placeholder="#000000"
      aria-label="HEX"
      className="h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm uppercase text-foreground outline-none transition focus:border-accent/50"
    />
  );
}

// Sayısal mm kutusu: kullanıcı yazarken oynamaz, blur/Enter'da commit eder.
// Dışarıdan gelen değer (tuvalde sürükleyince) render sırasında senkronlanır.
function NumInput({
  value,
  onCommit,
  min,
  max,
  step = 0.5,
  className,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = parseFloat(draft);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    v = Math.round(v * 10) / 10;
    onCommit(v);
    setDraft(String(v));
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={
        className ??
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent/50"
      }
    />
  );
}

// Seçili kartın köşesindeki onay rozeti.
function CheckBadge() {
  return (
    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow">
      ✓
    </span>
  );
}

// Açılır bölüm (Yerleşim ayarları / Gelişmiş ayarlar) — kapalı başlar.
function Accordion({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group py-1" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {icon && <span className="text-foreground/70">{icon}</span>}
        <span className="flex-1">{title}</span>
        <CaretDownIcon className="h-4 w-4 text-foreground/60 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

// Stil kartlarının örnek görselleri: kapak kurgusunun en yakın konsept örneği.
const STYLE_EXAMPLE: Record<string, string> = {
  literary: "/kurgu/FB/1.jpg",
  thriller: "/kurgu/FF/1.jpg",
  fantasy: "/kurgu/FM/1.jpg",
  romance: "/kurgu/FR/1.jpg",
  children: "/kurgu/YF/1.jpg",
  minimal: "/kurgu/QD/1.jpg",
  nonfiction: "/kurgu/K/1.jpg",
  vintage: "/kurgu/DB/1.jpg",
};
// Görsel yüklenene kadar kartın zemin rengi.
const STYLE_SWATCH: Record<string, string> = {
  literary: "linear-gradient(160deg, #efe7d6 0%, #d8c8a8 55%, #8a6f4d 100%)",
  thriller: "linear-gradient(160deg, #2b2f3a 0%, #151821 60%, #b3261e 100%)",
  fantasy: "linear-gradient(160deg, #2a2357 0%, #5b3f9a 55%, #d8b25a 100%)",
  romance: "linear-gradient(160deg, #f6e3e1 0%, #e8b4b8 55%, #b5546a 100%)",
  children: "linear-gradient(160deg, #fbe7a1 0%, #9ed3c6 55%, #f08a5d 100%)",
  minimal: "linear-gradient(160deg, #f4f2ee 0%, #e3ddd3 60%, #b9ae9c 100%)",
  nonfiction: "linear-gradient(160deg, #e7eef5 0%, #9fb6cc 55%, #2f4f6b 100%)",
  vintage: "linear-gradient(160deg, #efe1c3 0%, #c9a97a 55%, #6b4b2e 100%)",
};

function SegButton({
  active,
  onClick,
  children,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-accent bg-accent text-white shadow-sm"
          : "border-transparent bg-transparent text-foreground/75 hover:bg-accent-soft hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// Seçili nesnenin okunur adı (sözlükten / kullanıcı nesnesiyse türü ya da metni).
function selectedName(
  id: string,
  t: {
    selTitle: string;
    selAuthor: string;
    selSubtitle: string;
    selLogo: string;
    selRule: string;
    selFrame: string;
    selEmblem: string;
    selPanel: string;
    selSpine: string;
    selBarcode: string;
    selCover: string;
    selDarken: string;
    selSpineBand: string;
    selPhoto: string;
    selPhotoFrame: string;
    selBackground: string;
    selObjText: string;
    selObjRect: string;
    selObjCircle: string;
    selObjLine: string;
    selObjImage: string;
    selObjTriangle: string;
    selObjStar: string;
    selObjDiamond: string;
    selObjDivider: string;
  },
  objects: CustomObject[] = [],
): string {
  if (id.startsWith("obj-")) {
    const o = objects.find((x) => x.id === id);
    if (!o) return id;
    // Aynı türden birden çok nesne varsa numaralandır (Dikdörtgen 1 / 2…).
    const numbered = (base: string) => {
      const sameType = objects.filter((x) => x.type === o.type);
      if (sameType.length <= 1) return base;
      const n = sameType.findIndex((x) => x.id === o.id) + 1;
      return `${base} ${n}`;
    };
    if (o.type === "text")
      return o.text?.trim()
        ? o.text.trim().replace(/\s+/g, " ").slice(0, 20)
        : numbered(t.selObjText);
    return numbered(
      o.type === "rect"
        ? t.selObjRect
        : o.type === "circle"
          ? t.selObjCircle
          : o.type === "triangle"
            ? t.selObjTriangle
            : o.type === "star"
              ? t.selObjStar
              : o.type === "diamond"
                ? t.selObjDiamond
                : o.type === "divider"
                  ? t.selObjDivider
                  : o.type === "image"
                    ? t.selObjImage
                    : t.selObjLine,
    );
  }
  const map: Record<string, string> = {
    title: t.selTitle,
    author: t.selAuthor,
    subtitle: t.selSubtitle,
    logo: t.selLogo,
    rule: t.selRule,
    frame: t.selFrame,
    emblem: t.selEmblem,
    panel: t.selPanel,
    spineText: t.selSpine,
    barcode: t.selBarcode,
    cover: t.selCover,
    darken: t.selDarken,
    background: t.selBackground,
    spineBand: t.selSpineBand,
    photo: t.selPhoto,
    photoFrame: t.selPhotoFrame,
  };
  return map[id] ?? id;
}

// Yazı tipi kategorisi → yerelleştirilmiş başlık (menü grupları için).
function fontCatLabel(
  cat: FontCategory,
  t: {
    fontCatSerif: string;
    fontCatSans: string;
    fontCatDisplay: string;
    fontCatScript: string;
    fontCatMono: string;
  },
): string {
  switch (cat) {
    case "serif":
      return t.fontCatSerif;
    case "sans":
      return t.fontCatSans;
    case "display":
      return t.fontCatDisplay;
    case "script":
      return t.fontCatScript;
    case "mono":
      return t.fontCatMono;
  }
}
