/**
 * Filtruje akcje meczowe (regain/loses itd.) do wybranego klubu.
 * Gdy brak dopasowania po teamId, zwraca pustą tablicę — nigdy nie zwraca
 * wszystkich akcji meczu (to dublowało straty/przechwyty dwóch drużyn).
 */
export function filterMatchActionsBySelectedTeam<T extends { teamId?: string }>(
  actions: T[],
  selectedTeam: string | null | undefined,
): T[] {
  if (!selectedTeam) return actions;
  const withTeamId = actions.filter((a) => typeof a.teamId === "string" && a.teamId.length > 0);
  const exact = withTeamId.filter((a) => a.teamId === selectedTeam);
  if (exact.length > 0) return exact;

  // Legacy: brak teamId w danych — oddajemy całość do dalszego, bardziej precyzyjnego filtra.
  const withoutTeamId = actions.filter((a) => !a.teamId);
  if (withTeamId.length === 0) return withoutTeamId;

  // Mamy teamId, ale nic nie pasuje do selectedTeam: nie mieszaj danych przeciwnika.
  return [];
}
