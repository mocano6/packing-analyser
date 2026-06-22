"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StatsBombMatchRow, StatsBombSquadPlayerRow } from "@/utils/statsbombCsvParser";
import { buildStatsBombCorrelation, type StatsBombMetric } from "@/utils/statsbombCorrelation";
import StatsBombPlayerMetricShareModal from "@/components/StatsBombPlayerMetricShareModal/StatsBombPlayerMetricShareModal";
import { canBuildPlayerMetricShare } from "@/utils/statsBombPlayerMetricShare";
import styles from "@/components/WiedzaGoalsXgWeights/WiedzaGoalsXgWeights.module.css";
import panelStyles from "./StatsBombCorrelationPanel.module.css";
import { correlationAxisHeadClass } from "@/utils/correlationMatrixAxis";

import {
  correlationListSortLabel,
  defaultCorrelationListSort,
  sortCorrelationListRows,
  toggleCorrelationListSort,
  type CorrelationListSort,
  type CorrelationSectionKind,
} from "@/utils/statsBombCorrelationSort";
import { STATSBOMB_STRONG_CORR_THRESHOLD } from "@/utils/statsBombTeamReport";

export type StatsBombCorrelationPanelProps = {
  rows: StatsBombMatchRow[];
  squadPlayers?: StatsBombSquadPlayerRow[];
  scopeHint?: string;
};

type CorrelationRow = { metric: StatsBombMetric; r: number };

function defaultSectionSort(): Record<CorrelationSectionKind, CorrelationListSort> {
  return {
    positive: defaultCorrelationListSort("positive"),
    negative: defaultCorrelationListSort("negative"),
  };
}

function cellToneClass(r: number | null): string {
  if (r == null) return styles.corrNA;
  if (r >= STATSBOMB_STRONG_CORR_THRESHOLD) return styles.corrPosStrong;
  if (r <= -STATSBOMB_STRONG_CORR_THRESHOLD) return styles.corrNegStrong;
  return styles.corrNeutral;
}

function metricLabelClass(metric: StatsBombMetric): string {
  return metric.description ? panelStyles.metricWithDef : "";
}

function PlayerShareIcon() {
  return (
    <svg
      className={panelStyles.shareIconSvg}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 6.5v-.75A4.25 4.25 0 0 1 9.25 11.5h1.5A4.25 4.25 0 0 1 15 15.75v.75a.75.75 0 0 1-.75.75h-8.5A.75.75 0 0 1 5 16.5Zm10-2.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm2.5 1.25a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75h-1.1a5.23 5.23 0 0 0 .36-1.93v-.57a.75.75 0 0 1 .75-.75h-.26ZM3 15.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Zm-2.5 1.25a.75.75 0 0 1 .75.75v.5a.75.75 0 0 1-.75.75H.65a5.23 5.23 0 0 0 .36-1.93v-.57A.75.75 0 0 1 1.76 15h.74Z" />
    </svg>
  );
}

