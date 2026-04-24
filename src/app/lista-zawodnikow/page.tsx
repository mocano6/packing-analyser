"use client";

import type { DocumentData, UpdateData } from "firebase/firestore";
import React, { useMemo, useState, useEffect } from 'react';
import Link from "next/link";
import { Player, Action } from '@/types';
import { usePlayersState } from "@/hooks/usePlayersState";
import { useAuth } from "@/hooks/useAuth";
import {
  buildPlayersIndex,
  getPlayerLabel,
  getPlayerFullName,
  normalizePlayerTeamIdsFromFirestoreDoc,
} from '@/utils/playerUtils';
import { FirebaseError } from "firebase/app";
import {
  collection,
  getDocs,
  getDocsFromServer,
  doc,
  updateDoc,
  query,
  where,
  writeBatch,
} from '@/lib/firestoreWithMetrics';
import { getAuthClient, getDB } from '@/lib/firebase';
import {
  buildMatchDocumentUpdatesForDuplicateMergeMany,
  collectAllActionsFromMatchDoc,
} from '@/lib/duplicatePlayerMergeRewrite';
import {
  accumulateGpsCollectionDocsIntoGlobalCounts,
  accumulateMatchDocumentIntoGlobalCounts,
  buildDerivedActionBucketsByPlayerId,
  globalDataContactTotal,
  lookupGlobalPlayerDataCounts,
  buildDerivedMatchEventParticipationsByPlayerId,
  mergeGlobalCountsWithDerivedActionBuckets,
  mergeNestedMatchArraysIntoRootForAggregation,
  principalMatchDataContactTotal,
  type GlobalPlayerDataCounts,
} from '@/lib/globalPlayerDataCounts';
import { appendUnembeddedLegacyActionsPacking } from '@/lib/listaZawodnikowLegacyPackingScan';
import { normalizeFirestorePlayerId } from '@/lib/matchActionPlayerIds';
import { enrichMatchDataWithLegacyPackingIfNeeded } from '@/lib/matchDocumentCache';
import { loadMatchSnapshotsForLista } from '@/lib/listaZawodnikowLoadMatches';
import { resolveTeamFieldForMatchLabel } from '@/lib/listaZawodnikowMatchLabel';
import { readListaPageCache, writeListaPageCache } from '@/lib/listaZawodnikowPageCache';
import { filterActiveDuplicateIdsForBulkDelete } from '@/lib/listaZawodnikowDuplicateBulkSelection';
import {
  accumulateMatchDocumentPerMatchParticipation,
  participationMapToRecord,
  lookupPerMatchParticipationRows,
  type ListaPerMatchParticipation,
} from '@/lib/listaZawodnikowPerMatchBreakdown';
import toast from 'react-hot-toast';
import styles from './page.module.css';

const LISTA_TEAM_FILTER_KEY = 'lista_zawodnikow_team_filter_v1';
/** Równoległe wzbogacanie legacy packing — unika setek równoległych getDocs i pojedynczych błędów. */
const LISTA_ENRICH_CONCURRENCY = 16;

function DuplicateStatPair({
  k,
  v,
  title,
}: {
  k: string;
  v: number;
  title: string;
}) {
  return (
    <span className={styles.duplicateStatPair} title={title}>
      <span className={styles.duplicateStatKey}>{k}</span>
      <span className={styles.duplicateStatVal}>{v}</span>
    </span>
  );
}

