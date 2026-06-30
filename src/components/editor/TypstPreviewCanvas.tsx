"use client";

// Gerçek Typst sayfaları AÇIK-KİTAP (spread) düzeninde + üstlerinde tıklanabilir
// blok bölgeleri. Typst tek SVG (paylaşılan defs + dikey yığılmış sayfa <g>'leri)
// döndürür; sayfa <g> transform'larını yeniden yazıp 2 sütunlu ızgaraya
// (sayfa 1 sağda tek; sonra verso|recto ikilileri) koyarız — tek SVG, glyph
// referansları korunur. Introspection (renderBookSvgWithBlocks) her bloğun
// {sayfa, yPt} konumunu verir → ızgara koordinatında yüzde hotspot bantları.
// Tık → onSelectBlock(idx); editör overlay'i bloğun sayfası+konumunda.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { renderBookSvgWithBlocks, type TypstBookInput, type BlockPos } from "@/lib/typst";

const PT_PER_MM = 72 / 25.4;
const ROW_GAP_PT = 30; // açık-kitap ikilileri (satırlar) arası boşluk

// Sayfa index'inin (0-tabanlı) ızgara konumu: sayfa 0 sağda tek (recto), sonra
// verso(sol)|recto(sağ) ikilileri.
function pagePos(i: number): { col: 0 | 1; row: number } {
  if (i === 0) return { col: 1, row: 0 };
  const p = i - 1;
  return { col: (p % 2) as 0 | 1, row: 1 + Math.floor(p / 2) };
}

type Band = { idx: number; leftPct: number; topPct: number; widthPct: number; heightPct: number };

