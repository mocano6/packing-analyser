import type { PxtTeamSideStats } from "./statystykiZespoluPxtStats";

export type PxtComparisonMetric = {
  key: string;
  label: string;
  hint?: string;
  teamValue: number;
  oppValue: number;
  teamDisplay: string;
  oppDisplay: string;
  unit?: "int" | "pct";
};

function pctDisplay(value: number, fmt2: (n: number) => string): string {
  return `${fmt2(value)}%`;
}

export function buildPxtComparisonMetrics(
  teamStats: PxtTeamSideStats,
  opponentStats: PxtTeamSideStats,
  fmt2: (n: number) => string,
  fmt3: (n: number) => string,
): PxtComparisonMetric[] {
  return [
    {
      key: "total_pxt",
      label: "PxT łącznie",
      hint: "Suma ΔxT × punkty packing",
      teamValue: teamStats.pxt,
      oppValue: opponentStats.pxt,
      teamDisplay: fmt2(teamStats.pxt),
      oppDisplay: fmt2(opponentStats.pxt),
    },
    {
      key: "pxt_dominance",
      label: "Udział PxT",
      hint: "Procent łącznej puli PxT w meczu",
      unit: "pct",
      teamValue: teamStats.dominancePct,
      oppValue: opponentStats.dominancePct,
      teamDisplay: pctDisplay(teamStats.dominancePct, fmt2),
      oppDisplay: pctDisplay(opponentStats.dominancePct, fmt2),
    },
    {
      key: "total_xt",
      label: "ΔxT łącznie",
      teamValue: teamStats.xt,
      oppValue: opponentStats.xt,
      teamDisplay: fmt3(teamStats.xt),
      oppDisplay: fmt3(opponentStats.xt),
    },
    {
      key: "packing_pts",
      label: "Punkty packing",
      teamValue: teamStats.packing,
      oppValue: opponentStats.packing,
      teamDisplay: String(Math.round(teamStats.packing)),
      oppDisplay: String(Math.round(opponentStats.packing)),
      unit: "int",
    },
    {
      key: "actions",
      label: "Akcje",
      unit: "int",
      teamValue: teamStats.actionCount,
      oppValue: opponentStats.actionCount,
      teamDisplay: String(teamStats.actionCount),
      oppDisplay: String(opponentStats.actionCount),
    },
    {
      key: "passes",
      label: "Podania",
      unit: "int",
      teamValue: teamStats.passCount,
      oppValue: opponentStats.passCount,
      teamDisplay: String(teamStats.passCount),
      oppDisplay: String(opponentStats.passCount),
    },
    {
      key: "dribbles",
      label: "Dryblingi",
      unit: "int",
      teamValue: teamStats.dribbleCount,
      oppValue: opponentStats.dribbleCount,
      teamDisplay: String(teamStats.dribbleCount),
      oppDisplay: String(opponentStats.dribbleCount),
    },
    {
      key: "pxt_per_pass",
      label: "PxT / podanie",
      teamValue: teamStats.pxtPerPass,
      oppValue: opponentStats.pxtPerPass,
      teamDisplay: fmt3(teamStats.pxtPerPass),
      oppDisplay: fmt3(opponentStats.pxtPerPass),
    },
    {
      key: "pxt_per_dribble",
      label: "PxT / drybling",
      teamValue: teamStats.pxtPerDribble,
      oppValue: opponentStats.dribbleCount > 0 ? opponentStats.pxtPerDribble : 0,
      teamDisplay: fmt3(teamStats.pxtPerDribble),
      oppDisplay: opponentStats.dribbleCount > 0 ? fmt3(opponentStats.pxtPerDribble) : "—",
    },
    {
      key: "pxt_per_possession",
      label: "PxT / min pos.",
      hint: "PxT na minutę posiadania (jeśli dostępne)",
      teamValue: teamStats.pxtPerMinPossession,
      oppValue: opponentStats.pxtPerMinPossession,
      teamDisplay: teamStats.possessionMin > 0 ? fmt3(teamStats.pxtPerMinPossession) : "—",
      oppDisplay: opponentStats.possessionMin > 0 ? fmt3(opponentStats.pxtPerMinPossession) : "—",
    },
    {
      key: "p2_p3",
      label: "P2 + P3",
      unit: "int",
      teamValue: teamStats.p2Count + teamStats.p3Count,
      oppValue: opponentStats.p2Count + opponentStats.p3Count,
      teamDisplay: String(teamStats.p2Count + teamStats.p3Count),
      oppDisplay: String(opponentStats.p2Count + opponentStats.p3Count),
    },
    {
      key: "pk_entries",
      label: "Wejścia PK (z akcji)",
      unit: "int",
      teamValue: teamStats.pkCount,
      oppValue: opponentStats.pkCount,
      teamDisplay: String(teamStats.pkCount),
      oppDisplay: String(opponentStats.pkCount),
    },
    {
      key: "shots",
      label: "Strzały (z akcji)",
      unit: "int",
      teamValue: teamStats.shotCount,
      oppValue: opponentStats.shotCount,
      teamDisplay: String(teamStats.shotCount),
      oppDisplay: String(opponentStats.shotCount),
    },
    {
      key: "goals",
      label: "Gole (z akcji)",
      unit: "int",
      teamValue: teamStats.goalCount,
      oppValue: opponentStats.goalCount,
      teamDisplay: String(teamStats.goalCount),
      oppDisplay: String(opponentStats.goalCount),
    },
  ];
}
