"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { completeWizardStep } from "@/lib/projects/data";
import WizardGuide from "@/components/app/WizardGuide";
import { useEditorSession } from "@/lib/editor/session";
import { useSaveStatus, formatSavedTime, SAVE_LABELS } from "@/lib/projects/saveStatus";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { genreThemeId, genreLayoutSeed } from "@/lib/projects/genres";
import { requireExport } from "@/lib/credits/exportGate";
import { useMetaSync, useManuscriptSync, useModuleSync } from "@/lib/projects/useSync";
import { readSavedLayout, LAYOUT_SETTINGS_VERSION, type SavedLayoutSettings } from "@/lib/layout/layoutSettings";
import {
  INTERIOR_SIZES,
  MARGIN_PRESETS,
  pageGeometry,
  type Margins,
  type BookSize,
} from "@/lib/layout/page";
import {
  KDY_SIZE,
  KDY_BODY_FONT,
  KDY_HEADINGS,
} from "@/lib/layout/kdy";
import {
  STANDARD_PROFILES,
  effectiveBleedMm,
  kdpMinInsideMm,
  type PrintStandard,
} from "@/lib/layout/standards";
import {
  paginate,
  parseBlocks,
  type LayoutSettings,
  type BookMeta,
  type Block,
  type Page,
  type Line,
  type Run,
  type ParaAlign,
  type ChapterStyle,
  type SceneBreak,
  type OrnamentKind,
  type TocStyle,
  type BibStyle,
} from "@/lib/layout/paginate";
import {
  conceptLayoutSettings,
  ORNAMENT_OPTIONS,
  TOC_OPTIONS,
  BIB_OPTIONS,
  CHAPTER_STYLE_OPTIONS,
  SCENE_OPTIONS,
  QUOTE_OPTIONS,
  SUBHEAD_OPTIONS,
  type InteriorConcept,
  type ConceptSizeAdjust,
  type ConceptDetails,
} from "@/lib/layout/concepts";
import InteriorConceptPicker from "@/components/layout/InteriorConceptPicker";
import { TYPST_FAMILY_IDS } from "@/lib/typst/fonts";
import {
  LAYOUT_THEMES,
  getTheme,
  DEFAULT_PARAGRAPH_SPACING_MM,
  type LayoutTheme,
  type ChapterOrnament,
} from "@/lib/layout/themes";
import { ThemeThumbnail } from "@/lib/layout/themeThumbnail";
import { parseDocx, type DocxMode } from "@/lib/layout/docx";
import { blocksToMarkdown } from "@/lib/layout/blocksToMarkdown";
import type { MediaMap } from "@/lib/layout/mediaTokens";
import { exportBookPdf } from "@/lib/layout/pdf";
import { exportBookIdml } from "@/lib/layout/idml";
import { exportBookPdfTypst, TypstCrashError, type TypstBookInput, type BlockPos } from "@/lib/typst";
import { preflightPdf, type PreflightReport } from "@/lib/publishing/preflight";
import { TypstPreviewCanvas, type PreviewMode } from "@/components/editor/TypstPreviewCanvas";
import ExportOverlay from "@/components/app/ExportOverlay";
import {
  COVER_FONTS,
  FONT_CATEGORY_ORDER,
  fontFamilyOf,
  COVER_FONT_FAMILIES,
  type FontCategory,
} from "@/lib/cover/fonts";
import {
  TextTIcon,
  SlidersIcon,
  CheckCircleIcon,
  CaretDownIcon,
  ArrowsOutIcon,
  ArrowUUpLeftIcon,
  ArrowUUpRightIcon,
  PaletteIcon,
} from "@/components/PhosphorIcons";
import { useLayoutHistory } from "@/lib/layout/useLayoutHistory";

// Sayfalama hep sabit DPI'da yapılır (yakınlaştırmadan bağımsız sayfa sayısı).
const PAGINATE_DPI = 150;
const BASE_PX_PER_MM = 2.4;
const ZOOM_OPTIONS = [0.7, 0.85, 1, 1.25, 1.5] as const;

// Seçilebilir boyutlar: KDY 130×195 en üstte.
const ALL_SIZES: BookSize[] = [KDY_SIZE, ...INTERIOR_SIZES];
function getSize(id: string): BookSize {
  return ALL_SIZES.find((s) => s.id === id) ?? KDY_SIZE;
}
function familyOf(fontId: string): string {
  return COVER_FONTS.find((f) => f.id === fontId)?.family ?? KDY_BODY_FONT;
}

type PanelId = "book" | "text" | "page" | "type" | "quality";
type SourceMode = "manual" | "word";
type QualitySeverity = "error" | "warning" | "success";
type QualityCheck = { severity: QualitySeverity; label: string; detail: string };

const SAMPLE_TR = `# Birinci Bölüm

Sabah ışığı perdelerin arasından süzülürken, masanın üstünde duran kahve çoktan soğumuştu. Yine de fincanı eline aldı; sıcaklığından çok, alışkanlığın verdiği o tanıdık ağırlık için.

Pencerenin önünde durup sokağa baktı. Aşağıda, her zamanki gibi, gazeteci çocuk köşeyi dönüyordu. Şehir uyanıyordu ama o, bir süredir uykuya hiç dalmamış gibi hissediyordu kendini.

> Kelimeler hâlâ gözünün önündeydi; her birini ezbere biliyordu artık.

Belki de mesele uyku değildi. Belki mesele, dün gece okuduğu o mektuptu.

## Bir Ara Başlık

Tren istasyonu kalabalıktı. İnsanlar birbirine çarpmadan, sanki görünmez bir koreografiyle akıp gidiyordu peronlarda.

# İkinci Bölüm

O, bavulunu sıkıca tutup beklemeye koyuldu. Peronun ucundaki saat, her dakikayı ağır ağır sayıyordu.`;

function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

// Düzenleme panelinde metin RAHAT OKUNUR boyutta görünür (sayfanın küçültülmüş
// ölçeğinde değil). ~110 DPI → 11pt gövde ≈ 17px. Uzun metin panel içinde kaydırılır.
const READ_DPI = 110;
const READ_PXPERMM = READ_DPI / 25.4;

