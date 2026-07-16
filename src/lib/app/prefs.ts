// AppShell UI tercihleri (sunucu tarafı). Çerezden okunur ki sayfa ilk
// render'ında kenar çubuğu doğru genişlikle gelsin (daraltılmış/açık titreme yok).
import { cookies } from "next/headers";

export async function getSidebarCollapsed(): Promise<boolean> {
  const c = await cookies();
  return c.get("sb_collapsed")?.value === "1";
}

// Kullanıcının AÇIK tercihi (çerez): true/false; hiç seçim yapmadıysa null.
// Tuval ağırlıklı sayfalar (mizanpaj/kapak) null'da daraltılmış başlar —
// çalışma alanı geniş kalsın; kullanıcı menüyü açarsa tercihi korunur.
export async function getSidebarPref(): Promise<boolean | null> {
  const c = await cookies();
  const v = c.get("sb_collapsed")?.value;
  return v === "1" ? true : v === "0" ? false : null;
}
