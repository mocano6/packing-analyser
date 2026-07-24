import type { ScoutingPlayerInfo } from '@/types/scouting';

export interface PlayerNameParts {
  firstname?: string;
  lastname?: string;
}

/** Preferuje cache API, potem nazwisko ze składu meczu. */
export function resolvePlayerDisplayName(
  playerId: string,
  cached?: ScoutingPlayerInfo | null,
  fromStats?: PlayerNameParts
): string {
  const fromCache = cached ? `${cached.firstname} ${cached.lastname}`.trim() : '';
  if (fromCache) return fromCache;
  const fromMatch = `${fromStats?.firstname || ''} ${fromStats?.lastname || ''}`.trim();
  if (fromMatch) return fromMatch;
  return '';
}

/** Uzupełnia cache zawodnika danymi ze składu (bez pełnego profilu API). */
export function seedPlayerFromMatchStat(
  players: Record<string, ScoutingPlayerInfo>,
  stat: PlayerNameParts & { playerId: string; teamName?: string },
  fetchedAt: string
): void {
  const firstname = stat.firstname?.trim() || '';
  const lastname = stat.lastname?.trim() || '';
  if (!firstname && !lastname) return;

  const existing = players[stat.playerId];
  if (!existing) {
    players[stat.playerId] = {
      id: stat.playerId,
      firstname,
      lastname,
      age: null,
      clubName: stat.teamName,
      fetchedAt,
      apiProfile: false,
    };
    return;
  }
  if (!existing.firstname && firstname) existing.firstname = firstname;
  if (!existing.lastname && lastname) existing.lastname = lastname;
  if (!existing.clubName && stat.teamName) existing.clubName = stat.teamName;
}
