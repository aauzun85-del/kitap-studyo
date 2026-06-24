// Typst içerik kaçışı — en alttaki, en kritik ilkel. Run metni Typst markup'ına
// gömülürken özel karakterler kaçırılmalı yoksa metin sessizce bozulur.
//
// Typst içerik-modu özel karakterleri: \ # [ ] * _ $ ` < > @  (satır içi)
// ve satır başında: = + - /  (başlık/liste sözdizimi).
// Eğri tırnak “ ” ‘ ’, em-dash —, üç nokta … ÖZEL DEĞİL → dokunma (zaten
// prepare.ts uyguladı). Run'lar tek paragraf olduğundan satır sonu → boşluk.

import type { Run } from "@/lib/layout/paginate";

export function escapeTypst(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\") // önce ters bölü
    .replace(/([#[\]*_$`<>@])/g, "\\$1") // satır içi özel karakterler
    .replace(/(^|\n)([=+\-/])/g, "$1\\$2") // yalnız satır başındaki blok karakterleri
    .replace(/\n+/g, " "); // run içi kaçak satır sonları → boşluk
}

// Kalın/italik için FONKSİYON formu #strong[...] / #emph[...] kullanılır (markup
// *...* / _..._ DEĞİL): markup formu kelime-ortası/bitişik run'larda (örn. OCR/
// sembol-font parçalı metin) bozulur ("NAS_IL_" çözülemez). Fonksiyon formu her
// içerikle (kelime-ortası dahil) sağlam çalışır; TEK tuzağı: bir #strong[X]'ten
// SONRA gelen "(" derlemeyi çökertir, ";" yutulur, "." alan-erişimi sanılır.
// Çözüm: stilli run'dan sonraki run'ın BAŞ karakteri ( ; . ise kaçırılır (\( vb.).
function styledWrap(r: Run, m: string): string {
  if (r.bold && r.italic) return `#strong[#emph[${m}]]`;
  if (r.bold) return `#strong[${m}]`;
  if (r.italic) return `#emph[${m}]`;
  return m;
}

export function runsToMarkup(runs: Run[]): string {
  let out = "";
  let prevStyled = false;
  for (const r of runs) {
    let m = escapeTypst(r.text);
    // Önceki run #strong/#emph ile bittiyse, bu run'ın baş ( ; . karakterini
    // kaçır → "]" sonrası kod-devamı (çağrı/alan/yutma) olmasın.
    if (prevStyled && /^[(;.]/.test(m)) m = "\\" + m;
    out += styledWrap(r, m);
    prevStyled = Boolean(r.bold || r.italic);
  }
  return out;
}
