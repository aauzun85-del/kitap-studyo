"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  BLANK_TEMPLATE_ID,
  getTemplate,
  type CoverColors,
} from "@/lib/cover/templates";
import { STANDARD_PROFILES } from "@/lib/layout/standards";
import {
  normalizeIsbn,
  isValidEan13,
  completeIsbn,
  randomTestIsbn,
} from "@/lib/cover/barcode";
import { exportCoverPdf } from "@/lib/cover/pdf";
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
} from "@/components/PhosphorIcons";
import {
  AI_STYLES,
  DEFAULT_AI_STYLE_ID,
  buildAiPrompt,
  buildNanoCoverPrompt,
  nearestAspectRatio,
  nearestNanoAspect,
  spreadCustomDims,
} from "@/lib/cover/aiStyles";
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
} from "./CoverCanvas";
import {
  COVER_FONTS,
  DEFAULT_COVER_FONT,
  FONT_CATEGORY_ORDER,
  type FontCategory,
} from "@/lib/cover/fonts";

const PRINT_DPI = 300;

type PanelId =
  | "templates"
  | "ai"
  | "content"
  | "objects"
  | "colors"
  | "barcode"
  | "images"
  | "setup"
  | "layers"
  | "library";

export default function CoverStudio({
  lang,
  dict,
  initialProject,
  wizardAuto,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
  /** Sihirbaz modunda: kapağı kitap bilgisinden otomatik üret + AI panelini aç. */
  wizardAuto?: boolean;
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
  const [aiStyle, setAiStyle] = useState(DEFAULT_AI_STYLE_ID);
  // Üretim modeli: "flux" (mevcut, hızlı/sanatsal) | "nano" (Nano Banana Pro,
  // komutları daha iyi izler). Varsayılan flux → mevcut davranış korunur.
  const [aiModel, setAiModel] = useState<"flux" | "nano" | "ideogram">("flux");
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
  const [aiError, setAiError] = useState<"none" | "token" | "generic">("none");
  // Üretim sonrası bilgilendirme (ör. başlık görsele gömülünce yazı katmanları gizlendi).
  const [aiNotice, setAiNotice] = useState<"none" | "embed">("none");
  // AI ile TASARIM ÖĞESİ üretimi (mühür/rozet/amblem… → saydam PNG nesnesi).
  const [elemDesc, setElemDesc] = useState("");
  const [elemBusy, setElemBusy] = useState(false);
  const [elemError, setElemError] = useState<"none" | "token" | "generic">(
    "none",
  );
  // "Boya & değiştir" penceresi açık mı.
  const [editOpen, setEditOpen] = useState(false);

  // Kitap ayarları — yayın profili seçilmişse boyut+taşma o profile göre başlar
  // (kapak baskı speci platformla uyumlu olsun). Eski/profilsiz projede varsayılan.
  const seedCoverPlatform = initialProject?.data.meta.platform;
  const seedCoverProfile = seedCoverPlatform ? STANDARD_PROFILES[seedCoverPlatform] : null;
  const [sizeId, setSizeId] = useState(seedCoverProfile?.defaultSizeId ?? DEFAULT_SIZE_ID);
  const [pageCount, setPageCount] = useState(200);
  const [paperGsm, setPaperGsm] = useState<PaperGsm>(80);
  const [binding, setBinding] = useState<BindingType>("soft");
  const [spineManualOn, setSpineManualOn] = useState(false);
  const [spineManualValue, setSpineManualValue] = useState(11);
  const [bleedMm, setBleedMm] = useState<number>(seedCoverProfile?.bleedMm ?? DEFAULT_BLEED_MM);

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
  const [activePanel, setActivePanel] = useState<PanelId>(wizardAuto ? "ai" : "templates");

  // --- Otomatik kayıt (taslak) ---
  // Tasarım her değişiklikte tarayıcıya kaydedilir; yenilemede kaybolmaz.
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [draftRestored, setDraftRestored] = useState(false);
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
  const selectTemplate = (id: string) => {
    setTemplateId(id);
    setColorOverrides({});
  };
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
    setObjects((prev) => [
      ...prev,
      {
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

  const content = useMemo(
    () => ({
      title: title || t.titlePlaceholder,
      author: author || t.authorPlaceholder,
      subtitle,
      isbn: isbnComplete,
    }),
    [title, author, subtitle, isbnComplete, t.titlePlaceholder, t.authorPlaceholder],
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
    }),
    [coverImage, coverDarken, coverOpacity, coverScope, coverFit, coverPanX, coverZoom, logoImage, logoSize, logoPos],
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

  const handleExportPdf = async () => {
    const dataUrl = canvasRef.current?.getPrintDataUrl(PRINT_DPI);
    if (!dataUrl) return;
    setExporting(true);
    try {
      const safeTitle = (title || t.titlePlaceholder)
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .trim()
        .slice(0, 60) || "kapak";
      await exportCoverPdf(dataUrl, spread, `${safeTitle}-kapak.pdf`, cropMarks);
    } finally {
      setExporting(false);
    }
  };

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

  // --- Değişiklikleri otomatik kaydet (debounce) ---
  // hydratedRef açılana kadar (ilk yükleme) kayıt yapma. Her değişiklikten
  // ~0,6 sn sonra diske yaz; arada yeni değişiklik gelirse zamanlayıcı sıfırlanır.
  useEffect(() => {
    if (!hydratedRef.current) return;
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
      if (projectId) {
        // Buluta kaydet. Küçük resmi her ~4 sn'de bir, düşük DPI ile üret (ucuz).
        let thumb: string | undefined;
        const now = Date.now();
        if (now - lastThumbRef.current > 4000) {
          thumb = canvasRef.current?.getPrintDataUrl(36) ?? undefined;
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
  ]);

  // --- Sekme kapanırken/gizlenirken bekleyen kaydı hemen yaz ---
  // Debounce penceresinde sayfa kapanırsa son değişiklikler kaybolmasın.
  useEffect(() => {
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
  }, [projectId]);

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
  const generateAiCover = async (opts?: {
    styleId?: string;
    desc?: string;
    model?: "flux" | "nano" | "ideogram";
    scope?: "front" | "wrap";
    embedText?: boolean;
  }) => {
    setAiBusy(true);
    setAiError("none");
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
      const embed = (useModel === "nano" || useModel === "ideogram") && useEmbed;
      const prompt = embed
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
      const endpoint =
        useModel === "nano"
          ? "/api/cover-nano"
          : useModel === "ideogram"
            ? "/api/cover-ideogram"
            : "/api/cover-art";
      // Nano ve Ideogram aynı oran kümesini (yatay sarmal dahil) kabul eder →
      // ikisi de nearestNanoAspect kullanır; özel boyut desteklemezler.
      const payload =
        useModel === "nano" || useModel === "ideogram"
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
      });
      if (res.status === 503) {
        setAiError("token");
        return;
      }
      if (!res.ok) {
        setAiError("generic");
        return;
      }
      const data = (await res.json()) as { image?: string };
      if (!data.image) {
        setAiError("generic");
        return;
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
    } catch {
      setAiError("generic");
    } finally {
      setAiBusy(false);
    }
  };

  // ── SİHİRBAZ: kapak adımına girince kitap bilgisinden OTOMATİK kapak üret ──
  // Kitap asistanı (tür+bilgi → art-direction promtu) → Flux arka plan → başlık/
  // yazar kapağın kendi katmanlarıyla üstüne biner. Bir kez çalışır (kapak yoksa).
  const wizardFiredRef = useRef(false);
  useEffect(() => {
    if (!wizardAuto || wizardFiredRef.current) return;
    if (!title.trim() || coverImage) return; // başlık hazır + henüz kapak yok
    wizardFiredRef.current = true;
    void (async () => {
      const genre = initialProject?.data.meta.genre ?? "";
      const summary = (initialProject?.data.manuscript.text ?? "").slice(0, 1500);
      let desc = "";
      let styleId = aiStyle;
      let blurb = "";
      setCoverGenMsg(lang === "tr" ? "Kitap asistanı kapak fikrini yazıyor…" : "The book assistant is sketching your cover…");
      try {
        const res = await fetch("/api/cover-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, author, genre, summary, lang }),
        });
        if (res.ok) {
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
        // asistan başarısız olsa da yine de stil presetiyle bir kapak üretelim
      }
      setAiStyle(styleId);
      setAiDesc(desc);
      setAiModel("flux");
      setAiScope("wrap");
      setCoverGenMsg(lang === "tr" ? "Kapak görseli üretiliyor… (~30 sn)" : "Generating cover artwork… (~30s)");
      await generateAiCover({ styleId, desc, model: "flux", scope: "wrap", embedText: false });
      // Arka kapak yazısını arka kapağa düzenlenebilir metin olarak ekle.
      if (blurb) addBackCoverBlurb(blurb);
      setCoverGenMsg(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardAuto, title, coverImage]);

  // AI ile tasarım ÖĞESİ üret (mühür/rozet/amblem…): saydam PNG döner, tuvale
  // yeni bir "görsel" nesnesi olarak eklenir ve seçilir. Öteki nesneler gibi
  // taşınır/boyutlanır/çoğaltılır/silinir; autosave'e dahildir.
  const generateElement = async () => {
    const desc = elemDesc.trim();
    if (!desc) return;
    setElemBusy(true);
    setElemError("none");
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
      if (!res.ok) {
        setElemError("generic");
        return;
      }
      const data = (await res.json()) as { image?: string };
      if (!data.image) {
        setElemError("generic");
        return;
      }
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
    { id: "templates", label: t.navTemplates, Icon: LayoutIcon },
    { id: "ai", label: t.navAi, Icon: MagicWandIcon },
    { id: "content", label: t.navContent, Icon: TextTIcon },
    { id: "objects", label: t.navObjects, Icon: ShapesIcon },
    { id: "colors", label: t.navColors, Icon: PaletteIcon },
    { id: "barcode", label: t.navBarcode, Icon: BarcodeIcon },
    { id: "images", label: t.navImages, Icon: ImageIcon },
    { id: "setup", label: t.navSetup, Icon: SlidersIcon },
    { id: "layers", label: t.navLayers, Icon: StackIcon },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden px-4 pb-2 pt-2">
      {draftRestored && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
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

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Canva tarzı sol ikon şeridi */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {panels.map(({ id, label, Icon }) => {
            const active = activePanel === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  // Sekmeye geçince seçim odağından çık → geniş panel geri gelir.
                  setActivePanel(id);
                  setSelectedId(null);
                }}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-[11px] font-medium transition lg:w-16 ${
                  active && !selectedId
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}

          {/* "Yüklemelerim" — sol şeridin EN ALTINDA, ayraçla ayrılmış kişisel
              kütüphane (görseller + kaydedilen şablonlar). lg:mt-auto onu
              dikey şeritte en dibe iter. */}
          <button
            type="button"
            onClick={() => {
              setActivePanel("library");
              setSelectedId(null);
            }}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-[11px] font-medium transition lg:mt-auto lg:w-16 lg:border-t lg:border-border lg:pt-3 ${
              activePanel === "library" && !selectedId
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <FolderIcon className="h-5 w-5" />
            {t.navLibrary}
          </button>
        </nav>

        {/* Seçili grubun ayar paneli — her zaman görünür kalır ki seçim
            yapılınca tuval yatayda kaymasın (fabric'in kaymayı sürükleme
            sanmasını önler). */}
        <aside className="w-full shrink-0 lg:h-full lg:w-[300px] lg:overflow-y-auto lg:pr-1">
          {/* Şablonlar */}
          {activePanel === "templates" && (
          <section className="space-y-3">
            {/* Yeni tasarım: boş tuvalden başla (şablon kartlarının üstünde). */}
            <h2 className={headingClass}>{t.blankHeading}</h2>
            <button
              type="button"
              onClick={() => selectTemplate(BLANK_TEMPLATE_ID)}
              className={`flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition ${
                templateId === BLANK_TEMPLATE_ID
                  ? "border-accent ring-1 ring-accent"
                  : "border-border hover:border-accent/40"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg leading-none text-muted">
                +
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {t.blankButton}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {t.blankHint}
                </span>
              </span>
            </button>

            <h2 className={`${headingClass} pt-1`}>{t.templatesHeading}</h2>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => {
                const active = tpl.id === templateId;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => selectTemplate(tpl.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-accent ring-1 ring-accent"
                        : "border-border hover:border-accent/40"
                    }`}
                  >
                    <div className="flex gap-1.5">
                      {tpl.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="h-6 w-full rounded"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <span className="mt-2 block text-sm font-medium text-foreground">
                      {tpl.name[lang]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          )}

          {/* AI Kapak */}
          {activePanel === "ai" && (
          <section className="space-y-4">
            <h2 className={headingClass}>{t.aiHeading}</h2>
            <p className="text-xs text-muted">{t.aiHint}</p>

            <Field label={t.aiModelLabel} hint={t.aiModelHint}>
              <select
                value={aiModel}
                onChange={(e) =>
                  setAiModel(e.target.value as "flux" | "nano" | "ideogram")
                }
                className={selectClass}
              >
                <option value="flux">{t.aiModelFlux}</option>
                <option value="nano">{t.aiModelNano}</option>
                <option value="ideogram">{t.aiModelIdeogram}</option>
              </select>
            </Field>

            {(aiModel === "nano" || aiModel === "ideogram") && (
              <Field label={t.aiEmbedLabel} hint={t.aiEmbedHint}>
                <div className="grid grid-cols-2 gap-2">
                  <SegButton
                    active={aiEmbedText}
                    onClick={() => setAiEmbedText(true)}
                  >
                    {t.aiEmbedOn}
                  </SegButton>
                  <SegButton
                    active={!aiEmbedText}
                    onClick={() => setAiEmbedText(false)}
                  >
                    {t.aiEmbedOff}
                  </SegButton>
                </div>
              </Field>
            )}

            <Field label={t.aiStyleLabel}>
              <select
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value)}
                className={selectClass}
              >
                {AI_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name[lang]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t.aiScopeLabel} hint={t.aiScopeHint}>
              <div className="grid grid-cols-2 gap-2">
                <SegButton active={aiScope === "front"} onClick={() => setAiScope("front")}>
                  {t.scopeFront}
                </SegButton>
                <SegButton active={aiScope === "wrap"} onClick={() => setAiScope("wrap")}>
                  {t.scopeWrap}
                </SegButton>
              </div>
            </Field>

            <Field label={t.aiDescLabel} hint={t.aiDescHint}>
              <textarea
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                placeholder={t.aiDescPlaceholder}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Field>

            <button
              type="button"
              onClick={() => generateAiCover()}
              disabled={aiBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MagicWandIcon className="h-4 w-4" />
              {aiBusy ? t.aiBusy : t.aiGenerate}
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
            {aiNotice === "embed" && (
              <p className="rounded-lg border border-emerald-500/40 bg-emerald-50 px-3 py-3 text-xs text-emerald-700">
                {t.aiEmbedNotice}
              </p>
            )}

            {coverImage && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-accent bg-accent-soft px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/10"
              >
                <MagicWandIcon className="h-4 w-4" />
                {t.aiEditCta}
              </button>
            )}

            {coverImage && (
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
            )}

            {coverImage && (
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
            )}

            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted">
              {t.aiTip}
            </p>

            {aiHistory.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t.aiHistoryHeading}
                  </h3>
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
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">{t.aiHistoryHint}</p>
              </div>
            )}

            {/* AI ile TASARIM ÖĞESİ — saydam PNG nesnesi (mühür/rozet/amblem…) */}
            <div className="space-y-3 border-t border-border pt-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t.elemHeading}
                </h3>
                <p className="mt-1 text-xs text-muted">{t.elemHint}</p>
              </div>

              <Field label={t.elemPresetsLabel}>
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
              </Field>

              <Field label={t.elemDescLabel}>
                <textarea
                  value={elemDesc}
                  onChange={(e) => setElemDesc(e.target.value)}
                  placeholder={t.elemDescPlaceholder}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </Field>

              <button
                type="button"
                onClick={generateElement}
                disabled={elemBusy || !elemDesc.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MagicWandIcon className="h-4 w-4" />
                {elemBusy ? t.elemBusyLabel : t.elemGenerate}
              </button>

              {elemError === "token" && (
                <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">
                  {t.aiErrorToken}
                </p>
              )}
              {elemError === "generic" && (
                <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-3 text-xs text-accent">
                  {t.aiErrorGeneric}
                </p>
              )}

              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted">
                {t.elemTip}
              </p>
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
                      {id !== "darken" && id !== "background" && (
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
        </aside>

        {/* Tuval alanı */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Üst bar: toplam boyut + kılavuz + PDF indir */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-xs font-medium text-accent">
              {t.totalSizeLabel}: {formatMm(spread.totalWidth)} × {formatMm(spread.totalHeight)}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted">
                {draftStatus === "saving" ? t.draftSaving : t.draftSaved}
              </span>
              <button
                type="button"
                onClick={startNewDesign}
                className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground/70 transition hover:border-accent/40 hover:text-foreground"
              >
                {t.draftNew}
              </button>
              <span className="hidden h-5 w-px bg-border sm:block" />
              <label className="flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                {t.showGuides}
              </label>
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seçili nesne ayarları artık tuvalin sağındaki "Seçim" panelinde. */}

          {/* Tuval, kalan yüksekliği doldurur; içinde hem ene hem boya sığar. */}
          <div className="relative min-h-0 flex-1">
            {(coverGenMsg || aiBusy) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/85 backdrop-blur-[2px]">
                <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-accent/25 border-t-accent" />
                <div className="text-sm font-semibold text-foreground">
                  {coverGenMsg ?? (lang === "tr" ? "Kapak görseli üretiliyor…" : "Generating cover…")}
                </div>
                <div className="max-w-[240px] text-center text-xs text-muted">
                  {lang === "tr"
                    ? "Yapay zekâ kapağını çiziyor — bu biraz sürebilir."
                    : "AI is painting your cover — this can take a moment."}
                </div>
              </div>
            )}
            <CoverCanvas
              ref={canvasRef}
              spread={spread}
              labels={labels}
              templateId={templateId}
              colors={colors}
              content={content}
              showGuides={showGuides}
              images={images}
              objects={objects}
              positions={positions}
              layers={layers}
              hidden={hidden}
              locked={locked}
              autoContrast={autoContrast}
              textStyles={textStyles}
              selectedId={selectedId}
              onTextSelect={setSelectedTextLive}
              onGeometrySelect={setSelectedGeoLive}
              onPositionChange={handlePositionChange}
              onSelect={setSelectedId}
              onAngleChange={setSelectedAngle}
              onLayersChange={handleLayersChange}
            />
          </div>

          <p className="shrink-0 text-xs text-muted">{t.bleedNote}</p>
        </section>

        {/* Sağ "Seçim" paneli — her zaman 300px yer kaplar (boşken ipucu
            gösterir). Hep var olması, seçim yapılınca tuvalin yatayda
            kaymamasını sağlar → fabric kaymayı sürükleme sanmaz. */}
        <aside className="w-full shrink-0 lg:h-full lg:w-[300px] lg:overflow-y-auto lg:pr-1">
          {selectedId ? (
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
          ) : (
            /* Boşken bordürsüz/kutusuz sade ipucu → Canva gibi nefes alanı;
               yer (300px) yine sabit kalır, seçimde tuval kaymaz. */
            <p className="px-1 pt-2 text-xs text-muted/70">{t.inspectorEmptyHint}</p>
          )}
        </aside>
      </div>

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
          onClose={() => setEditOpen(false)}
          onApply={handleEditApply}
        />
      )}
    </div>
  );
}

const headingClass =
  "font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted";
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
      <label className="block text-sm font-medium text-foreground">{label}</label>
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
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-surface text-foreground/70 hover:border-accent/40"
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
