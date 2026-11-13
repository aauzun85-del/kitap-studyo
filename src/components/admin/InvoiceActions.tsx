"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markInvoiceIssued, undoInvoiceIssued } from "@/lib/credits/orderActions";

// "Fatura kesildi" işareti: faturayı (BizimHesap'ta) kestikten sonra numarasını
// yaz ve işaretle → sipariş listeden düşer. Yanlışsa geri alınır.
export default function InvoiceActions({
  orderId,
  issued,
  copyText,
}: {
  orderId: string;
  issued: boolean;
  /** Faturaya yapıştırılacak hazır metin (alıcı + tutarlar). */
  copyText?: string;
}) {
  const router = useRouter();
  const [no, setNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fn();
      if (!res.ok) setErr(res.error === "no-required" ? "Fatura numarasını yaz." : "İşlem yapılamadı.");
      else router.refresh();
    } catch {
      setErr("İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => window.confirm("Fatura işareti geri alınsın mı?") && void run(() => undoInvoiceIssued(orderId))}
        className="text-xs font-medium text-muted underline hover:text-foreground disabled:opacity-60"
      >
        Geri al
      </button>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <div className="flex gap-1.5">
        <input
          aria-label="Fatura no"
          placeholder="Fatura no"
          value={no}
          onChange={(e) => setNo(e.target.value)}
          maxLength={40}
          className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => markInvoiceIssued(orderId, no))}
          className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "…" : "Fatura kesildi"}
        </button>
      </div>
      {copyText && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(copyText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* pano yoksa sessiz geç */
            }
          }}
          className="self-start text-xs font-medium text-accent hover:underline"
        >
          {copied ? "Kopyalandı ✓" : "Bilgileri kopyala"}
        </button>
      )}
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  );
}
