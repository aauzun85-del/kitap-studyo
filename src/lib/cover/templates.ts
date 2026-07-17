import type { SpreadDimensions } from "./spread";
import { fontFamilyOf } from "./fonts";

// Şablonlar fabric'i dinamik yüklenmiş modül olarak alır.
type Fabric = typeof import("fabric");
type FabricCanvas = InstanceType<Fabric["Canvas"]>;

export type CoverContent = {
  title: string;
  author: string;
  subtitle: string;
  isbn: string;
};

// Kullanıcının özelleştirebildiği 3 ana renk.
export type CoverColors = {
  bg: string; // zemin (arka plan)
  ink: string; // yazı (başlık/yazar/alt başlık/sırt)
  accent: string; // vurgu (çizgi/etiket/şerit/çerçeve)
};

export type TemplateCtx = {
  fabric: Fabric;
  canvas: FabricCanvas;
  px: (mm: number) => number;
  d: SpreadDimensions;
  content: CoverContent;
  // Geçerli ISBN'den üretilen barkod (PNG dataURL); yoksa null → yer tutucu çizilir.
  barcodeUrl: string | null;
  // Etkin renkler: kullanıcı seçimi yoksa şablonun kendi paleti.
  colors: CoverColors;
  // Ön kapağın altında bir logo (örn. KDY markası) varsa, bu kadar mm'lik bir
  // bant logoya AYRILIR → alt-hizalı yazar adı bu kadar yukarı kayar, logoyla
  // üst üste binmez. Logo yoksa 0.
  bottomReserveMm?: number;
  // Kitabın dili: BÜYÜK HARF dönüşümü buna göre yapılır (tr: i→İ, ı→I).
  lang?: "tr" | "en";
  // Kapak görseli var mı? Varsa tipografik süsler (çizgi/çerçeve/amblem)
  // çizilmez — görselin üstünde anlamsız dururlar; başlık/yazar/panel kalır.
  hasImage?: boolean;
};

export type CoverTemplate = {
  id: string;
  name: { tr: string; en: string };
  swatch: string[];
  // Şablonun varsayılan 3 rengi (kullanıcı değiştirmezse bunlar kullanılır).
  palette: CoverColors;
  // Zemin rengi — kapak görseli bunun ÜSTÜNE, ön plandan ÖNCE çizilir.
  base: (ctx: TemplateCtx) => void;
  // Tasarım + başlık/yazar/barkod — görselin üstünde kalır.
  foreground: (ctx: TemplateCtx) => void;
};

const FONT = "Manrope, system-ui, sans-serif";

// ── Yardımcılar ────────────────────────────────────────────────

// Zemin rengi artık tam-tuval bir NESNE (editId "background") olarak çizilir →
// "Katman" panelinde görünür, göz ikonuyla gizlenip silinebilir. Taşınamaz.
function fill(ctx: TemplateCtx, color: string) {
  const { fabric, canvas, px, d } = ctx;
  const bgOpts = {
    left: 0,
    top: 0,
    width: px(d.totalWidth),
    height: px(d.totalHeight),
    fill: color,
    editId: "background",
    selectable: false,
    evented: false,
  };
  canvas.add(new fabric.Rect(bgOpts));
}

function rect(
  ctx: TemplateCtx,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  color: string,
) {
  const { fabric, canvas, px } = ctx;
  canvas.add(
    new fabric.Rect({
      left: px(xMm),
      top: px(yMm),
      width: px(wMm),
      height: px(hMm),
      fill: color,
      selectable: false,
      evented: false,
    }),
  );
}

type TextOpts = {
  cx: number; // merkez X (mm) — align "center" için
  leftMm?: number; // sol X (mm) — align "left" için
  top: number; // üst Y (mm)
  maxWidthMm: number;
  sizeMm: number;
  color: string;
  weight?: number | string;
  spacing?: number; // charSpacing (1/1000 em)
  upper?: boolean;
  lineHeight?: number;
  fontFamily?: string; // tuval font yığını (vars. FONT)
  align?: "center" | "left"; // vars. center
  editId?: string; // sürüklenebilir nesne kimliği (title/author/subtitle)
};

