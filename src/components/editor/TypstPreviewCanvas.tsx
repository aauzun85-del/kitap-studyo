"use client";

// Gerçek Typst sayfası (SVG) ÜSTÜNDE tıklanabilir blok bölgeleri. Typst
// introspection (renderBookSvgWithBlocks) her bloğun {sayfa, y(pt)} konumunu
// verir; bunları SVG kutusuna göre YÜZDE bantlara çevirip şeffaf hotspot div'leri
// koyarız (ölçek hesabı gerekmez: overlay SVG ile aynı kutu). Tıklayınca
// onSelectBlock(idx) → mevcut FormatBar + sayfa-düzeni araçları o bloğa bağlanır.
// editingBlock için renderBlockOverlay ile editör overlay'i konumlanır.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { renderBookSvgWithBlocks, type TypstBookInput, type BlockPos } from "@/lib/typst";

const PT_PER_MM = 72 / 25.4;

type Band = { idx: number; topPct: number; heightPct: number };

export function TypstPreviewCanvas({
  input,
  editingBlock,
  onSelectBlock,
  renderBlockOverlay,
}: {
  input: TypstBookInput;
  editingBlock: number | null;
  onSelectBlock: (idx: number) => void;
  // Düzenlenen blok için editör overlay'i. pxPerMm/renderDpi, SVG ölçeğine
  // eşitlenir → editör metni Typst metniyle aynı boyda görünür.
  renderBlockOverlay?: (
    idx: number,
    o: { topPct: number; heightPct: number; pxPerMm: number; renderDpi: number },
  ) => ReactNode;
}) {
  const [svg, setSvg] = useState("");
  const [positions, setPositions] = useState<BlockPos[]>([]);
  const [status, setStatus] = useState<"idle" | "compiling" | "error">("idle");
  const reqId = useRef(0);
  const svgWrapRef = useRef<HTMLDivElement | null>(null);
  // SVG'nin toplam yüksekliği (pt) — viewBox'tan okunur (boşluksuz dikey yığın).
  const [totalHeightPt, setTotalHeightPt] = useState(0);
  // Görüntülenen SVG'nin ölçeği: ekran-px / viewBox-pt (editör boyunu eşitlemek için).
  const [scale, setScale] = useState(0);

  // Girdi değişince debounce'la derle + konumları al.
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

  // SVG yerleşince viewBox yüksekliğini (toplam pt) + ekran ölçeğini oku;
  // kapsayıcı yeniden boyutlanınca ölçeği güncelle (ResizeObserver).
  useEffect(() => {
    // toplam yükseklik viewBox'tan gelir → YERLEŞİM gerekmez, hemen oku (hotspot'lar
    // bunu bekler). Ekran GENİŞLİĞİ (scale) yerleşim sonrası → rAF + ResizeObserver.
    const svgEl = svgWrapRef.current?.querySelector("svg");
    if (svgEl) {
      const vb = svgEl.viewBox.baseVal;
      if (vb && vb.height > 0) setTotalHeightPt(vb.height);
    }
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
  }, [svg]);

  // Geometri: kırpma/taşma payı dahil sayfa yüksekliği (pt).
  const to = input.cropMarks && input.bleedMm > 0 ? input.markOffsetMm : input.bleedMm;
  const pageHeightPt = (input.size.height + 2 * to) * PT_PER_MM;

  // Konumları → yüzde bantlara çevir. Her blok yığılmış-y'den bir sonraki bloğun
  // yığılmış-y'sine kadar (paragrafı kaplar); aşırı boşluk (boş sayfa) sınırlanır.
  const bands: Band[] = [];
  if (totalHeightPt > 0 && positions.length > 0) {
    const sorted = [...positions].sort((a, b) => a.page - b.page || a.yPt - b.yPt);
    const stackedY = (p: BlockPos) => (p.page - 1) * pageHeightPt + p.yPt;
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const top = stackedY(cur);
      const next = sorted[i + 1];
      // Bandın altı: sonraki blok AYNI sayfadaysa onun tepesi, değilse bu sayfanın
      // altı (band asla boş/sonraki sayfaya taşmasın).
      const bottom = next && next.page === cur.page ? stackedY(next) : cur.page * pageHeightPt;
      const h = Math.max(12, bottom - top);
      bands.push({ idx: cur.idx, topPct: (top / totalHeightPt) * 100, heightPct: (h / totalHeightPt) * 100 });
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

      {svg ? (
        <div ref={svgWrapRef} className="relative mx-auto max-w-[560px]">
          {/* Gerçek Typst sayfaları (= PDF) */}
          <div
            className="[&_svg]:h-auto [&_svg]:w-full [&_svg]:rounded-sm [&_svg]:bg-white [&_svg]:shadow-[0_2px_16px_rgba(0,0,0,0.18)]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          {/* Tıklanabilir blok bölgeleri */}
          <div className="absolute inset-0">
            {bands.map((b) => (
              <button
                key={b.idx}
                type="button"
                onClick={() => onSelectBlock(b.idx)}
                title="Düzenle / sayfa düzeni"
                className={`absolute left-0 w-full cursor-pointer rounded-sm transition ${
                  editingBlock === b.idx ? "bg-accent/15 ring-1 ring-accent" : "hover:bg-accent/10"
                }`}
                style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
              />
            ))}
          </div>
          {/* Düzenlenen bloğun editör overlay'i (Typst ölçeğiyle eşit boyda) */}
          {editBand && renderBlockOverlay && scale > 0 && (
            <div className="absolute left-0 w-full" style={{ top: `${editBand.topPct}%` }}>
              {renderBlockOverlay(editBand.idx, {
                topPct: editBand.topPct,
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
