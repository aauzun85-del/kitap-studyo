"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAssignShopierPayment } from "@/lib/credits/orderActions";

// Eşleşmeyen Shopier ödemesini bir üyeye tanımla. E-posta kutusu ödeyenin
// Shopier'e yazdığı adresle dolu gelir; üye Laycoty'ye başka adresle kayıtlıysa
// yönetici doğrusunu yazar. Tutar/ürün sunucuda Shopier'den yeniden okunur.
const ERRORS: Record<string, string> = {
  forbidden: "Bu işlem için yönetici olmalısın.",
  "bad-email": "Geçerli bir e-posta yaz.",
  "user-not-found": "Bu e-postayla kayıtlı üye yok.",
  "already-assigned": "Bu ödeme zaten bir üyeye tanımlanmış.",
  "shopier-unreachable": "Shopier'e ulaşılamadı, biraz sonra tekrar dene.",
  "approve-failed": "Jeton tanımlanamadı, tekrar dene.",
  "not-ready": "Shopier bağlantısı hazır değil.",
};

export default function ShopierAssign({ orderId, defaultEmail }: { orderId: string; defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const target = email.trim();
    if (!target) return setError(ERRORS["bad-email"]);
    if (!window.confirm(`Shopier #${orderId} ödemesi ${target} üyesine tanımlansın mı?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await adminAssignShopierPayment(orderId, target);
      if (!res.ok) {
        setError(
          ERRORS[res.error] ??
            (res.error.startsWith("order-invalid") ? "Bu ödeme tanımlanamaz (tutar/ürün uymuyor)." : "İşlem yapılamadı, tekrar dene."),
        );
      }
      router.refresh();
    } catch {
      setError("İşlem yapılamadı, tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          aria-label="Üyenin Laycoty e-postası"
          placeholder="Üyenin Laycoty e-postası"
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "…" : "Bu üyeye tanımla"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
