import type { Action, TeamInfo } from "@/types";
import { getZoneName, zoneNameToIndex, zoneNameToString } from "@/constants/xtValues";
import { getXTDifferenceForAction } from "@/utils/pxtFromAction";
import { packingContactKind } from "@/utils/wiedzaPackingZoneFlow";
import {
  filterPackingActionsForTab,
  getPackingActionTypeKey,
  type PxtPackingFilterKey,
  type PxtPackingFilterState,
} from "@/utils/statystykiZespoluPxtFilters";

export type PxtHalfFilter = "all" | "first" | "second";
export type PxtRoleFilter = "sender" | "receiver" | "dribbler";

export type PxtActionMetrics = {
  pxt: number;
  xtDelta: number;
  packPts: number;
};

export type PxtHalfSlice = {
  pxt: number;
  xt: number;
  packing: number;
  passCount: number;
  dribbleCount: number;
  pxtPerPass: number;
  pxtPerDribble: number;
};

export type PxtTeamSideStats = {
  pxt: number;
  xt: number;
  packing: number;
  actionCount: number;
  passCount: number;
  dribbleCount: number;
  pxtPerPass: number;
  pxtPerDribble: number;
  pxtPerMinPossession: number;
  p2Count: number;
  p3Count: number;
  pkCount: number;
  shotCount: number;
  goalCount: number;
  dominancePct: number;
  firstHalf: PxtHalfSlice;
  secondHalf: PxtHalfSlice;
  possessionMin: number;
};

export type PxtPlayerRow = {
  playerId: string;
  playerName: string;
  pxt: number;
  pxtSharePct: number;
  xt: number;
  packing: number;
  passes: number;
  receptions: number;
  dribbles: number;
  p2Count: number;
  p3Count: number;
};

export type PxtBreakdownRow = {
  key: string;
  label: string;
  teamValue: number;
  oppValue: number;
  teamCount: number;
  oppCount: number;
};

export type PxtCumulativePoint = {
  minute: number;
  teamPxt: number;
  oppPxt: number;
  teamXt: number;
  oppXt: number;
};

export type PxtIntervalPoint = {
  minute: string;
  minuteValue: number;
  teamPxt: number;
  oppPxt: number;
  teamXt: number;
  oppXt: number;
  teamPacking: number;
  oppPacking: number;
};

export function getPackingMetrics(action: Action): PxtActionMetrics {
  const packPts = (action.packingPoints ?? (action as { packing?: number }).packing ?? 0) as number;
  const xtDelta = getXTDifferenceForAction(action);
  return { pxt: xtDelta * packPts, xtDelta, packPts };
}

export function resolveOpponentTeamId(matchInfo: TeamInfo, selectedTeam: string): string {
  if (matchInfo.team === selectedTeam) return matchInfo.opponent ?? "";
  return matchInfo.team ?? "";
}

/** Akcje packing przypisane do wybranego klubu (legacy bez teamId → nasz). */
export function getTeamPackingActions(actions: Action[], selectedTeam: string): Action[] {
  const withTeamId = actions.filter((a) => typeof a.teamId === "string" && a.teamId.length > 0);
  if (withTeamId.length === 0) {
    return actions.filter((a) => a.mode !== "defense");
  }
  return actions.filter((a) => !a.teamId || a.teamId === selectedTeam);
}

export function getOpponentPackingActions(
  actions: Action[],
  selectedTeam: string,
  opponentId: string,
): Action[] {
  if (!opponentId) return [];
  return actions.filter((a) => a.teamId === opponentId);
}

export function filterPackingByHalf(actions: Action[], half: PxtHalfFilter): Action[] {
  if (half === "first") return actions.filter((a) => (a.minute ?? 0) <= 45);
  if (half === "second") return actions.filter((a) => (a.minute ?? 0) > 45);
  return actions;
}

