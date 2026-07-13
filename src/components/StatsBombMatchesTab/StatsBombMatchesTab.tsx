"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StatsBombMatchRow } from "@/utils/statsbombCsvParser";
import StatsBombMedianDistributionPanel from "@/components/StatsBombMedianDistributionPanel/StatsBombMedianDistributionPanel";
import StatsBombOutcomeMedianPanel from "@/components/StatsBombOutcomeMedianPanel/StatsBombOutcomeMedianPanel";
import {
  countStatsBombIncludedMatches,
  filterStatsBombMatchesForMedianAnalysis,
  pruneStatsBombExcludedMatchIds,
} from "@/utils/statsBombMatchInclusion";
import {
  countStatsBombMatchOutcomes,
  filterStatsBombMatchesByOutcome,
  getStatsBombMatchOutcome,
  statsBombMatchOutcomeLabel,
  statsBombMatchOutcomeShort,
  type StatsBombMatchOutcomeFilter,
} from "@/utils/statsBombMatchOutcome";
import {
  buildStatsBombTeamMedianDistribution,
  STATSBOMB_TEAM_MEDIAN_MIN_MATCHES,
  statsBombMatchRowId,
} from "@/utils/statsBombTeamMedianDistribution";
import pageStyles from "@/app/admin/statsbomb/statsbomb.module.css";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombMatchesTab.module.css";

export type StatsBombMatchesTabProps = {
  rows: StatsBombMatchRow[];
};

type MedianSubTab = "distribution" | "outcome_summary";

const OUTCOME_FILTERS: Array<{ id: StatsBombMatchOutcomeFilter; label: string }> = [
  { id: "all", label: "Wszystkie" },
  { id: "win", label: "Wygrane" },
  { id: "draw", label: "Remisy" },
  { id: "loss", label: "Przegrane" },
];

function outcomeRowClass(outcome: ReturnType<typeof getStatsBombMatchOutcome>): string {
  switch (outcome) {
    case "win":
      return styles.matchRowWin;
    case "draw":
      return styles.matchRowDraw;
    default:
      return styles.matchRowLoss;
  }
}

function outcomeBadgeClass(outcome: ReturnType<typeof getStatsBombMatchOutcome>): string {
  switch (outcome) {
    case "win":
      return styles.badgeWin;
    case "draw":
      return styles.badgeDraw;
    default:
      return styles.badgeLoss;
  }
}

