import type { PKEntry, TeamInfo } from "@/types";
import {
  getPkEntryKpiBreakdownCounts,
  isPkDribbleEntry,
  isPkSfgEntry,
} from "@/lib/pkEntryKpiBreakdown";
import {
  buildWiedzaPkEntriesSummary,
  type WiedzaPkBreakdownRow,
  type WiedzaPkEntriesSummary,
} from "@/utils/wiedzaPkEntriesSummary";
import {
  filterPkEntriesForWiedzaTab,
  type WiedzaPkEntriesFilterState,
} from "@/utils/wiedzaPkEntriesFilters";

export type PkHalfFilter = "all" | "first" | "second";

export type PkTeamSideStats = {
  entries: number;
  goals: number;
  shots: number;
  regains: number;
  regainPct: number;
  shotPct: number;
  goalFromShotPct: number;
  avgPartners: number;
  avgOpponents: number;
  pkAdvantage: number;
  entriesPerMatchMin: number;
  entriesPerMinPossession: number;
  possessionMin: number;
  matchMinutes: number;
  sfgCount: number;
  dribbleCount: number;
  passCount: number;
  dribbleRegainCount: number;
  passRegainCount: number;
  controversialEntries: number;
  firstHalf: { entries: number; goals: number; shots: number };
  secondHalf: { entries: number; goals: number; shots: number };
  entriesDominancePct: number;
};

export type PkPlayerRow = {
  playerId: string;
  playerName: string;
  entries: number;
  goals: number;
  shots: number;
  regains: number;
  sfgEntries: number;
  entriesSharePct: number;
  shotPct: number;
  goalFromShotPct: number;
};

export type PkCumulativePoint = {
  minute: number;
  teamEntries: number;
  opponentEntries: number;
  teamGoals: number;
  opponentGoals: number;
};

export type PkIntervalPoint = {
  minute: string;
  minuteValue: number;
  teamTotal: number;
  oppTotal: number;
  teamPass: number;
  teamDribble: number;
  teamSfg: number;
  oppPass: number;
  oppDribble: number;
  oppSfg: number;
};

export type GroupedPkRow = {
  key: string;
  name: string;
  teamCount: number;
  oppCount: number;
  teamShots: number;
  oppShots: number;
  teamGoals: number;
  oppGoals: number;
  teamRegains: number;
  oppRegains: number;
};

export function getMatchPkEntries(entries: PKEntry[], selectedTeam: string): PKEntry[] {
  return entries.filter((e) => e && e.teamId === selectedTeam);
}

/** attack = wejścia zespołu, defense = wejścia przeciwnika (nasza obrona). */
export function getSidePkEntries(entries: PKEntry[], side: "team" | "opponent"): PKEntry[] {
  const context = side === "team" ? "attack" : "defense";
  return entries.filter((e) => (e.teamContext ?? "attack") === context);
}

export function filterPkEntriesByHalf(entries: PKEntry[], half: PkHalfFilter): PKEntry[] {
  if (half === "first") return entries.filter((e) => e.minute <= 45);
  if (half === "second") return entries.filter((e) => e.minute > 45);
  return entries;
}

function getMatchMinutes(matchInfo: TeamInfo, half: PkHalfFilter): number {
  const pos = matchInfo.matchData?.possession;
  if (pos) {
    const first =
      (pos.teamFirstHalf ?? 0) +
      (pos.opponentFirstHalf ?? 0) +
      (pos.deadFirstHalf ?? 0);
    const second =
      (pos.teamSecondHalf ?? 0) +
      (pos.opponentSecondHalf ?? 0) +
      (pos.deadSecondHalf ?? 0);
    if (half === "first") return first > 0 ? first : 45;
    if (half === "second") return second > 0 ? second : 45;
    return first + second > 0 ? first + second : 90;
  }
  if (half === "first") return 45;
  if (half === "second") return 45;
  return 90;
}

function getPossessionMinutes(
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: PkHalfFilter,
  side: "team" | "opponent",
): number {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const field =
    side === "team"
      ? isSelectedTeamHome
        ? "team"
        : "opponent"
      : isSelectedTeamHome
        ? "opponent"
        : "team";

  if (half === "first") return matchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0;
  if (half === "second") return matchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0;
  return (
    (matchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0) +
    (matchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0)
  );
}

function sliceHalfStats(entries: PKEntry[]): {
  firstHalf: { entries: number; goals: number; shots: number };
  secondHalf: { entries: number; goals: number; shots: number };
} {
  const first = entries.filter((e) => e.minute <= 45);
  const second = entries.filter((e) => e.minute > 45);
  const goals = (list: PKEntry[]) => list.filter((e) => e.isGoal).length;
  const shots = (list: PKEntry[]) => list.filter((e) => e.isShot).length;
  return {
    firstHalf: { entries: first.length, goals: goals(first), shots: shots(first) },
    secondHalf: { entries: second.length, goals: goals(second), shots: shots(second) },
  };
}

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

