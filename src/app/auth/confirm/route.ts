import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// E-posta bağlantısı doğrulama (token_hash): Supabase e-posta şablonu
// {{ .TokenHash }} kullanacak şekilde güncellenirse bağlantı buraya gelir.
// /auth/callback'teki code akışından farkı: bağlantı hangi cihazda/tarayıcıda
// açılırsa açılsın çalışır (şifre sıfırlamayı telefonda açan kullanıcı için).
// [lang] dışında yaşar (proxy /auth/'yu atlar).

// redirect_to tam URL, "/auth/callback?next=X" ya da düz yol gelebilir —
// hepsinden güvenli bir site içi yol çıkar.
function resolveNext(raw: string | null): string {
  if (!raw) return "/tr";
  let path = raw;
  try {
    if (raw.includes("://")) {
      const u = new URL(raw);
      path = u.pathname + u.search;
    }
  } catch {
    return "/tr";
  }
  if (path.startsWith("/auth/callback")) {
    const inner = new URL(`http://x${path}`).searchParams.get("next");
    if (inner) path = inner;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/tr";
  }
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = resolveNext(
    searchParams.get("next") ?? searchParams.get("redirect_to"),
  );

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/tr/giris`);
}