// Metni yerleştirir. align "center" → originX center; "left" → originX left.
// Hangisi olursa olsun yazı uzayınca taşmaz (textbox genişliğine sarar).
function centeredText(ctx: TemplateCtx, text: string, o: TextOpts) {
  const { fabric, canvas, px } = ctx;
  const isLeft = o.align === "left";
  // Türkçe kitapta i→İ, ı→I (JS varsayılanı i→I yapar, yanlış); İngilizcede standart.
  const upper = (s: string) => s.toLocaleUpperCase(ctx.lang === "en" ? "en" : "tr");
  const t = new fabric.Textbox(o.upper ? upper(text) : text, {
    left: isLeft ? px(o.leftMm ?? 0) : px(o.cx),
    top: px(o.top),
    width: px(o.maxWidthMm),
    fontFamily: o.fontFamily ?? FONT,
    fontSize: px(o.sizeMm),
    fontWeight: o.weight ?? "400",
    fill: o.color,
    textAlign: isLeft ? "left" : "center",
    originX: isLeft ? "left" : "center",
    originY: "top",
    charSpacing: o.spacing ?? 0,
    lineHeight: o.lineHeight ?? 1.15,
    editId: o.editId,
    selectable: false,
    evented: false,
  });
  canvas.add(t);
  return t;
}

// Dikey sırt yazısı (sırt yeterince genişse).
function spineText(ctx: TemplateCtx, color: string, fontFamily?: string) {
  const { fabric, canvas, px, d, content } = ctx;
  if (d.spine < 10) return;
  const text = content.author
    ? `${content.title}  ·  ${content.author}`
    : content.title;
  const t = new fabric.Textbox(text, {
    left: px(d.spineCenter),
    top: px(d.midY),
    width: px(d.bookHeight - d.safeZone * 2),
    fontFamily: fontFamily ?? FONT,
    fontSize: px(Math.min(d.spine * 0.45, 4.5)),
    fontWeight: "600",
    fill: color,
    textAlign: "center",
    originX: "center",
    originY: "center",
    angle: 90,
    editId: "spineText",
    selectable: false,
    evented: false,
  });
  canvas.add(t);
}

// Kısa, ortalanmış vurgu çizgisi (başlık altı).
function accentRule(ctx: TemplateCtx, cxMm: number, yMm: number, color: string) {
  const { fabric, canvas, px } = ctx;
  const half = px(9);
  const line = new fabric.Line(
    [px(cxMm) - half, px(yMm), px(cxMm) + half, px(yMm)],
    {
      stroke: color,
      strokeWidth: Math.max(px(0.6), 1.5),
    },
  );
  // Görünmez tutma alanı: çizgi çok ince olduğu için seçmeyi/sürüklemeyi
  // kolaylaştırır. Çizgi + alan tek grup → birlikte taşınır.
  const grabH = Math.max(px(4), 12);
  const hit = new fabric.Rect({
    left: px(cxMm) - half,
    top: px(yMm) - grabH / 2,
    width: half * 2,
    height: grabH,
    fill: "transparent",
  });
  const ruleOpts = { editId: "rule", selectable: false, evented: false };
  canvas.add(new fabric.Group([hit, line], ruleOpts));
}

// Tek bir çerçevenin 4 kenar çizgisini DÖNDÜRÜR (eklemez). Çağıran dış+iç
// çerçeveyi tek "frame" grubunda toplayabilsin diye.
function frameLines(
  ctx: TemplateCtx,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  color: string,
  strokeMm = 0.5,
): object[] {
  const { fabric, px } = ctx;
  const sw = Math.max(px(strokeMm), 1);
  const o = { stroke: color, strokeWidth: sw };
  const x = px(xMm), y = px(yMm), w = px(wMm), h = px(hMm);
  return [
    new fabric.Line([x, y, x + w, y], o),
    new fabric.Line([x, y + h, x + w, y + h], o),
    new fabric.Line([x, y, x, y + h], o),
    new fabric.Line([x + w, y, x + w, y + h], o),
  ];
}

