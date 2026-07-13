"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import SidePanel from "@/components/SidePanel/SidePanel";
import StatsBombCorrelationPanel from "@/components/StatsBombCorrelationPanel/StatsBombCorrelationPanel";
import StatsBombPlayerReportPanel from "@/components/StatsBombPlayerReportPanel/StatsBombPlayerReportPanel";
import StatsBombPlayerScoutingPanel from "@/components/StatsBombPlayerScoutingPanel/StatsBombPlayerScoutingPanel";
import StatsBombTeamReportPanel from "@/components/StatsBombTeamReportPanel/StatsBombTeamReportPanel";
import StatsBombMatchesTab from "@/components/StatsBombMatchesTab/StatsBombMatchesTab";
import {
  clearStatsBombCsvFromStorage,
  clearStatsBombScoutCsvFromStorage,
  clearStatsBombSquadCsvFromStorage,
  detectStatsBombCsvKind,
  loadStatsBombCsvFromStorage,
  loadStatsBombScoutCsvFromStorage,
  loadStatsBombSquadCsvFromStorage,
  parseStatsBombMatchStatsCsv,
  parseStatsBombPlayerScoutCsv,
  parseStatsBombSquadStatsCsv,
  saveStatsBombCsvToStorage,
  saveStatsBombScoutCsvToStorage,
  saveStatsBombSquadCsvToStorage,
  type StatsBombMatchRow,
  type StatsBombScoutPlayerRow,
  type StatsBombSquadPlayerRow,
} from "@/utils/statsbombCsvParser";
import styles from "./statsbomb.module.css";

type MainTabId = "scouting" | "team";
type TeamTabId = "players" | "report" | "correlations" | "matches";

