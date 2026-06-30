// Yayın preflight'i — üretilmiş PDF'i açıp BASKIYA-HAZIRLIK denetimleri yapar
// (pdf-lib, zaten bağımlı). Tarayıcıda GÜVENİLİR olan YAPISAL kontroller: PDF
// sağlamlığı, şifreleme, sayfa sayısı, sayfa boyutu (MediaBox), TrimBox/BleedBox,
// gömülü fontlar, görsel sayısı. (Görsel-DPI / CMYK gibi içerik-akışı denetimleri
// sunucu aracı gerektirir — kapsam dışı.)

import { PDFDocument, PDFName, PDFDict, PDFRawStream } from "pdf-lib";

const PT_PER_MM = 72 / 25.4;

export type PreflightLevel = "ok" | "warn" | "error";
export type PreflightItem = { level: PreflightLevel; label: string; detail?: string };
export type PreflightReport = { items: PreflightItem[]; errorCount: number; warnCount: number; ready: boolean };

export type PreflightSpec = {
  sizeMm: { width: number; height: number }; // trim boyutu (mm)
  toMm: number; // kesim/trim → kâğıt kenarı (mm); MediaBox = trim + 2·to
  bleedMm: number;
};

function finalize(items: PreflightItem[]): PreflightReport {
  const errorCount = items.filter((i) => i.level === "error").length;
  const warnCount = items.filter((i) => i.level === "warn").length;
  return { items, errorCount, warnCount, ready: errorCount === 0 };
}

export async function preflightPdf(bytes: Uint8Array, spec: PreflightSpec): Promise<PreflightReport> {
  const items: PreflightItem[] = [];
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    return finalize([{ level: "error", label: "PDF açılamadı (bozuk olabilir)", detail: String(e) }]);
  }

  // Şifreleme — baskı için şifresiz olmalı.
  items.push(
    doc.isEncrypted
      ? { level: "error", label: "PDF şifreli", detail: "Baskı/yükleme için şifresiz olmalı." }
      : { level: "ok", label: "Şifreleme yok" },
  );

  // Sayfa sayısı.
  const pages = doc.getPages();
  items.push({ level: pages.length > 0 ? "ok" : "error", label: `Sayfa sayısı: ${pages.length}` });

  // Sayfa boyutu (MediaBox) = trim + 2·to.
  const expW = (spec.sizeMm.width + 2 * spec.toMm) * PT_PER_MM;
  const expH = (spec.sizeMm.height + 2 * spec.toMm) * PT_PER_MM;
  let sizeOk = pages.length > 0;
  for (const p of pages) {
    const s = p.getSize();
    if (Math.abs(s.width - expW) > 1.5 || Math.abs(s.height - expH) > 1.5) {
      sizeOk = false;
      break;
    }
  }
  const sizeLabel = `Sayfa boyutu: ${spec.sizeMm.width}×${spec.sizeMm.height} mm${spec.toMm > 0 ? " (+ taşma payı)" : ""}`;
  items.push(
    sizeOk
      ? { level: "ok", label: sizeLabel }
      : { level: "error", label: "Sayfa boyutu beklenenden farklı", detail: sizeLabel },
  );

  // TrimBox / BleedBox (ilk sayfada).
  const firstNode = pages[0]?.node as PDFDict | undefined;
  const hasTrim = !!firstNode?.get(PDFName.of("TrimBox"));
  items.push(
    hasTrim
      ? { level: "ok", label: "TrimBox (kesim kutusu) işaretli" }
      : { level: spec.toMm > 0 ? "error" : "warn", label: "TrimBox yok", detail: "KDY/KDP kesim kutusu bekler." },
  );
  if (spec.bleedMm > 0) {
    const hasBleed = !!firstNode?.get(PDFName.of("BleedBox"));
    items.push(
      hasBleed
        ? { level: "ok", label: "BleedBox (taşma kutusu) işaretli" }
        : { level: "error", label: "BleedBox yok", detail: "Taşmalı baskı için gerekir." },
    );
  }

  // Gömülü fontlar + görsel sayısı — tüm dolaylı nesneleri tara.
  let fontDescs = 0;
  let notEmbedded = 0;
  let images = 0;
  try {
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null;
      if (!dict) continue;
      if (dict.get(PDFName.of("Type")) === PDFName.of("FontDescriptor")) {
        fontDescs++;
        const embedded =
          dict.get(PDFName.of("FontFile")) ||
          dict.get(PDFName.of("FontFile2")) ||
          dict.get(PDFName.of("FontFile3"));
        if (!embedded) notEmbedded++;
      }
      if (dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) images++;
    }
  } catch {
    /* tarama hatası → font/görsel denetimini atla */
  }

  if (fontDescs === 0) {
    items.push({ level: "warn", label: "Font bilgisi okunamadı", detail: "Yine de Typst fontları gömer." });
  } else if (notEmbedded === 0) {
    items.push({ level: "ok", label: `Tüm fontlar gömülü (${fontDescs} font)` });
  } else {
    items.push({ level: "error", label: `${notEmbedded} font gömülü değil`, detail: "KDP/KDY gömülü font ister." });
  }

  items.push({
    level: "ok",
    label: `Görsel sayısı: ${images}`,
    detail: images === 0 ? "Görsel yok (düz metin kitabı) — normal." : undefined,
  });

  return finalize(items);
}
