'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useTeams } from '@/hooks/useTeams';
import { Player, TeamInfo } from '@/types';
import { usePlayersState } from '@/hooks/usePlayersState';
import WiedzaGoalsXgWeights from '@/components/WiedzaGoalsXgWeights/WiedzaGoalsXgWeights';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import styles from './wiedza.module.css';
import toast from 'react-hot-toast';
import SidePanel from '@/components/SidePanel/SidePanel';
import {
  loadWiedzaAnalyzeFromStorage,
  saveWiedzaAnalyzeToStorage,
  sanitizeWiedzaCache,
  type WiedzaAnalyzeCacheV2,
  type WiedzaAnalyzeCacheV3,
  type WiedzaTabId,
} from '@/lib/wiedzaAnalyzeCache';
import WiedzaPackingFlowTab from '@/components/WiedzaPackingFlowTab/WiedzaPackingFlowTab';
import { compactWiedzaMatchForStorage } from '@/lib/wiedzaMatchCompact';
import { getLosesBackAllyCountForDisplay } from '@/lib/losesBackAllyDisplay';
import {
  buildBirthYearMinutePercentagesByTeam,
  weightedMeanBirthYearForTeam,
} from '@/utils/wiedzaBirthYearMinutes';
import PlayerHeatmapPitch from '@/components/PlayerHeatmapPitch/PlayerHeatmapPitch';
import {
  buildAggregatedLosesZoneHeatmap,
  buildAggregatedRegainZoneHeatmap,
  type WiedzaHeatmapHalfFilter,
} from '@/utils/wiedzaZoneHeatmaps';
import {
  buildRegainZonePostWindowStats,
  REGAIN_POST_WINDOW_SECS,
  type RegainPostWindowAgg,
  type RegainPostWindowSec,
} from '@/utils/wiedzaRegainPostWindowByZone';
import { regainPostMapMetricFractionDigits, regainPostMapMetricLabel } from '@/utils/wiedzaRegainMapOverlay';
import {
  summarizeRegainShapeBuckets,
  summarizeLoseShapeBuckets,
} from '@/utils/wiedzaShapeBuckets';

const REGAIN_TABLE_METRIC_COLS: { metric: keyof RegainPostWindowAgg; label: string }[] = [
  { metric: 'eligibleRegains', label: 'n' },
  { metric: 'totalPk', label: 'PK' },
  { metric: 'totalXg', label: 'xG' },
  { metric: 'totalPxt', label: 'PxT' },
  { metric: 'totalXtDelta', label: 'ΣΔxT' },
  { metric: 'totalPackingPoints', label: 'Σ pkt' },
];

type RegainPostTableSort =
  | { kind: 'zone'; dir: 'asc' | 'desc' }
  | { kind: 'metric'; windowSec: RegainPostWindowSec; metric: keyof RegainPostWindowAgg; dir: 'asc' | 'desc' };

type FetchedMatch = TeamInfo & { id: string };

const WIEDZA_TEAM_BAR_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
];

type WindowType = 5 | 8 | 15 | 20;
type MetricType = 'pxt' | 'xg' | 'pk' | 'loses' | 'xtDelta' | 'packPts';
type GroupingType = 'partners' | 'opponents' | 'diff';

