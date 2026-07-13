"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StatsBombScoutPlayerRow, StatsBombMatchRow } from "@/utils/statsbombCsvParser";
import { formatStatsBombMarketValueEur } from "@/utils/statsbombCsvParser";
import {
  buildEmptyManualConfig,
  buildManualWeightedScoutingPoolRanking,
  buildManualWeightedScoutingReport,
  computeManualConfigTotalShare,
  createManualMetricEntryId,
  listAllScoutingMetricOptions,
  loadStoredManualConfig,
  manualConfigHasActiveWeights,
  saveStoredManualConfig,
  sanitizeManualConfig,
  type StatsBombManualScoutingReport,
  type StatsBombScoutingManualConfig,
  type StatsBombScoutingManualMetricEntry,
  type StatsBombScoutingManualMetricResult,
} from "@/utils/statsBombScoutingManualConfig";
import {
  buildStatsBombPlayerScoutingReportFromComputation,
  buildStatsBombScoutingComputation,
  buildStatsBombScoutingPoolRankingFromComputation,
  collectSquadMetricColumns,
  type StatsBombScoutingComputation,
  type StatsBombScoutingCriterionResult,
  type StatsBombScoutingPhaseSummary,
  type StatsBombScoutingPoolFilters,
  type StatsBombScoutingPoolRow,
  type StatsBombPlayerScoutingReport,
} from "@/utils/statsBombPlayerScouting";
import {
  buildScoutingCriterionWeights,
  buildWeightedScoutingCriterionScores,
  buildWeightedScoutingPoolRanking,
  computeWeightedScoutingFitPercentile,
  computeScoutingWeightShare,
  describeScoutingWeightImpact,
  listScoutingCorrelationReferenceMetrics,
  STATSBOMB_SCOUTING_CORR_MIN_ABS_R,
  STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID,
  summarizeWeightedScoutingPhase,
  type StatsBombScoutingCorrelationWeightsReport,
  type StatsBombScoutingWeightedCriterionScore,
  type StatsBombScoutingWeightedPoolRow,
} from "@/utils/statsBombScoutingCorrelationWeights";
import type { StatsBombMetric } from "@/utils/statsbombCorrelation";
import {
  STATSBOMB_SCOUTING_POSITIONS,
  type StatsBombScoutingPositionId,
} from "@/utils/statsBombScoutingProfiles";
import {
  STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  STATSBOMB_PLAYER_STRONG_PERCENTILE,
  STATSBOMB_PLAYER_WEAK_PERCENTILE,
  statsBombPhaseLabel,
  statsBombPlayerRoleLabel,
} from "@/utils/statsBombPlayerReport";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombPlayerScoutingPanel.module.css";

export type StatsBombPlayerScoutingPanelProps = {
  players: StatsBombScoutPlayerRow[];
  matchRows?: StatsBombMatchRow[];
  positionId?: StatsBombScoutingPositionId;
};

type ScoutingSubTab = "profile" | "correlation" | "manual";

const SCOUTING_CORR_REFERENCE_STORAGE_KEY = "statsbomb_scouting_corr_reference_metric_id";

function readStoredReferenceMetricId(): string {
  if (typeof window === "undefined") return STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID;
  try {
    const stored = window.localStorage.getItem(SCOUTING_CORR_REFERENCE_STORAGE_KEY);
    return stored?.trim() || STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID;
  } catch {
    return STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID;
  }
}

