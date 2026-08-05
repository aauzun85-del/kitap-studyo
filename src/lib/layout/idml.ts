// Mizanpaj bloklarından Adobe InDesign'ın açabildiği bir IDML paketi (.idml) üretir.
// Tamamen tarayıcıda çalışır (JSZip). IDML, bir ZIP arşivi içinde XML dosyalarıdır;
// yapı GERÇEK bir KDY InDesign şablonundan (KDY-sablon-130x195.idml) doğrulanarak
// çıkarılmıştır. Bu dosya bilerek proje-içi bir şeye bağlı DEĞİLDİR (yalnız jszip +
// paginate tipleri), böylece bağımsız da test edilebilir.
//
// KAPSAM (v1): tek Story'ye akan metin — başlık (Baslik1/Baslik2), gövde (Govde),
// alıntı (Alinti); kalın/italik karakter stilleri; kitabın boyu + kenar boşlukları;
// N sayfaya elle-zincirlenmiş metin çerçeveleri (overset olmadan). Resim/tablo v1'de
// yer tutucu paragrafa iner; sayfa-sonu/boşluk yaklaşık ele alınır. Kullanıcı dosyayı
// InDesign'da açıp düzenlemeye devam eder.

import JSZip from "jszip";
import type { Block, Run, LayoutSettings, BookMeta, ParaAlign } from "./paginate";
import type { BookSize, Margins } from "./page";
import { smartQuoteBlocks, prepareMeta } from "./prepare";
import { IDML_BUILTIN_STYLE_DEFS } from "./idmlBuiltinStyles";

export type IdmlBookInput = {
  meta: BookMeta;
  blocks: Block[];
  settings: LayoutSettings;
  size: BookSize; // mm (trim)
  margins: Margins; // mm
  gutter: number; // mm — inside'a eklenir (cilt payı)
  pageCount: number; // pages.length — çerçeve sayısı tahmini
};

// ── Ölçü + kaçış yardımcıları ───────────────────────────────────────────────
const PT_PER_MM = 72 / 25.4;
const mm2pt = (mm: number): number => mm * PT_PER_MM;
// InDesign tam ondalık bekler; 8 hane yeter, gereksiz sıfırlar atılır.
const ptStr = (n: number): string =>
  Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : "0";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Benzersiz Self id üreteci ───────────────────────────────────────────────
// Sabit id'lerle ("n", "$ID/…", "d") çakışmaması için "u"+artan sayaç.
function makeIdGen(): () => string {
  let n = 0x1000;
  return () => "u" + (n++).toString(16);
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const PKG_NS = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';

// ── Ayarlardan stil değerleri ───────────────────────────────────────────────
function justificationOf(align: ParaAlign | "left" | "justify" | undefined, fallback: "LeftJustified" | "LeftAlign"): string {
  switch (align) {
    case "center": return "CenterAlign";
    case "right": return "RightAlign";
    case "justify": return "LeftJustified";
    case "left": return "LeftAlign";
    default: return fallback;
  }
}

// ── Story: bloklar → ParagraphStyleRange ağacı ──────────────────────────────

type ParaStyle = "Govde" | "Baslik1" | "Baslik2" | "Alinti";

// Ardışık aynı-biçimli run'ları birleştir (gereksiz CharacterStyleRange şişmesini
// önler); boş metinli run'ları at.
function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && last.bold === r.bold && last.italic === r.italic) {
      last.text += r.text;
    } else {
      out.push({ text: r.text, bold: r.bold, italic: r.italic });
    }
  }
  return out;
}

function charStyleOf(r: Run): string {
  if (r.bold && r.italic) return "CharacterStyle/KalinItalik";
  if (r.bold) return "CharacterStyle/Kalin";
  if (r.italic) return "CharacterStyle/Italik";
  return "CharacterStyle/$ID/[No character style]";
}

