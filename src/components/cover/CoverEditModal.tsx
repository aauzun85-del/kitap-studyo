"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MagicWandIcon, TrashIcon } from "@/components/PhosphorIcons";

// "Boya & değiştir" penceresi. Değiştirilecek bölge iki yolla seçilir:
//  1) "Yaz & bul": nesne adı yazılır, AI (grounded SAM) onu bulup maskeler (fırçasız).
//  2) "Elle boya": kullanıcı bölgeyi fırçayla boyar.
// Seçilen bölge sonra flux-fill ile yeniden çizilir. Maske ekranda turuncu/yarı
// saydam görünür; sunucuya giderken siyah-beyaza (beyaz = değiştir) çevrilir.

export type CoverEditStrings = {
  title: string;
  hint: string;
  brushLabel: string;
  promptLabel: string;
  promptHint: string;
  promptPlaceholder: string;
  undo: string;
  clear: string;
  cancel: string;
  apply: string;
  busy: string;
  needMask: string;
  needPrompt: string;
  errorToken: string;
  errorGeneric: string;
  modeFind: string;
  modePaint: string;
  findLabel: string;
  findHint: string;
  findPlaceholder: string;
  findCta: string;
  finding: string;
  findNotFound: string;
  findFound: string;
  findAdjust: string;
  findAdjustHint: string;
  tagsCta: string;
  tagsBusy: string;
  tagsHint: string;
  tagsHeading: string;
  tagsEmpty: string;
};

type Tag = { en: string; tr: string };

type Pt = { x: number; y: number };
type Stroke = { size: number; pts: Pt[] };

const BRUSH_MIN = 12;
const BRUSH_MAX = 120;
const MASK_COLOR = "rgba(255,120,40,0.55)";
const OVERLAY_RGBA = [255, 120, 40, 140] as const;

