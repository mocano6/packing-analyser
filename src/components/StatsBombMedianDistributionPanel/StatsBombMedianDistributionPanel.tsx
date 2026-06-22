"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  formatDistributionValue,
  type StatsBombMedianCategorySection,
  type StatsBombMedianDistributionReport,
  type StatsBombMetricDistributionRow,
  valueToChartPercent,
} from "@/utils/statsBombMedianDistribution";
import { statsBombPhaseLabel } from "@/utils/statsBombTeamReport";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombMedianDistributionPanel.module.css";

export type StatsBombMedianDistributionPanelProps = {
  report: StatsBombMedianDistributionReport;
  mode: "team" | "player";
  highlightId?: string | null;
  highlightOptions?: Array<{ id: string; label: string; subLabel?: string }>;
  onHighlightChange?: (id: string) => void;
  scopeHint?: string;
};

function phaseBadgeClass(phase: StatsBombMetricDistributionRow["phase"]): string {
  switch (phase) {
    case "attack":
      return teamStyles.badgeAttack;
    case "defense":
      return teamStyles.badgeDefense;
    default:
      return teamStyles.badgeGeneral;
  }
}

function DistributionChartRow({
  metric,
  highlightId,
}: {
  metric: StatsBombMetricDistributionRow;
  highlightId?: string | null;
}) {
  const { stats } = metric;
  const medianPct = valueToChartPercent(stats.median, stats);
  const q1Pct = valueToChartPercent(stats.q1, stats);
  const q3Pct = valueToChartPercent(stats.q3, stats);
  const minPct = valueToChartPercent(stats.min, stats);
  const maxPct = valueToChartPercent(stats.max, stats);

  const highlighted = highlightId
    ? metric.observations.find((o) => o.id === highlightId)
    : null;

  return (
    <div className={styles.metricRow} role="group" aria-label={`Rozkład: ${metric.label}`}>
      <div className={styles.metricMeta}>
        <span className={styles.metricLabel} title={metric.description ?? metric.label}>
          {metric.label}
        </span>
        <span className={`${teamStyles.badge} ${phaseBadgeClass(metric.phase)}`}>
          {statsBombPhaseLabel(metric.phase)}
        </span>
      </div>

      <div className={styles.chartTrack} aria-hidden="true">
        <div
          className={styles.whisker}
          style={{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 0.5)}%` }}
        />
        <div
          className={styles.iqrBox}
          style={{ left: `${q1Pct}%`, width: `${Math.max(q3Pct - q1Pct, 0.5)}%` }}
        />
        <div className={styles.medianLine} style={{ left: `${medianPct}%` }} />
        {metric.observations.map((obs) => {
          const pct = valueToChartPercent(obs.value, stats);
          const isHighlighted = highlightId === obs.id;
          const outcomeClass =
            !isHighlighted && obs.outcome === "win"
              ? styles.obsDotWin
              : !isHighlighted && obs.outcome === "draw"
                ? styles.obsDotDraw
                : !isHighlighted && obs.outcome === "loss"
                  ? styles.obsDotLoss
                  : "";
          return (
            <div
              key={obs.id}
              className={`${styles.obsDot} ${outcomeClass} ${isHighlighted ? styles.obsDotHighlighted : ""}`}
              style={{ left: `${pct}%` }}
              title={`${obs.label}: ${formatDistributionValue(obs.value, metric.label)}${obs.subLabel ? ` (${obs.subLabel})` : ""}`}
            />
          );
        })}
      </div>

      <div className={styles.metricValues}>
        <span className={styles.statChip} title="Mediana sezonu">
          med. {formatDistributionValue(stats.median, metric.label)}
        </span>
        <span className={styles.statChipMuted} title="Rozstęp międzykwartylowy">
          Q1–Q3: {formatDistributionValue(stats.q1, metric.label)}–
          {formatDistributionValue(stats.q3, metric.label)}
        </span>
        {highlighted ? (
          <span className={styles.statChipHighlight} title={highlighted.subLabel}>
            {highlighted.label}: {formatDistributionValue(highlighted.value, metric.label)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CategorySection({
  section,
  highlightId,
  defaultExpanded,
}: {
  section: StatsBombMedianCategorySection;
  highlightId?: string | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? true);

  return (
    <section className={styles.categorySection} aria-label={section.label}>
      <button
        type="button"
        className={styles.categoryHeader}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.categoryTitle}>{section.label}</span>
        <span className={styles.categoryCount}>{section.metrics.length} parametrów</span>
        <span className={styles.categoryToggle}>{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className={styles.categoryBody}>
          {section.metrics.map((metric) => (
            <DistributionChartRow key={metric.id} metric={metric} highlightId={highlightId} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function StatsBombMedianDistributionPanel({
  report,
  mode,
  highlightId,
  highlightOptions = [],
  onHighlightChange,
  scopeHint,
}: StatsBombMedianDistributionPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [metricSearch, setMetricSearch] = useState("");

  const filteredSections = useMemo(() => {
    const search = metricSearch.trim().toLowerCase();
    return report.categorySections
      .filter((section) => categoryFilter === "all" || section.id === categoryFilter)
      .map((section) => ({
        ...section,
        metrics: section.metrics.filter((metric) => {
          if (!search) return true;
          return (
            metric.label.toLowerCase().includes(search) ||
            (metric.description?.toLowerCase().includes(search) ?? false)
          );
        }),
      }))
      .filter((section) => section.metrics.length > 0);
  }, [report.categorySections, categoryFilter, metricSearch]);

  const onCategoryFilter = useCallback((id: string) => {
    setCategoryFilter(id);
  }, []);

  const introHint =
    mode === "team"
      ? "Rozkład parametrów zespołu w sezonie (MatchStats): każdy wykres pokazuje wartości z poszczególnych meczów, " +
        "pudełko Q1–Q3, linię mediany oraz zaznaczony wybrany mecz. Im bliżej mediany, tym typowy wynik w próbie."
      : "Rozkład parametrów składu w sezonie (Squad STATS, per 90): każdy wykres pokazuje zawodników w składzie, " +
        "medianę sezonu składu oraz pozycję wybranego zawodnika.";

  return (
    <div className={styles.root}>
      <p className={teamStyles.hint}>
        {introHint}
        {scopeHint ? ` ${scopeHint}` : ""}
      </p>

      <div className={styles.toolbar}>
        {highlightOptions.length > 0 && onHighlightChange ? (
          <>
            <label htmlFor="statsbomb-median-highlight" className={styles.toolbarLabel}>
              {mode === "team" ? "Mecz" : "Zawodnik"}
            </label>
            <select
              id="statsbomb-median-highlight"
              className={styles.select}
              value={highlightId ?? ""}
              onChange={(e) => onHighlightChange(e.target.value)}
              aria-label={mode === "team" ? "Wybierz mecz do podświetlenia" : "Wybierz zawodnika"}
            >
              {highlightOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                  {opt.subLabel ? ` (${opt.subLabel})` : ""}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <input
          type="search"
          className={styles.searchInput}
          value={metricSearch}
          onChange={(e) => setMetricSearch(e.target.value)}
          placeholder="Szukaj parametru…"
          aria-label="Szukaj parametru w rozkładzie median"
        />
      </div>

      <div className={styles.legend} aria-label="Legenda wykresu">
        <span className={styles.legendItem}>
          <span className={styles.legendWhisker} /> min–max
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendIqr} /> Q1–Q3
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendMedian} /> mediana
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} /> obserwacja
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotWin}`} /> wygrana
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotDraw}`} /> remis
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotLoss}`} /> porażka
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.legendDotHighlight}`} /> wybrany
        </span>
      </div>

      <div className={styles.categoryFilters} role="tablist" aria-label="Filtr kategorii parametrów">
        <button
          type="button"
          role="tab"
          aria-selected={categoryFilter === "all"}
          className={`${styles.filterButton} ${categoryFilter === "all" ? styles.filterButtonActive : ""}`}
          onClick={() => onCategoryFilter("all")}
        >
          Wszystkie
        </button>
        {report.categorySections.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={categoryFilter === section.id}
            className={`${styles.filterButton} ${categoryFilter === section.id ? styles.filterButtonActive : ""}`}
            onClick={() => onCategoryFilter(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>

      {filteredSections.length === 0 ? (
        <p className={teamStyles.emptySection}>Brak parametrów dla wybranych filtrów.</p>
      ) : (
        filteredSections.map((section, index) => (
          <CategorySection
            key={section.id}
            section={section}
            highlightId={highlightId}
            defaultExpanded={index < 2 || categoryFilter !== "all"}
          />
        ))
      )}
    </div>
  );
}
