import type { TeamInfo } from "@/types";

/**
 * Konwersja surowej wartości z formularza / Firestore na sekundy startu połowy.
 * Wartości <= 0, null i NaN oznaczają brak ustawienia (nie zapisujemy „0” jako realnego offsetu —
 * zepsułoby to logikę: druga połowa od 0 s kłóci się z pierwszą połową).
 */
export function normalizeHalfStartTimeSeconds(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/** Usuwa z obiektu meczu błędne / puste czasy startu połów (0, null, stringi nie-numeryczne). */
export function normalizeTeamInfoHalfStarts(match: TeamInfo): TeamInfo {
  const out: TeamInfo = { ...match };
  const first = normalizeHalfStartTimeSeconds(match.firstHalfStartTime);
  const second = normalizeHalfStartTimeSeconds(match.secondHalfStartTime);
  if (first !== undefined) out.firstHalfStartTime = first;
  else delete out.firstHalfStartTime;
  if (second !== undefined) out.secondHalfStartTime = second;
  else delete out.secondHalfStartTime;
  return out;
}
