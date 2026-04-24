/**
 * Łączenie tablic z dokumentu meczu po polu `id`.
 * Przy synchronizacji offline→online: wpisy z `preferred` nadpisują te same id z serwera,
 * wpisy tylko z serwera (np. dopisane przez innego analityka) są zachowane.
 */
export function mergeByIdPreferPending<T extends { id?: string }>(server: T[], preferred: T[]): T[] {
  // Pusta tablica „preferred” nie oznacza „wyczyść pole na serwerze” (to kasowało całą historię
  // przy uszkodzonym pending []). Traktujemy jako brak nakładki — zostaw stan serwera.
  if (preferred.length === 0) {
    return [...server];
  }
  const map = new Map<string, T>();
  const serverWithoutId: T[] = [];
  const preferredWithoutId: T[] = [];

  for (const s of server) {
    if (s.id) {
      map.set(s.id, s);
    } else {
      serverWithoutId.push(s);
    }
  }
  for (const p of preferred) {
    if (p.id) {
      map.set(p.id, p);
    } else {
      preferredWithoutId.push(p);
    }
  }
  // Wpisy bez id nie wchodzą do mapy — dokładamy na końcu, żeby nie ginęły przy syncu.
  return [...Array.from(map.values()), ...serverWithoutId, ...preferredWithoutId];
}
