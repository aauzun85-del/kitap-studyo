"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { WizardState, WizardStepKey } from "@/lib/projects/types";
import { completeWizardStep } from "@/lib/projects/data";
import { Icon } from "./AppShell";

const STEPS: { key: WizardStepKey; seg: string; label: Record<Locale, string> }[] = [
  { key: "editor", seg: "editor", label: { tr: "AI Editör", en: "AI Editor" } },
  { key: "layout", seg: "mizanpaj", label: { tr: "Mizanpaj", en: "Layout" } },
  { key: "cover", seg: "kapak", label: { tr: "Kapak", en: "Cover" } },
];

const NEXT_SEG: Record<WizardStepKey, string> = {
  editor: "mizanpaj",
  layout: "kapak",
  cover: "indir",
};

function isDone(w: WizardState, key: WizardStepKey): boolean {
  return key === "editor" ? w.editorCompleted : key === "layout" ? w.layoutCompleted : w.coverCompleted;
}

export default function WizardBar({
  lang,
  projectId,
  current,
  wizard,
  backHref,
  backLabel,
}: {
  lang: Locale;
  projectId: string;
  current: WizardStepKey | "done";
  wizard: WizardState;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const t = lang === "tr";
  const finished = current === "done";

  async function onComplete() {
    if (finished) return;
    setBusy(true);
    try {
      await completeWizardStep(projectId, current);
    } catch {
      // kaydedilemese de ilerlemeyi engelleme; auto-save zaten arka planda
    }
    router.push(`/${lang}/${NEXT_SEG[current]}?project=${projectId}`);
  }

  const completeLabel =
    current === "cover" ? (t ? "Tamamla → İndir" : "Finish → Download") : t ? "Tamamladım" : "Done";

  return (
    <div
      style={{
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 20px",
        background: "#fff",
        borderBottom: "1px solid #e9eaf3",
      }}
    >
      <Link
        href={backHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          border: "1px solid #e9eaf3",
          borderRadius: 10,
          background: "#fff",
          color: "#4b5365",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
          flex: "none",
        }}
      >
        <Icon name="arrowLeft" size={15} sw={2.1} />
        {backLabel}
      </Link>

      {/* üretim hattı: ① ② ③ */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, minWidth: 0, overflowX: "auto" }}>
        {STEPS.map((s, i) => {
          const active = s.key === current;
          const done = isDone(wizard, s.key);
          return (
            <Fragment key={s.key}>
              <Link
                href={`/${lang}/${s.seg}?project=${projectId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 99,
                  textDecoration: "none",
                  flex: "none",
                  background: active ? "var(--pri-soft)" : "transparent",
                  border: active ? "1px solid #dfe0fb" : "1px solid transparent",
                }}
                title={s.label[lang]}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    flex: "none",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                    background: done ? "#16a34a" : active ? "var(--pri)" : "#fff",
                    color: done || active ? "#fff" : "#b6bbcb",
                    border: done || active ? "none" : "2px solid #e1e3ee",
                  }}
                >
                  {done ? <Icon name="check" size={13} sw={3} /> : i + 1}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 600,
                    color: active ? "var(--pri)" : done ? "#1d2333" : "#8a90a2",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label[lang]}
                </span>
              </Link>
              {i < STEPS.length - 1 && (
                <span style={{ width: 22, height: 2, flex: "none", borderRadius: 2, background: "#e7e8ef" }} />
              )}
            </Fragment>
          );
        })}
      </div>

      {finished ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 700, color: "#16a34a", flex: "none" }}>
          <Icon name="check" size={16} sw={2.6} style={{ color: "#16a34a" }} />
          {t ? "Tüm adımlar tamam" : "All steps done"}
        </span>
      ) : (
        <button
          onClick={onComplete}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 18px",
            border: "none",
            borderRadius: 10,
            background: "var(--pri)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.65 : 1,
            boxShadow: "0 4px 12px rgba(79,70,229,.25)",
            flex: "none",
          }}
        >
          {completeLabel}
          <Icon name="arrow" size={16} sw={2.1} />
        </button>
      )}
    </div>
  );
}
