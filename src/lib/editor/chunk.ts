// Metni, AI editör isteklerinde model/zaman sınırlarına takılmadan işleyebilmek
// için parçalara böler. Mümkün oldukça paragraf bütünlüğünü korur; tek paragraf
// çok uzunsa boşluktan (cümle sonu yaklaşık) keser.
//
// Öneriler "alıntıya dayalı" döndüğü (karakter konumu değil) için parçalar
// arası birleştirme basittir: dizileri arka arkaya eklemek yeterli, üst üste
// binme yoktur.
//
// Dipnotlar: "[^1]" işareti asla ortadan kesilmez; "[^1]: …" tanım paragrafı,
// sığdığı sürece (en çok %20 taşmayla) başvurusunun parçasında kalır.

const FN_DEF_START = /^\s*\[\^[^\]\s]+\]:/;
const FN_REF = /\[\^[^\]\s]+\]/g;

/** Sert kesim noktası bir [^id] işaretinin içine düşüyorsa işaretin dışına al. */
function safeCut(s: string, cut: number): number {
  if (!s.includes("[^")) return cut;
  const re = new RegExp(FN_REF.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) && m.index < cut) {
    const end = m.index + m[0].length;
    if (cut > m.index && cut < end) return m.index > 0 ? m.index : end;
  }
  return cut;
}

export function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];

  const chunks: string[] = [];
  const paras = text.split(/\n\n+/);
  let cur = "";

  const pushCur = () => {
    if (cur.trim()) chunks.push(cur);
    cur = "";
  };

  for (const p of paras) {
    if (p.length > max) {
      // Tek paragraf sığmıyor → boşluklardan parçala.
      pushCur();
      let rest = p;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut < max * 0.5) cut = safeCut(rest, max); // uygun boşluk yoksa sert kes
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      cur = rest;
    } else if (cur && cur.length + 2 + p.length > max && !(FN_DEF_START.test(p) && cur.length + 2 + p.length <= max * 1.2)) {
      pushCur();
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  pushCur();
  return chunks;
}
