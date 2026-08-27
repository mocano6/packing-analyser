import { Shot, TeamInfo } from "@/types";
import { isIn1TZoneCanonical, isInOpponent1TZoneCanonical } from "@/utils/pitchZones";
import { isSfgCategoryShot } from "@/utils/matchXgSplits";
import { getShotLinePlayersCount, summarizeCleanShots, isCleanShot } from "@/utils/shotLinePlayers";
import { buildWiedzaShotsSummary, type WiedzaShotBreakdownRow, type WiedzaShotsSummary } from "@/utils/wiedzaShotsSummary";

export const XG_PER_SHOT_KPI = 0.15;

/** Okno 8s CA / 8s ACC: strzał po starcie sekwencji, do 8 s. */
export const XG_SEQUENCE_WINDOW_SECONDS = 8;

export function eventVideoTimestampSec(event: {
  videoTimestampRaw?: number | null;
  videoTimestamp?: number | null;
}): number {
  const raw = event.videoTimestampRaw;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const v = event.videoTimestamp;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return 0;
}

/** Drużyna, która przyspieszała: atak = nasz zespół, obrona = przeciwnik. */
export function resolveAcc8sSideTeamId(
  entry: { teamId?: string; teamContext?: string },
  teamId: string,
  opponentId: string,
): string | null {
  const id = typeof entry.teamId === "string" ? entry.teamId.trim() : "";
  if (id) return id;
  if (entry.teamContext === "attack") return teamId;
  if (entry.teamContext === "defense") return opponentId;
  return null;
}

export type XgWindowTotals = {
  xg: number;
  goals: number;
  shots: number;
};

/**
 * Suma xG / goli / strzałów w oknie po starcie (regain albo 8s ACC).
 * Ten sam strzał liczony raz; okna jednej drużyny nie nachodzą (do następnego startu).
 */
export function summarizeXgAfterStartWindows(
  starts: Array<{ teamId: string; timestamp: number }>,
  shots: Array<{
    id?: string;
    teamId: string;
    timestamp: number;
    xG: number;
    isGoal: boolean;
  }>,
  windowSeconds = XG_SEQUENCE_WINDOW_SECONDS,
): Map<string, XgWindowTotals> {
  const byTeam = new Map<string, XgWindowTotals>();
  const counted = new Set<string>();
  const startsByTeam = new Map<string, number[]>();

  for (const start of starts) {
    if (!start.teamId || !(start.timestamp > 0)) continue;
    const list = startsByTeam.get(start.teamId) ?? [];
    list.push(start.timestamp);
    startsByTeam.set(start.teamId, list);
  }

  for (const [teamId, timestamps] of startsByTeam) {
    timestamps.sort((a, b) => a - b);
    let xg = 0;
    let goals = 0;
    let shotCount = 0;
    for (let i = 0; i < timestamps.length; i++) {
      const start = timestamps[i];
      const nextStart = i + 1 < timestamps.length ? timestamps[i + 1] : Number.POSITIVE_INFINITY;
      const end = Math.min(start + windowSeconds, nextStart);
      for (const shot of shots) {
        if (shot.teamId !== teamId) continue;
        if (!(shot.timestamp > start) || shot.timestamp > end) continue;
        const key = shot.id?.trim() || `${shot.teamId}:${shot.timestamp}:${shot.xG}`;
        if (counted.has(key)) continue;
        counted.add(key);
        xg += Number.isFinite(shot.xG) ? shot.xG : 0;
        if (shot.isGoal) goals += 1;
        shotCount += 1;
      }
    }
    byTeam.set(teamId, { xg, goals, shots: shotCount });
  }

  return byTeam;
}

export type XgHalfFilter = "all" | "first" | "second";
export type XgCategoryFilter = "all" | "sfg" | "open_play";

export type XgMapFilters = {
  bodyPart: "all" | "foot" | "foot_left" | "foot_right" | "head" | "other";
  sfg: boolean;
  regain: boolean;
  goal: boolean;
  blocked: boolean;
  onTarget: boolean;
};

