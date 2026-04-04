/**
 * Cache dokumentów meczów (matches/{matchId}).
 * Mecze starsze niż 7 dni są ładowane z cache; tylko najnowszy jest pobierany z Firestore.
 * Persystencja: pamięć + sessionStorage (przetrwa odświeżenie strony).
 * getOrLoadMatchDocument – jeden odczyt na matchId przy równoległych wywołaniach (usePackingActions, useShots, usePKEntries, useAcc8sEntries).
 * Gdy match.actions_packing jest puste, fallback do kolekcji actions_packing (legacy).
 */

import type { Action, TeamInfo } from "@/types";
import { getDB } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "@/lib/firestoreWithMetrics";

function normalizeLegacyAction(data: Record<string, unknown>, docId: string, matchId: string): Action {
  return {
    ...data,
    id: (data.id as string) ?? docId,
    matchId,
    minute: (data.minute ?? data.min ?? 0) as number,
    actionType: (data.actionType ?? data.type ?? "pass") as string,
    packingPoints: (data.packingPoints ?? data.packing ?? 0) as number,
    fromZone: (data.fromZone ?? data.startZone) as string | undefined,
    toZone: (data.toZone ?? data.endZone) as string | undefined,
    senderId: (data.senderId ?? data.playerId ?? "") as string,
    receiverId: (data.receiverId ?? data.receiverPlayerId ?? data.receiver_id) as string | undefined,
  } as Action;
}

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
        let packingActions = data.actions_packing || [];
        const legacyMatchIds = [matchId];
        if (data.matchId && data.matchId !== matchId) {
          legacyMatchIds.push(data.matchId);
        }
        if (packingActions.length === 0) {
          for (const legacyId of legacyMatchIds) {
            const legacyQuery = query(
              collection(db, "actions_packing"),
              where("matchId", "==", legacyId)
            );
            const legacySnapshot = await getDocs(legacyQuery);
            if (legacySnapshot.docs.length > 0) {
              packingActions = legacySnapshot.docs.map((d) =>
                normalizeLegacyAction(d.data() as Record<string, unknown>, d.id, matchId)
              );
              break;
            }
          }
        } else {
          packingActions = packingActions.map((a) => {
            const anyA = a as Record<string, unknown>;
            return {
              ...a,
              matchId,
              minute: a.minute ?? anyA.min ?? 0,
              actionType: a.actionType ?? anyA.type ?? "pass",
              packingPoints: a.packingPoints ?? anyA.packing ?? 0,
              fromZone: a.fromZone ?? anyA.startZone,
              toZone: a.toZone ?? anyA.endZone,
              senderId: a.senderId ?? anyA.playerId ?? "",
              receiverId: a.receiverId ?? anyA.receiverPlayerId ?? anyA.receiver_id ?? undefined,
            } as Action;
          });
        }
        const result: TeamInfo = { ...data, actions_packing: packingActions };
        setMatchDocumentInCache(matchId, result);
        return result;
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