function formatNum(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function formatPercentile(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatAge(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${Math.round(value)}`;
}

function formatHeight(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : `${Math.round(value)} cm`;
}

function formatPreferredFoot(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "—";
  if (normalized === "left" || normalized === "l") return "L";
  if (normalized === "right" || normalized === "r") return "P";
  if (normalized === "both") return "Obie";
  return value.trim();
}

function roleBadgeClass(role: StatsBombScoutingCriterionResult["role"]): string {
  switch (role) {
    case "strength":
      return teamStyles.badgeStrength;
    case "weakness":
      return teamStyles.badgeWeakness;
    default:
      return teamStyles.badgeNeutral;
  }
}

function percentileClass(percentile: number | null): string {
  if (percentile === null) return teamStyles.corrNeutral;
  if (percentile >= STATSBOMB_PLAYER_STRONG_PERCENTILE) return teamStyles.corrPosStrong;
  if (percentile <= STATSBOMB_PLAYER_WEAK_PERCENTILE) return teamStyles.corrNegStrong;
  return teamStyles.corrNeutral;
}

function PhaseSummaryCard({ summary }: { summary: StatsBombScoutingPhaseSummary }) {
  return (
    <article className={teamStyles.summaryCard}>
      <div className={teamStyles.summaryLabel}>
        {summary.phase === "attack" ? "Faza ataku" : "Faza defensywy"}
      </div>
      <div className={teamStyles.summaryValue}>
        {summary.avgPercentile === null ? "—" : `${Math.round(summary.avgPercentile)}%`}
      </div>
      <div className={teamStyles.summarySub}>
        Śr. percentyl · {summary.matchedCount}/{summary.totalCount} kryteriów ·{" "}
        {summary.strengthCount} mocnych · {summary.weaknessCount} słabych
      </div>
    </article>
  );
}

function CriteriaTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: StatsBombScoutingCriterionResult[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className={teamStyles.emptySection}>{emptyMessage}</p>;
  }

  return (
    <section className={teamStyles.section} aria-label={title}>
      <h3 className={teamStyles.sectionTitle}>{title}</h3>
      <div className={`${teamStyles.tableWrap} ${styles.tableWrapTall}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">Kryterium scoutingowe</th>
              <th scope="col">Metryka StatsBomb</th>
              <th scope="col">Per 90</th>
              <th scope="col">Śr. próba</th>
              <th scope="col">Percentyl</th>
              <th scope="col">Ocena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.criterionId}>
                <td>
                  <span className={styles.criterionLabel} title={row.rationale}>
                    {row.criterionLabel}
                  </span>
                  <span className={styles.criterionRationale}>{row.rationale}</span>
                </td>
                <td>
                  {row.metricLabel ? (
                    <span className={teamStyles.metricLabel} title={row.metricLabel}>
                      {row.metricLabel}
                    </span>
                  ) : (
                    <span className={styles.missingMetric}>Brak kolumny w eksporcie</span>
                  )}
                </td>
                <td className={teamStyles.num}>{formatNum(row.playerValue)}</td>
                <td className={teamStyles.num}>{formatNum(row.teamAvg)}</td>
                <td className={`${teamStyles.num} ${percentileClass(row.percentile)}`}>
                  {formatPercentile(row.percentile)}
                </td>
                <td>
                  {row.status === "missing" ? (
                    <span className={`${teamStyles.badge} ${teamStyles.badgeNeutral}`}>Brak danych</span>
                  ) : (
                    <span className={`${teamStyles.badge} ${roleBadgeClass(row.role)}`}>
                      {statsBombPlayerRoleLabel(row.role)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManualMetricsTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: StatsBombScoutingManualMetricResult[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className={teamStyles.emptySection}>{emptyMessage}</p>;
  }

  return (
    <section className={teamStyles.section} aria-label={title}>
      <h3 className={teamStyles.sectionTitle}>{title}</h3>
      <div className={`${teamStyles.tableWrap} ${styles.tableWrapTall}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">Metryka StatsBomb</th>
              <th scope="col">Udział</th>
              <th scope="col">Per 90</th>
              <th scope="col">Śr. próba</th>
              <th scope="col">Percentyl</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entryId}>
                <td>
                  <span className={teamStyles.metricLabel}>{row.metricLabel}</span>
                </td>
                <td className={teamStyles.num}>{row.sharePercent}%</td>
                <td className={teamStyles.num}>{formatNum(row.playerValue)}</td>
                <td className={teamStyles.num}>{formatNum(row.teamAvg)}</td>
                <td className={`${teamStyles.num} ${percentileClass(row.percentile)}`}>
                  {formatPercentile(row.percentile)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManualCriteriaConfigTable({
  computation,
  manualConfig,
  onConfigChange,
  onClearAll,
}: {
  computation: StatsBombScoutingComputation;
  manualConfig: StatsBombScoutingManualConfig;
  onConfigChange: (next: StatsBombScoutingManualConfig) => void;
  onClearAll: () => void;
}) {
  const availableColumns = useMemo(
    () => listAllScoutingMetricOptions(collectSquadMetricColumns(computation.players)),
    [computation.players],
  );

  const usedMetricKeys = useMemo(
    () =>
      new Set(
        manualConfig
          .map((entry) => entry.metricLabel?.trim().toLowerCase())
          .filter((label): label is string => Boolean(label)),
      ),
    [manualConfig],
  );

  const totalShare = useMemo(
    () => computeManualConfigTotalShare(manualConfig),
    [manualConfig],
  );

  const updateEntry = useCallback(
    (entryId: string, patch: Partial<StatsBombScoutingManualMetricEntry>) => {
      onConfigChange(
        manualConfig.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
      );
    },
    [manualConfig, onConfigChange],
  );

  const removeEntry = useCallback(
    (entryId: string) => {
      onConfigChange(manualConfig.filter((entry) => entry.id !== entryId));
    },
    [manualConfig, onConfigChange],
  );

  const addEntry = useCallback(() => {
    onConfigChange([
      ...manualConfig,
      {
        id: createManualMetricEntryId(),
        metricLabel: null,
        sharePercent: 0,
      },
    ]);
  }, [manualConfig, onConfigChange]);

  return (
    <section
      className={teamStyles.section}
      aria-label="Ręczna konfiguracja metryk i udziałów WADZ"
    >
      <div className={styles.manualConfigHeader}>
        <div>
          <h3 className={teamStyles.sectionTitle}>Metryki i udziały — konfiguracja ręczna</h3>
          <p className={teamStyles.sectionLead}>
            Dodaj metryki z listy kolumn PlayerScout i ustaw udział procentowy każdej z nich w
            ważonej ocenie (WADZ). Na starcie lista jest pusta — budujesz profil samodzielnie.
            Zmiany zapisują się automatycznie i przesortowują ranking.
          </p>
        </div>
        <div className={styles.manualConfigActions}>
          <button type="button" className={styles.addMetricButton} onClick={addEntry}>
            Dodaj metrykę
          </button>
          {manualConfig.length > 0 ? (
            <button type="button" className={styles.resetManualButton} onClick={onClearAll}>
              Wyczyść wszystko
            </button>
          ) : null}
        </div>
      </div>

      {manualConfig.length === 0 ? (
        <p className={teamStyles.emptySection}>
          Brak metryk. Kliknij <strong>Dodaj metrykę</strong>, wybierz kolumnę z PlayerScout i
          ustaw udział procentowy w WADZ.
        </p>
      ) : (
        <>
          <p className={styles.manualShareSummary} aria-live="polite">
            Suma udziałów: <strong>{totalShare}%</strong>
            {totalShare !== 100 ? " — idealnie 100%, ale WADZ działa także przy innej sumie." : ""}
          </p>
          <div className={`${teamStyles.tableWrap} ${styles.tableWrapTall}`}>
            <table className={teamStyles.table}>
              <thead>
                <tr>
                  <th scope="col">Metryka (PlayerScout)</th>
                  <th scope="col">Udział (%)</th>
                  <th scope="col">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {manualConfig.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <select
                        className={styles.metricSelect}
                        value={entry.metricLabel ?? ""}
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            metricLabel: event.target.value || null,
                          })
                        }
                        aria-label="Metryka z listy PlayerScout"
                      >
                        <option value="">— wybierz metrykę —</option>
                        {availableColumns.map((label) => {
                          const isUsedElsewhere =
                            Boolean(label.trim()) &&
                            usedMetricKeys.has(label.trim().toLowerCase()) &&
                            entry.metricLabel?.trim().toLowerCase() !== label.trim().toLowerCase();
                          return (
                            <option key={label} value={label} disabled={isUsedElsewhere}>
                              {label}
                              {isUsedElsewhere ? " (już dodana)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        className={styles.weightInput}
                        value={entry.sharePercent}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          updateEntry(entry.id, {
                            sharePercent:
                              Number.isFinite(parsed) && parsed >= 0
                                ? Math.min(100, parsed)
                                : 0,
                          });
                        }}
                        aria-label="Udział procentowy metryki w WADZ"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeMetricButton}
                        onClick={() => removeEntry(entry.id)}
                        aria-label="Usuń metrykę"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function formatCorrelation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function weightStatusLabel(status: StatsBombScoutingWeightedCriterionScore["status"]): string {
  switch (status) {
    case "weighted":
      return "Ważone";
    case "weak_correlation":
      return "Słaba korelacja";
    case "negative_correlation":
      return "Korelacja ujemna";
    case "missing_match_data":
      return "Brak w meczach";
    case "missing_player_metric":
      return "Brak metryki";
    default:
      return status;
  }
}

function formatWeightShare(weight: number, totalActiveWeight: number): string {
  const share = computeScoutingWeightShare(weight, totalActiveWeight);
  return share === null ? "—" : `${Math.round(share)}%`;
}

function WeightsTable({ report }: { report: StatsBombScoutingCorrelationWeightsReport }) {
  const activeCount = report.criterionWeights.filter((row) => row.status === "weighted").length;
  const referenceLabel = report.referenceMetricLabel;

  return (
    <section
      className={teamStyles.section}
      aria-label={`Wagi kryteriów z korelacji z ${referenceLabel}`}
    >
      <h3 className={teamStyles.sectionTitle}>
        Wagi kryteriów — korelacja z {referenceLabel}
      </h3>
      <p className={teamStyles.sectionLead}>
        Wagi pochodzą z analizy korelacji metryk meczowych z{" "}
        <strong>{referenceLabel}</strong> ({report.matchCount} meczów). Dla każdego kryterium
        wybierana jest metryka z listy kandydatów o najsilniejszej korelacji z {referenceLabel}{" "}
        (wymaga kolumny w PlayerScout i MatchStats). Do rankingu wliczane są kryteria ze skuteczną
        korelacją ≥ <strong>{STATSBOMB_SCOUTING_CORR_MIN_ABS_R}</strong> — dla metryk «więcej =
        lepiej» dodatnia r, dla «mniej = lepiej» (np. Turnovers, Dispossessed) ujemna r (waga =
        |r|). Aktywne: <strong>{activeCount}</strong> / {report.criterionWeights.length}.
        {report.attackWeightShare !== null && report.defenseWeightShare !== null ? (
          <>
            {" "}
            Udział wag: atak{" "}
            <strong>{Math.round(report.attackWeightShare * 100)}%</strong>, obrona{" "}
            <strong>{Math.round(report.defenseWeightShare * 100)}%</strong>.
          </>
        ) : null}
      </p>
      <div className={`${teamStyles.tableWrap} ${styles.tableWrapTall}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">Kryterium</th>
              <th scope="col">Faza</th>
              <th scope="col">Metryka gracza</th>
              <th scope="col">Metryka meczu</th>
              <th scope="col">r ({referenceLabel})</th>
              <th scope="col">Waga</th>
              <th scope="col">Udział</th>
              <th scope="col">Uzasadnienie wpływu</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {report.criterionWeights.map((row) => {
              const rationale = describeScoutingWeightImpact(
                row,
                referenceLabel,
                report.matchCount,
              );
              return (
              <tr key={row.criterionId}>
                <td>{row.criterionLabel}</td>
                <td>{statsBombPhaseLabel(row.phase)}</td>
                <td>{row.playerMetricLabel ?? "—"}</td>
                <td>{row.matchMetricLabel ?? "—"}</td>
                <td className={teamStyles.num}>{formatCorrelation(row.rPoints)}</td>
                <td className={teamStyles.num}>
                  {row.weight > 0 ? row.weight.toFixed(2) : "—"}
                </td>
                <td className={teamStyles.num}>
                  {formatWeightShare(row.weight, report.totalActiveWeight)}
                </td>
                <td>
                  <span className={styles.weightRationale} title={rationale}>
                    {rationale}
                  </span>
                </td>
                <td>
                  <span className={`${teamStyles.badge} ${teamStyles.badgeNeutral}`}>
                    {weightStatusLabel(row.status)}
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeightedPoolRankingTable({
  rows,
  selectedPlayerId,
  onSelectPlayer,
  referenceLabel,
  showMarketValue,
}: {
  rows: StatsBombScoutingWeightedPoolRow[];
  selectedPlayerId: string;
  onSelectPlayer: (playerId: string) => void;
  referenceLabel: string;
  showMarketValue: boolean;
}) {
  return (
    <section
      className={teamStyles.section}
      aria-label={`Ranking kandydatów ważony korelacją z ${referenceLabel}`}
    >
      <h3 className={teamStyles.sectionTitle}>Ranking ważony korelacją z {referenceLabel}</h3>
      <p className={teamStyles.sectionLead}>
        Percentyle kandydatów w próbie PlayerScout, ważone korelacją z {referenceLabel}{" "}
        (dodatnia r dla metryk «więcej = lepiej», ujemna r dla «mniej = lepiej»; próg skutecznej
        korelacji r ≥ {STATSBOMB_SCOUTING_CORR_MIN_ABS_R} lub |r| dla strat). Wyższy wynik =
        co historycznie szło w parze z lepszym {referenceLabel} w meczach drużyny.
      </p>
      <div className={`${teamStyles.tableWrap} ${styles.poolTableWrap}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Zawodnik</th>
              <th scope="col">Klub</th>
              <ScoutingPoolProfileHeaders showMarketValue={showMarketValue} />
              <th scope="col">Dopasowanie</th>
              <th scope="col">Atak (waga)</th>
              <th scope="col">Obrona (waga)</th>
              <th scope="col">Kryteria</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isSelected = row.playerId === selectedPlayerId;
              return (
                <tr
                  key={row.playerId}
                  className={isSelected ? styles.poolRowSelected : styles.poolRow}
                >
                  <td className={teamStyles.num}>{index + 1}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.poolPlayerButton}
                      onClick={() => onSelectPlayer(row.playerId)}
                    >
                      {row.displayName}
                    </button>
                  </td>
                  <td>{row.currentTeam || "—"}</td>
                  <ScoutingPoolProfileCells row={row} showMarketValue={showMarketValue} />
                  <td
                    className={`${teamStyles.num} ${percentileClass(row.weightedFitPercentile)}`}
                  >
                    {formatPercentile(row.weightedFitPercentile)}
                  </td>
                  <td className={teamStyles.num}>
                    {formatPercentile(row.attackWeightedPercentile)}
                  </td>
                  <td className={teamStyles.num}>
                    {formatPercentile(row.defenseWeightedPercentile)}
                  </td>
                  <td className={teamStyles.num}>{row.matchedCriteriaCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeightedCriteriaTable({
  title,
  rows,
  emptyMessage,
  referenceLabel,
}: {
  title: string;
  rows: StatsBombScoutingWeightedCriterionScore[];
  emptyMessage: string;
  referenceLabel: string;
}) {
  if (rows.length === 0) {
    return <p className={teamStyles.emptySection}>{emptyMessage}</p>;
  }

  return (
    <section className={teamStyles.section} aria-label={title}>
      <h3 className={teamStyles.sectionTitle}>{title}</h3>
      <div className={`${teamStyles.tableWrap} ${styles.tableWrapTall}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">Kryterium</th>
              <th scope="col">Metryka</th>
              <th scope="col">Per 90</th>
              <th scope="col">Percentyl</th>
              <th scope="col">Skuteczny %</th>
              <th scope="col">r ({referenceLabel})</th>
              <th scope="col">Waga</th>
              <th scope="col">Wkład</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.criterionId}>
                <td>{row.criterionLabel}</td>
                <td>{row.metricLabel ?? "—"}</td>
                <td className={teamStyles.num}>{formatNum(row.playerValue)}</td>
                <td className={teamStyles.num}>{formatPercentile(row.percentile)}</td>
                <td
                  className={`${teamStyles.num} ${percentileClass(row.effectivePercentile)}`}
                >
                  {formatPercentile(row.effectivePercentile)}
                </td>
                <td className={teamStyles.num}>{formatCorrelation(row.rPoints)}</td>
                <td className={teamStyles.num}>
                  {row.weight > 0 ? row.weight.toFixed(2) : "—"}
                </td>
                <td className={teamStyles.num}>
                  {row.weightedContribution === null
                    ? "—"
                    : Math.round(row.weightedContribution)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ScoutingPoolProfileCells({
  row,
  showMarketValue,
}: {
  row: StatsBombScoutingPoolRow;
  showMarketValue: boolean;
}) {
  return (
    <>
      <td className={teamStyles.num}>{Math.round(row.minutes)}</td>
      <td className={teamStyles.num}>{formatAge(row.age)}</td>
      <td className={teamStyles.num}>{formatHeight(row.height)}</td>
      <td>{formatPreferredFoot(row.preferredFoot)}</td>
      {showMarketValue ? (
        <td className={teamStyles.num}>{formatStatsBombMarketValueEur(row.marketValue)}</td>
      ) : null}
    </>
  );
}

function ScoutingPoolProfileHeaders({ showMarketValue }: { showMarketValue: boolean }) {
  return (
    <>
      <th scope="col">Minuty</th>
      <th scope="col">Wiek</th>
      <th scope="col">Wzrost</th>
      <th scope="col">Noga</th>
      {showMarketValue ? <th scope="col">Wartość</th> : null}
    </>
  );
}

function PoolRankingTable({
  rows,
  selectedPlayerId,
  onSelectPlayer,
  showMarketValue,
}: {
  rows: StatsBombScoutingPoolRow[];
  selectedPlayerId: string;
  onSelectPlayer: (playerId: string) => void;
  showMarketValue: boolean;
}) {
  return (
    <section className={teamStyles.section} aria-label="Ranking kandydatów w próbie scoutingowej">
      <h3 className={teamStyles.sectionTitle}>Porównanie kandydatów w próbie</h3>
      <p className={teamStyles.sectionLead}>
        Zawodnicy posortowani według dopasowania do profilu pozycji względem całej wczytanej listy
        PlayerScout. Kliknij wiersz, aby zobaczyć szczegóły kryteriów.
      </p>
      <div className={`${teamStyles.tableWrap} ${styles.poolTableWrap}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Zawodnik</th>
              <th scope="col">Klub</th>
              <ScoutingPoolProfileHeaders showMarketValue={showMarketValue} />
              <th scope="col">Dopasowanie</th>
              <th scope="col">Atak</th>
              <th scope="col">Obrona</th>
              <th scope="col">Mocne</th>
              <th scope="col">Słabe</th>
              <th scope="col">Kryteria</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isSelected = row.playerId === selectedPlayerId;
              return (
                <tr
                  key={row.playerId}
                  className={isSelected ? styles.poolRowSelected : styles.poolRow}
                >
                  <td className={teamStyles.num}>{index + 1}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.poolPlayerButton}
                      onClick={() => onSelectPlayer(row.playerId)}
                    >
                      {row.displayName}
                    </button>
                  </td>
                  <td>{row.currentTeam || "—"}</td>
                  <ScoutingPoolProfileCells row={row} showMarketValue={showMarketValue} />
                  <td className={`${teamStyles.num} ${percentileClass(row.overallFitPercentile)}`}>
                    {formatPercentile(row.overallFitPercentile)}
                  </td>
                  <td className={teamStyles.num}>{formatPercentile(row.attackAvgPercentile)}</td>
                  <td className={teamStyles.num}>{formatPercentile(row.defenseAvgPercentile)}</td>
                  <td className={teamStyles.num}>{row.strengthCount}</td>
                  <td className={teamStyles.num}>{row.weaknessCount}</td>
                  <td className={teamStyles.num}>{row.matchedCriteriaCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function StatsBombPlayerScoutingPanel({
  players,
  matchRows = [],
  positionId = "defensive_midfielder",
}: StatsBombPlayerScoutingPanelProps) {
  const [subTab, setSubTab] = useState<ScoutingSubTab>("profile");
  const [referenceMetricId, setReferenceMetricId] = useState(
    STATSBOMB_SCOUTING_DEFAULT_REFERENCE_METRIC_ID,
  );

  useEffect(() => {
    setReferenceMetricId(readStoredReferenceMetricId());
  }, []);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [minMinutes, setMinMinutes] = useState(STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES);
  const [minAgeInput, setMinAgeInput] = useState("");
  const [maxAgeInput, setMaxAgeInput] = useState("");
  const [computation, setComputation] = useState<StatsBombScoutingComputation | null>(null);
  const [poolRanking, setPoolRanking] = useState<StatsBombScoutingPoolRow[]>([]);
  const [manualConfig, setManualConfig] = useState<StatsBombScoutingManualConfig | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);

  const position = STATSBOMB_SCOUTING_POSITIONS.find((item) => item.id === positionId);

  const poolFilters = useMemo((): StatsBombScoutingPoolFilters => {
    const minAgeParsed = minAgeInput.trim() === "" ? null : Number(minAgeInput);
    const maxAgeParsed = maxAgeInput.trim() === "" ? null : Number(maxAgeInput);
    return {
      minMinutes,
      minAge: Number.isFinite(minAgeParsed) ? minAgeParsed : null,
      maxAge: Number.isFinite(maxAgeParsed) ? maxAgeParsed : null,
    };
  }, [minMinutes, minAgeInput, maxAgeInput]);

  const showMarketValue = useMemo(
    () => players.some((player) => player.marketValue !== null && player.marketValue > 0),
    [players],
  );

  useEffect(() => {
    if (players.length === 0) {
      setComputation(null);
      setPoolRanking([]);
      setIsComputing(false);
      setComputeError(null);
      return;
    }

    setIsComputing(true);
    setComputeError(null);

    const timer = window.setTimeout(() => {
      try {
        const nextComputation = buildStatsBombScoutingComputation(
          players,
          positionId,
          poolFilters,
        );
        if (!nextComputation) {
          setComputation(null);
          setPoolRanking([]);
          setComputeError("Nie udało się zbudować analizy scoutingowej.");
          return;
        }
        const ranking = buildStatsBombScoutingPoolRankingFromComputation(nextComputation);
        setComputation(nextComputation);
        setPoolRanking(ranking);
      } catch (error) {
        setComputation(null);
        setPoolRanking([]);
        setComputeError(
          error instanceof Error ? error.message : "Nie udało się przetworzyć listy kandydatów.",
        );
      } finally {
        setIsComputing(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [players, positionId, poolFilters]);

  useEffect(() => {
    if (!computation) {
      setManualConfig(null);
      return;
    }
    const stored = loadStoredManualConfig(positionId);
    setManualConfig(
      sanitizeManualConfig(computation, stored ?? buildEmptyManualConfig()),
    );
  }, [computation, positionId]);

  const persistManualConfig = useCallback(
    (next: StatsBombScoutingManualConfig) => {
      setManualConfig(next);
      saveStoredManualConfig(positionId, next);
    },
    [positionId],
  );

  const onManualConfigChange = useCallback(
    (next: StatsBombScoutingManualConfig) => {
      persistManualConfig(next);
    },
    [persistManualConfig],
  );

  const onClearManualConfig = useCallback(() => {
    persistManualConfig(buildEmptyManualConfig());
  }, [persistManualConfig]);

  const report: StatsBombPlayerScoutingReport | null = useMemo(() => {
    if (!computation || !selectedPlayerId) return null;
    return buildStatsBombPlayerScoutingReportFromComputation(computation, selectedPlayerId);
  }, [computation, selectedPlayerId]);

  const referenceMetrics = useMemo(
    () => listScoutingCorrelationReferenceMetrics(matchRows),
    [matchRows],
  );

  const selectedReferenceMetric = useMemo((): StatsBombMetric | null => {
    if (referenceMetrics.length === 0) return null;
    return (
      referenceMetrics.find((metric) => metric.id === referenceMetricId) ?? referenceMetrics[0]!
    );
  }, [referenceMetrics, referenceMetricId]);

  useEffect(() => {
    if (referenceMetrics.length === 0) return;
    const exists = referenceMetrics.some((metric) => metric.id === referenceMetricId);
    if (!exists) {
      setReferenceMetricId(referenceMetrics[0]!.id);
    }
  }, [referenceMetrics, referenceMetricId]);

  const manualPoolRanking = useMemo(() => {
    if (!computation || !manualConfig || !manualConfigHasActiveWeights(manualConfig)) return [];
    return buildManualWeightedScoutingPoolRanking(computation, manualConfig);
  }, [computation, manualConfig]);

  const manualReport: StatsBombManualScoutingReport | null = useMemo(() => {
    if (!computation || !manualConfig || !selectedPlayerId) return null;
    return buildManualWeightedScoutingReport(computation, selectedPlayerId, manualConfig);
  }, [computation, manualConfig, selectedPlayerId]);

  const weightsReport = useMemo(() => {
    if (!computation || matchRows.length < 3 || !selectedReferenceMetric) return null;
    return buildScoutingCriterionWeights(
      computation,
      matchRows,
      selectedReferenceMetric.id,
    );
  }, [computation, matchRows, selectedReferenceMetric]);

  const weightedPoolRanking = useMemo(() => {
    if (!computation || !weightsReport || weightsReport.totalActiveWeight <= 0) return [];
    return buildWeightedScoutingPoolRanking(computation, weightsReport);
  }, [computation, weightsReport]);

  const weightedScores = useMemo(() => {
    if (!computation || !weightsReport || !selectedPlayerId) return [];
    return buildWeightedScoutingCriterionScores(computation, selectedPlayerId, weightsReport);
  }, [computation, weightsReport, selectedPlayerId]);

  const weightedFit = useMemo(
    () => computeWeightedScoutingFitPercentile(weightedScores),
    [weightedScores],
  );

  const weightedAttackSummary = useMemo(
    () => summarizeWeightedScoutingPhase(weightedScores, "attack"),
    [weightedScores],
  );

  const weightedDefenseSummary = useMemo(
    () => summarizeWeightedScoutingPhase(weightedScores, "defense"),
    [weightedScores],
  );

  const activeRanking =
    subTab === "manual" && manualPoolRanking.length > 0
      ? manualPoolRanking
      : subTab === "correlation" && weightedPoolRanking.length > 0
        ? weightedPoolRanking
        : poolRanking;

  const selectedRow =
    activeRanking.find((row) => row.playerId === selectedPlayerId) ?? null;
  const profileAttackRows = report?.criteria.filter((row) => row.phase === "attack") ?? [];
  const profileDefenseRows = report?.criteria.filter((row) => row.phase === "defense") ?? [];
  const weightedAttackRows = weightedScores.filter((row) => row.phase === "attack");
  const weightedDefenseRows = weightedScores.filter((row) => row.phase === "defense");

  useEffect(() => {
    if (activeRanking.length === 0) {
      setSelectedPlayerId("");
      return;
    }
    const exists = activeRanking.some((row) => row.playerId === selectedPlayerId);
    if (!exists) {
      setSelectedPlayerId(activeRanking[0]!.playerId);
    }
  }, [activeRanking, selectedPlayerId]);

  const onMinMinutesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setMinMinutes(parsed);
    }
  }, []);

  const onMinAgeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMinAgeInput(event.target.value);
  }, []);

  const onMaxAgeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMaxAgeInput(event.target.value);
  }, []);

  const onReferenceMetricChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setReferenceMetricId(nextId);
    try {
      window.localStorage.setItem(SCOUTING_CORR_REFERENCE_STORAGE_KEY, nextId);
    } catch {
      // ignore storage errors
    }
  }, []);

  if (!position) {
    return <p className={teamStyles.hint}>Nieznany profil pozycji scoutingowej.</p>;
  }

  if (players.length === 0) {
    return (
      <p className={teamStyles.hint}>
        Wgraj plik PlayerScout CSV, aby porównać kandydatów na pozycję{" "}
        <strong>{position.label}</strong>.
      </p>
    );
  }

  return (
    <div className={styles.root}>
      <p className={teamStyles.hint}>
        Moduł scoutingowy działa niezależnie od składu własnej drużyny. Wczytaj listę kandydatów z
        eksportu <strong>PlayerScout</strong> i porównaj ich względem siebie nawzajem (percentyle w
        próbie). Profil <strong>{position.label}</strong>: {position.subtitle} ≥{" "}
        {STATSBOMB_PLAYER_STRONG_PERCENTILE}% = mocna strona, ≤ {STATSBOMB_PLAYER_WEAK_PERCENTILE}%
        = obszar do poprawy.
      </p>

      <div className={teamStyles.toolbar}>
        <label htmlFor="statsbomb-scouting-position" className={styles.toolbarLabel}>
          Pozycja
        </label>
        <select
          id="statsbomb-scouting-position"
          className={styles.select}
          value={positionId}
          disabled
          aria-label="Profil pozycji scoutingowej"
        >
          {STATSBOMB_SCOUTING_POSITIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>

        <label htmlFor="statsbomb-scouting-min-minutes" className={styles.toolbarLabel}>
          Min. minuty (próba)
        </label>
        <input
          id="statsbomb-scouting-min-minutes"
          type="number"
          min={0}
          step={50}
          className={styles.minutesInput}
          value={minMinutes}
          onChange={onMinMinutesChange}
          aria-label="Minimalne minuty kandydatów w próbie porównawczej"
        />

        <label htmlFor="statsbomb-scouting-min-age" className={styles.toolbarLabel}>
          Wiek od
        </label>
        <input
          id="statsbomb-scouting-min-age"
          type="number"
          min={15}
          max={45}
          step={1}
          className={styles.ageInput}
          value={minAgeInput}
          onChange={onMinAgeChange}
          placeholder="—"
          aria-label="Minimalny wiek kandydatów w próbie"
        />

        <label htmlFor="statsbomb-scouting-max-age" className={styles.toolbarLabel}>
          Wiek do
        </label>
        <input
          id="statsbomb-scouting-max-age"
          type="number"
          min={15}
          max={45}
          step={1}
          className={styles.ageInput}
          value={maxAgeInput}
          onChange={onMaxAgeChange}
          placeholder="—"
          aria-label="Maksymalny wiek kandydatów w próbie"
        />

        <span className={styles.poolMeta}>
          Kandydaci w próbie: <strong>{poolRanking.length}</strong> / {players.length}
        </span>
      </div>

      {isComputing ? (
        <p className={styles.loadingState} role="status" aria-live="polite">
          Obliczanie rankingu dla {players.length} kandydatów…
        </p>
      ) : null}

      {computeError ? <p className={styles.errorState}>{computeError}</p> : null}

      {!isComputing && poolRanking.length === 0 && !computeError ? (
        <p className={teamStyles.emptySection}>
          Brak kandydatów spełniających filtry próby (min. {minMinutes} min
          {poolFilters.minAge !== null ? `, wiek ≥ ${poolFilters.minAge}` : ""}
          {poolFilters.maxAge !== null ? `, wiek ≤ ${poolFilters.maxAge}` : ""}). Obniż progi lub
          wgraj szerszą listę.
        </p>
      ) : null}

      {!isComputing && poolRanking.length > 0 ? (
        <>
          <div className={teamStyles.subTabs} role="tablist" aria-label="Podzakładki scoutingowe">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === "profile"}
              className={`${teamStyles.subTab} ${subTab === "profile" ? teamStyles.subTabActive : ""}`}
              onClick={() => setSubTab("profile")}
            >
              Profil pozycji
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === "correlation"}
              className={`${teamStyles.subTab} ${subTab === "correlation" ? teamStyles.subTabActive : ""}`}
              onClick={() => setSubTab("correlation")}
            >
              Ważenie z korelacji
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === "manual"}
              className={`${teamStyles.subTab} ${subTab === "manual" ? teamStyles.subTabActive : ""}`}
              onClick={() => setSubTab("manual")}
            >
              Wagi ręczne
            </button>
          </div>

          {subTab === "profile" ? (
            <>
              <PoolRankingTable
                rows={poolRanking}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                showMarketValue={showMarketValue}
              />

              {report ? (
                <>
                  <div className={teamStyles.summaryGrid}>
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Dopasowanie profilu</div>
                      <div className={teamStyles.summaryValue}>
                        {report.overallFitPercentile === null
                          ? "—"
                          : `${Math.round(report.overallFitPercentile)}%`}
                      </div>
                      <div className={teamStyles.summarySub}>
                        {report.displayName}
                        {report.currentTeam ? ` · ${report.currentTeam}` : ""}
                      </div>
                    </article>
                    <PhaseSummaryCard summary={report.attackSummary} />
                    <PhaseSummaryCard summary={report.defenseSummary} />
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Pozycja</div>
                      <div className={teamStyles.summaryValue}>{position.label}</div>
                      <div className={teamStyles.summarySub}>
                        {Math.round(selectedRow?.minutes ?? 0)} min
                        {selectedRow?.age !== null && selectedRow?.age !== undefined
                          ? ` · ${Math.round(selectedRow.age)} lat`
                          : ""}
                        {selectedRow?.height !== null && selectedRow?.height !== undefined
                          ? ` · ${Math.round(selectedRow.height)} cm`
                          : ""}
                        {selectedRow?.preferredFoot
                          ? ` · ${formatPreferredFoot(selectedRow.preferredFoot)}`
                          : ""}
                        {showMarketValue && selectedRow?.marketValue
                          ? ` · ${formatStatsBombMarketValueEur(selectedRow.marketValue)}`
                          : ""}
                      </div>
                    </article>
                  </div>

                  <div className={teamStyles.phaseBannerGrid}>
                    <article className={`${teamStyles.phaseBanner} ${teamStyles.phaseBannerAttack}`}>
                      <h3 className={teamStyles.phaseBannerTitle}>
                        {statsBombPhaseLabel("attack")} — {report.attackSummary.strengthCount} mocnych /{" "}
                        {report.attackSummary.weaknessCount} słabych
                      </h3>
                      <p className={teamStyles.phaseBannerText}>
                        Jakość podań, progresja, gra pod presją, łączenie sektorów i skanowanie
                        przestrzeni.
                      </p>
                    </article>
                    <article className={`${teamStyles.phaseBanner} ${teamStyles.phaseBannerDefense}`}>
                      <h3 className={teamStyles.phaseBannerTitle}>
                        {statsBombPhaseLabel("defense")} — {report.defenseSummary.strengthCount} mocnych /{" "}
                        {report.defenseSummary.weaknessCount} słabych
                      </h3>
                      <p className={teamStyles.phaseBannerText}>
                        Pressing, zamykanie przestrzeni, antycypacja, pojedynki i akcje defensywne do
                        przodu.
                      </p>
                    </article>
                  </div>

                  <CriteriaTable
                    title={`Szczegóły — ${report.displayName}`}
                    rows={profileAttackRows}
                    emptyMessage="Brak kryteriów ofensywnych dla tego profilu."
                  />
                  <CriteriaTable
                    title="Faza defensywy — kryteria profilu"
                    rows={profileDefenseRows}
                    emptyMessage="Brak kryteriów defensywnych dla tego profilu."
                  />
                </>
              ) : null}
            </>
          ) : subTab === "manual" && computation && manualConfig ? (
            <>
              <ManualCriteriaConfigTable
                computation={computation}
                manualConfig={manualConfig}
                onConfigChange={onManualConfigChange}
                onClearAll={onClearManualConfig}
              />

              {manualPoolRanking.length === 0 ? (
                <p className={teamStyles.emptySection}>
                  Dodaj co najmniej jedną metrykę z udziałem &gt; 0%, aby zbudować ranking ważony
                  (WADZ).
                </p>
              ) : (
                <>
                  <PoolRankingTable
                    rows={manualPoolRanking}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                    showMarketValue={showMarketValue}
                  />

                  {manualReport ? (
                    <>
                      <div className={teamStyles.summaryGrid}>
                        <article className={teamStyles.summaryCard}>
                          <div className={teamStyles.summaryLabel}>Dopasowanie ważone</div>
                          <div className={teamStyles.summaryValue}>
                            {manualReport.overallFitPercentile === null
                              ? "—"
                              : `${Math.round(manualReport.overallFitPercentile)}%`}
                          </div>
                          <div className={teamStyles.summarySub}>
                            {manualReport.displayName}
                            {manualReport.currentTeam ? ` · ${manualReport.currentTeam}` : ""}
                          </div>
                        </article>
                        <PhaseSummaryCard
                          summary={{
                            phase: "attack",
                            matchedCount: manualReport.matchedMetricCount,
                            totalCount: manualReport.metrics.filter((row) => row.phase === "attack")
                              .length,
                            avgPercentile: manualReport.attackAvgPercentile,
                            strengthCount: manualReport.metrics.filter(
                              (row) =>
                                row.phase === "attack" &&
                                (row.percentile ?? 0) >= STATSBOMB_PLAYER_STRONG_PERCENTILE,
                            ).length,
                            weaknessCount: manualReport.metrics.filter(
                              (row) =>
                                row.phase === "attack" &&
                                (row.percentile ?? 0) <= STATSBOMB_PLAYER_WEAK_PERCENTILE,
                            ).length,
                          }}
                        />
                        <PhaseSummaryCard
                          summary={{
                            phase: "defense",
                            matchedCount: manualReport.matchedMetricCount,
                            totalCount: manualReport.metrics.filter((row) => row.phase === "defense")
                              .length,
                            avgPercentile: manualReport.defenseAvgPercentile,
                            strengthCount: manualReport.metrics.filter(
                              (row) =>
                                row.phase === "defense" &&
                                (row.percentile ?? 0) >= STATSBOMB_PLAYER_STRONG_PERCENTILE,
                            ).length,
                            weaknessCount: manualReport.metrics.filter(
                              (row) =>
                                row.phase === "defense" &&
                                (row.percentile ?? 0) <= STATSBOMB_PLAYER_WEAK_PERCENTILE,
                            ).length,
                          }}
                        />
                        <article className={teamStyles.summaryCard}>
                          <div className={teamStyles.summaryLabel}>Konfiguracja</div>
                          <div className={teamStyles.summaryValue}>Ręczna</div>
                          <div className={teamStyles.summarySub}>
                            {manualReport.metrics.length} metryk · suma udziałów{" "}
                            {manualReport.totalSharePercent}% · {position.label}
                          </div>
                        </article>
                      </div>

                      <ManualMetricsTable
                        title={`Szczegóły WADZ — ${manualReport.displayName}`}
                        rows={manualReport.metrics}
                        emptyMessage="Brak aktywnych metryk w konfiguracji."
                      />
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : subTab === "correlation" && matchRows.length < 3 ? (
            <p className={teamStyles.emptySection}>
              Wgraj plik <strong>MatchStats CSV</strong> w zakładce „Analiza zespołu” (min. 3 mecze),
              aby wyliczyć wagi kryteriów z korelacji z wybraną metryką referencyjną.
            </p>
          ) : subTab === "correlation" && !weightsReport ? (
            <p className={teamStyles.emptySection}>
              Nie udało się zbudować macierzy korelacji dla wczytanych meczów.
            </p>
          ) : subTab === "correlation" ? (
            <>
              <div className={teamStyles.toolbar}>
                <label htmlFor="statsbomb-scouting-reference-metric" className={styles.toolbarLabel}>
                  Metryka referencyjna (oś wag)
                </label>
                <select
                  id="statsbomb-scouting-reference-metric"
                  className={styles.select}
                  value={selectedReferenceMetric?.id ?? referenceMetricId}
                  onChange={onReferenceMetricChange}
                  aria-label="Metryka referencyjna dla wag scoutingowych"
                >
                  {referenceMetrics.map((metric) => (
                    <option key={metric.id} value={metric.id} title={metric.description}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>

              <WeightsTable report={weightsReport} />

              {weightsReport.totalActiveWeight <= 0 ? (
                <p className={teamStyles.emptySection}>
                  Brak kryteriów ze skuteczną korelacją z{" "}
                  <strong>{weightsReport.referenceMetricLabel}</strong> (wymagane r ≥{" "}
                  {STATSBOMB_SCOUTING_CORR_MIN_ABS_R} lub |r| dla metryk «mniej = lepiej»). Wybierz inną
                  metrykę referencyjną lub sprawdź, czy eksport meczów zawiera kolumny profilu
                  pozycji.
                </p>
              ) : (
                <>
              <WeightedPoolRankingTable
                rows={weightedPoolRanking}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                referenceLabel={weightsReport.referenceMetricLabel}
                showMarketValue={showMarketValue}
              />

              {selectedRow ? (
                <>
                  <div className={teamStyles.summaryGrid}>
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Dopasowanie ważone</div>
                      <div className={teamStyles.summaryValue}>
                        {weightedFit === null ? "—" : `${Math.round(weightedFit)}%`}
                      </div>
                      <div className={teamStyles.summarySub}>
                        {selectedRow.displayName}
                        {selectedRow.currentTeam ? ` · ${selectedRow.currentTeam}` : ""}
                      </div>
                    </article>
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Atak (waga korelacji)</div>
                      <div className={teamStyles.summaryValue}>
                        {weightedAttackSummary.weightedAvgPercentile === null
                          ? "—"
                          : `${Math.round(weightedAttackSummary.weightedAvgPercentile)}%`}
                      </div>
                      <div className={teamStyles.summarySub}>
                        {weightedAttackSummary.criterionCount} kryteriów · waga{" "}
                        {weightedAttackSummary.totalWeight.toFixed(2)}
                      </div>
                    </article>
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Obrona (waga korelacji)</div>
                      <div className={teamStyles.summaryValue}>
                        {weightedDefenseSummary.weightedAvgPercentile === null
                          ? "—"
                          : `${Math.round(weightedDefenseSummary.weightedAvgPercentile)}%`}
                      </div>
                      <div className={teamStyles.summarySub}>
                        {weightedDefenseSummary.criterionCount} kryteriów · waga{" "}
                        {weightedDefenseSummary.totalWeight.toFixed(2)}
                      </div>
                    </article>
                    <article className={teamStyles.summaryCard}>
                      <div className={teamStyles.summaryLabel}>Próba meczowa</div>
                      <div className={teamStyles.summaryValue}>{weightsReport.matchCount}</div>
                      <div className={teamStyles.summarySub}>
                        Korelacje z {weightsReport.referenceMetricLabel} · {position.label}
                      </div>
                    </article>
                  </div>

                  <WeightedCriteriaTable
                    title={`Szczegóły ważone — ${selectedRow.displayName}`}
                    rows={weightedAttackRows}
                    emptyMessage="Brak ważonych kryteriów ofensywnych."
                    referenceLabel={weightsReport.referenceMetricLabel}
                  />
                  <WeightedCriteriaTable
                    title="Faza defensywy — kryteria ważone"
                    rows={weightedDefenseRows}
                    emptyMessage="Brak ważonych kryteriów defensywnych."
                    referenceLabel={weightsReport.referenceMetricLabel}
                  />
                </>
              ) : null}
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