// Bir paragrafı (blok) tek ParagraphStyleRange olarak yazar. isLast=false ise
// paragraf sonuna <Br/> konur (son paragrafta konmaz → hayalet boş paragraf yok).
// override: blok-bazlı font/punto (biçim çubuğundan) varsa char range'e işlenir.
function paragraphXml(
  paraStyle: ParaStyle,
  runs: Run[],
  isLast: boolean,
  align: ParaAlign | undefined,
  override?: { fontFamily?: string; sizePt?: number },
): string {
  const merged = mergeRuns(runs);
  const parts: string[] = [];
  const alignAttr = align ? ` Justification="${justificationOf(align, "LeftJustified")}"` : "";
  parts.push(`\t\t<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${paraStyle}"${alignAttr}>`);

  // Blok-bazlı override: char range'e PointSize + AppliedFont ekle.
  const ovAttr = override?.sizePt != null ? ` PointSize="${ptStr(override.sizePt)}"` : "";
  const ovFont = override?.fontFamily
    ? `\n\t\t\t\t<Properties><AppliedFont type="string">${xmlEscape(override.fontFamily)}</AppliedFont></Properties>`
    : "";

  const ranges = merged.length ? merged : [{ text: "", bold: false, italic: false }];
  ranges.forEach((r, i) => {
    const isLastRange = i === ranges.length - 1;
    const br = !isLast && isLastRange ? "\n\t\t\t\t<Br />" : "";
    if (r.text) {
      parts.push(
        `\t\t\t<CharacterStyleRange AppliedCharacterStyle="${charStyleOf(r)}"${ovAttr}>${ovFont}\n` +
        `\t\t\t\t<Content>${xmlEscape(r.text)}</Content>${br}\n` +
        `\t\t\t</CharacterStyleRange>`,
      );
    } else {
      // Boş paragraf (blank/spacer): içerik yok, yalnız satır sonu.
      parts.push(
        `\t\t\t<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">${br}\n` +
        `\t\t\t</CharacterStyleRange>`,
      );
    }
  });
  parts.push(`\t\t</ParagraphStyleRange>`);
  return parts.join("\n");
}

// blocks → hazır paragraf listesi (yer tutucu/kicker açılımı burada). Sonra
// isLast işaretiyle Story XML'ine çevrilir.
type ParaSpec = { style: ParaStyle; runs: Run[]; align?: ParaAlign; override?: { fontFamily?: string; sizePt?: number } };

function blocksToParas(blocks: Block[]): ParaSpec[] {
  const out: ParaSpec[] = [];
  const plain = (t: string): Run[] => [{ text: t, bold: false, italic: false }];

  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        if (b.kicker) out.push({ style: "Baslik2", runs: plain(b.kicker) });
        out.push({
          style: b.level === 1 ? "Baslik1" : "Baslik2",
          runs: b.runs,
          align: b.align,
        });
        break;
      }
      case "paragraph":
        out.push({
          style: "Govde",
          runs: b.runs,
          align: b.align,
          override: { fontFamily: b.fontFamily, sizePt: b.sizePt },
        });
        break;
      case "blockquote":
        out.push({ style: "Alinti", runs: b.runs, align: b.align });
        break;
      case "blank":
      case "spacer": {
        // Boşluk hijyeni: baştaki boşlar hiç eklenmez, ardışık boşlar TEKE iner.
        // (Word'den gelen metinlerde baş/aralarda onlarca boş satır olabiliyor;
        // hepsi paragraf olursa InDesign'da baş tarafta boş sayfalar oluşuyor.)
        const last = out[out.length - 1];
        if (out.length > 0 && !(last.style === "Govde" && last.runs.length === 0)) {
          out.push({ style: "Govde", runs: [] });
        }
        break;
      }
      case "image":
        // v1: gerçek yerleştirme yok → görünür yer tutucu (içerik sessizce kaybolmasın).
        out.push({ style: "Govde", runs: plain("[ Görsel — InDesign'da yerleştirin ]") });
        break;
      case "table":
        out.push({ style: "Govde", runs: plain("[ Tablo — InDesign'da yeniden oluşturun ]") });
        break;
      // pagebreak: v1'de atlanır (bölüm başlıkları zaten yeni sayfa hissi verir).
    }
  }
  // Sondaki boş paragrafları at (kuyrukta boş sayfa üretmesinler).
  while (out.length && out[out.length - 1].style === "Govde" && out[out.length - 1].runs.length === 0) {
    out.pop();
  }
  return out;
}

function storyXml(storyId: string, blocks: Block[]): string {
  const paras = blocksToParas(blocks);
  const body = paras.length
    ? paras
        .map((p, i) => paragraphXml(p.style, p.runs, i === paras.length - 1, p.align, p.override))
        .join("\n")
    : paragraphXml("Govde", [], true, undefined);
  return `${XML_HEAD}
<idPkg:Story ${PKG_NS} DOMVersion="15.0">
\t<Story Self="${storyId}" UserText="true" IsEndnoteStory="false" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">
\t\t<StoryPreference OpticalMarginAlignment="false" OpticalMarginSize="12" FrameType="TextFrameType" StoryOrientation="Horizontal" StoryDirection="LeftToRightDirection" />
\t\t<InCopyExportOption IncludeGraphicProxies="true" IncludeAllResources="false" />
${body}
\t</Story>
</idPkg:Story>`;
}

// ── Sayfa + zincirli çerçeve geometrisi ─────────────────────────────────────

type PageGeom = { id: string; name: string; isRight: boolean };
type SpreadGeom = { id: string; pages: PageGeom[]; yOffset: number };

