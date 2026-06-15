// Knuth–Plass satır kırma ("total-fit") — InDesign'ın "Adobe Paragraf
// Düzenleyici"si ve LaTeX'in kullandığı yöntem. Açgözlü (greedy) yöntem her
// satıra tek tek bakıp ilk sığmayan kelimeyi alt satıra atar; bu, dar
// sütunlarda bazı satırlarda çirkin geniş boşluklar bırakır. Bu algoritma ise
// TÜM paragrafa bakıp boşlukları en dengeli dağıtan kırılma noktalarını seçer.
//
// Model: paragraf "kutu/tutkal/ceza" (box/glue/penalty) dizisine çevrilir.
//   - box     : kelime (ya da hece parçası) — sabit genişlik
//   - glue    : esneyebilen boşluk — gerilme (stretch) / büzülme (shrink) payı
//   - penalty : kırılabilir nokta (örn. tireleme) — küçük bir ceza ve görünür
//               tire genişliği taşır
// Toplam "demerit" (kötülük puanı) en küçük olan kırılma kümesi seçilir.

const INFINITY = 10000;

export type KPItem =
  | { type: "box"; width: number }
  | { type: "glue"; width: number; stretch: number; shrink: number }
  | { type: "penalty"; width: number; penalty: number; flagged: boolean };

export type KPOptions = {
  tolerance?: number; // izin verilen en gevşek satır (ratio üst sınırı); ~8
  linePenalty?: number; // her satır için taban ceza; ~10
  flaggedPenalty?: number; // ardışık tireli satırlar için ek ceza; ~100
  fitnessPenalty?: number; // komşu satırların gevşeklik sınıfı çok farklıysa ceza
};

type Totals = { width: number; stretch: number; shrink: number };

type KPNode = {
  position: number; // items[] içindeki kırılma noktası (sentinel için 0)
  line: number; // bu düğümle biten satır sayısı
  fitness: number; // gevşeklik sınıfı 0..3 (komşu satır tutarlılığı için)
  totals: Totals; // kırılmadan SONRAKİ kümülatif ölçüler (baştaki tutkalı atar)
  demerits: number; // buraya kadarki toplam kötülük puanı
  previous: KPNode | null;
};

// items → seçilen kırılma noktalarının indeks dizisi (baştaki 0 sentinel dahil).
// Uygun bir kırılma bulunamazsa null döner (çağıran açgözlü yönteme düşer).
export function knuthPlass(
  items: KPItem[],
  lineWidthFor: (lineNumber: number) => number, // 1 tabanlı satır no
  options: KPOptions = {},
): number[] | null {
  const tolerance = options.tolerance ?? 8;
  const linePenalty = options.linePenalty ?? 10;
  const flaggedPenalty = options.flaggedPenalty ?? 100;
  const fitnessPenalty = options.fitnessPenalty ?? 100;

  let active: KPNode[] = [
    { position: 0, line: 0, fitness: 1, totals: { width: 0, stretch: 0, shrink: 0 }, demerits: 0, previous: null },
  ];

  // Baştan, o ana kadar işlenmiş öğelerin kümülatif ölçüsü.
  const sum: Totals = { width: 0, stretch: 0, shrink: 0 };

  // Bir kırılma noktasından SONRAKİ kümülatif ölçü: kırılmayı izleyen tutkalları
  // (satır başındaki boşluk) ekler ki sonraki satırın genişliği bunları saymasın.
  const computeSum = (breakIndex: number): Totals => {
    const result: Totals = { width: sum.width, stretch: sum.stretch, shrink: sum.shrink };
    for (let i = breakIndex; i < items.length; i++) {
      const it = items[i];
      if (it.type === "glue") {
        result.width += it.width;
        result.stretch += it.stretch;
        result.shrink += it.shrink;
      } else if (it.type === "box" || (it.type === "penalty" && it.penalty === -INFINITY && i > breakIndex)) {
        break;
      }
    }
    return result;
  };

  const mainLoop = (index: number) => {
    const item = items[index];
    const forced = item.type === "penalty" && item.penalty === -INFINITY;

    // Her gevşeklik sınıfı için en iyi (en az demerit) aday öncül.
    const candidates: { node: KPNode | null; demerits: number }[] = [
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
      { node: null, demerits: Infinity },
    ];
    const survivors: KPNode[] = [];

    for (const a of active) {
      const currentLine = a.line + 1;
      let width = sum.width - a.totals.width;
      if (item.type === "penalty") width += item.width; // tire genişliği

      const available = lineWidthFor(currentLine);
      let ratio: number;
      if (width < available) {
        const stretch = sum.stretch - a.totals.stretch;
        ratio = stretch > 0 ? (available - width) / stretch : INFINITY;
      } else if (width > available) {
        const shrink = sum.shrink - a.totals.shrink;
        ratio = shrink > 0 ? (available - width) / shrink : INFINITY;
      } else {
        ratio = 0;
      }

      // Uygun kırılma: ne çok sıkışık (ratio < -1) ne de tolerans üstü gevşek.
      if (ratio >= -1 && ratio <= tolerance) {
        const badness = 100 * Math.pow(Math.abs(ratio), 3);
        const pen = item.type === "penalty" ? item.penalty : 0;
        const base = linePenalty + badness;
        let demerits: number;
        if (pen >= 0) demerits = (base + pen) * (base + pen);
        else if (pen > -INFINITY) demerits = base * base - pen * pen;
        else demerits = base * base;

        // Ardışık iki satır da tireyle bitiyorsa ek ceza.
        const prevItem = items[a.position];
        const prevFlagged = prevItem && prevItem.type === "penalty" ? prevItem.flagged : false;
        const curFlagged = item.type === "penalty" ? item.flagged : false;
        if (curFlagged && prevFlagged) demerits += flaggedPenalty;

        let fitness: number;
        if (ratio < -0.5) fitness = 0;
        else if (ratio <= 0.5) fitness = 1;
        else if (ratio <= 1) fitness = 2;
        else fitness = 3;
        if (Math.abs(fitness - a.fitness) > 1) demerits += fitnessPenalty;

        demerits += a.demerits;
        if (demerits < candidates[fitness].demerits) candidates[fitness] = { node: a, demerits };
      }

      // Bu kırılma için çok sıkışık ya da zorunlu kırılma → düğümü kapat.
      if (!(ratio < -1 || forced)) survivors.push(a);
    }

    active = survivors;
    const totals = computeSum(index);
    for (let f = 0; f < 4; f++) {
      const c = candidates[f];
      if (c.node) {
        active.push({
          position: index,
          line: c.node.line + 1,
          fitness: f,
          totals,
          demerits: c.demerits,
          previous: c.node,
        });
      }
    }
  };

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.type === "box") {
      sum.width += item.width;
    } else if (item.type === "glue") {
      // Bir tutkalda yalnızca öncesinde bir kutu varsa kırılabilir.
      if (index > 0 && items[index - 1].type === "box") mainLoop(index);
      sum.width += item.width;
      sum.stretch += item.stretch;
      sum.shrink += item.shrink;
    } else if (item.type === "penalty" && item.penalty !== INFINITY) {
      mainLoop(index);
    }
  }

  if (active.length === 0) return null;

  let best: KPNode | null = null;
  for (const a of active) if (!best || a.demerits < best.demerits) best = a;
  if (!best) return null;

  const breaks: number[] = [];
  for (let n: KPNode | null = best; n; n = n.previous) breaks.unshift(n.position);
  return breaks; // breaks[0] === 0 (sentinel)
}
