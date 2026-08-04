import type { Player, TeamInfo } from "@/types";
import { getMatchSquadPlayerIds } from "@/utils/setPiecesStorage";

interface ModalPlayersFilterOptions {
  requirePlayerMinutes?: boolean;
}

/**
 * Lista zawodników do modali (PK, strzał, akcja itd.).
 * Gdy mamy pełne `playerMinutes` z meczu — zostawiamy tylko tych z realnym czasem gry.
 * Gdy `playerMinutes` jest puste lub niezaładowane (np. zapis cache do localStorage bez minut) —
 * pokazujemy cały skład `matchInfo.team`, żeby modal nie był pusty do momentu dociągnięcia z Firebase.
 * `requirePlayerMinutes` wyłącza ten fallback dla miejsc, gdzie lista musi być stricte meczowa.
 *
 * Zawodnicy z protokołu meczu są uwzględniani nawet gdy już nie mają `matchInfo.team` w teams[]
 * (transfer / kolejny sezon).
 */
export function getModalPlayersForMatch(
  players: Player[],
  matchInfo: TeamInfo | null | undefined,
  options: ModalPlayersFilterOptions = {}
): Player[] {
  if (!matchInfo) return players;

  const matchSquadIds = new Set(getMatchSquadPlayerIds(matchInfo));
  const teamOrMatchPlayers = players.filter(
    (p) => p.teams?.includes(matchInfo.team) || matchSquadIds.has(p.id)
  );
  const pms = matchInfo.playerMinutes;
  if (!pms || pms.length === 0) {
    return options.requirePlayerMinutes ? [] : teamOrMatchPlayers;
  }

  return teamOrMatchPlayers.filter((player) => {
    const playerMinutes = pms.find((pm) => pm.playerId === player.id);
    if (!playerMinutes) return false;

    const playTime =
      playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
        ? 0
        : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

    return playTime >= 1;
  });
}
