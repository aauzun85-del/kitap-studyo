// Tema küçük resmi (görsel önizleme). Bir LayoutTheme'i, kitap iç sayfasının
// şematik mini bir SVG temsiline çevirir: gerçek metin değil "greek" çubuklar.
// Tema seçicide her satırın solunda görünür; ileride büyütülmüş önizleme (hover
// / seçili) için aynı bileşen daha büyük `size` ile kullanılabilir.
//
// TASARIM (workflow design paneli + sentez, 2026-06): her görsel öğe yalnızca
// LayoutTheme alanlarından türetilir (yeni tema otomatik doğru çizilir). Tek
// renkli vurgu = drop-cap (--accent); kicker --muted'a indirildi → liste
// sakin/indigo-hafif kalır. SSR güvenli: tüm geometri saf; düzensiz (ragged)
// satır genişlikleri id-çekirdekli PRNG'den → sunucu/istemci birebir aynı
// (hidrasyon uyuşmazlığı yok), Math.random YOK.

import type { LayoutTheme } from "@/lib/layout/themes";

// xfnv32 hash → mulberry32 PRNG. Aynı id hep aynı diziyi üretir.
function seededRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Yaşayan sütun (viewBox birimleri; viewBox 0 0 64 96 = 2:3, 130×195 mm).
const LEFT = 10;
const RIGHT = 54;
const FULLW = RIGHT - LEFT; // 44
const MAXY = 86;
const CAP = 8; // drop-cap kare kenarı

type Bar = { x: number; y: number; w: number };

export function ThemeThumbnail({
  theme,
  size = 56,
  lang = "tr",
  className,
  decorative = false,
}: {
  theme: LayoutTheme;
  size?: number;
  lang?: "tr" | "en";
  className?: string;
  // Etiketli bir kontrolün (örn. tema kartı butonu) içindeyken true → SVG
  // dekoratif sayılır (aria-hidden). Ad/açıklama zaten metin olarak var, ekran
  // okuyucu adı iki kez okumaz. Bağımsız/büyütülmüş önizlemede false → etiketli.
  decorative?: boolean;
}) {
  const rng = seededRng(theme.id);
  const rand = (lo: number, hi: number) => lo + Math.round(rng() * (hi - lo));

  // Başlık dikey konumu: chapterTopRatio → sayfanın % kaçından başlar.
  const titleY = Math.round(10 + theme.chapterTopRatio * 60);
  const kickerY = titleY - 5.8;
  const titleBarY = titleY - 1.5;
  const ornY = titleY + 5;
  const bodyStart = titleY + 13;

  // Satır aralığı = leading/punto, ~2.7× abartılmış (küçük boyutta görünür) +
  // taban/tavan ile sıkışık↔ferah ayrımı korunur.
  const lineGap = Math.min(
    6.2,
    Math.max(5, Math.round((theme.leadingPt / theme.bodySizePt) * 4 * 10) / 10),
  );

  // Paragraf biçimi tamamen alan-bazlı: girinti (firstLineIndentMm) ve paragraf
  // arası boşluk (paragraphSpacingMm) BAĞIMSIZ ele alınır → ikisini birden kuran
  // bir tema da doğru çizilir. Girinti üst sınırlı (≤20 birim) → büyük değerde
  // bile ilk satır sütun içinde kalır, negatif genişlik oluşmaz.
  const indentU =
    theme.firstLineIndentMm > 0
      ? Math.min(20, Math.max(6, Math.round(theme.firstLineIndentMm * 1.4)))
      : 0;
  const paraGapExtra =
    theme.paragraphSpacingMm > 0 ? Math.round((theme.paragraphSpacingMm / 2.6) * 3) : 0;

  // Gövde satırlarını paragraf akışıyla üret.
  const bars: Bar[] = [];
  let capRect: Bar | null = null;
  const paraLineCounts = [4, 3, 3, 3, 2, 3];
  let y = bodyStart;
  let pi = 0;
  let li = 0;
  let firstDocLine = true;

  while (y <= MAXY) {
    const lineCount = paraLineCounts[pi] ?? 3;
    const isFirstLine = li === 0;
    const isLastLine = li === lineCount - 1;

    let x = LEFT;
    let w = FULLW;

    // Paragraf ilk satırı girintisi.
    if (isFirstLine && indentU > 0) {
      x = LEFT + indentU;
      w = RIGHT - x;
    }

    // Hizalama → düzensizlik. Sola yaslı: her satır kısa/değişken (ragged sağ).
    // İki yana yaslı: yalnız paragraf SON satırı kısa, diğerleri tam.
    if (theme.align === "left") {
      x = LEFT;
      w = rand(18, 40);
    } else if (isLastLine) {
      x = LEFT;
      w = rand(22, 40);
    }

    // Drop-cap: yalnız 1. paragraf; kareyle çakışan satırlar sağa kayar (≈2 satır).
    if (theme.dropCap && pi === 0) {
      if (firstDocLine) capRect = { x: LEFT, y: bodyStart - 1, w: CAP };
      const overlapsCap = y - bodyStart < CAP - 0.5;
      if (overlapsCap) {
        x = Math.max(x, LEFT + 10); // 8 birim kare + boşluk → x=20
        w = RIGHT - x;
      }
    }

    bars.push({ x, y, w });
    firstDocLine = false;
    y += lineGap;
    li++;
    if (li >= lineCount) {
      pi++;
      li = 0;
      if (paraGapExtra > 0) y += paraGapExtra; // paragraflar arası boş satır
    }
  }

  const ariaPreview = lang === "tr" ? "önizleme" : "preview";
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": `${theme.name[lang]} ${ariaPreview}` };

  return (
    <svg
      viewBox="0 0 64 96"
      width={size}
      height={Math.round(size * 1.5)}
      {...a11y}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sayfa kartı */}
      <rect
        x={1}
        y={1}
        width={62}
        height={94}
        rx={3}
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth={1}
      />
      {/* "BÖLÜM N" kicker'ı (varsa) */}
      {theme.showChapterKicker && (
        <rect x={27} y={kickerY} width={10} height={1.6} rx={0.8} fill="var(--muted)" />
      )}
      {/* Bölüm başlığı */}
      <rect x={20} y={titleBarY} width={24} height={3} rx={1.2} fill="var(--foreground)" />
      {/* Başlık altı süsü */}
      {theme.chapterOrnament === "rule" && (
        <line x1={26} y1={ornY} x2={38} y2={ornY} stroke="var(--border)" strokeWidth={1.2} />
      )}
      {theme.chapterOrnament === "dots" && (
        <>
          <circle cx={29} cy={ornY} r={1} fill="var(--muted)" />
          <circle cx={32} cy={ornY} r={1} fill="var(--muted)" />
          <circle cx={35} cy={ornY} r={1} fill="var(--muted)" />
        </>
      )}
      {/* Drop-cap bloğu (tek vurgu öğesi). Yalnız drop-cap'li temalarda (2/6) →
          dolu indigo, hem aydınlık hem karanlıkta net "büyük baş harf" sinyali. */}
      {capRect && (
        <rect
          x={capRect.x}
          y={capRect.y}
          width={capRect.w}
          height={CAP}
          rx={1}
          fill="var(--accent)"
        />
      )}
      {/* Gövde "greek" çubukları */}
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={1.2} rx={0.6} fill="var(--muted)" />
      ))}
    </svg>
  );
}
