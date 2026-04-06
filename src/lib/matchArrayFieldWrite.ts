import type { Firestore } from "firebase/firestore";
import { doc, runTransaction } from "@/lib/firestoreWithMetrics";
import type { TeamInfo } from "@/types";
import { getMatchDocumentFromCache, setMatchDocumentInCache } from "@/lib/matchDocumentCache";
import { clearPendingMatchUpdate, getPendingField, setPendingMatchUpdate } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";

export type MatchArrayFieldKey = keyof Pick<
  TeamInfo,
  "shots" | "pkEntries" | "acc8sEntries" | "actions_packing" | "actions_unpacking" | "actions_regain" | "actions_loses"
>;

/** Bazowa lista: pending offline, potem cache dokumentu meczu. */
export function getBaselineMatchArray<T extends { id?: string }>(
  matchId: string,
  field: MatchArrayFieldKey
): T[] {
  const pending = getPendingField<T[]>(matchId, field);
  if (pending) {
    return pending.map((x) => ({ ...x }));
  }
  const cached = getMatchDocumentFromCache(matchId);
  const raw = (cached?.[field] as T[] | undefined) || [];
  return Array.isArray(raw) ? raw.map((x) => ({ ...x })) : [];
}

export type CommitMatchArrayOptions<T extends { id?: string }> = {
  db: Firestore;
  matchId: string;
  field: MatchArrayFieldKey;
  /** Wywoływane z aktualnej tablicy z serwera (transakcja) lub z baseline offline. */
  updater: (current: T[]) => T[];
  cleanForFirestore: (arr: T[]) => unknown;
  isOfflineError: (e: unknown) => boolean;
};

/**
 * Zapis tablicy w matches/{matchId}: online — transakcja (świeży odczyt + retry przy konfliktach);
 * offline — baseline z pending/cache, kolejka pending, aktualizacja cache.
 */
export type CommitMatchArrayResult<T> = { ok: boolean; next: T[]; usedOffline: boolean };

export async function commitMatchArrayFieldUpdate<T extends { id?: string }>(
  opts: CommitMatchArrayOptions<T>
): Promise<CommitMatchArrayResult<T>> {
  const { db, matchId, field, updater, cleanForFirestore, isOfflineError } = opts;
  const matchRef = doc(db, "matches", matchId);

  try {
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const data = snap.data() as TeamInfo;
      const current = (((data[field] as unknown) as T[] | undefined) ?? []) as T[];
      const nextArray = updater(current);
      const cleaned = cleanForFirestore(nextArray);
      transaction.update(matchRef, { [field]: cleaned } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      return nextArray;
    });

    clearPendingMatchUpdate(matchId, field);
    const cleaned = cleanForFirestore(next);
    const cached = getMatchDocumentFromCache(matchId);
    if (cached) {
      setMatchDocumentInCache(matchId, { ...cached, [field]: cleaned } as TeamInfo);
    }
    return { ok: true, next, usedOffline: false };
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_DOCUMENT_NOT_FOUND") {
      return { ok: false, next: [], usedOffline: false };
    }
    if (isOfflineError(err)) {
      const baseline = getBaselineMatchArray<T>(matchId, field);
      const next = updater(baseline);
      const cleaned = cleanForFirestore(next);
      setPendingMatchUpdate(matchId, field, cleaned);
      const cached = getMatchDocumentFromCache(matchId);
      if (cached) {
        setMatchDocumentInCache(matchId, { ...cached, [field]: cleaned } as TeamInfo);
      }
      return { ok: true, next, usedOffline: true };
    }
    console.error(`commitMatchArrayFieldUpdate ${String(field)}:`, err);
    return { ok: false, next: [], usedOffline: false };
  }
}

export type SyncPendingOptions<T extends { id?: string }> = {
  db: Firestore;
  matchId: string;
  field: MatchArrayFieldKey;
  cleanForFirestore: (arr: T[]) => unknown;
};

/**
 * Wysłanie kolejki offline: merge z aktualnym serwerem (żeby nie nadpisać pracy innych analityków).
 */
/** Zwraca zmerge'owaną tablicę po sukcesie, null przy braku pending lub błędzie. */
export async function syncPendingMatchArrayField<T extends { id?: string }>(
  opts: SyncPendingOptions<T>
): Promise<T[] | null> {
  const { db, matchId, field, cleanForFirestore } = opts;
  const pending = getPendingField<T[]>(matchId, field);
  if (!pending) {
    return null;
  }
  const matchRef = doc(db, "matches", matchId);
  try {
    const merged = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const data = snap.data() as TeamInfo;
      const server = (((data[field] as unknown) as T[] | undefined) ?? []) as T[];
      const next = mergeByIdPreferPending(server, pending);
      const cleaned = cleanForFirestore(next);
      transaction.update(matchRef, { [field]: cleaned } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      return next;
    });
    clearPendingMatchUpdate(matchId, field);
    const cached = getMatchDocumentFromCache(matchId);
    if (cached) {
      setMatchDocumentInCache(matchId, {
        ...cached,
        [field]: cleanForFirestore(merged),
      } as TeamInfo);
    }
    return merged;
  } catch {
    return null;
  }
}
