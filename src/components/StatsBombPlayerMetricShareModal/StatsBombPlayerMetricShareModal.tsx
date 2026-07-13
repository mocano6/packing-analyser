"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StatsBombSquadPlayerRow } from "@/utils/statsbombCsvParser";
import {
  buildPlayerMetricShare,
  buildSetPieceGoalsShareViews,
  SET_PIECE_GOALS_METRIC_LABEL,
  SET_PIECE_GOALS_UNAVAILABLE_NOTE,
  SET_PIECE_XG_ASSISTED_METRIC_LABEL,
  type StatsBombPlayerMetricShareResult,
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

type ShareSortColumn =
  | "displayName"
  | "minutes"
  | "per90"
  | "estimatedTotal"
  | "sharePct"
  | "sampleTotal"
  | "samplePerMinute"
  | "volumeQualityPerMinute";
type ShareSortDirection = "asc" | "desc";
type SetPieceGoalsTab = "goals" | "xgAssisted";

const DEFAULT_SHARE_SORT: { column: ShareSortColumn; direction: ShareSortDirection } = {
  column: "sharePct",
  direction: "desc",
};

const DEFAULT_RATE_SORT: { column: ShareSortColumn; direction: ShareSortDirection } = {
  column: "per90",
  direction: "desc",
};

const DEFAULT_RATE_VOLUME_QUALITY_SORT: { column: ShareSortColumn; direction: ShareSortDirection } =
  {
    column: "volumeQualityPerMinute",
    direction: "desc",
  };

const SHARE_SORTABLE_COLUMNS: { id: ShareSortColumn; label: string }[] = [
  { id: "displayName", label: "Zawodnik" },
  { id: "minutes", label: "Min" },
  { id: "per90", label: "Per 90" },
  { id: "estimatedTotal", label: "Szac. wkład" },
  { id: "sharePct", label: "Udział" },
];

const RATE_SORTABLE_BASE: { id: ShareSortColumn; label: string }[] = [
  { id: "displayName", label: "Zawodnik" },
  { id: "minutes", label: "Min" },
  { id: "sampleTotal", label: "Strzały" },
  { id: "samplePerMinute", label: "Strz./min" },
  { id: "per90", label: "Wartość" },
];

const RATE_VOLUME_QUALITY_COLUMN: { id: ShareSortColumn; label: string } = {
  id: "volumeQualityPerMinute",
  label: "xG strz./min",
};

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
    if (column === "sampleTotal") {
      return mult * ((a.sampleTotal ?? 0) - (b.sampleTotal ?? 0));
    }
    if (column === "samplePerMinute") {
      return mult * ((a.samplePerMinute ?? 0) - (b.samplePerMinute ?? 0));
    }
    if (column === "volumeQualityPerMinute") {
      return mult * ((a.volumeQualityPerMinute ?? 0) - (b.volumeQualityPerMinute ?? 0));
    }
    return mult * (a[column] - b[column]);
  });
}

function formatSampleTotal(value: number | undefined): string {
  if (!Number.isFinite(value)) return "—";
  return Math.round(value!).toLocaleString("pl-PL");
}

