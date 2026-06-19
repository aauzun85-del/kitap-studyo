"use client";

import { useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { useMetaSync, useManuscriptSync } from "@/lib/projects/useSync";
import { docxToText } from "@/lib/editor/docxText";
import { splitChapters } from "@/lib/publish/chapters";
import { buildEpubBlob, suggestFilename } from "@/lib/publish/epub";
import { buildPdfBlob } from "@/lib/publish/pdf";
import {
  TextTIcon,
  BookIcon,
  CheckCircleIcon,
  MagicWandIcon,
} from "@/components/PhosphorIcons";

const SAMPLE_TR = `Önsöz

Bu kitap, uzun bir yolculuğun sonunda doğdu. Yıllarca biriken notlar, bir gün kendiliğinden bir düzene kavuştu.

Birinci Bölüm

Sabah ışığı perdelerin arasından süzülürken, masanın üstünde duran kahve çoktan soğumuştu. Yine de fincanı eline aldı.

Pencerenin önünde durup sokağa baktı. Şehir uyanıyordu ama o, bir süredir uykuya hiç dalmamış gibi hissediyordu.

İkinci Bölüm

Belki de mesele uyku değildi. Belki de mesele, dün gece okuduğu o mektuptu. Mektup hâlâ ceketinin cebindeydi.`;

type EbookFormat = "epub" | "kindle" | "pdf";

export default function EkitapStudio({
  lang,
  dict,
  initialProject,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
}) {
  const t = dict.publishStudio;
  const projectId = initialProject?.id ?? null;
  const seed = initialProject?.data;

  const [raw, setRaw] = useState(seed?.manuscript.text ?? "");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState(false);

  const [bookTitle, setBookTitle] = useState(seed?.meta.title ?? "");
  const [bookAuthor, setBookAuthor] = useState(seed?.meta.author ?? "");

  // Bulut projesi: başlık/yazar + metni projeye yaz.
  useMetaSync(projectId, { title: bookTitle, author: bookAuthor });
  useManuscriptSync(projectId, raw, "ekitap");

  // Kapak görseli: dosyanın kendisi + önizleme için nesne URL'i.
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);

  const [formats, setFormats] = useState<Record<EbookFormat, boolean>>({
    epub: true,
    kindle: false,
    pdf: false,
  });

  const [building, setBuilding] = useState(false);
  const [epubDone, setEpubDone] = useState(false);
  const [epubError, setEpubError] = useState(false);

  const chapters = useMemo(() => splitChapters(raw), [raw]);
  const totalWords = useMemo(
    () => chapters.reduce((sum, c) => sum + c.words, 0),
    [chapters],
  );
  const stats = useMemo(
    () => ({ words: raw.trim() ? raw.trim().split(/\s+/).length : 0, chars: raw.length }),
    [raw],
  );
  const hasText = raw.trim().length > 0;

  function resetBuild() {
    setEpubDone(false);
    setEpubError(false);
  }

  async function handleDocx(file: File) {
    setImporting(true);
    setImportError(false);
    setImportInfo(null);
    resetBuild();
    try {
      const buffer = await file.arrayBuffer();
      const { text, paragraphCount } = docxToText(buffer);
      setRaw(text);
      setImportInfo(t.wordImportedInfo.replace("{paragraphs}", String(paragraphCount)));
    } catch {
      setImportError(true);
    } finally {
      setImporting(false);
    }
  }

  // Kapak görseli seç: yalnız JPG/PNG kabul; önceki önizleme URL'ini temizler.
  function handleCover(file: File) {
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setCoverError(true);
      return;
    }
    setCoverError(false);
    setCoverUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCoverFile(file);
    resetBuild();
  }

  function removeCover() {
    setCoverUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverFile(null);
    setCoverError(false);
    resetBuild();
  }

  function toggleFormat(f: EbookFormat) {
    setFormats((prev) => ({ ...prev, [f]: !prev[f] }));
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Seçili tüm formatları tarayıcıda üretip indirir. Kindle = Amazon KDP'nin
  // doğrudan kabul ettiği EPUB (aynı motor, farklı dosya adı).
  async function handleBuild() {
    setBuilding(true);
    resetBuild();
    try {
      const pubChapters = chapters.map((c) => ({
        title: c.title || t.chapterUntitled,
        paragraphs: c.paragraphs,
      }));
      const title = bookTitle.trim() || t.untitledBook;
      const author = bookAuthor.trim();
      const base = suggestFilename(title).replace(/\.epub$/, "");

      // Kapak seçildiyse baytlarını oku; EPUB ve Kindle çıktısına gömülür.
      const cover = coverFile
        ? { bytes: await coverFile.arrayBuffer(), mime: coverFile.type }
        : undefined;

      if (formats.epub) {
        const blob = await buildEpubBlob({ title, author, lang, tocTitle: t.tocTitle, chapters: pubChapters, cover });
        download(blob, `${base}.epub`);
      }
      if (formats.kindle) {
        const blob = await buildEpubBlob({ title, author, lang, tocTitle: t.tocTitle, chapters: pubChapters, cover });
        download(blob, `${base}-kdp.epub`);
      }
      if (formats.pdf) {
        const blob = await buildPdfBlob({ title, author, chapters: pubChapters });
        download(blob, `${base}.pdf`);
      }
      setEpubDone(true);
    } catch {
      setEpubError(true);
    } finally {
      setBuilding(false);
    }
  }

  const FORMATS: { id: EbookFormat; title: string; desc: string; soon: boolean }[] = [
    { id: "epub", title: t.formatEpub, desc: t.formatEpubDesc, soon: false },
    { id: "kindle", title: t.formatKindle, desc: t.formatKindleDesc, soon: false },
    { id: "pdf", title: t.formatPdf, desc: t.formatPdfDesc, soon: false },
  ];
  const anyFormat = formats.epub || formats.kindle || formats.pdf;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-4 px-4 py-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-[380px]">
        {/* Metin girişi */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TextTIcon className="h-5 w-5 text-accent" />
            {t.textHeading}
          </div>

          <label className="mt-3 block text-xs font-medium text-muted">{t.textLabel}</label>
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              resetBuild();
            }}
            placeholder={t.textPlaceholder}
            rows={12}
            className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition focus:border-accent"
          />

          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRaw(SAMPLE_TR);
                  resetBuild();
                }}
                className="font-medium text-accent transition hover:underline"
              >
                {t.sampleCta}
              </button>
              <button
                onClick={() => {
                  setRaw("");
                  resetBuild();
                }}
                className="font-medium transition hover:text-foreground"
              >
                {t.clearCta}
              </button>
            </div>
            <span>
              {stats.words} {t.statsWords} · {stats.chars} {t.statsChars}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleDocx(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BookIcon className="h-4 w-4 text-accent" />
            {importing ? t.wordImporting : t.wordCta}
          </button>
          {importInfo && <p className="mt-1.5 text-xs text-muted">{importInfo}</p>}
          {importError && <p className="mt-1.5 text-xs text-red-500">{t.wordError}</p>}
          <p className="mt-1.5 text-xs text-muted">{t.transferHint}</p>
        </div>

        {/* Kitap bilgileri */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookIcon className="h-5 w-5 text-accent" />
            {t.metaHeading}
          </div>
          <label className="mt-3 block text-xs font-medium text-muted">{t.bookTitleLabel}</label>
          <input
            type="text"
            value={bookTitle}
            onChange={(e) => {
              setBookTitle(e.target.value);
              resetBuild();
            }}
            placeholder={t.bookTitlePlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
          <label className="mt-3 block text-xs font-medium text-muted">{t.bookAuthorLabel}</label>
          <input
            type="text"
            value={bookAuthor}
            onChange={(e) => {
              setBookAuthor(e.target.value);
              resetBuild();
            }}
            placeholder={t.bookAuthorPlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
        </div>

        {/* Kapak görseli */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookIcon className="h-5 w-5 text-accent" />
            {t.coverHeading}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCover(file);
              e.target.value = "";
            }}
          />
          {coverUrl ? (
            <div className="mt-3 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt={t.coverHeading}
                className="h-28 w-auto shrink-0 rounded-md border border-border object-cover"
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="truncate text-xs text-muted">{coverFile?.name}</p>
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent"
                >
                  {t.coverChangeCta}
                </button>
                <button
                  onClick={removeCover}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:text-red-500"
                >
                  {t.coverRemoveCta}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent"
            >
              <BookIcon className="h-4 w-4 text-accent" />
              {t.coverCta}
            </button>
          )}
          {coverError && <p className="mt-1.5 text-xs text-red-500">{t.coverFormatError}</p>}
          <p className="mt-1.5 text-xs text-muted">{t.coverHint}</p>
        </div>

        {/* E-kitap formatları */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookIcon className="h-5 w-5 text-accent" />
            {t.formatsHeading}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {FORMATS.map((f) => (
              <li key={f.id}>
                <label
                  className={`flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition ${
                    f.soon ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-accent/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formats[f.id]}
                    disabled={f.soon}
                    onChange={() => toggleFormat(f.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)] disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {f.title}
                      {f.soon && (
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent">
                          {t.formatSoon}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{f.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            onClick={handleBuild}
            disabled={!hasText || !anyFormat || building || chapters.length === 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagicWandIcon className="h-4 w-4" />
            {building ? t.building : t.buildEbookCta}
          </button>
          {epubDone && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-accent">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {t.epubDoneNote}
            </p>
          )}
          {epubError && <p className="mt-2 text-xs text-red-500">{t.epubErrorNote}</p>}
        </div>
      </aside>

      {/* Canlı içindekiler önizlemesi */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background lg:sticky lg:top-4 lg:h-[calc(100dvh-12rem)]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
            {t.previewHeading}
          </span>
          {hasText && (
            <span className="font-mono text-xs text-accent">
              {t.chaptersFound.replace("{count}", String(chapters.length))}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!hasText ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="max-w-sm text-center">
                <BookIcon className="mx-auto h-10 w-10 text-border" />
                <p className="mt-3 text-sm text-muted">{t.previewEmpty}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent">
                  {t.totalWords.replace("{count}", String(totalWords))}
                </span>
              </div>
              <ol className="flex flex-col gap-2">
                {chapters.map((c, i) => {
                  const max = Math.max(...chapters.map((x) => x.words), 1);
                  return (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-surface px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">
                            {i + 1}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                            {c.title || t.chapterUntitled}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-muted">
                          {c.words} {t.statsWords}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                        <div
                          className="h-full rounded-full bg-accent/60"
                          style={{ width: `${Math.max(4, (c.words / max) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-foreground">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>{t.previewReady}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
