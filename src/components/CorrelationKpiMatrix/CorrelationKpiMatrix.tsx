"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadTrendyKpiDefinitions } from "@/lib/trendyKpiStore";
import {
  buildPearsonCorrelationMatrix,
  calculateTrendyKpiValue,
  correlationMatrixRowOrder,
  correlationMatrixRowOrderByReferenceColumn,
  DEFAULT_TRENDY_KPI_DEFINITIONS,
  getOpponentGoalsForMatch,
  getOpponentXGForMatch,
  getOpponentXgPerShot,
  getTeamGoalsPerShotForMatch,
  getOpponentGoalsPerShotForMatch,
  getRegainsFullPitchCount,
  getLosesFullPitchCount,
  getTeamGoalsForMatch,
  getTeamRegainsOpponentHalfCountForMatch,
  getTeamShotsBlockedCountForMatch,
  getTeamShotsOnTargetCountForMatch,
  getTeamXgForMatch,
  getOpponentShotsBlockedCountForMatch,
  getOpponentShotsOnTargetCountForMatch,
  permuteSquareCorrelationMatrix,
  getTeamMatchWinIndicatorForMatch,
  getTeamMatchDrawIndicatorForMatch,
  getTeamMatchLossIndicatorForMatch,
  type CorrelationMatrixLabelSortMode,
  type CorrelationMatrixSortMode,
  type TrendyKpiDefinition,
} from "@/utils/trendyKpis";
import { TeamInfo } from "@/types";
import {
  buildCorrelationKpiMatrixExportPayload,
  correlationMatrixExportFilename,
} from "@/utils/correlationMatrixExport";
import styles from "./CorrelationKpiMatrix.module.css";
import {
  correlationAxisHeadClass,
  trendyKpiCorrelationAxisSide,
  type CorrelationMatrixAxisSide,
} from "@/utils/correlationMatrixAxis";

/** Kolor komórki: zielono / czerwono tylko przy |r| ≥ tym progu. */
const CORR_HIGHLIGHT_ABS = 0.4;

type MatrixMetric = {
  id: string;
  label: string;
  /** Kolejność „trend”: po KPI z definicji, potem rosnąco dodatkowe */
  sortOrder: number;
  getValue: (m: TeamInfo) => number;
  axisSide: CorrelationMatrixAxisSide;
};

/** Metryki meczowe dodatkowe w macierzy (Baza wiedzy / korelacje). */
const CORRELATION_EXTRA_METRICS: MatrixMetric[] = [
  {
    id: "corr_team_goals",
    label: "Gole zespołu",
    sortOrder: 1001,
    getValue: getTeamGoalsForMatch,
    axisSide: "my",
  },
  {
    id: "corr_opponent_goals",
    label: "Gole przeciwnika",
    sortOrder: 1002,
    getValue: getOpponentGoalsForMatch,
    axisSide: "opp",
  },
  {
    id: "corr_team_xg",
    label: "xG zespołu",
    sortOrder: 1003,
    getValue: getTeamXgForMatch,
    axisSide: "my",
  },
  {
    id: "corr_opponent_xg",
    label: "xG przeciwnika",
    sortOrder: 1004,
    getValue: getOpponentXGForMatch,
    axisSide: "opp",
  },
  {
    id: "corr_regains_full",
    label: "Przechwyty (całe boisko)",
    sortOrder: 1005,
    getValue: getRegainsFullPitchCount,
    axisSide: "neutral",
  },
  {
    id: "corr_loses_full",
    label: "Straty (całe boisko)",
    sortOrder: 1006,
    getValue: getLosesFullPitchCount,
    axisSide: "neutral",
  },
  {
    id: "corr_opponent_xg_per_shot",
    label: "xG/strzał przeciwnika",
    sortOrder: 1007,
    getValue: getOpponentXgPerShot,
    axisSide: "opp",
  },
  {
    id: "corr_team_goals_per_shot",
    label: "Gole/strzał zespołu",
    sortOrder: 1008,
    getValue: getTeamGoalsPerShotForMatch,
    axisSide: "my",
  },
  {
    id: "corr_opponent_goals_per_shot",
    label: "Gole/strzał przeciwnika",
    sortOrder: 1009,
    getValue: getOpponentGoalsPerShotForMatch,
    axisSide: "opp",
  },
  {
    id: "corr_team_regains_opp_half",
    label: "Przechw. nasz na pp. przec.",
    sortOrder: 1010,
    getValue: getTeamRegainsOpponentHalfCountForMatch,
    axisSide: "my",
  },
  {
    id: "corr_team_shots_on_target",
    label: "Strzały celne zespołu",
    sortOrder: 1011,
    getValue: getTeamShotsOnTargetCountForMatch,
    axisSide: "my",
  },
  {
    id: "corr_opponent_shots_on_target",
    label: "Strzały celne przeciwnika",
    sortOrder: 1012,
    getValue: getOpponentShotsOnTargetCountForMatch,
    axisSide: "opp",
  },
  {
    id: "corr_team_shots_blocked",
    label: "Strzały zablokowane zespołu",
    sortOrder: 1013,
    getValue: getTeamShotsBlockedCountForMatch,
    axisSide: "my",
  },
  {
    id: "corr_opponent_shots_blocked",
    label: "Strzały zablokowane przeciwnika",
    sortOrder: 1014,
    getValue: getOpponentShotsBlockedCountForMatch,
    axisSide: "opp",
  },
];

