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

export function setPendingMatchUpdate(matchId: string, field: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingMatchUpdates(matchId) || {};
    const next = { ...existing, [field]: value };
    localStorage.setItem(getStorageKey(matchId), JSON.stringify(next));
  } catch {
    // Brak miejsca lub brak dostepu — pomijamy bez wyjatku
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

