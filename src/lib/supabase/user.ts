import { cache } from "react";
import { createClient } from "./server";

// Tek istek (bir sayfa render'ı) içinde getUser'ı TEK kez ağ çağrısına indirir.
// React cache() istek-kapsamlıdır: üst menü (SiteHeader) + sayfanın kendisi +
// admin kontrolü hepsi getCurrentUser() çağırsa bile Supabase'e yalnız BİR
// "kullanıcı geçerli mi?" sorgusu gider → sayfa geçişleri hızlanır.
//
// Not: proxy.ts ayrı bir istek bağlamında çalışır (oturum tazeleme için gerekli),
// onunla paylaşılamaz; bu yüzden render tarafındaki tekrarları birleştiriyoruz.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
