import type { PkTeamSideStats } from "./statystykiZespoluPkStats";

export type PkComparisonMetric = {
  key: string;
  label: string;
  hint?: string;
  teamValue: number;
  oppValue: number;
  teamDisplay: string;
  oppDisplay: string;
  unit?: "int" | "pct";
  signedValues?: boolean;
};

function pctDisplay(value: number, fmt2: (n: number) => string): string {
  return `${fmt2(value)}%`;
}

export function buildPkComparisonMetrics(
  teamStats: PkTeamSideStats,
  opponentStats: PkTeamSideStats,
  fmt2: (n: number) => string,
  formatSigned: (n: number) => string,
): PkComparisonMetric[] {
  return [
    {
      key: "total_entries",
      label: "Wejścia łącznie",
      hint: "Liczba wejść w pole karne",
      unit: "int",
      teamValue: teamStats.entries,
      oppValue: opponentStats.entries,
      teamDisplay: String(teamStats.entries),
      oppDisplay: String(opponentStats.entries),
    },
    {
      key: "entries_dominance",
      label: "Udział wejść",
      hint: "Procent łącznej puli wejść w meczu",
      unit: "pct",
      teamValue: teamStats.entriesDominancePct,
      oppValue: opponentStats.entriesDominancePct,
      teamDisplay: pctDisplay(teamStats.entriesDominancePct, fmt2),
      oppDisplay: pctDisplay(opponentStats.entriesDominancePct, fmt2),
    },
    {
      key: "goals",
      label: "Gole po wejściu",
      unit: "int",
      teamValue: teamStats.goals,
      oppValue: opponentStats.goals,
      teamDisplay: String(teamStats.goals),
      oppDisplay: String(opponentStats.goals),
    },
    {
      key: "shots",
      label: "Strzały po wejściu",
      unit: "int",
      teamValue: teamStats.shots,
      oppValue: opponentStats.shots,
      teamDisplay: String(teamStats.shots),
      oppDisplay: String(opponentStats.shots),
    },
    {
      key: "shot_pct",
      label: "Wejście → strzał",
      hint: "Strzały / wejścia × 100",
      unit: "pct",
      teamValue: teamStats.shotPct,
      oppValue: opponentStats.shotPct,
      teamDisplay: pctDisplay(teamStats.shotPct, fmt2),
      oppDisplay: pctDisplay(opponentStats.shotPct, fmt2),
    },
    {
      key: "goal_from_shot_pct",
      label: "Strzał → gol",
      hint: "Gole / strzały × 100",
      unit: "pct",
      teamValue: teamStats.goalFromShotPct,
      oppValue: opponentStats.goalFromShotPct,
      teamDisplay: pctDisplay(teamStats.goalFromShotPct, fmt2),
      oppDisplay: pctDisplay(opponentStats.goalFromShotPct, fmt2),
    },
    {
      key: "regain_pct",
      label: "Wejścia po regainie",
      hint: "Procent wejść w PK po wcześniejszym odbiorze w oknie czasowym",
      unit: "pct",
      teamValue: teamStats.regainPct,
      oppValue: opponentStats.regainPct,
      teamDisplay: `${pctDisplay(teamStats.regainPct, fmt2)} (${teamStats.regains})`,
      oppDisplay: `${pctDisplay(opponentStats.regainPct, fmt2)} (${opponentStats.regains})`,
    },
    {
      key: "pk_advantage",
      label: "Przewaga w PK",
      hint: "Śr. partnerzy − śr. przeciwnicy w PK",
      signedValues: true,
      teamValue: teamStats.pkAdvantage,
      oppValue: opponentStats.pkAdvantage,
      teamDisplay: formatSigned(teamStats.pkAdvantage),
      oppDisplay: formatSigned(opponentStats.pkAdvantage),
    },
    {
      key: "avg_partners",
      label: "Śr. partnerzy w PK",
      teamValue: teamStats.avgPartners,
      oppValue: opponentStats.avgPartners,
      teamDisplay: fmt2(teamStats.avgPartners),
      oppDisplay: fmt2(opponentStats.avgPartners),
    },
    {
      key: "avg_opponents",
      label: "Śr. przeciwnicy w PK",
      teamValue: teamStats.avgOpponents,
      oppValue: opponentStats.avgOpponents,
      teamDisplay: fmt2(teamStats.avgOpponents),
      oppDisplay: fmt2(opponentStats.avgOpponents),
    },
    {
      key: "entries_per_min",
      label: "Wejścia / min pos.",
      teamValue: teamStats.entriesPerMinPossession,
      oppValue: opponentStats.entriesPerMinPossession,
      teamDisplay: `${fmt2(teamStats.entriesPerMinPossession)} (${fmt2(teamStats.possessionMin)} min)`,
      oppDisplay: `${fmt2(opponentStats.entriesPerMinPossession)} (${fmt2(opponentStats.possessionMin)} min)`,
    },
    {
      key: "entries_per_match_min",
      label: "Wejścia / min meczu",
      teamValue: teamStats.entriesPerMatchMin,
      oppValue: opponentStats.entriesPerMatchMin,
      teamDisplay: `${fmt2(teamStats.entriesPerMatchMin)} (${fmt2(teamStats.matchMinutes)} min)`,
      oppDisplay: `${fmt2(opponentStats.entriesPerMatchMin)} (${fmt2(opponentStats.matchMinutes)} min)`,
    },
    {
      key: "sfg",
      label: "SFG",
      unit: "int",
      teamValue: teamStats.sfgCount,
      oppValue: opponentStats.sfgCount,
      teamDisplay: String(teamStats.sfgCount),
      oppDisplay: String(opponentStats.sfgCount),
    },
    {
      key: "dribble",
      label: "Drybling",
      unit: "int",
      teamValue: teamStats.dribbleCount,
      oppValue: opponentStats.dribbleCount,
      teamDisplay: `${teamStats.dribbleCount} (po regainie ${teamStats.dribbleRegainCount})`,
      oppDisplay: `${opponentStats.dribbleCount} (po regainie ${opponentStats.dribbleRegainCount})`,
    },
    {
      key: "pass",
      label: "Podanie",
      unit: "int",
      teamValue: teamStats.passCount,
      oppValue: opponentStats.passCount,
      teamDisplay: `${teamStats.passCount} (po regainie ${teamStats.passRegainCount})`,
      oppDisplay: `${opponentStats.passCount} (po regainie ${opponentStats.passRegainCount})`,
    },
    {
      key: "controversial",
      label: "Kontrowersyjne",
      unit: "int",
      teamValue: teamStats.controversialEntries,
      oppValue: opponentStats.controversialEntries,
      teamDisplay: String(teamStats.controversialEntries),
      oppDisplay: String(opponentStats.controversialEntries),
    },
  ];
}
