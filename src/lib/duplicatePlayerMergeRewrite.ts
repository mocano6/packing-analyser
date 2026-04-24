/**
 * Przepisywanie ID zawodników w dokumencie meczu przy sparowaniu duplikatów kartoteki.
 */

import type {
  Acc8sEntry,
  Action,
  GPSDataEntry,
  MatchActionSourceField,
  PKEntry,
  PlayerMatchStats,
  PlayerMinutes,
  Shot,
} from "@/types";
import { getActionReceiverIdFromRaw, getActionSenderIdFromRaw, normalizeFirestorePlayerId } from "./matchActionPlayerIds";

/** Zbiór ID duplikatów + główny ID po normalizacji (DocumentReference, „players/x”, liczby). */
function normalizedDuplicateIdSet(duplicatePlayerIds: string[]): Set<string> {
  const dup = new Set<string>();
  for (const id of duplicatePlayerIds) {
    const k = normalizeFirestorePlayerId(id);
    if (k) dup.add(k);
  }
  return dup;
}

function normalizedMainId(mainPlayerId: string): string {
  return normalizeFirestorePlayerId(mainPlayerId) ?? mainPlayerId;
}

export const MATCH_ACTION_ARRAY_KEYS = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
] as const;

export type MatchActionArrayKey = (typeof MATCH_ACTION_ARRAY_KEYS)[number];

/** Wszystkie akcje z czterech tablic dokumentu meczu (np. liczniki / statystyki). */
export function collectAllActionsFromMatchDoc(
  matchData: Record<string, unknown>,
  matchId: string,
): Action[] {
  const out: Action[] = [];
  for (const field of MATCH_ACTION_ARRAY_KEYS) {
    const arr = matchData[field];
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      const a = raw as Action;
      const senderId = getActionSenderIdFromRaw(raw) ?? a.senderId ?? "";
      const receiverId = getActionReceiverIdFromRaw(raw) ?? a.receiverId;
      out.push({
        ...a,
        matchId: a.matchId ?? matchId,
        senderId,
        receiverId,
        sourceMatchArray: field as MatchActionSourceField,
      });
    }
  }
  return out;
}

function rewriteScalarPlayerId(
  id: unknown,
  dup: Set<string>,
  mainId: string,
): { next: unknown; changed: boolean } {
  const k = normalizeFirestorePlayerId(id);
  if (!k || !dup.has(k)) {
    return { next: id, changed: false };
  }
  return { next: mainId, changed: true };
}

function rewritePlayerIdList(
  list: unknown[] | undefined,
  dup: Set<string>,
  mainId: string,
): { next: unknown[] | undefined; changed: boolean } {
  if (!list?.length) {
    return { next: list, changed: false };
  }
  let changed = false;
  const mapped = list.map((item) => {
    const k = normalizeFirestorePlayerId(item);
    if (k && dup.has(k)) {
      changed = true;
      return mainId;
    }
    return item;
  });
  const deduped = [...new Set(mapped as unknown[])];
  if (deduped.length !== list.length) {
    changed = true;
  }
  return { next: deduped, changed };
}

