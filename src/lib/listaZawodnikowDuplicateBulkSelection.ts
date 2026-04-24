/**
 * Pomocnicze do zaznaczania i walidacji hurtowego usuwania w sekcji duplikatów (lista-zawodnikow).
 */

export type DuplicateBulkPlayerRef = { id: string; isDeleted?: boolean };

/** Zwraca unikalne ID z listy kandydujących, które są w grupie i nie są usunięte. */
export function filterActiveDuplicateIdsForBulkDelete(
  candidateIds: readonly string[],
  groupPlayers: readonly DuplicateBulkPlayerRef[],
): string[] {
  const allowed = new Set(
    groupPlayers.filter((p) => !p.isDeleted).map((p) => p.id),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of candidateIds) {
    if (!id || seen.has(id)) continue;
    if (!allowed.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Usuwa z tablicy zaznaczeń ID, które już nie są aktywne w grupie (np. po operacji na innej karcie). */
export function pruneDuplicateGroupBulkSelection(
  selectedIds: readonly string[],
  groupPlayers: readonly DuplicateBulkPlayerRef[],
): string[] {
  return filterActiveDuplicateIdsForBulkDelete(selectedIds, groupPlayers);
}
