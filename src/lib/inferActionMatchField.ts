import type { Action } from "@/types";
import type { MatchArrayFieldKey } from "@/lib/matchArrayFieldWrite";

/** Tylko tablice akcji w dokumencie meczu (bez shots / pkEntries / acc8s). */
export type MatchDocumentActionFieldKey = Extract<
  MatchArrayFieldKey,
  "actions_packing" | "actions_unpacking" | "actions_regain" | "actions_loses"
>;

const ACTION_FIELD_LIST: MatchDocumentActionFieldKey[] = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
];

/**
 * Ta sama heurystyka co w usePackingActions (getActionCategory + mode).
 * Określa pole tablicy w dokumencie matches/{matchId} dla pojedynczej akcji.
 */
export function inferMatchArrayFieldForAction(action: Action): MatchDocumentActionFieldKey {
  if (
    action.isReaction5s !== undefined ||
    action.losesOppRosterSquadTallyF1 !== undefined ||
    action.losesBackAllyCount !== undefined
  ) {
    return "actions_loses";
  }
  if (
    action.regainOppRosterSquadTallyF1 !== undefined ||
    action.receptionBackAllyCount !== undefined ||
    action.receptionAllyCountBehindBall !== undefined ||
    action.playersBehindBall !== undefined ||
    action.opponentsBehindBall !== undefined ||
    action.totalPlayersOnField !== undefined ||
    action.totalOpponentsOnField !== undefined ||
    action.playersLeftField !== undefined ||
    action.opponentsLeftField !== undefined
  ) {
    return "actions_regain";
  }
  return action.mode === "defense" ? "actions_unpacking" : "actions_packing";
}

/** Rozdziela płaską listę akcji (np. stary eksport) na tablice zgodne z dokumentem meczu. */
export function splitActionsByMatchField(actions: Action[]): Record<MatchDocumentActionFieldKey, Action[]> {
  const out: Record<MatchDocumentActionFieldKey, Action[]> = {
    actions_packing: [],
    actions_unpacking: [],
    actions_regain: [],
    actions_loses: [],
  };
  for (const a of actions) {
    const field = inferMatchArrayFieldForAction(a);
    out[field].push(a);
  }
  return out;
}

export function emptyActionsByField(): Record<MatchDocumentActionFieldKey, Action[]> {
  return {
    actions_packing: [],
    actions_unpacking: [],
    actions_regain: [],
    actions_loses: [],
  };
}

/** Sczytuje actionsByField z eksportu lub dzieli pole `actions`. */
export function resolveImportedActionsByField(importedData: {
  actionsByField?: Partial<Record<MatchDocumentActionFieldKey, unknown>>;
  actions?: unknown;
}): Record<MatchDocumentActionFieldKey, Action[]> {
  const out = emptyActionsByField();
  if (importedData.actionsByField && typeof importedData.actionsByField === "object") {
    for (const k of ACTION_FIELD_LIST) {
      const arr = importedData.actionsByField[k];
      out[k] = Array.isArray(arr) ? (arr as Action[]) : [];
    }
    return out;
  }
  const list = Array.isArray(importedData.actions) ? (importedData.actions as Action[]) : [];
  return splitActionsByMatchField(list);
}