export type XgPlayerRow = {
  playerId: string;
  playerName: string;
  xg: number;
  shots: number;
  goals: number;
  /** Suma xG ze strzałów celnych i bramek (atak). Dla bramkarza także xG celnych strzałów w obronie. */
  xgOnTarget: number;
  shotsOnTarget: number;
  xgSfg: number;
  xgRegain: number;
  xgClean: number;
  cleanShots: number;
  avgLinePlayers: number;
  xgPerShot: number;
  xgSharePct: number;
};

export type XgHalfSideSlice = {
  xg: number;
  goals: number;
  shots: number;
};

export type XgTeamSideStats = {
  xg: number;
  npXg: number;
  npGoals: number;
  goals: number;
  shots: number;
  xgPerShot: number;
  npXgPerShot: number;
  xgOnTarget: number;
  shotsOnTarget: number;
  shotsBlocked: number;
  shotsOffTarget: number;
  xgBlocked: number;
  xgDiff: number;
  xgClean: number;
  cleanShots: number;
  goalsClean: number;
  avgLinePlayers: number;
  xgOpenPlay: number;
  xgCounter: number;
  counterShots: number;
  xgSfg: number;
  xgRegain: number;
  xgPenalty: number;
  penaltyShots: number;
  xgRebound: number;
  reboundShots: number;
  xgSfgDirect: number;
  xgSfgCombination: number;
  xgSfgPhase1: number;
  xgSfgPhase2: number;
  sfgDirectShots: number;
  sfgCombinationShots: number;
  sfgPhase1Shots: number;
  sfgPhase2Shots: number;
  conversionPct: number;
  onTargetPct: number;
  blockedPct: number;
  offTargetPct: number;
  efficiencyPct: number;
  npEfficiencyPct: number;
  assistXg: number;
  assistCount: number;
  controversialShots: number;
  controversialXg: number;
  xg1T: number;
  shots1T: number;
  contact1Pct: number;
  xgPerMinPossession: number;
  possessionMin: number;
  xgPerMatchMin: number;
  matchMinutes: number;
  firstHalf: XgHalfSideSlice;
  secondHalf: XgHalfSideSlice;
  xgDominancePct: number;
  /** Celne strzały przeciwnika w naszą bramkę (kontekst obrony). */
  gkOnTargetFaced: number;
  /** Obronione celne — celne bez bramki. */
  gkSavesOnTarget: number;
  /** Bramki stracone z celnych. */
  gkGoalsConcededOnTarget: number;
  /** % obronionych celnych (skuteczność bramkarza). */
  gkSavePct: number;
  gkXgOnTargetFaced: number;
  gkXgSaved: number;
};

export type XgBucketChartRow = {
  name: string;
  shots: number;
  xg: number;
  goals: number;
};

export function resolveShotTeamIdForSelectedTeam(
  shot: Shot,
  matchInfo: TeamInfo,
  selectedTeam: string,
): string | null {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  if (shot.teamId) return shot.teamId;
  if (shot.teamContext === "attack") {
    return isSelectedTeamHome ? matchInfo.team : matchInfo.opponent;
  }
  return isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;
}

export function filterShotsByHalf(shots: Shot[], half: XgHalfFilter): Shot[] {
  if (half === "first") return shots.filter((s) => s.minute <= 45);
  if (half === "second") return shots.filter((s) => s.minute > 45);
  return shots;
}

export function filterShotsByCategory(shots: Shot[], category: XgCategoryFilter): Shot[] {
  if (category === "sfg") {
    return shots.filter((shot) => isSfgCategoryShot(shot));
  }
  if (category === "open_play") {
    return shots.filter((shot) => {
      if ((shot as { actionCategory?: string }).actionCategory === "open_play") return true;
      return shot.actionType === "open_play" || shot.actionType === "counter" || shot.actionType === "regain";
    });
  }
  return shots;
}

export function isRegainShot(shot: Shot): boolean {
  return shot.actionType === "regain";
}

export function isCounterShot(shot: Shot): boolean {
  return shot.actionType === "counter";
}

export function isOnTargetShot(shot: Shot): boolean {
  return shot.shotType === "on_target" || shot.shotType === "goal" || Boolean(shot.isGoal);
}