// N çerçeve için sayfa dizisi: 1. sayfa tek başına sağ (recto), sonrası verso+recto
// çiftleri (kitap geleneği). Her spread PAGE_H + boşluk kadar aşağı kaydırılır.
function buildSpreads(
  gen: () => string,
  frameCount: number,
  pageHpt: number,
): { spreads: SpreadGeom[]; pages: PageGeom[] } {
  const pages: PageGeom[] = [];
  for (let p = 1; p <= frameCount; p++) {
    const isRight = p === 1 ? true : p % 2 === 1;
    pages.push({ id: gen(), name: String(p), isRight });
  }
  const spreads: SpreadGeom[] = [];
  const gap = mm2pt(22); // spread'ler arası pasteboard boşluğu (üst üste binmesin)
  let idx = 0;
  let si = 0;
  // İlk spread: yalnız sayfa 1 (recto).
  spreads.push({ id: gen(), pages: [pages[0]], yOffset: 0 });
  idx = 1;
  si = 1;
  while (idx < pages.length) {
    const pair = pages.slice(idx, idx + 2);
    spreads.push({ id: gen(), pages: pair, yOffset: si * (pageHpt + gap) });
    idx += 2;
    si++;
  }
  return { spreads, pages };
}

function frameXml(
  frameId: string,
  storyId: string,
  prevId: string,
  nextId: string,
  layerId: string,
  page: PageGeom,
  g: Geom,
): string {
  const top = mm2pt(g.marginTop);
  const insideTotal = mm2pt(g.marginInside + g.gutter);
  const outside = mm2pt(g.marginOutside);
  const tx = page.isRight ? insideTotal : -g.pageWpt + outside;
  const ty = -g.halfHpt + top;
  const fw = g.frameWpt;
  const fh = g.frameHpt;
  return `\t\t<TextFrame Self="${frameId}" ParentStory="${storyId}" PreviousTextFrame="${prevId}" NextTextFrame="${nextId}" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="$ID/" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" ItemLayer="${layerId}" Locked="false" LocalDisplaySetting="Default" AppliedObjectStyle="ObjectStyle/$ID/[Normal Text Frame]" ItemTransform="1 0 0 1 ${ptStr(tx)} ${ptStr(ty)}">
\t\t\t<Properties>
\t\t\t\t<PathGeometry>
\t\t\t\t\t<GeometryPathType PathOpen="false">
\t\t\t\t\t\t<PathPointArray>
\t\t\t\t\t\t\t<PathPointType Anchor="0 0" LeftDirection="0 0" RightDirection="0 0" />
\t\t\t\t\t\t\t<PathPointType Anchor="0 ${ptStr(fh)}" LeftDirection="0 ${ptStr(fh)}" RightDirection="0 ${ptStr(fh)}" />
\t\t\t\t\t\t\t<PathPointType Anchor="${ptStr(fw)} ${ptStr(fh)}" LeftDirection="${ptStr(fw)} ${ptStr(fh)}" RightDirection="${ptStr(fw)} ${ptStr(fh)}" />
\t\t\t\t\t\t\t<PathPointType Anchor="${ptStr(fw)} 0" LeftDirection="${ptStr(fw)} 0" RightDirection="${ptStr(fw)} 0" />
\t\t\t\t\t\t</PathPointArray>
\t\t\t\t\t</GeometryPathType>
\t\t\t\t</PathGeometry>
\t\t\t</Properties>
\t\t\t<TextFramePreference TextColumnCount="1" TextColumnFixedWidth="${ptStr(fw)}" TextColumnMaxWidth="0">
\t\t\t\t<Properties>
\t\t\t\t\t<InsetSpacing type="list">
\t\t\t\t\t\t<ListItem type="unit">0</ListItem>
\t\t\t\t\t\t<ListItem type="unit">0</ListItem>
\t\t\t\t\t\t<ListItem type="unit">0</ListItem>
\t\t\t\t\t\t<ListItem type="unit">0</ListItem>
\t\t\t\t\t</InsetSpacing>
\t\t\t\t</Properties>
\t\t\t</TextFramePreference>
\t\t\t<TextWrapPreference Inverse="false" ApplyToMasterPageOnly="false" TextWrapSide="BothSides" TextWrapMode="None">
\t\t\t\t<Properties>
\t\t\t\t\t<TextWrapOffset Top="0" Left="0" Bottom="0" Right="0" />
\t\t\t\t</Properties>
\t\t\t</TextWrapPreference>
\t\t</TextFrame>`;
}

function pageXml(page: PageGeom, g: Geom, masterId: string): string {
  const tx = page.isRight ? 0 : -g.pageWpt;
  return `\t\t<Page Self="${page.id}" TabOrder="" AppliedMaster="${masterId}" OverrideList="" MasterPageTransform="1 0 0 1 0 0" Name="${page.name}" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 ${ptStr(g.pageHpt)} ${ptStr(g.pageWpt)}" ItemTransform="1 0 0 1 ${ptStr(tx)} ${ptStr(-g.halfHpt)}" LayoutRule="UseMaster" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">
${marginPrefXml(g)}
\t\t</Page>`;
}

