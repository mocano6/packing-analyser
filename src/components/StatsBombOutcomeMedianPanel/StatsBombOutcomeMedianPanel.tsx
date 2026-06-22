"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildStatsBombTeamOutcomeMedianReport,
  sortOutcomeMetricSummaries,
  STATSBOMB_OUTCOME_SUMMARY_DEFAULT_DIRECTION,
  STATSBOMB_OUTCOME_SUMMARY_DEFAULT_SORT,
  statsBombOutcomeMedianGroupLabel,
  toggleOutcomeSummarySort,
  type StatsBombOutcomeMedianGroupKey,
  type StatsBombOutcomeMetricSummary,
  type StatsBombOutcomeSummarySortDirection,
  type StatsBombOutcomeSummarySortKey,
} from "@/utils/statsBombTeamOutcomeMedianAnalysis";
import {
  formatDistributionValue,
  type StatsBombMedianDistributionReport,
} from "@/utils/statsBombMedianDistribution";
import type { StatsBombMatchRow } from "@/utils/statsbombCsvParser";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombOutcomeMedianPanel.module.css";

export type StatsBombOutcomeMedianPanelProps = {
  rows: StatsBombMatchRow[];
  medianReport: StatsBombMedianDistributionReport;
  onSelectMatch?: (matchId: string) => void;
};

