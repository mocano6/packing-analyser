"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { StatsBombMatchRow } from "@/utils/statsbombCsvParser";
import {
  formatDistributionValue,
  type StatsBombMedianCategorySection,
  type StatsBombMedianDistributionReport,
  type StatsBombMetricDistributionRow,
  valueToChartPercent,
} from "@/utils/statsBombMedianDistribution";
import { statsBombMatchRowId } from "@/utils/statsBombTeamMedianDistribution";
import { statsBombPhaseLabel } from "@/utils/statsBombTeamReport";
import StatsBombMatchMedianDeviationTable from "@/components/StatsBombMatchMedianDeviationTable/StatsBombMatchMedianDeviationTable";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombMedianDistributionPanel.module.css";

type MedianPanelView = "charts" | "deviations";

export type StatsBombMedianDistributionPanelProps = {
  report: StatsBombMedianDistributionReport;
  mode: "team" | "player";
  highlightId?: string | null;
  highlightOptions?: Array<{ id: string; label: string; subLabel?: string }>;
  onHighlightChange?: (id: string) => void;
  scopeHint?: string;
  /** Mecz spoza próby mediany — nadal można go porównać z medianą (np. wyłączony checkboxem). */
  highlightMatchRow?: StatsBombMatchRow | null;
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
  highlightMatchRow,
}: {
  metric: StatsBombMetricDistributionRow;
  highlightId?: string | null;
  highlightMatchRow?: StatsBombMatchRow | null;
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

  const externalHighlight =
    highlightId &&
    !highlighted &&
    highlightMatchRow &&
    statsBombMatchRowId(highlightMatchRow) === highlightId
      ? (() => {
          const value = highlightMatchRow.numeric[metric.label];
          if (!Number.isFinite(value)) return null;
          return {
            label: highlightMatchRow.opponent,
            subLabel: highlightMatchRow.date,
            value,
          };
        })()
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
        {externalHighlight ? (
          <div
            className={`${styles.obsDot} ${styles.obsDotHighlighted} ${styles.obsDotExternal}`}
            style={{ left: `${valueToChartPercent(externalHighlight.value, stats)}%` }}
            title={`${externalHighlight.label}: ${formatDistributionValue(externalHighlight.value, metric.label)} (${externalHighlight.subLabel}) — poza próbą mediany`}
          />
        ) : null}
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
        ) : externalHighlight ? (
          <span className={styles.statChipHighlight} title={`${externalHighlight.subLabel} — poza próbą mediany`}>
            {externalHighlight.label}: {formatDistributionValue(externalHighlight.value, metric.label)} (poza próbą)
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CategorySection({
  section,
  highlightId,
  highlightMatchRow,
  defaultExpanded,
}: {
  section: StatsBombMedianCategorySection;
  highlightId?: string | null;
  highlightMatchRow?: StatsBombMatchRow | null;
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
            <DistributionChartRow
              key={metric.id}
              metric={metric}
              highlightId={highlightId}
              highlightMatchRow={highlightMatchRow}
            />
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
  highlightMatchRow,
}: StatsBombMedianDistributionPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [metricSearch, setMetricSearch] = useState("");
  const [panelView, setPanelView] = useState<MedianPanelView>("charts");

  const highlightLabel = useMemo(() => {
    if (!highlightId) return undefined;
    const option = highlightOptions.find((opt) => opt.id === highlightId);
    if (option) {
      return option.subLabel ? `${option.label} (${option.subLabel})` : option.label;
    }
    return undefined;
  }, [highlightId, highlightOptions]);

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

      {mode === "team" ? (
        <div className={styles.viewTabs} role="tablist" aria-label="Widok analizy mediany">
          <button
            type="button"
            role="tab"
            aria-selected={panelView === "charts"}
            className={`${styles.viewTab} ${panelView === "charts" ? styles.viewTabActive : ""}`}
            onClick={() => setPanelView("charts")}
          >
            Wykresy rozkładu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelView === "deviations"}
            className={`${styles.viewTab} ${panelView === "deviations" ? styles.viewTabActive : ""}`}
            onClick={() => setPanelView("deviations")}
          >
            Odchylenia wybranego meczu
          </button>
        </div>
      ) : null}

      {mode === "team" && panelView === "deviations" ? (
        <>
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
          <StatsBombMatchMedianDeviationTable
            report={report}
            highlightId={highlightId}
            highlightMatchRow={highlightMatchRow}
            highlightLabel={highlightLabel}
            categoryFilter={categoryFilter}
            metricSearch={metricSearch}
          />
        </>
      ) : null}

      {mode !== "team" || panelView === "charts" ? (
        <>
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
            highlightMatchRow={highlightMatchRow}
            defaultExpanded={index < 2 || categoryFilter !== "all"}
          />
        ))
      )}
        </>
      ) : null}
    </div>
  );
}
