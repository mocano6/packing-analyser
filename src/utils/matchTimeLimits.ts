/** Maksymalna minuta meczu / czas wideo (MM) w tagowaniu — dłuższe mecze, dogrywki, nagrania. */
export const MAX_MATCH_MINUTE = 200;

/** Maksymalna liczba minut w polu czasu wideo MM:SS. */
export const MAX_VIDEO_TIME_MINUTES = 200;

/** Koniec regulaminowej 1. połowy (konwencja minut meczu). */
export const FIRST_HALF_END_MINUTE = 45;

/** Początek 2. połowy (konwencja minut meczu). */
export const SECOND_HALF_START_MINUTE = 46;

export function clampFirstHalfMinute(minute: number): number {
  const n = Number.isFinite(minute) ? Math.floor(minute) : 1;
  return Math.max(1, Math.min(FIRST_HALF_END_MINUTE, n));
}

export function clampSecondHalfMinute(minute: number): number {
  const n = Number.isFinite(minute) ? Math.floor(minute) : SECOND_HALF_START_MINUTE;
  return Math.max(SECOND_HALF_START_MINUTE, Math.min(MAX_MATCH_MINUTE, n));
}

export function clampMatchMinute(minute: number, isSecondHalf: boolean): number {
  return isSecondHalf ? clampSecondHalfMinute(minute) : clampFirstHalfMinute(minute);
}

export function clampVideoTimeMinutes(mins: number): number {
  const n = Number.isFinite(mins) ? Math.floor(mins) : 0;
  return Math.max(0, Math.min(MAX_VIDEO_TIME_MINUTES, n));
}

/** Formatuje minuty wideo do MM:SS (sekundy 0–59). */
export function formatVideoMinutesAsMMSS(mins: number, secs = 0): string {
  const safeMins = clampVideoTimeMinutes(mins);
  const safeSecs = Math.max(0, Math.min(59, Math.floor(Number.isFinite(secs) ? secs : 0)));
  const formattedMins =
    safeMins < 100 ? safeMins.toString().padStart(2, "0") : safeMins.toString();
  return `${formattedMins}:${safeSecs.toString().padStart(2, "0")}`;
}
