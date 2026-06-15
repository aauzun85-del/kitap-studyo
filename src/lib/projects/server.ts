import type { SupabaseClient } from "@supabase/supabase-js";
import { migrateEnvelope, type ProjectEnvelope } from "./types";

// Sunucu tarafı: ?project=<id> varsa o projeyi getirir (RLS sahipliği garanti eder).
// Bulunamazsa/sahip değilse undefined → modül anonim modda açılır (yumuşak düşüş).
export async function loadInitialProject(
  supabase: SupabaseClient,
  projectParam: string | string[] | undefined,
): Promise<{ id: string; data: ProjectEnvelope } | undefined> {
  const id = typeof projectParam === "string" ? projectParam : undefined;
  if (!id) return undefined;
  const { data } = await supabase.from("projects").select("data").eq("id", id).single();
  if (!data) return undefined;
  return { id, data: migrateEnvelope(data.data) };
}