function marginPrefXml(g: Geom): string {
  return `\t\t\t<MarginPreference ColumnCount="1" ColumnGutter="0" Top="${ptStr(mm2pt(g.marginTop))}" Bottom="${ptStr(mm2pt(g.marginBottom))}" Left="${ptStr(mm2pt(g.marginInside + g.gutter))}" Right="${ptStr(mm2pt(g.marginOutside))}" ColumnDirection="Horizontal" />`;
}

// Bir spread'i, sayfalarını ve o spread'e düşen çerçeveleri yazar. Çerçeve zinciri
// TÜM belge boyunca süreklidir → prev/next id'leri dışarıdan verilir.
function spreadXml(
  spread: SpreadGeom,
  g: Geom,
  masterId: string,
  frames: string[],
): string {
  const pagesXml = spread.pages.map((p) => pageXml(p, g, masterId)).join("\n");
  return `${XML_HEAD}
<idPkg:Spread ${PKG_NS} DOMVersion="15.0">
\t<Spread Self="${spread.id}" PageTransitionType="None" PageTransitionDirection="NotApplicable" PageTransitionDuration="Medium" ShowMasterItems="true" PageCount="${spread.pages.length}" BindingLocation="${spread.pages.length === 1 ? 0 : 1}" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 ${ptStr(spread.yOffset)}" FlattenerOverride="Default">
${pagesXml}
${frames.join("\n")}
\t</Spread>
</idPkg:Spread>`;
}

// ── Ortak geometri (mm→pt önceden hesaplanmış) ──────────────────────────────
type Geom = {
  pageWpt: number;
  pageHpt: number;
  halfHpt: number;
  frameWpt: number;
  frameHpt: number;
  marginTop: number;
  marginBottom: number;
  marginInside: number;
  marginOutside: number;
  gutter: number;
};

function geomOf(input: IdmlBookInput): Geom {
  const { size, margins, gutter } = input;
  const pageWpt = mm2pt(size.width);
  const pageHpt = mm2pt(size.height);
  return {
    pageWpt,
    pageHpt,
    halfHpt: pageHpt / 2,
    frameWpt: mm2pt(size.width - (margins.inside + gutter) - margins.outside),
    frameHpt: mm2pt(size.height - margins.top - margins.bottom),
    marginTop: margins.top,
    marginBottom: margins.bottom,
    marginInside: margins.inside,
    marginOutside: margins.outside,
    gutter,
  };
}

// ── Kaynak dosyaları (Styles/Preferences/Fonts/Graphic/Master) ──────────────

