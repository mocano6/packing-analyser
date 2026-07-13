import type { Action, PKEntry, Shot, TeamInfo } from "@/types";
import { getXTDifferenceForAction } from "@/utils/pxtFromAction";
import {
  filterRegainActionsForTab,
  filterLosesActionsForTab,
  type RegainLosesHalfPitchFilter,
  type RegainLosesPFilterKey,
} from "@/utils/statystykiZespoluRegainLosesFilters";

type Timestamped<T> = { item: T; timestamp: number };

function withTimestamp<T extends { videoTimestampRaw?: number; videoTimestamp?: number }>(
  items: T[],
): Timestamped<T>[] {
  return items
    .map((item) => ({
      item,
      timestamp: item.videoTimestampRaw ?? item.videoTimestamp ?? 0,
    }))
    .filter((row) => row.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export type RegainAfterStats = {
  totalXG8s: number;
  totalShots8s: number;
  totalPKEntries8s: number;
  totalPXT8s: number;
  totalPasses8s: number;
  totalXG15s: number;
  totalShots15s: number;
  totalPKEntries15s: number;
  totalPXT15s: number;
  totalPasses15s: number;
  totalLosesAfterRegain5s: number;
  losesAfterRegain5sPct: number;
};

export type LosesAfterStats = {
  reaction5sPct: number;
  reaction5sGood: number;
  reaction5sTotal: number;
  totalOpponentRegains5s: number;
  totalOpponentXG8s: number;
  totalOpponentShots8s: number;
  totalOpponentPKEntries8s: number;
  totalOpponentRegains8s: number;
  totalOpponentXG15s: number;
  totalOpponentShots15s: number;
  totalOpponentPKEntries15s: number;
  totalOpponentRegains15s: number;
};

export function buildRegainAfterStats(
  matchInfo: TeamInfo | null,
  regainActions: Action[],
  allActions: Action[],
  allShots: Shot[],
  allPkEntries: PKEntry[],
  allLosesActions: Action[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): RegainAfterStats {
  const empty: RegainAfterStats = {
    totalXG8s: 0,
    totalShots8s: 0,
    totalPKEntries8s: 0,
    totalPXT8s: 0,
    totalPasses8s: 0,
    totalXG15s: 0,
    totalShots15s: 0,
    totalPKEntries15s: 0,
    totalPXT15s: 0,
    totalPasses15s: 0,
    totalLosesAfterRegain5s: 0,
    losesAfterRegain5sPct: 0,
  };
  if (!matchInfo) return empty;

  const filtered = filterRegainActionsForTab(regainActions, halfPitchFilter, pFilters);
  const teamId = matchInfo.team;
  const isHome = matchInfo.isHome;

  const allActionsTs = withTimestamp(allActions);
  const allShotsTs = withTimestamp(allShots);
  const allPkTs = withTimestamp(allPkEntries);
  const allLosesTs = withTimestamp(allLosesActions);
  const regainTs = withTimestamp(filtered);

  let totalXG8s = 0;
  let totalShots8s = 0;
  let totalPKEntries8s = 0;
  let totalPXT8s = 0;
  let totalPasses8s = 0;
  let totalXG15s = 0;
  let totalShots15s = 0;
  let totalPKEntries15s = 0;
  let totalPXT15s = 0;
  let totalPasses15s = 0;
  let totalLosesAfterRegain5s = 0;

  const shotTeamId = (shot: Shot) =>
    shot.teamId
    || (shot.teamContext === "attack"
      ? (isHome ? matchInfo.team : matchInfo.opponent)
      : (isHome ? matchInfo.opponent : matchInfo.team));

  regainTs.forEach((regainRow, index) => {
    const regainTimestamp = regainRow.timestamp;
    const nextRegainTimestamp = index < regainTs.length - 1 ? regainTs[index + 1].timestamp : Infinity;
    const inWindow = (ts: number, maxOffset: number) =>
      ts > regainTimestamp && ts <= regainTimestamp + maxOffset && ts < nextRegainTimestamp;

    const teamShots = (maxOffset: number) =>
      allShotsTs.filter((row) => inWindow(row.timestamp, maxOffset) && shotTeamId(row.item) === teamId);
    const teamPk = (maxOffset: number) =>
      allPkTs.filter(
        (row) =>
          inWindow(row.timestamp, maxOffset)
          && (row.item.teamContext === "attack" || row.item.teamId === teamId),
      );
    const teamLoses = (maxOffset: number) =>
      allLosesTs.filter(
        (row) => inWindow(row.timestamp, maxOffset) && (row.item.teamId || teamId) === teamId,
      );
    const packingInWindow = (maxOffset: number) =>
      allActionsTs.filter((row) => inWindow(row.timestamp, maxOffset));

    const shots8 = teamShots(8);
    totalXG8s += shots8.reduce((s, r) => s + (r.item.xG || 0), 0);
    totalShots8s += shots8.length;
    totalPKEntries8s += teamPk(8).length;
    const pack8 = packingInWindow(8);
    totalPasses8s += pack8.filter((r) => r.item.actionType === "pass").length;
    pack8.forEach((r) => {
      totalPXT8s += getXTDifferenceForAction(r.item) * (r.item.packingPoints || 0);
    });

    const shots15 = teamShots(15);
    totalXG15s += shots15.reduce((s, r) => s + (r.item.xG || 0), 0);
    totalShots15s += shots15.length;
    totalPKEntries15s += teamPk(15).length;
    const pack15 = packingInWindow(15);
    totalPasses15s += pack15.filter((r) => r.item.actionType === "pass").length;
    pack15.forEach((r) => {
      totalPXT15s += getXTDifferenceForAction(r.item) * (r.item.packingPoints || 0);
    });

    totalLosesAfterRegain5s += teamLoses(5).length;
  });

  return {
    totalXG8s,
    totalShots8s,
    totalPKEntries8s,
    totalPXT8s,
    totalPasses8s,
    totalXG15s,
    totalShots15s,
    totalPKEntries15s,
    totalPXT15s,
    totalPasses15s,
    totalLosesAfterRegain5s,
    losesAfterRegain5sPct: regainTs.length > 0 ? (totalLosesAfterRegain5s / regainTs.length) * 100 : 0,
  };
}

export function buildLosesAfterStats(
  matchInfo: TeamInfo | null,
  selectedTeam: string,
  loseActions: Action[],
  regainActions: Action[],
  allShots: Shot[],
  allPkEntries: PKEntry[],
  halfPitchFilter: RegainLosesHalfPitchFilter,
  pFilters: RegainLosesPFilterKey[],
): LosesAfterStats {
  const empty: LosesAfterStats = {
    reaction5sPct: 0,
    reaction5sGood: 0,
    reaction5sTotal: 0,
    totalOpponentRegains5s: 0,
    totalOpponentXG8s: 0,
    totalOpponentShots8s: 0,
    totalOpponentPKEntries8s: 0,
    totalOpponentRegains8s: 0,
    totalOpponentXG15s: 0,
    totalOpponentShots15s: 0,
    totalOpponentPKEntries15s: 0,
    totalOpponentRegains15s: 0,
  };
  if (!matchInfo) return empty;

  const filteredLoses = filterLosesActionsForTab(loseActions, halfPitchFilter, pFilters);
  const losesWith5s = filteredLoses.filter((a) => {
    if (a.isAut === true) return false;
    const hasBad = a.isBadReaction5s === true || (a as Action & { isReaction5sNotApplicable?: boolean }).isReaction5sNotApplicable === true;
    return a.isReaction5s === true || hasBad;
  });
  const reaction5sGood = losesWith5s.filter((a) => a.isReaction5s === true).length;

  const opponentId = matchInfo.team === selectedTeam ? matchInfo.opponent : matchInfo.team;
  const isHome = matchInfo.isHome;
  const oppShotsTs = withTimestamp(allShots).filter((row) => {
    const shotTeam = row.item.teamId
      || (row.item.teamContext === "attack"
        ? (isHome ? matchInfo.team : matchInfo.opponent)
        : (isHome ? matchInfo.opponent : matchInfo.team));
    return shotTeam === opponentId;
  });
  const oppPkTs = withTimestamp(allPkEntries).filter(
    (row) => row.item.teamContext === "defense" || row.item.teamId === opponentId,
  );
  const regainTs = withTimestamp(regainActions);

  let totalOpponentXG8s = 0;
  let totalOpponentShots8s = 0;
  let totalOpponentPKEntries8s = 0;
  let totalOpponentRegains8s = 0;
  let totalOpponentXG15s = 0;
  let totalOpponentShots15s = 0;
  let totalOpponentPKEntries15s = 0;
  let totalOpponentRegains15s = 0;
  let totalOpponentRegains5s = 0;

  const losesTs = withTimestamp(filteredLoses);
  losesTs.forEach((loseRow, index) => {
    const loseTimestamp = loseRow.timestamp;
    const nextLoseTimestamp = index < losesTs.length - 1 ? losesTs[index + 1].timestamp : Infinity;
    const inWindow = (ts: number, maxOffset: number) =>
      ts > loseTimestamp && ts <= loseTimestamp + maxOffset && ts < nextLoseTimestamp;

    const oppShots = (max: number) => oppShotsTs.filter((r) => inWindow(r.timestamp, max));
    const oppPk = (max: number) => oppPkTs.filter((r) => inWindow(r.timestamp, max));
    const ourRegains = (max: number) => regainTs.filter((r) => inWindow(r.timestamp, max));

    const s8 = oppShots(8);
    totalOpponentXG8s += s8.reduce((s, r) => s + (r.item.xG || 0), 0);
    totalOpponentShots8s += s8.length;
    totalOpponentPKEntries8s += oppPk(8).length;
    totalOpponentRegains8s += ourRegains(8).length;

    const s15 = oppShots(15);
    totalOpponentXG15s += s15.reduce((s, r) => s + (r.item.xG || 0), 0);
    totalOpponentShots15s += s15.length;
    totalOpponentPKEntries15s += oppPk(15).length;
    totalOpponentRegains15s += ourRegains(15).length;
    totalOpponentRegains5s += ourRegains(5).length;
  });

  return {
    reaction5sPct: losesWith5s.length > 0 ? (reaction5sGood / losesWith5s.length) * 100 : 0,
    reaction5sGood,
    reaction5sTotal: losesWith5s.length,
    totalOpponentRegains5s,
    totalOpponentXG8s,
    totalOpponentShots8s,
    totalOpponentPKEntries8s,
    totalOpponentRegains8s,
    totalOpponentXG15s,
    totalOpponentShots15s,
    totalOpponentPKEntries15s,
    totalOpponentRegains15s,
  };
}
