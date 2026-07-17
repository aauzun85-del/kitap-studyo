"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { mmToPx, type SpreadDimensions } from "@/lib/cover/spread";
import { getTemplate, type CoverContent, type CoverColors } from "@/lib/cover/templates";
import { generateBarcodeDataUrl } from "@/lib/cover/barcode";
import {
  fontFamilyOf,
  COVER_FONT_FAMILIES,
  COVER_FONTS,
  DEFAULT_COVER_FONT,
} from "@/lib/cover/fonts";

type Labels = {
  backCover: string;
  spine: string;
  frontCover: string;
};

export type CoverImages = {
  cover: string | null; // dataURL
  coverDarken: number; // 0..1 — üstüne siyah perde (görsel kararır)
  coverOpacity: number; // 0..1 — görselin kendi saydamlığı (zemin içinden görünür)
  coverScope: "front" | "wrap";
  coverFit: "fill" | "fit"; // doldur (kırparak kapla) | sığdır (tamamı görünsün)
  coverPanX: number; // -1..1 — kadraj içinde yatay kaydırma
  coverZoom: number; // 1..2.5 — yakınlaştırma çarpanı
  logo: string | null; // dataURL
  logoSize: number; // ön kapak genişliğinin yüzdesi
  logoPos: "top" | "bottom";
};

// Kullanıcının elle değiştirdiği nesnenin kayıtlı dönüşümü:
// konum (mm, sol-üst köşe), boyut (temel boyuta GÖRE çarpan) ve açı (derece).
export type ObjTransform = {
  leftMm: number;
  topMm: number;
  scaleX?: number; // temel ölçeğe göre çarpan (1 = değişmemiş)
  scaleY?: number;
  angle?: number; // derece (0..360)
};
export type PositionMap = Record<string, ObjTransform>;

// Seçili nesnenin o anki ölçü/konumu (mm) — panelde sayısal X/Y/G/Y için.
// Konum nesnenin MERKEZİDİR (tüm nesneler merkez orijinli oluşturulur).
export type ObjGeometry = {
  leftMm: number; // merkez X (sayfanın solundan)
  topMm: number; // merkez Y (sayfanın üstünden)
  widthMm: number; // o anki görünen genişlik
  heightMm: number; // o anki görünen yükseklik
};

// Yapısal metinler (başlık/yazar/altbaşlık/sırt) için kullanıcının seçtiği
// öğe bazlı stil. Yalnız değiştirilen alan saklanır; boş alan şablon/palet varsayılanı.
export type TextStyle = {
  fontId?: string;
  fontSizeMm?: number;
  color?: string;
};
export type TextStyleMap = Record<string, TextStyle>;

// Kullanıcının öne/arkaya aldığı nesnelerin katman seviyesi (editId → seviye).
export type LayerMap = Record<string, number>;

export type AlignMode = "left" | "center" | "right";

// Kullanıcının "Nesne" panelinden eklediği serbest nesneler.
export type CustomObjectType =
  | "text"
  | "rect"
  | "circle"
  | "line"
  | "image"
  | "triangle"
  | "star"
  | "diamond"
  | "divider";
export type DividerVariant = "double" | "dotline" | "diamond";
export type CustomObject = {
  id: string; // "obj-<n>" — editId olarak kullanılır
  type: CustomObjectType;
  text?: string; // type === "text" — satır sonları (\n) korunur
  fill: string; // dolu modunda dolgu; çerçeve modunda kenar; çizgide çizgi rengi
  fontSizeMm?: number; // type === "text"
  fontId?: string; // type === "text" — yazı tipi kimliği (fonts.ts)
  align?: "left" | "center" | "right"; // type === "text" — metin hizası (vars. orta)
  lineHeightMul?: number; // type === "text" — satır aralığı çarpanı (vars. 1.16)
  // type === "text" — renk yönetimi: undefined/true ise kapak görseli varken metin
  // arka plana göre OTOMATİK beyaz/siyah olur (okunurluk). Kullanıcı elle renk
  // seçince false olur → seçtiği renk korunur (otomatik kontrast atlar).
  autoColor?: boolean;
  // type === "text" — "arkasına okuma paneli": metnin arkasına metne göre
  // boyutlanan yarı saydam koyu panel (scrim) koyar. Bölünmüş/parlak-noktalı
  // zeminde (ör. parlak figür üstünde) garanti okunurluk için.
  panel?: boolean;
  src?: string; // type === "image" — AI üretilen saydam PNG (data URL)
  // ── Şekil stili (rect/circle/triangle/star/diamond için) ──
  shapeStyle?: "fill" | "outline"; // vars. "fill"; "outline" = içi boş, sadece çerçeve
  strokeWidthMm?: number; // çerçeve kalınlığı (outline) / çizgi kalınlığı (line), mm
  opacity?: number; // 0..1 saydamlık — vars. 1
  cornerRadiusMm?: number; // sadece rect — köşe yuvarlaklığı (mm), vars. 0
  variant?: DividerVariant; // type === "divider" — ayraç deseni
};

// Sürüklenebilir şablon nesne kimlikleri.
const EDITABLE_IDS = new Set([
  "title",
  "author",
  "subtitle",
  "logo",
  "rule", // başlık altı çizgi / nokta ayraç
  "frame", // şablon çerçevesi
  "emblem", // şablon amblemi
  "panel", // başlık arkası okuma paneli
  "spineText", // sırt yazısı
  "barcode", // arka kapak barkodu (grup)
  "cover", // kapak görseli
]);
// Şablon nesnesi veya kullanıcı nesnesi (obj-…) ise düzenlenebilir say.
const isEditableId = (id?: string): id is string =>
  !!id && (EDITABLE_IDS.has(id) || id.startsWith("obj-"));
// Taşınamayan ama gizlenip silinebilen örtüler (katman panelinde görünür).
const OVERLAY_IDS = new Set(["darken", "background"]);
// Katman listesine girecek tüm kimlikler (düzenlenebilir + örtüler).
const isLayerId = (id?: string): id is string =>
  isEditableId(id) || (!!id && OVERLAY_IDS.has(id));
