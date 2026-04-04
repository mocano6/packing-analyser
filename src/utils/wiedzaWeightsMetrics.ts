import { TeamInfo } from "../types";
import {
  buildPearsonCorrelationMatrix,
  getOpponentGoalsForMatch,
  getOpponentPKEntriesCountForMatch,
  getOpponentShotsCountForMatch,
  getOpponentXgPerShot,
  getOpponentXGForMatch,
  getTeamGoalsForMatch,
  getTeamMatchWinIndicatorForMatch,
  getTeamMatchDrawIndicatorForMatch,
  getTeamMatchLossIndicatorForMatch,
  getTeamCounterpress5sPctForMatch,
  getTeamPKEntriesCountForMatch,
  getTeamLosesInPMAreaCountForMatch,
  getTeamLosesOwnHalfNonAutCountForMatch,
  getTeamRegainsInPMAreaCountForMatch,
  getTeamRegainsOpponentHalfCountForMatch,
  getTeamShotsCountForMatch,
  getTeamShotsOnTargetCountForMatch,
  getTeamShotsBlockedCountForMatch,
  getOpponentShotsOnTargetCountForMatch,
  getOpponentShotsBlockedCountForMatch,
  getTeamXgForMatch,
  getTeamXgPerShotForMatch,
  getTeamGoalsPerShotForMatch,
  getOpponentGoalsPerShotForMatch,
  getTeamPxtForMatch,
  getTeamXtDeltaSumForMatch,
  getTeamPackingPointsSumForMatch,
  getTeamP2CountForMatch,
  getTeamP3CountForMatch,
  getTeamRegainsFullPitchCountForMatch,
  getTeamLosesFullPitchCountForMatch,
  getTeamPossessionPct,
  getOpponentPossessionPct,
  getDeadTimePct,
  getTeamAcc8sPctForMatch,
  getTeamOneTouchPctForMatch,
  getTeamRegainsPp8sCaPctForMatch,
} from "./trendyKpis";
import {
  getTeamXgOpenPlayForMatch,
  getOpponentXgOpenPlayForMatch,
  getTeamXgSfgForMatch,
  getOpponentXgSfgForMatch,
  getTeamXgRegainWindowsForMatch,
  getOpponentXgRegainWindowsForMatch,
} from "./matchXgSplits";
import type { CorrelationMatrixAxisSide } from "./correlationMatrixAxis";

/** Pojedyncza kolumna/wiersz w macierzy „Wagi”. */
export type WiedzaWeightsMetric = {
  id: string;
  label: string;
  getValue: (match: TeamInfo) => number;
  /** Kolor nagłówka: nasz klub / przeciwnik / wynik (W–R–P) / obie strony lub agregat. */
  axisSide: CorrelationMatrixAxisSide;
};

/**
 * Definicja źródłowa: para MY/OPP lub tylko MY (np. PM).
 * Z niej powstaje jedna duża macierz — widać korelacje między naszymi i przeciwnika metrykami (także ujemne).
 */
export type WiedzaWeightsMetricDef = {
  id: string;
  label: string;
  /** Etykieta kolumny OPP, gdy nie jest symetryczna do MY (np. przechwyty vs straty wł. pp.). */
  labelOpponent?: string;
  getTeam: (match: TeamInfo) => number;
  getOpponent?: (match: TeamInfo) => number;
};

