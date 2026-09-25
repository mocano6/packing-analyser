"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import type { Team } from "@/constants/teamsLoader";
import type { UserTeamAccess } from "@/lib/teamsForUserAccess";
import type { LnpCachedMatchMinutes } from "@/types/lnpPlayerLoad";
import type { LaczyTeamFixture, TrainingMicrocycleState } from "@/types/trainingMicrocycle";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import RefereeReportImportModal from "@/components/PlayerLoadTab/RefereeReportImportModal";
import { useLnpPlayerLoad } from "@/hooks/useLnpPlayerLoad";
import { parseLaczyTeamIdFromUrl, resolveLnpTeamPageUrl, writeStoredLnpTeamUrl } from "@/utils/laczyTeamUrl";
import {
  isFixtureHomeForTeam,
  mergeLaczyFixtures,
} from "@/utils/microcycleFixtures";
import {
  addPlayerLoadMerge,
  aggregatePlayerLoadMinutes,
  applyPlayerLoadRosterEdits,
  effectivePlayerLoadMerges,
  DEFAULT_PLAYER_LOAD_SORT,
  fixturesMissingMinutes,
  formatPlayerLoadName,
  hidePlayerLoadKey,
  LNP_MINUTES_FETCH_BATCH,
  loadBandForRow,
  mergeCachedMatchMinutes,
  nextPlayerLoadSort,
  opponentFromFixture,
  playedFixturesWithData,
  playerLoadMatchAppearances,
  playerLoadMinutesButtonLabel,
  removePlayerLoadMerge,
  restorePlayerLoadKey,
  sortPlayerLoadRows,
  summarizeLoadState,
  type LnpPlayerLoadRow,
  type PlayerLoadMatchAppearance,
  type PlayerLoadSort,
  type PlayerLoadSortKey,
} from "@/utils/lnpPlayerLoad";
import {
  attachKnownLnpIds,
  buildRefereeReportMatchId,
  isRefereeReportPdfMatchId,
  type RefereeReportMatch,
} from "@/utils/refereeReportPdf";
import styles from "./PlayerLoadTab.module.css";

interface PlayerLoadTabProps {
  uid: string;
  selectedTeam: string;
  onTeamChange: (teamId: string) => void;
  teamsCatalog: Team[];
  userTeamAccess: UserTeamAccess;
  microcycleState: TrainingMicrocycleState;
  setMicrocycleState: (
    updater: TrainingMicrocycleState | ((prev: TrainingMicrocycleState) => TrainingMicrocycleState)
  ) => void;
  microcycleLoading: boolean;
}

