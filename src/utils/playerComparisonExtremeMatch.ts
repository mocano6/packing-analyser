import type { TeamInfo } from "@/types";
import {
  getOpponentGoalsForMatch,
  getOpponentXGForMatch,
  getTeamGoalsForMatch,
  getTeamXgForMatch,
} from "./trendyKpis";

/** Wygrana co najmniej trzema bramkami (różnica goli ≥ 3). */
export const PLAYER_COMPARISON_EXTREME_GOAL_MARGIN = 3;

/** Przewaga xG „więcej niż dwa” — ścisłe > 2. */
export const PLAYER_COMPARISON_EXTREME_XG_MARGIN = 2;

/** Co najmniej 8 wejść w PK więcej niż przeciwnik. */
export const PLAYER_COMPARISON_EXTREME_PK_MARGIN = 8;

/** Mecz uznajemy za „skrajnie dominujący” przy ≥ 2 spełnionych sygnałach z trzech. */
export const PLAYER_COMPARISON_EXTREME_MIN_SIGNALS = 2;

function teamPkCount(match: TeamInfo): number {
  return (match.pkEntries ?? []).filter((e) => (e.teamContext ?? "attack") === "attack").length;
}

function opponentPkCount(match: TeamInfo): number {
  return (match.pkEntries ?? []).filter((e) => (e.teamContext ?? "attack") === "defense").length;
}

/**
 * Liczy spełnione kryteria dominacji (perspektywa `match.team`): gole, xG, wejścia PK.
 * Bazuje na tych samych podziałach co trendy KPI (`teamContext` attack/defense).
 */
export function countPlayerComparisonExtremeDominationSignals(match: TeamInfo): number {
  const gDiff = getTeamGoalsForMatch(match) - getOpponentGoalsForMatch(match);
  const xgDiff = getTeamXgForMatch(match) - getOpponentXGForMatch(match);
  const pkDiff = teamPkCount(match) - opponentPkCount(match);

  let n = 0;
  if (gDiff >= PLAYER_COMPARISON_EXTREME_GOAL_MARGIN) n++;
  if (xgDiff > PLAYER_COMPARISON_EXTREME_XG_MARGIN) n++;
  if (pkDiff >= PLAYER_COMPARISON_EXTREME_PK_MARGIN) n++;
  return n;
}

/** Mecz do wykluczenia z rankingu, gdy ≥ 2 z 3 progów dominacji są spełnione. */
export function isPlayerComparisonExtremeDominationMatch(match: TeamInfo): boolean {
  return countPlayerComparisonExtremeDominationSignals(match) >= PLAYER_COMPARISON_EXTREME_MIN_SIGNALS;
}

export function filterPlayerComparisonMatchesExcludingExtreme(matches: TeamInfo[]): TeamInfo[] {
  return matches.filter((m) => !isPlayerComparisonExtremeDominationMatch(m));
}