function stylesXml(s: LayoutSettings): string {
  const bodyPt = ptStr(s.bodySizePt);
  const firstIndent = ptStr(mm2pt(s.firstLineIndentMm));
  const spaceAfter = ptStr(mm2pt(s.paragraphSpacingMm));
  const bodyFont = xmlEscape(s.bodyFontFamily || "Source Serif 4");
  const headFont = xmlEscape(s.headingFontFamily || s.bodyFontFamily || "Source Serif 4");
  const bodyJust = s.align === "justify" ? "LeftJustified" : "LeftAlign";
  const hyphen = s.hyphenate ? "true" : "false";
  // Satır aralığı: >0 → sabit punto; =0 → otomatik (%120).
  const leading =
    s.leadingPt > 0
      ? `<Leading type="unit">${ptStr(s.leadingPt)}</Leading>`
      : `<Leading type="enumeration">Auto</Leading>`;
  const quoteIndent = ptStr(mm2pt(8));
  return `${XML_HEAD}
<idPkg:Styles ${PKG_NS} DOMVersion="15.0">
\t<RootCharacterStyleGroup Self="uCharGroup">
\t\t<CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]" />
\t\t<CharacterStyle Self="CharacterStyle/$ID/NormalCharacterStyle" Name="$ID/NormalCharacterStyle">
\t\t\t<Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties>
\t\t</CharacterStyle>
\t\t<CharacterStyle Self="CharacterStyle/Kalin" Name="Kalin" FontStyle="Bold">
\t\t\t<Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties>
\t\t</CharacterStyle>
\t\t<CharacterStyle Self="CharacterStyle/Italik" Name="Italik" FontStyle="Italic">
\t\t\t<Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties>
\t\t</CharacterStyle>
\t\t<CharacterStyle Self="CharacterStyle/KalinItalik" Name="KalinItalik" FontStyle="Bold Italic">
\t\t\t<Properties><BasedOn type="string">$ID/[No character style]</BasedOn></Properties>
\t\t</CharacterStyle>
\t</RootCharacterStyleGroup>
\t<RootParagraphStyleGroup Self="uParaGroup">
\t\t<ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" Imported="false" PointSize="${bodyPt}" HorizontalScale="100" VerticalScale="100" LeftIndent="0" RightIndent="0" FirstLineIndent="0" SpaceBefore="0" SpaceAfter="0" Hyphenation="${hyphen}" Justification="LeftAlign">
\t\t\t<Properties>
\t\t\t\t<Leading type="enumeration">Auto</Leading>
\t\t\t\t<AppliedFont type="string">${bodyFont}</AppliedFont>
\t\t\t</Properties>
\t\t</ParagraphStyle>
\t\t<ParagraphStyle Self="ParagraphStyle/$ID/NormalParagraphStyle" Name="$ID/NormalParagraphStyle" NextStyle="ParagraphStyle/$ID/NormalParagraphStyle">
\t\t\t<Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn></Properties>
\t\t</ParagraphStyle>
\t\t<ParagraphStyle Self="ParagraphStyle/Govde" Name="Govde" NextStyle="ParagraphStyle/Govde" PointSize="${bodyPt}" FirstLineIndent="${firstIndent}" SpaceAfter="${spaceAfter}" Hyphenation="${hyphen}" Justification="${bodyJust}">
\t\t\t<Properties>
\t\t\t\t<BasedOn type="string">$ID/[No paragraph style]</BasedOn>
\t\t\t\t${leading}
\t\t\t\t<AppliedFont type="string">${bodyFont}</AppliedFont>
\t\t\t</Properties>
\t\t</ParagraphStyle>
\t\t<ParagraphStyle Self="ParagraphStyle/Alinti" Name="Alinti" NextStyle="ParagraphStyle/Govde" FontStyle="Italic" PointSize="${bodyPt}" LeftIndent="${quoteIndent}" FirstLineIndent="0" SpaceAfter="${spaceAfter}" Justification="LeftAlign">
\t\t\t<Properties>
\t\t\t\t<BasedOn type="string">$ID/[No paragraph style]</BasedOn>
\t\t\t\t<AppliedFont type="string">${bodyFont}</AppliedFont>
\t\t\t</Properties>
\t\t</ParagraphStyle>
\t\t<ParagraphStyle Self="ParagraphStyle/Baslik1" Name="Baslik1" NextStyle="ParagraphStyle/Govde" FontStyle="Bold" PointSize="24" Capitalization="AllCaps" FirstLineIndent="0" SpaceAfter="8.5" Hyphenation="false" Justification="CenterAlign">
\t\t\t<Properties>
\t\t\t\t<BasedOn type="string">$ID/[No paragraph style]</BasedOn>
\t\t\t\t<Leading type="unit">36</Leading>
\t\t\t\t<AppliedFont type="string">${headFont}</AppliedFont>
\t\t\t</Properties>
\t\t</ParagraphStyle>
\t\t<ParagraphStyle Self="ParagraphStyle/Baslik2" Name="Baslik2" NextStyle="ParagraphStyle/Govde" FontStyle="Bold" PointSize="18" Capitalization="AllCaps" FirstLineIndent="0" SpaceAfter="6" KeepWithNext="1" Hyphenation="false" Justification="CenterAlign">
\t\t\t<Properties>
\t\t\t\t<BasedOn type="string">$ID/[No paragraph style]</BasedOn>
\t\t\t\t<Leading type="unit">28</Leading>
\t\t\t\t<AppliedFont type="string">${headFont}</AppliedFont>
\t\t\t</Properties>
\t\t</ParagraphStyle>
\t</RootParagraphStyleGroup>${IDML_BUILTIN_STYLE_DEFS}</idPkg:Styles>`;
}

function fontsXml(s: LayoutSettings): string {
  const fam = xmlEscape(s.bodyFontFamily || "Source Serif 4");
  const ps = (s.bodyFontFamily || "Source Serif 4").replace(/[^A-Za-z0-9]/g, "");
  const font = (self: string, styleName: string, suffix: string) =>
    `\t\t<Font Self="${self}" FontFamily="${fam}" Name="${fam} ${styleName}" PostScriptName="${ps}-${suffix}" Status="Installed" FontStyleName="${styleName}" FontType="OpenTypeCFF" WritingScript="0" FullName="${fam} ${styleName}" FullNameNative="${fam} ${styleName}" FontStyleNameNative="${styleName}" PlatformName="$ID/" />`;
  return `${XML_HEAD}
<idPkg:Fonts ${PKG_NS} DOMVersion="15.0">
\t<FontFamily Self="uFontFam" Name="${fam}">
${font("uFontFam1", "Regular", "Regular")}
${font("uFontFam2", "Italic", "It")}
${font("uFontFam3", "Bold", "Bold")}
${font("uFontFam4", "Bold Italic", "BoldIt")}
\t</FontFamily>
</idPkg:Fonts>`;
}

