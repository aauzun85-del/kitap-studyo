"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { useMetaSync, useManuscriptSync } from "@/lib/projects/useSync";
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
} from "@/lib/layout/paginate";
import {
  LAYOUT_THEMES,
  type LayoutTheme,
  type ChapterOrnament,
} from "@/lib/layout/themes";
import { ThemeThumbnail } from "@/lib/layout/themeThumbnail";
import { parseDocx, type DocxMode } from "@/lib/layout/docx";
import { blocksToMarkdown } from "@/lib/layout/blocksToMarkdown";
import type { MediaMap } from "@/lib/layout/mediaTokens";
import { exportBookPdf } from "@/lib/layout/pdf";
import { exportBookPdfTypst, type TypstBookInput } from "@/lib/typst";
import { preflightPdf, type PreflightReport } from "@/lib/publishing/preflight";
import { TypstPreviewCanvas } from "@/components/editor/TypstPreviewCanvas";
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
  LayoutIcon,
  SlidersIcon,
  StackIcon,
  CheckCircleIcon,
} from "@/components/PhosphorIcons";

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
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
  /** İndirme ekranından "?export=1": sayfalama hazır olunca İç sayfa PDF'ini
   *  otomatik indir + üstte durum katmanı göster. */
  autoExport?: boolean;
}) {
  const t = dict.layoutStudio;
  // Bulut projesi: state proje verisinden tohumlanır; proje yoksa anonim (boş).
  const projectId = initialProject?.id ?? null;
  const seed = initialProject?.data;

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
  const [standard, setStandard] = useState<PrintStandard>(seedPlatform);
  // KDP/Serbest taşma (bleed) açık mı — profilin varsayılanı.
  const [bleedOn, setBleedOn] = useState(seedProfile.bleedDefaultOn);

  // Sayfa / kenar boşlukları (profil varsayılanları).
  const [sizeId, setSizeId] = useState(seedProfile.defaultSizeId);
  const [margins, setMargins] = useState<Margins>({ ...seedProfile.defaultMargins });
  const [presetId, setPresetId] = useState<string>(seedPlatform);
  const [gutterAuto, setGutterAuto] = useState(true);
  const [gutterManual, setGutterManual] = useState(0);
  const [zoom, setZoom] = useState(1);

  // Tipografi (KDY varsayılanları).
  const [fontId, setFontId] = useState("sourceserif");
  const [bodySizePt, setBodySizePt] = useState(11);
  const [leadingPt, setLeadingPt] = useState(15);
  const [align, setAlign] = useState<"left" | "justify">("justify");
  const [indentMm, setIndentMm] = useState(5);
  // Paragraf-arası boşluk varsayılanı 0: klasik roman dizgisinde paragraflar
  // ilk-satır girintisiyle ayrılır, ekstra boşlukla değil. Boşluk eklemek tek
  // taban-çizgisi ızgarasını bozar (satır aralığı 15/20.7 pt karışır); bu yüzden
  // ızgara, gövde satırlarını leading'in katına hizalar (bkz. paginate snapBodyGap).
  // Varsayılan: her paragraftan sonra ~1 satır boşluk (kullanıcı isteği).
  const [paragraphSpacingMm, setParagraphSpacingMm] = useState(5);
  const [headingFontId, setHeadingFontId] = useState("sourceserif");
  const [detectHeadings, setDetectHeadings] = useState(true);

  // Yapısal seçenekler.
  const [chapterRight, setChapterRight] = useState(true);
  const [frontMatter, setFrontMatter] = useState(true);
  const [runningHeads, setRunningHeads] = useState(true);
  const [pageNumbers, setPageNumbers] = useState(true);
  // Heceleme yalnız Türkçe metinde güvenli; varsayılanı uygulama diline bağla.
  const [hyphenate, setHyphenate] = useState(lang === "tr");
  // Bölüm başı büyük baş harf (drop cap) — varsayılan açık.
  const [dropCap, setDropCap] = useState(true);
  // Satır kırma yöntemi — varsayılan "balanced" (Knuth–Plass, profesyonel).
  const [lineBreak, setLineBreak] = useState<"balanced" | "greedy">("balanced");
  // Bölüm açılış stili (tema sistemi).
  const [chapterTopRatio, setChapterTopRatio] = useState(0.12);
  const [chapterOrnament, setChapterOrnament] = useState<ChapterOrnament>("none");
  const [showChapterKicker, setShowChapterKicker] = useState(true);
  // Seçili tema (boş = elle/varsayılan; tema seçince ayarlar paketçe uygulanır).
  const [themeId, setThemeId] = useState("");
  // İçindekiler başlık geçersiz kılmaları (bölüm sırasına göre). Boş = otomatik.
  const [tocOverrides, setTocOverrides] = useState<Record<number, string>>({});

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

  // PDF dışa aktarma.
  const [cropMarks, setCropMarks] = useState(true);
  const [kerning, setKerning] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
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
      chapterTopRatio,
      chapterOrnament,
      showChapterKicker,
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
      chapterTopRatio,
      chapterOrnament,
      showChapterKicker,
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
    setChapterTopRatio(theme.chapterTopRatio);
    setChapterOrnament(theme.chapterOrnament);
    setShowChapterKicker(theme.showChapterKicker);
  }, []);

  // Etkin bloklar: Word modundaysa ve içe aktarım varsa onu, yoksa elle
  // yazılan markdown'ı kullan. İçe aktarım korunur; kaynağı değiştirince
  // kaybolmaz, böylece kullanıcı ileri-geri geçebilir.
  const derivedBlocks: Block[] = useMemo(
    () =>
      sourceMode === "word" && importedBlocks
        ? importedBlocks
        : parseBlocks(raw, detectHeadings, importMedia),
    [sourceMode, importedBlocks, raw, detectHeadings, importMedia],
  );

  // Canvasta düzenlenen blok indeksi (null = düzenleme yok).
  const [editingBlock, setEditingBlock] = useState<number | null>(null);

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
      } else if (runsEqual(b.runs, runs)) {
        setEditingBlock(null); // değişiklik yok → dokunma
        return;
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
      setImportMedia(media);
      setRaw(markdown);
      setEditingBlock(null);
    },
    [blocks],
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
    [blocks, applyLayout],
  );
  const addSpaceAfterBlock = useCallback(
    (i: number) => {
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
    [blocks, applyLayout],
  );
  const pullBlockToPrevPage = useCallback(
    (i: number) => {
      if (i <= 0 || blocks[i - 1]?.type !== "pagebreak") return;
      applyLayout([...blocks.slice(0, i - 1), ...blocks.slice(i)]);
    },
    [blocks, applyLayout],
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
    [docxMode, t],
  );

  const clearImport = useCallback(() => {
    setImportedBlocks(null);
    setImportInfo(null);
    setImportError(false);
  }, []);

  const handleExportPdf = useCallback(async (): Promise<boolean> => {
    if (pages.length === 0) return false;
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
  }, [pages, sizeId, margins, gutter, cropMarks, kerning, fontId, title, standard, bleedOn]);

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
    } catch {
      setExportError(true);
      return false;
    } finally {
      setExporting(false);
    }
  }, [blocks, meta, settings, sizeId, margins, gutter, cropMarks, standard, bleedOn, title]);

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
      setPreflightReport({
        items: [{ level: "error", label: "Denetim başarısız", detail: String(e) }],
        errorCount: 1,
        warnCount: 0,
        ready: false,
      });
    } finally {
      setPreflightRunning(false);
    }
  }, [blocks, meta, settings, sizeId, margins, gutter, cropMarks, standard, bleedOn]);

  // Export modu: yazı tipleri yüklenip sayfalama hazır olunca İç sayfa PDF'ini
  // bir kez otomatik indir (indirme ekranındaki tuştan gelindi). Metin
  // initialProject'ten SENKRON gelir (cover'ın aksine ağ beklemesi yok), ayrıca
  // pages.length>0 koşulu boş PDF'i engeller.
  useEffect(() => {
    if (!autoExport || autoExportFiredRef.current) return;
    if (!fontsReady || pages.length === 0) return;
    autoExportFiredRef.current = true;
    if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
    void (async () => {
      const ok = await handleExportPdfTypst(); // varsayılan = gördüğün baskı sayfası
      setAutoExportStatus(ok ? "done" : "error");
    })();
  }, [autoExport, fontsReady, pages.length, handleExportPdfTypst]);

  // SAFETY: yazı tipi/sayfalama asılı kalırsa overlay sonsuza dek "hazırlanıyor"
  // kalmasın → ~12 sn içinde tetiklenmediyse "error"a düş (elle "Tekrar dene").
  useEffect(() => {
    if (!autoExport) return;
    autoExportSafetyRef.current = window.setTimeout(() => {
      if (autoExportFiredRef.current) return;
      autoExportFiredRef.current = true;
      setAutoExportStatus("error");
    }, 12000);
    return () => {
      if (autoExportSafetyRef.current) window.clearTimeout(autoExportSafetyRef.current);
    };
  }, [autoExport]);

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
    { id: "book", label: t.navBook, Icon: StackIcon },
    { id: "text", label: t.navText, Icon: TextTIcon },
    { id: "page", label: t.navPage, Icon: LayoutIcon },
    { id: "type", label: t.navType, Icon: SlidersIcon },
    { id: "quality", label: t.navQuality, Icon: CheckCircleIcon },
  ];

  const isEmpty = blocks.length === 0 && !title.trim();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1760px] flex-col gap-4 px-4 py-6 lg:flex-row">
      {autoExport && (
        <ExportOverlay
          lang={lang}
          kind="ic"
          status={autoExportStatus}
          backHref={projectId ? `/${lang}/indir?project=${projectId}` : `/${lang}/projeler`}
          onDownload={() => void handleExportPdfTypst()}
        />
      )}
      {preflightReport && (
        <PreflightDialog report={preflightReport} onClose={() => setPreflightReport(null)} />
      )}
      <aside className="w-full shrink-0 lg:w-[380px]">
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-surface p-1">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPanel(id)}
              className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition ${
                panel === id
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
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
              setRaw={setRaw}
              stats={stats}
              onSample={() => setRaw(SAMPLE_TR)}
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
            <ThemePicker t={t} lang={lang} themeId={themeId} onApply={applyTheme} />
          )}
          {panel === "type" && (
            <TypePanel
              t={t}
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
          {panel === "type" && frontMatter && chapterTitles.length > 0 && (
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
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background lg:sticky lg:top-4 lg:h-[calc(100dvh-12rem)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
              {t.previewHeading}
            </span>
            <span className="text-sm font-semibold">
              {t.pageCountLabel} {pages.length} {t.pageWord}
            </span>
            {!isEmpty && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  quality.errorCount > 0
                    ? "bg-red-50 text-red-700"
                    : quality.warningCount > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {t.qualityScoreLabel} {quality.score}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5" title="Typst: gerçek baskı sayfası (=PDF), üstüne tıklayıp düzenle. Hızlı: yedek önizleme.">
              <button
                onClick={() => setPreviewEngine("typst")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  previewEngine === "typst" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                Typst
              </button>
              <button
                onClick={() => setPreviewEngine("js")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  previewEngine === "js" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                Hızlı
              </button>
            </div>
            {standard === "kdy" ? (
              <label className="flex items-center gap-1.5 text-xs text-muted" title={t.cropMarksLabel}>
                <input
                  type="checkbox"
                  checked={cropMarks}
                  onChange={(e) => setCropMarks(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {t.cropMarksLabel}
              </label>
            ) : (
              <label className="flex items-center gap-1.5 text-xs text-muted" title={t.bleedHint}>
                <input
                  type="checkbox"
                  checked={bleedOn}
                  onChange={(e) => setBleedOn(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {t.bleedLabel}
              </label>
            )}
            <label className="flex items-center gap-1.5 text-xs text-muted" title={t.kerningHint}>
              <input
                type="checkbox"
                checked={kerning}
                onChange={(e) => setKerning(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              {t.kerningLabel}
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              {t.zoomLabel}
              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-2 py-1 text-foreground"
              >
                {ZOOM_OPTIONS.map((z) => (
                  <option key={z} value={z}>
                    {Math.round(z * 100)}%
                  </option>
                ))}
              </select>
            </label>
            {/* PDF indir: görüntülenen motorla AYNI çıktı (Typst varsayılan =
                gördüğün baskı sayfası). "Hızlı" önizlemedeyse JS motoruyla iner. */}
            <button
              onClick={() => void (previewEngine === "typst" ? handleExportPdfTypst() : handleExportPdf())}
              disabled={exporting || isEmpty || blocks.length === 0}
              title={
                standard === "kdy"
                  ? t.exportHint
                  : standard === "ingram"
                    ? t.exportHintIngram
                    : t.exportHintKdp
              }
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? t.exportingLabel : t.exportPdfCta}
            </button>
            <button
              onClick={() => void handlePreflight()}
              disabled={preflightRunning || blocks.length === 0}
              title="Üretilen PDF'i baskı kurallarına göre denetle (sayfa boyutu, TrimBox, font gömme…)"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preflightRunning ? "Denetleniyor…" : "Baskı Denetimi"}
            </button>
          </div>
        </div>
        {exportError && (
          <div className="border-b border-border bg-red-50 px-4 py-2 text-xs text-red-700">
            {t.exportErrorLabel}
          </div>
        )}
        {!isEmpty && (
          <div className="border-b border-border bg-accent-soft/40 px-4 py-2 text-xs text-muted">
            {standard === "kdy" ? t.imprintNote : t.imprintNoteKdp}
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {isEmpty ? (
            <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted">
              {t.emptyPreview}
            </div>
          ) : previewEngine === "typst" ? (
            <TypstPreviewCanvas
              input={typstInput}
              editingBlock={editingBlock}
              onSelectBlock={startEditBlock}
            />
          ) : (
            <div className="flex flex-col items-center gap-6">
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
      </main>
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

function PreflightDialog({ report, onClose }: { report: PreflightReport; onClose: () => void }) {
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
                      <div className="mt-0.5 text-[11px] leading-relaxed text-muted">{item.detail}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border px-5 py-3">
          <p className="text-[11px] text-muted">
            Yapısal PDF denetimi (şifreleme, boyut, TrimBox, gömülü font). DPI/CMYK kontrolü için baskıevi aracını kullanın.
          </p>
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="text-foreground">{label}</span>
    </label>
  );
}

// Typst motorunun GERÇEKTEN yüklediği/render ettiği gövde fontları (3 aile).
// Diğer aileler Typst'te sessizce Source Serif'e düşerdi → "font değişmiyor"
// görünürdü. Bu yüzden gövde/başlık seçicileri yalnız bunları sunar.
const TYPST_FONTS = COVER_FONTS.filter((f) => ["sourceserif", "vollkorn", "arnopro"].includes(f.id));

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
                onClick={() => setRaw("")}
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

function TypePanel(props: {
  t: T;
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
}) {
  const { t } = props;
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t.typeHeading}</h2>

      <Field label={t.fontLabel}>
        <FontSelect value={props.fontId} onChange={props.setFontId} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <NumberRow label={t.fontSizeLabel} value={props.bodySizePt} step={0.5} min={6} onChange={props.setBodySizePt} suffix={t.unitPt} />
        <NumberRow label={t.leadingLabel} value={props.leadingPt} step={0.5} min={0} onChange={props.setLeadingPt} suffix={t.unitPt} />
      </div>

      <Field label={t.alignLabel}>
        <div className="flex gap-1.5">
          {(["left", "justify"] as const).map((a) => (
            <button
              key={a}
              onClick={() => props.setAlign(a)}
              className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                props.align === a
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-foreground hover:border-accent"
              }`}
            >
              {a === "left" ? t.alignLeft : t.alignJustify}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <NumberRow label={t.indentLabel} value={props.indentMm} step={0.5} onChange={props.setIndentMm} suffix={t.unitMm} />
        <NumberRow label={t.paraSpaceLabel} value={props.paragraphSpacingMm} step={0.5} onChange={props.setParagraphSpacingMm} suffix={t.unitMm} />
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <Field label={t.headingFontLabel}>
          <FontSelect value={props.headingFontId} onChange={props.setHeadingFontId} />
        </Field>
        <Toggle label={t.detectHeadings} checked={props.detectHeadings} onChange={props.setDetectHeadings} />
        <p className="text-xs text-muted">{t.detectHeadingsHint}</p>
      </div>

      <div className="border-t border-border pt-3 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.structureHeading}</h3>
        <Toggle label={t.frontMatterLabel} checked={props.frontMatter} onChange={props.setFrontMatter} />
        <Toggle label={t.chapterRightLabel} checked={props.chapterRight} onChange={props.setChapterRight} />
        <Toggle label={t.runningHeadsLabel} checked={props.runningHeads} onChange={props.setRunningHeads} />
        <Toggle label={t.pageNumbersLabel} checked={props.pageNumbers} onChange={props.setPageNumbers} />
        <Toggle label={t.hyphenateLabel} checked={props.hyphenate} onChange={props.setHyphenate} />
        <Toggle label={t.dropCapLabel} checked={props.dropCap} onChange={props.setDropCap} />
        <label className="flex items-center justify-between gap-3 py-1 text-sm text-foreground">
          <span>{t.lineBreakLabel}</span>
          <select
            value={props.lineBreak}
            onChange={(e) => props.setLineBreak(e.target.value as "balanced" | "greedy")}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-accent"
          >
            <option value="balanced">{t.lineBreakBalanced}</option>
            <option value="greedy">{t.lineBreakGreedy}</option>
          </select>
        </label>
        <p className="text-xs text-muted">{t.structureHint}</p>
      </div>
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
        onCommitFinal(read());
        onEnd();
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
      if (!committedRef.current && node) onCommitDraft(read());
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
