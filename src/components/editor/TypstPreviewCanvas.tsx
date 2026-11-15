"use client";

// Gerçek Typst sayfaları AÇIK-KİTAP (spread) düzeninde + üstlerinde tıklanabilir
// blok bölgeleri — SAYFA-PENCERELEMELİ (büyük kitap tarayıcıyı çökertmesin).
//
// Typst tek SVG döndürür: paylaşılan <defs> (glyph'ler, ÇOK büyük) + dikey
// yığılmış sayfa <g>'leri. Bunu ayırırız: defs'i BİR kez gizli svg'ye koyarız;
// her sayfayı kendi küçük svg'sine ayırırız (<use href="#g"> paylaşılan defs'e
// çözülür — doğrulandı). Sonra yalnız GÖRÜNÜR sayfaların svg'sini DOM'a basarız
// (IntersectionObserver); ekran dışı sayfa = boş beyaz kutu. Böylece 400 sayfalık
// kitapta bile DOM'da ~birkaç sayfa kalır.

import { useEffect, useMemo, useRef, useState } from "react";
import { renderBookSvgWithBlocks, TypstCrashError, type TypstBookInput, type BlockPos } from "@/lib/typst";

const SVGNS = "http://www.w3.org/2000/svg";
const ROW_GAP_PX = 22; // açık-kitap ikilileri (satırlar) arası boşluk

// Sayfa index'inin (0-tabanlı) ızgara konumu: sayfa 0 sağda tek (recto), sonra
// verso(sol)|recto(sağ) ikilileri.
function pagePos(i: number): { col: 0 | 1; row: number } {
  if (i === 0) return { col: 1, row: 0 };
  const p = i - 1;
  return { col: (p % 2) as 0 | 1, row: 1 + Math.floor(p / 2) };
}

// Görünüm: "flow" = tüm açılımlar alt alta kaydırılır (eski görünüm);
// "spread" = yalnız bir açılım (sol|sağ), alana sığdırılmış; "single" = tek sayfa.
export type PreviewMode = "flow" | "spread" | "single";
// Kenar boşluğu kılavuzu: sayfa boyunun/eninin kesri (0..1). inside = cilde bakan.
export type PageGuides = { top: number; bottom: number; inside: number; outside: number };

