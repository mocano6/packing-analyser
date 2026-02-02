export function formatMMSS(seconds: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export function minutesDecimalToSeconds(minutes?: number): number {
  if (minutes === undefined || minutes === null) return 0;
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 60);
}

export function secondsToMinutesDecimal(seconds: number): number {
  const s = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return s / 60;
}

