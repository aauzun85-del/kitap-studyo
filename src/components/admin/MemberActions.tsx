"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAssignProduct, adminGrantCredits } from "@/lib/credits/orderActions";

type Product = { id: string; name: string; kind: "package" | "addon"; credits: number; priceTry: number };

const ERR: Record<string, string> = {
  forbidden: "Bu işlem için yönetici olmalısın.",
  "note-required": "Kısa bir açıklama yaz (neden veriyorsun?).",
  "bad-credits": "Jeton sayısı 1 ile 100.000 arasında olmalı.",
  "bad-days": "Gün sayısı 1 ile 366 arasında olmalı.",
  "bad-product": "Ürün bulunamadı.",
  "user-not-found": "Üye bulunamadı.",
};

// Üye sayfasındaki elle işlemler: "Jeton ekle" ve "Paket / ek jeton tanımla".
// Kart ödemesi açılana kadar satışlar ve hediyeler buradan girilir.
export default function MemberActions({
  userId,
  email,
  products,
}: {
  userId: string;
  email: string;
  products: Product[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Jeton ekle
  const [credits, setCredits] = useState("100");
  const [days, setDays] = useState(""); // boş = süresiz
  const [gNote, setGNote] = useState("");

  // Ürün tanımla
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [paid, setPaid] = useState(true);
  const [pNote, setPNote] = useState("");
  const [bType, setBType] = useState<"bireysel" | "kurumsal">("bireysel");
  const [bName, setBName] = useState("");
  const [bTaxId, setBTaxId] = useState("");
  const [bTaxOffice, setBTaxOffice] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [bCity, setBCity] = useState("");

  const product = products.find((p) => p.id === productId);
  const input =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";
  const label = "mb-1 block text-xs font-medium text-muted";

  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: done });
        router.refresh();
      } else setMsg({ ok: false, text: ERR[res.error] ?? `İşlem yapılamadı: ${res.error}` });
    } catch {
      setMsg({ ok: false, text: "İşlem yapılamadı, tekrar dene." });
    } finally {
      setBusy(false);
    }
  }

  function grant() {
    const n = Number(credits);
    if (!window.confirm(`${email} üyesine ${n} jeton eklensin mi?`)) return;
    void run(
      () => adminGrantCredits({ userId, credits: n, days: days.trim() ? Number(days) : null, note: gNote }),
      `${n} jeton eklendi.`,
    );
  }

  function assign() {
    if (!product) return;
    const price = paid ? `${product.priceTry.toLocaleString("tr-TR")} ₺ (faturası kesilecek)` : "hediye (ücretsiz)";
    if (!window.confirm(`${email} üyesine "${product.name}" tanımlansın mı?\n${price}`)) return;
    void run(
      () =>
        adminAssignProduct({
          userId,
          productId: product.id,
          paid,
          note: pNote,
          billing: paid
            ? { type: bType, name: bName, taxId: bTaxId, taxOffice: bTaxOffice, address: bAddress, city: bCity }
            : undefined,
        }),
      `"${product.name}" tanımlandı.`,
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Paket / ek jeton tanımla */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="font-sans text-base font-extrabold">Paket / ek jeton tanımla</div>
        <p className="mt-1 text-xs text-muted">
          Havale ya da elden ödeme aldıysan ya da hediye vermek istiyorsan. Paket indirme hakkını da açar; ek jeton
          yalnız bakiye ekler. 30 gün geçerlidir.
        </p>
        <div className="mt-3 grid gap-3">
          <div>
            <label className={label} htmlFor="urun">Ürün</label>
            <select id="urun" className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.credits.toLocaleString("tr-TR")} jeton — {p.priceTry.toLocaleString("tr-TR")} ₺
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, t: "Ücretli satış" },
              { v: false, t: "Hediye (0 ₺)" },
            ].map((o) => (
              <label
                key={String(o.v)}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-bold ${
                  paid === o.v ? "border-accent bg-accent-soft text-accent" : "border-border text-muted"
                }`}
              >
                <input type="radio" name="ucret" className="sr-only" checked={paid === o.v} onChange={() => setPaid(o.v)} />
                {o.t}
              </label>
            ))}
          </div>
          {paid && (
            <div className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-2">
              <div className="text-xs font-semibold text-muted sm:col-span-2">
                Fatura bilgileri (sonra da girebilirsin)
              </div>
              <select
                aria-label="Fatura türü"
                className={input}
                value={bType}
                onChange={(e) => setBType(e.target.value as "bireysel" | "kurumsal")}
              >
                <option value="bireysel">Bireysel</option>
                <option value="kurumsal">Kurumsal</option>
              </select>
              <input className={input} placeholder={bType === "kurumsal" ? "Şirket unvanı" : "Ad soyad"} value={bName} onChange={(e) => setBName(e.target.value)} />
              <input className={input} inputMode="numeric" maxLength={11} placeholder={bType === "kurumsal" ? "Vergi no" : "TC kimlik no (isteğe bağlı)"} value={bTaxId} onChange={(e) => setBTaxId(e.target.value.replace(/\D/g, ""))} />
              {bType === "kurumsal" && (
                <input className={input} placeholder="Vergi dairesi" value={bTaxOffice} onChange={(e) => setBTaxOffice(e.target.value)} />
              )}
              <input className={`${input} sm:col-span-2`} placeholder="Adres" value={bAddress} onChange={(e) => setBAddress(e.target.value)} />
              <input className={input} placeholder="İl" value={bCity} onChange={(e) => setBCity(e.target.value)} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="p-not">Açıklama (zorunlu)</label>
            <input id="p-not" className={input} placeholder="ör. 12 Kasım havale / beta kullanıcısı" value={pNote} onChange={(e) => setPNote(e.target.value)} maxLength={300} />
          </div>
          <button
            type="button"
            disabled={busy || !product}
            onClick={assign}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "…" : "Tanımla"}
          </button>
        </div>
      </div>

      {/* Jeton ekle */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="font-sans text-base font-extrabold">Jeton ekle</div>
        <p className="mt-1 text-xs text-muted">
          Satış olmadan bakiyeye jeton ekler (telafi, deneme). İndirme hakkı vermez, fatura oluşturmaz.
        </p>
        <div className="mt-3 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label} htmlFor="jeton">Jeton</label>
              <input id="jeton" className={input} inputMode="numeric" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div>
              <label className={label} htmlFor="gun">Geçerlilik (gün)</label>
              <input id="gun" className={input} inputMode="numeric" placeholder="boş = süresiz" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="g-not">Açıklama (zorunlu)</label>
            <input id="g-not" className={input} placeholder="ör. hatalı kapak üretimi telafisi" value={gNote} onChange={(e) => setGNote(e.target.value)} maxLength={300} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={grant}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-bold transition hover:border-foreground/30 disabled:opacity-60"
          >
            {busy ? "…" : "Jeton ekle"}
          </button>
        </div>
      </div>

      {msg && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm lg:col-span-2 ${
            msg.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
