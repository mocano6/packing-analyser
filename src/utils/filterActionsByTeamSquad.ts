import type { Player } from "@/types";

export type FilterActionsByTeamSquadOptions = {
  /**
   * Zawodnicy z protokołu meczu (playerMinutes / startingLineup).
   * Pozwala zachować akcje graczy, którzy już nie są w teams[] wybranego klubu
   * (transfer / kolejny sezon), ale grali w analizowanym meczu.
   */
  matchParticipantIds?: Iterable<string>;
};

/**
 * Dla actions_loses / actions_regain zapis często ma teamId = match.team (właściciel dokumentu),
 * a nie drużyny której dotyczy zdarzenie — wtedy filtr po teamId zwraca straty obu stron naraz.
 * Ograniczamy do akcji, gdzie senderId to:
 * - zawodnik z aktualnej kadry analizowanego klubu (teams[]), LUB
 * - uczestnik analizowanych meczów (matchParticipantIds) — historyczny skład.
 */
export function filterActionsByAnalyzedTeamSquad<T extends { senderId?: string }>(
  actions: T[],
  selectedTeam: string | null | undefined,
  players: Pick<Player, "id" | "teams" | "isDeleted">[],
  options?: FilterActionsByTeamSquadOptions,
): T[] {
  if (!selectedTeam) return actions;

  const squadIds = new Set<string>();
  for (const p of players) {
    if (p.isDeleted) continue;
    if (p.teams?.includes(selectedTeam)) squadIds.add(p.id);
  }
  if (options?.matchParticipantIds) {
    for (const id of options.matchParticipantIds) {
      if (typeof id === "string" && id.length > 0) squadIds.add(id);
    }
  }

  // Brak kadry i brak protokołu meczu — nie zgadujemy (unikamy mieszania stron).
  if (squadIds.size === 0) return [];

  return actions.filter((a) => Boolean(a.senderId) && squadIds.has(a.senderId as string));
}