function formatNum(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function defaultSortForShare(share: StatsBombPlayerMetricShareResult) {
  if (share.mode === "rate" && share.volumeQualityLabel) {
    return DEFAULT_RATE_VOLUME_QUALITY_SORT;
  }
  return share.mode === "rate" ? DEFAULT_RATE_SORT : DEFAULT_SHARE_SORT;
}

type ShareTableProps = {
  share: StatsBombPlayerMetricShareResult;
  minMinutes: number;
};

function ShareTable({ share, minMinutes }: ShareTableProps) {
  const [shareSort, setShareSort] = useState(() => defaultSortForShare(share));

  useEffect(() => {
    setShareSort(defaultSortForShare(share));
  }, [share.metricLabel, share.squadColumn, share.mode, share.volumeQualityLabel]);

  const sortedRows = useMemo(
    () => sortShareRows(share.rows, shareSort.column, shareSort.direction),
    [share.rows, shareSort],
  );

  const sortableColumns = useMemo(() => {
    if (share.mode !== "rate") return SHARE_SORTABLE_COLUMNS;
    const rateColumns = RATE_SORTABLE_BASE.map((col) =>
      col.id === "sampleTotal" && share.sampleLabel ? { ...col, label: share.sampleLabel } : col,
    );
    if (share.volumeQualityLabel) {
      rateColumns.push({
        ...RATE_VOLUME_QUALITY_COLUMN,
        label: share.volumeQualityLabel,
      });
    }
    return rateColumns;
  }, [share.mode, share.sampleLabel, share.volumeQualityLabel]);

  const isRateMode = share.mode === "rate";
  const hasVolumeQuality = Boolean(share.volumeQualityLabel);
  const hasSetPieceBreakdown = Boolean(share.setPieceBreakdown);

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

  const maxShare = Math.max(...share.rows.map((row) => row.sharePct), 0) || 100;
  const maxPer90 = Math.max(...share.rows.map((row) => row.per90), 0) || 1;
  const maxVolumeQuality =
    Math.max(...share.rows.map((row) => row.volumeQualityPerMinute ?? 0), 0) || 1;

  return (
    <>
      <div className={styles.meta}>
        <span>
          Kolumna Squad: <strong>{share.squadColumn}</strong>
        </span>
        <span>
          Zawodnicy: <strong>{share.contributingPlayerCount}</strong>
        </span>
        <span>
          {isRateMode ? "Średnia składu" : "Suma szacowana"}:{" "}
          <strong>{formatNum(share.teamEstimatedTotal, isRateMode ? 3 : 2)}</strong>
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {sortableColumns.map(({ id, label }) => {
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
                    title={
                      id === "volumeQualityPerMinute"
                        ? "xG/Shot × Strz./min — łączy jakość i częstotliwość strzałów. Kliknij, aby sortować."
                        : `Sortuj po ${label}. Kliknij, aby przełączyć kierunek.`
                    }
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
              {hasSetPieceBreakdown ? (
                <th scope="col" className={styles.setPieceHead} title={share.setPieceBreakdown?.modeNote}>
                  Rodzaj SF
                </th>
              ) : null}
              <th scope="col">{isRateMode ? "Względem max" : "Rozkład"}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.displayName}</td>
                <td className={styles.num}>{Math.round(row.minutes)}</td>
                {isRateMode ? (
                  <>
                    <td className={styles.num}>{formatSampleTotal(row.sampleTotal)}</td>
                    <td className={styles.num}>{formatNum(row.samplePerMinute, 3)}</td>
                  </>
                ) : null}
                <td className={styles.num}>{formatNum(row.per90, isRateMode ? 3 : 2)}</td>
                {isRateMode && hasVolumeQuality ? (
                  <td className={`${styles.num} ${styles.shareStrong}`}>
                    {formatNum(row.volumeQualityPerMinute, 4)}
                  </td>
                ) : null}
                {!isRateMode ? (
                  <>
                    <td className={styles.num}>{formatNum(row.estimatedTotal)}</td>
                    <td className={`${styles.num} ${styles.shareStrong}`}>
                      {formatNum(row.sharePct, 1)}%
                    </td>
                  </>
                ) : null}
                {hasSetPieceBreakdown ? (
                  <td className={styles.setPieceCell}>
                    {row.setPieceTypes && row.setPieceTypes.length > 0 ? (
                      <div className={styles.setPieceTypeList}>
                        {row.setPieceTypes.map((type) => (
                          <span
                            key={type.id}
                            className={
                              type.isDominant
                                ? styles.setPieceTypeTagDominant
                                : styles.setPieceTypeTag
                            }
                            title={`${type.label}: ${formatNum(type.sharePct, 0)}% (${formatNum(type.per90, 2)} per 90)`}
                          >
                            {type.shortLabel} {formatNum(type.sharePct, 0)}%
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.setPieceEmpty}>—</span>
                    )}
                  </td>
                ) : null}
                <td className={styles.barCell}>
                  <div className={styles.barTrack} aria-hidden="true">
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.max(
                          4,
                          isRateMode
                            ? hasVolumeQuality
                              ? ((row.volumeQualityPerMinute ?? 0) / maxVolumeQuality) * 100
                              : (row.per90 / maxPer90) * 100
                            : (row.sharePct / maxShare) * 100,
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
      <div className={styles.footerNotes}>
        {share.description ? <p className={styles.footerNote}>{share.description}</p> : null}
        <p className={styles.footerNote}>
          {isRateMode
            ? hasVolumeQuality
              ? `„${share.volumeQualityLabel}” = xG/Shot × Strz./min (jakość i wolumen strzałów). „${share.sampleLabel ?? "Próby"}”: szacunek sezonowy (per 90 × min / 90). Zawodnicy poniżej ${minMinutes} min bez strzałów nie wchodzą do próby.`
              : `Ranking wg wartości per 90 w Squad STATS. „${share.sampleLabel ?? "Próby"}”: szacunek sezonowy (per 90 × min / 90). Strz./min = strzały per 90 ÷ 90. Zawodnicy poniżej ${minMinutes} min bez strzałów nie wchodzą do próby.`
            : `Udział (%): wkład zawodnika względem składu (dla metryk ze znakiem, np. OBV, liczymy wartość bezwzględną wkładu). Szacunek: per 90 × minuty / 90. Zawodnicy poniżej ${minMinutes} min nie wchodzą do próby.`}
          {share.setPieceBreakdown ? ` ${share.setPieceBreakdown.modeNote}` : ""}
        </p>
      </div>
    </>
  );
}

export default function StatsBombPlayerMetricShareModal({
  isOpen,
  metricLabel,
  players,
  contextNote,
  minMinutes = 300,
  onClose,
}: StatsBombPlayerMetricShareModalProps) {
  const [setPieceTab, setSetPieceTab] = useState<SetPieceGoalsTab>("goals");

  const modalData = useMemo(() => {
    if (!isOpen || !metricLabel) return null;
    if (metricLabel === SET_PIECE_GOALS_METRIC_LABEL) {
      const views = buildSetPieceGoalsShareViews(players, minMinutes);
      if (!views.goals && !views.xgAssisted) return null;
      return { kind: "setPieceGoals" as const, views };
    }
    const share = buildPlayerMetricShare(players, metricLabel, minMinutes);
    if (!share) return null;
    return { kind: "single" as const, share };
  }, [isOpen, metricLabel, players, minMinutes]);

  const activeShare = useMemo(() => {
    if (!modalData) return null;
    if (modalData.kind === "single") return modalData.share;
    return setPieceTab === "goals" ? modalData.views.goals : modalData.views.xgAssisted;
  }, [modalData, setPieceTab]);

  const hasSetPieceTabs =
    modalData?.kind === "setPieceGoals" && modalData.views.xgAssisted !== null;

  useEffect(() => {
    if (isOpen && metricLabel === SET_PIECE_GOALS_METRIC_LABEL) {
      setSetPieceTab("goals");
    }
  }, [isOpen, metricLabel]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !metricLabel || !modalData) return null;

  const isSetPieceGoalsModal = modalData.kind === "setPieceGoals";
  const titleMetricLabel = isSetPieceGoalsModal
    ? SET_PIECE_GOALS_METRIC_LABEL
    : modalData.share.metricLabel;
  const isRateMode = activeShare?.mode === "rate";
  const hasSetPieceBreakdown = Boolean(activeShare?.setPieceBreakdown);

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statsbomb-share-modal-title"
    >
      <div
        className={`${styles.dialog} ${hasSetPieceBreakdown ? styles.dialogWide : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="statsbomb-share-modal-title" className={styles.title}>
              {isRateMode ? "Ranking zawodników" : "Udział zawodników"}: {titleMetricLabel}
            </h2>
            <p className={styles.subtitle}>
              {isSetPieceGoalsModal
                ? setPieceTab === "goals"
                  ? "Gole ze stałych fragmentów — udział strzelców w składzie (Squad STATS)."
                  : "Set Piece xG Assisted — xG tworzone ze stałych fragmentów (inna metryka niż gole SF)."
                : isRateMode
                  ? activeShare?.volumeQualityLabel
                    ? "Domyślnie sortowanie po xG strz./min (jakość × częstotliwość strzałów)."
                    : "Wartości per 90 z Squad STATS — od najwyższej do najniższej."
                  : "Szacowany wkład w składzie na podstawie Squad STATS (per 90 × minuty / 90)."}
              {activeShare?.shareNote ? ` ${activeShare.shareNote}` : ""}
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
          {hasSetPieceTabs ? (
            <div className={styles.tabs} role="tablist" aria-label="Widoki stałych fragmentów">
              <button
                type="button"
                role="tab"
                id="statsbomb-sp-tab-goals"
                aria-selected={setPieceTab === "goals"}
                aria-controls="statsbomb-sp-tabpanel"
                className={`${styles.tabButton} ${setPieceTab === "goals" ? styles.tabButtonActive : ""}`}
                onClick={() => setSetPieceTab("goals")}
              >
                Gole SF
              </button>
              <button
                type="button"
                role="tab"
                id="statsbomb-sp-tab-xg"
                aria-selected={setPieceTab === "xgAssisted"}
                aria-controls="statsbomb-sp-tabpanel"
                className={`${styles.tabButton} ${setPieceTab === "xgAssisted" ? styles.tabButtonActive : ""}`}
                onClick={() => setSetPieceTab("xgAssisted")}
              >
                {SET_PIECE_XG_ASSISTED_METRIC_LABEL}
              </button>
            </div>
          ) : null}
          <div
            id="statsbomb-sp-tabpanel"
            role={hasSetPieceTabs ? "tabpanel" : undefined}
            aria-labelledby={
              hasSetPieceTabs
                ? setPieceTab === "goals"
                  ? "statsbomb-sp-tab-goals"
                  : "statsbomb-sp-tab-xg"
                : undefined
            }
          >
            {activeShare ? (
              <ShareTable key={activeShare.squadColumn} share={activeShare} minMinutes={minMinutes} />
            ) : (
              <div className={styles.emptyTab}>
                <p>{SET_PIECE_GOALS_UNAVAILABLE_NOTE}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
