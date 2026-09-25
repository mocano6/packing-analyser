"use client";

import React, { useMemo } from "react";
import { useWyscoutTeam } from "@/hooks/useWyscoutTeam";
import { isPolishIiiLigaCompetition } from "@/utils/wyscoutPolishCompetitions";
import {
  buildWyscoutMatchSides,
  buildWyscoutMetricRows,
  squadPlayerLabel,
} from "@/utils/wyscoutStatsDisplay";
import styles from "./StatystykiZespoluWyscoutTab.module.css";

type Props = {
  lookballTeamId: string;
  lookballTeamName: string;
  matchDate?: string;
  opponentName?: string;
};

export default function StatystykiZespoluWyscoutTab({
  lookballTeamId,
  lookballTeamName,
  matchDate,
  opponentName,
}: Props) {
  const {
    configured,
    binding,
    overview,
    isLoading,
    error,
    catalog,
    isCatalogLoading,
    selectedCompId,
    setSelectedCompId,
    selectedCompetition,
    seasons,
    selectedSeasonId,
    setSelectedSeasonId,
    visibleTeams,
    isLeagueLoading,
    teamFilter,
    setTeamFilter,
    loadCatalog,
    bindTeam,
    unbindTeam,
    loadMatchStats,
  } = useWyscoutTeam({
    lookballTeamId,
    lookballTeamName,
    matchDate,
    enabled: Boolean(lookballTeamId),
  });

  const sides = useMemo(() => {
    if (!overview?.matchStats || !binding) return null;
    return buildWyscoutMatchSides(overview.matchStats, binding.wyId);
  }, [overview?.matchStats, binding]);

  const metricRows = useMemo(() => (sides ? buildWyscoutMetricRows(sides) : []), [sides]);

  if (configured === false) {
    return (
      <div className={styles.section}>
        <div className={styles.banner} role="status">
          Brak konfiguracji API Wyscout. Dodaj <code>WYSCOUT_USERNAME</code> i{" "}
          <code>WYSCOUT_PASSWORD</code> do <code>.env.local</code>, potem zrestartuj{" "}
          <code>npm run dev</code>.
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <p className={styles.lead}>
        Lista lig schodzi z API (najpierw Polska). Wybierz ligę — potem sezon i klub.
      </p>

      {error ? <p className={styles.error}>{error}</p> : null}

      {binding ? (
        <div className={styles.bound}>
          <div>
            <div className={styles.boundName}>{binding.officialName || binding.name}</div>
            <div className={styles.resultMeta}>
              {[binding.competitionName, binding.wyId ? `wyId ${binding.wyId}` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button type="button" className={styles.ghostButton} onClick={unbindTeam}>
            Zmień drużynę
          </button>
        </div>
      ) : (
        <div className={styles.catalog}>
          <div className={styles.bindRow}>
            <label htmlFor="wyscout-manual-comp">
              <span className={styles.srOnly}>Dostępne ligi Wyscout</span>
            </label>
            <select
              id="wyscout-manual-comp"
              className={styles.searchInput}
              value={selectedCompId ?? ""}
              onChange={(e) => setSelectedCompId(Number(e.target.value) || null)}
              disabled={isCatalogLoading}
              aria-busy={isCatalogLoading}
            >
              <option value="">
                {isCatalogLoading
                  ? "Pobieranie dostępnych lig…"
                  : catalog?.competitions.length
                    ? "Wybierz ligę z licencji…"
                    : "Brak lig w odpowiedzi API"}
              </option>
              {(catalog?.competitions ?? []).map((comp) => (
                <option key={comp.wyId} value={comp.wyId}>
                  {isPolishIiiLigaCompetition(comp) ? "III · " : ""}
                  {comp.name}
                  {comp.area?.name ? ` · ${comp.area.name}` : ""}
                  {comp.divisionLevel ? ` (poz. ${comp.divisionLevel})` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => void loadCatalog()}
              disabled={isCatalogLoading}
            >
              Odśwież ligi
            </button>
          </div>

          {isCatalogLoading ? <p className={styles.loading}>Pobieranie lig z Wyscout…</p> : null}

          {catalog && catalog.competitions.length > 0 && catalog.iiiLiga.length === 0 ? (
            <div className={styles.banner} role="status">
              III ligi nie ma na liście z tego klucza. Wybierz inną ligę z pakietu albo dopisz
              III ligę u Hudl.
            </div>
          ) : null}

          {catalog ? (
            <div className={styles.bindRow}>

              <select
                id="wyscout-season"
                className={styles.searchInput}
                value={selectedSeasonId ?? ""}
                onChange={(e) => setSelectedSeasonId(Number(e.target.value) || null)}
                disabled={!selectedCompId || seasons.length === 0}
                aria-label="Sezon Wyscout"
              >
                <option value="">Sezon…</option>
                {seasons.map((season) => (
                  <option key={season.wyId} value={season.wyId}>
                    {season.name}
                    {season.active ? " (aktywny)" : ""}
                  </option>
                ))}
              </select>

              <input
                id="wyscout-team-filter"
                className={styles.searchInput}
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                placeholder={`Filtruj kluby${lookballTeamName ? `, np. ${lookballTeamName}` : ""}`}
                autoComplete="off"
                disabled={!selectedCompId}
              />
            </div>
          ) : null}

          {selectedCompetition ? (
            <p className={styles.resultMeta}>
              {selectedCompetition.name}
              {isPolishIiiLigaCompetition(selectedCompetition)
                ? " — to III liga w pakiecie Wyscout."
                : " — to nie III liga, ale jest w Twojej licencji."}
            </p>
          ) : null}

          {isLeagueLoading ? <p className={styles.loading}>Ładowanie drużyn ligi…</p> : null}

          {!binding && visibleTeams.length > 0 ? (
            <ul className={styles.results} aria-label="Drużyny wybranej ligi">
              {visibleTeams.map((team) => (
                <li key={team.wyId}>
                  <button type="button" className={styles.resultButton} onClick={() => bindTeam(team)}>
                    <span className={styles.resultName}>{team.officialName || team.name}</span>
                    <span className={styles.resultMeta}>
                      {[team.city, team.category, `wyId ${team.wyId}`].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!binding && !isLeagueLoading && selectedCompId && visibleTeams.length === 0 ? (
            <p className={styles.empty}>
              Brak drużyn w tej lidze/sezonie albo filtr nic nie zwraca. Wybierz inną grupę III
              ligi albo wyczyść filtr.
            </p>
          ) : null}
        </div>
      )}

      {isLoading ? <p className={styles.loading}>Pobieranie danych Wyscout…</p> : null}

      {overview && binding ? (
        <>
          {sides ? (
            <div className={styles.scoreboard} aria-label="Porównanie xG Wyscout">
              <div className={`${styles.scoreSide} ${styles.scoreSideTeam}`}>
                <span className={styles.scoreName}>{sides.team.name}</span>
                <span className={styles.scoreXg}>
                  {sides.team.xg == null ? "—" : sides.team.xg.toFixed(2)}
                </span>
              </div>
              <div className={styles.scoreMid}>
                <div>{overview.matchedMatch?.label || "Mecz Wyscout"}</div>
                <div>
                  {overview.matchedMatch?.dateutc || matchDate || "—"}
                  {opponentName ? ` · vs ${opponentName}` : ""}
                </div>
              </div>
              <div className={`${styles.scoreSide} ${styles.scoreSideOpp}`}>
                <span className={styles.scoreName}>{sides.opponent?.name || "Przeciwnik"}</span>
                <span className={styles.scoreXg}>
                  {sides.opponent?.xg == null ? "—" : sides.opponent.xg.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <p className={styles.empty}>
              {overview.matchedMatch
                ? "Mecz znaleziony, ale brak advanced stats (licencja albo mecz bez danych)."
                : matchDate
                  ? `Brak meczu Wyscout z datą ${matchDate}. Wybierz mecz z listy poniżej.`
                  : "Wybierz mecz z listy, aby zobaczyć statystyki."}
            </p>
          )}

          {metricRows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.metrics}>
                <caption className={styles.srOnly}>Statystyki Wyscout meczu</caption>
                <thead>
                  <tr>
                    <th scope="col">Metryka</th>
                    <th scope="col">{sides?.team.name || "Zespół"}</th>
                    <th scope="col">{sides?.opponent?.name || "Przeciwnik"}</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.team}</td>
                      <td>{row.opponent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className={styles.grid}>
            <section className={styles.panel} aria-labelledby="wyscout-matches-title">
              <h4 id="wyscout-matches-title" className={styles.panelTitle}>
                Mecze Wyscout
              </h4>
              {overview.matches.length === 0 ? (
                <p className={styles.empty}>Brak meczów dla tej drużyny.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Mecz</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.matches.map((match) => (
                        <tr key={match.matchId}>
                          <td>{(match.dateutc || match.date || "—").slice(0, 10)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => void loadMatchStats(match.matchId)}
                              aria-current={
                                overview.matchedMatch?.matchId === match.matchId
                                  ? "true"
                                  : undefined
                              }
                            >
                              {match.label || `#${match.matchId}`}
                            </button>
                          </td>
                          <td>{match.status || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div>
              <section className={styles.panel} aria-labelledby="wyscout-career-title">
                <h4 id="wyscout-career-title" className={styles.panelTitle}>
                  Sezony
                </h4>
                {overview.career?.length ? (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Sezon</th>
                          <th scope="col">Rozgrywki</th>
                          <th scope="col">Bilans</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.career.map((entry, idx) => (
                          <tr key={`${entry.seasonId ?? idx}-${entry.competitionId ?? idx}`}>
                            <td>{entry.season?.name || "—"}</td>
                            <td>{entry.competition?.name || "—"}</td>
                            <td>
                              {entry.matchWon ?? 0}-{entry.matchDraw ?? 0}-{entry.matchLost ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={styles.empty}>Brak historii sezonów.</p>
                )}
              </section>

              <section className={styles.panel} aria-labelledby="wyscout-squad-title">
                <h4 id="wyscout-squad-title" className={styles.panelTitle}>
                  Skład
                </h4>
                {overview.squad?.length ? (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Zawodnik</th>
                          <th scope="col">Pozycja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.squad.map((player) => (
                          <tr key={player.wyId}>
                            <td>{squadPlayerLabel(player)}</td>
                            <td>{player.role?.name || player.role?.code3 || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={styles.empty}>Brak składu albo brak uprawnień do tego endpointu.</p>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
