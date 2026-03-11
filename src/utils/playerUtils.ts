// Utility funkcje do obsługi zawodników

import { Player, TeamInfo } from '@/types';

/**
 * Sprawdza czy aktywny jest tryb prezentacji (maskowania danych)
 */
export const isPresentationMode = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('presentationMode') === 'true';
  }
  return false;
};

/**
 * Maskuje imię/nazwisko dla trybu prezentacji
 */
export const maskString = (str: string): string => {
  if (!str) return str;
  const parts = str.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const part = parts[0];
    return part.charAt(0) + '*'.repeat(Math.max(2, part.length - 1));
  }

  return parts.map(part => {
    if (part.length <= 1) return part;
    return part.charAt(0) + '*'.repeat(part.length - 1);
  }).join(' ');
};

/**
 * Pobiera pełne imię i nazwisko zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (firstName + lastName)
 */
export const getPlayerFullName = (player: Player): string => {
  let name = "";
  if (player.firstName && player.lastName) {
    name = `${player.firstName} ${player.lastName}`;
  } else if (player.name) {
    name = player.name;
  }
  
  if (isPresentationMode() && name) {
    return maskString(name);
  }
  return name;
};

/**
 * Pobiera nazwisko zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (lastName)
 */
export const getPlayerLastName = (player: Player): string => {
  let lastName = "";
  if (player.lastName) {
    lastName = player.lastName;
  } else if (player.name) {
    const words = player.name.trim().split(/\s+/);
    lastName = words[words.length - 1];
  }
  
  if (isPresentationMode() && lastName) {
    return maskString(lastName);
  }
  return lastName;
};

/**
 * Pobiera imię zawodnika
 * Obsługuje kompatybilność między starym formatem (name) a nowym (firstName)
 */
export const getPlayerFirstName = (player: Player): string => {
  let firstName = "";
  if (player.firstName) {
    firstName = player.firstName;
  } else if (player.name) {
    const words = player.name.trim().split(/\s+/);
    firstName = words[0];
  }
  
  if (isPresentationMode() && firstName) {
    return maskString(firstName);
  }
  return firstName;
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

/** Stały identyfikator używany w Shot dla bramki samobójczej */
export const OWN_GOAL_PLAYER_ID = "own_goal";

export const getPlayerLabel = (
  playerId: string | null | undefined,
  playersIndex: PlayersIndex,
  options?: { includeNumber?: boolean }
): string => {
  if (!playerId) return "Zawodnik usunięty";
  if (playerId === OWN_GOAL_PLAYER_ID) return "Bramka samobójcza";
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