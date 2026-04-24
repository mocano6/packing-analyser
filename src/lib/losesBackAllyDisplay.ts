import type { Action } from "@/types";

/**
 * Wyłącznie liczba przeciwników za piłką w momencie straty (0–10).
 * Kolejność: `losesOppRosterSquadTallyF1` → `losesBackAllyCount` (legacy) → wzór z total − playersBefore.
 */
export function getLosesBackAllyCountForDisplay(action: Action): number {
  if (action.losesOppRosterSquadTallyF1 != null) {
    return action.losesOppRosterSquadTallyF1;
  }
  if (action.losesBackAllyCount != null) {
    return action.losesBackAllyCount;
  }
  const total = action.totalPlayersOnField ?? 11;
  const partnersBefore = action.playersBehindBall ?? 0;
  return Math.max(0, total - partnersBefore);
}

/** Czy akcja loses ma zapisany snapshot „tylko za piłką” (nowy format) — wtedy w tabeli pierwsza kolumna to „—”. */
export function isLosesBackAllyCountModel(action: Action): boolean {
  return action.losesOppRosterSquadTallyF1 !== undefined || action.losesBackAllyCount !== undefined;
}
