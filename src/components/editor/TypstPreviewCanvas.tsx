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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { renderBookSvgWithBlocks, type TypstBookInput, type BlockPos } from "@/lib/typst";

const SVGNS = "http://www.w3.org/2000/svg";
const PT_PER_MM = 72 / 25.4;
const ROW_GAP_PX = 22; // açık-kitap ikilileri (satırlar) arası boşluk

// Sayfa index'inin (0-tabanlı) ızgara konumu: sayfa 0 sağda tek (recto), sonra
// verso(sol)|recto(sağ) ikilileri.
function pagePos(i: number): { col: 0 | 1; row: number } {
  if (i === 0) return { col: 1, row: 0 };
  const p = i - 1;
  return { col: (p % 2) as 0 | 1, row: 1 + Math.floor(p / 2) };
}

type OverlayInfo = { topPct: number; heightPct: number; pxPerMm: number; renderDpi: number };

export function TypstPreviewCanvas({
  input,
  editingBlock,
  onSelectBlock,
  renderBlockOverlay,
}: {
  input: TypstBookInput;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
  renderBlockOverlay?: (idx: number, o: OverlayInfo) => ReactNode;
}) {
  const [svg, setSvg] = useState("");
  const [positions, setPositions] = useState<BlockPos[]>([]);
  const [status, setStatus] = useState<"idle" | "compiling" | "error">("idle");
  const reqId = useRef(0);
  // Scroll kapsayıcısı state ile (callback ref) → IntersectionObserver root'u
  // olarak güvenilir (viewport'a bağımlı değil; ref zamanlaması sorunu yok).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (input.blocks.length === 0) {
      setSvg("");
      setPositions([]);
      setStatus("idle");
      return;
    }
    const id = ++reqId.current;
    setStatus("compiling");
    const timer = setTimeout(() => {
      renderBookSvgWithBlocks(input)
        .then((out) => {
          if (reqId.current === id) {
            setSvg(out.svg);
            setPositions(out.blocks);
            setStatus("idle");
          }
        })
        .catch(() => {
          if (reqId.current === id) setStatus("error");
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

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
    const styleHtml = [...root.children]
      .filter((c) => c.tagName.toLowerCase() === "style")
      .map((c) => c.outerHTML)
      .join("");
    const pages = groups.map((g) => {
      g.setAttribute("transform", "translate(0,0)");
      return g.outerHTML;
    });
    return { defsHtml, styleHtml, pages, pageW: vb[2], pageH: vb[3] / n, pageCount: n };
  }, [svg]);

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
    <div ref={setScrollEl} className="relative h-full overflow-auto bg-[var(--surface)] px-6 py-6">
      <div className="pointer-events-none absolute right-3 top-3 z-30">
        {status === "compiling" && (
          <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">derleniyor…</span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">önizleme hatası</span>
        )}
      </div>

      {doc ? (
        <>
          {/* Paylaşılan glyph tanımları — bir kez (gizli); sayfa svg'leri buna başvurur. */}
          <svg
            width="0"
            height="0"
            aria-hidden
            style={{ position: "absolute" }}
            dangerouslySetInnerHTML={{ __html: doc.defsHtml }}
          />
          <div className="mx-auto flex w-full max-w-[920px] flex-col" style={{ gap: ROW_GAP_PX }}>
            {rows.map((row, ri) => (
              <div key={ri} className="flex items-start justify-center">
                {[0, 1].map((col) => {
                  const idx = row[col];
                  if (idx == null) return <div key={col} className="w-1/2" />;
                  return (
                    <PageBox
                      key={col}
                      pageIdx={idx}
                      pageHtml={doc.pages[idx]}
                      styleHtml={doc.styleHtml}
                      pageW={doc.pageW}
                      pageH={doc.pageH}
                      blocks={byPage.get(idx + 1) ?? []}
                      scrollRoot={scrollEl}
                      editingBlock={editingBlock}
                      onSelectBlock={onSelectBlock}
                      renderBlockOverlay={renderBlockOverlay}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-center text-sm text-muted">
          {input.blocks.length === 0 ? "Metin ekleyin — sayfalar burada belirir." : "Sayfa hazırlanıyor…"}
        </div>
      )}
    </div>
  );
}

// Tek sayfa kutusu — görünür olunca (IntersectionObserver) içeriğini basar, değilse
// boş beyaz kutu (doğru boyutta). Bloklar bu sayfanın konumlarından.
function PageBox({
  pageIdx,
  pageHtml,
  styleHtml,
  pageW,
  pageH,
  blocks,
  scrollRoot,
  editingBlock,
  onSelectBlock,
  renderBlockOverlay,
}: {
  pageIdx: number;
  pageHtml: string;
  styleHtml: string;
  pageW: number;
  pageH: number;
  blocks: BlockPos[];
  scrollRoot: HTMLElement | null;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
  renderBlockOverlay?: (idx: number, o: OverlayInfo) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // root: scroll kapsayıcısı → kapsayıcı içi scroll'da güvenilir tetiklenir.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      root: scrollRoot ?? null,
      rootMargin: "1000px 0px", // görünür alan çevresinde tampon (önden yükle)
    });
    io.observe(el);
    const ro = new ResizeObserver(() => setBoxW(el.getBoundingClientRect().width));
    ro.observe(el);
    setBoxW(el.getBoundingClientRect().width);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, [scrollRoot]);

  // Bu sayfadaki blok bantları (sayfa kutusunun yüzdesi).
  const bands = useMemo(() => {
    return blocks.map((b, i) => {
      const top = b.yPt;
      const next = blocks[i + 1];
      const bottom = next ? next.yPt : pageH;
      return { idx: b.idx, topPct: (top / pageH) * 100, heightPct: (Math.max(10, bottom - top) / pageH) * 100 };
    });
  }, [blocks, pageH]);

  const editBand = editingBlock != null ? bands.find((b) => b.idx === editingBlock) : undefined;
  const scale = boxW > 0 ? boxW / pageW : 0;

  return (
    <div
      ref={ref}
      className="relative w-1/2 bg-white shadow-[0_1px_10px_rgba(0,0,0,0.18)]"
      style={{ aspectRatio: `${pageW} / ${pageH}` }}
    >
      {visible && (
        <div
          className="absolute inset-0 [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{
            __html: `<svg viewBox="0 0 ${pageW} ${pageH}" xmlns="${SVGNS}" preserveAspectRatio="xMidYMid meet">${styleHtml}${pageHtml}</svg>`,
          }}
        />
      )}
      {/* Tıklanabilir blok bölgeleri */}
      <div className="absolute inset-0">
        {bands.map((b) => (
          <button
            key={b.idx}
            type="button"
            onClick={() => onSelectBlock(b.idx)}
            title="Düzenle / sayfa düzeni"
            className="absolute left-0 w-full cursor-pointer rounded-sm transition hover:bg-accent/10"
            style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
          />
        ))}
      </div>
      {/* Düzenlenen blok bu sayfadaysa editör overlay'i */}
      {editBand && renderBlockOverlay && scale > 0 && (
        <div className="absolute left-0 w-full" style={{ top: `${editBand.topPct}%` }}>
          {renderBlockOverlay(editBand.idx, {
            topPct: editBand.topPct,
            heightPct: editBand.heightPct,
            pxPerMm: scale * PT_PER_MM,
            renderDpi: scale * 72,
          })}
        </div>
      )}
    </div>
  );
}
