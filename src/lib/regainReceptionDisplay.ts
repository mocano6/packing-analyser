import type { Action } from "@/types";

/**
 * Wyłącznie liczba przeciwników za piłką (0–10).
 * Kolejność: `regainOppRosterSquadTallyF1` → `receptionBackAllyCount` (legacy) → `receptionAllyCountBehindBall` → wzór z total − playersBefore.
 */
export function getReceptionBackAllyCountForDisplay(action: Action): number {
  if (action.regainOppRosterSquadTallyF1 != null) {
    return action.regainOppRosterSquadTallyF1;
  }
  if (action.receptionBackAllyCount != null) {
    return action.receptionBackAllyCount;
  }
  if (action.receptionAllyCountBehindBall != null) {
    return action.receptionAllyCountBehindBall;
  }
  const total = action.totalPlayersOnField ?? 11;
  const partnersBefore = action.playersBehindBall ?? 0;
  return Math.max(0, total - partnersBefore);
}

/** Czy akcja regain ma zapisany snapshot „tylko za piłką” (nowy lub pośredni format) — wtedy w tabeli pierwsza kolumna to „—”. */
export function isRegainReceptionBackCountModel(action: Action): boolean {
  return (
    action.regainOppRosterSquadTallyF1 !== undefined ||
    action.receptionBackAllyCount !== undefined ||
    action.receptionAllyCountBehindBall !== undefined
  );
}
