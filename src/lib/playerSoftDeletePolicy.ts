import { normalizePlayerTeamIdsFromFirestoreDoc } from "../utils/playerUtils";

/** allowedTeams z users — tablica lub pojedynczy string (legacy, zgodnie z regułami Firestore). */
export function normalizeAllowedTeamsForApi(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return [];
}

/** Czy zawodnik (teams / team / teamId) przecina listę dozwolonych zespołów trenera. */
export function playerDocTeamsOverlapAllowed(
  playerData: Record<string, unknown>,
  allowedTeams: string[],
): boolean {
  if (allowedTeams.length === 0) return false;
  const ids = normalizePlayerTeamIdsFromFirestoreDoc(playerData);
  return ids.some((id) => allowedTeams.includes(id));
}
