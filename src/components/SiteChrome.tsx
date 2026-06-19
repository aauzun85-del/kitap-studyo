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
]);

// Yeni AppShell çatısını kendi içinde çizen sayfalar: pazarlama header/footer'ı
// VE eski ince proje çubuğunu gizle (AppShell sol menüsü ikisinin de yerini alır).
// Modüller AppShell'e taşındıkça FULLSCREEN_SEGMENTS'ten buraya geçecek.
const APPSHELL_SEGMENTS = new Set(["projeler", "tanitim", "ekitap", "editor", "sesli-kitap"]);

export default function SiteChrome({
  header,
  footer,
  projectBar,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  projectBar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Yol: "/tr/kapak" → parçalar ["", "tr", "kapak"]; 2. parça = modül adı.
  const segment = pathname.split("/")[2] ?? "";
  const appShell = APPSHELL_SEGMENTS.has(segment);
  const fullscreen = appShell || FULLSCREEN_SEGMENTS.has(segment);

  return (
    <>
      {/* Proje açıkken modül-geçiş çubuğu (kendi içinde gizlenir); tam ekran
          araçlarda da görünür. AppShell sayfalarında çizilmez (sol menü yerini alır). */}
      {!appShell && projectBar}
      {!fullscreen && header}
      <main className="flex-1">{children}</main>
      {!fullscreen && footer}
    </>
  );
}
