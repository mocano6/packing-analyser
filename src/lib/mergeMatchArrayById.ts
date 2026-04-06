/**
 * Łączenie tablic z dokumentu meczu po polu `id`.
 * Przy synchronizacji offline→online: wpisy z `preferred` nadpisują te same id z serwera,
 * wpisy tylko z serwera (np. dopisane przez innego analityka) są zachowane.
 */
export function mergeByIdPreferPending<T extends { id?: string }>(server: T[], preferred: T[]): T[] {
  if (preferred.length === 0) {
    return [];
  }
  const map = new Map<string, T>();
  for (const s of server) {
    if (s.id) {
      map.set(s.id, s);
    }
  }
  for (const p of preferred) {
    if (p.id) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values());
}