export default function CoverEditModal({
  image,
  t,
  onClose,
  onApply,
}: {
  image: string;
  t: CoverEditStrings;
  onClose: () => void;
  onApply: (newImage: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke | null>(null);
  const natRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  // AI'nın bulduğu maske: gerçek çözünürlükte (beyaz=nesne) + ekranda turuncu katman.
  const aiMaskRef = useRef<HTMLCanvasElement | null>(null);
  const aiOverlayRef = useRef<HTMLCanvasElement | null>(null);

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<"find" | "paint">("find");
  const [brush, setBrush] = useState(40);
  const [prompt, setPrompt] = useState("");
  const [findLabel, setFindLabel] = useState("");
  const [findAdjust, setFindAdjust] = useState(0);
  const [finding, setFinding] = useState(false);
  // Otomatik nesne listesi (Seviye B).
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagging, setTagging] = useState(false);
  const [tagsEmpty, setTagsEmpty] = useState(false);
  const [hasAiMask, setHasAiMask] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0); // undo/apply için
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<"none" | "found">("none");
  const [error, setError] = useState<
    "none" | "mask" | "prompt" | "notfound" | "token" | "generic"
  >("none");

  const hasSelection = hasAiMask || strokeCount > 0;

  // Görseli yükleyip ekrana sığacak görüntü boyutunu hesapla (pencereye göre).
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      natRef.current = { w: img.naturalWidth, h: img.naturalHeight };
      const maxW = Math.min(window.innerWidth - 48, 900);
      const maxH = window.innerHeight - 300;
      const ratio = img.naturalWidth / img.naturalHeight;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      setDims({ w: Math.round(w), h: Math.round(h) });
    };
    img.src = image;
  }, [image]);

  // Ekrandaki maske katmanını sıfırdan çiz (AI katmanı + elle fırça).
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (aiOverlayRef.current) {
      ctx.drawImage(aiOverlayRef.current, 0, 0, canvas.width, canvas.height);
    }
    drawStrokes(ctx, strokesRef.current, 1, MASK_COLOR);
  }, []);

  useEffect(() => {
    redraw();
  }, [dims, redraw]);

  // ESC ile kapat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !finding) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy, finding]);

  const posFromEvent = (e: React.PointerEvent): Pt => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || mode !== "paint") return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = posFromEvent(e);
    currentRef.current = { size: brush, pts: [p] };
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = MASK_COLOR;
      ctx.beginPath();
      ctx.arc(p.x, p.y, brush / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const stroke = currentRef.current;
    if (!stroke) return;
    const p = posFromEvent(e);
    const prev = stroke.pts[stroke.pts.length - 1];
    stroke.pts.push(p);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = MASK_COLOR;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const onPointerUp = () => {
    if (!currentRef.current) return;
    strokesRef.current.push(currentRef.current);
    currentRef.current = null;
    setStrokeCount(strokesRef.current.length);
    if (error === "mask") setError("none");
  };

  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const clearAll = () => {
    strokesRef.current = [];
    aiMaskRef.current = null;
    aiOverlayRef.current = null;
    setStrokeCount(0);
    setHasAiMask(false);
    setInfo("none");
    redraw();
  };

  // Nesneyi AI'ya buldur, maskesini katman olarak ekle.
  // translate=false → label zaten İngilizce (etiket tıklaması), çeviri atlanır.
  const runDetect = async (sendLabel: string, translate: boolean) => {
    const label = sendLabel.trim();
    if (!label || finding || busy) return;
    setFinding(true);
    setError("none");
    setInfo("none");
    try {
      const res = await fetch("/api/cover-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, label, adjustment: findAdjust, translate }),
      });
      if (res.status === 503) {
        setError("token");
        return;
      }
      if (!res.ok) {
        setError("generic");
        return;
      }
      const data = (await res.json()) as { mask?: string };
      if (!data.mask) {
        setError("generic");
        return;
      }
      const { w, h } = natRef.current;
      const maskImg = await loadImage(data.mask);
      // Gerçek çözünürlükte maske (gönderim için) + ekran katmanı (gösterim için).
      aiMaskRef.current = maskToCanvas(maskImg, w, h);
      const { canvas: overlay, count } = maskToOverlay(
        maskImg,
        dims?.w ?? w,
        dims?.h ?? h,
      );
      // Çok az beyaz piksel → nesne aslında bulunamadı.
      if (count < 25) {
        aiMaskRef.current = null;
        aiOverlayRef.current = null;
        setHasAiMask(false);
        setError("notfound");
        redraw();
        return;
      }
      aiOverlayRef.current = overlay;
      setHasAiMask(true);
      setInfo("found");
      redraw();
    } catch {
      setError("generic");
    } finally {
      setFinding(false);
    }
  };

  // Elle yazılan kelimeyle bul (çeviri açık).
  const findObject = () => runDetect(findLabel, true);

  // Bir etikete tıklayınca: kelimeyi göster + İngilizcesiyle (çevirisiz) ara.
  const onTagClick = (tag: Tag) => {
    setFindLabel(tag.tr);
    runDetect(tag.en, false);
  };

  // "Nesneleri bul": AI görseldeki nesneleri listeler → tıklanabilir etiketler.
  const fetchTags = async () => {
    if (tagging || finding || busy) return;
    setTagging(true);
    setError("none");
    setTagsEmpty(false);
    try {
      const res = await fetch("/api/cover-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (res.status === 503) {
        setError("token");
        return;
      }
      if (!res.ok) {
        setError("generic");
        return;
      }
      const data = (await res.json()) as { tags?: Tag[] };
      if (!data.tags || data.tags.length === 0) {
        setTags([]);
        setTagsEmpty(true);
        return;
      }
      setTags(data.tags);
    } catch {
      setError("generic");
    } finally {
      setTagging(false);
    }
  };

  // Maskeyi orijinal görsel çözünürlüğünde siyah-beyaz üret (beyaz = değiştir).
  const buildMask = (): string | null => {
    const { w, h } = natRef.current;
    if (!w || !h || !dims) return null;
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const ctx = mask.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (aiMaskRef.current) {
      ctx.drawImage(aiMaskRef.current, 0, 0, w, h);
    }
    const scale = w / dims.w; // ekran → gerçek çözünürlük
    drawStrokes(ctx, strokesRef.current, scale, "#fff");
    return mask.toDataURL("image/png");
  };

  const apply = async () => {
    if (!hasSelection) {
      setError("mask");
      return;
    }
    if (!prompt.trim()) {
      setError("prompt");
      return;
    }
    const mask = buildMask();
    if (!mask) {
      setError("generic");
      return;
    }
    setBusy(true);
    setError("none");
    try {
      const res = await fetch("/api/cover-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mask, prompt: prompt.trim() }),
      });
      if (res.status === 503) {
        setError("token");
        return;
      }
      if (!res.ok) {
        setError("generic");
        return;
      }
      const data = (await res.json()) as { image?: string };
      if (!data.image) {
        setError("generic");
        return;
      }
      onApply(data.image);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-sans text-xl font-bold text-white">{t.title}</h2>
            <p className="mt-1 text-sm text-white/70">{t.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {t.cancel}
          </button>
        </div>

        {/* Boyama alanı: görsel altta, maske katmanı üstte */}
        <div className="flex justify-center">
          {dims && (
            <div
              className="relative touch-none overflow-hidden rounded-xl ring-1 ring-white/20"
              style={{ width: dims.w, height: dims.h }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full select-none"
                draggable={false}
              />
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                className={`absolute inset-0 ${mode === "paint" ? "cursor-crosshair" : "cursor-default"}`}
                style={{ touchAction: "none" }}
              />
            </div>
          )}
        </div>

        {/* Mod seçimi: Yaz & bul / Elle boya */}
        <div className="grid grid-cols-2 gap-2">
          <ModeButton active={mode === "find"} onClick={() => setMode("find")}>
            {t.modeFind}
          </ModeButton>
          <ModeButton active={mode === "paint"} onClick={() => setMode("paint")}>
            {t.modePaint}
          </ModeButton>
        </div>

        {mode === "find" ? (
          <div className="space-y-2 rounded-xl bg-white/10 px-4 py-3">
            <label className="block text-sm font-medium text-white">
              {t.findLabel}
            </label>
            <div className="flex gap-2">
              <input
                value={findLabel}
                onChange={(e) => {
                  setFindLabel(e.target.value);
                  if (error === "notfound") setError("none");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") findObject();
                }}
                placeholder={t.findPlaceholder}
                disabled={finding || busy}
                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-accent"
              />
              <button
                type="button"
                onClick={findObject}
                disabled={!findLabel.trim() || finding || busy}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finding ? t.finding : t.findCta}
              </button>
            </div>
            <p className="text-xs text-white/60">{t.findHint}</p>

            {/* Otomatik nesne listesi (Seviye B): AI nesneleri listeler, tıkla → maskele */}
            <div className="border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={fetchTags}
                disabled={tagging || finding || busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MagicWandIcon className="h-4 w-4" />
                {tagging ? t.tagsBusy : t.tagsCta}
              </button>
              <p className="mt-1.5 text-xs text-white/50">{t.tagsHint}</p>
              {tags.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-medium text-white/70">
                    {t.tagsHeading}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.en}
                        type="button"
                        onClick={() => onTagClick(tag)}
                        disabled={finding || busy}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:border-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {tag.tr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tagsEmpty && (
                <p className="mt-2 text-xs text-white/60">{t.tagsEmpty}</p>
              )}
            </div>

            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-sm text-white/80">
                <span>{t.findAdjust}</span>
                <span className="font-mono text-xs text-white/60">
                  {findAdjust > 0 ? `+${findAdjust}` : findAdjust}
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={60}
                step={5}
                value={findAdjust}
                onChange={(e) => setFindAdjust(Number(e.target.value))}
                disabled={finding || busy}
                className="mt-1 w-full accent-accent"
              />
              <p className="mt-1 text-xs text-white/50">{t.findAdjustHint}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearAll}
                disabled={!hasSelection || busy}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <TrashIcon className="h-4 w-4" />
                {t.clear}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-white/10 px-4 py-3">
            <label className="flex items-center gap-3 text-sm text-white/80">
              <span className="whitespace-nowrap">{t.brushLabel}</span>
              <input
                type="range"
                min={BRUSH_MIN}
                max={BRUSH_MAX}
                value={brush}
                onChange={(e) => setBrush(Number(e.target.value))}
                className="w-32 accent-accent"
              />
              <span
                className="rounded-full bg-accent/70"
                style={{ width: brush / 3 + 4, height: brush / 3 + 4 }}
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={strokeCount === 0 || busy}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t.undo}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!hasSelection || busy}
                className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <TrashIcon className="h-4 w-4" />
                {t.clear}
              </button>
            </div>
          </div>
        )}

        {/* Ne gelsin */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">{t.promptLabel}</label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (error === "prompt") setError("none");
            }}
            placeholder={t.promptPlaceholder}
            rows={2}
            className="w-full resize-none rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-accent"
          />
          <p className="text-xs text-white/60">{t.promptHint}</p>
        </div>

        {info === "found" && error === "none" && (
          <Note tone="ok">{t.findFound}</Note>
        )}
        {error === "notfound" && <Note>{t.findNotFound}</Note>}
        {error === "mask" && <Note>{t.needMask}</Note>}
        {error === "prompt" && <Note>{t.needPrompt}</Note>}
        {error === "token" && <Note>{t.errorToken}</Note>}
        {error === "generic" && <Note>{t.errorGeneric}</Note>}

        <div className="flex gap-3 pb-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || finding}
            className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MagicWandIcon className="h-4 w-4" />
            {busy ? t.busy : t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-accent bg-accent text-white"
          : "border-white/20 text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Note({
  children,
  tone = "warn",
}: {
  children: React.ReactNode;
  tone?: "warn" | "ok";
}) {
  return (
    <p
      className={`rounded-lg border px-3 py-2.5 text-xs text-white ${
        tone === "ok"
          ? "border-emerald-400/50 bg-emerald-400/15"
          : "border-accent/50 bg-accent/15"
      }`}
    >
      {children}
    </p>
  );
}