function formatMatchDate(dateTime: string): string {
  const t = new Date(dateTime);
  if (Number.isNaN(t.getTime())) return dateTime || "—";
  return t.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PlayerLoadTab({
  uid,
  selectedTeam,
  onTeamChange,
  teamsCatalog,
  userTeamAccess,
  microcycleState,
  setMicrocycleState,
  microcycleLoading,
}: PlayerLoadTabProps) {
  const { state, setLoadState, loading } = useLnpPlayerLoad(selectedTeam || null, uid);
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fixturesRefreshing, setFixturesRefreshing] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfReport, setPdfReport] = useState<RefereeReportMatch | null>(null);
  const [sort, setSort] = useState<PlayerLoadSort>(DEFAULT_PLAYER_LOAD_SORT);
  const [mergeSource, setMergeSource] = useState<LnpPlayerLoadRow | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const fixtures = microcycleState.lnpFixtures ?? [];
  const lnpTeamUrl = resolveLnpTeamPageUrl({
    lnpTeamUrl: microcycleState.lnpTeamUrl,
    lnpTeamId: microcycleState.lnpTeamId,
    lookballTeamId: selectedTeam,
  });
  const lnpTeamId =
    parseLaczyTeamIdFromUrl(lnpTeamUrl) ||
    microcycleState.lnpTeamId ||
    parseLaczyTeamIdFromUrl(microcycleState.lnpTeamUrl ?? "") ||
    "";
  const lnpTeamName = microcycleState.lnpTeamName ?? null;

  const selectedTeamName = useMemo(() => {
    const t = teamsCatalog.find((x) => x.id === selectedTeam);
    return t?.name ?? selectedTeam;
  }, [teamsCatalog, selectedTeam]);

  const rawRows = useMemo(() => aggregatePlayerLoadMinutes(state.matches), [state.matches]);
  const hiddenKeys = state.hiddenPlayerKeys ?? [];
  const manualMerges = state.playerMerges ?? [];
  const playerMerges = useMemo(
    () => effectivePlayerLoadMerges(rawRows, manualMerges),
    [rawRows, manualMerges]
  );
  const rows = useMemo(
    () => applyPlayerLoadRosterEdits(rawRows, hiddenKeys, manualMerges),
    [rawRows, hiddenKeys, manualMerges]
  );
  const hiddenRows = useMemo(() => {
    const hidden = new Set(hiddenKeys);
    return rawRows.filter((r) => hidden.has(r.key));
  }, [rawRows, hiddenKeys]);
  const mergeLabels = useMemo(() => {
    const byKey = new Map(rawRows.map((r) => [r.key, r]));
    return manualMerges
      .map((m) => {
        const source = byKey.get(m.sourceKey);
        const target = byKey.get(m.targetKey);
        if (!source || !target) return null;
        return { sourceKey: m.sourceKey, source, target };
      })
      .filter((x): x is { sourceKey: string; source: LnpPlayerLoadRow; target: LnpPlayerLoadRow } => x != null);
  }, [manualMerges, rawRows]);
  const sortedRows = useMemo(() => sortPlayerLoadRows(rows, sort), [rows, sort]);
  const onSort = useCallback((key: PlayerLoadSortKey) => {
    setSort((prev) => nextPlayerLoadSort(prev, key));
  }, []);
  const summary = useMemo(
    () => summarizeLoadState(state, fixtures),
    [state, fixtures]
  );
  const played = useMemo(() => playedFixturesWithData(fixtures), [fixtures]);
  const missing = useMemo(
    () => fixturesMissingMinutes(fixtures, state.matches),
    [fixtures, state.matches]
  );

  const matchesWithSquad = useMemo(
    () => state.matches.filter((m) => m.hasSquad).sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
    [state.matches]
  );

  const fixturesFetchedAt = microcycleState.lnpFixturesFetchedAt ?? null;

  const ensureFixtures = useCallback(async (options?: {
    force?: boolean;
    toastId?: string;
  }): Promise<{
    fixtures: LaczyTeamFixture[];
    teamId: string;
  } | null> => {
    const force = options?.force === true;
    const existing = microcycleState.lnpFixtures ?? [];
    const url = resolveLnpTeamPageUrl({
      lnpTeamUrl: microcycleState.lnpTeamUrl,
      lnpTeamId: microcycleState.lnpTeamId,
      lookballTeamId: selectedTeam,
    });
    const teamId = parseLaczyTeamIdFromUrl(url) || microcycleState.lnpTeamId || "";
    if (!force && existing.length > 0 && teamId) {
      return { fixtures: existing, teamId };
    }
    if (!teamId) {
      toast.error("W zakładce Mikrocykl wklej link do drużyny ŁNP (to samo pole terminarza) i zapisz.");
      return null;
    }
    const hadSaved = existing.length > 0;
    const tid =
      options?.toastId ??
      toast.loading(
        hadSaved ? "Odświeżanie terminarza z ŁNP…" : "Pobieranie terminarza z Łączy Nas Piłka…"
      );
    try {
      const res = await fetch("/api/microcycle/team-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url || teamId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        teamId?: string;
        teamName?: string;
        fixtures?: LaczyTeamFixture[];
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "Błąd pobierania terminarza.");
      }
      const incoming = Array.isArray(data.fixtures) ? data.fixtures : [];
      const resolvedTeamId = (data.teamId || teamId).toLowerCase();
      const fetchedAt = new Date().toISOString();
      let merged: LaczyTeamFixture[] = [];
      if (selectedTeam) writeStoredLnpTeamUrl(selectedTeam, url);
      setMicrocycleState((prev) => {
        const prevId = (
          prev.lnpTeamId ||
          parseLaczyTeamIdFromUrl(prev.lnpTeamUrl ?? "") ||
          ""
        ).toLowerCase();
        const sameTeam = !prevId || prevId === resolvedTeamId;
        merged = sameTeam
          ? mergeLaczyFixtures(prev.lnpFixtures ?? [], incoming)
          : [...incoming].sort((a, b) => a.dateTime.localeCompare(b.dateTime));
        return {
          ...prev,
          lnpTeamUrl: url,
          lnpTeamId: resolvedTeamId,
          lnpTeamName: data.teamName || prev.lnpTeamName || null,
          lnpFixtures: merged,
          lnpFixturesFetchedAt: fetchedAt,
        };
      });
      if (!options?.toastId) {
        toast.success(
          hadSaved
            ? `Terminarz odświeżony · ${merged.length} mecz(y).`
            : data.message || `Zapisano ${merged.length} meczów.`,
          { id: tid }
        );
      }
      return { fixtures: merged, teamId: resolvedTeamId };
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd pobierania terminarza.", { id: tid });
      return null;
    }
  }, [lnpTeamUrl, microcycleState.lnpFixtures, microcycleState.lnpTeamId, microcycleState.lnpTeamUrl, selectedTeam, setMicrocycleState]);

  const applyFetchedMinutes = useCallback(
    (incoming: LnpCachedMatchMinutes[], teamId: string) => {
      setLoadState((prev) => ({
        ...prev,
        matches: mergeCachedMatchMinutes(prev.matches, incoming),
        fetchedAt: new Date().toISOString(),
        lnpTeamId: teamId,
      }));
    },
    [setLoadState]
  );

  const pullMissingMinutes = useCallback(
    async (
      fixtureList: LaczyTeamFixture[],
      teamId: string,
      toastId?: string
    ): Promise<void> => {
      const toFetch = fixturesMissingMinutes(fixtureList, state.matches).slice(
        0,
        LNP_MINUTES_FETCH_BATCH
      );
      if (toFetch.length === 0) {
        toast.success("Terminarz odświeżony — brak nowych meczów bez minut.", toastId ? { id: toastId } : undefined);
        return;
      }
      const minutesTid =
        toastId ??
        toast.loading(`Pobieranie minut z ${toFetch.length} mecz(y)… (sesja Chrome / reCAPTCHA)`);
      if (toastId) {
        toast.loading(
          `Pobieranie minut z ${toFetch.length} mecz(y)… (sesja Chrome / reCAPTCHA)`,
          { id: toastId }
        );
      }
      const res = await fetch("/api/microcycle/played-match-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          matches: toFetch.map((f) => ({
            matchId: f.matchId,
            dateTime: f.dateTime,
            opponent: opponentFromFixture(f, teamId),
            isHome: isFixtureHomeForTeam(f, teamId),
            playName: f.playName,
            scoreFinal: f.scoreFinal ?? null,
            hostId: f.hostId,
            guestId: f.guestId,
            hostName: f.hostName,
            guestName: f.guestName,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        matches?: LnpCachedMatchMinutes[];
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || data.message || "Błąd pobierania minut.");
      }
      const incoming = Array.isArray(data.matches) ? data.matches : [];
      applyFetchedMinutes(incoming, teamId);
      const left = fixturesMissingMinutes(fixtureList, [
        ...state.matches,
        ...incoming,
      ]).length;
      toast.success(
        `${data.message || "Pobrano minuty."}${left > 0 ? ` Zostało ${left} — kliknij ponownie.` : ""}`,
        { id: minutesTid }
      );
    },
    [applyFetchedMinutes, state.matches]
  );

  const refreshFixtures = useCallback(async () => {
    setFixturesRefreshing(true);
    const tid = toast.loading("Odświeżanie terminarza z ŁNP…");
    try {
      const ready = await ensureFixtures({ force: true, toastId: tid });
      if (!ready) return;
      const missingNow = fixturesMissingMinutes(ready.fixtures, state.matches);
      if (missingNow.length === 0) {
        toast.success(
          `Terminarz odświeżony · ${ready.fixtures.length} mecz(y). Brak nowych bez minut.`,
          { id: tid }
        );
        return;
      }
      setFetching(true);
      await pullMissingMinutes(ready.fixtures, ready.teamId, tid);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd odświeżania terminarza.", { id: tid });
    } finally {
      setFixturesRefreshing(false);
      setFetching(false);
    }
  }, [ensureFixtures, pullMissingMinutes, state.matches]);

  const fetchMinutes = useCallback(async () => {
    setFetching(true);
    const tid = toast.loading("Sprawdzam terminarz i minuty w ŁNP…");
    try {
      setFixturesRefreshing(true);
      const ready = await ensureFixtures({ force: true, toastId: tid });
      setFixturesRefreshing(false);
      if (!ready) return;
      await pullMissingMinutes(ready.fixtures, ready.teamId, tid);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd pobierania minut.", { id: tid });
    } finally {
      setFixturesRefreshing(false);
      setFetching(false);
    }
  }, [ensureFixtures, pullMissingMinutes]);

  const ourTeamNames = useMemo(
    () => [selectedTeamName, lnpTeamName ?? ""].filter(Boolean),
    [selectedTeamName, lnpTeamName]
  );

  const existingPdfMatch = useMemo(() => {
    if (!pdfReport) return null;
    const id = buildRefereeReportMatchId(pdfReport.date, pdfReport.hostName, pdfReport.guestName);
    return state.matches.find((m) => m.matchId === id) ?? null;
  }, [pdfReport, state.matches]);

  const onPdfFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setParsingPdf(true);
    const tid = toast.loading("Odczyt sprawozdania PDF…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/microcycle/parse-referee-report", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        report?: RefereeReportMatch;
      };
      if (!res.ok || !data.report) {
        throw new Error(data.error || "Nie udało się odczytać PDF.");
      }
      setPdfReport(data.report);
      toast.success("Odczytano składy. Sprawdź minuty i zapisz.", { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd odczytu PDF.", { id: tid });
    } finally {
      setParsingPdf(false);
    }
  }, []);

  const confirmPdfMatch = useCallback(
    (match: LnpCachedMatchMinutes) => {
      setLoadState((prev) => {
        const known = prev.matches.flatMap((m) => m.players);
        const withIds = { ...match, players: attachKnownLnpIds(match.players, known) };
        return {
          ...prev,
          matches: mergeCachedMatchMinutes(prev.matches, [withIds]),
          fetchedAt: new Date().toISOString(),
        };
      });
      setPdfReport(null);
      toast.success(
        `Zapisano ${match.players.length} zawodników z PDF (${match.isHome ? "dom" : "wyjazd"} vs ${match.opponent}).`
      );
    },
    [setLoadState]
  );

  const hideRow = useCallback(
    (key: string, name: string) => {
      setLoadState((prev) => ({
        ...prev,
        hiddenPlayerKeys: hidePlayerLoadKey(prev.hiddenPlayerKeys ?? [], key),
      }));
      toast.success(`Ukryto ${name}. Przywrócisz pod tabelą.`);
    },
    [setLoadState]
  );

  const restoreRow = useCallback(
    (key: string) => {
      setLoadState((prev) => ({
        ...prev,
        hiddenPlayerKeys: restorePlayerLoadKey(prev.hiddenPlayerKeys ?? [], key),
      }));
    },
    [setLoadState]
  );

  const confirmMerge = useCallback(
    (sourceKey: string, targetKey: string) => {
      setLoadState((prev) => ({
        ...prev,
        playerMerges: addPlayerLoadMerge(prev.playerMerges ?? [], sourceKey, targetKey),
        hiddenPlayerKeys: restorePlayerLoadKey(prev.hiddenPlayerKeys ?? [], sourceKey),
      }));
      setMergeSource(null);
      toast.success("Połączono wiersze. Minuty są zsumowane.");
    },
    [setLoadState]
  );

  const unmergeSource = useCallback(
    (sourceKey: string) => {
      setLoadState((prev) => ({
        ...prev,
        playerMerges: removePlayerLoadMerge(prev.playerMerges ?? [], sourceKey),
      }));
    },
    [setLoadState]
  );

  if (microcycleLoading || loading) {
    return (
      <div className={styles.loadingBox} role="status">
        Ładowanie kontroli obciążeń…
      </div>
    );
  }

  if (!selectedTeam) {
    return (
      <div className={styles.loadingBox} role="status">
        Wybierz zespół, aby zobaczyć minuty meczowe.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.teamToolbar}>
        <span className={styles.teamToolbarLabel}>Zespół</span>
        <TeamsSelector
          selectedTeam={selectedTeam}
          onChange={onTeamChange}
          teamsCatalog={teamsCatalog}
          userTeamAccess={userTeamAccess}
          isExpanded={isTeamsSelectorExpanded}
          onToggle={() => setIsTeamsSelectorExpanded((v) => !v)}
        />
        <p className={styles.teamToolbarHint}>
          Minuty z rozegranych meczów Łączy Nas Piłka — kontrola obciążeń kadry{" "}
          <strong>{selectedTeamName}</strong>
          {lnpTeamName ? ` (${lnpTeamName})` : ""}.
        </p>
      </div>

      <section className={styles.panel} aria-labelledby="player-load-heading">
        <div className={styles.panelHead}>
          <div>
            <h2 id="player-load-heading" className={styles.title}>
              Minuty meczowe
            </h2>
            <p className={styles.hint}>
              Okna 3 i 7 dni liczone wstecz od teraz. Terminarz i minuty biorą link z zakładki Mikrocykl
              (pole ŁNP). Walkowery pomijamy. Puchar regionalny wgrywamy jako PDF. Duplikaty łącz Scal.
            </p>
            {lnpTeamUrl ? (
              <p className={styles.lnpUrlUsed}>
                Link: <span>{lnpTeamUrl}</span>
              </p>
            ) : null}
          </div>
          <div className={styles.panelHeadActions}>
            <input
              id="referee-report-pdf"
              ref={pdfInputRef}
              className={styles.fileInput}
              type="file"
              accept="application/pdf,.pdf"
              disabled={parsingPdf}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void onPdfFile(file);
              }}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={parsingPdf || fixturesRefreshing || fetching}
              onClick={() => pdfInputRef.current?.click()}
            >
              {parsingPdf ? "Odczytuję PDF…" : "Wgraj sprawozdanie PDF"}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => void refreshFixtures()}
              disabled={
                fixturesRefreshing || fetching || parsingPdf || (!lnpTeamUrl && !lnpTeamId)
              }
              aria-label="Odśwież terminarz meczów z Łączy Nas Piłka"
            >
              {fixturesRefreshing && !fetching ? "Odświeżam terminarz…" : "Odśwież terminarz"}
            </button>
            <button
              type="button"
              className={styles.fetchBtn}
              onClick={() => void fetchMinutes()}
              disabled={fetching || parsingPdf || (!lnpTeamUrl && !lnpTeamId)}
            >
              {playerLoadMinutesButtonLabel({
                fetching,
                missingCount: missing.length,
                playedCount: played.length,
                batch: LNP_MINUTES_FETCH_BATCH,
              })}
            </button>
          </div>
        </div>

        {!lnpTeamUrl && !lnpTeamId && (
          <p className={styles.warn} role="status">
            Brak linku do drużyny ŁNP. Wejdź w zakładkę Mikrocykl, wklej adres
            rozgrywki/drużyna/… i pobierz terminarz — albo użyj „Odśwież terminarz” tutaj, gdy link
            już jest zapisany.
          </p>
        )}

        <dl className={styles.stats} aria-label="Podsumowanie pobranych meczów">
          <div>
            <dt>Rozegrane w terminarzu</dt>
            <dd>{summary.played}</dd>
          </div>
          <div>
            <dt>Ze składem</dt>
            <dd>{summary.withSquad}</dd>
          </div>
          <div>
            <dt>Do pobrania</dt>
            <dd>{summary.missing}</dd>
          </div>
          <div>
            <dt>Terminarz z ŁNP</dt>
            <dd>{formatFetchedAt(fixturesFetchedAt) || "—"}</dd>
          </div>
          <div>
            <dt>Ostatnie minuty</dt>
            <dd>{formatFetchedAt(state.fetchedAt) || "—"}</dd>
          </div>
        </dl>

        {rows.length === 0 ? (
          <p className={styles.empty} role="status">
            {played.length === 0
              ? "Brak rozegranych meczów z danymi w terminarzu ŁNP. Puchar spoza ŁNP wgraj jako PDF sprawozdania."
              : "Nie pobrano jeszcze minut. Kliknij „Pobierz minuty” albo wgraj sprawozdanie PDF."}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Minuty zawodników: ogółem, ostatnie 7 dni i ostatnie 3 dni
              </caption>
              <colgroup>
                <col className={styles.colName} />
                <col className={styles.colNum} />
                <col className={styles.colNum} />
                <col className={styles.colNum} />
                <col className={styles.colWide} />
                <col className={styles.colWide} />
                <col className={styles.colActions} />
              </colgroup>
              <thead>
                <tr>
                  <SortableLoadTh
                    label="Zawodnik"
                    sortKey="name"
                    sort={sort}
                    onSort={onSort}
                    numeric={false}
                  />
                  <SortableLoadTh label="Nr" sortKey="number" sort={sort} onSort={onSort} />
                  <SortableLoadTh label="Mecze" sortKey="matches" sort={sort} onSort={onSort} />
                  <SortableLoadTh label="Ogółem" sortKey="total" sort={sort} onSort={onSort} />
                  <SortableLoadTh label="7 dni" sortKey="last7" sort={sort} onSort={onSort} />
                  <SortableLoadTh label="3 dni" sortKey="last3" sort={sort} onSort={onSort} />
                  <th scope="col" className={styles.actionsHead}>
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <PlayerLoadRowView
                    key={row.key}
                    row={row}
                    appearances={playerLoadMatchAppearances(state.matches, row.key, playerMerges)}
                    canMerge={sortedRows.length > 1}
                    onMerge={() => setMergeSource(row)}
                    onHide={() => hideRow(row.key, formatPlayerLoadName(row))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(hiddenRows.length > 0 || mergeLabels.length > 0) && (
          <div className={styles.rosterEdits}>
            {mergeLabels.length > 0 ? (
              <div>
                <p className={styles.rosterEditsTitle}>Połączenia</p>
                <ul className={styles.rosterEditsList}>
                  {mergeLabels.map((m) => (
                    <li key={m.sourceKey}>
                      <span>
                        {formatPlayerLoadName(m.source)}
                        {m.source.number ? ` nr ${m.source.number}` : ""} → {formatPlayerLoadName(m.target)}
                        {m.target.number ? ` nr ${m.target.number}` : ""}
                      </span>
                      <button
                        type="button"
                        className={styles.rowBtn}
                        onClick={() => unmergeSource(m.sourceKey)}
                      >
                        Rozłącz
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hiddenRows.length > 0 ? (
              <div>
                <p className={styles.rosterEditsTitle}>Ukryci zawodnicy</p>
                <ul className={styles.rosterEditsList}>
                  {hiddenRows.map((row) => (
                    <li key={row.key}>
                      <span>
                        {formatPlayerLoadName(row)}
                        {row.number ? ` nr ${row.number}` : ""}
                      </span>
                      <button type="button" className={styles.rowBtn} onClick={() => restoreRow(row.key)}>
                        Przywróć
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {matchesWithSquad.length > 0 && (
          <details className={styles.matchesDetails}>
            <summary>Mecze ze składem ({matchesWithSquad.length})</summary>
            <ul className={styles.matchList}>
              {matchesWithSquad.map((m) => (
                <li key={m.matchId}>
                  <span className={styles.matchDate}>{formatMatchDate(m.dateTime)}</span>
                  {isRefereeReportPdfMatchId(m.matchId) ? (
                    <span className={styles.pdfBadge}>PDF</span>
                  ) : null}
                  <span>
                    {m.isHome ? "vs" : "@"} {m.opponent || "Rywal"}
                    {m.scoreFinal ? ` ${m.scoreFinal}` : ""}
                  </span>
                  <span className={styles.matchMins}>
                    {m.players.reduce((s, p) => s + p.minutesPlayed, 0)}′ łącznie
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {pdfReport ? (
        <RefereeReportImportModal
          report={pdfReport}
          ourTeamNames={ourTeamNames}
          existingMatch={existingPdfMatch}
          onConfirm={(match) => confirmPdfMatch(match)}
          onClose={() => setPdfReport(null)}
        />
      ) : null}
      {mergeSource ? (
        <MergePlayerLoadModal
          source={mergeSource}
          targets={sortedRows.filter((r) => r.key !== mergeSource.key)}
          onConfirm={confirmMerge}
          onClose={() => setMergeSource(null)}
        />
      ) : null}
    </div>
  );
}

function SortableLoadTh({
  label,
  sortKey,
  sort,
  onSort,
  numeric = true,
}: {
  label: string;
  sortKey: PlayerLoadSortKey;
  sort: PlayerLoadSort;
  onSort: (key: PlayerLoadSortKey) => void;
  numeric?: boolean;
}) {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" className={numeric ? styles.num : undefined} aria-sort={ariaSort}>
      <button
        type="button"
        className={styles.sortBtn}
        onClick={() => onSort(sortKey)}
        aria-label={`Sortuj według: ${label}`}
      >
        {label}
        <span className={styles.sortMark} aria-hidden>
          {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

function PlayerLoadRowView({
  row,
  appearances,
  canMerge,
  onMerge,
  onHide,
}: {
  row: LnpPlayerLoadRow;
  appearances: PlayerLoadMatchAppearance[];
  canMerge: boolean;
  onMerge: () => void;
  onHide: () => void;
}) {
  const band = loadBandForRow(row);
  const name = formatPlayerLoadName(row);
  const canExpand = appearances.length > 0;

  return (
    <tr data-band={band}>
      <th scope="row" className={styles.nameCell}>
        {canExpand ? (
          <details className={styles.playerDetails}>
            <summary className={styles.playerSummary} aria-label={`Mecze i minuty: ${name}`}>
              <span className={styles.nameText}>{name}</span>
            </summary>
            <ul className={styles.playerMatchList}>
              {appearances.map((m) => (
                <li key={m.matchId}>
                  <span className={styles.playerMatchDate}>{formatMatchDate(m.dateTime)}</span>
                  {isRefereeReportPdfMatchId(m.matchId) ? (
                    <span className={styles.playerMatchPdf}>PDF</span>
                  ) : null}
                  <span className={styles.playerMatchOpp}>
                    {m.isHome ? "vs" : "@"} {m.opponent}
                    {m.scoreFinal ? ` ${m.scoreFinal}` : ""}
                  </span>
                  <span className={styles.playerMatchMins}>{m.minutesPlayed}′</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <span className={styles.nameText}>{name}</span>
        )}
      </th>
      <td className={styles.num}>{row.number || "—"}</td>
      <td className={styles.num}>{row.matchesPlayed}</td>
      <td className={styles.num}>{row.totalMinutes}</td>
      <td className={styles.num}>
        {row.last7Days}
        {row.matchesLast7 > 0 ? (
          <span className={styles.sub}>/{row.matchesLast7}</span>
        ) : null}
      </td>
      <td className={`${styles.num} ${styles.accent}`}>
        {row.last3Days}
        {row.matchesLast3 > 0 ? (
          <span className={styles.sub}>/{row.matchesLast3}</span>
        ) : null}
      </td>
      <td className={styles.actions}>
        {canMerge ? (
          <button
            type="button"
            className={styles.rowBtn}
            onClick={onMerge}
            aria-label={`Połącz ${name} z innym zawodnikiem`}
          >
            Scal
          </button>
        ) : null}
        <button
          type="button"
          className={styles.rowBtnDanger}
          onClick={onHide}
          aria-label={`Usuń ${name} z tabeli obciążeń`}
        >
          Usuń
        </button>
      </td>
    </tr>
  );
}

function formatMergeOption(row: LnpPlayerLoadRow): string {
  const name = formatPlayerLoadName(row);
  return row.number ? `${name} · nr ${row.number}` : name;
}

function MergePlayerLoadModal({
  source,
  targets,
  onConfirm,
  onClose,
}: {
  source: LnpPlayerLoadRow;
  targets: LnpPlayerLoadRow[];
  onConfirm: (sourceKey: string, targetKey: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const selectId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const sortedTargets = useMemo(
    () => [...targets].sort((a, b) => formatPlayerLoadName(a).localeCompare(formatPlayerLoadName(b), "pl")),
    [targets]
  );
  const [targetKey, setTargetKey] = useState(() => sortedTargets[0]?.key ?? "");

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = Boolean(targetKey) && targetKey !== source.key;

  return (
    <div className={styles.modalOverlay} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className={styles.modalTitle}>
          Połącz zawodnika
        </h3>
        <p className={styles.modalHint}>
          {formatMergeOption(source)} zniknie z tabeli. Minuty doliczymy do wybranego wiersza (jego nazwisko i
          numer zostaną).
        </p>
        {sortedTargets.length === 0 ? (
          <p className={styles.modalHint}>Brak innych zawodników do połączenia.</p>
        ) : (
          <label className={styles.mergeSelectLabel} htmlFor={selectId}>
            Połącz z
            <select
              id={selectId}
              className={styles.mergeSelect}
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
            >
              {sortedTargets.map((row) => (
                <option key={row.key} value={row.key}>
                  {formatMergeOption(row)} · {row.totalMinutes}′
                </option>
              ))}
            </select>
          </label>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className={styles.fetchBtn}
            disabled={!canSubmit}
            onClick={() => onConfirm(source.key, targetKey)}
          >
            Połącz
          </button>
        </div>
      </div>
    </div>
  );
}