export function isGoalShot(shot: Shot): boolean {
  return Boolean(shot.isGoal) || shot.shotType === "goal";
}

export function isBlockedShot(shot: Shot): boolean {
  return shot.shotType === "blocked";
}

/** Celny strzał w obronie bramkarza — bez zablokowanych i niecelnych. */
export function isGkFacedOnTargetShot(shot: Shot): boolean {
  return isOnTargetShot(shot) && !isBlockedShot(shot);
}

/** Celny strzał obroniony przez bramkarza (bez bramki). */
export function isSavedOnTargetShot(shot: Shot): boolean {
  return isGkFacedOnTargetShot(shot) && !isGoalShot(shot);
}

export type GoalkeeperSaveStats = {
  onTargetFaced: number;
  savesOnTarget: number;
  goalsConcededOnTarget: number;
  savePct: number;
  xgOnTargetFaced: number;
  xgSaved: number;
};

export function summarizeGoalkeeperSaves(defenseShotsFaced: Shot[]): GoalkeeperSaveStats {
  const onTargetFaced = defenseShotsFaced.filter(isGkFacedOnTargetShot);
  const savesOnTarget = onTargetFaced.filter(isSavedOnTargetShot);
  const goalsConcededOnTarget = onTargetFaced.filter(isGoalShot);
  return {
    onTargetFaced: onTargetFaced.length,
    savesOnTarget: savesOnTarget.length,
    goalsConcededOnTarget: goalsConcededOnTarget.length,
    savePct: pct(savesOnTarget.length, onTargetFaced.length),
    xgOnTargetFaced: sumXg(onTargetFaced),
    xgSaved: sumXg(savesOnTarget),
  };
}

/** Strzały w obronie wybranej strony (kontekst defense) — do xG OT bramkarza. */
export function getDefenseShotsFaced(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  side: "team" | "opponent" = "team",
): Shot[] {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const teamId = selectedTeam;
  const opponentId = isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;
  const attackingTeamId = side === "team" ? opponentId : teamId;
  return shots.filter(
    (s) => s.teamContext === "defense" && (!s.teamId || s.teamId === attackingTeamId),
  );
}

export function getSideShots(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  side: "team" | "opponent",
): Shot[] {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const teamId = selectedTeam;
  const opponentId = isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;
  const targetId = side === "team" ? teamId : opponentId;
  return shots.filter((s) => resolveShotTeamIdForSelectedTeam(s, matchInfo, selectedTeam) === targetId);
}

function getMatchMinutes(matchInfo: TeamInfo, half: XgHalfFilter): number {
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
    return (first + second) > 0 ? first + second : 90;
  }
  if (half === "first") return 45;
  if (half === "second") return 45;
  return 90;
}

function sliceHalfStats(shots: Shot[]): { firstHalf: XgHalfSideSlice; secondHalf: XgHalfSideSlice } {
  const first = shots.filter((s) => s.minute <= 45);
  const second = shots.filter((s) => s.minute > 45);
  return {
    firstHalf: {
      xg: sumXg(first),
      goals: countGoals(first),
      shots: first.length,
    },
    secondHalf: {
      xg: sumXg(second),
      goals: countGoals(second),
      shots: second.length,
    },
  };
}

function pct(n: number, total: number): number {
  return total > 0 ? (n / total) * 100 : 0;
}

function matchesMapTypeFilter(shot: Shot, filters: XgMapFilters): boolean {
  const allTypeFiltersOff = !filters.sfg && !filters.regain && !filters.goal && !filters.blocked && !filters.onTarget;
  if (allTypeFiltersOff) return true;

  let matchesAny = false;
  if (filters.sfg && isSfgCategoryShot(shot)) matchesAny = true;
  if (filters.regain && isRegainShot(shot)) matchesAny = true;
  if (filters.goal && shot.isGoal) matchesAny = true;
  if (filters.blocked && shot.shotType === "blocked") matchesAny = true;
  if (filters.onTarget && (shot.shotType === "on_target" || shot.shotType === "goal")) matchesAny = true;

  if (!matchesAny) {
    const isOffTarget = shot.shotType === "off_target";
    const isOpenPlay = shot.actionType === "open_play" || shot.actionType === "counter";
    const isOtherType = isOffTarget || (isOpenPlay && !isRegainShot(shot));
    return isOtherType && allTypeFiltersOff;
  }
  return true;
}