const GRAPHIC_XML = `${XML_HEAD}
<idPkg:Graphic ${PKG_NS} DOMVersion="15.0">
\t<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n" />
\t<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n" />
\t<Color Self="Color/Registration" Model="Registration" Space="CMYK" ColorValue="100 100 100 100" ColorOverride="Specialregistration" AlternateSpace="NoAlternateColor" AlternateColorValue="" Name="Registration" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n" />
\t<Ink Self="Ink/$ID/Process Cyan" Name="$ID/Process Cyan" Angle="75" ConvertToProcess="false" Frequency="70" NeutralDensity="0.61" PrintInk="true" TrapOrder="1" InkType="Normal" />
\t<Ink Self="Ink/$ID/Process Magenta" Name="$ID/Process Magenta" Angle="15" ConvertToProcess="false" Frequency="70" NeutralDensity="0.76" PrintInk="true" TrapOrder="2" InkType="Normal" />
\t<Ink Self="Ink/$ID/Process Yellow" Name="$ID/Process Yellow" Angle="0" ConvertToProcess="false" Frequency="70" NeutralDensity="0.16" PrintInk="true" TrapOrder="3" InkType="Normal" />
\t<Ink Self="Ink/$ID/Process Black" Name="$ID/Process Black" Angle="45" ConvertToProcess="false" Frequency="70" NeutralDensity="1.7" PrintInk="true" TrapOrder="4" InkType="Normal" />
\t<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true" SwatchCreatorID="7937" SwatchColorGroupReference="n" />
\t<StrokeStyle Self="StrokeStyle/$ID/Solid" Name="$ID/Solid" />
</idPkg:Graphic>`;

// physicalPages: GERÇEK üretilen sayfa sayısı (= frameCount). InDesign'ın
// "belge onarıldı" uyarısını önlemek için Section Length + PagesPerDocument
// input.pageCount değil bu değere eşit olmalı (referans şablon böyle).
function preferencesXml(input: IdmlBookInput, g: Geom, physicalPages: number): string {
  const s = input.settings;
  const bodyFont = xmlEscape(s.bodyFontFamily || "Source Serif 4");
  const leading =
    s.leadingPt > 0
      ? `<Leading type="unit">${ptStr(s.leadingPt)}</Leading>`
      : `<Leading type="enumeration">Auto</Leading>`;
  return `${XML_HEAD}
<idPkg:Preferences ${PKG_NS} DOMVersion="15.0">
\t<PageItemDefault FillColor="Swatch/None" FillTint="-1" StrokeWeight="1" MiterLimit="4" EndCap="ButtEndCap" EndJoin="MiterEndJoin" StrokeType="StrokeStyle/$ID/Solid" LeftLineEnd="None" RightLineEnd="None" StrokeColor="Swatch/None" StrokeTint="-1" GradientFillAngle="0" GradientStrokeAngle="0" GapColor="Swatch/None" GapTint="-1" StrokeAlignment="CenterAlignment" Nonprinting="false" />
\t<TextPreference TypographersQuotes="true" SmartTextReflow="true" AddPages="EndOfStory" LimitToMasterTextFrames="false" PreserveFacingPageSpreads="false" DeleteEmptyPages="true" />
\t<TextDefault AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]" PointSize="${ptStr(s.bodySizePt)}" FillColor="Color/Black" StrokeColor="Swatch/None" Justification="${s.align === "justify" ? "LeftJustified" : "LeftAlign"}" Hyphenation="${s.hyphenate ? "true" : "false"}">
\t\t<Properties>
\t\t\t<AppliedFont type="string">${bodyFont}</AppliedFont>
\t\t\t${leading}
\t\t</Properties>
\t</TextDefault>
\t<DocumentPreference PageHeight="${ptStr(g.pageHpt)}" PageWidth="${ptStr(g.pageWpt)}" PagesPerDocument="${physicalPages}" FacingPages="true" DocumentBleedTopOffset="0" DocumentBleedBottomOffset="0" DocumentBleedInsideOrLeftOffset="0" DocumentBleedOutsideOrRightOffset="0" DocumentBleedUniformSize="true" PreserveLayoutWhenShuffling="true" AllowPageShuffle="true" OverprintBlack="true" PageBinding="LeftToRight" ColumnDirection="Horizontal" Intent="PrintIntent" CreatePrimaryTextFrame="false" MasterTextFrame="false" />
\t<MarginPreference ColumnCount="1" ColumnGutter="0" Top="${ptStr(mm2pt(g.marginTop))}" Bottom="${ptStr(mm2pt(g.marginBottom))}" Left="${ptStr(mm2pt(g.marginInside + g.gutter))}" Right="${ptStr(mm2pt(g.marginOutside))}" ColumnDirection="Horizontal" />
\t<ViewPreference HorizontalMeasurementUnits="Millimeters" VerticalMeasurementUnits="Millimeters" PointsPerInch="72" RulerOrigin="SpreadOrigin" />
\t<TransparencyPreference BlendingSpace="CMYK" />
</idPkg:Preferences>`;
}

