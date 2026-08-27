/**
 * Etykiety względem dnia meczu (MD): MD-3, MD, MD+1 itd.
 * dayIndex / matchDayIndex: 0 = poniedziałek … 6 = niedziela.
 */
export function matchDayOffset(dayIndex: number, matchDayIndex: number): number {
  return dayIndex - matchDayIndex;
}

/**
 * Offset periodyzacyjny w tygodniu pn–nd.
 * Poniedziałek po meczu w niedzielę to MD+1 (regeneracja po poprzedniej niedzieli),
 * nie MD-6 — inaczej preset siłowy MD+1 nigdy nie ląduje w tym mikrocyklu.
 */
export function periodizationOffset(dayIndex: number, matchDayIndex: number): number {
  const raw = matchDayOffset(dayIndex, matchDayIndex);
  if (raw === -6) return 1;
  return raw;
}

export function formatMatchDayLabel(offset: number): string {
  if (offset === 0) return "MD";
  if (offset < 0) return `MD${offset}`;
  return `MD+${offset}`;
}

export function matchDayLabelForColumn(dayIndex: number, matchDayIndex: number): string {
  return formatMatchDayLabel(periodizationOffset(dayIndex, matchDayIndex));
}

/** 1–2 unikalne dni 0–6, posortowane (wcześniejszy mecz pierwszy). */
export function normalizeMatchDaysArray(arr: number[]): number[] {
  const u = [
    ...new Set(
      arr.filter(
        (x) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 6
      )
    ),
  ].sort((a, b) => a - b);
  return u.length === 0 ? [5] : u.slice(0, 2);
}

/** Etykiety MD względem każdego zdefiniowanego dnia meczu (np. dwa mecze w tygodniu). */
export function matchDayLabelsForColumn(dayIndex: number, matchDays: number[]): string[] {
  const n = normalizeMatchDaysArray(matchDays);
  return n.map((md) => matchDayLabelForColumn(dayIndex, md));
}

const DAY_NAMES_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"] as const;

export function weekdayShortPl(dayIndex: number): string {
  return DAY_NAMES_PL[dayIndex] ?? "?";
}

/** Poniedziałek bieżącego tygodnia (lokalna północ). */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
