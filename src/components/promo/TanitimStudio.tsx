"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProjectEnvelope } from "@/lib/projects/types";
import { useMetaSync } from "@/lib/projects/useSync";
import {
  MegaphoneIcon,
  BookIcon,
  TextTIcon,
  ImageIcon,
  CheckCircleIcon,
  MagicWandIcon,
} from "@/components/PhosphorIcons";

type Material = "social" | "press" | "sales";

type SocialPost = { platform: "instagram" | "x" | "facebook"; text: string };
type PromoResult = {
  posts?: SocialPost[];
  hashtags?: string[];
  pressRelease?: string;
  salesDescription?: string;
  backCover?: string;
};

const SAMPLE = {
  title: "İmkânsız Bahçe",
  author: "Ada Yılmaz",
  genre: "roman",
  audience: "edebiyat seven genç yetişkinler",
  summary:
    "Büyükannesinden kalan terk edilmiş bir bahçeyi canlandırmaya çalışan bir kadının, toprakla birlikte kendi geçmişiyle de yüzleştiği sıcak ve umut dolu bir hikâye.",
  tone: "warm",
};

export default function TanitimStudio({
  lang,
  dict,
  initialProject,
}: {
  lang: Locale;
  dict: Dictionary;
  initialProject?: { id: string; data: ProjectEnvelope };
}) {
  const t = dict.tanitimStudio;
  const projectId = initialProject?.id ?? null;
  const seed = initialProject?.data;

  const [title, setTitle] = useState(seed?.meta.title ?? "");
  const [author, setAuthor] = useState(seed?.meta.author ?? "");
  const [genre, setGenre] = useState("");
  const [audience, setAudience] = useState("");
  const [summary, setSummary] = useState("");
  const [tone, setTone] = useState(t.tones[0].id);

  // Metin malzemeleri (sosyal/basın/satış) + Instagram görseli canlı.
  const [materials, setMaterials] = useState<Record<Material, boolean>>({
    social: true,
    press: true,
    sales: true,
  });
  const [withImage, setWithImage] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromoResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Instagram görseli ayrı bir Replicate çağrısıyla üretilir (daha yavaş).
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);

  // Bulut projesi: paylaşılan başlık/yazarı projeye yaz (tanıtım formu alanları
  // genre/audience/summary/tone Aşama 2'de eklenecek).
  useMetaSync(projectId, { title, author });

  function loadSample() {
    // Proje aktifken paylaşılan başlık/yazarı ÖRNEK veriyle EZME (gerçek kitabı bozardı).
    if (!projectId) {
      setTitle(SAMPLE.title);
      setAuthor(SAMPLE.author);
    }
    setGenre(SAMPLE.genre);
    setAudience(SAMPLE.audience);
    setSummary(SAMPLE.summary);
    setTone(SAMPLE.tone);
    setError(null);
  }

  function clearAll() {
    if (!projectId) {
      setTitle("");
      setAuthor("");
    }
    setGenre("");
    setAudience("");
    setSummary("");
    setTone(t.tones[0].id);
    setError(null);
    setResult(null);
    setImage(null);
    setImageError(null);
  }

  const MATERIALS: { id: Material; title: string; desc: string; soon: boolean }[] = [
    { id: "social", title: t.matSocial, desc: t.matSocialDesc, soon: false },
    { id: "press", title: t.matPress, desc: t.matPressDesc, soon: false },
    { id: "sales", title: t.matSales, desc: t.matSalesDesc, soon: false },
  ];

  const hasInfo = title.trim().length > 0 && summary.trim().length > 0;
  const anyMaterial = materials.social || materials.press || materials.sales;

  function mapError(code: string | undefined): string {
    switch (code) {
      case "no-key":
        return t.errorNoKey;
      case "bad-key":
        return t.errorBadKey;
      case "rate-limit":
        return t.errorRateLimit;
      case "too-long":
        return t.errorTooLong;
      default:
        return t.errorGeneric;
    }
  }

  const busy = loading || imageLoading;
  const anyOutput = anyMaterial || withImage;

  function bookPayload() {
    return { title, author, genre, audience, summary, tone, lang };
  }

  async function generateText() {
    setLoading(true);
    setError(null);
    const selected = (Object.keys(materials) as Material[]).filter(
      (m) => materials[m],
    );
    try {
      const res = await fetch("/api/promo-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bookPayload(), materials: selected }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(mapError(data.error));
        setResult(null);
        return;
      }
      const data = (await res.json()) as PromoResult;
      setResult(data);
    } catch {
      setError(t.errorGeneric);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function generateImage() {
    setImageLoading(true);
    setImageError(null);
    try {
      const res = await fetch("/api/promo-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setImageError(
          data.error === "no-token" ? t.errorNoImageKey : t.errorImageGeneric,
        );
        setImage(null);
        return;
      }
      const data = (await res.json()) as { image?: string };
      if (!data.image) {
        setImageError(t.errorImageGeneric);
        setImage(null);
        return;
      }
      setImage(data.image);
    } catch {
      setImageError(t.errorImageGeneric);
      setImage(null);
    } finally {
      setImageLoading(false);
    }
  }

  function generate() {
    if (!hasInfo || !anyOutput || busy) return;
    // Metin ve görsel üretimi bağımsız; ikisi birden seçiliyse paralel çalışır.
    if (anyMaterial) void generateText();
    if (withImage) void generateImage();
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      // pano erişimi yoksa sessizce geç
    }
  }

  function platformLabel(p: SocialPost["platform"]): string {
    if (p === "instagram") return t.platformInstagram;
    if (p === "x") return t.platformX;
    return t.platformFacebook;
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
            {t.tagline}
          </span>
          <h1 className="mt-1 font-sans text-3xl font-extrabold tracking-tight">{t.title}</h1>
        </div>

        {/* Kitap bilgileri */}
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookIcon className="h-5 w-5 text-accent" />
            {t.infoHeading}
          </div>

          <label className="mt-3 block text-xs font-medium text-muted">{t.bookTitleLabel}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.bookTitlePlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />

          <label className="mt-3 block text-xs font-medium text-muted">{t.bookAuthorLabel}</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={t.bookAuthorPlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />

          <label className="mt-3 block text-xs font-medium text-muted">{t.genreLabel}</label>
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder={t.genrePlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />

          <label className="mt-3 block text-xs font-medium text-muted">{t.audienceLabel}</label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder={t.audiencePlaceholder}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          />

          <label className="mt-3 block text-xs font-medium text-muted">{t.summaryLabel}</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t.summaryPlaceholder}
            rows={6}
            className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition focus:border-accent"
          />

          <label className="mt-3 block text-xs font-medium text-muted">{t.toneLabel}</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent"
          >
            {t.tones.map((to) => (
              <option key={to.id} value={to.id}>
                {to.name}
              </option>
            ))}
          </select>

          <div className="mt-3 flex gap-3 text-xs text-muted">
            <button
              onClick={loadSample}
              className="font-medium text-accent transition hover:underline"
            >
              {t.sampleCta}
            </button>
            <button
              onClick={clearAll}
              className="font-medium transition hover:text-foreground"
            >
              {t.clearCta}
            </button>
          </div>
        </div>

        {/* Malzeme seçimi */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TextTIcon className="h-5 w-5 text-accent" />
            {t.materialsHeading}
          </div>
          <p className="mt-1 text-xs text-muted">{t.materialsHint}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {MATERIALS.map((m) => (
              <li key={m.id}>
                <label
                  className={`flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition ${
                    m.soon ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-accent/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={materials[m.id]}
                    disabled={m.soon}
                    onChange={() =>
                      !m.soon &&
                      setMaterials((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {m.title}
                      {m.soon && (
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-accent">
                          {t.matSoon}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{m.desc}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 transition hover:border-accent/50">
            <input
              type="checkbox"
              checked={withImage}
              onChange={() => setWithImage((v) => !v)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ImageIcon className="h-4 w-4 text-accent" />
                {t.imageLabel}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t.imageHint}</span>
            </span>
          </label>

          <button
            onClick={generate}
            disabled={!hasInfo || !anyOutput || busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MagicWandIcon className="h-4 w-4" />
            {busy
              ? imageLoading && !loading
                ? t.imageGenerating
                : t.generating
              : result || image
                ? t.regenerateCta
                : t.generateCta}
          </button>
          {error && (
            <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      </aside>

      {/* Önizleme */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
            {t.previewHeading}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!hasInfo ? (
            <div className="flex h-full items-center justify-center p-4">
              <div className="max-w-sm text-center">
                <MegaphoneIcon className="mx-auto h-10 w-10 text-border" />
                <p className="mt-3 text-sm text-muted">{t.previewEmpty}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-sans text-2xl font-extrabold tracking-tight">
                  {title}
                </h2>
                {author && <p className="mt-0.5 text-sm text-muted">{author}</p>}
                <p className="mt-3 text-sm leading-relaxed text-foreground/80">{summary}</p>
              </div>

              {result && (
                <>
                  {/* Sosyal medya gönderileri */}
                  {result.posts && result.posts.length > 0 && (
                    <div>
                      <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
                        {t.socialHeading}
                      </h3>
                      <ul className="mt-2 flex flex-col gap-3">
                        {result.posts.map((p, i) => {
                          const key = `post-${i}`;
                          return (
                            <li
                              key={key}
                              className="rounded-lg border border-border bg-surface p-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">
                                  {platformLabel(p.platform)}
                                </span>
                                <button
                                  onClick={() => copy(key, p.text)}
                                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
                                >
                                  {copiedKey === key ? t.copiedCta : t.copyCta}
                                </button>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                {p.text}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Hashtag'ler */}
                  {result.hashtags && result.hashtags.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
                          {t.hashtagsHeading}
                        </h3>
                        <button
                          onClick={() => copy("hashtags", result.hashtags!.join(" "))}
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
                        >
                          {copiedKey === "hashtags" ? t.copiedCta : t.copyAllCta}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {result.hashtags.map((h, i) => (
                          <span
                            key={`${h}-${i}`}
                            className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Basın bülteni */}
                  {result.pressRelease && (
                    <LongTextSection
                      heading={t.pressHeading}
                      text={result.pressRelease}
                      copyKey="press"
                      copiedKey={copiedKey}
                      onCopy={copy}
                      copyCta={t.copyCta}
                      copiedCta={t.copiedCta}
                    />
                  )}

                  {/* Satış sayfası açıklaması */}
                  {result.salesDescription && (
                    <LongTextSection
                      heading={t.salesDescHeading}
                      text={result.salesDescription}
                      copyKey="sales"
                      copiedKey={copiedKey}
                      onCopy={copy}
                      copyCta={t.copyCta}
                      copiedCta={t.copiedCta}
                    />
                  )}

                  {/* Arka kapak yazısı */}
                  {result.backCover && (
                    <LongTextSection
                      heading={t.backCoverHeading}
                      text={result.backCover}
                      copyKey="backcover"
                      copiedKey={copiedKey}
                      onCopy={copy}
                      copyCta={t.copyCta}
                      copiedCta={t.copiedCta}
                    />
                  )}
                </>
              )}

              {/* Instagram görseli */}
              {(imageLoading || image || imageError) && (
                <div>
                  <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
                    {t.imageHeading}
                  </h3>
                  {imageLoading ? (
                    <div className="mt-2 flex aspect-square w-full items-center justify-center rounded-lg border border-border bg-surface">
                      <span className="animate-pulse text-sm text-muted">
                        {t.imageGenerating}
                      </span>
                    </div>
                  ) : image ? (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image}
                        alt={t.imageHeading}
                        className="aspect-square w-full rounded-lg border border-border object-cover"
                      />
                      <a
                        href={image}
                        download={`${title || "tanitim"}-instagram.png`}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent hover:text-accent"
                      >
                        <ImageIcon className="h-4 w-4" />
                        {t.downloadCta}
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {imageError}
                    </p>
                  )}
                </div>
              )}

              {/* İlk durum bilgisi */}
              {!result && !image && !imageLoading && !imageError && (
                <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-foreground">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{t.previewReady}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Basın bülteni, satış açıklaması ve arka kapak gibi uzun metin bölümleri için
// başlık + Kopyala düğmesi + okunabilir metin kutusu.
function LongTextSection({
  heading,
  text,
  copyKey,
  copiedKey,
  onCopy,
  copyCta,
  copiedCta,
}: {
  heading: string;
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
  copyCta: string;
  copiedCta: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted">
          {heading}
        </h3>
        <button
          onClick={() => onCopy(copyKey, text)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
        >
          {copiedKey === copyKey ? copiedCta : copyCta}
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}