export function filterShotsForMap(shots: Shot[], filters: XgMapFilters): Shot[] {
  return shots.filter((shot) => {
    if (filters.bodyPart !== "all") {
      const bp = filters.bodyPart;
      const shotBp = shot.bodyPart;
      if (bp === "foot") {
        if (shotBp !== "foot" && shotBp !== "foot_left" && shotBp !== "foot_right") return false;
      } else if (shotBp !== bp) {
        return false;
      }
    }
    return matchesMapTypeFilter(shot, filters);
  });
}

function sumXg(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + (Number(s.xG) || 0), 0);
}

function countGoals(shots: Shot[]): number {
  return shots.filter((s) => s.isGoal || s.shotType === "goal").length;
}

function getPossessionMinutes(
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: XgHalfFilter,
  side: "team" | "opponent",
): number {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const field = side === "team"
    ? (isSelectedTeamHome ? "team" : "opponent")
    : (isSelectedTeamHome ? "opponent" : "team");

  if (half === "first") return matchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0;
  if (half === "second") return matchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0;
  return (
    (matchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0) +
    (matchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0)
  );
}

export function buildTeamSideStats(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: XgHalfFilter,
  side: "team" | "opponent",
): XgTeamSideStats {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const teamId = selectedTeam;
  const opponentId = isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;
  const targetId = side === "team" ? teamId : opponentId;

  const sideShots = getSideShots(shots, matchInfo, selectedTeam, side);
  const npShots = sideShots.filter((s) => s.actionType !== "penalty");
  const onTargetShots = sideShots.filter(isOnTargetShot);
  const blockedShots = sideShots.filter((s) => s.shotType === "blocked");
  const offTargetShots = sideShots.filter((s) => s.shotType === "off_target");
  const clean = summarizeCleanShots(sideShots);

  const sfgShots = sideShots.filter(isSfgCategoryShot);
  const regainShots = sideShots.filter(isRegainShot);
  const counterShots = sideShots.filter(isCounterShot);
  const penaltyShots = sideShots.filter((s) => s.actionType === "penalty");
  const reboundShots = sideShots.filter((s) => Boolean(s.previousShotId));
  const controversial = sideShots.filter((s) => s.isControversial);
  const assistGoalShots = sideShots.filter((s) => (s.isGoal || s.shotType === "goal") && Boolean(s.assistantId));

  const sfgDirectShots = sfgShots.filter((s) => s.sfgSubtype === "direct");
  const sfgCombinationShots = sfgShots.filter((s) => s.sfgSubtype === "combination");
  const sfgPhase1Shots = sfgShots.filter((s) => s.actionPhase === "phase1");
  const sfgPhase2Shots = sfgShots.filter((s) => s.actionPhase === "phase2");

  const xgSfg = sumXg(sfgShots);
  const xgRegain = sumXg(regainShots);
  const xgCounter = sumXg(counterShots);
  const xg = sumXg(sideShots);
  const npXg = sumXg(npShots);
  const goals = countGoals(sideShots);
  const npGoals = countGoals(npShots);
  const xgOpenPlay = Math.max(0, xg - xgSfg - xgRegain - xgCounter);

  const shots1T = side === "team"
    ? sideShots.filter(isIn1TZoneCanonical)
    : sideShots.filter(isInOpponent1TZoneCanonical);
  const shots1TContact1 = shots1T.filter((s) => s.isContact1 === true).length;

  const lineTotal = sideShots.reduce((sum, s) => sum + getShotLinePlayersCount(s), 0);
  const possessionMin = getPossessionMinutes(matchInfo, selectedTeam, half, side);
  const matchMinutes = getMatchMinutes(matchInfo, half);
  const halfSlices = sliceHalfStats(sideShots);
  const gkSaves = summarizeGoalkeeperSaves(
    getDefenseShotsFaced(shots, matchInfo, selectedTeam, side),
  );

  return {
    xg,
    npXg,
    npGoals,
    goals,
    shots: sideShots.length,
    xgPerShot: sideShots.length > 0 ? xg / sideShots.length : 0,
    npXgPerShot: npShots.length > 0 ? npXg / npShots.length : 0,
    xgOnTarget: sumXg(onTargetShots),
    shotsOnTarget: onTargetShots.length,
    shotsBlocked: blockedShots.length,
    shotsOffTarget: offTargetShots.length,
    xgBlocked: sumXg(blockedShots),
    xgDiff: xg - goals,
    xgClean: clean.xg,
    cleanShots: clean.shots,
    goalsClean: clean.goals,
    avgLinePlayers: sideShots.length > 0 ? lineTotal / sideShots.length : 0,
    xgOpenPlay,
    xgCounter,
    counterShots: counterShots.length,
    xgSfg,
    xgRegain,
    xgPenalty: sumXg(penaltyShots),
    penaltyShots: penaltyShots.length,
    xgRebound: sumXg(reboundShots),
    reboundShots: reboundShots.length,
    xgSfgDirect: sumXg(sfgDirectShots),
    xgSfgCombination: sumXg(sfgCombinationShots),
    xgSfgPhase1: sumXg(sfgPhase1Shots),
    xgSfgPhase2: sumXg(sfgPhase2Shots),
    sfgDirectShots: sfgDirectShots.length,
    sfgCombinationShots: sfgCombinationShots.length,
    sfgPhase1Shots: sfgPhase1Shots.length,
    sfgPhase2Shots: sfgPhase2Shots.length,
    conversionPct: pct(goals, sideShots.length),
    onTargetPct: pct(onTargetShots.length, sideShots.length),
    blockedPct: pct(blockedShots.length, sideShots.length),
    offTargetPct: pct(offTargetShots.length, sideShots.length),
    efficiencyPct: xg > 0 ? (goals / xg) * 100 : 0,
    npEfficiencyPct: npXg > 0 ? (npGoals / npXg) * 100 : 0,
    assistXg: sumXg(assistGoalShots),
    assistCount: assistGoalShots.length,
    controversialShots: controversial.length,
    controversialXg: sumXg(controversial),
    xg1T: sumXg(shots1T),
    shots1T: shots1T.length,
    contact1Pct: pct(shots1TContact1, shots1T.length),
    xgPerMinPossession: possessionMin > 0 ? xg / possessionMin : 0,
    possessionMin,
    xgPerMatchMin: matchMinutes > 0 ? xg / matchMinutes : 0,
    matchMinutes,
    firstHalf: halfSlices.firstHalf,
    secondHalf: halfSlices.secondHalf,
    xgDominancePct: 0,
    gkOnTargetFaced: gkSaves.onTargetFaced,
    gkSavesOnTarget: gkSaves.savesOnTarget,
    gkGoalsConcededOnTarget: gkSaves.goalsConcededOnTarget,
    gkSavePct: gkSaves.savePct,
    gkXgOnTargetFaced: gkSaves.xgOnTargetFaced,
    gkXgSaved: gkSaves.xgSaved,
  };
}

