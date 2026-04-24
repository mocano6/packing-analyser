import { normalizePlayerTeamIdsFromFirestoreDoc } from "../utils/playerUtils";

/** Wartość pola teams z payloadu zapisu (tablica lub string). */
export function normalizeTeamsFieldOnly(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

/**
 * Trener może zaktualizować zawodnika, jeśli miał dostęp do starego stanu (przecięcie zespołów)
 * i nowa lista zespołów (jeśli jest w payloadzie) zawiera wyłącznie zespoły z allowedTeams.
 */
export function staffAllowedToUpdatePlayer(
  oldData: Record<string, unknown>,
  updatePayload: Record<string, unknown>,
  allowedTeams: string[],
): boolean {
  if (allowedTeams.length === 0) return false;
  const oldIds = normalizePlayerTeamIdsFromFirestoreDoc(oldData);
  const hadAccess = oldIds.some((id) => allowedTeams.includes(id));
  if (!hadAccess) return false;

  if (!("teams" in updatePayload) || updatePayload.teams === undefined) {
    return true;
  }

  const newIds = normalizeTeamsFieldOnly(updatePayload.teams);
  return newIds.every((id) => allowedTeams.includes(id));
}

/** Tworzenie zawodnika — trener może tylko gdy przypisuje wyłącznie do swoich zespołów. */
export function staffAllowedToCreatePlayer(
  createPayload: Record<string, unknown>,
  allowedTeams: string[],
): boolean {
  if (allowedTeams.length === 0) return false;
  const newIds = normalizeTeamsFieldOnly(createPayload.teams);
  if (newIds.length === 0) return false;
  return newIds.every((id) => allowedTeams.includes(id));
}
