/**
 * Zamienia pole team/opponent z dokumentu meczu na etykietę do UI:
 * jeśli wartość to ID dokumentu teams/, użyj nazwy z namesMap.
 */
export function resolveTeamFieldForMatchLabel(
  raw: unknown,
  namesMap: Record<string, string>,
  fallback: string,
): string {
  if (typeof raw !== 'string') return fallback;
  const t = raw.trim();
  if (!t) return fallback;
  return namesMap[t] ?? t;
}
