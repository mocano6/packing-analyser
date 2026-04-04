/**
 * Normalizuje pole allowedTeams z dokumentu users/* (legacy / brak pola).
 */
export function normalizeAllowedTeams(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}
