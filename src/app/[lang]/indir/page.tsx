import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getSidebarCollapsed } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell from "@/components/app/AppShell";
import CreditNotice from "@/components/credits/CreditNotice";
import { hasActivePackageById } from "@/lib/credits/server";
import { signThumbs } from "@/lib/projects/storage";
import { readSavedLayout } from "@/lib/layout/layoutSettings";
import { KDY_SIZE } from "@/lib/layout/kdy";
import { INTERIOR_SIZES } from "@/lib/layout/page";
import { calcSpread, resolveCoverSize, bookSpineInfo, getPaper, formatCm, type BookSize } from "@/lib/cover/spread";
import {
  BookMockup,
  FileCard,
  DownloadIcon,
  FileIcon,
  ImageFileIcon,
  ShieldIcon,
} from "@/components/app/DownloadParts";

// İNDİRME ekranı (sihirbazın son adımı). Dosyalar burada önceden üretilmez:
// "İndir" ilgili modülü ?export=1 ile açar, modül GERÇEK PDF'i üretip indirir
// ve buraya döner. "Tüm dosyaları indir" önce iç sayfayı, ardından kendiliğinden
// kapağı indirir (ZIP değil, iki PDF).

const mmText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

export default async function IndirPage({ params, searchParams }: PageProps<"/[lang]/indir">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const tr = lang === "tr";
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const collapsed = await getSidebarCollapsed();

  if (!initialProject) redirect(`/${lang}/projeler`);

  const data = initialProject.data;
  const wizard = data.wizard;
  const pid = initialProject.id;
  const title = data.meta.title?.trim() || (tr ? "Adsız kitap" : "Untitled book");
  const author = data.meta.author?.trim() || "";
  // İç sayfa PDF'i metin gerektirir — metin yoksa kullanıcıyı önce metne yönlendir.
  const hasText = !!data.manuscript?.text?.trim();
  const hasCover = !!(data.cover?.coverImage || data.cover?.title || data.cover?.objects?.length);
  const canExport = await hasActivePackageById(user.id, user.email);
  const allDone = !!wizard && wizard.editorCompleted && wizard.layoutCompleted && wizard.coverCompleted;

  // İç sayfa boyu: mizanpajda seçilen (kayıtlı) boy; yoksa sihirbazda seçilen.
  const savedLayout = readSavedLayout(data.modules?.layout);
  const allInterior: BookSize[] = [KDY_SIZE, ...INTERIOR_SIZES];
  const interiorSize =
    allInterior.find((s) => s.id === savedLayout?.sizeId) ??
    allInterior.find((s) => s.id === data.meta.sizeId) ??
    null;

  // Tam kapak ölçüsü (taşma dahil): kapak taslağının kitap ayarlarından.
  const cv = data.cover ?? {};
  // Kapak tuvaliyle AYNI çözümleme ve varsayılanlar (küçük resim bu geometriyle çizildi).
  // Sayfa sayısı + kâğıt kitap düzeyinden (Mizanpaj / konsept ekranı), kapakla aynı kural.
  const spine = bookSpineInfo(data.meta, cv);
  const spread = hasCover
    ? calcSpread(
        resolveCoverSize(cv.sizeId ?? data.meta.sizeId),
        Math.max(1, spine.pages),
        spine.paperId,
        cv.binding ?? "soft",
        cv.spineManualOn && typeof cv.spineManualValue === "number" ? cv.spineManualValue : null,
        typeof cv.bleedMm === "number" ? cv.bleedMm : undefined,
      )
    : null;
  const spineLine = spread
    ? tr
      ? `Sırt ${formatCm(spread.spine, "tr")} · ${getPaper(spine.paperId).label.tr} · ${spine.pages} sayfa`
      : `Spine ${formatCm(spread.spine, "en")} · ${getPaper(spine.paperId).label.en} · ${spine.pages} pages`
    : "";

  // Kitap maketi için kapağın kayıtlı küçük resmi (tam kapak: arka + sırt + ön).
  const { data: row } = await supabase.from("projects").select("thumb_path").eq("id", pid).single();
  const thumbPath = (row as { thumb_path?: string | null } | null)?.thumb_path ?? null;
  const thumbUrl = thumbPath ? ((await signThumbs(supabase, [thumbPath])).get(thumbPath) ?? null) : null;

  const icHref = `/${lang}/mizanpaj?project=${pid}&export=1`;
  const kapakHref = `/${lang}/kapak?project=${pid}&export=1`;
  const allHref = `/${lang}/mizanpaj?project=${pid}&export=1&sonra=kapak`;
  const layoutHref = `/${lang}/mizanpaj?project=${pid}`;
  const coverHref = `/${lang}/kapak?project=${pid}`;
  const checkHref = `/${lang}/mizanpaj?project=${pid}&denetim=1`;

  const steps: { seg: string; label: string; done: boolean }[] = [
    { seg: "editor", label: tr ? "AI Editör" : "AI Editor", done: !!wizard?.editorCompleted },
    { seg: "mizanpaj", label: tr ? "Mizanpaj" : "Layout", done: !!wizard?.layoutCompleted },
    { seg: "kapak", label: tr ? "Kapak" : "Cover", done: !!wizard?.coverCompleted },
  ];

  return (
    <AppShell lang={lang} user={await toShellUser(user)} signOut={signOutAction.bind(null, lang)} defaultCollapsed={collapsed}>
      <div className="mx-auto w-full max-w-[1240px] px-5 pb-10 pt-5 sm:px-8">
        {/* Kırıntı yolu */}
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted" aria-label={tr ? "Konum" : "Breadcrumb"}>
          <Link href={`/${lang}/projeler`} className="hover:text-foreground">
            {tr ? "Kitaplarım" : "My books"}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="max-w-[40ch] truncate">{title}</span>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-foreground">{tr ? "Dosyalar" : "Files"}</span>
        </nav>

        {/* Adımlar: AI Editör → Mizanpaj → Kapak → İndir */}
        {wizard && (
          <ol className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {steps.map((s) => (
              <li key={s.seg} className="flex items-center gap-3">
                <Link href={`/${lang}/${s.seg}?project=${pid}`} className="flex items-center gap-2.5 text-base text-foreground/85 hover:text-foreground">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                      s.done ? "bg-accent text-white" : "border-2 border-border text-muted"
                    }`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  {s.label}
                </Link>
                <span className="hidden h-px w-10 bg-border sm:block" aria-hidden="true" />
              </li>
            ))}
            <li className="flex items-center gap-2.5 text-base font-semibold text-accent">
              {wizard.printDownloaded ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">✓</span>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-accent">
                  <span className="h-3 w-3 rounded-full bg-accent" />
                </span>
              )}
              {tr ? "İndir" : "Download"}
            </li>
          </ol>
        )}

        {/* Başlık */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {allDone ? (tr ? "Kitabın hazır." : "Your book is ready.") : tr ? "Dosyaların" : "Your files"}
          </h1>
          {allDone && (
            <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <span aria-hidden="true">✓</span>
              {tr ? "Tüm adımlar tamam" : "All steps done"}
            </span>
          )}
        </div>
        <p className="mt-2 text-lg text-muted">
          {tr ? "İç sayfalarını ve kapağını indir, kitabını bir sonraki adıma taşı." : "Download your interior and cover, and take your book to the next step."}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Kitap maketi */}
          <div className="flex flex-col items-center rounded-3xl bg-accent-soft/60 px-6 pb-7 pt-10 dark:bg-white/5">
            <BookMockup thumbUrl={thumbUrl} title={title} author={author} spread={spread} />
            <div className="mt-8 text-center">
              <div className="text-2xl font-bold text-foreground">{title}</div>
              <div className="mt-1 text-base text-muted">
                {[author, interiorSize ? `${mmText(interiorSize.width)} × ${mmText(interiorSize.height)} mm` : ""].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          {/* Dosyalar */}
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-foreground">{tr ? "İndirilebilir dosyalar" : "Downloadable files"}</h2>

            {!canExport && (
              <div className="mt-4">
                <CreditNotice lang={lang} problem={{ kind: "no-package" }} />
              </div>
            )}

            <div className="mt-4 space-y-4">
              <FileCard
                icon={<FileIcon />}
                title={tr ? "İç sayfalar" : "Interior pages"}
                lines={[
                  tr ? "PDF · baskıya hazır" : "PDF · print-ready",
                  interiorSize ? `${mmText(interiorSize.width)} × ${mmText(interiorSize.height)} mm` : "",
                ]}
                primary={
                  !hasText
                    ? { href: layoutHref, label: tr ? "Önce metni ekle" : "Add text first" }
                    : canExport
                      ? { href: icHref, label: tr ? "İndir" : "Download", download: true }
                      : null
                }
                links={[
                  { href: layoutHref, label: tr ? "Mizanpaja dön" : "Back to layout" },
                ]}
              />
              <FileCard
                icon={<ImageFileIcon />}
                title={tr ? "Tam kapak" : "Full cover"}
                lines={[
                  tr ? "PDF · Ön kapak, sırt ve arka kapak" : "PDF · Front, spine and back",
                  spread
                    ? `${mmText(Math.round(spread.totalWidth * 10) / 10)} × ${mmText(Math.round(spread.totalHeight * 10) / 10)} mm · ${tr ? "taşma payı dahil" : "bleed included"}`
                    : tr
                      ? "Taşma payı dahil"
                      : "Bleed included",
                  spineLine,
                ]}
                primary={
                  !hasCover
                    ? { href: coverHref, label: tr ? "Önce kapağı tasarla" : "Design the cover first" }
                    : canExport
                      ? { href: kapakHref, label: tr ? "İndir" : "Download", download: true }
                      : null
                }
                links={[
                  { href: coverHref, label: tr ? "Kapağı düzenle" : "Edit cover" },
                ]}
              />
            </div>

            {canExport && hasText && hasCover && (
              <div className="mt-5">
                <a
                  href={allHref}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-accent px-5 py-4 text-lg font-semibold text-white shadow-sm transition hover:opacity-90"
                >
                  <DownloadIcon className="h-6 w-6" />
                  {tr ? "Tüm dosyaları indir" : "Download all files"}
                </a>
                <p className="mt-2 text-center text-sm text-muted">
                  {tr ? "Önce iç sayfalar, sonra tek tıkla kapak · 2 PDF" : "Interior first, then the cover in one click · 2 PDFs"}
                </p>
              </div>
            )}

            {hasText && (
              <a
                href={checkHref}
                className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition hover:border-accent/40"
              >
                <ShieldIcon />
                <span className="flex-1 text-base font-semibold text-foreground">{tr ? "Baskı kontrolü" : "Print check"}</span>
                <span className="text-base font-medium text-accent">{tr ? "Kontrol raporunu aç →" : "Open the report →"}</span>
              </a>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <Link href={`/${lang}/projeler`} className="inline-flex items-center gap-2 text-base font-medium text-foreground/80 hover:text-foreground">
            <span aria-hidden="true">←</span>
            {tr ? "Kitaplarıma dön" : "Back to my books"}
          </Link>
          <Link href={`/${lang}/projeler?yeni=1`} className="inline-flex items-center gap-2 text-base font-semibold text-accent hover:underline">
            <span aria-hidden="true">+</span>
            {tr ? "Yeni kitap oluştur" : "Create a new book"}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
