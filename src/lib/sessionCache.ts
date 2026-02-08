/**
 * Prosty cache w pamięci z TTL — do ograniczania odczytów Firestore w ramach sesji.
 */

const caches = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 min

export function getCached<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  const entry = getCachedWithTimestamp<T>(key, ttlMs);
  return entry ? entry.data : null;
}

/** Zwraca wpis z datą — pozwala sprawdzić świeżość i pominąć fetch gdy cache OK */
export function getCachedWithTimestamp<T>(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS
): { data: T; timestamp: number } | null {
  const entry = caches.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    caches.delete(key);
    return null;
  }
  return { data: entry.data as T, timestamp: entry.timestamp };
}

export function setCached<T>(key: string, data: T): void {
  caches.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(key: string): void {
  caches.delete(key);
}

export const CACHE_KEYS = {
  PLAYERS_LIST: "players_list",
  TEAMS_LIST: "teams_list",
  USER_PREFIX: "user_", // + uid
} as const;