export function buildTeamSidePkStats(
  entries: PKEntry[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: PkHalfFilter,
  side: "team" | "opponent",
): PkTeamSideStats {
  const total = entries.length;
  const goals = entries.filter((e) => e.isGoal).length;
  const shots = entries.filter((e) => e.isShot).length;
  const regains = entries.filter((e) => e.isRegain).length;
  const partnersSum = entries.reduce((s, e) => s + (e.pkPlayersCount ?? 0), 0);
  const oppSum = entries.reduce((s, e) => s + (e.opponentsInPKCount ?? 0), 0);
  const avgPartners = total > 0 ? partnersSum / total : 0;
  const avgOpponents = total > 0 ? oppSum / total : 0;
  const breakdown = getPkEntryKpiBreakdownCounts(entries);
  const possessionMin = getPossessionMinutes(matchInfo, selectedTeam, half, side);
  const matchMinutes = getMatchMinutes(matchInfo, half);
  const halfSlices = sliceHalfStats(entries);

  return {
    entries: total,
    goals,
    shots,
    regains,
    regainPct: pct(regains, total),
    shotPct: pct(shots, total),
    goalFromShotPct: pct(goals, shots),
    avgPartners,
    avgOpponents,
    pkAdvantage: avgPartners - avgOpponents,
    entriesPerMatchMin: matchMinutes > 0 ? total / matchMinutes : 0,
    entriesPerMinPossession: possessionMin > 0 ? total / possessionMin : 0,
    possessionMin,
    matchMinutes,
    sfgCount: breakdown.sfgCount,
    dribbleCount: breakdown.dribbleCount,
    passCount: breakdown.passCount,
    dribbleRegainCount: breakdown.dribbleRegainCount,
    passRegainCount: breakdown.passRegainCount,
    controversialEntries: entries.filter((e) => e.isControversial).length,
    firstHalf: halfSlices.firstHalf,
    secondHalf: halfSlices.secondHalf,
    entriesDominancePct: 0,
  };
}

export function applyPkDominancePct(teamStats: PkTeamSideStats, opponentStats: PkTeamSideStats): void {
  const total = teamStats.entries + opponentStats.entries;
  teamStats.entriesDominancePct = total > 0 ? (teamStats.entries / total) * 100 : 0;
  opponentStats.entriesDominancePct = total > 0 ? (opponentStats.entries / total) * 100 : 0;
}

export function buildTeamAndOpponentPkStats(
  entries: PKEntry[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: PkHalfFilter,
): { teamStats: PkTeamSideStats; opponentStats: PkTeamSideStats } {
  const matchEntries = getMatchPkEntries(entries, selectedTeam);
  const teamStats = buildTeamSidePkStats(
    getSidePkEntries(matchEntries, "team"),
    matchInfo,
    selectedTeam,
    half,
    "team",
  );
  const opponentStats = buildTeamSidePkStats(
    getSidePkEntries(matchEntries, "opponent"),
    matchInfo,
    selectedTeam,
    half,
    "opponent",
  );
  applyPkDominancePct(teamStats, opponentStats);
  return { teamStats, opponentStats };
}

export function buildPkTabSummary(entries: PKEntry[]): WiedzaPkEntriesSummary {
  return buildWiedzaPkEntriesSummary(entries);
}

export function filterPkEntriesForTab(
  entries: PKEntry[],
  half: PkHalfFilter,
  filters: WiedzaPkEntriesFilterState,
): PKEntry[] {
  return filterPkEntriesForWiedzaTab(filterPkEntriesByHalf(entries, half), filters);
}

function classifyIntervalType(entry: PKEntry): "pass" | "dribble" | "sfg" {
  if (isPkSfgEntry(entry)) return "sfg";
  if (isPkDribbleEntry(entry)) return "dribble";
  return "pass";
}

export function buildPk5MinChartData(entries: PKEntry[], selectedTeam: string): PkIntervalPoint[] {
  const matchEntries = getMatchPkEntries(entries, selectedTeam);
  const intervals: Record<number, PkIntervalPoint> = {};

  const ensure = (i: number): PkIntervalPoint => {
    if (!intervals[i]) {
      intervals[i] = {
        minute: `${i}-${i + 5}`,
        minuteValue: i,
        teamTotal: 0,
        oppTotal: 0,
        teamPass: 0,
        teamDribble: 0,
        teamSfg: 0,
        oppPass: 0,
        oppDribble: 0,
        oppSfg: 0,
      };
    }
    return intervals[i];
  };

  for (const entry of matchEntries) {
    const interval = Math.floor(entry.minute / 5) * 5;
    const bucket = ensure(interval);
    const isTeam = (entry.teamContext ?? "attack") === "attack";
    const type = classifyIntervalType(entry);
    if (isTeam) {
      bucket.teamTotal += 1;
      if (type === "pass") bucket.teamPass += 1;
      else if (type === "dribble") bucket.teamDribble += 1;
      else bucket.teamSfg += 1;
    } else {
      bucket.oppTotal += 1;
      if (type === "pass") bucket.oppPass += 1;
      else if (type === "dribble") bucket.oppDribble += 1;
      else bucket.oppSfg += 1;
    }
  }

  const data: PkIntervalPoint[] = [];
  for (let i = 0; i <= 90; i += 5) {
    data.push(intervals[i] ?? ensure(i));
  }
  return data;
}

export function buildCumulativePkChartData(entries: PKEntry[], selectedTeam: string): PkCumulativePoint[] {
  const matchEntries = [...getMatchPkEntries(entries, selectedTeam)].sort((a, b) => a.minute - b.minute);
  let teamEntries = 0;
  let opponentEntries = 0;
  let teamGoals = 0;
  let opponentGoals = 0;

  return matchEntries.map((entry) => {
    const isTeam = (entry.teamContext ?? "attack") === "attack";
    if (isTeam) {
      teamEntries += 1;
      if (entry.isGoal) teamGoals += 1;
    } else {
      opponentEntries += 1;
      if (entry.isGoal) opponentGoals += 1;
    }
    return {
      minute: entry.minute,
      teamEntries,
      opponentEntries,
      teamGoals,
      opponentGoals,
    };
  });
}

export function mergePkBreakdownRows(
  teamRows: WiedzaPkBreakdownRow[],
  oppRows: WiedzaPkBreakdownRow[],
): GroupedPkRow[] {
  const map = new Map<string, GroupedPkRow>();
  const order: string[] = [];
  const ensure = (key: string, label: string) => {
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: label,
        teamCount: 0,
        oppCount: 0,
        teamShots: 0,
        oppShots: 0,
        teamGoals: 0,
        oppGoals: 0,
        teamRegains: 0,
        oppRegains: 0,
      });
      order.push(key);
    }
    return map.get(key)!;
  };
  teamRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.teamCount += r.count;
    g.teamShots += r.shots;
    g.teamGoals += r.goals;
    g.teamRegains += r.regains;
  });
  oppRows.forEach((r) => {
    const g = ensure(r.key, r.label);
    g.oppCount += r.count;
    g.oppShots += r.shots;
    g.oppGoals += r.goals;
    g.oppRegains += r.regains;
  });
  return order.map((k) => map.get(k)!);
}