export default function AdminStatsBombPage() {
  const { user, isAdmin, isLoading, userRole, linkedPlayerId, logout } = useAuth();
  const [matchCsvText, setMatchCsvText] = useState<string>("");
  const [matchFileName, setMatchFileName] = useState<string>("");
  const [squadCsvText, setSquadCsvText] = useState<string>("");
  const [squadFileName, setSquadFileName] = useState<string>("");
  const [scoutCsvText, setScoutCsvText] = useState<string>("");
  const [scoutFileName, setScoutFileName] = useState<string>("");
  const [scoutPlayers, setScoutPlayers] = useState<StatsBombScoutPlayerRow[]>([]);
  const [isParsingScout, setIsParsingScout] = useState(false);
  const [mainTab, setMainTab] = useState<MainTabId>("scouting");
  const [teamTab, setTeamTab] = useState<TeamTabId>("players");

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
    const savedScout = loadStatsBombScoutCsvFromStorage();
    if (savedScout) {
      setScoutCsvText(savedScout);
      setScoutFileName("Zapisany lokalnie (PlayerScout)");
    }
  }, []);

  useEffect(() => {
    if (squadCsvText.trim()) {
      setTeamTab((prev) =>
        (prev === "report" || prev === "correlations" || prev === "matches") && !matchCsvText.trim()
          ? "players"
          : prev,
      );
    } else if (matchCsvText.trim()) {
      setTeamTab((prev) => (prev === "players" ? "report" : prev));
    }
  }, [matchCsvText, squadCsvText]);

  useEffect(() => {
    if (!scoutCsvText.trim()) {
      setScoutPlayers([]);
      setIsParsingScout(false);
      return;
    }

    setIsParsingScout(true);
    const timer = window.setTimeout(() => {
      try {
        const parsed = parseStatsBombPlayerScoutCsv(scoutCsvText);
        setScoutPlayers(parsed);
      } catch (error) {
        setScoutPlayers([]);
        toast.error(
          "Błąd parsowania PlayerScout: " +
            (error instanceof Error ? error.message : String(error)),
        );
      } finally {
        setIsParsingScout(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [scoutCsvText]);

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
      setMainTab("team");
      setTeamTab("report");
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
        toast.error("To nie wygląda na plik Squad STATS — użyj importu MatchStats lub PlayerScout.");
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
      setMainTab("team");
      setTeamTab("players");
      toast.success(`Wczytano ${parsed.length} zawodników ze Squad STATS.`);
    } catch (error) {
      toast.error(
        "Błąd parsowania CSV: " + (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      event.target.value = "";
    }
  }, []);

  const handleScoutFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Wybierz plik CSV (PlayerScout).");
      return;
    }
    try {
      const text = await file.text();
      const kind = detectStatsBombCsvKind(text);
      if (kind !== "scout") {
        toast.error(
          "To nie wygląda na plik PlayerScout — nagłówek musi zawierać kolumny Player i Current Team.",
        );
        return;
      }
      const parsed = parseStatsBombPlayerScoutCsv(text);
      if (parsed.length === 0) {
        toast.error("Nie znaleziono kandydatów w pliku.");
        return;
      }
      setScoutCsvText(text);
      setScoutFileName(file.name);
      try {
        saveStatsBombScoutCsvToStorage(text);
      } catch {
        toast.error(
          "Plik wczytany, ale nie udało się zapisać w przeglądarce (limit pamięci). Po odświeżeniu wgraj ponownie.",
        );
      }
      setMainTab("scouting");
      toast.success(`Wczytano ${parsed.length} kandydatów z PlayerScout.`);
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

  const handleClearScout = useCallback(() => {
    setScoutCsvText("");
    setScoutFileName("");
    clearStatsBombScoutCsvFromStorage();
    toast.success("Usunięto plik PlayerScout.");
  }, []);

  const hasTeamData = matchRows.length > 0 || squadPlayers.length > 0;

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
              Scouting kandydatów (PlayerScout) oraz analiza własnego zespołu (Squad STATS +
              MatchStats): profile, korelacje i rozkłady median.
            </p>
          </div>
          <Link href="/admin" className={styles.backLink}>
            ← Panel administratora
          </Link>
        </div>

        <div className={styles.mainTabs} role="tablist" aria-label="Główne sekcje StatsBomb">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "scouting"}
            className={`${styles.mainTab} ${mainTab === "scouting" ? styles.mainTabActive : ""}`}
            onClick={() => setMainTab("scouting")}
          >
            Scouting
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "team"}
            className={`${styles.mainTab} ${mainTab === "team" ? styles.mainTabActive : ""}`}
            onClick={() => setMainTab("team")}
          >
            Analiza zespołu
          </button>
        </div>

        {mainTab === "scouting" ? (
          <>
            <section className={styles.panel} aria-labelledby="statsbomb-scout-upload-title">
              <h2 id="statsbomb-scout-upload-title" className={styles.panelTitle}>
                Import PlayerScout CSV
              </h2>
              <p className={styles.scoutIntro}>
                Lista kandydatów spoza własnego składu — np. eksport{" "}
                <strong>PlayerScout number 6.csv</strong>. Porównanie odbywa się wyłącznie w obrębie
                wczytanych zawodników, nie względem składu Jagielloni.
              </p>
              <div className={styles.uploadRow}>
                <input
                  id="statsbomb-scout-csv-upload"
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={handleScoutFileChange}
                  aria-label="Wybierz plik CSV PlayerScout"
                />
                {scoutCsvText ? (
                  <button type="button" className={styles.clearButton} onClick={handleClearScout}>
                    Usuń PlayerScout
                  </button>
                ) : null}
              </div>
              {scoutPlayers.length > 0 ? (
                <div className={styles.meta}>
                  <span>
                    Plik: <strong>{scoutFileName || "PlayerScout CSV"}</strong>
                  </span>
                  <span>
                    Kandydaci: <strong>{scoutPlayers.length}</strong>
                  </span>
                  <span>
                    Kluby:{" "}
                    <strong>
                      {new Set(scoutPlayers.map((p) => p.currentTeam).filter(Boolean)).size}
                    </strong>
                  </span>
                  <span>
                    Metryki: <strong>{Object.keys(scoutPlayers[0]?.numeric ?? {}).length}</strong>
                  </span>
                </div>
              ) : isParsingScout ? (
                <p className={styles.meta}>Wczytywanie i parsowanie pliku PlayerScout…</p>
              ) : (
                <p className={styles.meta}>
                  Wgraj plik z kolumnami <strong>Player</strong> i <strong>Current Team</strong>.
                </p>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="statsbomb-scouting-title">
              <h2 id="statsbomb-scouting-title" className={styles.panelTitle}>
                Profil scoutingowy — defensywny pomocnik (6)
              </h2>
              <StatsBombPlayerScoutingPanel players={scoutPlayers} matchRows={matchRows} />
            </section>
          </>
        ) : (
          <>
            <section className={styles.panel} aria-labelledby="statsbomb-upload-title">
              <h2 id="statsbomb-upload-title" className={styles.panelTitle}>
                Import CSV — własny zespół
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
                        Metryki liczbowe:{" "}
                        <strong>{Object.keys(matchRows[0]?.numeric ?? {}).length}</strong>
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

            {hasTeamData ? (
              <>
                <div className={styles.tabs} role="tablist" aria-label="Zakładki analizy zespołu">
                  {squadPlayers.length > 0 ? (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={teamTab === "players"}
                      className={`${styles.tab} ${teamTab === "players" ? styles.tabActive : ""}`}
                      onClick={() => setTeamTab("players")}
                    >
                      Dane indywidualne
                    </button>
                  ) : null}
                  {matchRows.length > 0 ? (
                    <>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={teamTab === "report"}
                        className={`${styles.tab} ${teamTab === "report" ? styles.tabActive : ""}`}
                        onClick={() => setTeamTab("report")}
                      >
                        Raport zespołu
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={teamTab === "correlations"}
                        className={`${styles.tab} ${teamTab === "correlations" ? styles.tabActive : ""}`}
                        onClick={() => setTeamTab("correlations")}
                      >
                        Korelacje
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={teamTab === "matches"}
                        className={`${styles.tab} ${teamTab === "matches" ? styles.tabActive : ""}`}
                        onClick={() => setTeamTab("matches")}
                      >
                        Lista meczów
                      </button>
                    </>
                  ) : null}
                </div>

                {teamTab === "players" && squadPlayers.length > 0 ? (
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

                {teamTab === "report" && matchRows.length > 0 ? (
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

                {teamTab === "correlations" && matchRows.length > 0 ? (
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

                {teamTab === "matches" && matchRows.length > 0 ? (
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
                Brak danych zespołowych — wgraj Squad STATS i/lub MatchStats CSV.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
