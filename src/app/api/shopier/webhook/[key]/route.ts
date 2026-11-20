// SHOPIER BİLDİRİM UCU — Shopier bir sipariş olayı olduğunda buraya POST atar.
//
// Bu uç yalnız bir "dürtme"dir: gövdedeki bilgiye GÜVENMEZ, hiçbir tutarı ya da
// e-postayı oradan almaz. Tek yaptığı, bekleyen kart siparişlerini Shopier
// API'sinden (mağaza anahtarıyla) yeniden denetletmektir → sahte bir bildirim en
// fazla gereksiz bir denetim başlatır, jeton verdiremez.
//
// Koruma: adresin son parçası gizli bir anahtardır (SHOPIER_WEBHOOK_KEY); tutmazsa
// 404. Shopier'in imza biçimi (Shopier-Signature) belgelenmemiş olduğu için imza
// şimdilik yalnız GÖZLEMLENİR (tuttu/tutmadı günlüğe yazılır), ret sebebi değildir.
// Shopier 5 saniye içinde 200 bekler → denetime 4 saniye tanınır, her durumda 200.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { settleAllPending } from "@/lib/credits/shopierSync";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Uzunluk sızdırmadan sabit zamanlı karşılaştırma (iki tarafın özetini kıyasla).
function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/shopier/webhook/[key]">) {
  const { key } = await ctx.params;
  const expected = process.env.SHOPIER_WEBHOOK_KEY;
  if (!expected || !sameSecret(key, expected)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const raw = await request.text().catch(() => "");

  // İmza gözlemi: hangi biçimin tuttuğunu öğrenince zorunlu denetime çevrilecek.
  const token = process.env.SHOPIER_WEBHOOK_TOKEN;
  const signature = request.headers.get("shopier-signature");
  let signatureMatch: boolean | null = null;
  if (token && signature) {
    const mac = createHmac("sha256", token).update(raw).digest();
    const got = signature.trim().replace(/^sha256=/i, "");
    signatureMatch = [mac.toString("hex"), mac.toString("base64")].some((c) => sameSecret(c, got));
  }

  // Gövdeden yalnız sipariş numarası günlüğe yazılır (alıcı bilgisi yazılmaz).
  let orderId: string | null = null;
  try {
    const j = JSON.parse(raw) as { id?: unknown; orderId?: unknown; data?: { id?: unknown } };
    const v = j?.id ?? j?.orderId ?? j?.data?.id;
    if (typeof v === "string" || typeof v === "number") orderId = String(v).replace(/[^\w-]/g, "").slice(0, 40);
  } catch {
    // Gövde JSON değilse sorun değil; içerik zaten kullanılmıyor.
  }
  console.log(
    `[shopier-webhook] olay=${(request.headers.get("shopier-event") ?? "?").replace(/[^\w.-]/g, "").slice(0, 60)} sipariş=${orderId ?? "?"} imza=${
      signatureMatch === null ? "denetlenmedi" : signatureMatch ? "tuttu" : "tutmadı"
    }`,
  );

  // 4 saniyelik bütçe: denetim 3,5 sn'den sonra yeni satıra başlamaz; yine de
  // uzarsa beklemeyi bırakıp 200 döneriz (kalanını üyenin ekranı / yönetim tamamlar).
  await Promise.race([
    settleAllPending(3500).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]);
  return NextResponse.json({ ok: true });
}