/** Udział xG zespołu w łącznej puli obu drużyn (0–100). */
export function applyXgDominancePct(teamStats: XgTeamSideStats, opponentStats: XgTeamSideStats): void {
  const total = teamStats.xg + opponentStats.xg;
  teamStats.xgDominancePct = total > 0 ? (teamStats.xg / total) * 100 : 0;
  opponentStats.xgDominancePct = total > 0 ? (opponentStats.xg / total) * 100 : 0;
}

export function buildSideShotsSummary(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  side: "team" | "opponent",
): WiedzaShotsSummary {
  return buildWiedzaShotsSummary(getSideShots(shots, matchInfo, selectedTeam, side));
}

export function buildXgBucketChartRows(rows: WiedzaShotBreakdownRow[]): XgBucketChartRow[] {
  return rows.map((row) => ({
    name: row.label,
    shots: row.count,
    xg: row.xg,
    goals: row.goals,
  }));
}

export type SfgBreakdownRow = {
  key: string;
  label: string;
  shots: number;
  xg: number;
  goals: number;
  avgXg: number;
};

export function buildSfgBreakdownRows(stats: XgTeamSideStats): SfgBreakdownRow[] {
  const rows: SfgBreakdownRow[] = [
    { key: "direct", label: "Bezpośredni", shots: stats.sfgDirectShots, xg: stats.xgSfgDirect, goals: 0, avgXg: 0 },
    { key: "combination", label: "Kombinacyjny", shots: stats.sfgCombinationShots, xg: stats.xgSfgCombination, goals: 0, avgXg: 0 },
    { key: "phase1", label: "I faza", shots: stats.sfgPhase1Shots, xg: stats.xgSfgPhase1, goals: 0, avgXg: 0 },
    { key: "phase2", label: "II faza", shots: stats.sfgPhase2Shots, xg: stats.xgSfgPhase2, goals: 0, avgXg: 0 },
  ];
  return rows
    .filter((r) => r.shots > 0 || r.xg > 0)
    .map((r) => ({ ...r, avgXg: r.shots > 0 ? r.xg / r.shots : 0 }));
}

