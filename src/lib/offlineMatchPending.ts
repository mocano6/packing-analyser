// src/lib/offlineMatchPending.ts
// Prosty storage dla zmian meczów zapisanych offline.

const STORAGE_PREFIX = "pending_match_updates_";

export type PendingMatchUpdates = Record<string, unknown>;

function getStorageKey(matchId: string): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

export function getPendingMatchUpdates(matchId: string): PendingMatchUpdates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMatchUpdates;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Zapis kolejki offline; false = localStorage niedostępny / quota / wyjątek. */
export function setPendingMatchUpdate(matchId: string, field: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    const existing = getPendingMatchUpdates(matchId) || {};
    const next = { ...existing, [field]: value };
    localStorage.setItem(getStorageKey(matchId), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/**
 * Usuwa z kolejki wpisy z pustą tablicą (np. uszkodzone pending) — bez synchronizacji z serwerem.
 */
export function clearEmptyArrayPendingFields(
  matchId: string,
  fields: readonly string[],
): void {
  for (const field of fields) {
    const pending = getPendingField<unknown[]>(matchId, field);
    if (pending !== null && Array.isArray(pending) && pending.length === 0) {
      clearPendingMatchUpdate(matchId, field);
    }
  }
}

export function clearPendingMatchUpdate(matchId: string, field: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingMatchUpdates(matchId);
    if (!existing) return;
    delete (existing as PendingMatchUpdates)[field];
    if (Object.keys(existing).length === 0) {
      localStorage.removeItem(getStorageKey(matchId));
      return;
    }
    localStorage.setItem(getStorageKey(matchId), JSON.stringify(existing));
  } catch {
    // ignore
  }
}

export function hasPendingMatchUpdates(matchId: string, field: string): boolean {
  const pending = getPendingMatchUpdates(matchId);
  return !!pending && Object.prototype.hasOwnProperty.call(pending, field);
}

export function getPendingField<T>(matchId: string, field: string): T | null {
  const pending = getPendingMatchUpdates(matchId);
  if (!pending) return null;
  if (!Object.prototype.hasOwnProperty.call(pending, field)) return null;
  return pending[field] as T;
}

