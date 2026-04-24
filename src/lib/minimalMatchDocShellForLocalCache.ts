import type { TeamInfo } from "@/types";

/** Minimalny dokument meczu pod zapis w sessionStorage, gdy brak pełnego getDoc. */
export function minimalMatchDocShellForLocalCache(matchId: string): TeamInfo {
  return {
    matchId,
    team: "",
    opponent: "",
    isHome: true,
    competition: "",
    date: "",
    actions_packing: [],
    actions_unpacking: [],
    actions_regain: [],
    actions_loses: [],
    shots: [],
    pkEntries: [],
    acc8sEntries: [],
  };
}