export default function WiedzaPage() {
  const { user, isAdmin, userRole, linkedPlayerId, logout } = useAuth();
  const { teams } = useTeams();
  const { players } = usePlayersState();

  // Initialize dates: to = today, from = 3 months ago
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedMatches, setFetchedMatches] = useState<FetchedMatch[]>([]);

  const [activeWindow, setActiveWindow] = useState<WindowType>(8);
  const [activeMetric, setActiveMetric] = useState<MetricType>('pxt');
  const [activeGrouping, setActiveGrouping] = useState<GroupingType>('diff');
  const [activeTab, setActiveTab] = useState<WiedzaTabId>('regains');

  const [wiedzaMapHalf, setWiedzaMapHalf] = useState<WiedzaHeatmapHalfFilter>('all');
  const [wiedzaMapMode, setWiedzaMapMode] = useState<'count' | 'xt'>('count');
  const [wiedzaMapXtSide, setWiedzaMapXtSide] = useState<'attack' | 'defense'>('attack');

  const [regainPostTableSort, setRegainPostTableSort] = useState<RegainPostTableSort>({
    kind: 'metric',
    windowSec: 20,
    metric: 'totalPk',
    dir: 'desc',
  });

  /** Mapa przechwytów: klasyczna vs wartości jak w tabeli „czyste okno”. */
  const [regainMapSource, setRegainMapSource] = useState<'classic' | 'postTable'>('classic');
  const [regainPostMapWindow, setRegainPostMapWindow] = useState<RegainPostWindowSec>(20);
  const [regainPostMapMetric, setRegainPostMapMetric] = useState<keyof RegainPostWindowAgg>('totalPk');
  const [regainMapSelectedZones, setRegainMapSelectedZones] = useState<string[]>([]);
  const [regainPostMapRestrictToSelection, setRegainPostMapRestrictToSelection] = useState(false);
  const regainMapSelectAllRef = useRef<HTMLInputElement>(null);

  const fetchMatchesByFilters = useCallback(
    async (teamIds: string[], from: string, to: string): Promise<FetchedMatch[]> => {
      const chunkSize = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < teamIds.length; i += chunkSize) {
        chunks.push(teamIds.slice(i, i + chunkSize));
      }
      const allFetched: FetchedMatch[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, 'matches'), where('team', 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as TeamInfo;
          let keep = true;
          if (from && data.date < from) keep = false;
          if (to && data.date > to) keep = false;
          if (keep) {
            allFetched.push({ ...data, id: docSnap.id, matchId: docSnap.id });
          }
        });
      }
      return allFetched;
    },
    [],
  );

  /** Stabilny klucz — `teams` często ma nową referencję przy każdym renderze, co psuło wczytanie z localStorage. */
  const teamIdsKey = useMemo(() => [...teams.map((t) => t.id)].sort().join('|'), [teams]);

  const fetchedMatchesLenRef = useRef(0);
  fetchedMatchesLenRef.current = fetchedMatches.length;

  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Ostatni payload do zapisu — flush przy unmount / pagehide, gdy debounce jeszcze nie zdążył. */
  const latestWiedzaPayloadRef = useRef<WiedzaAnalyzeCacheV2 | WiedzaAnalyzeCacheV3 | null>(null);

  /**
   * useLayoutEffect: przed malowaniem — z localStorage tylko filtry (daty, zespoły, zakładka).
   * Mecze nie są przywracane: wykresy i macierze pojawiają się dopiero po „Analizuj” (pobranie z Firestore).
   * Tylko `teamIdsKey` w deps — `teams` ma często nową referencję i powodowałby zbędne przebiegi layoutu.
   */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (teamIdsKey.length === 0) return;
    if (fetchedMatchesLenRef.current > 0) return;

    const cached = loadWiedzaAnalyzeFromStorage();
    if (!cached) return;

    const validIds = new Set(teamsRef.current.map((t) => t.id));
    const sane = sanitizeWiedzaCache(cached, validIds);

    const nextTeams =
      sane.selectedTeams.length > 0
        ? sane.selectedTeams
        : [...new Set(sane.matches.map((m) => m.team))];
    const filteredTeams = nextTeams.filter((id) => validIds.has(id));

    setDateFrom(sane.dateFrom);
    setDateTo(sane.dateTo);
    setSelectedTeams(filteredTeams);
    setActiveTab(sane.activeTab);
    setFetchedMatches([]);

    const hadStoredFilters =
      filteredTeams.length > 0 || sane.matches.length > 0 || cached.v === 2;
    if (hadStoredFilters) {
      toast(
        'Wczytano filtry z zapisu lokalnego. Kliknij „Analizuj”, aby pobrać mecze i zobaczyć analizę.',
        { duration: 7000 },
      );
    }
  }, [teamIdsKey]);

  /**
   * Zapis próby — debounce oszczędza UI; przy unmount / zmianie deps anulowany timer musi wykonać zapis,
   * inaczej odświeżenie strony tuż po „Analizuj” traci dane (Chrome).
   */
  useEffect(() => {
    if (fetchedMatches.length === 0 || typeof window === 'undefined') {
      latestWiedzaPayloadRef.current = null;
      return;
    }
    const payload: WiedzaAnalyzeCacheV3 = {
      v: 3,
      dateFrom,
      dateTo,
      selectedTeams,
      activeTab,
      matches: fetchedMatches.map(compactWiedzaMatchForStorage),
    };
    latestWiedzaPayloadRef.current = payload;
    if (persistTimerRef.current != null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      saveWiedzaAnalyzeToStorage(payload);
    }, 1200);
    return () => {
      if (persistTimerRef.current != null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        const pending = latestWiedzaPayloadRef.current;
        if (pending && pending.selectedTeams.length > 0) {
          saveWiedzaAnalyzeToStorage(pending);
        }
      }
    };
  }, [fetchedMatches, dateFrom, dateTo, selectedTeams, activeTab]);

  /** Ostatnia szansa na zapis przed zamknięciem karty (timer mógł jeszcze nie polecieć). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flush = () => {
      const p = latestWiedzaPayloadRef.current;
      if (p && p.selectedTeams.length > 0) saveWiedzaAnalyzeToStorage(p);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // ------------------------------------------------------------------
  // OBLICZENIA DLA PRZECHWYTÓW
  // ------------------------------------------------------------------
  const regainsData = useMemo(() => {
    if (activeTab !== 'regains' || fetchedMatches.length === 0) return [];

    let rawResults: {
      partners: number;
      opponents: number;
      diff: number;
      pxt: number;
      xg: number;
      pk: number;
      xtDelta: number;
      packingPoints: number;
      hasLose: boolean;
    }[] = [];

    fetchedMatches.forEach(match => {
      const regains = match.actions_regain || [];
      const loses = match.actions_loses || [];
      const packing = match.actions_packing || [];
      const shots = match.shots || [];
      const pkEntries = match.pkEntries || [];

      // Sort events by timestamp
      const sortedLoses = loses
        .filter(l => !l.teamId || l.teamId === match.team)
        .map(l => ({ ...l, t: l.videoTimestampRaw ?? (l.videoTimestamp !== undefined ? l.videoTimestamp + 10 : 0) }))
        .filter(l => l.t > 0)
        .sort((a, b) => a.t - b.t);

      const sortedPacking = packing
        .map(p => ({ ...p, t: p.videoTimestampRaw ?? p.videoTimestamp ?? 0 }))
        .filter(p => p.t > 0)
        .sort((a, b) => a.t - b.t);

      const sortedShots = shots
        .filter(s => s.teamContext === 'attack' || (!s.teamContext && (!s.teamId || s.teamId === match.team)))
        .map(s => ({ ...s, t: s.videoTimestampRaw ?? s.videoTimestamp ?? 0 }))
        .filter(s => s.t > 0)
        .sort((a, b) => a.t - b.t);

      const sortedPkEntries = pkEntries
        .filter(e => e.teamContext === 'attack' || (!e.teamContext && (!e.teamId || e.teamId === match.team)))
        .map(e => ({ ...e, t: e.videoTimestampRaw ?? e.videoTimestamp ?? 0 }))
        .filter(e => e.t > 0)
        .sort((a, b) => a.t - b.t);

      regains.forEach(regain => {
        const t0 = regain.videoTimestampRaw ?? regain.videoTimestamp ?? 0;
        if (t0 <= 0) return;

        const playersBehind = regain.playersBehindBall ?? 0;
        const totalPlayers = regain.totalPlayersOnField ?? 11;
        const playersAhead = totalPlayers - playersBehind;

        const opponentsBehind = regain.opponentsBehindBall ?? 0;
        const totalOpponents = regain.totalOpponentsOnField ?? 11;
        const opponentsAhead = totalOpponents - opponentsBehind;

        // Odrzucamy anomalia: obie drużyny po 0, albo obie po 10
        if ((playersAhead === 0 && opponentsAhead === 0) || (playersAhead === 10 && opponentsAhead === 10)) {
          return;
        }

        const diff = playersAhead - opponentsAhead;

        // Znajdź pierwszą stratę NASZEGO zespołu po tym przechwycie
        const nextLose = sortedLoses.find(l => l.t > t0);
        const tEndLose = nextLose ? nextLose.t : Infinity;
        
        // Granica czasowa to t0 + activeWindow, ale nie dalej niż pierwsza strata
        const tLimit = Math.min(t0 + activeWindow, tEndLose);

        // Oblicz czy wystąpiła strata wewnątrz tego okna (tLimit)
        // Strata wystąpiła w oknie, jeśli jej czas jest <= t0 + activeWindow
        const hasLose = nextLose !== undefined && nextLose.t <= t0 + activeWindow;

        // PxT (Σ ΔxT×pkt), ΣΔxT oraz suma pkt packing w oknie (jak w tabeli stref / packing)
        let sumPxt = 0;
        let sumXtDelta = 0;
        let sumPackingPts = 0;
        sortedPacking.forEach((p) => {
          if (p.t > t0 && p.t <= tLimit) {
            const xtDiff = (p.xTValueEnd || 0) - (p.xTValueStart || 0);
            sumPxt += xtDiff * (p.packingPoints || 0);
            sumXtDelta += xtDiff;
            sumPackingPts += p.packingPoints || 0;
          }
        });

        // Zlicz xG
        let sumXg = 0;
        sortedShots.forEach(s => {
          if (s.t > t0 && s.t <= tLimit) {
            sumXg += Number(s.xG || 0);
          }
        });

        // Zlicz PK
        let countPk = 0;
        sortedPkEntries.forEach(e => {
          if (e.t > t0 && e.t <= tLimit) {
            countPk += 1;
          }
        });

        rawResults.push({
          partners: playersAhead,
          opponents: opponentsAhead,
          diff,
          pxt: sumPxt,
          xg: sumXg,
          pk: countPk,
          xtDelta: sumXtDelta,
          packingPoints: sumPackingPts,
          hasLose,
        });
      });
    });

    return rawResults;
  }, [fetchedMatches, activeWindow, activeTab]);

  // ------------------------------------------------------------------
  // OBLICZENIA DLA STRAT
  // ------------------------------------------------------------------
  const losesData = useMemo(() => {
    if (activeTab !== 'loses' || fetchedMatches.length === 0) return [];

    let rawResults: { partners: number; opponents: number; diff: number; opponentPxt: number; opponentXg: number; opponentPk: number; hasOpponentLose: boolean }[] = [];

    fetchedMatches.forEach(match => {
      const loses = match.actions_loses || [];
      const regains = match.actions_regain || [];
      // Dla strat naszego zespołu, interesują nas akcje z piłką PRZECIWNIKA
      // więc musimy odwrócić perspektywę (strzały i wejścia w PK przeciwnika)
      const packing = match.actions_packing || []; // Niestety nie mamy akcji pakowania przeciwnika w bazie
      const shots = match.shots || [];
      const pkEntries = match.pkEntries || [];

      // Sort events by timestamp
      const sortedRegains = regains
        .map(r => ({ ...r, t: r.videoTimestampRaw ?? (r.videoTimestamp !== undefined ? r.videoTimestamp : 0) }))
        .filter(r => r.t > 0)
        .sort((a, b) => a.t - b.t);

      // Strzały przeciwnika
      const sortedOpponentShots = shots
        .filter(s => s.teamContext === 'defense' || (s.teamId && s.teamId !== match.team))
        .map(s => ({ ...s, t: s.videoTimestampRaw ?? s.videoTimestamp ?? 0 }))
        .filter(s => s.t > 0)
        .sort((a, b) => a.t - b.t);

      // Wejścia w PK przeciwnika
      const sortedOpponentPkEntries = pkEntries
        .filter(e => e.teamContext === 'defense' || (e.teamId && e.teamId !== match.team))
        .map(e => ({ ...e, t: e.videoTimestampRaw ?? e.videoTimestamp ?? 0 }))
        .filter(e => e.t > 0)
        .sort((a, b) => a.t - b.t);

      loses.forEach(lose => {
        // Ignorujemy auty, bo nie niosą takiego zagrożenia
        if (lose.isAut) return;

        // Czas straty to moment kiedy przeciwnik odzyskuje piłkę (zaczyna akcję)
        const t0 = lose.videoTimestampRaw ?? (lose.videoTimestamp !== undefined ? lose.videoTimestamp + 10 : 0);
        if (t0 <= 0) return;

        const playersAhead = getLosesBackAllyCountForDisplay(lose);

        const opponentsBehind = lose.opponentsBehindBall ?? 0;
        const totalOpponents = lose.totalOpponentsOnField ?? 11;
        const opponentsAhead = totalOpponents - opponentsBehind;

        // Odrzucamy anomalia
        if ((playersAhead === 0 && opponentsAhead === 0) || (playersAhead === 10 && opponentsAhead === 10)) {
          return;
        }

        const diff = playersAhead - opponentsAhead;

        // Znajdź NASZ pierwszy regain (przeciwnik traci piłkę) po tej naszej stracie
        const nextRegain = sortedRegains.find(r => r.t > t0);
        const tEndRegain = nextRegain ? nextRegain.t : Infinity;
        
        // Granica czasowa to t0 + activeWindow, ale nie dalej niż nasz następny regain
        const tLimit = Math.min(t0 + activeWindow, tEndRegain);

        // Czy przeciwnik stracił piłkę w tym oknie
        const hasOpponentLose = nextRegain !== undefined && nextRegain.t <= t0 + activeWindow;

        // Dla PxT nie mamy danych z podań przeciwników, ale możemy zasymulować to na razie jako 0 lub pominąć w statystykach

        // Zlicz xG przeciwnika
        let sumXg = 0;
        sortedOpponentShots.forEach(s => {
          if (s.t > t0 && s.t <= tLimit) {
            sumXg += Number(s.xG || 0);
          }
        });

        // Zlicz wejścia w PK przeciwnika
        let countPk = 0;
        sortedOpponentPkEntries.forEach(e => {
          if (e.t > t0 && e.t <= tLimit) {
            countPk += 1;
          }
        });

        rawResults.push({
          partners: playersAhead,
          opponents: opponentsAhead,
          diff,
          opponentPxt: 0, // Aktualnie brak danych z podań przeciwnika
          opponentXg: sumXg,
          opponentPk: countPk,
          hasOpponentLose
        });
      });
    });

    return rawResults;
  }, [fetchedMatches, activeWindow, activeTab]);

  // Grupowanie wyników w buckety
  const chartData = useMemo(() => {
    const dataToUse = activeTab === 'regains' ? regainsData : losesData;
    if (dataToUse.length === 0) return [];

    let buckets: Record<string, { label: string, sortOrder: number, count: number, sumVal: number }> = {};

    const getBucketForDiff = (d: number) => {
      if (d < -2) return { key: '<-2', label: 'Poniżej -2', order: 1 };
      if (d >= -2 && d <= -1) return { key: '-2to-1', label: 'Od -2 do -1', order: 2 };
      if (d === 0) return { key: '0', label: '0 (Równowaga)', order: 3 };
      if (d >= 1 && d <= 2) return { key: '1to2', label: 'Od +1 do +2', order: 4 };
      return { key: '>2', label: 'Powyżej +2', order: 5 };
    };

    const getBucketForPlayers = (p: number) => {
      if (p <= 2) return { key: '1-2', label: '1 - 2', order: 1 };
      if (p >= 3 && p <= 4) return { key: '3-4', label: '3 - 4', order: 2 };
      if (p >= 5 && p <= 6) return { key: '5-6', label: '5 - 6', order: 3 };
      return { key: '7+', label: '7 - 9', order: 4 };
    };

    dataToUse.forEach(item => {
      let bucketInfo;
      if (activeGrouping === 'diff') bucketInfo = getBucketForDiff(item.diff);
      else if (activeGrouping === 'partners') bucketInfo = getBucketForPlayers(item.partners);
      else bucketInfo = getBucketForPlayers(item.opponents);

      if (!buckets[bucketInfo.key]) {
        buckets[bucketInfo.key] = { label: bucketInfo.label, sortOrder: bucketInfo.order, count: 0, sumVal: 0 };
      }

      buckets[bucketInfo.key].count += 1;

      if (activeTab === 'regains') {
        const regainItem = item as (typeof regainsData)[number];
        if (activeMetric === 'pxt') buckets[bucketInfo.key].sumVal += regainItem.pxt;
        else if (activeMetric === 'xg') buckets[bucketInfo.key].sumVal += regainItem.xg;
        else if (activeMetric === 'pk') buckets[bucketInfo.key].sumVal += regainItem.pk;
        else if (activeMetric === 'xtDelta') buckets[bucketInfo.key].sumVal += regainItem.xtDelta;
        else if (activeMetric === 'packPts') buckets[bucketInfo.key].sumVal += regainItem.packingPoints;
        else if (activeMetric === 'loses') buckets[bucketInfo.key].sumVal += regainItem.hasLose ? 1 : 0;
      } else {
        const loseItem = item as any;
        // W stratach "loses" znaczy, że przeciwnik stracił po naszej stracie (czyli my mamy znowu regain)
        if (activeMetric === 'pxt') buckets[bucketInfo.key].sumVal += loseItem.opponentPxt; // Na razie 0
        else if (activeMetric === 'xg') buckets[bucketInfo.key].sumVal += loseItem.opponentXg;
        else if (activeMetric === 'pk') buckets[bucketInfo.key].sumVal += loseItem.opponentPk;
        else if (activeMetric === 'loses') buckets[bucketInfo.key].sumVal += loseItem.hasOpponentLose ? 1 : 0;
      }
    });

    return Object.values(buckets)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(b => ({
        name: b.label,
        count: b.count,
        value: b.count > 0 ? (activeMetric === 'loses' ? (b.sumVal / b.count) * 100 : b.sumVal / b.count) : 0,
      }));

  }, [regainsData, losesData, activeGrouping, activeMetric, activeTab]);

  // Metryki do kart podsumowujących
  const summaryStats = useMemo(() => {
    const dataToUse = activeTab === 'regains' ? regainsData : losesData;
    if (dataToUse.length === 0) return null;
    const total = dataToUse.length;
    
    if (activeTab === 'regains') {
      const avgPxt = regainsData.reduce((s, r) => s + r.pxt, 0) / total;
      const avgXg = regainsData.reduce((s, r) => s + r.xg, 0) / total;
      const avgPk = regainsData.reduce((s, r) => s + r.pk, 0) / total;
      const losePct = (regainsData.filter((r) => r.hasLose).length / total) * 100;
      const avgXtDelta = regainsData.reduce((s, r) => s + r.xtDelta, 0) / total;
      const avgPackingPts = regainsData.reduce((s, r) => s + r.packingPoints, 0) / total;
      return { total, avgPxt, avgXg, avgPk, losePct, avgXtDelta, avgPackingPts };
    } else {
      const avgPxt = losesData.reduce((s, r) => s + r.opponentPxt, 0) / total;
      const avgXg = losesData.reduce((s, r) => s + r.opponentXg, 0) / total;
      const avgPk = losesData.reduce((s, r) => s + r.opponentPk, 0) / total;
      const losePct = (losesData.filter((r) => r.hasOpponentLose).length / total) * 100;
      return { total, avgPxt, avgXg, avgPk, losePct, avgXtDelta: 0, avgPackingPts: 0 };
    }
  }, [regainsData, losesData, activeTab]);

  const regainShapeBucketRows = useMemo(
    () => (activeTab === 'regains' ? summarizeRegainShapeBuckets(regainsData, activeGrouping) : []),
    [activeTab, regainsData, activeGrouping],
  );

  const loseShapeBucketRows = useMemo(
    () => (activeTab === 'loses' ? summarizeLoseShapeBuckets(losesData, activeGrouping) : []),
    [activeTab, losesData, activeGrouping],
  );

  const matchesForCorrelation = useMemo(
    () => fetchedMatches.map((m) => ({ ...m, matchId: m.matchId ?? m.id }) as TeamInfo),
    [fetchedMatches],
  );

  const playersById = useMemo(() => {
    const m = new Map<string, Pick<Player, 'id' | 'birthYear'>>();
    for (const p of players) {
      if (p.isDeleted) continue;
      m.set(p.id, { id: p.id, birthYear: p.birthYear });
    }
    return m;
  }, [players]);

  const birthYearChartModel = useMemo(
    () =>
      selectedTeams.length > 0
        ? buildBirthYearMinutePercentagesByTeam(matchesForCorrelation, playersById, selectedTeams)
        : null,
    [matchesForCorrelation, playersById, selectedTeams],
  );

  const youthSummaryByTeam = useMemo(
    () =>
      selectedTeams.map((tid) => ({
        id: tid,
        label: teams.find((t) => t.id === tid)?.name ?? tid,
        weightedMeanBirthYear: weightedMeanBirthYearForTeam(matchesForCorrelation, playersById, tid),
      })),
    [selectedTeams, teams, matchesForCorrelation, playersById],
  );

  const matchesWithPlayerMinutes = useMemo(
    () => fetchedMatches.filter((m) => (m.playerMinutes?.length ?? 0) > 0).length,
    [fetchedMatches],
  );

  const wiedzaRegainHeatmap = useMemo(
    () =>
      buildAggregatedRegainZoneHeatmap(matchesForCorrelation, wiedzaMapHalf, wiedzaMapMode, wiedzaMapXtSide),
    [matchesForCorrelation, wiedzaMapHalf, wiedzaMapMode, wiedzaMapXtSide],
  );

  const wiedzaLosesHeatmap = useMemo(
    () =>
      buildAggregatedLosesZoneHeatmap(matchesForCorrelation, wiedzaMapHalf, wiedzaMapMode, wiedzaMapXtSide),
    [matchesForCorrelation, wiedzaMapHalf, wiedzaMapMode, wiedzaMapXtSide],
  );

  const regainZonePostWindowRows = useMemo(
    () => buildRegainZonePostWindowStats(matchesForCorrelation),
    [matchesForCorrelation],
  );

  const sortedRegainZonePostWindowRows = useMemo(() => {
    const rows = [...regainZonePostWindowRows];
    if (rows.length === 0) return rows;
    if (regainPostTableSort.kind === 'zone') {
      const m = regainPostTableSort.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => m * a.zone.localeCompare(b.zone, 'pl'));
      return rows;
    }
    const { windowSec, metric, dir } = regainPostTableSort;
    const mul = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = a.byWindow[windowSec][metric];
      const vb = b.byWindow[windowSec][metric];
      const cmp = mul * (va - vb);
      if (cmp !== 0) return cmp;
      return a.zone.localeCompare(b.zone, 'pl');
    });
    return rows;
  }, [regainZonePostWindowRows, regainPostTableSort]);

  const onRegainPostTableSortZone = useCallback(() => {
    setRegainPostTableSort((prev) => {
      if (prev.kind === 'zone') {
        return { kind: 'zone', dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { kind: 'zone', dir: 'asc' };
    });
  }, []);

  const onRegainPostTableSortMetric = useCallback((windowSec: RegainPostWindowSec, metric: keyof RegainPostWindowAgg) => {
    setRegainPostTableSort((prev) => {
      if (prev.kind === 'metric' && prev.windowSec === windowSec && prev.metric === metric) {
        return { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { kind: 'metric', windowSec, metric, dir: 'desc' };
    });
  }, []);

  const regainMapHighlightSet = useMemo(
    () => (regainMapSelectedZones.length > 0 ? new Set(regainMapSelectedZones) : null),
    [regainMapSelectedZones],
  );

  const regainPostWindowPitchMap = useMemo(() => {
    const m = new Map<string, number>();
    const sel = new Set(regainMapSelectedZones);
    const restrict = regainPostMapRestrictToSelection && sel.size > 0;
    for (const row of regainZonePostWindowRows) {
      const raw = row.byWindow[regainPostMapWindow][regainPostMapMetric];
      m.set(row.zone, restrict && !sel.has(row.zone) ? 0 : raw);
    }
    return m;
  }, [
    regainZonePostWindowRows,
    regainPostMapWindow,
    regainPostMapMetric,
    regainMapSelectedZones,
    regainPostMapRestrictToSelection,
  ]);

  const allRegainZonesForMap = useMemo(
    () => regainZonePostWindowRows.map((r) => r.zone),
    [regainZonePostWindowRows],
  );

  const regainMapAllZonesSelected =
    allRegainZonesForMap.length > 0 && regainMapSelectedZones.length === allRegainZonesForMap.length;

  useLayoutEffect(() => {
    const el = regainMapSelectAllRef.current;
    if (!el) return;
    const n = allRegainZonesForMap.length;
    const k = regainMapSelectedZones.length;
    el.indeterminate = n > 0 && k > 0 && k < n;
  }, [allRegainZonesForMap.length, regainMapSelectedZones.length]);

  const onRegainMapToggleSelectAll = useCallback(() => {
    setRegainMapSelectedZones((prev) => (prev.length === allRegainZonesForMap.length ? [] : [...allRegainZonesForMap]));
  }, [allRegainZonesForMap]);

  const toggleRegainMapZone = useCallback((zone: string) => {
    setRegainMapSelectedZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone],
    );
  }, []);

  const regainPitchHeatmapData = useMemo(() => {
    if (activeTab !== 'regains') return wiedzaLosesHeatmap;
    if (regainMapSource === 'postTable') return regainPostWindowPitchMap;
    return wiedzaRegainHeatmap;
  }, [activeTab, regainMapSource, regainPostWindowPitchMap, wiedzaRegainHeatmap, wiedzaLosesHeatmap]);

  const regainPitchMode = useMemo(() => {
    if (activeTab !== 'regains') return wiedzaMapMode === 'xt' ? ('pxt' as const) : ('count' as const);
    if (regainMapSource === 'classic') return wiedzaMapMode === 'xt' ? ('pxt' as const) : ('count' as const);
    return regainPostMapMetricFractionDigits(regainPostMapMetric) === 0 ? ('count' as const) : ('pxt' as const);
  }, [activeTab, regainMapSource, wiedzaMapMode, regainPostMapMetric]);

  const regainPitchValueFractionDigits = useMemo(() => {
    if (activeTab !== 'regains' || regainMapSource !== 'postTable') return null;
    return regainPostMapMetricFractionDigits(regainPostMapMetric);
  }, [activeTab, regainMapSource, regainPostMapMetric]);

  const regainPitchValueLabel = useMemo(() => {
    if (activeTab !== 'regains' || regainMapSource !== 'postTable') return undefined;
    return regainPostMapMetricLabel(regainPostMapMetric, regainPostMapWindow);
  }, [activeTab, regainMapSource, regainPostMapMetric, regainPostMapWindow]);

  const regainPitchDimUnhighlighted = useMemo(
    () =>
      activeTab === 'regains' &&
      regainMapSource === 'postTable' &&
      regainMapSelectedZones.length > 0 &&
      !regainPostMapRestrictToSelection,
    [activeTab, regainMapSource, regainMapSelectedZones.length, regainPostMapRestrictToSelection],
  );

  // If not admin, show nothing or access denied
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

  const handleSelectAllTeams = () => {
    setSelectedTeams(teams.map(t => t.id));
  };

  const handleDeselectAllTeams = () => {
    setSelectedTeams([]);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleAnalyze = async () => {
    if (selectedTeams.length === 0) {
      toast.error('Wybierz co najmniej jeden zespół');
      return;
    }

    setIsLoading(true);

    try {
      const allFetched = await fetchMatchesByFilters(selectedTeams, dateFrom, dateTo);

      setFetchedMatches(allFetched);

      const cachePayload: WiedzaAnalyzeCacheV3 = {
        v: 3,
        dateFrom,
        dateTo,
        selectedTeams,
        activeTab,
        matches: allFetched.map(compactWiedzaMatchForStorage),
      };
      latestWiedzaPayloadRef.current = cachePayload;
      const saveRes = saveWiedzaAnalyzeToStorage(cachePayload);
      if (!saveRes.ok) {
        toast.error(
          saveRes.reason === 'quota'
            ? 'Brak miejsca w przeglądarce — nie zapisano próby lokalnie'
            : 'Nie udało się zapisać próby lokalnie',
        );
      } else if (saveRes.filtersOnly) {
        toast.success(
          `Pobrano ${allFetched.length} meczów. Lokalnie zapisano tylko filtry (nadal za dużo danych) — po odświeżeniu pobierzemy mecze z bazy.`,
          { duration: 9000 },
        );
      } else {
        toast.success(`Pobrano dane z ${allFetched.length} meczów`);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Błąd podczas pobierania danych');
    } finally {
      setIsLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const valueStr =
        activeMetric === 'loses'
          ? `${data.value.toFixed(1)}%`
          : activeMetric === 'packPts'
            ? data.value.toFixed(2)
            : activeMetric === 'pk'
              ? data.value.toFixed(2)
              : data.value.toFixed(3);
      const metricDesc =
        activeMetric === 'pxt'
          ? 'Średni PxT:'
          : activeMetric === 'xg'
            ? activeTab === 'loses'
              ? 'Średnie xG rywala:'
              : 'Średnie xG:'
            : activeMetric === 'pk'
              ? activeTab === 'loses'
                ? 'Średnio wejść PK rywala:'
                : 'Średnio wejść PK:'
              : activeMetric === 'xtDelta'
                ? 'Średni ΣΔxT:'
                : activeMetric === 'packPts'
                  ? 'Średnia suma pkt packing:'
                  : activeTab === 'regains'
                    ? '% Strat:'
                    : '% Naszych przechwytów:';
      return (
        <div className={styles.tooltipCustom}>
          <div className={styles.tooltipLabel}>{label}</div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipDesc}>{metricDesc}</span>
            <span className={styles.tooltipVal}>{valueStr}</span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipDesc}>Liczba {activeTab === 'regains' ? 'przechwytów' : 'strat'} (N):</span>
            <span className={styles.tooltipVal} style={{color: '#4b5563'}}>{data.count}</span>
          </div>
        </div>
      );
    }
    return null;
  };

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
          <h1>🧠 Baza Wiedzy</h1>
        <p>Analiza globalnych trendów na podstawie wszystkich zaznaczonych meczów.</p>
      </div>

      <div className={styles.filtersPanel}>
        <div className={styles.dateFilters}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Data od:</span>
            <input 
              type="date" 
              className={styles.dateInput} 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Data do:</span>
            <input 
              type="date" 
              className={styles.dateInput} 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Zespoły ({selectedTeams.length} wybranych)</span>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            <button type="button" className={styles.toggleButton} onClick={handleSelectAllTeams} style={{background: '#e5e7eb'}}>Zaznacz wszystkie</button>
            <button type="button" className={styles.toggleButton} onClick={handleDeselectAllTeams} style={{background: '#e5e7eb'}}>Odznacz wszystkie</button>
          </div>
          <div className={styles.teamsGrid}>
            {teams.map(team => (
              <label key={team.id} className={styles.teamCheckbox}>
                <input 
                  type="checkbox" 
                  checked={selectedTeams.includes(team.id)}
                  onChange={() => toggleTeam(team.id)}
                />
                {team.name}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button 
            className={styles.primaryButton} 
            onClick={handleAnalyze}
            disabled={isLoading || selectedTeams.length === 0}
          >
            {isLoading ? 'Pobieranie...' : 'Analizuj'}
          </button>
        </div>
        <p className={styles.cacheHint}>
          Zapis lokalny: skrócone dane meczów po „Analizuj” (v3) lub same filtry przy braku miejsca (v2). Po wejściu na
          stronę wczytujemy tylko filtry — wykresy i macierze zobaczysz dopiero po ponownym kliknięciu „Analizuj” (wtedy
          idzie zapytanie do Firestore).
        </p>
      </div>

      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'regains' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('regains');
            if (activeMetric === 'loses' && activeGrouping === 'diff') {
              // Keep settings
            }
          }}
        >
          Wiedza po przechwycie
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'loses' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('loses');
            if (activeMetric === 'pxt' || activeMetric === 'xtDelta' || activeMetric === 'packPts') {
              setActiveMetric('xg');
            }
          }}
        >
          Wiedza po stracie
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'correlations' ? styles.active : ''}`}
          onClick={() => setActiveTab('correlations')}
        >
          Korelacje i Wagi
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'packingZones' ? styles.active : ''}`}
          onClick={() => setActiveTab('packingZones')}
        >
          Strefy PxT / kontakty
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${activeTab === 'youth' ? styles.active : ''}`}
          onClick={() => setActiveTab('youth')}
        >
          Minuty vs rok ur.
        </button>
      </div>

      <div className={styles.contentPanel}>
        {activeTab === 'correlations' ? (
          fetchedMatches.length === 0 ? (
            <div className={styles.correlationMergedPanel}>
              <h2 className={styles.correlationTabTitle}>Korelacje i Wagi</h2>
              <p className={styles.correlationTabLead}>
                Ta zakładka pokazuje <strong>macierz korelacji metryk Wagi</strong> (gole, xG, PxT, suma ΔxT, suma pkt packing,
                przechwyty, straty itd.) — jedna próba to jeden mecz. Po pobraniu danych zobaczysz tu pełny opis i tabelę.
              </p>
              <div className={styles.emptyState} role="status">
                Wybierz zespoły, ustaw zakres dat i kliknij „Analizuj”, aby załadować mecze i wyświetlić macierz.
              </div>
            </div>
          ) : (
            <div className={styles.correlationMergedPanel}>
              <h2 className={styles.correlationTabTitle}>Korelacje i Wagi</h2>
              <p className={styles.correlationTabLead}>
                Jedna próba = jeden mecz. <strong>Macierz korelacji Pearsona</strong> — metryki z{" "}
                <code className={styles.inlineCode}>wiedzaWeightsMetrics.ts</code> (sortowanie wierszy i kolumn). Pierwsze trzy
                wiersze/kolumny: Wygrana, Remis, Przegrana (0/1 z goli); przy korelacji z innymi metrykami zera w tych wierszach nie
                są pomijane jako „brak danych”. „Straty całe b.” tylko MY (bez OPP). Z akcji packing: PxT (Σ ΔxT × pkt), dodatkowo{" "}
                <strong>xT (suma Δ)</strong> oraz <strong>Packing (suma pkt)</strong>. Korelacja <em>r</em>; kolory: zielono{" "}
                <em>r</em> ≥ 0,4, czerwono <em>r</em> ≤ −0,4. Nagłówki: niebieski — MY, bursztynowy — OPP, fioletowy — W/R/P, szary —
                agregat. Przekątna „—”. {selectedTeams.length} klubów, {fetchedMatches.length} meczów.
              </p>
              <WiedzaGoalsXgWeights matches={matchesForCorrelation} compact hideHint />
            </div>
          )
        ) : activeTab === 'packingZones' ? (
          <WiedzaPackingFlowTab matches={matchesForCorrelation} />
        ) : activeTab === 'youth' ? (
          fetchedMatches.length === 0 ? (
            <div className={styles.correlationMergedPanel}>
              <h2 className={styles.correlationTabTitle}>Minuty vs rok urodzenia</h2>
              <p className={styles.correlationTabLead}>
                Wykres pokaże, jaki <strong>udział rozegranych minut</strong> (w wybranym zakresie dat) przypada na poszczególne
                roczniki w każdym zaznaczonym klubie — łatwiej zobaczyć, kto częściej stawia na młodszych zawodników.
              </p>
              <div className={styles.emptyState} role="status">
                Wybierz zespoły, ustaw daty i kliknij „Analizuj”, aby załadować mecze.
              </div>
            </div>
          ) : (
            <div className={styles.correlationMergedPanel}>
              <h2 className={styles.correlationTabTitle}>Minuty vs rok urodzenia</h2>
              <p className={styles.correlationTabLead}>
                Okres: <strong>{dateFrom}</strong> – <strong>{dateTo}</strong>. Dla każdego klubu słupek to{" "}
                <strong>udział % rozegranych minut</strong> wśród zawodników z <strong>znanym rokiem urodzenia</strong> (suma po
                wybranych meczach). Wpisy ze statusem kontuzja / brak powołania / inny klub oraz 0 min są pomijane. Oś X: rok
                urodzenia (większy rok = młodszy zawodnik).{" "}
                <strong>Większy % przy młodszych rocznikach</strong> oznacza większy udział młodzieży w minutach. W próbie:{" "}
                {matchesWithPlayerMinutes} / {fetchedMatches.length} meczów ma zapis <code className={styles.inlineCode}>playerMinutes</code>.
              </p>
              {birthYearChartModel && birthYearChartModel.rows.length > 0 ? (
                <>
                  <div className={styles.youthChartWrap}>
                    <ResponsiveContainer width="100%" height={420}>
                      <BarChart
                        data={birthYearChartModel.rows}
                        margin={{ top: 16, right: 28, left: 8, bottom: 28 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#6b7280', fontSize: 12 }}
                          label={{ value: 'Rok urodzenia', position: 'insideBottom', offset: -18, fill: '#6b7280', fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          domain={[0, 100]}
                          tick={{ fill: '#6b7280', fontSize: 11 }}
                          tickFormatter={(v) => `${v}%`}
                          label={{
                            value: '% minut klubu (znane roczniki)',
                            angle: -90,
                            position: 'insideLeft',
                            offset: 8,
                            fill: '#6b7280',
                            fontSize: 12,
                          }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: '#f3f4f6' }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className={styles.tooltipCustom}>
                                <div className={styles.tooltipLabel}>Rok urodzenia: {label}</div>
                                {payload.map((p) => (
                                  <div key={String(p.dataKey)} className={styles.tooltipRow}>
                                    <span className={styles.tooltipDesc}>{p.name}</span>
                                    <span className={styles.tooltipVal}>
                                      {typeof p.value === 'number' ? `${p.value.toFixed(1)}%` : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: 8 }} />
                        {selectedTeams.map((tid, i) => (
                          <Bar
                            key={tid}
                            dataKey={`pct_${tid}`}
                            name={teams.find((t) => t.id === tid)?.name ?? tid}
                            fill={WIEDZA_TEAM_BAR_COLORS[i % WIEDZA_TEAM_BAR_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={48}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className={styles.youthSummaryGrid} role="list" aria-label="Średni rok urodzenia zważony minutami">
                    {youthSummaryByTeam.map((row) => (
                      <div key={row.id} className={styles.youthSummaryCard} role="listitem">
                        <span className={styles.youthSummaryLabel}>{row.label}</span>
                        <span className={styles.youthSummaryValue}>
                          {row.weightedMeanBirthYear != null
                            ? `Śr. rok ur. (minuty): ${row.weightedMeanBirthYear.toFixed(2)} — wyżej = młodsi na boisku`
                            : 'Brak minut z znanym rokiem ur.'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState} role="status">
                  Brak rozkładu minut według roku urodzenia. Upewnij się, że w meczach są zapisane minuty zawodników oraz że w
                  kartotece mają uzupełniony rok urodzenia.
                </div>
              )}
              {birthYearChartModel &&
              Object.values(birthYearChartModel.unknownMinutesByTeam).some((u) => u > 0) ? (
                <p className={styles.youthFootnote}>
                  Część minut nie ma przypisanego roku (brak zawodnika w bazie lub brak pola rok urodzenia):{' '}
                  {selectedTeams
                    .map((tid) => {
                      const u = birthYearChartModel.unknownMinutesByTeam[tid] ?? 0;
                      if (u <= 0) return null;
                      const nm = teams.find((t) => t.id === tid)?.name ?? tid;
                      return `${nm}: ${Math.round(u)} min`;
                    })
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : null}
            </div>
          )
        ) : (
          <>
            <div className={styles.controlsRow}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Okno czasowe</span>
                <div className={styles.toggleGroup}>
                  {[5, 8, 15, 20].map((w) => (
                    <button 
                      key={w}
                      className={`${styles.toggleButton} ${activeWindow === w ? styles.active : ''}`}
                      onClick={() => setActiveWindow(w as WindowType)}
                    >
                      {w}s
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Badany wymiar</span>
                <div className={styles.toggleGroup}>
                  <button 
                    className={`${styles.toggleButton} ${activeGrouping === 'partners' ? styles.active : ''}`}
                    onClick={() => setActiveGrouping('partners')}
                  >
                    Liczba Partnerów
                  </button>
                  <button 
                    className={`${styles.toggleButton} ${activeGrouping === 'opponents' ? styles.active : ''}`}
                    onClick={() => setActiveGrouping('opponents')}
                  >
                    Liczba Przeciwników
                  </button>
                  <button 
                    className={`${styles.toggleButton} ${activeGrouping === 'diff' ? styles.active : ''}`}
                    onClick={() => setActiveGrouping('diff')}
                  >
                    Różnica / Przewaga
                  </button>
                </div>
              </div>

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Metryka na 1 {activeTab === 'regains' ? 'przechwyt' : 'stratę'}</span>
                <div className={`${styles.toggleGroup} ${styles.metricToggleWrap}`}>
                  {activeTab === 'regains' ? (
                    <button 
                      className={`${styles.toggleButton} ${activeMetric === 'pxt' ? styles.active : ''}`}
                      onClick={() => setActiveMetric('pxt')}
                    >
                      Średni PxT
                    </button>
                  ) : (
                    <button 
                      className={`${styles.toggleButton} ${styles.disabled}`}
                      title="Brak danych o podaniach przeciwnika"
                      disabled
                    >
                      Średni PxT rywala
                    </button>
                  )}
                  <button 
                    className={`${styles.toggleButton} ${activeMetric === 'xg' ? styles.active : ''}`}
                    onClick={() => setActiveMetric('xg')}
                  >
                    Średnie xG {activeTab === 'loses' ? 'rywala' : ''}
                  </button>
                  <button 
                    className={`${styles.toggleButton} ${activeMetric === 'pk' ? styles.active : ''}`}
                    onClick={() => setActiveMetric('pk')}
                  >
                    Wejścia w PK {activeTab === 'loses' ? 'rywala' : ''}
                  </button>
                  {activeTab === 'regains' ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.toggleButton} ${activeMetric === 'xtDelta' ? styles.active : ''}`}
                        onClick={() => setActiveMetric('xtDelta')}
                        title="Suma zmian xT na akcjach packing w oknie (bez mnożenia przez pkt)"
                      >
                        Średni ΣΔxT
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleButton} ${activeMetric === 'packPts' ? styles.active : ''}`}
                        onClick={() => setActiveMetric('packPts')}
                      >
                        Śr. Σ pkt packing
                      </button>
                    </>
                  ) : null}
                  <button 
                    className={`${styles.toggleButton} ${activeMetric === 'loses' ? styles.active : ''}`}
                    onClick={() => setActiveMetric('loses')}
                  >
                    {activeTab === 'regains' ? '% Strat' : '% Naszych przechwytów'}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.heatmapSection}>
              <h3 className={styles.heatmapHead}>
                {activeTab === 'regains'
                  ? 'Mapa przechwytów na boisku'
                  : 'Mapa strat piłki na boisku'}
              </h3>
              <p className={styles.heatmapLead}>
                {activeTab === 'regains' ? (
                  <>
                    Agregacja wszystkich zaznaczonych klubów i meczów z próby (jak wykres poniżej). Ciemniejszy kolor = więcej{' '}
                    {wiedzaMapMode === 'xt' ? 'sumy xT w strefie' : 'przechwytów w strefie'}. Strefa na mapie:{' '}
                    <strong>atak przy przechwycie</strong> (<code className={styles.inlineCode}>regainAttackZone</code> / opposite).
                    Poniżej tabela: po przechwyciu w danej strefie, co dzieje się w <strong>8 s, 12 s i 20 s</strong> — tylko gdy{' '}
                    <strong>w tym oknie nie było straty</strong> naszej drużyny (czasy jak w reszcie Wiedzy: strata z{' '}
                    <code className={styles.inlineCode}>videoTimestampRaw</code> lub videoTimestamp+10). Sumy: wejścia w PK, xG ze
                    strzałów, PxT i ΣΔxT oraz suma pkt packing na akcjach packing w oknie. Zaznacz strefy w tabeli, aby{' '}
                    <strong>podświetlić je na mapie</strong>; przy widoku mapy „Z tabeli” wybierz okno i metrykę jak w nagłówkach tabeli.{' '}
                    <strong>Partnerzy nad piłką</strong> = nasi zawodnicy przed piłką w momencie przechwytu,{' '}
                    <strong>przeciwnicy nad piłką</strong> = ich zawodnicy przed piłką, <strong>różnica</strong> = partnerzy − przeciwnicy.
                    Wykres i tabela zbiorcza poniżej pokazują, jak te trzy podziały wiążą się ze średnim xG, PxT, PK, ΣΔxT, sumą pkt packing
                    i % straty w wybranym oknie czasu po przechwycie.
                  </>
                ) : (
                  <>
                    Agregacja próby jak wyżej. Ciemniejszy kolor = więcej{' '}
                    {wiedzaMapMode === 'xt' ? 'sumy xT w strefie' : 'strat w strefie'}. Strefa: <strong>atak w momencie straty</strong>{' '}
                    (<code className={styles.inlineCode}>losesAttackZone</code>). Te same definicje partnerów / przeciwników / różnicy co przy
                    przechwytach — poniżej tabela: jak układ nad piłką w momencie <strong>naszej straty</strong> wiąże się ze średnim xG i PK rywala
                    oraz z % przypadków, gdy w oknie po stracie znów odbieramy piłkę (nasz przechwyt).
                  </>
                )}
              </p>
              {fetchedMatches.length === 0 ? (
                <p className={styles.heatmapEmptyHint} role="status">
                  Uruchom „Analizuj”, aby zobaczyć rozkład na boisku.
                </p>
              ) : (
                <>
                  <div className={styles.heatmapToolbar}>
                    {activeTab === 'regains' ? (
                      <div className={styles.controlGroup}>
                        <span className={styles.controlLabel}>Źródło mapy</span>
                        <div className={styles.toggleGroup}>
                          <button
                            type="button"
                            className={`${styles.toggleButton} ${regainMapSource === 'classic' ? styles.active : ''}`}
                            onClick={() => setRegainMapSource('classic')}
                          >
                            Klasyczna
                          </button>
                          <button
                            type="button"
                            className={`${styles.toggleButton} ${regainMapSource === 'postTable' ? styles.active : ''}`}
                            onClick={() => setRegainMapSource('postTable')}
                          >
                            Z tabeli (czyste okno)
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {activeTab === 'regains' && regainMapSource === 'postTable' ? (
                      <>
                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Okno na mapie</span>
                          <div className={styles.toggleGroup}>
                            {REGAIN_POST_WINDOW_SECS.map((w) => (
                              <button
                                key={w}
                                type="button"
                                className={`${styles.toggleButton} ${regainPostMapWindow === w ? styles.active : ''}`}
                                onClick={() => setRegainPostMapWindow(w)}
                              >
                                {w}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Metryka na mapie</span>
                          <div className={`${styles.toggleGroup} ${styles.regainPostMapMetricToggles}`}>
                            {REGAIN_TABLE_METRIC_COLS.map((col) => (
                              <button
                                key={col.metric}
                                type="button"
                                className={`${styles.toggleButton} ${regainPostMapMetric === col.metric ? styles.active : ''}`}
                                onClick={() => setRegainPostMapMetric(col.metric)}
                              >
                                {col.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className={styles.regainPostMapRestrictLabel}>
                          <input
                            type="checkbox"
                            className={styles.regainPostMapRestrictCheckbox}
                            checked={regainPostMapRestrictToSelection}
                            onChange={(e) => setRegainPostMapRestrictToSelection(e.target.checked)}
                          />
                          Tylko zaznaczone strefy (reszta 0 na heatmapie)
                        </label>
                      </>
                    ) : (
                      <>
                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Obszar</span>
                          <div className={styles.toggleGroup}>
                            {(
                              [
                                ['all', 'Całe boisko'],
                                ['own', activeTab === 'regains' ? 'Przechwyt: nasza pp.' : 'Strata: nasza pp.'],
                                ['opponent', activeTab === 'regains' ? 'Przechwyt: pp. przec.' : 'Strata: pp. przec.'],
                                ['pm', 'Pole karne'],
                              ] as const
                            ).map(([key, label]) => (
                              <button
                                key={key}
                                type="button"
                                className={`${styles.toggleButton} ${wiedzaMapHalf === key ? styles.active : ''}`}
                                onClick={() => setWiedzaMapHalf(key)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={styles.controlGroup}>
                          <span className={styles.controlLabel}>Wartość w komórce</span>
                          <div className={styles.toggleGroup}>
                            <button
                              type="button"
                              className={`${styles.toggleButton} ${wiedzaMapMode === 'count' ? styles.active : ''}`}
                              onClick={() => setWiedzaMapMode('count')}
                            >
                              Liczba akcji
                            </button>
                            <button
                              type="button"
                              className={`${styles.toggleButton} ${wiedzaMapMode === 'xt' ? styles.active : ''}`}
                              onClick={() => setWiedzaMapMode('xt')}
                            >
                              Suma xT
                            </button>
                          </div>
                        </div>
                        {wiedzaMapMode === 'xt' ? (
                          <div className={styles.controlGroup}>
                            <span className={styles.controlLabel}>xT z perspektywy</span>
                            <div className={styles.toggleGroup}>
                              <button
                                type="button"
                                className={`${styles.toggleButton} ${wiedzaMapXtSide === 'attack' ? styles.active : ''}`}
                                onClick={() => setWiedzaMapXtSide('attack')}
                              >
                                Atak
                              </button>
                              <button
                                type="button"
                                className={`${styles.toggleButton} ${wiedzaMapXtSide === 'defense' ? styles.active : ''}`}
                                onClick={() => setWiedzaMapXtSide('defense')}
                              >
                                Obrona
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                  {activeTab === 'regains' && regainMapSource === 'postTable' ? (
                    <p className={styles.heatmapPostTableHint} role="note">
                      Wartości na boisku odpowiadają tabeli poniżej (te same okna i metryki). Filtr <strong>Obszar</strong> dotyczy
                      wyłącznie widoku klasycznego.
                    </p>
                  ) : null}
                  <div className={styles.heatmapPitchWrap}>
                    <PlayerHeatmapPitch
                      heatmapData={regainPitchHeatmapData}
                      category={activeTab === 'regains' ? 'regains' : 'loses'}
                      mode={regainPitchMode}
                      mirrored={false}
                      highlightedZones={activeTab === 'regains' ? regainMapHighlightSet : null}
                      dimUnhighlighted={regainPitchDimUnhighlighted}
                      valueFractionDigits={regainPitchValueFractionDigits}
                      valueLabel={regainPitchValueLabel}
                    />
                  </div>
                  {activeTab === 'regains' ? (
                    <div className={styles.regainPostWindowBlock}>
                      <h4 className={styles.regainPostWindowTitle}>
                        Strefa przechwytu → PK, xG, PxT, xT i packing (8 s / 12 s / 20 s, bez straty w oknie)
                      </h4>
                      <p className={styles.regainPostWindowLead}>
                        Wiersz = strefa <code className={styles.inlineCode}>regainAttackZone</code>. Dla każdego okna liczymy tylko
                        przechwyty, gdzie pierwsza strata własna jest <strong>po</strong> zakończeniu okna (lub brak straty). W komórkach:{' '}
                        <strong>n</strong> — liczba takich przechwytów, potem sumy w oknie (t₀, t₀+W] jak przy wykresie głównym.{' '}
                        <strong>Kliknij nagłówek kolumny</strong>, aby sortować (ponowne kliknięcie odwraca kolejność). Kolumna z checkboxem:{' '}
                        zaznacz strefy do podświetlenia na mapie (i opcjonalnie do ograniczenia heatmapy przy widoku „Z tabeli”).
                      </p>
                      {regainZonePostWindowRows.length === 0 ? (
                        <p className={styles.regainPostWindowEmpty} role="status">
                          Brak danych (np. brak stref przy przechwytach albo każdy przechwyt ma stratę w pierwszych 20 s).
                        </p>
                      ) : (
                        <div className={styles.regainPostWindowTableWrap} role="region" aria-label="Tabela stref przechwytu i skutków po czasie">
                          <table className={styles.regainPostWindowTable}>
                            <thead>
                              <tr>
                                <th rowSpan={2} scope="col" className={styles.regainPostThMap}>
                                  <input
                                    ref={regainMapSelectAllRef}
                                    type="checkbox"
                                    className={styles.regainPostMapCheckbox}
                                    checked={regainMapAllZonesSelected}
                                    onChange={onRegainMapToggleSelectAll}
                                    aria-label="Zaznacz lub odznacz wszystkie strefy na mapie"
                                  />
                                </th>
                                <th
                                  rowSpan={2}
                                  scope="col"
                                  className={styles.regainPostThZone}
                                  aria-sort={
                                    regainPostTableSort.kind === 'zone'
                                      ? regainPostTableSort.dir === 'asc'
                                        ? 'ascending'
                                        : 'descending'
                                      : 'none'
                                  }
                                >
                                  <button
                                    type="button"
                                    className={styles.regainSortBtn}
                                    onClick={onRegainPostTableSortZone}
                                    aria-label="Sortuj według strefy"
                                  >
                                    Strefa
                                    {regainPostTableSort.kind === 'zone' ? (
                                      <span className={styles.regainSortMark} aria-hidden>
                                        {regainPostTableSort.dir === 'asc' ? ' ▲' : ' ▼'}
                                      </span>
                                    ) : null}
                                  </button>
                                </th>
                                {REGAIN_POST_WINDOW_SECS.map((w) => (
                                  <th key={w} colSpan={6} scope="colgroup" className={styles.regainPostThGroup}>
                                    {w} s (czyste okno)
                                  </th>
                                ))}
                              </tr>
                              <tr>
                                {REGAIN_POST_WINDOW_SECS.flatMap((w) =>
                                  REGAIN_TABLE_METRIC_COLS.map((col) => {
                                    const active =
                                      regainPostTableSort.kind === 'metric' &&
                                      regainPostTableSort.windowSec === w &&
                                      regainPostTableSort.metric === col.metric;
                                    return (
                                      <th
                                        key={`${w}-${String(col.metric)}`}
                                        scope="col"
                                        aria-sort={
                                          active
                                            ? regainPostTableSort.dir === 'asc'
                                              ? 'ascending'
                                              : 'descending'
                                            : 'none'
                                        }
                                      >
                                        <button
                                          type="button"
                                          className={styles.regainSortBtn}
                                          onClick={() => onRegainPostTableSortMetric(w, col.metric)}
                                          aria-label={`Sortuj według ${col.label}, okno ${w} sekund`}
                                        >
                                          {col.label}
                                          {active ? (
                                            <span className={styles.regainSortMark} aria-hidden>
                                              {regainPostTableSort.dir === 'asc' ? ' ▲' : ' ▼'}
                                            </span>
                                          ) : null}
                                        </button>
                                      </th>
                                    );
                                  }),
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {sortedRegainZonePostWindowRows.map((row) => (
                                <tr key={row.zone}>
                                  <td className={styles.regainPostTdMap}>
                                    <input
                                      type="checkbox"
                                      className={styles.regainPostMapCheckbox}
                                      checked={regainMapSelectedZones.includes(row.zone)}
                                      onChange={() => toggleRegainMapZone(row.zone)}
                                      aria-label={`Pokaż strefę ${row.zone} na mapie`}
                                    />
                                  </td>
                                  <th scope="row" className={styles.regainPostThZone}>
                                    {row.zone}
                                  </th>
                                  {REGAIN_POST_WINDOW_SECS.map((w) => {
                                    const a = row.byWindow[w];
                                    return (
                                      <React.Fragment key={w}>
                                        <td>{a.eligibleRegains}</td>
                                        <td>{a.totalPk}</td>
                                        <td>{a.totalXg.toFixed(3)}</td>
                                        <td>{a.totalPxt.toFixed(3)}</td>
                                        <td>{a.totalXtDelta.toFixed(3)}</td>
                                        <td>{a.totalPackingPoints}</td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {activeTab === 'regains' && fetchedMatches.length > 0 ? (
                    <div className={styles.shapeBucketBlock}>
                      <h4 className={styles.shapeBucketTitle}>Skuteczność kontry a układ nad piłką</h4>
                      <p className={styles.shapeBucketLead}>
                        Wiersze = te same przedziały co oś X na wykresie (zależnie od „Badanego wymiaru”). Wartości uśrednione na{' '}
                        <strong>jeden przechwyt</strong> w oknie <strong>{activeWindow}s</strong> po odbiorze piłki (do pierwszej straty lub końca
                        okna). PxT = Σ(ΔxT×pkt), ΣΔxT i Σ pkt — tylko z akcji packing w tym przedziale.
                      </p>
                      {regainShapeBucketRows.length === 0 ? (
                        <p className={styles.shapeBucketEmpty} role="status">
                          Brak przechwytów z poprawnym układem zawodników (nad piłką).
                        </p>
                      ) : (
                        <div className={styles.shapeBucketTableWrap} role="region" aria-label="Tabela skuteczności kontry według układu nad piłką">
                          <table className={styles.shapeBucketTable}>
                            <thead>
                              <tr>
                                <th scope="col">Przedział</th>
                                <th scope="col">n</th>
                                <th scope="col">Śr. PxT</th>
                                <th scope="col">Śr. xG</th>
                                <th scope="col">Śr. PK</th>
                                <th scope="col">Śr. ΣΔxT</th>
                                <th scope="col">Śr. Σ pkt</th>
                                <th scope="col">% strat</th>
                              </tr>
                            </thead>
                            <tbody>
                              {regainShapeBucketRows.map((row) => (
                                <tr key={row.key}>
                                  <th scope="row">{row.label}</th>
                                  <td>{row.n}</td>
                                  <td>{row.avgPxt.toFixed(3)}</td>
                                  <td>{row.avgXg.toFixed(3)}</td>
                                  <td>{row.avgPk.toFixed(2)}</td>
                                  <td>{row.avgXtDelta.toFixed(3)}</td>
                                  <td>{row.avgPackingPts.toFixed(2)}</td>
                                  <td>{row.losePct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {activeTab === 'loses' && fetchedMatches.length > 0 ? (
                    <div className={styles.shapeBucketBlock}>
                      <h4 className={styles.shapeBucketTitle}>Konsekwencje straty a układ nad piłką</h4>
                      <p className={styles.shapeBucketLead}>
                        Te same przedziały co wykres. Średnie liczone na <strong>jedną stratę</strong> w oknie <strong>{activeWindow}s</strong> (do
                        naszego przechwytu lub końca okna). PxT / packing przeciwnika nie są w bazie — tabela ma xG, PK i odzyskanie piłki.
                      </p>
                      {loseShapeBucketRows.length === 0 ? (
                        <p className={styles.shapeBucketEmpty} role="status">
                          Brak strat z poprawnym układem zawodników.
                        </p>
                      ) : (
                        <div className={styles.shapeBucketTableWrap} role="region" aria-label="Tabela skutków straty według układu nad piłką">
                          <table className={styles.shapeBucketTable}>
                            <thead>
                              <tr>
                                <th scope="col">Przedział</th>
                                <th scope="col">n</th>
                                <th scope="col">Śr. xG ryw.</th>
                                <th scope="col">Śr. PK ryw.</th>
                                <th scope="col">% nasz przechwyt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loseShapeBucketRows.map((row) => (
                                <tr key={row.key}>
                                  <th scope="row">{row.label}</th>
                                  <td>{row.n}</td>
                                  <td>{row.avgOpponentXg.toFixed(3)}</td>
                                  <td>{row.avgOpponentPk.toFixed(2)}</td>
                                  <td>{row.regainPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {summaryStats && (
              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryCardLabel}>Próba ({activeTab === 'regains' ? 'Przechwyty' : 'Straty'})</span>
                  <span className={styles.summaryCardValue}>{summaryStats.total}</span>
                </div>
                {activeTab === 'regains' && (
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryCardLabel}>Średni PxT ({activeWindow}s)</span>
                    <span className={styles.summaryCardValue}>{summaryStats.avgPxt.toFixed(3)}</span>
                  </div>
                )}
                <div className={styles.summaryCard}>
                  <span className={styles.summaryCardLabel}>Średnie xG {activeTab === 'loses' ? 'rywala ' : ''}({activeWindow}s)</span>
                  <span className={styles.summaryCardValue}>{summaryStats.avgXg.toFixed(3)}</span>
                </div>
                {activeTab === 'regains' && (
                  <>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Śr. ΣΔxT ({activeWindow}s)</span>
                      <span className={styles.summaryCardValue}>{summaryStats.avgXtDelta.toFixed(3)}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Śr. Σ pkt packing ({activeWindow}s)</span>
                      <span className={styles.summaryCardValue}>{summaryStats.avgPackingPts.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className={styles.summaryCard}>
                  <span className={styles.summaryCardLabel}>{activeTab === 'regains' ? '% Strat' : '% Naszych przechwytów'} ({activeWindow}s)</span>
                  <span className={styles.summaryCardValue}>{summaryStats.losePct.toFixed(1)}%</span>
                </div>
              </div>
            )}

            <div className={styles.chartContainer}>
              {fetchedMatches.length === 0 ? (
                <div className={styles.emptyState} role="status">
                  Wybierz zespoły, ustaw zakres dat i kliknij „Analizuj”, aby pobrać mecze i wyświetlić wykres.
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      dx={-10}
                      tickFormatter={(val) => {
                        if (activeMetric === 'loses') return `${val}%`;
                        if (activeMetric === 'packPts') return Number(val).toFixed(2);
                        if (activeMetric === 'pk') return Number(val).toFixed(2);
                        return Number(val).toFixed(4);
                      }}
                    />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={activeMetric === 'loses' ? (activeTab === 'loses' ? '#10b981' : '#ef4444') : (activeTab === 'loses' ? '#ef4444' : '#3b82f6')} 
                          opacity={entry.count < 5 ? 0.4 : 1} // Mniejsza opacity dla próby < 5
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.emptyState}>Brak danych pasujących do wybranych kryteriów.</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
