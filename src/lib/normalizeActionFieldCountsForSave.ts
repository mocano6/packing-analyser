import type { Action } from "@/types";

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
  return {
    ...action,
    ...(pl !== undefined ? { playersLeftField: pl, totalPlayersOnField: 11 - pl } : {}),
    ...(ol !== undefined ? { opponentsLeftField: ol, totalOpponentsOnField: 11 - ol } : {}),
  };
}