function emptyPlayerRow(
  playerId: string,
  playerName: string,
): Omit<XgPlayerRow, "xgPerShot" | "xgSharePct"> {
  return {
    playerId,
    playerName,
    xg: 0,
    shots: 0,
    goals: 0,
    xgOnTarget: 0,
    shotsOnTarget: 0,
    xgSfg: 0,
    xgRegain: 0,
    xgClean: 0,
    cleanShots: 0,
    avgLinePlayers: 0,
  };
}

export function buildPlayerXgRows(
  teamShots: Shot[],
  teamXg: number,
  getPlayerName: (playerId: string) => string,
  defenseShotsFaced: Shot[] = [],
): XgPlayerRow[] {
  const acc: Record<string, Omit<XgPlayerRow, "xgPerShot" | "xgSharePct">> = {};

  const ensurePlayer = (playerId: string, playerName: string) => {
    if (!acc[playerId]) {
      acc[playerId] = emptyPlayerRow(playerId, playerName);
    }
    return acc[playerId];
  };

  for (const shot of teamShots) {
    const xgValue = Number(shot.xG) || 0;
    if (xgValue <= 0 && !shot.playerId) continue;

    const playerIdRaw = String(shot.playerId || "").trim();
    const fallbackName = String(shot.playerName || (shot as { player?: string }).player || "").trim();
    const playerId = playerIdRaw || `name:${fallbackName || "unknown"}`;
    const playerName = playerIdRaw ? getPlayerName(playerIdRaw) : (fallbackName || "Nieznany zawodnik");

    const row = ensurePlayer(playerId, playerName);
    row.xg += xgValue;
    row.shots += 1;
    if (shot.isGoal || shot.shotType === "goal") row.goals += 1;
    if (isOnTargetShot(shot)) {
      row.xgOnTarget += xgValue;
      row.shotsOnTarget += 1;
    }
    if (isSfgCategoryShot(shot)) row.xgSfg += xgValue;
    if (isRegainShot(shot)) row.xgRegain += xgValue;
    if (isCleanShot(shot)) {
      row.xgClean += xgValue;
      row.cleanShots += 1;
    }
    row.avgLinePlayers += getShotLinePlayersCount(shot);
  }

  for (const shot of defenseShotsFaced) {
    const playerIdRaw = String(shot.playerId || "").trim();
    if (!playerIdRaw || !isOnTargetShot(shot)) continue;
    const xgValue = Number(shot.xG) || 0;
    const row = ensurePlayer(playerIdRaw, getPlayerName(playerIdRaw));
    row.xgOnTarget += xgValue;
    row.shotsOnTarget += 1;
  }

  return Object.values(acc)
    .map((row) => ({
      ...row,
      avgLinePlayers: row.shots > 0 ? row.avgLinePlayers / row.shots : 0,
      xgPerShot: row.shots > 0 ? row.xg / row.shots : 0,
      xgSharePct: teamXg > 0 ? (row.xg / teamXg) * 100 : 0,
    }))
    .sort((a, b) => b.xg - a.xg);
}