export function TypstPreviewCanvas({
  input,
  editingBlock,
  onSelectBlock,
  onError,
  mode = "flow",
  zoom = 1,
  cursor = 0,
  guides,
  pageWidthMm,
  onDocInfo,
  onViewInfo,
}: {
  input: TypstBookInput;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
  // Derleme çökerse (ör. çok büyük kitap) üst bileşen "Hızlı" moda düşebilsin.
  onError?: () => void;
  mode?: PreviewMode;
  /** 1 = alana sığdır; >1 büyüt (alan kaydırılır). */
  zoom?: number;
  /** Sayfalı görünümde gösterilen yer: "spread" → açılım sırası, "single" → sayfa (0-tabanlı). */
  cursor?: number;
  /** Verilirse sayfalarda kesikli kenar boşluğu çizgileri çizilir. */
  guides?: PageGuides | null;
  /** Gerçek boyut yüzdesi için sayfanın mm eni. */
  pageWidthMm?: number;
  /** Derleme bitince: sayfa sayısı + blok konumları (bölüme atlamak için). */
  onDocInfo?: (info: { pageCount: number; positions: BlockPos[] }) => void;
  /** Ekrandaki sayfa ölçüsü (gerçek boyuta göre %) ve en çok kaç kat büyütülebilir. */
  onViewInfo?: (info: { realPercent: number }) => void;
}) {
  const [svg, setSvg] = useState("");
  const [positions, setPositions] = useState<BlockPos[]>([]);
  const [status, setStatus] = useState<"idle" | "compiling" | "error">("idle");
  const reqId = useRef(0);
  // Scroll kapsayıcısı state ile (callback ref) → IntersectionObserver root'u
  // olarak güvenilir (viewport'a bağımlı değil; ref zamanlaması sorunu yok).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!scrollEl) return;
    // Kaydırma çubuğu döngüsü olmasın: ölçüyü kaymayan üst kutudan al.
    const host = scrollEl.parentElement ?? scrollEl;
    const measure = () => setBox((b) => (b.w === host.clientWidth && b.h === host.clientHeight ? b : { w: host.clientWidth, h: host.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [scrollEl]);

  useEffect(() => {
    // Bu effect önizleme state'ini Typst girdisiyle SENKRONİZE eder (effect'in
    // asıl işi budur); kural fazla temkinli olduğundan senkron kısmı kapatıyoruz.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (input.blocks.length === 0) {
      setSvg("");
      setPositions([]);
      setStatus("idle");
      return;
    }
    const id = ++reqId.current;
    setStatus("compiling");
    /* eslint-enable react-hooks/set-state-in-effect */
    // Bekleme süresi: yazarken HER tuşta derlemesin; yalnız kullanıcı DURUNCA bir
    // kez derlesin (ağır Typst derlemesi arayüzü dondurduğundan kritik).
    const timer = setTimeout(() => {
      renderBookSvgWithBlocks(input)
        .then((out) => {
          if (reqId.current === id) {
            setSvg(out.svg);
            setPositions(out.blocks);
            setStatus("idle");
          }
        })
        .catch((e) => {
          if (reqId.current === id) {
            setStatus("error");
            // Yalnız GERÇEK çökmede (Rust panic, işçi tazelenemedi) üst bileşen
            // "Hızlı"ya düşer; geçici hatada Typst'te kal → sonraki düzenlemede
            // yeniden denenir ("önizleme = baskı" ilkesi sessizce bozulmasın).
            if (e instanceof TypstCrashError) onError?.();
          }
        });
    }, 1200);
    return () => clearTimeout(timer);
  }, [input, onError]);

  // SVG'yi ayır: paylaşılan defs + sayfa-başı parça (transform sıfırlı) + stil.
  const doc = useMemo(() => {
    if (!svg) return null;
    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = parsed.querySelector("svg");
    if (!root || root.querySelector("parsererror")) return null;
    const vb = (root.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    if (vb.length < 4 || !vb[2] || !vb[3]) return null;
    const groups = [...root.children].filter((c) => c.tagName.toLowerCase() === "g");
    const n = groups.length;
    if (n === 0) return null;
    const defsHtml = [...root.children]
      .filter((c) => c.tagName.toLowerCase() === "defs")
      .map((c) => c.outerHTML)
      .join("");
    // Typst'in CSS'indeki çıplak `svg { fill: none }` kuralı: satır içi SVG'deki
    // <style> belgenin TAMAMINA uygulanır → uygulamadaki tüm dolgulu simgeler
    // (sekmeler, araç çubuğu…) görünmez oluyordu. Kural yalnız önizleme
    // sayfalarıyla (svg.typst-page) sınırlanır; önizleme çizimi değişmez.
    const styleHtml = [...root.children]
      .filter((c) => c.tagName.toLowerCase() === "style")
      .map((c) => c.outerHTML)
      .join("")
      .replace(/(^|[}\s,>])svg(\s*\{)/g, "$1svg.typst-page$2");
    const pages = groups.map((g) => {
      g.setAttribute("transform", "translate(0,0)");
      return g.outerHTML;
    });
    return { defsHtml, styleHtml, pages, pageW: vb[2], pageH: vb[3] / n, pageCount: n };
  }, [svg]);

  const onDocInfoRef = useRef(onDocInfo);
  const onViewInfoRef = useRef(onViewInfo);
  useEffect(() => {
    onDocInfoRef.current = onDocInfo;
    onViewInfoRef.current = onViewInfo;
  });
  useEffect(() => {
    onDocInfoRef.current?.({ pageCount: doc?.pageCount ?? 0, positions });
  }, [doc, positions]);

  // Konumları sayfaya göre grupla.
  const byPage = useMemo(() => {
    const m = new Map<number, BlockPos[]>();
    for (const p of positions) {
      const arr = m.get(p.page) ?? [];
      arr.push(p);
      m.set(p.page, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.yPt - b.yPt);
    return m;
  }, [positions]);

  // Her sayfa için "taşma sahibi": o sayfada hiç işaret yoksa (sayfa, önceki uzun
  // bloğun DEVAMIYLA dolu) tüm sayfayı bu bloğa bağla → ölü sayfa kalmaz. Yedek =
  // bu sayfadan ÖNCE başlayan son blok (okuma sırası = idx artışı).
  const pageFallback = useMemo(() => {
    const m = new Map<number, number>();
    const sorted = [...positions].sort((a, b) => a.page - b.page || a.idx - b.idx);
    const count = doc?.pageCount ?? 0;
    let last = -1;
    let cursor = 0;
    for (let pg = 1; pg <= count; pg++) {
      while (cursor < sorted.length && sorted[cursor].page < pg) {
        last = sorted[cursor].idx;
        cursor++;
      }
      m.set(pg, last);
    }
    return m;
  }, [positions, doc]);

  // Açık-kitap satırları: her satır [versoPageIdx|null, rectoPageIdx|null] (0-tabanlı).
  const rows = useMemo(() => {
    if (!doc) return [];
    const r: (number | null)[][] = [];
    for (let i = 0; i < doc.pageCount; i++) {
      const { col, row } = pagePos(i);
      if (!r[row]) r[row] = [null, null];
      r[row][col] = i;
    }
    return r;
  }, [doc]);

  return (
    <div
      ref={setScrollEl}
      className={`relative h-full overflow-auto bg-[var(--surface)] ${mode === "flow" ? "px-6 py-6" : "flex"}`}
    >
      <div className="pointer-events-none absolute right-3 top-3 z-30">
        {status === "compiling" && (
          <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">derleniyor…</span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">önizleme hatası</span>
        )}
      </div>

      {doc && mode !== "flow" ? (
        (() => {
          // Sayfalı görünüm: bir açılım ya da tek sayfa, alana SIĞDIRILMIŞ (× zoom).
          const PAD = 28;
          const cols = mode === "spread" ? 2 : 1;
          const aspect = doc.pageW / doc.pageH;
          const fitW = Math.max(60, Math.min((box.w - PAD * 2) / cols, (box.h - PAD * 2) * aspect));
          const pageW = Math.round(fitW * Math.max(1, zoom));
          const rowIdx = mode === "spread" ? Math.min(Math.max(0, cursor), Math.max(0, rows.length - 1)) : 0;
          const shown: (number | null)[] =
            mode === "spread" ? (rows[rowIdx] ?? [null, null]) : [Math.min(Math.max(0, cursor), doc.pageCount - 1)];
          return (
            <>
              <svg width="0" height="0" aria-hidden style={{ position: "absolute" }} dangerouslySetInnerHTML={{ __html: doc.defsHtml }} />
              <RealSize
                pagePx={pageW}
                pageWidthMm={pageWidthMm}
                onViewInfo={onViewInfoRef}
              />
              <div className="m-auto flex shrink-0 items-start justify-center" style={{ padding: PAD }}>
                {shown.map((idx, col) =>
                  idx == null ? (
                    <div key={`b${col}`} style={{ width: pageW }} aria-hidden />
                  ) : (
                    <PageBox
                      key={idx}
                      pageHtml={doc.pages[idx]}
                      styleHtml={doc.styleHtml}
                      pageW={doc.pageW}
                      pageH={doc.pageH}
                      widthPx={pageW}
                      blocks={byPage.get(idx + 1) ?? []}
                      fallbackIdx={pageFallback.get(idx + 1) ?? -1}
                      scrollRoot={scrollEl}
                      editingBlock={editingBlock}
                      onSelectBlock={onSelectBlock}
                      guides={guides}
                      recto={(idx + 1) % 2 === 1}
                    />
                  ),
                )}
              </div>
            </>
          );
        })()
      ) : doc ? (
        <>
          {/* Paylaşılan glyph tanımları — bir kez (gizli); sayfa svg'leri buna başvurur. */}
          <svg
            width="0"
            height="0"
            aria-hidden
            style={{ position: "absolute" }}
            dangerouslySetInnerHTML={{ __html: doc.defsHtml }}
          />
          <RealSize
            pagePx={(Math.min(1180, Math.max(0, box.w - 48)) * Math.max(1, zoom)) / 2}
            pageWidthMm={pageWidthMm}
            onViewInfo={onViewInfoRef}
          />
          {/* Akış: büyütünce sütun gerçekten genişler (kutu yana kaydırılır). */}
          <div
            className="mx-auto flex shrink-0 flex-col"
            style={{ gap: ROW_GAP_PX, width: Math.min(1180, Math.max(0, box.w - 48)) * Math.max(1, zoom) || undefined }}
          >
            {rows.map((row, ri) => (
              <div key={ri} className="flex items-start justify-center">
                {[0, 1].map((col) => {
                  const idx = row[col];
                  if (idx == null) return <div key={col} className="w-1/2" />;
                  return (
                    <PageBox
                      key={col}
                      pageHtml={doc.pages[idx]}
                      styleHtml={doc.styleHtml}
                      pageW={doc.pageW}
                      pageH={doc.pageH}
                      blocks={byPage.get(idx + 1) ?? []}
                      fallbackIdx={pageFallback.get(idx + 1) ?? -1}
                      scrollRoot={scrollEl}
                      editingBlock={editingBlock}
                      onSelectBlock={onSelectBlock}
                      guides={guides}
                      recto={(idx + 1) % 2 === 1}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-center text-sm text-muted">
          {input.blocks.length === 0 ? "Metin ekleyin — sayfalar burada belirir." : "Sayfa hazırlanıyor…"}
        </div>
      )}
    </div>
  );
}

// Tek sayfa kutusu — görünür olunca (IntersectionObserver) içeriğini basar, değilse
// boş beyaz kutu (doğru boyutta). Bloklar bu sayfanın konumlarından.
function PageBox({
  pageHtml,
  styleHtml,
  pageW,
  pageH,
  blocks,
  fallbackIdx,
  scrollRoot,
  editingBlock,
  onSelectBlock,
  widthPx,
  guides,
  recto,
}: {
  widthPx?: number;
  guides?: PageGuides | null;
  recto?: boolean;
  pageHtml: string;
  styleHtml: string;
  pageW: number;
  pageH: number;
  blocks: BlockPos[];
  fallbackIdx: number;
  scrollRoot: HTMLElement | null;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // root: scroll kapsayıcısı → kapsayıcı içi scroll'da güvenilir tetiklenir.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      root: scrollRoot ?? null,
      rootMargin: "1000px 0px", // görünür alan çevresinde tampon (önden yükle)
    });
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  // Bu sayfadaki tıklanabilir blok bantları (sayfa kutusunun yüzdesi). Bantlar
  // sayfayı TEPEDEN TABANA boşluksuz döşer (ölü bölge olmaz):
  //  • Sayfa önceki sayfadan TAŞAN blokla başlıyorsa tepe bölgesi [0, ilk işaret)
  //    o taşan bloğun AYRI bandıdır — aksi halde kuyruk, sonraki paragrafla tek
  //    vurguda birleşir ve tıklayınca yanlış blok seçilir.
  //  • Taşan blok yoksa ilk bant tepeye (0) kadar uzar → üst marj/başlık da
  //    tıklanır (kullanıcı şikâyeti: "üst taraflar aktif değil").
  //  • Her bant bir sonrakinin y'sine, son bant sayfa tabanına iner.
  //  • Sayfada hiç işaret yoksa (uzun bloğun ortası) tüm sayfa = taşan blok.
  const bands = useMemo(() => {
    const pct = (v: number) => (v / pageH) * 100;
    if (blocks.length === 0) {
      return fallbackIdx >= 0 ? [{ idx: fallbackIdx, topPct: 0, heightPct: 100 }] : [];
    }
    const first = blocks[0];
    const hasSpill = fallbackIdx >= 0 && fallbackIdx !== first.idx && first.yPt > 0;
    const out = blocks.map((b, i) => {
      const next = blocks[i + 1];
      const top = i === 0 && !hasSpill ? 0 : b.yPt;
      const bottom = next ? next.yPt : pageH;
      return { idx: b.idx, topPct: pct(top), heightPct: pct(Math.max(8, bottom - top)) };
    });
    if (hasSpill) {
      out.unshift({ idx: fallbackIdx, topPct: 0, heightPct: pct(Math.max(8, first.yPt)) });
    }
    return out;
  }, [blocks, fallbackIdx, pageH]);

  return (
    <div
      ref={ref}
      className={`relative bg-white shadow-[0_1px_10px_rgba(0,0,0,0.18)] ${widthPx ? "shrink-0" : "w-1/2"}`}
      style={{ aspectRatio: `${pageW} / ${pageH}`, ...(widthPx ? { width: widthPx } : {}) }}
    >
      {guides && (
        // Kenar boşluğu kılavuzu (yalnız ekranda; baskıya girmez). Sağ sayfada
        // cilt tarafı solda, sol sayfada sağda.
        <div
          aria-hidden
          className="pointer-events-none absolute border border-dashed border-sky-400/70"
          style={{
            top: `${guides.top * 100}%`,
            bottom: `${guides.bottom * 100}%`,
            left: `${(recto ? guides.inside : guides.outside) * 100}%`,
            right: `${(recto ? guides.outside : guides.inside) * 100}%`,
          }}
        />
      )}
      {visible && (
        <div
          className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{
            __html: `<svg class="typst-page" viewBox="0 0 ${pageW} ${pageH}" xmlns="${SVGNS}" preserveAspectRatio="xMidYMid meet">${styleHtml}${pageHtml}</svg>`,
          }}
        />
      )}
      {/* Tıklanabilir blok bölgeleri — düzenlenen blok vurgulanır (altta panel açık). */}
      <div className="absolute inset-0">
        {bands.map((b) => {
          const active = editingBlock != null && b.idx === editingBlock;
          return (
            <button
              key={b.idx}
              type="button"
              onClick={() => onSelectBlock(b.idx)}
              title="Düzenlemek için tıkla"
              className={`absolute left-0 w-full cursor-pointer rounded-sm transition ${
                active
                  ? "bg-accent/15 outline outline-2 outline-accent/70"
                  : "hover:bg-accent/10"
              }`}
              style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

// Ekrandaki sayfa enini gerçek boyuta oranlayıp üst bileşene bildirir (yalnız değişince).
function RealSize({
  pagePx,
  pageWidthMm,
  onViewInfo,
}: {
  pagePx: number;
  pageWidthMm?: number;
  onViewInfo: React.RefObject<((info: { realPercent: number }) => void) | undefined>;
}) {
  const pct = pageWidthMm ? Math.round((pagePx / (pageWidthMm * (96 / 25.4))) * 100) : 0;
  useEffect(() => {
    if (pct > 0) onViewInfo.current?.({ realPercent: pct });
  }, [pct, onViewInfo]);
  return null;
}