function emptyHalfSlice(): PxtHalfSlice {
  return {
    pxt: 0,
    xt: 0,
    packing: 0,
    passCount: 0,
    dribbleCount: 0,
    pxtPerPass: 0,
    pxtPerDribble: 0,
  };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function getTeamPossessionMinutes(matchInfo: TeamInfo, selectedTeam: string, half: PxtHalfFilter): number {
  const pos = matchInfo.matchData?.possession;
  if (!pos) return 0;
  const isOurHome = matchInfo.team === selectedTeam;
  const first = isOurHome ? (pos.teamFirstHalf ?? 0) : (pos.opponentFirstHalf ?? 0);
  const second = isOurHome ? (pos.teamSecondHalf ?? 0) : (pos.opponentSecondHalf ?? 0);
  if (half === "first") return first;
  if (half === "second") return second;
  return first + second;
}

function getOpponentPossessionMinutes(matchInfo: TeamInfo, selectedTeam: string, half: PxtHalfFilter): number {
  const pos = matchInfo.matchData?.possession;
  if (!pos) return 0;
  const isOurHome = matchInfo.team === selectedTeam;
  const first = isOurHome ? (pos.opponentFirstHalf ?? 0) : (pos.teamFirstHalf ?? 0);
  const second = isOurHome ? (pos.opponentSecondHalf ?? 0) : (pos.teamSecondHalf ?? 0);
  if (half === "first") return first;
  if (half === "second") return second;
  return first + second;
}

export function buildPxtSideStats(
  actions: Action[],
  possessionMin: number,
  totalPoolPxt: number,
): PxtTeamSideStats {
  let pxt = 0;
  let xt = 0;
  let packing = 0;
  let passCount = 0;
  let dribbleCount = 0;
  let p2Count = 0;
  let p3Count = 0;
  let pkCount = 0;
  let shotCount = 0;
  let goalCount = 0;

  const firstHalf = emptyHalfSlice();
  const secondHalf = emptyHalfSlice();

  for (const action of actions) {
    const m = getPackingMetrics(action);
    const typeKey = getPackingActionTypeKey(action);
    const minute = typeof action.minute === "number" ? action.minute : 0;
    const halfSlice = minute <= 45 ? firstHalf : secondHalf;

    pxt += m.pxt;
    xt += m.xtDelta;
    packing += m.packPts;
    halfSlice.pxt += m.pxt;
    halfSlice.xt += m.xtDelta;
    halfSlice.packing += m.packPts;

    if (typeKey === "pass") {
      passCount += 1;
      halfSlice.passCount += 1;
    }
    if (typeKey === "dribble") {
      dribbleCount += 1;
      halfSlice.dribbleCount += 1;
    }
    if (action.isP2) p2Count += 1;
    if (action.isP3) p3Count += 1;
    if (action.isPenaltyAreaEntry) pkCount += 1;
    if (action.isShot) shotCount += 1;
    if (action.isGoal) goalCount += 1;
  }

  firstHalf.pxtPerPass = firstHalf.passCount > 0 ? firstHalf.pxt / firstHalf.passCount : 0;
  secondHalf.pxtPerPass = secondHalf.passCount > 0 ? secondHalf.pxt / secondHalf.passCount : 0;
  firstHalf.pxtPerDribble = firstHalf.dribbleCount > 0 ? firstHalf.pxt / firstHalf.dribbleCount : 0;
  secondHalf.pxtPerDribble = secondHalf.dribbleCount > 0 ? secondHalf.pxt / secondHalf.dribbleCount : 0;

  return {
    pxt,
    xt,
    packing,
    actionCount: actions.length,
    passCount,
    dribbleCount,
    pxtPerPass: passCount > 0 ? pxt / passCount : 0,
    pxtPerDribble: dribbleCount > 0 ? pxt / dribbleCount : 0,
    pxtPerMinPossession: possessionMin > 0 ? pxt / possessionMin : 0,
    p2Count,
    p3Count,
    pkCount,
    shotCount,
    goalCount,
    dominancePct: pct(pxt, totalPoolPxt),
    firstHalf,
    secondHalf,
    possessionMin,
  };
}

export function buildTeamAndOpponentPxtStats(
  allActions: Action[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: PxtHalfFilter,
  filters: PxtPackingFilterState,
): { team: PxtTeamSideStats; opponent: PxtTeamSideStats } {
  const opponentId = resolveOpponentTeamId(matchInfo, selectedTeam);
  const teamRaw = filterPackingByHalf(getTeamPackingActions(allActions, selectedTeam), half);
  const oppRaw = filterPackingByHalf(getOpponentPackingActions(allActions, selectedTeam, opponentId), half);
  const teamActions = filterPackingActionsForTab(teamRaw, filters);
  const oppActions = filterPackingActionsForTab(oppRaw, filters);
  const teamPoss = getTeamPossessionMinutes(matchInfo, selectedTeam, half);
  const oppPoss = getOpponentPossessionMinutes(matchInfo, selectedTeam, half);
  const totalPool = teamActions.reduce((s, a) => s + getPackingMetrics(a).pxt, 0)
    + oppActions.reduce((s, a) => s + getPackingMetrics(a).pxt, 0);

  return {
    team: buildPxtSideStats(teamActions, teamPoss, totalPool),
    opponent: buildPxtSideStats(oppActions, oppPoss, totalPool),
  };
}

export function buildPxtHalfSummaryForKpi(actions: Action[]): { firstHalf: PxtHalfSlice; secondHalf: PxtHalfSlice } {
  const firstHalf = emptyHalfSlice();
  const secondHalf = emptyHalfSlice();

  for (const action of actions) {
    if (action.mode === "defense") continue;
    const m = getPackingMetrics(action);
    const typeKey = getPackingActionTypeKey(action);
    const minute = typeof action.minute === "number" ? action.minute : 0;
    const slice = minute <= 45 ? firstHalf : secondHalf;
    slice.pxt += m.pxt;
    slice.xt += m.xtDelta;
    slice.packing += m.packPts;
    if (typeKey === "pass") slice.passCount += 1;
    if (typeKey === "dribble") slice.dribbleCount += 1;
  }

  firstHalf.pxtPerPass = firstHalf.passCount > 0 ? firstHalf.pxt / firstHalf.passCount : 0;
  secondHalf.pxtPerPass = secondHalf.passCount > 0 ? secondHalf.pxt / secondHalf.passCount : 0;
  firstHalf.pxtPerDribble = firstHalf.dribbleCount > 0 ? firstHalf.pxt / firstHalf.dribbleCount : 0;
  secondHalf.pxtPerDribble = secondHalf.dribbleCount > 0 ? secondHalf.pxt / secondHalf.dribbleCount : 0;

  return { firstHalf, secondHalf };
}

export function normalizePxtZoneKey(zone: string | number | null | undefined): string | null {
  if (zone == null) return null;
  const raw = typeof zone === "string" ? zone.toUpperCase().replace(/\s+/g, "") : String(zone).toUpperCase();
  const idx = zoneNameToIndex(raw);
  if (idx !== null) {
    const zn = getZoneName(idx);
    return zn ? zoneNameToString(zn) : raw;
  }
  return raw;
}

export function buildPxtHeatmapData(
  actions: Action[],
  role: PxtRoleFilter,
  direction: "from" | "to",
  mode: "pxt" | "count",
): Map<string, number> {
  const heatmap = new Map<string, number>();

  for (const action of actions) {
    const typeKey = getPackingActionTypeKey(action);
    if (role === "dribbler" && typeKey !== "dribble") continue;
    if (role !== "dribbler" && typeKey === "dribble") continue;
    if (role === "sender" && typeKey !== "pass") continue;
    if (role === "receiver" && typeKey !== "pass") continue;

    let zone: string | number | null | undefined;
    if (role === "dribbler") {
      zone = action.startZone ?? action.fromZone;
    } else if (role === "sender") {
      zone = direction === "from" ? (action.fromZone ?? action.startZone) : (action.toZone ?? action.endZone);
    } else {
      zone = direction === "to" ? (action.toZone ?? action.endZone) : (action.fromZone ?? action.startZone);
    }

    const normalized = normalizePxtZoneKey(zone);
    if (!normalized) continue;

    const add = mode === "pxt" ? getPackingMetrics(action).pxt : 1;
    heatmap.set(normalized, (heatmap.get(normalized) ?? 0) + add);
  }

  return heatmap;
}

export function buildPxtZonePlayerStats(
  actions: Action[],
  role: PxtRoleFilter,
  direction: "from" | "to",
): Map<string, Map<string, { pxt: number; actions: number }>> {
  const stats = new Map<string, Map<string, { pxt: number; actions: number }>>();

  for (const action of actions) {
    const typeKey = getPackingActionTypeKey(action);
    if (role === "dribbler" && typeKey !== "dribble") continue;
    if (role !== "dribbler" && typeKey === "dribble") continue;
    if (role === "sender" && typeKey !== "pass") continue;
    if (role === "receiver" && typeKey !== "pass") continue;

    let zone: string | number | null | undefined;
    let playerId: string | undefined;

    if (role === "dribbler") {
      zone = action.startZone ?? action.fromZone;
      playerId = action.senderId;
    } else if (role === "sender") {
      zone = direction === "from" ? (action.fromZone ?? action.startZone) : (action.toZone ?? action.endZone);
      playerId = action.senderId;
    } else {
      zone = direction === "to" ? (action.toZone ?? action.endZone) : (action.fromZone ?? action.startZone);
      playerId = action.receiverId;
    }

    const normalized = normalizePxtZoneKey(zone);
    if (!normalized || !playerId) continue;

    if (!stats.has(normalized)) stats.set(normalized, new Map());
    const zoneMap = stats.get(normalized)!;
    if (!zoneMap.has(playerId)) zoneMap.set(playerId, { pxt: 0, actions: 0 });
    const row = zoneMap.get(playerId)!;
    row.actions += 1;
    row.pxt += getPackingMetrics(action).pxt;
  }

  return stats;
}

export function buildPlayerPxtRows(
  actions: Action[],
  totalPxt: number,
  getPlayerName: (playerId: string) => string,
): PxtPlayerRow[] {
  const map = new Map<string, PxtPlayerRow>();

  const ensure = (playerId: string): PxtPlayerRow => {
    if (!map.has(playerId)) {
      map.set(playerId, {
        playerId,
        playerName: getPlayerName(playerId),
        pxt: 0,
        pxtSharePct: 0,
        xt: 0,
        packing: 0,
        passes: 0,
        receptions: 0,
        dribbles: 0,
        p2Count: 0,
        p3Count: 0,
      });
    }
    return map.get(playerId)!;
  };

  for (const action of actions) {
    const m = getPackingMetrics(action);
    const typeKey = getPackingActionTypeKey(action);

    if (typeKey === "pass") {
      if (action.senderId) {
        const row = ensure(action.senderId);
        row.pxt += m.pxt;
        row.xt += m.xtDelta;
        row.packing += m.packPts;
        row.passes += 1;
        if (action.isP2) row.p2Count += 1;
        if (action.isP3) row.p3Count += 1;
      }
      if (action.receiverId) {
        const row = ensure(action.receiverId);
        row.receptions += 1;
      }
    } else if (typeKey === "dribble" && action.senderId) {
      const row = ensure(action.senderId);
      row.pxt += m.pxt;
      row.xt += m.xtDelta;
      row.packing += m.packPts;
      row.dribbles += 1;
      if (action.isP2) row.p2Count += 1;
      if (action.isP3) row.p3Count += 1;
    }
  }

  const rows = Array.from(map.values());
  for (const row of rows) {
    row.pxtSharePct = totalPxt > 0 ? (row.pxt / totalPxt) * 100 : 0;
  }
  rows.sort((a, b) => b.pxt - a.pxt || a.playerName.localeCompare(b.playerName, "pl"));
  return rows;
}

const OUTCOME_BREAKDOWN: { key: string; label: string; match: (a: Action) => boolean }[] = [
  { key: "p3", label: "P3", match: (a) => Boolean(a.isP3) },
  { key: "p2", label: "P2", match: (a) => Boolean(a.isP2) },
  { key: "p1", label: "P1", match: (a) => Boolean(a.isP1) },
  { key: "p0", label: "P0", match: (a) => Boolean(a.isP0) },
  { key: "pk", label: "Wejście PK", match: (a) => Boolean(a.isPenaltyAreaEntry) },
  { key: "shot", label: "Strzał", match: (a) => Boolean(a.isShot) },
  { key: "goal", label: "Gol", match: (a) => Boolean(a.isGoal) },
];

const CONTACT_LABELS: Record<string, string> = {
  c1: "Kontakt 1",
  c2: "Kontakt 2",
  c3: "Kontakt 3+",
  unknown: "Bez kontaktu",
};

export function buildPxtOutcomeBreakdown(
  teamActions: Action[],
  oppActions: Action[],
  metric: "pxt" | "xt" | "packing",
): PxtBreakdownRow[] {
  const pick = (m: PxtActionMetrics) => (metric === "pxt" ? m.pxt : metric === "xt" ? m.xtDelta : m.packPts);

  return OUTCOME_BREAKDOWN.map(({ key, label, match }) => {
    const teamMatched = teamActions.filter(match);
    const oppMatched = oppActions.filter(match);
    return {
      key,
      label,
      teamValue: teamMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      oppValue: oppMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      teamCount: teamMatched.length,
      oppCount: oppMatched.length,
    };
  }).filter((r) => r.teamCount > 0 || r.oppCount > 0);
}

export function buildPxtTypeBreakdown(
  teamActions: Action[],
  oppActions: Action[],
  metric: "pxt" | "xt" | "packing",
): PxtBreakdownRow[] {
  const pick = (m: PxtActionMetrics) => (metric === "pxt" ? m.pxt : metric === "xt" ? m.xtDelta : m.packPts);
  const types: { key: string; label: string; match: (a: Action) => boolean }[] = [
    { key: "pass", label: "Podanie", match: (a) => getPackingActionTypeKey(a) === "pass" },
    { key: "dribble", label: "Drybling", match: (a) => getPackingActionTypeKey(a) === "dribble" },
  ];

  return types.map(({ key, label, match }) => {
    const teamMatched = teamActions.filter(match);
    const oppMatched = oppActions.filter(match);
    return {
      key,
      label,
      teamValue: teamMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      oppValue: oppMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      teamCount: teamMatched.length,
      oppCount: oppMatched.length,
    };
  });
}

export function buildPxtContactBreakdown(
  teamActions: Action[],
  oppActions: Action[],
  metric: "pxt" | "xt" | "packing",
): PxtBreakdownRow[] {
  const pick = (m: PxtActionMetrics) => (metric === "pxt" ? m.pxt : metric === "xt" ? m.xtDelta : m.packPts);
  const keys = ["c3", "c2", "c1", "unknown"] as const;

  return keys.map((key) => {
    const teamMatched = teamActions.filter((a) => packingContactKind(a) === key);
    const oppMatched = oppActions.filter((a) => packingContactKind(a) === key);
    return {
      key,
      label: CONTACT_LABELS[key],
      teamValue: teamMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      oppValue: oppMatched.reduce((s, a) => s + pick(getPackingMetrics(a)), 0),
      teamCount: teamMatched.length,
      oppCount: oppMatched.length,
    };
  }).filter((r) => r.teamCount > 0 || r.oppCount > 0);
}

export function buildCumulativePxtChartData(
  allActions: Action[],
  selectedTeam: string,
  opponentId: string,
): PxtCumulativePoint[] {
  const team = getTeamPackingActions(allActions, selectedTeam).filter((a) => a.mode !== "defense");
  const opp = getOpponentPackingActions(allActions, selectedTeam, opponentId);
  const merged = [
    ...team.map((a) => ({ minute: a.minute ?? 0, side: "team" as const, action: a })),
    ...opp.map((a) => ({ minute: a.minute ?? 0, side: "opp" as const, action: a })),
  ].sort((a, b) => a.minute - b.minute || (a.side === "team" ? -1 : 1));

  let teamPxt = 0;
  let oppPxt = 0;
  let teamXt = 0;
  let oppXt = 0;

  return merged.map((item) => {
    const m = getPackingMetrics(item.action);
    if (item.side === "team") {
      teamPxt += m.pxt;
      teamXt += m.xtDelta;
    } else {
      oppPxt += m.pxt;
      oppXt += m.xtDelta;
    }
    return { minute: item.minute, teamPxt, oppPxt, teamXt, oppXt };
  });
}

export function buildPxt5MinChartData(
  allActions: Action[],
  selectedTeam: string,
  opponentId: string,
): PxtIntervalPoint[] {
  const team = getTeamPackingActions(allActions, selectedTeam);
  const opp = getOpponentPackingActions(allActions, selectedTeam, opponentId);
  const intervals: Record<number, PxtIntervalPoint> = {};

  const ensure = (i: number): PxtIntervalPoint => {
    if (!intervals[i]) {
      intervals[i] = {
        minute: `${i}-${i + 5}`,
        minuteValue: i,
        teamPxt: 0,
        oppPxt: 0,
        teamXt: 0,
        oppXt: 0,
        teamPacking: 0,
        oppPacking: 0,
      };
    }
    return intervals[i];
  };

  const add = (action: Action, side: "team" | "opp") => {
    const interval = Math.floor((action.minute ?? 0) / 5) * 5;
    const bucket = ensure(interval);
    const m = getPackingMetrics(action);
    if (side === "team") {
      bucket.teamPxt += m.pxt;
      bucket.teamXt += m.xtDelta;
      bucket.teamPacking += m.packPts;
    } else {
      bucket.oppPxt += m.pxt;
      bucket.oppXt += m.xtDelta;
      bucket.oppPacking += m.packPts;
    }
  };

  team.forEach((a) => add(a, "team"));
  opp.forEach((a) => add(a, "opp"));

  const data: PxtIntervalPoint[] = [];
  for (let i = 0; i <= 90; i += 5) {
    data.push(intervals[i] ?? ensure(i));
  }
  return data;
}

export type PxtFilterCountKey = PxtPackingFilterKey;

export function buildPxtFilterCounts(actions: Action[]): Record<PxtFilterCountKey, number> {
  const counts: Record<PxtFilterCountKey, number> = {
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
    p0start: 0,
    p1start: 0,
    p2start: 0,
    p3start: 0,
    pk: 0,
    shot: 0,
    goal: 0,
  };

  for (const action of actions) {
    if (action.isP0) counts.p0 += 1;
    if (action.isP1) counts.p1 += 1;
    if (action.isP2) counts.p2 += 1;
    if (action.isP3) counts.p3 += 1;
    if (action.isP0Start) counts.p0start += 1;
    if (action.isP1Start) counts.p1start += 1;
    if (action.isP2Start) counts.p2start += 1;
    if (action.isP3Start) counts.p3start += 1;
    if (action.isPenaltyAreaEntry) counts.pk += 1;
    if (action.isShot) counts.shot += 1;
    if (action.isGoal) counts.goal += 1;
  }

  return counts;
}

function resolvePxtActionZone(
  action: Action,
  role: PxtRoleFilter,
  direction: "from" | "to",
): string | null {
  const typeKey = getPackingActionTypeKey(action);
  if (role === "dribbler" && typeKey !== "dribble") return null;
  if (role !== "dribbler" && typeKey === "dribble") return null;
  if (role === "sender" && typeKey !== "pass") return null;
  if (role === "receiver" && typeKey !== "pass") return null;

  let zone: string | number | null | undefined;
  if (role === "dribbler") {
    zone = action.startZone ?? action.fromZone;
  } else if (role === "sender") {
    zone = direction === "from" ? (action.fromZone ?? action.startZone) : (action.toZone ?? action.endZone);
  } else {
    zone = direction === "to" ? (action.toZone ?? action.endZone) : (action.fromZone ?? action.startZone);
  }

  return normalizePxtZoneKey(zone);
}

/** Akcje przypisane do wybranej strefy heatmapy (ten sam filtr roli/kierunku co heatmapa). */
export function getPxtActionsInZone(
  actions: Action[],
  zoneName: string,
  role: PxtRoleFilter,
  direction: "from" | "to",
): Action[] {
  const target = normalizePxtZoneKey(zoneName) ?? zoneName.toUpperCase().replace(/\s+/g, "");
  return actions.filter((action) => resolvePxtActionZone(action, role, direction) === target);
}

export type PxtZoneRoleActionGroup = {
  role: PxtRoleFilter;
  label: string;
  actions: Action[];
};

/** Po kliknięciu strefy: podanie (z), przyjęcie (w), drybling/atak (z). */
export function buildPxtZoneRoleActionGroups(actions: Action[], zoneName: string): PxtZoneRoleActionGroup[] {
  const sortActions = (rows: Action[]) =>
    [...rows].sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id));

  return [
    {
      role: "sender",
      label: "Podanie (z strefy)",
      actions: sortActions(getPxtActionsInZone(actions, zoneName, "sender", "from")),
    },
    {
      role: "receiver",
      label: "Przyjęcie (w strefie)",
      actions: sortActions(getPxtActionsInZone(actions, zoneName, "receiver", "to")),
    },
    {
      role: "dribbler",
      label: "Drybling (atak)",
      actions: sortActions(getPxtActionsInZone(actions, zoneName, "dribbler", "from")),
    },
  ];
}
