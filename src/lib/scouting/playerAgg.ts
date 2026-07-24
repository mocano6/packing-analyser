import type { ScoutingPlayerMatchStat } from '@/types/scouting';

export interface PlayerMatchAgg {
  minutes: number;
  goals: number;
  matches: number;
  starts: number;
  subs: number;
  yellowCards: number;
  redCards: number;
}

export const emptyPlayerMatchAgg = (): PlayerMatchAgg => ({
  minutes: 0,
  goals: 0,
  matches: 0,
  starts: 0,
  subs: 0,
  yellowCards: 0,
  redCards: 0,
});

type StatSlice = Pick<
  ScoutingPlayerMatchStat,
  'minutesPlayed' | 'goals' | 'isStarter' | 'yellowCards' | 'redCards'
>;

/** Sumuje statystyki pojedynczego występu meczowego do agregatu sezonowego. */
export function accumulatePlayerMatchStat(cur: PlayerMatchAgg, p: StatSlice): PlayerMatchAgg {
  const next: PlayerMatchAgg = {
    ...cur,
    minutes: cur.minutes + p.minutesPlayed,
    goals: cur.goals + p.goals,
    yellowCards: cur.yellowCards + p.yellowCards,
    redCards: cur.redCards + p.redCards,
  };
  if (p.minutesPlayed > 0) {
    next.matches = cur.matches + 1;
    if (p.isStarter) {
      next.starts = cur.starts + 1;
    } else {
      next.subs = cur.subs + 1;
    }
  }
  return next;
}

/** Format kartek do komórki tabeli (puste gdy brak). */
export function formatPlayerCards(yellow: number, red: number): string {
  const parts: string[] = [];
  if (yellow > 0) parts.push(`${yellow}🟨`);
  if (red > 0) parts.push(`${red}🟥`);
  return parts.join(' ') || '';
}
