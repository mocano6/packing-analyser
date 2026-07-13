import type { Action, TeamInfo } from "@/types";
import { computeAttackDefenseTilt } from "@/utils/attackDefenseTilt";
import { losesZoneRawForMap } from "@/utils/kpiRegainLosesZoneRaw";
import { regainXtValues } from "@/utils/statystykiZespoluRegainLosesFilters";
import { getLosesXtValues } from "@/utils/statystykiZespoluLosesStats";
import { normalizeWiedzaPitchZone } from "@/utils/wiedzaZoneHeatmaps";

export type TrendyRegainLosesTiltSide = {
  total: number;
  attackCount: number;
  defenseCount: number;
  attackXt: number;
  defenseXt: number;
};

export type TrendyRegainLosesTiltSummary = {
  regains: TrendyRegainLosesTiltSide;
  loses: TrendyRegainLosesTiltSide;
};

const EMPTY_SIDE: TrendyRegainLosesTiltSide = {
  total: 0,
  attackCount: 0,
  defenseCount: 0,
  attackXt: 0,
  defenseXt: 0,
};

function getTeamRegainActions(match: TeamInfo): Action[] {
  return (match.actions_regain ?? []).filter(
    (action) => action && (!action.teamId || action.teamId === match.team),
  );
}

function getTeamLoseActions(match: TeamInfo): Action[] {
  return (match.actions_loses ?? []).filter(
    (action) => action && action.isAut !== true && (!action.teamId || action.teamId === match.team),
  );
}

function accumulateRegains(actions: Action[]): TrendyRegainLosesTiltSide {
  const side = { ...EMPTY_SIDE };
  for (const action of actions) {
    side.total += 1;
    const { attackXt, defenseXt } = regainXtValues(action);
    side.attackCount += 1;
    side.defenseCount += 1;
    side.attackXt += attackXt;
    side.defenseXt += defenseXt;
  }
  return side;
}

function accumulateLoses(actions: Action[]): TrendyRegainLosesTiltSide {
  const side = { ...EMPTY_SIDE };
  for (const action of actions) {
    const zoneName = normalizeWiedzaPitchZone(losesZoneRawForMap(action));
    if (!zoneName) continue;
    const { attackXt, defenseXt } = getLosesXtValues(action);
    side.total += 1;
    side.attackCount += 1;
    side.defenseCount += 1;
    side.attackXt += attackXt;
    side.defenseXt += defenseXt;
  }
  return side;
}

function mergeSides(
  target: TrendyRegainLosesTiltSide,
  source: TrendyRegainLosesTiltSide,
): TrendyRegainLosesTiltSide {
  return {
    total: target.total + source.total,
    attackCount: target.attackCount + source.attackCount,
    defenseCount: target.defenseCount + source.defenseCount,
    attackXt: target.attackXt + source.attackXt,
    defenseXt: target.defenseXt + source.defenseXt,
  };
}

/** Suma przechwytów i strat zespołu z podziałem xT atak/obrona — jak w raporcie zespołu. */
export function buildTrendyRegainLosesTiltSummary(matches: TeamInfo[]): TrendyRegainLosesTiltSummary {
  let regains = { ...EMPTY_SIDE };
  let loses = { ...EMPTY_SIDE };

  for (const match of matches) {
    regains = mergeSides(regains, accumulateRegains(getTeamRegainActions(match)));
    loses = mergeSides(loses, accumulateLoses(getTeamLoseActions(match)));
  }

  return { regains, loses };
}

/** Krótki opis przewagi xT do nagłówka karty KPI w Trendach. */
export function formatTrendyTiltVerdictShort(side: TrendyRegainLosesTiltSide): string {
  const tilt = computeAttackDefenseTilt(side.attackXt, side.defenseXt);
  const diff = Math.abs(tilt.diff);
  if (tilt.direction === "attack") {
    return `przewaga xT w ataku (${tilt.attackShare.toFixed(0)}%)`;
  }
  if (tilt.direction === "defense") {
    return `przewaga xT w obronie (${tilt.defenseShare.toFixed(0)}%)`;
  }
  return `równowaga xT (${tilt.attackShare.toFixed(0)}% / ${tilt.defenseShare.toFixed(0)}%)`;
}
