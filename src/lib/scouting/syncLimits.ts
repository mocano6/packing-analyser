/** Domyślne limity jednej sesji sync (Chrome + reCAPTCHA nie wytrzymują całej ligi naraz). */
export const DEFAULT_MAX_MATCHES_PER_SYNC = 80;
/** Partia profili na sesję — wiek jest priorytetem, ale reCAPTCHA limituje długość sesji. */
export const DEFAULT_MAX_PLAYERS_PER_SYNC = 80;
/**
 * Chunk zawodników w sync.ts — fetchMany i tak tnie do burstSize,
 * mniejszy chunk = częstsze checkpointy na dysku.
 */
export const PLAYER_FETCH_CHUNK = 16;

/**
 * Token Bearer żyje ok. 2 s. Po tym API zwraca 401.
 * Nie reuse’ujemy tokenu starszego niż TOKEN_MAX_AGE_MS.
 */
export const TOKEN_MAX_AGE_MS = 900;
/**
 * Wielkość paczki równoległych żądań — większa = mniej remintów reCAPTCHA na sesję
 * (każdy remint ryzykuje 403).
 */
export const DEFAULT_BURST_SIZE = 8;

export function sliceWithLimit<T>(items: T[], limit: number): { slice: T[]; remaining: number } {
  const safeLimit = limit > 0 ? limit : items.length;
  const slice = items.slice(0, safeLimit);
  return { slice, remaining: Math.max(0, items.length - slice.length) };
}

/** Czy przechwycony Bearer jest jeszcze w oknie bezpiecznego użycia (~2 s życia tokenu). */
export function isBearerStillFresh(tokenAtMs: number, nowMs: number, maxAgeMs: number = TOKEN_MAX_AGE_MS): boolean {
  if (!tokenAtMs || maxAgeMs <= 0) return false;
  return nowMs - tokenAtMs < maxAgeMs;
}
