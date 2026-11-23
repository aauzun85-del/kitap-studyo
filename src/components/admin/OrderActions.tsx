"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveOrder, rejectOrder } from "@/lib/credits/orderActions";

// Bekleyen havale siparişi için Onayla / Reddet. Onaylayınca jetonlar yüklenir.
export default function OrderActions({ orderId, tr }: { orderId: string; tr: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "approve" | "reject") {
    if (kind === "reject" && !window.confirm(tr ? "Bu siparişi reddet?" : "Reject this order?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = kind === "approve" ? await approveOrder(orderId) : await rejectOrder(orderId);
      if (!res.ok) setError(tr ? "İşlem yapılamadı, tekrar dene." : "Action failed, try again.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "…" : tr ? "Onayla" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={busy}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {tr ? "Reddet" : "Reject"}
        </button>
      </div>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
