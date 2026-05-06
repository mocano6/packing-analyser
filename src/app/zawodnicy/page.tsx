"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveRadar } from "@nivo/radar";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SidePanel from "@/components/SidePanel/SidePanel";
import TeamsMultiSelectorModal from "@/components/TeamsMultiSelectorModal/TeamsMultiSelectorModal";
import PositionsMultiSelectorModal from "@/components/PositionsMultiSelectorModal/PositionsMultiSelectorModal";
import type { Team as TeamCatalogEntry } from "@/constants/teamsLoader";
import { useAuth } from "@/hooks/useAuth";
import { usePlayerComparisonData, type PlayerComparisonFilters } from "@/hooks/usePlayerComparisonData";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useTeams } from "@/hooks/useTeams";
import { filterTeamsByUserAccess } from "@/lib/teamsForUserAccess";
import {
  PLAYER_COMPARISON_AXIS_METRIC_IDS,
  PLAYER_COMPARISON_FAMILY_OPTIONS,
  PLAYER_COMPARISON_METRICS,
  getMetricLeader,
  resolvePlayerComparisonMetricId,
  supportsComparisonMetricRole,
  type PlayerComparisonMetricFamily,
  type PlayerComparisonMetricId,
  type PlayerComparisonMetricRole,
  type PlayerComparisonRow,
} from "@/utils/playerComparisonMetrics";
import { getDefaultPlayerComparisonDateRange } from "@/utils/playerComparisonDateDefaults";
import {
  PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY,
  parsePlayerComparisonPreferences,
  serializePlayerComparisonPreferences,
} from "@/utils/playerComparisonPreferences";
import styles from "./zawodnicy.module.css";

/** Kolory serii A/B — spider + oznaczenia przy selectach. */
const COMPARISON_PLAYER_COLORS = ["#2563eb", "#16a34a"] as const;

const metricById = new Map(PLAYER_COMPARISON_METRICS.map((metric) => [metric.id, metric]));