export function rewriteActionForDuplicateMerge(
  action: Action,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { action: Action; changed: boolean } {
  const {
    senderName,
    senderNumber,
    receiverName,
    receiverNumber,
    ...rest0
  } = action as Action & {
    senderName?: string;
    senderNumber?: number;
    receiverName?: string;
    receiverNumber?: number;
  };

  let changed = !!(senderName || senderNumber || receiverName || receiverNumber);
  const next = { ...rest0 } as Action;
  const nextRec = next as unknown as Record<string, unknown>;
  const actionRec = action as unknown as Record<string, unknown>;

  const s = rewriteScalarPlayerId(next.senderId, duplicateIds, mainPlayerId);
  if (s.changed) {
    next.senderId = s.next as string;
    changed = true;
  }
  if (next.receiverId !== undefined && next.receiverId !== null && next.receiverId !== "") {
    const r = rewriteScalarPlayerId(next.receiverId, duplicateIds, mainPlayerId);
    if (r.changed) {
      next.receiverId = r.next as string | undefined;
      changed = true;
    }
  }

  const legacyPid = actionRec.playerId;
  if (legacyPid !== undefined) {
    const p = rewriteScalarPlayerId(legacyPid, duplicateIds, mainPlayerId);
    if (p.changed) {
      nextRec.playerId = p.next;
      changed = true;
    }
  }
  const legacyRecv = actionRec.receiverPlayerId;
  if (legacyRecv !== undefined) {
    const p = rewriteScalarPlayerId(legacyRecv, duplicateIds, mainPlayerId);
    if (p.changed) {
      nextRec.receiverPlayerId = p.next;
      changed = true;
    }
  }

  const def = rewritePlayerIdList(next.defensePlayers as unknown[] | undefined, duplicateIds, mainPlayerId);
  if (def.changed) {
    next.defensePlayers = def.next as string[];
    changed = true;
  }

  return { action: next, changed };
}

export function rewriteShotForDuplicateMerge(
  shot: Shot,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { shot: Shot; changed: boolean } {
  const {
    playerName,
    assistantName,
    senderName,
    receiverName,
    ...rest0
  } = shot as Shot & {
    playerName?: string;
    assistantName?: string;
    senderName?: string;
    receiverName?: string;
  };

  let changed = !!(playerName || assistantName || senderName || receiverName);
  const next = { ...rest0 } as Shot;

  const p = rewriteScalarPlayerId(next.playerId, duplicateIds, mainPlayerId);
  if (p.changed) {
    next.playerId = p.next as string;
    changed = true;
  }
  const a = rewriteScalarPlayerId(next.assistantId, duplicateIds, mainPlayerId);
  if (a.changed) {
    next.assistantId = a.next as string | undefined;
    changed = true;
  }
  const bp = rewritePlayerIdList(next.blockingPlayers as unknown[] | undefined, duplicateIds, mainPlayerId);
  if (bp.changed) {
    next.blockingPlayers = (bp.next ?? []) as string[];
    changed = true;
  }
  const lp = rewritePlayerIdList(next.linePlayers as unknown[] | undefined, duplicateIds, mainPlayerId);
  if (lp.changed) {
    next.linePlayers = (lp.next ?? []) as string[];
    changed = true;
  }

  return { shot: next, changed };
}

export function rewritePKEntryForDuplicateMerge(
  entry: PKEntry,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { entry: PKEntry; changed: boolean } {
  const { senderName, receiverName, ...rest0 } = entry as PKEntry & {
    senderName?: string;
    receiverName?: string;
  };
  let changed = !!(senderName || receiverName);
  const next = { ...rest0 } as PKEntry;

  const s = rewriteScalarPlayerId(next.senderId, duplicateIds, mainPlayerId);
  if (s.changed) {
    next.senderId = s.next as string;
    changed = true;
  }
  const r = rewriteScalarPlayerId(next.receiverId, duplicateIds, mainPlayerId);
  if (r.changed) {
    next.receiverId = r.next as string;
    changed = true;
  }

  return { entry: next, changed };
}

export function rewriteAcc8sEntryForDuplicateMerge(
  entry: Acc8sEntry,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { entry: Acc8sEntry; changed: boolean } {
  const next = { ...entry } as Acc8sEntry;
  let changed = false;
  if (Array.isArray(next.passingPlayerIds) && next.passingPlayerIds.length > 0) {
    const rw = rewritePlayerIdList(next.passingPlayerIds as unknown[], duplicateIds, mainPlayerId);
    if (rw.changed) {
      next.passingPlayerIds = (rw.next ?? []) as string[];
      changed = true;
    }
  }
  return { entry: next, changed };
}

export function rewritePlayerMinutesForDuplicateMerge(
  row: PlayerMinutes,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { row: PlayerMinutes; changed: boolean } {
  const k = normalizeFirestorePlayerId(row.playerId);
  if (!k || !duplicateIds.has(k)) {
    return { row, changed: false };
  }
  return { row: { ...row, playerId: mainPlayerId }, changed: true };
}

export function rewritePlayerMatchStatsForDuplicateMerge(
  row: PlayerMatchStats,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { row: PlayerMatchStats; changed: boolean } {
  const k = normalizeFirestorePlayerId(row.playerId);
  if (!k || !duplicateIds.has(k)) {
    return { row, changed: false };
  }
  return { row: { ...row, playerId: mainPlayerId }, changed: true };
}

export function rewriteGpsDataEntryForDuplicateMerge(
  entry: GPSDataEntry,
  duplicateIds: Set<string>,
  mainPlayerId: string,
): { entry: GPSDataEntry; changed: boolean } {
  const { playerName, ...rest } = entry as GPSDataEntry & { playerName?: string };
  let changed = !!playerName;
  const next = { ...rest } as GPSDataEntry;
  const gk = normalizeFirestorePlayerId(next.playerId);
  if (gk && duplicateIds.has(gk)) {
    next.playerId = mainPlayerId;
    changed = true;
  }
  return { entry: next, changed };
}

/**
 * Pola dokumentu matches/{id} do zapisu w updateDoc — tylko te, które faktycznie się zmieniły.
 */
export function buildMatchDocumentUpdatesForDuplicateMerge(
  matchData: Record<string, unknown>,
  duplicatePlayerIds: string[],
  mainPlayerId: string,
): { updates: Record<string, unknown>; changed: boolean } {
  const dup = normalizedDuplicateIdSet(duplicatePlayerIds);
  const mainNorm = normalizedMainId(mainPlayerId);
  const updates: Record<string, unknown> = {};
  let changed = false;

  for (const field of MATCH_ACTION_ARRAY_KEYS) {
    const arr = matchData[field];
    if (!Array.isArray(arr)) continue;
    let fieldChanged = false;
    const nextArr = arr.map((raw: Action) => {
      const { action, changed: ac } = rewriteActionForDuplicateMerge(raw, dup, mainNorm);
      if (ac) fieldChanged = true;
      return action;
    });
    if (fieldChanged) {
      updates[field] = nextArr;
      changed = true;
    }
  }

  const shots = matchData.shots;
  if (Array.isArray(shots)) {
    let fieldChanged = false;
    const nextArr = shots.map((raw: Shot) => {
      const { shot, changed: sc } = rewriteShotForDuplicateMerge(raw, dup, mainNorm);
      if (sc) fieldChanged = true;
      return shot;
    });
    if (fieldChanged) {
      updates.shots = nextArr;
      changed = true;
    }
  }

  const pkEntries = matchData.pkEntries;
  if (Array.isArray(pkEntries)) {
    let fieldChanged = false;
    const nextArr = pkEntries.map((raw: PKEntry) => {
      const { entry, changed: ec } = rewritePKEntryForDuplicateMerge(raw, dup, mainNorm);
      if (ec) fieldChanged = true;
      return entry;
    });
    if (fieldChanged) {
      updates.pkEntries = nextArr;
      changed = true;
    }
  }

  const acc8s = matchData.acc8sEntries;
  if (Array.isArray(acc8s)) {
    let fieldChanged = false;
    const nextArr = acc8s.map((raw: Acc8sEntry) => {
      const { entry, changed: ec } = rewriteAcc8sEntryForDuplicateMerge(raw, dup, mainNorm);
      if (ec) fieldChanged = true;
      return entry;
    });
    if (fieldChanged) {
      updates.acc8sEntries = nextArr;
      changed = true;
    }
  }

  const pm = matchData.playerMinutes;
  if (Array.isArray(pm)) {
    let fieldChanged = false;
    const nextArr = pm.map((raw: PlayerMinutes) => {
      const { row, changed: rc } = rewritePlayerMinutesForDuplicateMerge(raw, dup, mainNorm);
      if (rc) fieldChanged = true;
      return row;
    });
    if (fieldChanged) {
      updates.playerMinutes = nextArr;
      changed = true;
    }
  }

  const gpsData = matchData.gpsData;
  if (Array.isArray(gpsData)) {
    let fieldChanged = false;
    const nextArr = gpsData.map((raw: GPSDataEntry) => {
      const { entry, changed: gc } = rewriteGpsDataEntryForDuplicateMerge(raw, dup, mainNorm);
      if (gc) fieldChanged = true;
      return entry;
    });
    if (fieldChanged) {
      updates.gpsData = nextArr;
      changed = true;
    }
  }

  const nested = matchData.matchData as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object" && Array.isArray(nested.playerStats)) {
    let fieldChanged = false;
    const nextStats = (nested.playerStats as PlayerMatchStats[]).map((raw) => {
      const { row, changed: rc } = rewritePlayerMatchStatsForDuplicateMerge(raw, dup, mainNorm);
      if (rc) fieldChanged = true;
      return row;
    });
    if (fieldChanged) {
      updates.matchData = { ...nested, playerStats: nextStats };
      changed = true;
    }
  }

  return { updates, changed };
}

/** Jedna operacja scalenia duplikatów w dokumencie meczu (subset kart do main). */
export type DuplicateMergeMatchOperation = {
  duplicatePlayerIds: string[];
  mainPlayerId: string;
};

/**
 * Stosuje wiele grup duplikatów do jednego dokumentu meczu po kolei (ten sam mecz, wiele par main/dup).
 * Używane przy masowym sparowaniu — jeden odczyt meczu, jeden zapis zamiast N× getDocs(matches).
 */
export function buildMatchDocumentUpdatesForDuplicateMergeMany(
  matchData: Record<string, unknown>,
  operations: DuplicateMergeMatchOperation[],
): { updates: Record<string, unknown>; changed: boolean } {
  if (!operations.length) {
    return { updates: {}, changed: false };
  }
  let working: Record<string, unknown> = { ...matchData };
  const accumulated: Record<string, unknown> = {};
  let changed = false;
  for (const op of operations) {
    if (!op.duplicatePlayerIds.length) continue;
    const { updates, changed: c } = buildMatchDocumentUpdatesForDuplicateMerge(
      working,
      op.duplicatePlayerIds,
      op.mainPlayerId,
    );
    if (c) {
      changed = true;
      Object.assign(accumulated, updates);
      working = { ...working, ...updates };
    }
  }
  return { updates: accumulated, changed };
}