export default function StatsBombMatchesTab({ rows }: StatsBombMatchesTabProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [tableOutcomeFilter, setTableOutcomeFilter] = useState<StatsBombMatchOutcomeFilter>("all");
  const [medianSubTab, setMedianSubTab] = useState<MedianSubTab>("distribution");
  const [excludedMatchIds, setExcludedMatchIds] = useState<Set<string>>(() => new Set());
  const medianSectionRef = useRef<HTMLElement | null>(null);

  const allMatchIds = useMemo(() => rows.map(statsBombMatchRowId), [rows]);

  useEffect(() => {
    setExcludedMatchIds((prev) => pruneStatsBombExcludedMatchIds(prev, allMatchIds));
  }, [allMatchIds]);

  const includedRows = useMemo(
    () => filterStatsBombMatchesForMedianAnalysis(rows, excludedMatchIds),
    [rows, excludedMatchIds],
  );

  const includedCount = countStatsBombIncludedMatches(rows.length, excludedMatchIds);
  const medianReport = useMemo(
    () => buildStatsBombTeamMedianDistribution(includedRows),
    [includedRows],
  );
  const outcomeCounts = useMemo(() => countStatsBombMatchOutcomes(includedRows), [includedRows]);
  const tableOutcomeCounts = useMemo(() => countStatsBombMatchOutcomes(rows), [rows]);

  const filteredRows = useMemo(
    () => filterStatsBombMatchesByOutcome(rows, tableOutcomeFilter),
    [rows, tableOutcomeFilter],
  );

  const allVisibleIncluded = useMemo(
    () => filteredRows.every((row) => !excludedMatchIds.has(statsBombMatchRowId(row))),
    [filteredRows, excludedMatchIds],
  );

  const matchHighlightOptions = useMemo(
    () =>
      rows.map((row, index) => ({
        id: statsBombMatchRowId(row),
        label: `#${index + 1} · ${row.opponent}`,
        subLabel: row.date,
      })),
    [rows],
  );

  const selectedMatch = useMemo(
    () => rows.find((row) => statsBombMatchRowId(row) === selectedMatchId) ?? null,
    [rows, selectedMatchId],
  );

  const selectedMatchIndex = useMemo(
    () => rows.findIndex((row) => statsBombMatchRowId(row) === selectedMatchId),
    [rows, selectedMatchId],
  );

  const selectedMatchIncluded = selectedMatch
    ? !excludedMatchIds.has(statsBombMatchRowId(selectedMatch))
    : true;

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedMatchId("");
      return;
    }
    const exists = rows.some((row) => statsBombMatchRowId(row) === selectedMatchId);
    if (!exists) {
      setSelectedMatchId(statsBombMatchRowId(rows[rows.length - 1]!));
    }
  }, [rows, selectedMatchId]);

  const isMatchIncluded = useCallback(
    (matchId: string) => !excludedMatchIds.has(matchId),
    [excludedMatchIds],
  );

  const setMatchIncluded = useCallback((matchId: string, included: boolean) => {
    setExcludedMatchIds((prev) => {
      const next = new Set(prev);
      if (included) {
        next.delete(matchId);
      } else {
        next.add(matchId);
      }
      return next;
    });
  }, []);

  const toggleMatchIncluded = useCallback(
    (matchId: string) => {
      setMatchIncluded(matchId, !isMatchIncluded(matchId));
    },
    [isMatchIncluded, setMatchIncluded],
  );

  const toggleAllVisibleIncluded = useCallback(() => {
    const includeAll = !allVisibleIncluded;
    setExcludedMatchIds((prev) => {
      const next = new Set(prev);
      for (const row of filteredRows) {
        const id = statsBombMatchRowId(row);
        if (includeAll) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }, [allVisibleIncluded, filteredRows]);

  const resetAllIncluded = useCallback(() => {
    setExcludedMatchIds(new Set());
  }, []);

  const selectMatch = useCallback((row: StatsBombMatchRow, scroll = true) => {
    setSelectedMatchId(statsBombMatchRowId(row));
    if (scroll) {
      requestAnimationFrame(() => {
        medianSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const onRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, row: StatsBombMatchRow) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectMatch(row);
      }
    },
    [selectMatch],
  );

  const onSelectMatchFromOutcome = useCallback(
    (matchId: string) => {
      const row = rows.find((r) => statsBombMatchRowId(r) === matchId);
      if (!row) return;
      setMedianSubTab("distribution");
      selectMatch(row);
    },
    [rows, selectMatch],
  );

  const analysisScopeHint =
    includedCount === rows.length
      ? `Próba mediany: ${includedCount} meczów (${outcomeCounts.win}W · ${outcomeCounts.draw}R · ${outcomeCounts.loss}L).`
      : `Próba mediany: ${includedCount} z ${rows.length} meczów (${outcomeCounts.win}W · ${outcomeCounts.draw}R · ${outcomeCounts.loss}L). Wyłączone mecze nie wchodzą do mediany ani podsumowania wg wyniku.`;

  return (
    <div className={styles.root}>
      <p className={styles.lead}>
        Odznacz mecz w kolumnie „Med.”, aby wyłączyć go z mediany sezonu i porównań. Kliknij wiersz,
        aby zobaczyć pozycję meczu względem mediany z pozostałych zaznaczonych meczów. Kolory
        wierszy: zielony — wygrana, żółty — remis, czerwony — porażka.
      </p>

      <div className={styles.inclusionBar}>
        <span className={styles.inclusionSummary}>
          W medianie: <strong>{includedCount}</strong> / {rows.length} meczów
        </span>
        {excludedMatchIds.size > 0 ? (
          <button type="button" className={styles.inclusionReset} onClick={resetAllIncluded}>
            Przywróć wszystkie
          </button>
        ) : null}
      </div>

      <div className={styles.tableFilters} role="tablist" aria-label="Filtr wyniku meczu w tabeli">
        {OUTCOME_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tableOutcomeFilter === id}
            className={`${styles.tableFilterButton} ${styles[`tableFilter${id.charAt(0).toUpperCase()}${id.slice(1)}`]} ${tableOutcomeFilter === id ? styles.tableFilterButtonActive : ""}`}
            onClick={() => setTableOutcomeFilter(id)}
          >
            {label}
            <span className={styles.tableFilterCount}>
              {id === "all"
                ? tableOutcomeCounts.total
                : id === "win"
                  ? tableOutcomeCounts.win
                  : id === "draw"
                    ? tableOutcomeCounts.draw
                    : tableOutcomeCounts.loss}
            </span>
          </button>
        ))}
      </div>

      <div className={pageStyles.tableWrap}>
        <table className={pageStyles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.includeHead}>
                <input
                  type="checkbox"
                  className={styles.includeCheckbox}
                  checked={filteredRows.length > 0 && allVisibleIncluded}
                  aria-label="Zaznacz lub odznacz wszystkie widoczne mecze w medianie"
                  onChange={toggleAllVisibleIncluded}
                />
                <span className={styles.includeHeadLabel}>Med.</span>
              </th>
              <th scope="col">#</th>
              <th scope="col">Wynik</th>
              <th scope="col">Data</th>
              <th scope="col">Mecz</th>
              <th scope="col">G/A</th>
              <th scope="col">Gole</th>
              <th scope="col">Stracone</th>
              <th scope="col">xG</th>
              <th scope="col">xGA</th>
              <th scope="col">GD</th>
              <th scope="col">xGD</th>
              <th scope="col">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={13} className={styles.emptyTable}>
                  Brak meczów dla wybranego filtra wyniku.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const rowId = statsBombMatchRowId(row);
                const seasonIndex = rows.findIndex((r) => statsBombMatchRowId(r) === rowId) + 1;
                const outcome = getStatsBombMatchOutcome(row);
                const isSelected = rowId === selectedMatchId;
                const included = isMatchIncluded(rowId);
                return (
                  <tr
                    key={rowId}
                    className={`${styles.matchRow} ${outcomeRowClass(outcome)} ${isSelected ? styles.matchRowSelected : ""} ${included ? "" : styles.matchRowExcluded}`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`Mecz ${seasonIndex}: ${statsBombMatchOutcomeLabel(outcome)}, ${row.opponent}, ${row.date}${included ? "" : ", wyłączony z mediany"}`}
                    onClick={() => selectMatch(row)}
                    onKeyDown={(event) => onRowKeyDown(event, row)}
                  >
                    <td className={styles.includeCell} onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={styles.includeCheckbox}
                        checked={included}
                        aria-label={`Uwzględnij mecz ${row.opponent} (${row.date}) w medianie`}
                        onChange={() => toggleMatchIncluded(rowId)}
                      />
                    </td>
                    <td className={styles.matchNumber}>{seasonIndex}</td>
                    <td>
                      <span
                        className={`${styles.outcomeBadge} ${outcomeBadgeClass(outcome)}`}
                        title={statsBombMatchOutcomeLabel(outcome)}
                      >
                        {statsBombMatchOutcomeShort(outcome)}
                      </span>
                    </td>
                    <td>{row.date}</td>
                    <td title={row.matchLabel}>{row.opponent}</td>
                    <td>
                      <span className={row.isHome ? pageStyles.badgeHome : pageStyles.badgeAway}>
                        {row.isHome ? "Dom" : "Wyjazd"}
                      </span>
                    </td>
                    <td>{row.outcomes.goals}</td>
                    <td>{row.outcomes.goalsConceded}</td>
                    <td>{row.outcomes.xg.toFixed(2)}</td>
                    <td>{row.outcomes.xga.toFixed(2)}</td>
                    <td>{row.outcomes.gd}</td>
                    <td>{row.outcomes.xgd.toFixed(2)}</td>
                    <td>{row.outcomes.points}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section
        ref={medianSectionRef}
        className={styles.medianSection}
        aria-labelledby="statsbomb-match-medians-title"
      >
        <div className={styles.medianHeader}>
          <h3 id="statsbomb-match-medians-title" className={styles.medianTitle}>
            Analiza median sezonu
            {selectedMatch && selectedMatchIndex >= 0 ? (
              <span className={styles.medianSubtitle}>
                — mecz #{selectedMatchIndex + 1}: {selectedMatch.opponent} ({selectedMatch.date})
                {!selectedMatchIncluded ? " · poza próbą mediany" : ""}
              </span>
            ) : null}
          </h3>

          <div className={teamStyles.subTabs} role="tablist" aria-label="Podzakładki analizy median">
            <button
              type="button"
              role="tab"
              aria-selected={medianSubTab === "distribution"}
              className={`${teamStyles.subTab} ${medianSubTab === "distribution" ? teamStyles.subTabActive : ""}`}
              onClick={() => setMedianSubTab("distribution")}
            >
              Mecz vs mediana
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={medianSubTab === "outcome_summary"}
              className={`${teamStyles.subTab} ${medianSubTab === "outcome_summary" ? teamStyles.subTabActive : ""}`}
              onClick={() => setMedianSubTab("outcome_summary")}
            >
              Podsumowanie wg wyniku
            </button>
          </div>
        </div>

        {includedCount < STATSBOMB_TEAM_MEDIAN_MIN_MATCHES ? (
          <p className={styles.medianHint}>
            Potrzebujesz co najmniej {STATSBOMB_TEAM_MEDIAN_MIN_MATCHES} meczów w medianie, aby
            pokazać analizę (obecnie: {includedCount}). Zaznacz więcej meczów w tabeli.
          </p>
        ) : medianReport ? (
          medianSubTab === "distribution" ? (
            <StatsBombMedianDistributionPanel
              report={medianReport}
              mode="team"
              highlightId={selectedMatchId}
              highlightMatchRow={selectedMatchIncluded ? null : selectedMatch}
              highlightOptions={matchHighlightOptions}
              onHighlightChange={setSelectedMatchId}
              scopeHint={analysisScopeHint}
            />
          ) : (
            <StatsBombOutcomeMedianPanel
              rows={includedRows}
              medianReport={medianReport}
              onSelectMatch={onSelectMatchFromOutcome}
            />
          )
        ) : (
          <p className={styles.medianHint}>Nie udało się zbudować rozkładu median zespołu.</p>
        )}
      </section>
    </div>
  );
}