// Arka kapak için gerçekçi barkod yer tutucusu.
function barcodePlaceholder(ctx: TemplateCtx, frameColor: string) {
  // Geçerli barkod varsa gerçek görsel CoverCanvas tarafından çizilir; yer tutucu atlanır.
  if (ctx.barcodeUrl) return;
  const { fabric, canvas, px, d } = ctx;
  const x = px(d.barcodeX), y = px(d.barcodeY), w = px(d.barcodeW), h = px(d.barcodeH);
  // Tüm parçaları bir diziye topla → tek GRUP olarak ekle (birlikte taşınır).
  const parts: object[] = [];
  parts.push(
    new fabric.Rect({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: "#ffffff",
      stroke: frameColor,
      strokeWidth: 1,
      rx: 3,
      ry: 3,
    }),
  );
  // Sahte barkod çizgileri.
  const barTop = y + h * 0.2;
  const barBottom = h * 0.45;
  const pad = w * 0.12;
  let cx = x + pad;
  const end = x + w - pad;
  let i = 0;
  while (cx < end) {
    const bw = (i % 3 === 0 ? 2.2 : i % 2 === 0 ? 1 : 1.6);
    parts.push(
      new fabric.Rect({
        left: cx,
        top: barTop,
        width: bw,
        height: barBottom,
        fill: "#1a1a1a",
      }),
    );
    cx += bw + 2.2;
    i++;
  }
  parts.push(
    new fabric.Textbox("ISBN 978-0-00-000000-0", {
      left: x + w / 2,
      top: y + h * 0.74,
      width: w,
      fontFamily: "monospace",
      fontSize: Math.max(h * 0.13, 7),
      fill: "#1a1a1a",
      textAlign: "center",
      originX: "center",
    }),
  );
  const barcodeOpts = { editId: "barcode", selectable: false, evented: false };
  canvas.add(new fabric.Group(parts as never[], barcodeOpts));
}

// ── Tarif (recipe) tabanlı şablon motoru ───────────────────────────
// Her şablon küçük bir VERİ tarifidir (font, başlık yeri, süs, bant, palet).
// Tek "drawTitleBlock" çizici tarifi okuyup ön kapağı kurar → estetik TEK yerde.

type Decoration = "none" | "rule" | "doubleRule" | "dots";
type TitlePos = "top" | "center" | "bottom";

export type TemplateRecipe = {
  id: string;
  name: { tr: string; en: string };
  palette: CoverColors;
  swatch?: string[];
  titleFontId: string; // COVER_FONTS id (serif/sans/display…)
  kickerFontId?: string; // vars. "sans"
  authorFontId?: string; // vars. "sans"
  titlePos?: TitlePos; // vars. "center"
  align?: "center" | "left"; // vars. "center"
  titleUpper?: boolean; // başlık BÜYÜK harf mi
  titleWeight?: number | string; // vars. 700
  titleScale?: number; // başlık boyut çarpanı (vars. 1)
  letterSpacingTitle?: number; // başlık harf aralığı (vars. 0)
  decoration?: Decoration; // başlık altı ayraç (vars. "rule")
  frame?: boolean; // ince çift çerçeve
  emblem?: boolean; // başlık üstü güneş/amblem motifi
  band?: "none" | "top" | "side"; // vurgu bandı
  panel?: boolean; // başlığın arkasına yarı saydam panel (görsel üstü okunurluk)
};

// Süs nesnesini "rule"/"frame"/... kimliğiyle ekler → Katman panelinde görünür,
// göz ikonuyla gizlenip kaldırılabilir (kullanıcı istemediği süsü silebilir).
function addDecor(ctx: TemplateCtx, parts: object[], editId: string) {
  const { fabric, canvas } = ctx;
  // editId, Group seçenek tipinde tanımlı değil → ayrı const ile excess-property
  // kontrolünü atlatırız (accentRule ile aynı desen).
  const opts = { editId, selectable: false, evented: false };
  canvas.add(new fabric.Group(parts as never[], opts));
}

// İki ince paralel çizgi (klasik ayraç).
function doubleRule(ctx: TemplateCtx, cxMm: number, yMm: number, color: string) {
  const { fabric, px } = ctx;
  const half = px(11);
  const g = Math.max(px(0.9), 2);
  const mk = (yy: number) =>
    new fabric.Line([px(cxMm) - half, yy, px(cxMm) + half, yy], {
      stroke: color,
      strokeWidth: Math.max(px(0.5), 1),
    });
  addDecor(ctx, [mk(px(yMm) - g), mk(px(yMm) + g)], "rule");
}

// Üç küçük nokta ayraç.
function dotsDivider(ctx: TemplateCtx, cxMm: number, yMm: number, color: string) {
  const { fabric, px } = ctx;
  const r = Math.max(px(0.7), 1.5);
  const gap = px(3);
  const parts = [-gap, 0, gap].map(
    (dx) =>
      new fabric.Circle({
        left: px(cxMm) + dx,
        top: px(yMm),
        radius: r,
        fill: color,
        originX: "center",
        originY: "center",
      }),
  );
  addDecor(ctx, parts, "rule");
}