export default function LayoutStudio({
  lang,
  dict,
  initialProject,
  autoExport,
  canExport,
  user = null,
  signOut,
  exportThenHref,
  autoPreflight = false,
  startFocus = false,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
  /** Üst çubuktaki hesap rozeti (tam ekran düzende uygulama menüsü yok). */
  user?: { name: string; initials: string } | null;
  signOut?: () => Promise<void>;
  /** "Tüm dosyaları indir": iç sayfa PDF'i inince buraya geç (kapak indirmesi). */
  exportThenHref?: string;
  /** "Baskı kontrolü": sayfalar hazır olunca baskı denetimini kendiliğinden çalıştır. */
  autoPreflight?: boolean;
  /** "Önizle": büyük görünümde (paneller gizli) aç. */
  startFocus?: boolean;
  /** İndirme ekranından "?export=1": sayfalama hazır olunca İç sayfa PDF'ini
   *  otomatik indir + üstte durum katmanı göster. */
  autoExport?: boolean;
  /** Aktif jeton paketi var mı? false ise indirme kilitli. */
  canExport: boolean;
}) {
  const t = dict.layoutStudio;
  // Bulut projesi: state proje verisinden tohumlanır; proje yoksa anonim (boş).
  const projectId = initialProject?.id ?? null;
  const seed = initialProject?.data;
  // Kayıtlı mizanpaj ayarları (envelope.modules.layout): varsa sol paneldeki her
  // ayar buradan başlar → sayfa yeniden açılınca seçimler kaybolmaz; İndir
  // ekranındaki PDF de bu ayarlarla çıkar. Yoksa eskisi gibi profil/tema varsayılanı.
  const [saved] = useState(() => readSavedLayout(seed?.modules?.layout));

  const [panel, setPanel] = useState<PanelId>("book");

  // Kitap bilgileri.
  const [title, setTitle] = useState(seed?.meta.title ?? "");
  const [author, setAuthor] = useState(seed?.meta.author ?? "");
  const [bio, setBio] = useState(seed?.meta.bio ?? "");
  const [subtitle, setSubtitle] = useState(seed?.meta.subtitle ?? "");
  const [publisher, setPublisher] = useState(seed?.meta.publisher ?? "");

  // Gövde metni (elle yazılan markdown) ve Word'den içe aktarılan bloklar.
  const [sourceMode, setSourceMode] = useState<SourceMode>("manual");
  const [raw, setRaw] = useState(seed?.manuscript.text ?? "");

  // Bulut projesi aktifse: başlık/yazar/bio + metni projeye debounce ile yaz.
  useMetaSync(projectId, { title, author, bio, subtitle, publisher });
  useManuscriptSync(projectId, raw, "layout");
  const [importedBlocks, setImportedBlocks] = useState<Block[] | null>(null);
  // Word'den gelen RESİM ikili verisi (markdown'a sığmaz) → jeton + harita.
  // raw'daki "![](kitap-gorsel:ID)" jetonları buradan veriye bağlanır.
  const [importMedia, setImportMedia] = useState<MediaMap>(() => new Map());
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [docxMode, setDocxMode] = useState<DocxMode>("kdy");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(false);

  // Baskı standardı (yayın profili). Projede seçilmişse ondan başlar; boyut/kenar/
  // taşma o profilin varsayılanlarına göre kurulur. Eski projelerde profil yoksa KDY.
  const seedPlatform: PrintStandard = seed?.meta.platform ?? "kdy";
  const seedProfile = STANDARD_PROFILES[seedPlatform];
  const [standard, setStandard] = useState<PrintStandard>(saved?.standard ?? seedPlatform);
  // KDP/Serbest taşma (bleed) açık mı — profilin varsayılanı.
  const [bleedOn, setBleedOn] = useState(saved?.bleedOn ?? seedProfile.bleedDefaultOn);

  // Sayfa / kenar boşlukları (profil varsayılanları). Sihirbazda kitap boyu
  // seçildiyse (meta.sizeId) o kullanılır; tanınmayan/eski id'de profil varsayılanı.
  const seedSizeId =
    seed?.meta.sizeId && ALL_SIZES.some((s) => s.id === seed.meta.sizeId)
      ? seed.meta.sizeId
      : seedProfile.defaultSizeId;
  const [sizeId, setSizeId] = useState(
    saved?.sizeId && ALL_SIZES.some((s) => s.id === saved.sizeId) ? saved.sizeId : seedSizeId,
  );
  const [margins, setMargins] = useState<Margins>(saved?.margins ?? { ...seedProfile.defaultMargins });
  const [presetId, setPresetId] = useState<string>(saved?.presetId ?? seedPlatform);
  const [gutterAuto, setGutterAuto] = useState(saved?.gutterAuto ?? true);
  const [gutterManual, setGutterManual] = useState(saved?.gutterManual ?? 0);
  const [zoom, setZoom] = useState(1);

  // Önizleme ergonomisi: sol ayar paneli gizlenebilir (geniş önizleme), ikincil
  // kontroller "Görünüm" menüsünde, künye notu kapatılabilir. Tercihler kalıcı.
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [imprintNoteHidden, setImprintNoteHidden] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("mizanpaj-panel-gizli") === "1") setSidePanelOpen(false);
      if (localStorage.getItem("mizanpaj-kunye-notu-gizli") === "1") setImprintNoteHidden(true);
    } catch {
      /* localStorage kapalıysa varsayılanlar kalır */
    }
  }, []);
  const toggleSidePanel = () =>
    setSidePanelOpen((v) => {
      try {
        localStorage.setItem("mizanpaj-panel-gizli", v ? "1" : "0");
      } catch {
        /* yok say */
      }
      return !v;
    });
  // Odak modu: önizleme tüm pencereyi kaplar (uygulama başlığı/sihirbaz çubuğu
  // dahil hiçbir şey yer kaplamaz). ESC ile çıkılır.
  const [focusMode, setFocusMode] = useState(startFocus);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  const dismissImprintNote = () => {
    setImprintNoteHidden(true);
    try {
      localStorage.setItem("mizanpaj-kunye-notu-gizli", "1");
    } catch {
      /* yok say */
    }
  };

  // Tipografi (KDY varsayılanları).
  const [fontId, setFontId] = useState(saved?.fontId ?? "sourceserif");
  const [bodySizePt, setBodySizePt] = useState(saved?.bodySizePt ?? 11);
  const [leadingPt, setLeadingPt] = useState(saved?.leadingPt ?? 15);
  const [align, setAlign] = useState<"left" | "justify">(saved?.align ?? "justify");
  const [indentMm, setIndentMm] = useState(saved?.indentMm ?? 5);
  // Paragraf-arası boşluk varsayılanı 0: klasik roman dizgisinde paragraflar
  // ilk-satır girintisiyle ayrılır, ekstra boşlukla değil. Boşluk eklemek tek
  // taban-çizgisi ızgarasını bozar (satır aralığı 15/20.7 pt karışır); bu yüzden
  // ızgara, gövde satırlarını leading'in katına hizalar (bkz. paginate snapBodyGap).
  // Varsayılan: her paragraftan sonra ~1 satır boşluk (kullanıcı isteği). Tüm
  // temalar da aynı değeri kullanır → türe göre seçilen tema sıfırlamaz.
  const [paragraphSpacingMm, setParagraphSpacingMm] = useState(
    saved?.paragraphSpacingMm ?? DEFAULT_PARAGRAPH_SPACING_MM,
  );
  const [headingFontId, setHeadingFontId] = useState(saved?.headingFontId ?? "sourceserif");
  const [detectHeadings, setDetectHeadings] = useState(saved?.detectHeadings ?? true);

  // Yapısal seçenekler.
  const [chapterRight, setChapterRight] = useState(saved?.chapterRight ?? true);
  const [frontMatter, setFrontMatter] = useState(saved?.frontMatter ?? true);
  const [runningHeads, setRunningHeads] = useState(saved?.runningHeads ?? true);
  const [pageNumbers, setPageNumbers] = useState(saved?.pageNumbers ?? true);
  // Heceleme yalnız Türkçe metinde güvenli; varsayılanı uygulama diline bağla.
  const [hyphenate, setHyphenate] = useState(saved?.hyphenate ?? lang === "tr");
  // Bölüm başı büyük baş harf (drop cap) — varsayılan açık.
  const [dropCap, setDropCap] = useState(saved?.dropCap ?? true);
  // Satır kırma yöntemi — varsayılan "balanced" (Knuth–Plass, profesyonel).
  const [lineBreak, setLineBreak] = useState<"balanced" | "greedy">(saved?.lineBreak ?? "balanced");
  const [widowControl, setWidowControl] = useState(saved?.widowControl ?? true);
  const [opticalMargins, setOpticalMargins] = useState(saved?.opticalMargins ?? true);
  // Bölüm açılış stili (tema sistemi).
  // Bölüm başlığı HER ZAMAN sayfanın en üstünden başlar (kullanıcı isteği: bölüm
  // başlarındaki üst boşluk tamamen kaldırıldı) → sabit 0; eski kayıtlar yok sayılır.
  const chapterTopRatio = 0;
  const [chapterOrnament, setChapterOrnament] = useState<ChapterOrnament>(saved?.chapterOrnament ?? "none");
  const [showChapterKicker, setShowChapterKicker] = useState(saved?.showChapterKicker ?? true);
  // Seçili tema (boş = elle/varsayılan; tema seçince ayarlar paketçe uygulanır).
  const [themeId, setThemeId] = useState(saved?.themeId ?? "");
  // İçindekiler başlık geçersiz kılmaları (bölüm sırasına göre). Boş = otomatik.
  const [tocOverrides, setTocOverrides] = useState<Record<number, string>>(saved?.tocOverrides ?? {});
  // İç tasarım konsepti (konsept ekranı). Boş = henüz seçilmedi; "skip" = üye
  // "kendim ayarlayacağım" dedi. Diğer alanlar konseptin bölüm/sayfa biçimleri.
  const [conceptId, setConceptId] = useState(saved?.conceptId ?? "");
  const [chapterStyle, setChapterStyle] = useState<ChapterStyle>(saved?.chapterStyle ?? "centered");
  const [chapterNewPage, setChapterNewPage] = useState(saved?.chapterNewPage ?? true);
  const [chapterTitleScale, setChapterTitleScale] = useState(saved?.chapterTitleScale ?? 1);
  const [firstWordsCaps, setFirstWordsCaps] = useState(saved?.firstWordsCaps ?? false);
  const [sceneBreak, setSceneBreak] = useState<SceneBreak>(saved?.sceneBreak ?? "stars");
  const [runningHeadStyle, setRunningHeadStyle] = useState<"italic" | "caps">(saved?.runningHeadStyle ?? "italic");
  const [folioPosition, setFolioPosition] = useState<"outer" | "center">(saved?.folioPosition ?? "outer");
  const [subheadStyle, setSubheadStyle] = useState<"center" | "left" | "left-caps">(saved?.subheadStyle ?? "center");
  const [quoteStyle, setQuoteStyle] = useState<"indent" | "box" | "bar">(saved?.quoteStyle ?? "indent");
  const [keepLineBreaks, setKeepLineBreaks] = useState(saved?.keepLineBreaks ?? false);
  const [bodyInsetMm, setBodyInsetMm] = useState(saved?.bodyInsetMm ?? 0);
  // Bu alan gelmeden kaydedilmiş kitaplar: "⁂ ayraç"lı konsept (Çağdaş) ⁂ kalsın.
  const [ornamentKind, setOrnamentKind] = useState<OrnamentKind>(
    saved?.ornamentKind ?? (saved?.sceneBreak === "asterism" ? "asterism" : "fleuron"),
  );
  const [tocStyle, setTocStyle] = useState<TocStyle>(saved?.tocStyle ?? "classic");
  const [bibStyle, setBibStyle] = useState<BibStyle>(saved?.bibStyle ?? "none");

  const [fontsReady, setFontsReady] = useState(false);
  const measureRef = useRef<HTMLCanvasElement | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [gutter, setGutter] = useState(0);

  // Yazma görünümü: sayfanın içinde yazıyormuş gibi tek beyaz kâğıt yüzey.
  // İsteğe bağlı, sağda canlı baskı önizleme (varsayılan kapalı → "ayrı panel"
  // hissi olmasın; istenince açılır).
  // Önizleme motoru: "typst" = gerçek baskı sayfası (=PDF), tıklanabilir bloklar;
  // "js" = hızlı yaklaşık önizleme (yedek).
  const [previewEngine, setPreviewEngine] = useState<"typst" | "js">("typst");
  // İLKE: önizleme = baskı. Typst derlemesi artık Web Worker'da (arka kanal)
  // çalıştığı için büyük kitapta da arayüz donmaz → eski "120+ sayfada otomatik
  // Hızlı'ya düş" kuralı KALDIRILDI (görünen ile basılan farklıydı — kullanıcı
  // şikâyeti). "Hızlı" yalnız elle seçilirse ya da Typst çökerse kullanılır ve
  // önizleme üstünde kalıcı "yaklaşık" şeridi gösterir.
  const pickEngine = useCallback((e: "typst" | "js") => {
    setPreviewEngine(e);
  }, []);

  // PDF dışa aktarma.
  const [cropMarks, setCropMarks] = useState(saved?.cropMarks ?? true);
  const [kerning, setKerning] = useState(saved?.kerning ?? true);

  // Sol paneldeki ayarları projeye kaydet (700 ms gecikmeli + çıkışta hemen).
  // İndir ekranının salt-okunur dışa aktarım modunda (autoExport) YAZILMAZ.
  // Önizleme motoru kaydedilmez: onu büyük-kitap/çökme kuralı kendisi yönetir.
  const layoutSlice = useMemo<SavedLayoutSettings>(
    () => ({
      v: LAYOUT_SETTINGS_VERSION,
      standard, bleedOn, sizeId, margins, presetId, gutterAuto, gutterManual, cropMarks,
      themeId, fontId, headingFontId, bodySizePt, leadingPt, align, indentMm,
      paragraphSpacingMm, detectHeadings, kerning,
      chapterRight, frontMatter, runningHeads, pageNumbers, hyphenate, dropCap, lineBreak,
      widowControl, opticalMargins,
      chapterTopRatio, chapterOrnament, showChapterKicker, tocOverrides,
      conceptId, chapterStyle, chapterNewPage, chapterTitleScale, firstWordsCaps, sceneBreak,
      runningHeadStyle, folioPosition, subheadStyle, quoteStyle, keepLineBreaks, bodyInsetMm,
      ornamentKind, tocStyle, bibStyle,
    }),
    [
      standard, bleedOn, sizeId, margins, presetId, gutterAuto, gutterManual, cropMarks,
      themeId, fontId, headingFontId, bodySizePt, leadingPt, align, indentMm,
      paragraphSpacingMm, detectHeadings, kerning,
      chapterRight, frontMatter, runningHeads, pageNumbers, hyphenate, dropCap, lineBreak,
      widowControl, opticalMargins,
      chapterTopRatio, chapterOrnament, showChapterKicker, tocOverrides,
      conceptId, chapterStyle, chapterNewPage, chapterTitleScale, firstWordsCaps, sceneBreak,
      runningHeadStyle, folioPosition, subheadStyle, quoteStyle, keepLineBreaks, bodyInsetMm,
      ornamentKind, tocStyle, bibStyle,
    ],
  );
  useModuleSync(projectId, "layout", layoutSlice, !!autoExport);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  // Typst PDF motoru çöktüyse (sayfa yenilenene kadar çalışamaz): anlaşılır
  // mesaj + "Sayfayı yenile" + teknik not (gerçek sebep).
  const [typstCrash, setTypstCrash] = useState<TypstCrashError | null>(null);
  // İndirme ekranından "?export=1" ile gelince: sayfalama hazır olunca İç sayfa
  // PDF'i otomatik indirilir; üstteki durum katmanı bunu izler.
  const [autoExportStatus, setAutoExportStatus] = useState<"working" | "done" | "error">("working");
  const autoExportFiredRef = useRef(false);
  const autoExportSafetyRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = COVER_FONT_FAMILIES.map((f) =>
      document.fonts.load(`16px "${f}"`).catch(() => undefined),
    );
    Promise.all(load).then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const size = getSize(sizeId);

  const meta: BookMeta = useMemo(
    () => ({ title, author, bio, subtitle, publisher }),
    [title, author, bio, subtitle, publisher],
  );

  const settings: LayoutSettings = useMemo(
    () => ({
      bodyFontFamily: familyOf(fontId),
      bodySizePt,
      leadingPt,
      align,
      firstLineIndentMm: indentMm,
      paragraphSpacingMm,
      headingFontFamily: familyOf(headingFontId),
      detectHeadings,
      chapterStartsOnRightPage: chapterRight,
      showFrontMatter: frontMatter,
      showRunningHeads: runningHeads,
      showPageNumbers: pageNumbers,
      hyphenate,
      lang: lang === "en" ? "en" : "tr",
      dropCap,
      lineBreak,
      widowControl,
      opticalMargins,
      chapterTopRatio,
      chapterOrnament,
      showChapterKicker,
      conceptId: conceptId && conceptId !== "skip" ? conceptId : undefined,
      chapterStyle,
      chapterNewPage,
      chapterTitleScale,
      firstWordsCaps,
      sceneBreak,
      runningHeadStyle,
      folioPosition,
      subheadStyle,
      quoteStyle,
      keepLineBreaks,
      bodyInsetMm,
      ornamentKind,
      tocStyle,
      bibStyle,
    }),
    [
      fontId,
      bodySizePt,
      leadingPt,
      align,
      indentMm,
      paragraphSpacingMm,
      headingFontId,
      detectHeadings,
      chapterRight,
      frontMatter,
      runningHeads,
      pageNumbers,
      hyphenate,
      dropCap,
      lineBreak,
      widowControl,
      opticalMargins,
      chapterTopRatio,
      chapterOrnament,
      showChapterKicker,
      conceptId,
      chapterStyle,
      chapterNewPage,
      chapterTitleScale,
      firstWordsCaps,
      sceneBreak,
      runningHeadStyle,
      folioPosition,
      subheadStyle,
      quoteStyle,
      keepLineBreaks,
      bodyInsetMm,
      ornamentKind,
      tocStyle,
      bibStyle,
      lang,
    ],
  );

  // Tema uygula: tüm tipografi + bölüm-açılış ayarlarını paketçe oturt. Marjlara
  // DOKUNMAZ (platform/KDY uyumu korunur). Seçimden sonra her ayar elle değişebilir.
  const applyTheme = useCallback((theme: LayoutTheme) => {
    setThemeId(theme.id);
    setFontId(theme.bodyFontId);
    setHeadingFontId(theme.headingFontId);
    setBodySizePt(theme.bodySizePt);
    setLeadingPt(theme.leadingPt);
    setAlign(theme.align);
    setIndentMm(theme.firstLineIndentMm);
    setParagraphSpacingMm(theme.paragraphSpacingMm);
    setHyphenate(theme.hyphenate);
    setLineBreak(theme.lineBreak);
    setDropCap(theme.dropCap);
    setChapterOrnament(theme.chapterOrnament);
    setShowChapterKicker(theme.showChapterKicker);
    // Hazır tema konseptin özel biçimlerini bugünkü varsayılanlara döndürür.
    // Konsept artık geçerli değil (ama ekran yeniden kendiliğinden açılmasın).
    setConceptId((prev) => (prev ? "skip" : prev));
    setChapterStyle("centered");
    setChapterNewPage(true);
    setChapterTitleScale(1);
    setFirstWordsCaps(false);
    setSceneBreak("stars");
    setRunningHeadStyle("italic");
    setFolioPosition("outer");
    setSubheadStyle("center");
    setQuoteStyle("indent");
    setKeepLineBreaks(false);
    setBodyInsetMm(0);
    setOrnamentKind("fleuron");
    setTocStyle("classic");
    setBibStyle("none");
  }, []);

  // İç tasarım konsepti uygula: tipografi + bölüm/sayfa biçimleri paketçe.
  // Marjlara ve boyuta DOKUNMAZ (baskı profili korunur).
  const applyConcept = useCallback((k: InteriorConcept, adjust: ConceptSizeAdjust, details: ConceptDetails = {}) => {
    const c = conceptLayoutSettings(k, familyOf, adjust, details);
    setConceptId(k.id);
    setThemeId("");
    setFontId(k.bodyFontId);
    setHeadingFontId(k.headingFontId);
    setBodySizePt(c.bodySizePt);
    setLeadingPt(c.leadingPt);
    setAlign(c.align);
    setIndentMm(c.firstLineIndentMm);
    setParagraphSpacingMm(c.paragraphSpacingMm);
    setHyphenate(c.hyphenate);
    setLineBreak(c.lineBreak);
    setDropCap(c.dropCap);
    setChapterOrnament(c.chapterOrnament);
    setShowChapterKicker(c.showChapterKicker);
    setRunningHeads(c.showRunningHeads);
    setPageNumbers(c.showPageNumbers);
    setChapterStyle(c.chapterStyle);
    setChapterNewPage(c.chapterNewPage);
    setChapterTitleScale(c.chapterTitleScale);
    setFirstWordsCaps(c.firstWordsCaps);
    setSceneBreak(c.sceneBreak);
    setRunningHeadStyle(c.runningHeadStyle);
    setFolioPosition(c.folioPosition);
    setSubheadStyle(c.subheadStyle);
    setQuoteStyle(c.quoteStyle);
    setKeepLineBreaks(c.keepLineBreaks);
    setBodyInsetMm(c.bodyInsetMm);
    setOrnamentKind(c.ornamentKind);
    setTocStyle(c.tocStyle);
    setBibStyle(c.bibStyle);
  }, []);

  // Tür → tema: sihirbazda seçilen kitap türü bir temaya eşleşiyorsa mizanpaj
  // o temayla açılır (şiir→Şiir, kişisel gelişim→Kişisel Gelişim, akademik/
  // bilim/tarih→Akademik, biyografi→Anı). Çocuk kitabında yalnız punto büyür.
  // Bir kez, açılışta çalışır; kullanıcı sonrasında her şeyi değiştirebilir.
  const genreThemeFiredRef = useRef(false);
  useEffect(() => {
    if (genreThemeFiredRef.current) return;
    genreThemeFiredRef.current = true;
    // Kayıtlı ayar varsa kullanıcının seçimi geçerli: tür teması EZMESİN.
    if (saved) return;
    const themeIdFromGenre = genreThemeId(seed?.meta.genre);
    if (themeIdFromGenre) applyTheme(getTheme(themeIdFromGenre));
    const extra = genreLayoutSeed(seed?.meta.genre);
    if (extra?.bodySizePt) setBodySizePt(extra.bodySizePt);
    if (extra?.leadingPt) setLeadingPt(extra.leadingPt);
  }, [applyTheme, seed, saved]);

  // Etkin bloklar: Word modundaysa ve içe aktarım varsa onu, yoksa elle
  // yazılan markdown'ı kullan. İçe aktarım korunur; kaynağı değiştirince
  // kaybolmaz, böylece kullanıcı ileri-geri geçebilir.
  const derivedBlocks: Block[] = useMemo(
    () =>
      sourceMode === "word" && importedBlocks
        ? importedBlocks
        : parseBlocks(raw, detectHeadings, importMedia, { keepLineBreaks }),
    [sourceMode, importedBlocks, raw, detectHeadings, importMedia, keepLineBreaks],
  );

  // Canvasta düzenlenen blok indeksi (null = düzenleme yok).
  const [editingBlock, setEditingBlock] = useState<number | null>(null);

  // Geri al / Yinele: tek kaynak (raw + resim haritası) üzerinden. Geri yükleme
  // açık paragraf düzenleyicisini kapatır; sayfalama + otomatik kayıt takip eder.
  const restoreSnapshot = useCallback((r: string, m: MediaMap) => {
    setEditingBlock(null);
    setImportMedia(m);
    setRaw(r);
  }, []);
  const history = useLayoutHistory(raw, importMedia, restoreSnapshot, t.stepGeneric);
  const markStep = history.label;

  // Aktif düzenleyicinin emir API'si (biçim çubuğu → seçili metne kalın/italik).
  const editorApiRef = useRef<EditorApi | null>(null);
  // Seçimin canlı biçimi (çubukta B/I vurgusu için). Düzenleyici güncelliyor.
  const [selFmt, setSelFmt] = useState<{ bold: boolean; italic: boolean }>({ bold: false, italic: false });

  // Canvas üstünde düzenleme için tek doğru kaynak. Kaynak (elle metin / Word
  // içe aktarma / mod) değişince türetilen değerden yeniden kurulur; canvasta
  // yapılan düzenlemeler bir sonraki kaynak değişimine kadar burada yaşar.
  const [blocks, setBlocks] = useState<Block[]>(derivedBlocks);
  useEffect(() => {
    // Düzenleme sürerken (editingBlock != null) canvas'ı yeniden tohumlama:
    // commitBlockFinal raw'a yazınca derivedBlocks değişir; burada reseed yapmak
    // yeni açılan editörü kapatır ve anlık düzenlemeyi ezerdi. Düzenleme bitince
    // (null) raw'dan tazele — raw artık düzenlemeyi içerdiği için kayıp olmaz.
    if (editingBlock != null) return;
    setBlocks(derivedBlocks);
  }, [derivedBlocks, editingBlock]);

  // İçindekiler'e girecek bölümlerin (1. seviye başlık) sıralı başlıkları.
  // paginate ile AYNI süzgeç; İçindekiler düzenleme listesi bunları gösterir.
  const chapterTitles = useMemo(
    () =>
      blocks
        .filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.level === 1)
        .map((b) => b.runs.map((r) => r.text).join("").trim()),
    [blocks],
  );

  // Düzenleme bitince (blur / ✕ / başka yere tıklama) çağrılır: yeni run'ları
  // yazar, blok boşaldıysa siler. Başlık silinince içindekiler de düşer (blok
  // indeksleri konumsaldır; sayfalama yeniden numaralandırır).
  const commitBlockFinal = useCallback(
    (index: number, runs: Run[]) => {
      const b = blocks[index];
      if (!b || b.type === "blank" || b.type === "image" || b.type === "table" || b.type === "pagebreak" || b.type === "spacer") {
        setEditingBlock(null);
        return;
      }
      const text = runs.map((r) => r.text).join("");
      let next: Block[];
      if (text.trim().length === 0) {
        next = [...blocks.slice(0, index), ...blocks.slice(index + 1)]; // boşaldı → sil
      } else if (runsEqual(b.runs, runs) && !fmtDirtyRef.current) {
        setEditingBlock(null); // değişiklik yok → dokunma
        return;
      } else if (runsEqual(b.runs, runs)) {
        // Metin aynı ama font/punto değişti → mevcut blocks'u raw'a yaz.
        next = [...blocks];
      } else {
        next = [...blocks];
        next[index] = { ...b, runs };
      }
      // TEK KAYNAK = raw: canvas düzenlemesini hem blocks'a (anında önizleme) hem
      // markdown'a YAZ → yan metin (textarea), otomatik kayıt ve PDF hepsi aynı
      // kaynaktan okur. (Eskiden yalnız blocks güncellenip raw bayat kalıyordu →
      // düzenleme ne kaydoluyor ne PDF'e geçiyordu.)
      setBlocks(next);
      const { markdown, media } = blocksToMarkdown(next);
      markStep(t.stepEdit);
      setImportMedia(media);
      setRaw(markdown);
      setEditingBlock(null);
      fmtDirtyRef.current = false;
    },
    [blocks, markStep, t.stepEdit],
  );

  // Düzenleme sürerken (örn. blok-seviyesi punto değişince yeniden sayfalama
  // editörü taşıyabilir) ara kayıt: yalnızca run'ları günceller, düzenlemeyi
  // bitirmez ve bloğu silmez.
  const commitBlockDraft = useCallback((index: number, runs: Run[]) => {
    setBlocks((prev) => {
      const b = prev[index];
      if (!b || b.type === "blank" || b.type === "image" || b.type === "table" || b.type === "pagebreak" || b.type === "spacer") return prev;
      if (runs.length === 0 || runsEqual(b.runs, runs)) return prev;
      const next = [...prev];
      next[index] = { ...b, runs };
      return next;
    });
  }, []);

  // Biçim çubuğu: düzenlenen bloğun blok-seviyesi biçimini güncelle (tüm paragraf).
  // fmtDirty: yalnız font/punto değişti ve metin AYNI kaldıysa bile commit'te
  // raw'a yazılsın (yoksa kapatınca kaybolur — raw tek kalıcı kaynak).
  const fmtDirtyRef = useRef(false);
  const mutateEditingBlock = useCallback(
    (fn: (b: Block) => Block) => {
      setBlocks((prev) => {
        if (editingBlock == null) return prev;
        const b = prev[editingBlock];
        if (!b || b.type === "blank" || b.type === "image" || b.type === "table" || b.type === "pagebreak" || b.type === "spacer") return prev;
        const next = [...prev];
        next[editingBlock] = fn(b);
        return next;
      });
      fmtDirtyRef.current = true;
    },
    [editingBlock],
  );
  // ── Sayfa düzeni eylemleri (önizlemede paragrafa tıklayınca biçim çubuğundan) ──
  // Yazar GERÇEK SAYFADA bir paragrafı görüp tıklar; bu eylemler blocks'a
  // pagebreak/spacer ekler/çıkarır → markdown'a serialize edip setRaw (KALICI +
  // her iki motorda reflow). Word resim id'leri yeniden üretildiği için medya
  // haritası da güncellenir.
  const applyLayout = useCallback((next: Block[]) => {
    const { markdown, media } = blocksToMarkdown(next);
    setImportMedia(media);
    setRaw(markdown);
    setEditingBlock(null);
  }, []);
  // İmleç paragrafın ortasındaysa oradan böl (cümle-bazlı); değilse tüm bloğa
  // uygula. İki yarı arasına ayraç (pagebreak/spacer) girer.
  const sendBlockToNextPage = useCallback(
    (i: number) => {
      markStep(t.stepNextPage);
      const blk = blocks[i];
      if (blk?.type === "paragraph") {
        const s = editorApiRef.current?.splitAtCaret?.();
        if (s && s.before.length && s.after.length) {
          applyLayout([...blocks.slice(0, i), { ...blk, runs: s.before }, { type: "pagebreak" }, { ...blk, runs: s.after }, ...blocks.slice(i + 1)]);
          return;
        }
      }
      applyLayout([...blocks.slice(0, i), { type: "pagebreak" }, ...blocks.slice(i)]);
    },
    [blocks, applyLayout, markStep, t.stepNextPage],
  );
  const addSpaceAfterBlock = useCallback(
    (i: number) => {
      markStep(t.stepSpace);
      const blk = blocks[i];
      if (blk?.type === "paragraph") {
        const s = editorApiRef.current?.splitAtCaret?.();
        if (s && s.before.length && s.after.length) {
          applyLayout([...blocks.slice(0, i), { ...blk, runs: s.before }, { type: "spacer", mm: 8 }, { ...blk, runs: s.after }, ...blocks.slice(i + 1)]);
          return;
        }
      }
      applyLayout([...blocks.slice(0, i + 1), { type: "spacer", mm: 8 }, ...blocks.slice(i + 1)]);
    },
    [blocks, applyLayout, markStep, t.stepSpace],
  );
  const pullBlockToPrevPage = useCallback(
    (i: number) => {
      if (i <= 0 || blocks[i - 1]?.type !== "pagebreak") return;
      markStep(t.stepPrevPage);
      applyLayout([...blocks.slice(0, i - 1), ...blocks.slice(i)]);
    },
    [blocks, applyLayout, markStep, t.stepPrevPage],
  );

  // Bir bloğu düzenlemeye başla (JS önizleme satırı VEYA Typst sayfa hotspot'u).
  // Başka bloğa geçmeden ÖNCE mevcut düzenlemeyi commit'le (tıklama blur etmez).
  // editingBlock'u REF'ten okur → callback SABİT kalır (TypstPreviewCanvas
  // hotspot'larını memoize edebilsin → her seçimde 100'lerce div yeniden
  // çizilmesin = "işaretleyince yavaş" düzelir).
  const editingBlockRef = useRef<number | null>(null);
  useEffect(() => {
    editingBlockRef.current = editingBlock;
  }, [editingBlock]);
  const startEditBlock = useCallback((i: number) => {
    const cur = editingBlockRef.current;
    if (cur != null && cur !== i) editorApiRef.current?.commit();
    setSelFmt({ bold: false, italic: false });
    fmtDirtyRef.current = false;
    setEditingBlock(i);
  }, []);

  const setBlockFont = useCallback(
    (family: string) => mutateEditingBlock((b) => (b.type === "blank" ? b : { ...b, fontFamily: family })),
    [mutateEditingBlock],
  );
  const setBlockSize = useCallback(
    (pt: number) => mutateEditingBlock((b) => (b.type === "blank" ? b : { ...b, sizePt: pt })),
    [mutateEditingBlock],
  );
  const setBlockAlign = useCallback(
    (align: ParaAlign) => mutateEditingBlock((b) => (b.type === "blank" ? b : { ...b, align })),
    [mutateEditingBlock],
  );
  // Kalın/italik artık seçili metne uygulanır: aktif düzenleyicinin API'sine git.
  const toggleSelBold = useCallback(() => editorApiRef.current?.toggleBold(), []);
  const toggleSelItalic = useCallback(() => editorApiRef.current?.toggleItalic(), []);

  // ── Geri al / Yinele ──
  // Araç çubuğu düğmesine basınca açık paragraf önce blur ile kaydolur (değişiklik
  // varsa o da bir adım olur) → "Geri al" her zaman EN SON değişikliği alır.
  // Kısa bir not neyin geri alındığını söyler (değişiklik görünmeyen bir
  // sayfada olabilir).
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const noteTimerRef = useRef<number | null>(null);
  const flashNote = useCallback((text: string) => {
    setHistoryNote(text);
    if (noteTimerRef.current) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setHistoryNote(null), 2800);
  }, []);
  // Typst önizlemesi ÇÖKERSE (Rust panic; işçi tazelenemedi) "Hızlı" moda düş →
  // asla "önizleme hatası"nda kilitlenme. Yalnız gerçek çökmede çağrılır
  // (TypstPreviewCanvas ayıklar); geçici hatada Typst'te kalınıp yeniden denenir.
  const handleTypstPreviewError = useCallback(() => {
    setPreviewEngine("js");
    flashNote(
      "Typst önizlemesi bu kitapta çöktü — 'Hızlı' (yaklaşık) moda geçildi. PDF yine Typst ile üretilir.",
    );
  }, [flashNote]);
  const { undo: historyUndo, redo: historyRedo } = history;
  const handleUndo = useCallback(() => {
    if (editingBlockRef.current != null) {
      // Düzenleyici hâlâ açıksa (blur kaydetmediyse): kaydetmeden kapat.
      setEditingBlock(null);
      flashNote(t.undoEditClosed);
      return;
    }
    const done = historyUndo();
    if (done) flashNote(t.undoneNote.replace("{label}", done));
  }, [historyUndo, flashNote, t.undoEditClosed, t.undoneNote]);
  const handleRedo = useCallback(() => {
    const done = historyRedo();
    if (done) flashNote(t.redoneNote.replace("{label}", done));
  }, [historyRedo, flashNote, t.redoneNote]);
  // ⌘Z / Ctrl+Z geri al; ⌘⇧Z / Ctrl+Y yinele. Yazı alanındayken tarayıcının
  // kendi geri alması çalışsın diye dokunmayız.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const isUndo = k === "z" && !e.shiftKey;
      const isRedo = (k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey && !e.metaKey);
      if (!isUndo && !isRedo) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      if (isUndo) handleUndo();
      else handleRedo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  const handleImport = useCallback(
    async (file: File) => {
      setImporting(true);
      setImportError(false);
      try {
        const buffer = await file.arrayBuffer();
        const res = parseDocx(buffer, docxMode);
        // Word içeriğini DÜZENLENEBİLİR + KAYITLI tek kaynağa (markdown raw) çevir.
        // Resim/tablo kaybolmaz (jeton + medya haritası); kullanıcı yazma
        // görünümünde doğrudan metni düzenler, otomatik kaydolur.
        const { markdown, media } = blocksToMarkdown(res.blocks);
        markStep(t.stepImport);
        setRaw(markdown);
        setImportMedia(media);
        setImportedBlocks(null);
        setSourceMode("manual");
        setImportInfo(
          t.wordImportedInfo
            .replace("{paragraphs}", String(res.paragraphCount))
            .replace("{headings}", String(res.headingCount)),
        );
        // Boşsa Word'ün üst verisinden başlık/yazar öner.
        if (res.suggestedTitle) setTitle((cur) => cur.trim() || res.suggestedTitle!);
        if (res.suggestedAuthor) setAuthor((cur) => cur.trim() || res.suggestedAuthor!);
      } catch {
        setImportedBlocks(null);
        setImportInfo(null);
        setImportError(true);
      } finally {
        setImporting(false);
      }
    },
    [docxMode, t, markStep],
  );

  const clearImport = useCallback(() => {
    setImportedBlocks(null);
    setImportInfo(null);
    setImportError(false);
  }, []);

  const handleExportPdf = useCallback(async (): Promise<boolean> => {
    if (pages.length === 0) return false;
    if (!requireExport(canExport, lang)) return false;
    setExporting(true);
    setExportError(false);
    try {
      const profile = STANDARD_PROFILES[standard];
      const bytes = await exportBookPdf({
        pages,
        size: getSize(sizeId),
        margins,
        gutter,
        // Taşma: KDY hep 5 mm; KDP taşma açıksa 3,175 mm, kapalıysa 0 (tam kesim).
        bleedMm: effectiveBleedMm(standard, bleedOn),
        markOffsetMm: profile.markOffsetMm,
        // Kesim işaretleri yalnızca KDY'de; KDP işaretsiz PDF ister.
        cropMarks: profile.cropMarksAllowed ? cropMarks : false,
        bodyFamily: familyOf(fontId),
        kerning,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (title.trim() || "kitap").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
      a.download = `${safe || "kitap"}-ic-sayfa.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Büyük PDF'te blob okunmadan revoke edilirse indirme kesilir → gecikmeli iptal.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      setExportError(true);
      return false;
    } finally {
      setExporting(false);
    }
  }, [pages, sizeId, margins, gutter, cropMarks, kerning, fontId, title, standard, bleedOn, canExport, lang]);

  // InDesign IDML dışa aktarma: mizanpajı Adobe InDesign'da açılabilir .idml
  // paketine çevirir (metin + boyut + kenar + stiller). Jeton kapısı PDF ile aynı.
  const handleExportIdml = useCallback(async (): Promise<boolean> => {
    if (blocks.length === 0) return false;
    if (!requireExport(canExport, lang)) return false;
    setExporting(true);
    setExportError(false);
    try {
      const bytes = await exportBookIdml({
        meta,
        blocks,
        settings,
        size: getSize(sizeId),
        margins,
        gutter,
        // Yalnız GÖVDE sayfaları: başlık/içindekiler/boş sayfalar IDML'de yok;
        // toplam sayı verilirse hepsi InDesign'da sonda boş sayfaya dönüşüyor.
        pageCount: pages.filter((p) => p.role === "body").length,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/vnd.adobe.indesign-idml-package" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (title.trim() || "kitap").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
      a.download = `${safe || "kitap"}-ic-sayfa.idml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      setExportError(true);
      return false;
    } finally {
      setExporting(false);
    }
  }, [blocks, meta, settings, sizeId, margins, gutter, pages.length, title, canExport, lang]);

  // Yazma görünümünün canlı önizlemesine giden Typst girdisi. Export'la AYNI
  // montaj; yalnız kesim krosları/taşma KAPALI → temiz "kitap sayfası" görünür
  // (yazarken kırpma bandı kafa karıştırmasın; export tam geometriyi kullanır).
  const typstInput: TypstBookInput = useMemo(
    () => ({
      meta,
      blocks,
      settings,
      size: getSize(sizeId),
      margins,
      gutter,
      bleedMm: 0,
      markOffsetMm: STANDARD_PROFILES[standard].markOffsetMm,
      cropMarks: false,
    }),
    [meta, blocks, settings, sizeId, margins, gutter, standard],
  );

  // DENEME — Typst (WASM) motoruyla aynı PDF. Mevcut motorla YAN YANA; blocks +
  // meta + settings + geometri besler (pages[] DEĞİL — Typst kendi sayfalıyor).
  // Doğrulanınca varsayılan olacak; şimdilik ayrı tuş.
  const handleExportPdfTypst = useCallback(async (): Promise<boolean> => {
    if (blocks.length === 0) return false;
    if (!requireExport(canExport, lang)) return false;
    setExporting(true);
    setExportError(false);
    try {
      const profile = STANDARD_PROFILES[standard];
      const bytes = await exportBookPdfTypst({
        meta,
        blocks,
        settings,
        size: getSize(sizeId),
        margins,
        gutter,
        bleedMm: effectiveBleedMm(standard, bleedOn),
        markOffsetMm: profile.markOffsetMm,
        cropMarks: profile.cropMarksAllowed ? cropMarks : false,
      });
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (title.trim() || "kitap").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
      a.download = `${safe || "kitap"}-ic-sayfa-typst.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      if (e instanceof TypstCrashError) setTypstCrash(e);
      setExportError(true);
      return false;
    } finally {
      setExporting(false);
    }
  }, [blocks, meta, settings, sizeId, margins, gutter, cropMarks, standard, bleedOn, title, canExport, lang]);

  // Baskı denetimi (preflight): Typst PDF'ini üret + yapısal baskı kontrolleri.
  const [preflightReport, setPreflightReport] = useState<PreflightReport | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);
  const handlePreflight = useCallback(async () => {
    if (blocks.length === 0) return;
    setPreflightRunning(true);
    setPreflightReport(null);
    try {
      const profile = STANDARD_PROFILES[standard];
      const bleedMm = effectiveBleedMm(standard, bleedOn);
      const cropOn = profile.cropMarksAllowed ? cropMarks : false;
      const bytes = await exportBookPdfTypst({
        meta,
        blocks,
        settings,
        size: getSize(sizeId),
        margins,
        gutter,
        bleedMm,
        markOffsetMm: profile.markOffsetMm,
        cropMarks: cropOn,
      });
      const to = cropOn && bleedMm > 0 ? profile.markOffsetMm : bleedMm;
      const report = await preflightPdf(bytes, { sizeMm: getSize(sizeId), toMm: to, bleedMm });
      setPreflightReport(report);
    } catch (e) {
      const crash = e instanceof TypstCrashError ? e : null;
      if (crash) setTypstCrash(crash);
      setPreflightReport({
        items: [
          crash
            ? {
                level: "error",
                label: t.typstCrashTitle,
                detail: crash.panic ? `${t.typstCrashBody}\n\n${t.techNoteLabel} ${crash.panic}` : t.typstCrashBody,
              }
            : { level: "error", label: "Denetim başarısız", detail: String(e) },
        ],
        errorCount: 1,
        warnCount: 0,
        ready: false,
      });
    } finally {
      setPreflightRunning(false);
    }
  }, [blocks, meta, settings, sizeId, margins, gutter, cropMarks, standard, bleedOn, t]);

  // Export modu: yazı tipleri yüklenip sayfalama hazır olunca İç sayfa PDF'ini
  // bir kez otomatik indir (indirme ekranındaki tuştan gelindi). Metin
  // initialProject'ten SENKRON gelir (cover'ın aksine ağ beklemesi yok), ayrıca
  // pages.length>0 koşulu boş PDF'i engeller.
  useEffect(() => {
    if (!autoExport || autoExportFiredRef.current) return;
    // Aktif paket yoksa otomatik indirme HİÇ başlamaz (onay kutusu da açılmaz);
    // katman "paket gerekli" durumunu gösterir.
    if (!canExport) return;
    if (!fontsReady || pages.length === 0) return;
    autoExportFiredRef.current = true;
    if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
    void (async () => {
      const ok = await handleExportPdfTypst(); // varsayılan = gördüğün baskı sayfası
      setAutoExportStatus(ok ? "done" : "error");
})();
  }, [autoExport, canExport, fontsReady, pages.length, handleExportPdfTypst]);

  // SAFETY: yazı tipi/sayfalama asılı kalırsa overlay sonsuza dek "hazırlanıyor"
  // kalmasın → ~12 sn içinde tetiklenmediyse "error"a düş (elle "Tekrar dene").
  useEffect(() => {
    if (!autoExport || !canExport) return;
    autoExportSafetyRef.current = window.setTimeout(() => {
      if (autoExportFiredRef.current) return;
      autoExportFiredRef.current = true;
      setAutoExportStatus("error");
    }, 12000);
    return () => {
      if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
    };
  }, [autoExport, canExport]);

  // Sayfalama: cilt payı otomatikse iki geçişli hesap. Ölçüm tarayıcıda
  // (canvas measureText) yapılır → effect içinde.
  useEffect(() => {
    if (!fontsReady) return;
    if (!measureRef.current) measureRef.current = document.createElement("canvas");
    const ctx = measureRef.current.getContext("2d");
    if (!ctx) return;

    const run = (g: number): Page[] => {
      const geo = pageGeometry(size, margins, g, true);
      return paginate({
        meta,
        blocks,
        contentWidthMm: geo.contentWidth,
        contentHeightMm: geo.contentHeight,
        settings,
        ctx,
        dpi: PAGINATE_DPI,
        tocOverrides,
      });
    };

    let g = gutterAuto ? 0 : gutterManual;
    let result = run(g);
    if (gutterAuto) {
      // Cilt payı, seçili baskı standardına göre önerilir: KDY sayfa-sayısı
      // tablosu; KDP, etkin iç kenar minimumunu karşılayacak ek pay.
      const suggested = STANDARD_PROFILES[standard].gutterMm(result.length, margins.inside);
      if (suggested !== g) {
        g = suggested;
        result = run(g);
      }
    }
    setPages(result);
    setGutter(g);
  }, [fontsReady, meta, blocks, size, margins, settings, gutterAuto, gutterManual, standard, tocOverrides]);

  const stats = useMemo(() => {
    const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
    return { words, chars: raw.length };
  }, [raw]);

  const quality = useMemo(
    () =>
      buildQualityChecks({
        t,
        title,
        author,
        raw,
        blocks,
        pages,
        standard,
        margins,
        gutter,
        frontMatter,
        runningHeads,
        pageNumbers,
        hyphenate,
        lineBreak,
        contentWidthMm: pageGeometry(size, margins, gutter, true).contentWidth,
        contentHeightMm: pageGeometry(size, margins, gutter, true).contentHeight,
      }),
    [
      t,
      title,
      author,
      raw,
      blocks,
      pages,
      standard,
      size,
      margins,
      gutter,
      frontMatter,
      runningHeads,
      pageNumbers,
      hyphenate,
      lineBreak,
    ],
  );

  const applyPreset = useCallback((id: string) => {
    setPresetId(id);
    // Baskı standardı kimlikleri (kdy/kdp/ingram/bnpress/lulu) doğrudan o
    // profilin varsayılan kenar boşluklarını uygular.
    if (id in STANDARD_PROFILES) {
      setMargins({ ...STANDARD_PROFILES[id as PrintStandard].defaultMargins });
      return;
    }
    const p = MARGIN_PRESETS.find((x) => x.id === id);
    if (p) setMargins(p.margins);
  }, []);

  // Baskı standardını değiştir: o profilin boyut, kenar boşlukları, taşma ve
  // kesim işareti varsayılanlarını uygula. Cilt payı otomatiğe döner.
  const applyStandard = useCallback((id: PrintStandard) => {
    const p = STANDARD_PROFILES[id];
    setStandard(id);
    setSizeId(p.defaultSizeId);
    setMargins({ ...p.defaultMargins });
    setPresetId(id);
    setGutterAuto(true);
    setBleedOn(p.bleedDefaultOn);
    setCropMarks(p.cropMarksAllowed);
  }, []);

  const updateMargin = useCallback((key: keyof Margins, value: number) => {
    setPresetId("custom");
    setMargins((m) => ({ ...m, [key]: Math.max(0, value) }));
  }, []);

  const pxPerMm = BASE_PX_PER_MM * zoom;
  const renderDpi = pxPerMm * 25.4;
  const bodyFamily = familyOf(fontId);

  // Düzenlenen bloğun ilk göründüğü sayfa (editör yalnızca orada çizilir).
  const editingFirstPage = useMemo(() => {
    if (editingBlock == null) return null;
    for (const p of pages) {
      if (p.lines.some((l) => l.blockIndex === editingBlock)) return p.number;
    }
    return null;
  }, [pages, editingBlock]);
  const editingRuns: Run[] =
    editingBlock != null && blocks[editingBlock] && blocks[editingBlock].type !== "blank"
      ? (blocks[editingBlock] as Extract<Block, { runs: Run[] }>).runs
      : [];
  const editingBlockData =
    editingBlock != null && blocks[editingBlock] && blocks[editingBlock].type !== "blank"
      ? blocks[editingBlock]
      : null;
  // Düzenleme panelindeki editörün biçimi (okunur ölçek). Metin türünü yansıtır
  // (başlık daha büyük/kalın) ama her zaman RAHAT okunur boyutta — sayfa ölçeği değil.
  const editingLine = useMemo<Line | null>(() => {
    if (editingBlock == null) return null;
    const blk = blocks[editingBlock];
    if (
      !blk ||
      blk.type === "blank" ||
      blk.type === "image" ||
      blk.type === "table" ||
      blk.type === "pagebreak" ||
      blk.type === "spacer"
    )
      return null;
    const isHeading = blk.type === "heading";
    const sizePt = ("sizePt" in blk && blk.sizePt) || blockDefaultSizePt(blk, bodySizePt);
    return {
      segments: [],
      kind: isHeading ? "heading" : "body",
      sizePt,
      font: isHeading ? familyOf(headingFontId) : bodyFamily,
      weight: isHeading ? 700 : 400,
      italic: blk.type === "blockquote",
      align: "align" in blk && blk.align ? blk.align : "left",
      indentMm: 0,
      blockIndentMm: 0,
      justify: false,
      spaceBeforeMm: 0,
      heightMm: ((sizePt * 1.5) / 72) * 25.4,
      blockIndex: editingBlock,
    };
  }, [editingBlock, blocks, bodySizePt, headingFontId, bodyFamily]);
  // Düzenlenen bloğun okunur tür etiketi (panel başlığı).
  const editingTypeLabel = useMemo(() => {
    if (!editingBlockData) return "";
    switch (editingBlockData.type) {
      case "heading":
        return "Başlık";
      case "blockquote":
        return "Alıntı";
      default:
        return "Paragraf";
    }
  }, [editingBlockData]);

  const navItems: { id: PanelId; label: string; Icon: typeof TextTIcon }[] = [
    { id: "book", label: lang === "tr" ? "Kitap" : "Book", Icon: BookOpenIcon },
    { id: "text", label: lang === "tr" ? "Metin" : "Text", Icon: TextTIcon },
    { id: "page", label: lang === "tr" ? "Sayfa" : "Page", Icon: PageIcon },
    { id: "type", label: lang === "tr" ? "Yazı" : "Type", Icon: SlidersIcon },
    { id: "quality", label: lang === "tr" ? "Denetim" : "Check", Icon: CheckCircleIcon },
  ];

  const isEmpty = blocks.length === 0 && !title.trim();

  // İç tasarım konsepti ekranı: kitapta metin varsa ve üye henüz konsept
  // seçmediyse (ya da "şimdilik geç" demediyse) Mizanpaj'a girişte açılır.
  // İndirme/denetim/önizleme kısa yollarında açılmaz.
  const [conceptOpen, setConceptOpen] = useState(
    () =>
      !!projectId &&
      !autoExport &&
      !autoPreflight &&
      !startFocus &&
      !saved?.conceptId &&
      (seed?.manuscript.text ?? "").trim().length > 0,
  );
  const conceptBlocksFor = useCallback(
    (keep: boolean) =>
      sourceMode === "word" && importedBlocks
        ? importedBlocks
        : parseBlocks(raw, detectHeadings, importMedia, { keepLineBreaks: keep }),
    [sourceMode, importedBlocks, raw, detectHeadings, importMedia],
  );

  const tr = lang === "tr";
  const router = useRouter();
  const docTitle = title.trim() || (tr ? "Mizanpaj çalışması" : "Layout draft");
  const wizard = seed?.wizard;
  const wizardActive = !!wizard?.active && !autoExport;
  const wizardSteps: [string, string, boolean][] = wizard
    ? [
        ["editor", tr ? "AI Editör" : "AI Editor", wizard.editorCompleted],
        ["mizanpaj", tr ? "Mizanpaj" : "Layout", wizard.layoutCompleted],
        ["kapak", tr ? "Kapak" : "Cover", wizard.coverCompleted],
      ]
    : [];

  // Sağ panel başlığı (ikon + ad + kısa açıklama).
  const PANEL_META: Record<PanelId, { title: string; sub: string; Icon: typeof TextTIcon }> = {
    book: { title: tr ? "Kitap bilgileri" : "Book details", sub: tr ? "Ad, yazar, alt başlık ve künye." : "Title, author, subtitle and imprint.", Icon: BookOpenIcon },
    text: { title: tr ? "Metin" : "Text", sub: tr ? "Metni yaz, yapıştır ya da Word'den aktar." : "Type, paste or import from Word.", Icon: TextTIcon },
    page: { title: tr ? "Sayfa düzeni" : "Page setup", sub: tr ? "Baskı standardı, boyut ve kenar boşlukları." : "Print standard, size and margins.", Icon: PageIcon },
    type: { title: tr ? "Yazı düzeni" : "Typography", sub: tr ? "Yazı tipi, punto, satır aralığı ve dizgi kuralları." : "Font, size, leading and typesetting rules.", Icon: SlidersIcon },
    quality: { title: tr ? "Denetim" : "Check", sub: tr ? "Baskıya hazır mı? Eksikler ve öneriler." : "Ready to print? Gaps and tips.", Icon: CheckCircleIcon },
  };
  const panelMeta = PANEL_META[panel];
  const PanelIcon = panelMeta.Icon;

  // ── Önizleme görünümü: tek sayfa / karşılıklı / akış, sayfa gezinme ──
  const [viewMode, setViewMode] = useState<PreviewMode>("spread");
  const [cursorPage, setCursorPage] = useState(0); // 0-tabanlı sayfa (tek sayfa)
  const [viewZoom, setViewZoom] = useState(1);
  const [realPercent, setRealPercent] = useState(100);
  const [docPageCount, setDocPageCount] = useState(0);
  const [docPositions, setDocPositions] = useState<BlockPos[]>([]);
  const [showGuides, setShowGuides] = useState(true);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [wizardBusy, setWizardBusy] = useState(false);
  // AI Editör kontrolü arka planda sürüyorsa adım çipinde dönen gösterge.
  const editorJob = useEditorSession(projectId);
  // Gerçek kayıt durumu (yazıyor / kaydediliyor / kaydedildi / hata).
  const saveStatus = useSaveStatus();
  const finishWizard = async () => {
    if (!projectId || wizardBusy) return;
    setWizardBusy(true);
    try {
      await completeWizardStep(projectId, "layout");
    } catch {
      // kaydedilemese de ilerle
    }
    router.push(`/${lang}/kapak?project=${projectId}`);
  };
  // Açılım (karşılıklı) sırası: 0 = yalnız 1. sayfa (sağda), r = sayfa 2r ve 2r+1.
  const rowOfPage = (p: number) => (p <= 0 ? 0 : 1 + Math.floor((p - 1) / 2));
  const rowCount = docPageCount <= 0 ? 0 : 1 + Math.ceil((docPageCount - 1) / 2);
  // Kitap kısalınca imleç son sayfayı aşmasın (etiket ve oklar doğru kalsın).
  const curPage = docPageCount > 0 ? Math.min(cursorPage, docPageCount - 1) : 0;
  const cursorRow = rowOfPage(curPage);
  const goToPage = useCallback(
    (p: number) => {
      setCursorPage(Math.max(0, Math.min(p, Math.max(0, docPageCount - 1))));
      setViewMode((m) => (m === "flow" ? "spread" : m));
    },
    [docPageCount],
  );
  const stepPage = useCallback(
    (dir: 1 | -1) => {
      if (viewMode === "spread") {
        const r = Math.max(0, Math.min(rowCount - 1, cursorRow + dir));
        setCursorPage(r === 0 ? 0 : 2 * r - 1);
      } else {
        setCursorPage(Math.max(0, Math.min(docPageCount - 1, curPage + dir)));
      }
    },
    [viewMode, rowCount, cursorRow, docPageCount, curPage],
  );
  const canPrev = viewMode === "spread" ? cursorRow > 0 : curPage > 0;
  const canNext = viewMode === "spread" ? cursorRow < rowCount - 1 : curPage < docPageCount - 1;
  const pageLabel =
    viewMode === "spread"
      ? cursorRow === 0
        ? "1"
        : 2 * cursorRow + 1 <= docPageCount
          ? `${2 * cursorRow}–${2 * cursorRow + 1}`
          : `${2 * cursorRow}`
      : `${curPage + 1}`;
  const changeViewMode = (m: PreviewMode) => setViewMode(m);
  const VIEW_ZOOM = [1, 1.25, 1.5, 2, 2.5, 3];
  const zoomBy = (dir: 1 | -1) => {
    if (previewEngine === "typst") {
      const i = VIEW_ZOOM.findIndex((v) => v >= viewZoom - 1e-6);
      const cur = i === -1 ? VIEW_ZOOM.length - 1 : i;
      setViewZoom(VIEW_ZOOM[Math.max(0, Math.min(VIEW_ZOOM.length - 1, cur + dir))]);
    } else {
      const opts = ZOOM_OPTIONS as readonly number[];
      const i = opts.findIndex((v) => v >= zoom - 1e-6);
      const cur = i === -1 ? opts.length - 1 : i;
      setZoom(opts[Math.max(0, Math.min(opts.length - 1, cur + dir))]);
    }
  };
  const handleDocInfo = useCallback((info: { pageCount: number; positions: BlockPos[] }) => {
    setDocPageCount(info.pageCount);
    setDocPositions(info.positions);
  }, []);
  const handleViewInfo = useCallback((info: { realPercent: number }) => {
    setRealPercent(info.realPercent);
  }, []);
  // Bölümler: 1. düzey başlıklar ve Typst'in yerleştirdiği sayfaları.
  const chapterNav = useMemo(() => {
    const out: { idx: number; title: string; page: number }[] = [];
    blocks.forEach((b, i) => {
      if (b.type !== "heading" || b.level !== 1) return;
      const pos = docPositions.find((p) => p.idx === i);
      if (pos) out.push({ idx: i, title: b.runs.map((r) => r.text).join("").trim(), page: pos.page });
    });
    return out;
  }, [blocks, docPositions]);
  // Kenar boşluğu kılavuzu (sayfa kesri). İç kenara cilt payı eklenir.
  const pageGuides = useMemo(
    () => ({
      top: margins.top / size.height,
      bottom: margins.bottom / size.height,
      inside: (margins.inside + gutter) / size.width,
      outside: margins.outside / size.width,
    }),
    [margins, gutter, size.width, size.height],
  );
  // ← / → ile sayfa çevir (yazı yazarken değil).
  const stepPageRef = useRef(stepPage);
  useEffect(() => {
    stepPageRef.current = stepPage;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      stepPageRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // İndirme ekranındaki "Baskı kontrolü": sayfalar hazır olunca denetimi bir kez
  // kendiliğinden çalıştır (rapor penceresi açılır) ve Denetim panelini göster.
  const autoPreflightFiredRef = useRef(false);
  useEffect(() => {
    if (!autoPreflight || autoPreflightFiredRef.current) return;
    if (blocks.length === 0 || docPageCount === 0) return;
    autoPreflightFiredRef.current = true;
    const id = window.setTimeout(() => {
      setPanel("quality");
      void handlePreflight();
    }, 0);
    return () => window.clearTimeout(id);
  }, [autoPreflight, blocks.length, docPageCount, handlePreflight]);

  // "Tüm kitaba uygula": paragraf paragraf verilmiş yazı tipi/punto ayarlarını
  // kaldırır → paneldeki ayar kitabın HER yerinde geçerli olur (geri alınabilir).
  const applyToWholeBook = useCallback(() => {
    const isOverride = (b: Block) =>
      (b.type === "paragraph" || b.type === "heading" || b.type === "blockquote") && (!!b.fontFamily || !!b.sizePt);
    const count = blocks.filter(isOverride).length;
    if (count === 0) {
      flashNote(tr ? "Tüm kitap zaten bu ayarlarla dizili." : "The whole book already uses these settings.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        tr
          ? `${count} paragrafta ayrıca seçilmiş yazı tipi/punto var. Hepsi kaldırılıp bu ayarlar tüm kitaba uygulansın mı? (Geri alınabilir.)`
          : `${count} paragraphs have their own font/size. Remove them and apply these settings to the whole book? (Can be undone.)`,
      )
    )
      return;
    markStep(tr ? "Tüm kitaba uygula" : "Apply to whole book");
    applyLayout(
      blocks.map((b) =>
        b.type === "paragraph" || b.type === "heading" || b.type === "blockquote"
          ? { ...b, fontFamily: undefined, sizePt: undefined }
          : b,
      ),
    );
  }, [blocks, applyLayout, markStep, flashNote, tr]);

  // İçindekiler başlıklarını elle düzeltme (Yazı → Gelişmiş).
  const tocEditor = (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.tocEditHeading}</h3>
      <p className="text-xs text-muted">{t.tocEditHint}</p>
      <div className="space-y-2">
        {chapterTitles.map((orig, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right font-mono text-xs text-muted">{i + 1}</span>
            <input
              type="text"
              value={tocOverrides[i] ?? ""}
              placeholder={orig || t.tocEntryPlaceholder}
              onChange={(e) => {
                const v = e.target.value;
                setTocOverrides((prev) => {
                  const next = { ...prev };
                  if (v.trim() === "") delete next[i];
                  else next[i] = v;
                  return next;
                });
              }}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={`flex w-full flex-col bg-background ${
        focusMode ? "fixed inset-0 z-[70] h-dvh overflow-hidden" : "h-dvh overflow-y-auto lg:overflow-hidden"
      }`}
    >
      {conceptOpen && (
        <InteriorConceptPicker
          lang={lang}
          genre={seed?.meta.genre}
          baseInput={typstInput}
          blocksFor={conceptBlocksFor}
          familyOf={familyOf}
          currentConceptId={conceptId && conceptId !== "skip" ? conceptId : undefined}
          currentDetails={{ ornamentKind, tocStyle, bibStyle }}
          firstTime={!conceptId}
          onApply={(k, adj, det) => {
            applyConcept(k, adj, det);
            setConceptOpen(false);
          }}
          onSkip={() => {
            setConceptId("skip");
            setConceptOpen(false);
          }}
          onClose={() => setConceptOpen(false)}
        />
      )}
      {autoExport && (
        <ExportOverlay
          lang={lang}
          kind="ic"
          status={canExport ? autoExportStatus : "locked"}
          backHref={projectId ? `/${lang}/indir?project=${projectId}` : `/${lang}/projeler`}
          onDownload={() => void handleExportPdfTypst()}
          // "Tüm dosyaları indir": iç sayfa inince kapağa TEK TIKLA geç (tarayıcı,
          // tıklamasız ikinci otomatik indirmeyi engelleyebiliyor).
          next={exportThenHref ? { href: exportThenHref, label: lang === "tr" ? "Sıradaki: Kapak PDF'ini indir →" : "Next: download the cover PDF →" } : undefined}
        />
      )}
      {preflightReport && (
        <PreflightDialog
          report={preflightReport}
          onClose={() => setPreflightReport(null)}
          reloadLabel={typstCrash ? t.reloadCta : undefined}
        />
      )}

      {/* ── Üst çubuk ── */}
      {!focusMode && (
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
            <span className="hidden 2xl:inline">{tr ? "Kitaplarım" : "My books"}</span>
          </Link>
          <span className="hidden h-7 w-px shrink-0 bg-border md:block" />
          <span
            className="hidden h-8 w-8 shrink-0 rounded-lg sm:block"
            style={{ background: "linear-gradient(135deg, var(--color-accent), #7c3aed)" }}
            aria-hidden="true"
          />
          <span className="min-w-[6rem] truncate text-base font-semibold text-foreground" title={docTitle}>
            {docTitle}
          </span>
          {projectId && (
            <span
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm ${saveStatus?.state === "error" ? "font-semibold text-red-600" : "text-muted"}`}
              role="status"
              title={saveStatus?.state === "saved" && saveStatus.savedAt ? formatSavedTime(saveStatus.savedAt, lang) : undefined}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  saveStatus?.state === "error"
                    ? "bg-red-500"
                    : saveStatus?.state === "dirty" || saveStatus?.state === "saving"
                      ? "bg-amber-400"
                      : "bg-emerald-500"
                }`}
              />
              <span className={saveStatus?.state === "error" ? "" : "hidden 2xl:inline"}>
                {saveStatus ? SAVE_LABELS[lang][saveStatus.state] : tr ? "Kaydedildi" : "Saved"}
              </span>
            </span>
          )}

          {wizardActive && wizard && projectId && (
            <nav className="ml-2 hidden shrink-0 items-center gap-1 2xl:flex" aria-label={tr ? "Adımlar" : "Steps"}>
              {wizardSteps.map(([seg, label, done], i) => (
                <Link
                  key={seg}
                  href={`/${lang}/${seg}?project=${projectId}`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    seg === "mizanpaj" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  {seg === "editor" && editorJob.running !== null ? (
                    <span
                      className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
                      title={tr ? "AI Editör kontrolü arka planda sürüyor" : "AI Editor check running"}
                    />
                  ) : (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        done ? "bg-emerald-600 text-white" : seg === "mizanpaj" ? "bg-accent text-white" : "border border-border"
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
            <div className="relative shrink-0 2xl:hidden">
              <button
                type="button"
                onClick={() => setStepsOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={stepsOpen}
                className="flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {tr ? "Adım 2/3" : "Step 2/3"} <span aria-hidden="true">▾</span>
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
                        <span className="w-4 text-center text-xs">
                          {seg === "editor" && editorJob.running !== null ? "…" : done ? "✓" : i + 1}
                        </span>
                        {label}
                        {seg === "editor" && editorJob.running !== null && (
                          <span className="ml-auto text-xs text-accent">{tr ? "sürüyor" : "running"}</span>
                        )}
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
            onClick={handleUndo}
            disabled={!history.canUndo && editingBlock == null}
            title={
              history.undoLabel
                ? t.undoTip.replace("{label}", history.undoLabel)
                : editingBlock != null
                  ? t.undoTipOpen
                  : t.undoTipEmpty
            }
            aria-label={t.undoCta}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!history.canRedo}
            title={history.redoLabel ? t.redoTip.replace("{label}", history.redoLabel) : t.redoTipEmpty}
            aria-label={t.redoCta}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition hover:bg-accent-soft hover:text-foreground disabled:opacity-30 sm:flex"
          >
            <ArrowUUpRightIcon className="h-5 w-5" />
          </button>
          <span className="hidden h-7 w-px shrink-0 bg-border sm:block" />
          <button
            type="button"
            onClick={() => void handlePreflight()}
            disabled={preflightRunning || blocks.length === 0}
            title={tr ? "Üretilen PDF'i baskı kurallarına göre denetle (sayfa boyutu, kesim kutusu, yazı tipi gömme…)" : "Check the PDF against print rules"}
            className="hidden shrink-0 whitespace-nowrap rounded-xl border border-accent/50 px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 xl:block"
          >
            {preflightRunning ? (tr ? "Denetleniyor…" : "Checking…") : tr ? "Baskı denetimi" : "Print check"}
          </button>
          {/* PDF indir ▾ — PDF (gördüğün motorla birebir), IDML ve çıktı ayarları */}
          <div className="relative shrink-0">
            <div className="flex overflow-hidden rounded-xl bg-accent text-white shadow-sm">
              <button
                type="button"
                onClick={() => void (previewEngine === "typst" ? handleExportPdfTypst() : handleExportPdf())}
                disabled={exporting || isEmpty || blocks.length === 0}
                title={standard === "kdy" ? t.exportHint : standard === "ingram" ? t.exportHintIngram : t.exportHintKdp}
                className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? t.exportingLabel : tr ? "PDF indir" : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={() => setViewMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={viewMenuOpen}
                aria-label={tr ? "İndirme seçenekleri" : "Download options"}
                className="border-l border-white/25 px-2.5 transition hover:bg-white/10"
              >
                <CaretDownIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            {viewMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setViewMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-full z-40 mt-2 flex w-72 flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMenuOpen(false);
                      void handlePreflight();
                    }}
                    disabled={preflightRunning || blocks.length === 0}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 xl:hidden"
                  >
                    {tr ? "Baskı denetimi" : "Print check"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMenuOpen(false);
                      void handleExportIdml();
                    }}
                    disabled={exporting || isEmpty || blocks.length === 0}
                    title={t.exportIdmlHint}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.exportIdmlCta}
                  </button>
                  <div className="flex items-center justify-between gap-2 text-sm text-muted">
                    {t.engineLabel}
                    <div
                      className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
                      title={tr ? "Typst: gerçek baskı sayfası (ne görürsen o basılır). Hızlı: yaklaşık yedek önizleme." : "Typst: the real print page. Fast: approximate preview."}
                    >
                      <button
                        type="button"
                        onClick={() => pickEngine("typst")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${previewEngine === "typst" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"}`}
                      >
                        Typst
                      </button>
                      <button
                        type="button"
                        onClick={() => pickEngine("js")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${previewEngine === "js" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"}`}
                      >
                        {tr ? "Hızlı" : "Fast"}
                      </button>
                    </div>
                  </div>
                  {standard === "kdy" ? (
                    <label className="flex items-center gap-2 text-sm text-foreground/80" title={t.cropMarksLabel}>
                      <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                      {t.cropMarksLabel}
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 text-sm text-foreground/80" title={t.bleedHint}>
                      <input type="checkbox" checked={bleedOn} onChange={(e) => setBleedOn(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                      {t.bleedLabel}
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
          {wizardActive && projectId && (
            <button
              type="button"
              onClick={() => void finishWizard()}
              disabled={wizardBusy}
              title={tr ? "Mizanpajı tamamla ve kapağa geç" : "Finish layout and go to the cover"}
              className="shrink-0 whitespace-nowrap rounded-xl border border-emerald-600/40 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
            >
              <span className="hidden sm:inline">{tr ? "Tamamla →" : "Finish →"}</span>
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
                <button type="button" aria-label="×" className="fixed inset-0 z-30 cursor-default" onClick={() => setAccountOpen(false)} />
                <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
                  {user?.name && <div className="truncate px-4 py-2 text-sm font-semibold text-foreground">{user.name}</div>}
                  <Link href={`/${lang}/projeler`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {tr ? "Kitaplarım" : "My books"}
                  </Link>
                  <Link href={`/${lang}/jetonlar`} className="block px-4 py-2.5 text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                    {tr ? "Jetonlarım" : "My credits"}
                  </Link>
                  {signOut && (
                    <form action={signOut} className="border-t border-border">
                      <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent">
                        {tr ? "Çıkış yap" : "Sign out"}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── Sol araç şeridi ── */}
        {!focusMode && (
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 lg:w-[92px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:px-2 lg:py-3">
            <button
              type="button"
              onClick={() => setConceptOpen(true)}
              title={tr ? "İç tasarım konsepti: kitabın türüne göre hazır sayfa düzenleri" : "Interior design concept: ready-made page designs for your genre"}
              className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium text-foreground/70 transition hover:bg-background hover:text-foreground lg:w-full lg:border-b lg:border-border lg:pb-4 [@media(max-height:820px)]:py-2"
            >
              <PaletteIcon className="h-6 w-6 text-accent" />
              {tr ? "Konsept" : "Concept"}
            </button>
            {navItems.map(({ id, label, Icon }) => {
              const active = panel === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPanel(id);
                    if (!sidePanelOpen) toggleSidePanel();
                  }}
                  aria-pressed={active}
                  className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium transition lg:w-full [@media(max-height:820px)]:py-2 ${
                    active ? "bg-accent-soft text-accent" : "text-foreground/70 hover:bg-background hover:text-foreground"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setPanel("text");
                setSourceMode("word");
                if (!sidePanelOpen) toggleSidePanel();
              }}
              className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium text-foreground/70 transition hover:bg-background hover:text-foreground lg:mt-auto lg:w-full lg:border-t lg:border-border lg:pt-4 [@media(max-height:820px)]:py-2"
            >
              <DownloadSimpleIcon className="h-6 w-6" />
              {tr ? "İçe aktar" : "Import"}
            </button>
          </nav>
        )}

        {/* ── Önizleme ── */}
        <section className="flex min-h-[60vh] min-w-0 flex-1 flex-col p-2 lg:min-h-0 lg:p-3">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-2.5 py-1.5 sm:gap-3 sm:px-3">
              {previewEngine === "typst" && (
                <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label={tr ? "Görünüm" : "View"}>
                  {(
                    [
                      ["single", tr ? "Tek sayfa" : "Single"],
                      ["spread", tr ? "Karşılıklı" : "Spread"],
                      ["flow", tr ? "Akış" : "Flow"],
                    ] as [PreviewMode, string][]
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => changeViewMode(v)}
                      aria-pressed={viewMode === v}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        viewMode === v ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1" />
              <span className="whitespace-nowrap text-sm text-muted">
                {previewEngine === "typst" && docPageCount === 0 && !isEmpty ? "…" : (previewEngine === "typst" ? docPageCount : pages.length) || 0}{" "}
                {tr ? "sayfa" : "pages"}
              </span>
              {!isEmpty && (
                <button
                  type="button"
                  onClick={() => {
                    setPanel("quality");
                    if (!sidePanelOpen) toggleSidePanel();
                  }}
                  title={t.qualityScoreLabel}
                  className={`hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${
                    quality.errorCount > 0
                      ? "bg-red-50 text-red-700"
                      : quality.warningCount > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {t.qualityScoreLabel} {quality.score}
                </button>
              )}
              {previewEngine === "typst" && (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground/80" title={tr ? "Kenar boşluklarını kesikli çizgiyle göster (baskıya girmez)" : "Show margins as dashed lines (not printed)"}>
                  <span className="relative inline-flex">
                    <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} className="peer sr-only" />
                    <span className="h-6 w-11 rounded-full bg-foreground/25 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </span>
                  {tr ? "Kılavuzlar" : "Guides"}
                </label>
              )}
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                title={focusMode ? t.focusExitTip : t.focusTip}
                className={`flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold transition ${
                  focusMode ? "bg-accent text-white hover:opacity-90" : "text-foreground/70 hover:bg-accent-soft hover:text-foreground"
                }`}
              >
                <ArrowsOutIcon className="h-5 w-5" />
                {focusMode && (tr ? "Büyük görünümü kapat" : "Close big view")}
              </button>
            </div>
            {exportError && !typstCrash && (
              <div className="border-b border-border bg-red-50 px-4 py-2 text-xs text-red-700">
                {t.exportErrorLabel}
              </div>
            )}
            {typstCrash && (
              <div className="flex items-start justify-between gap-3 border-b border-border bg-red-50 px-4 py-2 text-xs text-red-700">
                <div className="min-w-0">
                  <span className="font-semibold">{t.typstCrashTitle}.</span> {t.typstCrashBody}
                  {typstCrash.panic && (
                    <span className="mt-1 block break-words font-mono text-[10px] text-red-600/80">
                      {t.techNoteLabel} {typstCrash.panic}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 font-semibold text-white transition hover:bg-red-700"
                >
                  {t.reloadCta}
                </button>
              </div>
            )}
            {!isEmpty && !imprintNoteHidden && (
              <div className="flex items-center justify-between gap-3 border-b border-border bg-accent-soft/40 px-4 py-1.5 text-xs text-muted">
                <span>{standard === "kdy" ? t.imprintNote : t.imprintNoteKdp}</span>
                <button
                  onClick={dismissImprintNote}
                  title="Bu notu gizle"
                  className="shrink-0 rounded px-1.5 text-sm leading-none text-muted transition hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}


            {historyNote && (
              <div role="status" className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background shadow">
                {historyNote}
              </div>
            )}
            <div className={`relative min-h-0 flex-1 ${previewEngine === "typst" || isEmpty ? "overflow-hidden" : "overflow-auto px-4 py-3"}`}>
              {isEmpty ? (
                <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted">
                  {t.emptyPreview}
                </div>
              ) : previewEngine === "typst" && conceptOpen ? (
                // Konsept ekranı açıkken tüm kitabı derleme: tek Typst işçisi önce
                // konsept önizlemelerini hazırlasın (büyük kitapta saniyeler sürerdi).
                <div className="flex h-full items-center justify-center p-6 text-sm text-muted">
                  {tr ? "Konsept seçiliyor…" : "Choosing a concept…"}
                </div>
              ) : previewEngine === "typst" ? (
                <TypstPreviewCanvas
                  input={typstInput}
                  editingBlock={editingBlock}
                  onSelectBlock={startEditBlock}
                  onError={handleTypstPreviewError}
                  mode={viewMode}
                  zoom={viewZoom}
                  cursor={viewMode === "spread" ? cursorRow : curPage}
                  guides={showGuides ? pageGuides : null}
                  pageWidthMm={size.width}
                  onDocInfo={handleDocInfo}
                  onViewInfo={handleViewInfo}
                />
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {/* Kalıcı uyarı: Hızlı mod YAKLAŞIKTIR — "önizleme = baskı" yalnız
                      Typst'te geçerli. Kullanıcı bunu bilmeden baskı kararı vermesin. */}
                  <div className="sticky top-0 z-10 w-full max-w-[720px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                    {tr
                                            ? "Yaklaşık önizleme (Hızlı mod) — satır sonları baskıdan farklı olabilir. PDF her zaman Typst ile üretilir."
                                            : "Approximate preview (Fast mode) — line breaks may differ from print. The PDF is always made with Typst."}{" "}
                                          <button type="button" onClick={() => pickEngine("typst")} className="pointer-events-auto font-semibold underline">
                                            {tr ? "Baskı görünümüne dön" : "Back to print view"}
                                          </button>
                  </div>
                  {(() => {
                    // Karşılıklı sayfa (facing) düzeni: 1. sayfa tek başına SAĞDA
                    // (recto); sonra çift(verso=sol) | tek(recto=sağ) ikilileri. Böylece
                    // iç marjlar cilt boşluğunda karşı karşıya gelir — gerçek açık kitap
                    // gibi — ve aynalı marjlar doğru tarafta görünür.
                    const renderPage = (page: Page) => (
                      <PagePreview
                        key={page.number}
                        page={page}
                        size={size}
                        margins={margins}
                        gutter={gutter}
                        pxPerMm={pxPerMm}
                        renderDpi={renderDpi}
                        bodyFamily={bodyFamily}
                        roleLabel={roleLabelOf(page.role, t)}
                        editingBlock={editingBlock}
                        showEditor={page.number === editingFirstPage}
                        editingRuns={editingRuns}
                        editorApiRef={editorApiRef}
                        onStartEdit={startEditBlock}
                        onCommitFinal={commitBlockFinal}
                        onCommitDraft={commitBlockDraft}
                        onEndEdit={() => setEditingBlock(null)}
                        onSelection={setSelFmt}
                      />
                    );
                    const blank = (key: string) => (
                      <div key={key} aria-hidden style={{ width: size.width * pxPerMm, height: size.height * pxPerMm }} />
                    );
                    // İlk sayfa hariç kalanları (verso,recto) ikililerine ayır.
                    const pairs: (Page | undefined)[][] = [];
                    for (let i = 1; i < pages.length; i += 2) pairs.push([pages[i], pages[i + 1]]);
                    return (
                      <>
                        <div className="flex items-start justify-center gap-0">
                          {blank("blank-0")}
                          {pages[0] && renderPage(pages[0])}
                        </div>
                        {pairs.map(([l, r], idx) => (
                          <div key={`spread-${idx}`} className="flex items-start justify-center gap-0">
                            {l ? renderPage(l) : blank(`bl-${idx}`)}
                            {r ? renderPage(r) : blank(`br-${idx}`)}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Düzenleme paneli — sayfaya tıklayınca altta açılır. Metin OKUNUR boyutta
                ve panel kendi içinde kaydırılır → uzun paragraflar da rahat düzenlenir
                (sayfanın küçültülmüş ölçeğine sıkışmaz). Sayfa yukarıda görünür kalır. */}
            {editingBlockData && editingLine && (
              <div className="shrink-0 border-t border-border bg-surface shadow-[0_-6px_24px_rgba(0,0,0,0.07)]">
                <FormatBar
                  t={t}
                  typeLabel={editingTypeLabel}
                  selBold={selFmt.bold}
                  selItalic={selFmt.italic}
                  fontId={
                    editingBlockData.type === "paragraph" || editingBlockData.type === "heading" || editingBlockData.type === "blockquote"
                      ? editingBlockData.fontFamily
                        ? idOfFamily(editingBlockData.fontFamily)
                        : blockDefaultFontId(editingBlockData, fontId, headingFontId)
                      : fontId
                  }
                  sizePt={
                    editingBlockData.type === "paragraph" || editingBlockData.type === "heading" || editingBlockData.type === "blockquote"
                      ? (editingBlockData.sizePt ?? blockDefaultSizePt(editingBlockData, bodySizePt))
                      : bodySizePt
                  }
                  onFontId={(id) => setBlockFont(familyOf(id))}
                  onSizePt={(pt) => setBlockSize(pt)}
                  onToggleBold={toggleSelBold}
                  onToggleItalic={toggleSelItalic}
                  onSendNextPage={() => editingBlock != null && sendBlockToNextPage(editingBlock)}
                  onAddSpace={() => editingBlock != null && addSpaceAfterBlock(editingBlock)}
                  onPullPrevPage={() => editingBlock != null && pullBlockToPrevPage(editingBlock)}
                  canPullPrev={editingBlock != null && editingBlock > 0 && blocks[editingBlock - 1]?.type === "pagebreak"}
                  onCancel={() => setEditingBlock(null)}
                  onClose={() => editorApiRef.current?.commit()}
                />
                <div className="max-h-[42vh] overflow-y-auto px-5 py-4">
                  <div className="mx-auto max-w-[680px] text-[#1a1a1a]">
                    <RichBlockEditor
                      key={editingBlock}
                      line={editingLine}
                      pxPerMm={READ_PXPERMM}
                      renderDpi={READ_DPI}
                      initialRuns={editingRuns}
                      apiRef={editorApiRef}
                      onCommitFinal={(runs) => editingBlock != null && commitBlockFinal(editingBlock, runs)}
                      onCommitDraft={(runs) => editingBlock != null && commitBlockDraft(editingBlock, runs)}
                      onEnd={() => setEditingBlock(null)}
                      onCancel={() => setEditingBlock(null)}
                      onSelection={setSelFmt}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Alt şerit: ölçü · bölümler · sayfa gezinme · yakınlaştırma */}
            {!isEmpty && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-3 py-2 sm:gap-3">
                <span className="hidden whitespace-nowrap text-sm text-muted md:inline">
                  {size.width} × {size.height} mm
                </span>
                {previewEngine === "typst" && chapterNav.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setChaptersOpen((o) => !o)}
                      aria-haspopup="menu"
                      aria-expanded={chaptersOpen}
                      className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground/80 transition hover:border-accent/40 hover:text-foreground"
                    >
                      <span aria-hidden="true">☰</span>
                      {tr ? "Bölümler" : "Chapters"}
                      <CaretDownIcon className="h-3 w-3" />
                    </button>
                    {chaptersOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setChaptersOpen(false)} />
                        <div role="menu" className="absolute bottom-full left-0 z-40 mb-2 max-h-[50vh] w-72 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-xl">
                          {chapterNav.map((c, i) => (
                            <button
                              key={`${c.idx}-${i}`}
                              type="button"
                              onClick={() => {
                                setChaptersOpen(false);
                                goToPage(c.page - 1);
                              }}
                              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-foreground/80 hover:bg-accent-soft hover:text-accent"
                            >
                              <span className="truncate">{c.title || `${tr ? "Bölüm" : "Chapter"} ${i + 1}`}</span>
                              <span className="shrink-0 text-xs text-muted">{c.page}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="flex-1" />
                {previewEngine === "typst" && viewMode !== "flow" && docPageCount > 0 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepPage(-1)}
                      disabled={!canPrev}
                      aria-label={tr ? "Önceki" : "Previous"}
                      title={tr ? "Önceki (←)" : "Previous (←)"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                    >
                      ‹
                    </button>
                    <span className="min-w-[5.5rem] text-center text-sm font-semibold tabular-nums text-foreground">
                      {pageLabel} / {docPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepPage(1)}
                      disabled={!canNext}
                      aria-label={tr ? "Sonraki" : "Next"}
                      title={tr ? "Sonraki (→)" : "Next (→)"}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-lg text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                    >
                      ›
                    </button>
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-0.5 rounded-xl border border-border bg-surface px-1 py-0.5" role="group" aria-label={tr ? "Yakınlaştırma" : "Zoom"}>
                  <button
                    type="button"
                    onClick={() => zoomBy(-1)}
                    disabled={previewEngine === "typst" ? viewZoom <= VIEW_ZOOM[0] : zoom <= ZOOM_OPTIONS[0]}
                    aria-label={tr ? "Küçült" : "Zoom out"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-foreground" aria-live="polite">
                    {previewEngine === "typst" ? `${realPercent}%` : `${Math.round(zoom * 100)}%`}
                  </span>
                  <button
                    type="button"
                    onClick={() => zoomBy(1)}
                    disabled={previewEngine === "typst" ? viewZoom >= VIEW_ZOOM[VIEW_ZOOM.length - 1] : zoom >= ZOOM_OPTIONS[ZOOM_OPTIONS.length - 1]}
                    aria-label={tr ? "Büyüt" : "Zoom in"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-foreground/80 transition hover:bg-accent-soft disabled:opacity-30"
                  >
                    +
                  </button>
                  <span className="mx-1 h-6 w-px bg-border" />
                  <button
                    type="button"
                    onClick={() => (previewEngine === "typst" ? setViewZoom(1) : setZoom(1))}
                    title={tr ? "Ekrana sığdır" : "Fit to screen"}
                    className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium text-foreground/80 transition hover:bg-accent-soft"
                  >
                    <ArrowsOutIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tr ? "Ekrana sığdır" : "Fit to screen"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Sağ panel ── */}
        {!focusMode && (
          <aside
            className={`flex shrink-0 flex-col border-t border-border bg-surface lg:min-h-0 lg:border-l lg:border-t-0 ${
              sidePanelOpen ? "lg:w-[380px]" : "lg:w-14"
            }`}
          >
            {sidePanelOpen ? (
              <>
                <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4">
                  <button
                    type="button"
                    onClick={toggleSidePanel}
                    title={t.hidePanelTip}
                    aria-label={t.hidePanelTip}
                    className="-ml-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/70 transition hover:bg-accent-soft hover:text-foreground lg:flex"
                  >
                    ›
                  </button>
                  <PanelIcon className="mt-1 h-6 w-6 shrink-0 text-accent" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight text-foreground">{panelMeta.title}</h2>
                    <p className="mt-0.5 text-sm text-muted">{panelMeta.sub}</p>
                  </div>
                </div>
                <div key={panel} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 max-lg:max-h-[70vh] [&_h2]:sr-only">
                  {panel === "book" && (
                    <BookPanel
                      t={t}
                      title={title}
                      setTitle={setTitle}
                      author={author}
                      setAuthor={setAuthor}
                      subtitle={subtitle}
                      setSubtitle={setSubtitle}
                      publisher={publisher}
                      setPublisher={setPublisher}
                      bio={bio}
                      setBio={setBio}
                    />
                  )}
                  {panel === "text" && (
                    <TextPanel
                      t={t}
                      raw={raw}
                      setRaw={(v) => {
                        history.typing(t.stepTyping);
                        setRaw(v);
                      }}
                      stats={stats}
                      onSample={() => {
                        markStep(t.stepSample);
                        setRaw(SAMPLE_TR);
                      }}
                      onClear={() => {
                        markStep(t.stepClear);
                        setRaw("");
                      }}
                      sourceMode={sourceMode}
                      setSourceMode={setSourceMode}
                      docxMode={docxMode}
                      setDocxMode={setDocxMode}
                      importing={importing}
                      importInfo={importInfo}
                      importError={importError}
                      onImport={handleImport}
                      onClearImport={clearImport}
                    />
                  )}
                  {panel === "page" && (
                    <PagePanel
                      t={t}
                      standard={standard}
                      applyStandard={applyStandard}
                      sizeId={sizeId}
                      setSizeId={setSizeId}
                      presetId={presetId}
                      applyPreset={applyPreset}
                      margins={margins}
                      updateMargin={updateMargin}
                      gutterAuto={gutterAuto}
                      setGutterAuto={setGutterAuto}
                      gutterManual={gutterManual}
                      setGutterManual={setGutterManual}
                      gutter={gutter}
                    />
                  )}
                  {panel === "type" && (
                    <TypeLayoutPanel
                      t={t}
                      lang={lang}
                      fontId={fontId}
                      setFontId={setFontId}
                      bodySizePt={bodySizePt}
                      setBodySizePt={setBodySizePt}
                      leadingPt={leadingPt}
                      setLeadingPt={setLeadingPt}
                      align={align}
                      setAlign={setAlign}
                      indentMm={indentMm}
                      setIndentMm={setIndentMm}
                      paragraphSpacingMm={paragraphSpacingMm}
                      setParagraphSpacingMm={setParagraphSpacingMm}
                      headingFontId={headingFontId}
                      setHeadingFontId={setHeadingFontId}
                      detectHeadings={detectHeadings}
                      setDetectHeadings={setDetectHeadings}
                      chapterRight={chapterRight}
                      setChapterRight={setChapterRight}
                      frontMatter={frontMatter}
                      setFrontMatter={setFrontMatter}
                      runningHeads={runningHeads}
                      setRunningHeads={setRunningHeads}
                      pageNumbers={pageNumbers}
                      setPageNumbers={setPageNumbers}
                      hyphenate={hyphenate}
                      setHyphenate={setHyphenate}
                      dropCap={dropCap}
                      setDropCap={setDropCap}
                      lineBreak={lineBreak}
                      setLineBreak={setLineBreak}
                      widowControl={widowControl}
                      setWidowControl={setWidowControl}
                      opticalMargins={opticalMargins}
                      setOpticalMargins={setOpticalMargins}
                      kerning={kerning}
                      setKerning={setKerning}
                      themePicker={<ThemePicker t={t} lang={lang} themeId={themeId} onApply={applyTheme} />}
                      tocEditor={frontMatter && chapterTitles.length > 0 ? tocEditor : null}
                      onApplyAll={applyToWholeBook}
                      detailsPanel={
                        <ConceptDetailsControls
                          lang={lang}
                          values={{ chapterStyle, chapterOrnament, ornamentKind, sceneBreak, subheadStyle, quoteStyle, tocStyle, bibStyle, runningHeadStyle, folioPosition, chapterNewPage, firstWordsCaps, keepLineBreaks }}
                          set={{ setChapterStyle, setChapterOrnament, setOrnamentKind, setSceneBreak, setSubheadStyle, setQuoteStyle, setTocStyle, setBibStyle, setRunningHeadStyle, setFolioPosition, setChapterNewPage, setFirstWordsCaps, setKeepLineBreaks }}
                          onConcept={() => setConceptOpen(true)}
                        />
                      }
                    />
                  )}
                  {panel === "quality" && (
                    <QualityPanel
                      t={t}
                      score={quality.score}
                      checks={quality.checks}
                      errorCount={quality.errorCount}
                      warningCount={quality.warningCount}
                      successCount={quality.successCount}
                    />
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleSidePanel}
                title={t.showPanelTip}
                className="hidden h-full flex-col items-center gap-3 px-2 py-4 text-foreground/70 transition hover:bg-accent-soft hover:text-foreground lg:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border">‹</span>
                <PanelIcon className="h-6 w-6 text-accent" />
              </button>
            )}
          </aside>
        )}
      </div>
      {wizardActive && projectId && !focusMode && <WizardGuide lang={lang} step="layout" projectId={projectId} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── alt bileşenler

type T = Dictionary["layoutStudio"];

function roleLabelOf(role: Page["role"], t: T): string {
  switch (role) {
    case "title":
      return t.roleTitle;
    case "bio":
      return t.roleBio;
    case "toc":
      return t.roleToc;
    case "blank":
      return t.roleBlank;
    default:
      return "";
  }
}

function plainBlockText(block: Block): string {
  return "runs" in block ? block.runs.map((r) => r.text).join("").trim() : "";
}

function formatQualityTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

function buildQualityChecks({
  t,
  title,
  author,
  raw,
  blocks,
  pages,
  standard,
  margins,
  gutter,
  frontMatter,
  runningHeads,
  pageNumbers,
  hyphenate,
  lineBreak,
  contentWidthMm,
  contentHeightMm,
}: {
  t: T;
  title: string;
  author: string;
  raw: string;
  blocks: Block[];
  pages: Page[];
  standard: PrintStandard;
  margins: Margins;
  gutter: number;
  frontMatter: boolean;
  runningHeads: boolean;
  pageNumbers: boolean;
  hyphenate: boolean;
  lineBreak: LayoutSettings["lineBreak"];
  contentWidthMm: number;
  contentHeightMm: number;
}): {
  score: number;
  checks: QualityCheck[];
  errorCount: number;
  warningCount: number;
  successCount: number;
} {
  const checks: QualityCheck[] = [];
  const chapters = blocks.filter((b) => b.type === "heading" && b.level === 1);
  const bodyPages = pages.filter((p) => p.role === "body");
  const lastBodyPage = bodyPages.at(-1);
  const sourceWordCount = raw.trim() ? raw.trim().split(/\s+/).length : 0;
  const bodyBlockCount = blocks.filter((b) => b.type === "paragraph" || b.type === "blockquote").length;

  const add = (severity: QualitySeverity, label: string, detail: string) => {
    checks.push({ severity, label, detail });
  };

  if (!title.trim()) add("error", t.qualityMissingTitle, t.qualityMissingTitleDetail);
  else add("success", t.qualityTitleOk, t.qualityTitleOkDetail);

  if (!author.trim()) add("warning", t.qualityMissingAuthor, t.qualityMissingAuthorDetail);
  else add("success", t.qualityAuthorOk, t.qualityAuthorOkDetail);

  if (bodyBlockCount === 0) add("error", t.qualityNoBody, t.qualityNoBodyDetail);
  else add("success", t.qualityBodyOk, formatQualityTemplate(t.qualityBodyOkDetail, { count: bodyBlockCount }));

  if (chapters.length === 0) add("warning", t.qualityNoChapters, t.qualityNoChaptersDetail);
  else add("success", t.qualityChaptersOk, formatQualityTemplate(t.qualityChaptersOkDetail, { count: chapters.length }));

  if (!frontMatter) add("warning", t.qualityFrontMatterOff, t.qualityFrontMatterOffDetail);
  else add("success", t.qualityFrontMatterOk, t.qualityFrontMatterOkDetail);

  if (!pageNumbers) add("warning", t.qualityPageNumbersOff, t.qualityPageNumbersOffDetail);
  else add("success", t.qualityPageNumbersOk, t.qualityPageNumbersOkDetail);

  if (!runningHeads) add("warning", t.qualityRunningHeadsOff, t.qualityRunningHeadsOffDetail);
  else add("success", t.qualityRunningHeadsOk, t.qualityRunningHeadsOkDetail);

  if (lineBreak === "balanced") add("success", t.qualityLineBreakOk, t.qualityLineBreakOkDetail);
  else add("warning", t.qualityLineBreakGreedy, t.qualityLineBreakGreedyDetail);

  if (hyphenate) add("success", t.qualityHyphenationOk, t.qualityHyphenationOkDetail);
  else if (standard !== "kdp" || sourceWordCount > 1200) add("warning", t.qualityHyphenationOff, t.qualityHyphenationOffDetail);

  if (contentWidthMm < 70 || contentHeightMm < 115) {
    add(
      "warning",
      t.qualityTextAreaTight,
      formatQualityTemplate(t.qualityTextAreaTightDetail, {
        width: Math.round(contentWidthMm),
        height: Math.round(contentHeightMm),
      }),
    );
  } else {
    add(
      "success",
      t.qualityTextAreaOk,
      formatQualityTemplate(t.qualityTextAreaOkDetail, {
        width: Math.round(contentWidthMm),
        height: Math.round(contentHeightMm),
      }),
    );
  }

  if (standard === "kdp" || standard === "ingram" || standard === "bnpress" || standard === "lulu") {
    const inside = margins.inside + gutter;
    const minInside = kdpMinInsideMm(Math.max(1, pages.length));
    if (inside + 0.01 < minInside) {
      add(
        "error",
        t.qualityInsideMarginLow,
        formatQualityTemplate(t.qualityInsideMarginLowDetail, {
          current: inside.toFixed(1),
          required: minInside.toFixed(1),
        }),
      );
    } else {
      add(
        "success",
        t.qualityInsideMarginOk,
        formatQualityTemplate(t.qualityInsideMarginOkDetail, { current: inside.toFixed(1) }),
      );
    }
    if (pages.length > 828) add("error", t.qualityKdpPageLimit, t.qualityKdpPageLimitDetail);
  }

  const lastBodyLines = lastBodyPage?.lines.filter((l) => l.kind === "body").length ?? 0;
  if (lastBodyPage && lastBodyLines > 0 && lastBodyLines <= 3 && bodyPages.length > 1) {
    add("warning", t.qualityShortLastPage, t.qualityShortLastPageDetail);
  }

  const repeatedHeadingTexts = new Set<string>();
  const seenHeadingTexts = new Set<string>();
  for (const chapter of chapters) {
    const text = plainBlockText(chapter).toLocaleLowerCase("tr");
    if (seenHeadingTexts.has(text)) repeatedHeadingTexts.add(text);
    seenHeadingTexts.add(text);
  }
  if (repeatedHeadingTexts.size > 0) add("warning", t.qualityDuplicateChapters, t.qualityDuplicateChaptersDetail);

  const errorCount = checks.filter((c) => c.severity === "error").length;
  const warningCount = checks.filter((c) => c.severity === "warning").length;
  const successCount = checks.filter((c) => c.severity === "success").length;
  // Hatalar (eksik başlık/gövde, platform sınırı) skoru ağır düşürür; uyarılar
  // (isteğe bağlı ayarlar/öneriler) daha hafif — yapısal olarak sağlam ama birkaç
  // isteğe-bağlı kapalı kitap "hazır değil" yanılgısı vermesin.
  const score = Math.max(0, Math.min(100, 100 - errorCount * 18 - warningCount * 5));
  return { score, checks, errorCount, warningCount, successCount };
}

function PreflightDialog({
  report,
  onClose,
  reloadLabel,
}: {
  report: PreflightReport;
  onClose: () => void;
  /** Typst motoru çöktüyse: sayfayı yenileme düğmesi. */
  reloadLabel?: string;
}) {
  const levelIcon = (level: "ok" | "warn" | "error") =>
    level === "ok" ? "✅" : level === "warn" ? "⚠️" : "❌";
  const summary = report.ready
    ? "Baskıya hazır"
    : `${report.errorCount} hata${report.warnCount > 0 ? `, ${report.warnCount} uyarı` : ""}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Baskı Denetimi</h2>
            <p className={`mt-0.5 text-xs font-medium ${report.ready ? "text-emerald-600" : "text-red-600"}`}>
              {summary}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-foreground/10 hover:text-foreground"
            aria-label="Kapat"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {report.items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-sm leading-none">{levelIcon(item.level)}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground">{item.label}</div>
                    {item.detail && (
                      <div className="mt-0.5 whitespace-pre-line break-words text-[11px] leading-relaxed text-muted">{item.detail}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-[11px] text-muted">
            Yapısal PDF denetimi (şifreleme, boyut, TrimBox, gömülü font). DPI/CMYK kontrolü için baskıevi aracını kullanın.
          </p>
          {reloadLabel && (
            <button
              onClick={() => window.location.reload()}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              {reloadLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function QualityPanel({
  t,
  score,
  checks,
  errorCount,
  warningCount,
  successCount,
}: {
  t: T;
  score: number;
  checks: QualityCheck[];
  errorCount: number;
  warningCount: number;
  successCount: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{t.qualityHeading}</h2>
        <p className="mt-1 text-xs text-muted">{t.qualityHint}</p>
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">{t.qualityScoreLabel}</div>
            <div className="mt-1 text-4xl font-semibold text-foreground">{score}</div>
          </div>
          <div className="text-right text-xs text-muted">
            {formatQualityTemplate(t.qualitySummary, {
              errors: errorCount,
              warnings: warningCount,
              ok: successCount,
            })}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${
              errorCount > 0 ? "bg-red-500" : warningCount > 0 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((check, i) => (
          <div key={`${check.label}-${i}`} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-start gap-2">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  check.severity === "error"
                    ? "bg-red-500"
                    : check.severity === "warning"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
              />
              <div>
                <div className="text-sm font-semibold text-foreground">{check.label}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted">{check.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

function NumberRow({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-right text-foreground outline-none focus:border-accent"
        />
        {suffix && <span className="w-6 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}


// Typst motorunun GERÇEKTEN yüklediği/render ettiği gövde fontları (3 aile).
// Diğer aileler Typst'te sessizce Source Serif'e düşerdi → "font değişmiyor"
// görünürdü. Bu yüzden gövde/başlık seçicileri yalnız bunları sunar.
// Typst'in gerçekten yüklediği aileler (src/lib/typst/fonts.ts).
const TYPST_FONTS = COVER_FONTS.filter((f) => (TYPST_FAMILY_IDS as readonly string[]).includes(f.id));

function FontSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {TYPST_FONTS.map((f) => (
        <option key={f.id} value={f.id} style={{ fontFamily: fontFamilyOf(f.id) }}>
          {f.label}
        </option>
      ))}
    </select>
  );
}

function BookPanel({
  t,
  title,
  setTitle,
  author,
  setAuthor,
  subtitle,
  setSubtitle,
  publisher,
  setPublisher,
  bio,
  setBio,
}: {
  t: T;
  title: string;
  setTitle: (v: string) => void;
  author: string;
  setAuthor: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  publisher: string;
  setPublisher: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{t.bookHeading}</h2>
      <Field label={t.bookTitleLabel}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.bookTitlePlaceholder}
          className={inputCls}
        />
      </Field>
      <Field label={t.bookSubtitleLabel}>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder={t.bookSubtitlePlaceholder}
          className={inputCls}
        />
      </Field>
      <Field label={t.bookAuthorLabel}>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder={t.bookAuthorPlaceholder}
          className={inputCls}
        />
      </Field>
      <Field label={t.bookPublisherLabel}>
        <input
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          placeholder={t.bookPublisherPlaceholder}
          className={inputCls}
        />
      </Field>
      <Field label={t.bookBioLabel}>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t.bookBioPlaceholder}
          rows={6}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      </Field>
      <p className="text-xs text-muted">{t.bookHint}</p>
    </div>
  );
}

function TextPanel({
  t,
  raw,
  setRaw,
  stats,
  onSample,
  onClear,
  sourceMode,
  setSourceMode,
  docxMode,
  setDocxMode,
  importing,
  importInfo,
  importError,
  onImport,
  onClearImport,
}: {
  t: T;
  raw: string;
  setRaw: (v: string) => void;
  stats: { words: number; chars: number };
  onSample: () => void;
  onClear: () => void;
  sourceMode: SourceMode;
  setSourceMode: (v: SourceMode) => void;
  docxMode: DocxMode;
  setDocxMode: (v: DocxMode) => void;
  importing: boolean;
  importInfo: string | null;
  importError: boolean;
  onImport: (file: File) => void;
  onClearImport: () => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">{t.textHeading}</h2>

      {/* Kaynak: elle yaz / Word'den aktar */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
        {(["manual", "word"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setSourceMode(m)}
            className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
              sourceMode === m
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {m === "manual" ? t.sourceManual : t.sourceWord}
          </button>
        ))}
      </div>

      {sourceMode === "manual" ? (
        <>
          <Field label={t.textLabel}>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t.textPlaceholder}
              rows={14}
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </Field>
          <p className="text-xs text-muted">{t.textMarkdownHint}</p>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {stats.words} {t.statsWords} · {stats.chars} {t.statsChars}
            </span>
            <div className="flex gap-2">
              <button
                onClick={onSample}
                className="rounded-lg border border-border px-2.5 py-1 font-medium text-foreground transition hover:border-accent hover:text-accent"
              >
                {t.sampleCta}
              </button>
              <button
                onClick={onClear}
                className="rounded-lg border border-border px-2.5 py-1 font-medium text-foreground transition hover:border-accent hover:text-accent"
              >
                {t.clearCta}
              </button>
            </div>
          </div>
        </>
      ) : (
        <WordImport
          t={t}
          docxMode={docxMode}
          setDocxMode={setDocxMode}
          importing={importing}
          importInfo={importInfo}
          importError={importError}
          onImport={onImport}
          onClearImport={onClearImport}
        />
      )}
    </div>
  );
}

function WordImport({
  t,
  docxMode,
  setDocxMode,
  importing,
  importInfo,
  importError,
  onImport,
  onClearImport,
}: {
  t: T;
  docxMode: DocxMode;
  setDocxMode: (v: DocxMode) => void;
  importing: boolean;
  importInfo: string | null;
  importError: boolean;
  onImport: (file: File) => void;
  onClearImport: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const modes: { id: DocxMode; label: string; hint: string }[] = [
    { id: "kdy", label: t.wordModeKdy, hint: t.wordModeKdyHint },
    { id: "faithful", label: t.wordModeFaithful, hint: t.wordModeFaithfulHint },
  ];
  return (
    <div className="space-y-3">
      {/* Mod seçimi: önce seç, sonra dosya seç (mod, okuma anında uygulanır) */}
      <Field label={t.wordModeLabel}>
        <div className="space-y-1.5">
          {modes.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 transition ${
                docxMode === m.id
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="docxMode"
                checked={docxMode === m.id}
                onChange={() => setDocxMode(m.id)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium text-foreground">{m.label}</span>
                <span className="block text-xs text-muted">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      <input
        ref={fileRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="w-full rounded-lg border border-dashed border-border bg-background px-3 py-4 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {importing
          ? t.wordImporting
          : importInfo
            ? t.wordReplaceCta
            : t.wordDropLabel}
      </button>

      {importInfo && !importError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-accent-soft px-3 py-2 text-xs">
          <span className="text-foreground">{importInfo}</span>
          <button
            onClick={onClearImport}
            className="shrink-0 font-medium text-accent hover:underline"
          >
            {t.wordClearCta}
          </button>
        </div>
      )}
      {importError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {t.wordError}
        </p>
      )}

      <p className="text-xs text-muted">{t.wordHint}</p>
    </div>
  );
}

function PagePanel({
  t,
  standard,
  applyStandard,
  sizeId,
  setSizeId,
  presetId,
  applyPreset,
  margins,
  updateMargin,
  gutterAuto,
  setGutterAuto,
  gutterManual,
  setGutterManual,
  gutter,
}: {
  t: T;
  standard: PrintStandard;
  applyStandard: (id: PrintStandard) => void;
  sizeId: string;
  setSizeId: (v: string) => void;
  presetId: string;
  applyPreset: (id: string) => void;
  margins: Margins;
  updateMargin: (key: keyof Margins, value: number) => void;
  gutterAuto: boolean;
  setGutterAuto: (v: boolean) => void;
  gutterManual: number;
  setGutterManual: (v: number) => void;
  gutter: number;
}) {
  const presetLabels: Record<string, string> = {
    kdy: t.presetKdy,
    kdp: t.presetKdp,
    ingram: t.presetIngram,
    bnpress: t.presetBnpress,
    lulu: t.presetLulu,
    comfortable: t.presetComfortable,
    standard: t.presetStandard,
    compact: t.presetCompact,
    custom: t.presetCustom,
  };
  // Hazır ayar listesi: ilk düğme aktif standardın varsayılanı.
  const stdPreset = standard;
  const presetIds = [stdPreset, ...MARGIN_PRESETS.map((p) => p.id)];
  const standards: { id: PrintStandard; label: string }[] = [
    { id: "kdy", label: t.standardKdy },
    { id: "kdp", label: t.standardKdp },
    { id: "ingram", label: t.standardIngram },
    { id: "bnpress", label: t.standardBnpress },
    { id: "lulu", label: t.standardLulu },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t.pageHeading}</h2>

      <Field label={t.standardLabel}>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
          {standards.map((s) => (
            <button
              key={s.id}
              onClick={() => applyStandard(s.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                standard === s.id
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{t.standardHint}</p>
      </Field>

      <Field label={t.sizeLabel}>
        <select value={sizeId} onChange={(e) => setSizeId(e.target.value)} className={inputCls}>
          <optgroup label={t.sizeGroupKdy}>
            <option value={KDY_SIZE.id}>{KDY_SIZE.label}</option>
          </optgroup>
          <optgroup label={t.sizeGroupKdp}>
            {INTERIOR_SIZES.filter((s) => s.category === "kdp").map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label={t.sizeGroupTr}>
            {INTERIOR_SIZES.filter((s) => s.category === "tr").map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field label={t.presetLabel}>
        <div className="flex flex-wrap gap-1.5">
          {presetIds.map((id) => (
            <button
              key={id}
              onClick={() => applyPreset(id)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                presetId === id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-foreground hover:border-accent"
              }`}
            >
              {presetLabels[id]}
            </button>
          ))}
          {presetId === "custom" && (
            <span className="rounded-lg border border-accent bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              {t.presetCustom}
            </span>
          )}
        </div>
      </Field>

      <div className="space-y-2">
        <NumberRow label={t.marginTop} value={margins.top} onChange={(v) => updateMargin("top", v)} suffix={t.unitMm} />
        <NumberRow label={t.marginBottom} value={margins.bottom} onChange={(v) => updateMargin("bottom", v)} suffix={t.unitMm} />
        <NumberRow label={t.marginInside} value={margins.inside} onChange={(v) => updateMargin("inside", v)} suffix={t.unitMm} />
        <NumberRow label={t.marginOutside} value={margins.outside} onChange={(v) => updateMargin("outside", v)} suffix={t.unitMm} />
      </div>
      <p className="text-xs text-muted">{t.marginsHint}</p>

      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{t.gutterLabel}</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={gutterAuto}
              onChange={(e) => setGutterAuto(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {t.gutterAuto}
          </span>
        </label>
        {gutterAuto ? (
          <p className="text-xs text-muted">
            {gutter.toFixed(1)} {t.unitMm}
          </p>
        ) : (
          <NumberRow label={t.gutterLabel} value={gutterManual} step={0.5} onChange={setGutterManual} suffix={t.unitMm} />
        )}
        <p className="text-xs text-muted">{t.gutterHint}</p>
      </div>
    </div>
  );
}

// Tema seçici (düz liste): bir temaya tıklayınca tüm tipografi + bölüm-açılış
// ayarları paketçe oturur. Yazı sekmesinin en üstünde; altındaki ince ayarlarla
// dilenirse üzerine düzenleme yapılır.
function ThemePicker({
  t,
  lang,
  themeId,
  onApply,
}: {
  t: T;
  lang: "tr" | "en";
  themeId: string;
  onApply: (theme: LayoutTheme) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{t.themeHeading}</h2>
        <p className="mt-1 text-xs text-muted">{t.themeHint}</p>
      </div>
      <div className="space-y-2">
        {LAYOUT_THEMES.map((theme) => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onApply(theme)}
              className={`block w-full rounded-lg border p-3 text-left transition ${
                active
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background hover:border-accent/60"
              }`}
            >
              <div className="flex items-start gap-3">
                <ThemeThumbnail
                  theme={theme}
                  size={56}
                  decorative
                  className="shrink-0 rounded-[3px]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{theme.name[lang]}</span>
                    {active && (
                      <span className="shrink-0 text-[11px] font-semibold text-accent">
                        {t.themeActive}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    {theme.description[lang]}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Basit çizgi ikonlar (Phosphor tarzı) ──
function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M128 88a32 32 0 0 1 32-32h72v144h-72a32 32 0 0 0-32 32" />
      <path d="M24 200h72a32 32 0 0 1 32 32V88a32 32 0 0 0-32-32H24Z" />
    </svg>
  );
}
function PageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="48" y="32" width="160" height="192" rx="12" />
      <path d="M88 80h80M88 112h80M88 144h48" />
    </svg>
  );
}
function DownloadSimpleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M128 40v128M80 120l48 48 48-48M40 184v24a8 8 0 0 0 8 8h160a8 8 0 0 0 8-8v-24" />
    </svg>
  );
}

// Açılır bölüm (kapalı başlar).
function PanelAccordion({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {icon && <span className="text-foreground/70">{icon}</span>}
        <span className="flex-1">{title}</span>
        <CaretDownIcon className="h-4 w-4 text-foreground/60 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 pb-4 pt-1">{children}</div>
    </details>
  );
}

// Anahtar (açık/kapalı) satırı — sağda kaydırmalı düğme.
function SwitchRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-foreground" title={hint}>
      <span>{label}</span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-foreground/25 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

// Sayı seçici: hazır değerler + (listede yoksa) şimdiki değer.
function ValueSelect({ value, values, onChange, suffix, format }: { value: number; values: number[]; onChange: (v: number) => void; suffix?: string; format?: (v: number) => string }) {
  const list = values.includes(value) ? values : [...values, value].sort((a, b) => a - b);
  const show = (v: number) => (format ? format(v) : `${String(v).replace(".", ",")}${suffix ? ` ${suffix}` : ""}`);
  return (
    <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className={inputCls}>
      {list.map((v) => (
        <option key={v} value={String(v)}>
          {show(v)}
        </option>
      ))}
    </select>
  );
}
const range = (a: number, b: number, step: number) => {
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
};

// Yazı düzeni paneli (taslaktaki gibi): Gövde / Başlık sekmeleri, dizgi
// kuralları, açılır "Üstbilgi ve sayfa numarası" ve "Gelişmiş ayarlar",
// altta "Tüm kitaba uygula".
function TypeLayoutPanel(props: {
  t: T;
  lang: Locale;
  fontId: string;
  setFontId: (v: string) => void;
  bodySizePt: number;
  setBodySizePt: (v: number) => void;
  leadingPt: number;
  setLeadingPt: (v: number) => void;
  align: "left" | "justify";
  setAlign: (v: "left" | "justify") => void;
  indentMm: number;
  setIndentMm: (v: number) => void;
  paragraphSpacingMm: number;
  setParagraphSpacingMm: (v: number) => void;
  headingFontId: string;
  setHeadingFontId: (v: string) => void;
  detectHeadings: boolean;
  setDetectHeadings: (v: boolean) => void;
  chapterRight: boolean;
  setChapterRight: (v: boolean) => void;
  frontMatter: boolean;
  setFrontMatter: (v: boolean) => void;
  runningHeads: boolean;
  setRunningHeads: (v: boolean) => void;
  pageNumbers: boolean;
  setPageNumbers: (v: boolean) => void;
  hyphenate: boolean;
  setHyphenate: (v: boolean) => void;
  dropCap: boolean;
  setDropCap: (v: boolean) => void;
  lineBreak: "balanced" | "greedy";
  setLineBreak: (v: "balanced" | "greedy") => void;
  widowControl: boolean;
  setWidowControl: (v: boolean) => void;
  opticalMargins: boolean;
  setOpticalMargins: (v: boolean) => void;
  kerning: boolean;
  setKerning: (v: boolean) => void;
  themePicker: React.ReactNode;
  tocEditor: React.ReactNode;
  /** Konsept ayrıntıları (bölüm başı, süs, içindekiler, kaynakça…). */
  detailsPanel: React.ReactNode;
  onApplyAll: () => void;
}) {
  const { t } = props;
  const tr = props.lang === "tr";
  const [tab, setTab] = useState<"body" | "heading">("body");
  const label = "mb-1.5 block text-sm font-semibold text-foreground";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1" role="tablist">
        {(
          [
            ["body", tr ? "Gövde" : "Body"],
            ["heading", tr ? "Başlık" : "Heading"],
          ] as ["body" | "heading", string][]
        ).map(([id, name]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === id ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "body" ? (
        <div className="space-y-4">
          <div>
            <span className={label}>{t.fontLabel}</span>
            <FontSelect value={props.fontId} onChange={props.setFontId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={label}>{tr ? "Punto" : "Size"}</span>
              <ValueSelect value={props.bodySizePt} values={range(8, 14, 0.5)} onChange={props.setBodySizePt} />
            </div>
            <div>
              <span className={label}>{t.leadingLabel}</span>
              <ValueSelect
                value={props.leadingPt}
                values={[0, ...range(10, 20, 0.5)]}
                onChange={props.setLeadingPt}
                format={(v) => (v === 0 ? (tr ? "Otomatik" : "Auto") : String(v).replace(".", ","))}
              />
            </div>
          </div>
          <div>
            <span className={label}>{tr ? "Metin hizalama" : "Alignment"}</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
              {(["left", "justify"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => props.setAlign(a)}
                  aria-pressed={props.align === a}
                  title={a === "left" ? t.alignLeft : t.alignJustify}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                    props.align === a ? "bg-accent-soft text-accent" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <svg viewBox="0 0 20 14" className="h-4 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                    {a === "left" ? (
                      <path d="M1 1h18M1 5h12M1 9h18M1 13h10" />
                    ) : (
                      <path d="M1 1h18M1 5h18M1 9h18M1 13h18" />
                    )}
                  </svg>
                  {a === "left" ? t.alignLeft : t.alignJustify}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{tr ? "İlk satır girintisi" : "First-line indent"}</span>
              <div className="w-32">
                <ValueSelect value={props.indentMm} values={range(0, 10, 0.5)} onChange={props.setIndentMm} suffix="mm" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-foreground">{tr ? "Paragraf sonrası" : "Space after paragraph"}</span>
              <div className="w-32">
                <ValueSelect value={props.paragraphSpacingMm} values={range(0, 6, 0.5)} onChange={props.setParagraphSpacingMm} suffix="mm" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="mb-1 text-base font-semibold text-foreground">{tr ? "Dizgi kuralları" : "Typesetting rules"}</h3>
            <SwitchRow label={tr ? "Türkçe heceleme" : "Hyphenation"} checked={props.hyphenate} onChange={props.setHyphenate} />
            <SwitchRow
              label={tr ? "Dul ve yetim satır koruması" : "Widow & orphan control"}
              hint={tr ? "Paragrafın tek satırı sayfa başında ya da sonunda yalnız kalmasın." : "Keep single paragraph lines from being stranded at page top/bottom."}
              checked={props.widowControl}
              onChange={props.setWidowControl}
            />
            <SwitchRow
              label={tr ? "Optik kenar hizalama" : "Optical margin alignment"}
              hint={tr ? "Satır sonundaki noktalama kenarın biraz dışına taşar; metin kenarı gözle düz görünür." : "Punctuation hangs slightly outside the margin so the edge looks straight."}
              checked={props.opticalMargins}
              onChange={props.setOpticalMargins}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <span className={label}>{t.headingFontLabel}</span>
            <FontSelect value={props.headingFontId} onChange={props.setHeadingFontId} />
          </div>
          <SwitchRow label={t.detectHeadings} hint={t.detectHeadingsHint} checked={props.detectHeadings} onChange={props.setDetectHeadings} />
          <SwitchRow label={t.chapterRightLabel} checked={props.chapterRight} onChange={props.setChapterRight} />
          <SwitchRow label={t.dropCapLabel} checked={props.dropCap} onChange={props.setDropCap} />
        </div>
      )}

      <div className="divide-y divide-border border-t border-border">
        <PanelAccordion
          title={tr ? "Hazır temalar" : "Ready-made themes"}
          icon={<svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><rect x="2.5" y="3" width="6.5" height="6.5" rx="1.2" /><rect x="11" y="3" width="6.5" height="6.5" rx="1.2" /><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2" /><rect x="11" y="11" width="6.5" height="6.5" rx="1.2" /></svg>}
        >
          {props.themePicker}
        </PanelAccordion>
        <PanelAccordion
          title={tr ? "Bölüm, süs, içindekiler, kaynakça" : "Chapters, ornament, contents, bibliography"}
          icon={<PaletteIcon className="h-5 w-5" />}
        >
          {props.detailsPanel}
        </PanelAccordion>
        <PanelAccordion
          title={tr ? "Üstbilgi ve sayfa numarası" : "Running heads & page numbers"}
          icon={<svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><rect x="3" y="2" width="14" height="16" rx="2" /><path d="M6 6h8M6 9h8M6 12h5" /></svg>}
        >
          <SwitchRow label={t.runningHeadsLabel} checked={props.runningHeads} onChange={props.setRunningHeads} />
          <SwitchRow label={t.pageNumbersLabel} checked={props.pageNumbers} onChange={props.setPageNumbers} />
          <SwitchRow label={t.frontMatterLabel} checked={props.frontMatter} onChange={props.setFrontMatter} />
        </PanelAccordion>
        <PanelAccordion title={tr ? "Gelişmiş ayarlar" : "Advanced settings"} icon={<SlidersIcon className="h-5 w-5" />}>
          <label className="flex items-center justify-between gap-3 text-sm text-foreground">
            <span>{t.lineBreakLabel}</span>
            <select
              value={props.lineBreak}
              onChange={(e) => props.setLineBreak(e.target.value as "balanced" | "greedy")}
              className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="balanced">{t.lineBreakBalanced}</option>
              <option value="greedy">{t.lineBreakGreedy}</option>
            </select>
          </label>
          <SwitchRow label={t.kerningLabel} hint={t.kerningHint} checked={props.kerning} onChange={props.setKerning} />
          {props.tocEditor}
        </PanelAccordion>
      </div>

      <button
        type="button"
        onClick={props.onApplyAll}
        title={tr ? "Paragraflara ayrıca verilmiş yazı tipi/punto ayarlarını kaldırır; bu ayarlar kitabın her yerinde geçerli olur." : "Removes per-paragraph font/size overrides so these settings apply everywhere."}
        className="w-full rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        {tr ? "Tüm kitaba uygula" : "Apply to whole book"}
      </button>
    </div>
  );
}

// Konsept ayrıntıları — Yazı panelinde tek tek değiştirilebilir (konsept
// seçildikten sonra da). Etiketler konsept ekranıyla ortak (concepts.ts).
function ConceptDetailsControls({
  lang,
  values: v,
  set,
  onConcept,
}: {
  lang: Locale;
  values: {
    chapterStyle: ChapterStyle;
    chapterOrnament: ChapterOrnament;
    ornamentKind: OrnamentKind;
    sceneBreak: SceneBreak;
    subheadStyle: "center" | "left" | "left-caps";
    quoteStyle: "indent" | "box" | "bar";
    tocStyle: TocStyle;
    bibStyle: BibStyle;
    runningHeadStyle: "italic" | "caps";
    folioPosition: "outer" | "center";
    chapterNewPage: boolean;
    firstWordsCaps: boolean;
    keepLineBreaks: boolean;
  };
  set: {
    setChapterStyle: (x: ChapterStyle) => void;
    setChapterOrnament: (x: ChapterOrnament) => void;
    setOrnamentKind: (x: OrnamentKind) => void;
    setSceneBreak: (x: SceneBreak) => void;
    setSubheadStyle: (x: "center" | "left" | "left-caps") => void;
    setQuoteStyle: (x: "indent" | "box" | "bar") => void;
    setTocStyle: (x: TocStyle) => void;
    setBibStyle: (x: BibStyle) => void;
    setRunningHeadStyle: (x: "italic" | "caps") => void;
    setFolioPosition: (x: "outer" | "center") => void;
    setChapterNewPage: (x: boolean) => void;
    setFirstWordsCaps: (x: boolean) => void;
    setKeepLineBreaks: (x: boolean) => void;
  };
  onConcept: () => void;
}) {
  const tr = lang === "tr";
  const row = <T extends string>(label: string, value: T, opts: { v: T; tr: string; en: string }[], onChange: (x: T) => void) => (
    <label className="flex items-center justify-between gap-3 text-sm text-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 max-w-[58%] rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
      >
        {opts.map((o) => (
          <option key={o.v} value={o.v}>
            {o[lang]}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onConcept}
        className="w-full rounded-lg border border-accent/40 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent-soft"
      >
        {tr ? "İç tasarım konseptini aç" : "Open interior design concepts"}
      </button>
      {row(tr ? "Bölüm başı" : "Chapter opening", v.chapterStyle, CHAPTER_STYLE_OPTIONS, (x) => {
        set.setChapterStyle(x);
        // Süslü bölüm başı seçildi ama süs kapalıysa: süs açılır (yoksa boş kalır).
        if (x === "ornament" && v.ornamentKind === "none") set.setOrnamentKind("fleuron");
      })}
      {row(
        tr ? "Süs" : "Ornament",
        v.ornamentKind,
        ORNAMENT_OPTIONS.map((o) => ({ ...o, tr: `${o.glyph} ${o.tr}`, en: `${o.glyph} ${o.en}` })),
        (x) => {
          set.setOrnamentKind(x);
          // Kitapta süsün görüneceği bir yer yoksa: başlık altına ve sahne ayracına koy.
          const shown =
            v.chapterOrnament === "fleuron" || v.chapterStyle === "ornament" || v.sceneBreak === "fleuron" || v.sceneBreak === "asterism";
          if (x !== "none" && !shown) {
            set.setChapterOrnament("fleuron");
            set.setSceneBreak("fleuron");
          }
        },
      )}
      {row(tr ? "Sahne ayracı" : "Scene break", v.sceneBreak === "asterism" ? "fleuron" : v.sceneBreak, SCENE_OPTIONS, (x) => {
        set.setSceneBreak(x);
        if (x === "fleuron" && v.ornamentKind === "none") set.setOrnamentKind("fleuron");
      })}
      {row(tr ? "Ara başlık" : "Subheads", v.subheadStyle, SUBHEAD_OPTIONS, set.setSubheadStyle)}
      {row(tr ? "Alıntı" : "Quotes", v.quoteStyle, QUOTE_OPTIONS, set.setQuoteStyle)}
      {row(tr ? "İçindekiler" : "Contents", v.tocStyle, TOC_OPTIONS, set.setTocStyle)}
      {row(tr ? "Kaynakça" : "Bibliography", v.bibStyle, BIB_OPTIONS, set.setBibStyle)}
      {row(
        tr ? "Üst bilgi" : "Running head",
        v.runningHeadStyle,
        [
          { v: "italic" as const, tr: "İtalik", en: "Italic" },
          { v: "caps" as const, tr: "Büyük harf", en: "Capitals" },
        ],
        set.setRunningHeadStyle,
      )}
      {row(
        tr ? "Sayfa numarası" : "Page number",
        v.folioPosition,
        [
          { v: "outer" as const, tr: "Dış kenarda", en: "Outer edge" },
          { v: "center" as const, tr: "Ortada", en: "Centred" },
        ],
        set.setFolioPosition,
      )}
      <SwitchRow label={tr ? "Her bölüm yeni sayfadan başlasın" : "Each chapter starts a new page"} checked={v.chapterNewPage} onChange={set.setChapterNewPage} />
      <SwitchRow label={tr ? "Bölümün ilk kelimeleri büyük harf" : "Capitalise chapter's first words"} checked={v.firstWordsCaps} onChange={set.setFirstWordsCaps} />
      <SwitchRow
        label={tr ? "Şiir: dizeleri koru" : "Poetry: keep line breaks"}
        hint={tr ? "Paragraf içindeki satır sonları kitapta da satır sonu olur." : "Line breaks inside a paragraph stay line breaks in the book."}
        checked={v.keepLineBreaks}
        onChange={set.setKeepLineBreaks}
      />
    </div>
  );
}

// Biçim çubuğu yardımcıları.
function idOfFamily(family: string): string {
  return COVER_FONTS.find((f) => f.family === family)?.id ?? "sourceserif";
}
// Bloğun varsayılan (override yoksa) font ailesi ve puntosu — çubukta gösterilir.
function blockDefaultFontId(b: Block, bodyFontId: string, headingFontId: string): string {
  return b.type === "heading" ? headingFontId : bodyFontId;
}
function blockDefaultSizePt(b: Block, bodySizePt: number): number {
  if (b.type === "heading") return KDY_HEADINGS[b.level].sizePt;
  return bodySizePt;
}

// Aktif düzenleyicinin biçim çubuğuna açtığı emirler.
type EditorApi = {
  toggleBold: () => void;
  toggleItalic: () => void;
  commit: () => void; // ✕ düğmesi: kaydet ve düzenlemeyi bitir.
  // İmleç paragrafın ORTASINDAYSA run'ları imleçten ikiye böler (cümle-bazlı
  // sayfa-sonu/boşluk için). Başta/sonda ya da seçim yoksa null.
  splitAtCaret: () => { before: Run[]; after: Run[] } | null;
};

// run dizisini karakter ofsetinden ikiye böler (imleçten paragraf bölme).
function splitRunsAt(runs: Run[], offset: number): { before: Run[]; after: Run[] } {
  const before: Run[] = [];
  const after: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const len = r.text.length;
    if (pos + len <= offset) before.push(r);
    else if (pos >= offset) after.push(r);
    else {
      const cut = offset - pos;
      before.push({ ...r, text: r.text.slice(0, cut) });
      after.push({ ...r, text: r.text.slice(cut) });
    }
    pos += len;
  }
  return { before: before.filter((r) => r.text.length > 0), after: after.filter((r) => r.text.length > 0) };
}

function runsEqual(a: Run[], b: Run[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].text !== b[i].text || a[i].bold !== b[i].bold || a[i].italic !== b[i].italic) return false;
  }
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// Run[] → contentEditable başlangıç HTML'i. Her run, açık font-weight/style
// taşıyan bir span; böylece kalın/italik görünür ve seçim biçimlendirmesi
// (execCommand) buna ekleme/çıkarma yapabilir.
function runsToHtml(runs: Run[]): string {
  if (runs.length === 0) return "";
  return runs
    .map((r) => {
      const style = `font-weight:${r.bold ? "bold" : "normal"};font-style:${r.italic ? "italic" : "normal"}`;
      return `<span style="${style}">${escapeHtml(r.text)}</span>`;
    })
    .join("");
}

// contentEditable DOM → Run[]. Metin düğümlerini gezer; her düğümün etkin
// kalın/italik durumunu atalardaki etiket (B/STRONG, I/EM) ve satır-içi
// font-weight / font-style'dan hesaplar (execCommand çıktısının iki biçimini de
// kapsar). Komşu aynı stiller tek run'da birleşir.
function domToRuns(root: HTMLElement): Run[] {
  const runs: Run[] = [];
  const push = (text: string, bold: boolean, italic: boolean) => {
    if (!text) return;
    const prev = runs[runs.length - 1];
    if (prev && prev.bold === bold && prev.italic === italic) prev.text += text;
    else runs.push({ text, bold, italic });
  };
  const walk = (node: Node, bold: boolean, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push(node.textContent ?? "", bold, italic);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      push(" ", bold, italic);
      return;
    }
    let b = bold;
    let i = italic;
    if (el.tagName === "B" || el.tagName === "STRONG") b = true;
    if (el.tagName === "I" || el.tagName === "EM") i = true;
    const fw = el.style.fontWeight;
    if (fw) b = fw === "bold" || Number(fw) >= 600;
    const fs = el.style.fontStyle;
    if (fs) i = fs === "italic" || fs === "oblique";
    for (const child of Array.from(el.childNodes)) walk(child, b, i);
  };
  for (const child of Array.from(root.childNodes)) walk(child, false, false);
  return runs.filter((r) => r.text.length > 0);
}

function LineView({
  line,
  pxPerMm,
  renderDpi,
  onClick,
}: {
  line: Line;
  pxPerMm: number;
  renderDpi: number;
  onClick?: () => void;
}) {
  const sizePx = ptToPx(line.sizePt, renderDpi);
  const align = line.align;
  const textAlign: "left" | "center" | "right" | "justify" =
    align === "center" ? "center" : align === "right" ? "right" : line.justify ? "justify" : "left";
  const textAlignLast: "left" | "center" | "right" | "justify" = line.justify ? "justify" : textAlign;
  const leftInsetPx = (line.leftInsetMm ?? 0) * pxPerMm;
  const cap = line.dropCap;
  const capSizePx = cap ? ptToPx(cap.sizePt, renderDpi) : 0;
  // Drop cap'in tepesini ilk satırın büyük-harf tepesiyle hizala (yaklaşık model).
  const lineHpx = line.heightMm * pxPerMm;
  const baseline0 = lineHpx * 0.5 + sizePx * 0.35; // ilk satır taban çizgisi (div tepesinden)
  const capTopPx = baseline0 - sizePx * 0.7 - capSizePx * 0.1;
  return (
    <div
      onClick={onClick}
      style={{
        position: cap ? "relative" : undefined,
        cursor: onClick ? "text" : undefined,
        fontFamily: `"${line.font}", Georgia, serif`,
        fontSize: sizePx,
        lineHeight: `${line.heightMm * pxPerMm}px`,
        height: line.heightMm * pxPerMm,
        marginTop: line.spaceBeforeMm * pxPerMm,
        marginLeft: line.blockIndentMm * pxPerMm + leftInsetPx,
        marginRight: line.blockIndentMm * pxPerMm,
        paddingLeft: line.indentMm * pxPerMm,
        textAlign,
        textAlignLast,
        whiteSpace: line.justify ? "normal" : "nowrap",
        overflow: cap ? "visible" : "hidden",
      }}
    >
      {cap && (
        <span
          style={{
            position: "absolute",
            left: -leftInsetPx,
            // Glifin tepesi ilk satırın büyük-harf tepesiyle hizalansın.
            top: capTopPx,
            fontFamily: `"${cap.font}", Georgia, serif`,
            fontSize: capSizePx,
            fontWeight: cap.weight,
            lineHeight: 1,
          }}
        >
          {cap.char}
        </span>
      )}
      {line.segments.map((seg, i) => (
        <span
          key={i}
          style={{
            fontWeight: seg.bold ? 700 : line.weight,
            fontStyle: seg.italic || line.italic ? "italic" : "normal",
          }}
        >
          {seg.text}
        </span>
      ))}
    </div>
  );
}

// InDesign benzeri biçim çubuğu: düzenlenen bloğun font/punto/kalın/italik/
// hizalamasını gösterir ve tüm paragrafa uygular. Önizlemenin üstüne yapışır.
// data-fmtbar: editör odağı çubuğa geçince düzenleme kapanmasın diye işaret.
function FormatBar({
  t,
  typeLabel,
  selBold,
  selItalic,
  fontId,
  sizePt,
  onFontId,
  onSizePt,
  onToggleBold,
  onToggleItalic,
  onSendNextPage,
  onAddSpace,
  onPullPrevPage,
  canPullPrev,
  onCancel,
  onClose,
}: {
  t: T;
  typeLabel?: string;
  selBold: boolean;
  selItalic: boolean;
  /** Düzenlenen bloğun yazı tipi (id) ve puntosu — tüm paragrafa uygulanır. */
  fontId: string;
  sizePt: number;
  onFontId: (id: string) => void;
  onSizePt: (pt: number) => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onSendNextPage: () => void;
  onAddSpace: () => void;
  onPullPrevPage: () => void;
  canPullPrev: boolean;
  onCancel?: () => void;
  onClose: () => void;
}) {
  // Kalın/italik vurgusu seçili metnin canlı durumundan gelir.
  const isBold = selBold;
  const isItalic = selItalic;
  const btn = "flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2 text-sm text-foreground transition hover:border-accent";
  const btnOn = "border-accent bg-accent-soft text-accent";
  // Düğmeler odağı çalmasın (editör odakta kalsın) diye mousedown'da preventDefault.
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div
      data-fmtbar
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2"
    >
      {typeLabel && (
        <>
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-muted">
            {typeLabel}
          </span>
          <div className="mx-1 h-5 w-px bg-border" />
        </>
      )}
      <button type="button" onMouseDown={keepFocus} onClick={onToggleBold} className={`${btn} font-bold ${isBold ? btnOn : ""}`} title="Kalın">
        B
      </button>
      <button type="button" onMouseDown={keepFocus} onClick={onToggleItalic} className={`${btn} italic ${isItalic ? btnOn : ""}`} title="İtalik">
        I
      </button>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Paragrafın yazı tipi + puntosu (tüm bloğa uygulanır; select/input odak
          alabilir — data-fmtbar sayesinde düzenleme kapanmaz). */}
      <select
        value={fontId}
        onChange={(e) => onFontId(e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
        title="Yazı tipi (paragraf)"
      >
        {TYPST_FONTS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <input
        type="number"
        value={sizePt}
        min={6}
        max={48}
        step={0.5}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && n >= 6 && n <= 48) onSizePt(n);
        }}
        className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
        title="Punto (paragraf)"
      />

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Sayfa düzeni: bu paragrafı sonraki sayfaya at / önceki sayfaya çek /
          altına boşluk ekle. Yazar sayfadaki yerini görerek karar verir. */}
      <button type="button" onMouseDown={keepFocus} onClick={onSendNextPage} className={btn} title={t.sendNextPageHint}>
        ⤓ {t.sendNextPage}
      </button>
      {canPullPrev && (
        <button type="button" onMouseDown={keepFocus} onClick={onPullPrevPage} className={btn} title={t.pullPrevPageHint}>
          ⤒ {t.pullPrevPage}
        </button>
      )}
      <button type="button" onMouseDown={keepFocus} onClick={onAddSpace} className={btn} title={t.addSpaceHint}>
        ␣ {t.addSpace}
      </button>

      <div className="ml-auto flex items-center gap-2">
        {onCancel && (
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={onCancel}
            className="flex h-8 items-center justify-center rounded-md px-3 text-sm text-muted transition hover:text-foreground"
            title="Değişiklikleri at (Esc)"
          >
            İptal
          </button>
        )}
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={onClose}
          className="flex h-8 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90"
          title="Kaydet ve kapat"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

// Canvas üstünde yerinde ZENGİN düzenleyici (contentEditable). Bloğun run'larını
// kalın/italik span'lerle çizer; kullanıcı bir kelimeyi seçip biçim çubuğundan
// B/I'ye basınca yalnız o seçime uygulanır (execCommand). Başka yere tıklayınca
// (blur) DOM → Run[] olarak kaydeder, Esc iptal eder. İçerik yalnızca ilk
// kurulumda ref ile yazılır; sonraki React render'ları DOM metnine dokunmaz
// (böylece yeniden sayfalama düzenlemeyi bozmaz).
function RichBlockEditor({
  line,
  pxPerMm,
  renderDpi,
  initialRuns,
  apiRef,
  onCommitFinal,
  onCommitDraft,
  onEnd,
  onCancel,
  onSelection,
}: {
  line: Line;
  pxPerMm: number;
  renderDpi: number;
  initialRuns: Run[];
  apiRef: { current: EditorApi | null };
  onCommitFinal: (runs: Run[]) => void;
  onCommitDraft: (runs: Run[]) => void;
  onEnd: () => void;
  onCancel: () => void;
  onSelection: (f: { bold: boolean; italic: boolean }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false); // çift kayıt / kayıp düzenleme önler

  // Kayıt geri çağrıları HER render'da tazelenir: api mount'ta bir kez kurulur,
  // içindeki commit ilk render'ın commitBlockFinal kopyasını hapsederse blok-
  // seviyesi font/punto gibi SONRAKİ blocks değişiklikleri eski kopyayla ezilir.
  const onCommitFinalRef = useRef(onCommitFinal);
  const onCommitDraftRef = useRef(onCommitDraft);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onCommitFinalRef.current = onCommitFinal;
    onCommitDraftRef.current = onCommitDraft;
    onEndRef.current = onEnd;
  });

  const emitSelection = useCallback(() => {
    let bold = false;
    let italic = false;
    try {
      bold = document.queryCommandState("bold");
      italic = document.queryCommandState("italic");
    } catch {
      /* yoksay */
    }
    onSelection({ bold, italic });
  }, [onSelection]);

  // İlk kurulum: içeriği bir kez yaz, odakla ve tamamını seç.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = runsToHtml(initialRuns);
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* yoksay */
    }
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    emitSelection();
    // initialRuns kasıtlı olarak bağımlılık dışı: yalnız mount'ta tohumla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Biçim çubuğunun çağıracağı emirler + ara/son kayıt mantığı.
  useEffect(() => {
    const node = ref.current; // mount'tan unmount'a sabit; cleanup'ta güvenli.
    const read = () => (node ? domToRuns(node) : []);
    const api: EditorApi = {
      toggleBold: () => {
        document.execCommand("bold");
        emitSelection();
      },
      toggleItalic: () => {
        document.execCommand("italic");
        emitSelection();
      },
      commit: () => {
        committedRef.current = true;
        onCommitFinalRef.current(read());
        onEndRef.current();
      },
      splitAtCaret: () => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !node) return null;
        const r = sel.getRangeAt(0);
        if (!node.contains(r.startContainer)) return null;
        // İmlecin metin başından karakter ofsetini ölç.
        const pre = document.createRange();
        pre.selectNodeContents(node);
        pre.setEnd(r.startContainer, r.startOffset);
        const offset = pre.toString().length;
        const runs = read();
        const total = runs.reduce((n, x) => n + x.text.length, 0);
        if (offset <= 0 || offset >= total) return null; // başta/sonda → bölme yok
        committedRef.current = true; // bölme uygulanacak → unmount draft'ı bastır
        return splitRunsAt(runs, offset);
      },
    };
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) apiRef.current = null;
      // Beklenmedik unmount (örn. yeniden sayfalama editörü taşıdı): düzenlemeyi
      // bitirmeden run'ları sakla, böylece yazılanlar kaybolmaz.
      if (!committedRef.current && node) onCommitDraftRef.current(read());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seçim değişince çubuktaki B/I vurgusunu güncelle.
  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel && ref.current && sel.anchorNode && ref.current.contains(sel.anchorNode)) emitSelection();
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [emitSelection]);

  const sizePx = ptToPx(line.sizePt, renderDpi);
  const indentPx = line.blockIndentMm * pxPerMm;
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => {
        // Biçim çubuğuyla etkileşimde düzenlemeyi kapatma (odak çubuğa geçti).
        const rt = e.relatedTarget as HTMLElement | null;
        if (rt && rt.closest("[data-fmtbar]")) return;
        committedRef.current = true;
        onCommitFinal(ref.current ? domToRuns(ref.current) : []);
        onEnd();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          committedRef.current = true; // iptal: kaydetme
          onCancel();
        } else if (e.key === "Enter") {
          // Bir blok tek paragraftır; satır sonu eklenmesin.
          e.preventDefault();
        }
      }}
      style={{
        display: "block",
        boxSizing: "border-box",
        width: `calc(100% - ${indentPx * 2}px)`,
        marginTop: line.spaceBeforeMm * pxPerMm,
        marginLeft: indentPx,
        marginRight: indentPx,
        fontFamily: `"${line.font}", Georgia, serif`,
        fontSize: sizePx,
        lineHeight: `${line.heightMm * pxPerMm}px`,
        fontWeight: line.weight,
        fontStyle: line.italic ? "italic" : "normal",
        textAlign: line.align === "center" ? "center" : line.align === "right" ? "right" : "left",
        color: "inherit",
        padding: 0,
        border: "1px solid rgba(234,88,12,0.6)",
        outline: "none",
        background: "rgba(234,88,12,0.06)",
      }}
    />
  );
}

function PagePreview({
  page,
  size,
  margins,
  gutter,
  pxPerMm,
  renderDpi,
  bodyFamily,
  roleLabel,
  editingBlock,
  showEditor,
  editingRuns,
  editorApiRef,
  onStartEdit,
  onCommitFinal,
  onCommitDraft,
  onEndEdit,
  onSelection,
}: {
  page: Page;
  size: BookSize;
  margins: Margins;
  gutter: number;
  pxPerMm: number;
  renderDpi: number;
  bodyFamily: string;
  roleLabel: string;
  editingBlock: number | null;
  showEditor: boolean;
  editingRuns: Run[];
  editorApiRef: { current: EditorApi | null };
  onStartEdit: (i: number) => void;
  onCommitFinal: (i: number, runs: Run[]) => void;
  onCommitDraft: (i: number, runs: Run[]) => void;
  onEndEdit: () => void;
  onSelection: (f: { bold: boolean; italic: boolean }) => void;
}) {
  const isRight = page.isRight;
  const geo = pageGeometry(size, margins, gutter, isRight);
  const metaFontSize = ptToPx(9, renderDpi);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative bg-white shadow-[0_1px_8px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
        style={{ width: size.width * pxPerMm, height: size.height * pxPerMm }}
      >
        {/* üst bilgi (yazar / kitap adı) */}
        {page.runningHead && (
          <div
            className="absolute text-muted"
            style={{
              top: (margins.top / 2) * pxPerMm,
              left: geo.left * pxPerMm,
              width: geo.contentWidth * pxPerMm,
              textAlign: isRight ? "right" : "left",
              fontSize: metaFontSize,
              fontFamily: `"${bodyFamily}", Georgia, serif`,
              fontStyle: "italic",
            }}
          >
            {page.runningHead}
          </div>
        )}

        {/* metin alanı */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: geo.left * pxPerMm,
            top: geo.top * pxPerMm,
            width: geo.contentWidth * pxPerMm,
            height: geo.contentHeight * pxPerMm,
            color: "#1a1a1a",
          }}
        >
          {/* Düzenlenen bloğun satırlarını gizle; ilk satırının yerine tek bir
              düzenleyici koy (blok birden çok satıra/sayfaya taşsa bile bir tane). */}
          {(() => {
            const editorLineIdx =
              showEditor && editingBlock != null
                ? page.lines.findIndex((l) => l.blockIndex === editingBlock)
                : -1;
            return page.lines.map((line, i) => {
              const isEditing = editingBlock != null && line.blockIndex === editingBlock;
              if (isEditing) {
                if (i !== editorLineIdx) return null;
                return (
                  <RichBlockEditor
                    key={`editor-${editingBlock}`}
                    line={line}
                    pxPerMm={pxPerMm}
                    renderDpi={renderDpi}
                    initialRuns={editingRuns}
                    apiRef={editorApiRef}
                    onCommitFinal={(runs) => onCommitFinal(editingBlock, runs)}
                    onCommitDraft={(runs) => onCommitDraft(editingBlock, runs)}
                    onEnd={onEndEdit}
                    onCancel={onEndEdit}
                    onSelection={onSelection}
                  />
                );
              }
              return (
                <LineView
                  key={i}
                  line={line}
                  pxPerMm={pxPerMm}
                  renderDpi={renderDpi}
                  onClick={
                    line.blockIndex != null
                      ? () => onStartEdit(line.blockIndex!)
                      : undefined
                  }
                />
              );
            });
          })()}
        </div>

        {/* sayfa numarası — dış alt köşe */}
        {page.showNumber && (
          <div
            className="absolute text-muted"
            style={{
              bottom: (margins.bottom / 2.4) * pxPerMm,
              left: geo.left * pxPerMm,
              width: geo.contentWidth * pxPerMm,
              textAlign: isRight ? "right" : "left",
              fontSize: metaFontSize,
              fontFamily: `"${bodyFamily}", Georgia, serif`,
            }}
          >
            {page.number}
          </div>
        )}
      </div>
      {roleLabel && (
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">{roleLabel}</span>
      )}
    </div>
  );
}