export default function StatsBombCorrelationPanel({
  rows,
  squadPlayers = [],
  scopeHint,
}: StatsBombCorrelationPanelProps) {
  const [referenceMetricId, setReferenceMetricId] = useState("sb_gd");
  const [shareMetricLabel, setShareMetricLabel] = useState<string | null>(null);
  const [shareContextNote, setShareContextNote] = useState<string | undefined>();
  const [rListSort, setRListSort] = useState<Record<CorrelationSectionKind, CorrelationListSort>>(
    defaultSectionSort,
  );
  const showPlayerShareColumn = squadPlayers.length > 0;
  const data = useMemo(() => buildStatsBombCorrelation(rows, 3), [rows]);

  useEffect(() => {
    if (!data?.metrics.length) return;
    const exists = data.metrics.some((m) => m.id === referenceMetricId);
    if (!exists) {
      setReferenceMetricId(data.metrics[0]?.id ?? "sb_gd");
    }
  }, [data, referenceMetricId]);

  useEffect(() => {
    setRListSort(defaultSectionSort());
  }, [referenceMetricId]);

  const toggleRSort = useCallback((section: CorrelationSectionKind) => {
    setRListSort((prev) => ({
      ...prev,
      [section]: toggleCorrelationListSort(prev[section]),
    }));
  }, []);

  const display = useMemo(() => {
    if (!data || data.metrics.length === 0) return null;
    const referenceOptions = data.metrics;
    const selectedReference =
      referenceOptions.find((metric) => metric.id === referenceMetricId) ??
      referenceOptions[0] ??
      data.metrics[0];
    const referenceIndex = data.metrics.findIndex((metric) => metric.id === selectedReference.id);
    const correlations: CorrelationRow[] = data.metrics.flatMap((metric, index) => {
      const r = data.matrix[referenceIndex]?.[index] ?? null;
      if (metric.id === selectedReference.id || r === null) return [];
      return [{ metric, r }];
    });
    const positive = sortCorrelationListRows(
      correlations.filter((row) => row.r > 0),
      rListSort.positive,
    );
    const negative = sortCorrelationListRows(
      correlations.filter((row) => row.r < 0),
      rListSort.negative,
    );
    return { referenceOptions, selectedReference, positive, negative };
  }, [data, referenceMetricId, rListSort]);

  const onReferenceMetricChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setReferenceMetricId(e.target.value);
  }, []);

  const selectMetricAsReference = useCallback((metricId: string) => {
    setReferenceMetricId(metricId);
  }, []);

  const openShareModal = useCallback(
    (metric: StatsBombMetric, r: number, referenceLabel: string) => {
      if (!canBuildPlayerMetricShare(squadPlayers, metric.label)) return;
      setShareMetricLabel(metric.label);
      setShareContextNote(`Korelacja z ${referenceLabel}: r=${r.toFixed(3)}.`);
    },
    [squadPlayers],
  );

  const closeShareModal = useCallback(() => {
    setShareMetricLabel(null);
    setShareContextNote(undefined);
  }, []);

  const definedCount = useMemo(
    () => (data?.metrics.filter((m) => m.description).length ?? 0),
    [data],
  );

  return (
    <div className={`${styles.root} ${styles.rootCompact}`}>
      <p className={styles.hint}>
        Korelacje Pearsona między metrykami StatsBomb a wynikiem meczu. Każda para używa
        wszystkich meczów w próbie (zero to prawdziwa wartość, np. 0 goli). Metryki z
        podkreśleniem kropkowanym mają definicję — najedź kursorem.
        Kolory: r ≥ 0,36 zielono, r ≤ −0,36 czerwono. Kliknij nagłówek kolumny r, aby przełączyć sortowanie
        rosnąco / malejąco (domyślnie najsilniejsze |r| na górze). Kliknij wiersz korelacji, aby ustawić
        metrykę referencyjną.
        {showPlayerShareColumn
          ? " Ikona zawodników po prawej otwiera udział w składzie (Squad STATS)."
          : ""}
        {scopeHint ? ` ${scopeHint}` : ""}
      </p>
      {rows.length < 3 ? (
        <p className={styles.empty}>Potrzebujesz co najmniej trzech meczów w pliku CSV.</p>
      ) : display ? (
        <>
          <div className={styles.toolbar}>
            <label htmlFor="statsbomb-reference-metric" className={styles.sortLabel}>
              Metryka referencyjna
            </label>
            <select
              id="statsbomb-reference-metric"
              name="statsbombReferenceMetric"
              className={styles.select}
              value={display.selectedReference.id}
              onChange={onReferenceMetricChange}
              aria-label="Metryka referencyjna korelacji StatsBomb"
            >
              {display.referenceOptions.map((metric) => (
                <option key={metric.id} value={metric.id} title={metric.description}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
          {display.selectedReference.description ? (
            <p className={panelStyles.referenceDef}>{display.selectedReference.description}</p>
          ) : null}
          <p className={panelStyles.glossaryNote}>
            Definicje: glossary raportu Wyscout/StatsBomb (SSA Jagiellonia) + nazewnictwo MatchStats CSV.
            Opisane metryki: {definedCount} / {data.metrics.length}.
          </p>
          <div className={styles.correlationColumns}>
            {(
              [
                { key: "positive" as const, title: "Korelacje dodatnie", rows: display.positive },
                { key: "negative" as const, title: "Korelacje ujemne", rows: display.negative },
              ] as const
            ).map((section) => {
              const listSort = rListSort[section.key];
              const ascending = listSort === "ascending";
              return (
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
                      <th
                        scope="col"
                        className={`${styles.correlationValueHead} ${panelStyles.sortableHead} ${panelStyles.sortableHeadActive}`}
                        aria-sort={ascending ? "ascending" : "descending"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleRSort(section.key);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleRSort(section.key);
                          }
                        }}
                        tabIndex={0}
                        title={`${correlationListSortLabel(listSort)}. Kliknij, aby przełączyć.`}
                      >
                        r
                        <span className={panelStyles.sortIndicator} aria-hidden="true">
                          {ascending ? "↑" : "↓"}
                        </span>
                      </th>
                      {showPlayerShareColumn ? (
                        <th scope="col" className={panelStyles.actionHead}>
                          <span className={panelStyles.visuallyHidden}>Udział zawodników</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length > 0 ? (
                      section.rows.map(({ metric, r }) => {
                        const shareable =
                          showPlayerShareColumn &&
                          canBuildPlayerMetricShare(squadPlayers, metric.label);
                        return (
                        <tr
                          key={`${display.selectedReference.id}-${metric.id}-${metric.label}`}
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
                            className={`${styles.rowHead} ${correlationAxisHeadClass(metric.axisSide, styles)} ${metricLabelClass(metric)}`}
                            title={metric.description ?? metric.label}
                          >
                            {metric.label}
                          </th>
                          <td className={`${styles.cell} ${cellToneClass(r)}`}>{r.toFixed(3)}</td>
                          {showPlayerShareColumn ? (
                            <td className={panelStyles.actionCell}>
                              {shareable ? (
                                <button
                                  type="button"
                                  className={panelStyles.shareIconButton}
                                  aria-label={`Udział zawodników w metryce ${metric.label}`}
                                  title="Udział zawodników w składzie"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openShareModal(metric, r, display.selectedReference.label);
                                  }}
                                >
                                  <PlayerShareIcon />
                                </button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                      })
                    ) : (
                      <tr>
                        <td colSpan={showPlayerShareColumn ? 3 : 2} className={styles.empty}>
                          Brak korelacji w tej kategorii.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
            })}
          </div>
          <StatsBombPlayerMetricShareModal
            isOpen={shareMetricLabel !== null}
            metricLabel={shareMetricLabel}
            players={squadPlayers}
            contextNote={shareContextNote}
            onClose={closeShareModal}
          />
        </>
      ) : (
        <p className={styles.empty}>Nie udało się obliczyć macierzy korelacji.</p>
      )}
    </div>
  );
}
