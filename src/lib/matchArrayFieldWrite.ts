import type { Firestore } from "firebase/firestore";
import { doc, runTransaction } from "@/lib/firestoreWithMetrics";
import type { TeamInfo } from "@/types";
import {
  getMatchDocumentFromCache,
  getOrLoadMatchDocument,
  setMatchDocumentInCache,
} from "@/lib/matchDocumentCache";
import { clearPendingMatchUpdate, getPendingField, setPendingMatchUpdate } from "@/lib/offlineMatchPending";
import { mergeByIdPreferPending } from "@/lib/mergeMatchArrayById";
import { ensureEachEntryHasId } from "@/lib/ensureMatchArrayIds";
import { shouldQueuePendingOnMatchWriteFailure } from "@/utils/isFirestoreOfflineLikeError";
import { minimalMatchDocShellForLocalCache } from "@/lib/minimalMatchDocShellForLocalCache";

export { minimalMatchDocShellForLocalCache };

export type MatchArrayFieldKey = keyof Pick<
  TeamInfo,
  "shots" | "pkEntries" | "acc8sEntries" | "actions_packing" | "actions_unpacking" | "actions_regain" | "actions_loses"
>;

const ALL_MATCH_ARRAY_FIELDS: MatchArrayFieldKey[] = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
  "shots",
  "pkEntries",
  "acc8sEntries",
];

/**
 * Po zapisie offline: jeden spójny dokument w sessionStorage (wszystkie tablice z pending/cache),
 * żeby odświeżenie strony nadal pokazywało packing/regain/loses (i spójnie PK/strzały/8s w cache).
 */
export function rebuildMatchDocumentCacheAfterOfflineFieldWrite(
  matchId: string,
  field: MatchArrayFieldKey,
  cleaned: unknown,
): void {
  const cached = getMatchDocumentFromCache(matchId);
  const base = cached ?? minimalMatchDocShellForLocalCache(matchId);
  const next: TeamInfo = {
    ...base,
    matchId: base.matchId ?? matchId,
  };
  const rec = next as unknown as Record<string, unknown>;
  for (const k of ALL_MATCH_ARRAY_FIELDS) {
    rec[k] = k === field ? cleaned : getBaselineMatchArray(matchId, k);
  }
  setMatchDocumentInCache(matchId, next);
}

export function rebuildMatchDocumentCacheAfterOfflineTwoFields(
  matchId: string,
  fieldA: MatchArrayFieldKey,
  cleanA: unknown,
  fieldB: MatchArrayFieldKey,
  cleanB: unknown,
): void {
  const cached = getMatchDocumentFromCache(matchId);
  const base = cached ?? minimalMatchDocShellForLocalCache(matchId);
  const next: TeamInfo = {
    ...base,
    matchId: base.matchId ?? matchId,
  };
  const rec2 = next as unknown as Record<string, unknown>;
  for (const k of ALL_MATCH_ARRAY_FIELDS) {
    if (k === fieldA) rec2[k] = cleanA;
    else if (k === fieldB) rec2[k] = cleanB;
    else rec2[k] = getBaselineMatchArray(matchId, k);
  }
  setMatchDocumentInCache(matchId, next);
}

/** Bazowa lista: pending offline, potem cache dokumentu meczu. */
export function getBaselineMatchArray<T extends { id?: string }>(
  matchId: string,
  field: MatchArrayFieldKey
): T[] {
  const pending = getPendingField<T[]>(matchId, field);
  if (pending !== null && Array.isArray(pending)) {
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
};

/**
 * Zapis tablicy w matches/{matchId}: online — transakcja (świeży odczyt + retry przy konfliktach);
 * offline — baseline z pending/cache, kolejka pending, aktualizacja cache.
 */
export type CommitMatchArrayResult<T> = { ok: boolean; next: T[]; usedOffline: boolean };

export async function commitMatchArrayFieldUpdate<T extends { id?: string }>(
  opts: CommitMatchArrayOptions<T>
): Promise<CommitMatchArrayResult<T>> {
  const { db, matchId, field, updater, cleanForFirestore } = opts;
  const matchRef = doc(db, "matches", matchId);

  try {
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const data = snap.data() as TeamInfo;
      const current = (((data[field] as unknown) as T[] | undefined) ?? []) as T[];
      const nextArray = ensureEachEntryHasId(updater(current));
      const cleaned = cleanForFirestore(nextArray);
      transaction.update(matchRef, { [field]: cleaned } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      return nextArray;
    });

    clearPendingMatchUpdate(matchId, field);
    const cleaned = cleanForFirestore(next);
    const cached = getMatchDocumentFromCache(matchId);
    if (cached) {
      setMatchDocumentInCache(matchId, { ...cached, [field]: cleaned } as TeamInfo);
    } else {
      await getOrLoadMatchDocument(matchId);
    }
    return { ok: true, next, usedOffline: false };
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_DOCUMENT_NOT_FOUND") {
      return { ok: false, next: [], usedOffline: false };
    }
    if (shouldQueuePendingOnMatchWriteFailure(err)) {
      const baseline = getBaselineMatchArray<T>(matchId, field);
      const next = ensureEachEntryHasId(updater(baseline));
      const cleaned = cleanForFirestore(next);
      if (!setPendingMatchUpdate(matchId, field, cleaned)) {
        console.error(
          "commitMatchArrayFieldUpdate: nie zapisano kolejki offline (localStorage).",
          String(field),
        );
        return { ok: false, next: [], usedOffline: false };
      }
      rebuildMatchDocumentCacheAfterOfflineFieldWrite(matchId, field, cleaned);
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
  if (pending.length === 0) {
    clearPendingMatchUpdate(matchId, field);
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
      const next = ensureEachEntryHasId(mergeByIdPreferPending(server, pending));
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
    } else {
      await getOrLoadMatchDocument(matchId);
    }
    return merged;
  } catch {
    return null;
  }
}

