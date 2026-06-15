// Supabase bağlantı bilgileri.
//
// Bu iki değer GİZLİ DEĞİLDİR: publishable key zaten tarayıcıya gönderilmek
// üzere tasarlanmıştır ve verileri Row Level Security (RLS) korur. Bu yüzden
// koda gömülü olmaları güvenlidir (Supabase'in resmi önerdiği yöntem).
//
// Neden env değil de sabit? Vercel'de "Sensitive" işaretli NEXT_PUBLIC_*
// değişkenleri build sırasında koda gömülmediği için undefined kalıyordu.
// Env tanımlıysa onu, değilse bu sabitleri kullanırız — her durumda çalışır.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://xrpbizuyqehrxcokrfdl.supabase.co";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_hLjosLWf-5YH7VLWHD5mlg_ZB9G7906";