function collectEntryParticipants(entry: PKEntry): Array<{ playerId: string; playerName?: string }> {
  const isDribble = isPkDribbleEntry(entry);
  const participants: Array<{ playerId: string; playerName?: string }> = [];
  const add = (id?: string, name?: string) => {
    const playerIdRaw = String(id || "").trim();
    const fallbackName = String(name || "").trim();
    if (!playerIdRaw && !fallbackName) return;
    participants.push({ playerId: playerIdRaw || `name:${fallbackName}`, playerName: fallbackName || undefined });
  };
  if (isDribble) {
    add(entry.senderId, entry.senderName);
  } else {
    add(entry.senderId, entry.senderName);
    add(entry.receiverId, entry.receiverName);
  }
  return participants;
}

export function buildPlayerPkRows(
  teamEntries: PKEntry[],
  teamEntriesTotal: number,
  getPlayerName: (playerId: string) => string,
): PkPlayerRow[] {
  const acc: Record<string, Omit<PkPlayerRow, "entriesSharePct" | "shotPct" | "goalFromShotPct">> = {};

  for (const entry of teamEntries) {
    const participants = collectEntryParticipants(entry);
    if (participants.length === 0) continue;

    const seen = new Set<string>();
    for (const p of participants) {
      if (seen.has(p.playerId)) continue;
      seen.add(p.playerId);
      const playerName = p.playerId.startsWith("name:")
        ? (p.playerName || "Nieznany zawodnik")
        : getPlayerName(p.playerId);

      if (!acc[p.playerId]) {
        acc[p.playerId] = {
          playerId: p.playerId,
          playerName,
          entries: 0,
          goals: 0,
          shots: 0,
          regains: 0,
          sfgEntries: 0,
        };
      }
      acc[p.playerId].entries += 1;
      if (entry.isGoal) acc[p.playerId].goals += 1;
      if (entry.isShot) acc[p.playerId].shots += 1;
      if (entry.isRegain) acc[p.playerId].regains += 1;
      if (isPkSfgEntry(entry)) acc[p.playerId].sfgEntries += 1;
    }
  }

  return Object.values(acc)
    .map((row) => ({
      ...row,
      entriesSharePct: teamEntriesTotal > 0 ? (row.entries / teamEntriesTotal) * 100 : 0,
      shotPct: row.entries > 0 ? (row.shots / row.entries) * 100 : 0,
      goalFromShotPct: row.shots > 0 ? (row.goals / row.shots) * 100 : 0,
    }))
    .sort((a, b) => b.entries - a.entries);
}
