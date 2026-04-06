/**
 * Kategoria akcji na podstawie kształtu obiektu (spójnie z ActionsTable / page.tsx).
 */
import type { Action } from "@/types";

export function getActionCategory(action: Action): "packing" | "regain" | "loses" {
  if (
    action.isReaction5s !== undefined ||
    action.isAut !== undefined ||
    action.isBadReaction5s !== undefined ||
    (action as Action & { isPMArea?: boolean }).isPMArea !== undefined ||
    action.losesAttackZone !== undefined ||
    action.losesDefenseZone !== undefined ||
    action.losesAttackXT !== undefined ||
    action.losesDefenseXT !== undefined
  ) {
    return "loses";
  }
  if (
    action.regainAttackZone !== undefined ||
    action.regainDefenseZone !== undefined ||
    action.regainAttackXT !== undefined ||
    action.regainDefenseXT !== undefined ||
    action.playersBehindBall !== undefined ||
    action.opponentsBehindBall !== undefined ||
    action.totalPlayersOnField !== undefined ||
    action.totalOpponentsOnField !== undefined ||
    action.playersLeftField !== undefined ||
    action.opponentsLeftField !== undefined
  ) {
    return "regain";
  }
  return "packing";
}
