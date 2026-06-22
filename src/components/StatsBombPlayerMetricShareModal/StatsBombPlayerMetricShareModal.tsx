"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StatsBombSquadPlayerRow } from "@/utils/statsbombCsvParser";
import {
  buildPlayerMetricShare,
  type StatsBombPlayerMetricShareRow,
} from "@/utils/statsBombPlayerMetricShare";
import styles from "./StatsBombPlayerMetricShareModal.module.css";

export type StatsBombPlayerMetricShareModalProps = {
  isOpen: boolean;
  metricLabel: string | null;
  players: StatsBombSquadPlayerRow[];
  contextNote?: string;
  minMinutes?: number;
  onClose: () => void;
};

type ShareSortColumn = "displayName" | "minutes" | "per90" | "estimatedTotal" | "sharePct";
type ShareSortDirection = "asc" | "desc";

const DEFAULT_SHARE_SORT: { column: ShareSortColumn; direction: ShareSortDirection } = {
  column: "sharePct",
  direction: "desc",
};

const SORTABLE_COLUMNS: { id: ShareSortColumn; label: string }[] = [
  { id: "displayName", label: "Zawodnik" },
  { id: "minutes", label: "Min" },
  { id: "per90", label: "Per 90" },
  { id: "estimatedTotal", label: "Szac. wkład" },
  { id: "sharePct", label: "Udział" },
];

function toggleShareSort(
  current: { column: ShareSortColumn; direction: ShareSortDirection },
  nextColumn: ShareSortColumn,
): { column: ShareSortColumn; direction: ShareSortDirection } {
  if (current.column === nextColumn) {
    return { column: nextColumn, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return {
    column: nextColumn,
    direction: nextColumn === "displayName" ? "asc" : "desc",
  };
}

function sortShareRows(
  rows: StatsBombPlayerMetricShareRow[],
  column: ShareSortColumn,
  direction: ShareSortDirection,
): StatsBombPlayerMetricShareRow[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (column === "displayName") {
      return mult * a.displayName.localeCompare(b.displayName, "pl");
    }
    return mult * (a[column] - b[column]);
  });
}

function formatNum(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export default function StatsBombPlayerMetricShareModal({
  isOpen,
  metricLabel,
  players,
  contextNote,
  minMinutes = 300,
  onClose,
}: StatsBombPlayerMetricShareModalProps) {
  const [shareSort, setShareSort] = useState(DEFAULT_SHARE_SORT);

  const share = useMemo(() => {
    if (!isOpen || !metricLabel) return null;
    return buildPlayerMetricShare(players, metricLabel, minMinutes);
  }, [isOpen, metricLabel, players, minMinutes]);

  useEffect(() => {
    if (!isOpen) return;
    setShareSort(DEFAULT_SHARE_SORT);
  }, [isOpen, metricLabel]);

  const sortedRows = useMemo(() => {
    if (!share) return [];
    return sortShareRows(share.rows, shareSort.column, shareSort.direction);
  }, [share, shareSort]);

  const toggleSort = useCallback((column: ShareSortColumn) => {
    setShareSort((prev) => toggleShareSort(prev, column));
  }, []);

  const onSortKeyDown = useCallback(
    (event: React.KeyboardEvent, column: ShareSortColumn) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSort(column);
      }
    },
    [toggleSort],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !metricLabel || !share) return null;

  const maxShare = Math.max(...share.rows.map((row) => row.sharePct), 0) || 100;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statsbomb-share-modal-title"
    >
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 id="statsbomb-share-modal-title" className={styles.title}>
              Udział zawodników: {share.metricLabel}
            </h2>
            <p className={styles.subtitle}>
              Szacowany wkład w składzie na podstawie Squad STATS (per 90 × minuty / 90).
              {contextNote ? ` ${contextNote}` : ""}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.meta}>
            <span>
              Kolumna Squad: <strong>{share.squadColumn}</strong>
            </span>
            <span>
              Zawodnicy z udziałem: <strong>{share.contributingPlayerCount}</strong>
            </span>
            <span>
              Suma szacowana: <strong>{formatNum(share.teamEstimatedTotal)}</strong>
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map(({ id, label }) => {
                    const isActive = shareSort.column === id;
                    const ascending = shareSort.direction === "asc";
                    return (
                      <th
                        key={id}
                        scope="col"
                        className={`${styles.sortableHead} ${isActive ? styles.sortableHeadActive : ""}`}
                        aria-sort={isActive ? (ascending ? "ascending" : "descending") : "none"}
                        onClick={() => toggleSort(id)}
                        onKeyDown={(event) => onSortKeyDown(event, id)}
                        tabIndex={0}
                        title={`Sortuj po ${label}. Kliknij, aby przełączyć kierunek.`}
                      >
                        {label}
                        {isActive ? (
                          <span className={styles.sortIndicator} aria-hidden="true">
                            {ascending ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </th>
                    );
                  })}
                  <th scope="col">Rozkład</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.playerId}>
                    <td>{row.displayName}</td>
                    <td className={styles.num}>{Math.round(row.minutes)}</td>
                    <td className={styles.num}>{formatNum(row.per90)}</td>
                    <td className={styles.num}>{formatNum(row.estimatedTotal)}</td>
                    <td className={`${styles.num} ${styles.shareStrong}`}>
                      {formatNum(row.sharePct, 1)}%
                    </td>
                    <td className={styles.barCell}>
                      <div className={styles.barTrack} aria-hidden="true">
                        <div
                          className={styles.barFill}
                          style={{ width: `${Math.max(4, (row.sharePct / maxShare) * 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footerNotes}>
            {share.description ? (
              <p className={styles.footerNote}>{share.description}</p>
            ) : null}
            <p className={styles.footerNote}>
              Udział (%): wkład zawodnika względem składu (dla metryk ze znakiem, np. OBV, liczymy
              wartość bezwzględną wkładu). Szacunek: per 90 × minuty / 90. Zawodnicy poniżej {minMinutes}{" "}
              min nie wchodzą do próby.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
