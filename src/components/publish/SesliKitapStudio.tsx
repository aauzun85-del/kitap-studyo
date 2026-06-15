"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { useMetaSync, useManuscriptSync } from "@/lib/projects/useSync";
import { docxToText } from "@/lib/editor/docxText";
import { splitChapters } from "@/lib/publish/chapters";
import { suggestFilename } from "@/lib/publish/epub";
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

type AudioVoice = "ai" | "own";

export default function SesliKitapStudio({
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
  const [voice, setVoice] = useState<AudioVoice>("ai");

  // Bulut projesi: başlık + metni projeye yaz (sesli kitapta yazar alanı yok).
  useMetaSync(projectId, { title: bookTitle });
  useManuscriptSync(projectId, raw, "audiobook");

  // Sesli kitap (yapay zekâ sesi) durumu.
  // Ses motoru: MiniMax (Türkçe seslere uygun) | ElevenLabs v3 (çok doğal). İkisi
  // de aynı Replicate anahtarıyla çalışır; ses listeleri farklıdır.
  const [engine, setEngine] = useState<"minimax" | "elevenlabs">("minimax");
  const [aiVoice, setAiVoice] = useState(t.audioVoices[0]?.id ?? "Calm_Woman");
  const [aiSpeed, setAiSpeed] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [chapterAudio, setChapterAudio] = useState<Record<number, string>>({});
  const [genIdx, setGenIdx] = useState<number | null>(null);
  const [audioErr, setAudioErr] = useState<"token" | "generic" | null>(null);
  // Dinleme hızı: üretilen sesi yeniden üretmeden (kredi harcamadan) hızlı/yavaş
  // oynatır. TTS "okuma hızı"ndan farklı; yalnız oynatıcıya uygulanır.
  const [listenRate, setListenRate] = useState(1);
  const audioWrapRef = useRef<HTMLDivElement>(null);

  // Dinleme hızını mevcut tüm oynatıcılara uygula (hız değişince + yeni ses
  // üretilince yeniden çalışır).
  useEffect(() => {
    const players = audioWrapRef.current?.querySelectorAll("audio");
    players?.forEach((a) => {
      a.playbackRate = listenRate;
    });
  }, [listenRate, previewUrl, chapterAudio]);

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

  // Metin/bölümler değişince eski bölüm seslendirmeleri yanlış bölüme denk
  // gelmesin diye temizlenir.
  function resetAudio() {
    setChapterAudio({});
  }

  // Motor değişince o motorun ilk sesine geç, önceki sesleri temizle (eski motorun
  // ses kimliği yeni motorda geçersizdir).
  const voiceList = engine === "elevenlabs" ? t.audioVoicesEleven : t.audioVoices;
  function changeEngine(e: "minimax" | "elevenlabs") {
    if (e === engine) return;
    setEngine(e);
    const first = (e === "elevenlabs" ? t.audioVoicesEleven : t.audioVoices)[0]?.id;
    if (first) setAiVoice(first);
    setPreviewUrl(null);
    resetAudio();
  }

  async function handleDocx(file: File) {
    setImporting(true);
    setImportError(false);
    setImportInfo(null);
    resetAudio();
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

  // Metni /api/tts'e gönderir; başarılıysa çalınabilir/indirilebilir data URL
  // döner. Hata durumunda audioErr'i ayarlayıp null döndürür.
  async function callTts(text: string): Promise<string | null> {
    setAudioErr(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: aiVoice, speed: aiSpeed, engine }),
      });
      if (res.status === 503) {
        setAudioErr("token");
        return null;
      }
      if (!res.ok) {
        setAudioErr("generic");
        return null;
      }
      const data = (await res.json()) as { audio?: string };
      if (!data.audio) {
        setAudioErr("generic");
        return null;
      }
      return data.audio;
    } catch {
      setAudioErr("generic");
      return null;
    }
  }

  async function handlePreview() {
    setPreviewBusy(true);
    setPreviewUrl(null);
    const url = await callTts(t.audioPreviewText);
    if (url) setPreviewUrl(url);
    setPreviewBusy(false);
  }

  async function handleNarrate(i: number) {
    setGenIdx(i);
    const ch = chapters[i];
    const text = [ch.title, ...ch.paragraphs].filter(Boolean).join("\n\n");
    const url = await callTts(text);
    if (url) setChapterAudio((prev) => ({ ...prev, [i]: url }));
    setGenIdx(null);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1400px] flex-col gap-4 px-4 py-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-[380px]">
        <Link
          href={`/${lang}`}
          className="text-sm font-medium text-muted transition hover:text-foreground"
        >
          ← {dict.common.back}
        </Link>
        <div className="mt-4">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-accent">
            {t.audiobookTagline}
          </span>
          <h1 className="mt-1 font-sans text-3xl font-extrabold tracking-tight">{t.audiobookTitle}</h1>
        </div>

        {/* Metin girişi */}
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TextTIcon className="h-5 w-5 text-accent" />
            {t.textHeading}
          </div>

          <label className="mt-3 block text-xs font-medium text-muted">{t.textLabel}</label>
          <textarea
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              resetAudio();
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
                  resetAudio();
                }}
                className="font-medium text-accent transition hover:underline"
              >
                {t.sampleCta}
              </button>
              <button
                onClick={() => {
                  setRaw("");
                  resetAudio();
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

        {/* Kitap adı (dosya adı için) */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookIcon className="h-5 w-5 text-accent" />
            {t.metaHeading}
          </div>
          <label className="mt-3 block text-xs font-medium text-muted">{t.bookTitleLabel}</label>
          <input
            type="text"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder={t.bookTitlePlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />
        </div>

        {/* Sesli kitap */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MagicWandIcon className="h-5 w-5 text-accent" />
            {t.audioHeading}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {(
              [
                { id: "ai" as const, title: t.audioAi, desc: t.audioAiDesc },
                { id: "own" as const, title: t.audioOwn, desc: t.audioOwnDesc },
              ]
            ).map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition hover:border-accent/50">
                  <input
                    type="radio"
                    name="audio-voice"
                    checked={voice === o.id}
                    onChange={() => setVoice(o.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{o.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{o.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {voice === "ai" ? (
            <div ref={audioWrapRef} className="mt-3 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-muted">{t.audioEngineLabel}</label>
                <select
                  value={engine}
                  onChange={(e) => changeEngine(e.target.value as "minimax" | "elevenlabs")}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                >
                  {t.audioEngines.map((en) => (
                    <option key={en.id} value={en.id}>
                      {en.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted">
                  {t.audioEngines.find((en) => en.id === engine)?.desc}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">{t.audioVoiceLabel}</label>
                <select
                  value={aiVoice}
                  onChange={(e) => setAiVoice(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
                >
                  {voiceList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center justify-between text-xs font-medium text-muted">
                  <span>{t.audioSpeedLabel}</span>
                  <span className="font-mono text-accent">{aiSpeed.toFixed(2)}×</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={aiSpeed}
                  onChange={(e) => setAiSpeed(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted">{t.audioListenSpeedLabel}</label>
                <div className="mt-1.5 flex gap-1.5">
                  {[1, 1.25, 1.5, 1.75, 2].map((r) => (
                    <button
                      key={r}
                      onClick={() => setListenRate(r)}
                      className={`flex-1 rounded-md border px-1 py-1 text-xs font-medium transition ${
                        listenRate === r
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-border bg-background text-muted hover:border-accent/50"
                      }`}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted">{t.audioListenSpeedHint}</p>
              </div>

              <div>
                <button
                  onClick={handlePreview}
                  disabled={previewBusy || genIdx !== null}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MagicWandIcon className="h-4 w-4 text-accent" />
                  {previewBusy ? t.audioPreviewBusy : t.audioPreviewCta}
                </button>
                {previewUrl && (
                  <audio controls src={previewUrl} className="mt-2 w-full" />
                )}
              </div>

              <div className="border-t border-border pt-3">
                <div className="text-sm font-semibold text-foreground">{t.audioChaptersHeading}</div>
                <p className="mt-1 text-xs text-muted">{t.audioChaptersHint}</p>
                {hasText && chapters.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {chapters.map((c, i) => {
                      const audioUrl = chapterAudio[i];
                      const busy = genIdx === i;
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent">
                                {i + 1}
                              </span>
                              <span className="min-w-0 truncate text-sm text-foreground">
                                {c.title || t.chapterUntitled}
                              </span>
                            </span>
                            <button
                              onClick={() => handleNarrate(i)}
                              disabled={genIdx !== null || previewBusy}
                              className="shrink-0 rounded-md border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent transition enabled:hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? t.audioNarrateBusy : t.audioNarrateCta}
                            </button>
                          </div>
                          {audioUrl && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              <audio controls src={audioUrl} className="w-full" />
                              <a
                                href={audioUrl}
                                download={`${suggestFilename(bookTitle.trim() || t.untitledBook).replace(/\.epub$/, "")}-${i + 1}.mp3`}
                                className="self-start text-xs font-medium text-accent transition hover:underline"
                              >
                                ↓ {t.audioDownload}
                              </a>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted">{t.previewEmpty}</p>
                )}
              </div>

              {audioErr && (
                <p className="text-xs text-red-500">
                  {audioErr === "token" ? t.audioTokenError : t.audioGenericError}
                </p>
              )}
              <p className="text-xs text-muted">{t.audioCreditNote}</p>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-muted">{t.audioOwnSoonNote}</p>
          )}
        </div>
      </aside>

      {/* Canlı içindekiler önizlemesi */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
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