// Güneş/amblem motifi: ince halka + ışınlar (mistik/klasik kapaklar için).
function emblem(ctx: TemplateCtx, cxMm: number, yMm: number, color: string) {
  const { fabric, canvas, px } = ctx;
  const R = px(7);
  const parts: object[] = [
    new fabric.Circle({
      left: 0,
      top: 0,
      radius: R,
      fill: "transparent",
      stroke: color,
      strokeWidth: Math.max(px(0.5), 1),
      originX: "center",
      originY: "center",
    }),
    new fabric.Circle({
      left: 0,
      top: 0,
      radius: px(2.6),
      fill: color,
      opacity: 0.5,
      originX: "center",
      originY: "center",
    }),
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r1 = R + px(1.2);
    const r2 = R + px(3.2);
    parts.push(
      new fabric.Line(
        [Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2],
        { stroke: color, strokeWidth: Math.max(px(0.4), 1) },
      ),
    );
  }
  const opts = {
    left: px(cxMm),
    top: px(yMm),
    originX: "center" as const,
    originY: "center" as const,
    editId: "emblem",
    selectable: false,
    evented: false,
  };
  canvas.add(new fabric.Group(parts as never[], opts));
}

// Başlığın arkasına yarı saydam koyu panel (görsel üstünde okunurluk).
function titlePanel(ctx: TemplateCtx, yTopMm: number, hMm: number) {
  const { fabric, canvas, px, d } = ctx;
  canvas.add(
    new fabric.Rect({
      left: px(d.frontSafeLeft) - px(1),
      top: px(yTopMm),
      width: px(d.frontSafeRight - d.frontSafeLeft) + px(2),
      height: px(hMm),
      fill: "rgba(15,18,28,0.5)",
      rx: px(2),
      ry: px(2),
      editId: "panel",
      selectable: false,
      evented: false,
    }),
  );
}

// Tarifi okuyup ön kapağı kurar (kicker → başlık → süs → yazar).
function drawTitleBlock(ctx: TemplateCtx, r: TemplateRecipe) {
  const { d, content, colors } = ctx;
  const align = r.align ?? "center";
  const pos = r.titlePos ?? "center";
  const titleFont = fontFamilyOf(r.titleFontId);
  const kickerFont = fontFamilyOf(r.kickerFontId ?? "sans");
  const authorFont = fontFamilyOf(r.authorFontId ?? "sans");

  // Yan bant varsa başlık bandın sağına kayar.
  let leftMm = d.frontSafeLeft;
  let maxW = d.frontSafeRight - d.frontSafeLeft;
  if (r.band === "side") {
    leftMm = d.spineEnd + d.bookWidth * 0.16 + d.safeZone;
    maxW = d.frontSafeRight - leftMm;
  }
  const cx = align === "left" ? leftMm : d.frontCenter;
  const decCx = align === "left" ? leftMm + 9 : d.frontCenter;

  const startRatio = pos === "top" ? 0.07 : pos === "bottom" ? 0.5 : 0.3;
  let y = d.topTrim + d.bookHeight * startRatio;
  const gap = d.bookHeight * 0.018;

  if (r.frame && !ctx.hasImage) {
    const fw = d.frontSafeRight - d.frontSafeLeft;
    const fh = d.bottomSafe - d.topSafe;
    addDecor(
      ctx,
      [
        ...frameLines(ctx, d.frontSafeLeft, d.topSafe, fw, fh, colors.accent, 0.5),
        ...frameLines(ctx, d.frontSafeLeft + 2, d.topSafe + 2, fw - 4, fh - 4, colors.accent, 0.3),
      ],
      "frame",
    );
  }
  if (r.emblem && !ctx.hasImage) {
    emblem(ctx, align === "left" ? leftMm + 8 : d.frontCenter, y, colors.accent);
    y += d.bookHeight * 0.075;
  }
  if (r.panel) {
    titlePanel(ctx, y - 4, d.bookHeight * 0.33);
  }

  if (content.subtitle) {
    const k = centeredText(ctx, content.subtitle, {
      cx,
      leftMm,
      align,
      top: y,
      maxWidthMm: maxW,
      sizeMm: Math.max(d.bookWidth * 0.03, 2.8),
      color: colors.accent,
      weight: "600",
      spacing: 300,
      upper: true,
      fontFamily: kickerFont,
      editId: "subtitle",
    });
    y += pxToMm(ctx, k.height ?? 0) + gap * 1.3;
  }

  const title = centeredText(ctx, content.title || " ", {
    cx,
    leftMm,
    align,
    top: y,
    maxWidthMm: maxW,
    sizeMm: d.bookWidth * 0.12 * (r.titleScale ?? 1),
    color: colors.ink,
    weight: r.titleWeight ?? "800",
    lineHeight: 1.06,
    upper: r.titleUpper,
    spacing: r.letterSpacingTitle ?? 0,
    fontFamily: titleFont,
    editId: "title",
  });
  y += pxToMm(ctx, title.height ?? 0) + gap;

  // Görselli kapakta süs çizgisi/noktalar çizilmez (görselin üstünde anlamsız
  // duran turuncu çizgi şikayeti); düz zeminli tipografik kapakta kalır.
  const dec = r.decoration ?? "rule";
  if (!ctx.hasImage) {
    if (dec === "rule") accentRule(ctx, decCx, y + gap * 0.4, colors.accent);
    else if (dec === "doubleRule") doubleRule(ctx, decCx, y + gap * 0.6, colors.accent);
    else if (dec === "dots") dotsDivider(ctx, decCx, y + gap, colors.accent);
  }

  if (content.author) {
    const a = {
      cx,
      leftMm,
      align,
      maxWidthMm: maxW,
      sizeMm: Math.max(d.bookWidth * 0.044, 3.4),
      color: colors.ink,
      weight: "600" as const,
      spacing: 220,
      upper: true,
      fontFamily: authorFont,
      editId: "author",
    };
    if (pos === "bottom") {
      centeredText(ctx, content.author, { ...a, top: y + gap * 2.5 });
    } else {
      // Alt logo varsa yazarı onun üstüne al (bottomReserveMm kadar yukarı).
      centeredTextBottom(ctx, content.author, {
        ...a,
        bottom: d.bottomSafe - (ctx.bottomReserveMm ?? 0),
      });
    }
  }
}

