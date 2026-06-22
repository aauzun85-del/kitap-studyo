import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

// Giriş yapılmadan kullanılamayan araç sayfaları (ilk yol parçası).
const PROTECTED = new Set(["kapak", "mizanpaj", "editor", "ekitap", "sesli-kitap", "projeler", "admin", "indir"]);

function getLocale(request: NextRequest): string {
  const accept = request.headers.get("accept-language");
  if (accept) {
    const preferred = accept.split(",")[0].split("-")[0].toLowerCase();
    if ((locales as readonly string[]).includes(preferred)) {
      return preferred;
    }
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API route'ları dil önekine girmez (arka uç çağrıları).
  if (pathname.startsWith("/api/")) return;

  // OAuth callback [lang] dışında yaşar → dil yönlendirmesine girmemeli;
  // kendi oturum çerezlerini route handler içinde yazar.
  if (pathname.startsWith("/auth/")) return;

  // Dil öneki yoksa: önce dile yönlendir (auth'tan ÖNCE, eski i18n davranışı).
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (!hasLocale) {
    const locale = getLocale(request);
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // Dil öneki var → Supabase oturumunu tazele (auth çerezini canlı tutar).
  const { user, response } = await updateSession(request);

  // Araç sayfalarını koru. Server Action POST'larını ATLA: aksi halde korumalı
  // bir sayfadan tetiklenen "çıkış yap" action POST'u, proxy tarafından login'e
  // yönlendirilip action'a hiç ulaşmaz (sessizce çalışmaz).
  const lang = pathname.split("/")[1];
  const seg = pathname.split("/")[2] ?? "";
  const isAction =
    request.method === "POST" || request.headers.has("next-action");

  if (PROTECTED.has(seg) && !user && !isAction) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/giris`;
    url.searchParams.set("next", pathname);
    const redirectRes = NextResponse.redirect(url);
    // Tazelenmiş çerezleri yönlendirme yanıtına da taşı (kaybolmasın).
    response.cookies.getAll().forEach((c) => redirectRes.cookies.set(c));
    return redirectRes;
  }

  // Diğer tüm yollarda tazelenmiş çerezleri taşıyan response'u dön (oturum canlı kalsın).
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
