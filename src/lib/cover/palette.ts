// Kapak görselinden sırt bandı rengi: görselin KOYU yarısının ortalaması,
// hafif doygunluk kırpmasıyla. Amaç tam renk analizi değil, sırtın görselle
// "aynı aileden" görünmesi. Tarayıcıda çalışır (canvas); hata olursa null.

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export async function spineColorFromImage(dataUrl: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      // Buluttan gelen (imzalı URL) görsel: CORS izniyle yükle, yoksa piksel okunamaz.
      if (/^https?:\/\//i.test(dataUrl)) el.crossOrigin = "anonymous";
      el.src = dataUrl;
    });
    const W = 48;
    const H = Math.max(1, Math.round((W * img.height) / Math.max(1, img.width)));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, W, H);
    const { data } = g.getImageData(0, 0, W, H);
    const px: { r: number; g: number; b: number; l: number }[] = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], gg = data[i + 1], b = data[i + 2];
      // Fotoğraf yuvasının krom yeşili (findChromaRect ile aynı ölçüt) palete girmesin.
      if (gg > 150 && gg - r > 90 && gg - b > 90) continue;
      px.push({ r, g: gg, b, l: 0.2126 * r + 0.7152 * gg + 0.0722 * b });
    }
    if (px.length === 0) return null;
    px.sort((a, b) => a.l - b.l);
    // Koyu %35'lik dilimin ortalaması: sırt genelde kapağın gölge tonunda durur.
    const take = px.slice(0, Math.max(1, Math.floor(px.length * 0.35)));
    let r = 0, gg = 0, b = 0;
    for (const p of take) {
      r += p.r;
      gg += p.g;
      b += p.b;
    }
    r /= take.length;
    gg /= take.length;
    b /= take.length;
    // Çok parlak çıkarsa (açık kapak) biraz koyulaştır → sırt yazısı okunur kalsın.
    const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const k = lum > 150 ? 0.72 : 1;
    return toHex(r * k, gg * k, b * k);
  } catch {
    return null;
  }
}

// Yapay zekânın fotoğraf yuvasına koyduğu SAF YEŞİL yer tutucuyu bulur
// (#00FF00, krom anahtar). Döndürülen değerler görselin kesirleridir (0..1) ve
// görselin doğal boyutu; bulunamazsa null. Kenar yumuşatmasını kapatmak için
// çağıran taraf dikdörtgeni biraz genişletir.
export async function findChromaRect(
  dataUrl: string,
): Promise<{ fx: number; fy: number; fw: number; fh: number; iw: number; ih: number } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      // Buluttan gelen (imzalı URL) görsel: CORS izniyle yükle, yoksa piksel okunamaz.
      if (/^https?:\/\//i.test(dataUrl)) el.crossOrigin = "anonymous";
      el.src = dataUrl;
    });
    const W = Math.min(640, img.width);
    const H = Math.max(1, Math.round((W * img.height) / Math.max(1, img.width)));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, W, H);
    const { data } = g.getImageData(0, 0, W, H);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = data[i], gg = data[i + 1], b = data[i + 2];
        // Belirgin yeşil: yeşil kanal baskın ve yüksek.
        if (gg > 150 && gg - r > 90 && gg - b > 90) {
          n++;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    // Çok küçük/dağınık yeşil = yer tutucu değil.
    if (n < W * H * 0.01 || x1 <= x0 || y1 <= y0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (n < bw * bh * 0.6) return null; // dikdörtgen değil (dağınık yeşil)
    return { fx: x0 / W, fy: y0 / H, fw: bw / W, fh: bh / H, iw: img.width, ih: img.height };
  } catch {
    return null;
  }
}