// Tarifi tam bir CoverTemplate'e çevirir (CoverTemplate arayüzü değişmez,
// böylece CoverCanvas/CoverStudio'da hiçbir şey değişmez).
function buildTemplate(r: TemplateRecipe): CoverTemplate {
  return {
    id: r.id,
    name: r.name,
    swatch: r.swatch ?? [r.palette.bg, r.palette.ink, r.palette.accent],
    palette: r.palette,
    base: (ctx) => {
      fill(ctx, ctx.colors.bg);
      if (r.band === "top") {
        rect(ctx, 0, 0, ctx.d.totalWidth, ctx.d.bleed + ctx.d.bookHeight * 0.28, ctx.colors.accent);
      } else if (r.band === "side") {
        rect(ctx, ctx.d.spineEnd, 0, ctx.d.bookWidth * 0.16, ctx.d.totalHeight, ctx.colors.accent);
        rect(ctx, ctx.d.spineStart, 0, ctx.d.spine, ctx.d.totalHeight, ctx.colors.accent);
      }
    },
    foreground: (ctx) => {
      drawTitleBlock(ctx, r);
      // Sırt yazısı: yan bant rengi sırtı boyadığında zıt renk kullan.
      spineText(
        ctx,
        r.band === "side" ? r.palette.bg : ctx.colors.ink,
        fontFamilyOf(r.kickerFontId ?? "sans"),
      );
      barcodePlaceholder(ctx, "#d8d2c6");
    },
  };
}

function centeredTextBottom(
  ctx: TemplateCtx,
  text: string,
  o: Omit<TextOpts, "top"> & { bottom: number },
) {
  // Önce çiz, yüksekliğini ölç, sonra alt kenara hizala.
  const t = centeredText(ctx, text, { ...o, top: o.bottom });
  const hMm = pxToMm(ctx, t.height ?? 0);
  t.set({ top: ctx.px(o.bottom - hMm) });
  t.setCoords?.();
}

function pxToMm(ctx: TemplateCtx, pxVal: number): number {
  // px(1mm) kaç piksel → tersine çevir.
  const onePx = ctx.px(1);
  return onePx > 0 ? pxVal / onePx : 0;
}

// ── Şablonlar ──────────────────────────────────────────────────