/** Kluczowe liczniki z całej bazy (mecze + gps w tle ∑) — skróty z opisem w title. */
function DuplicateGlobalCountsSummary({
  counts: c,
  isLoading: aggregatesLoading,
}: {
  counts: GlobalPlayerDataCounts;
  /** Trwa pierwsze pobranie agregacji meczów / GPS — bez tego liczniki byłyby myląco zerowe. */
  isLoading?: boolean;
}) {
  if (aggregatesLoading) {
    return (
      <div
        className={`${styles.duplicateGlobalStatsCompact} ${styles.duplicateGlobalStatsCompactLoading}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="ładowanie liczników z dokumentów meczów, proszę czekać"
      >
        <div className={styles.duplicateStatCompactLine}>
          <span className={styles.duplicateAggregatesLoadingInner}>
            <span className={styles.duplicateAggregatesLoadingSpinner} aria-hidden />
            <span>ładowanie liczników z meczów…</span>
          </span>
        </div>
      </div>
    );
  }

  const pkTotal = c.pkAsSender + c.pkAsReceiver;
  const packTotal = c.actionsPacking + c.actionsUnpacking;
  const row: [string, number, string][] = [
    [
      'Zdarz',
      c.matchEventsParticipated,
      'łączna liczba zdarzeń we wszystkich meczach, w których zawodnik brał udział (4 tablice akcji z obroną, strzały, PK, ACC8s). Jeden wiersz zdarzenia liczy się maksymalnie raz',
    ],
    ['Pack', packTotal, 'Packing + unpacking — wystąpienia jako nadawca lub odbiorca we wszystkich meczach'],
    ['Reg', c.actionsRegain, 'Regain — nadawca/odbiorca'],
    ['Str', c.actionsLoses, 'Straty (loses) — nadawca/odbiorca'],
    ['xG', c.shotsAsShooter, 'Strzały — jako strzelec (mapa xG)'],
    ['PK', pkTotal, 'Wejścia w pole karne — nadawca + odbiorca'],
    [
      'Min',
      c.playerMinutesPlayedSum,
      `Łączna suma minut z playerMinutes: suma max(0, endMinute - startMinute) we wszystkich meczach (jak kolumna Min Σ w tabeli poniżej). Liczba wierszy / odcinków: ${c.playerMinutesRows}.`,
    ],
  ];
  return (
    <div
      className={styles.duplicateGlobalStatsCompact}
      role="group"
      aria-label="Zbiorcze liczniki: zdarzenia, packing, regain, straty, xG (strzelec), PK, suma minut z playerMinutes. Najedź na skrót po opis."
    >
      <div className={styles.duplicateStatCompactLine}>
        {row.map(([k, v, t], i) => (
          <DuplicateStatPair key={`${k}-${i}`} k={k} v={v} title={t} />
        ))}
      </div>
    </div>
  );
}

/** Tabela: każdy mecz, w którym zawodnik ma wpisy (akcje, strzały, PK, 8s, minuty). */
function DuplicatePerMatchParticipationTable({
  playerId,
  rows,
  matchNamesById,
  aggregatesLoading,
}: {
  playerId: string;
  rows: ListaPerMatchParticipation[];
  matchNamesById: Record<string, string>;
  aggregatesLoading: boolean;
}) {
  if (aggregatesLoading) {
    return (
      <div className={styles.duplicatePerMatchWrap} role="status" aria-live="polite" aria-busy="true">
        <p className={styles.duplicatePerMatchHint}>Trwa ładowanie podziału na mecze…</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={styles.duplicatePerMatchWrap}>
        <p className={styles.duplicatePerMatchHint}>
          Brak rozbicia na mecze — dane pojawią się po pełnym pobraniu dokumentów meczów z Firestore.
        </p>
      </div>
    );
  }
  return (
    <details className={styles.duplicatePerMatchDetails}>
      <summary className={styles.duplicatePerMatchSummary}>
        Wszystkie mecze z udziałem ({rows.length}) — zdarzenia, typy akcji, minuty
      </summary>
      <div className={styles.duplicatePerMatchScroll} tabIndex={0}>
        <table className={styles.duplicatePerMatchTable} aria-label={`Podsumowanie per mecz dla zawodnika ${playerId}`}>
          <thead>
            <tr>
              <th scope="col">Mecz</th>
              <th scope="col" title="Wiersze zdarzeń (jak „Zdarz” w skrócie — bez samych wpisów minut)">
                Zdarz
              </th>
              <th scope="col">Pack</th>
              <th scope="col">Unp</th>
              <th scope="col">Reg</th>
              <th scope="col">Str</th>
              <th scope="col" title="Obrona w 4 tablicach">
                Obr
              </th>
              <th scope="col">Strzał</th>
              <th scope="col">Ast</th>
              <th scope="col">PK</th>
              <th scope="col">8s</th>
              <th scope="col" title="Suma (end − start) po wierszach playerMinutes w meczu">
                Min Σ
              </th>
              <th scope="col" title="Liczba wierszy playerMinutes">
                n
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pkSum = r.pkAsSender + r.pkAsReceiver;
              const matchLabel = matchNamesById[r.matchId] ?? r.matchId;
              return (
                <tr key={r.matchId}>
                  <td className={styles.duplicatePerMatchNameCell} title={matchLabel}>
                    {matchLabel}
                  </td>
                  <td>{r.matchEvents}</td>
                  <td>{r.actionsPacking}</td>
                  <td>{r.actionsUnpacking}</td>
                  <td>{r.actionsRegain}</td>
                  <td>{r.actionsLoses}</td>
                  <td>{r.actionsAsDefense}</td>
                  <td>{r.shotsAsShooter}</td>
                  <td>{r.shotsAsAssistant}</td>
                  <td title={`nadawca ${r.pkAsSender} / odbiorca ${r.pkAsReceiver}`}>{pkSum}</td>
                  <td>{r.acc8sParticipations}</td>
                  <td>{r.minutesPlayed}</td>
                  <td>{r.playerMinutesRows}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function ListaZawodnikow() {
  const [searchTerm, setSearchTerm] = useState('');
  /** Pusty string = wszystkie zespoły; ID dokumentu teams/ */
  const [filterTeamId, setFilterTeamId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(LISTA_TEAM_FILTER_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [sortBy, setSortBy] = useState<'name' | 'actions' | 'teams'>('actions');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [matchNamesById, setMatchNamesById] = useState<Record<string, string>>({});
  /** Domyślnie true — po wejściu admina unikamy pierwszego „migotania” samych zer zanim wystartuje fetch. */
  const [isLoading, setIsLoading] = useState(true);
  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<Set<string>>(new Set());
  const [expandedDuplicatePlayerIds, setExpandedDuplicatePlayerIds] = useState<Set<string>>(new Set());
  /** Na karcie duplikatu: ID zawodnika do usunięcia (źródło) → ID karty docelowej (zachowanej). */
  const [duplicateMergeTargetBySourceId, setDuplicateMergeTargetBySourceId] = useState<Record<string, string>>(
    {},
  );
  /** Zaznaczenia do hurtowego soft delete we wszystkich grupach duplikatów naraz. */
  const [duplicateBulkSelectedPlayerIds, setDuplicateBulkSelectedPlayerIds] = useState<string[]>([]);
  const [duplicateBulkDeleting, setDuplicateBulkDeleting] = useState(false);
  const [globalCountsByPlayerId, setGlobalCountsByPlayerId] = useState<
    Record<string, GlobalPlayerDataCounts>
  >({});
  const [perMatchParticipationByPlayerId, setPerMatchParticipationByPlayerId] = useState<
    Record<string, ListaPerMatchParticipation[]>
  >({});
  const [teamNamesById, setTeamNamesById] = useState<Record<string, string>>({});
  /** `${playerId}|${teamId}` — trwa wypisanie z zespołu na karcie duplikatu */
  const [teamRemovalPending, setTeamRemovalPending] = useState<string | null>(null);
  /** Diagnostyka ostatniego ładowania agregacji (mecze vs legacy actions_packing). */
  const [listaAggDebug, setListaAggDebug] = useState<{
    matchDocs: number;
    legacyActionsAdded: number;
  } | null>(null);

  /** Inkrementacja przy każdym uruchomieniu efektu — React Strict Mode odpala podwójnie; stary fetch nie może nadpisać stanu. */
  const listaMatchFetchGenRef = React.useRef(0);
  /** Po sparowaniu duplikatów — ponowne pobranie meczów / liczników bez przeładowania strony. */
  const [listaAggregatesRefreshKey, setListaAggregatesRefreshKey] = useState(0);

  const { isAuthenticated, isAdmin, isLoading: authLoading, user } = useAuth();
  const { players, handleDeletePlayer: deletePlayer, handleRestorePlayer: restorePlayer } = usePlayersState();
  const [allPlayersIncludingDeleted, setAllPlayersIncludingDeleted] = useState<Player[]>([]);
  const [isLoadingAllPlayers, setIsLoadingAllPlayers] = useState(true);

  const playersIndex = useMemo(() => buildPlayersIndex(allPlayersIncludingDeleted), [allPlayersIncludingDeleted]);


  const derivedActionBucketsByPlayerId = useMemo(
    () => buildDerivedActionBucketsByPlayerId(allActions),
    [allActions],
  );

  const derivedMatchEventsByPlayerId = useMemo(
    () => buildDerivedMatchEventParticipationsByPlayerId(allActions),
    [allActions],
  );

  /** Brak danych w stanie — wtedy pokazujemy „ładowanie” zamiast zer (np. zanim odczyt z Firestore się domknie). */
  const listaAggregatesShellEmpty = useMemo(
    () => allActions.length === 0 && Object.keys(globalCountsByPlayerId).length === 0,
    [allActions, globalCountsByPlayerId],
  );
  const listaAggregatesLoadingUi = isLoading && listaAggregatesShellEmpty;

  const teamSelectOptions = useMemo(() => {
    return Object.entries(teamNamesById)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
  }, [teamNamesById]);

  // Usuń zapisany filtr, jeśli zespół już nie istnieje w mapie (po załadowaniu).
  useEffect(() => {
    if (!filterTeamId) return;
    const ids = Object.keys(teamNamesById);
    if (ids.length === 0) return;
    if (!ids.includes(filterTeamId)) {
      setFilterTeamId('');
      try {
        localStorage.removeItem(LISTA_TEAM_FILTER_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [teamNamesById, filterTeamId]);

  const setFilterTeamIdPersisted = React.useCallback((id: string) => {
    setFilterTeamId(id);
    try {
      if (id) {
        localStorage.setItem(LISTA_TEAM_FILTER_KEY, id);
      } else {
        localStorage.removeItem(LISTA_TEAM_FILTER_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // WSZYSTKIE HOOKI MUSZĄ BYĆ PRZED WARUNKAMI RETURN!
  
  // Pobierz zespoły, wszystkie mecze (akcje + globalne liczniki), kolekcję gps — po pełnym auth (reguły Firestore).
  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!isAuthenticated || !isAdmin) {
      setIsLoading(false);
      return;
    }

    const gen = ++listaMatchFetchGenRef.current;
    let cancelled = false;

    const applyIfCurrent = (fn: () => void) => {
      if (cancelled || gen !== listaMatchFetchGenRef.current) return;
      fn();
    };

    const fetchAllActions = async () => {
      applyIfCurrent(() => {
        setIsLoading(true);
        setListaAggDebug(null);
      });

      const cachedWarm = readListaPageCache();
      if (
        cachedWarm &&
        (cachedWarm.actions.length > 0 || Object.keys(cachedWarm.globalCountsByPlayerId).length > 0)
      ) {
        applyIfCurrent(() => {
          setAllActions(cachedWarm.actions);
          setGlobalCountsByPlayerId(cachedWarm.globalCountsByPlayerId);
          setPerMatchParticipationByPlayerId({});
          if (Object.keys(cachedWarm.matchNamesById).length > 0) {
            setMatchNamesById(cachedWarm.matchNamesById);
          }
        });
      }

      try {
        const db = getDB();

        try {
          await getAuthClient().currentUser?.getIdToken(true);
        } catch {
          /* odświeżenie claimów przed odczytem rules — ignoruj brak sesji */
        }

        const [teamsSnapshot, gpsSnapshot] = await Promise.all([
          getDocs(collection(db, 'teams')),
          getDocs(collection(db, 'gps')),
        ]);

        const namesMap: Record<string, string> = {};
        teamsSnapshot.docs.forEach((d) => {
          const n = (d.data() as { name?: string }).name;
          namesMap[d.id] = typeof n === 'string' && n.trim() ? n.trim() : d.id;
        });
        applyIfCurrent(() => setTeamNamesById(namesMap));

        const teamIdsForMatchQuery = teamsSnapshot.docs.map((d) => d.id);
        const matchSnapshots = await loadMatchSnapshotsForLista(db, teamIdsForMatchQuery);

        const allMatchActions: Action[] = [];
        const matchLabels: Record<string, string> = {};
        const globalMap = new Map<string, GlobalPlayerDataCounts>();
        const perMatchMap = new Map<string, Map<string, ListaPerMatchParticipation>>();

        const enrichedRows: { matchId: string; enriched: Record<string, unknown> }[] = [];
        for (let i = 0; i < matchSnapshots.length; i += LISTA_ENRICH_CONCURRENCY) {
          const slice = matchSnapshots.slice(i, i + LISTA_ENRICH_CONCURRENCY);
          const part = await Promise.all(
            slice.map(async (docSnap) => {
              const matchId = docSnap.id;
              const raw = docSnap.data() as Record<string, unknown> & {
                team?: string;
                opponent?: string;
                date?: string;
              };
              try {
                const enriched = await enrichMatchDataWithLegacyPackingIfNeeded(db, matchId, raw);
                return { matchId, enriched };
              } catch (e) {
                console.warn('[lista-zawodnikow] enrichMatchData', matchId, e);
                return { matchId, enriched: raw };
              }
            }),
          );
          enrichedRows.push(...part);
        }

        for (const { matchId, enriched } of enrichedRows) {
          const merged = mergeNestedMatchArraysIntoRootForAggregation(
            enriched as Record<string, unknown>,
          );
          const matchData = merged as Record<string, unknown> & {
            team?: string;
            opponent?: string;
            date?: string;
          };
          const team = resolveTeamFieldForMatchLabel(matchData.team, namesMap, 'Zespół');
          const opponent = resolveTeamFieldForMatchLabel(
            matchData.opponent,
            namesMap,
            'Przeciwnik',
          );
          const date = matchData.date ?? '';
          matchLabels[matchId] = `${team} vs ${opponent}${date ? ` (${date})` : ''}`;

          accumulateMatchDocumentIntoGlobalCounts(matchData, globalMap);
          accumulateMatchDocumentPerMatchParticipation(
            matchData as Record<string, unknown>,
            matchId,
            perMatchMap,
          );
          collectAllActionsFromMatchDoc(matchData, matchId).forEach((a) => {
            allMatchActions.push(a);
          });
        }

        const embeddedKeys = new Set<string>();
        for (const a of allMatchActions) {
          embeddedKeys.add(
            `${String(a.matchId).trim()}|${String(a.id).trim()}`,
          );
        }
        let legacyActionsAdded = 0;
        if (allMatchActions.length === 0) {
          const extra = await appendUnembeddedLegacyActionsPacking(
            db,
            globalMap,
            embeddedKeys,
          );
          legacyActionsAdded = extra.length;
          allMatchActions.push(...extra);
        }

        accumulateGpsCollectionDocsIntoGlobalCounts(gpsSnapshot.docs, globalMap);

        const countsRecord: Record<string, GlobalPlayerDataCounts> = {};
        globalMap.forEach((v, k) => {
          countsRecord[k] = v;
        });
        const perMatchRecord = participationMapToRecord(perMatchMap, matchLabels);

        const ts = Date.now();
        applyIfCurrent(() => {
          setListaAggDebug({
            matchDocs: matchSnapshots.length,
            legacyActionsAdded,
          });
          setGlobalCountsByPlayerId(countsRecord);
          setPerMatchParticipationByPlayerId(perMatchRecord);
          setMatchNamesById(matchLabels);
          setAllActions(allMatchActions);
          writeListaPageCache({
            ts,
            actions: allMatchActions,
            globalCountsByPlayerId: countsRecord,
            matchNamesById: matchLabels,
          });
        });
      } catch (error) {
        console.error('Błąd podczas pobierania akcji:', error);
        applyIfCurrent(() => {
          const restored = readListaPageCache();
          if (
            restored &&
            (restored.actions.length > 0 || Object.keys(restored.globalCountsByPlayerId).length > 0)
          ) {
            setAllActions(restored.actions);
            setGlobalCountsByPlayerId(restored.globalCountsByPlayerId);
            setPerMatchParticipationByPlayerId({});
            if (Object.keys(restored.matchNamesById).length > 0) {
              setMatchNamesById(restored.matchNamesById);
            }
          } else {
            setAllActions([]);
            setMatchNamesById({});
            setGlobalCountsByPlayerId({});
            setPerMatchParticipationByPlayerId({});
            setListaAggDebug(null);
          }
        });
      } finally {
        applyIfCurrent(() => setIsLoading(false));
      }
    };

    void fetchAllActions();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, isAdmin, listaAggregatesRefreshKey]);

  // Pobierz wszystkich zawodników (w tym usuniętych) – tylko na tej stronie
  const fetchAllPlayersIncludingDeleted = React.useCallback(async () => {
    if (authLoading || !isAuthenticated || !isAdmin) {
      return;
    }
    if (!getDB()) {
      setAllPlayersIncludingDeleted([]);
      setIsLoadingAllPlayers(false);
      return;
    }
    setIsLoadingAllPlayers(true);
    try {
      const colRef = collection(getDB(), "players");
      let playersSnapshot;
      try {
        playersSnapshot = await getDocsFromServer(colRef);
      } catch (e) {
        console.warn("[lista-zawodnikow] players getDocsFromServer → cache:", e);
        playersSnapshot = await getDocs(colRef);
      }
      const list = playersSnapshot.docs.map(docSnap => {
        const data = docSnap.data() as Player & { team?: string; teamId?: string };
        const { id: _id, ...rest } = data;
        const player: Player = {
          id: docSnap.id,
          ...rest,
          teams: normalizePlayerTeamIdsFromFirestoreDoc(data),
        };
        return player;
      });
      setAllPlayersIncludingDeleted(list);
    } catch (error) {
      console.error('Błąd pobierania listy zawodników (z usuniętymi):', error);
      setAllPlayersIncludingDeleted([]);
    } finally {
      setIsLoadingAllPlayers(false);
    }
  }, [authLoading, isAuthenticated, isAdmin]);

  useEffect(() => {
    fetchAllPlayersIncludingDeleted();
  }, [fetchAllPlayersIncludingDeleted]);

  // Oblicz liczbę akcji (nadawca/odbiorca w 4 tablicach) oraz globalne powiązania z danymi
  const playersWithStats = useMemo(() => {
    return allPlayersIncludingDeleted.map((player) => {
      const pk = normalizeFirestorePlayerId(player.id) ?? player.id;
      const playerActions = allActions.filter(
        (action) =>
          normalizeFirestorePlayerId(action.senderId) === pk ||
          normalizeFirestorePlayerId(action.receiverId) === pk,
      );
      const gcRaw = lookupGlobalPlayerDataCounts(globalCountsByPlayerId, player.id);
      const gc = mergeGlobalCountsWithDerivedActionBuckets(
        gcRaw,
        derivedActionBucketsByPlayerId.get(pk),
        derivedMatchEventsByPlayerId.get(pk),
      );
      const teamLabels = (player.teams || []).map((tid) => teamNamesById[tid] ?? tid);

      const packingActionsCount = playerActions.length;
      const globalDataTotal = globalDataContactTotal(gc);
      const principalDataTotal = principalMatchDataContactTotal(gc);
      return {
        ...player,
        /** Wpisy w 4 tablicach meczu (packing / unpacking / regain / loses) — tylko to w rozwinięciu „akcji”. */
        actionsCount: packingActionsCount,
        teamsString: teamLabels.length ? teamLabels.join(', ') : '',
        globalCounts: gc,
        /** Suma wszystkich powiązań z danymi w bazie (m.in. 4 tablice, strzały/xG, PK, minuty, GPS…). */
        globalDataTotal,
        /** Pack+Unpack+Reg+Loses + strzały (xG) + PK — kolumna „Powiązania” i sortowanie. */
        principalDataTotal,
      };
    });
  }, [
    allPlayersIncludingDeleted,
    allActions,
    globalCountsByPlayerId,
    teamNamesById,
    derivedActionBucketsByPlayerId,
    derivedMatchEventsByPlayerId,
  ]);

  // Filtrowanie i sortowanie
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = playersWithStats.filter((player) => {
      if (filterTeamId) {
        const teams = Array.isArray(player.teams) ? player.teams : [];
        if (!teams.includes(filterTeamId)) return false;
      }
      return (
        getPlayerLabel(player.id, playersIndex).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.number?.toString() || '').includes(searchTerm) ||
        player.teamsString.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    return filtered.sort((a, b) => {
      let aValue, bValue;
      
      // Funkcja do wyciągnięcia nazwiska (ostatnie słowo) z pełnej nazwy
      const getLastName = (fullName: string) => {
        const words = fullName.trim().split(/\s+/);
        return words[words.length - 1].toLowerCase();
      };
      
      switch (sortBy) {
        case 'name':
          // Sortuj po nazwisku zamiast po pełnej nazwie
          aValue = getLastName(a.name || '');
          bValue = getLastName(b.name || '');
          break;
        case 'actions':
          aValue = a.principalDataTotal;
          bValue = b.principalDataTotal;
          break;
        case 'teams':
          aValue = a.teamsString.toLowerCase();
          bValue = b.teamsString.toLowerCase();
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue, 'pl', { sensitivity: 'base' })
          : bValue.localeCompare(aValue, 'pl', { sensitivity: 'base' });
      } else {
        return sortDirection === 'asc' 
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });
  }, [playersWithStats, searchTerm, filterTeamId, sortBy, sortDirection, playersIndex]);

  const handleRemovePlayerFromTeam = React.useCallback(
    async (playerId: string, teamId: string) => {
      const tid = teamId.trim();
      const teamLabel = teamNamesById[tid] ?? teamNamesById[teamId] ?? teamId;
      const playerLabel = getPlayerLabel(playerId, playersIndex);
      if (
        !window.confirm(
          `Wypisać ${playerLabel} z zespołu „${teamLabel}”? Zaktualizujemy kartę zawodnika i opcjonalnie wpis w teams/${tid}/members.`,
        )
      ) {
        return;
      }
      const pendingKey = `${playerId}|${tid}`;
      setTeamRemovalPending(pendingKey);
      const toastId = toast.loading(`Wypisywanie: ${playerLabel} — „${teamLabel}”…`);
      try {
        if (!user) {
          toast.error("Brak sesji — zaloguj się ponownie.", { id: toastId });
          return;
        }
        const token = await user.getIdToken();
        const res = await fetch("/api/admin-remove-player-from-team", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ playerId, teamId: tid }),
        });
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          let msg =
            typeof payload.error === "string" && payload.error
              ? payload.error
              : `HTTP ${res.status}`;
          if (res.status === 503 && payload.code === "admin-config-missing") {
            msg +=
              " Na hostingu ustaw FIREBASE_SERVICE_ACCOUNT_KEY (lub PATH) — bez tego API admin nie działa.";
          }
          toast.error(`Nie udało się wypisać z zespołu: ${msg}`, { id: toastId, duration: 6000 });
          return;
        }
        await fetchAllPlayersIncludingDeleted();
        toast.dismiss(toastId);
      } catch (e) {
        console.error(e);
        const detail =
          e instanceof FirebaseError
            ? `${e.message} (${e.code})`
            : e instanceof Error
              ? e.message
              : "nieznany";
        toast.error(`Błąd wypisania z zespołu: ${detail}`, { id: toastId, duration: 6000 });
      } finally {
        setTeamRemovalPending(null);
      }
    },
    [teamNamesById, playersIndex, fetchAllPlayersIncludingDeleted, user],
  );

  // Potencjalne duplikaty — to samo imię i nazwisko (z pola Player / name), znormalizowane.
  // Zawodnicy usunięci (soft delete / archiwum) są pomijani — to nie duplikaty aktywnej kartoteki.
  const findDuplicates = () => {
    const normalizeToken = (token: string) => {
      if (!token) return '';
      return token
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^a-z\s]/g, '');
    };

    /** Imię i nazwisko z dokumentu (bez maskowania trybu prezentacji). */
    const rawFirstLast = (p: Player): { first: string; last: string } => {
      const fn = (p.firstName ?? '').trim();
      const ln = (p.lastName ?? '').trim();
      if (fn || ln) {
        return { first: fn, last: ln };
      }
      const raw = (p.name ?? '').trim();
      if (!raw) return { first: '', last: '' };
      const words = raw.split(/\s+/).filter(Boolean);
      if (words.length === 0) return { first: '', last: '' };
      if (words.length === 1) return { first: '', last: words[0] };
      return { first: words.slice(0, -1).join(' '), last: words[words.length - 1] };
    };

    const fullNameGroups: { [key: string]: typeof playersWithStats } = {};

    playersWithStats.forEach((player) => {
      if (player.isDeleted) return;
      const { first, last } = rawFirstLast(player);
      const lastKey = normalizeToken(last);
      if (!lastKey) return;
      const firstKey = normalizeToken(first);
      const key = `${firstKey}|${lastKey}`;
      if (!fullNameGroups[key]) {
        fullNameGroups[key] = [];
      }
      fullNameGroups[key].push(player);
    });

    return Object.entries(fullNameGroups)
      .filter(([_, grp]) => grp.length > 1)
      .map(([key, grp]) => ({
        type: 'fullName' as const,
        key,
        players: grp,
      }));
  };

  const duplicates = findDuplicates();

  /** Wszyscy zawodnicy pokazywani w sekcji duplikatów (do walidacji zaznaczeń). */
  const duplicateBulkAllowedPlayers = useMemo(
    () =>
      findDuplicates().flatMap((d) =>
        d.players.map((p) => ({ id: p.id, isDeleted: p.isDeleted })),
      ),
    [playersWithStats],
  );

  const duplicateBulkSelectedEffective = useMemo(
    () =>
      filterActiveDuplicateIdsForBulkDelete(
        duplicateBulkSelectedPlayerIds,
        duplicateBulkAllowedPlayers,
      ),
    [duplicateBulkSelectedPlayerIds, duplicateBulkAllowedPlayers],
  );

  type PreparedDuplicateMergeRow = {
    duplicatePlayerIds: string[];
    mainPlayer: (typeof playersWithStats)[number];
    duplicatesToMerge: (typeof playersWithStats)[number][];
  };

  /** Po udanym zapisie w Firestore: lokalny stan + ponowny fetch listy i agregacji (bez reload). */
  const finalizeDuplicateMergesInUI = React.useCallback(
    async (prepared: PreparedDuplicateMergeRow[], successMessage: string) => {
      const mergedDupIds = new Set<string>();
      for (const row of prepared) {
        row.duplicatesToMerge.forEach((d) => mergedDupIds.add(d.id));
      }
      setExpandedDuplicatePlayerIds((prev) => {
        const next = new Set(prev);
        mergedDupIds.forEach((id) => next.delete(id));
        return next;
      });
      setExpandedPlayerIds((prev) => {
        const next = new Set(prev);
        mergedDupIds.forEach((id) => next.delete(id));
        return next;
      });
      setDuplicateMergeTargetBySourceId((prev) => {
        const next = { ...prev };
        for (const id of mergedDupIds) {
          delete next[id];
        }
        for (const [src, tgt] of Object.entries(prev)) {
          if (mergedDupIds.has(tgt)) delete next[src];
        }
        return next;
      });
      setDuplicateBulkSelectedPlayerIds((prev) => {
        const filtered = prev.filter((id) => !mergedDupIds.has(id));
        return filtered.length === prev.length ? prev : filtered;
      });
      await fetchAllPlayersIncludingDeleted();
      setListaAggregatesRefreshKey((k) => k + 1);
      toast.success(successMessage, { duration: 6000 });
    },
    [fetchAllPlayersIncludingDeleted],
  );


  // SPRAWDŹ UPRAWNIENIA (PO WSZYSTKICH HOOKACH)
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Sprawdzanie uprawnień...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.accessDenied}>
          <h2>🔒 Brak dostępu</h2>
          <p>Musisz być zalogowany, aby uzyskać dostęp do tej strony.</p>
          <Link href="/login" className={styles.loginButton}>
            Przejdź do logowania
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.accessDenied}>
          <h2>🔒 Brak uprawnień</h2>
          <p>Tylko administratorzy mają dostęp do listy wszystkich zawodników.</p>
          <Link href="/analyzer" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  // Funkcja do przełączania rozwinięcia akcji zawodnika (tabela główna)
  const togglePlayerActions = (playerId: string) => {
    setExpandedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Funkcja do przełączania rozwinięcia akcji w sekcji duplikatów
  const toggleDuplicatePlayerActions = (playerId: string) => {
    setExpandedDuplicatePlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Funkcja do pobierania akcji konkretnego zawodnika (4 tablice — ta sama normalizacja ID co w licznikach)
  const getPlayerActions = (playerId: string) => {
    const pk = normalizeFirestorePlayerId(playerId) ?? playerId;
    return allActions
      .filter(
        (action) =>
          normalizeFirestorePlayerId(action.senderId) === pk ||
          normalizeFirestorePlayerId(action.receiverId) === pk,
      )
      .sort((a, b) => b.minute - a.minute);
  };

  // Funkcja do obliczania podobieństwa stringów (algorytm Jaro-Winkler uproszczony)
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    // Uproszczony algorytm - sprawdź ile znaków jest wspólnych
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) {
        matches++;
      }
    }
    
    return matches / longer.length;
  };

  /** Wspólna ścieżka: mecze, gps, dokumenty players. Zwraca false przy braku DB / braku pracy. */
  const executePreparedDuplicateMerges = async (prepared: PreparedDuplicateMergeRow[]): Promise<boolean> => {
    if (prepared.length === 0) return true;
    const db = getDB();
    if (!db) {
      toast.error('Brak połączenia z bazą danych.');
      return false;
    }

    const mergeOperations = prepared.map((p) => ({
      duplicatePlayerIds: p.duplicatePlayerIds,
      mainPlayerId: p.mainPlayer.id,
    }));

    const teamsSnap = await getDocs(collection(db, 'teams'));
    const matchSnapshots = await loadMatchSnapshotsForLista(db, teamsSnap.docs.map((d) => d.id));

    const MATCH_BATCH_MAX = 400;
    let matchBatch = writeBatch(db);
    let matchBatchOps = 0;
    const flushMatchBatch = async () => {
      if (matchBatchOps === 0) return;
      await matchBatch.commit();
      matchBatch = writeBatch(db);
      matchBatchOps = 0;
    };

    for (const matchDoc of matchSnapshots) {
      const matchId = matchDoc.id;
      const raw = matchDoc.data() as Record<string, unknown>;
      let matchData: Record<string, unknown>;
      try {
        matchData = await enrichMatchDataWithLegacyPackingIfNeeded(db, matchId, raw);
      } catch (e) {
        console.warn("[lista-zawodnikow merge] enrichMatchData", matchId, e);
        matchData = raw;
      }
      const { updates, changed } = buildMatchDocumentUpdatesForDuplicateMergeMany(matchData, mergeOperations);
      if (changed) {
        matchBatch.update(
          doc(db, 'matches', matchDoc.id),
          updates as unknown as UpdateData<DocumentData>,
        );
        matchBatchOps++;
        if (matchBatchOps >= MATCH_BATCH_MAX) {
          await flushMatchBatch();
        }
      }
    }
    await flushMatchBatch();

    const dupToMain = new Map<string, string>();
    for (const op of mergeOperations) {
      for (const dup of op.duplicatePlayerIds) {
        const dk = normalizeFirestorePlayerId(dup) ?? dup;
        dupToMain.set(dk, op.mainPlayerId);
      }
    }
    const allDupIds = [...dupToMain.keys()];
    const GPS_IN_CHUNK = 30;
    const GPS_BATCH_MAX = 400;
    for (let gi = 0; gi < allDupIds.length; gi += GPS_IN_CHUNK) {
      const chunk = allDupIds.slice(gi, gi + GPS_IN_CHUNK);
      const gpsSnap = await getDocs(query(collection(db, 'gps'), where('playerId', 'in', chunk)));
      let gpsBatch = writeBatch(db);
      let gpsBatchOps = 0;
      const flushGpsBatch = async () => {
        if (gpsBatchOps === 0) return;
        await gpsBatch.commit();
        gpsBatch = writeBatch(db);
        gpsBatchOps = 0;
      };
      for (const d of gpsSnap.docs) {
        const pkGps = normalizeFirestorePlayerId(d.data().playerId);
        const mainId = pkGps ? dupToMain.get(pkGps) : undefined;
        if (mainId) {
          gpsBatch.update(d.ref, { playerId: mainId });
          gpsBatchOps++;
          if (gpsBatchOps >= GPS_BATCH_MAX) {
            await flushGpsBatch();
          }
        }
      }
      await flushGpsBatch();
    }

    for (const { mainPlayer, duplicatesToMerge } of prepared) {
      try {
        const allTeams = new Set(mainPlayer.teams || []);
        duplicatesToMerge.forEach((duplicate) => {
          if (duplicate.teams) {
            duplicate.teams.forEach((team) => allTeams.add(team));
          }
        });
        const teamsAfterMerge = Array.from(allTeams);
        const updatedMainPlayer = {
          ...mainPlayer,
          teams: teamsAfterMerge,
          position: mainPlayer.position || duplicatesToMerge.find((d) => d.position)?.position || mainPlayer.position,
          birthYear: mainPlayer.birthYear || duplicatesToMerge.find((d) => d.birthYear)?.birthYear || mainPlayer.birthYear,
        };

        await updateDoc(doc(db, 'players', mainPlayer.id), {
          teams: updatedMainPlayer.teams,
          position: updatedMainPlayer.position,
          birthYear: updatedMainPlayer.birthYear,
        });
        for (const duplicate of duplicatesToMerge) {
          await updateDoc(doc(db, 'players', duplicate.id), { isDeleted: true });
        }
      } catch (error) {
        console.error(
          `Błąd podczas sparowywania duplikatów (players) dla ${getPlayerLabel(mainPlayer.id, playersIndex) || 'Brak nazwy'}:`,
          error,
        );
        throw error;
      }
    }

    return true;
  };

  /** Tylko ta jedna karta → docelowa; pozostali w grupie bez zmian. */
  const mergeOneDuplicateCardIntoTarget = async (
    duplicateRow: (typeof playersWithStats)[number],
    mainRow: (typeof playersWithStats)[number],
    groupTitle: string,
  ) => {
    if (duplicateRow.id === mainRow.id) return;
    const dupLabel = getPlayerLabel(duplicateRow.id, playersIndex);
    const mainLabel = getPlayerLabel(mainRow.id, playersIndex);
    const ok = window.confirm(
      `Scal tylko tego jednego zawodnika (ta karta), bez reszty grupy „${groupTitle}”?\n\n` +
        `• Ta karta przestanie być aktywna: ${dupLabel}\n` +
        `  ID: ${duplicateRow.id}\n` +
        `• Zachowana karta (docelowa): ${mainLabel}\n` +
        `  ID: ${mainRow.id}\n\n` +
        'Powiązania w meczach i GPS dla tej jednej karty zostaną przepisane na docelową; ta karta otrzyma isDeleted: true. Inni zawodnicy w tej samej grupie imion nie są dotykani.\n\n' +
        'Kontynuować?',
    );
    if (!ok) return;

    const onePrepared: PreparedDuplicateMergeRow[] = [
      {
        duplicatePlayerIds: [duplicateRow.id],
        mainPlayer: mainRow,
        duplicatesToMerge: [duplicateRow],
      },
    ];

    const toastId = toast.loading(`Sparowywanie: ${dupLabel} → ${mainLabel}…`);
    setIsMergingDuplicates(true);
    try {
      const saved = await executePreparedDuplicateMerges(onePrepared);
      toast.dismiss(toastId);
      if (saved) {
        await finalizeDuplicateMergesInUI(
          onePrepared,
          `Sparowano: ${dupLabel} → ${mainLabel}. Usunięta karta (soft delete) jest w archiwum; możesz ją przywrócić przy pomyłce. Liczniki z meczów odświeżają się w tle.`,
        );
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Błąd podczas sparowywania duplikatów:', error);
      toast.error('Wystąpił błąd podczas sparowywania. Sprawdź konsolę i spróbuj ponownie.', {
        duration: 6500,
      });
    } finally {
      setIsMergingDuplicates(false);
    }
  };

  /** Sparowanie wielu grup naraz (przycisk „Sparuj N grup”) — wspólna implementacja: executePreparedDuplicateMerges. */
  const mergeDuplicateGroups = async (groups: typeof duplicates) => {
    if (groups.length === 0) {
      alert('Nie znaleziono duplikatów do sparowania.');
      return;
    }

    const duplicatesSummary = groups
      .map(({ players }) => {
        const label = getPlayerFullName(players[0]).trim() || players[0].id;
        return `👥 ${label}: ${players.length} zawodników`;
      })
      .join('\n');

    const scopeLabel =
      groups.length === 1
        ? 'tylko tę jedną grupę duplikatów'
        : `${groups.length} grup duplikatów`;

    const confirmMerge = window.confirm(
      `Czy na pewno chcesz sparować ${scopeLabel}?\n\n` +
      'Grupy do scalenia:\n' +
      duplicatesSummary +
      '\n\n' +
      'Operacja ta:\n' +
      '• Przeniesie powiązania w meczu (akcje packing/unpacking/regain/loses, strzały, PK, 8s, minuty, GPS w meczu, statystyki w matchData)\n' +
      '• Zaktualizuje dokumenty w kolekcji gps (pole playerId), jeśli wskazują na duplikat\n' +
      '• Oznaczy sklejane karty jako usunięte (isDeleted: true)\n' +
      '• Nie może być cofnięta\n\n' +
      'Czy kontynuować?'
    );

    if (!confirmMerge) return;

    const prepared: PreparedDuplicateMergeRow[] = [];

    for (const { players: duplicatePlayers } of groups) {
      if (duplicatePlayers.length < 2) continue;
      const sortedPlayers = [...duplicatePlayers].sort((a, b) => {
        if (a.globalDataTotal !== b.globalDataTotal) {
          return b.globalDataTotal - a.globalDataTotal;
        }
        return a.id.localeCompare(b.id);
      });
      const mainPlayer = sortedPlayers[0];
      const duplicatesToMerge = sortedPlayers.slice(1);
      const duplicatePlayerIds = duplicatesToMerge.map((d) => d.id);
      if (duplicatePlayerIds.length === 0) continue;
      prepared.push({ duplicatePlayerIds, mainPlayer, duplicatesToMerge });
    }

    if (prepared.length === 0) {
      toast.error('Nie znaleziono duplikatów do sparowania (brak grup z co najmniej 2 zawodnikami).');
      return;
    }

    const toastId = toast.loading(
      prepared.length === 1
        ? 'Sparowywanie jednej grupy duplikatów…'
        : `Sparowywanie ${prepared.length} grup duplikatów…`,
    );
    setIsMergingDuplicates(true);
    try {
      const saved = await executePreparedDuplicateMerges(prepared);
      toast.dismiss(toastId);
      if (saved) {
        const n = prepared.length;
        await finalizeDuplicateMergesInUI(
          prepared,
          n === 1
            ? 'Sparowano grupę duplikatów. Zbędne karty w archiwum (soft delete). Liczniki z meczów odświeżają się w tle.'
            : `Sparowano ${n} grup duplikatów. Zbędne karty w archiwum (soft delete). Liczniki z meczów odświeżają się w tle.`,
        );
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Błąd podczas sparowywania duplikatów:', error);
      toast.error('Wystąpił błąd podczas sparowywania. Sprawdź konsolę i spróbuj ponownie.', {
        duration: 6500,
      });
    } finally {
      setIsMergingDuplicates(false);
    }
  };


  const mergeDuplicates = () => void mergeDuplicateGroups(duplicates);

  const handleSort = (field: 'name' | 'actions' | 'teams') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: 'name' | 'actions' | 'teams') => {
    if (sortBy !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleDeletePlayerFromList = async (playerId: string) => {
    const playerLabel = getPlayerLabel(playerId, playersIndex);
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć zawodnika ${playerLabel}?\n\n` +
          "To jest soft delete: w dokumencie players zostanie ustawione isDeleted: true (rekord pozostaje w bazie).",
      )
    ) {
      return;
    }
    const prevRow = allPlayersIncludingDeleted.find((p) => p.id === playerId);
    const toastId = toast.loading(`Usuwanie: ${playerLabel}…`);

    setAllPlayersIncludingDeleted((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, isDeleted: true } : p)),
    );
    setExpandedDuplicatePlayerIds((prev) => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
    setExpandedPlayerIds((prev) => {
      const next = new Set(prev);
      next.delete(playerId);
      return next;
    });
    setDuplicateBulkSelectedPlayerIds((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : prev,
    );

    try {
      const success = await deletePlayer(playerId);
      if (success) {
        toast.success(
          `Usunięto z aktywnej kartoteki: ${playerLabel} (soft delete — możesz przywrócić).`,
          { id: toastId, duration: 5500 },
        );
      } else {
        if (prevRow) {
          setAllPlayersIncludingDeleted((prev) =>
            prev.map((p) => (p.id === playerId ? prevRow : p)),
          );
        }
        toast.error("Nie udało się usunąć zawodnika (sprawdź konsolę lub uprawnienia).", {
          id: toastId,
        });
      }
    } catch (e) {
      console.error(e);
      if (prevRow) {
        setAllPlayersIncludingDeleted((prev) =>
          prev.map((p) => (p.id === playerId ? prevRow : p)),
        );
      }
      toast.error("Błąd podczas usuwania zawodnika.", { id: toastId });
    }
  };

  const handleRestorePlayerFromList = async (playerId: string) => {
    const playerLabel = getPlayerLabel(playerId, playersIndex);
    if (!window.confirm(`Czy na pewno chcesz przywrócić zawodnika ${playerLabel}?`)) {
      return;
    }
    const prevRow = allPlayersIncludingDeleted.find((p) => p.id === playerId);
    const toastId = toast.loading(`Przywracanie: ${playerLabel}…`);

    setAllPlayersIncludingDeleted((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, isDeleted: false } : p)),
    );

    try {
      const success = await restorePlayer(playerId);
      if (success) {
        toast.success(
          `Przywrócono do aktywnej kartoteki: ${playerLabel}.`,
          { id: toastId, duration: 5000 },
        );
      } else {
        if (prevRow) {
          setAllPlayersIncludingDeleted((prev) =>
            prev.map((p) => (p.id === playerId ? prevRow : p)),
          );
        }
        toast.error("Nie udało się przywrócić zawodnika.", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      if (prevRow) {
        setAllPlayersIncludingDeleted((prev) =>
          prev.map((p) => (p.id === playerId ? prevRow : p)),
        );
      }
      toast.error("Błąd podczas przywracania zawodnika.", { id: toastId });
    }
  };

  const toggleDuplicateBulkPlayer = (playerId: string, nextChecked: boolean) => {
    setDuplicateBulkSelectedPlayerIds((prev) => {
      if (nextChecked) {
        return prev.includes(playerId) ? prev : [...prev, playerId];
      }
      return prev.filter((id) => id !== playerId);
    });
  };

  const clearDuplicateBulkSelection = () => {
    setDuplicateBulkSelectedPlayerIds([]);
  };

  const handleBulkSoftDeleteAllSelectedDuplicates = async () => {
    const ids = filterActiveDuplicateIdsForBulkDelete(
      duplicateBulkSelectedPlayerIds,
      duplicateBulkAllowedPlayers,
    );
    if (ids.length === 0) {
      toast.error('Zaznacz co najmniej jednego aktywnego zawodnika (checkbox przy koszu w dowolnej grupie).');
      return;
    }
    const lines = ids.map(
      (id) => `• ${getPlayerLabel(id, playersIndex)} (${id})`,
    );
    if (
      !window.confirm(
        `Czy na pewno chcesz usunąć ${ids.length} zawodników z zaznaczenia (wszystkie grupy duplikatów)?\n\n` +
          lines.join('\n') +
          '\n\nTo jest soft delete (isDeleted: true w Firestore). Karty pozostają w bazie — można przywrócić z archiwum.\n\nKontynuować?',
      )
    ) {
      return;
    }

    const idSet = new Set(ids);
    const prevRows = new Map<string, (typeof allPlayersIncludingDeleted)[number] | undefined>();
    for (const id of ids) {
      prevRows.set(id, allPlayersIncludingDeleted.find((p) => p.id === id));
    }

    setDuplicateBulkDeleting(true);
    const toastId = toast.loading(`Usuwanie ${ids.length} zawodników…`);

    setAllPlayersIncludingDeleted((prev) =>
      prev.map((p) => (idSet.has(p.id) ? { ...p, isDeleted: true } : p)),
    );
    setDuplicateBulkSelectedPlayerIds((prev) => prev.filter((id) => !idSet.has(id)));
    setExpandedDuplicatePlayerIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setExpandedPlayerIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setDuplicateMergeTargetBySourceId((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      for (const [src, tgt] of Object.entries(prev)) {
        if (idSet.has(tgt)) delete next[src];
      }
      return next;
    });

    try {
      const failed: string[] = [];
      for (const id of ids) {
        const ok = await deletePlayer(id);
        if (!ok) failed.push(id);
      }

      if (failed.length > 0) {
        const failedSet = new Set(failed);
        setAllPlayersIncludingDeleted((prev) =>
          prev.map((p) => {
            if (!failedSet.has(p.id)) return p;
            const row = prevRows.get(p.id);
            return row ? { ...row } : p;
          }),
        );
        toast.error(
          `Nie udało się usunąć ${failed.length} z ${ids.length} zawodników (sprawdź uprawnienia). Pozostali zostali oznaczeni lokalnie — odśwież listę jeśli widzisz niespójność.`,
          { id: toastId, duration: 7500 },
        );
      } else {
        toast.success(
          `Usunięto z aktywnej kartoteki: ${ids.length} zawodników (soft delete).`,
          { id: toastId, duration: 5500 },
        );
      }
    } catch (e) {
      console.error(e);
      toast.error('Błąd podczas hurtowego usuwania. Sprawdź konsolę.', { id: toastId, duration: 6500 });
    } finally {
      setDuplicateBulkDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lista wszystkich zawodników</h1>
        <p style={{ margin: "5px 0", fontSize: "14px", color: "#6c757d" }}>
          Wyszukuj po imieniu, nazwisku, numerze, zespole lub ID zawodnika. Możesz ograniczyć listę do jednego zespołu.
          Najedź na skrócone ID aby zobaczyć pełne.
        </p>
        <Link href="/analyzer" className={styles.backButton}>
          ← Powrót do głównej
        </Link>
      </div>

      {listaAggDebug &&
        listaAggDebug.matchDocs === 0 &&
        listaAggDebug.legacyActionsAdded === 0 &&
        !isLoading && (
          <div className={styles.aggDiagnosticBanner} role="status">
            <strong>Brak danych z agregacji meczów.</strong> Firestore nie zwrócił dokumentów{' '}
            <code>matches</code>/<code>matches_archive</code> ani wpisów w <code>actions_packing</code> (albo
            reguły bezpieczeństwa odrzucają listę — admin musi mieć rolę w{' '}
            <code>{"users/{uid}"}</code> lub claim <code>admin</code> w tokenie). Sprawdź konsolę pod{' '}
            <code>[lista-zawodnikow]</code> i reguły dla kolekcji <code>matches</code>.
          </div>
        )}
      {listaAggDebug && listaAggDebug.legacyActionsAdded > 0 && !isLoading && (
        <div className={styles.aggDiagnosticInfo} role="status">
          Uzupełniono {listaAggDebug.legacyActionsAdded} akcji z kolekcji root{' '}
          <code>actions_packing</code> (tablice w dokumentach meczów były puste).
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.controlsTopRow}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Szukaj zawodnika (imię, nazwisko, numer, zespół, ID)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              aria-label="Szukaj zawodnika"
            />
          </div>
          <div className={styles.teamFilter}>
            <label htmlFor="lista-team-filter" className={styles.teamFilterLabel}>
              Zespół
            </label>
            <select
              id="lista-team-filter"
              className={styles.teamSelect}
              value={filterTeamId}
              onChange={(e) => setFilterTeamIdPersisted(e.target.value)}
              aria-label="Filtruj listę po zespole — tylko zawodnicy przypisani do wybranego zespołu"
            >
              <option value="">Wszystkie zespoły</option>
              {teamSelectOptions.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className={styles.stats}>
          <span className={styles.totalCount}>
            Łącznie: {allPlayersIncludingDeleted.length}
            {' '}(aktywnych: {allPlayersIncludingDeleted.filter(p => !p.isDeleted).length},
            {' '}usuniętych: {allPlayersIncludingDeleted.filter(p => p.isDeleted).length})
          </span>
          <span className={styles.filteredCount}>
            Wyświetlanych: {filteredAndSortedPlayers.length}
          </span>
          {isLoadingAllPlayers && (
            <span className={styles.loadingLabel}>Ładowanie listy…</span>
          )}
          {duplicates.length > 0 && (
            <span className={styles.duplicatesWarning}>
              ⚠️ Znaleziono {duplicates.length} potencjalnych duplikatów (tylko aktywni; archiwalni pominięci)
            </span>
          )}
          <button 
            onClick={mergeDuplicates}
            disabled={isMergingDuplicates}
            className={styles.mergeDuplicatesButton}
            title="Sparuj wszystkie duplikaty automatycznie"
          >
            {isMergingDuplicates ? 'Sparowywanie...' : `🔄 Sparuj ${duplicates.length} grup duplikatów`}
          </button>
          <button 
            onClick={() => {}}
            className={styles.cleanupButton}
            title="Usuń duplikaty z Firebase (na podstawie name + number)"
            disabled
          >
            🧹 Wyczyść duplikaty Firebase
          </button>
          <button 
            onClick={() => {}}
            className={styles.cleanupButton}
            title="Usuń duplikaty ID z lokalnego stanu"
            disabled
          >
            🧹 Wyczyść duplikaty lokalnie
          </button>
        </div>
      </div>

      {/* Sekcja duplikatów — grupy po imieniu i nazwisku; liczniki z całej bazy */}
      {duplicates.length > 0 && (
        <div id="duplikaty-zawodnikow" className={styles.duplicatesSection}>
          <div className={styles.duplicatesHeader}>
            <h3>⚠️ Potencjalne duplikaty (aktywna kartoteka, bez usuniętych)</h3>
            <div
              className={styles.duplicateGroupBulkBar}
              role="group"
              aria-label="Hurtowe odznaczanie i usuwanie we wszystkich grupach duplikatów"
            >
              <button
                type="button"
                className={styles.duplicateGroupBulkBtn}
                disabled={
                  isMergingDuplicates ||
                  duplicateBulkDeleting ||
                  duplicateBulkSelectedEffective.length === 0
                }
                onClick={clearDuplicateBulkSelection}
              >
                Odznacz wszystkie
              </button>
              <button
                type="button"
                className={`${styles.duplicateGroupBulkBtn} ${styles.duplicateGroupBulkBtnDanger}`}
                disabled={
                  isMergingDuplicates ||
                  duplicateBulkDeleting ||
                  duplicateBulkSelectedEffective.length === 0
                }
                onClick={() => void handleBulkSoftDeleteAllSelectedDuplicates()}
              >
                Usuń zaznaczone ({duplicateBulkSelectedEffective.length})
              </button>
            </div>
          </div>
          {duplicates.map(({ key, players: duplicatePlayers }) => {
            const labelPlayer = duplicatePlayers[0];
            const groupTitle =
              getPlayerFullName(labelPlayer).trim() || getPlayerLabel(labelPlayer.id, playersIndex) || key;
            const bulkBusy = isMergingDuplicates || duplicateBulkDeleting;
            return (
            <div key={key} className={styles.duplicateGroup}>
              <div className={styles.duplicateGroupTitleRow}>
                <h4>Imię i nazwisko: {groupTitle}</h4>
              </div>
              <p className={styles.duplicateGroupHint}>
                Grupy powstają przy <strong>tym samym imieniu i nazwisku</strong> (z pola kartoteki). Archiwalni / usunięci są pomijani. <strong>Hurtowe usunięcie:</strong> zaznacz karty checkboxem przy koszu w dowolnych grupach, potem u góry sekcji: „Odznacz wszystkie” lub „Usuń zaznaczone” — jedna operacja dla całego zaznaczenia (soft delete, bez scalania danych z meczów). <strong>Scalanie:</strong> na każdej karcie wybierz docelową kartę i użyj „Sparuj tę kartę” — tylko ta jedna karta jest scalana z wybraną; pozostali w grupie bez zmian. Liczniki: <code>matches</code> (w tym legacy <code>actions_packing</code> gdy tablica w meczu pusta) + <code>gps</code>. Karta: Zdarz, Pack, Reg, Str, xG, PK, Min (suma minut z <code>playerMinutes</code>, w tabeli: Min Σ / liczba wierszy); przy zespole × wypisuje z zespołu. Rozwinięcie: 4 tablice akcji.
              </p>
              <div className={styles.duplicateListRow}>
                {duplicatePlayers.map((player) => {
                  const mergeTargetCandidates = [...duplicatePlayers]
                    .filter((p) => p.id !== player.id)
                    .sort((a, b) => {
                      if (a.globalDataTotal !== b.globalDataTotal) {
                        return b.globalDataTotal - a.globalDataTotal;
                      }
                      return a.id.localeCompare(b.id);
                    });
                  const selectedMergeTargetId =
                    duplicateMergeTargetBySourceId[player.id] ?? mergeTargetCandidates[0]?.id ?? '';
                  return (
                  <div key={player.id} className={styles.duplicateItemWrapperFlex}>
                    <div className={`${styles.duplicateItem} ${styles.duplicateItemStack}`}>
                      <div className={styles.duplicateCardTop}>
                        <div className={`${styles.playerInfo} ${styles.duplicatePlayerInfo}`}>
                          <div className={styles.duplicateCardMetaLine}>
                            <span className={styles.duplicateCardName}>
                              {player.isDeleted ? (
                                <>
                                  {(getPlayerFullName(player) || 'Zawodnik').trim() || 'Zawodnik'}
                                  <span className={styles.playerDeletedLabel}> (usunięty)</span>
                                  {player.position && (
                                    <span className={styles.playerPosition}> {player.position}</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  {getPlayerLabel(player.id, playersIndex)}
                                  {player.position && (
                                    <span className={styles.playerPosition}> {player.position}</span>
                                  )}
                                </>
                              )}
                            </span>
                            <span className={styles.duplicateCardNum}>#{player.number ?? '—'}</span>
                            <span className={styles.duplicateCardYear}>
                              {player.birthYear ? `· ${player.birthYear}` : '· —'}
                            </span>
                          </div>
                          <div
                            className={styles.duplicateCardTeamsLine}
                            title={(player.teams || []).map((tid) => teamNamesById[tid] ?? tid).join(', ')}
                          >
                            <span className={styles.teamsLabel}>Zesp. </span>
                            {(player.teams || []).length === 0 ? (
                              <span className={styles.duplicateCardTeamsText}>—</span>
                            ) : (
                              <ul className={styles.duplicateTeamChips} aria-label="Zespoły zawodnika — usuń przyciskiem">
                                {(player.teams || []).map((tid) => {
                                  const pending =
                                    teamRemovalPending === `${player.id}|${tid}`;
                                  const tname = teamNamesById[tid] ?? tid;
                                  return (
                                    <li key={tid} className={styles.duplicateTeamChip}>
                                      <span className={styles.duplicateTeamChipName} title={tid}>
                                        {tname}
                                      </span>
                                      <button
                                        type="button"
                                        className={styles.duplicateTeamRemoveBtn}
                                        disabled={pending}
                                        aria-label={`Wypisz z zespołu ${tname}`}
                                        title="Wypisz zawodnika z tego zespołu"
                                        onClick={() => handleRemovePlayerFromTeam(player.id, tid)}
                                      >
                                        {pending ? "…" : "×"}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                          <DuplicateGlobalCountsSummary
                            counts={player.globalCounts}
                            isLoading={listaAggregatesLoadingUi}
                          />
                          <DuplicatePerMatchParticipationTable
                            playerId={player.id}
                            rows={lookupPerMatchParticipationRows(
                              perMatchParticipationByPlayerId,
                              player.id,
                            )}
                            matchNamesById={matchNamesById}
                            aggregatesLoading={listaAggregatesLoadingUi}
                          />
                          <div className={styles.duplicateActionsRow}>
                            <button
                              type="button"
                              onClick={() => toggleDuplicatePlayerActions(player.id)}
                              disabled={listaAggregatesLoadingUi || player.actionsCount === 0}
                              className={styles.duplicateActionsBtn}
                              title={
                                listaAggregatesLoadingUi
                                  ? 'ładowanie danych z meczów…'
                                  : player.actionsCount > 0
                                    ? 'Rozwiń listę akcji (4 tablice w meczach)'
                                    : 'Brak wpisów jako nadawca/odbiorca'
                              }
                            >
                              4 tab.: {listaAggregatesLoadingUi ? '…' : player.actionsCount}
                            </button>
                            <span
                              className={styles.globalTotalBadge}
                              title={
                                listaAggregatesLoadingUi
                                  ? 'ładowanie sum powiązań z bazy…'
                                  : 'Suma wszystkich powiązań z danymi w bazie'
                              }
                            >
                              ∑ <strong>{listaAggregatesLoadingUi ? '…' : player.globalDataTotal}</strong>
                            </span>
                            <code className={styles.duplicateCardId} title={player.id}>
                              {player.id.length > 10 ? `${player.id.slice(0, 10)}…` : player.id}
                            </code>
                          </div>
                        </div>
                        <div className={styles.duplicateCardToolbar}>
                          {player.isDeleted ? (
                            <button
                              type="button"
                              onClick={() => handleRestorePlayerFromList(player.id)}
                              className={styles.duplicateToolbarBtn}
                              title="Przywróć tego zawodnika"
                            >
                              ↩️
                            </button>
                          ) : (
                            <>
                              <input
                                type="checkbox"
                                className={styles.duplicateToolbarBulkCheckbox}
                                checked={duplicateBulkSelectedEffective.includes(player.id)}
                                disabled={bulkBusy}
                                onChange={(e) =>
                                  toggleDuplicateBulkPlayer(player.id, e.target.checked)
                                }
                                aria-label={`Zaznacz do hurtowego usunięcia: ${getPlayerLabel(player.id, playersIndex)}`}
                                title="Zaznacz do hurtowego usunięcia (akcje u góry sekcji)"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeletePlayerFromList(player.id)}
                                className={`${styles.duplicateToolbarBtn} ${styles.duplicateToolbarBtnDanger}`}
                                title="Usuń tego zawodnika"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {!player.isDeleted && mergeTargetCandidates.length > 0 && (
                        <div className={styles.duplicateCardMergeRow}>
                          <label className={styles.duplicateCardMergeLabel} htmlFor={`merge-target-${player.id}`}>
                            Scal tę kartę w
                          </label>
                          <select
                            id={`merge-target-${player.id}`}
                            className={styles.duplicateCardMergeSelect}
                            value={selectedMergeTargetId}
                            onChange={(e) =>
                              setDuplicateMergeTargetBySourceId((prev) => ({
                                ...prev,
                                [player.id]: e.target.value,
                              }))
                            }
                            aria-label={`Wybierz docelową kartę dla scalenia — ${getPlayerLabel(player.id, playersIndex)}`}
                          >
                            {mergeTargetCandidates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {getPlayerLabel(t.id, playersIndex, { includeNumber: true })} · ∑{' '}
                                {listaAggregatesLoadingUi ? '…' : t.globalDataTotal}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.duplicateCardMergeButton}
                            disabled={
                              isMergingDuplicates ||
                              bulkBusy ||
                              !selectedMergeTargetId ||
                              selectedMergeTargetId === player.id
                            }
                            title="Tylko ta karta: przepisz powiązania na wybraną i oznacz tę jako usuniętą"
                            onClick={() => {
                              const mainRow = duplicatePlayers.find((p) => p.id === selectedMergeTargetId);
                              if (!mainRow) return;
                              void mergeOneDuplicateCardIntoTarget(player, mainRow, groupTitle);
                            }}
                          >
                            {isMergingDuplicates ? '…' : '🔗 Sparuj tę kartę'}
                          </button>
                        </div>
                      )}
                    </div>
                    {expandedDuplicatePlayerIds.has(player.id) && player.actionsCount > 0 && (() => {
                      const playerActions = getPlayerActions(player.id);
                      if (playerActions.length === 0) return null;
                      return (
                        <div className={styles.expandedActionsSection}>
                          <div className={styles.actionsHeader}>
                            <h3>Akcje: {getPlayerLabel(player.id, playersIndex)}</h3>
                            <button
                              type="button"
                              onClick={() => toggleDuplicatePlayerActions(player.id)}
                              className={styles.closeActionsButton}
                              title="Zamknij listę akcji"
                            >
                              ✕
                            </button>
                          </div>
                          <div className={styles.actionsStats}>
                            <span>Łącznie: <strong>{playerActions.length}</strong></span>
                            <span>
                              Jako nadawca:{' '}
                              <strong>
                                {
                                  playerActions.filter(
                                    (a) =>
                                      normalizeFirestorePlayerId(a.senderId) ===
                                      (normalizeFirestorePlayerId(player.id) ?? player.id),
                                  ).length
                                }
                              </strong>
                            </span>
                            <span>
                              Jako odbiorca:{' '}
                              <strong>
                                {
                                  playerActions.filter(
                                    (a) =>
                                      normalizeFirestorePlayerId(a.receiverId) ===
                                      (normalizeFirestorePlayerId(player.id) ?? player.id),
                                  ).length
                                }
                              </strong>
                            </span>
                          </div>
                          <div className={styles.actionsTable}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Minuta</th>
                                  <th>Typ akcji</th>
                                  <th>Rola</th>
                                  <th>Partner</th>
                                  <th>Nazwa meczu</th>
                                  <th>Punkty</th>
                                  <th>Szczegóły</th>
                                </tr>
                              </thead>
                              <tbody>
                                {playerActions.map((action, index) => {
                                  const pkn = normalizeFirestorePlayerId(player.id) ?? player.id;
                                  const isActionSender =
                                    normalizeFirestorePlayerId(action.senderId) === pkn;
                                  const partnerId = isActionSender ? action.receiverId : action.senderId;
                                  return (
                                    <tr key={`${action.id}-${index}`} className={styles.actionRow}>
                                      <td className={styles.actionMinute}>{action.minute}'</td>
                                      <td className={styles.actionType}>
                                        {action.actionType === 'pass' ? '⚽ Podanie' : '🏃 Drybling'}
                                      </td>
                                      <td className={`${styles.actionRole} ${isActionSender ? styles.sender : styles.receiver}`}>
                                        {isActionSender ? '📤 Nadawca' : '📥 Odbiorca'}
                                      </td>
                                      <td className={styles.actionPartner}>
                                        {action.actionType === 'pass' && partnerId
                                          ? getPlayerLabel(partnerId, playersIndex, { includeNumber: true })
                                          : '-'}
                                      </td>
                                      <td className={styles.actionMatchName} title={matchNamesById[action.matchId] ?? action.matchId}>
                                        {matchNamesById[action.matchId] ?? action.matchId ?? '-'}
                                      </td>
                                      <td className={`${styles.actionPoints} ${(action.packingPoints || 0) >= 3 ? styles.highPoints : ''}`}>
                                        <strong>{action.packingPoints || 0}</strong>
                                      </td>
                                      <td className={styles.actionDetails}>
                                        {action.isP3 && <span className={styles.p3Badge}>P3</span>}
                                        {action.isShot && <span className={styles.shotBadge}>🎯 Strzał</span>}
                                        {action.isGoal && <span className={styles.goalBadge}>⚽ Gol</span>}
                                        {action.isPenaltyAreaEntry && <span className={styles.penaltyBadge}>📦 Pole karne</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Tabela wszystkich zawodników */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className={styles.sortableHeader}>
                Imię i nazwisko (sortuj wg nazwiska) {getSortIcon('name')}
              </th>
              <th>Numer</th>
              <th>ID</th>
              <th>Rok urodzenia</th>
              <th>Pozycja</th>
              <th onClick={() => handleSort('teams')} className={styles.sortableHeader}>
                Zespoły {getSortIcon('teams')}
              </th>
              <th
                onClick={() => handleSort('actions')}
                className={styles.sortableHeader}
                title="Suma z: 4 tablic akcji w meczu (packing/unpacking/regain/loses) + strzały (xG) + PK. Pełna suma kontaktów (minuty, GPS, 8s itd.) w podpowiedzi komórki, jeśli jest większa."
              >
                Powiązania (suma) {getSortIcon('actions')}
              </th>
              <th>Status</th>
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedPlayers.map((player) => (
              <tr key={player.id} className={`${styles.tableRow} ${player.isDeleted ? styles.rowDeleted : ''}`}>
                <td className={styles.playerName}>{getPlayerLabel(player.id, playersIndex)}</td>
                <td className={styles.playerNumber}>#{player.number || 'Brak'}</td>
                <td className={styles.playerId} title={player.id}>{player.id.slice(0, 8)}...</td>
                <td>{player.birthYear || '-'}</td>
                <td>{player.position || '-'}</td>
                <td className={styles.playerTeams}>
                  {!player.teams || player.teams.length === 0 ? (
                    <span>—</span>
                  ) : (
                    <ul
                      className={styles.duplicateTeamChips}
                      aria-label="Zespoły zawodnika — przycisk × wypisuje z zespołu"
                    >
                      {(player.teams || []).map((tid) => {
                        const pending = teamRemovalPending === `${player.id}|${tid}`;
                        const tname = teamNamesById[tid] ?? tid;
                        return (
                          <li key={tid} className={styles.duplicateTeamChip}>
                            <span className={styles.duplicateTeamChipName} title={tid}>
                              {tname}
                            </span>
                            <button
                              type="button"
                              className={styles.duplicateTeamRemoveBtn}
                              disabled={pending}
                              aria-label={`Wypisz z zespołu ${tname}`}
                              title="Wypisz zawodnika z tego zespołu"
                              onClick={() => handleRemovePlayerFromTeam(player.id, tid)}
                            >
                              {pending ? '…' : '×'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </td>
                <td
                  className={`${styles.actionsCount} ${styles.principalAssociationsCell} ${player.globalDataTotal === 0 ? styles.noActions : ''}`}
                  title={
                    player.actionsCount > 0
                      ? `Główne źródła (pack+unpack+reg+str+xG+PK): ${player.principalDataTotal}. Pełna suma kontaktów (także minuty, GPS, 8s…): ${player.globalDataTotal}. Wpisów w 4 tablicach (lista po rozwinięciu): ${player.actionsCount}.`
                      : player.globalDataTotal > 0
                        ? `Główne źródła: ${player.principalDataTotal}. Pełna suma kontaktów: ${player.globalDataTotal}. Brak wpisów w 4 tablicach — rozwinięcie listy akcji niedostępne; strzały/PK itd. są policzone w licznikach powyżej.`
                        : "Brak powiązań z danymi w bazie."
                  }
                >
                  <div className={styles.principalCellStack}>
                    <button
                      type="button"
                      onClick={() => togglePlayerActions(player.id)}
                      className={`${styles.actionsButton} ${expandedPlayerIds.has(player.id) ? styles.expanded : ''}`}
                      disabled={player.actionsCount === 0}
                      title={
                        player.actionsCount > 0
                          ? "Rozwiń listę wpisów z 4 tablic akcji w meczach"
                          : player.globalDataTotal > 0
                            ? "Brak wpisów w 4 tablicach — szczegóły liczników Pack / Reg / Str / xG / PK są w wierszu poniżej."
                            : "Brak danych"
                      }
                    >
                      {player.principalDataTotal}
                      {player.actionsCount > 0 && (
                        <span className={styles.expandIcon}>
                          {expandedPlayerIds.has(player.id) ? ' ▼' : ' ▶'}
                        </span>
                      )}
                    </button>
                    <DuplicateGlobalCountsSummary
                      counts={player.globalCounts}
                      isLoading={listaAggregatesLoadingUi}
                    />
                    <DuplicatePerMatchParticipationTable
                      playerId={player.id}
                      rows={lookupPerMatchParticipationRows(
                        perMatchParticipationByPlayerId,
                        player.id,
                      )}
                      matchNamesById={matchNamesById}
                      aggregatesLoading={listaAggregatesLoadingUi}
                    />
                    {player.globalDataTotal > player.principalDataTotal && (
                      <span className={styles.fullContactHint} title="Pozostałe powiązania (minuty, GPS, obrona w akcji, 8s, statystyki w matchData itd.)">
                        +inne: {player.globalDataTotal - player.principalDataTotal}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {player.isDeleted ? (
                    <span className={styles.statusDeleted} title="Zawodnik usunięty">Usunięty</span>
                  ) : (
                    <span className={styles.statusActive}>Aktywny</span>
                  )}
                </td>
                <td>
                  {player.isDeleted ? (
                    <button
                      onClick={() => handleRestorePlayerFromList(player.id)}
                      className={styles.restoreButton}
                      title="Przywróć zawodnika"
                    >
                      ↩️ Przywróć
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDeletePlayerFromList(player.id)}
                        className={styles.deleteButton}
                        title="Usuń zawodnika"
                        disabled={player.globalDataTotal > 0}
                      >
                        🗑️
                      </button>
                      {player.globalDataTotal > 0 && (
                        <span className={styles.deleteWarning} title="Nie można usunąć zawodnika z danymi w bazie (mecze, GPS itd.)">
                          ⚠️
                        </span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Sekcja z rozwiniętymi akcjami */}
        {Array.from(expandedPlayerIds).map(playerId => {
          const player = filteredAndSortedPlayers.find(p => p.id === playerId);
          const playerActions = getPlayerActions(playerId);
          
          if (!player || playerActions.length === 0) return null;

          return (
            <div key={`actions-${playerId}`} className={styles.expandedActionsSection}>
              <div className={styles.actionsHeader}>
                <h3>Akcje zawodnika: {getPlayerLabel(player.id, playersIndex)}</h3>
                <button 
                  onClick={() => togglePlayerActions(playerId)}
                  className={styles.closeActionsButton}
                  title="Zamknij listę akcji"
                >
                  ✕
                </button>
              </div>
              
              <div className={styles.actionsStats}>
                <span>Łącznie akcji: <strong>{playerActions.length}</strong></span>
                <span>
                  Jako nadawca:{' '}
                  <strong>
                    {
                      playerActions.filter(
                        (a) =>
                          normalizeFirestorePlayerId(a.senderId) ===
                          (normalizeFirestorePlayerId(playerId) ?? playerId),
                      ).length
                    }
                  </strong>
                </span>
                <span>
                  Jako odbiorca:{' '}
                  <strong>
                    {
                      playerActions.filter(
                        (a) =>
                          normalizeFirestorePlayerId(a.receiverId) ===
                          (normalizeFirestorePlayerId(playerId) ?? playerId),
                      ).length
                    }
                  </strong>
                </span>
              </div>

              <div className={styles.actionsTable}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Minuta</th>
                      <th>Typ akcji</th>
                      <th>Rola</th>
                      <th>Partner</th>
                      <th>Nazwa meczu</th>
                      <th>Punkty</th>
                      <th>Szczegóły</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerActions.map((action, index) => {
                      const pkm = normalizeFirestorePlayerId(playerId) ?? playerId;
                      const isActionSender = normalizeFirestorePlayerId(action.senderId) === pkm;
                      const partnerId = isActionSender ? action.receiverId : action.senderId;
                      
                      return (
                        <tr key={`${action.id}-${index}`} className={styles.actionRow}>
                          <td className={styles.actionMinute}>{action.minute}'</td>
                          <td className={styles.actionType}>
                            {action.actionType === 'pass' ? '⚽ Podanie' : '🏃 Drybling'}
                          </td>
                          <td className={`${styles.actionRole} ${isActionSender ? styles.sender : styles.receiver}`}>
                            {isActionSender ? '📤 Nadawca' : '📥 Odbiorca'}
                          </td>
                          <td className={styles.actionPartner}>
                            {action.actionType === 'pass' && partnerId
                              ? getPlayerLabel(partnerId, playersIndex, { includeNumber: true })
                              : '-'}
                          </td>
                          <td className={styles.actionMatchName} title={matchNamesById[action.matchId] ?? action.matchId}>
                            {matchNamesById[action.matchId] ?? action.matchId ?? '-'}
                          </td>
                          <td className={`${styles.actionPoints} ${(action.packingPoints || 0) >= 3 ? styles.highPoints : ''}`}>
                            <strong>{action.packingPoints || 0}</strong>
                          </td>
                          <td className={styles.actionDetails}>
                            {action.isP3 && <span className={styles.p3Badge}>P3</span>}
                            {action.isShot && <span className={styles.shotBadge}>🎯 Strzał</span>}
                            {action.isGoal && <span className={styles.goalBadge}>⚽ Gol</span>}
                            {action.isPenaltyAreaEntry && <span className={styles.penaltyBadge}>📦 Pole karne</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className={styles.noResults}>
          <p>Brak zawodników spełniających kryteria wyszukiwania</p>
        </div>
      )}
    </div>
  );
} 
