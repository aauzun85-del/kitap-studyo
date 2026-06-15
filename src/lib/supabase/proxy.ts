import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";

// @supabase/ssr'ın "middleware" oturum-tazeleme deseni — bu uygulamanın 'proxy'
// kuralına göre adlandırıldı. Her istekte auth çerezini tazeler ve HEM çözülmüş
// kullanıcıyı HEM de tazelenmiş Set-Cookie başlıklarını taşıyan response'u döner;
// böylece src/proxy.ts çerezleri koruyarak yönlendirme kararı verebilir.
// Çerezler hem request'e hem response'a yazılır (proxy çerez API'si gereği).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Proxy her istekte (prefetch dahil) çalıştığı için yalnız getUser() çağrılır;
  // burada DB sorgusu yapılmaz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, response };
}
