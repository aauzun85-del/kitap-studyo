import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "./config";

// Tarayıcı tarafı Supabase istemcisi. Yalnız client component'lerde, Supabase ile
// doğrudan konuşması gereken yerlerde kullanılır (Google OAuth yönlendirmesi gibi).
// E-posta/şifre girişi bunu KULLANMAZ — o iş server action üzerinden gider.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
