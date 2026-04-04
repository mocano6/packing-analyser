import type { Player } from "@/types";

/**
 * Dla actions_loses / actions_regain zapis często ma teamId = match.team (właściciel dokumentu),
 * a nie drużyny której dotyczy zdarzenie — wtedy filtr po teamId zwraca straty obu stron naraz.
 * Ograniczamy do akcji, gdzie senderId to zawodnik z kadry analizowanego klubu (teams[]).
 */
export function filterActionsByAnalyzedTeamSquad<T extends { senderId?: string }>(
  actions: T[],
  selectedTeam: string | null | undefined,
  players: Pick<Player, "id" | "teams" | "isDeleted">[],
): T[] {
  if (!selectedTeam) return actions;
  if (players.length === 0) return [];

  const squadIds = new Set<string>();
  for (const p of players) {
    if (p.isDeleted) continue;
    if (p.teams?.includes(selectedTeam)) squadIds.add(p.id);
  }
  if (squadIds.size === 0) return [];

  return actions.filter((a) => Boolean(a.senderId) && squadIds.has(a.senderId as string));
}
