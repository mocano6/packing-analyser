"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import SidePanel from "@/components/SidePanel/SidePanel";
import StatsBombCorrelationPanel from "@/components/StatsBombCorrelationPanel/StatsBombCorrelationPanel";
import StatsBombPlayerReportPanel from "@/components/StatsBombPlayerReportPanel/StatsBombPlayerReportPanel";
import StatsBombTeamReportPanel from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel";
import StatsBombMatchesTab from "@/components/StatsBombMatchesTab/StatsBombMatchesTab";
import {
  clearStatsBombCsvFromStorage,
  clearStatsBombSquadCsvFromStorage,
  detectStatsBombCsvKind,
  loadStatsBombCsvFromStorage,
  loadStatsBombSquadCsvFromStorage,
  parseStatsBombMatchStatsCsv,
  parseStatsBombSquadStatsCsv,
  saveStatsBombCsvToStorage,
  saveStatsBombSquadCsvToStorage,
  type StatsBombMatchRow,
  type StatsBombSquadPlayerRow,
} from "@/utils/statsbombCsvParser";
import styles from "./statsbomb.module.css";

type TabId = "players" | "report" | "correlations" | "matches";

export default function AdminStatsBombPage() {
  const { user, isAdmin, isLoading, userRole, linkedPlayerId, logout } = useAuth();
  const [matchCsvText, setMatchCsvText] = useState<string>("");
  const [matchFileName, setMatchFileName] = useState<string>("");
  const [squadCsvText, setSquadCsvText] = useState<string>("");
  const [squadFileName, setSquadFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("players");

  useEffect(() => {
    const savedMatch = loadStatsBombCsvFromStorage();
    if (savedMatch) {
      setMatchCsvText(savedMatch);
      setMatchFileName("Zapisany lokalnie (mecze)");
    }
    const savedSquad = loadStatsBombSquadCsvFromStorage();
    if (savedSquad) {
      setSquadCsvText(savedSquad);
      setSquadFileName("Zapisany lokalnie (skład)");
    }
  }, []);

  useEffect(() => {
    if (squadCsvText.trim()) {
      setActiveTab((prev) => (prev === "report" || prev === "correlations" || prev === "matches") && !matchCsvText.trim() ? "players" : prev);
    } else if (matchCsvText.trim()) {
      setActiveTab((prev) => (prev === "players" ? "report" : prev));
    }
  }, [matchCsvText, squadCsvText]);

  const matchRows = useMemo(() => {
    if (!matchCsvText.trim()) return [] as StatsBombMatchRow[];
    try {
      return parseStatsBombMatchStatsCsv(matchCsvText);
    } catch {
      return [];
    }
  }, [matchCsvText]);

  const squadPlayers = useMemo(() => {
    if (!squadCsvText.trim()) return [] as StatsBombSquadPlayerRow[];
    try {
      return parseStatsBombSquadStatsCsv(squadCsvText);
    } catch {
      return [];
    }
  }, [squadCsvText]);

  const dateRange = useMemo(() => {
    if (matchRows.length === 0) return null;
    const dates = matchRows.map((r) => r.date).filter(Boolean).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [matchRows]);

  const handleMatchFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Wybierz plik CSV (StatsBomb MatchStats).");
      return;
    }
    try {
      const text = await file.text();
      const kind = detectStatsBombCsvKind(text);
      if (kind !== "match") {
        toast.error("To nie wygląda na plik MatchStats — użyj importu Squad STATS poniżej.");
        return;
      }
      const parsed = parseStatsBombMatchStatsCsv(text);
      if (parsed.length === 0) {
        toast.error("Nie znaleziono wierszy meczów w pliku.");
        return;
      }
      setMatchCsvText(text);
      setMatchFileName(file.name);
      saveStatsBombCsvToStorage(text);
      toast.success(`Wczytano ${parsed.length} meczów ze StatsBomb.`);
    } catch (error) {
      toast.error(
        "Błąd parsowania CSV: " + (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      event.target.value = "";
    }
  }, []);

  const handleSquadFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Wybierz plik CSV (StatsBomb Squad STATS).");
      return;
    }
    try {
      const text = await file.text();
      const kind = detectStatsBombCsvKind(text);
      if (kind !== "squad") {
        toast.error("To nie wygląda na plik Squad STATS — użyj importu MatchStats powyżej.");
        return;
      }
      const parsed = parseStatsBombSquadStatsCsv(text);
      if (parsed.length === 0) {
        toast.error("Nie znaleziono zawodników w pliku.");
        return;
      }
      setSquadCsvText(text);
      setSquadFileName(file.name);
      saveStatsBombSquadCsvToStorage(text);
      setActiveTab("players");
      toast.success(`Wczytano ${parsed.length} zawodników ze Squad STATS.`);
    } catch (error) {
      toast.error(
        "Błąd parsowania CSV: " + (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      event.target.value = "";
    }
  }, []);

  const handleClearMatch = useCallback(() => {
    setMatchCsvText("");
    setMatchFileName("");
    clearStatsBombCsvFromStorage();
    toast.success("Usunięto plik meczów.");
  }, []);

  const handleClearSquad = useCallback(() => {
    setSquadCsvText("");
    setSquadFileName("");
    clearStatsBombSquadCsvFromStorage();
    toast.success("Usunięto plik składu.");
  }, []);

  const hasAnyData = matchRows.length > 0 || squadPlayers.length > 0;

  if (isLoading) {
    return <div className={styles.emptyState}>Ładowanie...</div>;
  }

  if (!user || !isAdmin) {
    return (
      <>
        <SidePanel
          players={[]}
          actions={[]}
          matchInfo={null}
          isAdmin={isAdmin}
          userRole={userRole}
          linkedPlayerId={linkedPlayerId}
          selectedTeam=""
          onRefreshData={async () => {}}
          onImportSuccess={() => {}}
          onImportError={() => {}}
          onLogout={logout}
        />
        <div className={styles.container}>
          <div className={styles.emptyState}>Brak dostępu. Strona tylko dla administratorów.</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SidePanel
        players={[]}
        actions={[]}
        matchInfo={null}
        isAdmin={isAdmin}
        userRole={userRole}
        linkedPlayerId={linkedPlayerId}
        selectedTeam=""
        onRefreshData={async () => {}}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1>StatsBomb</h1>
            <p>
              Importuj eksporty StatsBomb: Squad STATS (zawodnicy) oraz MatchStats (mecze).
              Analizuj profile indywidualne względem składu oraz korelacje zespołu z wynikiem meczu.
            </p>
          </div>
          <Link href="/admin" className={styles.backLink}>
            ← Panel administratora
          </Link>
        </div>

        <section className={styles.panel} aria-labelledby="statsbomb-upload-title">
          <h2 id="statsbomb-upload-title" className={styles.panelTitle}>
            Import CSV
          </h2>
          <div className={styles.uploadGrid}>
            <div className={styles.uploadBlock}>
              <h3 className={styles.uploadBlockTitle}>Squad STATS — dane indywidualne</h3>
              <div className={styles.uploadRow}>
                <input
                  id="statsbomb-squad-csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={handleSquadFileChange}
                  aria-label="Wybierz plik CSV StatsBomb Squad STATS"
                />
                {squadCsvText ? (
                  <button type="button" className={styles.clearButton} onClick={handleClearSquad}>
                    Usuń skład
                  </button>
                ) : null}
              </div>
              {squadPlayers.length > 0 ? (
                <div className={styles.meta}>
                  <span>
                    Plik: <strong>{squadFileName || "Squad CSV"}</strong>
                  </span>
                  <span>
                    Zawodnicy: <strong>{squadPlayers.length}</strong>
                  </span>
                  <span>
                    Metryki: <strong>{Object.keys(squadPlayers[0]?.numeric ?? {}).length}</strong>
                  </span>
                </div>
              ) : (
                <p className={styles.meta}>
                  Wgraj plik typu <strong>JagielloniaBiałystok-Squad STATS.csv</strong>.
                </p>
              )}
            </div>

            <div className={styles.uploadBlock}>
              <h3 className={styles.uploadBlockTitle}>MatchStats — dane zespołowe</h3>
              <div className={styles.uploadRow}>
                <input
                  id="statsbomb-csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={handleMatchFileChange}
                  aria-label="Wybierz plik CSV StatsBomb MatchStats"
                />
                {matchCsvText ? (
                  <button type="button" className={styles.clearButton} onClick={handleClearMatch}>
                    Usuń mecze
                  </button>
                ) : null}
              </div>
              {matchRows.length > 0 ? (
                <div className={styles.meta}>
                  <span>
                    Plik: <strong>{matchFileName || "Match CSV"}</strong>
                  </span>
                  <span>
                    Mecze: <strong>{matchRows.length}</strong>
                  </span>
                  {dateRange ? (
                    <span>
                      Zakres dat: <strong>{dateRange.from}</strong> – <strong>{dateRange.to}</strong>
                    </span>
                  ) : null}
                  <span>
                    Metryki liczbowe: <strong>{Object.keys(matchRows[0]?.numeric ?? {}).length}</strong>
                  </span>
                </div>
              ) : (
                <p className={styles.meta}>
                  Wgraj plik typu <strong>JagielloniaBiałystok-MatchStats.csv</strong>.
                </p>
              )}
            </div>
          </div>
        </section>

        {hasAnyData ? (
          <>
            <div className={styles.tabs} role="tablist" aria-label="Zakładki StatsBomb">
              {squadPlayers.length > 0 ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "players"}
                  className={`${styles.tab} ${activeTab === "players" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("players")}
                >
                  Dane indywidualne
                </button>
              ) : null}
              {matchRows.length > 0 ? (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "report"}
                    className={`${styles.tab} ${activeTab === "report" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("report")}
                  >
                    Raport zespołu
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "correlations"}
                    className={`${styles.tab} ${activeTab === "correlations" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("correlations")}
                  >
                    Korelacje
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "matches"}
                    className={`${styles.tab} ${activeTab === "matches" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("matches")}
                  >
                    Lista meczów
                  </button>
                </>
              ) : null}
            </div>

            {activeTab === "players" && squadPlayers.length > 0 ? (
              <section className={styles.panel} aria-labelledby="statsbomb-players-title">
                <h2 id="statsbomb-players-title" className={styles.panelTitle}>
                  Profile zawodników
                </h2>
                <StatsBombPlayerReportPanel
                  players={squadPlayers}
                  scopeHint={`Skład: ${squadPlayers.length} zawodników.`}
                />
              </section>
            ) : null}

            {activeTab === "report" && matchRows.length > 0 ? (
              <section className={styles.panel} aria-labelledby="statsbomb-report-title">
                <h2 id="statsbomb-report-title" className={styles.panelTitle}>
                  Raport zespołu
                </h2>
                <StatsBombTeamReportPanel
                  rows={matchRows}
                  squadPlayers={squadPlayers}
                  scopeHint={`Próba: ${matchRows.length} meczów.`}
                />
              </section>
            ) : null}

            {activeTab === "correlations" && matchRows.length > 0 ? (
              <section className={styles.panel} aria-labelledby="statsbomb-corr-title">
                <h2 id="statsbomb-corr-title" className={styles.panelTitle}>
                  Korelacje z wynikiem
                </h2>
                <StatsBombCorrelationPanel
                  rows={matchRows}
                  squadPlayers={squadPlayers}
                  scopeHint={`Próba: ${matchRows.length} meczów.`}
                />
              </section>
            ) : null}

            {activeTab === "matches" && matchRows.length > 0 ? (
              <section className={styles.panel} aria-labelledby="statsbomb-matches-title">
                <h2 id="statsbomb-matches-title" className={styles.panelTitle}>
                  Lista meczów ({matchRows.length})
                </h2>
                <StatsBombMatchesTab rows={matchRows} />
              </section>
            ) : null}
          </>
        ) : (
          <div className={styles.emptyState}>
            Brak danych — wgraj Squad STATS i/lub MatchStats CSV.
          </div>
        )}
      </div>
    </>
  );
}
