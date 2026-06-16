import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// SERVICE-ROLE istemcisi — TÜM veriye erişir, RLS'yi atlar. YALNIZ SUNUCUDA
// kullanılır (admin sayfası gibi). service_role anahtarı ÇOK GİZLİDİR:
// NEXT_PUBLIC_ DEĞİLDİR, tarayıcıya asla gönderilmez. Bu dosya bir client
// component'ten import edilirse build hata vermeli (server-only niyet).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY-missing");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceKey(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