// ── Şablon tarifleri ───────────────────────────────────────────────
// Her biri küçük bir veri tarifi; buildTemplate bunları çizilebilir
// CoverTemplate'e çevirir. Yeni şablon = buraya birkaç satır.
export const TEMPLATE_RECIPES: TemplateRecipe[] = [
  {
    id: "edebi",
    name: { tr: "Edebi", en: "Literary" },
    palette: { bg: "#f3ece0", ink: "#2b2a27", accent: "#b8923f" },
    titleFontId: "cormorant",
    titleWeight: 600,
    titleScale: 1.12,
    decoration: "doubleRule",
  },
  {
    id: "modern",
    name: { tr: "Modern", en: "Modern" },
    palette: { bg: "#ece9e3", ink: "#15140f", accent: "#e8552d" },
    titleFontId: "montserrat",
    titleWeight: 800,
    titlePos: "bottom",
    align: "left",
    decoration: "rule",
  },
  {
    id: "klasik",
    name: { tr: "Klasik", en: "Classic" },
    palette: { bg: "#1e2a3a", ink: "#f0e9d8", accent: "#c9a24a" },
    titleFontId: "playfair",
    titleWeight: 700,
    frame: true,
    decoration: "dots",
  },
  {
    id: "bant",
    name: { tr: "Üst bant", en: "Top band" },
    palette: { bg: "#f5f1e8", ink: "#1a1a1a", accent: "#2f6f6a" },
    titleFontId: "poppins",
    titleWeight: 700,
    band: "top",
    decoration: "none",
  },
  {
    id: "sahne",
    name: { tr: "Sahne", en: "Stage" },
    palette: { bg: "#14213a", ink: "#f3ead2", accent: "#e0b85a" },
    titleFontId: "ebgaramond",
    titleWeight: 600,
    panel: true,
    decoration: "rule",
  },
  {
    id: "serit",
    name: { tr: "Dikey şerit", en: "Side band" },
    palette: { bg: "#f0ebe1", ink: "#2b2a27", accent: "#993c1d" },
    titleFontId: "lora",
    titleWeight: 700,
    band: "side",
    align: "left",
    decoration: "rule",
  },
  {
    id: "tipo",
    name: { tr: "Büyük tipo", en: "Big type" },
    palette: { bg: "#e8552d", ink: "#fff7f2", accent: "#ffd9c8" },
    titleFontId: "bebas",
    titleWeight: 400,
    titleUpper: true,
    titleScale: 1.7,
    letterSpacingTitle: 30,
    decoration: "none",
  },
  {
    id: "mistik",
    name: { tr: "Mistik", en: "Mystic" },
    palette: { bg: "#2a2233", ink: "#efe6ce", accent: "#caa44a" },
    titleFontId: "cinzel",
    titleWeight: 600,
    titleUpper: true,
    titleScale: 0.95,
    letterSpacingTitle: 40,
    emblem: true,
    decoration: "dots",
  },
  {
    id: "sade",
    name: { tr: "Sade", en: "Minimal" },
    palette: { bg: "#f7f5f1", ink: "#1a1a1a", accent: "#e8612b" },
    titleFontId: "sans",
    titleWeight: 800,
    decoration: "rule",
  },
  {
    id: "romantik",
    name: { tr: "Romantik", en: "Romantic" },
    palette: { bg: "#f6eef0", ink: "#3a2e33", accent: "#b06a86" },
    titleFontId: "cormorant",
    titleWeight: 600,
    titleScale: 1.1,
    decoration: "dots",
  },
];

export const TEMPLATES: CoverTemplate[] = TEMPLATE_RECIPES.map(buildTemplate);

// "Boş tuval": ızgarada görünmez, ayrı bir "Yeni tasarım" bölümünden seçilir.
// Üzerinde hazır yazı/şerit/barkod YOK — yalnız düz zemin. Kullanıcı kendi
// metin/şekil/AI öğelerini sıfırdan ekler. Renkler makul varsayılanlar.
export const BLANK_TEMPLATE: CoverTemplate = {
  id: "bos",
  name: { tr: "Boş tuval", en: "Blank canvas" },
  swatch: ["#ffffff", "#f4f1ea"],
  palette: { bg: "#ffffff", ink: "#1c1a17", accent: "#e8552d" },
  base: (ctx) => {
    fill(ctx, ctx.colors.bg);
  },
  foreground: () => {
    // Bilerek boş — tertemiz tuval.
  },
};

export function getTemplate(id: string): CoverTemplate {
  if (id === BLANK_TEMPLATE.id) return BLANK_TEMPLATE;
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const DEFAULT_TEMPLATE_ID = "sade";
export const BLANK_TEMPLATE_ID = "bos";
