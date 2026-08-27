/** Dni wolne w mikrocyklu — 0 = pn … 6 = nd. */

/** Pi–nd: domyślny odpoczynek amatorskiego tygodnia 4 jednostek (pn–czw). */
export const AMATEUR_REST_WEEKDAY_INDEXES = [4, 5, 6] as const;

function clampDayIndex(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0 || i > 6) return null;
  return i;
}

export function normalizeRestDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const item of raw) {
    const day = clampDayIndex(item);
    if (day != null) unique.add(day);
  }
  return [...unique].sort((a, b) => a - b);
}

export function isRestDay(restDays: number[] | undefined, dayIndex: number): boolean {
  const day = clampDayIndex(dayIndex);
  if (day == null) return false;
  return (restDays ?? []).includes(day);
}

/**
 * Pi, so, nd — wolne, chyba że wypada mecz.
 * Daje dokładnie cztery dni treningowe przy meczu w sobotę albo niedzielę.
 */
export function defaultAmateurRestDays(matchDays: number[]): number[] {
  const matches = new Set(
    matchDays.filter((d) => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6)
  );
  return AMATEUR_REST_WEEKDAY_INDEXES.filter((d) => !matches.has(d));
}

export function setRestDay(
  restDays: number[] | undefined,
  dayIndex: number,
  rest: boolean
): number[] {
  const day = clampDayIndex(dayIndex);
  if (day == null) return normalizeRestDays(restDays);
  const next = new Set(normalizeRestDays(restDays));
  if (rest) next.add(day);
  else next.delete(day);
  return [...next].sort((a, b) => a - b);
}

/** Zamiana znacznika wolnego między dwoma dniami. */
export function swapRestDays(
  restDays: number[] | undefined,
  fromDayIndex: number,
  toDayIndex: number
): number[] {
  const from = clampDayIndex(fromDayIndex);
  const to = clampDayIndex(toDayIndex);
  if (from == null || to == null || from === to) return normalizeRestDays(restDays);
  const fromRest = isRestDay(restDays, from);
  const toRest = isRestDay(restDays, to);
  let next = setRestDay(restDays, from, toRest);
  next = setRestDay(next, to, fromRest);
  return next;
}

/** Przeniesienie znacznika wolnego: źródło przestaje być wolne, cel przejmuje flagę. */
export function moveRestDay(
  restDays: number[] | undefined,
  fromDayIndex: number,
  toDayIndex: number
): number[] {
  const from = clampDayIndex(fromDayIndex);
  const to = clampDayIndex(toDayIndex);
  if (from == null || to == null || from === to) return normalizeRestDays(restDays);
  const fromRest = isRestDay(restDays, from);
  let next = setRestDay(restDays, from, false);
  next = setRestDay(next, to, fromRest);
  return next;
}
