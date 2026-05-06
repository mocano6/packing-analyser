"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TeamInfo } from "@/types";
import { buildWiedzaWeightsCorrelation } from "@/utils/wiedzaWeightsMetrics";
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
  const [referenceMetricId, setReferenceMetricId] = useState("w_gd_per_match");
  const data = useMemo(() => buildWiedzaWeightsCorrelation(matches, 3), [matches]);

  /** Stan synchronizowany z listą metryk po zmianie próby. */
  useEffect(() => {
    if (!data?.metrics.length) return;
    const exists = data.metrics.some((m) => m.id === referenceMetricId);
    if (!exists) {
      setReferenceMetricId(data.metrics[0].id);
    }
  }, [data, referenceMetricId]);

  const display = useMemo(() => {
    if (!data || data.metrics.length === 0) return null;
    const referenceOptions = data.metrics;
    const selectedReference = referenceOptions.find((metric) => metric.id === referenceMetricId) ?? referenceOptions[0] ?? data.metrics[0];
    const referenceIndex = data.metrics.findIndex((metric) => metric.id === selectedReference.id);
    const correlations = data.metrics.flatMap((metric, index) => {
      const r = data.matrix[referenceIndex]?.[index] ?? null;
      if (metric.id === selectedReference.id || r === null) return [];
      return [{ metric, r }];
    });
    const positive = correlations.filter((row) => row.r > 0).sort((a, b) => b.r - a.r);
    const negative = correlations.filter((row) => row.r < 0).sort((a, b) => a.r - b.r);
    return { referenceOptions, selectedReference, positive, negative };
  }, [data, referenceMetricId]);

  const onReferenceMetricChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setReferenceMetricId(e.target.value);
  }, []);

  const selectMetricAsReference = useCallback((metricId: string) => {
    setReferenceMetricId(metricId);
  }, []);

  const rootClass = compact ? `${styles.root} ${styles.rootCompact}` : styles.root;

  return (
    <div className={rootClass}>
      {!hideHint ? (
        <p className={styles.hint}>
          Wybierz jedną metrykę referencyjną, a tabela pokaże wszystkie jej korelacje dodatnie i ujemne posortowane od najsilniejszych.
          Kliknij wiersz korelacji, aby ustawić tę metrykę jako referencyjną.
          <strong>Kolory:</strong> r ≥ 0,4 zielono, r ≤ −0,4 czerwono.{" "}
          <strong>Nagłówki:</strong> niebieski — nasz zespół (MY), bursztynowy — przeciwnik (OPP), fioletowy — wynik (W/R/P). Metryki źródłowe:{" "}
          <code style={{ fontSize: "12px" }}>wiedzaWeightsMetrics.ts</code>.
          {scopeHint ? ` ${scopeHint}` : ""}
        </p>
      ) : null}
      {matches.length < 3 ? (
        <p className={styles.empty}>Potrzebujesz co najmniej trzech meczów w próbie.</p>
      ) : display ? (
        <>
          <div className={styles.toolbar}>
            <label htmlFor="wiedza-weights-reference-metric" className={styles.sortLabel}>
              Metryka referencyjna
            </label>
            <select
              id="wiedza-weights-reference-metric"
              name="wiedzaWeightsReferenceMetric"
              className={styles.select}
              value={display.selectedReference.id}
              onChange={onReferenceMetricChange}
              aria-label="Metryka referencyjna korelacji Wag"
            >
              {display.referenceOptions.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.correlationColumns}>
            {[
              { title: "Korelacje dodatnie", rows: display.positive },
              { title: "Korelacje ujemne", rows: display.negative },
            ].map((section) => (
              <div
                key={section.title}
                className={styles.scroll}
                role="region"
                aria-label={`${section.title} dla ${display.selectedReference.label}`}
              >
                <table className={styles.table}>
                  <caption className={styles.correlationCaption}>
                    {section.title}: {display.selectedReference.label}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.corner}>
                        Metryka
                      </th>
                      <th scope="col" className={styles.correlationValueHead}>
                        r
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length > 0 ? (
                      section.rows.map(({ metric, r }) => (
                        <tr
                          key={`${display.selectedReference.id}-${metric.id}`}
                          className={styles.clickableCorrRow}
                          tabIndex={0}
                          aria-label={`Ustaw ${metric.label} jako metrykę referencyjną`}
                          onClick={() => selectMetricAsReference(metric.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectMetricAsReference(metric.id);
                            }
                          }}
                        >
                          <th
                            scope="row"
                            className={`${styles.rowHead} ${correlationAxisHeadClass(metric.axisSide, styles)}`}
                            title={metric.label}
                          >
                            {metric.label}
                          </th>
                          <td
                            className={`${styles.cell} ${cellToneClass(r, styles)}`}
                            title={`${display.selectedReference.label} ↔ ${metric.label}: r = ${r.toFixed(3)}`}
                          >
                            {r.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className={`${styles.cell} ${styles.corrNA}`}>
                          Brak korelacji w tej grupie.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>Brak danych do macierzy.</p>
      )}
    </div>
  );
}
