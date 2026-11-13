// Yönetim ekranındaki tarih aralığı (?bas=YYYY-AA-GG&bit=YYYY-AA-GG).
// Günler TÜRKİYE saatine göredir (UTC+3, yaz saati yok): "12 Kasım" = o günün
// 00:00–24:00 arası İstanbul saati.

export type Period = {
  from: string; // YYYY-AA-GG (dahil)
  to: string; // YYYY-AA-GG (dahil)
  fromIso: string; // aralığın başı (UTC ISO)
  toIso: string; // aralığın SONU, hariç (UTC ISO)
  label: string; // "son 30 gün" / "13.10.2026 – 12.11.2026"
  days: number;
};

const DAY = 86400000;
const TR_OFFSET = 3 * 3600000;
const RE = /^\d{4}-\d{2}-\d{2}$/;

// Bir anın İstanbul'daki takvim günü.
export function trDay(d: Date): string {
  return new Date(d.getTime() + TR_OFFSET).toISOString().slice(0, 10);
}
const startOf = (day: string) => new Date(`${day}T00:00:00+03:00`);
const shift = (day: string, n: number) => trDay(new Date(startOf(day).getTime() + n * DAY));
const pretty = (day: string) => day.split("-").reverse().join(".");
const valid = (s: string | null | undefined): s is string =>
  !!s && RE.test(s) && !Number.isNaN(startOf(s).getTime());

export const MAX_PERIOD_DAYS = 366;

// Parametreler geçersiz/boşsa: son 30 gün. Ters girilirse yer değiştirir;
// en çok 366 gün.
export function resolvePeriod(bas: string | null | undefined, bit: string | null | undefined, now = new Date()): Period {
  const today = trDay(now);
  let to = valid(bit) ? bit : today;
  let from = valid(bas) ? bas : shift(to, -29);
  if (from > to) [from, to] = [to, from];
  let days = Math.round((startOf(to).getTime() - startOf(from).getTime()) / DAY) + 1;
  if (days > MAX_PERIOD_DAYS) {
    from = shift(to, -(MAX_PERIOD_DAYS - 1));
    days = MAX_PERIOD_DAYS;
  }
  const isDefault = !valid(bas) && !valid(bit);
  return {
    from,
    to,
    fromIso: startOf(from).toISOString(),
    toIso: new Date(startOf(to).getTime() + DAY).toISOString(),
    label: isDefault ? "son 30 gün" : from === to ? pretty(from) : `${pretty(from)} – ${pretty(to)}`,
    days,
  };
}

// Hazır aralıklar (düğmeler).
export function periodPresets(now = new Date()): { id: string; label: string; from: string; to: string }[] {
  const today = trDay(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const prevEnd = shift(monthStart, -1);
  return [
    { id: "bugun", label: "Bugün", from: today, to: today },
    { id: "dun", label: "Dün", from: shift(today, -1), to: shift(today, -1) },
    { id: "7", label: "Son 7 gün", from: shift(today, -6), to: today },
    { id: "30", label: "Son 30 gün", from: shift(today, -29), to: today },
    { id: "buay", label: "Bu ay", from: monthStart, to: today },
    { id: "gecenay", label: "Geçen ay", from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd },
  ];
}
