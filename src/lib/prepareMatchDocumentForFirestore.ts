/**
 * Dokument matches/ musi przejść firestore.rules (hasForbiddenPIIKeys, team vs allowedTeams).
 * Usuwamy przypadkowe klucze PII z poziomu głównego i ustawiamy teamId = team (reguły sprawdzają oba).
 */

import type { TeamInfo } from "@/types";

const FORBIDDEN_ROOT_KEYS = [
  "firstName",
  "lastName",
  "name",
  "birthYear",
  "number",
  "playerName",
  "senderName",
  "receiverName",
  "assistantName",
  "senderNumber",
  "receiverNumber",
] as const;

function removeUndefinedDeep(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep).filter((x) => x !== undefined);
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    Object.keys(obj as object).forEach((k) => {
      const v = (obj as Record<string, unknown>)[k];
      if (v !== undefined) cleaned[k] = removeUndefinedDeep(v);
    });
    return cleaned;
  }
  return obj;
}

/**
 * Obiekt gotowy do setDoc(matches/{id}, data) — bez undefined, bez zakazanych kluczy, team + teamId spójne.
 */
export function prepareMatchDocumentForFirestore(match: TeamInfo): Record<string, unknown> {
  const cleaned = removeUndefinedDeep({ ...match }) as Record<string, unknown>;
  for (const k of FORBIDDEN_ROOT_KEYS) {
    delete cleaned[k];
  }
   let team = typeof cleaned.team === "string" ? cleaned.team.trim() : "";
  if (!team && typeof cleaned.teamId === "string") {
    team = cleaned.teamId.trim();
  }
  if (!team && Array.isArray(cleaned.teams) && cleaned.teams.length === 1) {
    const only = cleaned.teams[0];
    if (typeof only === "string") team = only.trim();
  }
  if (team) {
    cleaned.team = team;
    cleaned.teamId = team;
  }
  return cleaned;
}
