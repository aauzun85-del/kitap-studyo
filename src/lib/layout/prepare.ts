// Motor-bağımsız METİN HAZIRLIĞI — hem mevcut JS dizgi motoru (paginate) hem de
// yeni Typst motoru AYNI dönüşümleri uygular, yoksa iki çıktı tırnak/tire/yer-
// tutucu konusunda sessizce ayrışır. Tek doğruluk kaynağı burası.
//
// İçerik: akıllı (tipografik) tırnak dönüşümü, Türkçe em-dash normalizasyonu,
// Word üst verisindeki "yer tutucu" başlık/yazar temizliği.

import type { Run, Block, BookMeta } from "./paginate";

// ── Yer tutucu meta temizliği ──────────────────────────────────────────────
// Word üst verisinden (docProps/core.xml) sık gelen "yer tutucu" başlık/yazar
// değerleri. Gerçek bir ad değildir; koşu başlığı/başlık sayfasında asla
// gösterilmemeli — boş kabul edilir. Karşılaştırma kırpılmış + küçük harf.
const META_PLACEHOLDERS = new Set([
  "un-named", "unnamed", "un named", "untitled", "no title", "name", "title", "author",
  "isimsiz", "adsız", "adsiz", "isimsiz kitap", "adsız kitap", "adsiz kitap",
]);

// Bir başlık/yazar değerini temizler: kırpar; bilinen yer tutucu ya da boşsa ""
// döndürür (çağıran taraf boş diye çizmez).
export function cleanMetaValue(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return META_PLACEHOLDERS.has(t.toLocaleLowerCase("tr")) ? "" : t;
}

// ── Akıllı (tipografik) tırnak dönüşümü ────────────────────────────────────
// Düz tırnakları (" ve ') yayıncılık standardı eğri tırnaklara çevirir. Bağlam
// duyarlı: açılış “ ‘ ile kapanış ” ’ doğru yönlenir; Türkçe kesme işareti
// (KDY'nin, 2023'te, Atatürk'ün) sağ tek tırnağa (’) döner. Yön bağlamı run
// sınırlarını aşar (önceki karakter hatırlanır).
const isQuoteWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);
const OPENS_BEFORE_QUOTE = "([{‘“<«—–-/"; // bu karakterlerden sonra tırnak açılır

// ── Çizgi (tire/dash) tek-kural normalizasyonu ─────────────────────────────
// Türkçe dizgide cümle/ara çizgisi ARALIKLI em dash (" — ") ile yazılır. Kaynak
// metindeki karışık kullanım tek kurala bağlanır. KORUNANLAR: kelime içi tire
// (ara-sıra) ve sayı aralıklarındaki bitişik en dash (1914–1918).
export function normalizeDashesText(text: string): string {
  let s = text;
  s = s.replace(/-{2,}/g, "—");          // çift/çoklu tire → em dash
  s = s.replace(/ +[-–] +/g, " — ");     // aralıklı kısa tire / en dash → aralıklı em dash
  s = s.replace(/\s*—\s*/g, " — ");      // tüm em dash'leri tek boşlukla aç (bitişik dahil)
  s = s.replace(/^\s*—\s/, "— ");        // satır/paragraf başı diyalog tiresi: önünde boşluk yok
  return s;
}

export function applySmartQuotesToRuns(runs: Run[], prevRef: { prev: string }): Run[] {
  return runs.map((r) => {
    let s = "";
    for (const ch of normalizeDashesText(r.text)) {
      const prev = prevRef.prev;
      if (ch === '"') {
        const open = prev === "" || /\s/.test(prev) || OPENS_BEFORE_QUOTE.includes(prev);
        s += open ? "“" : "”";
      } else if (ch === "'") {
        if (isQuoteWordChar(prev)) s += "’"; // kelime içi/sonu: kesme ’
        else {
          const open = prev === "" || /\s/.test(prev) || OPENS_BEFORE_QUOTE.includes(prev);
          s += open ? "‘" : "’";
        }
      } else {
        s += ch;
      }
      prevRef.prev = ch; // bağlam: dönüşmemiş özgün karakter
    }
    return { ...r, text: s };
  });
}

export function smartQuoteText(text: string): string {
  return applySmartQuotesToRuns([{ text, bold: false, italic: false }], { prev: "" })[0].text;
}

export function smartQuoteBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    // run taşımayan bloklar (boş / görsel / tablo / sayfa-sonu / boşluk)
    // dokunulmaz. (Tablo hücre metni v1'de akıllı tırnaktan geçmez.)
    if (
      b.type === "blank" ||
      b.type === "image" ||
      b.type === "table" ||
      b.type === "pagebreak" ||
      b.type === "spacer"
    )
      return b;
    // Her blok kendi bağlamında başlar (önceki blok tırnağı taşımaz).
    return { ...b, runs: applySmartQuotesToRuns(b.runs, { prev: "" }) };
  });
}

// Meta'yı tek noktadan hazırla (temizle + akıllı tırnak) — iki motor da kullanır.
export function prepareMeta(meta: BookMeta): BookMeta {
  return {
    title: smartQuoteText(cleanMetaValue(meta.title)),
    author: smartQuoteText(cleanMetaValue(meta.author)),
    bio: smartQuoteText(meta.bio),
    subtitle: smartQuoteText(cleanMetaValue(meta.subtitle ?? "")),
    publisher: smartQuoteText(cleanMetaValue(meta.publisher ?? "")),
  };
}
