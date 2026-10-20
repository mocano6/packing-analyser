"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { TeamInfo } from "@/types";
import { buildWiedzaWeightsCorrelation } from "@/utils/wiedzaWeightsMetrics";
import { buildWiedzaMeanAbsShapPreview } from "@/utils/wiedzaMeanAbsShap";
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

function shapToneClass(value: number, maxValue: number, positive: boolean, s: typeof styles): string {
  if (maxValue <= 0 || value < maxValue * CORR_HIGHLIGHT_ABS) return s.corrNeutral;
  return positive ? s.corrPosStrong : s.corrNegStrong;
}

function formatMeanAbsShap(value: number): string {
  if (value >= 10) return value.toFixed(1);
  if (value >= 0.1) return value.toFixed(2);
  return value.toFixed(3);
}

type ValuePreviewMode = "pearson" | "meanAbsShap";

export default function WiedzaGoalsXgWeights({
  matches,
  scopeHint,
  compact = false,
  hideHint = false,
}: WiedzaGoalsXgWeightsProps) {
  const [referenceMetricId, setReferenceMetricId] = useState("w_match_points");
  const [valuePreview, setValuePreview] = useState<ValuePreviewMode>("pearson");
  const data = useMemo(() => buildWiedzaWeightsCorrelation(matches, 3), [matches]);
  const shapPreview = useMemo(() => {
    if (valuePreview !== "meanAbsShap" || !data) return null;
    return buildWiedzaMeanAbsShapPreview(matches, data.metrics, referenceMetricId);
  }, [data, matches, referenceMetricId, valuePreview]);

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
    if (valuePreview === "meanAbsShap") {
      const byId = new Map((shapPreview?.rows ?? []).map((row) => [row.id, row]));
      const maxValue = Math.max(0, ...[...byId.values()].map((row) => row.meanAbsShap));
      const contributions = data.metrics.flatMap((metric) => {
        const row = byId.get(metric.id);
        if (!row) return [];
        return [{
          metric,
          valueText: formatMeanAbsShap(row.meanAbsShap),
          title: `${selectedReference.label} ← ${metric.label}: mean(|SHAP value|) = ${row.meanAbsShap.toFixed(3)}`,
          tone: shapToneClass(row.meanAbsShap, maxValue, row.direction > 0, styles),
          sortValue: row.direction > 0 ? row.meanAbsShap : -row.meanAbsShap,
        }];
      });
      return {
        referenceOptions,
        selectedReference,
        valueHeader: "mean(|SHAP|)",
        emptyLabel: "Brak wkładu w tej grupie.",
        positiveTitle: "Dodatni wkład SHAP",
        negativeTitle: "Ujemny wkład SHAP",
        positive: contributions.filter((row) => row.sortValue > 0).sort((a, b) => b.sortValue - a.sortValue),
        negative: contributions.filter((row) => row.sortValue < 0).sort((a, b) => a.sortValue - b.sortValue),
        model: shapPreview,
      };
    }
    const referenceIndex = data.metrics.findIndex((metric) => metric.id === selectedReference.id);
    const correlations = data.metrics.flatMap((metric, index) => {
      const r = data.matrix[referenceIndex]?.[index] ?? null;
      if (metric.id === selectedReference.id || r === null) return [];
      return [{
        metric,
        valueText: r.toFixed(2),
        title: `${selectedReference.label} ↔ ${metric.label}: r = ${r.toFixed(3)}`,
        tone: cellToneClass(r, styles),
        sortValue: r,
      }];
    });
    return {
      referenceOptions,
      selectedReference,
      valueHeader: "r",
      emptyLabel: "Brak korelacji w tej grupie.",
      positiveTitle: "Korelacje dodatnie",
      negativeTitle: "Korelacje ujemne",
      positive: correlations.filter((row) => row.sortValue > 0).sort((a, b) => b.sortValue - a.sortValue),
      negative: correlations.filter((row) => row.sortValue < 0).sort((a, b) => a.sortValue - b.sortValue),
      model: null,
    };
  }, [data, referenceMetricId, shapPreview, valuePreview]);

  const onReferenceMetricChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setReferenceMetricId(e.target.value);
  }, []);

  const onValuePreviewChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setValuePreview(e.target.value === "meanAbsShap" ? "meanAbsShap" : "pearson");
  }, []);

  const selectMetricAsReference = useCallback((metricId: string) => {
    setReferenceMetricId(metricId);
  }, []);

  const rootClass = compact ? `${styles.root} ${styles.rootCompact}` : styles.root;

  return (
    <div className={rootClass}>
      {!hideHint ? (
        <p className={styles.hint}>
          Wybierz jedną metrykę referencyjną. Podgląd wartości przełącza tabelę między korelacją Pearsona a mean(|SHAP value|) modelu liniowego.
          Kliknij wiersz, aby ustawić tę metrykę jako referencyjną.
          <strong>Kolory:</strong> przy korelacji r ≥ 0,4 zielono i r ≤ −0,4 czerwono; przy SHAP próg to 40% najsilniejszego wkładu.{" "}
          <strong>Nagłówki:</strong> niebieski — nasz zespół (MY), bursztynowy — przeciwnik (OPP), fioletowy — wynik (Punkty, W/R/P). Metryki źródłowe:{" "}
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
            <label htmlFor="wiedza-weights-value-preview" className={styles.sortLabel}>
              Podgląd wartości
            </label>
            <select
              id="wiedza-weights-value-preview"
              name="wiedzaWeightsValuePreview"
              className={styles.select}
              value={valuePreview}
              onChange={onValuePreviewChange}
              aria-label="Podgląd wartości korelacji albo mean SHAP"
            >
              <option value="pearson">Korelacja Pearsona (r)</option>
              <option value="meanAbsShap">mean(|SHAP value|)</option>
            </select>
          </div>
          {valuePreview === "meanAbsShap" ? (
            display.model ? (
              <p className={styles.modelNote}>
                Model liniowy (regresja grzbietowa) przewiduje <strong>{display.selectedReference.label}</strong> z{" "}
                {display.model.featureCount} metryk o najsilniejszej korelacji (próba n = {display.model.n}, R² ={" "}
                {display.model.r2.toFixed(2)}). mean(|SHAP value|) to średni moduł wkładu cechy w jednostkach metryki
                referencyjnej, po uwzględnieniu pozostałych cech modelu. Dodatni wkład oznacza, że wyższa wartość metryki
                podnosi prognozę.
              </p>
            ) : (
              <p className={styles.empty}>Za mało zmienności w próbie, żeby policzyć mean(|SHAP value|).</p>
            )
          ) : null}
          {valuePreview !== "meanAbsShap" || display.model ? (
          <div className={styles.correlationColumns}>
            {[
              { title: display.positiveTitle, rows: display.positive },
              { title: display.negativeTitle, rows: display.negative },
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
                        {display.valueHeader}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length > 0 ? (
                      section.rows.map(({ metric, valueText, title, tone }) => (
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
                          <td className={`${styles.cell} ${tone}`} title={title}>
                            {valueText}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className={`${styles.cell} ${styles.corrNA}`}>
                          {display.emptyLabel}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          ) : null}
        </>
      ) : (
        <p className={styles.empty}>Brak danych do macierzy.</p>
      )}
    </div>
  );
}
