import type { Player, TeamInfo } from "@/types";

/**
 * Lista zawodników do modali (PK, strzał, akcja itd.).
 * Gdy mamy pełne `playerMinutes` z meczu — zostawiamy tylko tych z realnym czasem gry.
 * Gdy `playerMinutes` jest puste lub niezaładowane (np. zapis cache do localStorage bez minut) —
 * pokazujemy cały skład `matchInfo.team`, żeby modal nie był pusty do momentu dociągnięcia z Firebase.
 */
export function getModalPlayersForMatch(
  players: Player[],
  matchInfo: TeamInfo | null | undefined
): Player[] {
  if (!matchInfo) return players;

  const teamPlayers = players.filter((p) => p.teams?.includes(matchInfo.team));
  const pms = matchInfo.playerMinutes;
  if (!pms || pms.length === 0) {
    return teamPlayers;
  }

  return teamPlayers.filter((player) => {
    const playerMinutes = pms.find((pm) => pm.playerId === player.id);
    if (!playerMinutes) return false;

    const playTime =
      playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
        ? 0
        : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

    return playTime >= 1;
  });
}