// Bir görseli (data URL) yükleyip <img> nesnesi döndürür.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// AI maskesini hedef boyutta bir tuvale çizer (siyah-beyaz korunur).
function maskToCanvas(
  img: HTMLImageElement,
  w: number,
  h: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(img, 0, 0, w, h);
  return c;
}

// AI maskesini ekranda gösterilecek turuncu/yarı saydam katmana çevirir.
// Beyaz piksel sayısını da döndürür (nesne bulundu mu kontrolü için).
function maskToOverlay(
  img: HTMLImageElement,
  w: number,
  h: number,
): { canvas: HTMLCanvasElement; count: number } {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 128) {
      d[i] = OVERLAY_RGBA[0];
      d[i + 1] = OVERLAY_RGBA[1];
      d[i + 2] = OVERLAY_RGBA[2];
      d[i + 3] = OVERLAY_RGBA[3];
      count++;
    } else {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(id, 0, 0);
  return { canvas: c, count };
}

// Fırça izlerini verilen bağlama (ekran ya da maske) çizer. scale: ekran→hedef oranı.
function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  scale: number,
  color: string,
) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const s of strokes) {
    const r = (s.size * scale) / 2;
    if (s.pts.length === 1) {
      const p = s.pts[0];
      ctx.beginPath();
      ctx.arc(p.x * scale, p.y * scale, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.lineWidth = s.size * scale;
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x * scale, s.pts[0].y * scale);
    for (let i = 1; i < s.pts.length; i++) {
      ctx.lineTo(s.pts[i].x * scale, s.pts[i].y * scale);
    }
    ctx.stroke();
  }
}
