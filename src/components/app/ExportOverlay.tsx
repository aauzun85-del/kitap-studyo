"use client";

import Link from "next/link";

/**
 * Sihirbazın indirme ekranından bir modüle "?export=1" ile gelindiğinde,
 * modülün üstüne çizilen tam ekran katman. Modül kendi GERÇEK PDF üretimini
 * (mizanpaj/kapak) otomatik tetikler; bu katman durumu gösterir:
 *  - working: "hazırlanıyor…" (spinner)
 *  - done:    "indirildi ✓" + (tarayıcı otomatik indirmeyi engellediyse) elle
 *             "İndir" düğmesi + "İndirme ekranına dön".
 *  - error:   hata + "Tekrar dene" + dön.
 * onDownload = modülün export fonksiyonu (kullanıcı tıklayınca = jest → indirme
 * garanti). Otomatik deneme + bu düğme birlikte hem tek-tık hem güvence verir.
 */
export default function ExportOverlay({
  lang,
  kind,
  status,
  backHref,
  onDownload,
}: {
  lang: "tr" | "en";
  kind: "ic" | "kapak";
  status: "working" | "done" | "error";
  backHref: string;
  onDownload: () => void;
}) {
  const tr = lang === "tr";
  const label = kind === "ic" ? (tr ? "İç sayfa PDF" : "Interior PDF") : (tr ? "Kapak PDF" : "Cover PDF");
  const head =
    status === "working"
      ? tr
        ? `${label} hazırlanıyor…`
        : `Preparing ${label}…`
      : status === "done"
        ? tr
          ? `${label} indirildi`
          : `${label} downloaded`
        : tr
          ? "Bir sorun oldu"
          : "Something went wrong";
  const sub =
    status === "working"
      ? tr
        ? "Baskıya hazır dosyan oluşturuluyor — birkaç saniye."
        : "Building your print-ready file — a few seconds."
      : status === "done"
        ? tr
          ? "Tarayıcının indirilenler klasörüne kaydedildi. İnmediyse aşağıdaki düğmeye bas."
          : "Saved to your browser's downloads. If it didn't start, use the button below."
        : tr
          ? "PDF üretilemedi. Tekrar dene; sürerse modülden elle indir."
          : "Couldn't generate the PDF. Try again; if it persists, download from the module.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(247,248,252,0.93)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #eceef5",
          borderRadius: 18,
          boxShadow: "0 10px 34px rgba(20,24,40,.12)",
          padding: "34px 30px",
          maxWidth: 430,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>
          {status === "working" ? "📄" : status === "done" ? "✅" : "⚠️"}
        </div>
        <h2 style={{ margin: "14px 0 6px", fontSize: 21, fontWeight: 800, letterSpacing: "-.3px" }}>{head}</h2>
        <p style={{ margin: "0 auto", fontSize: 14, color: "#6b7280", lineHeight: 1.55, maxWidth: 360 }}>{sub}</p>

        {status === "working" && <div className="tipo-exp-spin" />}

        {status !== "working" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <button
              type="button"
              onClick={onDownload}
              style={{
                background: "#4f46e5",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                padding: "11px 20px",
                borderRadius: 11,
                border: "none",
                cursor: "pointer",
              }}
            >
              {status === "error" ? (tr ? "Tekrar dene" : "Try again") : tr ? "İndir" : "Download"}
            </button>
            <Link
              href={backHref}
              style={{
                display: "inline-block",
                fontWeight: 700,
                fontSize: 14,
                padding: "11px 20px",
                borderRadius: 11,
                textDecoration: "none",
                color: "#3b3f52",
                border: "1px solid #e5e7f0",
                background: "#fff",
              }}
            >
              {tr ? "← İndirme ekranına dön" : "← Back to downloads"}
            </Link>
          </div>
        )}
      </div>
      <style>{`.tipo-exp-spin{width:30px;height:30px;border-radius:50%;border:3px solid #e6e7f0;border-top-color:#4f46e5;animation:tipoExpSpin .8s linear infinite;margin:20px auto 2px}@keyframes tipoExpSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
