import type { ScoutingLeagueGroup, Sex } from '@/types/scouting';

const ROZGRYWKI_BASE = 'https://www.laczynaspilka.pl/rozgrywki';

/** Strona pojedynczego meczu — alternatywna kotwica tokenu. */
export function buildMatchPageUrl(matchId: string): string {
  return `${ROZGRYWKI_BASE}/mecz/${matchId}`;
}

export type RozgrywkiRound = 'Autumn' | 'Spring';

/** URL strony rozgrywek dla konkretnej ligi — stabilniejszy mint tokenu niż goły /rozgrywki/. */
export function buildRozgrywkiUrl(
  seasonId: string,
  leagueGroupId: string,
  leagueId: string,
  sex: Sex,
  round: RozgrywkiRound = 'Autumn'
): string {
  const params = new URLSearchParams({
    season: seasonId,
    leagueGroup: leagueGroupId,
    leagueId,
    enumType: 'None',
    round,
    queue: '0',
    isAdvanceMode: 'false',
    genderType: sex === 'female' ? 'Female' : 'Male',
  });
  return `${ROZGRYWKI_BASE}?${params.toString()}`;
}

export const ROZGRYWKI_HOME_URL = ROZGRYWKI_BASE;

export function findLeagueGroupId(groups: ScoutingLeagueGroup[], leagueId: string): string | null {
  for (const g of groups) {
    if (g.leagues.some((l) => l.leagueId === leagueId)) return g.id;
  }
  return null;
}
