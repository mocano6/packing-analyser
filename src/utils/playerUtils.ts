// Utility funkcje do obsługi zawodników

import { Player, TeamInfo } from '@/types';

/**
 * Pobiera pełne imię i nazwisko zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (firstName + lastName)
 */
export const getPlayerFullName = (player: Player): string => {
  if (player.firstName && player.lastName) {
    return `${player.firstName} ${player.lastName}`;
  } else if (player.name) {
    return player.name;
  }
  return "";
};

/**
 * Pobiera nazwisko zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (lastName)
 */
export const getPlayerLastName = (player: Player): string => {
  if (player.lastName) {
    return player.lastName;
  } else if (player.name) {
    const words = player.name.trim().split(/\s+/);
    return words[words.length - 1];
  }
  return "";
};

/**
 * Pobiera imię zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (firstName)
 */
export const getPlayerFirstName = (player: Player): string => {
  if (player.firstName) {
    return player.firstName;
  } else if (player.name) {
    const words = player.name.trim().split(/\s+/);
    return words[0];
  }
  return "";
};

/**
 * Sortuje zawodników alfabetycznie po nazwisku
 */
export const sortPlayersByLastName = (players: Player[]): Player[] => {
  return [...players].sort((a, b) => {
    const lastNameA = getPlayerLastName(a).toLowerCase();
    const lastNameB = getPlayerLastName(b).toLowerCase();
    return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
  });
};

export type PlayersIndex = Map<string, Player>;

export const buildPlayersIndex = (players: Player[]): PlayersIndex => {
  return new Map(players.map(player => [player.id, player]));
};

export const getPlayerLabel = (
  playerId: string | null | undefined,
  playersIndex: PlayersIndex,
  options?: { includeNumber?: boolean }
): string => {
  if (!playerId) return "Zawodnik usunięty";
  const player = playersIndex.get(playerId);
  if (!player || player.isDeleted) return "Zawodnik usunięty";
  const name = getPlayerFullName(player).trim();
  const number = options?.includeNumber && player.number ? ` #${player.number}` : "";
  return `${name || "Zawodnik"}${number}`.trim();
};

export const getPositionInMatch = (
  matchInfo: TeamInfo | null | undefined,
  playerId: string | null | undefined
): string | undefined => {
  if (!matchInfo || !playerId) return undefined;
  const minutes = matchInfo.playerMinutes?.find(pm => pm.playerId === playerId);
  return minutes?.position;
};