function masterSpreadXml(masterId: string, g: Geom): string {
  const pageL = "uMasterPageL";
  const pageR = "uMasterPageR";
  return `${XML_HEAD}
<idPkg:MasterSpread ${PKG_NS} DOMVersion="15.0">
\t<MasterSpread Self="${masterId}" Name="A-Master" NamePrefix="A" BaseName="Master" ShowMasterItems="true" PageCount="2" OverriddenPageItemProps="" PrimaryTextFrame="n" ItemTransform="1 0 0 1 0 0">
\t\t<Page Self="${pageL}" AppliedMaster="n" Name="A" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 ${ptStr(g.pageHpt)} ${ptStr(g.pageWpt)}" ItemTransform="1 0 0 1 ${ptStr(-g.pageWpt)} ${ptStr(-g.halfHpt)}" LayoutRule="Off" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">
${marginPrefXml(g)}
\t\t</Page>
\t\t<Page Self="${pageR}" AppliedMaster="n" Name="A" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 ${ptStr(g.pageHpt)} ${ptStr(g.pageWpt)}" ItemTransform="1 0 0 1 0 ${ptStr(-g.halfHpt)}" LayoutRule="Off" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">
${marginPrefXml(g)}
\t\t</Page>
\t</MasterSpread>
</idPkg:MasterSpread>`;
}

const CONTAINER_XML = `${XML_HEAD}
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
\t<rootfiles>
\t\t<rootfile full-path="designmap.xml" media-type="text/xml"></rootfile>
\t</rootfiles>
</container>`;

const METADATA_XML = `${XML_HEAD}
<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.6">
   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
         <dc:format>application/x-indesign</dc:format>
         <xmp:CreatorTool>Laycoty</xmp:CreatorTool>
      </rdf:Description>
   </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

const TAGS_XML = `${XML_HEAD}
<idPkg:Tags ${PKG_NS} DOMVersion="15.0">
\t<XMLTag Self="XMLTag/Root" Name="Root">
\t\t<Properties>
\t\t\t<TagColor type="enumeration">LightBlue</TagColor>
\t\t</Properties>
\t</XMLTag>
</idPkg:Tags>`;

function backingStoryXml(backingId: string, rootElemId: string): string {
  return `${XML_HEAD}
<idPkg:BackingStory ${PKG_NS} DOMVersion="15.0">
\t<XmlStory Self="${backingId}" UserText="true" IsEndnoteStory="false" AppliedTOCStyle="n" TrackChanges="false" StoryTitle="$ID/" AppliedNamedGrid="n">
\t\t<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/$ID/NormalParagraphStyle">
\t\t\t<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
\t\t\t\t<XMLElement Self="${rootElemId}" MarkupTag="XMLTag/Root" />
\t\t\t</CharacterStyleRange>
\t\t</ParagraphStyleRange>
\t</XmlStory>
</idPkg:BackingStory>`;
}

function designmapXml(ids: {
  storyId: string;
  backingId: string;
  layerId: string;
  masterId: string;
  sectionId: string;
  firstPageId: string;
  spreadIds: string[];
  pageCount: number;
  docName: string;
}): string {
  const spreadRefs = ids.spreadIds
    .map((sid) => `\t<idPkg:Spread src="Spreads/Spread_${sid}.xml" />`)
    .join("\n");
  return `${XML_HEAD}
