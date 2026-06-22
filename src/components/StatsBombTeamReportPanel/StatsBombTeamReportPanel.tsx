"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { StatsBombMatchRow, StatsBombSquadPlayerRow } from "@/utils/statsbombCsvParser";
import StatsBombPlayerMetricShareModal from "@/components/StatsBombPlayerMetricShareModal/StatsBombPlayerMetricShareModal";
import { canBuildPlayerMetricShare } from "@/utils/statsBombPlayerMetricShare";
import {
  buildStatsBombPhaseSummary,
  buildStatsBombTeamReport,
  statsBombPhaseLabel,
  statsBombRoleLabel,
  STATSBOMB_STRONG_CORR_THRESHOLD,
  type StatsBombReportMetricRow,
  type StatsBombReportPhase,
} from "@/utils/statsBombTeamReport";
import styles from "./StatsBombTeamReportPanel.module.css";

export type StatsBombTeamReportPanelProps = {
  rows: StatsBombMatchRow[];
  squadPlayers?: StatsBombSquadPlayerRow[];
  scopeHint?: string;
};

function formatNum(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatR(value: number | null): string {
  return value === null ? "—" : value.toFixed(3);
}

function corrClass(r: number | null): string {
  if (r === null) return styles.corrNeutral;
  if (r >= STATSBOMB_STRONG_CORR_THRESHOLD) return styles.corrPosStrong;
  if (r <= -STATSBOMB_STRONG_CORR_THRESHOLD) return styles.corrNegStrong;
  return styles.corrNeutral;
}

function phaseBadgeClass(phase: StatsBombReportPhase): string {
  switch (phase) {
    case "attack":
      return styles.badgeAttack;
    case "defense":
      return styles.badgeDefense;
    default:
      return styles.badgeGeneral;
  }
}

type MetricRole = StatsBombReportMetricRow["role"];

function roleBadgeClass(role: MetricRole): string {
  switch (role) {
    case "strength":
      return styles.badgeStrength;
    case "weakness":
      return styles.badgeWeakness;
    default:
      return styles.badgeNeutral;
  }
}

type MetricAxisSide = StatsBombReportMetricRow["axisSide"];

function axisRowClass(axisSide: MetricAxisSide): string {
  switch (axisSide) {
    case "my":
      return styles.headAxisMy;
    case "opp":
      return styles.headAxisOpp;
    default:
      return styles.headAxisNeutral;
  }
}

function MetricTable({
  title,
  lead,
  rows,
  ariaLabel,
  emptyMessage,
  onMetricClick,
  isMetricShareable,
}: {
  title: string;
  lead?: string;
  rows: Array<StatsBombReportMetricRow>;
  ariaLabel: string;
  emptyMessage: string;
  onMetricClick?: (label: string, contextNote?: string) => void;
  isMetricShareable?: (label: string) => boolean;
}) {
  return (
    <section className={styles.section} aria-label={ariaLabel}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {lead ? <p className={styles.sectionLead}>{lead}</p> : null}
      {rows.length === 0 ? (
        <p className={styles.emptySection}>{emptyMessage}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Metryka</th>
                <th scope="col">Faza</th>
                <th scope="col">Śr./mecz</th>
                <th scope="col">Śr. przy W</th>
                <th scope="col">Śr. przy L</th>
                <th scope="col">r (Pkt)</th>
                <th scope="col">r (GD)</th>
                <th scope="col">Rola</th>
                <th scope="col">Interpretacja</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const shareable = isMetricShareable?.(row.label) ?? false;
                const contextNote =
                  row.rPoints !== null
                    ? `Korelacja z punktami: r=${row.rPoints.toFixed(3)}.`
                    : undefined;
                return (
                  <tr key={row.id} className={axisRowClass(row.axisSide)}>
                    <td>
                      {shareable && onMetricClick ? (
                        <button
                          type="button"
                          className={`${styles.metricLabel} ${styles.metricClickable} ${row.description ? styles.metricWithDef : ""}`}
                          title={`${row.description ?? row.label}. Kliknij, aby zobaczyć udział zawodników.`}
                          onClick={() => onMetricClick(row.label, contextNote)}
                        >
                          {row.label}
                        </button>
                      ) : (
                        <span
                          className={`${styles.metricLabel} ${row.description ? styles.metricWithDef : ""}`}
                          title={row.description ?? row.label}
                        >
                          {row.label}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${phaseBadgeClass(row.phase)}`}>
                        {statsBombPhaseLabel(row.phase)}
                      </span>
                    </td>
                    <td className={styles.num}>{formatNum(row.avgPerMatch)}</td>
                    <td className={styles.num}>{formatNum(row.avgWhenWin)}</td>
                    <td className={styles.num}>{formatNum(row.avgWhenLoss)}</td>
                    <td className={`${styles.num} ${corrClass(row.rPoints)}`}>{formatR(row.rPoints)}</td>
                    <td className={`${styles.num} ${corrClass(row.rGd)}`}>{formatR(row.rGd)}</td>
                    <td>
                      <span className={`${styles.badge} ${roleBadgeClass(row.role)}`}>
                        {statsBombRoleLabel(row.role)}
                      </span>
                    </td>
                    <td className={styles.interpretation}>{row.interpretation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function StatsBombTeamReportPanel({
  rows,
  squadPlayers = [],
  scopeHint,
}: StatsBombTeamReportPanelProps) {
  const [shareMetricLabel, setShareMetricLabel] = useState<string | null>(null);
  const [shareContextNote, setShareContextNote] = useState<string | undefined>();

  const report = useMemo(() => buildStatsBombTeamReport(rows, 3), [rows]);

  const isMetricShareable = useCallback(
    (label: string) => squadPlayers.length > 0 && canBuildPlayerMetricShare(squadPlayers, label),
    [squadPlayers],
  );

  const openShareModal = useCallback((label: string, contextNote?: string) => {
    if (!canBuildPlayerMetricShare(squadPlayers, label)) return;
    setShareMetricLabel(label);
    setShareContextNote(contextNote);
  }, [squadPlayers]);

  const closeShareModal = useCallback(() => {
    setShareMetricLabel(null);
    setShareContextNote(undefined);
  }, []);

  const attackSummary = useMemo(
    () => (report ? buildStatsBombPhaseSummary(report.ranked, "attack") : null),
    [report],
  );
  const defenseSummary = useMemo(
    () => (report ? buildStatsBombPhaseSummary(report.ranked, "defense") : null),
    [report],
  );

  if (rows.length < 3) {
    return (
      <p className={styles.hint}>Potrzebujesz co najmniej trzech meczów, aby wygenerować raport zespołu.</p>
    );
  }

  if (!report) {
    return <p className={styles.hint}>Nie udało się zbudować raportu zespołu.</p>;
  }

  const { summary } = report;

  const introHint =
    `Raport syntetyczny: xG, wejścia w pole karne (jeśli są w CSV) oraz pełny ranking metryk według korelacji ` +
    `z punktami i GD. Metryki z |r| >= ${STATSBOMB_STRONG_CORR_THRESHOLD} traktujemy jako mocne sygnały. ` +
    `Najedź na metrykę z kropkowanym podkreśleniem po definicję.` +
    (squadPlayers.length > 0
      ? " Kliknij niebieską metrykę, aby zobaczyć udział zawodników (Squad STATS)."
      : "") +
    (scopeHint ? ` ${scopeHint}` : "");

  const tableProps = {
    onMetricClick: squadPlayers.length > 0 ? openShareModal : undefined,
    isMetricShareable,
  };

  return (
    <div className={styles.reportRoot}>
      <p className={styles.hint}>{introHint}</p>

      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Mecze</div>
          <div className={styles.summaryValue}>{summary.matchCount}</div>
          <div className={styles.summarySub}>
            {summary.wins}W · {summary.draws}R · {summary.losses}L
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Punkty</div>
          <div className={styles.summaryValue}>{summary.points}</div>
          <div className={styles.summarySub}>{formatNum(summary.pointsPerMatch)} / mecz</div>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>GD</div>
          <div className={styles.summaryValue}>
            {summary.gd > 0 ? "+" : ""}
            {summary.gd}
          </div>
          <div className={styles.summarySub}>
            {summary.goalsFor}:{summary.goalsAgainst}
          </div>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Śr. xG</div>
          <div className={styles.summaryValue}>{formatNum(summary.avgXg)}</div>
          <div className={styles.summarySub}>xGA {formatNum(summary.avgXga)}</div>
        </article>
        <article className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Śr. xGD</div>
          <div className={styles.summaryValue}>
            {summary.avgXgd > 0 ? "+" : ""}
            {formatNum(summary.avgXgd)}
          </div>
        </article>
      </div>

      <div className={styles.phaseBannerGrid}>
        <article className={`${styles.phaseBanner} ${styles.phaseBannerAttack}`}>
          <h3 className={styles.phaseBannerTitle}>Atak — co działa?</h3>
          <p className={styles.phaseBannerText}>
            {attackSummary ??
              "Brak metryk ataku z silną korelacją z wynikiem w tej próbie. Sprawdź pełny ranking poniżej."}
          </p>
        </article>
        <article className={`${styles.phaseBanner} ${styles.phaseBannerDefense}`}>
          <h3 className={styles.phaseBannerTitle}>Obrona — gdzie ryzyko?</h3>
          <p className={styles.phaseBannerText}>
            {defenseSummary ??
              "Brak metryk obrony z silną korelacją z wynikiem w tej próbie. Sprawdź pełny ranking poniżej."}
          </p>
        </article>
      </div>

      <MetricTable
        title="xG — wszystkie metryki w pliku"
        lead="Sumy i wskaźniki xG (własne i rywala), posortowane według |r| z punktami."
        rows={report.xgRows}
        ariaLabel="Metryki xG StatsBomb"
        emptyMessage="W pliku CSV nie znaleziono kolumn xG."
        {...tableProps}
      />

      <MetricTable
        title="Pole karne i progresja"
        lead="Dotknięcia w boxie, podania do boxa, progresje — jeśli występują w eksporcie MatchStats."
        rows={report.pkRows}
        ariaLabel="Metryki pola karnego StatsBomb"
        emptyMessage="W pliku CSV nie znaleziono kolumn związanych z polem karnym."
        {...tableProps}
      />

      <div className={styles.splitColumns}>
        <MetricTable
          title={`Mocne strony (r >= ${STATSBOMB_STRONG_CORR_THRESHOLD})`}
          lead="Wyższe wartości metryki częściej towarzyszą zdobywaniu punktów."
          rows={report.strengths}
          ariaLabel="Mocne strony zespołu StatsBomb"
          emptyMessage="Brak metryk z silną dodatnią korelacją z punktami."
          {...tableProps}
        />
        <MetricTable
          title={`Słabe strony / ryzyka (r <= -${STATSBOMB_STRONG_CORR_THRESHOLD})`}
          lead="Wyższe wartości metryki częściej towarzyszą utracie punktów."
          rows={report.weaknesses}
          ariaLabel="Słabe strony zespołu StatsBomb"
          emptyMessage="Brak metryk z silną ujemną korelacją z punktami."
          {...tableProps}
        />
      </div>

      <MetricTable
        title="Pełny ranking wpływu na wynik"
        lead="Wszystkie parametry z CSV (bez bezpośrednich wyników meczu), od najsilniejszej korelacji z punktami do najsłabszej."
        rows={report.ranked}
        ariaLabel="Pełny ranking metryk StatsBomb"
        emptyMessage="Brak metryk do rankingu."
        {...tableProps}
      />

      <StatsBombPlayerMetricShareModal
        isOpen={shareMetricLabel !== null}
        metricLabel={shareMetricLabel}
        players={squadPlayers}
        contextNote={shareContextNote}
        onClose={closeShareModal}
      />
    </div>
  );
}
