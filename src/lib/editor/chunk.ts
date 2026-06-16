// Metni, AI editör isteklerinde model/zaman sınırlarına takılmadan işleyebilmek
// için parçalara böler. Mümkün oldukça paragraf bütünlüğünü korur; tek paragraf
// çok uzunsa boşluktan (cümle sonu yaklaşık) keser.
//
// Öneriler "alıntıya dayalı" döndüğü (karakter konumu değil) için parçalar
// arası birleştirme basittir: dizileri arka arkaya eklemek yeterli, üst üste
// binme yoktur.
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
        if (cut < max * 0.5) cut = max; // uygun boşluk yoksa sert kes
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut).trimStart();
      }
      cur = rest;
    } else if (cur && (cur.length + 2 + p.length) > max) {
      pushCur();
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  pushCur();
  return chunks;
}
