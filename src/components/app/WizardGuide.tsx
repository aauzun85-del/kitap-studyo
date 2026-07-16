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
        "Sağda 1'den 6'ya numaralı kontroller var: Genel Kontrol (yazım/dilbilgisi), Editöryal inceleme (üslup), Kitap yapısı, Yayına hazırlık, Riskli içerik ve Türe göre kontrol.",
        "Sırayla hepsini çalıştırabilir ya da yalnız istediğin kontrolleri seçebilirsin — zorunlu değil.",
        "Çıkan önerilere tek tek Uygula ya da Yoksay de; karar her zaman sende.",
        "Bittiğinde üstteki Tamamladım düğmesine bas — seni Mizanpaj adımına geçirir.",
      ],
    },
    en: {
      title: "Step 1 · AI Editor",
      lines: [
        "Paste your manuscript into the left panel or upload it from a Word (.docx) file.",
        "On the right are checks numbered 1 to 6: General Check (spelling/grammar), Editorial review (style), Book structure, Publish prep, Risky content and Genre check.",
        "Run them all in order, or pick only the ones you want — none are required.",
        "Apply or Ignore each suggestion one by one; you're always in control.",
        "When done, hit Done at the top — it takes you to the Layout step.",
      ],
    },
  },
  layout: {
    tr: {
      title: "2. Adım · Mizanpaj",
      lines: [
        "Metnin otomatik olarak baskıya hazır iç sayfalara döküldü; sayfaları gezerek kontrol et.",
        "Sayfada bir paragrafa tıkla: altta düzenleme çubuğu açılır — metni değiştirebilir, seçili kelimeyi kalın/italik yapabilir, paragrafın yazı tipini ve puntosunu ayarlayabilirsin.",
        "Aynı çubuktaki 'Sonraki sayfaya' ve 'Boşluk ekle' ile paragrafı sayfa içinde istediğin yere yerleştirebilirsin.",
        "Soldaki sekmelerden kitap boyu, kenar boşlukları, tema ve yazı ayarlarını değiştirebilirsin (zorunlu değil).",
        "Bitirmeden 'Denetim' sekmesine mutlaka göz at — sayfaların baskı kurallarına uygunluğunu kontrol eder.",
        "Hazır olunca Tamamladım'a bas — Kapak adımına geçer.",
      ],
    },
    en: {
      title: "Step 2 · Layout",
      lines: [
        "Your text was automatically flowed into print-ready interior pages; browse and review them.",
        "Click a paragraph on the page: an editing bar opens below — edit the text, make selected words bold/italic, and set the paragraph's font and size.",
        "Use 'Next page' and 'Add space' in the same bar to place the paragraph exactly where you want.",
        "Use the tabs on the left to change book size, margins, theme and typography (not required).",
        "Before finishing, check the 'Denetim' (Inspection) tab — it validates your pages against print rules.",
        "When ready, hit Done — it moves to the Cover step.",
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

export default function WizardGuide({
  lang,
  step,
  projectId,
}: {
  lang: Locale;
  step: Step;
  projectId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  // "Görüldü" bilgisi KİTABA özeldir: her yeni kitapta rehber yeniden ortada
  // açılır (eskiden adım başına tek seferdi → ikinci kitapta hiç çıkmıyordu).
  const seenKey = projectId ? `tipo_guide_seen_${projectId}_${step}` : `tipo_guide_seen_${step}`;

  // Her adıma İLK girişte rehber ortada (karartılı) açılır; daha önce görüldüyse
  // küçük düğme olarak durur.
  useEffect(() => {
    const seen = typeof window !== "undefined" && window.localStorage.getItem(seenKey) === "1";
    setOpen(!seen);
    setReady(true);
  }, [seenKey]);

  const c = GUIDE[step][lang];

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(seenKey, "1");
    } catch {}
  }

  if (!ready) return null;

  return (
    <>
      <style>{`
        @keyframes tipoGuideIn { from { opacity: 0; transform: translateY(-12px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes tipoGuidePulse { 0%,100% { box-shadow: 0 10px 26px rgba(79,70,229,.34); } 50% { box-shadow: 0 10px 30px rgba(79,70,229,.34), 0 0 0 8px rgba(79,70,229,.16); } }
      `}</style>

      {open ? (
        <div
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 75,
            background: "rgba(20,24,40,.38)",
            backdropFilter: "blur(1.5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460,
              maxWidth: "calc(100vw - 40px)",
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 30px 70px rgba(20,24,40,.34)",
              overflow: "hidden",
              animation: "tipoGuideIn .22s ease both",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", background: "linear-gradient(120deg,#4f46e5,#7c3aed)", color: "#fff" }}>
              <span style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="ai" size={21} style={{ color: "#fff" }} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".6px", opacity: 0.85 }}>
                  {lang === "tr" ? "REHBER" : "GUIDE"}
                </div>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{c.title}</div>
              </div>
              <button
                onClick={dismiss}
                aria-label={lang === "tr" ? "Kapat" : "Close"}
                style={{ width: 30, height: 30, flex: "none", border: "none", borderRadius: 9, background: "rgba(255,255,255,.18)", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: "18px 20px 6px", display: "flex", flexDirection: "column", gap: 14 }}>
              {c.lines.map((line, i) => (
                <li key={i} style={{ display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.5, color: "#3a4154" }}>
                  <span style={{ width: 24, height: 24, flex: "none", borderRadius: "50%", background: "var(--pri-soft,#eef0fd)", color: "var(--pri,#4f46e5)", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div style={{ padding: "10px 20px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={dismiss}
                style={{ padding: "11px 22px", border: "none", borderRadius: 11, background: "var(--pri,#4f46e5)", color: "#fff", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px rgba(79,70,229,.28)" }}
              >
                {lang === "tr" ? "Anladım, başlayalım" : "Got it, let's go"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            zIndex: 70,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 17px",
            border: "none",
            borderRadius: 99,
            background: "linear-gradient(120deg,#4f46e5,#7c3aed)",
            color: "#fff",
            fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            animation: "tipoGuidePulse 2.4s ease-in-out infinite",
          }}
        >
          <Icon name="ai" size={16} style={{ color: "#fff" }} />
          {lang === "tr" ? "Rehber" : "Guide"}
        </button>
      )}
    </>
  );
}