function formatSigned(value: number | null, label: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const formatted = formatDistributionValue(Math.abs(value), label);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function groupStatsForMetric(
  metric: StatsBombOutcomeMetricSummary,
  group: StatsBombOutcomeMedianGroupKey,
) {
  return metric[group];
}

const SORT_COLUMNS: Array<{ key: StatsBombOutcomeSummarySortKey; label: string }> = [
  { key: "label", label: "Parametr" },
  { key: "categoryLabel", label: "Kategoria" },
  { key: "seasonMedian", label: "Mediana sezonu" },
  { key: "avgValue", label: "Śr. wartość" },
  { key: "avgDeviation", label: "Śr. odchylenie" },
  { key: "avgAbsDeviation", label: "Śr. |odchylenie|" },
  { key: "aboveMedianCount", label: "Pow. med." },
  { key: "belowMedianCount", label: "Poniżej med." },
  { key: "matchCount", label: "Mecze" },
];

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: StatsBombOutcomeSummarySortKey;
  activeSortKey: StatsBombOutcomeSummarySortKey;
  direction: StatsBombOutcomeSummarySortDirection;
  onSort: (key: StatsBombOutcomeSummarySortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={`${styles.sortableHeader} ${isActive ? styles.sortableHeaderActive : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className={styles.sortIndicator} aria-hidden="true">
          {isActive ? (direction === "asc" ? " ↑" : " ↓") : " ⇅"}
        </span>
      </button>
    </th>
  );
}

function OutcomeSummaryTable({
  metrics,
  group,
  onSelectMatch,
}: {
  metrics: StatsBombOutcomeMetricSummary[];
  group: StatsBombOutcomeMedianGroupKey;
  onSelectMatch?: (matchId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<StatsBombOutcomeSummarySortKey>(
    STATSBOMB_OUTCOME_SUMMARY_DEFAULT_SORT,
  );
  const [sortDirection, setSortDirection] = useState<StatsBombOutcomeSummarySortDirection>(
    STATSBOMB_OUTCOME_SUMMARY_DEFAULT_DIRECTION,
  );

  useEffect(() => {
    setSortKey(STATSBOMB_OUTCOME_SUMMARY_DEFAULT_SORT);
    setSortDirection(STATSBOMB_OUTCOME_SUMMARY_DEFAULT_DIRECTION);
    setExpandedId(null);
  }, [group]);

  const handleSort = useCallback((nextKey: StatsBombOutcomeSummarySortKey) => {
    const next = toggleOutcomeSummarySort(sortKey, sortDirection, nextKey);
    setSortKey(next.sortKey);
    setSortDirection(next.direction);
    setExpandedId(null);
  }, [sortDirection, sortKey]);

  const sortedMetrics = useMemo(
    () => sortOutcomeMetricSummaries(metrics, group, sortKey, sortDirection),
    [metrics, group, sortKey, sortDirection],
  );

  if (metrics.length === 0) {
    return (
      <p className={teamStyles.emptySection}>
        Brak meczów w tej kategorii wyniku do porównania z medianą sezonu.
      </p>
    );
  }

  return (
    <div className={teamStyles.tableWrap}>
      <table className={teamStyles.table}>
        <thead>
          <tr>
            {SORT_COLUMNS.map((column) => (
              <SortableHeader
                key={column.key}
                label={column.label}
                sortKey={column.key}
                activeSortKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
            ))}
            <th scope="col">Szczegóły</th>
          </tr>
        </thead>
        <tbody>
          {sortedMetrics.map((metric) => {
            const stats = groupStatsForMetric(metric, group);
            const isExpanded = expandedId === metric.id;
            return (
              <React.Fragment key={metric.id}>
                <tr>
                  <td>
                    <span className={teamStyles.metricLabel} title={metric.description ?? metric.label}>
                      {metric.label}
                    </span>
                  </td>
                  <td>{metric.categoryLabel}</td>
                  <td className={teamStyles.num}>
                    {formatDistributionValue(metric.seasonMedian, metric.label)}
                  </td>
                  <td className={teamStyles.num}>
                    {stats.avgValue === null
                      ? "—"
                      : formatDistributionValue(stats.avgValue, metric.label)}
                  </td>
                  <td className={`${teamStyles.num} ${(stats.avgDeviation ?? 0) > 0 ? styles.positive : (stats.avgDeviation ?? 0) < 0 ? styles.negative : ""}`}>
                    {formatSigned(stats.avgDeviation, metric.label)}
                  </td>
                  <td className={teamStyles.num}>
                    {stats.avgAbsDeviation === null
                      ? "—"
                      : formatDistributionValue(stats.avgAbsDeviation, metric.label)}
                  </td>
                  <td className={teamStyles.num}>{stats.aboveMedianCount}</td>
                  <td className={teamStyles.num}>{stats.belowMedianCount}</td>
                  <td className={teamStyles.num}>{stats.matchCount}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.detailsButton}
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : metric.id)}
                    >
                      {isExpanded ? "Zwiń" : "Rozwiń"}
                    </button>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className={styles.detailsRow}>
                    <td colSpan={10}>
                      <div className={styles.detailsGrid}>
                        <div>
                          <h4 className={styles.detailsTitle}>Najwyżej ponad medianą</h4>
                          <ul className={styles.detailsList}>
                            {stats.topPositive.length === 0 ? (
                              <li>—</li>
                            ) : (
                              stats.topPositive.map((entry) => (
                                <li key={entry.matchId}>
                                  {onSelectMatch ? (
                                    <button
                                      type="button"
                                      className={styles.matchLink}
                                      onClick={() => onSelectMatch(entry.matchId)}
                                    >
                                      {entry.opponent} ({entry.date})
                                    </button>
                                  ) : (
                                    `${entry.opponent} (${entry.date})`
                                  )}
                                  : {formatDistributionValue(entry.value, metric.label)} (
                                  {formatSigned(entry.deviation, metric.label)}
                                  {entry.deviationPct !== null ? `, ${formatPct(entry.deviationPct)}` : ""})
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                        <div>
                          <h4 className={styles.detailsTitle}>Najniżej poniżej mediany</h4>
                          <ul className={styles.detailsList}>
                            {stats.topNegative.length === 0 ? (
                              <li>—</li>
                            ) : (
                              stats.topNegative.map((entry) => (
                                <li key={entry.matchId}>
                                  {onSelectMatch ? (
                                    <button
                                      type="button"
                                      className={styles.matchLink}
                                      onClick={() => onSelectMatch(entry.matchId)}
                                    >
                                      {entry.opponent} ({entry.date})
                                    </button>
                                  ) : (
                                    `${entry.opponent} (${entry.date})`
                                  )}
                                  : {formatDistributionValue(entry.value, metric.label)} (
                                  {formatSigned(entry.deviation, metric.label)}
                                  {entry.deviationPct !== null ? `, ${formatPct(entry.deviationPct)}` : ""})
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StatsBombOutcomeMedianPanel({
  rows,
  medianReport,
  onSelectMatch,
}: StatsBombOutcomeMedianPanelProps) {
  const [outcomeGroup, setOutcomeGroup] = useState<StatsBombOutcomeMedianGroupKey>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const report = useMemo(
    () => buildStatsBombTeamOutcomeMedianReport(rows, medianReport),
    [rows, medianReport],
  );

  const onOutcomeGroup = useCallback((group: StatsBombOutcomeMedianGroupKey) => {
    setOutcomeGroup(group);
  }, []);

  const rankedMetrics = useMemo(() => {
    if (!report) return [];
    let list = report.rankedByOutcome[outcomeGroup] ?? [];
    if (categoryFilter !== "all") {
      list = list.filter((metric) => metric.categoryId === categoryFilter);
    }
    return list;
  }, [report, outcomeGroup, categoryFilter]);

  if (!report) {
    return <p className={teamStyles.hint}>Nie udało się zbudować podsumowania odchyleń od mediany.</p>;
  }

  const categoryOptions = [...new Set(report.metrics.map((m) => m.categoryId))];

  return (
    <div className={styles.root}>
      <p className={teamStyles.hint}>
        Porównanie parametrów meczów z medianą sezonu, posegregowane wg wyniku (W/R/P). Kliknij
        nagłówek kolumny, aby posortować tabelę — domyślnie według średniego |odchylenia|.
      </p>

      <div className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.summaryWin}`}>
          <div className={styles.summaryLabel}>Wygrane</div>
          <div className={styles.summaryValue}>{report.summary.winCount}</div>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryDraw}`}>
          <div className={styles.summaryLabel}>Remisy</div>
          <div className={styles.summaryValue}>{report.summary.drawCount}</div>
        </article>
        <article className={`${styles.summaryCard} ${styles.summaryLoss}`}>
          <div className={styles.summaryLabel}>Porażki</div>
          <div className={styles.summaryValue}>{report.summary.lossCount}</div>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Razem</div>
          <div className={styles.summaryValue}>{report.summary.totalCount}</div>
        </article>
      </div>

      <div className={styles.filters} role="tablist" aria-label="Grupa wyniku meczu">
        {(["all", "win", "draw", "loss"] as const).map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={outcomeGroup === group}
            className={`${styles.filterButton} ${styles[`filter${group.charAt(0).toUpperCase()}${group.slice(1)}`]} ${outcomeGroup === group ? styles.filterButtonActive : ""}`}
            onClick={() => onOutcomeGroup(group)}
          >
            {statsBombOutcomeMedianGroupLabel(group)}
          </button>
        ))}
      </div>

      <div className={styles.categoryFilters}>
        <button
          type="button"
          className={`${styles.categoryChip} ${categoryFilter === "all" ? styles.categoryChipActive : ""}`}
          onClick={() => setCategoryFilter("all")}
        >
          Wszystkie kategorie
        </button>
        {categoryOptions.map((id) => {
          const label = report.metrics.find((m) => m.categoryId === id)?.categoryLabel ?? id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.categoryChip} ${categoryFilter === id ? styles.categoryChipActive : ""}`}
              onClick={() => setCategoryFilter(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      <section aria-label={`Odchylenia od mediany — ${statsBombOutcomeMedianGroupLabel(outcomeGroup)}`}>
        <h4 className={styles.sectionTitle}>
          Najsilniejsze odchylenia — {statsBombOutcomeMedianGroupLabel(outcomeGroup)}
        </h4>
        <OutcomeSummaryTable
          metrics={rankedMetrics}
          group={outcomeGroup}
          onSelectMatch={onSelectMatch}
        />
      </section>
    </div>
  );
}
