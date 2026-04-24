/**
 * Logika zgodna z firestore.rules (matches write): admin poza tym modułem,
 * brak users/{uid} → zapis dozwolony przy niepustym team,
 * player + pusta allowedTeams → brak,
 * staff + pusta allowedTeams → dowolny niepusty team,
 * w przeciwnym razie team musi być w allowedTeams (lista lub pojedynczy string).
 */

function normalizeRole(r: unknown): string {
  return typeof r === "string" ? r.trim().toLowerCase() : "";
}

function allowedTeamsEffectivelyEmpty(userData: Record<string, unknown>): boolean {
  const a = userData.allowedTeams;
  if (a == null) return true;
  if (Array.isArray(a)) return a.length === 0;
  if (typeof a === "string") return a.trim().length === 0;
  return false;
}

function teamIdInAllowedTeams(teamId: string, userData: Record<string, unknown>): boolean {
  const tid = teamId.trim();
  if (!tid) return false;
  const a = userData.allowedTeams;
  if (Array.isArray(a)) {
    return a.includes(tid);
  }
  if (typeof a === "string") {
    const s = a.trim();
    if (!s.length) return false;
    return s === tid;
  }
  return false;
}

/**
 * @param userData — null gdy brak dokumentu users/{uid}
 */
export function canCallerSaveMatch(
  userData: Record<string, unknown> | null | undefined,
  teamRaw: string
): boolean {
  const team = String(teamRaw || "").trim();
  if (!team) return false;

  if (userData == null) return true;

  const role = normalizeRole(userData.role);
  const isPlayer = role === "player";
  const emptyAllowed = allowedTeamsEffectivelyEmpty(userData);

  if (emptyAllowed) {
    if (isPlayer) return false;
    return true;
  }

  return teamIdInAllowedTeams(team, userData);
}
