"use client";

import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { PAYMENT_OPEN } from "@/lib/credits/pricing";

// JETON / OTURUM UYARISI — bir yapay zekâ işlemi jeton yetmediği (402) ya da
// oturum kapandığı (401) için çalışmadıysa üyeye NE olduğunu ve NE yapacağını
// söyler. Tüm stüdyolar aynı bileşeni kullanır (tek metin, tek davranış).

export type CreditProblem =
  | { kind: "no-credits"; cost?: number; balance?: number }
  | { kind: "auth" }
  | { kind: "no-package" }; // indirme için aktif paket gerekli

// Sunucu yanıtından sorunu çıkarır. 402 → jeton yetmedi, 401 → oturum yok.
// Başka durumlarda null (çağıran kendi genel hatasını gösterir).
export async function creditProblemFrom(res: Response): Promise<CreditProblem | null> {
  if (res.status === 401) return { kind: "auth" };
  if (res.status !== 402) return null;
  try {
    const j = (await res.clone().json()) as { cost?: unknown; balance?: unknown };
    return {
      kind: "no-credits",
      cost: typeof j.cost === "number" ? j.cost : undefined,
      balance: typeof j.balance === "number" ? j.balance : undefined,
    };
  } catch {
    return { kind: "no-credits" };
  }
}

export function creditProblemText(p: CreditProblem, lang: Locale): string {
  const tr = lang === "tr";
  if (p.kind === "auth")
    return tr ? "Oturumun kapanmış. Devam etmek için yeniden giriş yap." : "Your session has expired. Please sign in again.";
  if (p.kind === "no-package")
    return tr
      ? PAYMENT_OPEN
        ? "Dosya indirmek için aktif bir paket gerekir."
        : "Dosya indirmek için aktif bir paket gerekir. Kartla ödeme henüz açılmadı; paket tanımlatmak için bize yaz."
      : PAYMENT_OPEN
        ? "Downloading files requires an active package."
        : "Downloading files requires an active package. Card payment isn't open yet; contact us to have one added.";
  const need =
    p.cost != null && p.balance != null
      ? tr
        ? `Bu işlem ${p.cost} jeton ister, bakiyen ${p.balance}.`
        : `This action needs ${p.cost} credits; you have ${p.balance}.`
      : tr
        ? "Jetonun bu işlem için yetmiyor."
        : "You don't have enough credits for this action.";
  const how = tr
    ? PAYMENT_OPEN
      ? "Paket ya da ek jeton alabilirsin."
      : "Kartla ödeme henüz açılmadı; jeton tanımlatmak için bize yaz."
    : PAYMENT_OPEN
      ? "You can buy a package or extra credits."
      : "Card payment isn't open yet; contact us to have credits added.";
  return `${need} ${how}`;
}

export default function CreditNotice({
  lang,
  problem,
  className = "",
  onClose,
}: {
  lang: Locale;
  problem: CreditProblem;
  className?: string;
  onClose?: () => void;
}) {
  const tr = lang === "tr";
  const btn =
    "rounded-full border border-amber-400/70 bg-white/70 px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-white dark:bg-transparent dark:text-amber-100";
  return (
    <div
      role="alert"
      className={`rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{creditProblemText(problem, lang)}</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label={tr ? "Kapat" : "Close"} className="shrink-0 text-base leading-none opacity-70 hover:opacity-100">
            ×
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {problem.kind === "auth" ? (
          <Link href={`/${lang}/giris`} className={btn}>
            {tr ? "Giriş yap" : "Sign in"}
          </Link>
        ) : (
          <>
            <Link href={`/${lang}/fiyatlar`} className={btn}>
              {tr ? "Paketleri gör" : "See packages"}
            </Link>
            <Link href={`/${lang}/iletisim`} className={btn}>
              {tr ? "Bize yaz" : "Contact us"}
            </Link>
            <Link href={`/${lang}/jetonlar`} className={btn}>
              {tr ? "Jetonlarım" : "My credits"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
