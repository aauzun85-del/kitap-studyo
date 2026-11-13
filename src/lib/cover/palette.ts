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