// Otomatik kontrast + gölge uygulanacak + öğe bazlı stil verilebilen yapısal
// metinler (başlık/yazar/altbaşlık/sırt). Okunurluk ve metin düzenleme ortak küme.
const READABLE_IDS = new Set(["title", "author", "subtitle", "spineText"]);
// fontFamily yığınından (ör. '"Manrope", sans-serif') geri font kimliği bulur.
function fontIdOf(family?: string): string {
  if (!family) return DEFAULT_COVER_FONT;
  const f = COVER_FONTS.find((c) => family.includes(c.family));
  return f?.id ?? DEFAULT_COVER_FONT;
}
// sRGB bağıl parlaklık (0=siyah … 1=beyaz). Metnin altındaki görsel bölgesini
// örnekleyip yazıyı otomatik beyaz/siyah seçmek için kullanılır (WCAG katsayıları).
function relLum(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const SNAP_GUIDE = "#c026d3"; // yapışma kılavuzu — mor

const COLOR_BORDER = "#cfc6b6";
const GUIDE_TRIM = "rgba(90,86,78,0.45)";
const GUIDE_CROP = "#000000";
// Kesim işaretlerinin altına çizilen beyaz "hale": koyu kapakta da görünsünler.
const GUIDE_CROP_HALO = "rgba(255,255,255,0.9)";
const GUIDE_FOLD = "rgba(232,97,43,0.7)";
const GUIDE_LABEL = "rgba(40,38,34,0.55)";

const MAX_DISPLAY_WIDTH = 1200;

export type CoverCanvasHandle = {
  /** Baskı için tuvali verilen DPI'da PNG dataURL olarak verir (ekran yardımcıları hariç). */
  getPrintDataUrl: (dpi: number) => string | null;
  /** Seçili nesneyi bulunduğu bölgenin güvenli alanına göre hizalar. */
  alignSelected: (mode: AlignMode) => void;
  /** Seçili nesneyi verilen dereceye döndürür. */
  setSelectedAngle: (deg: number) => void;
};

type FabricCanvasInstance = {
  dispose: () => void;
  getObjects: () => Array<{ visible?: boolean; set: (k: string, v: unknown) => void } & Record<string, unknown>>;
  renderAll: () => void;
  toDataURL: (opts: Record<string, unknown>) => string;
};

const CoverCanvas = forwardRef<CoverCanvasHandle, {
  spread: SpreadDimensions;
  labels: Labels;
  /** Kitabın dili — büyük harf dönüşümü (tr: i→İ) buna göre yapılır. */
  lang?: "tr" | "en";
  templateId: string;
  colors: CoverColors;
  content: CoverContent;
  showGuides: boolean;
  images: CoverImages;
  objects: CustomObject[];
  positions: PositionMap;
  layers: LayerMap;
  hidden: Record<string, boolean>;
  locked: Record<string, boolean>;
  autoContrast: boolean; // başlık/yazar arka plana göre oto beyaz/siyah + gölge
  textStyles: TextStyleMap; // yapısal metinlerin öğe bazlı stilleri
  selectedId: string | null; // dışarıdan (katman listesi) seçim — tuvalde seç
  onPositionChange: (id: string, t: ObjTransform) => void;
  onSelect: (id: string | null) => void;
  onTextSelect: (style: TextStyle | null) => void; // seçili metnin canlı stili
  onGeometrySelect: (geo: ObjGeometry | null) => void; // seçili nesnenin ölçüsü
  onAngleChange: (deg: number) => void;
  onLayersChange: (ids: string[]) => void;
  // Tuval (zemin + görsel + logolar + metin) tam çizildiğinde çağrılır — async
  // görsel yüklemeleri dahil. Otomatik PDF/PNG çıktısı için "hazır" sinyali.
  onReady?: () => void;
}>(function CoverCanvas({
  spread,
  labels,
  lang,
  templateId,
  colors,
  content,
  showGuides,
  images,
  objects,
  positions,
  layers,
  hidden,
  locked,
  autoContrast,
  textStyles,
  selectedId,
  onPositionChange,
  onSelect,
  onTextSelect,
  onGeometrySelect,
  onAngleChange,
  onLayersChange,
  onReady,
}, ref) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<{ dispose: () => void } | null>(null);
  const displayDpiRef = useRef(96);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  // Yazı tipleri yüklenince tuval yeniden çizilsin (ilk boyamada fallback fontla
  // çizilmesini önler). document.fonts hazır olunca true olur.
  const [fontsReady, setFontsReady] = useState(false);

  // Olay işleyicilerinin her zaman en güncel değere ulaşması için ref'ler.
  const spreadRef = useRef(spread);
  const positionsRef = useRef(positions);
  const layersRef = useRef(layers);
  const hiddenRef = useRef(hidden);
  const lockedRef = useRef(locked);
  const onPosRef = useRef(onPositionChange);
  const onSelRef = useRef(onSelect);
  const onTextSelRef = useRef(onTextSelect);
  const onGeoRef = useRef(onGeometrySelect);
  const onAngleRef = useRef(onAngleChange);
  const onLayersRef = useRef(onLayersChange);
  const onReadyRef = useRef(onReady);
  const textStylesRef = useRef(textStyles);
  const pxRef = useRef<(mm: number) => number>(() => 0);
  const mmRef = useRef<(pxVal: number) => number>(() => 0);
  const selectedIdRef = useRef<string | null>(null);
  // Tuval programlı olarak yeniden kurulurken (canvas.clear + nesneleri yeniden
  // ekleme) fabric "selection:cleared/created" olayları tetiklenir. Bunlar parent'a
  // yansırsa selectedId bir an null↔id gidip gelir → sağ panel (ve içindeki metin
  // kutusu) sökülüp yeniden kurulur (odak kaybı, "tek harf" hatası) ve render
  // döngüsü oluşur. Bu bayrak true iken seçim olayları parent'a YANSITILMAZ.
  const rebuildingRef = useRef(false);
  // Dış seçim senkronu, render effect içindeki reportSel'i çağırabilsin diye saklarız.
  const reportSelRef = useRef<((o: unknown) => void) | null>(null);
  // Render sonunda seçili nesnenin GÜNCEL ölçüsünü panele tazelemek için (sayısal
  // düzenleme tuval olayı tetiklemediğinden panel eski değerde kalmasın).
  const reportGeoRef = useRef<((o: unknown) => void) | null>(null);
  // Panele en son bildirilen katman listesi — aynıysa tekrar bildirme (render churn).
  const lastLayersRef = useRef<string>("");
  // Panele en son bildirilen seçili ölçü/konum — DEĞİŞMEDİYSE setSelectedGeoLive'ı
  // tekrar çağırma. Aksi halde her render'da yeni nesne referansı üretip parent'ı
  // gereksiz yere render eder; kararsız bir bağımlılıkla birleşince sonsuz döngü
  // ("Maximum update depth") amplifikatörü olur. lastLayersRef ile aynı mantık.
  const lastGeoRef = useRef<string | null>(null);
  const guidesRef = useRef<unknown[]>([]);
  // Her nesnenin oluşturulduğu andaki "temel" ölçeği (editId → {sx, sy}).
  // Kullanıcı boyutu buna GÖRE oran olarak saklanır → ekran yeniden ölçeklenince bozulmaz.
  const baseScaleRef = useRef<Record<string, { sx: number; sy: number }>>({});
  spreadRef.current = spread;
  positionsRef.current = positions;
  layersRef.current = layers;
  hiddenRef.current = hidden ?? {};
  lockedRef.current = locked ?? {};
  onPosRef.current = onPositionChange;
  onSelRef.current = onSelect;
  onTextSelRef.current = onTextSelect;
  onGeoRef.current = onGeometrySelect;
  onAngleRef.current = onAngleChange;
  onLayersRef.current = onLayersChange;
  onReadyRef.current = onReady;
  textStylesRef.current = textStyles;

  // Bir nesnenin güncel dönüşümünü kayıt formatına çevirir (konum + oran + açı).
  // Ref'lerden okuduğu için her zaman en güncel değerleri kullanır.
  const buildTransform = (o: {
    editId?: string;
    left: number;
    top: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
  }): ObjTransform => {
    const base =
      (o.editId ? baseScaleRef.current[o.editId] : undefined) ?? { sx: 1, sy: 1 };
    return {
      leftMm: mmRef.current(o.left),
      topMm: mmRef.current(o.top),
      scaleX: base.sx ? (o.scaleX ?? 1) / base.sx : 1,
      scaleY: base.sy ? (o.scaleY ?? 1) / base.sy : 1,
      angle: o.angle ?? 0,
    };
  };

  useImperativeHandle(ref, () => ({
    getPrintDataUrl: (dpi: number) => {
      const canvas = fabricCanvasRef.current as
        | (FabricCanvasInstance & { discardActiveObject?: () => void })
        | null;
      if (!canvas) return null;
      const multiplier = dpi / displayDpiRef.current;
      // Seçim çerçevesi baskıya sızmasın.
      canvas.discardActiveObject?.();
      const screenOnly = canvas.getObjects().filter((o) => o._screenOnly === true);
      screenOnly.forEach((o) => o.set("visible", false));
      canvas.renderAll();
      const url = canvas.toDataURL({
        format: "png",
        multiplier,
        enableRetinaScaling: false,
      });
      screenOnly.forEach((o) => o.set("visible", true));
      canvas.renderAll();
      return url;
    },
    alignSelected: (mode: AlignMode) => {
      const canvas = fabricCanvasRef.current as unknown as {
        getActiveObject: () => Record<string, unknown> | null | undefined;
        requestRenderAll: () => void;
      } | null;
      if (!canvas) return;
      const o = canvas.getActiveObject() as
        | (Record<string, unknown> & {
            editId?: string;
            left: number;
            getCenterPoint: () => { x: number; y: number };
            getScaledWidth: () => number;
            setCoords: () => void;
            top: number;
            scaleX?: number;
            scaleY?: number;
            angle?: number;
          })
        | null
        | undefined;
      if (!o || !o.editId) return;
      const sp = spreadRef.current;
      const pxf = pxRef.current;
      const c = o.getCenterPoint();
      // Nesne hangi bölgedeyse (arka / sırt / ön) o bölgenin güvenli alanına hizala.
      let safeL: number, safeR: number;
      if (c.x < pxf(sp.spineStart)) {
        safeL = sp.backSafeLeft;
        safeR = sp.backSafeRight;
      } else if (c.x < pxf(sp.spineEnd)) {
        safeL = sp.spineStart;
        safeR = sp.spineEnd;
      } else {
        safeL = sp.frontSafeLeft;
        safeR = sp.frontSafeRight;
      }
      const halfW = o.getScaledWidth() / 2;
      let targetCx: number;
      if (mode === "left") targetCx = pxf(safeL) + halfW;
      else if (mode === "right") targetCx = pxf(safeR) - halfW;
      else targetCx = (pxf(safeL) + pxf(safeR)) / 2;
      o.left += targetCx - c.x;
      o.setCoords();
      canvas.requestRenderAll();
      onPosRef.current(o.editId, buildTransform(o));
    },
    setSelectedAngle: (deg: number) => {
      const canvas = fabricCanvasRef.current as unknown as {
        getActiveObject: () => Record<string, unknown> | null | undefined;
        requestRenderAll: () => void;
      } | null;
      if (!canvas) return;
      const o = canvas.getActiveObject() as
        | (Record<string, unknown> & {
            editId?: string;
            left: number;
            top: number;
            scaleX?: number;
            scaleY?: number;
            angle?: number;
            setCoords: () => void;
            rotate?: (deg: number) => void;
          })
        | null
        | undefined;
      if (!o || !o.editId) return;
      // rotate() merkez etrafında döndürür (fare tutamacıyla aynı davranış);
      // yoksa açıyı doğrudan ata.
      if (typeof o.rotate === "function") o.rotate(deg);
      else o.angle = deg;
      o.setCoords();
      canvas.requestRenderAll();
      onPosRef.current(o.editId, buildTransform(o));
    },
  }));

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // İlk ölçümü SENKRON yap: bu effect boyama sonrası çalışır, yani kutu
    // gerçek boyutundadır. Yalnız ResizeObserver'ın ilk (async) bildirimine
    // güvenmek bazı düzen yarışlarında containerW=0'da takılı kalmaya yol
    // açıyordu → fabric hiç başlatılmıyordu (tuval 300×150 kalıyordu).
    // contentRect = içerik kutusu (padding hariç) olduğundan, padding'i çıkar.
    const cs = getComputedStyle(el);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    setContainerW(el.clientWidth - padX);
    setContainerH(el.clientHeight - padY);
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
      setContainerH(entries[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Kapak yazı tiplerini önceden yükle; hazır olunca yeniden çizimi tetikle.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    Promise.all(
      COVER_FONT_FAMILIES.map((f) =>
        document.fonts.load(`16px "${f}"`).catch(() => undefined),
      ),
    )
      .then(() => document.fonts.ready)
      .then(() => {
        if (alive) setFontsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (containerW === 0) return;
    let disposed = false;

    async function render() {
      const fabric = await import("fabric");
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (disposed || !canvasElRef.current) return;

      // Tuval, çevreleyen kutuya HEM ene HEM boya sığsın (Canva gibi ortalı).
      // Kapak yatay olduğundan çoğu ekranda yükseklik belirleyici olur → taşmaz.
      const aspect = spread.totalWidth / spread.totalHeight;
      const heightCap = containerH > 0 ? containerH * aspect : Infinity;
      const targetW = Math.min(containerW, heightCap, MAX_DISPLAY_WIDTH);
      const displayDpi = (targetW / spread.totalWidth) * 25.4;
      displayDpiRef.current = displayDpi;
      const pxW = Math.round(targetW);
      const pxH = Math.round(targetW * (spread.totalHeight / spread.totalWidth));
      const px = (mm: number) => mmToPx(mm, displayDpi);
      pxRef.current = px;
      // px → mm: YUVARLANMAMIŞ tam ölçek kullan. (px(1) yuvarlandığı için
      // onu kullanmak konumu sağa/sola kaydırırdı.) px() geri uygularken
      // round(mm * S) yaptığından, S aynı olunca gidiş-dönüş birebir olur.
      const pxPerMm = displayDpi / 25.4;
      mmRef.current = (pxVal: number) => (pxPerMm > 0 ? pxVal / pxPerMm : 0);

      let canvas = fabricCanvasRef.current as InstanceType<typeof fabric.Canvas> | null;
      if (!canvas) {
        canvas = new fabric.Canvas(canvasElRef.current, {
          selection: false,
          backgroundColor: "#ffffff",
          renderOnAddRemove: false,
          preserveObjectStacking: true,
        });
        fabricCanvasRef.current = canvas;

        const cv = canvas;
        type AnyObj = Record<string, unknown> & {
          editId?: string;
          left: number;
          top: number;
          scaleX?: number;
          scaleY?: number;
          angle?: number;
          getCenterPoint: () => { x: number; y: number };
          setCoords: () => void;
        };

        const clearGuides = () => {
          if (guidesRef.current.length) {
            guidesRef.current.forEach((g) => cv.remove(g as never));
            guidesRef.current = [];
            cv.requestRenderAll();
          }
        };
        const persist = (o: AnyObj | undefined) => {
          if (!o?.editId) return;
          onPosRef.current(o.editId, buildTransform(o));
          onAngleRef.current(Math.round(o.angle ?? 0));
        };
        // Seçili nesnenin o anki ölçü/konumunu (mm) panele bildir.
        const reportGeo = (o: AnyObj | undefined) => {
          const go = o as unknown as {
            left?: number;
            top?: number;
            getScaledWidth?: () => number;
            getScaledHeight?: () => number;
          } | undefined;
          if (
            go &&
            typeof go.getScaledWidth === "function" &&
            typeof go.getScaledHeight === "function"
          ) {
            const r1 = (v: number) => Math.round(v * 10) / 10;
            const geo = {
              leftMm: r1(mmRef.current(go.left ?? 0)),
              topMm: r1(mmRef.current(go.top ?? 0)),
              widthMm: r1(mmRef.current(go.getScaledWidth())),
              heightMm: r1(mmRef.current(go.getScaledHeight())),
            };
            // DEĞİŞMEDİYSE bildirme → her render'da yeni nesne üretip parent'ı
            // gereksiz render etme; render churn / döngü amplifikasyonunu engelle.
            const key = `${geo.leftMm}|${geo.topMm}|${geo.widthMm}|${geo.heightMm}`;
            if (key === lastGeoRef.current) return;
            lastGeoRef.current = key;
            onGeoRef.current(geo);
          } else {
            if (lastGeoRef.current === null) return;
            lastGeoRef.current = null;
            onGeoRef.current(null);
          }
        };
        reportGeoRef.current = reportGeo as (o: unknown) => void;

        cv.on("object:moving", (e) => {
          const o = e.target as unknown as AnyObj | undefined;
          if (!o) return;
          const sp = spreadRef.current;
          const pxf = pxRef.current;
          const th = pxf(2.5); // ~2.5 mm yapışma toleransı
          clearGuides();
          // Yatay: arka/sırt/ön merkezlerine yapış → dikey mor kılavuz.
          const c = o.getCenterPoint();
          const xs = [sp.backCenter, sp.spineCenter, sp.frontCenter].map(pxf);
          for (const tx of xs) {
            if (Math.abs(c.x - tx) < th) {
              o.left += tx - c.x;
              o.setCoords();
              const gl = new fabric.Line([tx, 0, tx, cv.height ?? 0], {
                stroke: SNAP_GUIDE,
                strokeWidth: 1,
                selectable: false,
                evented: false,
                _screenOnly: true,
              });
              cv.add(gl);
              guidesRef.current.push(gl);
              break;
            }
          }
          // Dikey: kapak orta hattına yapış → yatay mor kılavuz.
          const ty = pxf(sp.midY);
          const cy = o.getCenterPoint().y;
          if (Math.abs(cy - ty) < th) {
            o.top += ty - cy;
            o.setCoords();
            const gl = new fabric.Line([0, ty, cv.width ?? 0, ty], {
              stroke: SNAP_GUIDE,
              strokeWidth: 1,
              selectable: false,
              evented: false,
              _screenOnly: true,
            });
            cv.add(gl);
            guidesRef.current.push(gl);
          }
          // Sınır kilidi: nesnenin GÖRÜNEN KUTUSU (bbox) trim/kesim alanı içinde
          // kalsın → kenardan/kesim hattından taşma engellenir (KDP güvenli alan).
          // Nesne trim alanından büyükse o eksende ortalanır (tamamen kaybolamaz).
          {
            const ob = o as unknown as {
              getBoundingRect?: (
                a?: boolean,
                c?: boolean,
              ) => { left: number; top: number; width: number; height: number };
            };
            if (typeof ob.getBoundingRect === "function") {
              const minX = pxf(sp.backStart),
                maxX = pxf(sp.frontEnd),
                minY = pxf(sp.topTrim),
                maxY = pxf(sp.bottomTrim);
              const bb = ob.getBoundingRect(true, true);
              const shift = (lo: number, len: number, min: number, max: number) => {
                if (len >= max - min) return (min + max) / 2 - (lo + len / 2);
                if (lo < min) return min - lo;
                if (lo + len > max) return max - (lo + len);
                return 0;
              };
              const dx = shift(bb.left, bb.width, minX, maxX);
              const dy = shift(bb.top, bb.height, minY, maxY);
              if (dx !== 0 || dy !== 0) {
                o.left += dx;
                o.top += dy;
                o.setCoords();
              }
            }
          }
          reportGeo(o); // panel X/Y kutuları sürüklerken canlı güncellensin
        });
        cv.on("object:scaling", (e) => {
          reportGeo(e.target as unknown as AnyObj | undefined);
        });
        cv.on("object:modified", (e) => {
          const o = e.target as unknown as AnyObj | undefined;
          persist(o);
          reportGeo(o);
          clearGuides();
        });
        // Döndürürken açıyı canlı bildir (panel kutusu güncellensin).
        cv.on("object:rotating", (e) => {
          const o = e.target as unknown as AnyObj | undefined;
          if (o) onAngleRef.current(Math.round(o.angle ?? 0));
        });
        cv.on("mouse:up", clearGuides);
        const reportSel = (o: AnyObj | undefined) => {
          // Programlı yeniden kurulum sırasındaki seçim olaylarını yok say:
          // selectedId/panel state'ine dokunma (odak kaybı + döngü engellenir).
          if (rebuildingRef.current) return;
          const id = o?.editId ?? null;
          selectedIdRef.current = id;
          onSelRef.current(id);
          onAngleRef.current(Math.round(o?.angle ?? 0));
          // Seçim bir metinse canlı stilini bildir (panel mevcut değerleri göstersin).
          const to = o as unknown as {
            fontSize?: number;
            fontFamily?: string;
            fill?: unknown;
          } | undefined;
          if (to && typeof to.fontSize === "number") {
            const mm = mmRef.current(to.fontSize);
            onTextSelRef.current({
              fontId: fontIdOf(to.fontFamily),
              fontSizeMm: Math.round(mm * 2) / 2,
              color: typeof to.fill === "string" ? to.fill : undefined,
            });
          } else {
            onTextSelRef.current(null);
          }
          // Seçili nesnenin ölçü/konumunu (mm) bildir — sayısal X/Y/G/Y paneli için.
          reportGeo(o);
        };
        reportSelRef.current = reportSel as (o: unknown) => void;
        cv.on("selection:created", (e) =>
          reportSel(e.selected?.[0] as unknown as AnyObj | undefined),
        );
        cv.on("selection:updated", (e) =>
          reportSel(e.selected?.[0] as unknown as AnyObj | undefined),
        );
        cv.on("selection:cleared", () => reportSel(undefined));
      }

      // Yeniden çizimden önce seçili nesnenin kimliğini sakla (clear seçimi siler).
      const keepSel = selectedIdRef.current;
      // Yeniden kurulum başlıyor: bundan sonraki fabric seçim olayları (clear +
      // yeniden ekleme + yeniden seçme) parent state'ine YANSIMASIN.
      rebuildingRef.current = true;
      canvas.setDimensions({ width: pxW, height: pxH });
      canvas.clear();
      canvas.backgroundColor = "#ffffff";

      const template = getTemplate(templateId);
      const barcodeUrl = generateBarcodeDataUrl(content.isbn);
      // Ön kapakta alt-logo (KDY markası vb.) varsa, altında bir bant ayır →
      // şablonun alt-hizalı yazar adı bu kadar yukarı kayar, logoyla çakışmaz.
      // Logo yüksekliği yüklenmeden bilinmediğinden geniş marka logosu (~2,2
      // en/boy) varsayımı + boşlukla tahmin edilir.
      const hasBottomLogo = !!images.logo && images.logoPos === "bottom";
      const bottomReserveMm = hasBottomLogo
        ? (spread.bookWidth * (images.logoSize / 100)) / 2.2 + spread.bookHeight * 0.025
        : 0;
      // colors bir an için boş gelirse (canlı güncelleme sırasında) şablonun kendi paletine düş.
      const ctx = {
        fabric,
        canvas,
        px,
        d: spread,
        content,
        barcodeUrl,
        colors: colors ?? template.palette,
        bottomReserveMm,
        lang,
        // Görsel varken şablon süsleri (çizgi/çerçeve/amblem) çizilmez.
        hasImage: !!images.cover,
      };

      // 1) Zemin rengi (editId "background"). Katman panelinden gizlenmişse görünmez yap.
      template.base(ctx);
      if ((hiddenRef.current ?? {})["background"]) {
        for (const o of canvas.getObjects() as unknown as Array<{
          editId?: string;
          set: (opts: Record<string, unknown>) => void;
        }>) {
          if (o.editId === "background") o.set({ visible: false });
        }
      }

      // 2) Kapak görseli (object-fit cover + kırpma) ve karartma örtüsü.
      if (images.cover) {
        const rectMm =
          images.coverScope === "wrap"
            ? { x: 0, y: 0, w: spread.totalWidth, h: spread.totalHeight }
            : {
                x: spread.spineEnd,
                y: 0,
                w: spread.totalWidth - spread.spineEnd,
                h: spread.totalHeight,
              };
        const rx = px(rectMm.x), ry = px(rectMm.y), rw = px(rectMm.w), rh = px(rectMm.h);

        const img = await fabric.FabricImage.fromURL(images.cover);
        if (disposed || !fabricCanvasRef.current) return;
        const iw = img.width ?? 1;
        const ih = img.height ?? 1;
        // Doldur (cover, Math.max → alanı kaplar, kenarlar kırpılabilir) ya da
        // Sığdır (contain, Math.min → görselin tamamı görünür, kenarda boşluk kalabilir).
        const zoom = Math.max(1, images.coverZoom || 1);
        const fitScale =
          images.coverFit === "fit"
            ? Math.min(rw / iw, rh / ih)
            : Math.max(rw / iw, rh / ih);
        const scale = fitScale * zoom;
        // Kadraja sığmayan taşma kadarını yatay kaydırmaya izin ver (-1..1).
        const overflowX = Math.max(0, iw * scale - rw);
        const panX = Math.max(-1, Math.min(1, images.coverPanX || 0));
        img.set({
          originX: "center",
          originY: "center",
          left: rx + rw / 2 + (panX * overflowX) / 2,
          top: ry + rh / 2,
          scaleX: scale,
          scaleY: scale,
          opacity: Math.max(0, Math.min(1, images.coverOpacity ?? 1)),
          editId: "cover",
          selectable: false,
          evented: false,
        });
        img.clipPath = new fabric.Rect({
          left: rx + rw / 2,
          top: ry + rh / 2,
          width: rw,
          height: rh,
          originX: "center",
          originY: "center",
          absolutePositioned: true,
        });
        canvas.add(img);

        // Karartma örtüsü: editId "darken" ile katman listesine girer; göz ikonuyla
        // gizlenince (visible:false) hem ekranda hem baskıda yok olur. Taşınamaz/boyutlanamaz.
        if (images.coverDarken > 0) {
          const darkenHidden = !!(hiddenRef.current ?? {})["darken"];
          canvas.add(
            new fabric.Rect({
              left: rx,
              top: ry,
              width: rw,
              height: rh,
              fill: `rgba(0,0,0,${images.coverDarken})`,
              editId: "darken",
              visible: !darkenHidden,
              selectable: false,
              evented: false,
            }),
          );
        }
      }

      // 3) Şablonun ön planı (tasarım + başlık/yazar/barkod) — görselin üstünde.
      template.foreground(ctx);

      // 3a) Yapısal metin stilleri — kullanıcı başlık/yazar/altbaşlık/sırt için
      // font/boyut/renk seçtiyse uygula. Renk seçilmişse _userColor işaretle →
      // okunurluk adımı (4e) o metni atlasın (kullanıcı kontrolü öncelikli).
      {
        const styles = textStylesRef.current ?? {};
        for (const o of canvas.getObjects() as unknown as Array<{
          editId?: string;
          set: (opts: Record<string, unknown>) => void;
        }>) {
          if (!o.editId || !READABLE_IDS.has(o.editId)) continue;
          const st = styles[o.editId];
          if (!st) continue;
          if (st.fontId) o.set({ fontFamily: fontFamilyOf(st.fontId) });
          if (st.fontSizeMm != null) o.set({ fontSize: px(st.fontSizeMm) });
          if (st.color) o.set({ fill: st.color, _userColor: true });
        }
      }

      // 3a-fit) Başlık/yazar/altbaşlığı ön kapağın GÜVENLİ ALANINA sığdır. Tek uzun
      // kelime ya da büyük punto güvenli genişliği aşarsa fontu orantılı küçültürüz;
      // böylece yazı kenardan / kesim hattından taşmaz (KDP güvenli alan kuralı).
      {
        const FIT_IDS = new Set(["title", "author", "subtitle"]);
        const safeWpx = px(spread.bookWidth - spread.safeZone * 2);
        if (safeWpx > 0) {
          for (const o of canvas.getObjects() as unknown as Array<{
            editId?: string;
            fontSize?: number;
            getScaledWidth?: () => number;
            set: (opts: Record<string, unknown>) => void;
            initDimensions?: () => void;
            setCoords?: () => void;
          }>) {
            if (!o.editId || !FIT_IDS.has(o.editId)) continue;
            if (
              typeof o.getScaledWidth !== "function" ||
              typeof o.fontSize !== "number"
            )
              continue;
            const w = o.getScaledWidth();
            if (w <= safeWpx || w <= 0) continue;
            const minFont = px(4);
            const fs = Math.max(minFont, o.fontSize * (safeWpx / w) * 0.98);
            o.set({ fontSize: fs });
            o.initDimensions?.();
            o.setCoords?.();
          }
        }
      }

      // 3b) Gerçek ISBN barkodu — arka kapaktaki barkod alanına sığdır (contain).
      // Beyaz kutu + barkod görseli tek GRUP → birlikte taşınır.
      if (barcodeUrl) {
        const bx = px(spread.barcodeX), by = px(spread.barcodeY);
        const bw = px(spread.barcodeW), bh = px(spread.barcodeH);
        const box = new fabric.Rect({
          left: bx,
          top: by,
          width: bw,
          height: bh,
          fill: "#ffffff",
          rx: 3,
          ry: 3,
        });
        const bar = await fabric.FabricImage.fromURL(barcodeUrl);
        if (disposed || !fabricCanvasRef.current) return;
        const pad = Math.min(bw, bh) * 0.1;
        const innerW = bw - pad * 2, innerH = bh - pad * 2;
        const bscale = Math.min(innerW / (bar.width ?? 1), innerH / (bar.height ?? 1));
        bar.set({
          originX: "center",
          originY: "center",
          left: bx + bw / 2,
          top: by + bh / 2,
          scaleX: bscale,
          scaleY: bscale,
        });
        const barcodeOpts = { editId: "barcode", selectable: false, evented: false };
        canvas.add(new fabric.Group([box, bar], barcodeOpts));
      }

      // 4) Logo — ön kapakta konumlandır.
      if (images.logo) {
        const logo = await fabric.FabricImage.fromURL(images.logo);
        if (disposed || !fabricCanvasRef.current) return;
        const targetWmm = spread.bookWidth * (images.logoSize / 100);
        const lscale = px(targetWmm) / (logo.width ?? 1);
        // Logonun yüksekliğini (mm) en/boy oranından bul; güvenli çizgiye HİZALA:
        // alt logo → alt kenarı alt güvenli çizgide, üst logo → üst kenarı üst
        // güvenli çizgide (KDY kılavuzu: "alt güvenli alan çizgisine hizalanır").
        const logoHmm = targetWmm * ((logo.height ?? 1) / (logo.width ?? 1));
        const yMm =
          images.logoPos === "top"
            ? spread.topSafe + logoHmm / 2
            : spread.bottomSafe - logoHmm / 2;
        logo.set({
          originX: "center",
          originY: "center",
          left: px(spread.frontCenter),
          top: px(yMm),
          scaleX: lscale,
          scaleY: lscale,
          editId: "logo",
          selectable: false,
          evented: false,
        });
        canvas.add(logo);
      }

      // 4a) Kullanıcının eklediği serbest nesneler (metin + şekiller).
      // Ön kapağın ortasına düşer; konumu/boyutu 4b'deki kayıt makinesi uygular.
      {
        const fx = px(spread.frontCenter);
        const fy = px(spread.midY);
        // Şekil stili → fabric dolgu/kenar/saydamlık özelliklerine çevir.
        // "outline" (içi boş): dolgu şeffaf, renk kenara taşınır. strokeUniform=true
        // → nesne ölçeklense bile çerçeve kalınlığı sabit kalır (ezilmez/incelmez).
        const shapeProps = (o: CustomObject) => {
          const outline = o.shapeStyle === "outline";
          return {
            fill: outline ? "transparent" : o.fill,
            stroke: outline ? o.fill : undefined,
            strokeWidth: outline ? Math.max(px(o.strokeWidthMm ?? 0.8), 1) : 0,
            strokeUniform: true,
            opacity: o.opacity ?? 1,
          };
        };
        // 5 köşeli yıldız / elmas için köşe noktaları (merkez 0,0 etrafında).
        const starPoints = (outerR: number, innerR: number, spikes = 5) => {
          const pts: { x: number; y: number }[] = [];
          const step = Math.PI / spikes;
          let rot = -Math.PI / 2; // tepe yukarı baksın
          for (let i = 0; i < spikes; i++) {
            pts.push({ x: Math.cos(rot) * outerR, y: Math.sin(rot) * outerR });
            rot += step;
            pts.push({ x: Math.cos(rot) * innerR, y: Math.sin(rot) * innerR });
            rot += step;
          }
          return pts;
        };
        for (const obj of objects) {
          if (obj.type === "text") {
            canvas.add(
              new fabric.Textbox(obj.text && obj.text.length ? obj.text : " ", {
                fontFamily: fontFamilyOf(obj.fontId),
                fontSize: px(obj.fontSizeMm ?? 8),
                fill: obj.fill,
                // Hizalama + satır aralığı kullanıcı seçimine göre (varsayılan orta/normal).
                textAlign: obj.align ?? "center",
                lineHeight: obj.lineHeightMul ?? 1.16,
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                width: px(spread.bookWidth) * 0.8,
                editId: obj.id,
              }),
            );
          } else if (obj.type === "rect") {
            canvas.add(
              new fabric.Rect({
                width: px(40),
                height: px(25),
                rx: px(obj.cornerRadiusMm ?? 0),
                ry: px(obj.cornerRadiusMm ?? 0),
                ...shapeProps(obj),
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                editId: obj.id,
              }),
            );
          } else if (obj.type === "circle") {
            canvas.add(
              new fabric.Circle({
                radius: px(15),
                ...shapeProps(obj),
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                editId: obj.id,
              }),
            );
          } else if (obj.type === "triangle") {
            canvas.add(
              new fabric.Triangle({
                width: px(42),
                height: px(36),
                ...shapeProps(obj),
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                editId: obj.id,
              }),
            );
          } else if (obj.type === "diamond") {
            const d = px(20); // yarı köşegen
            // Polygon'un seçenek tipinde editId yok → nesneyi kurup sonra atıyoruz.
            const dia = new fabric.Polygon(
              [
                { x: 0, y: -d },
                { x: d, y: 0 },
                { x: 0, y: d },
                { x: -d, y: 0 },
              ],
              {
                ...shapeProps(obj),
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
              },
            );
            (dia as { editId?: string }).editId = obj.id;
            canvas.add(dia);
          } else if (obj.type === "star") {
            const st = new fabric.Polygon(starPoints(px(22), px(9)), {
              ...shapeProps(obj),
              originX: "center",
              originY: "center",
              left: fx,
              top: fy,
            });
            (st as { editId?: string }).editId = obj.id;
            canvas.add(st);
          } else if (obj.type === "line") {
            canvas.add(
              new fabric.Line([0, 0, px(50), 0], {
                stroke: obj.fill,
                strokeWidth: Math.max(px(obj.strokeWidthMm ?? 0.6), 2),
                strokeUniform: true,
                opacity: obj.opacity ?? 1,
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                editId: obj.id,
              }),
            );
          } else if (obj.type === "divider") {
            // Hazır dekoratif ayraç: birden çok küçük parçayı tek GRUP olarak ekler;
            // böylece kullanıcı tek nesne gibi taşır/ölçekler/döndürür.
            const color = obj.fill;
            const lw = Math.max(px(obj.strokeWidthMm ?? 0.5), 2);
            const W = px(70); // toplam ayraç genişliği
            const variant = obj.variant ?? "double";
            const ruleLine = (x1: number, x2: number, y: number) =>
              new fabric.Line([x1, y, x2, y], {
                stroke: color,
                strokeWidth: lw,
                strokeUniform: true,
              });
            const parts: object[] = [];
            if (variant === "double") {
              const g = px(1.4); // iki çizgi arası yarı boşluk
              parts.push(ruleLine(-W / 2, W / 2, -g));
              parts.push(ruleLine(-W / 2, W / 2, g));
            } else if (variant === "dotline") {
              const gap = px(4);
              parts.push(ruleLine(-W / 2, -gap, 0));
              parts.push(ruleLine(gap, W / 2, 0));
              parts.push(
                new fabric.Circle({
                  radius: px(1.5),
                  fill: color,
                  originX: "center",
                  originY: "center",
                  left: 0,
                  top: 0,
                }),
              );
            } else {
              // "diamond" — ortada küçük elmas, iki yanında çizgi
              const gap = px(5);
              const dr = px(2.4);
              parts.push(ruleLine(-W / 2, -gap, 0));
              parts.push(ruleLine(gap, W / 2, 0));
              parts.push(
                new fabric.Polygon(
                  [
                    { x: 0, y: -dr },
                    { x: dr, y: 0 },
                    { x: 0, y: dr },
                    { x: -dr, y: 0 },
                  ],
                  {
                    fill: color,
                    originX: "center",
                    originY: "center",
                    left: 0,
                    top: 0,
                  },
                ),
              );
            }
            const grp = new fabric.Group(parts as never[], {
              originX: "center",
              originY: "center",
              left: fx,
              top: fy,
              opacity: obj.opacity ?? 1,
            });
            (grp as { editId?: string }).editId = obj.id;
            canvas.add(grp);
          } else if (obj.type === "image" && obj.src) {
            // AI üretilen saydam PNG öğesi (mühür/rozet/amblem…). Logo deseni gibi
            // taban genişliğine ölçeklenir; kullanıcı çarpanı 4b'de üstüne uygulanır.
            // Bozuk/geçersiz data URL render'ı kilitlemesin → try/catch ile yut.
            try {
              const img = await fabric.FabricImage.fromURL(obj.src);
              // Bekleme sırasında bileşen yeniden çizildi/atıldıysa ekleme.
              if (disposed || !fabricCanvasRef.current) return;
              const natW = (img.width as number) || 1;
              const targetWmm = Math.min(spread.bookWidth * 0.45, 60);
              const base = px(targetWmm) / natW;
              img.set({
                originX: "center",
                originY: "center",
                left: fx,
                top: fy,
                scaleX: base,
                scaleY: base,
                editId: obj.id,
              });
              canvas.add(img);
            } catch {
              // sessizce atla — öğe çizilemezse diğer nesneler etkilenmesin
            }
          }
        }
      }

      // 4b) Düzenlenebilir nesneleri taşınabilir yap + kayıtlı konumları uygula.
      type EditObj = {
        editId?: string;
        scaleX?: number;
        scaleY?: number;
        getScaledWidth?: () => number;
        getScaledHeight?: () => number;
        set: (opts: Record<string, unknown>) => void;
        setCoords: () => void;
      };
      const hiddenMap = hiddenRef.current ?? {};
      const lockedMap = lockedRef.current ?? {};
      for (const o of canvas.getObjects() as unknown as EditObj[]) {
        if (!isEditableId(o.editId)) continue;
        const isHidden = !!hiddenMap[o.editId];
        const isLocked = !!lockedMap[o.editId];
        const interactive = !isHidden && !isLocked;
        o.set({
          visible: !isHidden, // göz kapalıysa görünmez (baskıya da girmez)
          selectable: interactive,
          evented: interactive,
          editable: false, // metin kutusuna çift tıkla yazı düzenlemeyi kapat
          hasControls: interactive, // köşeden boyutlandır + üst tutamaçtan döndür
          hasBorders: true,
          borderColor: SNAP_GUIDE,
          cornerColor: SNAP_GUIDE,
          cornerStyle: "circle",
          transparentCorners: false,
          cornerSize: 10,
          hoverCursor: interactive ? "move" : "default",
          // Kilitliyse hiçbir şekilde değişmesin.
          lockMovementX: isLocked,
          lockMovementY: isLocked,
          lockScalingX: isLocked,
          lockScalingY: isLocked,
          lockRotation: isLocked,
        });
        // Temel ölçeği (oluşturulduğu andaki) kaydet — kullanıcı boyutu buna oranla saklanır.
        const base = { sx: o.scaleX ?? 1, sy: o.scaleY ?? 1 };
        baseScaleRef.current[o.editId] = base;
        const ov = positionsRef.current[o.editId];
        if (ov) {
          // GÜVENLİK: yalnız geçerli (sonlu) değerleri uygula. Bozuk/NaN/0 ölçek
          // veya konum render'ı bozmasın (taslaktan gelen hatalı değerlere karşı).
          const fin = (v: unknown): v is number =>
            typeof v === "number" && Number.isFinite(v);
          if (fin(ov.leftMm)) o.set({ left: px(ov.leftMm) });
          if (fin(ov.topMm)) o.set({ top: px(ov.topMm) });
          if (fin(ov.scaleX) && ov.scaleX > 0)
            o.set({ scaleX: base.sx * ov.scaleX });
          if (fin(ov.scaleY) && ov.scaleY > 0)
            o.set({ scaleY: base.sy * ov.scaleY });
          if (fin(ov.angle)) o.set({ angle: ov.angle });
          // GÜVENLİK: aşırı büyük ölçek tarayıcıyı DONDURUR (fabric devasa bir cache
          // tuvali ayırmaya çalışır). Ölçekli boyutu tuvalin ~3 katıyla sınırla.
          if (
            typeof o.getScaledWidth === "function" &&
            typeof o.getScaledHeight === "function"
          ) {
            const capW = pxW * 3;
            const capH = pxH * 3;
            const sw = o.getScaledWidth();
            const sh = o.getScaledHeight();
            if (sw > capW && sw > 0)
              o.set({ scaleX: (o.scaleX ?? 1) * (capW / sw) });
            if (sh > capH && sh > 0)
              o.set({ scaleY: (o.scaleY ?? 1) * (capH / sh) });
          }
          o.setCoords();
        }
      }

      // 4b-2) ÇAKIŞMA KORUMASI — Üst başlık (kicker) çok satırlı / taşınmış başlığa
      // binmesin. Tüm konum override'ları uygulandıktan SONRA: alt başlığın altı
      // başlığın üstünü geçiyorsa, alt başlığı başlığın hemen üstüne kaydır.
      // Yalnız alt başlığın KENDİ konum override'ı yoksa müdahale et (kullanıcı onu
      // elle yerleştirdiyse dokunma) ve üst güvenli kenarın üstüne taşma.
      {
        type BoxObj = {
          editId?: string;
          top?: number;
          getBoundingRect?: (
            a?: boolean,
            b?: boolean,
          ) => { top: number; height: number };
          set: (o: Record<string, unknown>) => void;
          setCoords?: () => void;
        };
        const objs2 = canvas.getObjects() as unknown as BoxObj[];
        const titleO = objs2.find((o) => o.editId === "title");
        const subO = objs2.find((o) => o.editId === "subtitle");
        if (titleO && subO && !positionsRef.current["subtitle"]) {
          const tr = titleO.getBoundingRect?.(true, true);
          const sr = subO.getBoundingRect?.(true, true);
          if (tr && sr && typeof subO.top === "number") {
            const gapPx = px(2);
            const minTop = px(spread.topSafe);
            if (sr.top + sr.height > tr.top - gapPx) {
              // başlığın üstünden gapPx yukarıda olacak şekilde alt başlığı taşı
              const delta = tr.top - gapPx - (sr.top + sr.height);
              const newTop = Math.max(minTop, subO.top + delta);
              subO.set({ top: newTop });
              subO.setCoords?.();
            }
          }
        }
      }

      // 4c) Katman sırası — kullanıcı bir nesneyi öne/arkaya aldıysa uygula.
      // Bu noktada tuvalde yalnızca içerik nesneleri var (kılavuzlar sonra eklenir),
      // bu yüzden hepsini (seviye, özgün sıra) ile kararlı sırala ve yeniden diz.
      {
        const lay = layersRef.current;
        const objs = canvas.getObjects() as unknown as Array<{ editId?: string }>;
        // Bir nesnenin yığın seviyesi (büyük = önde/üstte):
        //  • "background" → her zaman en altta (dolu zemin asla içeriği örtmesin).
        //  • Kullanıcı bir katmanı elle sıraladıysa → o seviye.
        //  • Yeni eklenen kullanıcı nesnesi (henüz sıralanmamış "obj-…") → en üstte
        //    (kullanıcı eklediği şeyi hemen görsün; aksi halde zeminin altına düşerdi).
        //  • Diğer her şey → 0 (eklenme sırasını korur).
        const levelOf = (editId?: string): number => {
          if (editId === "background") return Number.MIN_SAFE_INTEGER;
          if (editId && lay[editId] != null) return lay[editId];
          if (editId && editId.startsWith("obj-")) return Number.MAX_SAFE_INTEGER;
          return 0;
        };
        const indexed = objs.map((o, i) => ({
          o,
          i,
          level: levelOf(o.editId),
        }));
        const sorted = [...indexed].sort(
          (a, b) => a.level - b.level || a.i - b.i,
        );
        if (sorted.some((s, i) => s.i !== i)) {
          sorted.forEach((s, i) => canvas.moveObjectTo(s.o as never, i));
        }
      }

      // 4d) Katman listesini panele bildir — ÖN'den ARKA'ya (tuval dizisi tersi:
      // dizide son = en önde). Panel üstten alta bu sırayı gösterir.
      {
        const ids: string[] = [];
        for (const o of canvas.getObjects() as unknown as Array<{ editId?: string }>) {
          // Düzenlenebilir nesneler + örtüler (karartma, zemin) listede görünür.
          if (isLayerId(o.editId)) ids.push(o.editId!);
        }
        ids.reverse();
        // Aynı sıra tekrar bildirilmesin → gereksiz parent state güncellemesi ve
        // olası render döngülerini engelle (boot-loop koruması).
        const key = ids.join("|");
        if (key !== lastLayersRef.current) {
          lastLayersRef.current = key;
          onLayersRef.current(ids);
        }
      }

      // 4e) OKUNURLUK — yapısal + serbest metinleri arka plana göre otomatik
      // beyaz/siyah yap. Arka plan UNIFORM ise sadece renk + ince halo gölge yeter.
      // Arka plan BÖLÜNMÜŞ/parlak-noktalı ise (ör. koyu zeminde parlak altın figür)
      // tek renk yazı her yerde okunmaz → metnin arkasına otomatik yarı saydam
      // PANEL (scrim) koyarız. Yalnız kapak görseli varken çalışır; metinler SON
      // konumlarında (override'lar uygulandıktan SONRA) örneklenir.
      if (images.cover && autoContrast) {
        type ReadObj = {
          editId?: string;
          visible?: boolean;
          _userColor?: boolean;
          getBoundingRect?: (
            absolute?: boolean,
            calculate?: boolean,
          ) => { left: number; top: number; width: number; height: number };
          set: (opts: Record<string, unknown>) => void;
        };
        // Yapısal metinlere EK olarak, kullanıcının eklediği serbest METİN
        // nesneleri de (tanıtım/gövde) okunurluğa dahil — yeter ki kullanıcı o
        // metnin rengini elle seçmemiş olsun (autoColor !== false).
        const autoTextIds = new Set(
          objects
            .filter(
              (o) => o.type === "text" && o.autoColor !== false && !o.panel,
            )
            .map((o) => o.id),
        );
        const all = canvas.getObjects() as unknown as ReadObj[];
        const targets = all.filter(
          (o) =>
            o.editId &&
            (READABLE_IDS.has(o.editId) || autoTextIds.has(o.editId)) &&
            o.visible !== false &&
            o._userColor !== true, // kullanıcı rengi seçtiyse otomatik kontrast atla
        );
        if (targets.length) {
          // Metinleri geçici GİZLE → alt tuvalde yalnız zemin + görsel kalsın;
          // her metnin tam altındaki pikselleri temsil eder.
          targets.forEach((o) => o.set({ visible: false }));
          canvas.renderAll();
          const lower = (canvas as unknown as { lowerCanvasEl?: HTMLCanvasElement })
            .lowerCanvasEl;
          const lctx =
            lower?.getContext("2d", { willReadFrequently: true }) ?? null;
          const dpr =
            (canvas as unknown as { getRetinaScaling?: () => number })
              .getRetinaScaling?.() ?? 1;
          // Arka planın hem ORTALAMA parlaklığını hem de "ne kadar bölünmüş"
          // olduğunu (parlak/koyu piksel oranları) ölç.
          const sampleBg = (r: {
            left: number;
            top: number;
            width: number;
            height: number;
          }): { mean: number; brightFrac: number; darkFrac: number } | null => {
            if (!lctx || !lower) return null;
            const x = Math.max(0, Math.floor(r.left * dpr));
            const y = Math.max(0, Math.floor(r.top * dpr));
            const w = Math.min(lower.width - x, Math.ceil(r.width * dpr));
            const h = Math.min(lower.height - y, Math.ceil(r.height * dpr));
            if (w <= 0 || h <= 0) return null;
            let data: Uint8ClampedArray;
            try {
              data = lctx.getImageData(x, y, w, h).data;
            } catch {
              return null; // tainted vb. → sessizce vazgeç (palet rengi kalır)
            }
            const step = Math.max(4, Math.floor((w * h) / 800) * 4) || 4;
            let sum = 0;
            let n = 0;
            let bright = 0;
            let dark = 0;
            for (let i = 0; i + 3 < data.length; i += step) {
              if (data[i + 3] === 0) continue; // şeffaf → atla
              const L = relLum(data[i], data[i + 1], data[i + 2]);
              sum += L;
              n++;
              if (L > 0.62) bright++;
              else if (L < 0.38) dark++;
            }
            if (n === 0) return null;
            return { mean: sum / n, brightFrac: bright / n, darkFrac: dark / n };
          };
          // 1. GEÇİŞ — tüm metinler GİZLİYKEN örnekle (metin metnin altını kirletmesin).
          const decisions = targets.map((o) => ({
            o,
            rect: o.getBoundingRect?.(true, true),
            bg: o.getBoundingRect ? sampleBg(o.getBoundingRect(true, true)) : null,
          }));
          targets.forEach((o) => o.set({ visible: true }));
          // 2. GEÇİŞ — renk + gerekiyorsa arkasına scrim panel.
          const PADx = px(3.5);
          const PADy = px(2.5);
          for (const { o, rect, bg } of decisions) {
            if (!bg) continue;
            let light = bg.mean < 0.5; // arka plan koyu → açık (beyaz) yazı
            // Scrim ne zaman gerekir?
            //  • Zemin ORTA TONLU/dokulu (ne tam koyu ne tam açık) → hiçbir düz yazı
            //    rengi güvenli okunmaz (ör. parlak+koyu işlemeli altın anahtar).
            //  • ya da seçilen yazı rengiyle ÇELİŞEN piksel oranı yüksek (beyaz
            //    yazıda parlak pikseller / koyu yazıda koyu pikseller).
            const midTone = bg.mean > 0.32 && bg.mean < 0.68;
            const conflict = light ? bg.brightFrac : bg.darkFrac;
            const needsScrim = midTone || conflict > 0.2;
            // Scrim varsa ve zemin orta tonluysa en güvenli eşleşme: koyu panel +
            // beyaz yazı (kapaklarda en okunaklı kombinasyon).
            if (needsScrim && midTone) light = true;
            if (needsScrim && rect) {
              const scrim = new fabric.Rect({
                left: rect.left - PADx,
                top: rect.top - PADy,
                width: rect.width + PADx * 2,
                height: rect.height + PADy * 2,
                fill: light ? "rgba(15,15,20,0.5)" : "rgba(250,250,250,0.62)",
                rx: px(2),
                ry: px(2),
                originX: "left",
                originY: "top",
                selectable: false,
                evented: false,
                hoverCursor: "default",
              });
              canvas.add(scrim);
              // Metnin hemen ALTINA al (scrim arkada, yazı önde).
              const ti = canvas.getObjects().indexOf(o as never);
              if (ti >= 0) canvas.moveObjectTo(scrim as never, ti);
            }
            o.set({
              fill: light ? "#ffffff" : "#111111",
              // Scrim zaten kontrast sağlıyor → ağır gölge gerekmez (daha temiz).
              shadow: needsScrim
                ? null
                : new fabric.Shadow({
                    color: light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)",
                    blur: Math.max(px(0.6), 2),
                    offsetX: 0,
                    offsetY: Math.max(px(0.3), 1),
                  }),
            });
          }
        }
      }

      // 4f) "Arkasına okuma paneli" açık serbest metinler — metne göre boyutlanan
      // koyu yarı saydam panel (scrim) + (otomatik renkliyse) beyaz yazı. Auto-
      // contrast'tan BAĞIMSIZ: kapak görseli olmasa da, parlak/bölünmüş zeminde
      // kullanıcı tek tıkla garanti okunurluk sağlayabilsin.
      {
        type PanelObj = {
          editId?: string;
          getBoundingRect?: (
            a?: boolean,
            b?: boolean,
          ) => { left: number; top: number; width: number; height: number };
          set: (o: Record<string, unknown>) => void;
        };
        const panelTexts = objects.filter((o) => o.type === "text" && o.panel);
        if (panelTexts.length) {
          const PADx = px(3.5);
          const PADy = px(2.5);
          const cobjs = canvas.getObjects() as unknown as PanelObj[];
          for (const pt of panelTexts) {
            const fo = cobjs.find((o) => o.editId === pt.id);
            if (!fo || !fo.getBoundingRect) continue;
            const r = fo.getBoundingRect(true, true);
            const scrim = new fabric.Rect({
              left: r.left - PADx,
              top: r.top - PADy,
              width: r.width + PADx * 2,
              height: r.height + PADy * 2,
              fill: "rgba(15,15,20,0.55)",
              rx: px(2),
              ry: px(2),
              originX: "left",
              originY: "top",
              selectable: false,
              evented: false,
              hoverCursor: "default",
            });
            canvas.add(scrim);
            const ti = canvas.getObjects().indexOf(fo as never);
            if (ti >= 0) canvas.moveObjectTo(scrim as never, ti);
            // Otomatik renkli metin → koyu panel üstünde beyaz (gölge gereksiz).
            if (pt.autoColor !== false) fo.set({ fill: "#ffffff", shadow: null });
          }
        }
      }

      // Yeniden çizimden önce seçili olan nesneyi tekrar seç.
      if (keepSel) {
        const again = (canvas.getObjects() as unknown as EditObj[]).find(
          (o) => o.editId === keepSel,
        );
        if (again) {
          canvas.setActiveObject(again as never);
          // KÖK NEDEN DÜZELTMESİ: Sayısal panelden (genişlik/yükseklik/konum)
          // yapılan değişiklikler tuvalde olay tetiklemez; bu yüzden parent'taki
          // canlı ölçü (selectedGeoLive) bayatlardı ve bir sonraki sayısal düzenleme
          // çarpanı patlatıp render'ı donduruyordu. Her render sonunda seçili
          // nesnenin GERÇEK ölçüsünü yeniden bildirerek ölçüyü taze tut.
          again.setCoords?.();
          reportGeoRef.current?.(again);
        }
      }
      // Yeniden kurulum bitti: seçim olayları yine parent'a yansıyabilir
      // (kullanıcı tuvalde nesneye tıklayınca panel normal şekilde açılır/değişir).
      rebuildingRef.current = false;

      // 5) Baskı kılavuzları.
      if (showGuides) {
        const staticProps = { selectable: false, evented: false, hoverCursor: "default", _screenOnly: true } as const;
        canvas.add(
          new fabric.Rect({
            left: px(spread.bleed),
            top: px(spread.bleed),
            width: px(spread.totalWidth - spread.bleed * 2),
            height: px(spread.totalHeight - spread.bleed * 2),
            fill: "transparent",
            stroke: GUIDE_TRIM,
            strokeWidth: 1,
            strokeDashArray: [6, 5],
            ...staticProps,
          }),
        );
        const foldLine = (xMm: number) =>
          new fabric.Line(
            [px(xMm), px(spread.bleed), px(xMm), px(spread.totalHeight - spread.bleed)],
            { stroke: GUIDE_FOLD, strokeWidth: 1, strokeDashArray: [6, 5], ...staticProps },
          );
        canvas.add(foldLine(spread.spineStart), foldLine(spread.spineEnd));

        const labelY = px(spread.bleed) + 6;
        const sectionLabel = (text: string, centerXmm: number) => {
          const lbl = new fabric.Textbox(text, {
            fontFamily: "Manrope, system-ui, sans-serif",
            fontSize: Math.max(px(4), 10),
            fontWeight: "600",
            fill: GUIDE_LABEL,
            textAlign: "center",
            width: px(spread.bookWidth) * 0.9,
            originX: "center",
            ...staticProps,
          });
          lbl.set({ left: px(centerXmm), top: labelY });
          return lbl;
        };
        canvas.add(
          sectionLabel(labels.backCover, spread.backCenter),
          sectionLabel(labels.frontCover, spread.frontCenter),
        );

        // Kesim işaretleri (cross) — dört trim köşesi, taşma payı içine uzanır.
        // Her çizgi çift katman: altta kalın BEYAZ hale, üstte ince SİYAH çizgi.
        // Böylece koyu kapakta da (beyaz çerçeve) görünür, açık kapakta da (siyah).
        const gap = 1;
        const reach = Math.max(spread.bleed - 0.5, gap + 1);
        const cropSeg = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          dashed = false,
        ) => {
          const dash = dashed ? { strokeDashArray: [3, 3] } : {};
          canvas.add(
            // hale (altta) — biraz daha kalın beyaz
            new fabric.Line([px(x1), px(y1), px(x2), px(y2)], {
              stroke: GUIDE_CROP_HALO,
              strokeWidth: 3,
              ...dash,
              ...staticProps,
            }),
            // çekirdek (üstte) — ince siyah
            new fabric.Line([px(x1), px(y1), px(x2), px(y2)], {
              stroke: GUIDE_CROP,
              strokeWidth: 1,
              ...dash,
              ...staticProps,
            }),
          );
        };
        const cropMark = (txMm: number, tyMm: number, dx: -1 | 1, dy: -1 | 1) => {
          cropSeg(txMm + dx * gap, tyMm, txMm + dx * reach, tyMm);
          cropSeg(txMm, tyMm + dy * gap, txMm, tyMm + dy * reach);
        };
        cropMark(spread.backStart, spread.topTrim, -1, -1);
        cropMark(spread.frontEnd, spread.topTrim, 1, -1);
        cropMark(spread.backStart, spread.bottomTrim, -1, 1);
        cropMark(spread.frontEnd, spread.bottomTrim, 1, 1);

        // Sırt katlama işaretleri — sırt başı/bitişinde, taşma payına doğru kesik çizgi.
        const spineFoldMark = (xMm: number) => {
          cropSeg(xMm, spread.topTrim - gap, xMm, spread.topTrim - reach, true);
          cropSeg(xMm, spread.bottomTrim + gap, xMm, spread.bottomTrim + reach, true);
        };
        spineFoldMark(spread.spineStart);
        spineFoldMark(spread.spineEnd);
      }

      // 6) Tuval kenarı (yalnızca ekran — baskıya girmez).
      canvas.add(
        new fabric.Rect({
          left: 0.5,
          top: 0.5,
          width: pxW - 1,
          height: pxH - 1,
          fill: "transparent",
          stroke: COLOR_BORDER,
          strokeWidth: 1,
          selectable: false,
          evented: false,
          _screenOnly: true,
        }),
      );

      canvas.requestRenderAll();
      // Tuval tam çizildi (async görseller dahil) → "hazır" sinyali. Otomatik
      // PDF çıktısı (indirme ekranından gelen export modu) bunu bekler.
      if (!disposed) onReadyRef.current?.();
    }

    render();
    return () => {
      disposed = true;
      // Bu render erken sonlandıysa (await sonrası disposed) bayrak true takılı
      // kalmasın → bir sonraki seçim olayları yine parent'a yansıyabilsin.
      rebuildingRef.current = false;
    };
  }, [spread, labels, lang, templateId, colors, content, showGuides, images, objects, positions, layers, hidden, locked, autoContrast, textStyles, containerW, containerH, fontsReady]);

  useEffect(() => {
    return () => {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // Dış seçim (katman listesine tıklayınca) → tuvalde nesneyi programlı seç.
  // Böylece kaybolan/ayırt edilemeyen nesne listeden seçilip düzenlenebilir.
  useEffect(() => {
    const canvas = fabricCanvasRef.current as unknown as {
      getObjects?: () => Array<{ editId?: string }>;
      getActiveObject?: () => { editId?: string } | null | undefined;
      setActiveObject?: (o: unknown) => void;
      discardActiveObject?: () => void;
      requestRenderAll?: () => void;
    } | null;
    if (!canvas?.getObjects) return;
    const active = canvas.getActiveObject?.();
    if ((active?.editId ?? null) === selectedId) return; // zaten seçili
    if (!selectedId) {
      // Dış taraf seçimi temizlediyse (panel "kapat" düğmesi, sekmeye geçiş)
      // tuvaldeki aktif nesneyi de bırak → iki taraf senkron kalsın.
      if (active) {
        canvas.discardActiveObject?.();
        canvas.requestRenderAll?.();
      }
      return;
    }
    const target = canvas
      .getObjects()
      .find((o) => o.editId === selectedId);
    if (target) {
      canvas.setActiveObject?.(target);
      canvas.requestRenderAll?.();
      reportSelRef.current?.(target);
    }
  }, [selectedId]);

  return (
    <div
      ref={wrapperRef}
      className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-[#efe9de] p-4"
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasElRef} className="block" />
    </div>
  );
});

export default CoverCanvas;
