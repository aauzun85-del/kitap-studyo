import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { creditCost, type CreditAction } from "./pricing";

// JETON KAPISI — pahalı bir uç noktanın en başında (girdi doğrulamasından
// SONRA, asıl işten ÖNCE) çağrılır. İki sonuç döner:
//   • { ok: false, response } → jeton yetersiz / giriş yok. Rota bunu döndürür,
//     asıl iş HİÇ çalışmaz.
//   • { ok: true, refund }    → jeton düşüldü, iş yapılabilir. İş başarısız
//     olursa rota `await gate.refund()` diyerek jetonu geri yatırır.
export type CreditGate =
  | { ok: false; response: NextResponse }
  | { ok: true; refund: () => Promise<void>; balance: number };

const noRefund = async () => {};

export async function chargeCredits(action: CreditAction): Promise<CreditGate> {
  const cost = creditCost(action);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Jeton sistemi kimlik gerektirir: giriş yapılmamışsa iş yapılmaz.
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "auth" }, { status: 401 }),
    };
  }

  // Admin sınırsız kullanır (jeton yakmaz).
  if (isAdminEmail(user.email)) {
    return { ok: true, refund: noRefund, balance: Number.POSITIVE_INFINITY };
  }

  // Ücretsiz (0 jeton) işlem — yine de giriş şartı geçerli.
  if (cost <= 0) {
    return { ok: true, refund: noRefund, balance: Number.POSITIVE_INFINITY };
  }

  // Atomik harcama (Postgres fonksiyonu; aşırı harcama imkânsız).
  const { data, error } = await supabase.rpc("spend_credits", {
    p_cost: cost,
    p_action: action,
  });

  if (error) {
    if ((error.message ?? "").includes("insufficient-credits")) {
      // Gerçek bakiye lotların toplamıdır (eski "credits" tablosu kullanılmıyor).
      const { data: bal } = await supabase.rpc("credit_balance", { p_uid: user.id });
      return {
        ok: false,
        response: NextResponse.json(
          { error: "no-credits", cost, balance: typeof bal === "number" ? bal : 0 },
          { status: 402 },
        ),
      };
    }
    // Beklenmeyen hata → işi başlatma (para/kaynak yakmayalım).
    return {
      ok: false,
      response: NextResponse.json({ error: "credits-failed" }, { status: 500 }),
    };
  }

  const balance = typeof data === "number" ? data : 0;
  const uid = user.id;

  // İş başarısız olursa jetonu geri yatır (service-role ile; sessiz best-effort).
  const refund = async () => {
    // İade edilemezse üye jeton kaybeder → en azından sunucu kaydına düşsün.
    if (!hasServiceKey()) {
      console.error("[jeton] iade yapılamadı: SUPABASE_SERVICE_ROLE_KEY yok", { uid, action, cost });
      return;
    }
    try {
      const admin = createAdminClient();
      const { error: refundError } = await admin.rpc("refund_credits", {
        p_uid: uid,
        p_cost: cost,
        p_action: action,
      });
      if (refundError) console.error("[jeton] iade hatası", { uid, action, cost, m: refundError.message });
    } catch (e) {
      console.error("[jeton] iade hatası", { uid, action, cost, m: String(e) });
    }
  };

  return { ok: true, refund, balance };
}

// Belli bir kullanıcı id'sinin jeton bakiyesi (süresi geçmemiş lotların toplamı).
// Çağıran zaten kullanıcıyı biliyorsa ekstra getUser çağrısı yapmadan bakiyeyi
// getirmek için — AppShell üst barı bunu kullanır.
export async function getBalanceById(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("credit_balance", { p_uid: userId });
  return typeof data === "number" ? data : 0;
}

// Kullanıcının AKTİF (süresi geçmemiş) satın alınmış paketi var mı? İndirme /
// dışa aktarma erişimi bununla açılır. Admin her zaman true.
export async function hasActivePackageById(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_active_package", { p_uid: userId });
  return data === true;
}

// Üst menü / hesap için: giriş yapan kullanıcının güncel jeton bakiyesi.
// Admin için Infinity, giriş yoksa null döner.
export async function getBalance(): Promise<number | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (isAdminEmail(user.email)) return Number.POSITIVE_INFINITY;
  const { data } = await supabase.rpc("credit_balance", { p_uid: user.id });
  return typeof data === "number" ? data : 0;
}
