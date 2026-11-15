import Link from "next/link";

// İndirme ekranının parçaları (sunucu bileşeni olarak da çalışır).

// Dosya kartı: ikon + ad + bilgi satırları; sağda ana düğme ve bağlantılar.
export function FileCard({
  icon,
  title,
  lines,
  primary,
  links,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  primary: { href: string; label: string; download?: boolean } | null;
  links: { href: string; label: string; eye?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm sm:flex-nowrap">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xl font-bold text-foreground">{title}</div>
        {lines.filter(Boolean).map((l) => (
          <div key={l} className="mt-0.5 text-base text-muted">
            {l}
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:items-end">
        {primary && (
          <a
            href={primary.href}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 px-6 py-2.5 text-base font-semibold transition sm:min-w-[160px] ${
              primary.download
                ? "border-accent text-accent hover:bg-accent-soft"
                : "border-dashed border-border text-foreground/80 hover:border-accent/50"
            }`}
          >
            {primary.download && <DownloadIcon className="h-5 w-5" />}
            {primary.label}
          </a>
        )}
        <div className="flex items-center justify-end gap-3 text-base">
          {links.map((l, i) => (
            <span key={l.href + l.label} className="flex items-center gap-3">
              {i > 0 && <span className="h-4 w-px bg-border" aria-hidden="true" />}
              <Link href={l.href} className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
                {l.eye && <EyeIcon />}
                {l.label}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Kapağın küçük resminden (tam kapak) 3B kitap maketi: ön yüz = resmin sağ
// kısmı, sırt = ortadaki şerit. Resim yoksa sade bir kapak.
export function BookMockup({
  thumbUrl,
  title,
  author,
  spread,
}: {
  thumbUrl: string | null;
  title: string;
  author: string;
  spread: { totalWidth: number; totalHeight: number; spineStart: number; spineEnd: number; bleed: number } | null;
}) {
  const H = 330;
  const total = spread ? spread.totalWidth / spread.totalHeight : 1.37;
  // Ön yüz: sırt bitişinden sağ taşma payının başına kadar.
  const frontMm = spread ? spread.totalWidth - spread.spineEnd - spread.bleed : 0;
  const frontW = spread ? Math.round((frontMm / spread.totalHeight) * H) : Math.round(H * 0.66);
  const spineMm = spread ? spread.spineEnd - spread.spineStart : 0;
  // Maket: ince kitapta da sırt seçilebilsin diye en az 26 px.
  const spineW = Math.max(26, spread ? Math.round((spineMm / spread.totalHeight) * H) : 26);
  const imgW = H * total; // resmin bu yükseklikteki eni (px)
  const pxPerMm = spread ? H / spread.totalHeight : 0;
  const frontX = spread ? -(spread.spineEnd * pxPerMm) : 0;
  const spineX = spread ? -(spread.spineStart * pxPerMm) : 0;
  const face = (x: number) =>
    thumbUrl && spread
      ? { backgroundImage: `url(${thumbUrl})`, backgroundSize: `${imgW}px ${H}px`, backgroundPosition: `${x}px 0` }
      : undefined;
  return (
    <div className="flex justify-center" style={{ perspective: 1600 }}>
      <div
        className="relative"
        style={{ width: frontW, height: H, transformStyle: "preserve-3d", transform: "rotateY(30deg)" }}
      >
        {/* sırt */}
        <div
          className="absolute top-0 bg-[#e9e2d3]"
          style={{
            left: -spineW,
            width: spineW,
            height: H,
            // Ön yüzün sol kenarından içeri (arkaya) katlanan sırt; sol taraftan görünür.
            transformOrigin: "right center",
            transform: "rotateY(-90deg)",
            filter: "brightness(0.82)",
            ...face(spineX),
          }}
        />
        {/* ön yüz */}
        <div
          className="absolute inset-0 overflow-hidden rounded-r-[3px] bg-[#f3eee3] shadow-[18px_22px_40px_rgba(30,30,60,0.28)]"
          style={face(frontX)}
        >
          {!(thumbUrl && spread) && (
            <div className="flex h-full flex-col items-center justify-between px-5 py-8 text-center text-[#2a2a35]">
              <div className="text-xl font-semibold leading-tight" style={{ fontFamily: "Georgia, serif" }}>
                {title}
              </div>
              <div className="h-px w-10 bg-[#c0392b]" />
              <div className="text-xs uppercase tracking-[0.3em]">{author}</div>
            </div>
          )}
          {/* cilt kıvrımı gölgesi */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10.5l5 5 5-5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
export function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
export function ImageFileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
    </svg>
  );
}
export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-foreground/70" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