export type CorrelationKpiMatrixProps = {
  matches: TeamInfo[];
  isPresentationMode?: boolean;
  /** Tekst uzupełniający podpowiedź (np. wiele zespołów) */
  scopeHint?: string;
  /** Mniejsza czcionka i paddingi (np. Baza wiedzy). */
  compact?: boolean;
  /** Ukrywa akapit z objaśnieniem (gdy opis jest nad komponentem). */
  hideHint?: boolean;
};

export default function CorrelationKpiMatrix({
  matches,
  isPresentationMode = false,
  scopeHint,
  compact = false,
  hideHint = false,
}: CorrelationKpiMatrixProps) {
  const [kpiDefinitions, setKpiDefinitions] = useState<TrendyKpiDefinition[]>(DEFAULT_TRENDY_KPI_DEFINITIONS);
  const [sortMode, setSortMode] = useState<CorrelationMatrixSortMode>("trend");
  const [sortRefColumnIndex, setSortRefColumnIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const defs = await loadTrendyKpiDefinitions();
        if (!cancelled) setKpiDefinitions(defs);
      } catch {
        if (!cancelled) setKpiDefinitions(DEFAULT_TRENDY_KPI_DEFINITIONS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendyKpisForMatrix = useMemo(() => {
    return kpiDefinitions
      .filter((kpi) => kpi.active && kpi.id !== "dead_time_pct")
      .sort((a, b) => {
        if (a.id === "xg_for") return -1;
        if (b.id === "xg_for") return 1;
        return a.order - b.order;
      });
  }, [kpiDefinitions]);

  const matrixMetrics = useMemo((): MatrixMetric[] => {
    const matchWin: MatrixMetric = {
      id: "corr_match_win",
      label: "Wygrana",
      sortOrder: -1000,
      getValue: getTeamMatchWinIndicatorForMatch,
      axisSide: "outcome",
    };
    const matchDraw: MatrixMetric = {
      id: "corr_match_draw",
      label: "Remis",
      sortOrder: -999,
      getValue: getTeamMatchDrawIndicatorForMatch,
      axisSide: "outcome",
    };
    const matchLoss: MatrixMetric = {
      id: "corr_match_loss",
      label: "Przegrana",
      sortOrder: -998,
      getValue: getTeamMatchLossIndicatorForMatch,
      axisSide: "outcome",
    };
    const trendyPart: MatrixMetric[] = trendyKpisForMatrix.map((def) => ({
      id: def.id,
      label: def.label,
      sortOrder: def.order,
      getValue: (m: TeamInfo) => calculateTrendyKpiValue(m, def.id),
      axisSide: trendyKpiCorrelationAxisSide(def.id),
    }));
    const hasTrendyXg = trendyKpisForMatrix.some((d) => d.id === "xg_for");
    const extras = CORRELATION_EXTRA_METRICS.filter((e) => !(hasTrendyXg && e.id === "corr_team_xg"));
    return [matchWin, matchDraw, matchLoss, ...trendyPart, ...extras];
  }, [trendyKpisForMatrix]);

  const rawMatrix = useMemo(() => {
    if (matches.length < 3 || matrixMetrics.length === 0) return null;
    const columns = matrixMetrics.map((metric) => matches.map((m) => metric.getValue(m)));
    return buildPearsonCorrelationMatrix(columns, 3, {
      omitZeroValues: true,
      binaryIndicatorColumnIndices: new Set([0, 1, 2]),
    });
  }, [matches, matrixMetrics]);

  const display = useMemo(() => {
    if (!rawMatrix || matrixMetrics.length === 0) return null;
    const n = matrixMetrics.length;
    const refIdx = Math.min(Math.max(0, sortRefColumnIndex), n - 1);
    const labels = matrixMetrics.map((d) => d.label);
    let order: number[];
    if (sortMode === "column_desc") {
      order = correlationMatrixRowOrderByReferenceColumn(rawMatrix, refIdx, "desc");
    } else if (sortMode === "column_asc") {
      order = correlationMatrixRowOrderByReferenceColumn(rawMatrix, refIdx, "asc");
    } else {
      order = correlationMatrixRowOrder(labels, rawMatrix, sortMode as CorrelationMatrixLabelSortMode);
    }
    const defs = order.map((idx) => matrixMetrics[idx]);
    const matrix = permuteSquareCorrelationMatrix(rawMatrix, order);
    return { defs, matrix };
  }, [rawMatrix, matrixMetrics, sortMode, sortRefColumnIndex]);

  const onSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (
      v === "trend" ||
      v === "alpha_pl" ||
      v === "avg_abs" ||
      v === "column_desc" ||
      v === "column_asc"
    ) {
      setSortMode(v);
    }
  }, []);

  const onRefColumnChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const i = Number.parseInt(e.target.value, 10);
    if (Number.isFinite(i) && i >= 0) setSortRefColumnIndex(i);
  }, []);

  const onExportJson = useCallback(() => {
    if (!display || typeof window === "undefined" || matrixMetrics.length === 0) return;
    const exportedAt = new Date().toISOString();
    const refIdx = Math.min(Math.max(0, sortRefColumnIndex), matrixMetrics.length - 1);
    const refMetric = matrixMetrics[refIdx];
    const columnSortReference =
      sortMode === "column_desc" || sortMode === "column_asc"
        ? {
            metricId: refMetric.id,
            label: refMetric.label,
            direction: sortMode === "column_desc" ? ("desc" as const) : ("asc" as const),
          }
        : undefined;
    const payload = buildCorrelationKpiMatrixExportPayload({
      exportedAt,
      matchCount: matches.length,
      sortMode,
      columnSortReference,
      scopeHint,
      metrics: display.defs.map((d) => ({ id: d.id, label: d.label })),
      matrix: display.matrix,
    });
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = correlationMatrixExportFilename(exportedAt);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [display, matches.length, matrixMetrics, sortMode, sortRefColumnIndex, scopeHint]);

  return (
    <div className={compact ? `${styles.section} ${styles.sectionCompact}` : styles.section}>
      {!hideHint ? (
        <p className={styles.hint}>
          Jedna próba = jeden mecz. Pierwsze wiersze: <strong>Wygrana, Remis, Przegrana</strong> (0/1 z goli, jedna jedynka na mecz), z perspektywy klubu z
          dokumentu meczu. Korelacja Pearsona r; <strong>kolory komórek:</strong> zielono r ≥ 0,4, czerwono r ≤ −0,4.{" "}
          <strong>Nagłówki wierszy/kolumn:</strong> niebieski — nasz zespół, bursztynowy — przeciwnik, fioletowy — wynik (W/R/P), szary — obie strony / agregat.
          Dodatkowe
          kolumny: gole/xG obu drużyn, przechwyty/straty, xG/strzał przeciwnika, gole/strzał zespołu i przeciwnika, strzały celne i zablokowane (nasze / przeciwnika); PxT i P2/P3
          są w wierszach trendów KPI (bez duplikatu xG zespołu, gdy jest w trendach). Straty wł. pp. (bez aut) są tylko w macierzy
          Wagi (kolumna OPP przy przechwytach całe b.) — tu bez drugiego wiersza z tym samym licznikiem. Dla każdej pary metryk pomijane są mecze, w których którakolwiek
          wartość to 0.
          {scopeHint ? ` ${scopeHint}` : ""}
        </p>
      ) : null}
      {matches.length < 3 ? (
        <p className={styles.empty}>Potrzebujesz co najmniej trzech meczów w próbie, aby policzyć macierz.</p>
      ) : display ? (
        <>
          <div className={styles.toolbar}>
            <label htmlFor="correlation-kpi-matrix-sort" className={styles.sortLabel}>
              Sortuj wiersze i kolumny
            </label>
            <select
              id="correlation-kpi-matrix-sort"
              name="correlationKpiMatrixSort"
              className={styles.select}
              value={sortMode}
              onChange={onSortChange}
              aria-label="Sortowanie macierzy korelacji KPI"
            >
              <option value="trend">Kolejność listy trendów</option>
              <option value="alpha_pl">Alfabetycznie (A–Ż)</option>
              <option value="avg_abs">Średnia |korelacja| z innymi (malejąco)</option>
              <option value="column_desc">Po kolumnie: od największej korelacji</option>
              <option value="column_asc">Po kolumnie: od najmniejszej korelacji</option>
            </select>
            {(sortMode === "column_desc" || sortMode === "column_asc") && matrixMetrics.length > 0 ? (
              <>
                <label htmlFor="correlation-kpi-ref-col" className={styles.sortLabel}>
                  Metryka (kolumna referencyjna)
                </label>
                <select
                  id="correlation-kpi-ref-col"
                  name="correlationKpiRefColumn"
                  className={styles.select}
                  value={Math.min(Math.max(0, sortRefColumnIndex), matrixMetrics.length - 1)}
                  onChange={onRefColumnChange}
                  aria-label="Metryka referencyjna do sortowania po kolumnie"
                >
                  {matrixMetrics.map((m, i) => (
                    <option key={m.id} value={i}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <button
              type="button"
              className={styles.exportButton}
              onClick={onExportJson}
              aria-label="Pobierz macierz korelacji jako plik JSON do analizy w modelu LLM"
            >
              Pobierz JSON (LLM)
            </button>
          </div>
          <div
            className={styles.scroll}
            role="region"
            aria-label="Tabela korelacji Pearsona między KPI"
            tabIndex={0}
          >
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Macierz korelacji Pearsona między KPI trendów, wartości od minus jeden do jeden.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.corner}>
                    KPI
                  </th>
                  {display.defs.map((def, colIdx) => (
                    <th
                      key={def.id}
                      scope="col"
                      className={`${styles.colHead} ${correlationAxisHeadClass(def.axisSide, styles)}`}
                      title={def.label}
                    >
                      {isPresentationMode ? `K${colIdx + 1}` : def.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.defs.map((rowDef, i) => (
                  <tr key={rowDef.id}>
                    <th
                      scope="row"
                      className={`${styles.rowHead} ${correlationAxisHeadClass(rowDef.axisSide, styles)}`}
                      title={rowDef.label}
                    >
                      {isPresentationMode ? `K${i + 1}` : rowDef.label}
                    </th>
                    {display.matrix[i].map((r, j) => {
                      const colDef = display.defs[j];
                      const isDiagonal = i === j;
                      const toneClass = isDiagonal
                        ? styles.corrCellNA
                        : r == null
                          ? styles.corrCellNA
                          : r >= CORR_HIGHLIGHT_ABS
                            ? styles.corrCellPosStrong
                            : r <= -CORR_HIGHLIGHT_ABS
                              ? styles.corrCellNegStrong
                              : styles.corrCellNeutral;
                      const labelA = isPresentationMode ? `K${i + 1}` : rowDef.label;
                      const labelB = isPresentationMode ? `K${j + 1}` : colDef.label;
                      const title = isDiagonal
                        ? `${labelA}: ten sam KPI — pominięto autokorelację (r = 1)`
                        : r == null
                          ? `${labelA} ↔ ${labelB}: brak obliczenia`
                          : `${labelA} ↔ ${labelB}: r = ${r.toFixed(3)}`;
                      return (
                        <td key={`${rowDef.id}-${colDef.id}`} className={`${styles.cell} ${toneClass}`} title={title}>
                          {isDiagonal || r == null ? "—" : r.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className={styles.empty}>Brak danych do macierzy korelacji.</p>
      )}
    </div>
  );
}
