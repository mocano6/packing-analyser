// Wyliczanie minut i statystyk zawodników z surowych zdarzeń meczu
// (endpoint matches/{matchId}/events z API rozgrywek laczynaspilka.pl).

import type { ScoutingPlayerMatchStat, ScoutingTeamRef } from '@/types/scouting';

const REGULAR_TIME = 90;

export interface RawEventItem {
  type?: string;
  minute?: string; // np. "71'" albo "45+2'"
}

export interface RawSquadPlayer {
  id: string;
  firstname?: string;
  lastname?: string;
  number?: number | null;
  isKeeper?: boolean;
  isCaptain?: boolean;
  isJunior?: boolean;
  type?: string; // "Starter" dla wyjściowej jedenastki
  goals?: RawEventItem[];
  cards?: RawEventItem[];
  substitutions?: RawEventItem[];
}

export interface RawTeamEvents {
  staff?: unknown[];
  squad?: RawSquadPlayer[];
}

export interface RawMatchEvents {
  host?: RawTeamEvents;
  guest?: RawTeamEvents;
}

/** Parsuje minutę typu "45+2'" -> 47, "71'" -> 71. Zwraca null gdy brak. */
export function parseMinute(raw?: string): number | null {
  if (!raw) return null;
  const nums = raw.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + parseInt(n, 10), 0);
}

const isRedCard = (type?: string): boolean => {
  const t = (type || '').toLowerCase();
  return t.includes('red') || t.includes('second');
};

const isOwnGoal = (type?: string): boolean => (type || '').toLowerCase().includes('own');

export interface PlayerPlayInterval {
  isStarter: boolean;
  startMinute: number;
  endMinute: number;
  minutesPlayed: number;
  subInMinute: number | null;
  subOutMinute: number | null;
}

/** Przedział gry (Od/Do) ze składu, zmian i czerwonej kartki. */
export function computePlayerPlayInterval(p: RawSquadPlayer): PlayerPlayInterval {
  const subs = p.substitutions || [];
  const subInMinute = parseMinute(subs.find((s) => (s.type || '').toLowerCase() === 'in')?.minute);
  const subOutMinute = parseMinute(subs.find((s) => (s.type || '').toLowerCase() === 'out')?.minute);
  const isStarter = (p.type || '').toLowerCase() === 'starter';
  const redMinute = parseMinute(p.cards?.find((c) => isRedCard(c.type))?.minute);

  if (isStarter) {
    const startMinute = 0;
    let endMinute = subOutMinute ?? REGULAR_TIME;
    if (redMinute != null) endMinute = Math.min(endMinute, redMinute);
    return {
      isStarter,
      startMinute,
      endMinute,
      minutesPlayed: Math.max(0, endMinute - startMinute),
      subInMinute,
      subOutMinute,
    };
  }
  if (subInMinute != null) {
    const startMinute = subInMinute;
    let endMinute = subOutMinute ?? REGULAR_TIME;
    if (redMinute != null) endMinute = Math.min(endMinute, redMinute);
    return {
      isStarter,
      startMinute,
      endMinute,
      minutesPlayed: Math.max(0, endMinute - startMinute),
      subInMinute,
      subOutMinute,
    };
  }
  return {
    isStarter,
    startMinute: 0,
    endMinute: 0,
    minutesPlayed: 0,
    subInMinute,
    subOutMinute,
  };
}

/** Wylicza statystyki jednego zawodnika (minuty, bramki, kartki). */
export function computePlayerStat(
  p: RawSquadPlayer,
  team: ScoutingTeamRef
): ScoutingPlayerMatchStat {
  const interval = computePlayerPlayInterval(p);
  const goalsAll = p.goals || [];
  const scored = goalsAll.filter((g) => !isOwnGoal(g.type));
  const own = goalsAll.filter((g) => isOwnGoal(g.type));

  const yellow = (p.cards || []).filter((c) => !isRedCard(c.type)).length;
  const red = (p.cards || []).filter((c) => isRedCard(c.type)).length;

  return {
    playerId: p.id,
    firstname: p.firstname || '',
    lastname: p.lastname || '',
    number: p.number ?? null,
    teamId: team.id,
    teamName: team.name,
    isStarter: interval.isStarter,
    minutesPlayed: interval.minutesPlayed,
    goals: scored.length,
    goalMinutes: scored.map((g) => parseMinute(g.minute)).filter((m): m is number => m != null),
    ownGoals: own.length,
    yellowCards: yellow,
    redCards: red,
    subInMinute: interval.subInMinute,
    subOutMinute: interval.subOutMinute,
  };
}

/** Buduje pełną listę statystyk zawodników obu drużyn z odpowiedzi events. */
export function computeMatchPlayerStats(
  events: RawMatchEvents,
  host: ScoutingTeamRef,
  guest: ScoutingTeamRef
): ScoutingPlayerMatchStat[] {
  const out: ScoutingPlayerMatchStat[] = [];
  for (const p of events.host?.squad || []) out.push(computePlayerStat(p, host));
  for (const p of events.guest?.squad || []) out.push(computePlayerStat(p, guest));
  return out;
}
