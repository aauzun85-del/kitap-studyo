// Admin (yönetici) e-posta kontrolü. Admin listesi ADMIN_EMAILS ortam
// değişkeninden okunur (virgülle ayrılmış, büyük/küçük harf duyarsız) —
// kodda gömülü e-posta YOKTUR.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
