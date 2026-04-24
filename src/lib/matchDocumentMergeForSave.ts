/**
 * Bezpieczne scalanie zapisu dokumentu matches/{id} — unika nadpisania
 * pełnych tablic pustymi [] ze „zcompactowanego” cache lub niepełnego stanu UI.
 */

import type { TeamInfo } from "@/types";

/** Pola tablicowe w dokumencie meczu — puste [] z klienta nie powinny kasować danych z serwera przy zapisie metadanych. */
export const MATCH_DOC_HEAVY_ARRAY_KEYS = [
  "actions_packing",
  "actions_unpacking",
  "actions_regain",
  "actions_loses",
  "shots",
  "pkEntries",
  "acc8sEntries",
  "playerMinutes",
  "gpsData",
] as const;

/**
 * Przy setDoc(..., { merge: true }): usuń z payloadu klucze, gdzie klient ma pustą tablicę,
 * a serwer ma niepustą — wtedy merge nie nadpisze istniejących danych.
 */
export function stripEmptyHeavyArraysThatWouldWipeServer(
  payload: Record<string, unknown>,
  serverData: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!serverData) {
    return payload;
  }
  const out: Record<string, unknown> = { ...payload };
  for (const key of MATCH_DOC_HEAVY_ARRAY_KEYS) {
    const c = out[key];
    const s = serverData[key];
    if (Array.isArray(c) && c.length === 0 && Array.isArray(s) && s.length > 0) {
      delete out[key];
    }
  }
  return out;
}

function mergeNestedPartials(
  existing: Record<string, number | undefined> | undefined,
  incoming: Record<string, number | undefined> | undefined
): Record<string, number | undefined> | undefined {
  const merged = { ...(existing || {}), ...(incoming || {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Scala fragment matchData z modalu (częściowe zagnieżdżone obiekty) z istniejącym matchData z Firestore,
 * zachowując m.in. playerStats i agregaty 8s, których formularz nie edytuje.
 */
export function mergeMatchDataForFirestoreWrite(
  existing: TeamInfo["matchData"] | undefined,
  incoming: TeamInfo["matchData"] | undefined
): TeamInfo["matchData"] | undefined {
  if (!incoming && !existing) {
    return undefined;
  }
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }

  const e = existing;
  const i = incoming;

  return {
    ...e,
    ...i,
    possession: mergeNestedPartials(e.possession, i.possession) ?? e.possession ?? i.possession,
    passes: mergeNestedPartials(e.passes, i.passes) ?? e.passes ?? i.passes,
    passesInaccurate: mergeNestedPartials(e.passesInaccurate, i.passesInaccurate) ?? e.passesInaccurate ?? i.passesInaccurate,
    passesInOpponentHalf:
      mergeNestedPartials(e.passesInOpponentHalf, i.passesInOpponentHalf) ??
      e.passesInOpponentHalf ??
      i.passesInOpponentHalf,
    passesInOpponentHalfInaccurate:
      mergeNestedPartials(e.passesInOpponentHalfInaccurate, i.passesInOpponentHalfInaccurate) ??
      e.passesInOpponentHalfInaccurate ??
      i.passesInOpponentHalfInaccurate,
    successful8sActions:
      mergeNestedPartials(e.successful8sActions, i.successful8sActions) ??
      e.successful8sActions ??
      i.successful8sActions,
    unsuccessful8sActions:
      mergeNestedPartials(e.unsuccessful8sActions, i.unsuccessful8sActions) ??
      e.unsuccessful8sActions ??
      i.unsuccessful8sActions,
    playerStats: i.playerStats !== undefined ? i.playerStats : e.playerStats,
  };
}
