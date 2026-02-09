/**
 * Cache dokumentów meczów (matches/{matchId}).
 * Mecze starsze niż 7 dni są ładowane z cache; tylko najnowszy jest pobierany z Firestore.
 * Persystencja: pamięć + sessionStorage (przetrwa odświeżenie strony).
 * getOrLoadMatchDocument – jeden odczyt na matchId przy równoległych wywołaniach (usePackingActions, useShots, usePKEntries, useAcc8sEntries).
 */

import type { TeamInfo } from "@/types";
import { getDB } from "@/lib/firebase";
import { doc, getDoc } from "@/lib/firestoreWithMetrics";

const STORAGE_PREFIX = "packing_match_doc_";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const memory = new Map<string, TeamInfo>();

function storageKey(matchId: string): string {
  return `${STORAGE_PREFIX}${matchId}`;
}

export function getMatchDocumentFromCache(matchId: string): TeamInfo | null {
  const fromMemory = memory.get(matchId);
  if (fromMemory) return fromMemory;

  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeamInfo;
    memory.set(matchId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setMatchDocumentInCache(matchId: string, data: TeamInfo): void {
  memory.set(matchId, data);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(matchId), JSON.stringify(data));
  } catch {
    // sessionStorage pełny lub niedostępny – zostaw tylko w pamięci
  }
}

/** Obecnie trwające ładowanie dokumentu meczu – deduplikacja równoległych getDoc. */
const loadInFlight = new Map<string, Promise<TeamInfo | null>>();

/**
 * Pobiera dokument meczu z Firestore. Równoległe wywołania dla tego samego matchId
 * współdzielą jedno getDoc (1 odczyt zamiast 4 przy zmianie meczu).
 */
export async function getOrLoadMatchDocument(matchId: string): Promise<TeamInfo | null> {
  if (!matchId) return null;

  const existing = loadInFlight.get(matchId);
  if (existing) return existing;

  const db = getDB();
  if (!db) return null;

  const promise = (async (): Promise<TeamInfo | null> => {
    try {
      const matchRef = doc(db, "matches", matchId);
      const matchDoc = await getDoc(matchRef);
      if (matchDoc.exists()) {
        const data = matchDoc.data() as TeamInfo;
        setMatchDocumentInCache(matchId, data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("Błąd podczas pobierania dokumentu meczu:", error);
      const cached = getMatchDocumentFromCache(matchId);
      return cached;
    } finally {
      loadInFlight.delete(matchId);
    }
  })();

  loadInFlight.set(matchId, promise);
  return promise;
}

/** Czy data meczu (date string) jest starsza niż 7 dni od teraz */
export function isMatchOlderThan7Days(matchDate: string): boolean {
  const t = new Date(matchDate).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > SEVEN_DAYS_MS;
}

/** Sortowanie meczów: najnowszy pierwszy (do ustalenia, który pobrać z sieci) */
export function sortMatchesByDateDesc<T extends { date?: string; matchId?: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const ta = new Date(a.date || 0).getTime();
    const tb = new Date(b.date || 0).getTime();
    return tb - ta;
  });
}