export function TypstPreviewCanvas({
  input,
  editingBlock,
  onSelectBlock,
  renderBlockOverlay,
}: {
  input: TypstBookInput;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
  // Düzenlenen blok için editör overlay'i. pxPerMm/renderDpi SVG ölçeğine eşitlenir.
  renderBlockOverlay?: (
    idx: number,
    o: { leftPct: number; topPct: number; widthPct: number; heightPct: number; pxPerMm: number; renderDpi: number },
  ) => ReactNode;
}) {
  const [svg, setSvg] = useState("");
  const [positions, setPositions] = useState<BlockPos[]>([]);
  const [status, setStatus] = useState<"idle" | "compiling" | "error">("idle");
  const reqId = useRef(0);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);
  // Görüntülenen SVG ölçeği: ekran-px / viewBox-pt (editör boyunu eşitlemek için).
  const [scale, setScale] = useState(0);

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

  // Dikey yığılmış SVG → açık-kitap ızgarası (sayfa <g> transform'larını yeniden
  // yaz, viewBox'u güncelle). Paylaşılan defs/glyph referansları korunur.
  const spread = useMemo(() => {
    if (!svg) return null;
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.querySelector("svg");
    if (!root || root.querySelector("parsererror")) return null;
    const vb = (root.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    if (vb.length < 4 || !vb[2] || !vb[3]) return null;
    const pages = [...root.children].filter((c) => c.tagName.toLowerCase() === "g");
    const n = pages.length;
    if (n === 0) return null;
    const pageW = vb[2];
    const pageH = vb[3] / n; // dikey yığında her sayfa eşit yükseklikte
    const rows = pagePos(n - 1).row + 1;
    const gridW = 2 * pageW;
    const gridH = rows * pageH + Math.max(0, rows - 1) * ROW_GAP_PT;
    const SVGNS = "http://www.w3.org/2000/svg";
    pages.forEach((g, i) => {
      const { col, row } = pagePos(i);
      g.setAttribute("transform", `translate(${col * pageW}, ${row * (pageH + ROW_GAP_PT)})`);
      // Beyaz kâğıt zemini (her sayfa için; boşluklar koyu kalır → ayrık sayfalar).
      const rect = doc.createElementNS(SVGNS, "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(pageW));
      rect.setAttribute("height", String(pageH));
      rect.setAttribute("fill", "#ffffff");
      g.insertBefore(rect, g.firstChild);
    });
    root.setAttribute("viewBox", `0 0 ${gridW} ${gridH}`);
    root.removeAttribute("width");
    root.removeAttribute("height");
    return { html: root.outerHTML, gridW, gridH, pageW, pageH };
  }, [svg]);

  // SVG yerleşince ekran ölçeğini oku (editör boyu için); rAF + ResizeObserver.
  useEffect(() => {
    const measureScale = () => {
      const el = svgWrapRef.current?.querySelector("svg");
      if (!el) return;
      const vb = el.viewBox.baseVal;
      const w = el.getBoundingClientRect().width;
      if (vb && vb.width > 0 && w > 0) setScale(w / vb.width);
    };
    const raf = requestAnimationFrame(() => {
      measureScale();
      requestAnimationFrame(measureScale);
    });
    const wrap = svgWrapRef.current;
    const ro = wrap ? new ResizeObserver(measureScale) : null;
    if (ro && wrap) ro.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [spread?.html]);

  // Blok konumları → ızgara koordinatında yüzde bantlar.
  const bands: Band[] = [];
  if (spread && positions.length > 0) {
    const { gridW, gridH, pageW, pageH } = spread;
    const sorted = [...positions].sort((a, b) => a.page - b.page || a.yPt - b.yPt);
    const gx = (p: BlockPos) => pagePos(p.page - 1).col * pageW;
    const gy = (p: BlockPos) => pagePos(p.page - 1).row * (pageH + ROW_GAP_PT) + p.yPt;
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const top = gy(cur);
      const next = sorted[i + 1];
      // Bandın altı: sonraki blok AYNI sayfadaysa onun tepesi; değilse sayfa altı.
      const pageBottom = pagePos(cur.page - 1).row * (pageH + ROW_GAP_PT) + pageH;
      const bottom = next && next.page === cur.page ? gy(next) : pageBottom;
      bands.push({
        idx: cur.idx,
        leftPct: (gx(cur) / gridW) * 100,
        topPct: (top / gridH) * 100,
        widthPct: (pageW / gridW) * 100,
        heightPct: (Math.max(12, bottom - top) / gridH) * 100,
      });
    }
  }
  const editBand = editingBlock != null ? bands.find((b) => b.idx === editingBlock) : undefined;

  return (
    <div className="relative h-full overflow-auto bg-[var(--surface)] px-6 py-6">
      <div className="pointer-events-none absolute right-3 top-3 z-20">
        {status === "compiling" && (
          <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">derleniyor…</span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">önizleme hatası</span>
        )}
      </div>

      {spread ? (
        <div ref={svgWrapRef} className="relative mx-auto max-w-[920px]">
          {/* Gerçek Typst sayfaları (= PDF), açık-kitap düzeninde */}
          <div
            className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:overflow-visible"
            dangerouslySetInnerHTML={{ __html: spread.html }}
          />
          {/* Tıklanabilir blok bölgeleri */}
          <div className="absolute inset-0">
            {bands.map((b) => (
              <button
                key={b.idx}
                type="button"
                onClick={() => onSelectBlock(b.idx)}
                title="Düzenle / sayfa düzeni"
                className={`absolute cursor-pointer rounded-sm transition ${
                  editingBlock === b.idx ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-accent/10"
                }`}
                style={{ left: `${b.leftPct}%`, top: `${b.topPct}%`, width: `${b.widthPct}%`, height: `${b.heightPct}%` }}
              />
            ))}
          </div>
          {/* Düzenlenen bloğun editör overlay'i (sayfa sütununda, Typst boyunda) */}
          {editBand && renderBlockOverlay && scale > 0 && (
            <div
              className="absolute"
              style={{ left: `${editBand.leftPct}%`, top: `${editBand.topPct}%`, width: `${editBand.widthPct}%` }}
            >
              {renderBlockOverlay(editBand.idx, {
                leftPct: editBand.leftPct,
                topPct: editBand.topPct,
                widthPct: editBand.widthPct,
                heightPct: editBand.heightPct,
                pxPerMm: (scale * 72) / 25.4,
                renderDpi: scale * 72,
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-center text-sm text-muted">
          {input.blocks.length === 0 ? "Metin ekleyin — sayfalar burada belirir." : "Sayfa hazırlanıyor…"}
        </div>
      )}
    </div>
  );
}