export type XgCumulativePoint = {
  minute: number;
  teamXG: number;
  opponentXG: number;
  teamGoals: number;
  opponentGoals: number;
};

export function buildCumulativeXgChartData(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
): XgCumulativePoint[] {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const teamId = selectedTeam;
  const opponentId = isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;

  const sorted = [...shots].sort((a, b) => a.minute - b.minute);
  let teamXG = 0;
  let opponentXG = 0;
  let teamGoals = 0;
  let opponentGoals = 0;

  return sorted.map((shot) => {
    const shotTeamId = resolveShotTeamIdForSelectedTeam(shot, matchInfo, selectedTeam);
    const xgValue = Number(shot.xG) || 0;
    const isGoal = shot.isGoal || shot.shotType === "goal";

    if (shotTeamId === teamId) {
      teamXG += xgValue;
      if (isGoal) teamGoals += 1;
    } else if (shotTeamId === opponentId) {
      opponentXG += xgValue;
      if (isGoal) opponentGoals += 1;
    }

    return { minute: shot.minute, teamXG, opponentXG, teamGoals, opponentGoals };
  });
}

export type XgIntervalPoint = {
  minute: string;
  minuteValue: number;
  teamXG: number;
  opponentXG: number;
  teamOpenPlay: number;
  teamCounter: number;
  teamSfg: number;
  teamRegain: number;
  opponentOpenPlay: number;
  opponentCounter: number;
  opponentSfg: number;
  opponentRegain: number;
};

export function buildXg5MinChartData(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
): XgIntervalPoint[] {
  const isSelectedTeamHome = matchInfo.team === selectedTeam;
  const teamId = selectedTeam;
  const opponentId = isSelectedTeamHome ? matchInfo.opponent : matchInfo.team;

  const intervals: Record<number, XgIntervalPoint> = {};

  const ensure = (i: number): XgIntervalPoint => {
    if (!intervals[i]) {
      intervals[i] = {
        minute: `${i}-${i + 5}`,
        minuteValue: i,
        teamXG: 0,
        opponentXG: 0,
        teamOpenPlay: 0,
        teamCounter: 0,
        teamSfg: 0,
        teamRegain: 0,
        opponentOpenPlay: 0,
        opponentCounter: 0,
        opponentSfg: 0,
        opponentRegain: 0,
      };
    }
    return intervals[i];
  };

  for (const shot of shots) {
    const interval = Math.floor(shot.minute / 5) * 5;
    const bucket = ensure(interval);
    const shotTeamId = resolveShotTeamIdForSelectedTeam(shot, matchInfo, selectedTeam);
    const xgValue = Number(shot.xG) || 0;
    const isTeam = shotTeamId === teamId;
    const isOpp = shotTeamId === opponentId;
    if (!isTeam && !isOpp) continue;

    const prefix = isTeam ? "team" : "opponent";
    bucket[`${prefix}XG` as "teamXG"] += xgValue;
    if (isSfgCategoryShot(shot)) {
      bucket[`${prefix}Sfg` as "teamSfg"] += xgValue;
    } else if (isRegainShot(shot)) {
      bucket[`${prefix}Regain` as "teamRegain"] += xgValue;
    } else if (isCounterShot(shot)) {
      bucket[`${prefix}Counter` as "teamCounter"] += xgValue;
    } else {
      bucket[`${prefix}OpenPlay` as "teamOpenPlay"] += xgValue;
    }
  }

  const data: XgIntervalPoint[] = [];
  for (let i = 0; i <= 90; i += 5) {
    data.push(intervals[i] ?? ensure(i));
  }
  return data;
}

export function buildXgTabSummary(shots: Shot[]) {
  return buildWiedzaShotsSummary(shots);
}

export function buildTeamAndOpponentStats(
  shots: Shot[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  half: XgHalfFilter,
): { teamStats: XgTeamSideStats; opponentStats: XgTeamSideStats } {
  const teamStats = buildTeamSideStats(shots, matchInfo, selectedTeam, half, "team");
  const opponentStats = buildTeamSideStats(shots, matchInfo, selectedTeam, half, "opponent");
  applyXgDominancePct(teamStats, opponentStats);
  return { teamStats, opponentStats };
}
