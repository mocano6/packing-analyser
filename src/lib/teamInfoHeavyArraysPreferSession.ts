import type { TeamInfo } from "@/types";

/** Jeśli primary ma elementy — użyj go; w przeciwnym razie secondary (np. cache sesji). */
export function preferNonEmptyArray<T>(primary: T[] | undefined, secondary: T[] | undefined): T[] {
  const a = primary ?? [];
  if (a.length > 0) return a;
  return secondary ?? [];
}

/**
 * Lista meczów / meta często ma „compact” puste tablice. Przy fallbackzie ładowania nie kasuj
 * danych już w sessionStorage (packing, PK, xG, regain — ten sam wzorzec co useShots/usePKEntries).
 */
export function mergeTeamInfoMetaWithSessionCache(
  meta: TeamInfo,
  session: TeamInfo | null | undefined,
): TeamInfo {
  if (!session) {
    return {
      ...meta,
      actions_packing: meta.actions_packing ?? [],
      actions_unpacking: meta.actions_unpacking ?? [],
      actions_regain: meta.actions_regain ?? [],
      actions_loses: meta.actions_loses ?? [],
      shots: meta.shots ?? [],
      pkEntries: meta.pkEntries ?? [],
      acc8sEntries: meta.acc8sEntries ?? [],
      playerMinutes: meta.playerMinutes ?? [],
      gpsData: meta.gpsData ?? [],
    };
  }

  return {
    ...meta,
    actions_packing: preferNonEmptyArray(meta.actions_packing, session.actions_packing),
    actions_unpacking: preferNonEmptyArray(meta.actions_unpacking, session.actions_unpacking),
    actions_regain: preferNonEmptyArray(meta.actions_regain, session.actions_regain),
    actions_loses: preferNonEmptyArray(meta.actions_loses, session.actions_loses),
    shots: preferNonEmptyArray(meta.shots, session.shots),
    pkEntries: preferNonEmptyArray(meta.pkEntries, session.pkEntries),
    acc8sEntries: preferNonEmptyArray(meta.acc8sEntries, session.acc8sEntries),
    playerMinutes: preferNonEmptyArray(meta.playerMinutes, session.playerMinutes),
    gpsData: preferNonEmptyArray(meta.gpsData, session.gpsData),
    matchData: meta.matchData ?? session.matchData,
  };
}
