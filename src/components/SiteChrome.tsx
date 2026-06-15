"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Araç (editör) sayfalarında üst menü + alt bilgi gizlenir → tam ekran,
 * odaklı çalışma alanı (Canva benzeri). Bu rotalarda kapak/mizanpaj vb.
 * stüdyolar tüm yüksekliği kullanır. Diğer sayfalarda (ana sayfa, tanıtım,
 * giriş, kayıt) header + footer normal görünür.
 *
 * Not: `header` ve `footer` SUNUCUDA çizilip buraya prop olarak geçer →
 * sözlük istemci paketine sızmaz, yalnız "göster/gizle" kararı istemcide.
 */
const FULLSCREEN_SEGMENTS = new Set([
  "kapak",
  "mizanpaj",
  "editor",
  "ekitap",
  "sesli-kitap",
]);

export default function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Yol: "/tr/kapak" → parçalar ["", "tr", "kapak"]; 2. parça = modül adı.
  const segment = pathname.split("/")[2] ?? "";
  const fullscreen = FULLSCREEN_SEGMENTS.has(segment);

  return (
    <>
      {!fullscreen && header}
      <main className="flex-1">{children}</main>
      {!fullscreen && footer}
    </>
  );
}