export type CommitTwoFieldsOptions<T extends { id?: string }> = {
  db: Firestore;
  matchId: string;
  fieldA: MatchArrayFieldKey;
  fieldB: MatchArrayFieldKey;
  /** Pełny dokument meczu z transakcji (świeży odczyt). */
  buildNext: (data: TeamInfo) => { nextA: T[]; nextB: T[] };
  cleanForFirestore: (arr: T[]) => unknown;
};

/**
 * Atomowy zapis dwóch tablic w tym samym matches/{matchId} (np. przeniesienie akcji packing ↔ unpacking).
 */
export async function commitTwoMatchArrayFieldsUpdate<T extends { id?: string }>(
  opts: CommitTwoFieldsOptions<T>
): Promise<{ ok: boolean; usedOffline: boolean }> {
  const { db, matchId, fieldA, fieldB, buildNext, cleanForFirestore } = opts;
  if (fieldA === fieldB) {
    console.error("commitTwoMatchArrayFieldsUpdate: fieldA === fieldB");
    return { ok: false, usedOffline: false };
  }
  const matchRef = doc(db, "matches", matchId);

  try {
    const { nextA, nextB } = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(matchRef);
      if (!snap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const data = snap.data() as TeamInfo;
      const built = buildNext(data);
      const cleanA = cleanForFirestore(ensureEachEntryHasId(built.nextA));
      const cleanB = cleanForFirestore(ensureEachEntryHasId(built.nextB));
      transaction.update(matchRef, {
        [fieldA]: cleanA,
        [fieldB]: cleanB,
      } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      return built;
    });

    clearPendingMatchUpdate(matchId, fieldA);
    clearPendingMatchUpdate(matchId, fieldB);
    const cleanA = cleanForFirestore(ensureEachEntryHasId(nextA));
    const cleanB = cleanForFirestore(ensureEachEntryHasId(nextB));
    const snapData = getMatchDocumentFromCache(matchId);
    if (snapData) {
      setMatchDocumentInCache(matchId, {
        ...snapData,
        [fieldA]: cleanA,
        [fieldB]: cleanB,
      } as TeamInfo);
    } else {
      await getOrLoadMatchDocument(matchId);
    }
    return { ok: true, usedOffline: false };
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_DOCUMENT_NOT_FOUND") {
      return { ok: false, usedOffline: false };
    }
    if (shouldQueuePendingOnMatchWriteFailure(err)) {
      const cached = getMatchDocumentFromCache(matchId) ?? ({} as TeamInfo);
      const baselineA = getBaselineMatchArray<T>(matchId, fieldA);
      const baselineB = getBaselineMatchArray<T>(matchId, fieldB);
      const synthetic = { ...cached, [fieldA]: baselineA, [fieldB]: baselineB } as TeamInfo;
      const { nextA, nextB } = buildNext(synthetic);
      const cleanA = cleanForFirestore(ensureEachEntryHasId(nextA));
      const cleanB = cleanForFirestore(ensureEachEntryHasId(nextB));
      if (!setPendingMatchUpdate(matchId, fieldA, cleanA) || !setPendingMatchUpdate(matchId, fieldB, cleanB)) {
        console.error("commitTwoMatchArrayFieldsUpdate: localStorage pending failed");
        return { ok: false, usedOffline: false };
      }
      rebuildMatchDocumentCacheAfterOfflineTwoFields(matchId, fieldA, cleanA, fieldB, cleanB);
      return { ok: true, usedOffline: true };
    }
    console.error(`commitTwoMatchArrayFieldsUpdate ${String(fieldA)}/${String(fieldB)}:`, err);
    return { ok: false, usedOffline: false };
  }
}

