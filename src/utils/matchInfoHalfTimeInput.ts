/**
 * Pola sekund w formularzu „czas startu” (MM:SS) — bez type=number,
 * żeby nie gubić wiodących zer (np. „07”) podczas edycji.
 */

export function sanitizeHalfSecondsRaw(input: string): string {
  return input.replace(/\D/g, "").slice(0, 2);
}

export function halfSecondsFromRaw(raw: string): number {
  if (raw === "") return 0;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(59, n));
}

export function formatHalfSecondsDisplay(seconds: number): string {
  return String(Math.max(0, Math.min(59, Math.floor(seconds)))).padStart(2, "0");
}
