"use client";

// Yazma görünümünün sağ yarısı — yazarken motorun ürettiği BASKI sayfasını canlı
// gösterir. Girdi (metin/ayar) değişince debounce'la Typst'i SVG'ye derler
// (incremental ~20ms). Derlenirken SON İYİ görüntüyü tutar (ekran boşalmaz);
// hata olursa son iyi görüntü kalır. Tek <svg> içinde tüm sayfalar dikey dizili
// → kolon genişliğine sığdırılır, aşağı kaydırılır.

import { useEffect, useRef, useState } from "react";
import { renderBookSvgTypst, type TypstBookInput } from "@/lib/typst";

export function LiveTypstPreview({ input }: { input: TypstBookInput }) {
  const [svg, setSvg] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "compiling" | "error">("idle");
  // En son istenen derlemenin kimliği — yarış (eski sonuç yeniyi ezmesin) önler.
  const reqId = useRef(0);

  useEffect(() => {
    if (input.blocks.length === 0) {
      setSvg("");
      setStatus("idle");
      return;
    }
    const id = ++reqId.current;
    setStatus("compiling");
    const timer = setTimeout(() => {
      renderBookSvgTypst(input)
        .then((out) => {
          if (reqId.current === id) {
            setSvg(out);
            setStatus("idle");
          }
        })
        .catch(() => {
          if (reqId.current === id) setStatus("error");
        });
    }, 280);
    return () => clearTimeout(timer);
  }, [input]);

  return (
    <div className="relative h-full overflow-auto bg-[var(--surface)] px-6 py-6">
      {/* Derleme/hata rozeti — sağ üstte, içeriği örtmeden */}
      <div className="pointer-events-none absolute right-3 top-3 z-10">
        {status === "compiling" && (
          <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background">
            derleniyor…
          </span>
        )}
        {status === "error" && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
            önizleme hatası
          </span>
        )}
      </div>

      {svg ? (
        <div
          // Typst SVG'si sayfayı ŞEFFAF zeminle + metni SİYAH çizer → koyu arayüzde
          // görünmez. Sayfaya beyaz kâğıt zemini ver (okunur + "kâğıt" hissi).
          className="mx-auto max-w-[520px] [&_svg]:h-auto [&_svg]:w-full [&_svg]:rounded-sm [&_svg]:bg-white [&_svg]:shadow-[0_2px_16px_rgba(0,0,0,0.18)]"
          // İçerik kullanıcının KENDİ metninden bizim Typst derlememizden gelir
          // (dış kaynak değil) → güvenli.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-center text-sm text-muted">
          {input.blocks.length === 0
            ? "Yazmaya başlayın — sayfa burada belirir."
            : "Sayfa hazırlanıyor…"}
        </div>
      )}
    </div>
  );
}