export type CommitCrossMatchPairOptions<T extends { id?: string }> = {
  db: Firestore;
  sourceMatchId: string;
  sourceField: MatchArrayFieldKey;
  targetMatchId: string;
  targetField: MatchArrayFieldKey;
  build: (sourceRows: T[], targetRows: T[]) => { nextSource: T[]; nextTarget: T[] };
  cleanForFirestore: (arr: T[]) => unknown;
};

/**
 * Jedna transakcja: aktualizacja tablicy w dwóch dokumentach meczu (np. przeniesienie akcji między meczami).
 */
export async function commitCrossMatchArrayFieldPairUpdate<T extends { id?: string }>(
  opts: CommitCrossMatchPairOptions<T>
): Promise<{ ok: boolean; usedOffline: boolean }> {
  const { db, sourceMatchId, sourceField, targetMatchId, targetField, build, cleanForFirestore } = opts;
  const sourceRef = doc(db, "matches", sourceMatchId);
  const targetRef = doc(db, "matches", targetMatchId);

  try {
    const { nextSource, nextTarget } = await runTransaction(db, async (transaction) => {
      const sourceSnap = await transaction.get(sourceRef);
      const targetSnap = await transaction.get(targetRef);
      if (!sourceSnap.exists() || !targetSnap.exists()) {
        throw new Error("MATCH_DOCUMENT_NOT_FOUND");
      }
      const sData = sourceSnap.data() as TeamInfo;
      const tData = targetSnap.data() as TeamInfo;
      const sRows = (((sData[sourceField] as unknown) as T[] | undefined) ?? []) as T[];
      const tRows = (((tData[targetField] as unknown) as T[] | undefined) ?? []) as T[];
      const built = build(sRows, tRows);
      const cleanS = cleanForFirestore(ensureEachEntryHasId(built.nextSource));
      const cleanT = cleanForFirestore(ensureEachEntryHasId(built.nextTarget));
      transaction.update(sourceRef, { [sourceField]: cleanS } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      transaction.update(targetRef, { [targetField]: cleanT } as Record<string, unknown> as import("firebase/firestore").UpdateData<TeamInfo>);
      return built;
    });

    clearPendingMatchUpdate(sourceMatchId, sourceField);
    clearPendingMatchUpdate(targetMatchId, targetField);

    const cleanS = cleanForFirestore(ensureEachEntryHasId(nextSource));
    const cleanT = cleanForFirestore(ensureEachEntryHasId(nextTarget));
    const cacheS = getMatchDocumentFromCache(sourceMatchId);
    if (cacheS) {
      setMatchDocumentInCache(sourceMatchId, { ...cacheS, [sourceField]: cleanS } as TeamInfo);
    }
    const cacheT = getMatchDocumentFromCache(targetMatchId);
    if (cacheT) {
      setMatchDocumentInCache(targetMatchId, { ...cacheT, [targetField]: cleanT } as TeamInfo);
    }

    return { ok: true, usedOffline: false };
  } catch (err) {
    if (err instanceof Error && err.message === "MATCH_DOCUMENT_NOT_FOUND") {
      return { ok: false, usedOffline: false };
    }
    if (shouldQueuePendingOnMatchWriteFailure(err)) {
      const sBase = getBaselineMatchArray<T>(sourceMatchId, sourceField);
      const tBase = getBaselineMatchArray<T>(targetMatchId, targetField);
      const { nextSource, nextTarget } = build(sBase, tBase);
      const cleanS = cleanForFirestore(ensureEachEntryHasId(nextSource));
      const cleanT = cleanForFirestore(ensureEachEntryHasId(nextTarget));
      if (
        !setPendingMatchUpdate(sourceMatchId, sourceField, cleanS) ||
        !setPendingMatchUpdate(targetMatchId, targetField, cleanT)
      ) {
        console.error("commitCrossMatchArrayFieldPairUpdate: localStorage pending failed");
        return { ok: false, usedOffline: false };
      }
      rebuildMatchDocumentCacheAfterOfflineFieldWrite(sourceMatchId, sourceField, cleanS);
      rebuildMatchDocumentCacheAfterOfflineFieldWrite(targetMatchId, targetField, cleanT);
      return { ok: true, usedOffline: true };
    }
    console.error("commitCrossMatchArrayFieldPairUpdate:", err);
    return { ok: false, usedOffline: false };
  }
}
