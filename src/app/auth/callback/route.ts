import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth (Google) callback: gelen `code`'u oturum çerezine çevirir ve kullanıcıyı
// diline geri döndürür. Bu dosya yalnız Google girişi açıldığında çalışır;
// e-posta/şifre girişini etkilemez. [lang] dışında yaşar (proxy /auth/'yu atlar).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tr";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/tr/giris`);
}
