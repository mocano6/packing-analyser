"use client";

import React, { useCallback, useMemo, useState } from "react";
import { TeamInfo } from "@/types";
import { buildWiedzaWeightsCorrelation } from "@/utils/wiedzaWeightsMetrics";
import {
  correlationMatrixRowOrder,
  correlationMatrixRowOrderByReferenceColumn,
  permuteSquareCorrelationMatrix,
  type CorrelationMatrixLabelSortMode,
  type CorrelationMatrixSortMode,
} from "@/utils/trendyKpis";
import styles from "./WiedzaGoalsXgWeights.module.css";
import { correlationAxisHeadClass } from "@/utils/correlationMatrixAxis";

export type WiedzaGoalsXgWeightsProps = {
  matches: TeamInfo[];
  scopeHint?: string;
  /** Mniejsza czcionka i paddingi (np. Baza wiedzy). */
  compact?: boolean;
  /** Ukrywa akapit z objaśnieniem (gdy opis jest nad komponentem, np. Baza wiedzy). */
  hideHint?: boolean;
};

/** Kolor tła: tylko |r| ≥ tego progu (zielono / czerwono). */
const CORR_HIGHLIGHT_ABS = 0.4;

function cellToneClass(r: number | null, s: typeof styles): string {
  if (r == null) return s.corrNA;
  if (r >= CORR_HIGHLIGHT_ABS) return s.corrPosStrong;
  if (r <= -CORR_HIGHLIGHT_ABS) return s.corrNegStrong;
  return s.corrNeutral;
}

export default function WiedzaGoalsXgWeights({
  matches,
  scopeHint,
  compact = false,
  hideHint = false,
}: WiedzaGoalsXgWeightsProps) {
  const [sortMode, setSortMode] = useState<CorrelationMatrixSortMode>("trend");
  const [sortRefColumnIndex, setSortRefColumnIndex] = useState(0);
  const data = useMemo(() => buildWiedzaWeightsCorrelation(matches, 3), [matches]);

  const display = useMemo(() => {
    if (!data || data.metrics.length === 0) return null;
    const n = data.metrics.length;
    const refIdx = Math.min(Math.max(0, sortRefColumnIndex), n - 1);
    const labels = data.metrics.map((m) => m.label);
    let order: number[];
    if (sortMode === "column_desc") {
      order = correlationMatrixRowOrderByReferenceColumn(data.matrix, refIdx, "desc");
    } else if (sortMode === "column_asc") {
      order = correlationMatrixRowOrderByReferenceColumn(data.matrix, refIdx, "asc");
    } else {
      order = correlationMatrixRowOrder(labels, data.matrix, sortMode as CorrelationMatrixLabelSortMode);
    }
    const metrics = order.map((idx) => data.metrics[idx]);
    const matrix = permuteSquareCorrelationMatrix(data.matrix, order);
    return { metrics, matrix };
  }, [data, sortMode, sortRefColumnIndex]);

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

  const rootClass = compact ? `${styles.root} ${styles.rootCompact}` : styles.root;

  return (
    <div className={rootClass}>
      {!hideHint ? (
        <p className={styles.hint}>
          Pierwsze trzy kolumny/wiersze: <strong>Wygrana, Remis, Przegrana</strong> (0/1 z goli; jedna jedynka na mecz). Przy korelacji z innymi metrykami zera w tych wierszach nie są pomijane jako „brak danych”. „Straty całe b.” tylko MY (bez OPP). Reszta: metryki MY i OPP. Przekątna „—”.
          <strong>Kolory komórek:</strong> r ≥ 0,4 zielono, r ≤ −0,4 czerwono.{" "}
          <strong>Nagłówki:</strong> niebieski — nasz zespół (MY), bursztynowy — przeciwnik (OPP), fioletowy — wynik (W/R/P). Metryki:{" "}
          <code style={{ fontSize: "12px" }}>wiedzaWeightsMetrics.ts</code>.
          {scopeHint ? ` ${scopeHint}` : ""}
        </p>
      ) : null}
      {matches.length < 3 ? (
        <p className={styles.empty}>Potrzebujesz co najmniej trzech meczów w próbie.</p>
      ) : display ? (
        <>
          <div className={styles.toolbar}>
            <label htmlFor="wiedza-weights-matrix-sort" className={styles.sortLabel}>
              Sortuj wiersze i kolumny (Wagi)
            </label>
            <select
              id="wiedza-weights-matrix-sort"
              name="wiedzaWeightsMatrixSort"
              className={styles.select}
              value={sortMode}
              onChange={onSortChange}
              aria-label="Sortowanie macierzy korelacji Wag"
            >
              <option value="trend">Kolejność z definicji metryk</option>
              <option value="alpha_pl">Alfabetycznie (A–Ż)</option>
              <option value="avg_abs">Średnia |korelacja| z innymi (malejąco)</option>
              <option value="column_desc">Po kolumnie: od największej korelacji</option>
              <option value="column_asc">Po kolumnie: od najmniejszej korelacji</option>
            </select>
            {(sortMode === "column_desc" || sortMode === "column_asc") && data ? (
              <>
                <label htmlFor="wiedza-weights-ref-col" className={styles.sortLabel}>
                  Metryka (kolumna referencyjna)
                </label>
                <select
                  id="wiedza-weights-ref-col"
                  name="wiedzaWeightsRefColumn"
                  className={styles.select}
                  value={Math.min(Math.max(0, sortRefColumnIndex), data.metrics.length - 1)}
                  onChange={onRefColumnChange}
                  aria-label="Metryka referencyjna do sortowania po kolumnie"
                >
                  {data.metrics.map((m, i) => (
                    <option key={m.id} value={i}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
          <div
            className={styles.scroll}
            role="region"
            aria-label="Korelacje Pearsona — wszystkie metryki MY i OPP (Wagi)"
            tabIndex={0}
          >
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Pełna macierz korelacji: metryki naszego zespołu i przeciwnika w jednej siatce.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={styles.corner}>
                    Metryka
                  </th>
                  {display.metrics.map((m) => (
                    <th
                      key={m.id}
                      scope="col"
                      className={`${styles.colHead} ${correlationAxisHeadClass(m.axisSide, styles)}`}
                      title={m.label}
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.metrics.map((rowM, i) => (
                  <tr key={rowM.id}>
                    <th
                      scope="row"
                      className={`${styles.rowHead} ${correlationAxisHeadClass(rowM.axisSide, styles)}`}
                      title={rowM.label}
                    >
                      {rowM.label}
                    </th>
                    {display.matrix[i].map((r, j) => {
                      const colM = display.metrics[j];
                      const isDiagonal = i === j;
                      const tone = isDiagonal ? styles.corrNA : cellToneClass(r, styles);
                      const title = isDiagonal
                        ? `${rowM.label}: ta sama metryka — pominięto autokorelację (r = 1)`
                        : r == null
                          ? `${rowM.label} ↔ ${colM.label}: brak obliczenia`
                          : `${rowM.label} ↔ ${colM.label}: r = ${r.toFixed(3)}`;
                      return (
                        <td key={`${rowM.id}-${colM.id}`} className={`${styles.cell} ${tone}`} title={title}>
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
        <p className={styles.empty}>Brak danych do macierzy.</p>
      )}
    </div>
  );
}
