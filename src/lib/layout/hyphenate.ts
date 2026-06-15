// Türkçe heceleme (hyphenation) — satır sonlarında kelimeleri hece sınırından
// bölmek için. Türkçe hece yapısı düzenlidir: her hecede tam bir sesli harf
// bulunur. Algoritma sözlük gerektirmez, kurallarla çalışır:
//   • İki sesli arasında 1 sessiz → sessiz ikinci heceye gider (a-ra, ka-pı).
//   • İki sesli arasında 2 sessiz → ortadan bölünür (kar-tal, pen-ce-re).
//   • İki sesli arasında 3+ sessiz → son sessiz sonraki heceye, kalanı önceki
//     hecede kalır (sürt-mek, elek-trik → e-lek-trik).
//
// Tireleme yalnızca Türkçe metinde güvenlidir; İngilizce için kapalı bırakılır
// (yanlış bölme yapmamak adına). Bölme noktaları her hecenin sonundadır; tipo-
// grafik kurallarla her iki yanda en az 2 harf kalacak şekilde kısıtlanır.

const VOWELS = "aeıioöuüâîû"; // Türkçe sesliler (+ nadir şapkalılar)

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch.toLocaleLowerCase("tr"));
}

// Bir kelimeyi Türkçe hecelere böler. Harf olmayan karakterler (tire, kesme)
// içeren parçalarda güvenli kalmak için yalnız saf harf dizilerini böler.
export function syllabifyTr(word: string): string[] {
  if (word.length < 4) return [word];
  // Yalnız harflerden oluşmuyorsa (sayı, noktalama bitişikse) bölme.
  if (!/^[\p{L}]+$/u.test(word)) return [word];

  const chars = [...word];
  const vowelAt = chars.map(isVowel);
  const vowelCount = vowelAt.filter(Boolean).length;
  if (vowelCount < 2) return [word]; // tek heceli

  // Sesli indeksleri.
  const vIdx: number[] = [];
  vowelAt.forEach((v, i) => v && vIdx.push(i));

  // Her ardışık sesli çifti arasındaki sessizleri sayıp bölme noktası belirle.
  // Bölme noktası = bir hecenin başladığı indeks.
  const cuts: number[] = []; // hece başlangıç indeksleri (0 hariç)
  for (let k = 0; k < vIdx.length - 1; k++) {
    const a = vIdx[k];
    const b = vIdx[k + 1];
    const between = b - a - 1; // aradaki sessiz sayısı
    let cut: number;
    if (between <= 0) {
      cut = b; // bitişik iki sesli: ikinci sesliden böl (sa-at)
    } else if (between === 1) {
      cut = b - 1; // V-CV: tek sessiz sonraki heceye
    } else {
      cut = b - 1; // VC…-CV: son sessiz sonraki heceye, kalanı önceki hecede
    }
    cuts.push(cut);
  }

  const parts: string[] = [];
  let start = 0;
  for (const c of cuts) {
    parts.push(chars.slice(start, c).join(""));
    start = c;
  }
  parts.push(chars.slice(start).join(""));
  return parts.filter((p) => p.length > 0);
}

// Kelime içindeki olası bölme noktalarını (karakter indeksleri) döndürür.
// Her iki yanda en az `minSide` harf kalır (tipografik kural; varsayılan 2).
export function hyphenPoints(word: string, minSide = 2): number[] {
  const syll = syllabifyTr(word);
  if (syll.length < 2) return [];
  const points: number[] = [];
  let pos = 0;
  for (let i = 0; i < syll.length - 1; i++) {
    pos += syll[i].length;
    if (pos >= minSide && word.length - pos >= minSide) points.push(pos);
  }
  return points;
}
