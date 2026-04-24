/**
 * Dostęp do listy zespołów w UI (zgodnie z useAuth: isAdmin albo users/{uid}.allowedTeams).
 * Admin widzi pełny katalog; pozostali tylko wpisy, których id jest w allowedTeamIds.
 */
export type UserTeamAccess = { isAdmin: boolean; allowedTeamIds: string[] };

export function filterTeamsByUserAccess<T extends { id: string }>(
  teams: T[],
  access: UserTeamAccess
): T[] {
  if (access.isAdmin) {
    return teams.slice();
  }
  const allowed = new Set(
    (access.allowedTeamIds || []).filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  if (allowed.size === 0) {
    return [];
  }
  return teams.filter((t) => allowed.has(t.id));
}

/**
 * Czy użytkownik może wybrać dany zespół (pojedyncze id) — do walidacji onChange.
 */
export function isTeamIdAccessibleForUser(teamId: string, access: UserTeamAccess): boolean {
  if (access.isAdmin) return true;
  return (access.allowedTeamIds || []).includes(teamId);
}