export const WIEDZA_WEIGHTS_METRIC_DEFS: WiedzaWeightsMetricDef[] = [
  { id: "w_goals", label: "Gole", getTeam: getTeamGoalsForMatch, getOpponent: getOpponentGoalsForMatch },
  { id: "w_shots", label: "Strzały", getTeam: getTeamShotsCountForMatch, getOpponent: getOpponentShotsCountForMatch },
  {
    id: "w_shots_on_target",
    label: "Strzały celne",
    getTeam: getTeamShotsOnTargetCountForMatch,
    getOpponent: getOpponentShotsOnTargetCountForMatch,
  },
  {
    id: "w_shots_blocked",
    label: "Strzały zablokowane",
    getTeam: getTeamShotsBlockedCountForMatch,
    getOpponent: getOpponentShotsBlockedCountForMatch,
  },
  { id: "w_pk", label: "PK", getTeam: getTeamPKEntriesCountForMatch, getOpponent: getOpponentPKEntriesCountForMatch },
  { id: "w_xg", label: "xG", getTeam: getTeamXgForMatch, getOpponent: getOpponentXGForMatch },
  {
    id: "w_xg_per_shot",
    label: "xG/strz.",
    getTeam: getTeamXgPerShotForMatch,
    getOpponent: getOpponentXgPerShot,
  },
  {
    id: "w_goals_per_shot",
    label: "Gole/strz.",
    getTeam: getTeamGoalsPerShotForMatch,
    getOpponent: getOpponentGoalsPerShotForMatch,
  },
  {
    id: "w_xg_open",
    label: "xG otw. gra",
    getTeam: getTeamXgOpenPlayForMatch,
    getOpponent: getOpponentXgOpenPlayForMatch,
  },
  {
    id: "w_xg_sfg",
    label: "xG SFG",
    getTeam: getTeamXgSfgForMatch,
    getOpponent: getOpponentXgSfgForMatch,
  },
  {
    id: "w_xg_regain",
    label: "xG po regain",
    getTeam: getTeamXgRegainWindowsForMatch,
    getOpponent: getOpponentXgRegainWindowsForMatch,
  },
  /**
   * MY: przechwyty na całym boisku. OPP: straty własnej połowy (bez aut) — ten sam licznik co wcześniej w osobnym wierszu „Straty wł. pp. MY” (usunięty, żeby nie duplikować macierzy).
   */
  {
    id: "w_regains_full_pitch",
    label: "Przechw. całe b.",
    labelOpponent: "Straty wł. pp.",
    getTeam: getTeamRegainsFullPitchCountForMatch,
    getOpponent: getTeamLosesOwnHalfNonAutCountForMatch,
  },
  {
    id: "w_loses_full_pitch",
    label: "Straty całe b.",
    getTeam: getTeamLosesFullPitchCountForMatch,
  },
  {
    id: "w_possession_pct",
    label: "Posiadanie %",
    getTeam: getTeamPossessionPct,
    getOpponent: getOpponentPossessionPct,
  },
  { id: "w_dead_time_pct", label: "Czas martwy %", getTeam: getDeadTimePct },
  { id: "w_acc8s_pct", label: "8s ACC %", getTeam: getTeamAcc8sPctForMatch },
  { id: "w_one_touch_pct", label: "1T %", getTeam: getTeamOneTouchPctForMatch },
  { id: "w_8s_ca_pct", label: "8s CA %", getTeam: getTeamRegainsPp8sCaPctForMatch },
  { id: "w_loses_pm", label: "Straty PM", getTeam: getTeamLosesInPMAreaCountForMatch },
  { id: "w_regains_pm", label: "Przechw. PM", getTeam: getTeamRegainsInPMAreaCountForMatch },
  {
    id: "w_regains_opp_half",
    label: "Przechw. pp. przec.",
    getTeam: getTeamRegainsOpponentHalfCountForMatch,
  },
  { id: "w_5s_pct", label: "5s %", getTeam: getTeamCounterpress5sPctForMatch },
  { id: "w_pxt", label: "PxT", getTeam: getTeamPxtForMatch },
  { id: "w_xt_delta", label: "xT (suma Δ)", getTeam: getTeamXtDeltaSumForMatch },
  { id: "w_packing_pts", label: "Packing (suma pkt)", getTeam: getTeamPackingPointsSumForMatch },
  { id: "w_p2", label: "P2", getTeam: getTeamP2CountForMatch },
  { id: "w_p3", label: "P3", getTeam: getTeamP3CountForMatch },
];

/** Wszystkie metryki do jednej macierzy: MY i OPP obok siebie (gdzie jest para). */
export function getWiedzaWeightsMetricsFull(): WiedzaWeightsMetric[] {
  const out: WiedzaWeightsMetric[] = [
    {
      id: "w_match_win",
      label: "Wygrana",
      getValue: getTeamMatchWinIndicatorForMatch,
      axisSide: "outcome",
    },
    {
      id: "w_match_draw",
      label: "Remis",
      getValue: getTeamMatchDrawIndicatorForMatch,
      axisSide: "outcome",
    },
    {
      id: "w_match_loss",
      label: "Przegrana",
      getValue: getTeamMatchLossIndicatorForMatch,
      axisSide: "outcome",
    },
  ];
  for (const d of WIEDZA_WEIGHTS_METRIC_DEFS) {
    out.push({
      id: `${d.id}_my`,
      label: `${d.label} MY`,
      getValue: d.getTeam,
      axisSide: "my",
    });
    if (d.getOpponent) {
      out.push({
        id: `${d.id}_opp`,
        label: `${d.labelOpponent ?? d.label} OPP`,
        getValue: d.getOpponent,
        axisSide: "opp",
      });
    }
  }
  return out;
}

/** Pełna lista metryk (alias do macierzy i testów). */
export const WIEDZA_WEIGHTS_METRICS: WiedzaWeightsMetric[] = getWiedzaWeightsMetricsFull();

export type WiedzaWeightsCorrelationResult = {
  metrics: WiedzaWeightsMetric[];
  matrix: (number | null)[][];
};

export function buildWiedzaWeightsCorrelation(
  matches: TeamInfo[],
  minSamples = 3,
): WiedzaWeightsCorrelationResult | null {
  const metrics = getWiedzaWeightsMetricsFull();
  if (matches.length < minSamples || metrics.length === 0) return null;
  const columns = metrics.map((m) => matches.map((x) => m.getValue(x)));
  /** Musi być zgodne z kolejnością trzech pierwszych wpisów w `out` powyżej (Wygrana, Remis, Przegrana). */
  const matrix = buildPearsonCorrelationMatrix(columns, minSamples, {
    omitZeroValues: true,
    binaryIndicatorColumnIndices: new Set([0, 1, 2]),
  });
  return { metrics, matrix };
}
