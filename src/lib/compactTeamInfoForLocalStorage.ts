import type { TeamInfo } from "@/types";

/**
 * Wersja na zapis do localStorage — bez ciężkich tablic (akcje, strzały, minuty, matchData).
 * Pełne dokumenty zostają w pamięci po fetchFromFirebase; na dysku tylko lista meczów (meta).
 */
export function compactTeamInfoForLocalStorage(m: TeamInfo): TeamInfo {
  return {
    ...m,
    actions_packing: [],
    actions_unpacking: [],
    actions_regain: [],
    actions_loses: [],
    shots: [],
    pkEntries: [],
    acc8sEntries: [],
    playerMinutes: [],
    matchData: undefined,
  };
}
