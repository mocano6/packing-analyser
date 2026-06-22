"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { StatsBombSquadPlayerRow } from "@/utils/statsbombCsvParser";
import StatsBombMedianDistributionPanel from "@/components/StatsBombMedianDistributionPanel/StatsBombMedianDistributionPanel";
import {
  buildStatsBombPlayerReport,
  STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES,
  STATSBOMB_PLAYER_STRONG_PERCENTILE,
  STATSBOMB_PLAYER_WEAK_PERCENTILE,
  statsBombPhaseLabel,
  statsBombPlayerRoleLabel,
  type StatsBombPlayerMetricRow,
  type StatsBombSquadMetricStandoutRow,
} from "@/utils/statsBombPlayerReport";
import { buildStatsBombPlayerMedianDistribution } from "@/utils/statsBombPlayerMedianDistribution";
import teamStyles from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel.module.css";
import styles from "./StatsBombPlayerReportPanel.module.css";

export type StatsBombPlayerReportPanelProps = {
  players: StatsBombSquadPlayerRow[];
  scopeHint?: string;
};

type ParameterFilter = "all" | "strengths" | "weaknesses" | "leaders";
type PlayerSubTab = "profile" | "medians";

function formatNum(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatOptional(value: number | null, digits = 2): string {
  return value === null ? "—" : formatNum(value, digits);
}

function formatPercentile(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatZ(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function roleBadgeClass(role: StatsBombPlayerMetricRow["role"]): string {
  switch (role) {
    case "strength":
      return teamStyles.badgeStrength;
    case "weakness":
      return teamStyles.badgeWeakness;
    default:
      return teamStyles.badgeNeutral;
  }
}

function phaseBadgeClass(phase: StatsBombPlayerMetricRow["phase"]): string {
  switch (phase) {
    case "attack":
      return teamStyles.badgeAttack;
    case "defense":
      return teamStyles.badgeDefense;
    default:
      return teamStyles.badgeGeneral;
  }
}

function percentileClass(row: StatsBombPlayerMetricRow): string {
  if (row.percentile === null) return teamStyles.corrNeutral;
  if (row.percentile >= STATSBOMB_PLAYER_STRONG_PERCENTILE) return teamStyles.corrPosStrong;
  if (row.percentile <= STATSBOMB_PLAYER_WEAK_PERCENTILE) return teamStyles.corrNegStrong;
  return teamStyles.corrNeutral;
}

function MetricTable({
  title,
  lead,
  rows,
  ariaLabel,
  emptyMessage,
  selectedPlayerId,
  tall = false,
  showDescription = false,
}: {
  title: string;
  lead?: string;
  rows: StatsBombPlayerMetricRow[];
  ariaLabel: string;
  emptyMessage: string;
  selectedPlayerId?: string;
  tall?: boolean;
  showDescription?: boolean;
}) {
  return (
    <section className={teamStyles.section} aria-label={ariaLabel}>
      {title ? <h3 className={teamStyles.sectionTitle}>{title}</h3> : null}
      {lead ? <p className={teamStyles.sectionLead}>{lead}</p> : null}
      {rows.length === 0 ? (
        <p className={teamStyles.emptySection}>{emptyMessage}</p>
      ) : (
        <div className={`${teamStyles.tableWrap} ${tall ? styles.tableWrapFull : ""}`}>
          <table className={teamStyles.table}>
            <thead>
              <tr>
                <th scope="col">Metryka</th>
                {showDescription ? <th scope="col">Opis</th> : null}
                <th scope="col">Faza</th>
                <th scope="col">Per 90</th>
                <th scope="col">Sezon (szac.)</th>
                <th scope="col">Śr. skład</th>
                <th scope="col">Percentyl</th>
                <th scope="col">Lider składu</th>
                <th scope="col">z</th>
                <th scope="col">Rola</th>
                {!showDescription ? <th scope="col">Interpretacja</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.id}-${row.label}`}
                  className={row.isSquadLeader ? styles.leaderRow : undefined}
                >
                  <td>
                    <span
                      className={`${teamStyles.metricLabel} ${row.description ? teamStyles.metricWithDef : ""}`}
                      title={row.description ?? row.label}
                    >
                      {row.label}
                      {row.isSquadLeader ? " ★" : ""}
                    </span>
                  </td>
                  {showDescription ? (
                    <td className={styles.descCell}>{row.description ?? "—"}</td>
                  ) : null}
                  <td>
                    <span className={`${teamStyles.badge} ${phaseBadgeClass(row.phase)}`}>
                      {statsBombPhaseLabel(row.phase)}
                    </span>
                  </td>
                  <td className={teamStyles.num}>{formatNum(row.playerValue)}</td>
                  <td className={teamStyles.num}>{formatOptional(row.seasonTotal)}</td>
                  <td className={teamStyles.num}>{formatNum(row.teamAvg)}</td>
                  <td className={`${teamStyles.num} ${percentileClass(row)}`}>
                    {formatPercentile(row.percentile)}
                  </td>
                  <td className={teamStyles.num}>
                    {row.squadLeaderName ? (
                      <span
                        className={
                          row.isSquadLeader && selectedPlayerId ? styles.leaderCell : undefined
                        }
                      >
                        {row.squadLeaderName} ({formatNum(row.squadLeaderPer90 ?? NaN)})
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={teamStyles.num}>{formatZ(row.zScore)}</td>
                  <td>
                    <span className={`${teamStyles.badge} ${roleBadgeClass(row.role)}`}>
                      {statsBombPlayerRoleLabel(row.role)}
                    </span>
                  </td>
                  {!showDescription ? (
                    <td className={teamStyles.interpretation}>{row.interpretation}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SquadStandoutsTable({
  rows,
  selectedPlayerId,
}: {
  rows: StatsBombSquadMetricStandoutRow[];
  selectedPlayerId: string;
}) {
  return (
    <section className={teamStyles.section} aria-label="Ranking składu po parametrach StatsBomb">
      <h3 className={teamStyles.sectionTitle}>Ranking składu — kto wyróżnia się w parametrze</h3>
      <p className={teamStyles.sectionLead}>
        Dla każdej metryki lider składu (per 90) oraz miejsca 2–3. Wiersz podświetlony, gdy
        wybrany zawodnik jest liderem. Sezon (szac.) = per 90 × minuty / 90.
      </p>
      <div className={`${teamStyles.tableWrap} ${styles.tableWrapFull}`}>
        <table className={teamStyles.table}>
          <thead>
            <tr>
              <th scope="col">Parametr</th>
              <th scope="col">Opis</th>
              <th scope="col">Faza</th>
              <th scope="col">Lider (per 90)</th>
              <th scope="col">Sezon lidera</th>
              <th scope="col">Śr. skład</th>
              <th scope="col">2. miejsce</th>
              <th scope="col">3. miejsce</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelectedLeader = row.leader.playerId === selectedPlayerId;
              return (
                <tr key={row.id} className={isSelectedLeader ? styles.leaderRow : undefined}>
                  <td>
                    <span
                      className={`${teamStyles.metricLabel} ${row.description ? teamStyles.metricWithDef : ""}`}
                      title={row.description ?? row.label}
                    >
                      {row.label}
                    </span>
                  </td>
                  <td className={styles.descCell}>{row.description ?? "—"}</td>
                  <td>
                    <span className={`${teamStyles.badge} ${phaseBadgeClass(row.phase)}`}>
                      {statsBombPhaseLabel(row.phase)}
                    </span>
                  </td>
                  <td className={`${teamStyles.num} ${isSelectedLeader ? styles.leaderCell : ""}`}>
                    {row.leader.displayName} ({formatNum(row.leader.per90)})
                  </td>
                  <td className={teamStyles.num}>{formatOptional(row.leader.seasonTotal)}</td>
                  <td className={teamStyles.num}>{formatNum(row.teamAvgPer90)}</td>
                  <td className={teamStyles.num}>
                    {row.runnersUp[0]
                      ? `${row.runnersUp[0].displayName} (${formatNum(row.runnersUp[0].per90)})`
                      : "—"}
                  </td>
                  <td className={teamStyles.num}>
                    {row.runnersUp[1]
                      ? `${row.runnersUp[1].displayName} (${formatNum(row.runnersUp[1].per90)})`
                      : "—"}
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

export default function StatsBombPlayerReportPanel({
  players,
  scopeHint,
}: StatsBombPlayerReportPanelProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [minMinutes, setMinMinutes] = useState(STATSBOMB_PLAYER_DEFAULT_MIN_MINUTES);
  const [parameterFilter, setParameterFilter] = useState<ParameterFilter>("all");
  const [metricSearch, setMetricSearch] = useState("");
  const [subTab, setSubTab] = useState<PlayerSubTab>("profile");

  const report = useMemo(
    () => buildStatsBombPlayerReport(players, minMinutes),
    [players, minMinutes],
  );

  const medianReport = useMemo(
    () => buildStatsBombPlayerMedianDistribution(players, minMinutes),
    [players, minMinutes],
  );

  useEffect(() => {
    if (!report?.players.length) return;
    const exists = report.players.some((p) => p.playerId === selectedPlayerId);
    if (!exists) {
      setSelectedPlayerId(report.players[0]?.playerId ?? "");
    }
  }, [report, selectedPlayerId]);

  const profile = report?.profiles[selectedPlayerId] ?? null;
  const selectedPlayer = profile?.player ?? report?.players.find((p) => p.playerId === selectedPlayerId);

  const filteredParameters = useMemo(() => {
    const rows = profile?.allParameters ?? [];
    const search = metricSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (parameterFilter === "strengths" && row.role !== "strength") return false;
      if (parameterFilter === "weaknesses" && row.role !== "weakness") return false;
      if (parameterFilter === "leaders" && !row.isSquadLeader) return false;
      if (!search) return true;
      return (
        row.label.toLowerCase().includes(search) ||
        (row.description?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [profile?.allParameters, parameterFilter, metricSearch]);

  const leaderCount = useMemo(
    () => profile?.allParameters.filter((row) => row.isSquadLeader).length ?? 0,
    [profile?.allParameters],
  );

  const onPlayerChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlayerId(event.target.value);
  }, []);

  const onMinMinutesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setMinMinutes(parsed);
    }
  }, []);

  const highlightOptions = useMemo(
    () =>
      (report?.players ?? []).map((player) => ({
        id: player.playerId,
        label: player.displayName,
        subLabel: `${Math.round(player.minutes)} min`,
      })),
    [report?.players],
  );

  if (players.length === 0) {
    return (
      <p className={teamStyles.hint}>
        Wgraj plik Squad STATS (CSV), aby zobaczyć profil zawodników względem składu.
      </p>
    );
  }

  const introHint =
    `Statystyki indywidualne z eksportu Squad STATS. Kolumna Per 90 pochodzi wprost z CSV; ` +
    `Sezon (szac.) = per 90 × minuty / 90 (tylko metryki wolumenowe, bez % i średnich). ` +
    `Porównanie ze średnią składu (min. ${minMinutes} min w próbie). Percentyl ≥ ${STATSBOMB_PLAYER_STRONG_PERCENTILE}% = mocna strona, ` +
    `≤ ${STATSBOMB_PLAYER_WEAK_PERCENTILE}% = słaba strona.` +
    (scopeHint ? ` ${scopeHint}` : "");

  const attackStrengths = profile?.strengths.filter((row) => row.phase === "attack").slice(0, 3) ?? [];
  const defenseStrengths = profile?.strengths.filter((row) => row.phase === "defense").slice(0, 3) ?? [];

  return (
    <div className={teamStyles.reportRoot}>
      <div className={teamStyles.subTabs} role="tablist" aria-label="Podzakładki raportu zawodników">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "profile"}
          className={`${teamStyles.subTab} ${subTab === "profile" ? teamStyles.subTabActive : ""}`}
          onClick={() => setSubTab("profile")}
        >
          Profil zawodnika
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === "medians"}
          className={`${teamStyles.subTab} ${subTab === "medians" ? teamStyles.subTabActive : ""}`}
          onClick={() => setSubTab("medians")}
        >
          Mediany sezonu składu
        </button>
      </div>

      {subTab === "medians" ? (
        medianReport ? (
          <StatsBombMedianDistributionPanel
            report={medianReport}
            mode="player"
            highlightId={selectedPlayerId}
            highlightOptions={highlightOptions}
            onHighlightChange={setSelectedPlayerId}
            scopeHint={`Próba składu: min. ${minMinutes} min.`}
          />
        ) : (
          <p className={teamStyles.hint}>
            Potrzebujesz co najmniej trzech zawodników z danymi Squad STATS, aby pokazać rozkład median.
          </p>
        )
      ) : !report || !selectedPlayer ? (
        <p className={teamStyles.hint}>Nie udało się zbudować raportu zawodników.</p>
      ) : (
        <>
      <p className={teamStyles.hint}>{introHint}</p>

      <div
        className={teamStyles.toolbar}
        style={{ display: "flex", flexWrap: "wrap", gap: "12px 16px", alignItems: "center" }}
      >
        <label
          htmlFor="statsbomb-player-select"
          style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
        >
          Zawodnik
        </label>
        <select
          id="statsbomb-player-select"
          value={selectedPlayerId}
          onChange={onPlayerChange}
          aria-label="Wybierz zawodnika StatsBomb"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
            minWidth: 220,
          }}
        >
          {report.players.map((player) => (
            <option key={player.playerId} value={player.playerId}>
              {player.displayName} ({Math.round(player.minutes)} min)
            </option>
          ))}
        </select>
        <label
          htmlFor="statsbomb-min-minutes"
          style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
        >
          Min. minuty (próba)
        </label>
        <input
          id="statsbomb-min-minutes"
          type="number"
          min={0}
          step={50}
          value={minMinutes}
          onChange={onMinMinutesChange}
          aria-label="Minimalne minuty zawodników w próbie porównawczej"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
            width: 100,
          }}
        />
      </div>

      <div className={teamStyles.summaryGrid}>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Minuty</div>
          <div className={teamStyles.summaryValue}>{Math.round(selectedPlayer.minutes)}</div>
          <div className={teamStyles.summarySub}>
            {selectedPlayer.isGoalkeeper ? "Bramkarz" : "Pole"}
          </div>
        </article>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Parametry</div>
          <div className={teamStyles.summaryValue}>{profile?.allParameters.length ?? 0}</div>
          <div className={teamStyles.summarySub}>z {report.summary.metricCount} w składzie</div>
        </article>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Liderstwa</div>
          <div className={teamStyles.summaryValue}>{leaderCount}</div>
          <div className={teamStyles.summarySub}>parametrów per 90 w składzie</div>
        </article>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Mocne strony</div>
          <div className={teamStyles.summaryValue}>{profile?.strengths.length ?? 0}</div>
          <div className={teamStyles.summarySub}>percentyl ≥ {STATSBOMB_PLAYER_STRONG_PERCENTILE}%</div>
        </article>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Słabe strony</div>
          <div className={teamStyles.summaryValue}>{profile?.weaknesses.length ?? 0}</div>
          <div className={teamStyles.summarySub}>percentyl ≤ {STATSBOMB_PLAYER_WEAK_PERCENTILE}%</div>
        </article>
        <article className={teamStyles.summaryCard}>
          <div className={teamStyles.summaryLabel}>Skład</div>
          <div className={teamStyles.summaryValue}>{report.summary.eligiblePlayerCount}</div>
          <div className={teamStyles.summarySub}>z {report.summary.playerCount} zawodników</div>
        </article>
        {selectedPlayer.age !== null ? (
          <article className={teamStyles.summaryCard}>
            <div className={teamStyles.summaryLabel}>Wiek</div>
            <div className={teamStyles.summaryValue}>{Math.round(selectedPlayer.age)}</div>
          </article>
        ) : null}
      </div>

      <div className={teamStyles.phaseBannerGrid}>
        <article className={`${teamStyles.phaseBanner} ${teamStyles.phaseBannerAttack}`}>
          <h3 className={teamStyles.phaseBannerTitle}>Atak — wyróżnienia</h3>
          <p className={teamStyles.phaseBannerText}>
            {attackStrengths.length > 0
              ? attackStrengths
                  .map((row) => `${row.label} (${formatPercentile(row.percentile)}, per 90: ${formatNum(row.playerValue)})`)
                  .join("; ")
              : "Brak wyraźnych mocnych stron ofensywnych względem składu."}
          </p>
        </article>
        <article className={`${teamStyles.phaseBanner} ${teamStyles.phaseBannerDefense}`}>
          <h3 className={teamStyles.phaseBannerTitle}>Obrona — wyróżnienia</h3>
          <p className={teamStyles.phaseBannerText}>
            {defenseStrengths.length > 0
              ? defenseStrengths
                  .map((row) => `${row.label} (${formatPercentile(row.percentile)}, per 90: ${formatNum(row.playerValue)})`)
                  .join("; ")
              : "Brak wyraźnych mocnych stron defensywnych względem składu."}
          </p>
        </article>
      </div>

      <section className={teamStyles.section} aria-label="Tabela wszystkich parametrów zawodnika">
        <h3 className={teamStyles.sectionTitle}>
          Wszystkie parametry zawodnika ({selectedPlayer.displayName})
        </h3>
        <p className={teamStyles.sectionLead}>
          Pełna lista metryk z Squad STATS: wartość per 90, szacunek sezonowy, porównanie ze
          składem oraz lider parametru. ★ = zawodnik lideruje składem w tej metryce.
        </p>
        <div className={styles.filterRow}>
          {(
            [
              ["all", "Wszystkie"],
              ["strengths", "Mocne strony"],
              ["weaknesses", "Słabe strony"],
              ["leaders", "Liderstwa w składzie"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${styles.filterButton} ${parameterFilter === id ? styles.filterButtonActive : ""}`}
              onClick={() => setParameterFilter(id)}
              aria-pressed={parameterFilter === id}
            >
              {label}
            </button>
          ))}
          <input
            type="search"
            className={styles.searchInput}
            value={metricSearch}
            onChange={(event) => setMetricSearch(event.target.value)}
            placeholder="Szukaj parametru…"
            aria-label="Szukaj parametru w tabeli zawodnika"
          />
        </div>
        <MetricTable
          title=""
          rows={filteredParameters}
          ariaLabel="Wszystkie parametry zawodnika StatsBomb"
          emptyMessage="Brak parametrów dla wybranych filtrów."
          selectedPlayerId={selectedPlayerId}
          tall
          showDescription
        />
      </section>

      <SquadStandoutsTable rows={report.squadStandouts} selectedPlayerId={selectedPlayerId} />

      <div className={teamStyles.splitColumns}>
        <MetricTable
          title={`Mocne strony (≥ ${STATSBOMB_PLAYER_STRONG_PERCENTILE}. percentyl)`}
          lead="Parametry, w których zawodnik wyraźnie wyprzedza średnią składu."
          rows={profile?.strengths ?? []}
          ariaLabel="Mocne strony zawodnika StatsBomb"
          emptyMessage="Brak metryk w górnych 25% składu dla tego zawodnika."
          selectedPlayerId={selectedPlayerId}
        />
        <MetricTable
          title={`Słabe strony (≤ ${STATSBOMB_PLAYER_WEAK_PERCENTILE}. percentyl)`}
          lead="Parametry poniżej średniej składu — obszary do poprawy lub mniejszej roli."
          rows={profile?.weaknesses ?? []}
          ariaLabel="Słabe strony zawodnika StatsBomb"
          emptyMessage="Brak metryk w dolnych 25% składu dla tego zawodnika."
          selectedPlayerId={selectedPlayerId}
        />
      </div>

      <MetricTable
        title="Profil vs skład (najbardziej odbiegające)"
        lead="Metryki posortowane od najbardziej odbiegających od średniej składu."
        rows={profile?.ranked ?? []}
        ariaLabel="Profil zawodnika StatsBomb posortowany"
        emptyMessage="Brak metryk do wyświetlenia."
        selectedPlayerId={selectedPlayerId}
        tall
      />
        </>
      )}
    </div>
  );
}
