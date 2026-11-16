// Dipnotlar — metinde markdown biçimi (kdy-mizanpaj CLI ile aynı):
//   gövdede:   "...kelime[^1] devam"
//   tanım:     "[^1]: Dipnot metni." (TEK satır, kendi paragrafı)
//
// parseBlocks (paginate.ts) bir ön geçişte tanım satırlarını metinden ayıklar,
// her başvuruyu (ref) bir tanıma bağlar ve başvuruyu metin İÇİNDE özel-alan
// (Private Use) iki karakterlik bir yer tutucuyla değiştirir. inlineRuns bu yer
// tutucuları boş metinli "dipnot run"larına çevirir: { text: "", fn: { id, runs } }.
// Böylece başlık/bölüm/kelime sayımı gibi düz metin kullanan her yer dipnotları
// kendiliğinden yok sayar; Typst/EPUB gibi çıktılar fn alanını okur.
//
// Bilinçli farklar (CLI'ye göre): yinelenen kimlikte başvuru, KENDİSİNDEN SONRA
// gelen ilk kullanılmamış tanıma bağlanır (bölüm bölüm yapıştırılmış metinde her
// bölüm [^1]'den başlar); kullanılmayan tanım SİLİNMEZ (görünür paragraf kalır,
// kaybolmasın); dipnot metninde kalın/italik korunur.
//
// Bu dosya paginate.ts'ten çalışma anında içe aktarılır → yalnız TİP içe aktarır.

import type { Block, Run } from "./paginate";

/** Gövde içi başvuru: [^1], [^a2] … (kimlikte boşluk ve "]" olmaz). */
export const FN_REF_RE = /\[\^([^\]\s]+)\]/g;
/** Tanım satırı: "[^1]: metin" (satırın tamamı). */
export const FN_DEF_RE = /^\[\^([^\]\s]+)\]:\s*(.*)$/;

/** Yer tutucu: U+E000 + (U+E100 + sıra). ~6000 dipnota kadar. */
const PH_LEAD = "";
const PH_BASE = 0xe100;
const PH_MAX = 0xf8ff - PH_BASE;
export const FN_PH_RE = /[-]/g;

/** Düz metinden dipnot yer tutucularını ve [^n] başvurularını siler. */
export function stripFootnoteMarks(s: string): string {
  return s.replace(FN_PH_RE, "").replace(FN_REF_RE, "");
}

type Def = { id: string; text: string; line: number; used: boolean };

/**
 * Ham metindeki dipnotları çözer: kullanılan tanım satırlarını siler, her
 * başvuruyu yer tutucuyla değiştirir. notes[k] = k. yer tutucunun dipnotu
 * (id + ham markdown metni). Dipnot yoksa metin aynen döner.
 */
export function extractFootnotes(raw: string): { text: string; notes: { id: string; text: string }[] } {
  if (!raw.includes("[^")) return { text: raw, notes: [] };
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const defs: Def[] = [];
  lines.forEach((l, i) => {
    const m = FN_DEF_RE.exec(l.trim());
    if (m) defs.push({ id: m[1], text: m[2].trim(), line: i, used: false });
  });
  if (!defs.length) return { text: raw, notes: [] };
  const byId = new Map<string, Def[]>();
  for (const d of defs) {
    const arr = byId.get(d.id) ?? [];
    arr.push(d);
    byId.set(d.id, arr);
  }
  const defLines = new Set(defs.map((d) => d.line));
  const notes: { id: string; text: string }[] = [];
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (defLines.has(i)) {
      out.push(l); // karar aşağıda: kullanılan tanımlar silinir
      return;
    }
    out.push(
      l.replace(FN_REF_RE, (whole, id: string) => {
        const cands = byId.get(id);
        if (!cands || notes.length > PH_MAX) return whole;
        // Kendisinden SONRA gelen ilk kullanılmamış tanım; yoksa öncekilerin sonuncusu.
        // Aynı kimliğe tanımdan önce iki kez başvurulduysa ikincisi de aynı nota bağlanır.
        const d =
          cands.find((c) => !c.used && c.line > i) ??
          cands.find((c) => c.line > i) ??
          [...cands].reverse().find((c) => c.line < i);
        if (!d) return whole;
        d.used = true;
        notes.push({ id, text: d.text });
        return PH_LEAD + String.fromCharCode(PH_BASE + notes.length - 1);
      }),
    );
  });
  // Kullanılan tanım satırlarını sil (kullanılmayan görünür paragraf kalır).
  const usedLines = new Set(defs.filter((d) => d.used).map((d) => d.line));
  const text = out.filter((_, i) => !usedLines.has(i)).join("\n");
  return { text, notes };
}

/**
 * Yer tutucu içeren metinden run'lar: yer tutucular boş metinli dipnot run'ı
 * olur; çevresindeki biçim (kalın/italik) korunur.
 */
export function splitFootnoteRuns(runs: Run[], notes: Run[][], ids: string[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text.includes(PH_LEAD)) {
      out.push(r);
      continue;
    }
    const re = new RegExp(FN_PH_RE.source, "g");
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(r.text))) {
      if (m.index > last) out.push({ ...r, text: r.text.slice(last, m.index) });
      const k = m[0].charCodeAt(1) - PH_BASE;
      if (notes[k]) out.push({ text: "", bold: false, italic: false, fn: { id: ids[k], runs: notes[k] } });
      last = re.lastIndex;
    }
    if (last < r.text.length) out.push({ ...r, text: r.text.slice(last) });
  }
  return out;
}

/** Bloğun run'ları (başlık/paragraf/alıntı + tablo hücreleri). */
function blockRuns(b: Block): Run[][] {
  if (b.type === "paragraph" || b.type === "heading" || b.type === "blockquote") return [b.runs];
  if (b.type === "table") return b.rows.flatMap((row) => row);
  return [];
}

/** Kitaptaki dipnot sayısı (Mizanpaj "Dipnotlar" bölümü bunu gösterir). */
export function countFootnotes(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) for (const runs of blockRuns(b)) for (const r of runs) if (r.fn) n++;
  return n;
}

/** Dipnot run'larını çıkarır (düz metin/özet/sesli okuma için). */
export function withoutFootnotes(runs: Run[]): Run[] {
  return runs.filter((r) => !r.fn);
}
