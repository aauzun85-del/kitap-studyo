// AppShell için kullanıcı kimliği türetme (sunucu tarafı paylaşılan yardımcı).
import { isAdminEmail } from "@/lib/admin";
import { getBalanceById } from "@/lib/credits/server";
import type { ShellUser } from "@/components/app/AppShell";

type SupabaseUserLike = {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

/** E-postadan / metadata'dan görünür ad + baş harfler türetir. */
export function deriveIdentity(email: string, fullName?: string): { name: string; initials: string } {
  const local = email.split("@")[0] ?? "";
  const raw = (fullName?.trim() || local).replace(/[._-]+/g, " ").trim();
  const name =
    raw
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ") || email;
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] ?? email).slice(0, 2)).toUpperCase();
  return { name, initials };
}

/** Supabase user → AppShell ShellUser (yoksa null). Jeton bakiyesini de çeker
 *  (admin için null = sınırsız → üst barda "∞" gösterilir). */
export async function toShellUser(
  user: SupabaseUserLike,
): Promise<ShellUser | null> {
  if (!user) return null;
  const email = user.email ?? "";
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);
  const { name, initials } = deriveIdentity(email, fullName);
  const isAdmin = isAdminEmail(email);
  const balance = isAdmin || !user.id ? null : await getBalanceById(user.id);
  return { name, initials, email, isAdmin, balance };
}
