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

// Bir run → Typst markup. Kalın/italik için MARKUP sözdizimi *...* / _..._
// kullanılır (FONKSİYON formu #strong[...] DEĞİL): çünkü #strong[X] sonrası gelen
// "(" tüm derlemeyi çökertir, ";" yutulur. Markup formu bu kod-modu tuzaklarının
// HİÇBİRİNE düşmez (sonraki tüm karakterler düz metin). Tek sınır: kelime ORTASI
// biçim (ke*lime*de) — kitaplarda neredeyse hiç olmaz; olursa düz * görünür (çökme yok).
// Vurgu işaretleri kelime sınırında olmalı → baştaki/sondaki boşluk dışarı taşınır.
function wrapMarkup(m: string, open: string, close: string): string {
  const lm = /^(\s*)([\s\S]*?)(\s*)$/.exec(m);
  if (!lm) return m;
  const [, lead, core, trail] = lm;
  if (!core) return m; // yalnız boşluk → sarma
  return `${lead}${open}${core}${close}${trail}`;
}

function runToMarkup(r: Run): string {
  const m = escapeTypst(r.text);
  if (r.bold && r.italic) return wrapMarkup(m, "*_", "_*");
  if (r.bold) return wrapMarkup(m, "*", "*");
  if (r.italic) return wrapMarkup(m, "_", "_");
  return m;
}

export function runsToMarkup(runs: Run[]): string {
  return runs.map(runToMarkup).join("");
}
