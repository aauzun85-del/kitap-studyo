// NABIZ (keep-alive) ucu — Supabase ücretsiz planı ~1 hafta hareketsiz kalan
// projeyi uyutuyor (25 Tem 2026'da laycoty.com bu yüzden açılmadı). vercel.json
// içindeki günlük cron bu ucu çağırır; veritabanına yapılan minik sorgu Supabase
// tarafında "aktivite" sayılır ve proje uyanık kalır. Veri DÖNDÜRMEZ (yalnız
// satır sayısı başlığı) — herkese açık olması zararsızdır.

import { NextResponse } from "next/server";
import { createAdminClient, hasServiceKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic"; // önbelleğe girmesin — her çağrı gerçek DB isteği olsun

export async function GET() {
  try {
    // Tercihen service-role (RLS'siz kesin DB dokunuşu); yerelde anahtar boşsa
    // anon istemciyle düş (RLS boş sonuç döndürür ama sorgu yine DB'ye ulaşır).
    if (hasServiceKey()) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
    } else {
      const supabase = await createClient();
      await supabase.from("projects").select("id", { count: "exact", head: true });
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
