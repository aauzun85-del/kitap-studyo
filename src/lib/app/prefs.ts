// AppShell UI tercihleri (sunucu tarafı). Çerezden okunur ki sayfa ilk
// render'ında kenar çubuğu doğru genişlikle gelsin (daraltılmış/açık titreme yok).
import { cookies } from "next/headers";

export async function getSidebarCollapsed(): Promise<boolean> {
  const c = await cookies();
  return c.get("sb_collapsed")?.value === "1";
}
