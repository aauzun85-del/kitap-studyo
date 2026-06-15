import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";

// Sunucu tarafı Supabase istemcisi: Server Component, Server Action ve Route
// Handler'larda kullanılır. Bu Next.js sürümünde cookies() ASENKRONDUR (await),
// ve Server Component render'ı sırasında çerez YAZILAMAZ — bu yüzden setAll
// try/catch ile sarılır; render sırasında çağrılırsa sessizce atlar (çerez
// tazelemesi proxy.ts'te yapılır). Çağıranlar MUTLAKA `await createClient()` der.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component render'ından çağrıldı — yok say; proxy.ts tazeler.
          }
        },
      },
    },
  );
}
