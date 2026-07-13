"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { StatsBombMatchRow } from "@/utils/statsbombCsvParser";
import {
  buildStatsBombMatchMedianDeviations,
  rankStatsBombMatchMedianDeviations,
  STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_DIRECTION,
  STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_SORT,
  toggleMatchMedianDeviationSort,
  type StatsBombMatchMedianDeviationRow,
  type StatsBombMatchMedianDeviationSortDirection,
  type StatsBombMatchMedianDeviationSortKey,
} from "@/utils/statsBombMatchMedianDeviation";
import { formatDistributionValue, type StatsBombMedianDistributionReport } from "@/utils/statsBombMedianDistribution";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombMatchMedianDeviationTable.module.css";

const SORT_COLUMNS: Array<{ key: StatsBombMatchMedianDeviationSortKey; label: string }> = [
  { key: "label", label: "Parametr" },
  { key: "categoryLabel", label: "Kategoria" },
  { key: "median", label: "Mediana" },
  { key: "matchValue", label: "Mecz" },
  { key: "deviation", label: "Odchylenie" },
  { key: "deviationPct", label: "Odchyl. %" },
  { key: "absDeviation", label: "|Odchylenie|" },
  { key: "absDeviationPct", label: "|Odchyl.| %" },
];

function formatSigned(value: number, label: string): string {
  const formatted = formatDistributionValue(Math.abs(value), label);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

function formatPct(value: number | null, reliable: boolean): string {
  if (!reliable || value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(0)}%`;
}

function phaseBadgeClass(phase: StatsBombMatchMedianDeviationRow["phase"]): string {
  switch (phase) {
    case "attack":
      return teamStyles.badgeAttack;
    case "defense":
      return teamStyles.badgeDefense;
    default:
      return teamStyles.badgeGeneral;
  }
}

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: StatsBombMatchMedianDeviationSortKey;
  activeSortKey: StatsBombMatchMedianDeviationSortKey;
  direction: StatsBombMatchMedianDeviationSortDirection;
  onSort: (key: StatsBombMatchMedianDeviationSortKey) => void;
}) {
  const isActive = activeSortKey === sortKey;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button
        type="button"
        className={`${styles.deviationSortHead} ${isActive ? styles.deviationSortHeadActive : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className={styles.deviationSortIndicator} aria-hidden="true">
          {isActive ? (direction === "asc" ? " ↑" : " ↓") : " ⇅"}
        </span>
      </button>
    </th>
  );
}

export type StatsBombMatchMedianDeviationTableProps = {
  report: StatsBombMedianDistributionReport;
  highlightId: string | null | undefined;
  highlightMatchRow?: StatsBombMatchRow | null;
  highlightLabel?: string;
  categoryFilter?: string;
  metricSearch?: string;
};

export default function StatsBombMatchMedianDeviationTable({
  report,
  highlightId,
  highlightMatchRow,
  highlightLabel,
  categoryFilter = "all",
  metricSearch = "",
}: StatsBombMatchMedianDeviationTableProps) {
  const [sortKey, setSortKey] = useState<StatsBombMatchMedianDeviationSortKey>(
    STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_SORT,
  );
  const [sortDirection, setSortDirection] = useState<StatsBombMatchMedianDeviationSortDirection>(
    STATSBOMB_MATCH_MEDIAN_DEVIATION_DEFAULT_DIRECTION,
  );

  const deviationRows = useMemo(() => {
    if (!highlightId) return [];
    return buildStatsBombMatchMedianDeviations(report, highlightId, highlightMatchRow);
  }, [report, highlightId, highlightMatchRow]);

  const filteredRows = useMemo(() => {
    const search = metricSearch.trim().toLowerCase();
    return deviationRows.filter((row) => {
      if (categoryFilter !== "all" && row.categoryId !== categoryFilter) return false;
      if (!search) return true;
      return (
        row.label.toLowerCase().includes(search) ||
        (row.description?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [deviationRows, categoryFilter, metricSearch]);

  const sortedRows = useMemo(
    () => rankStatsBombMatchMedianDeviations(filteredRows, sortKey, sortDirection),
    [filteredRows, sortKey, sortDirection],
  );

  const handleSort = useCallback(
    (nextKey: StatsBombMatchMedianDeviationSortKey) => {
      const next = toggleMatchMedianDeviationSort(sortKey, sortDirection, nextKey);
      setSortKey(next.sortKey);
      setSortDirection(next.direction);
    },
    [sortDirection, sortKey],
  );

  if (!highlightId) {
    return (
      <p className={teamStyles.emptySection}>
        Wybierz mecz w tabeli powyżej lub z listy rozwijanej, aby zobaczyć ranking odchyleń od
        mediany zaznaczonych meczów.
      </p>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <p className={teamStyles.emptySection}>
        Brak parametrów spełniających filtry dla {highlightLabel ?? "wybranego meczu"}.
      </p>
    );
  }

  const maxAbsPct =
    Math.max(...sortedRows.map((row) => row.absDeviationPct ?? 0), 0) || 100;
  const maxAbsDev = Math.max(...sortedRows.map((row) => row.absDeviation), 0) || 1;

  return (
    <div className={styles.deviationSection}>
      <p className={styles.deviationHint}>
        Parametry posortowane według tego, jak bardzo{" "}
        <strong>{highlightLabel ?? "wybrany mecz"}</strong> odbiega od mediany z zaznaczonych
        meczów. Domyślnie sortowanie po |odchyl.| % — najbardziej wysunięte parametry na górze.
      </p>
      <div className={`${teamStyles.tableWrap} ${styles.deviationTableWrap}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              {SORT_COLUMNS.map(({ key, label }) => (
                <SortableHeader
                  key={key}
                  label={label}
                  sortKey={key}
                  activeSortKey={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              ))}
              <th scope="col">Siła</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.metricId}>
                <td>
                  <span
                    className={teamStyles.metricLabel}
                    title={row.description ?? row.label}
                  >
                    {row.label}
                  </span>
                </td>
                <td>
                  <span className={`${teamStyles.badge} ${phaseBadgeClass(row.phase)}`}>
                    {row.categoryLabel}
                  </span>
                </td>
                <td className={teamStyles.num}>
                  {formatDistributionValue(row.median, row.label)}
                </td>
                <td className={teamStyles.num}>
                  {formatDistributionValue(row.matchValue, row.label)}
                </td>
                <td
                  className={`${teamStyles.num} ${row.deviation > 0 ? styles.deviationPositive : row.deviation < 0 ? styles.deviationNegative : ""}`}
                >
                  {formatSigned(row.deviation, row.label)}
                </td>
                <td
                  className={`${teamStyles.num} ${row.deviationPct !== null && row.deviationPct > 0 ? styles.deviationPositive : row.deviationPct !== null && row.deviationPct < 0 ? styles.deviationNegative : ""}`}
                  title={
                    row.pctReliable
                      ? "Odchylenie względem mediany z zaznaczonych meczów."
                      : "Brak sensownej skali % — patrz na odchylenie bezwzględne."
                  }
                >
                  {formatPct(row.deviationPct, row.pctReliable)}
                </td>
                <td className={teamStyles.num}>
                  {formatDistributionValue(row.absDeviation, row.label)}
                </td>
                <td className={teamStyles.num}>
                  {formatPct(row.absDeviationPct, row.pctReliable)}
                </td>
                <td className={styles.deviationBarCell}>
                  <div className={styles.deviationBarTrack} aria-hidden="true">
                    <div
                      className={styles.deviationBarFill}
                      style={{
                        width: `${Math.max(
                          4,
                          row.pctReliable && row.absDeviationPct !== null
                            ? (row.absDeviationPct / maxAbsPct) * 100
                            : (row.absDeviation / maxAbsDev) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
