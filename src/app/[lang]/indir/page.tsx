import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { loadInitialProject } from "@/lib/projects/server";
import { toShellUser } from "@/lib/app/identity";
import { getSidebarCollapsed } from "@/lib/app/prefs";
import { signOutAction } from "@/app/[lang]/auth-actions";
import AppShell from "@/components/app/AppShell";
import WizardBar from "@/components/app/WizardBar";

export default async function IndirPage({ params, searchParams }: PageProps<"/[lang]/indir">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/giris`);

  const isTr = lang === "tr";
  const sp = await searchParams;
  const supabase = await createClient();
  const initialProject = await loadInitialProject(supabase, sp.project);
  const collapsed = await getSidebarCollapsed();

  if (!initialProject) redirect(`/${lang}/projeler`);

  const wizard = initialProject.data.wizard;
  const title = initialProject.data.meta.title?.trim() || (isTr ? "Kitabın" : "Your book");

  const wizardBar = wizard ? (
    <WizardBar
      lang={lang}
      projectId={initialProject.id}
      current="done"
      wizard={wizard}
      backHref={`/${lang}/projeler`}
      backLabel={isTr ? "Kitaplarım" : "My Books"}
    />
  ) : undefined;

  return (
    <AppShell
      lang={lang}
      user={toShellUser(user)}
      signOut={signOutAction.bind(null, lang)}
      wizardBar={wizardBar}
      defaultCollapsed={collapsed}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 34px 60px" }}>
        <div
          style={{
            background: "#fff",
            border: "1px solid #eceef5",
            borderRadius: 18,
            boxShadow: "0 1px 2px rgba(20,24,40,.04)",
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40, lineHeight: 1 }}>🎉</div>
          <h1 style={{ margin: "16px 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-.4px" }}>
            {isTr ? `"${title}" hazır!` : `"${title}" is ready!`}
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#6b7280", lineHeight: 1.6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            {isTr
              ? "Üç adımı da tamamladın. Baskıya hazır dosyaların indirilmeye hazır olacak."
              : "You've completed all three steps. Your print-ready files will be downloadable here."}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 28 }}>
            <div style={{ flex: "1 1 200px", maxWidth: 260, border: "1px solid #ececf4", borderRadius: 13, padding: "18px 16px", textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isTr ? "İç sayfa PDF" : "Interior PDF"}</div>
              <div style={{ fontSize: 13, color: "#9aa1b1", marginTop: 4 }}>{isTr ? "Baskıya hazır · 300 DPI" : "Print-ready · 300 DPI"}</div>
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--pri)" }}>{isTr ? "Yakında" : "Soon"}</div>
            </div>
            <div style={{ flex: "1 1 200px", maxWidth: 260, border: "1px solid #ececf4", borderRadius: 13, padding: "18px 16px", textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{isTr ? "Kapak PDF" : "Cover PDF"}</div>
              <div style={{ fontSize: 13, color: "#9aa1b1", marginTop: 4 }}>{isTr ? "Tam kapak · taşma payı" : "Full cover · bleed"}</div>
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "var(--pri)" }}>{isTr ? "Yakında" : "Soon"}</div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
