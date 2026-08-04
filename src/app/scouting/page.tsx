'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import SidePanel from '@/components/SidePanel/SidePanel';
import ScoutingDebugModal from '@/components/ScoutingDebugModal/ScoutingDebugModal';
import { useAuth } from '@/hooks/useAuth';
import { canAccessScouting } from '@/lib/userRoles';
import { appendClientApiLog } from '@/lib/scouting/clientDebug';
import { resolvePlayerDisplayName } from '@/lib/scouting/playerNames';
import { accumulatePlayerMatchStat, emptyPlayerMatchAgg, formatPlayerCards } from '@/lib/scouting/playerAgg';
import { resolvePlayerSeasonProfile } from '@/lib/scouting/playerProfile';
import {
  countMatchesWithPlayerStats,
  countWalkoverMatches,
  isLeagueEventsComplete,
  isWalkoverMatchState,
  isPlayedMatchState,
} from '@/lib/scouting/matchStates';
import {
  restoreCompetitionsForSex,
  saveCompetitionsFetch,
  saveCompetitionsSelection,
  getCachedLeagueGroups,
  findLeagueGroupIdInCache,
  pushCompetitionsToServer,
  loadScoutingCompetitionsStore,
  allLeagueIdsFromGroups,
} from '@/lib/scouting/competitionsCache';
import {
  leagueKey,
  type ScoutingState,
  type ScoutingSeason,
  type ScoutingLeagueGroup,
  type ScoutingConfig,
  type ScoutingSyncResult,
  type ScoutingLeagueData,
  type ScoutedMatch,
  type ScoutingDebugLog,
  type ScoutingPlayerInfo,
  type Sex,
} from '@/types/scouting';
import styles from './page.module.css';

interface CompetitionsResponse {
  seasons: ScoutingSeason[];
  leagueGroups: ScoutingLeagueGroup[];
  selectedSeasonId: string | null;
  debugLog?: ScoutingDebugLog;
}

interface PlayerAggRow {
  playerId: string;
  name: string;
  club: string;
  age: number | null;
  birthYear: number | null;
  citizenship: string;
  minutes: number;
  goals: number;
  matches: number;
  starts: number;
  subs: number;
  yellowCards: number;
  redCards: number;
  leaguesCount: number;
}

type SortCol =
  | 'name'
  | 'club'
  | 'birthYear'
  | 'age'
  | 'minutes'
  | 'goals'
  | 'matches'
  | 'starts'
  | 'subs'
  | 'cards';
type MatchSortCol = 'date' | 'queue' | 'host' | 'score' | 'guest' | 'state';

/** Maks. partii syncu na ligę (tryb nocny — wiele lig z rzędu). */
const MAX_SYNC_ROUNDS_PER_LEAGUE = 500;

const fmtDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
};

const fmtMatchDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function ScoutingPage() {
  const { isAdmin, isLoading: authLoading, userRole, linkedPlayerId, logout } = useAuth();
  const canAccessPage = canAccessScouting({ isAdmin, userRole });
  /** Scout: tylko podgląd stanu — bez sync / usuwania / crawl. */
  const isReadOnly = canAccessPage && !isAdmin;

  const [state, setState] = useState<ScoutingState | null>(null);
  const [loadingState, setLoadingState] = useState(true);

  // Dodawanie nowej ligi
  const [sex, setSex] = useState<Sex>('male');
  const [competitions, setCompetitions] = useState<CompetitionsResponse | null>(null);
  const [loadingComp, setLoadingComp] = useState(false);
  const [seasonId, setSeasonId] = useState('');
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([]);
  const [competitionsSavedAt, setCompetitionsSavedAt] = useState<string | null>(null);

  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [syncingBulk, setSyncingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ league: number; total: number; name: string; round: number } | null>(
    null
  );

  const [debugLogs, setDebugLogs] = useState<ScoutingDebugLog[]>([]);
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  const pushDebugLog = useCallback((log?: ScoutingDebugLog | null) => {
    if (log) setDebugLogs((prev) => [...prev, log]);
  }, []);

  const debugEntryCount = useMemo(() => debugLogs.reduce((n, l) => n + l.entries.length, 0), [debugLogs]);

  // Widok / filtry / sort
  const [view, setView] = useState<'players' | 'matches'>('players');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [birthYearMin, setBirthYearMin] = useState('');
  const [birthYearMax, setBirthYearMax] = useState('');
  const [minMinutes, setMinMinutes] = useState('');
  const [minGoals, setMinGoals] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('goals');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [matchesLeagueKey, setMatchesLeagueKey] = useState<string>('');
  const [matchTeamFilter, setMatchTeamFilter] = useState('');
  const [matchSortCol, setMatchSortCol] = useState<MatchSortCol>('date');
  const [matchSortDir, setMatchSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/scouting/state');
        const data = (await res.json()) as ScoutingState;
        setState(data);
      } catch {
        toast.error('Nie udało się wczytać stanu bazy.');
      } finally {
        setLoadingState(false);
      }
    })();
  }, []);

  /** Przywróć listę rozgrywek z localStorage (bez ponownego scrapingu). Tylko admin (sync UI). */
  useEffect(() => {
    if (isReadOnly || authLoading || !canAccessPage) return;
    const store = loadScoutingCompetitionsStore();
    const initialSex = store?.lastSex ?? 'male';
    setSex(initialSex);
    const cached = restoreCompetitionsForSex(initialSex);
    if (cached) {
      setCompetitions({
        seasons: cached.seasons,
        leagueGroups: cached.leagueGroups,
        selectedSeasonId: cached.selectedSeasonId,
      });
      setSeasonId(cached.seasonId);
      setSelectedLeagueIds(cached.leagueIds);
      setCompetitionsSavedAt(cached.savedAt);
      void pushCompetitionsToServer(initialSex, cached.seasonId, cached.leagueGroups);
    }
  }, [isReadOnly, authLoading, canAccessPage]);

  const leagueEntries = useMemo<[string, ScoutingLeagueData][]>(
    () => (state ? Object.entries(state.leagues) : []),
    [state]
  );

  useEffect(() => {
    if (!matchesLeagueKey && leagueEntries.length > 0) setMatchesLeagueKey(leagueEntries[0][0]);
  }, [leagueEntries, matchesLeagueKey]);

  const loadCompetitions = useCallback(
    async (forSeasonId?: string) => {
      setLoadingComp(true);
      const url = `/api/scouting/competitions?${new URLSearchParams({
        sex,
        ...(forSeasonId ? { seasonId: forSeasonId } : {}),
      }).toString()}`;
      try {
        const res = await fetch(url);
        const payload = (await res.json()) as CompetitionsResponse & { error?: string; debugLog?: ScoutingDebugLog };
        setDebugLogs((prev) => appendClientApiLog(prev, 'GET competitions', res, payload));
        if (payload.debugLog) pushDebugLog(payload.debugLog);
        if (!res.ok) {
          setDebugModalOpen(true);
          throw new Error(payload.error || `Błąd HTTP ${res.status}`);
        }
        if (!payload.seasons?.length) {
          setDebugModalOpen(true);
          throw new Error('Nie udało się pobrać sezonów — sprawdź okno Chrome (powinno pokazać stronę Rozgrywki, nie 404).');
        }
        setCompetitions(payload);
        const nextSeasonId = payload.selectedSeasonId || seasonId;
        if (nextSeasonId) setSeasonId(nextSeasonId);
        const allIds = allLeagueIdsFromGroups(payload.leagueGroups);
        const nextSelected =
          selectedLeagueIds.length > 0 ? selectedLeagueIds.filter((id) => allIds.includes(id)) : allIds;
        setSelectedLeagueIds(nextSelected);
        saveCompetitionsFetch(sex, payload, { seasonId: nextSeasonId, leagueIds: nextSelected });
        void pushCompetitionsToServer(sex, nextSeasonId, payload.leagueGroups);
        setCompetitionsSavedAt(new Date().toISOString());
        toast.success(competitions ? 'Odświeżono listę rozgrywek.' : 'Załadowano listę rozgrywek.');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Błąd pobierania rozgrywek.');
      } finally {
        setLoadingComp(false);
      }
    },
    [sex, pushDebugLog, seasonId, selectedLeagueIds, competitions]
  );

  const applySex = (newSex: Sex) => {
    setSex(newSex);
    setSelectedLeagueIds([]);
    const cached = restoreCompetitionsForSex(newSex);
    if (cached) {
      setCompetitions({
        seasons: cached.seasons,
        leagueGroups: cached.leagueGroups,
        selectedSeasonId: cached.selectedSeasonId,
      });
      setSeasonId(cached.seasonId);
      setSelectedLeagueIds(cached.leagueIds);
      setCompetitionsSavedAt(cached.savedAt);
    } else {
      setCompetitions(null);
      setSeasonId('');
      setSelectedLeagueIds([]);
      setCompetitionsSavedAt(null);
    }
  };

  const onSeasonChange = (newSeasonId: string) => {
    setSeasonId(newSeasonId);
    const groups = getCachedLeagueGroups(sex, newSeasonId);
    const ids = groups ? allLeagueIdsFromGroups(groups) : [];
    setSelectedLeagueIds(ids);
    saveCompetitionsSelection(sex, newSeasonId, ids);
    const cachedGroups = getCachedLeagueGroups(sex, newSeasonId);
    if (cachedGroups && competitions) {
      setCompetitions({
        ...competitions,
        leagueGroups: cachedGroups,
        selectedSeasonId: newSeasonId,
      });
      return;
    }
    loadCompetitions(newSeasonId);
  };

  const persistLeagueSelection = (ids: string[]) => {
    setSelectedLeagueIds(ids);
    saveCompetitionsSelection(sex, seasonId, ids);
  };

  const toggleLeagueSelection = (leagueId: string) => {
    persistLeagueSelection(
      selectedLeagueIds.includes(leagueId)
        ? selectedLeagueIds.filter((id) => id !== leagueId)
        : [...selectedLeagueIds, leagueId]
    );
  };

  const selectAllLeagues = () => {
    persistLeagueSelection(leagueOptions.map((o) => o.value));
  };

  const deselectAllLeagues = () => {
    persistLeagueSelection([]);
  };

  const leagueOptions = useMemo(() => {
    if (!competitions) return [] as { value: string; label: string }[];
    const opts: { value: string; label: string }[] = [];
    for (const g of competitions.leagueGroups) {
      for (const l of g.leagues) {
        const label = g.name === l.name ? l.name : `${g.name} – ${l.name}`;
        opts.push({ value: l.leagueId, label });
      }
    }
    return opts;
  }, [competitions]);

  const enrichSyncConfig = (config: ScoutingConfig): ScoutingConfig => {
    if (config.leagueGroupId) return config;
    const groupId = findLeagueGroupIdInCache(config.sex, config.seasonId, config.leagueId);
    return groupId ? { ...config, leagueGroupId: groupId } : config;
  };

  const syncLeagueUntilComplete = async (
    config: ScoutingConfig,
    key: string,
    onProgress?: (round: number, result: ScoutingSyncResult) => void
  ): Promise<ScoutingSyncResult | null> => {
    let lastResult: ScoutingSyncResult | null = null;
    let round = 0;
    do {
      round += 1;
      const res = await fetch('/api/scouting/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: enrichSyncConfig(config) }),
      });
      const result = (await res.json()) as ScoutingSyncResult & { error?: string };
      lastResult = result;
      setDebugLogs((prev) => appendClientApiLog(prev, `POST sync ${config.leagueName} #${round}`, res, result));
      if (result.debugLog) pushDebugLog(result.debugLog);
      if (
        result.state &&
        (Object.keys(result.state.leagues).length > 0 || Object.keys(result.state.players).length > 0)
      ) {
        setState(result.state);
      }
      if (!res.ok || result.error) {
        setDebugModalOpen(true);
        throw new Error(result.error || result.message || 'Błąd synchronizacji.');
      }
      onProgress?.(round, result);
      const matchesLeft = result.matchesRemaining ?? 0;
      const playersLeft = result.playersRemaining ?? 0;
      const hasMore = matchesLeft > 0 || playersLeft > 0;
      if (!hasMore || round >= MAX_SYNC_ROUNDS_PER_LEAGUE) break;
    } while (true);
    return lastResult;
  };

  const syncLeague = async (config: ScoutingConfig, key: string) => {
    setSyncingKey(key);
    const tid = toast.loading(`Synchronizacja: ${config.leagueName}…`);
    try {
      const lastResult = await syncLeagueUntilComplete(config, key, (round, result) => {
        const matchesLeft = result.matchesRemaining ?? 0;
        const playersLeft = result.playersRemaining ?? 0;
        if (matchesLeft > 0 || playersLeft > 0) {
          toast.loading(
            `${config.leagueName}: partia ${round} — pozostało ${matchesLeft} meczów, ${playersLeft} profili`,
            { id: tid }
          );
        }
      });
      if (lastResult?.errors?.length) setDebugModalOpen(true);
      toast.success(lastResult?.message || 'Synchronizacja zakończona.', { id: tid });
      if (lastResult?.errors?.length) toast(`Uwaga: ${lastResult.errors.length} błąd(ów) przy pobieraniu.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Błąd synchronizacji.', { id: tid });
    } finally {
      setSyncingKey(null);
    }
  };

  const syncSelectedLeagues = async () => {
    if (!seasonId || selectedLeagueIds.length === 0) {
      toast.error('Wybierz sezon i zaznacz co najmniej jedną ligę.');
      return;
    }
    const seasonName = competitions?.seasons.find((s) => s.id === seasonId)?.name || '';
    const configs: ScoutingConfig[] = selectedLeagueIds.map((leagueId) => {
      const base: ScoutingConfig = {
        seasonId,
        seasonName,
        leagueId,
        leagueName: leagueOptions.find((o) => o.value === leagueId)?.label || leagueId,
        sex,
      };
      const groupId = findLeagueGroupIdInCache(sex, seasonId, leagueId);
      return groupId ? { ...base, leagueGroupId: groupId } : base;
    });

    setSyncingBulk(true);
    const tid = toast.loading(`Start syncu ${configs.length} lig…`);
    try {
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const key = leagueKey(config.seasonId, config.leagueId);
        setBulkProgress({ league: i + 1, total: configs.length, name: config.leagueName, round: 0 });
        toast.loading(`Liga ${i + 1}/${configs.length}: ${config.leagueName}`, { id: tid });
        await syncLeagueUntilComplete(config, key, (round) => {
          setBulkProgress({ league: i + 1, total: configs.length, name: config.leagueName, round });
        });
      }
      toast.success(`Zakończono synchronizację ${configs.length} lig.`, { id: tid });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Błąd synchronizacji zbiorczej.', { id: tid });
    } finally {
      setSyncingBulk(false);
      setBulkProgress(null);
    }
  };

  const addAndSync = () => {
    syncSelectedLeagues();
  };

  const removeLeague = async (key: string) => {
    if (!confirm('Usunąć tę ligę z bazy scoutingu?')) return;
    try {
      const res = await fetch(`/api/scouting/league?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const data = (await res.json()) as { state: ScoutingState; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || 'Błąd usuwania.');
      setState(data.state);
      toast.success('Usunięto ligę z bazy.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Błąd usuwania.');
    }
  };

  // Agregacja zawodników z wybranych lig + join z cache (wiek).
  const playerRows = useMemo<PlayerAggRow[]>(() => {
    if (!state) return [];
    const selected = leagueEntries.filter(([k]) => leagueFilter === 'all' || k === leagueFilter);
    const agg = new Map<
      string,
      ReturnType<typeof emptyPlayerMatchAgg> & {
        team: string;
        leagues: Set<string>;
        firstname: string;
        lastname: string;
        seasonId: string;
        seasonName: string;
      }
    >();
    for (const [k, ld] of selected) {
      const seasonIdForLeague = ld.config.seasonId;
      const seasonNameForLeague = ld.config.seasonName;
      for (const m of ld.matches) {
        for (const p of m.playerStats || []) {
          const cur = agg.get(p.playerId) || {
            ...emptyPlayerMatchAgg(),
            team: p.teamName,
            leagues: new Set<string>(),
            firstname: '',
            lastname: '',
            seasonId: seasonIdForLeague,
            seasonName: seasonNameForLeague,
          };
          const stats = accumulatePlayerMatchStat(cur, p);
          cur.minutes = stats.minutes;
          cur.goals = stats.goals;
          cur.matches = stats.matches;
          cur.starts = stats.starts;
          cur.subs = stats.subs;
          cur.yellowCards = stats.yellowCards;
          cur.redCards = stats.redCards;
          cur.team = p.teamName || cur.team;
          cur.leagues.add(k);
          if (p.firstname && !cur.firstname) cur.firstname = p.firstname;
          if (p.lastname && !cur.lastname) cur.lastname = p.lastname;
          agg.set(p.playerId, cur);
        }
      }
    }
    const rows: PlayerAggRow[] = [];
    for (const [id, a] of agg) {
      const info = state.players[id];
      const seasonStats = resolvePlayerSeasonProfile(info, a.seasonId, a.seasonName);
      const name =
        resolvePlayerDisplayName(id, info, { firstname: a.firstname, lastname: a.lastname }) || 'Nieznany zawodnik';
      rows.push({
        playerId: id,
        name,
        club: info?.clubName || a.team,
        age: seasonStats.age,
        birthYear: seasonStats.birthYear,
        citizenship: info?.citizenship || '',
        minutes: a.minutes,
        goals: a.goals,
        matches: a.matches,
        starts: a.starts,
        subs: a.subs,
        yellowCards: a.yellowCards,
        redCards: a.redCards,
        leaguesCount: a.leagues.size,
      });
    }
    return rows;
  }, [state, leagueEntries, leagueFilter]);

  const filteredSortedRows = useMemo<PlayerAggRow[]>(() => {
    const aMin = ageMin ? parseInt(ageMin, 10) : null;
    const aMax = ageMax ? parseInt(ageMax, 10) : null;
    const byMin = birthYearMin ? parseInt(birthYearMin, 10) : null;
    const byMax = birthYearMax ? parseInt(birthYearMax, 10) : null;
    const mMin = minMinutes ? parseInt(minMinutes, 10) : null;
    const gMin = minGoals ? parseInt(minGoals, 10) : null;
    const rows = playerRows.filter((r) => {
      if (aMin != null && (r.age == null || r.age < aMin)) return false;
      if (aMax != null && (r.age == null || r.age > aMax)) return false;
      if (byMin != null && (r.birthYear == null || r.birthYear < byMin)) return false;
      if (byMax != null && (r.birthYear == null || r.birthYear > byMax)) return false;
      if (mMin != null && r.minutes < mMin) return false;
      if (gMin != null && r.goals < gMin) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name') cmp = a.name.localeCompare(b.name, 'pl');
      else if (sortCol === 'club') cmp = a.club.localeCompare(b.club, 'pl');
      else if (sortCol === 'birthYear') cmp = (a.birthYear ?? -1) - (b.birthYear ?? -1);
      else if (sortCol === 'age') cmp = (a.age ?? -1) - (b.age ?? -1);
      else if (sortCol === 'minutes') cmp = a.minutes - b.minutes;
      else if (sortCol === 'goals') cmp = a.goals - b.goals;
      else if (sortCol === 'matches') cmp = a.matches - b.matches;
      else if (sortCol === 'starts') cmp = a.starts - b.starts;
      else if (sortCol === 'subs') cmp = a.subs - b.subs;
      else if (sortCol === 'cards') {
        cmp = a.yellowCards + a.redCards - (b.yellowCards + b.redCards);
        if (cmp === 0) cmp = a.redCards - b.redCards;
      }
      if (cmp === 0) cmp = b.goals - a.goals || b.minutes - a.minutes;
      return cmp * dir;
    });
    return rows;
  }, [playerRows, ageMin, ageMax, birthYearMin, birthYearMax, minMinutes, minGoals, sortCol, sortDir]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortCol(col);
      setSortDir(col === 'name' || col === 'club' ? 'asc' : 'desc');
    }
  };
  const sortArrow = (col: SortCol) => (sortCol === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const toggleMatchSort = (col: MatchSortCol) => {
    if (matchSortCol === col) setMatchSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setMatchSortCol(col);
      setMatchSortDir(col === 'host' || col === 'guest' || col === 'state' ? 'asc' : 'desc');
    }
  };
  const matchSortArrow = (col: MatchSortCol) =>
    matchSortCol === col ? (matchSortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const totalMatches = leagueEntries.reduce((s, [, ld]) => s + ld.matches.length, 0);
  const playersCount = state ? Object.keys(state.players).length : 0;
  const playersMissingAge = playerRows.filter((r) => r.age == null).length;
  const isSyncing = syncingBulk || !!syncingKey;
  const selectedMatchesLeague = leagueEntries.find(([k]) => k === matchesLeagueKey)?.[1];

  const filteredSortedMatches = useMemo<ScoutedMatch[]>(() => {
    if (!selectedMatchesLeague) return [];
    const q = matchTeamFilter.trim().toLowerCase();
    let rows = selectedMatchesLeague.matches;
    if (q) {
      rows = rows.filter(
        (m) => m.host.name.toLowerCase().includes(q) || m.guest.name.toLowerCase().includes(q)
      );
    }
    const dir = matchSortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (matchSortCol === 'date') {
        cmp = new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      } else if (matchSortCol === 'queue') {
        cmp = (a.queue ?? -1) - (b.queue ?? -1);
      } else if (matchSortCol === 'host') {
        cmp = a.host.name.localeCompare(b.host.name, 'pl');
      } else if (matchSortCol === 'score') {
        cmp = (a.scoreFinal ?? '').localeCompare(b.scoreFinal ?? '', 'pl');
      } else if (matchSortCol === 'guest') {
        cmp = a.guest.name.localeCompare(b.guest.name, 'pl');
      } else if (matchSortCol === 'state') {
        cmp = (a.state ?? '').localeCompare(b.state ?? '', 'pl');
      }
      if (cmp === 0) cmp = (a.queue ?? 0) - (b.queue ?? 0);
      return cmp * dir;
    });
  }, [selectedMatchesLeague, matchTeamFilter, matchSortCol, matchSortDir]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.hint}>Ładowanie…</p>
      </div>
    );
  }

  if (!canAccessPage) {
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
            <h1>Scouting rozgrywek</h1>
            <p className={styles.subtitle}>Brak dostępu. Strona tylko dla administratorów i scoutów.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Scouting rozgrywek</h1>
        <p className={styles.subtitle}>
          {isReadOnly
            ? 'Podgląd zebranych danych o zawodnikach (wiek, minuty, bramki) z lig PZPN.'
            : 'Zbieranie danych o zawodnikach (wiek, minuty, bramki) z wielu lig PZPN. Raz prześledzone ligi są zapisywane i nie są pobierane ponownie (zwłaszcza z zakończonych sezonów).'}
        </p>
      </div>

      {/* Dodawanie ligi — tylko admin */}
      {!isReadOnly && (
      <section className={styles.card}>
        <h2>Synchronizuj ligi sezonu</h2>
        <div className={styles.scopeRow}>
          <div className={styles.field}>
            <label>Płeć rozgrywek</label>
            <div className={styles.segmented}>
              <button type="button" className={sex === 'male' ? styles.segActive : styles.seg} onClick={() => applySex('male')} disabled={loadingComp || isSyncing}>
                Mężczyźni
              </button>
              <button type="button" className={sex === 'female' ? styles.segActive : styles.seg} onClick={() => applySex('female')} disabled={loadingComp || isSyncing}>
                Kobiety
              </button>
            </div>
          </div>
          <button type="button" className={styles.secondaryBtn} onClick={() => loadCompetitions(seasonId || undefined)} disabled={loadingComp || isSyncing}>
            {loadingComp ? 'Ładowanie…' : competitions ? 'Odśwież listę rozgrywek' : 'Załaduj listę rozgrywek'}
          </button>
        </div>

        {competitionsSavedAt && (
          <p className={styles.cacheHint}>
            Lista rozgrywek zapisana lokalnie ({fmtDate(competitionsSavedAt)}). Po odświeżeniu strony nie trzeba pobierać ponownie — użyj „Odśwież”, gdy PZPN doda nowy sezon.
          </p>
        )}

        {competitions && (
          <>
            <div className={styles.scopeRow}>
              <div className={styles.field}>
                <label>Sezon</label>
                <select value={seasonId} onChange={(e) => onSeasonChange(e.target.value)} disabled={isSyncing}>
                  <option value="">— wybierz —</option>
                  {competitions.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.isCurrent ? ' (bieżący)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.leaguePickerActions}>
                <button type="button" className={styles.linkBtn} onClick={selectAllLeagues} disabled={isSyncing || leagueOptions.length === 0}>
                  Zaznacz wszystkie
                </button>
                <button type="button" className={styles.linkBtn} onClick={deselectAllLeagues} disabled={isSyncing}>
                  Odznacz
                </button>
                <span className={styles.leaguePickerCount}>
                  {selectedLeagueIds.length} / {leagueOptions.length}
                </span>
              </div>
            </div>
            <fieldset className={styles.leaguePicker} disabled={isSyncing || !seasonId}>
              <legend>Ligi do pobrania</legend>
              {leagueOptions.map((o) => (
                <label key={o.value} className={styles.leagueCheck}>
                  <input
                    type="checkbox"
                    checked={selectedLeagueIds.includes(o.value)}
                    onChange={() => toggleLeagueSelection(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>
            <div className={styles.scopeRow}>
              <button
                className={styles.primaryBtn}
                onClick={addAndSync}
                disabled={!seasonId || selectedLeagueIds.length === 0 || isSyncing}
              >
                {syncingBulk
                  ? bulkProgress
                    ? `Sync ${bulkProgress.league}/${bulkProgress.total}: ${bulkProgress.name} (partia ${bulkProgress.round})…`
                    : 'Synchronizacja wielu lig…'
                  : `Synchronizuj zaznaczone (${selectedLeagueIds.length})`}
              </button>
            </div>
          </>
        )}
        <p className={styles.hint}>
          Zaznacz ligi sezonu i kliknij „Synchronizuj zaznaczone” — aplikacja sama przejdzie przez wszystkie ligi i partie
          (mecze + profile zawodników). Możesz zostawić na noc; zostaw otwartą kartę przeglądarki. Rok urodzenia jest
          liczony per sezon (ten sam zawodnik może mieć inny wiek w kolejnym sezonie).
        </p>
        {debugEntryCount > 0 && (
          <button type="button" className={styles.debugBtn} onClick={() => setDebugModalOpen(true)}>
            Logi zapytań ({debugEntryCount}) — kopiuj do debugowania
          </button>
        )}
      </section>
      )}

      {!isReadOnly && (
      <ScoutingDebugModal
        isOpen={debugModalOpen}
        onClose={() => setDebugModalOpen(false)}
        logs={debugLogs}
        onClear={() => setDebugLogs([])}
      />
      )}

      {/* Śledzone ligi */}
      <section className={styles.card}>
        <h2>Śledzone ligi ({leagueEntries.length})</h2>
        {loadingState ? (
          <p>Wczytywanie…</p>
        ) : leagueEntries.length === 0 ? (
          <p className={styles.hint}>
            {isReadOnly
              ? 'Brak śledzonych lig w bazie scoutingu.'
              : 'Brak śledzonych lig. Dodaj pierwszą ligę powyżej.'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Liga</th>
                  <th>Sezon</th>
                  <th>Mecze (ze stat. · WO)</th>
                  <th>Ostatnia aktualizacja</th>
                  <th>Sezon bieżący</th>
                  {!isReadOnly && <th></th>}
                </tr>
              </thead>
              <tbody>
                {leagueEntries.map(([k, ld]) => {
                  const withStats = countMatchesWithPlayerStats(ld.matches);
                  const walkovers = countWalkoverMatches(ld.matches);
                  const eventsComplete = isLeagueEventsComplete(ld.matches);
                  const syncUnnecessary = eventsComplete && !ld.isCurrentSeason;
                  const matchesLabel =
                    walkovers > 0
                      ? `${ld.matches.length} (${withStats} · ${walkovers} WO)`
                      : `${ld.matches.length} (${withStats})`;
                  return (
                    <tr key={k}>
                      <td className={styles.teamCell}>{ld.config.leagueName}</td>
                      <td>{ld.config.seasonName}</td>
                      <td title={walkovers > 0 ? `${walkovers} walkower(ów) — bez składu/zdarzeń` : undefined}>
                        {matchesLabel}
                      </td>
                      <td>{fmtDate(ld.lastUpdatedAt)}</td>
                      <td>{ld.isCurrentSeason ? 'tak' : 'nie'}</td>
                      {!isReadOnly && (
                      <td className={styles.actionsCell}>
                        <button
                          className={styles.miniBtn}
                          onClick={() => syncLeague(ld.config, k)}
                          disabled={isSyncing || syncUnnecessary}
                          title={
                            syncUnnecessary
                              ? 'Komplet — zdarzenia pobrane dla wszystkich meczów rozegranych (puste składy i walkowery OK)'
                              : ld.isCurrentSeason
                                ? 'Pobierz nowe mecze'
                                : 'Sezon zakończony — zwykle nic nowego'
                          }
                        >
                          {syncingKey === k ? '…' : syncUnnecessary ? 'Komplet' : 'Synchronizuj'}
                        </button>
                        <button className={styles.miniBtnDanger} onClick={() => removeLeague(k)} disabled={isSyncing}>
                          Usuń
                        </button>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dane */}
      {leagueEntries.length > 0 && (
        <section className={styles.card}>
          <div className={styles.tabs}>
            <button className={view === 'players' ? styles.tabActive : styles.tab} onClick={() => setView('players')}>
              Zawodnicy
            </button>
            <button className={view === 'matches' ? styles.tabActive : styles.tab} onClick={() => setView('matches')}>
              Mecze
            </button>
          </div>

          {view === 'players' ? (
            <>
              <div className={styles.filters}>
                <div className={styles.field}>
                  <label>Liga</label>
                  <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
                    <option value="all">Wszystkie ({totalMatches} meczów)</option>
                    {leagueEntries.map(([k, ld]) => (
                      <option key={k} value={k}>
                        {ld.config.leagueName} • {ld.config.seasonName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>R. urodz. od</label>
                  <input type="number" min={1950} max={2035} value={birthYearMin} onChange={(e) => setBirthYearMin(e.target.value)} placeholder="np. 2008" />
                </div>
                <div className={styles.field}>
                  <label>R. urodz. do</label>
                  <input type="number" min={1950} max={2035} value={birthYearMax} onChange={(e) => setBirthYearMax(e.target.value)} placeholder="np. 2010" />
                </div>
                <div className={styles.field}>
                  <label>Wiek od</label>
                  <input type="number" min={0} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="np. 16" />
                </div>
                <div className={styles.field}>
                  <label>Wiek do</label>
                  <input type="number" min={0} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="np. 21" />
                </div>
                <div className={styles.field}>
                  <label>Min. minut</label>
                  <input type="number" min={0} value={minMinutes} onChange={(e) => setMinMinutes(e.target.value)} placeholder="np. 500" />
                </div>
                <div className={styles.field}>
                  <label>Min. bramek</label>
                  <input type="number" min={0} value={minGoals} onChange={(e) => setMinGoals(e.target.value)} placeholder="np. 1" />
                </div>
                <div className={styles.resultCount}>{filteredSortedRows.length} zawodn.</div>
              </div>

              {playersMissingAge > 0 && !isReadOnly && (
                <p className={styles.hint}>
                  Brak wieku u {playersMissingAge} zawodnik(ów) — uruchom synchronizację ligi (profile pobierane partiami,
                  ~120 na rundę).
                </p>
              )}

              {playersCount === 0 ? (
                <p className={styles.hint}>
                  {isReadOnly
                    ? 'Brak danych zawodników w bazie scoutingu.'
                    : 'Brak danych zawodników — uruchom synchronizację ligi.'}
                </p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th className={styles.sortable} onClick={() => toggleSort('name')}>
                          Zawodnik{sortArrow('name')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('club')}>
                          Klub{sortArrow('club')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('birthYear')}>
                          R. ur.{sortArrow('birthYear')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('age')}>
                          Wiek{sortArrow('age')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('minutes')}>
                          Minuty{sortArrow('minutes')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('goals')}>
                          Bramki{sortArrow('goals')}
                        </th>
                        <th className={styles.sortable} onClick={() => toggleSort('matches')}>
                          Mecze{sortArrow('matches')}
                        </th>
                        <th
                          className={styles.sortable}
                          title="Mecze rozegrane od pierwszej minuty (skład wyjściowy)"
                          onClick={() => toggleSort('starts')}
                        >
                          Od 1′{sortArrow('starts')}
                        </th>
                        <th
                          className={styles.sortable}
                          title="Mecze rozegrane po wejściu z ławki rezerwowych"
                          onClick={() => toggleSort('subs')}
                        >
                          Rez.{sortArrow('subs')}
                        </th>
                        <th
                          className={styles.sortable}
                          title="Żółte i czerwone kartki w sezonie"
                          onClick={() => toggleSort('cards')}
                        >
                          K{sortArrow('cards')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSortedRows.map((r, i) => (
                        <tr key={r.playerId}>
                          <td>{i + 1}</td>
                          <td className={styles.teamCell}>
                            {r.name}
                            {r.citizenship ? <span className={styles.subTag}>{r.citizenship}</span> : null}
                          </td>
                          <td>{r.club}</td>
                          <td className={r.birthYear == null ? styles.ageMissing : styles.scoreCell}>{r.birthYear ?? '—'}</td>
                          <td className={r.age == null ? styles.ageMissing : styles.scoreCell}>{r.age ?? '—'}</td>
                          <td>{r.minutes}′</td>
                          <td className={styles.scoreCell}>{r.goals}</td>
                          <td>{r.matches}</td>
                          <td>{r.starts}</td>
                          <td>{r.subs}</td>
                          <td className={styles.cardsCell} title={formatPlayerCards(r.yellowCards, r.redCards) || undefined}>
                            {formatPlayerCards(r.yellowCards, r.redCards) || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.filters}>
                <div className={styles.field}>
                  <label>Liga</label>
                  <select value={matchesLeagueKey} onChange={(e) => setMatchesLeagueKey(e.target.value)}>
                    {leagueEntries.map(([k, ld]) => (
                      <option key={k} value={k}>
                        {ld.config.leagueName} • {ld.config.seasonName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label>Zespół</label>
                  <input
                    type="search"
                    value={matchTeamFilter}
                    onChange={(e) => setMatchTeamFilter(e.target.value)}
                    placeholder="np. Legia, Lech…"
                    aria-label="Filtruj mecze po nazwie zespołu"
                  />
                </div>
                <div className={styles.resultCount}>
                  {filteredSortedMatches.length}
                  {selectedMatchesLeague && matchTeamFilter.trim()
                    ? ` / ${selectedMatchesLeague.matches.length}`
                    : ''}{' '}
                  mecz.
                </div>
              </div>
              {selectedMatchesLeague && (
                <MatchesTable
                  matches={filteredSortedMatches}
                  expanded={expandedMatch}
                  setExpanded={setExpandedMatch}
                  onSort={toggleMatchSort}
                  sortArrow={matchSortArrow}
                />
              )}
            </>
          )}
        </section>
      )}

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
    </div>
  );
}

function MatchesTable({
  matches,
  expanded,
  setExpanded,
  onSort,
  sortArrow,
}: {
  matches: ScoutedMatch[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onSort: (col: MatchSortCol) => void;
  sortArrow: (col: MatchSortCol) => string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.sortable} onClick={() => onSort('date')}>
              Data{sortArrow('date')}
            </th>
            <th className={styles.sortable} onClick={() => onSort('queue')}>
              Kol.{sortArrow('queue')}
            </th>
            <th className={styles.sortable} onClick={() => onSort('host')}>
              Gospodarz{sortArrow('host')}
            </th>
            <th className={styles.sortable} onClick={() => onSort('score')}>
              Wynik{sortArrow('score')}
            </th>
            <th className={styles.sortable} onClick={() => onSort('guest')}>
              Gość{sortArrow('guest')}
            </th>
            <th className={styles.sortable} onClick={() => onSort('state')}>
              Status{sortArrow('state')}
            </th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => {
            const hasStats = !!m.playerStats && m.playerStats.length > 0;
            const isOpen = expanded === m.matchId;
            return (
              <React.Fragment key={m.matchId}>
                <tr className={hasStats ? styles.rowClickable : ''} onClick={() => hasStats && setExpanded(isOpen ? null : m.matchId)}>
                  <td>{fmtMatchDate(m.dateTime)}</td>
                  <td>{m.queue ?? '—'}</td>
                  <td className={styles.teamCell}>{m.host.name}</td>
                  <td className={styles.scoreCell}>{m.scoreFinal ?? '—'}</td>
                  <td className={styles.teamCell}>{m.guest.name}</td>
                  <td>
                    <span
                      className={
                        isWalkoverMatchState(m.state)
                          ? styles.badgeWalkover
                          : isPlayedMatchState(m.state)
                            ? styles.badgePlayed
                            : styles.badge
                      }
                    >
                      {m.state || '—'}
                    </span>
                  </td>
                  <td>{hasStats ? (isOpen ? '▲' : '▼') : ''}</td>
                </tr>
                {isOpen && hasStats && (
                  <tr>
                    <td colSpan={7} className={styles.expandCell}>
                      <PlayerStatsBlock match={m} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsBlock({ match }: { match: ScoutedMatch }) {
  const stats = match.playerStats || [];
  const teams = [
    { id: match.host.id, name: match.host.name },
    { id: match.guest.id, name: match.guest.name },
  ];
  return (
    <div className={styles.statsBlock}>
      {teams.map((t) => {
        const rows = stats.filter((s) => s.teamId === t.id).sort((a, b) => b.minutesPlayed - a.minutesPlayed);
        return (
          <div key={t.id} className={styles.teamStats}>
            <h4>{t.name}</h4>
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Zawodnik</th>
                  <th>Min</th>
                  <th>Gole</th>
                  <th>K</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.number ?? ''}</td>
                    <td>
                      {p.firstname} {p.lastname}
                      {!p.isStarter && p.minutesPlayed > 0 ? <span className={styles.subTag}>rez.</span> : ''}
                    </td>
                    <td>{p.minutesPlayed}′</td>
                    <td>
                      {p.goals > 0 ? `${p.goals} (${p.goalMinutes.map((x) => x + '′').join(', ')})` : ''}
                      {p.ownGoals > 0 ? ` sam.${p.ownGoals}` : ''}
                    </td>
                    <td>
                      {p.yellowCards > 0 ? '🟨' : ''}
                      {p.redCards > 0 ? '🟥' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
