/**
 * Czyste funkcje modyfikujące tablice w dokumencie meczu — ta sama logika co w analyzer / commitach.
 * Testowalne bez Firebase; trzymać w sync z handleSaveEditedAction i modalami weryfikacji.
 */

import type { Acc8sEntry, Action, PKEntry, Shot, TeamInfo } from "../types";
import type { MatchArrayFieldKey } from "./matchArrayFieldWrite";

/** Przeniesienie akcji packing ↔ unpacking w jednym dokumencie (commitTwo). */
export function buildMovePackingUnpackingNext(
  data: TeamInfo,
  originalField: MatchArrayFieldKey,
  targetField: MatchArrayFieldKey,
  actionId: string,
  movedAction: Action
): { nextA: Action[]; nextB: Action[] } {
  const orig = (data[originalField as keyof TeamInfo] as Action[] | undefined) || [];
  const dest = (data[targetField as keyof TeamInfo] as Action[] | undefined) || [];
  return {
    nextA: orig.filter((a) => a.id !== actionId),
    nextB: [...dest, movedAction],
  };
}

/** Atomowe przeniesienie akcji między dwoma dokumentami meczu. */
export function buildCrossMatchMoveNext(
  sourceRows: Action[],
  targetRows: Action[],
  actionId: string,
  movedAction: Action
): { nextSource: Action[]; nextTarget: Action[] } {
  return {
    nextSource: sourceRows.filter((a) => a.id !== actionId),
    nextTarget: [...targetRows, movedAction],
  };
}

/** Edycja akcji w miejscu (commit pojedynczego pola). */
export function replaceActionByIdInArray(
  current: Action[],
  actionId: string,
  nextAction: Action
): Action[] {
  const idx = current.findIndex((a) => a.id === actionId);
  if (idx === -1) return current;
  const copy = [...current];
  copy[idx] = nextAction;
  return copy;
}

export type PkRegainPendingUpdate = {
  entryKey: string;
  isRegain: boolean;
  isShot?: boolean;
  isGoal?: boolean;
};

/** Modal weryfikacji PK — Zatwierdź zmiany (regain / strzał / gol). */
export function applyPkRegainBulkUpdate(
  current: PKEntry[],
  pendingUpdates: PkRegainPendingUpdate[],
  selectedKeys: Set<string>,
  getKey: (e: PKEntry) => string
): PKEntry[] {
  const updateByKey = new Map(pendingUpdates.map((u) => [u.entryKey, u] as const));
  return current.map((entry) => {
    const entryKey = getKey(entry);
    const update = updateByKey.get(entryKey);
    if (update && selectedKeys.has(entryKey)) {
      return {
        ...entry,
        isRegain: update.isRegain,
        isShot: update.isShot !== undefined ? update.isShot : entry.isShot,
        isGoal: update.isGoal !== undefined ? update.isGoal : entry.isGoal,
      };
    }
    return entry;
  });
}

export type ShotActionTypePendingUpdate = {
  shotKey: string;
  actionType: Shot["actionType"];
};

/** Modal weryfikacji strzałów — actionType (xG / kontekst tabel). */
export function applyShotsActionTypeBulkUpdate(
  current: Shot[],
  pendingUpdates: ShotActionTypePendingUpdate[],
  selectedKeys: Set<string>,
  getKey: (s: Shot) => string
): Shot[] {
  const updateByKey = new Map(pendingUpdates.map((u) => [u.shotKey, u] as const));
  return current.map((shot) => {
    const shotKey = getKey(shot);
    const update = updateByKey.get(shotKey);
    if (update && selectedKeys.has(shotKey)) {
      return { ...shot, actionType: update.actionType };
    }
    return shot;
  });
}

/** Zbiorcza aktualizacja flag 8s ACC (jak bulkUpdateAcc8sEntries). */
export function applyAcc8sBulkFlagsUpdate(
  current: Acc8sEntry[],
  updates: Array<{ id: string; isShotUnder8s: boolean; isPKEntryUnder8s: boolean }>
): Acc8sEntry[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  return current.map((entry) => {
    const u = byId.get(entry.id);
    if (!u) return entry;
    return { ...entry, isShotUnder8s: u.isShotUnder8s, isPKEntryUnder8s: u.isPKEntryUnder8s };
  });
}

/** Dopisanie nowej akcji (jak updater w usePackingActions po oczyszczeniu listy). */
export function appendActionToArray(current: Action[], newAction: Action): Action[] {
  return [...current, newAction];
}

/** Usunięcie po id (jak delete w usePackingActions). */
export function removeActionById(current: Action[], actionId: string): Action[] {
  return current.filter((a) => a.id !== actionId);
}