const formatMetricValue = (metricId: PlayerComparisonMetricId, value: number): string => {
  if (!Number.isFinite(value)) return "—";
  const digits = metricById.get(metricId)?.fractionDigits ?? 1;
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const getWorstMetricRow = (rows: PlayerComparisonRow[], metricId: PlayerComparisonMetricId): PlayerComparisonRow | null => {
  const definition = metricById.get(metricId);
  if (!definition || rows.length === 0) return null;
  return rows.reduce((worst, row) => {
    const diff = row.values[metricId] - worst.values[metricId];
    return definition.direction === "lower" ? (diff > 0 ? row : worst) : diff < 0 ? row : worst;
  }, rows[0]);
};

const normalizeRadarScore = (rows: PlayerComparisonRow[], row: PlayerComparisonRow, metricId: PlayerComparisonMetricId): number => {
  const definition = metricById.get(metricId);
  const values = rows.map((item) => item.values[metricId]).filter(Number.isFinite);
  if (!definition || values.length === 0) return 0;
  const max = Math.max(...values, 0);
  if (max <= 0) return definition.direction === "lower" ? 100 : 0;
  const value = row.values[metricId];
  if (!Number.isFinite(value)) return 0;
  const score = definition.direction === "lower" ? (1 - value / max) * 100 : (value / max) * 100;
  return Math.max(0, Math.min(100, score));
};

const parseYear = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

type FullTableSortColumn = "playerName" | "birthYear" | "position" | "minutes" | "matches" | "kpi";

const defaultKpiTableSortDirection = (metricId: PlayerComparisonMetricId): "asc" | "desc" =>
  metricById.get(metricId)?.direction === "lower" ? "asc" : "desc";

export default function ZawodnicyPage() {
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, userRole, linkedPlayerId, logout } = useAuth();
  const { teams, isLoading: teamsLoading } = useTeams();
  const { players, refetchPlayers } = usePlayersState();
  const { comparison, matches, isLoading, error, lastFilters, loadComparison } = usePlayerComparisonData();

  const defaultDateRange = useMemo(() => getDefaultPlayerComparisonDateRange(), []);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [birthYearFrom, setBirthYearFrom] = useState("");
  const [birthYearTo, setBirthYearTo] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDateRange.from);
  const [dateTo, setDateTo] = useState(defaultDateRange.to);
  const [mode, setMode] = useState<"sum" | "per90">("per90");
  const [metricFamily, setMetricFamily] = useState<PlayerComparisonMetricFamily>("pxt");
  const [metricRole, setMetricRole] = useState<PlayerComparisonMetricRole>("sender");
  const [minMinutesStr, setMinMinutesStr] = useState("");
  const [minMatchesStr, setMinMatchesStr] = useState("");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [fullTableSort, setFullTableSort] = useState<{ column: FullTableSortColumn; direction: "asc" | "desc" }>(() => ({
    column: "kpi",
    direction: defaultKpiTableSortDirection(resolvePlayerComparisonMetricId("pxt", "sender")),
  }));
  const [primaryPlayerId, setPrimaryPlayerId] = useState("");
  const [secondaryPlayerId, setSecondaryPlayerId] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  const userTeamAccess = useMemo(
    () => ({ isAdmin, allowedTeamIds: userTeams ?? [] }),
    [isAdmin, userTeams],
  );
  const availableTeams = useMemo(() => filterTeamsByUserAccess(teams, userTeamAccess), [teams, userTeamAccess]);
  const teamsCatalog = teams as TeamCatalogEntry[];
  const sidePanelTeamId = useMemo(
    () => selectedTeamIds[0] ?? availableTeams[0]?.id ?? "",
    [availableTeams, selectedTeamIds],
  );
  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const rows = comparison?.rows ?? [];
  const positionsCatalog = useMemo(() => rows.map((r) => r.position), [rows]);

  const positionFilteredRows = useMemo(() => {
    if (selectedPositions.length === 0) return rows;
    return rows.filter((r) => selectedPositions.includes(r.position));
  }, [rows, selectedPositions]);

  const minMinutesThreshold = Math.max(0, Number.parseInt(minMinutesStr, 10) || 0);
  const minMatchesThreshold = Math.max(0, Number.parseInt(minMatchesStr, 10) || 0);

  const eligibleRows = useMemo(
    () =>
      positionFilteredRows.filter(
        (r) => r.minutes >= minMinutesThreshold && r.matchesPlayed >= minMatchesThreshold,
      ),
    [minMatchesThreshold, minMinutesThreshold, positionFilteredRows],
  );

  const activeMetricId = useMemo(
    () => resolvePlayerComparisonMetricId(metricFamily, metricRole),
    [metricFamily, metricRole],
  );
  const selectedMetric = metricById.get(activeMetricId) ?? PLAYER_COMPARISON_METRICS[0];
  const rowsWithAnyValue = useMemo(
    () =>
      eligibleRows.filter((row) => PLAYER_COMPARISON_METRICS.some((metric) => Math.abs(row.values[metric.id]) > 0)),
    [eligibleRows],
  );

  const sortedRows = useMemo(() => {
    const direction = metricById.get(activeMetricId)?.direction ?? "higher";
    return [...eligibleRows].sort((a, b) => {
      const diff = a.values[activeMetricId] - b.values[activeMetricId];
      return direction === "lower" ? diff : -diff;
    });
  }, [activeMetricId, eligibleRows]);

  const sortedSelectRows = useMemo(
    () =>
      [...rowsWithAnyValue].sort((a, b) => {
        const byLast = a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true });
        if (byLast !== 0) return byLast;
        return a.firstName.localeCompare(b.firstName, "pl", { sensitivity: "base", numeric: true });
      }),
    [rowsWithAnyValue],
  );

  useEffect(() => {
    setFullTableSort((s) =>
      s.column === "kpi" ? { column: "kpi", direction: defaultKpiTableSortDirection(activeMetricId) } : s,
    );
  }, [activeMetricId]);

  const fullTableSortedRows = useMemo(() => {
    const { column, direction } = fullTableSort;
    const rows = [...eligibleRows];

    const finiteOr = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);

    rows.sort((a, b) => {
      let d = 0;
      switch (column) {
        case "playerName":
          d = a.playerName.localeCompare(b.playerName, "pl", { sensitivity: "base", numeric: true });
          break;
        case "birthYear": {
          const aNull = a.birthYear == null;
          const bNull = b.birthYear == null;
          if (aNull && bNull) d = 0;
          else if (aNull) return 1;
          else if (bNull) return -1;
          else d = a.birthYear! - b.birthYear!;
          break;
        }
        case "position":
          d = (a.position || "").localeCompare(b.position || "", "pl", { sensitivity: "base", numeric: true });
          break;
        case "minutes":
          d = a.minutes - b.minutes;
          break;
        case "matches":
          d = a.matchesPlayed - b.matchesPlayed;
          break;
        case "kpi":
          d =
            finiteOr(a.values[activeMetricId], Number.POSITIVE_INFINITY) -
            finiteOr(b.values[activeMetricId], Number.POSITIVE_INFINITY);
          break;
        default:
          d = 0;
      }
      if (d !== 0) return direction === "asc" ? d : -d;
      return (
        a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true }) || a.playerId.localeCompare(b.playerId)
      );
    });

    return rows;
  }, [activeMetricId, eligibleRows, fullTableSort]);

  const handleFullTableSort = (column: FullTableSortColumn) => {
    setFullTableSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const direction =
        column === "kpi" ? defaultKpiTableSortDirection(activeMetricId) : "asc";
      return { column, direction };
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferences = parsePlayerComparisonPreferences(window.localStorage.getItem(PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY));
    setSelectedTeamIds(preferences.selectedTeamIds);
    setBirthYearFrom(preferences.birthYearFrom);
    setBirthYearTo(preferences.birthYearTo);
    setMode(preferences.mode);
    setMetricFamily(preferences.comparisonMetricFamily);
    setMetricRole(preferences.comparisonMetricRole);
    setMinMinutesStr(preferences.minMinutes);
    setMinMatchesStr(preferences.minMatches);
    setSelectedPositions(preferences.selectedPositions);
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(
      PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY,
      serializePlayerComparisonPreferences({
        selectedTeamIds,
        birthYearFrom,
        birthYearTo,
        mode,
        comparisonMetricFamily: metricFamily,
        comparisonMetricRole: metricRole,
        minMinutes: minMinutesStr,
        minMatches: minMatchesStr,
        selectedPositions,
      }),
    );
  }, [
    birthYearFrom,
    birthYearTo,
    metricFamily,
    metricRole,
    minMatchesStr,
    minMinutesStr,
    mode,
    preferencesLoaded,
    selectedPositions,
    selectedTeamIds,
  ]);

  useEffect(() => {
    if (sortedSelectRows.length === 0) {
      setPrimaryPlayerId("");
      setSecondaryPlayerId("");
      return;
    }
    const firstId = sortedSelectRows[0].playerId;
    setPrimaryPlayerId((current) =>
      sortedSelectRows.some((row) => row.playerId === current) ? current : firstId,
    );
    setSecondaryPlayerId((current) => {
      if (sortedSelectRows.some((row) => row.playerId === current) && current !== firstId) return current;
      return sortedSelectRows[1]?.playerId ?? firstId;
    });
  }, [sortedSelectRows]);

  const loadedTeamNames = useMemo(() => {
    const ids = lastFilters?.teamIds ?? selectedTeamIds;
    return ids.map((teamId) => teamNameById.get(teamId) ?? teamId);
  }, [lastFilters?.teamIds, selectedTeamIds, teamNameById]);

  const barData = useMemo(
    () =>
      sortedRows.slice(0, 12).map((row) => {
        const v = row.values[activeMetricId];
        const value = Number.isFinite(v) ? Number(v.toFixed(3)) : 0;
        return { name: row.playerName, value };
      }),
    [activeMetricId, sortedRows],
  );

  const primaryPlayer = sortedSelectRows.find((row) => row.playerId === primaryPlayerId) ?? null;
  const secondaryPlayer = sortedSelectRows.find((row) => row.playerId === secondaryPlayerId) ?? null;
  const radarData = useMemo(() => {
    if (!primaryPlayer || !secondaryPlayer) return [];
    return PLAYER_COMPARISON_AXIS_METRIC_IDS.map((axisId) => {
      const metric = metricById.get(axisId)!;
      return {
        metric: metric.shortLabel,
        [primaryPlayer.playerName]: normalizeRadarScore(eligibleRows, primaryPlayer, axisId),
        [secondaryPlayer.playerName]: normalizeRadarScore(eligibleRows, secondaryPlayer, axisId),
      };
    });
  }, [eligibleRows, primaryPlayer, secondaryPlayer]);

  const handleLoad = async () => {
    const filters: PlayerComparisonFilters = {
      teamIds: selectedTeamIds,
      birthYearFrom: parseYear(birthYearFrom),
      birthYearTo: parseYear(birthYearTo),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      mode,
    };
    await loadComparison(filters);
  };

  const sidePanel = (
    <SidePanel
      players={players}
      actions={[]}
      matchInfo={null}
      isAdmin={isAdmin}
      userRole={userRole ?? undefined}
      linkedPlayerId={linkedPlayerId}
      selectedTeam={sidePanelTeamId}
      onRefreshData={refetchPlayers}
      onImportSuccess={() => {}}
      onImportError={() => {}}
      onLogout={logout}
    />
  );

  if (authLoading) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <div className={styles.spinner} />
          <p>Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <h1 className={styles.centeredTitle}>Brak dostępu</h1>
          <p className={styles.centeredHint}>Musisz być zalogowany, aby zobaczyć porównywarkę zawodników.</p>
          <Link href="/login" className={styles.primaryButton}>
            Przejdź do logowania
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin && (!userTeams || userTeams.length === 0)) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <h1 className={styles.centeredTitle}>Brak dostępu do zespołów</h1>
          <p className={styles.centeredHint}>Twoje konto nie ma przypisanych zespołów.</p>
          <button type="button" onClick={logout} className={styles.primaryButton}>
            Wyloguj się
          </button>
        </div>
        {sidePanel}
      </div>
    );
  }

  if (teamsLoading) {
    return (
      <div className={styles.pageRoot}>
        <div className={styles.centered}>
          <div className={styles.spinner} />
          <p>Ładowanie zespołów...</p>
        </div>
        {sidePanel}
      </div>
    );
  }

  return (
    <div className={styles.pageRoot}>
      <header className={styles.header}>
        <div>
          <h1>Porównywarka zawodników</h1>
          <p>Dane KPI z meczów. Porównanie: Packing, PXT, xT, xG, wejścia PK, przechwyty, straty i xT strat.</p>
        </div>
      </header>

      <section className={styles.filtersPanel} aria-labelledby="player-comparison-filters">
        <div className={styles.sectionHeading}>
          <h2 id="player-comparison-filters">Filtry porównania</h2>
          <p className={styles.sectionHint}>Wybierz zespoły i roczniki. Pobieranie danych dopiero po kliknięciu przycisku.</p>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.teamsFilterCell}>
            <TeamsMultiSelectorModal
              teamsCatalog={teamsCatalog}
              userTeamAccess={userTeamAccess}
              selectedTeamIds={selectedTeamIds}
              onChange={setSelectedTeamIds}
              containerClassName={styles.teamsMultiSelectorInRow}
            />
          </div>

          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Rocznik od</span>
            <input
              id="birth-year-from"
              type="number"
              inputMode="numeric"
              placeholder="np. 2007"
              value={birthYearFrom}
              onChange={(event) => setBirthYearFrom(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Rocznik do</span>
            <input
              id="birth-year-to"
              type="number"
              inputMode="numeric"
              placeholder="np. 2009"
              value={birthYearTo}
              onChange={(event) => setBirthYearTo(event.target.value)}
              className={styles.input}
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Data meczu od</span>
            <input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={styles.input} />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Data meczu do</span>
            <input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={styles.input} />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Tryb</span>
            <div className={styles.modeToggle} role="group" aria-label="Tryb porównania">
              <button type="button" className={`${styles.modeButton} ${mode === "per90" ? styles.modeButtonActive : ""}`} onClick={() => setMode("per90")}>
                Per 90
              </button>
              <button type="button" className={`${styles.modeButton} ${mode === "sum" ? styles.modeButtonActive : ""}`} onClick={() => setMode("sum")}>
                Suma
              </button>
            </div>
          </div>
          <div className={styles.filterActions}>
            <span className={styles.filterSummaryLine}>
              <strong>{selectedTeamIds.length}</strong> zesp.
              {birthYearFrom || birthYearTo ? ` · r. ${birthYearFrom || "…"}–${birthYearTo || "…"}` : ""}
            </span>
            <button type="button" className={styles.primaryButton} onClick={handleLoad} disabled={isLoading || selectedTeamIds.length === 0}>
              {isLoading ? "Ładowanie…" : "Załaduj porównanie"}
            </button>
          </div>
        </div>

        <div className={`${styles.filtersRow} ${styles.filtersRowSecondary}`}>
          <div className={styles.positionsFilterCell}>
            <PositionsMultiSelectorModal
              positionsCatalog={positionsCatalog}
              selectedPositions={selectedPositions}
              onChange={setSelectedPositions}
              disabled={!comparison}
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Min. minut (≥)</span>
            <input
              id="min-minutes-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={minMinutesStr}
              onChange={(e) => setMinMinutesStr(e.target.value)}
              className={styles.input}
              aria-label="Minimalna liczba minut, aby uwzględnić zawodnika"
            />
          </div>
          <div className={`${styles.filterItem} ${styles.filterItemInRow}`}>
            <span>Min. meczów (≥)</span>
            <input
              id="min-matches-threshold"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={minMatchesStr}
              onChange={(e) => setMinMatchesStr(e.target.value)}
              className={styles.input}
              aria-label="Minimalna liczba rozegranych meczów, aby uwzględnić zawodnika"
            />
          </div>
          <p className={styles.filtersSecondaryHint}>
            Progi i pozycje stosują się po załadowaniu danych. Pozycje — dopiero gdy tabela ma dane.
          </p>
        </div>
      </section>

      {error && <p className={styles.errorText}>{error}</p>}

      {!comparison && !isLoading && (
        <section className={styles.emptyState}>
          <h2>Ustaw filtry, żeby rozpocząć</h2>
          <p>Na starcie nie pobieramy listy meczów dla tej analizy. Wybierz zespoły i (opcjonalnie) roczniki, potem załaduj porównanie.</p>
        </section>
      )}

      {comparison && (
        <>
          <section className={styles.summaryGrid} aria-label="Podsumowanie porównania">
            <article className={styles.summaryCard}>
              <span>Zawodnicy w analizie</span>
              <strong title="Po progach minut, meczów i filtrze pozycji">
                {eligibleRows.length}
                {rows.length > 0 ? ` / ${rows.length}` : ""}
              </strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Mecze</span>
              <strong>{matches.length}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Tryb</span>
              <strong>{lastFilters?.mode === "per90" ? "Per 90" : "Suma"}</strong>
            </article>
            <article className={styles.summaryCard}>
              <span>Zespoły</span>
              <strong className={styles.summaryTeams}>{loadedTeamNames.length ? loadedTeamNames.join(", ") : "—"}</strong>
            </article>
          </section>

          {comparison.usedPer90Fallback && lastFilters?.mode === "per90" && (
            <p className={styles.warningText}>
              Dla części zawodników nie znaleziono minut w meczach. Ich wartości w trybie per 90 pokazujemy jak sumę (bez skalowania).
            </p>
          )}

          {rows.length === 0 ? (
            <section className={styles.emptyState}>
              <h2>Brak zawodników dla wybranych filtrów</h2>
              <p>Zmień zakres roczników albo wybierz inne zespoły.</p>
            </section>
          ) : eligibleRows.length === 0 ? (
            <section className={styles.emptyState}>
              <h2>Żaden zawodnik nie spełnia kryteriów</h2>
              <p>
                Zmniejsz próg minimalnych minut lub meczów albo poszerz filtr pozycji (albo usuń go — „Pokaż wszystkie pozycje” w modalu).
              </p>
            </section>
          ) : (
            <>
              <section className={styles.kpiGrid} aria-label="Liderzy KPI">
                {PLAYER_COMPARISON_AXIS_METRIC_IDS.map((axisId) => {
                  const metric = metricById.get(axisId)!;
                  const leader = getMetricLeader(eligibleRows, axisId);
                  const weakest = getWorstMetricRow(eligibleRows, axisId);
                  return (
                    <article key={axisId} className={styles.kpiCard}>
                      <span>{metric.label}</span>
                      <strong>{leader?.playerName ?? "—"}</strong>
                      <small>
                        Lider: {leader ? formatMetricValue(axisId, leader.values[axisId]) : "—"} · Najsłabiej:{" "}
                        {weakest ? `${weakest.playerName} (${formatMetricValue(axisId, weakest.values[axisId])})` : "—"}
                      </small>
                    </article>
                  );
                })}
              </section>

              <section className={`${styles.analysisGrid} ${styles.analysisGridRankingOnly}`}>
                <article className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <h2 className={styles.panelTitle}>Ranking KPI</h2>
                      <p className={styles.panelSubtitle}>Wybierz KPI i zobacz, kto się wyróżnia.</p>
                    </div>
                    <div className={styles.rankingControls}>
                      <select
                        value={metricFamily}
                        onChange={(event) => {
                          const next = event.target.value as PlayerComparisonMetricFamily;
                          setMetricFamily(next);
                          if (!supportsComparisonMetricRole(next)) {
                            setMetricRole("sender");
                          }
                        }}
                        className={styles.select}
                        aria-label="Wybierz KPI do rankingu"
                      >
                        {PLAYER_COMPARISON_FAMILY_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {supportsComparisonMetricRole(metricFamily) && (
                        <div className={styles.roleToggle} role="group" aria-label="Rola w akcji">
                          <button
                            type="button"
                            className={`${styles.modeButton} ${metricRole === "sender" ? styles.modeButtonActive : ""}`}
                            onClick={() => setMetricRole("sender")}
                            aria-pressed={metricRole === "sender"}
                          >
                            Podający
                          </button>
                          <button
                            type="button"
                            className={`${styles.modeButton} ${metricRole === "receiver" ? styles.modeButtonActive : ""}`}
                            onClick={() => setMetricRole("receiver")}
                            aria-pressed={metricRole === "receiver"}
                          >
                            Przyjmujący
                          </button>
                          <button
                            type="button"
                            className={`${styles.modeButton} ${metricRole === "dribble" ? styles.modeButtonActive : ""}`}
                            onClick={() => setMetricRole("dribble")}
                            aria-pressed={metricRole === "dribble"}
                          >
                            Drybler
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.chartWrapper}>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={barData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fill: "#475569", fontSize: 12 }} />
                        <Tooltip
                          formatter={(value) => [formatMetricValue(activeMetricId, Number(value)), selectedMetric.label]}
                          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                        />
                        <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </section>

              <article className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2 className={styles.panelTitle}>Porównanie dwóch zawodników</h2>
                    <p className={styles.panelSubtitle}>SpiderMapa: skala względna w obrębie grupy po progach (0–100).</p>
                    {primaryPlayer && secondaryPlayer ? (
                      <ul className={styles.radarPlayerLegend} aria-label="Kolory serii na wykresie radarowym">
                        <li>
                          <span className={styles.playerColorDot} style={{ backgroundColor: COMPARISON_PLAYER_COLORS[0] }} aria-hidden />
                          <span>{primaryPlayer.playerName}</span>
                        </li>
                        <li>
                          <span className={styles.playerColorDot} style={{ backgroundColor: COMPARISON_PLAYER_COLORS[1] }} aria-hidden />
                          <span>{secondaryPlayer.playerName}</span>
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  <div className={styles.playerSelects}>
                    <div className={styles.playerSelectPair}>
                      <span
                        className={styles.playerColorDot}
                        style={{ backgroundColor: COMPARISON_PLAYER_COLORS[0] }}
                        title="Kolor zawodnika A na spider mapie"
                        aria-hidden
                      />
                      <select
                        value={primaryPlayerId}
                        onChange={(event) => setPrimaryPlayerId(event.target.value)}
                        className={styles.select}
                        aria-label="Zawodnik A"
                      >
                        {sortedSelectRows.map((row) => (
                          <option key={row.playerId} value={row.playerId}>
                            {row.playerName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.playerSelectPair}>
                      <span
                        className={styles.playerColorDot}
                        style={{ backgroundColor: COMPARISON_PLAYER_COLORS[1] }}
                        title="Kolor zawodnika B na spider mapie"
                        aria-hidden
                      />
                      <select
                        value={secondaryPlayerId}
                        onChange={(event) => setSecondaryPlayerId(event.target.value)}
                        className={styles.select}
                        aria-label="Zawodnik B"
                      >
                        {sortedSelectRows.map((row) => (
                          <option key={row.playerId} value={row.playerId}>
                            {row.playerName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {primaryPlayer && secondaryPlayer ? (
                  <div className={styles.comparisonLayout}>
                    <div className={styles.radarWrapper}>
                      <ResponsiveRadar
                        data={radarData}
                        keys={[primaryPlayer.playerName, secondaryPlayer.playerName]}
                        indexBy="metric"
                        maxValue={100}
                        margin={{ top: 48, right: 64, bottom: 48, left: 64 }}
                        curve="linearClosed"
                        borderWidth={2}
                        borderColor={{ from: "color" }}
                        gridLevels={5}
                        gridShape="circular"
                        gridLabelOffset={18}
                        enableDots
                        dotSize={6}
                        dotBorderWidth={2}
                        dotBorderColor={{ from: "color" }}
                        colors={[...COMPARISON_PLAYER_COLORS]}
                        fillOpacity={0.15}
                        blendMode="multiply"
                        motionConfig="wobbly"
                        sliceTooltip={({ index }) => {
                          const metric = PLAYER_COMPARISON_AXIS_METRIC_IDS.map((id) => metricById.get(id)!).find((m) => m.shortLabel === index);
                          if (!metric) return null;
                          return (
                            <div className={styles.radarTooltip}>
                              <strong>{metric.label}</strong>
                              <span>
                                {primaryPlayer.playerName}: {formatMetricValue(metric.id, primaryPlayer.values[metric.id])}
                              </span>
                              <span>
                                {secondaryPlayer.playerName}: {formatMetricValue(metric.id, secondaryPlayer.values[metric.id])}
                              </span>
                            </div>
                          );
                        }}
                      />
                    </div>
                    <div className={styles.compareTableWrapper}>
                      <table className={styles.playersTable}>
                        <thead>
                          <tr>
                            <th>KPI</th>
                            <th>
                              <span className={styles.compareTableHeadCell}>
                                <span
                                  className={styles.playerColorDot}
                                  style={{ backgroundColor: COMPARISON_PLAYER_COLORS[0] }}
                                  aria-hidden
                                />
                                {primaryPlayer.playerName}
                              </span>
                            </th>
                            <th>
                              <span className={styles.compareTableHeadCell}>
                                <span
                                  className={styles.playerColorDot}
                                  style={{ backgroundColor: COMPARISON_PLAYER_COLORS[1] }}
                                  aria-hidden
                                />
                                {secondaryPlayer.playerName}
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {PLAYER_COMPARISON_AXIS_METRIC_IDS.map((axisId) => {
                            const metric = metricById.get(axisId)!;
                            return (
                              <tr key={axisId}>
                                <td>{metric.label}</td>
                                <td>{formatMetricValue(axisId, primaryPlayer.values[axisId])}</td>
                                <td>{formatMetricValue(axisId, secondaryPlayer.values[axisId])}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className={styles.emptyInline}>Brak zawodników z danymi KPI do porównania w tym zakresie.</p>
                )}
              </article>

              <details className={styles.playersTableDetails}>
                <summary className={styles.playersTableSummary}>Pełna tabela zawodników (opcjonalnie rozwiń)</summary>
                <p className={styles.playersTableHint}>
                  Kliknij nagłówek kolumny, by sortować. Drugie kliknięcie odwraca kolejność. Kolumna KPI odpowiada aktualnemu zestawowi w rankingu (
                  {selectedMetric.label}).
                </p>
                <div className={styles.tableWrapper}>
                  <table className={styles.playersTable}>
                    <thead>
                      <tr>
                        <th scope="col" aria-sort={fullTableSort.column === "playerName" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("playerName")}
                            aria-label="Sortuj według zawodnika"
                          >
                            Zawodnik
                            {fullTableSort.column === "playerName" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "birthYear" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("birthYear")}
                            aria-label="Sortuj według rocznika"
                          >
                            Rocznik
                            {fullTableSort.column === "birthYear" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "position" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("position")}
                            aria-label="Sortuj według pozycji"
                          >
                            Pozycja
                            {fullTableSort.column === "position" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "minutes" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("minutes")}
                            aria-label="Sortuj według minut"
                          >
                            Min
                            {fullTableSort.column === "minutes" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "matches" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("matches")}
                            aria-label="Sortuj według liczby meczów"
                          >
                            Mecze
                            {fullTableSort.column === "matches" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                        <th scope="col" aria-sort={fullTableSort.column === "kpi" ? (fullTableSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                          <button
                            type="button"
                            className={styles.tableSortButton}
                            onClick={() => handleFullTableSort("kpi")}
                            aria-label={`Sortuj według ${selectedMetric.label}`}
                          >
                            {selectedMetric.shortLabel}
                            {fullTableSort.column === "kpi" ? (
                              <span className={styles.tableSortIndicator} aria-hidden>
                                {fullTableSort.direction === "asc" ? " ↑" : " ↓"}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fullTableSortedRows.map((row) => (
                        <tr key={row.playerId}>
                          <td>
                            <strong>{row.playerName}</strong>
                            <span className={styles.playerMeta}>#{row.number || "—"}</span>
                          </td>
                          <td>{row.birthYear ?? "—"}</td>
                          <td>{row.position || "—"}</td>
                          <td>{Math.round(row.minutes)}</td>
                          <td>{row.matchesPlayed}</td>
                          <td>{formatMetricValue(activeMetricId, row.values[activeMetricId])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
      {sidePanel}
    </div>
  );
}
