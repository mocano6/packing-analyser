import type { Action } from "@/types";
import { getActionCategory } from "../utils/actionCategory";

/**
 * Przy zapisie (np. edycja w analizatorze) — ujednolicenie do `regainOppRosterSquadTallyF1` / `losesOppRosterSquadTallyF1`
 * i wyczyszczenie przestarzałych pól, żeby Firestore dostał nowy kształt dokumentu.
 */
export function applyOppRosterTallyF1WriteShape(action: Action): Action {
  const cat = getActionCategory(action);
  if (cat === "regain") {
    const hasExplicitSingle =
      action.regainOppRosterSquadTallyF1 != null ||
      action.receptionBackAllyCount != null ||
      action.receptionAllyCountBehindBall != null;
    if (!hasExplicitSingle) return action;
    const n =
      action.regainOppRosterSquadTallyF1 ??
      action.receptionBackAllyCount ??
      action.receptionAllyCountBehindBall;
    if (n == null) return action;
    return {
      ...action,
      regainOppRosterSquadTallyF1: n,
      receptionBackAllyCount: undefined,
      receptionAllyCountBehindBall: undefined,
    };
  }
  if (cat === "loses") {
    const hasExplicit =
      action.losesOppRosterSquadTallyF1 != null || action.losesBackAllyCount != null;
    if (!hasExplicit) return action;
    const n = action.losesOppRosterSquadTallyF1 ?? action.losesBackAllyCount;
    if (n == null) return action;
    return {
      ...action,
      losesOppRosterSquadTallyF1: n,
      losesBackAllyCount: undefined,
      playersBehindBall: undefined,
      opponentsBehindBall: undefined,
    };
  }
  return action;
}

/**
 * Uzupełnia playersLeftField / opponentsLeftField z totalPlayersOnField / totalOpponentsOnField,
 * gdy w rekordzie (np. ze starszego zapisu) brakuje jawnych liczników opuścił boisko.
 */
export function normalizeActionFieldCountsForSave(action: Action): Action {
  let pl = action.playersLeftField;
  if (pl === undefined && action.totalPlayersOnField !== undefined) {
    pl = 11 - action.totalPlayersOnField;
  }
  let ol = action.opponentsLeftField;
  if (ol === undefined && action.totalOpponentsOnField !== undefined) {
    ol = 11 - action.totalOpponentsOnField;
  }
  const withLeftFields = {
    ...action,
    ...(pl !== undefined ? { playersLeftField: pl, totalPlayersOnField: 11 - pl } : {}),
    ...(ol !== undefined ? { opponentsLeftField: ol, totalOpponentsOnField: 11 - ol } : {}),
  } as Action;
  return applyOppRosterTallyF1WriteShape(withLeftFields);
}
