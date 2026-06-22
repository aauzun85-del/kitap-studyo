"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { WizardStepKey } from "@/lib/projects/types";
import { Icon } from "./AppShell";

type Step = WizardStepKey | "done";

const GUIDE: Record<Step, { tr: { title: string; lines: string[] }; en: { title: string; lines: string[] } }> = {
  editor: {
    tr: {
      title: "1. Adım · AI Editör",
      lines: [
        "Kitabının metnini sol panele yapıştır ya da Word (.docx) dosyandan yükle.",
        "Yapay zekâ yazım, dil ve tutarlılık önerilerini çıkarır; her öneriye Uygula ya da Yoksay de.",
        "Bittiğinde üstteki Tamamladım düğmesine bas — seni Mizanpaj adımına geçirir.",
      ],
    },
    en: {
      title: "Step 1 · AI Editor",
      lines: [
        "Paste your manuscript into the left panel or upload it from a Word (.docx) file.",
        "AI surfaces spelling, style and consistency suggestions; Apply or Ignore each one.",
        "When done, hit Done at the top — it takes you to the Layout step.",
      ],
    },
  },
  layout: {
    tr: {
      title: "2. Adım · Mizanpaj",
      lines: [
        "Metnin otomatik olarak baskıya hazır iç sayfalara döküldü; sayfalara göz at.",
        "İstersen kitap boyutunu veya yazı tipini soldan değiştirebilirsin (gerekmez).",
        "Bittiğinde Tamamladım'a bas — Kapak adımına geçer.",
      ],
    },
    en: {
      title: "Step 2 · Layout",
      lines: [
        "Your text was automatically flowed into print-ready interior pages; review them.",
        "Optionally change book size or font on the left (not required).",
        "When done, hit Done — it moves to the Cover step.",
      ],
    },
  },
  cover: {
    tr: {
      title: "3. Adım · Kapak",
      lines: [
        "Kapağın kitap bilgilerinden otomatik oluştu: ön görsel + başlık/yazar + arka kapak yazısı + barkod.",
        "Beğenmezsen 'Görsel üret' ile yeniden dene; rengini, yazısını, arka kapak metnini düzenleyebilirsin.",
        "Tam kapağı görmek için 'Tüm kapak'a geç. Bittiğinde Tamamla → İndir'e bas.",
      ],
    },
    en: {
      title: "Step 3 · Cover",
      lines: [
        "Your cover was generated from the book info: front art + title/author + back blurb + barcode.",
        "Not happy? Regenerate with 'Generate'; you can edit colors, text and the back blurb.",
        "Switch to 'Full cover' to see all of it. When done, hit Finish → Download.",
      ],
    },
  },
  done: {
    tr: {
      title: "Bitti · İndirme",
      lines: [
        "Tebrikler — kitabın baskıya hazır! 🎉",
        "Buradan İç sayfa PDF ve Kapak PDF dosyalarını indir.",
        "İstediğin an üstteki adımlara dönüp düzenleme yapabilirsin.",
      ],
    },
    en: {
      title: "Done · Download",
      lines: [
        "Congrats — your book is print-ready! 🎉",
        "Download the interior PDF and the cover PDF here.",
        "You can jump back to any step above to edit anytime.",
      ],
    },
  },
};

const STORAGE_KEY = "tipo_guide_min"; // "1" → kullanıcı rehberi küçülttü

export default function WizardGuide({ lang, step }: { lang: Locale; step: Step }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  // İlk yüklemede: kullanıcı daha önce küçültmediyse açık başla.
  useEffect(() => {
    const min = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
    setOpen(!min);
    setReady(true);
  }, []);

  const c = GUIDE[step][lang];

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }
  function reopen() {
    setOpen(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "0");
    } catch {}
  }

  if (!ready) return null;

  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 70, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      {open ? (
        <div
          style={{
            width: 320,
            maxWidth: "calc(100vw - 44px)",
            background: "#fff",
            border: "1px solid #e9eaf3",
            borderRadius: 16,
            boxShadow: "0 18px 50px rgba(20,24,40,.22)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "linear-gradient(120deg,#4f46e5,#7c3aed)", color: "#fff" }}>
            <span style={{ width: 30, height: 30, flex: "none", borderRadius: 9, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="ai" size={17} style={{ color: "#fff" }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", opacity: 0.85 }}>
                {lang === "tr" ? "REHBER" : "GUIDE"}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
            </div>
            <button
              onClick={close}
              aria-label={lang === "tr" ? "Kapat" : "Close"}
              style={{ width: 26, height: 26, flex: "none", border: "none", borderRadius: 8, background: "rgba(255,255,255,.18)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
            {c.lines.map((line, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: "#3a4154" }}>
                <span style={{ width: 20, height: 20, flex: "none", borderRadius: "50%", background: "var(--pri-soft,#eef0fd)", color: "var(--pri,#4f46e5)", fontSize: 11.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          onClick={reopen}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 16px",
            border: "none",
            borderRadius: 99,
            background: "linear-gradient(120deg,#4f46e5,#7c3aed)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 10px 26px rgba(79,70,229,.34)",
          }}
        >
          <Icon name="ai" size={16} style={{ color: "#fff" }} />
          {lang === "tr" ? "Rehber" : "Guide"}
        </button>
      )}
    </div>
  );
}