<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="15.0(209)" ?>
<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="15.0" Self="d" StoryList="${ids.storyId} ${ids.backingId}" Name="${xmlEscape(ids.docName)}.indd" ZeroPoint="0 0" ActiveLayer="${ids.layerId}" CMYKProfile="$ID/" RGBProfile="$ID/" SolidColorIntent="UseColorSettings" AfterBlendingIntent="UseColorSettings" DefaultImageIntent="UseColorSettings" RGBPolicy="PreserveEmbeddedProfiles" CMYKPolicy="PreserveEmbeddedProfiles" AccurateLABSpots="false">
\t<Language Self="Language/$ID/Turkish" Name="$ID/Turkish" SingleQuotes="‘’" DoubleQuotes="“”" PrimaryLanguageName="$ID/Turkish" SublanguageName="$ID/" Id="0" HyphenationVendor="Hunspell" SpellingVendor="Hunspell" />
\t<idPkg:Graphic src="Resources/Graphic.xml" />
\t<idPkg:Fonts src="Resources/Fonts.xml" />
\t<idPkg:Styles src="Resources/Styles.xml" />
\t<idPkg:Preferences src="Resources/Preferences.xml" />
\t<idPkg:Tags src="XML/Tags.xml" />
\t<Layer Self="${ids.layerId}" Name="Layer 1" Visible="true" Locked="false" IgnoreWrap="false" ShowGuides="true" LockGuides="false" UI="true" Expendable="true" Printable="true">
\t\t<Properties>
\t\t\t<LayerColor type="enumeration">LightBlue</LayerColor>
\t\t</Properties>
\t</Layer>
\t<idPkg:MasterSpread src="MasterSpreads/MasterSpread_${ids.masterId}.xml" />
${spreadRefs}
\t<Section Self="${ids.sectionId}" Length="${ids.pageCount}" Name="" ContinueNumbering="true" IncludeSectionPrefix="false" Marker="" PageStart="${ids.firstPageId}" SectionPrefix="">
\t\t<Properties>
\t\t\t<PageNumberStyle type="enumeration">Arabic</PageNumberStyle>
\t\t</Properties>
\t</Section>
\t<idPkg:BackingStory src="XML/BackingStory.xml" />
\t<idPkg:Story src="Stories/Story_${ids.storyId}.xml" />
</Document>`;
}

// ── Ana üretici ─────────────────────────────────────────────────────────────

/**
 * Mizanpaj bloklarından InDesign IDML paketi üretir (Uint8Array = .idml içeriği).
 * JS/Typst çıktısıyla tırnak/tire ayrışmasın diye önce smartQuote/prepareMeta uygular.
 */
export async function exportBookIdml(input: IdmlBookInput): Promise<Uint8Array> {
  // 1) İçerik normalizasyonu (diğer motorlarla AYNI).
  const blocks = smartQuoteBlocks(input.blocks);
  const gen = makeIdGen();
  const g = geomOf(input);

  // 2) Kimlikler.
  const storyId = gen();
  const backingId = gen();
  const rootElemId = gen();
  const layerId = gen();
  const masterId = gen();
  const sectionId = gen();

  // 3) Sayfa + çerçeve zinciri: pageCount + 1 güvenlik payı. Taşma olursa
  // SmartTextReflow sayfa ekler; metin erken biterse DeleteEmptyPages kuyruğu
  // temizler — o yüzden pay küçük tutulur (fazlası sonda boş sayfa yığıyordu).
  const frameCount = Math.max(1, input.pageCount) + 1;
  const { spreads, pages } = buildSpreads(gen, frameCount, g.pageHpt);

  // Tüm sayfalar sırayla → tek zincir. Her sayfaya bir çerçeve; prev/next id'leri.
  const frameIds = pages.map(() => gen());
  const frameFor = new Map<string, string>(); // pageId → frameXml
  pages.forEach((p, i) => {
    const prev = i > 0 ? frameIds[i - 1] : "n";
    const next = i < pages.length - 1 ? frameIds[i + 1] : "n";
    frameFor.set(p.id, frameXml(frameIds[i], storyId, prev, next, layerId, p, g));
  });

  // 4) Zip.
  const zip = new JSZip();
  // mimetype: İLK giriş + STORE (sıkıştırmasız) + tam 43 bayt (newline yok).
  zip.file("mimetype", "application/vnd.adobe.indesign-idml-package", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("META-INF/metadata.xml", METADATA_XML);
  zip.file("Resources/Graphic.xml", GRAPHIC_XML);
  zip.file("Resources/Fonts.xml", fontsXml(input.settings));
  zip.file("Resources/Styles.xml", stylesXml(input.settings));
  zip.file("Resources/Preferences.xml", preferencesXml(input, g, pages.length));
  zip.file("XML/Tags.xml", TAGS_XML);
  zip.file("XML/BackingStory.xml", backingStoryXml(backingId, rootElemId));
  zip.file(`MasterSpreads/MasterSpread_${masterId}.xml`, masterSpreadXml(masterId, g));
  for (const sp of spreads) {
    const frames = sp.pages.map((p) => frameFor.get(p.id)!).filter(Boolean);
    zip.file(`Spreads/Spread_${sp.id}.xml`, spreadXml(sp, g, masterId, frames));
  }
  zip.file(`Stories/Story_${storyId}.xml`, storyXml(storyId, blocks));
  zip.file(
    "designmap.xml",
    designmapXml({
      storyId,
      backingId,
      layerId,
      masterId,
      sectionId,
      firstPageId: pages[0].id,
      spreadIds: spreads.map((s) => s.id),
      pageCount: pages.length, // Section Length = GERÇEK sayfa sayısı
      docName: prepareMeta(input.meta).title || "kitap",
    }),
  );

  return zip.generateAsync({ type: "uint8array", mimeType: "application/vnd.adobe.indesign-idml-package" });
}
