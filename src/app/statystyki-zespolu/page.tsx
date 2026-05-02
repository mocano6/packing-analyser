"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Fragment } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ResponsiveRadar } from '@nivo/radar';
import { Action, TeamInfo, Shot } from "@/types";
import { getOppositeXTValueForZone, getZoneName, getXTValueForZone, zoneNameToIndex, zoneNameToString } from "@/constants/xtValues";
import { getXTDifferenceForAction } from "@/utils/pxtFromAction";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { usePlayersState } from "@/hooks/usePlayersState";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "@/lib/firestoreWithMetrics";
import { getCached, setCached } from "@/lib/sessionCache";
import { clearMatchDocumentCache, getOrLoadMatchDocument } from "@/lib/matchDocumentCache";
import Link from "next/link";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import { getCurrentSeason, filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import { isIn1TZoneCanonical, isInOpponent1TZoneCanonical } from "@/utils/pitchZones";
import PlayerHeatmapPitch from "@/components/PlayerHeatmapPitch/PlayerHeatmapPitch";
import XGPitch from "@/components/XGPitch/XGPitch";
import PKEntriesPitch from "@/components/PKEntriesPitch/PKEntriesPitch";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import {
  attachXtToPlayerShareRows,
  countActionsByPlayerId,
  type KpiRegainsLosesPlayersSortCol,
  mapToSortedPlayerShareRows,
  playerStatsSummary,
  sortKpiRegainsLosesPlayerRows,
} from "@/utils/kpiDashboardPlayerShares";
import { filterMatchActionsBySelectedTeam } from "@/utils/filterMatchActionsByTeam";
import { filterActionsByAnalyzedTeamSquad } from "@/utils/filterActionsByTeamSquad";
import {
  count8sCaShotForBreakdown,
  isPkEntryFromRegainSequence,
  isShotFromRegainSequence,
} from "@/utils/kpiRegainSequenceFlags";
import SidePanel from "@/components/SidePanel/SidePanel";
import YouTubeVideo, { YouTubeVideoRef } from "@/components/YouTubeVideo/YouTubeVideo";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { getPkEntryKpiBreakdownCounts, isPkSfgEntry } from "@/lib/pkEntryKpiBreakdown";
import { filterTeamsByUserAccess } from "@/lib/teamsForUserAccess";
import { sumNonPenaltyXg } from "@/lib/xgNonPenalty";
import { calculateXgOutcomeProjection } from "@/utils/xgOutcomeProjection";
import styles from "./statystyki-zespolu.module.css";

/** Spójny zielony / czerwony KPI na tej stronie (wspólny dla wykresów, KPI i akcji). */
const TEAM_STATS_GREEN = '#059669';
const TEAM_STATS_RED = '#dc2626';
const TEAM_STATS_RADAR_REFERENCE = '#6366f1';
/** Linia serii „Wartość” na radarze KPI (jak wcześniej — zielony, nie neutralny szary). */
const TEAM_STATS_RADAR_VALUE_LINE = TEAM_STATS_GREEN;

const GPS_MATCH_DAY_CACHE_TTL_MS = 10 * 60 * 1000;
type KpiMatchPeriod = 'total' | 'firstHalf' | 'secondHalf';

export default function StatystykiZespoluPage() {
  const { teams, isLoading: isTeamsLoading } = useTeams();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, userRole, linkedPlayerId, logout } = useAuth();
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [selectedKpiForVideo, setSelectedKpiForVideo] = useState<string | null>(null);
  const [expandedKpiForPlayers, setExpandedKpiForPlayers] = useState<string | null>(null);
  const [isPlayersListCollapsed, setIsPlayersListCollapsed] = useState<boolean>(true);
  const [selectedPlayerForVideo, setSelectedPlayerForVideo] = useState<string | null>(null);
  const { players } = usePlayersState();
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);
  const { isPresentationMode } = usePresentationMode();
  
  // Resetuj stan zwijania gdy zmienia się wybrane KPI
  useEffect(() => {
    setIsPlayersListCollapsed(false);
  }, [expandedKpiForPlayers]);
  
  const youtubeVideoRef = useRef<YouTubeVideoRef>(null);

  // Filtruj dostępne zespoły — ta sama logika co w TeamsSelector / analyzer
  const availableTeams = useMemo(
    () =>
      filterTeamsByUserAccess(teams, {
        isAdmin,
        allowedTeamIds: userTeams ?? [],
      }),
    [userTeams, isAdmin, teams]
  );
  
  // Konwertuj availableTeams array na format używany w komponencie
  const teamsObject = useMemo(() => {
    const obj: Record<string, { id: string; name: string }> = {};
    availableTeams.forEach(team => {
      obj[team.id] = team;
    });
    return obj;
  }, [availableTeams]);

  // Inicjalizuj selectedTeam z localStorage lub pustym stringiem
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedTeam') || "";
    }
    return "";
  });
  const [isTeamsSelectorExpanded, setIsTeamsSelectorExpanded] = useState(false);
  
  // Ustaw domyślny zespół gdy teams się załadują i zapisz w localStorage
  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeam) {
      const firstTeamId = availableTeams[0].id;
      setSelectedTeam(firstTeamId);
      localStorage.setItem('selectedTeam', firstTeamId);
    }
  }, [availableTeams, selectedTeam]);

  // Zapisuj wybrany zespół w localStorage przy każdej zmianie
  useEffect(() => {
    if (selectedTeam) {
      localStorage.setItem('selectedTeam', selectedTeam);
    }
  }, [selectedTeam]);

  // Wielokrotny wybór meczów; ostatnie zaznaczenie zapamiętywane w localStorage per zespół
  const [selectedMatches, setSelectedMatches] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const team = localStorage.getItem("selectedTeam") || "";
      if (team) {
        const stored = localStorage.getItem(`teamStats_selectedMatches_${team}`);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as unknown;
            if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === "string")) {
              return parsed.length > 0 ? [parsed[0]] : [];
            }
          } catch {
            // ignore
          }
        }
        const legacy = localStorage.getItem("teamStats_selectedMatch") || "";
        if (legacy) return [legacy];
      }
      // fallback: stary globalny klucz (kompatybilność wsteczna)
      const globalStored = localStorage.getItem("teamStats_selectedMatches");
      if (globalStored) {
        try {
          const parsed = JSON.parse(globalStored) as unknown;
          if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === "string")) {
            return parsed.length > 0 ? [parsed[0]] : [];
          }
        } catch {
          // ignore
        }
      }
    }
    return [];
  });
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allRegainActions, setAllRegainActions] = useState<Action[]>([]);
  const [allLosesActions, setAllLosesActions] = useState<Action[]>([]);
  const [allShots, setAllShots] = useState<any[]>([]);
  const [allPKEntries, setAllPKEntries] = useState<any[]>([]);
  const [allAcc8sEntries, setAllAcc8sEntries] = useState<any[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<
    'kpi' | 'pxt' | 'xg' | 'pkEntries' | 'regains' | 'loses' | 'gps' | null
  >(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('statystykiZespolu_expandedCategory');
      if (saved === 'trendy') return 'kpi';
      if (saved && ['kpi', 'pxt', 'xg', 'pkEntries', 'regains', 'loses', 'gps'].includes(saved)) {
        return saved as 'kpi' | 'pxt' | 'xg' | 'pkEntries' | 'regains' | 'loses' | 'gps';
      }
      return 'kpi';
    }
    return 'kpi';
  });

  // Zapisuj wybraną kategorię w localStorage przy każdej zmianie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (expandedCategory) {
        localStorage.setItem('statystykiZespolu_expandedCategory', expandedCategory);
      } else {
        localStorage.removeItem('statystykiZespolu_expandedCategory');
      }
    }
  }, [expandedCategory]);

  // Loguj strukturę akcji po wejściu w zakładkę PxT (do debugowania)
  useEffect(() => {
    if (expandedCategory === 'pxt') {
      console.log('PxT: wszystkie akcje', allActions);
      if (allActions.length > 0) {
        console.log('PxT: przykładowa akcja (pierwsza)', allActions[0]);
      } else {
        console.log('PxT: brak akcji (allActions puste – dane mogą się jeszcze ładować)');
      }
    }
  }, [expandedCategory, allActions]);

  const [selectedSeason, setSelectedSeason] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("teamStats_selectedSeason") || "";
    }
    return "";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("teamStats_selectedSeason", selectedSeason);
    }
  }, [selectedSeason]);

  // Zapisuj ostatnie zaznaczenie meczów w localStorage per zespół (podręczna)
  useEffect(() => {
    if (typeof window !== "undefined" && selectedTeam) {
      const key = `teamStats_selectedMatches_${selectedTeam}`;
      if (selectedMatches.length > 0) {
        localStorage.setItem(key, JSON.stringify(selectedMatches));
      } else {
        localStorage.removeItem(key);
      }
    }
  }, [selectedTeam, selectedMatches]);

  const [selectedMetric, setSelectedMetric] = useState<'pxt' | 'xt' | 'packing'>('pxt');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble' | 'all'>('all');
  const [heatmapMode, setHeatmapMode] = useState<"pxt" | "count">("pxt");
  const [heatmapDirection, setHeatmapDirection] = useState<"from" | "to">("from");
  const [selectedPxtCategory, setSelectedPxtCategory] = useState<"sender" | "receiver" | "dribbler">("sender");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [teamRegainAttackDefenseMode, setTeamRegainAttackDefenseMode] = useState<"attack" | "defense">("defense");
  const [teamRegainHeatmapMode, setTeamRegainHeatmapMode] = useState<"xt" | "count">("xt");
  const [teamLosesAttackDefenseMode, setTeamLosesAttackDefenseMode] = useState<"attack" | "defense">("attack");
  const [teamLosesHeatmapMode, setTeamLosesHeatmapMode] = useState<"xt" | "count">("xt");
  const [losesHalfFilter, setLosesHalfFilter] = useState<"all" | "own" | "opponent" | "pm">("all");
  const [regainHalfFilter, setRegainHalfFilter] = useState<"all" | "own" | "opponent" | "pm">("all");
  const [selectedActionFilter, setSelectedActionFilter] = useState<Array<'p0' | 'p1' | 'p2' | 'p3' | 'p0start' | 'p1start' | 'p2start' | 'p3start' | 'pk' | 'shot' | 'goal'>>([]);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{ playerId: string; playerName: string; zoneName: string } | null>(null);
  const [matchDataPeriod, setMatchDataPeriod] = useState<'total' | 'firstHalf' | 'secondHalf'>('total');
  const [kpiMatchPeriod, setKpiMatchPeriod] = useState<KpiMatchPeriod>('total');
  const [passesExpanded, setPassesExpanded] = useState(false);
  const [xgExpanded, setXgExpanded] = useState(false);
  const [xgExpandedMatchData, setXgExpandedMatchData] = useState(false);
  const [pkEntriesExpandedMatchData, setPkEntriesExpandedMatchData] = useState(false);
  const [possessionExpanded, setPossessionExpanded] = useState(false);
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [kpiShotsRowExpanded, setKpiShotsRowExpanded] = useState(false);
  const [kpiPkRowExpanded, setKpiPkRowExpanded] = useState(false);
  const [kpiP2P3RowExpanded, setKpiP2P3RowExpanded] = useState(false);
  const [kpiRegainsPPRowExpanded, setKpiRegainsPPRowExpanded] = useState(false);
  const [kpiPossessionRowExpanded, setKpiPossessionRowExpanded] = useState(false);
  const [kpiXgRowExpanded, setKpiXgRowExpanded] = useState(false);
  const [kpiXgPlayersModalOpen, setKpiXgPlayersModalOpen] = useState(false);
  const [kpiShotsPlayersModalOpen, setKpiShotsPlayersModalOpen] = useState(false);
  const [kpiPkPlayersModalOpen, setKpiPkPlayersModalOpen] = useState(false);
  const [kpiPxtPlayersModalOpen, setKpiPxtPlayersModalOpen] = useState(false);
  const [kpiPxtPlayersRoles, setKpiPxtPlayersRoles] = useState<{
    sender: boolean;
    receiver: boolean;
    dribbler: boolean;
  }>({ sender: true, receiver: true, dribbler: true });
  const [kpiPxtSort, setKpiPxtSort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'desc' });
  const [kpiP2P3PlayersModalOpen, setKpiP2P3PlayersModalOpen] = useState(false);
  const [kpiRegainsPpPlayersModalOpen, setKpiRegainsPpPlayersModalOpen] = useState(false);
  const [kpiRegainsAllPitchPlayersModalOpen, setKpiRegainsAllPitchPlayersModalOpen] = useState(false);
  const [kpiLosesAllPitchPlayersModalOpen, setKpiLosesAllPitchPlayersModalOpen] = useState(false);
  const [kpiRegainsPpPlayersSort, setKpiRegainsPpPlayersSort] = useState<{
    column: KpiRegainsLosesPlayersSortCol;
    dir: "asc" | "desc";
  }>({ column: null, dir: "desc" });
  const [kpiRegainsAllPitchPlayersSort, setKpiRegainsAllPitchPlayersSort] = useState<{
    column: KpiRegainsLosesPlayersSortCol;
    dir: "asc" | "desc";
  }>({ column: null, dir: "desc" });
  const [kpiLosesAllPitchPlayersSort, setKpiLosesAllPitchPlayersSort] = useState<{
    column: KpiRegainsLosesPlayersSortCol;
    dir: "asc" | "desc";
  }>({ column: null, dir: "desc" });
  const [kpiP2P3Sort, setKpiP2P3Sort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'desc' });
  const [kpiShotsSort, setKpiShotsSort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'desc' });
  const [kpiXgSort, setKpiXgSort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'desc' });
  const [kpiPkSort, setKpiPkSort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'desc' });
  const [kpiPkPlayersRoles, setKpiPkPlayersRoles] = useState<{
    sender: boolean;
    receiver: boolean;
    dribbler: boolean;
  }>({
    sender: true,
    receiver: true,
    dribbler: true,
  });
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [gpsMatchDayExpanded, setGpsMatchDayExpanded] = useState(true);
  const [gpsMatchDayPeriod, setGpsMatchDayPeriod] = useState<'total' | 'firstHalf' | 'secondHalf'>('total');
  const [gpsMatchDayData, setGpsMatchDayData] = useState<Array<{ id: string; playerId: string; playerName: string; firstHalf: Record<string, any>; secondHalf: Record<string, any>; total: Record<string, any> }>>([]);
  const [gpsMatchDayLoading, setGpsMatchDayLoading] = useState(false);
  const [gpsMatchDaySort, setGpsMatchDaySort] = useState<{ column: string | null; dir: 'asc' | 'desc' }>({ column: null, dir: 'asc' });
  const [gpsMatchPositionFilter, setGpsMatchPositionFilter] = useState<string>('all');
  const [gpsMatchValueMode, setGpsMatchValueMode] = useState<'raw' | 'perMinute'>('raw');
  const [xgFilter, setXgFilter] = useState<'all' | 'sfg' | 'open_play'>('all');
  const [xgHalf, setXgHalf] = useState<'all' | 'first' | 'second'>('all');
  const [xgMapFilters, setXgMapFilters] = useState<{
    bodyPart: 'all' | 'foot' | 'foot_left' | 'foot_right' | 'head' | 'other';
    sfg: boolean;
    regain: boolean;
    goal: boolean;
    blocked: boolean;
    onTarget: boolean;
  }>({
    bodyPart: 'all',
    sfg: true,
    regain: true,
    goal: true,
    blocked: true,
    onTarget: true,
  });
  const [selectedPKEntryIdForView, setSelectedPKEntryIdForView] = useState<string | undefined>(undefined);
  const [xgMapModalOpen, setXgMapModalOpen] = useState(false);
  const [pkMapModalOpen, setPkMapModalOpen] = useState(false);
  const [pkEntryTypeFilter, setPkEntryTypeFilter] = useState<"all" | "pass" | "dribble" | "sfg">("all");
  const [matchSelectOpen, setMatchSelectOpen] = useState(false);
  const matchSelectRef = useRef<HTMLDivElement>(null);
  const lastTeamWithMatchesRef = useRef<string>("");
  const [pkOnlyRegain, setPkOnlyRegain] = useState(false);
  const [pkOnlyShot, setPkOnlyShot] = useState(false);
  const [pkOnlyGoal, setPkOnlyGoal] = useState(false);
  const [pkSide, setPkSide] = useState<"attack" | "defense">("attack");
  const [zoneDetails, setZoneDetails] = useState<{
    zoneName: string;
    players: Array<{
      playerId: string;
      playerName: string;
      pxt: number;
      passes: number;
    }>;
  } | null>(null);
  const [selectedLosesZone, setSelectedLosesZone] = useState<string | null>(null);
  const [losesZoneDetails, setLosesZoneDetails] = useState<{
    zoneName: string;
    totalXT: number;
    totalLoses: number;
    players: Array<{
      playerId: string;
      playerName: string;
      losesXT: number;
      loses: number;
      actions: Array<{
        minute: number;
        zone: string;
        isReaction5s?: boolean;
        isAut?: boolean;
        isBadReaction5s?: boolean;
        xT: number;
      }>;
    }>;
  } | null>(null);
  
  const [selectedRegainZone, setSelectedRegainZone] = useState<string | null>(null);
  const [regainZoneDetails, setRegainZoneDetails] = useState<{
    zoneName: string;
    totalXT: number;
    totalRegains: number;
    players: Array<{
      playerId: string;
      playerName: string;
      regainXT: number;
      regains: number;
      actions: Array<{
        minute: number;
        zone: string;
        isBelow8s?: boolean;
        xT: number;
      }>;
    }>;
  } | null>(null);

  // Helpery do filtrów akcji (Start/Koniec)
  const isFilterActive = (filter: 'p0' | 'p1' | 'p2' | 'p3' | 'p0start' | 'p1start' | 'p2start' | 'p3start' | 'pk' | 'shot' | 'goal'): boolean => {
    return Array.isArray(selectedActionFilter) && selectedActionFilter.includes(filter);
  };

  const hasStartFilterSelected = (): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    return filters.some(f => ['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
  };

  const hasEndFilterSelected = (): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    return filters.some(f => ['p0', 'p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
  };

  const matchesSelectedActionFilter = (action: Action): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    if (filters.length === 0) return true;

    const startFilters = filters.filter(f => ['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
    const endFilters = filters.filter(f => ['p0', 'p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));

    let matchesStartFilter = startFilters.length === 0;
    let matchesEndFilter = endFilters.length === 0;

    if (startFilters.length > 0) {
      matchesStartFilter = startFilters.some(filter => {
        if (filter === 'p0start') return action.isP0Start;
        if (filter === 'p1start') return action.isP1Start;
        if (filter === 'p2start') return action.isP2Start;
        if (filter === 'p3start') return action.isP3Start;
        return false;
      });
    }

    if (endFilters.length > 0) {
      const isP0 = action.isP0;
      const isP1 = action.isP1;
      const isP2 = action.isP2;
      const isP3 = action.isP3;
      const isPK = action.isPenaltyAreaEntry;
      const isShot = action.isShot;
      const isGoal = action.isGoal;

      matchesEndFilter = endFilters.some(filter => {
        if (filter === 'p0') return isP0;
        if (filter === 'p1') return isP1;
        if (filter === 'p2') return isP2;
        if (filter === 'p3') return isP3;
        if (filter === 'pk') return isPK;
        if (filter === 'shot') return isShot;
        if (filter === 'goal') return isGoal;
        return false;
      });
    }

    return matchesStartFilter && matchesEndFilter;
  };

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();

  const handleRefreshData = useCallback(async () => {
    if (isRefreshingData) return;
    try {
      setIsRefreshingData(true);
      selectedMatches.forEach((id) => clearMatchDocumentCache(id));
      await forceRefreshFromFirebase(selectedTeam || undefined);
      setRefreshKey((prev) => prev + 1);
    } finally {
      setIsRefreshingData(false);
    }
  }, [isRefreshingData, selectedMatches, selectedTeam, forceRefreshFromFirebase]);

  // Inicjalizuj selectedSeason na najnowszy sezon na podstawie meczów
  useEffect(() => {
    if (allMatches.length === 0) return;
    const seasons = getAvailableSeasonsFromMatches(allMatches);
    if (!selectedSeason) {
      if (seasons.length > 0) {
        setSelectedSeason(seasons[0].id);
      } else {
        setSelectedSeason("all");
      }
      return;
    }
    if (selectedSeason !== "all" && !seasons.some(season => season.id === selectedSeason)) {
      setSelectedSeason(seasons.length > 0 ? seasons[0].id : "all");
    }
  }, [selectedSeason, allMatches]);

  // Pobierz mecze dla wybranego zespołu - tylko przy zmianie zespołu
  useEffect(() => {
    if (selectedTeam) {
      // Nie wymuszaj odświeżenia przy każdej zmianie - używaj normalnego fetchMatches
      fetchMatches(selectedTeam).catch(() => {
        // Silently handle error - UI will show empty state
      });
    }
  }, [selectedTeam]); // Tylko selectedTeam w dependency - bez funkcji żeby uniknąć infinite loop

  // Filtruj mecze według wybranego zespołu i sezonu i sortuj od najnowszych
  const teamMatches = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    const seasonFiltered = selectedSeason ? filterMatchesBySeason(teamFiltered, selectedSeason) : teamFiltered;
    // Zawsze sortuj mecze malejąco po dacie, żeby najnowsze były na górze listy
    return [...seasonFiltered].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [allMatches, selectedTeam, selectedSeason]);

  // Oblicz dostępne sezony na podstawie meczów wybranego zespołu
  const availableSeasons = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeam]);

  // Domyślnie zaznacz ostatni (najnowszy) mecz, gdy brak wyboru lub wybrane nie są już dostępne.
  // Gdy lista meczów jest pusta: nie czyść od razu (dane mogą się ładować po odświeżeniu).
  // Czyść tylko gdy ten sam zespół już wcześniej miał załadowane dane i teraz ma 0 meczów.
  // Przywróć zapamiętane zaznaczenie z localStorage (per zespół), także gdy selectedTeam jeszcze "" (SSR/hydration).
  useEffect(() => {
    const prevTeam = lastTeamWithMatchesRef.current;
    if (selectedTeam) lastTeamWithMatchesRef.current = selectedTeam;

    if (teamMatches.length === 0) {
      if (selectedMatches.length > 0 && prevTeam === selectedTeam && selectedTeam) {
        setSelectedMatches([]);
      }
      return;
    }

    const availableMatchIds = new Set(
      teamMatches
        .map(match => match.matchId)
        .filter((matchId): matchId is string => !!matchId)
    );

    const stillValid = selectedMatches.filter(id => availableMatchIds.has(id));
    if (stillValid.length > 0) {
      const single = [stillValid[0]];
      if (single.length !== selectedMatches.length || selectedMatches[0] !== single[0]) {
        setSelectedMatches(single);
      }
      return;
    }

    // Brak ważnego wyboru — przywróć z localStorage (zespół ze state lub z localStorage przy odświeżeniu)
    const teamForStorage =
      selectedTeam ||
      (typeof window !== "undefined" ? localStorage.getItem("selectedTeam") : null) ||
      "";
    if (typeof window !== "undefined" && teamForStorage) {
      const stored = localStorage.getItem(`teamStats_selectedMatches_${teamForStorage}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (Array.isArray(parsed) && parsed.every((id): id is string => typeof id === "string")) {
            const restoredValid = parsed.filter(id => availableMatchIds.has(id));
            if (restoredValid.length > 0) {
              setSelectedMatches([restoredValid[0]]);
              return;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    const byDateDesc = [...teamMatches].sort((a, b) => {
      const ta = new Date(a.date || 0).getTime();
      const tb = new Date(b.date || 0).getTime();
      return tb - ta;
    });
    const newestMatchId = byDateDesc[0]?.matchId || "";
    if (newestMatchId) setSelectedMatches([newestMatchId]);
  }, [teamMatches, selectedMatches, selectedTeam]);

  // Zamknij dropdown meczu przy kliknięciu poza lub Escape
  useEffect(() => {
    if (!matchSelectOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (matchSelectRef.current && !matchSelectRef.current.contains(e.target as Node)) {
        setMatchSelectOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMatchSelectOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [matchSelectOpen]);

  // Pobierz akcje dla wybranych meczów (łączenie danych z wielu meczów)
  useEffect(() => {
    const loadActionsForMatches = async () => {
      if (selectedMatches.length === 0) {
        setAllActions([]);
        setAllRegainActions([]);
        setAllLosesActions([]);
        setAllShots([]);
        setAllPKEntries([]);
        setAllAcc8sEntries([]);
        return;
      }

      setIsLoadingActions(true);

      try {
        if (!db) {
          setAllActions([]);
          setAllRegainActions([]);
          setAllLosesActions([]);
          setAllShots([]);
          setAllPKEntries([]);
          setAllAcc8sEntries([]);
          return;
        }

        const results = await Promise.all(
          selectedMatches.map((matchId) => getOrLoadMatchDocument(matchId))
        );

        const allActionsList: Action[] = [];
        const allRegainList: Action[] = [];
        const allLosesList: Action[] = [];
        const allShotsList: any[] = [];
        const allPkEntriesList: any[] = [];
        const allAcc8sList: any[] = [];

        for (let i = 0; i < results.length; i++) {
          const matchData = results[i];
          const matchId = selectedMatches[i];
          if (!matchId) continue;

          let packingActions = matchData?.actions_packing || [];
          const legacyMatchIds = [matchId];
          if (matchData?.matchId && matchData.matchId !== matchId) {
            legacyMatchIds.push(matchData.matchId as string);
          }
          if (packingActions.length === 0 && matchId) {
            for (const legacyId of legacyMatchIds) {
              const legacyQuery = query(
                collection(db, "actions_packing"),
                where("matchId", "==", legacyId)
              );
              const legacySnapshot = await getDocs(legacyQuery);
              if (legacySnapshot.docs.length > 0) {
                packingActions = legacySnapshot.docs.map((d) => {
                  const data = d.data();
                  const normalized: Record<string, unknown> = {
                    ...data,
                    id: data.id ?? d.id,
                    matchId,
                    minute: data.minute ?? data.min ?? 0,
                    actionType: data.actionType ?? data.type ?? "pass",
                    packingPoints: data.packingPoints ?? data.packing ?? 0,
                    fromZone: data.fromZone ?? data.startZone,
                    toZone: data.toZone ?? data.endZone,
                    senderId: data.senderId ?? data.playerId ?? "",
                    receiverId: data.receiverId ?? data.receiverPlayerId ?? data.receiver_id ?? undefined,
                  };
                  return normalized as Action;
                });
                break;
              }
            }
          }
          if (packingActions.length > 0 && matchId) {
            packingActions = packingActions.map((a) => {
              const anyA = a as any;
              return {
                ...a,
                matchId,
                minute: a.minute ?? anyA.min ?? 0,
                actionType: a.actionType ?? anyA.type ?? "pass",
                packingPoints: a.packingPoints ?? anyA.packing ?? 0,
                fromZone: a.fromZone ?? anyA.startZone,
                toZone: a.toZone ?? anyA.endZone,
                senderId: a.senderId ?? anyA.playerId ?? "",
                receiverId: a.receiverId ?? anyA.receiverPlayerId ?? anyA.receiver_id ?? undefined,
              };
            });
          }
          if (packingActions.length === 0 && process.env.NODE_ENV === "development") {
            console.warn(`[statystyki-zespolu] Brak akcji dla meczu ${matchId} (doc: ${matchData ? "istnieje" : "null"}, legacy: sprawdzono ${legacyMatchIds.join(", ")})`);
          }
          allActionsList.push(...packingActions);
          if (matchData) {
            allRegainList.push(
              ...(matchData.actions_regain || []).map((action) => ({
                ...action,
                _actionSource: "regain",
              })) as Action[]
            );
            allLosesList.push(
              ...(matchData.actions_loses || []).map((action) => ({
                ...action,
                _actionSource: "loses",
              })) as Action[]
            );
            allShotsList.push(...(matchData.shots || []));
            allPkEntriesList.push(...(matchData.pkEntries || []));
            allAcc8sList.push(...((matchData as any).acc8sEntries || []));
          }
        }

        setAllActions(allActionsList);
        setAllRegainActions(allRegainList);
        setAllLosesActions(allLosesList);
        setAllShots(allShotsList);
        setAllPKEntries(allPkEntriesList);
        setAllAcc8sEntries(allAcc8sList);
      } catch (err) {
        console.error("[statystyki-zespolu] Błąd ładowania akcji:", err);
        setAllActions([]);
        setAllRegainActions([]);
        setAllLosesActions([]);
        setAllShots([]);
        setAllPKEntries([]);
        setAllAcc8sEntries([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadActionsForMatches();
  }, [selectedMatches, selectedTeam, refreshKey]);

  // Przygotuj dane dla wykresów zespołowych
  const teamChartData = useMemo(() => {
    if (allActions.length === 0) return [];

    // Oblicz skumulowane wartości dla zespołu
    const data: any[] = [];
    let cumulativePacking = 0;
    let cumulativePxT = 0;
    let cumulativeXT = 0;
    
    // Sortuj akcje po minutach
    const sortedActions = [...allActions].sort((a, b) => a.minute - b.minute);
    
    sortedActions.forEach((action, index) => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = getXTDifferenceForAction(action);
      const pxtValue = xTDifference * packingPoints;
      
      cumulativePacking += packingPoints;
      cumulativePxT += pxtValue;
      cumulativeXT += xTDifference;
      
      // Dodaj punkt co akcję dla płynnego wykresu
      data.push({
        minute: action.minute,
        actionIndex: index + 1,
        packing: cumulativePacking,
        pxt: cumulativePxT,
        xt: cumulativeXT
      });
    });

    return data;
  }, [allActions]);

  // Przygotuj dane dla wykresu co 5 min
  const teamChartData5Min = useMemo(() => {
    if (allActions.length === 0) return [];

    // Grupuj akcje w przedziały 5-minutowe
    const intervals: { [key: number]: { packing: number; pxt: number; xt: number } } = {};
    
    allActions.forEach(action => {
      const interval = Math.floor(action.minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { packing: 0, pxt: 0, xt: 0 };
      }
      
      const packingPoints = action.packingPoints || 0;
      const xTDifference = getXTDifferenceForAction(action);
      const pxtValue = xTDifference * packingPoints;
      
      intervals[interval].packing += packingPoints;
      intervals[interval].pxt += pxtValue;
      intervals[interval].xt += xTDifference;
    });

    // Konwertuj na tablicę - pokazuj przyrost w przedziale, nie skumulowane
    const data: any[] = [];
    
    // Tworzymy wszystkie przedziały 0-90 minut (co 5 min)
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { packing: 0, pxt: 0, xt: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        minuteValue: i,
        packing: intervalData.packing,
        pxt: intervalData.pxt,
        xt: intervalData.xt
      });
    }

    // Oblicz linię trendu dla PxT (regresja liniowa)
    if (data.length > 1) {
      const n = data.length;
      const sumX = data.reduce((sum, d, i) => sum + i, 0);
      const sumY = data.reduce((sum, d) => sum + d.pxt, 0);
      const sumXY = data.reduce((sum, d, i) => sum + i * d.pxt, 0);
      const sumXX = data.reduce((sum, d, i) => sum + i * i, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return data.map((d, i) => ({
        ...d,
        trendLine: slope * i + intercept,
      }));
    }
    
    return data;
  }, [allActions]);


  // Przygotuj podsumowanie połówek
  const halfTimeStats = useMemo(() => {
    if (allActions.length === 0) return { 
      firstHalf: { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0, xtPerPass: 0, xtPerDribble: 0, packingPerPass: 0, packingPerDribble: 0 }, 
      secondHalf: { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0, xtPerPass: 0, xtPerDribble: 0, packingPerPass: 0, packingPerDribble: 0 } 
    };

    let firstHalf = { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0, xtPerPass: 0, xtPerDribble: 0, packingPerPass: 0, packingPerDribble: 0 };
    let secondHalf = { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0, xtPerPass: 0, xtPerDribble: 0, packingPerPass: 0, packingPerDribble: 0 };

    // Filtruj akcje według wybranego typu (uwzględnij alternatywne nazwy pól z legacy/importu)
    const getActionType = (a: Action) => a.actionType ?? (a as any).type ?? "";
    const filteredActions = allActions.filter(action => {
      const at = getActionType(action);
      if (selectedActionType === 'all') return true;
      if (selectedActionType === 'pass') return at === 'pass' || at === 'podanie';
      if (selectedActionType === 'dribble') return at === 'dribble' || at === 'drybling';
      return true;
    }).filter(action => {
      // Filtruj akcje według wybranych filtrów Start/Koniec
      return matchesSelectedActionFilter(action);
    });

    filteredActions.forEach(action => {
      const packingPoints = (action.packingPoints ?? (action as any).packing ?? 0) as number;
      const xTDifference = getXTDifferenceForAction(action);
      const pxtValue = xTDifference * packingPoints;
      const at = getActionType(action);
      const isPass = at === 'pass' || at === 'podanie';
      const isDribble = at === 'dribble' || at === 'drybling';
      const minute = typeof action.minute === 'number' && Number.isFinite(action.minute)
        ? action.minute
        : Number((action as any).min ?? action.minute ?? 0);
      
      if (minute <= 45) {
        firstHalf.packing += packingPoints;
        firstHalf.pxt += pxtValue;
        firstHalf.xt += xTDifference;
        if (isPass) firstHalf.passCount += 1;
        if (isDribble) firstHalf.dribbleCount += 1;
      } else {
        secondHalf.packing += packingPoints;
        secondHalf.pxt += pxtValue;
        secondHalf.xt += xTDifference;
        if (isPass) secondHalf.passCount += 1;
        if (isDribble) secondHalf.dribbleCount += 1;
      }
    });

    // Oblicz PxT/podanie i PxT/drybling dla każdej połowy
    firstHalf.pxtPerPass = firstHalf.passCount > 0 ? firstHalf.pxt / firstHalf.passCount : 0;
    secondHalf.pxtPerPass = secondHalf.passCount > 0 ? secondHalf.pxt / secondHalf.passCount : 0;
    firstHalf.pxtPerDribble = firstHalf.dribbleCount > 0 ? firstHalf.pxt / firstHalf.dribbleCount : 0;
    secondHalf.pxtPerDribble = secondHalf.dribbleCount > 0 ? secondHalf.pxt / secondHalf.dribbleCount : 0;
    
    // Oblicz xT/podanie i xT/drybling dla każdej połowy
    firstHalf.xtPerPass = firstHalf.passCount > 0 ? firstHalf.xt / firstHalf.passCount : 0;
    secondHalf.xtPerPass = secondHalf.passCount > 0 ? secondHalf.xt / secondHalf.passCount : 0;
    firstHalf.xtPerDribble = firstHalf.dribbleCount > 0 ? firstHalf.xt / firstHalf.dribbleCount : 0;
    secondHalf.xtPerDribble = secondHalf.dribbleCount > 0 ? secondHalf.xt / secondHalf.dribbleCount : 0;
    
    // Oblicz Packing/podanie i Packing/drybling dla każdej połowy
    firstHalf.packingPerPass = firstHalf.passCount > 0 ? firstHalf.packing / firstHalf.passCount : 0;
    secondHalf.packingPerPass = secondHalf.passCount > 0 ? secondHalf.packing / secondHalf.passCount : 0;
    firstHalf.packingPerDribble = firstHalf.dribbleCount > 0 ? firstHalf.packing / firstHalf.dribbleCount : 0;
    secondHalf.packingPerDribble = secondHalf.dribbleCount > 0 ? secondHalf.packing / secondHalf.dribbleCount : 0;

    return { firstHalf, secondHalf };
  }, [allActions, selectedActionType, selectedActionFilter]);

  // Pierwszy wybrany mecz – używany do metadanych (zespół, przeciwnik, isHome, matchData przy jednym meczu)
  const selectedMatchInfo = useMemo(() => {
    const firstId = selectedMatches[0];
    if (!firstId) return undefined;
    return teamMatches.find((match) => match.matchId === firstId);
  }, [teamMatches, selectedMatches]);

  // Zagregowane posiadanie zespołu i przeciwnika z wybranych meczów (dla wskaźników /min posiadania)
  const aggregatedPossession = useMemo(() => {
    let teamMin = 0;
    let opponentMin = 0;
    selectedMatches.forEach((matchId) => {
      const m = teamMatches.find((mm) => mm.matchId === matchId);
      if (!m?.matchData?.possession) return;
      const p = m.matchData.possession;
      const isOurHome = m.team === selectedTeam;
      teamMin += isOurHome
        ? (p.teamFirstHalf ?? 0) + (p.teamSecondHalf ?? 0)
        : (p.opponentFirstHalf ?? 0) + (p.opponentSecondHalf ?? 0);
      opponentMin += isOurHome
        ? (p.opponentFirstHalf ?? 0) + (p.opponentSecondHalf ?? 0)
        : (p.teamFirstHalf ?? 0) + (p.teamSecondHalf ?? 0);
    });
    return { teamMin, opponentMin };
  }, [selectedMatches, teamMatches, selectedTeam]);

  // Etykieta przycisku: jeden mecz – pełna nazwa; wiele – "X meczów" lub pierwszy + ", +N"
  const matchSelectDisplayInfo = useMemo(() => {
    if (selectedMatches.length === 0) {
      if (teamMatches.length === 0) return null;
      const byDateDesc = [...teamMatches].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      return byDateDesc[0] ?? null;
    }
    if (selectedMatches.length === 1 && selectedMatchInfo) return selectedMatchInfo;
    const first = selectedMatchInfo;
    if (first) return { ...first, _multiLabel: `${selectedMatches.length} meczów` as const };
    return null;
  }, [selectedMatchInfo, teamMatches, selectedMatches]);

  // Resetuj wybranego zawodnika gdy zmienia się KPI lub mecz
  useEffect(() => {
    setSelectedPlayerForVideo(null);
  }, [selectedKpiForVideo, selectedMatchInfo]);

  // Pobierz dane GPS „Mecz” (day === "MD") dla daty wybranego meczu
  useEffect(() => {
    const needsGps = expandedCategory === 'gps' || expandedCategory === 'kpi';
    if (!needsGps || !selectedMatchInfo || !selectedTeam || !db || players.length === 0) {
      if (!needsGps) setGpsMatchDayData([]);
      return;
    }
    const matchDate = selectedMatchInfo.date;
    const matchDateStr = typeof matchDate === 'string' && matchDate.includes('T')
      ? matchDate.slice(0, 10)
      : typeof matchDate === 'string'
        ? matchDate
        : '';
    if (!matchDateStr) {
      setGpsMatchDayData([]);
      return;
    }
    const cacheKey = `gps_md_${selectedTeam}_${matchDateStr}`;
    const cached = getCached<typeof gpsMatchDayData>(cacheKey, GPS_MATCH_DAY_CACHE_TTL_MS);
    if (cached && players.length > 0) {
      setGpsMatchDayData(cached);
      setGpsMatchDayLoading(false);
      return;
    }
    setGpsMatchDayLoading(true);
    const gpsRef = collection(db, 'gps');
    (async () => {
      try {
        const provider = 'STATSports';
        let snapshot;
        try {
          snapshot = await getDocs(
            query(
              gpsRef,
              where('teamId', '==', selectedTeam),
              where('date', '==', matchDateStr),
              where('day', '==', 'MD'),
              where('provider', '==', provider)
            )
          );
        } catch {
          // Brak indeksu / stare dane - fallback bez provider
          snapshot = await getDocs(
            query(gpsRef, where('teamId', '==', selectedTeam), where('date', '==', matchDateStr), where('day', '==', 'MD'))
          );
        }

        const list: Array<{
          id: string;
          playerId: string;
          playerName: string;
          firstHalf: Record<string, any>;
          secondHalf: Record<string, any>;
          total: Record<string, any>;
        }> = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            playerId: d.playerId ?? '',
            playerName: getPlayerLabel(d.playerId ?? '', playersIndex),
            firstHalf: d.firstHalf ?? {},
            secondHalf: d.secondHalf ?? {},
            total: d.total ?? {},
          });
        });
        setGpsMatchDayData(list);
        const allNamesResolved = list.length === 0 || list.some((e) => e.playerName !== "Zawodnik usunięty");
        if (allNamesResolved) setCached(cacheKey, list);
      } catch {
        setGpsMatchDayData([]);
      } finally {
        setGpsMatchDayLoading(false);
      }
    })();
  }, [expandedCategory, selectedMatchInfo, selectedTeam, players.length, playersIndex]);

  const pkEntriesSideStats = useMemo(() => {
    // UWAGA: PKEntryModal zapisuje `teamId` jako matchInfo.team (nasz zespół) również dla wpisów przeciwnika,
    // a rozróżnienie "nasze vs przeciwnika" jest realizowane przez `teamContext`:
    // - attack = nasze wejścia
    // - defense = wejścia przeciwnika (czyli nasza obrona)
    const entries = (allPKEntries || [])
      .filter((e: any) => e && e.teamId === selectedTeam)
      .filter((e: any) => (e.teamContext ?? "attack") === pkSide);

    const total = entries.length;
    const goals = entries.filter((e: any) => !!e.isGoal).length;
    const shots = entries.filter((e: any) => !!e.isShot).length;
    const regains = entries.filter((e: any) => !!e.isRegain).length;
    const regainPct = total > 0 ? (regains / total) * 100 : 0;

    const partnersSum = entries.reduce((s: number, e: any) => s + (e.pkPlayersCount ?? 0), 0);
    const oppSum = entries.reduce((s: number, e: any) => s + (e.opponentsInPKCount ?? 0), 0);
    const avgPartners = total > 0 ? partnersSum / total : 0;
    const avgOpponents = total > 0 ? oppSum / total : 0;
    const avgDiffOppMinusPartners = avgOpponents - avgPartners;

    return {
      entries,
      total,
      goals,
      shots,
      regains,
      regainPct,
      avgPartners,
      avgOpponents,
      avgDiffOppMinusPartners,
    };
  }, [allPKEntries, selectedTeam, pkSide]);

  const pkEntriesFilteredForView = useMemo(() => {
    return pkEntriesSideStats.entries.filter((e: any) => {
      if (pkEntryTypeFilter !== "all" && (e.entryType || "pass") !== pkEntryTypeFilter) return false;
      if (pkOnlyRegain && !e.isRegain) return false;
      if (pkOnlyShot && !e.isShot) return false;
      if (pkOnlyGoal && !e.isGoal) return false;
      return true;
    });
  }, [pkEntriesSideStats.entries, pkEntryTypeFilter, pkOnlyRegain, pkOnlyShot, pkOnlyGoal]);

  // Na mapie w modalnym widoku chcemy pokazać wejścia w PK obu zespołów (atak + obrona)
  const pkEntriesFilteredForMap = useMemo(() => {
    const entries = (allPKEntries || []).filter((e: any) => e && e.teamId === selectedTeam);
    return entries.filter((e: any) => {
      if (pkEntryTypeFilter !== "all" && (e.entryType || "pass") !== pkEntryTypeFilter) return false;
      if (pkOnlyRegain && !e.isRegain) return false;
      if (pkOnlyShot && !e.isShot) return false;
      if (pkOnlyGoal && !e.isGoal) return false;
      return true;
    });
  }, [allPKEntries, selectedTeam, pkEntryTypeFilter, pkOnlyRegain, pkOnlyShot, pkOnlyGoal]);

  const selectedPKEntry = useMemo(() => {
    if (!selectedPKEntryIdForView) return null;
    return pkEntriesSideStats.entries.find((e: any) => e.id === selectedPKEntryIdForView) || null;
  }, [pkEntriesSideStats.entries, selectedPKEntryIdForView]);

  useEffect(() => {
    // Po zmianie atak/obrona wyczyść selekcję strzałki, żeby nie wskazywać wpisu z innej strony
    setSelectedPKEntryIdForView(undefined);
  }, [pkSide]);

  // Przygotuj dane dla wykresu skumulowanego xG w czasie (jak w PxT)
  const xgChartData = useMemo(() => {
    if (selectedMatches.length === 0 || allShots.length === 0 || !selectedMatchInfo) return [];

    const isHome = selectedMatchInfo.isHome;
    const teamId = isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent;
    const opponentId = isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;

    // Wykresy nie są filtrowane - pokazują wszystkie strzały
    const filteredShots = allShots;

    // Oblicz skumulowane wartości xG dla zespołu i przeciwnika
    const data: any[] = [];
    let cumulativeTeamXG = 0;
    let cumulativeOpponentXG = 0;
    
    // Sortuj strzały po minutach
    const sortedShots = [...filteredShots].sort((a, b) => a.minute - b.minute);
    
    sortedShots.forEach((shot, index) => {
      const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
        ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
        : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
      
      const xgValue = shot.xG || 0;
      
      if (shotTeamId === teamId) {
        cumulativeTeamXG += xgValue;
      } else if (shotTeamId === opponentId) {
        cumulativeOpponentXG += xgValue;
      }
      
      // Dodaj punkt co strzał dla płynnego wykresu
      data.push({
        minute: shot.minute,
        shotIndex: index + 1,
        teamXG: cumulativeTeamXG,
        opponentXG: cumulativeOpponentXG
      });
    });

    return data;
  }, [allShots, selectedMatches.length, selectedMatchInfo]);

  // Przygotuj dane dla wykresu xG co 5 min
  const xgChartData5Min = useMemo(() => {
    if (selectedMatches.length === 0 || allShots.length === 0 || !selectedMatchInfo) return [];

    const isHome = selectedMatchInfo.isHome;
    const teamId = isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent;
    const opponentId = isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;

    // Wykresy nie są filtrowane - pokazują wszystkie strzały
    const filteredShots = allShots;

    // Grupuj strzały w przedziały 5-minutowe
    const intervals: { [key: number]: { teamXG: number; opponentXG: number } } = {};
    
    filteredShots.forEach(shot => {
      const interval = Math.floor(shot.minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { teamXG: 0, opponentXG: 0 };
      }
      
      const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
        ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
        : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
      
      const xgValue = shot.xG || 0;
      
      if (shotTeamId === teamId) {
        intervals[interval].teamXG += xgValue;
      } else if (shotTeamId === opponentId) {
        intervals[interval].opponentXG += xgValue;
      }
    });

    // Konwertuj na tablicę - pokazuj przyrost w przedziale, nie skumulowane
    const data: any[] = [];
    
    // Tworzymy wszystkie przedziały 0-90 minut (co 5 min)
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { teamXG: 0, opponentXG: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        minuteValue: i,
        teamXG: intervalData.teamXG,
        opponentXG: intervalData.opponentXG
      });
    }
    
    return data;
  }, [allShots, selectedMatches.length, selectedMatchInfo]);

  // Funkcja pomocnicza do klasyfikacji stref
  const isLateralZone = (zoneName: string | null | undefined): boolean => {
    if (!zoneName) return false;
    const normalized = typeof zoneName === 'string' 
      ? zoneName.toUpperCase().replace(/\s+/g, '') 
      : String(zoneName).toUpperCase().replace(/\s+/g, '');
    const letter = normalized.charAt(0);
    return letter === 'A' || letter === 'B' || letter === 'G' || letter === 'H';
  };

  // Funkcja pomocnicza do konwersji strefy na nazwę
  const convertZoneToName = (zone: string | number | null | undefined): string | null => {
    if (!zone) return null;
    const normalized = typeof zone === 'string' 
      ? zone.toUpperCase().replace(/\s+/g, '') 
      : String(zone).toUpperCase().replace(/\s+/g, '');
    return normalized;
  };

  // Definicja połowy boiska dla tego widoku: 1-6 własna, 7+ połowa przeciwnika.
  const isOwnHalfByZoneColumn = (zoneName: string | null | undefined): boolean => {
    const normalized = convertZoneToName(zoneName);
    if (!normalized) return false;
    const col = Number.parseInt(normalized.slice(1), 10);
    if (!Number.isFinite(col)) return false;
    return col <= 6;
  };

  const getOppositeZoneName = (zoneName: string): string | null => {
    const zoneIndex = zoneNameToIndex(zoneName);
    if (zoneIndex === null) return null;
    const row = Math.floor(zoneIndex / 12);
    const col = zoneIndex % 12;
    const oppositeRow = 7 - row;
    const oppositeCol = 11 - col;
    const oppositeIndex = oppositeRow * 12 + oppositeCol;
    const oppositeZoneName = getZoneName(oppositeIndex);
    return oppositeZoneName ? zoneNameToString(oppositeZoneName) : null;
  };

  const isLosesAction = (action: any): boolean => {
    if (action?.actionType === 'regain' || action?.isRegain === true) return false;
    const actionSource = action?._actionSource;
    if (actionSource) {
      return actionSource === 'lose' || actionSource === 'loses' || actionSource === 'loss';
    }
    if (action?.actionType === 'lose' || action?.actionType === 'loses' || action?.actionType === 'loss') return true;
    
    if (action._collection === 'regains' || action._collectionName === 'regains' || action.collectionName === 'regains') return false;
    if (action._collection === 'loses' || action._collectionName === 'loses' || action.collectionName === 'loses') return true;
    
    // Używamy tej samej logiki co w getActionCategory (src/utils/actionCategory.ts)
    if (
      action.isReaction5s !== undefined ||
      action.losesOppRosterSquadTallyF1 !== undefined ||
      action.losesBackAllyCount !== undefined ||
      action.isAut !== undefined ||
      action.isBadReaction5s !== undefined ||
      action.losesAttackZone !== undefined ||
      action.losesDefenseZone !== undefined ||
      action.losesAttackXT !== undefined ||
      action.losesDefenseXT !== undefined
    ) {
      return true;
    }
    
    return false;
  };

  const isRegainAction = (action: any): boolean => {
    if (
      action.isReaction5s !== undefined ||
      action.losesOppRosterSquadTallyF1 !== undefined ||
      action.losesBackAllyCount !== undefined
    ) {
      return false;
    }
    if (action?.actionType === 'lose' || action?.actionType === 'loses' || action?.actionType === 'loss') return false;
    if (action?.actionType === 'regain') return true;
    if (action?.isRegain === true) return true;
    const actionSource = action?._actionSource;
    if (actionSource) {
      return actionSource === 'regain';
    }
    
    if (action._collection === 'loses' || action._collectionName === 'loses' || action.collectionName === 'loses') return false;
    if (action._collection === 'regains' || action._collectionName === 'regains' || action.collectionName === 'regains') return true;
    
    // Używamy tej samej logiki co w getActionCategory (src/utils/actionCategory.ts)
    if (
      action.regainAttackZone !== undefined ||
      action.regainDefenseZone !== undefined ||
      action.regainAttackXT !== undefined ||
      action.regainDefenseXT !== undefined ||
      action.regainOppRosterSquadTallyF1 !== undefined ||
      action.receptionBackAllyCount !== undefined ||
      action.playersBehindBall !== undefined ||
      action.opponentsBehindBall !== undefined ||
      action.totalPlayersOnField !== undefined ||
      action.totalOpponentsOnField !== undefined ||
      action.playersLeftField !== undefined ||
      action.opponentsLeftField !== undefined
    ) {
      return true;
    }
    
    return false;
  };

  /** Strefa ataku przechwytu do mapy / liczników widocznych — jak przy filtrze PM (fallback toZone/endZone). */
  const regainAttackZoneRawForMap = (action: Action): string | undefined =>
    action.regainAttackZone || action.oppositeZone || action.toZone || action.endZone || undefined;

  const teamActions = useMemo(() => {
    if (!selectedTeam) return allActions;
    return allActions.filter(action => !action.teamId || action.teamId === selectedTeam);
  }, [allActions, selectedTeam]);

  const teamRegainActions = useMemo(() => {
    const byTeam = filterMatchActionsBySelectedTeam(allRegainActions, selectedTeam);
    const bySquad = filterActionsByAnalyzedTeamSquad(byTeam, selectedTeam, players);
    const firstMatchId = selectedMatches[0];
    const selectedMatch = firstMatchId ? teamMatches.find((m) => m.matchId === firstMatchId) : undefined;
    const playerMinutesIds = new Set(
      (selectedMatch?.playerMinutes ?? [])
        .map((pm) => pm.playerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    if (playerMinutesIds.size === 0) return bySquad;
    const byPlayerMinutes = bySquad.filter((a) => Boolean(a.senderId) && playerMinutesIds.has(a.senderId));
    return byPlayerMinutes.length > 0 ? byPlayerMinutes : bySquad;
  }, [allRegainActions, selectedTeam, players, selectedMatches, teamMatches]);

  const teamLosesActions = useMemo(() => {
    const byTeam = filterMatchActionsBySelectedTeam(allLosesActions, selectedTeam);
    const bySquad = filterActionsByAnalyzedTeamSquad(byTeam, selectedTeam, players);
    const firstMatchId = selectedMatches[0];
    const selectedMatch = firstMatchId ? teamMatches.find((m) => m.matchId === firstMatchId) : undefined;
    const playerMinutesIds = new Set(
      (selectedMatch?.playerMinutes ?? [])
        .map((pm) => pm.playerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    if (playerMinutesIds.size === 0) return bySquad;
    const byPlayerMinutes = bySquad.filter((a) => Boolean(a.senderId) && playerMinutesIds.has(a.senderId));
    return byPlayerMinutes.length > 0 ? byPlayerMinutes : bySquad;
  }, [allLosesActions, selectedTeam, players, selectedMatches, teamMatches]);

  const derivedRegainActions = useMemo(() => {
    if (allRegainActions.length > 0) return teamRegainActions;
    return teamActions.filter((action) => isRegainAction(action));
  }, [allRegainActions, teamRegainActions, teamActions]);

  const derivedLosesActions = useMemo(() => {
    if (allLosesActions.length > 0) return teamLosesActions;
    return teamActions.filter((action) => isLosesAction(action));
  }, [allLosesActions, teamLosesActions, teamActions]);

  // Oblicz statystyki zespołu
  const teamStats = useMemo(() => {
    if (allActions.length === 0) {
      return {
        totalPxT: 0,
        totalxG: 0,
        totalRegains: 0,
        totalLoses: 0,
        totalPKEntries: 0,
        totalMinutes: 90,
        pxtPer90: 0,
        xgPer90: 0,
        regainsPer90: 0,
        losesPer90: 0,
        pkEntriesPer90: 0,
        regainsFirstHalf: 0,
        regainsSecondHalf: 0,
        losesFirstHalf: 0,
        losesSecondHalf: 0,
        // Szczegółowe statystyki PxT
        pxtAsSender: 0,
        pxtAsReceiver: 0,
        pxtAsDribbler: 0,
        senderActionsCount: 0,
        receiverActionsCount: 0,
        dribblingActionsCount: 0,
        senderPassCount: 0,
        receiverPassCount: 0,
        // Liczniki akcji jako podający
        senderP0StartCount: 0,
        senderP1StartCount: 0,
        senderP2StartCount: 0,
        senderP3StartCount: 0,
        senderP0StartCountLateral: 0,
        senderP0StartCountCentral: 0,
        senderP1StartCountLateral: 0,
        senderP1StartCountCentral: 0,
        senderP2StartCountLateral: 0,
        senderP2StartCountCentral: 0,
        senderP3StartCountLateral: 0,
        senderP3StartCountCentral: 0,
        senderP0Count: 0,
        senderP1Count: 0,
        senderP2Count: 0,
        senderP3Count: 0,
        senderPKCount: 0,
        senderShotCount: 0,
        senderGoalCount: 0,
        senderP0CountLateral: 0,
        senderP0CountCentral: 0,
        senderP1CountLateral: 0,
        senderP1CountCentral: 0,
        senderP2CountLateral: 0,
        senderP2CountCentral: 0,
        senderP3CountLateral: 0,
        senderP3CountCentral: 0,
        senderPKCountLateral: 0,
        senderPKCountCentral: 0,
        senderShotCountLateral: 0,
        senderShotCountCentral: 0,
        senderGoalCountLateral: 0,
        senderGoalCountCentral: 0,
        // Liczniki akcji jako przyjmujący
        receiverP0Count: 0,
        receiverP1Count: 0,
        receiverP2Count: 0,
        receiverP3Count: 0,
        receiverPKCount: 0,
        receiverShotCount: 0,
        receiverGoalCount: 0,
        receiverP0CountLateral: 0,
        receiverP0CountCentral: 0,
        receiverP1CountLateral: 0,
        receiverP1CountCentral: 0,
        receiverP2CountLateral: 0,
        receiverP2CountCentral: 0,
        receiverP3CountLateral: 0,
        receiverP3CountCentral: 0,
        receiverPKCountLateral: 0,
        receiverPKCountCentral: 0,
        receiverShotCountLateral: 0,
        receiverShotCountCentral: 0,
        receiverGoalCountLateral: 0,
        receiverGoalCountCentral: 0,
        // Liczniki akcji z dryblingu
        dribblingP0Count: 0,
        dribblingP1Count: 0,
        dribblingP2Count: 0,
        dribblingP3Count: 0,
        dribblingPKCount: 0,
        dribblingShotCount: 0,
        dribblingGoalCount: 0,
        dribblingP0CountLateral: 0,
        dribblingP0CountCentral: 0,
        dribblingP1CountLateral: 0,
        dribblingP1CountCentral: 0,
        dribblingP2CountLateral: 0,
        dribblingP2CountCentral: 0,
        dribblingP3CountLateral: 0,
        dribblingP3CountCentral: 0,
        dribblingPKCountLateral: 0,
        dribblingPKCountCentral: 0,
        dribblingShotCountLateral: 0,
        dribblingShotCountCentral: 0,
        dribblingGoalCountLateral: 0,
        dribblingGoalCountCentral: 0,
      };
    }

    let totalPxT = 0;
    let totalxG = 0;
    let totalRegains = 0;
    let totalLoses = 0;
    let totalPKEntries = 0;
    let regainsFirstHalf = 0;
    let regainsSecondHalf = 0;
    let losesFirstHalf = 0;
    let losesSecondHalf = 0;

    // Szczegółowe statystyki PxT
    let pxtAsSender = 0;
    let pxtAsReceiver = 0;
    let pxtAsDribbler = 0;
    let senderActionsCount = 0;
    let receiverActionsCount = 0;
    let dribblingActionsCount = 0;
    let senderPassCount = 0;
    let receiverPassCount = 0;

    // Liczniki akcji jako podający
    let senderP0StartCount = 0;
    let senderP1StartCount = 0;
    let senderP2StartCount = 0;
    let senderP3StartCount = 0;
    let senderP0StartCountLateral = 0;
    let senderP0StartCountCentral = 0;
    let senderP1StartCountLateral = 0;
    let senderP1StartCountCentral = 0;
    let senderP2StartCountLateral = 0;
    let senderP2StartCountCentral = 0;
    let senderP3StartCountLateral = 0;
    let senderP3StartCountCentral = 0;
    let senderP0Count = 0;
    let senderP1Count = 0;
    let senderP2Count = 0;
    let senderP3Count = 0;
    let senderPKCount = 0;
    let senderShotCount = 0;
    let senderGoalCount = 0;
    let senderP0CountLateral = 0;
    let senderP0CountCentral = 0;
    let senderP1CountLateral = 0;
    let senderP1CountCentral = 0;
    let senderP2CountLateral = 0;
    let senderP2CountCentral = 0;
    let senderP3CountLateral = 0;
    let senderP3CountCentral = 0;
    let senderPKCountLateral = 0;
    let senderPKCountCentral = 0;
    let senderShotCountLateral = 0;
    let senderShotCountCentral = 0;
    let senderGoalCountLateral = 0;
    let senderGoalCountCentral = 0;

    // Liczniki akcji jako przyjmujący
    let receiverP0Count = 0;
    let receiverP1Count = 0;
    let receiverP2Count = 0;
    let receiverP3Count = 0;
    let receiverPKCount = 0;
    let receiverShotCount = 0;
    let receiverGoalCount = 0;
    let receiverP0CountLateral = 0;
    let receiverP0CountCentral = 0;
    let receiverP1CountLateral = 0;
    let receiverP1CountCentral = 0;
    let receiverP2CountLateral = 0;
    let receiverP2CountCentral = 0;
    let receiverP3CountLateral = 0;
    let receiverP3CountCentral = 0;
    let receiverPKCountLateral = 0;
    let receiverPKCountCentral = 0;
    let receiverShotCountLateral = 0;
    let receiverShotCountCentral = 0;
    let receiverGoalCountLateral = 0;
    let receiverGoalCountCentral = 0;

    // Liczniki akcji z dryblingu
    let dribblingP0Count = 0;
    let dribblingP1Count = 0;
    let dribblingP2Count = 0;
    let dribblingP3Count = 0;
    let dribblingPKCount = 0;
    let dribblingShotCount = 0;
    let dribblingGoalCount = 0;
    let dribblingP0CountLateral = 0;
    let dribblingP0CountCentral = 0;
    let dribblingP1CountLateral = 0;
    let dribblingP1CountCentral = 0;
    let dribblingP2CountLateral = 0;
    let dribblingP2CountCentral = 0;
    let dribblingP3CountLateral = 0;
    let dribblingP3CountCentral = 0;
    let dribblingPKCountLateral = 0;
    let dribblingPKCountCentral = 0;
    let dribblingShotCountLateral = 0;
    let dribblingShotCountCentral = 0;
    let dribblingGoalCountLateral = 0;
    let dribblingGoalCountCentral = 0;

    // Przechwyty i straty licz z derivedRegainActions i derivedLosesActions
    derivedRegainActions.forEach(action => {
      const actionMinute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      const hasMinute = Number.isFinite(actionMinute);

      totalRegains += 1;
      if (hasMinute) {
        if (actionMinute <= 45) {
          regainsFirstHalf += 1;
        } else {
          regainsSecondHalf += 1;
        }
      }
    });

    derivedLosesActions.forEach(action => {
      const actionMinute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      const hasMinute = Number.isFinite(actionMinute);

      totalLoses += 1;
      if (hasMinute) {
        if (actionMinute <= 45) {
          losesFirstHalf += 1;
        } else {
          losesSecondHalf += 1;
        }
      }
    });

    // Oblicz PxT z akcji
    // WAŻNE: Liczniki są obliczane tylko dla akcji z wybranej kategorii (selectedPxtCategory),
    // aby zgadzały się z heatmapą
    const getActionTypeForStats = (a: Action) => a.actionType ?? (a as any).type ?? "";
    allActions.forEach(action => {
      const at = getActionTypeForStats(action);
      // Filtruj akcje według kategorii (tak jak w heatmapie) – uwzględnij alternatywne nazwy
      if (selectedPxtCategory === 'dribbler' && at !== 'dribble' && at !== 'drybling') return;
      if (selectedPxtCategory !== 'dribbler' && (at === 'dribble' || at === 'drybling')) return;
      if (!matchesSelectedActionFilter(action)) return;
      
      const packingPoints = (action.packingPoints ?? (action as any).packing ?? 0) as number;
      const xTDifference = getXTDifferenceForAction(action);
      const pxtValue = xTDifference * packingPoints;

      const isDribble = at === 'dribble' || at === 'drybling';
      const isPass = at === 'pass' || at === 'podanie';

      // PxT jako podający (sender) - tylko jeśli selectedPxtCategory === 'sender'
      if (selectedPxtCategory === 'sender' && isPass && action.senderId) {
        pxtAsSender += pxtValue;
        totalPxT += pxtValue; // Zwiększ totalPxT tylko dla akcji sender
        senderActionsCount += 1;
        senderPassCount += 1;

        // Użyj tej samej strefy co heatmapa - jeśli heatmapDirection === 'from', użyj strefy źródłowej, w przeciwnym razie docelowej
        const senderZoneName = heatmapDirection === "from" 
          ? convertZoneToName(action.fromZone || action.startZone)
          : convertZoneToName(action.toZone ?? action.endZone ?? undefined);

        const startZoneName = convertZoneToName(action.fromZone || action.startZone);

        const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
        const startFilters = filters.filter(f => ['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
        const endFilters = filters.filter(f => ['p0', 'p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));

        let matchesStartFilterForCounts = startFilters.length === 0;
        let matchesEndFilterForCounts = endFilters.length === 0;

        if (startFilters.length > 0) {
          matchesStartFilterForCounts = startFilters.some(filter => {
            if (filter === 'p0start') return action.isP0Start;
            if (filter === 'p1start') return action.isP1Start;
            if (filter === 'p2start') return action.isP2Start;
            if (filter === 'p3start') return action.isP3Start;
            return false;
          });
        }

        if (endFilters.length > 0) {
          const isP0 = action.isP0;
          const isP1 = action.isP1;
          const isP2 = action.isP2;
          const isP3 = action.isP3;
          const isPK = action.isPenaltyAreaEntry;
          const isShot = action.isShot;
          const isGoal = action.isGoal;

          matchesEndFilterForCounts = endFilters.some(filter => {
            if (filter === 'p0') return isP0;
            if (filter === 'p1') return isP1;
            if (filter === 'p2') return isP2;
            if (filter === 'p3') return isP3;
            if (filter === 'pk') return isPK;
            if (filter === 'shot') return isShot;
            if (filter === 'goal') return isGoal;
            return false;
          });
        }

        const matchesFiltersForEndCounts =
          (startFilters.length > 0 && endFilters.length > 0)
            ? (matchesStartFilterForCounts && matchesEndFilterForCounts)
            : (startFilters.length > 0 ? matchesStartFilterForCounts : matchesEndFilterForCounts);

        // Miejsca startowe (P0-P3 Start) – zawsze używamy strefy startowej
        if (startZoneName && senderZoneName) {
          const startZoneIsLateral = isLateralZone(startZoneName);
          const matchesEndFilterForStartCounts = endFilters.length === 0 || matchesEndFilterForCounts;

          if (action.isP0Start && matchesEndFilterForStartCounts) {
            senderP0StartCount += 1;
            if (startZoneIsLateral) senderP0StartCountLateral += 1;
            else senderP0StartCountCentral += 1;
          }
          if (action.isP1Start && matchesEndFilterForStartCounts) {
            senderP1StartCount += 1;
            if (startZoneIsLateral) senderP1StartCountLateral += 1;
            else senderP1StartCountCentral += 1;
          }
          if (action.isP2Start && matchesEndFilterForStartCounts) {
            senderP2StartCount += 1;
            if (startZoneIsLateral) senderP2StartCountLateral += 1;
            else senderP2StartCountCentral += 1;
          }
          if (action.isP3Start && matchesEndFilterForStartCounts) {
            senderP3StartCount += 1;
            if (startZoneIsLateral) senderP3StartCountLateral += 1;
            else senderP3StartCountCentral += 1;
          }
        }

        // Licz tylko akcje, które mają strefę (tak jak heatmapa)
        if (senderZoneName) {
          const senderIsLateral = isLateralZone(senderZoneName);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry && matchesFiltersForEndCounts) {
            senderPKCount += 1;
            if (senderIsLateral) senderPKCountLateral += 1;
            else senderPKCountCentral += 1;
          }

          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot && matchesFiltersForEndCounts) {
            senderShotCount += 1;
            if (senderIsLateral) senderShotCountLateral += 1;
            else senderShotCountCentral += 1;
            if (action.isGoal && matchesFiltersForEndCounts) {
              senderGoalCount += 1;
              if (senderIsLateral) senderGoalCountLateral += 1;
              else senderGoalCountCentral += 1;
            }
          }

          // P3, P2, P1, P0 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Dla kafelków End używamy tylko isP0, isP1, isP2, isP3 (bez isP0Start itd.)
          if (action.isP3 && matchesFiltersForEndCounts) {
            senderP3Count += 1;
            if (senderIsLateral) senderP3CountLateral += 1;
            else senderP3CountCentral += 1;
          }
          if (action.isP2 && matchesFiltersForEndCounts) {
            senderP2Count += 1;
            if (senderIsLateral) senderP2CountLateral += 1;
            else senderP2CountCentral += 1;
          }
          if (action.isP1 && matchesFiltersForEndCounts) {
            senderP1Count += 1;
            if (senderIsLateral) senderP1CountLateral += 1;
            else senderP1CountCentral += 1;
          }
          if (action.isP0 && matchesFiltersForEndCounts) {
            senderP0Count += 1;
            if (senderIsLateral) senderP0CountLateral += 1;
            else senderP0CountCentral += 1;
          }
        }
      }

      // PxT jako przyjmujący (receiver) - tylko jeśli selectedPxtCategory === 'receiver'
      if (selectedPxtCategory === 'receiver' && isPass && action.receiverId) {
        pxtAsReceiver += pxtValue;
        totalPxT += pxtValue; // Zwiększ totalPxT tylko dla akcji receiver
        receiverActionsCount += 1;
        receiverPassCount += 1;

        // Użyj tej samej strefy co heatmapa - jeśli heatmapDirection === 'to', użyj strefy docelowej, w przeciwnym razie źródłowej
        const receiverZoneName = heatmapDirection === "to" 
          ? convertZoneToName(action.toZone ?? action.endZone ?? undefined)
          : convertZoneToName(action.fromZone ?? action.startZone ?? undefined);
        
        // Licz tylko akcje, które mają strefę (tak jak heatmapa)
        if (receiverZoneName) {
          const receiverIsLateral = isLateralZone(receiverZoneName);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            receiverPKCount += 1;
            if (receiverIsLateral) receiverPKCountLateral += 1;
            else receiverPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            receiverShotCount += 1;
            if (receiverIsLateral) receiverShotCountLateral += 1;
            else receiverShotCountCentral += 1;
            if (action.isGoal) {
              receiverGoalCount += 1;
              if (receiverIsLateral) receiverGoalCountLateral += 1;
              else receiverGoalCountCentral += 1;
            }
          }
          
          // P3, P2, P1, P0 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Dla kafelków End używamy tylko isP0, isP1, isP2, isP3 (bez isP0Start itd.)
          if (action.isP3) {
            receiverP3Count += 1;
            if (receiverIsLateral) receiverP3CountLateral += 1;
            else receiverP3CountCentral += 1;
          }
          if (action.isP2) {
            receiverP2Count += 1;
            if (receiverIsLateral) receiverP2CountLateral += 1;
            else receiverP2CountCentral += 1;
          }
          if (action.isP1) {
            receiverP1Count += 1;
            if (receiverIsLateral) receiverP1CountLateral += 1;
            else receiverP1CountCentral += 1;
          }
          if (action.isP0) {
            receiverP0Count += 1;
            if (receiverIsLateral) receiverP0CountLateral += 1;
            else receiverP0CountCentral += 1;
          }
        }
      }

      // PxT z dryblingu - tylko jeśli selectedPxtCategory === 'dribbler'
      if (selectedPxtCategory === 'dribbler' && isDribble && action.senderId) {
        pxtAsDribbler += pxtValue;
        totalPxT += pxtValue; // Zwiększ totalPxT tylko dla akcji dribbler
        dribblingActionsCount += 1;

        // Użyj tej samej strefy co heatmapa - dla dryblingu zawsze używamy startZone/fromZone
        const dribblingZoneName = convertZoneToName(action.startZone || action.fromZone);
        
        // Licz tylko akcje, które mają strefę (tak jak heatmapa)
        if (dribblingZoneName) {
          const dribblingIsLateral = isLateralZone(dribblingZoneName);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            dribblingPKCount += 1;
            if (dribblingIsLateral) dribblingPKCountLateral += 1;
            else dribblingPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            dribblingShotCount += 1;
            if (dribblingIsLateral) dribblingShotCountLateral += 1;
            else dribblingShotCountCentral += 1;
            if (action.isGoal) {
              dribblingGoalCount += 1;
              if (dribblingIsLateral) dribblingGoalCountLateral += 1;
              else dribblingGoalCountCentral += 1;
            }
          }
          
          // P3, P2, P1, P0 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Dla kafelków End używamy tylko isP0, isP1, isP2, isP3 (bez isP0Start itd.)
          if (action.isP3) {
            dribblingP3Count += 1;
            if (dribblingIsLateral) dribblingP3CountLateral += 1;
            else dribblingP3CountCentral += 1;
          }
          if (action.isP2) {
            dribblingP2Count += 1;
            if (dribblingIsLateral) dribblingP2CountLateral += 1;
            else dribblingP2CountCentral += 1;
          }
          if (action.isP1) {
            dribblingP1Count += 1;
            if (dribblingIsLateral) dribblingP1CountLateral += 1;
            else dribblingP1CountCentral += 1;
          }
          if (action.isP0) {
            dribblingP0Count += 1;
            if (dribblingIsLateral) dribblingP0CountLateral += 1;
            else dribblingP0CountCentral += 1;
          }
        }
      }

      // Wejścia w PK liczymy z dedykowanej kolekcji pkEntries (poniżej), żeby nie dublować
    });

    // Oblicz xG z strzałów
    allShots.forEach(shot => {
      if (shot.teamId === selectedTeam && shot.xG) {
        totalxG += shot.xG;
      }
    });

    // Oblicz wejścia w PK z pkEntries
    allPKEntries.forEach(pkEntry => {
      if (pkEntry.teamId === selectedTeam) {
        totalPKEntries += 1;
      }
    });

    // Domyślnie 90 minut dla meczu
    const totalMinutes = 90;
    const per90Multiplier = totalMinutes > 0 ? 90 / totalMinutes : 0;

    return {
      totalPxT,
      totalxG,
      totalRegains,
      totalLoses,
      totalPKEntries,
      totalMinutes,
      pxtPer90: totalPxT * per90Multiplier,
      xgPer90: totalxG * per90Multiplier,
      regainsPer90: totalRegains * per90Multiplier,
      losesPer90: totalLoses * per90Multiplier,
      pkEntriesPer90: totalPKEntries * per90Multiplier,
      regainsFirstHalf,
      regainsSecondHalf,
      losesFirstHalf,
      losesSecondHalf,
      // Szczegółowe statystyki PxT
      pxtAsSender,
      pxtAsReceiver,
      pxtAsDribbler,
      senderActionsCount,
      receiverActionsCount,
      dribblingActionsCount,
      senderPassCount,
      receiverPassCount,
      pxtSenderPer90: pxtAsSender * per90Multiplier,
      pxtReceiverPer90: pxtAsReceiver * per90Multiplier,
      pxtDribblingPer90: pxtAsDribbler * per90Multiplier,
      senderActionsPer90: senderActionsCount * per90Multiplier,
      receiverActionsPer90: receiverActionsCount * per90Multiplier,
      dribblingActionsPer90: dribblingActionsCount * per90Multiplier,
      pxtSenderPerAction: senderPassCount > 0 ? pxtAsSender / senderPassCount : 0,
      pxtReceiverPerAction: receiverPassCount > 0 ? pxtAsReceiver / receiverPassCount : 0,
      pxtDribblingPerAction: dribblingActionsCount > 0 ? pxtAsDribbler / dribblingActionsCount : 0,
      // Liczniki akcji jako podający
      senderP0Count,
      senderP1Count,
      senderP2Count,
      senderP3Count,
      senderPKCount,
      senderShotCount,
      senderGoalCount,
      senderP0CountLateral,
      senderP0CountCentral,
      senderP1CountLateral,
      senderP1CountCentral,
      senderP2CountLateral,
      senderP2CountCentral,
      senderP3CountLateral,
      senderP3CountCentral,
      senderPKCountLateral,
      senderPKCountCentral,
      senderShotCountLateral,
      senderShotCountCentral,
      senderGoalCountLateral,
      senderGoalCountCentral,
      // Liczniki akcji jako przyjmujący
      receiverP0Count,
      receiverP1Count,
      receiverP2Count,
      receiverP3Count,
      receiverPKCount,
      receiverShotCount,
      receiverGoalCount,
      receiverP0CountLateral,
      receiverP0CountCentral,
      receiverP1CountLateral,
      receiverP1CountCentral,
      receiverP2CountLateral,
      receiverP2CountCentral,
      receiverP3CountLateral,
      receiverP3CountCentral,
      receiverPKCountLateral,
      receiverPKCountCentral,
      receiverShotCountLateral,
      receiverShotCountCentral,
      receiverGoalCountLateral,
      receiverGoalCountCentral,
      // Liczniki akcji z dryblingu
      dribblingP0Count,
      dribblingP1Count,
      dribblingP2Count,
      dribblingP3Count,
      dribblingPKCount,
      dribblingShotCount,
      dribblingGoalCount,
      dribblingP0CountLateral,
      dribblingP0CountCentral,
      dribblingP1CountLateral,
      dribblingP1CountCentral,
      dribblingP2CountLateral,
      dribblingP2CountCentral,
      dribblingP3CountLateral,
      dribblingP3CountCentral,
      dribblingPKCountLateral,
      dribblingPKCountCentral,
      dribblingShotCountLateral,
      dribblingShotCountCentral,
      dribblingGoalCountLateral,
      dribblingGoalCountCentral,
      senderP0StartCount,
      senderP1StartCount,
      senderP2StartCount,
      senderP3StartCount,
      senderP0StartCountLateral,
      senderP0StartCountCentral,
      senderP1StartCountLateral,
      senderP1StartCountCentral,
      senderP2StartCountLateral,
      senderP2StartCountCentral,
      senderP3StartCountLateral,
      senderP3StartCountCentral,
    };
  }, [allActions, teamActions, allShots, allPKEntries, selectedTeam, heatmapDirection, selectedPxtCategory, derivedRegainActions, derivedLosesActions, selectedActionFilter]);

  const regainsFirstHalfPct = teamStats.totalRegains > 0
    ? (teamStats.regainsFirstHalf / teamStats.totalRegains) * 100
    : 0;
  const regainsSecondHalfPct = teamStats.totalRegains > 0
    ? (teamStats.regainsSecondHalf / teamStats.totalRegains) * 100
    : 0;
  const losesFirstHalfPct = teamStats.totalLoses > 0
    ? (teamStats.losesFirstHalf / teamStats.totalLoses) * 100
    : 0;
  const losesSecondHalfPct = teamStats.totalLoses > 0
    ? (teamStats.losesSecondHalf / teamStats.totalLoses) * 100
    : 0;
  const regainsPer10 = teamStats.totalMinutes > 0
    ? teamStats.totalRegains / (teamStats.totalMinutes / 10)
    : 0;
  const losesPer10 = teamStats.totalMinutes > 0
    ? teamStats.totalLoses / (teamStats.totalMinutes / 10)
    : 0;
  const regainsPer5 = teamStats.totalMinutes > 0
    ? teamStats.totalRegains / (teamStats.totalMinutes / 5)
    : 0;
  const losesPer5 = teamStats.totalMinutes > 0
    ? teamStats.totalLoses / (teamStats.totalMinutes / 5)
    : 0;

  const regainLosesTimeline = useMemo(() => {
    if (derivedRegainActions.length === 0 && derivedLosesActions.length === 0) return [];

    const intervals: { [key: number]: { regains: number; loses: number } } = {};
    derivedRegainActions.forEach(action => {
      const minute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      if (!Number.isFinite(minute)) return;
      const interval = Math.floor(minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { regains: 0, loses: 0 };
      }
      intervals[interval].regains += 1;
    });
    derivedLosesActions.forEach(action => {
      const minute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      if (!Number.isFinite(minute)) return;
      const interval = Math.floor(minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { regains: 0, loses: 0 };
      }
      intervals[interval].loses += 1;
    });

    const data: { minute: string; regains: number; loses: number }[] = [];
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { regains: 0, loses: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        regains: intervalData.regains,
        loses: intervalData.loses,
      });
    }
    return data;
  }, [derivedRegainActions, derivedLosesActions]);

  const teamRegainStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Filtruj przechwyty według wybranej połowy
    let filteredRegainActions = regainHalfFilter === "all"
      ? derivedRegainActions
      : regainHalfFilter === "pm"
      ? derivedRegainActions.filter(action => {
          // PM Area jak przy heatmapie / KPI poł. przeciwnika: strefa ataku przechwytu
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          return isPMArea(attackZoneName);
        })
      : derivedRegainActions.filter(action => {
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          
          if (!attackZoneName) return false;
          
          const isOwn = isOwnHalf(attackZoneName);
          
          return regainHalfFilter === "own" ? isOwn : !isOwn;
        });

    // Oblicz statystyki P0-P3 dla wszystkich przechwytów (bez filtrowania według selectedActionFilter)
    // Te wartości będą pokazywane w kafelkach
    let allRegainP0Count = 0;
    let allRegainP1Count = 0;
    let allRegainP2Count = 0;
    let allRegainP3Count = 0;
    let allRegainP0CountLateral = 0;
    let allRegainP1CountLateral = 0;
    let allRegainP2CountLateral = 0;
    let allRegainP3CountLateral = 0;
    let allRegainP0CountCentral = 0;
    let allRegainP1CountCentral = 0;
    let allRegainP2CountCentral = 0;
    let allRegainP3CountCentral = 0;
    /** Przechwyty z możliwą strefą na mapie (jak widoczne / heatmapa), bez żadnej flagi P0–P3 */
    let allRegainNoPCount = 0;

    filteredRegainActions.forEach(action => {
      const attackZoneRaw = regainAttackZoneRawForMap(action);
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      if (!attackZoneName) return;

      const isLateral = isLateralZone(attackZoneName);
      // Ta sama baza co visibleRegainsCount (bez filtra P): strefa ataku na mapie; boczna/środkowa jak w profilu zawodnika
      if (action.isP0 || action.isP0Start) {
        allRegainP0Count += 1;
        if (isLateral) allRegainP0CountLateral += 1;
        else allRegainP0CountCentral += 1;
      } else if (action.isP1 || action.isP1Start) {
        allRegainP1Count += 1;
        if (isLateral) allRegainP1CountLateral += 1;
        else allRegainP1CountCentral += 1;
      } else if (action.isP2 || action.isP2Start) {
        allRegainP2Count += 1;
        if (isLateral) allRegainP2CountLateral += 1;
        else allRegainP2CountCentral += 1;
      } else if (action.isP3 || action.isP3Start) {
        allRegainP3Count += 1;
        if (isLateral) allRegainP3CountLateral += 1;
        else allRegainP3CountCentral += 1;
      } else {
        allRegainNoPCount += 1;
      }
    });

    // Filtruj według selectedActionFilter (P0-P3) - tylko dla statystyk poniżej
    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredRegainActions = filteredRegainActions.filter(action => matchesSelectedActionFilter(action));
    }

    // Ta sama baza co heatmapa przechwytów: tylko akcje z mapowalną strefą ataku.
    const visibleRegainActions = filteredRegainActions.filter((action) => {
      const attackZoneRaw = regainAttackZoneRawForMap(action);
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      return Boolean(attackZoneName);
    });
    const visibleRegainsCount = visibleRegainActions.length;
    const visibleRegainsOpponentHalf = visibleRegainActions.filter((action) => {
      const attackZoneRaw = regainAttackZoneRawForMap(action);
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      return Boolean(attackZoneName && !isOwnHalf(attackZoneName));
    }).length;

    const attackXTHeatmap = new Map<string, number>();
    const defenseXTHeatmap = new Map<string, number>();
    const attackCountHeatmap = new Map<string, number>();
    const defenseCountHeatmap = new Map<string, number>();

    let totalRegains = 0;
    let totalRegainsOwnHalf = 0;
    let totalRegainsOpponentHalf = 0;
    let regainAttackCount = 0;
    let regainDefenseCount = 0;
    let regainXTInAttack = 0;
    let regainXTInDefense = 0;
    let regainP2Pxt = 0;
    let regainP3Pxt = 0;

    let attackContextCount = 0;
    let defenseContextCount = 0;
    let attackPlayersBehindSum = 0;
    let attackOpponentsBehindSum = 0;
    let defensePlayersBehindSum = 0;
    let defenseOpponentsBehindSum = 0;

    // Statystyki P0-P3 dla przechwytów
    let regainP0Count = 0;
    let regainP1Count = 0;
    let regainP2Count = 0;
    let regainP3Count = 0;
    let regainP0CountLateral = 0;
    let regainP1CountLateral = 0;
    let regainP2CountLateral = 0;
    let regainP3CountLateral = 0;
    let regainP0CountCentral = 0;
    let regainP1CountCentral = 0;
    let regainP2CountCentral = 0;
    let regainP3CountCentral = 0;

    filteredRegainActions.forEach(action => {
      totalRegains += 1;

      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
      
      // Policz przechwyty według połowy boiska
      // regainDefenseZone to strefa, gdzie zespół odzyskał piłkę
      // regainAttackZone to strefa przeciwna (gdzie piłka trafi po odzyskaniu)
      // Dla "przechwytów na połowie przeciwnika" używamy strefy ataku (z fallbackiem jak na mapie)
      const attackZoneRaw = regainAttackZoneRawForMap(action);
      const attackZoneName = attackZoneRaw
        ? convertZoneToName(attackZoneRaw)
        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
      
      if (attackZoneName) {
        const isOwn = isOwnHalf(attackZoneName);
        // Z perspektywy ataku: strefy 1-6 to własna połowa, strefy 7-12 to połowa przeciwnika
        // Jeśli attackZone jest na połowie przeciwnika (isOwn = false, strefy 7-12), to regainDefenseZone jest na własnej połowie (strefy 1-6)
        // Jeśli attackZone jest na własnej połowie (isOwn = true, strefy 1-6), to regainDefenseZone jest na połowie przeciwnika (strefy 7-12)
        if (isOwn) {
          totalRegainsOwnHalf += 1; // attackZone na własnej połowie (1-6) = regain na własnej połowie
        } else {
          totalRegainsOpponentHalf += 1; // attackZone na połowie przeciwnika (7-12) = regain na połowie przeciwnika
        }
      }

      const defenseXT = action.regainDefenseXT !== undefined
        ? action.regainDefenseXT
        : (action.xTValueEnd ?? action.xTValueStart ?? 0);
      const attackXT = action.regainAttackXT !== undefined
        ? action.regainAttackXT
        : (action.oppositeXT ?? (defenseZoneName && zoneNameToIndex(defenseZoneName) !== null
          ? getOppositeXTValueForZone(zoneNameToIndex(defenseZoneName)!)
          : 0));

      if (defenseZoneName) {
        defenseXTHeatmap.set(defenseZoneName, (defenseXTHeatmap.get(defenseZoneName) || 0) + defenseXT);
        defenseCountHeatmap.set(defenseZoneName, (defenseCountHeatmap.get(defenseZoneName) || 0) + 1);
      }
      if (attackZoneName) {
        attackXTHeatmap.set(attackZoneName, (attackXTHeatmap.get(attackZoneName) || 0) + attackXT);
        attackCountHeatmap.set(attackZoneName, (attackCountHeatmap.get(attackZoneName) || 0) + 1);
      }

      const isAttack = action.isAttack !== undefined ? action.isAttack : defenseXT < 0.02;
      const playersBehind = action.playersBehindBall ?? 0;
      const opponentsBehind = action.opponentsBehindBall ?? 0;

      if (isAttack) {
        regainAttackCount += 1;
        regainXTInAttack += attackXT;
        if (action.isP2 || action.isP2Start) {
          regainP2Pxt += attackXT;
        }
        if (action.isP3 || action.isP3Start) {
          regainP3Pxt += attackXT;
        }
        attackContextCount += 1;
        attackPlayersBehindSum += playersBehind;
        attackOpponentsBehindSum += opponentsBehind;
      } else {
        regainDefenseCount += 1;
        regainXTInDefense += defenseXT;
        defenseContextCount += 1;
        defensePlayersBehindSum += playersBehind;
        defenseOpponentsBehindSum += opponentsBehind;
      }

      // Oblicz statystyki P0-P3 dla przechwytów (używamy regainDefenseZone)
      if (defenseZoneName) {
        const isLateral = isLateralZone(defenseZoneName);
        
        if (action.isP0 || action.isP0Start) {
          regainP0Count += 1;
          if (isLateral) regainP0CountLateral += 1;
          else regainP0CountCentral += 1;
        }
        if (action.isP1 || action.isP1Start) {
          regainP1Count += 1;
          if (isLateral) regainP1CountLateral += 1;
          else regainP1CountCentral += 1;
        }
        if (action.isP2 || action.isP2Start) {
          regainP2Count += 1;
          if (isLateral) regainP2CountLateral += 1;
          else regainP2CountCentral += 1;
        }
        if (action.isP3 || action.isP3Start) {
          regainP3Count += 1;
          if (isLateral) regainP3CountLateral += 1;
          else regainP3CountCentral += 1;
        }
      }
    });

    const totalContext = attackContextCount + defenseContextCount;

    const result = {
      totalRegains,
      totalRegainsOwnHalf,
      totalRegainsOpponentHalf,
      regainAttackCount,
      regainDefenseCount,
      regainXTInAttack,
      regainXTInDefense,
      regainXTInAttackPerAction: regainAttackCount > 0 ? regainXTInAttack / regainAttackCount : 0,
      regainXTInDefensePerAction: regainDefenseCount > 0 ? regainXTInDefense / regainDefenseCount : 0,
      regainP2Pxt,
      regainP3Pxt,
      attackPct: totalRegains > 0 ? (regainAttackCount / totalRegains) * 100 : 0,
      defensePct: totalRegains > 0 ? (regainDefenseCount / totalRegains) * 100 : 0,
      avgPlayersBehindAttack: attackContextCount > 0 ? attackPlayersBehindSum / attackContextCount : 0,
      avgOpponentsBehindAttack: attackContextCount > 0 ? attackOpponentsBehindSum / attackContextCount : 0,
      avgPlayerDiffAttack: attackContextCount > 0 ? (attackPlayersBehindSum - attackOpponentsBehindSum) / attackContextCount : 0,
      avgPlayersBehindDefense: defenseContextCount > 0 ? defensePlayersBehindSum / defenseContextCount : 0,
      avgOpponentsBehindDefense: defenseContextCount > 0 ? defenseOpponentsBehindSum / defenseContextCount : 0,
      avgPlayerDiffDefense: defenseContextCount > 0 ? (defensePlayersBehindSum - defenseOpponentsBehindSum) / defenseContextCount : 0,
      attackXTHeatmap,
      defenseXTHeatmap,
      attackCountHeatmap,
      defenseCountHeatmap,
      // Statystyki P0-P3
      regainP0Count,
      regainP1Count,
      regainP2Count,
      regainP3Count,
      regainP0CountLateral,
      regainP1CountLateral,
      regainP2CountLateral,
      regainP3CountLateral,
      regainP0CountCentral,
      regainP1CountCentral,
      regainP2CountCentral,
      regainP3CountCentral,
      // Statystyki P0-P3 dla wszystkich przechwytów (bez filtrowania według selectedActionFilter) - do wyświetlania w kafelkach
      allRegainP0Count,
      allRegainP1Count,
      allRegainP2Count,
      allRegainP3Count,
      allRegainP0CountLateral,
      allRegainP1CountLateral,
      allRegainP2CountLateral,
      allRegainP3CountLateral,
      allRegainP0CountCentral,
      allRegainP1CountCentral,
      allRegainP2CountCentral,
      allRegainP3CountCentral,
      totalRegainsWithP: allRegainP0Count + allRegainP1Count + allRegainP2Count + allRegainP3Count,
      allRegainNoPCount,
      visibleRegainsCount,
      visibleRegainsOpponentHalf,
    };
    
    return result;
  }, [derivedRegainActions, regainHalfFilter, selectedActionFilter]);

  // Statystyki po akcjach regain (xG, wejścia w PK, PXT 8s, 15s)
  const regainAfterStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Filtruj przechwyty według wybranej połowy
    let filteredRegainActions = regainHalfFilter === "all"
      ? derivedRegainActions
      : regainHalfFilter === "pm"
      ? derivedRegainActions.filter(action => {
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          return isPMArea(attackZoneName);
        })
      : derivedRegainActions.filter(action => {
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          
          if (!attackZoneName) return false;
          
          const isOwn = isOwnHalf(attackZoneName);
          
          return regainHalfFilter === "own" ? isOwn : !isOwn;
        });

    // Filtruj według selectedActionFilter (P0-P3)
    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredRegainActions = filteredRegainActions.filter(action => matchesSelectedActionFilter(action));
    }

    if (selectedMatches.length === 0 || !selectedMatchInfo || filteredRegainActions.length === 0) {
      return {
        totalXG8s: 0,
        totalShots8s: 0,
        totalPKEntries8s: 0,
        totalPXT8s: 0,
        totalPasses8s: 0,
        totalXG15s: 0,
        totalShots15s: 0,
        totalPKEntries15s: 0,
        totalPXT15s: 0,
        totalPasses15s: 0,
        totalLosesAfterRegain5s: 0,
        losesAfterRegain5sPct: 0,
        xGPerRegain: 0,
        pkEntriesPerRegain: 0,
        pxt8sPerRegain: 0,
      };
    }

    const isHome = selectedMatchInfo.isHome;
    const teamId = selectedMatchInfo.team; // Nasz zespół
    const opponentId = selectedMatchInfo.opponent; // Przeciwnik

    let totalXG8s = 0;
    let totalShots8s = 0;
    let totalPKEntries8s = 0;
    let totalPXT8s = 0;
    let totalPasses8s = 0;
    let totalXG15s = 0;
    let totalShots15s = 0;
    let totalPKEntries15s = 0;
    let totalPXT15s = 0;
    let totalPasses15s = 0;
    let totalLosesAfterRegain5s = 0;

    // Sortuj wszystkie akcje według czasu wideo
    const allActionsWithTimestamp = allActions
      .map(action => ({
        action,
        timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    const allShotsWithTimestamp = allShots
      .map(shot => ({
        shot,
        timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    const allPKEntriesWithTimestamp = allPKEntries
      .map(entry => ({
        entry,
        timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    const allLosesWithTimestamp = allLosesActions
      .map(lose => ({
        lose,
        timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Sortuj akcje regain według czasu wideo (używamy przefiltrowanych akcji)
    const regainActionsWithTimestamp = filteredRegainActions
      .map(action => ({
        action,
        timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Dla każdej akcji regain, znajdź nasze akcje (xG, PK) w ciągu 8s i 15s
    regainActionsWithTimestamp.forEach((regainItem, index) => {
      const regainTimestamp = regainItem.timestamp;
      const nextRegainTimestamp = index < regainActionsWithTimestamp.length - 1
        ? regainActionsWithTimestamp[index + 1].timestamp
        : Infinity;

      const eightSecondsAfterRegain = regainTimestamp + 8;
      const fifteenSecondsAfterRegain = regainTimestamp + 15;
      const fiveSecondsAfterRegain = regainTimestamp + 5;

      // Funkcja pomocnicza do filtrowania strzałów naszego zespołu
      const filterTeamShots = (maxTimestamp: number) => {
        return allShotsWithTimestamp.filter(item => {
          if (item.timestamp <= regainTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextRegainTimestamp) {
            return false;
          }
          const shotTeamId = item.shot.teamId || (item.shot.teamContext === 'attack' 
            ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
            : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
          return shotTeamId === teamId;
        });
      };

      // Funkcja pomocnicza do filtrowania wejść w PK naszego zespołu
      const filterTeamPKEntries = (maxTimestamp: number) => {
        return allPKEntriesWithTimestamp.filter(item => {
          if (item.timestamp <= regainTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextRegainTimestamp) {
            return false;
          }
          // teamContext === "attack" oznacza nasze wejścia
          return item.entry.teamContext === "attack" || 
                 (item.entry.teamId && item.entry.teamId === teamId);
        });
      };

      // Funkcja pomocnicza do filtrowania strat naszego zespołu
      const filterTeamLoses = (maxTimestamp: number) => {
        return allLosesWithTimestamp.filter(item => {
          if (item.timestamp <= regainTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextRegainTimestamp) {
            return false;
          }
          const loseTeamId = item.lose.teamId || teamId;
          return loseTeamId === teamId;
        });
      };

      // 8 sekund
      const shots8s = filterTeamShots(eightSecondsAfterRegain);
      const pkEntries8s = filterTeamPKEntries(eightSecondsAfterRegain);
      totalXG8s += shots8s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
      totalShots8s += shots8s.length;
      totalPKEntries8s += pkEntries8s.length;

      // Znajdź wszystkie akcje packing w ciągu 8 sekund po tej akcji regain
      const actionsWithin8s = allActionsWithTimestamp.filter(
        item => item.timestamp > regainTimestamp && item.timestamp <= eightSecondsAfterRegain && item.timestamp < nextRegainTimestamp
      );

      // Policz podania (akcje typu "pass")
      const passes8s = actionsWithin8s.filter(item => item.action.actionType === 'pass');
      totalPasses8s += passes8s.length;

      // Oblicz PXT z akcji w ciągu 8 sekund
      actionsWithin8s.forEach(item => {
        const xTDifference = getXTDifferenceForAction(item.action);
        const packingPoints = item.action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        totalPXT8s += pxtValue;
      });

      // 15 sekund
      const shots15s = filterTeamShots(fifteenSecondsAfterRegain);
      const pkEntries15s = filterTeamPKEntries(fifteenSecondsAfterRegain);
      totalXG15s += shots15s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
      totalShots15s += shots15s.length;
      totalPKEntries15s += pkEntries15s.length;
      const loses5s = filterTeamLoses(fiveSecondsAfterRegain);
      totalLosesAfterRegain5s += loses5s.length;

      // Znajdź wszystkie akcje packing w ciągu 15 sekund po tej akcji regain
      const actionsWithin15s = allActionsWithTimestamp.filter(
        item => item.timestamp > regainTimestamp && item.timestamp <= fifteenSecondsAfterRegain && item.timestamp < nextRegainTimestamp
      );

      // Policz podania (akcje typu "pass")
      const passes15s = actionsWithin15s.filter(item => item.action.actionType === 'pass');
      totalPasses15s += passes15s.length;

      // Oblicz PXT z akcji w ciągu 15 sekund
      actionsWithin15s.forEach(item => {
        const xTDifference = getXTDifferenceForAction(item.action);
        const packingPoints = item.action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        totalPXT15s += pxtValue;
      });
    });

    const totalRegains = filteredRegainActions.length;
    const totalRegainsFor5s = regainActionsWithTimestamp.length;

    return {
      totalXG8s,
      totalShots8s,
      totalPKEntries8s,
      totalPXT8s,
      totalPasses8s,
      totalXG15s,
      totalShots15s,
      totalPKEntries15s,
      totalPXT15s,
      totalPasses15s,
      totalLosesAfterRegain5s,
      losesAfterRegain5sPct: totalRegainsFor5s > 0 ? (totalLosesAfterRegain5s / totalRegainsFor5s) * 100 : 0,
      xGPerRegain: totalRegains > 0 ? totalXG8s / totalRegains : 0,
      pkEntriesPerRegain: totalRegains > 0 ? totalPKEntries8s / totalRegains : 0,
      pxt8sPerRegain: totalRegains > 0 ? totalPXT8s / totalRegains : 0,
    };
  }, [selectedMatches.length, selectedMatchInfo, derivedRegainActions, allActions, allShots, allPKEntries, allLosesActions, regainHalfFilter, selectedActionFilter]);

  const regainsTimelineXT = useMemo(() => {
    if (derivedRegainActions.length === 0) return [];
    const intervals: { [key: number]: { regains: number; xtAttack: number; xtDefense: number } } = {};
    derivedRegainActions.forEach(action => {
      const minute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      if (!Number.isFinite(minute)) return;
      const interval = Math.floor(minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { regains: 0, xtAttack: 0, xtDefense: 0 };
      }
      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
      const defenseXT = action.regainDefenseXT !== undefined
        ? action.regainDefenseXT
        : (action.xTValueEnd ?? action.xTValueStart ?? 0);
      const attackXT = action.regainAttackXT !== undefined
        ? action.regainAttackXT
        : (action.oppositeXT ?? (defenseZoneName && zoneNameToIndex(defenseZoneName) !== null
          ? getOppositeXTValueForZone(zoneNameToIndex(defenseZoneName)!)
          : 0));
      intervals[interval].regains += 1;
      intervals[interval].xtAttack += attackXT;
      intervals[interval].xtDefense += defenseXT;
    });
    const data: { minute: string; regains: number; xtAttack: number; xtDefense: number }[] = [];
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { regains: 0, xtAttack: 0, xtDefense: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        regains: intervalData.regains,
        xtAttack: intervalData.xtAttack,
        xtDefense: intervalData.xtDefense,
      });
    }
    return data;
  }, [derivedRegainActions]);

  // Oblicz całkowite xT dla wszystkich przechwytów w meczu (bez filtra)
  const totalRegainsXT = useMemo(() => {
    let totalXTInAttack = 0;
    let totalXTInDefense = 0;

    derivedRegainActions.forEach(action => {
      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;

      const defenseXT = action.regainDefenseXT !== undefined
        ? action.regainDefenseXT
        : (action.xTValueEnd ?? action.xTValueStart ?? 0);

      const attackXT = action.regainAttackXT !== undefined
        ? action.regainAttackXT
        : (action.oppositeXT ?? (defenseZoneName && zoneNameToIndex(defenseZoneName) !== null
          ? getOppositeXTValueForZone(zoneNameToIndex(defenseZoneName)!)
          : 0));

      totalXTInDefense += defenseXT;
      totalXTInAttack += attackXT;
    });

    return {
      totalXTInAttack,
      totalXTInDefense,
      totalXT: totalXTInAttack + totalXTInDefense,
    };
  }, [derivedRegainActions]);

  const teamLosesStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Ta sama kolejność co przy totalLosesOwnHalfFull — inaczej jedna strata bez attack/from/to/start a z losesDefenseZone znika z liczników i heatmapy
    const losesZoneRawFromAction = (action: (typeof derivedLosesActions)[number]) =>
      action.losesAttackZone ||
      action.fromZone ||
      action.toZone ||
      action.startZone ||
      (action as { losesDefenseZone?: string }).losesDefenseZone;

    // Pełne sumy strat według połowy (niezależne od filtra) - dla KPI "Przechwyty na połowie przeciwnika"
    // "przeciwnika" = nasze straty na własnej połowie (bez autów)
    // losesAttackZone = strefa wyboru = gdzie straciliśmy piłkę (jak w usePackingActions)
    // losesDefenseZone = strefa przeciwna; fallback: fromZone, toZone, startZone
    let totalLosesOwnHalfFull = 0;
    let totalLosesOpponentHalfFull = 0;
    derivedLosesActions.forEach(action => {
      const zoneRaw = losesZoneRawFromAction(action);
      const zoneName = zoneRaw ? convertZoneToName(zoneRaw) : null;
      if (zoneName) {
        const isOwn = isOwnHalf(zoneName);
        if (isOwn) {
          if ((action as any).isAut !== true && (action as any).aut !== true) totalLosesOwnHalfFull += 1;
        } else {
          totalLosesOpponentHalfFull += 1;
        }
      }
    });

    // Filtruj straty według wybranej połowy
    let filteredLosesActions = losesHalfFilter === "all"
      ? derivedLosesActions
      : losesHalfFilter === "pm"
      ? derivedLosesActions.filter(action => {
          const losesZoneRaw = losesZoneRawFromAction(action);
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          return isPMArea(losesZoneName);
        })
      : derivedLosesActions.filter(action => {
          const losesZoneRaw = losesZoneRawFromAction(action);
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          
          if (!losesZoneName) return false;
          
          const isOwn = isOwnHalf(losesZoneName);
          
          return losesHalfFilter === "own" ? isOwn : !isOwn;
        });

    // Oblicz statystyki P0-P3 dla wszystkich strat (bez filtrowania według selectedActionFilter)
    // Te wartości będą pokazywane w kafelkach
    let allLosesP0Count = 0;
    let allLosesP1Count = 0;
    let allLosesP2Count = 0;
    let allLosesP3Count = 0;
    let allLosesP0CountLateral = 0;
    let allLosesP1CountLateral = 0;
    let allLosesP2CountLateral = 0;
    let allLosesP3CountLateral = 0;
    let allLosesP0CountCentral = 0;
    let allLosesP1CountCentral = 0;
    let allLosesP2CountCentral = 0;
    let allLosesP3CountCentral = 0;
    /** Strata z mapą, bez P0–P3 (nie aut na własnej połowie) */
    let allLosesNoPCount = 0;
    /** Aut na własnej połowie ze strefą na mapie — wyłączone z kafelków P (jak wcześniej), wliczone w STRATY */
    let allLosesOwnHalfAutOnMapCount = 0;

    filteredLosesActions.forEach(action => {
      const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      if (!attackZoneName) return;

      const losesZoneRaw = losesZoneRawFromAction(action);
      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
      const zoneForHalf = losesZoneName ?? attackZoneName;
      const isOwn = isOwnHalf(zoneForHalf);
      const excludeAsAut = isOwn && (action.isAut === true || (action as any).aut === true);
      if (excludeAsAut) {
        allLosesOwnHalfAutOnMapCount += 1;
        return;
      }

      const isLateral = isLateralZone(attackZoneName);
      if (action.isP0 || action.isP0Start) {
        allLosesP0Count += 1;
        if (isLateral) allLosesP0CountLateral += 1;
        else allLosesP0CountCentral += 1;
      } else if (action.isP1 || action.isP1Start) {
        allLosesP1Count += 1;
        if (isLateral) allLosesP1CountLateral += 1;
        else allLosesP1CountCentral += 1;
      } else if (action.isP2 || action.isP2Start) {
        allLosesP2Count += 1;
        if (isLateral) allLosesP2CountLateral += 1;
        else allLosesP2CountCentral += 1;
      } else if (action.isP3 || action.isP3Start) {
        allLosesP3Count += 1;
        if (isLateral) allLosesP3CountLateral += 1;
        else allLosesP3CountCentral += 1;
      } else {
        allLosesNoPCount += 1;
      }
    });

    // Filtruj według selectedActionFilter (P0-P3) - tylko dla statystyk poniżej
    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredLosesActions = filteredLosesActions.filter(action => matchesSelectedActionFilter(action));
    }

    // Ta sama baza co heatmapa strat: tylko akcje, które mają strefę możliwą do narysowania na boisku.
    const visibleLosesActions = filteredLosesActions.filter((action) => {
      const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      return Boolean(attackZoneName);
    });
    const visibleLosesCount = visibleLosesActions.length;
    const visibleAutCount = visibleLosesActions.filter(
      (action) => action.isAut === true || (action as any).aut === true,
    ).length;

    if (filteredLosesActions.length === 0) {
      return {
        losesXTInAttack: 0,
        losesXTInDefense: 0,
        losesAttackCount: 0,
        losesDefenseCount: 0,
        totalLosesOwnHalf: 0,
        totalLosesOpponentHalf: 0,
        totalLosesOwnHalfFull,
        totalLosesOpponentHalfFull,
        visibleLosesCount,
        visibleAutCount,
        attackXTHeatmap: new Map<string, number>(),
        defenseXTHeatmap: new Map<string, number>(),
        attackCountHeatmap: new Map<string, number>(),
        defenseCountHeatmap: new Map<string, number>(),
        allLosesP0Count,
        allLosesP1Count,
        allLosesP2Count,
        allLosesP3Count,
        allLosesP0CountLateral,
        allLosesP1CountLateral,
        allLosesP2CountLateral,
        allLosesP3CountLateral,
        allLosesP0CountCentral,
        allLosesP1CountCentral,
        allLosesP2CountCentral,
        allLosesP3CountCentral,
        allLosesNoPCount,
        allLosesOwnHalfAutOnMapCount,
      };
    }

    const attackXTHeatmap = new Map<string, number>();
    const defenseXTHeatmap = new Map<string, number>();
    const attackCountHeatmap = new Map<string, number>();
    const defenseCountHeatmap = new Map<string, number>();

    let losesXTInAttack = 0;
    let losesXTInDefense = 0;
    let losesAttackCount = 0;
    let losesDefenseCount = 0;
    let totalLosesOwnHalf = 0;
    let totalLosesOpponentHalf = 0;

    filteredLosesActions.forEach(action => {
      const losesZoneRaw = losesZoneRawFromAction(action);
      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;

      // Policz straty według połowy boiska (losesZoneName = strefa, gdzie straciliśmy piłkę)
      // Straty na własnej połowie nie mogą mieć flagi isAut: true
      if (losesZoneName) {
        const zoneXT = action.losesAttackXT !== undefined
          ? action.losesAttackXT
          : (() => {
              const idx = zoneNameToIndex(losesZoneName);
              return idx !== null ? getXTValueForZone(idx) : (action.xTValueStart ?? action.xTValueEnd ?? 0);
            })();
        const oppositeXT = action.losesDefenseXT !== undefined
          ? action.losesDefenseXT
          : (() => {
              const idx = zoneNameToIndex(losesZoneName);
              return idx !== null ? getOppositeXTValueForZone(idx) : 0;
            })();
        if (isOwnHalf(losesZoneName)) {
          if (action.isAut !== true && (action as any).aut !== true) {
            totalLosesOwnHalf += 1;
          }
          defenseXTHeatmap.set(losesZoneName, (defenseXTHeatmap.get(losesZoneName) || 0) + zoneXT);
          defenseCountHeatmap.set(losesZoneName, (defenseCountHeatmap.get(losesZoneName) || 0) + 1);
          losesXTInDefense += zoneXT;
          losesDefenseCount += 1;
        } else {
          totalLosesOpponentHalf += 1;
          attackXTHeatmap.set(losesZoneName, (attackXTHeatmap.get(losesZoneName) || 0) + zoneXT);
          attackCountHeatmap.set(losesZoneName, (attackCountHeatmap.get(losesZoneName) || 0) + 1);
          losesXTInAttack += zoneXT;
          losesAttackCount += 1;
        }
      }
    });

    return {
      losesXTInAttack,
      losesXTInDefense,
      losesAttackCount,
      losesDefenseCount,
      totalLosesOwnHalf,
      totalLosesOpponentHalf,
      totalLosesOwnHalfFull,
      totalLosesOpponentHalfFull,
      visibleLosesCount,
      visibleAutCount,
      attackXTHeatmap,
      defenseXTHeatmap,
      attackCountHeatmap,
      defenseCountHeatmap,
        // Statystyki P0-P3 dla wszystkich strat (bez filtrowania według selectedActionFilter) - do wyświetlania w kafelkach
        allLosesP0Count,
        allLosesP1Count,
        allLosesP2Count,
        allLosesP3Count,
        allLosesP0CountLateral,
        allLosesP1CountLateral,
        allLosesP2CountLateral,
        allLosesP3CountLateral,
        allLosesP0CountCentral,
        allLosesP1CountCentral,
        allLosesP2CountCentral,
        allLosesP3CountCentral,
        allLosesNoPCount,
        allLosesOwnHalfAutOnMapCount,
      };
    }, [derivedLosesActions, losesHalfFilter, selectedActionFilter]);

  // Oblicz całkowite xT dla wszystkich strat w meczu (bez filtra)
  const totalLosesXT = useMemo(() => {
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      return isOwnHalfByZoneColumn(normalized);
    };
    let totalXTInAttack = 0;
    let totalXTInDefense = 0;

    derivedLosesActions.forEach(action => {
      // losesAttackZone = strefa, gdzie straciliśmy piłkę
      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;

      const zoneXT = action.losesAttackXT !== undefined
        ? action.losesAttackXT
        : (() => {
            const idx = losesZoneName ? zoneNameToIndex(losesZoneName) : null;
            if (idx !== null) return getXTValueForZone(idx);
            return action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0);
          })();

      if (losesZoneName && isOwnHalf(losesZoneName)) {
        totalXTInDefense += zoneXT;
      } else {
        totalXTInAttack += zoneXT;
      }
    });

    return {
      totalXTInAttack,
      totalXTInDefense,
      totalXT: totalXTInAttack + totalXTInDefense,
    };
  }, [derivedLosesActions]);

  const losesTimelineXT = useMemo(() => {
    if (derivedLosesActions.length === 0) return [];
    const intervals: { [key: number]: { loses: number; xtAttack: number; xtDefense: number } } = {};
    derivedLosesActions.forEach(action => {
      const minute = typeof action.minute === 'number' ? action.minute : Number(action.minute);
      if (!Number.isFinite(minute)) return;
      const interval = Math.floor(minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { loses: 0, xtAttack: 0, xtDefense: 0 };
      }
      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
      const zoneXT = action.losesAttackXT !== undefined
        ? action.losesAttackXT
        : (() => {
            const idx = losesZoneName ? zoneNameToIndex(losesZoneName) : null;
            if (idx !== null) return getXTValueForZone(idx);
            return action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0);
          })();
      intervals[interval].loses += 1;
      if (losesZoneName) {
        if (isOwnHalfByZoneColumn(losesZoneName)) {
          intervals[interval].xtDefense += zoneXT;
        } else {
          intervals[interval].xtAttack += zoneXT;
        }
      }
    });
    const data: { minute: string; loses: number; xtAttack: number; xtDefense: number }[] = [];
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { loses: 0, xtAttack: 0, xtDefense: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        loses: intervalData.loses,
        xtAttack: intervalData.xtAttack,
        xtDefense: intervalData.xtDefense,
      });
    }
    return data;
  }, [derivedLosesActions]);

  const losesContextStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Filtruj straty według wybranej połowy
    const filteredLosesActions = losesHalfFilter === "all"
      ? derivedLosesActions
      : losesHalfFilter === "pm"
      ? derivedLosesActions.filter(action => {
          const losesZoneRaw =
            action.losesAttackZone ||
            action.fromZone ||
            action.toZone ||
            action.startZone ||
            (action as { losesDefenseZone?: string }).losesDefenseZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          return isPMArea(losesZoneName);
        })
      : derivedLosesActions.filter(action => {
          const losesZoneRaw =
            action.losesAttackZone ||
            action.fromZone ||
            action.toZone ||
            action.startZone ||
            (action as { losesDefenseZone?: string }).losesDefenseZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;

          if (!losesZoneName) return false;

          const isOwn = isOwnHalf(losesZoneName);

          if (losesHalfFilter === "own") return isOwn;
          if (losesHalfFilter === "opponent") return !isOwn;
          
          return false;
        });

    if (filteredLosesActions.length === 0) {
      return {
        reaction5sCount: 0,
        below8sCount: 0,
        unknownCount: 0,
        totalLosesForReaction5s: 0, // Całkowita liczba strat z zaznaczonym przyciskiem 5s (✓ lub ✗), bez isAut
      };
    }

    let reaction5sCount = 0;
    let below8sCount = 0;
    let unknownCount = 0;
    let totalLosesForReaction5s = 0;

    filteredLosesActions.forEach(action => {
      // Wyklucz tylko akcje z isAut z liczenia dla reaction5s
      // Uwzględniamy straty z isReaction5s === true LUB isBadReaction5s === true (mają zaznaczony jeden z przycisków 5s)
      // Wsparcie wsteczne: isReaction5sNotApplicable jest traktowane jak isBadReaction5s
      const hasBad5s = action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true;
      const has5sFlag = action.isReaction5s === true || hasBad5s;
      const isExcluded = action.isAut === true;
      
      if (!isExcluded && has5sFlag) {
        totalLosesForReaction5s += 1;
      }

      if (action.isReaction5s === true && !isExcluded) {
        reaction5sCount += 1;
      } else if (action.isBelow8s === true) {
        below8sCount += 1;
      } else {
        unknownCount += 1;
      }
    });

    return {
      reaction5sCount,
      below8sCount,
      unknownCount,
      totalLosesForReaction5s,
    };
  }, [derivedLosesActions, losesHalfFilter]);

    // Statystyki przeciwnika po stratach (xG, wejścia w PK, regainy w ciągu 5s, 8s, 15s)
  const losesAfterStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Filtruj straty według wybranej połowy
    let filteredLosesActions = losesHalfFilter === "all"
      ? derivedLosesActions
      : losesHalfFilter === "pm"
      ? derivedLosesActions.filter(action => {
          const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          return isPMArea(losesZoneName);
        })
      : derivedLosesActions.filter(action => {
          const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;

          if (!losesZoneName) return false;

          const isOwn = isOwnHalf(losesZoneName);

          if (losesHalfFilter === "own") return isOwn;
          if (losesHalfFilter === "opponent") return !isOwn;
          
          return false;
        });

    // Filtruj według selectedActionFilter (P0-P3)
    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredLosesActions = filteredLosesActions.filter(action => matchesSelectedActionFilter(action));
    }

    if (selectedMatches.length === 0 || !selectedMatchInfo || filteredLosesActions.length === 0) {
      return {
        totalOpponentXG5s: 0,
        totalOpponentPKEntries5s: 0,
        totalOpponentRegains5s: 0,
        totalOpponentShots5s: 0,
        totalOpponentXG8s: 0,
        totalOpponentPKEntries8s: 0,
        totalOpponentRegains8s: 0,
        totalOpponentShots8s: 0,
        totalOpponentXG15s: 0,
        totalOpponentPKEntries15s: 0,
        totalOpponentRegains15s: 0,
        totalOpponentShots15s: 0,
        xGPerLose: 0,
        pkEntriesPerLose: 0,
      };
    }

    const isHome = selectedMatchInfo.isHome;
    // teamId to zawsze nasz zespół (selectedTeam), opponentId to przeciwnik
    const teamId = selectedMatchInfo.team; // Nasz zespół
    const opponentId = selectedMatchInfo.opponent; // Przeciwnik

    let totalOpponentXG5s = 0;
    let totalOpponentPKEntries5s = 0;
    let totalOpponentRegains5s = 0;
    let totalOpponentShots5s = 0;
    let totalOpponentXG8s = 0;
    let totalOpponentPKEntries8s = 0;
    let totalOpponentRegains8s = 0;
    let totalOpponentShots8s = 0;
    let totalOpponentXG15s = 0;
    let totalOpponentPKEntries15s = 0;
    let totalOpponentRegains15s = 0;
    let totalOpponentShots15s = 0;

    // Sortuj wszystkie akcje według czasu wideo
    const allShotsWithTimestamp = allShots
      .map(shot => ({
        shot,
        timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    const allPKEntriesWithTimestamp = allPKEntries
      .map(entry => ({
        entry,
        timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Sortuj regainy naszego zespołu według czasu wideo (derivedRegainActions zawiera tylko regainy naszego zespołu)
    const allRegainActionsWithTimestamp = derivedRegainActions
      .map(action => ({
        action,
        timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Sortuj akcje loses według czasu wideo (używamy przefiltrowanych akcji)
    const losesActionsWithTimestamp = filteredLosesActions
      .map(action => ({
        action,
        timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
      }))
      .filter(item => item.timestamp > 0)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Dla każdej akcji loses, znajdź akcje przeciwnika w ciągu 5s, 8s i 15s
    losesActionsWithTimestamp.forEach((loseItem, index) => {
      const loseTimestamp = loseItem.timestamp;
      const nextLoseTimestamp = index < losesActionsWithTimestamp.length - 1
        ? losesActionsWithTimestamp[index + 1].timestamp
        : Infinity;

      const fiveSecondsAfterLose = loseTimestamp + 5;
      const eightSecondsAfterLose = loseTimestamp + 8;
      const fifteenSecondsAfterLose = loseTimestamp + 15;

      // Funkcja pomocnicza do filtrowania strzałów przeciwnika
      const filterOpponentShots = (maxTimestamp: number) => {
        return allShotsWithTimestamp.filter(item => {
          if (item.timestamp <= loseTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextLoseTimestamp) {
            return false;
          }
          const shotTeamId = item.shot.teamId || (item.shot.teamContext === 'attack' 
            ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
            : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
          return shotTeamId === opponentId;
        });
      };

      // Funkcja pomocnicza do filtrowania wejść w PK przeciwnika
      const filterOpponentPKEntries = (maxTimestamp: number) => {
        return allPKEntriesWithTimestamp.filter(item => {
          if (item.timestamp <= loseTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextLoseTimestamp) {
            return false;
          }
          return item.entry.teamContext === "defense" || 
                 (item.entry.teamId && item.entry.teamId !== teamId);
        });
      };

      // Funkcja pomocnicza do filtrowania regainów naszego zespołu
      // derivedRegainActions już zawiera tylko regainy naszego zespołu, więc nie musimy dodatkowo filtrować po teamId
      const filterTeamRegains = (maxTimestamp: number) => {
        return allRegainActionsWithTimestamp.filter(item => {
          if (item.timestamp <= loseTimestamp || item.timestamp > maxTimestamp || item.timestamp >= nextLoseTimestamp) {
            return false;
          }
          // Wszystkie regainy w allRegainActionsWithTimestamp są już naszego zespołu (z derivedRegainActions)
          return true;
        });
      };

      // 5 sekund
      const shots5s = filterOpponentShots(fiveSecondsAfterLose);
      const pkEntries5s = filterOpponentPKEntries(fiveSecondsAfterLose);
      const regains5s = filterTeamRegains(fiveSecondsAfterLose);
      totalOpponentXG5s += shots5s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
      totalOpponentShots5s += shots5s.length;
      totalOpponentPKEntries5s += pkEntries5s.length;
      totalOpponentRegains5s += regains5s.length;

      // 8 sekund
      const shots8s = filterOpponentShots(eightSecondsAfterLose);
      const pkEntries8s = filterOpponentPKEntries(eightSecondsAfterLose);
      const regains8s = filterTeamRegains(eightSecondsAfterLose);
      totalOpponentXG8s += shots8s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
      totalOpponentShots8s += shots8s.length;
      totalOpponentPKEntries8s += pkEntries8s.length;
      totalOpponentRegains8s += regains8s.length;

      // 15 sekund
      const shots15s = filterOpponentShots(fifteenSecondsAfterLose);
      const pkEntries15s = filterOpponentPKEntries(fifteenSecondsAfterLose);
      const regains15s = filterTeamRegains(fifteenSecondsAfterLose);
      totalOpponentXG15s += shots15s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
      totalOpponentShots15s += shots15s.length;
      totalOpponentPKEntries15s += pkEntries15s.length;
      totalOpponentRegains15s += regains15s.length;
    });

    const totalLoses = derivedLosesActions.length;

    return {
      totalOpponentXG5s,
      totalOpponentPKEntries5s,
      totalOpponentRegains5s,
      totalOpponentShots5s,
      totalOpponentXG8s,
      totalOpponentPKEntries8s,
      totalOpponentRegains8s,
      totalOpponentShots8s,
      totalOpponentXG15s,
      totalOpponentPKEntries15s,
      totalOpponentRegains15s,
      totalOpponentShots15s,
      xGPerLose: totalLoses > 0 ? totalOpponentXG8s / totalLoses : 0,
      pkEntriesPerLose: totalLoses > 0 ? totalOpponentPKEntries8s / totalLoses : 0,
    };
  }, [selectedMatches.length, selectedMatchInfo, selectedTeam, derivedLosesActions, derivedRegainActions, allShots, allPKEntries, losesHalfFilter, selectedActionFilter]);

  // Wykres PK entries co 5 minut (zespół vs przeciwnik)
  const pkEntriesTimeline = useMemo(() => {
    if (selectedMatches.length === 0 || allPKEntries.length === 0) return [];

    const intervals: { [key: number]: { team: number; opponent: number } } = {};
    
    allPKEntries.forEach((entry: any) => {
      if (!entry || !entry.minute) return;
      const minute = typeof entry.minute === 'number' ? entry.minute : Number(entry.minute);
      if (!Number.isFinite(minute)) return;
      
      const interval = Math.floor(minute / 5) * 5;
      if (!intervals[interval]) {
        intervals[interval] = { team: 0, opponent: 0 };
      }
      
      // teamContext: 'attack' = nasze wejścia, 'defense' = wejścia przeciwnika
      const context = entry.teamContext ?? 'attack';
      if (context === 'attack') {
        intervals[interval].team += 1;
      } else {
        intervals[interval].opponent += 1;
      }
    });

    const data: { minute: string; team: number; opponent: number }[] = [];
    for (let i = 0; i <= 90; i += 5) {
      const intervalData = intervals[i] || { team: 0, opponent: 0 };
      data.push({
        minute: `${i}-${i + 5}`,
        team: intervalData.team,
        opponent: intervalData.opponent,
      });
    }
    return data;
  }, [selectedMatches.length, allPKEntries]);

  const teamRegainContext = teamRegainAttackDefenseMode === "attack"
    ? {
        playersBehind: teamRegainStats.avgPlayersBehindAttack,
        opponentsBehind: teamRegainStats.avgOpponentsBehindAttack,
        playerDiff: teamRegainStats.avgPlayerDiffAttack,
      }
    : {
        playersBehind: teamRegainStats.avgPlayersBehindDefense,
        opponentsBehind: teamRegainStats.avgOpponentsBehindDefense,
        playerDiff: teamRegainStats.avgPlayerDiffDefense,
      };

  // Zawsze używaj pól z ataku (regainAttackZone), ale wartości xT / liczba akcji zależą od trybu
  const teamRegainHeatmap = useMemo(() => {
    // Funkcje pomocnicze
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Najpierw przefiltruj akcje pod kątem połowy/PM Area oraz P0-P3,
    // a dopiero potem buduj mapę – dzięki temu filtry działają identycznie
    // zarówno w trybie xT, jak i w trybie "Liczba akcji"
    let filteredRegainActions = regainHalfFilter === "all"
      ? derivedRegainActions
      : regainHalfFilter === "pm"
      ? derivedRegainActions.filter(action => {
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          return isPMArea(attackZoneName);
        })
      : derivedRegainActions.filter(action => {
          const attackZoneRaw = regainAttackZoneRawForMap(action);
          const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
          if (!attackZoneName) return false;
          const isOwn = isOwnHalf(attackZoneName);
          // regainHalfFilter === "own"/"opponent" zgodnie z etykietami przycisków
          return regainHalfFilter === "own" ? isOwn : !isOwn;
        });

    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredRegainActions = filteredRegainActions.filter(action => matchesSelectedActionFilter(action));
    }

    const result = new Map<string, number>();

    filteredRegainActions.forEach(action => {
      const attackZoneRaw = regainAttackZoneRawForMap(action);
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      if (!attackZoneName) return;

      if (teamRegainHeatmapMode === "xt") {
        // xT: suma regainAttackXT / regainDefenseXT
        const actionXT =
          teamRegainAttackDefenseMode === "attack"
            ? action.regainAttackXT ?? 0
            : action.regainDefenseXT ?? 0;
        result.set(attackZoneName, (result.get(attackZoneName) || 0) + actionXT);
      } else {
        // Liczba akcji: każda akcja = 1
        result.set(attackZoneName, (result.get(attackZoneName) || 0) + 1);
      }
    });

    return result;
  }, [derivedRegainActions, regainHalfFilter, teamRegainAttackDefenseMode, teamRegainHeatmapMode, selectedActionFilter]);

  // Zawsze używaj pól z ataku (losesAttackZone), ale wartości xT / liczba akcji zależą od trybu
  const teamLosesHeatmap = useMemo(() => {
    // Funkcje pomocnicze
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      return isOwnHalfByZoneColumn(normalized);
    };

    const isPMArea = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
      return pmZones.includes(normalized);
    };

    // Najpierw przefiltruj akcje pod kątem połowy/PM Area oraz P0-P3,
    // a dopiero potem buduj mapę – identycznie dla xT i liczby akcji
    let filteredLosesActions = losesHalfFilter === "all"
      ? derivedLosesActions
      : losesHalfFilter === "pm"
      ? derivedLosesActions.filter(action => {
          const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          return isPMArea(losesZoneName);
        })
      : derivedLosesActions.filter(action => {
          const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
          const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
          if (!losesZoneName) return false;
          const isOwn = isOwnHalf(losesZoneName);
          // losesHalfFilter === "own" / "opponent" — zgodnie z etykietami przycisków
          return losesHalfFilter === "own" ? isOwn : !isOwn;
        });

    if (selectedActionFilter && selectedActionFilter.length > 0) {
      filteredLosesActions = filteredLosesActions.filter(action => matchesSelectedActionFilter(action));
    }

    const result = new Map<string, number>();

    filteredLosesActions.forEach(action => {
      const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
      if (!attackZoneName) return;

      if (teamLosesHeatmapMode === "xt") {
        const actionXT =
          teamLosesAttackDefenseMode === "attack"
            ? action.losesAttackXT ?? 0
            : action.losesDefenseXT ?? 0;
        result.set(attackZoneName, (result.get(attackZoneName) || 0) + actionXT);
      } else {
        result.set(attackZoneName, (result.get(attackZoneName) || 0) + 1);
      }
    });

    return result;
  }, [derivedLosesActions, losesHalfFilter, teamLosesAttackDefenseMode, teamLosesHeatmapMode, selectedActionFilter]);

  // Przygotuj dane dla heatmapy zespołu i agregacja danych zawodników
  const teamHeatmapData = useMemo(() => {
    if (allActions.length === 0) return new Map<string, number>();

    const heatmap = new Map<string, number>();

    allActions.forEach(action => {
      // Filtruj akcje według kategorii
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return;

      // Filtruj akcje według wybranych filtrów Start/Koniec
      if (!matchesSelectedActionFilter(action)) return;

      let zone: string | undefined;
      if (selectedPxtCategory === 'dribbler') {
        // Dla dryblingu zawsze używamy startZone
        zone = action.startZone || action.fromZone;
      } else if (selectedPxtCategory === 'sender') {
        zone = heatmapDirection === "from" 
          ? (action.fromZone || action.startZone) 
          : (action.toZone || action.endZone);
      } else if (selectedPxtCategory === 'receiver') {
        zone = heatmapDirection === "to" 
          ? (action.toZone || action.endZone) 
          : (action.fromZone || action.startZone);
      }
      
      if (!zone) return;

      // Normalizuj nazwę strefy do formatu kanonicznego "A1" (zgodnego z PlayerHeatmapPitch)
      const rawNormalized = typeof zone === 'string' 
        ? zone.toUpperCase().replace(/\s+/g, '') 
        : String(zone).toUpperCase().replace(/\s+/g, '');
      const zoneIndex = zoneNameToIndex(rawNormalized);
      const normalizedZone = zoneIndex !== null 
        ? (getZoneName(zoneIndex) ? zoneNameToString(getZoneName(zoneIndex)!) : rawNormalized)
        : rawNormalized;

      if (heatmapMode === "pxt") {
        const packingPoints = action.packingPoints || 0;
        const xTDifference = getXTDifferenceForAction(action);
        const pxtValue = xTDifference * packingPoints;
        
        const currentValue = heatmap.get(normalizedZone) || 0;
        heatmap.set(normalizedZone, currentValue + pxtValue);
      } else {
        // Tryb liczby akcji
        const currentValue = heatmap.get(normalizedZone) || 0;
        heatmap.set(normalizedZone, currentValue + 1);
      }
    });

    return heatmap;
  }, [allActions, heatmapMode, heatmapDirection, selectedPxtCategory, selectedActionFilter]);

  // Agregacja danych zawodników dla każdej strefy
  const zonePlayerStats = useMemo(() => {
    const stats = new Map<string, Map<string, { pxt: number; passes: number }>>();

    allActions.forEach(action => {
      // Filtruj akcje według kategorii
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      
      // Filtruj akcje według wybranych filtrów Start/Koniec
      if (!matchesSelectedActionFilter(action)) return;
      
      if (selectedPxtCategory === 'dribbler' && action.actionType === 'dribble') {
        // Dla dryblingu zawsze używamy startZone i senderId
        const zone = action.startZone || action.fromZone;
        const playerId = action.senderId;
        
        if (!zone || !playerId) return;

        const normalizedZone = typeof zone === 'string' 
          ? zone.toUpperCase().replace(/\s+/g, '') 
          : String(zone).toUpperCase().replace(/\s+/g, '');

        if (!stats.has(normalizedZone)) {
          stats.set(normalizedZone, new Map());
        }

        const zoneStats = stats.get(normalizedZone)!;
        if (!zoneStats.has(playerId)) {
          zoneStats.set(playerId, { pxt: 0, passes: 0 });
        }

        const playerStats = zoneStats.get(playerId)!;
        playerStats.passes += 1;

        const packingPoints = action.packingPoints || 0;
        const xTDifference = getXTDifferenceForAction(action);
        const pxtValue = xTDifference * packingPoints;
        playerStats.pxt += pxtValue;
        return;
      }
      
      // Dla sender i receiver - tylko podania
      if (action.actionType !== 'pass') return;
      
      let zone: string | undefined;
      let playerId: string | undefined;
      
      if (selectedPxtCategory === 'sender') {
        zone = heatmapDirection === "from" 
          ? (action.fromZone || action.startZone) 
          : (action.toZone || action.endZone);
        playerId = action.senderId;
      } else if (selectedPxtCategory === 'receiver') {
        // Dla receiver: "to" = przyjęcie w strefie (toZone), "from" = przyjęcie z strefy (fromZone)
        zone = heatmapDirection === "to" 
          ? (action.toZone || action.endZone) 
          : (action.fromZone || action.startZone);
        // Zawsze używamy receiverId dla kategorii receiver
        playerId = action.receiverId;
      }
      
      if (!zone || !playerId) return;

      const normalizedZone = typeof zone === 'string' 
        ? zone.toUpperCase().replace(/\s+/g, '') 
        : String(zone).toUpperCase().replace(/\s+/g, '');

      if (!stats.has(normalizedZone)) {
        stats.set(normalizedZone, new Map());
      }

      const zoneStats = stats.get(normalizedZone)!;
      if (!zoneStats.has(playerId)) {
        zoneStats.set(playerId, { pxt: 0, passes: 0 });
      }

      const playerStats = zoneStats.get(playerId)!;
      playerStats.passes += 1;

      // Zawsze obliczaj PxT, niezależnie od trybu (potrzebne do wyświetlania w panelu)
      const packingPoints = action.packingPoints || 0;
      const xTDifference = getXTDifferenceForAction(action);
      const pxtValue = xTDifference * packingPoints;
      playerStats.pxt += pxtValue;
    });

    return stats;
  }, [allActions, heatmapMode, heatmapDirection, selectedPxtCategory, selectedActionFilter]);

  // Statystyki zawodników dla każdej strefy w stratach
  const losesZonePlayerStats = useMemo(() => {
    const stats = new Map<string, Map<string, { losesXT: number; loses: number }>>();

    derivedLosesActions.forEach(action => {
      // Filtruj według wybranego filtra połowy (losesAttackZone = strefa, gdzie straciliśmy piłkę)
      if (losesHalfFilter === "own" || losesHalfFilter === "opponent") {
        const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
        const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
        if (losesZoneName) {
          const zoneIndex = zoneNameToIndex(losesZoneName);
          if (zoneIndex !== null) {
            const isOwn = isOwnHalfByZoneColumn(losesZoneName);
            if (losesHalfFilter === "own" && !isOwn) return;
            if (losesHalfFilter === "opponent" && isOwn) return;
          }
        }
      } else if (losesHalfFilter === "pm") {
        const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
        const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
        if (losesZoneName) {
          const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
          if (!pmZones.includes(losesZoneName)) return;
        }
      }

      // losesAttackZone = strefa, gdzie stracono piłkę
      const zone = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
      const playerId = action.senderId;
      
      if (!zone || !playerId) return;

      const normalizedZone = typeof zone === 'string' 
        ? zone.toUpperCase().replace(/\s+/g, '') 
        : String(zone).toUpperCase().replace(/\s+/g, '');

      if (!stats.has(normalizedZone)) {
        stats.set(normalizedZone, new Map());
      }

      const zoneStats = stats.get(normalizedZone)!;
      if (!zoneStats.has(playerId)) {
        zoneStats.set(playerId, { losesXT: 0, loses: 0 });
      }

      const playerStats = zoneStats.get(playerId)!;
      playerStats.loses += 1;

      // Oblicz xT dla straty (używamy losesDefenseXT)
      const losesXT = action.losesDefenseXT !== undefined 
        ? action.losesDefenseXT 
        : (() => {
            const zoneName = typeof zone === 'string' ? zone.toUpperCase() : String(zone).toUpperCase();
            const zoneIdx = zoneNameToIndex(zoneName);
            if (zoneIdx !== null) return getXTValueForZone(zoneIdx);
            return 0;
          })();
      playerStats.losesXT += losesXT;
    });

    return stats;
  }, [derivedLosesActions, losesHalfFilter]);

  // Automatyczne odświeżanie szczegółów strefy przy zmianie kategorii lub kierunku
  useEffect(() => {
    if (selectedZone) {
      // Jeśli jest wybrana strefa, automatycznie odśwież szczegóły
      const zoneStats = zonePlayerStats.get(selectedZone);
      
      if (zoneStats && zoneStats.size > 0) {
        const playersList = Array.from(zoneStats.entries())
          .map(([playerId, stats]) => {
            const player = players.find(p => p.id === playerId);
            return {
              playerId,
              playerName: getPlayerLabel(playerId, playersIndex),
              pxt: stats.pxt,
              passes: stats.passes,
            };
          })
          .sort((a, b) => b.pxt - a.pxt);
        
        setZoneDetails({
          zoneName: selectedZone,
          players: playersList,
        });
      } else {
        setZoneDetails(null);
        setSelectedZone(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPxtCategory, heatmapDirection, selectedZone]);

  // Custom tooltip dla wykresu
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={styles.tooltip}>
          <p className={styles.tooltipLabel}>{`Minuta: ${data.minute?.toFixed(1)}`}</p>
          <p>Akcja: #{data.actionIndex}</p>
          <hr style={{margin: '8px 0', border: 'none', borderTop: '1px solid #ddd'}} />
          <p style={{ color: '#8884d8' }}>Packing: {data.packing?.toFixed(0)}</p>
          <p style={{ color: TEAM_STATS_GREEN }}>PxT: {data.pxt?.toFixed(2)}</p>
          <p style={{ color: '#ffc658' }}>xT: {data.xt?.toFixed(3)}</p>
        </div>
      );
    }
    return null;
  };

  // TERAZ sprawdź czy aplikacja się ładuje - WSZYSTKIE HOOKI MUSZĄ BYĆ POWYŻEJ!
  if (authLoading || isTeamsLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }

  // Sprawdź uwierzytelnienie
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

  // Sprawdź czy użytkownik ma dostęp do jakichkolwiek zespołów
  if (!isAdmin && (!userTeams || userTeams.length === 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.noTeamsAccess}>
          <h2>🚫 Brak dostępu do zespołów</h2>
          <p>Twoje konto nie ma uprawnień do żadnego zespołu. Skontaktuj się z administratorem, aby uzyskać dostęp.</p>
          <button 
            onClick={logout}
            className={styles.logoutButton}
          >
            Wyloguj się
          </button>
        </div>
      </div>
    );
  }

  // Sprawdź czy są dostępne zespoły
  if (availableTeams.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noTeamsAccess}>
          <h2>⚠️ Brak dostępnych zespołów</h2>
          <p>Nie znaleziono żadnych zespołów dostępnych dla Twojego konta.</p>
          <Link href="/analyzer" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/analyzer" className={styles.backButton} title="Powrót do głównej">
          ←
        </Link>
        <div className={styles.headerTitleRow}>
          <h1>Statystyki zespołu - Analiza meczu</h1>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={handleRefreshData}
            disabled={isRefreshingData}
            aria-disabled={isRefreshingData}
            title="Odśwież dane z Firebase"
          >
            {isRefreshingData ? "Odświeżanie..." : "Odśwież dane"}
          </button>
        </div>
      </div>

      {/* Kompaktowa sekcja wyboru */}
      <div className={styles.compactSelectorsContainer}>
        <div className={`${styles.compactSelectorGroup} ${styles.teamGroup}`}>
          <label id="team-select-label" className={styles.compactLabel}>
            Zespół:
          </label>
          {isTeamsLoading ? (
            <p className={styles.loadingText}>Ładowanie...</p>
          ) : (
            <TeamsSelector
              selectedTeam={selectedTeam}
              onChange={setSelectedTeam}
              teamsCatalog={availableTeams}
              userTeamAccess={{ isAdmin, allowedTeamIds: userTeams ?? [] }}
              className={styles.compactTeamSelectorHeader}
              showLabel={false}
              isExpanded={isTeamsSelectorExpanded}
              onToggle={() => setIsTeamsSelectorExpanded((isExpanded) => !isExpanded)}
            />
          )}
        </div>

        <div className={`${styles.compactSelectorGroup} ${styles.seasonGroup}`}>
          <label className={styles.compactLabel}>
            Sezon:
          </label>
          <SeasonSelector
            selectedSeason={selectedSeason}
            onChange={setSelectedSeason}
            showLabel={false}
            availableSeasons={availableSeasons}
            className={styles.compactSelect}
          />
        </div>

        <div className={styles.compactSelectorGroup} ref={matchSelectRef}>
          <label id="match-select-label" className={styles.compactLabel}>
            Mecz:
          </label>
          {teamMatches.length === 0 ? (
            <p className={styles.noMatchesCompact}>Brak meczów</p>
          ) : (
            <div className={styles.matchSelectWrapper}>
              <button
                type="button"
                id="match-select"
                aria-haspopup="listbox"
                aria-expanded={matchSelectOpen}
                aria-labelledby="match-select-label"
                className={styles.compactSelect}
                onClick={() => setMatchSelectOpen((open) => !open)}
              >
                <span className={styles.compactSelectButtonText}>
                  {matchSelectDisplayInfo
                    ? isPresentationMode
                      ? selectedMatches.length === 0
                        ? "Wybierz mecz"
                        : (matchSelectDisplayInfo as { _multiLabel?: string })._multiLabel
                          ? "Wiele meczów"
                          : "Wybrany mecz"
                      : (matchSelectDisplayInfo as { _multiLabel?: string })._multiLabel
                        ? (matchSelectDisplayInfo as { _multiLabel: string })._multiLabel
                        : `${matchSelectDisplayInfo.opponent} (${matchSelectDisplayInfo.date}) - ${matchSelectDisplayInfo.competition} - ${
                            matchSelectDisplayInfo.isHome ? "Dom" : "Wyjazd"
                          }`
                    : ""}
                </span>
                <span className={styles.matchSelectChevron} aria-hidden>
                  {matchSelectOpen ? "▲" : "▼"}
                </span>
              </button>
              {matchSelectOpen && (
                <ul
                  className={styles.matchSelectDropdown}
                  role="listbox"
                  aria-labelledby="match-select-label"
                  aria-multiselectable="false"
                >
                  {teamMatches.map((match, matchIdx) => {
                    const matchId = match.matchId || "";
                    const isSelected = matchId ? selectedMatches.includes(matchId) : false;
                    const optionLabel = isPresentationMode
                      ? `Mecz ${matchIdx + 1}`
                      : `${match.opponent} (${match.date}) - ${match.competition} - ${match.isHome ? "Dom" : "Wyjazd"}`;
                    return (
                      <li
                        key={matchId || match.opponent}
                        role="option"
                        aria-selected={isSelected}
                        className={styles.matchSelectOptionRow}
                      >
                        <label className={styles.matchSelectOptionLabel}>
                          <input
                            type="radio"
                            name="match-select-radio"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedMatches([matchId]);
                              setMatchSelectOpen(false);
                            }}
                            className={styles.matchSelectCheckbox}
                            aria-label={optionLabel}
                          />
                          <span className={styles.matchSelectOptionText}>{optionLabel}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zakładki z metrykami */}
      {selectedMatches.length > 0 && !isLoadingActions && (
        <div className={styles.statsContainer}>
          <div className={styles.statsLayout}>
            {/* Lista kategorii na górze */}
            <div className={styles.categoriesList}>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'kpi' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('kpi')}
              >
                <span className={styles.categoryName}>KPI</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'pxt' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('pxt')}
              >
                <span className={styles.categoryName}>PxT</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'xg' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('xg')}
              >
                <span className={styles.categoryName}>xG</span>
              </button>
                <button
                  type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'pkEntries' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('pkEntries')}
                >
                <span className={styles.categoryName}>Wejścia w PK</span>
                </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'regains' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('regains')}
              >
                <span className={styles.categoryName}>Przechwyty</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'loses' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('loses')}
              >
                <span className={styles.categoryName}>Straty</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'gps' ? styles.active : ''}`}
                onClick={() => setExpandedCategory('gps')}
              >
                <span className={styles.categoryName}>GPS</span>
              </button>
      </div>

            {/* Szczegóły poniżej */}
            {expandedCategory === 'kpi' && selectedMatchInfo && (
              <Fragment>
              <div>
              <div className={styles.detailsPanel}>
                {(() => {
                  // Oblicz dane dla spidermapy
                  const teamIdInMatch = selectedTeam;
                  const opponentIdInMatch = selectedMatchInfo.opponent;
                  const getKpiEventMinute = (event: any): number => {
                    const rawMinute = event?.minute ?? event?.min;
                    const minute = typeof rawMinute === 'number' ? rawMinute : Number(rawMinute);
                    return Number.isFinite(minute) ? minute : NaN;
                  };
                  const isInKpiMatchPeriod = (event: any): boolean => {
                    if (kpiMatchPeriod === 'total') return true;
                    const minute = getKpiEventMinute(event);
                    if (!Number.isFinite(minute)) return false;
                    return kpiMatchPeriod === 'firstHalf' ? minute <= 45 : minute > 45;
                  };
                  const kpiAllActions = allActions.filter(isInKpiMatchPeriod);
                  const kpiAllRegainActions = allRegainActions.filter(isInKpiMatchPeriod);
                  const kpiDerivedRegainActions = derivedRegainActions.filter(isInKpiMatchPeriod);
                  const kpiDerivedLosesActions = derivedLosesActions.filter(isInKpiMatchPeriod);
                  const kpiAllShots = allShots.filter(isInKpiMatchPeriod);
                  const kpiAllPKEntries = (allPKEntries || []).filter(isInKpiMatchPeriod);
                  const kpiAllAcc8sEntries = (allAcc8sEntries || []).filter(isInKpiMatchPeriod);
                  const kpiPeriodLabel =
                    kpiMatchPeriod === 'firstHalf'
                      ? '1. połowa'
                      : kpiMatchPeriod === 'secondHalf'
                        ? '2. połowa'
                        : 'Cały mecz';
                  const resolveShotTeamId = (shot: any): string | null => {
                    if (shot.teamId) return shot.teamId;
                    if (shot.teamContext === "attack") return teamIdInMatch;
                    if (shot.teamContext === "defense") return opponentIdInMatch;
                    return null;
                  };
                  
                  // Filtruj strzały przeciwnika
                  const opponentShots = kpiAllShots.filter(shot => {
                    const shotTeamId = resolveShotTeamId(shot);
                    return shotTeamId === opponentIdInMatch;
                  });
                  
                  // Filtruj strzały naszego zespołu
                  const teamShots = kpiAllShots.filter(shot => {
                    const shotTeamId = resolveShotTeamId(shot);
                    return shotTeamId === teamIdInMatch;
                  });
                  
                  const opponentXG = opponentShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                  const opponentShotsCount = opponentShots.length;
                  const opponentXGPerShot = opponentShotsCount > 0 ? (opponentXG / opponentShotsCount) : 0;
                  
                  const teamXG = teamShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                  const teamShotsCount = teamShots.length;
                  const teamXGPerShot = teamShotsCount > 0 ? (teamXG / teamShotsCount) : 0;
                  const teamNPxG = sumNonPenaltyXg(teamShots);
                  const opponentNPxG = sumNonPenaltyXg(opponentShots);
                  const teamGoals = teamShots.filter((shot: any) => shot.isGoal || shot.shotType === 'goal').length;
                  const opponentGoals = opponentShots.filter((shot: any) => shot.isGoal || shot.shotType === 'goal').length;
                  const teamOnTarget = teamShots.filter((s: any) => s.shotType === 'on_target' || s.shotType === 'goal' || s.isGoal).length;
                  const opponentOnTarget = opponentShots.filter((s: any) => s.shotType === 'on_target' || s.shotType === 'goal' || s.isGoal).length;
                  const teamOffTarget = teamShots.filter((s: any) => s.shotType === 'off_target').length;
                  const opponentOffTarget = opponentShots.filter((s: any) => s.shotType === 'off_target').length;
                  const teamBlocked = teamShots.filter((s: any) => s.shotType === 'blocked').length;
                  const opponentBlocked = opponentShots.filter((s: any) => s.shotType === 'blocked').length;
                  const xgOutcomeProjection = calculateXgOutcomeProjection(teamShots, opponentShots);
                  const teamXGDelta = teamGoals - teamXG;
                  const opponentXGDelta = opponentGoals - opponentXG;

                  // xG wg rodzaju: SFG, otwarta gra, regain
                  const isSfgShot = (shot: any) =>
                    (shot.actionCategory === 'sfg') ||
                    shot.actionType === 'corner' || shot.actionType === 'free_kick' ||
                    shot.actionType === 'direct_free_kick' || shot.actionType === 'penalty' || shot.actionType === 'throw_in';
                  const teamShotsSFG = teamShots.filter(isSfgShot);
                  const opponentShotsSFG = opponentShots.filter(isSfgShot);
                  const teamXGSFG = teamShotsSFG.reduce((sum, s) => sum + (s.xG || 0), 0);
                  const opponentXGSFG = opponentShotsSFG.reduce((sum, s) => sum + (s.xG || 0), 0);
                  const teamGoalsSFG = teamShotsSFG.filter((shot: any) => shot.isGoal || shot.shotType === 'goal').length;
                  const opponentGoalsSFG = opponentShotsSFG.filter((shot: any) => shot.isGoal || shot.shotType === 'goal').length;

                  const isRegainShot = (shot: any) => shot.actionType === 'regain';
                  const REGAIN_XG_FALLBACK_EPS = 1e-9;

                  const allRegainCombined = [
                    ...kpiAllRegainActions,
                    ...kpiAllActions.filter((a: any) => a.isRegain === true || isRegainAction(a)),
                  ];
                  const uniqueRegains = Array.from(
                    new Map(allRegainCombined.map(a => [a.id || `${a.minute}_${a.x}_${a.y}`, a])).values()
                  );
                  const regainWithTs = uniqueRegains
                    .map(a => ({ action: a, ts: (a as any).videoTimestampRaw ?? (a as any).videoTimestamp ?? 0 }))
                    .filter(x => x.ts > 0)
                    .sort((a, b) => a.ts - b.ts);
                  const shotsWithTs = [...teamShots, ...opponentShots]
                    .map(s => ({ shot: s, ts: (s as any).videoTimestampRaw ?? (s as any).videoTimestamp ?? 0 }))
                    .filter(x => x.ts > 0);
                  let teamXGRegainWindow = 0;
                  let opponentXGRegainWindow = 0;
                  let teamGoalsRegainWindow = 0;
                  let opponentGoalsRegainWindow = 0;
                  regainWithTs.forEach((item, i) => {
                    const nextTs = i < regainWithTs.length - 1 ? regainWithTs[i + 1].ts : Infinity;
                    const endTs = item.ts + 8;
                    const regainTeamId = item.action.teamId || (item.action.teamContext === 'attack' ? teamIdInMatch : opponentIdInMatch);
                    const shotsInWindow = shotsWithTs.filter(
                      x => x.ts > item.ts && x.ts <= endTs && x.ts < nextTs && resolveShotTeamId(x.shot) === regainTeamId
                    );
                    const xg = shotsInWindow.reduce((sum, x) => sum + (x.shot.xG || 0), 0);
                    const goals = shotsInWindow.filter(x => x.shot.isGoal || x.shot.shotType === 'goal').length;
                    if (regainTeamId === teamIdInMatch) {
                      teamXGRegainWindow += xg;
                      teamGoalsRegainWindow += goals;
                    } else {
                      opponentXGRegainWindow += xg;
                      opponentGoalsRegainWindow += goals;
                    }
                  });
                  let teamXGRegain =
                    teamXGRegainWindow > REGAIN_XG_FALLBACK_EPS
                      ? teamXGRegainWindow
                      : teamShots.filter(isRegainShot).reduce((sum, s) => sum + (s.xG || 0), 0);
                  let teamGoalsRegain =
                    teamXGRegainWindow > REGAIN_XG_FALLBACK_EPS
                      ? teamGoalsRegainWindow
                      : teamShots.filter((s: any) => isRegainShot(s) && (s.isGoal || s.shotType === 'goal')).length;
                  let opponentXGRegain =
                    opponentXGRegainWindow > REGAIN_XG_FALLBACK_EPS
                      ? opponentXGRegainWindow
                      : opponentShots.filter(isRegainShot).reduce((sum, s) => sum + (s.xG || 0), 0);
                  let opponentGoalsRegain =
                    opponentXGRegainWindow > REGAIN_XG_FALLBACK_EPS
                      ? opponentGoalsRegainWindow
                      : opponentShots.filter((s: any) => isRegainShot(s) && (s.isGoal || s.shotType === 'goal')).length;
                  const teamXGOpenPlay = teamXG - teamXGSFG - teamXGRegain;
                  const opponentXGOpenPlay = opponentXG - opponentXGSFG - opponentXGRegain;
                  const teamGoalsOpenPlay = teamGoals - teamGoalsSFG - teamGoalsRegain;
                  const opponentGoalsOpenPlay = opponentGoals - opponentGoalsSFG - opponentGoalsRegain;
                  const teamShotToRegainWindowMap = new Map<string, boolean>();
                  if (teamXGRegainWindow > REGAIN_XG_FALLBACK_EPS) {
                    regainWithTs.forEach((item, i) => {
                      const nextTs = i < regainWithTs.length - 1 ? regainWithTs[i + 1].ts : Infinity;
                      const endTs = item.ts + 8;
                      const regainTeamId = item.action.teamId || (item.action.teamContext === 'attack' ? teamIdInMatch : opponentIdInMatch);
                      if (regainTeamId !== teamIdInMatch) return;
                      shotsWithTs.forEach((shotEntry) => {
                        const shotId = shotEntry.shot?.id;
                        if (!shotId) return;
                        const isInWindow = shotEntry.ts > item.ts && shotEntry.ts <= endTs && shotEntry.ts < nextTs && resolveShotTeamId(shotEntry.shot) === regainTeamId;
                        if (isInWindow) {
                          teamShotToRegainWindowMap.set(shotId, true);
                        }
                      });
                    });
                  } else {
                    teamShots.filter(isRegainShot).forEach((shot) => {
                      if (shot.id) teamShotToRegainWindowMap.set(shot.id, true);
                    });
                  }
                  const xgPlayersSummary = teamShots
                    .reduce((acc, shot) => {
                      const xgValue = Number(shot.xG) || 0;
                      if (xgValue <= 0) return acc;
                      const playerIdRaw = String(shot.playerId || '').trim();
                      const fallbackName = String(shot.playerName || shot.player || shot.playerDisplayName || '').trim();
                      const playerId = playerIdRaw || `name:${fallbackName || 'unknown'}`;
                      const playerName = playerIdRaw
                        ? getPlayerLabel(playerIdRaw, playersIndex)
                        : (fallbackName || 'Nieznany zawodnik');
                      if (!acc[playerId]) {
                        acc[playerId] = {
                          playerId,
                          playerName,
                          xg: 0,
                          shots: 0,
                          goals: 0,
                          xgSfg: 0,
                          xgRegain: 0,
                        };
                      }
                      acc[playerId].xg += xgValue;
                      acc[playerId].shots += 1;
                      const isGoal = shot.isGoal || shot.shotType === 'goal';
                      if (isGoal) acc[playerId].goals += 1;
                      if (isSfgShot(shot)) {
                        acc[playerId].xgSfg += xgValue;
                      }
                      if (shot.id && teamShotToRegainWindowMap.get(shot.id)) {
                        acc[playerId].xgRegain += xgValue;
                      }
                      return acc;
                    }, {} as Record<string, {
                      playerId: string;
                      playerName: string;
                      xg: number;
                      shots: number;
                      goals: number;
                      xgSfg: number;
                      xgRegain: number;
                    }>);
                  const xgPlayersList = Object.values(xgPlayersSummary)
                    .map((playerStats) => ({
                      ...playerStats,
                      xgPerShot: playerStats.shots > 0 ? playerStats.xg / playerStats.shots : 0,
                      xgSharePct: teamXG > 0 ? (playerStats.xg / teamXG) * 100 : 0,
                    }))
                    .sort((a, b) => b.xg - a.xg);
                  const kpiXgSortCol = kpiXgSort.column;
                  const kpiXgSortDir = kpiXgSort.dir;
                  const sortedXgPlayersList = !kpiXgSortCol
                    ? xgPlayersList
                    : [...xgPlayersList].sort((a, b) => {
                        let va: string | number;
                        let vb: string | number;
                        if (kpiXgSortCol === 'playerName') {
                          va = (a.playerName ?? '');
                          vb = (b.playerName ?? '');
                          return kpiXgSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                        }
                        if (kpiXgSortCol === 'xgMinusGoals') {
                          va = a.xg - (a.goals ?? 0);
                          vb = b.xg - (b.goals ?? 0);
                        } else {
                          va = Number((a as Record<string, unknown>)[kpiXgSortCol]) ?? 0;
                          vb = Number((b as Record<string, unknown>)[kpiXgSortCol]) ?? 0;
                        }
                        return kpiXgSortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
                      });

                  const shotsPlayersSummary = teamShots.reduce((acc, shot) => {
                    const playerIdRaw = String(shot.playerId || '').trim();
                    const fallbackName = String(shot.playerName || shot.player || shot.playerDisplayName || '').trim();
                    const playerId = playerIdRaw || `name:${fallbackName || 'unknown'}`;
                    const playerName = playerIdRaw
                      ? getPlayerLabel(playerIdRaw, playersIndex)
                      : (fallbackName || 'Nieznany zawodnik');
                    if (!acc[playerId]) {
                      acc[playerId] = {
                        playerId,
                        playerName,
                        shots: 0,
                        onTarget: 0,
                        goals: 0,
                        blocked: 0,
                      };
                    }
                    acc[playerId].shots += 1;
                    const isGoal = shot.isGoal || shot.shotType === 'goal';
                    const isOnTarget = shot.shotType === 'on_target' || isGoal || shot.isGoal;
                    const isBlocked = shot.shotType === 'blocked';
                    if (isOnTarget) acc[playerId].onTarget += 1;
                    if (isGoal) acc[playerId].goals += 1;
                    if (isBlocked) acc[playerId].blocked += 1;
                    return acc;
                  }, {} as Record<string, {
                    playerId: string;
                    playerName: string;
                    shots: number;
                    onTarget: number;
                    goals: number;
                    blocked: number;
                  }>);
                  const shotsPlayersList = Object.values(shotsPlayersSummary)
                    .map((playerStats) => ({
                      ...playerStats,
                      shotsSharePct: teamShotsCount > 0 ? (playerStats.shots / teamShotsCount) * 100 : 0,
                      onTargetPct: playerStats.shots > 0 ? (playerStats.onTarget / playerStats.shots) * 100 : 0,
                      shotsMinusGoals: playerStats.shots - (playerStats.goals ?? 0),
                    }))
                    .sort((a, b) => b.shots - a.shots);
                  const kpiShotsSortCol = kpiShotsSort.column;
                  const kpiShotsSortDir = kpiShotsSort.dir;
                  const sortedShotsPlayersList = !kpiShotsSortCol
                    ? shotsPlayersList
                    : [...shotsPlayersList].sort((a, b) => {
                        let va: string | number = (a as Record<string, unknown>)[kpiShotsSortCol];
                        let vb: string | number = (b as Record<string, unknown>)[kpiShotsSortCol];
                        if (kpiShotsSortCol === 'playerName') {
                          va = (va as string) ?? '';
                          vb = (vb as string) ?? '';
                          return kpiShotsSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                        }
                        va = Number(va) ?? 0;
                        vb = Number(vb) ?? 0;
                        return kpiShotsSortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
                      });

                  // Oblicz % strzałów z 1T w strefie 1T (KANONICZNIE, niezależnie od obrotu UI)
                  const teamShots1T = teamShots.filter(isIn1TZoneCanonical);
                  const teamShots1TCount = teamShots1T.length;
                  const teamShots1TContact1 = teamShots1T.filter(shot => shot.isContact1 === true).length;
                  const team1TContact1Percentage = teamShots1TCount > 0 ? (teamShots1TContact1 / teamShots1TCount) * 100 : 0;
                  
                  // Wejścia w PK przeciwnika (teamContext === 'defense')
                  const opponentPKEntries = kpiAllPKEntries.filter((e: any) =>
                    e && e.teamId === selectedTeam && (e.teamContext ?? "attack") === "defense"
                  );
                  const opponentPKEntriesCount = opponentPKEntries.length;
                  const teamPKEntries = kpiAllPKEntries.filter((e: any) =>
                    e && e.teamId === selectedTeam && (e.teamContext ?? "attack") !== "defense"
                  );
                  const teamPKEntriesCount = teamPKEntries.length;
                  const teamPkBr = getPkEntryKpiBreakdownCounts(teamPKEntries);
                  const opponentPkBr = getPkEntryKpiBreakdownCounts(opponentPKEntries);
                  const teamPKSfgCount = teamPkBr.sfgCount;
                  const teamPKDribbleCount = teamPkBr.dribbleCount;
                  const teamPKPassCount = teamPkBr.passCount;
                  const teamPKDribbleRegainCount = teamPkBr.dribbleRegainCount;
                  const teamPKPassRegainCount = teamPkBr.passRegainCount;
                  const opponentPKSfgCount = opponentPkBr.sfgCount;
                  const opponentPKDribbleCount = opponentPkBr.dribbleCount;
                  const opponentPKPassCount = opponentPkBr.passCount;
                  const opponentPKDribbleRegainCount = opponentPkBr.dribbleRegainCount;
                  const opponentPKPassRegainCount = opponentPkBr.passRegainCount;
                  const pkPlayersSummary = teamPKEntries.reduce((acc, entry: any) => {
                    const enabledRoles = kpiPkPlayersRoles;
                    const perEntryPlayers = new Map<string, { playerIdRaw: string; fallbackName: string }>();

                    const rawType = String(entry.entryType || entry.actionType || '').toLowerCase();
                    const isDribbleEntry = rawType === "dribble" && !isPkSfgEntry(entry);

                    const addRolePlayer = (roleKey: 'sender' | 'receiver' | 'dribbler', idRaw?: string | null, nameRaw?: string | null) => {
                      if (!enabledRoles[roleKey]) return;
                      if (roleKey === 'sender' && isDribbleEntry) return;
                      if (roleKey === 'dribbler' && !isDribbleEntry) return;

                      const playerIdRaw = String(idRaw || '').trim();
                      const fallbackName = String(nameRaw || '').trim();
                      if (!playerIdRaw && !fallbackName) return;
                      const key = playerIdRaw || `name:${fallbackName}`;
                      if (!perEntryPlayers.has(key)) {
                        perEntryPlayers.set(key, { playerIdRaw, fallbackName });
                      }
                    };

                    addRolePlayer(
                      'sender',
                      entry.senderId ?? entry.playerId,
                      entry.senderName ?? entry.playerName ?? entry.player ?? entry.playerDisplayName
                    );
                    addRolePlayer(
                      'receiver',
                      entry.receiverId ?? entry.playerId,
                      entry.receiverName ?? entry.playerName ?? entry.player ?? entry.playerDisplayName
                    );
                    addRolePlayer(
                      'dribbler',
                      isDribbleEntry ? (entry.senderId ?? entry.playerId) : (entry.dribblerId ?? entry.playerId),
                      isDribbleEntry
                        ? (entry.senderName ?? entry.playerName ?? entry.player ?? entry.playerDisplayName)
                        : (entry.dribblerName ?? entry.playerName ?? entry.player ?? entry.playerDisplayName)
                    );

                    if (perEntryPlayers.size === 0) {
                      return acc;
                    }

                    const isRegainEntry = !!entry.isRegain;
                    const isSfgEntry = isPkSfgEntry(entry);
                    const isShotEntry = !!entry.isShot;

                    perEntryPlayers.forEach(({ playerIdRaw, fallbackName }, key) => {
                      const hasId = !!playerIdRaw;
                      const playerName = hasId
                        ? getPlayerLabel(playerIdRaw, playersIndex)
                        : fallbackName;
                      if (!acc[key]) {
                        acc[key] = {
                          playerId: key,
                          playerName,
                          entries: 0,
                          entriesRegain: 0,
                          entriesSfg: 0,
                          entriesShot: 0,
                        };
                      }
                      acc[key].entries += 1;
                      if (isRegainEntry) acc[key].entriesRegain += 1;
                      if (isSfgEntry) acc[key].entriesSfg += 1;
                      if (isShotEntry) acc[key].entriesShot += 1;
                    });

                    return acc;
                  }, {} as Record<string, {
                    playerId: string;
                    playerName: string;
                    entries: number;
                    entriesRegain: number;
                    entriesSfg: number;
                    entriesShot: number;
                  }>);
                  const pkPlayersList = Object.values(pkPlayersSummary)
                    .map((playerStats) => ({
                      ...playerStats,
                      entriesSharePct: teamPKEntriesCount > 0 ? (playerStats.entries / teamPKEntriesCount) * 100 : 0,
                    }))
                    .sort((a, b) => b.entries - a.entries);
                  const kpiPkSortCol = kpiPkSort.column;
                  const kpiPkSortDir = kpiPkSort.dir;
                  const sortedPkPlayersList = !kpiPkSortCol
                    ? pkPlayersList
                    : [...pkPlayersList].sort((a, b) => {
                        let va: string | number = (a as Record<string, unknown>)[kpiPkSortCol];
                        let vb: string | number = (b as Record<string, unknown>)[kpiPkSortCol];
                        if (kpiPkSortCol === 'playerName') {
                          va = (va as string) ?? '';
                          vb = (vb as string) ?? '';
                          return kpiPkSortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                        }
                        va = Number(va) ?? 0;
                        vb = Number(vb) ?? 0;
                        return kpiPkSortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
                      });
                  const totalPxtAll = kpiMatchPeriod === 'firstHalf'
                    ? halfTimeStats.firstHalf.pxt
                    : kpiMatchPeriod === 'secondHalf'
                      ? halfTimeStats.secondHalf.pxt
                      : halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                  // PxT per zawodnik: podanie (sender), odbiór (receiver), drybling (dribbler) + ile razy zdobyli/otrzymali piłkę w P2/P3
                  const teamPxtActions = kpiAllActions.filter((a: any) => a.teamId === selectedTeam);
                  const pxtPlayersSummary = teamPxtActions.reduce(
                    (
                      acc: Record<string, {
                        playerId: string;
                        playerName: string;
                        pxtSender: number;
                        pxtReceiver: number;
                        pxtDribbler: number;
                        p2Sender: number;
                        p2Receiver: number;
                        p3Sender: number;
                        p3Receiver: number;
                        p2Dribbler: number;
                        p3Dribbler: number;
                      }>,
                      action: any
                    ) => {
                      const packingPoints = action.packingPoints || 0;
                      const xTDifference = getXTDifferenceForAction(action);
                      const pxtValue = xTDifference * packingPoints;
                      const isDribble = (action.actionType || '').toLowerCase() === 'dribble';
                      const isPass = (action.actionType || '').toLowerCase() === 'pass' || !isDribble;
                      const inP2 = action.isP2 === true;
                      const inP3 = action.isP3 === true;

                      const ensurePlayer = (playerId: string) => {
                        if (!playerId) return undefined;
                        const name =
                          getPlayerLabel(playerId, playersIndex) ||
                          action.senderName ||
                          action.receiverName ||
                          'Nieznany zawodnik';
                        if (!acc[playerId]) {
                          acc[playerId] = {
                            playerId,
                            playerName: name,
                            pxtSender: 0,
                            pxtReceiver: 0,
                            pxtDribbler: 0,
                            p2Sender: 0,
                            p2Receiver: 0,
                            p3Sender: 0,
                            p3Receiver: 0,
                            p2Dribbler: 0,
                            p3Dribbler: 0,
                          };
                        }
                        acc[playerId].playerName = name;
                        return acc[playerId];
                      };

                      const addPxt = (playerId: string, role: 'pxtSender' | 'pxtReceiver' | 'pxtDribbler') => {
                        const playerStats = ensurePlayer(playerId);
                        if (!playerStats) return;
                        playerStats[role] += pxtValue;
                      };

                      if (isDribble && action.senderId) {
                        addPxt(action.senderId, 'pxtDribbler');
                      } else if (isPass) {
                        if (action.senderId) addPxt(action.senderId, 'pxtSender');
                        if (action.receiverId) addPxt(action.receiverId, 'pxtReceiver');
                      }

                      if (isPass) {
                        if (action.senderId) {
                          const senderStats = ensurePlayer(action.senderId);
                          if (senderStats) {
                            if (inP2) senderStats.p2Sender += 1;
                            if (inP3) senderStats.p3Sender += 1;
                          }
                        }
                        if (action.receiverId) {
                          const receiverStats = ensurePlayer(action.receiverId);
                          if (receiverStats) {
                            if (inP2) receiverStats.p2Receiver += 1;
                            if (inP3) receiverStats.p3Receiver += 1;
                          }
                        }
                      }
                      if (isDribble && action.senderId) {
                        const dribblerStats = ensurePlayer(action.senderId);
                        if (dribblerStats) {
                          if (inP2) dribblerStats.p2Dribbler += 1;
                          if (inP3) dribblerStats.p3Dribbler += 1;
                        }
                      }

                      return acc;
                    },
                    {}
                  );
                  const enabledPxtRoles = kpiPxtPlayersRoles;
                  const pxtPlayersList = Object.values(pxtPlayersSummary)
                    .map((p) => {
                      const fromRoles = (enabledPxtRoles.sender ? p.pxtSender : 0) + (enabledPxtRoles.receiver ? p.pxtReceiver : 0) + (enabledPxtRoles.dribbler ? p.pxtDribbler : 0);
                      return {
                        ...p,
                        pxtTotal: p.pxtSender + p.pxtReceiver + p.pxtDribbler,
                        pxtFromSelectedRoles: fromRoles,
                        pxtSharePct: totalPxtAll > 0 ? (fromRoles / totalPxtAll) * 100 : 0,
                      };
                    })
                    .filter((p) => p.pxtFromSelectedRoles > 0)
                    .sort((a, b) => b.pxtFromSelectedRoles - a.pxtFromSelectedRoles);
                  const sortCol = kpiPxtSort.column;
                  const sortDir = kpiPxtSort.dir;
                  const sortedPxtPlayersList = sortCol
                    ? [...pxtPlayersList].sort((a, b) => {
                        let va: string | number = a[sortCol as keyof typeof a];
                        let vb: string | number = b[sortCol as keyof typeof b];
                        if (sortCol === 'playerName') {
                          va = (va as string) || '';
                          vb = (vb as string) || '';
                          return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                        }
                        va = Number(va) ?? 0;
                        vb = Number(vb) ?? 0;
                        return sortDir === 'asc' ? va - vb : vb - va;
                      })
                    : pxtPlayersList;
                  // Per-player P2/P3: podający, przyjęcie, drybling z packing + regain
                  // Jak w teamRegainStats: own/opponent po strefie obrony; PM Area po strefie ataku przechwytu
                  const isOwnHalfRegain = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    return isOwnHalfByZoneColumn(normalized);
                  };
                  const isPMAreaRegain = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                    return pmZones.includes(normalized);
                  };
                  let filteredRegainsForP2P3 = (kpiDerivedRegainActions || []).filter((a: any) => {
                    if (a.teamId !== selectedTeam) return false;
                    if (regainHalfFilter === 'pm') {
                      const attackZoneRaw = regainAttackZoneRawForMap(a);
                      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                      return isPMAreaRegain(attackZoneName);
                    }
                    const defenseZoneRaw = a.regainDefenseZone || a.fromZone || a.toZone || a.startZone;
                    const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                    if (!defenseZoneName) return false;
                    if (regainHalfFilter === 'all') return true;
                    const isOwn = isOwnHalfRegain(defenseZoneName);
                    return regainHalfFilter === 'own' ? isOwn : !isOwn;
                  });
                  const regainP2P3ByPlayer = filteredRegainsForP2P3
                    .filter((a: any) => a.isP2 || a.isP3 || a.isP2Start === true || a.isP3Start === true)
                    .reduce((acc: Record<string, { p2Regain: number; p3Regain: number }>, a: any) => {
                      const id = a.senderId || (a as any).playerId;
                      if (!id) return acc;
                      if (!acc[id]) acc[id] = { p2Regain: 0, p3Regain: 0 };
                      if (a.isP2 || a.isP2Start) acc[id].p2Regain += 1;
                      if (a.isP3 || a.isP3Start) acc[id].p3Regain += 1;
                      return acc;
                    }, {});
                  const allP2P3PlayerIds = new Set([
                    ...Object.keys(pxtPlayersSummary),
                    ...Object.keys(regainP2P3ByPlayer),
                  ]);
                  const p2p3PlayersList = Array.from(allP2P3PlayerIds)
                    .map((playerId) => {
                      const p = pxtPlayersSummary[playerId];
                      const r = regainP2P3ByPlayer[playerId] || { p2Regain: 0, p3Regain: 0 };
                      const p2Sender = p?.p2Sender ?? 0;
                      const p3Sender = p?.p3Sender ?? 0;
                      const p2Receiver = p?.p2Receiver ?? 0;
                      const p3Receiver = p?.p3Receiver ?? 0;
                      const p2Dribbler = p?.p2Dribbler ?? 0;
                      const p3Dribbler = p?.p3Dribbler ?? 0;
                      const p2Total = p2Sender + p2Dribbler + r.p2Regain;
                      const p3Total = p3Sender + p3Dribbler + r.p3Regain;
                      const p2Sum = r.p2Regain + p2Sender + p2Dribbler + p2Receiver;
                      const p3Sum = r.p3Regain + p3Sender + p3Dribbler + p3Receiver;
                      const playerName = p?.playerName ?? getPlayerLabel(playerId, playersIndex) ?? 'Nieznany zawodnik';
                      return {
                        playerId,
                        playerName,
                        p2Total,
                        p3Total,
                        p2Sum,
                        p3Sum,
                        p2Regain: r.p2Regain,
                        p3Regain: r.p3Regain,
                        p2Sender,
                        p3Sender,
                        p2Dribbler,
                        p3Dribbler,
                        p2Receiver,
                        p3Receiver,
                      };
                    })
                    .filter((row) => row.p2Total > 0 || row.p3Total > 0)
                    .sort((a, b) => b.p2Total + b.p3Total - (a.p2Total + a.p3Total));
                  const p2p3SortCol = kpiP2P3Sort.column;
                  const p2p3SortDir = kpiP2P3Sort.dir;
                  const getP2P3SortValue = (row: typeof p2p3PlayersList[0], col: string) => {
                    if (col === 'playerName') return row.playerName ?? '';
                    if (col === 'p2Regain') return row.p2Regain;
                    if (col === 'p3Regain') return row.p3Regain;
                    if (col === 'p2Sender') return row.p2Sender;
                    if (col === 'p3Sender') return row.p3Sender;
                    if (col === 'p2Dribbler') return row.p2Dribbler;
                    if (col === 'p3Dribbler') return row.p3Dribbler;
                    if (col === 'p2Receiver') return row.p2Receiver;
                    if (col === 'p3Receiver') return row.p3Receiver;
                    if (col === 'p2Sum') return row.p2Sum;
                    if (col === 'p3Sum') return row.p3Sum;
                    return 0;
                  };
                  const sortedP2P3PlayersList = p2p3SortCol
                    ? [...p2p3PlayersList].sort((a, b) => {
                        const va = getP2P3SortValue(a, p2p3SortCol);
                        const vb = getP2P3SortValue(b, p2p3SortCol);
                        if (p2p3SortCol === 'playerName') {
                          return p2p3SortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
                        }
                        const na = Number(va) ?? 0;
                        const nb = Number(vb) ?? 0;
                        return p2p3SortDir === 'asc' ? na - nb : nb - na;
                      })
                    : p2p3PlayersList;
                  // Łączna liczba akcji P2/P3: podania progresywne (podający + drybling) + P2/P3 po regains
                  const totalP2FromPass = teamPxtActions.filter((a: any) => (a.isP2 || a.isP2Start) && String(a.actionType || '').toLowerCase() !== 'dribble').length;
                  const totalP2FromDribble = teamPxtActions.filter((a: any) => (a.isP2 || a.isP2Start) && String(a.actionType || '').toLowerCase() === 'dribble').length;
                  const totalP2FromRegain = filteredRegainsForP2P3.filter((a: any) => a.isP2 || a.isP2Start).length;
                  const totalP2Actions = totalP2FromPass + totalP2FromDribble + totalP2FromRegain;

                  const totalP3FromPass = teamPxtActions.filter((a: any) => (a.isP3 || a.isP3Start) && String(a.actionType || '').toLowerCase() !== 'dribble').length;
                  const totalP3FromDribble = teamPxtActions.filter((a: any) => (a.isP3 || a.isP3Start) && String(a.actionType || '').toLowerCase() === 'dribble').length;
                  const totalP3FromRegain = filteredRegainsForP2P3.filter((a: any) => a.isP3 || a.isP3Start).length;
                  const totalP3Actions = totalP3FromPass + totalP3FromDribble + totalP3FromRegain;
                  
                  // Oblicz % strat z isReaction5s === true
                  // 1. Wliczamy wszystkie straty z loses
                  // 2. Odejmujemy tylko straty z flagą isAut
                  // 3. Uwzględniamy straty z isReaction5s === true LUB isBadReaction5s === true (mają zaznaczony jeden z przycisków 5s)
                  // 4. Sprawdzamy, jaki % z tych strat ma flagę isReaction5s === true (✓ 5s)
                  const allLoses = kpiDerivedLosesActions;
                  // Wszystkie straty bez isAut, które mają zaznaczony jeden z przycisków 5s (✓ 5s LUB ✗ 5s)
                  // Uwaga: sprawdzamy dokładnie === true, aby wykluczyć undefined i false
                  // Wsparcie wsteczne: isReaction5sNotApplicable jest traktowane jak isBadReaction5s
                  const losesWith5sFlags = allLoses.filter(action => {
                    if (action.isAut === true) return false;
                    // Sprawdzamy isBadReaction5s lub isReaction5sNotApplicable (wsparcie wsteczne)
                    const hasBad5s = action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true;
                    return action.isReaction5s === true || hasBad5s;
                  });
                  // Straty z flagą isReaction5s === true (✓ 5s - dobre)
                  const reaction5sLoses = losesWith5sFlags.filter(action => 
                    action.isReaction5s === true
                  );
                  const reaction5sPercentage = losesWith5sFlags.length > 0 
                    ? (reaction5sLoses.length / losesWith5sFlags.length) * 100 
                    : 0;
                  
                  // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
                  const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    return isOwnHalfByZoneColumn(normalized);
                  };
                  
                  // Funkcja pomocnicza do określenia czy strefa jest w PM Area (C5-8, D5-8, E5-8, F5-8)
                  const isPMArea = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    // PM Area to strefy: C5, C6, C7, C8, D5, D6, D7, D8, E5, E6, E7, E8, F5, F6, F7, F8
                    const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                    return pmZones.includes(normalized);
                  };
                  
                  // Oblicz straty w PM Area
                  const losesInPMArea = allLoses.filter(action => {
                    const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                    const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                    return isPMArea(losesZoneName);
                  });
                  const losesInPMAreaCount = losesInPMArea.length;
                  const losesInPMAreaPercentage = allLoses.length > 0 
                    ? (losesInPMAreaCount / allLoses.length) * 100 
                    : 0;
                  
                  // Oblicz statystyki 8s ACC
                  // allAcc8sEntries są już przefiltrowane dla wybranego meczu w useEffect
                  const all8sAccEntries = kpiAllAcc8sEntries.filter((entry: any) => entry);
                  const total8sAcc = all8sAccEntries.length;
                  
                  const pk8sEntries = all8sAccEntries.filter((entry: any) => entry.isPKEntryUnder8s === true);
                  const pk8sCount = pk8sEntries.length;
                  const pk8sPercentage = total8sAcc > 0 ? (pk8sCount / total8sAcc) * 100 : 0;
                  
                  const shot8sEntries = all8sAccEntries.filter((entry: any) => entry.isShotUnder8s === true);
                  const shot8sCount = shot8sEntries.length;
                  const shot8sPercentage = total8sAcc > 0 ? (shot8sCount / total8sAcc) * 100 : 0;
                  
                  // Strzały i PK 8s - suma liczbową PK 8s + Strzały 8s (nawet jeśli niektóre akcje są w obu kategoriach)
                  // To jest suma wszystkich akcji z flagą strzału LUB PK (unikalne akcje)
                  const shotAndPK8sEntries = all8sAccEntries.filter((entry: any) => 
                    entry.isShotUnder8s === true || entry.isPKEntryUnder8s === true
                  );
                  const shotAndPK8sCount = shotAndPK8sEntries.length;
                  const shotAndPK8sPercentage = total8sAcc > 0 ? (shotAndPK8sCount / total8sAcc) * 100 : 0;
                  
                  // Oblicz wejścia w PK w odległości 8s i 9s od akcji 8s ACC
                  // Dla każdej akcji 8s ACC z videoTimestampRaw, znajdź wejścia w PK w przedziale [czas_8s_acc, czas_8s_acc + Xs]
                  const acc8sWithTimestamp = all8sAccEntries.filter((entry: any) => 
                    entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null
                  );
                  
                  const pkEntriesWithTimestamp = kpiAllPKEntries.filter((entry: any) =>
                    entry && (entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null || 
                              entry.videoTimestamp !== undefined && entry.videoTimestamp !== null)
                  );
                  
                  const shotsWithTimestamp = kpiAllShots.filter((entry: any) =>
                    entry && (entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null || 
                              entry.videoTimestamp !== undefined && entry.videoTimestamp !== null)
                  );
                  
                  // Zlicz akcje 8s ACC, które mają wejścia w PK LUB strzały w przedziale 8s
                  const acc8sWithPKOrShot8s = acc8sWithTimestamp.filter((acc8sEntry: any) => {
                    const acc8sTime = acc8sEntry.videoTimestampRaw;
                    const timeWindowEnd8s = acc8sTime + 8;
                    
                    // Sprawdź czy jest wejście w PK w przedziale 8s
                    const hasPK = pkEntriesWithTimestamp.some((pkEntry: any) => {
                      let pkTime: number | null = null;
                      if (pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null) {
                        pkTime = pkEntry.videoTimestampRaw;
                      } else if (pkEntry.videoTimestamp !== undefined && pkEntry.videoTimestamp !== null) {
                        pkTime = pkEntry.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                      }
                      if (pkTime === null) return false;
                      return pkTime >= acc8sTime && pkTime <= timeWindowEnd8s;
                    });
                    
                    // Sprawdź czy jest strzał w przedziale 8s
                    const hasShot = shotsWithTimestamp.some((shot: any) => {
                      let shotTime: number | null = null;
                      if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                        shotTime = shot.videoTimestampRaw;
                      } else if (shot.videoTimestamp !== undefined && shot.videoTimestamp !== null) {
                        shotTime = shot.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                      }
                      if (shotTime === null) return false;
                      return shotTime >= acc8sTime && shotTime <= timeWindowEnd8s;
                    });
                    
                    return hasPK || hasShot;
                  });
                  
                  const pkEntriesWithin8sCount = acc8sWithPKOrShot8s.length;
                  const pkEntriesWithin8sPercentage = total8sAcc > 0 ? (pkEntriesWithin8sCount / total8sAcc) * 100 : 0;
                  
                  // Zlicz unikalne wejścia w PK, które są w odległości <= 9s od jakiejkolwiek akcji 8s ACC
                  const pkEntriesWithin9s = new Set<string>(); // Używamy Set, aby uniknąć duplikatów
                  
                  acc8sWithTimestamp.forEach((acc8sEntry: any) => {
                    const acc8sTime = acc8sEntry.videoTimestampRaw;
                    const timeWindowEnd9s = acc8sTime + 9; // 9 sekund od akcji 8s ACC
                    
                    pkEntriesWithTimestamp.forEach((pkEntry: any) => {
                      const pkTime = pkEntry.videoTimestampRaw;
                      // Wejście w PK musi być w przedziale [czas_8s_acc, czas_8s_acc + 9s]
                      if (pkTime >= acc8sTime && pkTime <= timeWindowEnd9s) {
                        pkEntriesWithin9s.add(pkEntry.id || pkEntry.timestamp?.toString() || Math.random().toString());
                      }
                    });
                  });
                  
                  const pkEntriesWithin9sCount = pkEntriesWithin9s.size;
                  const pkEntriesWithin9sPercentage = total8sAcc > 0 ? (pkEntriesWithin9sCount / total8sAcc) * 100 : 0;
                  
                  // Przygotuj dane dla spidermapy
                  // Normalizujemy wartości do skali 0-100 dla lepszej wizualizacji
                  // Zakładamy maksymalne wartości: xG = 3.0, xG/strzał = 0.30 (2x KPI), wejścia w PK = 20, % = 100
                  const maxXG = 3.0;
                  const maxXGPerShot = 0.30; // 2x KPI (0.15) dla lepszej wizualizacji
                  const maxPKEntries = 20;
                  const maxPercentage = 100;
                  const maxLosesPMAreaCount = 20;
                  
                  const normalizedOpponentXG = Math.min((opponentXG / maxXG) * 100, 100);
                  const normalizedOpponentXGPerShot = Math.min((opponentXGPerShot / maxXGPerShot) * 100, 100);
                  const normalizedTeamXG = Math.min((teamXG / maxXG) * 100, 100);
                  const normalizedTeamXGPerShot = Math.min((teamXGPerShot / maxXGPerShot) * 100, 100);
                  const normalizedOpponentPKEntries = Math.min((opponentPKEntriesCount / maxPKEntries) * 100, 100);
                  const normalizedReaction5sPercentage = Math.min((reaction5sPercentage / maxPercentage) * 100, 100);
                  const normalizedLosesInPMAreaCount = Math.min((losesInPMAreaCount / maxLosesPMAreaCount) * 100, 100);
                  
                  // Normalizacja dla "Udane wejścia" - cel to 25%, więc normalizujemy do skali gdzie 25% = 100%
                  const target8sAcc = 25;
                  const normalized8sAcc = Math.min((shotAndPK8sPercentage / target8sAcc) * 100, 100);
                  
                  /** Skala radaru: „na KPI” = ten poziom (0–100); wspólna dla niebieskiego wielokąta Cel i zielonej realizacji — ten sam promień przy spełnieniu KPI. */
                  const kpiRadarValue = 52;

                  // xG przeciwnika: KPI < 1.0
                  const kpiXG = 1.0;
                  
                  // xG/strzał (NASZ): KPI > 0.15 (więcej = lepiej)
                  const kpiXGPerShot = 0.15;
                  
                  // % strzałów z 1T w strefie 1T: KPI ≥ 85% (więcej = lepiej)
                  const kpi1TPercentage = 85;
                  
                  // PK przeciwnik: KPI < 11
                  const kpiPKEntries = 11;
                  
                  // 5s: KPI > 50%
                  const kpiReaction5s = 50;
                  
                  // Straty PM Area: KPI ≤ 6 szt.
                  const kpiLosesPMAreaCount = 6;
                  
                  // Przechwyty na połowie przeciwnika: KPI ≥ 27
                  const kpiRegainsOpponentHalf = 27;
                  
                  // Przechwyty PP → PK/Shot 8s: KPI ≥ 25%
                  const kpiRegainsPPToPKShot8s = 25;
                  
                  // Oblicz przechwyty na połowie przeciwnika z videoTimestampRaw
                  const regainsOnOpponentHalfWithTimestamp = kpiDerivedRegainActions
                    .filter(action => {
                      const attackZoneRaw = regainAttackZoneRawForMap(action);
                      const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                      if (!attackZoneName) return false;
                      return !isOwnHalf(attackZoneName);
                    })
                    .filter(action => {
                      const timestamp = action.videoTimestampRaw ?? action.videoTimestamp ?? 0;
                      return timestamp > 0;
                    })
                    .map(action => ({
                      action,
                      timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  // Przygotuj PK entries i shots w ataku z timestampami
                  const pkEntriesAttackWithTimestamp = kpiAllPKEntries
                    .filter((entry: any) => {
                      if (!entry) return false;
                      const teamContext = entry.teamContext ?? "attack";
                      return teamContext === "attack" || (entry.teamId && entry.teamId === teamIdInMatch);
                    })
                    .map((entry: any) => ({
                      entry,
                      timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  const shotsAttackWithTimestamp = teamShots
                    .map(shot => ({
                      shot,
                      timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  // Przygotuj loses z timestampami
                  const losesWithTimestamp = kpiDerivedLosesActions
                    .map(lose => ({
                      lose,
                      timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  // Dla każdego przechwytu na połowie przeciwnika sprawdź, czy w ciągu 8s jest PK entry lub shot w ataku, bez loses między nimi
                  let regainsPPWithPKOrShot8s = 0;
                  let regainsPPWithShot8s = 0;
                  let regainsPPWithPK8s = 0;
                  
                  regainsOnOpponentHalfWithTimestamp.forEach(regainItem => {
                    const regainTime = regainItem.timestamp;
                    const timeWindowEnd = regainTime + 8;
                    
                    // Znajdź najbliższe PK entry w ataku w oknie 8s
                    const pkEntryInWindow = pkEntriesAttackWithTimestamp.find(item =>
                      item.timestamp > regainTime &&
                      item.timestamp <= timeWindowEnd &&
                      isPkEntryFromRegainSequence(item.entry)
                    );

                    // Znajdź najbliższy strzał w ataku w oknie 8s — tylko oznaczony jako po przechwycie
                    const shotInWindow = shotsAttackWithTimestamp.find(item =>
                      item.timestamp > regainTime &&
                      item.timestamp <= timeWindowEnd &&
                      isShotFromRegainSequence(item.shot)
                    );
                    
                    let validShot = false;
                    if (shotInWindow) {
                      const hasLoseBeforeShot = losesWithTimestamp.some(loseItem => 
                        loseItem.timestamp > regainTime && loseItem.timestamp < shotInWindow.timestamp
                      );
                      if (!hasLoseBeforeShot) validShot = true;
                    }

                    let validPK = false;
                    if (pkEntryInWindow) {
                      const hasLoseBeforePK = losesWithTimestamp.some(loseItem => 
                        loseItem.timestamp > regainTime && loseItem.timestamp < pkEntryInWindow.timestamp
                      );
                      if (!hasLoseBeforePK) validPK = true;
                    }

                    // Strzał nie dublowany z PK→strzał (PKEntry.isShot + strzał po czasie PK)
                    if (
                      count8sCaShotForBreakdown(
                        validShot,
                        shotInWindow?.timestamp,
                        validPK,
                        pkEntryInWindow?.entry,
                        pkEntryInWindow?.timestamp
                      )
                    ) {
                      regainsPPWithShot8s += 1;
                    }
                    if (validPK) regainsPPWithPK8s += 1;
                    if (validShot || validPK) regainsPPWithPKOrShot8s += 1;
                  });

                  // Oblicz nasze straty na własnej połowie (bez autów) z videoTimestampRaw
                  const losesOnOwnHalfWithTimestamp = kpiDerivedLosesActions
                    .filter(action => {
                      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone || (action as { losesDefenseZone?: string }).losesDefenseZone;
                      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                      if (!losesZoneName) return false;
                      const isOwn = isOwnHalf(losesZoneName);
                      const excludeAsAut = isOwn && (action.isAut === true || (action as any).aut === true);
                      return isOwn && !excludeAsAut;
                    })
                    .filter(action => {
                      const timestamp = action.videoTimestampRaw ?? action.videoTimestamp ?? 0;
                      return timestamp > 0;
                    })
                    .map(action => ({
                      action,
                      timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                    }))
                    .sort((a, b) => a.timestamp - b.timestamp);

                  // Przygotuj PK entries i shots przeciwnika z timestampami
                  const pkEntriesDefenseWithTimestamp = kpiAllPKEntries
                    .filter((entry: any) => {
                      if (!entry) return false;
                      const teamContext = entry.teamContext ?? "attack";
                      return teamContext === "defense" || (entry.teamId && entry.teamId !== teamIdInMatch);
                    })
                    .map((entry: any) => ({
                      entry,
                      timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  const shotsDefenseWithTimestamp = opponentShots
                    .map(shot => ({
                      shot,
                      timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);

                  // Przygotuj regains z timestampami (do sprawdzania czy przeciwnik nie stracił piłki)
                  const regainsWithTimestamp = kpiDerivedRegainActions
                    .map(regain => ({
                      regain,
                      timestamp: regain.videoTimestampRaw ?? regain.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);

                  // Dla każdej naszej straty na własnej połowie sprawdź, czy w ciągu 8s jest PK entry lub shot w obronie, bez naszych regains między nimi
                  let losesOwnHalfWithPKOrShot8s = 0;
                  let losesOwnHalfWithShot8s = 0;
                  let losesOwnHalfWithPK8s = 0;
                  
                  losesOnOwnHalfWithTimestamp.forEach(loseItem => {
                    const loseTime = loseItem.timestamp;
                    const timeWindowEnd = loseTime + 8;
                    
                    // Znajdź najbliższe PK entry w obronie w oknie 8s
                    const pkEntryInWindow = pkEntriesDefenseWithTimestamp.find(item =>
                      item.timestamp > loseTime &&
                      item.timestamp <= timeWindowEnd &&
                      isPkEntryFromRegainSequence(item.entry)
                    );

                    const shotInWindow = shotsDefenseWithTimestamp.find(item =>
                      item.timestamp > loseTime &&
                      item.timestamp <= timeWindowEnd &&
                      isShotFromRegainSequence(item.shot)
                    );
                    
                    let validShot = false;
                    if (shotInWindow) {
                      const hasRegainBeforeShot = regainsWithTimestamp.some(regainItem => 
                        regainItem.timestamp > loseTime && regainItem.timestamp < shotInWindow.timestamp
                      );
                      if (!hasRegainBeforeShot) validShot = true;
                    }

                    let validPK = false;
                    if (pkEntryInWindow) {
                      const hasRegainBeforePK = regainsWithTimestamp.some(regainItem => 
                        regainItem.timestamp > loseTime && regainItem.timestamp < pkEntryInWindow.timestamp
                      );
                      if (!hasRegainBeforePK) validPK = true;
                    }

                    if (
                      count8sCaShotForBreakdown(
                        validShot,
                        shotInWindow?.timestamp,
                        validPK,
                        pkEntryInWindow?.entry,
                        pkEntryInWindow?.timestamp
                      )
                    ) {
                      losesOwnHalfWithShot8s += 1;
                    }
                    if (validPK) losesOwnHalfWithPK8s += 1;
                    if (validShot || validPK) losesOwnHalfWithPKOrShot8s += 1;
                  });

                  const kpiApplySelectedActionFilter = (list: Action[]) =>
                    selectedActionFilter && selectedActionFilter.length > 0
                      ? list.filter((action) => matchesSelectedActionFilter(action))
                      : list;

                  // Dashboard KPI bazuje na wybranym zakresie czasu meczu.
                  const kpiDashboardFilteredRegains = kpiApplySelectedActionFilter(kpiDerivedRegainActions);
                  const kpiRegainsAllPitchForDashboard = kpiDashboardFilteredRegains;

                  const regainsPpActionsForPlayers = kpiDashboardFilteredRegains.filter((action) => {
                    const attackZoneRaw = regainAttackZoneRawForMap(action);
                    const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                    return Boolean(attackZoneName && !isOwnHalf(attackZoneName));
                  });
                  const ppRegainsTotalForShare = regainsPpActionsForPlayers.length;
                  const ppRegainsByPlayer = countActionsByPlayerId(regainsPpActionsForPlayers);
                  const ppRegainsPlayerRows = mapToSortedPlayerShareRows(
                    ppRegainsByPlayer,
                    ppRegainsTotalForShare,
                    (id) => getPlayerLabel(id, playersIndex)
                  );
                  const ppRegainsPlayerSummary = playerStatsSummary(ppRegainsByPlayer, ppRegainsTotalForShare);

                  const regainsPPToPKShot8sPercentage = ppRegainsTotalForShare > 0
                    ? (regainsPPWithPKOrShot8s / ppRegainsTotalForShare) * 100
                    : 0;

                  const kpiDashboardRegainsVisibleOnPitch = kpiDashboardFilteredRegains.filter((action) => {
                    const attackZoneRaw = regainAttackZoneRawForMap(action);
                    return Boolean(attackZoneRaw && convertZoneToName(attackZoneRaw));
                  });
                  const allPitchRegainsTotal = kpiDashboardRegainsVisibleOnPitch.length;
                  const allPitchRegainsByPlayer = countActionsByPlayerId(kpiDashboardRegainsVisibleOnPitch);
                  const allPitchRegainsPlayerRows = mapToSortedPlayerShareRows(
                    allPitchRegainsByPlayer,
                    allPitchRegainsTotal,
                    (id) => getPlayerLabel(id, playersIndex)
                  );
                  const allPitchRegainsPlayerSummary = playerStatsSummary(allPitchRegainsByPlayer, allPitchRegainsTotal);

                  // Dashboard KPI bazuje na wybranym zakresie czasu meczu.
                  const kpiDashboardFilteredLoses = kpiApplySelectedActionFilter(kpiDerivedLosesActions);
                  const kpiLosesAllPitchForDashboard = kpiDashboardFilteredLoses;

                  const kpiDashboardLosesVisibleOnPitch = kpiLosesAllPitchForDashboard.filter((action) => {
                    const raw = action.losesAttackZone || action.oppositeZone;
                    return Boolean(raw && convertZoneToName(raw));
                  });
                  const allPitchLosesTotal = kpiDashboardLosesVisibleOnPitch.length;
                  const allPitchLosesByPlayer = countActionsByPlayerId(kpiDashboardLosesVisibleOnPitch);
                  const allPitchLosesPlayerRows = mapToSortedPlayerShareRows(
                    allPitchLosesByPlayer,
                    allPitchLosesTotal,
                    (id) => getPlayerLabel(id, playersIndex)
                  );
                  const allPitchLosesPlayerSummary = playerStatsSummary(allPitchLosesByPlayer, allPitchLosesTotal);

                  const accumulateRegainXtByPlayerForKpi = (acts: Action[]) => {
                    const byPlayer = new Map<string, { xtAttack: number; xtDefense: number }>();
                    let teamXtTotal = 0;
                    let teamXtAttackOnly = 0;
                    let teamXtDefenseOnly = 0;
                    for (const action of acts) {
                      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                      const attackZoneRaw = regainAttackZoneRawForMap(action);
                      const attackZoneName = attackZoneRaw
                        ? convertZoneToName(attackZoneRaw)
                        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                      const defenseXT = action.regainDefenseXT !== undefined
                        ? action.regainDefenseXT
                        : (action.xTValueEnd ?? action.xTValueStart ?? 0);
                      const attackXT = action.regainAttackXT !== undefined
                        ? action.regainAttackXT
                        : (action.oppositeXT ?? (defenseZoneName && zoneNameToIndex(defenseZoneName) !== null
                          ? getOppositeXTValueForZone(zoneNameToIndex(defenseZoneName)!)
                          : 0));
                      const isAttack = action.isAttack !== undefined ? action.isAttack : defenseXT < 0.02;
                      if (isAttack) {
                        teamXtAttackOnly += attackXT;
                        teamXtTotal += attackXT;
                      } else {
                        teamXtDefenseOnly += defenseXT;
                        teamXtTotal += defenseXT;
                      }
                      const pid = String(action.senderId || action.playerId || "").trim();
                      if (!pid) continue;
                      const cur = byPlayer.get(pid) ?? { xtAttack: 0, xtDefense: 0 };
                      if (isAttack) cur.xtAttack += attackXT;
                      else cur.xtDefense += defenseXT;
                      byPlayer.set(pid, cur);
                    }
                    return { byPlayer, teamXtTotal, teamXtAttackOnly, teamXtDefenseOnly };
                  };

                  const accumulateLoseXtByPlayerForKpi = (acts: Action[]) => {
                    const byPlayer = new Map<string, { xtAttack: number; xtDefense: number }>();
                    let teamXtTotal = 0;
                    let teamXtAttackOnly = 0;
                    let teamXtDefenseOnly = 0;
                    for (const action of acts) {
                      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                      if (!losesZoneName) continue;
                      const zoneXT = action.losesAttackXT !== undefined
                        ? action.losesAttackXT
                        : (() => {
                            const idx = zoneNameToIndex(losesZoneName);
                            return idx !== null ? getXTValueForZone(idx) : (action.xTValueStart ?? action.xTValueEnd ?? 0);
                          })();
                      teamXtTotal += zoneXT;
                      if (isOwnHalf(losesZoneName)) teamXtDefenseOnly += zoneXT;
                      else teamXtAttackOnly += zoneXT;
                      const pid = String(action.senderId || action.playerId || "").trim();
                      if (!pid) continue;
                      const cur = byPlayer.get(pid) ?? { xtAttack: 0, xtDefense: 0 };
                      if (isOwnHalf(losesZoneName)) cur.xtDefense += zoneXT;
                      else cur.xtAttack += zoneXT;
                      byPlayer.set(pid, cur);
                    }
                    return { byPlayer, teamXtTotal, teamXtAttackOnly, teamXtDefenseOnly };
                  };

                  const formatKpiPlayerModalXtCell = (value: number, teamBucketTotal: number): string => {
                    const v = value.toFixed(3);
                    if (teamBucketTotal <= 0) return v;
                    return `${v} (${((value / teamBucketTotal) * 100).toFixed(1)}%)`;
                  };

                  const ppRegainXtAgg = accumulateRegainXtByPlayerForKpi(regainsPpActionsForPlayers);
                  const allPitchRegainXtAgg = accumulateRegainXtByPlayerForKpi(kpiRegainsAllPitchForDashboard);
                  const allPitchLoseXtAgg = accumulateLoseXtByPlayerForKpi(kpiLosesAllPitchForDashboard);

                  const ppRegainsPlayerRowsWithXt = attachXtToPlayerShareRows(
                    ppRegainsPlayerRows,
                    ppRegainXtAgg.byPlayer
                  );
                  const allPitchRegainsPlayerRowsWithXt = attachXtToPlayerShareRows(
                    allPitchRegainsPlayerRows,
                    allPitchRegainXtAgg.byPlayer
                  );
                  const allPitchLosesPlayerRowsWithXt = attachXtToPlayerShareRows(
                    allPitchLosesPlayerRows,
                    allPitchLoseXtAgg.byPlayer
                  );

                  const sortedPpRegainsPlayerRowsWithXt = sortKpiRegainsLosesPlayerRows(
                    ppRegainsPlayerRowsWithXt,
                    kpiRegainsPpPlayersSort
                  );
                  const sortedAllPitchRegainsPlayerRowsWithXt = sortKpiRegainsLosesPlayerRows(
                    allPitchRegainsPlayerRowsWithXt,
                    kpiRegainsAllPitchPlayersSort
                  );
                  const sortedAllPitchLosesPlayerRowsWithXt = sortKpiRegainsLosesPlayerRows(
                    allPitchLosesPlayerRowsWithXt,
                    kpiLosesAllPitchPlayersSort
                  );
                  
                  // Dla spidermapy: wartości "ujemnie rosnące i dodatnio malejące"
                  // Dla metryk gdzie "mniej = lepiej": odwracamy (100 - normalized) - im mniej, tym większa wartość na wykresie
                  // Dla metryk gdzie "więcej = lepiej": używamy normalizowanej wartości - im więcej, tym większa wartość na wykresie
                  const toScoreLowerIsBetter = (normalizedValue: number): number => Math.max(0, Math.min(100, 100 - normalizedValue));
                  const toScoreHigherIsBetter = (normalizedValue: number): number => Math.max(0, Math.min(100, normalizedValue));
                  
                  // Specjalna funkcja dla "Straty PM Area" - zapewnia, że gdy wartość = KPI, to score = kpiRadarValue
                  // Mapowanie: 0 → 100, kpiLosesPMAreaCount → kpiRadarValue, maxLosesPMAreaCount → 0
                  const toScoreLosesPMArea = (actualValue: number): number => {
                    if (actualValue <= 0) return 100;
                    if (actualValue >= maxLosesPMAreaCount) return 0;
                    if (actualValue === kpiLosesPMAreaCount) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < KPI, interpolujemy między 100 a kpiRadarValue
                    // gdy wartość > KPI, interpolujemy między kpiRadarValue a 0
                    if (actualValue < kpiLosesPMAreaCount) {
                      // Interpolacja między (0, 100) a (kpiLosesPMAreaCount, kpiRadarValue)
                      const ratio = actualValue / kpiLosesPMAreaCount;
                      return 100 - (100 - kpiRadarValue) * ratio;
                    } else {
                      // Interpolacja między (kpiLosesPMAreaCount, kpiRadarValue) a (maxLosesPMAreaCount, 0)
                      const ratio = (actualValue - kpiLosesPMAreaCount) / (maxLosesPMAreaCount - kpiLosesPMAreaCount);
                      return kpiRadarValue - kpiRadarValue * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "8s ACC" - zapewnia, że gdy wartość = target8sAcc, to score = kpiRadarValue
                  // Mapowanie: 0% → 0, target8sAcc → kpiRadarValue, 100% → 100
                  const toScore8sAcc = (actualPercentage: number): number => {
                    if (actualPercentage <= 0) return 0;
                    if (actualPercentage >= 100) return 100;
                    if (actualPercentage === target8sAcc) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < target8sAcc, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > target8sAcc, interpolujemy między kpiRadarValue a 100
                    if (actualPercentage < target8sAcc) {
                      // Interpolacja między (0, 0) a (target8sAcc, kpiRadarValue)
                      const ratio = actualPercentage / target8sAcc;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (target8sAcc, kpiRadarValue) a (100, 100)
                      const ratio = (actualPercentage - target8sAcc) / (100 - target8sAcc);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "xG/strzał" - zapewnia, że gdy wartość = kpiXGPerShot, to score = kpiRadarValue
                  // Mapowanie: 0 → 0, kpiXGPerShot → kpiRadarValue, maxXGPerShot → 100
                  const toScoreXGPerShot = (actualValue: number): number => {
                    if (actualValue <= 0) return 0;
                    if (actualValue >= maxXGPerShot) return 100;
                    if (actualValue === kpiXGPerShot) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpiXGPerShot, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > kpiXGPerShot, interpolujemy między kpiRadarValue a 100
                    if (actualValue < kpiXGPerShot) {
                      // Interpolacja między (0, 0) a (kpiXGPerShot, kpiRadarValue)
                      const ratio = actualValue / kpiXGPerShot;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (kpiXGPerShot, kpiRadarValue) a (maxXGPerShot, 100)
                      const ratio = (actualValue - kpiXGPerShot) / (maxXGPerShot - kpiXGPerShot);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "% 1T (strefa 1T)" - zapewnia, że gdy wartość = kpi1TPercentage, to score = kpiRadarValue
                  // Mapowanie: 0% → 0, kpi1TPercentage (85%) → kpiRadarValue, 100% → 100
                  const toScore1TPercentage = (actualPercentage: number): number => {
                    if (actualPercentage <= 0) return 0;
                    if (actualPercentage >= 100) return 100;
                    if (actualPercentage === kpi1TPercentage) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpi1TPercentage, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > kpi1TPercentage, interpolujemy między kpiRadarValue a 100
                    if (actualPercentage < kpi1TPercentage) {
                      // Interpolacja między (0, 0) a (kpi1TPercentage, kpiRadarValue)
                      const ratio = actualPercentage / kpi1TPercentage;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (kpi1TPercentage, kpiRadarValue) a (100, 100)
                      const ratio = (actualPercentage - kpi1TPercentage) / (100 - kpi1TPercentage);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "PK przeciwnik" - zapewnia, że gdy wartość = kpiPKEntries, to score = kpiRadarValue
                  // Mapowanie: 0 → 100, kpiPKEntries (11) → kpiRadarValue, kpiPKEntries + 40 (51) → 0
                  // Punkt 0 na spidermapie = KPI + 40 (51), punkt 100 = 0 (najlepsze)
                  const maxPKOpponentEntries = kpiPKEntries + 40; // 51 = maksimum na spidermapie (punkt 0)
                  const toScorePKOpponent = (actualValue: number): number => {
                    if (actualValue <= 0) return 100;
                    if (actualValue >= maxPKOpponentEntries) return 0;
                    if (actualValue === kpiPKEntries) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpiPKEntries, interpolujemy między 100 a kpiRadarValue
                    // gdy wartość > kpiPKEntries, interpolujemy między kpiRadarValue a 0
                    if (actualValue < kpiPKEntries) {
                      // Interpolacja między (0, 100) a (kpiPKEntries, kpiRadarValue)
                      const ratio = actualValue / kpiPKEntries;
                      return 100 - (100 - kpiRadarValue) * ratio;
                    } else {
                      // Interpolacja między (kpiPKEntries, kpiRadarValue) a (maxPKOpponentEntries, 0)
                      const ratio = (actualValue - kpiPKEntries) / (maxPKOpponentEntries - kpiPKEntries);
                      return kpiRadarValue - kpiRadarValue * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "5s (reakcja)" - zapewnia, że gdy wartość = kpiReaction5s, to score = kpiRadarValue
                  // Mapowanie: 0% → 0, kpiReaction5s (50%) → kpiRadarValue, kpiReaction5s + 40% (90%) → 100
                  // Punkt 0 na spidermapie = KPI (50%), punkt 100 = KPI + 40% (90%)
                  const maxReaction5sPercentage = kpiReaction5s + 40; // 90% = maksimum na spidermapie
                  const toScoreReaction5s = (actualPercentage: number): number => {
                    if (actualPercentage <= 0) return 0;
                    if (actualPercentage >= maxReaction5sPercentage) return 100;
                    if (actualPercentage === kpiReaction5s) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpiReaction5s, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > kpiReaction5s, interpolujemy między kpiRadarValue a 100
                    if (actualPercentage < kpiReaction5s) {
                      // Interpolacja między (0, 0) a (kpiReaction5s, kpiRadarValue)
                      const ratio = actualPercentage / kpiReaction5s;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (kpiReaction5s, kpiRadarValue) a (maxReaction5sPercentage, 100)
                      const ratio = (actualPercentage - kpiReaction5s) / (maxReaction5sPercentage - kpiReaction5s);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "Przechwyty na połowie przeciwnika" - zapewnia, że gdy wartość = kpiRegainsOpponentHalf, to score = kpiRadarValue
                  // Mapowanie: 0 → 0, kpiRegainsOpponentHalf → kpiRadarValue, maxRegainsOpponentHalf → 100
                  const maxRegainsOpponentHalf = 60; // 2x KPI dla lepszej wizualizacji
                  const toScoreRegainsOpponentHalf = (actualValue: number): number => {
                    if (actualValue <= 0) return 0;
                    if (actualValue >= maxRegainsOpponentHalf) return 100;
                    if (actualValue === kpiRegainsOpponentHalf) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpiRegainsOpponentHalf, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > kpiRegainsOpponentHalf, interpolujemy między kpiRadarValue a 100
                    if (actualValue < kpiRegainsOpponentHalf) {
                      // Interpolacja między (0, 0) a (kpiRegainsOpponentHalf, kpiRadarValue)
                      const ratio = actualValue / kpiRegainsOpponentHalf;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (kpiRegainsOpponentHalf, kpiRadarValue) a (maxRegainsOpponentHalf, 100)
                      const ratio = (actualValue - kpiRegainsOpponentHalf) / (maxRegainsOpponentHalf - kpiRegainsOpponentHalf);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };
                  
                  // Specjalna funkcja dla "Przechwyty PP → PK/Shot 8s" - zapewnia, że gdy wartość = kpiRegainsPPToPKShot8s, to score = kpiRadarValue
                  // Mapowanie: 0% → 0, kpiRegainsPPToPKShot8s → kpiRadarValue, 100% → 100
                  const toScoreRegainsPPToPKShot8s = (actualPercentage: number): number => {
                    if (actualPercentage <= 0) return 0;
                    if (actualPercentage >= 100) return 100;
                    if (actualPercentage === kpiRegainsPPToPKShot8s) return kpiRadarValue;
                    
                    // Interpolacja liniowa: gdy wartość < kpiRegainsPPToPKShot8s, interpolujemy między 0 a kpiRadarValue
                    // gdy wartość > kpiRegainsPPToPKShot8s, interpolujemy między kpiRadarValue a 100
                    if (actualPercentage < kpiRegainsPPToPKShot8s) {
                      // Interpolacja między (0, 0) a (kpiRegainsPPToPKShot8s, kpiRadarValue)
                      const ratio = actualPercentage / kpiRegainsPPToPKShot8s;
                      return kpiRadarValue * ratio;
                    } else {
                      // Interpolacja między (kpiRegainsPPToPKShot8s, kpiRadarValue) a (100, 100)
                      const ratio = (actualPercentage - kpiRegainsPPToPKShot8s) / (100 - kpiRegainsPPToPKShot8s);
                      return kpiRadarValue + (100 - kpiRadarValue) * ratio;
                    }
                  };

                  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
                  /**
                   * „Więcej = lepiej”: przy actual === target poziom ≈ obręcz KPI (kpiRadarValue).
                   * Nadmiar ponad KPI może dojechać do 100 (brzeg diagramu).
                   */
                  const scoreHigherIsBetter = (actual: number, target: number) => {
                    if (target <= 0) return 0;
                    return clamp((actual / target) * kpiRadarValue, 0, 100);
                  };
                  const formatDelta = (delta: number, mode: 'higher' | 'lower', precision: number, unit?: string) => {
                    const value = Math.abs(delta).toFixed(precision);
                    const suffix = unit ? ` ${unit}` : '';
                    if (mode === 'higher') {
                      return delta >= 0 ? `zapasu: +${value}${suffix}` : `brakuje: ${value}${suffix}`;
                    }
                    return delta <= 0 ? `zapasu: ${value}${suffix}` : `nadmiar: +${value}${suffix}`;
                  };

                  const xgPerShotDelta = teamXGPerShot - kpiXGPerShot;
                  const oneTDelta = team1TContact1Percentage - kpi1TPercentage;
                  const pkDelta = opponentPKEntriesCount - kpiPKEntries;
                  const reactionDelta = reaction5sPercentage - kpiReaction5s;
                  const losesPmDelta = losesInPMAreaCount - kpiLosesPMAreaCount;
                  const accDelta = shotAndPK8sPercentage - target8sAcc;
                  const regainsOpponentHalfDelta = ppRegainsTotalForShare - kpiRegainsOpponentHalf;
                  const regainsPPToPKShot8sDelta = regainsPPToPKShot8sPercentage - kpiRegainsPPToPKShot8s;

                  const baseRadarData = [
                    { metric: 'xG/strzał', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(teamXGPerShot, kpiXGPerShot), value: scoreHigherIsBetter(teamXGPerShot, kpiXGPerShot), actualValue: teamXGPerShot, actualLabel: `${teamXGPerShot.toFixed(2)} (${teamShotsCount} strzałów)`, kpiLabel: `KPI > ${kpiXGPerShot.toFixed(2)}`, deltaLabel: formatDelta(xgPerShotDelta, 'higher', 2), kpiMet: teamXGPerShot >= kpiXGPerShot },
                    { metric: '1T', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(team1TContact1Percentage, kpi1TPercentage), value: scoreHigherIsBetter(team1TContact1Percentage, kpi1TPercentage), actualValue: team1TContact1Percentage, actualLabel: `${team1TContact1Percentage.toFixed(1)}%`, kpiLabel: `KPI ≥ ${kpi1TPercentage}%`, deltaLabel: formatDelta(oneTDelta, 'higher', 1, 'pp'), kpiMet: team1TContact1Percentage >= kpi1TPercentage },
                    { metric: '5s', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(reaction5sPercentage, kpiReaction5s), value: scoreHigherIsBetter(reaction5sPercentage, kpiReaction5s), actualValue: reaction5sPercentage, actualLabel: `${reaction5sPercentage.toFixed(1)}% (${reaction5sLoses.length}/${losesWith5sFlags.length})`, kpiLabel: `KPI > ${kpiReaction5s}%`, deltaLabel: formatDelta(reactionDelta, 'higher', 1, 'pp'), kpiMet: reaction5sPercentage >= kpiReaction5s },
                    { metric: 'PK przeciwnik', 'KPI': kpiRadarValue, 'Wartość': toScorePKOpponent(opponentPKEntriesCount), value: toScorePKOpponent(opponentPKEntriesCount), actualValue: opponentPKEntriesCount, actualLabel: `${opponentPKEntriesCount}`, kpiLabel: `KPI < ${kpiPKEntries}`, deltaLabel: formatDelta(pkDelta, 'lower', 0), kpiMet: opponentPKEntriesCount <= kpiPKEntries },
                    { metric: 'PM Area straty', 'KPI': kpiRadarValue, 'Wartość': toScoreLosesPMArea(losesInPMAreaCount), value: toScoreLosesPMArea(losesInPMAreaCount), actualValue: losesInPMAreaCount, actualLabel: `${losesInPMAreaCount} (${losesInPMAreaPercentage.toFixed(1)}% z ${allLoses.length})`, kpiLabel: `KPI ≤ ${kpiLosesPMAreaCount}`, deltaLabel: formatDelta(losesPmDelta, 'lower', 0), kpiMet: losesInPMAreaCount <= kpiLosesPMAreaCount },
                    { metric: 'Przechwyty PP', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(ppRegainsTotalForShare, kpiRegainsOpponentHalf), value: scoreHigherIsBetter(ppRegainsTotalForShare, kpiRegainsOpponentHalf), actualValue: ppRegainsTotalForShare, actualLabel: `${ppRegainsTotalForShare}`, kpiLabel: `KPI ≥ ${kpiRegainsOpponentHalf}`, deltaLabel: formatDelta(regainsOpponentHalfDelta, 'higher', 0), kpiMet: ppRegainsTotalForShare >= kpiRegainsOpponentHalf },
                    { metric: '8s CA', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(regainsPPToPKShot8sPercentage, kpiRegainsPPToPKShot8s), value: scoreHigherIsBetter(regainsPPToPKShot8sPercentage, kpiRegainsPPToPKShot8s), actualValue: regainsPPToPKShot8sPercentage, actualLabel: `${regainsPPToPKShot8sPercentage.toFixed(1)}% (${regainsPPWithPKOrShot8s}/${ppRegainsTotalForShare})`, kpiLabel: `KPI ≥ ${kpiRegainsPPToPKShot8s}%`, deltaLabel: formatDelta(regainsPPToPKShot8sDelta, 'higher', 1, 'pp'), kpiMet: regainsPPToPKShot8sPercentage >= kpiRegainsPPToPKShot8s },
                    { metric: '8s ACC', 'KPI': kpiRadarValue, 'Wartość': scoreHigherIsBetter(shotAndPK8sPercentage, target8sAcc), value: scoreHigherIsBetter(shotAndPK8sPercentage, target8sAcc), actualValue: shotAndPK8sPercentage, actualLabel: `${shotAndPK8sPercentage.toFixed(1)}% (${shotAndPK8sCount}/${total8sAcc})`, kpiLabel: `KPI ≥ ${target8sAcc}%`, deltaLabel: formatDelta(accDelta, 'higher', 1, 'pp'), kpiMet: shotAndPK8sPercentage >= target8sAcc },
                  ];

                  const radarData = baseRadarData.map((item, idx) => ({
                    ...item,
                    displayMetric: isPresentationMode ? `KPI ${idx + 1}` : item.metric,
                  }));

          const selectedTeamData = availableTeams.find((team) => team.id === selectedTeam);
          const opponentTeamData = availableTeams.find((team) => team.id === opponentIdInMatch);
          const isMultiMatchSelection = selectedMatches.length > 1;
          const rawSelectedTeamName = selectedTeamData?.name || "Nasz zespół";
          const rawOpponentName = isMultiMatchSelection
            ? "Przeciwnicy"
            : (opponentTeamData?.name || selectedMatchInfo.opponent || "Przeciwnik");

          const selectedTeamName = isPresentationMode ? "Zespół A" : rawSelectedTeamName;
          const opponentName = isPresentationMode ? "Zespół B" : rawOpponentName;
                  const selectedTeamLogo = (selectedTeamData as any)?.logo || null;
                  const opponentLogo = isMultiMatchSelection
                    ? null
                    : ((opponentTeamData as any)?.logo || selectedMatchInfo.opponentLogo || null);
                  const scoreModeLabel = "xG";
                  const possessionData = selectedMatchInfo.matchData?.possession;
                  const teamPossessionFirstHalf = possessionData?.teamFirstHalf || 0;
                  const teamPossessionSecondHalf = possessionData?.teamSecondHalf || 0;
                  const opponentPossessionFirstHalf = possessionData?.opponentFirstHalf || 0;
                  const opponentPossessionSecondHalf = possessionData?.opponentSecondHalf || 0;
                  const teamPossessionMinutes = kpiMatchPeriod === 'firstHalf'
                    ? teamPossessionFirstHalf
                    : kpiMatchPeriod === 'secondHalf'
                      ? teamPossessionSecondHalf
                      : teamPossessionFirstHalf + teamPossessionSecondHalf;
                  const opponentPossessionMinutes = kpiMatchPeriod === 'firstHalf'
                    ? opponentPossessionFirstHalf
                    : kpiMatchPeriod === 'secondHalf'
                      ? opponentPossessionSecondHalf
                      : opponentPossessionFirstHalf + opponentPossessionSecondHalf;
                  const liveMinutes = teamPossessionMinutes + opponentPossessionMinutes;
                  const explicitDeadMinutes = kpiMatchPeriod === 'firstHalf'
                    ? (possessionData?.deadFirstHalf || 0)
                    : kpiMatchPeriod === 'secondHalf'
                      ? (possessionData?.deadSecondHalf || 0)
                      : (possessionData?.deadFirstHalf || 0) + (possessionData?.deadSecondHalf || 0);
                  const inferredDeadMinutes = kpiMatchPeriod === 'firstHalf'
                    ? Math.max(0, 45 - (teamPossessionFirstHalf + opponentPossessionFirstHalf))
                    : kpiMatchPeriod === 'secondHalf'
                      ? Math.max(0, 45 - (teamPossessionSecondHalf + opponentPossessionSecondHalf))
                      : Math.max(0, 45 - (teamPossessionFirstHalf + opponentPossessionFirstHalf))
                        + Math.max(0, 45 - (teamPossessionSecondHalf + opponentPossessionSecondHalf));
                  const deadMinutes = explicitDeadMinutes > 0 ? explicitDeadMinutes : inferredDeadMinutes;
                  const totalTrackedMinutes = liveMinutes + deadMinutes;
                  const teamPossessionPercent = liveMinutes > 0 ? (teamPossessionMinutes / liveMinutes) * 100 : 0;
                  const opponentPossessionPercent = liveMinutes > 0 ? (opponentPossessionMinutes / liveMinutes) * 100 : 0;
                  const deadPercent = totalTrackedMinutes > 0 ? (deadMinutes / totalTrackedMinutes) * 100 : 0;
                  const formatMinutesToMMSS = (minutes: number): string => {
                    if (!Number.isFinite(minutes) || minutes <= 0) return "0:00";
                    const totalSeconds = Math.round(minutes * 60);
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  };
                  const formatSignedStat = (value: number, digits = 2): string =>
                    `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
                  const formatOutcomeProbability = (value: number): string =>
                    `${Math.round(value * 100)}%`;
                  const matchDateLabel = isPresentationMode
                    ? ""
                    : typeof selectedMatchInfo.date === "string" && selectedMatchInfo.date
                      ? (() => {
                          const rawDate = selectedMatchInfo.date.includes("T")
                            ? selectedMatchInfo.date.slice(0, 10)
                            : selectedMatchInfo.date;
                          const parsedDate = new Date(rawDate);
                          return Number.isNaN(parsedDate.getTime())
                            ? rawDate
                            : parsedDate.toLocaleDateString("pl-PL");
                        })()
                      : "";
                  const teamXgMinusGoals = teamXG - teamGoals;
                  const opponentXgMinusGoals = opponentXG - opponentGoals;
                  const xgAdvantage = teamXG - opponentXG;
                  const pkAdvantage = teamPKEntriesCount - opponentPKEntriesCount;
                  const pxtPerPossessionMinute = teamPossessionMinutes > 0 ? totalPxtAll / teamPossessionMinutes : 0;
                  const formatPctShare = (value: number, total: number): string =>
                    `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`;
                  const findGpsTotalKey = (entry: Record<string, any>, keys: string[]) =>
                    keys.find((key) => Object.prototype.hasOwnProperty.call(entry, key));
                  const totalDistanceM = gpsMatchDayData.reduce((sum, entry) => {
                    const key = findGpsTotalKey(entry.total ?? {}, ['Total Distance', 'Total distance', 'Distance']);
                    const value = key != null && entry.total?.[key] != null ? Number(entry.total[key]) : NaN;
                    return sum + (Number.isFinite(value) ? value : 0);
                  }, 0);
                  const totalDistanceLabel = totalDistanceM > 0
                    ? `${(totalDistanceM / 1000).toFixed(1)} km`
                    : 'Brak danych';

                  const radarSliceTooltip = ({ index }: { index: string | number; data: readonly { id: string; value: number; formattedValue: string; color: string }[] }) => {
                    const d = typeof index === 'string'
                      ? radarData.find((r) => r.displayMetric === index)
                      : radarData[index];
                    if (!d) return null;
                    const actualVal = d.actualValue;
                    const isPercentage = d.metric === '1T' || d.metric === '5s' || d.metric === '8s ACC' || d.metric === '8s CA';
                    const valueFormatted = isPercentage
                      ? `${parseFloat(actualVal.toFixed(1))}%`
                      : (typeof actualVal === 'number' && actualVal % 1 !== 0 ? actualVal.toFixed(2) : String(actualVal));
                    const pctWykonania = Math.round(d.value);
                    const achieved = Boolean((d as { kpiMet?: boolean }).kpiMet);
                    const statusColor = achieved ? TEAM_STATS_GREEN : TEAM_STATS_RED;
                    const statusLabel = achieved ? 'KPI osiągnięte' : 'KPI nieosiągnięte';
                    return (
                      <div style={{
                        backgroundColor: '#1e293b',
                        border: `2px solid ${statusColor}`,
                        borderRadius: '12px',
                        padding: '16px 20px',
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.2)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
                        minWidth: '200px'
                      }}>
                        <p style={{ margin: 0, marginBottom: '8px', fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>{valueFormatted}</p>
                        <p style={{ margin: 0, marginBottom: '8px', fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>{d.kpiLabel}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} aria-hidden />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: statusColor }}>{pctWykonania}% — {statusLabel}</span>
                        </div>
                      </div>
                    );
                  };
                  
                  return (
                    <div className={`${styles.chartContainerInPanel} ${styles.kpiDashboardPanel}`}>
                      <div className={styles.kpiTopRow}>
                        <div className={styles.kpiMatchHeader}>
                          <div className={styles.kpiRadarColumn}>
                            <div className={styles.kpiAnalysisPanel}>
                              <div className={styles.kpiAnalysisHeader}>
                                <h4 className={styles.kpiAnalysisTitle}>Ocena modelu gry</h4>
                                <div
                                  className={`${styles.kpiPeriodSelector} ${styles.kpiPeriodSelectorInline}`}
                                  role="group"
                                  aria-label={`Zakres czasu KPI: ${kpiPeriodLabel}`}
                                >
                                  {[
                                    { value: 'total', label: 'Cały mecz' },
                                    { value: 'firstHalf', label: '1. połowa' },
                                    { value: 'secondHalf', label: '2. połowa' },
                                  ].map((period) => (
                                    <button
                                      key={period.value}
                                      type="button"
                                      className={`${styles.kpiPeriodButton} ${kpiMatchPeriod === period.value ? styles.active : ''}`}
                                      onClick={() => setKpiMatchPeriod(period.value as KpiMatchPeriod)}
                                      aria-pressed={kpiMatchPeriod === period.value}
                                    >
                                      {period.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className={styles.kpiRadarWrapper}>
                                <ResponsiveRadar
                                  data={radarData}
                                  keys={['KPI', 'Wartość']}
                                  indexBy="displayMetric"
                                  maxValue={100}
                                  margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                                  curve="linearClosed"
                                  borderWidth={2}
                                  borderColor={{ from: 'color' }}
                                  gridLevels={6}
                                  gridShape="circular"
                                  gridLabelOffset={12}
                                  enableDots={true}
                                  dotSize={6}
                                  dotBorderWidth={2}
                                  dotColor={(dot) => {
                                    if (dot.key === 'KPI') return TEAM_STATS_RADAR_REFERENCE;
                                    const row = radarData.find((r) => r.displayMetric === dot.index);
                                    const met = row != null && Boolean((row as { kpiMet?: boolean }).kpiMet);
                                    return met ? TEAM_STATS_GREEN : TEAM_STATS_RED;
                                  }}
                                  dotBorderColor={(dot) => {
                                    if (dot.key === 'KPI') return TEAM_STATS_RADAR_REFERENCE;
                                    const row = radarData.find((r) => r.displayMetric === dot.index);
                                    const met = row != null && Boolean((row as { kpiMet?: boolean }).kpiMet);
                                    return met ? TEAM_STATS_GREEN : TEAM_STATS_RED;
                                  }}
                                  colors={[TEAM_STATS_RADAR_REFERENCE, TEAM_STATS_RADAR_VALUE_LINE]}
                                  fillOpacity={0.15}
                                  blendMode="multiply"
                                  motionConfig="wobbly"
                                  sliceTooltip={radarSliceTooltip}
                                  legends={[
                                    {
                                      anchor: 'top-left',
                                      direction: 'column',
                                      translateX: -30,
                                      translateY: -10,
                                      itemWidth: 80,
                                      itemHeight: 16,
                                      itemTextColor: 'rgba(0, 0, 0, 0.65)',
                                      symbolSize: 10,
                                      symbolShape: 'circle',
                                    },
                                  ]}
                                  theme={{
                                    grid: { line: { stroke: 'rgba(0, 0, 0, 0.08)', strokeWidth: 1 } },
                                    dots: { text: { fontSize: 11 } },
                                    axis: {
                                      ticks: {
                                        text: {
                                          fontSize: 12,
                                          fill: 'rgba(0, 0, 0, 0.65)',
                                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
                                          fontWeight: 500,
                                        },
                                      },
                                    },
                                  }}
                                />
                              </div>
                              <div
                                className={styles.kpiOutcomeProjection}
                                aria-label={`Prognoza xG: zwycięstwo ${formatOutcomeProbability(xgOutcomeProjection.winProbability)}, remis ${formatOutcomeProbability(xgOutcomeProjection.drawProbability)}, porażka ${formatOutcomeProbability(xgOutcomeProjection.lossProbability)}, oczekiwane punkty ${xgOutcomeProjection.expectedPoints.toFixed(2)}`}
                              >
                                <div className={styles.kpiOutcomeProjectionHeader}>
                                  <span className={styles.kpiOutcomeProjectionTitle}>Prognoza xG</span>
                                  <span className={styles.kpiOutcomeProjectionPoints}>
                                    xPts <strong>{xgOutcomeProjection.expectedPoints.toFixed(2)}</strong>
                                  </span>
                                </div>
                                <div className={styles.kpiOutcomeProjectionBar} aria-hidden>
                                  <span
                                    className={`${styles.kpiOutcomeProjectionBarSegment} ${styles.kpiOutcomeProjectionBarWin}`}
                                    style={{ width: `${xgOutcomeProjection.winProbability * 100}%` }}
                                  />
                                  <span
                                    className={`${styles.kpiOutcomeProjectionBarSegment} ${styles.kpiOutcomeProjectionBarDraw}`}
                                    style={{ width: `${xgOutcomeProjection.drawProbability * 100}%` }}
                                  />
                                  <span
                                    className={`${styles.kpiOutcomeProjectionBarSegment} ${styles.kpiOutcomeProjectionBarLoss}`}
                                    style={{ width: `${xgOutcomeProjection.lossProbability * 100}%` }}
                                  />
                                </div>
                                <div className={styles.kpiOutcomeProjectionLegend}>
                                  <span className={styles.kpiOutcomeProjectionLegendItem}>
                                    <span className={`${styles.kpiOutcomeProjectionDot} ${styles.kpiOutcomeProjectionDotWin}`} aria-hidden />
                                    <strong>{formatOutcomeProbability(xgOutcomeProjection.winProbability)}</strong>
                                    <span>Wygrana</span>
                                  </span>
                                  <span className={styles.kpiOutcomeProjectionLegendItem}>
                                    <span className={`${styles.kpiOutcomeProjectionDot} ${styles.kpiOutcomeProjectionDotDraw}`} aria-hidden />
                                    <strong>{formatOutcomeProbability(xgOutcomeProjection.drawProbability)}</strong>
                                    <span>Remis</span>
                                  </span>
                                  <span className={styles.kpiOutcomeProjectionLegendItem}>
                                    <span className={`${styles.kpiOutcomeProjectionDot} ${styles.kpiOutcomeProjectionDotLoss}`} aria-hidden />
                                    <strong>{formatOutcomeProbability(xgOutcomeProjection.lossProbability)}</strong>
                                    <span>Porażka</span>
                                  </span>
                                </div>
                              </div>
                              {(() => {
                                const kpiCount = 8;
                                let realizedKpiCount = 0;
                                if (shotAndPK8sPercentage >= target8sAcc) realizedKpiCount++;
                                if (teamXGPerShot >= kpiXGPerShot) realizedKpiCount++;
                                if (team1TContact1Percentage >= kpi1TPercentage) realizedKpiCount++;
                                if (opponentPKEntriesCount <= kpiPKEntries) realizedKpiCount++;
                                if (reaction5sPercentage >= kpiReaction5s) realizedKpiCount++;
                                if (losesInPMAreaCount <= kpiLosesPMAreaCount) realizedKpiCount++;
                                if (ppRegainsTotalForShare >= kpiRegainsOpponentHalf) realizedKpiCount++;
                                if (regainsPPToPKShot8sPercentage >= kpiRegainsPPToPKShot8s) realizedKpiCount++;
                                const kpiPercentage = (realizedKpiCount / kpiCount) * 100;
                                const avgWykonanie = radarData.length > 0
                                  ? radarData.reduce((sum, r) => sum + r.value, 0) / radarData.length
                                  : 0;
                                const isKpiGood = kpiPercentage >= 50;
                                return (
                                  <div
                                    className={`${styles.kpiScoreRowCombined} ${isKpiGood ? styles.kpiScoreRowKpiGood : styles.kpiScoreRowKpiBad}`}
                                    aria-label="KPI zrealizowane"
                                  >
                                    <div className={styles.kpiScoreRowCombinedMain}>
                                      <div className={styles.kpiScoreRowCombinedBlock}>
                                        <span className={styles.kpiScoreRowLabel}>KPI zrealizowane</span>
                                        <span className={styles.kpiScoreRowValues}>
                                          <span
                                            className={`${styles.kpiScoreRowKpiValue} ${
                                              isKpiGood
                                                ? styles.kpiScoreRowKpiValueGood
                                                : styles.kpiScoreRowKpiValueBad
                                            }`}
                                          >
                                            {kpiPercentage.toFixed(1)}%
                                          </span>{' '}
                                          <span className={styles.kpiScoreRowValuesPossessionTime}>
                                            ({realizedKpiCount} / {kpiCount} KPI)
                                          </span>
                                          {' · '}
                                          <span className={styles.kpiScoreRowValuesPossessionTime}>
                                            śr. wykonanie: {avgWykonanie.toFixed(0)}%
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                          <div className={styles.kpiScoreSection}>
                            <div className={styles.kpiScoreMetaRow}>
                              {isMultiMatchSelection && (
                                <span className={styles.kpiScoreMetaBadge}>
                                  {isPresentationMode ? "Wiele meczów" : `${selectedMatches.length} mecze`}
                                </span>
                              )}
                            </div>
                            <div className={styles.kpiScoreHero}>
                              {!isPresentationMode && (
                                <span className={styles.kpiScoreHeroVenue} aria-hidden>{selectedMatchInfo.isHome ? 'Dom' : 'Wyjazd'}</span>
                              )}
                              {!isPresentationMode && matchDateLabel && (
                                <span className={styles.kpiScoreHeroDate} aria-hidden>{matchDateLabel}</span>
                              )}
                              <div className={styles.kpiScoreHeroMain}>
                                <span className={styles.kpiScoreSectionLogoWrap}>
                                  {selectedTeamLogo && !isPresentationMode ? (
                                    <img src={selectedTeamLogo} alt={`Logo ${selectedTeamName}`} className={styles.kpiScoreSectionLogo} />
                                  ) : (
                                    <span className={styles.kpiScoreSectionLogoPlaceholder}>{selectedTeamName.slice(0, 2)}</span>
                                  )}
                                  <span className={styles.kpiScoreSectionTeamName}>{selectedTeamName}</span>
                                </span>
                                <div className={styles.kpiScoreHeroCenter}>
                                  <span className={styles.kpiScoreHeroEyebrow}>Wynik</span>
                                  <span className={styles.kpiScoreHeroScore}>{teamGoals} : {opponentGoals}</span>
                                  <div
                                    className={styles.kpiScoreHeroXgStack}
                                    aria-label={`Pełny xG ${teamXG.toFixed(2)}:${opponentXG.toFixed(2)}, NPxG ${teamNPxG.toFixed(2)}:${opponentNPxG.toFixed(2)}`}
                                  >
                                    <span
                                      className={styles.kpiScoreHeroXgPrimary}
                                      title="xG — oczekiwane bramki (wszystkie strzały)"
                                    >
                                      xG {teamXG.toFixed(2)} : {opponentXG.toFixed(2)}
                                    </span>
                                    <span
                                      className={styles.kpiScoreHeroXgSecondary}
                                      title="NPxG (non-penalty xG) — bez rzutów karnych"
                                    >
                                      NPxG {teamNPxG.toFixed(2)} : {opponentNPxG.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreHeroDeltaRow} aria-label="Różnica xG i gole (my : rywal)">
                                    <span className={teamXgMinusGoals >= 0 ? styles.kpiXGDeltaNegative : styles.kpiXGDeltaPositive}>{formatSignedStat(teamXgMinusGoals)}</span>
                                    <span className={styles.kpiScoreHeroDeltaSep}>:</span>
                                    <span className={opponentXgMinusGoals >= 0 ? styles.kpiXGDeltaNegative : styles.kpiXGDeltaPositive}>{formatSignedStat(opponentXgMinusGoals)}</span>
                                  </div>
                                </div>
                                <span className={styles.kpiScoreSectionLogoWrap}>
                                  {opponentLogo && !isPresentationMode ? (
                                    <img src={opponentLogo} alt={`Logo ${opponentName}`} className={styles.kpiScoreSectionLogo} />
                                  ) : (
                                    <span className={styles.kpiScoreSectionLogoPlaceholder}>{(opponentName || '').slice(0, 2)}</span>
                                  )}
                                  <span className={styles.kpiScoreSectionTeamName}>{opponentName}</span>
                                </span>
                              </div>
                            </div>
                            <div className={styles.kpiScoreMetrics}>
                            <div
                              role="button"
                              tabIndex={0}
                              className={`${styles.kpiScoreRowClickable} ${kpiXgRowExpanded ? styles.kpiScoreRowClickableExpanded : ''}`}
                              onClick={() => setKpiXgRowExpanded(!kpiXgRowExpanded)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgRowExpanded(!kpiXgRowExpanded); } }}
                              title={
                                kpiXgRowExpanded
                                  ? 'Kliknij, aby zwinąć'
                                  : 'Kliknij, aby rozwinąć szczegóły xG'
                              }
                              aria-label={
                                kpiXgRowExpanded
                                  ? 'Zwiń szczegóły xG'
                                  : 'Rozwiń szczegóły xG'
                              }
                              aria-expanded={kpiXgRowExpanded}
                            >
                              <span className={styles.kpiScoreRowCenterBlock}>
                                <span className={styles.kpiScoreRowLabel}>xG</span>
                                <span className={styles.kpiScoreRowCenterIcons}>
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setXgMapModalOpen(true); }}
                                      title="Otwórz mapę xG"
                                      aria-label="Otwórz mapę xG"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                        <line x1="8" y1="2" x2="8" y2="18" />
                                        <line x1="16" y1="6" x2="16" y2="22" />
                                      </svg>
                                    </button>
                                  )}
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setKpiXgPlayersModalOpen(true); }}
                                      title="Pokaż wkład xG zawodników"
                                      aria-label="Pokaż wkład xG zawodników"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  )}
                                </span>
                              </span>
                              <div className={styles.kpiScoreRowValuesWrap}>
                                <span className={styles.kpiScoreRowLeft}>
                                  {(() => {
                                    const diff = teamXG - opponentXG;
                                    return (
                                      <span 
                                        className={styles.kpiScoreRowValuesPossessionTime} 
                                        style={{ 
                                          marginRight: '6px',
                                          color: diff > 0 ? TEAM_STATS_GREEN : diff < 0 ? TEAM_STATS_RED : 'inherit',
                                          fontWeight: 500
                                        }}
                                      >
                                        ({diff > 0 ? '+' : ''}{diff.toFixed(2)})
                                      </span>
                                    );
                                  })()}
                                  <span className={styles.kpiScoreRowValues}>{teamXG.toFixed(2)}</span>
                                </span>
                                <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                <span className={styles.kpiScoreRowRight}>{opponentXG.toFixed(2)}</span>
                              </div>
                              <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                {kpiXgRowExpanded ? (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                ) : (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                )}
                              </span>
                            </div>
                            {kpiXgRowExpanded && (
                              <div className={styles.kpiScoreRowExpandedContent}>
                                <div className={`${styles.kpiScoreGoalsDetails} ${styles.kpiScoreGoalsDetailsXg}`}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Otwarta gra</span>
                                    <span className={styles.kpiScoreRowGoals}>
                                      <span style={{ color: TEAM_STATS_GREEN }}>{teamGoalsOpenPlay}</span>
                                      <span style={{ margin: '0 2px', color: '#64748b' }}>:</span>
                                      <span style={{ color: TEAM_STATS_RED }}>{opponentGoalsOpenPlay}</span>
                                    </span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamXGOpenPlay.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamXG > 0 ? Math.round(teamXGOpenPlay / teamXG * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentXGOpenPlay.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentXG > 0 ? Math.round(opponentXGOpenPlay / opponentXG * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>SFG</span>
                                    <span className={styles.kpiScoreRowGoals}>
                                      <span style={{ color: TEAM_STATS_GREEN }}>{teamGoalsSFG}</span>
                                      <span style={{ margin: '0 2px', color: '#64748b' }}>:</span>
                                      <span style={{ color: TEAM_STATS_RED }}>{opponentGoalsSFG}</span>
                                    </span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamXGSFG.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamXG > 0 ? Math.round(teamXGSFG / teamXG * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentXGSFG.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentXG > 0 ? Math.round(opponentXGSFG / opponentXG * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Regain</span>
                                    <span className={styles.kpiScoreRowGoals}>
                                      <span style={{ color: TEAM_STATS_GREEN }}>{teamGoalsRegain}</span>
                                      <span style={{ margin: '0 2px', color: '#64748b' }}>:</span>
                                      <span style={{ color: TEAM_STATS_RED }}>{opponentGoalsRegain}</span>
                                    </span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamXGRegain.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamXG > 0 ? Math.round(teamXGRegain / teamXG * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentXGRegain.toFixed(2)}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentXG > 0 ? Math.round(opponentXGRegain / opponentXG * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiXgPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiXgPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-xg-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-xg-modal-title">xG</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiXgPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiXgTableWithGoals}`}>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' })); } }}
                                        >
                                          Zawodnik{kpiXgSort.column === 'playerName' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xgSharePct', dir: prev.column === 'xgSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xgSharePct', dir: prev.column === 'xgSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Udział xG{kpiXgSort.column === 'xgSharePct' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xg', dir: prev.column === 'xg' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xg', dir: prev.column === 'xg' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          xG{kpiXgSort.column === 'xg' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xgMinusGoals', dir: prev.column === 'xgMinusGoals' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xgMinusGoals', dir: prev.column === 'xgMinusGoals' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          xG − g{kpiXgSort.column === 'xgMinusGoals' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xgPerShot', dir: prev.column === 'xgPerShot' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xgPerShot', dir: prev.column === 'xgPerShot' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          xG/strzał{kpiXgSort.column === 'xgPerShot' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xgRegain', dir: prev.column === 'xgRegain' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xgRegain', dir: prev.column === 'xgRegain' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          xG po Regain{kpiXgSort.column === 'xgRegain' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiXgSort(prev => ({ column: 'xgSfg', dir: prev.column === 'xgSfg' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiXgSort(prev => ({ column: 'xgSfg', dir: prev.column === 'xgSfg' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          xG po SFG{kpiXgSort.column === 'xgSfg' ? (kpiXgSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                      </div>
                                      {sortedXgPlayersList.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedXgPlayersList.map((playerStats) => {
                                            const xgMinusGoals = playerStats.xg - (playerStats.goals ?? 0);
                                            const xgToGoalsStr = xgMinusGoals >= 0 ? `+${xgMinusGoals.toFixed(2)}` : xgMinusGoals.toFixed(2);
                                            const xgToGoalsClass = xgMinusGoals >= 0 ? styles.kpiXGDeltaNegative : styles.kpiXGDeltaPositive;
                                            return (
                                            <div key={playerStats.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{playerStats.playerName}</span>
                                              <span>{Math.round(playerStats.xgSharePct)}%</span>
                                              <span>{playerStats.xg.toFixed(2)} ({playerStats.shots})</span>
                                              <span className={xgToGoalsClass}>{xgToGoalsStr}</span>
                                              <span className={playerStats.xgPerShot >= 0.15 ? styles.kpiXGDeltaPositive : styles.kpiXGDeltaNegative}>{playerStats.xgPerShot.toFixed(2)}</span>
                                              <span>{playerStats.xgRegain.toFixed(2)}</span>
                                              <span>{playerStats.xgSfg.toFixed(2)}</span>
                                            </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak strzałów z xG dla wybranej drużyny.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiShotsPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiShotsPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-shots-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-shots-modal-title">Strzały</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiShotsPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiXgPlayersDetailsShots}`}>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' })); } }}
                                        >
                                          Zawodnik{kpiShotsSort.column === 'playerName' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'shotsSharePct', dir: prev.column === 'shotsSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'shotsSharePct', dir: prev.column === 'shotsSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Udział strzałów{kpiShotsSort.column === 'shotsSharePct' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'shots', dir: prev.column === 'shots' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'shots', dir: prev.column === 'shots' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Strzały{kpiShotsSort.column === 'shots' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'shotsMinusGoals', dir: prev.column === 'shotsMinusGoals' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'shotsMinusGoals', dir: prev.column === 'shotsMinusGoals' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Strzały − gole{kpiShotsSort.column === 'shotsMinusGoals' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'onTargetPct', dir: prev.column === 'onTargetPct' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'onTargetPct', dir: prev.column === 'onTargetPct' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          % celnych{kpiShotsSort.column === 'onTargetPct' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'onTarget', dir: prev.column === 'onTarget' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'onTarget', dir: prev.column === 'onTarget' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Celne{kpiShotsSort.column === 'onTarget' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'goals', dir: prev.column === 'goals' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'goals', dir: prev.column === 'goals' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Gole{kpiShotsSort.column === 'goals' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiShotsSort(prev => ({ column: 'blocked', dir: prev.column === 'blocked' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsSort(prev => ({ column: 'blocked', dir: prev.column === 'blocked' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Zablokowane{kpiShotsSort.column === 'blocked' ? (kpiShotsSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                      </div>
                                      {sortedShotsPlayersList.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedShotsPlayersList.map((playerStats) => (
                                            <div key={playerStats.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{playerStats.playerName}</span>
                                              <span>{Math.round(playerStats.shotsSharePct)}%</span>
                                              <span>{playerStats.shots}</span>
                                              <span>{playerStats.shotsMinusGoals}</span>
                                              <span>{Math.round(playerStats.onTargetPct)}%</span>
                                              <span>{playerStats.onTarget}</span>
                                              <span>{playerStats.goals}</span>
                                              <span>{playerStats.blocked}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak strzałów dla wybranej drużyny.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiPkPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiPkPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-pk-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-pk-modal-title">Wejścia PK</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiPkPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={styles.kpiXgPlayersDetails}>
                                      <div className={styles.metricSelector}>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPkPlayersRoles.sender ? styles.active : ''}`}
                                          onClick={() => setKpiPkPlayersRoles(prev => ({ ...prev, sender: !prev.sender }))}
                                          aria-pressed={kpiPkPlayersRoles.sender}
                                        >
                                          Nadawca podania
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPkPlayersRoles.receiver ? styles.active : ''}`}
                                          onClick={() => setKpiPkPlayersRoles(prev => ({ ...prev, receiver: !prev.receiver }))}
                                          aria-pressed={kpiPkPlayersRoles.receiver}
                                        >
                                          Adresat podania
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPkPlayersRoles.dribbler ? styles.active : ''}`}
                                          onClick={() => setKpiPkPlayersRoles(prev => ({ ...prev, dribbler: !prev.dribbler }))}
                                          aria-pressed={kpiPkPlayersRoles.dribbler}
                                        >
                                          Dryblingiem
                                        </button>
                                      </div>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' })); } }}
                                        >
                                          Zawodnik{kpiPkSort.column === 'playerName' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'entriesSharePct', dir: prev.column === 'entriesSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'entriesSharePct', dir: prev.column === 'entriesSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Udział wejść{kpiPkSort.column === 'entriesSharePct' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'entries', dir: prev.column === 'entries' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'entries', dir: prev.column === 'entries' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Wejścia PK{kpiPkSort.column === 'entries' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'entriesRegain', dir: prev.column === 'entriesRegain' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'entriesRegain', dir: prev.column === 'entriesRegain' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Po Regain{kpiPkSort.column === 'entriesRegain' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'entriesSfg', dir: prev.column === 'entriesSfg' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'entriesSfg', dir: prev.column === 'entriesSfg' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Po SFG{kpiPkSort.column === 'entriesSfg' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPkSort(prev => ({ column: 'entriesShot', dir: prev.column === 'entriesShot' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkSort(prev => ({ column: 'entriesShot', dir: prev.column === 'entriesShot' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Zakończone strzałem{kpiPkSort.column === 'entriesShot' ? (kpiPkSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                      </div>
                                      {sortedPkPlayersList.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedPkPlayersList.map((playerStats) => (
                                            <div key={playerStats.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{playerStats.playerName}</span>
                                              <span>{Math.round(playerStats.entriesSharePct)}%</span>
                                              <span>{playerStats.entries}</span>
                                              <span>{playerStats.entriesRegain}</span>
                                              <span>{playerStats.entriesSfg}</span>
                                              <span>{playerStats.entriesShot}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak wejść w PK dla wybranej drużyny.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiPxtPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiPxtPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="pxt-players-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="pxt-players-modal-title">PxT</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiPxtPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={styles.kpiXgPlayersDetails}>
                                      <div className={styles.metricSelector}>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPxtPlayersRoles.sender ? styles.active : ''}`}
                                          onClick={() => setKpiPxtPlayersRoles(prev => ({ ...prev, sender: !prev.sender }))}
                                          aria-pressed={kpiPxtPlayersRoles.sender}
                                        >
                                          Podanie
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPxtPlayersRoles.receiver ? styles.active : ''}`}
                                          onClick={() => setKpiPxtPlayersRoles(prev => ({ ...prev, receiver: !prev.receiver }))}
                                          aria-pressed={kpiPxtPlayersRoles.receiver}
                                        >
                                          Przyjęcie
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.metricButton} ${kpiPxtPlayersRoles.dribbler ? styles.active : ''}`}
                                          onClick={() => setKpiPxtPlayersRoles(prev => ({ ...prev, dribbler: !prev.dribbler }))}
                                          aria-pressed={kpiPxtPlayersRoles.dribbler}
                                        >
                                          Drybling
                                        </button>
                                      </div>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' })); } }}
                                        >
                                          Zawodnik{kpiPxtSort.column === 'playerName' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'pxtSharePct', dir: prev.column === 'pxtSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'pxtSharePct', dir: prev.column === 'pxtSharePct' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Udział %{kpiPxtSort.column === 'pxtSharePct' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'pxtTotal', dir: prev.column === 'pxtTotal' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'pxtTotal', dir: prev.column === 'pxtTotal' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          PxT{kpiPxtSort.column === 'pxtTotal' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'pxtSender', dir: prev.column === 'pxtSender' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'pxtSender', dir: prev.column === 'pxtSender' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Podanie{kpiPxtSort.column === 'pxtSender' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'pxtReceiver', dir: prev.column === 'pxtReceiver' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'pxtReceiver', dir: prev.column === 'pxtReceiver' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Przyjęcie{kpiPxtSort.column === 'pxtReceiver' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() => setKpiPxtSort(prev => ({ column: 'pxtDribbler', dir: prev.column === 'pxtDribbler' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPxtSort(prev => ({ column: 'pxtDribbler', dir: prev.column === 'pxtDribbler' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          Drybling{kpiPxtSort.column === 'pxtDribbler' ? (kpiPxtSort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                      </div>
                                      {sortedPxtPlayersList.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedPxtPlayersList.map((playerStats) => (
                                            <div key={playerStats.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{playerStats.playerName}</span>
                                              <span>{Math.round(playerStats.pxtSharePct)}%</span>
                                              <span>{playerStats.pxtTotal.toFixed(2)}</span>
                                              <span>{playerStats.pxtSender.toFixed(2)}</span>
                                              <span>{playerStats.pxtReceiver.toFixed(2)}</span>
                                              <span>{playerStats.pxtDribbler.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak PxT dla wybranej drużyny lub wybranych ról.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiP2P3PlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiP2P3PlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="p2p3-players-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="p2p3-players-modal-title">P2/P3</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiP2P3PlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiP2P3Table}`}>
                                      <div className={styles.kpiP2P3HeaderGrid}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderZawodnik}`}
                                          style={{ gridColumn: 1, gridRow: '1 / 3' }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'playerName', dir: prev.column === 'playerName' && prev.dir === 'asc' ? 'desc' : 'asc' })); } }}
                                        >
                                          Zawodnik{kpiP2P3Sort.column === 'playerName' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span className={`${styles.kpiP2P3HeaderGroup} ${styles.kpiP2P3HeaderGroupA}`} style={{ gridColumn: '2 / 4', gridRow: 1 }}>Regain</span>
                                        <span className={`${styles.kpiP2P3HeaderGroup} ${styles.kpiP2P3HeaderGroupB}`} style={{ gridColumn: '4 / 6', gridRow: 1 }}>Podający</span>
                                        <span className={`${styles.kpiP2P3HeaderGroup} ${styles.kpiP2P3HeaderGroupA}`} style={{ gridColumn: '6 / 8', gridRow: 1 }}>Drybling</span>
                                        <span className={`${styles.kpiP2P3HeaderGroup} ${styles.kpiP2P3HeaderGroupB}`} style={{ gridColumn: '8 / 10', gridRow: 1 }}>Przyjęcie</span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColA}`}
                                          style={{ gridColumn: 2, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p2Regain', dir: prev.column === 'p2Regain' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p2Regain', dir: prev.column === 'p2Regain' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P2{kpiP2P3Sort.column === 'p2Regain' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColA}`}
                                          style={{ gridColumn: 3, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p3Regain', dir: prev.column === 'p3Regain' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p3Regain', dir: prev.column === 'p3Regain' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P3{kpiP2P3Sort.column === 'p3Regain' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColB}`}
                                          style={{ gridColumn: 4, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p2Sender', dir: prev.column === 'p2Sender' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p2Sender', dir: prev.column === 'p2Sender' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P2{kpiP2P3Sort.column === 'p2Sender' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColB}`}
                                          style={{ gridColumn: 5, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p3Sender', dir: prev.column === 'p3Sender' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p3Sender', dir: prev.column === 'p3Sender' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P3{kpiP2P3Sort.column === 'p3Sender' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColA}`}
                                          style={{ gridColumn: 6, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p2Dribbler', dir: prev.column === 'p2Dribbler' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p2Dribbler', dir: prev.column === 'p2Dribbler' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P2{kpiP2P3Sort.column === 'p2Dribbler' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColA}`}
                                          style={{ gridColumn: 7, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p3Dribbler', dir: prev.column === 'p3Dribbler' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p3Dribbler', dir: prev.column === 'p3Dribbler' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P3{kpiP2P3Sort.column === 'p3Dribbler' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColB}`}
                                          style={{ gridColumn: 8, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p2Receiver', dir: prev.column === 'p2Receiver' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p2Receiver', dir: prev.column === 'p2Receiver' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P2{kpiP2P3Sort.column === 'p2Receiver' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColB}`}
                                          style={{ gridColumn: 9, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p3Receiver', dir: prev.column === 'p3Receiver' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p3Receiver', dir: prev.column === 'p3Receiver' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P3{kpiP2P3Sort.column === 'p3Receiver' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span className={`${styles.kpiP2P3HeaderGroup} ${styles.kpiP2P3HeaderGroupSum}`} style={{ gridColumn: '10 / 12', gridRow: 1 }}>Łącznie</span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColSum}`}
                                          style={{ gridColumn: 10, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p2Sum', dir: prev.column === 'p2Sum' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p2Sum', dir: prev.column === 'p2Sum' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P2{kpiP2P3Sort.column === 'p2Sum' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={`${styles.kpiXgPlayersSortableHeader} ${styles.kpiP2P3HeaderColSum}`}
                                          style={{ gridColumn: 11, gridRow: 2 }}
                                          onClick={() => setKpiP2P3Sort(prev => ({ column: 'p3Sum', dir: prev.column === 'p3Sum' && prev.dir === 'desc' ? 'asc' : 'desc' }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiP2P3Sort(prev => ({ column: 'p3Sum', dir: prev.column === 'p3Sum' && prev.dir === 'desc' ? 'asc' : 'desc' })); } }}
                                        >
                                          P3{kpiP2P3Sort.column === 'p3Sum' ? (kpiP2P3Sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                                        </span>
                                      </div>
                                      {sortedP2P3PlayersList.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedP2P3PlayersList.map((row) => (
                                            <div key={row.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{row.playerName}</span>
                                              <span>{row.p2Regain}</span>
                                              <span>{row.p3Regain}</span>
                                              <span>{row.p2Sender}</span>
                                              <span>{row.p3Sender}</span>
                                              <span>{row.p2Dribbler}</span>
                                              <span>{row.p3Dribbler}</span>
                                              <span>{row.p2Receiver}</span>
                                              <span>{row.p3Receiver}</span>
                                              <span className={styles.kpiP2P3CellSum}>{row.p2Sum}</span>
                                              <span className={styles.kpiP2P3CellSum}>{row.p3Sum}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak akcji P2/P3 dla wybranej drużyny.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiRegainsPpPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiRegainsPpPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-regains-pp-players-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-regains-pp-players-modal-title">Przechwyty PP – zawodnicy</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiRegainsPpPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiXgPlayersDetailsSimple3}`}>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() =>
                                            setKpiRegainsPpPlayersSort((prev) => ({
                                              column: "playerName",
                                              dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsPpPlayersSort((prev) => ({
                                                column: "playerName",
                                                dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                              }));
                                            }
                                          }}
                                        >
                                          Zawodnik
                                          {kpiRegainsPpPlayersSort.column === "playerName"
                                            ? kpiRegainsPpPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Liczba przechwytów i udział w liczbie przechwytów w nawiasie"
                                          onClick={() =>
                                            setKpiRegainsPpPlayersSort((prev) => ({
                                              column: "count",
                                              dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsPpPlayersSort((prev) => ({
                                                column: "count",
                                                dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          Przechwyty
                                          {kpiRegainsPpPlayersSort.column === "count"
                                            ? kpiRegainsPpPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT w ataku; w nawiasie udział w xT ataku całej puli PP"
                                          onClick={() =>
                                            setKpiRegainsPpPlayersSort((prev) => ({
                                              column: "xtAttack",
                                              dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsPpPlayersSort((prev) => ({
                                                column: "xtAttack",
                                                dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT atak
                                          {kpiRegainsPpPlayersSort.column === "xtAttack"
                                            ? kpiRegainsPpPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT w obronie; w nawiasie udział w xT obrony całej puli PP"
                                          onClick={() =>
                                            setKpiRegainsPpPlayersSort((prev) => ({
                                              column: "xtDefense",
                                              dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsPpPlayersSort((prev) => ({
                                                column: "xtDefense",
                                                dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT obrona
                                          {kpiRegainsPpPlayersSort.column === "xtDefense"
                                            ? kpiRegainsPpPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                      </div>
                                      {sortedPpRegainsPlayerRowsWithXt.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedPpRegainsPlayerRowsWithXt.map((row) => (
                                            <div key={row.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{row.playerName}</span>
                                              <span>
                                                {row.count} ({row.sharePct.toFixed(1)}%)
                                              </span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtAttack, ppRegainXtAgg.teamXtAttackOnly)}</span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtDefense, ppRegainXtAgg.teamXtDefenseOnly)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak przypisanych zawodników do przechwytów PP.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiRegainsAllPitchPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiRegainsAllPitchPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-regains-all-pitch-players-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-regains-all-pitch-players-modal-title">Przechwyty (całe boisko) – zawodnicy</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiRegainsAllPitchPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiXgPlayersDetailsSimple3}`}>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() =>
                                            setKpiRegainsAllPitchPlayersSort((prev) => ({
                                              column: "playerName",
                                              dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsAllPitchPlayersSort((prev) => ({
                                                column: "playerName",
                                                dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                              }));
                                            }
                                          }}
                                        >
                                          Zawodnik
                                          {kpiRegainsAllPitchPlayersSort.column === "playerName"
                                            ? kpiRegainsAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Liczba przechwytów i udział w liczbie przechwytów w nawiasie"
                                          onClick={() =>
                                            setKpiRegainsAllPitchPlayersSort((prev) => ({
                                              column: "count",
                                              dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsAllPitchPlayersSort((prev) => ({
                                                column: "count",
                                                dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          Przechwyty
                                          {kpiRegainsAllPitchPlayersSort.column === "count"
                                            ? kpiRegainsAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT w ataku; w nawiasie udział w xT ataku całej puli"
                                          onClick={() =>
                                            setKpiRegainsAllPitchPlayersSort((prev) => ({
                                              column: "xtAttack",
                                              dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsAllPitchPlayersSort((prev) => ({
                                                column: "xtAttack",
                                                dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT atak
                                          {kpiRegainsAllPitchPlayersSort.column === "xtAttack"
                                            ? kpiRegainsAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT w obronie; w nawiasie udział w xT obrony całej puli"
                                          onClick={() =>
                                            setKpiRegainsAllPitchPlayersSort((prev) => ({
                                              column: "xtDefense",
                                              dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiRegainsAllPitchPlayersSort((prev) => ({
                                                column: "xtDefense",
                                                dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT obrona
                                          {kpiRegainsAllPitchPlayersSort.column === "xtDefense"
                                            ? kpiRegainsAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                      </div>
                                      {sortedAllPitchRegainsPlayerRowsWithXt.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedAllPitchRegainsPlayerRowsWithXt.map((row) => (
                                            <div key={row.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{row.playerName}</span>
                                              <span>
                                                {row.count} ({row.sharePct.toFixed(1)}%)
                                              </span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtAttack, allPitchRegainXtAgg.teamXtAttackOnly)}</span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtDefense, allPitchRegainXtAgg.teamXtDefenseOnly)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak przypisanych zawodników do przechwytów.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {kpiLosesAllPitchPlayersModalOpen && (
                              <div className={styles.modalOverlay} onClick={() => setKpiLosesAllPitchPlayersModalOpen(false)} role="dialog" aria-modal="true" aria-labelledby="kpi-loses-all-pitch-players-modal-title">
                                <div className={`${styles.modalContent} ${styles.kpiModalContent}`} onClick={(e) => e.stopPropagation()}>
                                  <div className={styles.modalHeader}>
                                    <h3 id="kpi-loses-all-pitch-players-modal-title">Straty (całe boisko) – zawodnicy</h3>
                                    <button
                                      type="button"
                                      className={styles.modalCloseButton}
                                      onClick={() => setKpiLosesAllPitchPlayersModalOpen(false)}
                                      aria-label="Zamknij"
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <div className={styles.modalBody}>
                                    <div className={`${styles.kpiXgPlayersDetails} ${styles.kpiXgPlayersDetailsSimple3}`}>
                                      <div className={styles.kpiXgPlayersHeader}>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          onClick={() =>
                                            setKpiLosesAllPitchPlayersSort((prev) => ({
                                              column: "playerName",
                                              dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiLosesAllPitchPlayersSort((prev) => ({
                                                column: "playerName",
                                                dir: prev.column === "playerName" && prev.dir === "asc" ? "desc" : "asc",
                                              }));
                                            }
                                          }}
                                        >
                                          Zawodnik
                                          {kpiLosesAllPitchPlayersSort.column === "playerName"
                                            ? kpiLosesAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Liczba strat i udział w liczbie strat w nawiasie"
                                          onClick={() =>
                                            setKpiLosesAllPitchPlayersSort((prev) => ({
                                              column: "count",
                                              dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiLosesAllPitchPlayersSort((prev) => ({
                                                column: "count",
                                                dir: prev.column === "count" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          Straty
                                          {kpiLosesAllPitchPlayersSort.column === "count"
                                            ? kpiLosesAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT strat na połowie przeciwnika; w nawiasie udział w tej sumie zespołu"
                                          onClick={() =>
                                            setKpiLosesAllPitchPlayersSort((prev) => ({
                                              column: "xtAttack",
                                              dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiLosesAllPitchPlayersSort((prev) => ({
                                                column: "xtAttack",
                                                dir: prev.column === "xtAttack" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT atak
                                          {kpiLosesAllPitchPlayersSort.column === "xtAttack"
                                            ? kpiLosesAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          className={styles.kpiXgPlayersSortableHeader}
                                          title="Suma xT strat na własnej połowie; w nawiasie udział w tej sumie zespołu"
                                          onClick={() =>
                                            setKpiLosesAllPitchPlayersSort((prev) => ({
                                              column: "xtDefense",
                                              dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                            }))
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              setKpiLosesAllPitchPlayersSort((prev) => ({
                                                column: "xtDefense",
                                                dir: prev.column === "xtDefense" && prev.dir === "desc" ? "asc" : "desc",
                                              }));
                                            }
                                          }}
                                        >
                                          xT obrona
                                          {kpiLosesAllPitchPlayersSort.column === "xtDefense"
                                            ? kpiLosesAllPitchPlayersSort.dir === "asc"
                                              ? " ↑"
                                              : " ↓"
                                            : ""}
                                        </span>
                                      </div>
                                      {sortedAllPitchLosesPlayerRowsWithXt.length > 0 ? (
                                        <div className={styles.kpiXgPlayersList}>
                                          {sortedAllPitchLosesPlayerRowsWithXt.map((row) => (
                                            <div key={row.playerId} className={styles.kpiXgPlayersRow}>
                                              <span className={styles.kpiXgPlayersName}>{row.playerName}</span>
                                              <span>
                                                {row.count} ({row.sharePct.toFixed(1)}%)
                                              </span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtAttack, allPitchLoseXtAgg.teamXtAttackOnly)}</span>
                                              <span>{formatKpiPlayerModalXtCell(row.xtDefense, allPitchLoseXtAgg.teamXtDefenseOnly)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className={styles.kpiXgPlayersEmpty}>Brak przypisanych zawodników do strat.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div
                              role="button"
                              tabIndex={0}
                              className={`${styles.kpiScoreRowClickable} ${kpiShotsRowExpanded ? styles.kpiScoreRowClickableExpanded : ''}`}
                              onClick={() => setKpiShotsRowExpanded(!kpiShotsRowExpanded)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiShotsRowExpanded(!kpiShotsRowExpanded); } }}
                              title={kpiShotsRowExpanded ? 'Kliknij, aby zwinąć' : 'Kliknij, aby rozwinąć szczegóły strzałów'}
                              aria-expanded={kpiShotsRowExpanded}
                            >
                              <span className={styles.kpiScoreRowCenterBlock}>
                                <span className={styles.kpiScoreRowLabel}>Strzały</span>
                                <span className={styles.kpiScoreRowCenterIcons}>
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setXgMapModalOpen(true); }}
                                      title="Otwórz mapę xG"
                                      aria-label="Otwórz mapę xG"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                        <line x1="8" y1="2" x2="8" y2="18" />
                                        <line x1="16" y1="6" x2="16" y2="22" />
                                      </svg>
                                    </button>
                                  )}
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setKpiShotsPlayersModalOpen(true);
                                      }}
                                      title="Pokaż wkład zawodników w strzały"
                                      aria-label="Pokaż wkład zawodników w strzały"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  )}
                                </span>
                              </span>
                              <div className={styles.kpiScoreRowValuesWrap}>
                                <span className={styles.kpiScoreRowLeft}>
                                  <span className={styles.kpiScoreRowValues}>{teamShotsCount}</span>
                                </span>
                                <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                <span className={styles.kpiScoreRowRight}>{opponentShotsCount}</span>
                              </div>
                              <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                {kpiShotsRowExpanded ? (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                ) : (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                )}
                              </span>
                            </div>
                            {kpiShotsRowExpanded && (
                              <div className={styles.kpiScoreRowExpandedContent}>
                                <div className={styles.kpiScoreGoalsDetails}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Celne</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamOnTarget}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamShotsCount > 0 ? Math.round(teamOnTarget / teamShotsCount * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentOnTarget}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentShotsCount > 0 ? Math.round(opponentOnTarget / opponentShotsCount * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Niecelne</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamOffTarget}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamShotsCount > 0 ? Math.round(teamOffTarget / teamShotsCount * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentOffTarget}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentShotsCount > 0 ? Math.round(opponentOffTarget / opponentShotsCount * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Zablokowane</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamBlocked}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamShotsCount > 0 ? Math.round(teamBlocked / teamShotsCount * 100) : 0}%)
                                      </span>
                                      {' : '}
                                      {opponentBlocked}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentShotsCount > 0 ? Math.round(opponentBlocked / opponentShotsCount * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div
                              role="button"
                              tabIndex={0}
                              className={`${styles.kpiScoreRowClickable} ${styles.kpiScoreRowThreeCol} ${kpiPkRowExpanded ? styles.kpiScoreRowClickableExpanded : ''}`}
                              onClick={() => setKpiPkRowExpanded(!kpiPkRowExpanded)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setKpiPkRowExpanded(!kpiPkRowExpanded); } }}
                              title={kpiPkRowExpanded ? 'Kliknij, aby zwinąć' : 'Kliknij, aby rozwinąć szczegóły PK (po regain, SFG, drybling, podanie)'}
                              aria-expanded={kpiPkRowExpanded}
                            >
                              <span className={styles.kpiScoreRowCenterBlock}>
                                <span className={styles.kpiScoreRowLabel}>PK</span>
                                <span className={styles.kpiScoreRowCenterIcons}>
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setPkMapModalOpen(true); }}
                                      title="Otwórz mapę wejść w PK"
                                      aria-label="Otwórz mapę wejść w pole karne"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                        <line x1="8" y1="2" x2="8" y2="18" />
                                        <line x1="16" y1="6" x2="16" y2="22" />
                                      </svg>
                                    </button>
                                  )}
                                  {selectedMatchInfo && (
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setKpiPkPlayersModalOpen(true); }}
                                      title="Pokaż wkład zawodników w wejścia PK"
                                      aria-label="Pokaż wkład zawodników w wejścia PK"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  )}
                                </span>
                              </span>
                              <div className={styles.kpiScoreRowValuesWrap}>
                                <span className={styles.kpiScoreRowLeft}>
                                  <span className={styles.kpiScoreRowValues}>{teamPKEntriesCount}</span>
                                </span>
                                <span className={styles.kpiScoreRowCombinedDivider}> : </span>
                                <span className={styles.kpiScoreRowRight}>{opponentPKEntriesCount}</span>
                              </div>
                              <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                {kpiPkRowExpanded ? (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                ) : (
                                  <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                )}
                              </span>
                            </div>
                            {kpiPkRowExpanded && (
                              <div className={styles.kpiScoreRowExpandedContent}>
                                <div className={styles.kpiScoreGoalsDetails}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>SFG</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamPKSfgCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamPKEntriesCount > 0 ? Math.round(teamPKSfgCount / teamPKEntriesCount * 100) : 0}%)
                                      </span>
                                      <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                      {opponentPKSfgCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentPKEntriesCount > 0 ? Math.round(opponentPKSfgCount / opponentPKEntriesCount * 100) : 0}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Drybling</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamPKDribbleCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamPKEntriesCount > 0 ? Math.round(teamPKDribbleCount / teamPKEntriesCount * 100) : 0}%)
                                      </span>
                                      <span className={styles.kpiScoreRowValuesRegainPart}>
                                        {' '}
                                        · {teamPKDribbleRegainCount} po regain
                                      </span>
                                      <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                      {opponentPKDribbleCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentPKEntriesCount > 0 ? Math.round(opponentPKDribbleCount / opponentPKEntriesCount * 100) : 0}%)
                                      </span>
                                      <span className={styles.kpiScoreRowValuesRegainPart}>
                                        {' '}
                                        · {opponentPKDribbleRegainCount} po regain
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Podanie</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {teamPKPassCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({teamPKEntriesCount > 0 ? Math.round(teamPKPassCount / teamPKEntriesCount * 100) : 0}%)
                                      </span>
                                      <span className={styles.kpiScoreRowValuesRegainPart}>
                                        {' '}
                                        · {teamPKPassRegainCount} po regain
                                      </span>
                                      <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                      {opponentPKPassCount}{' '}
                                      <span className={styles.kpiScoreRowValuesPct}>
                                        ({opponentPKEntriesCount > 0 ? Math.round(opponentPKPassCount / opponentPKEntriesCount * 100) : 0}%)
                                      </span>
                                      <span className={styles.kpiScoreRowValuesRegainPart}>
                                        {' '}
                                        · {opponentPKPassRegainCount} po regain
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              className={`${styles.kpiScoreRowCombined} ${styles.kpiScoreRowP3Clickable}`}
                              onClick={() => {
                                setSelectedKpiForVideo(selectedKpiForVideo === 'p2p3-passes' ? null : 'p2p3-passes');
                                setExpandedKpiForPlayers(null);
                              }}
                              title="PxT – nie wlicza się do KPI"
                              aria-label="PxT, nie wlicza się do KPI"
                            >
                              <div className={styles.kpiScoreRowCombinedMain}>
                                <div className={styles.kpiScoreRowCombinedBlock}>
                                  <span className={styles.kpiScoreRowLabelWithIcon}>
                                    <span className={styles.kpiScoreRowLabel}>PxT</span>
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setKpiPxtPlayersModalOpen(true);
                                      }}
                                      title="Pokaż wkład PxT zawodników (podanie / odbiór / drybling)"
                                      aria-label="Pokaż wkład PxT zawodników"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  </span>
                                  <span className={styles.kpiScoreRowValuesWithIcon}>
                                    <span className={styles.kpiScoreRowValues}>{totalPxtAll.toFixed(2)} PxT</span>
                                  </span>
                                </div>
                              </div>
                            </button>
                            <div
                              className={`${styles.kpiScoreRowCombined} ${kpiP2P3RowExpanded ? styles.kpiScoreRowCombinedExpanded : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setKpiP2P3RowExpanded(!kpiP2P3RowExpanded)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setKpiP2P3RowExpanded(!kpiP2P3RowExpanded);
                                }
                              }}
                              aria-expanded={kpiP2P3RowExpanded}
                              title={kpiP2P3RowExpanded ? 'Kliknij, aby zwinąć szczegóły P2/P3' : 'Kliknij, aby rozwinąć szczegóły P2/P3'}
                            >
                              <div className={styles.kpiScoreRowCombinedMain}>
                                <div className={styles.kpiScoreRowCombinedBlock}>
                                  <span className={styles.kpiScoreRowLabelWithIcon}>
                                    <span className={styles.kpiScoreRowLabel}>P2/P3</span>
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => { e.stopPropagation(); setKpiP2P3PlayersModalOpen(true); }}
                                      title="Pokaż statystyki P2/P3 zawodników (regain, podający, drybling, przyjęcie)"
                                      aria-label="Pokaż statystyki P2/P3 zawodników"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  </span>
                                  <span className={styles.kpiScoreRowValuesWithIcon}>
                                    <span className={styles.kpiScoreRowValues}>
                                      {totalP2Actions}/{totalP3Actions}
                                    </span>
                                  </span>
                                </div>
                                <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                  {kpiP2P3RowExpanded ? (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </span>
                              </div>
                            {kpiP2P3RowExpanded && (
                              <div className={styles.kpiScoreRowExpandedContent}>
                                <div className={styles.kpiScoreGoalsDetails}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Podania</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {totalP2Actions > 0 || totalP3Actions > 0 ? (
                                        <>
                                          {totalP2FromPass}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP2Actions > 0 ? Math.round((totalP2FromPass / totalP2Actions) * 100) : 0}%)
                                          </span>
                                          {' / '}
                                          {totalP3FromPass}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP3Actions > 0 ? Math.round((totalP3FromPass / totalP3Actions) * 100) : 0}%)
                                          </span>
                                        </>
                                      ) : (
                                        'brak danych'
                                      )}
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Drybling</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {totalP2Actions > 0 || totalP3Actions > 0 ? (
                                        <>
                                          {totalP2FromDribble}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP2Actions > 0 ? Math.round((totalP2FromDribble / totalP2Actions) * 100) : 0}%)
                                          </span>
                                          {' / '}
                                          {totalP3FromDribble}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP3Actions > 0 ? Math.round((totalP3FromDribble / totalP3Actions) * 100) : 0}%)
                                          </span>
                                        </>
                                      ) : (
                                        'brak danych'
                                      )}
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>Regain</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {totalP2Actions > 0 || totalP3Actions > 0 ? (
                                        <>
                                          {totalP2FromRegain}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP2Actions > 0 ? Math.round((totalP2FromRegain / totalP2Actions) * 100) : 0}%)
                                          </span>
                                          {' / '}
                                          {totalP3FromRegain}{' '}
                                          <span className={styles.kpiScoreRowValuesPct}>
                                            ({totalP3Actions > 0 ? Math.round((totalP3FromRegain / totalP3Actions) * 100) : 0}%)
                                          </span>
                                        </>
                                      ) : (
                                        'brak danych'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            </div>
                            <div
                              className={`${styles.kpiScoreRowCombined} ${kpiRegainsPPRowExpanded ? styles.kpiScoreRowCombinedExpanded : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setKpiRegainsPPRowExpanded(!kpiRegainsPPRowExpanded)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setKpiRegainsPPRowExpanded(!kpiRegainsPPRowExpanded);
                                }
                              }}
                              aria-expanded={kpiRegainsPPRowExpanded}
                              title={kpiRegainsPPRowExpanded ? 'Kliknij, aby zwinąć szczegóły przechwytów PP' : 'Kliknij, aby rozwinąć szczegóły przechwytów PP'}
                            >
                              <div className={styles.kpiScoreRowCombinedMain}>
                                <div className={styles.kpiScoreRowCombinedBlock}>
                                  <span className={styles.kpiScoreRowLabelWithIcon}>
                                    <span className={styles.kpiScoreRowLabel} title="Przeciwnika = straty na własnej połowie, które nie są autami">
                                      Przechwyty na połowie przeciwnika
                                    </span>
                                    <button
                                      type="button"
                                      className={styles.kpiMapIconButton}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setKpiRegainsPpPlayersModalOpen(true);
                                      }}
                                      title="Pokaż udział zawodników w przechwytach PP"
                                      aria-label="Pokaż udział zawodników w przechwytach PP"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    </button>
                                  </span>
                                  <span className={styles.kpiScoreRowValues} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px' }}>
                                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px', justifyContent: 'flex-end' }}>
                                      <span>{ppRegainsTotalForShare}</span>
                                      {ppRegainsTotalForShare > 0 && ppRegainsPlayerSummary.playersWithActions > 0 ? (
                                        <span className={styles.kpiScoreRowValuesPossessionTime}>
                                          · {ppRegainsPlayerSummary.playersWithActions} zaw., max {ppRegainsPlayerSummary.maxSharePct.toFixed(1)}%
                                        </span>
                                      ) : null}
                                    </span>
                                    <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                    <span>{teamLosesStats.totalLosesOwnHalfFull}</span>
                                  </span>
                                </div>
                                <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                  {kpiRegainsPPRowExpanded ? (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  ) : (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </span>
                              </div>
                            {kpiRegainsPPRowExpanded && (
                              <div className={styles.kpiScoreRowExpandedContent}>
                                <div className={styles.kpiScoreGoalsDetails}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabelWithIcon}>
                                      <span className={styles.kpiScoreRowLabel}>Przechwyty (całe boisko)</span>
                                      <button
                                        type="button"
                                        className={styles.kpiMapIconButton}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setKpiRegainsAllPitchPlayersModalOpen(true);
                                        }}
                                        title="Lista zawodników – przechwyty na całym boisku"
                                        aria-label="Lista zawodników – przechwyty na całym boisku"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                          <circle cx="9" cy="7" r="4" />
                                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                      </button>
                                    </span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {allPitchRegainsTotal}
                                      {allPitchRegainsTotal > 0 && allPitchRegainsPlayerSummary.playersWithActions > 0 ? (
                                        <span className={styles.kpiScoreRowValuesPossessionTime}>
                                          {' '}
                                          · {allPitchRegainsPlayerSummary.playersWithActions} zaw., max {allPitchRegainsPlayerSummary.maxSharePct.toFixed(1)}%
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabelWithIcon}>
                                      <span className={styles.kpiScoreRowLabel}>Straty (całe boisko)</span>
                                      <button
                                        type="button"
                                        className={styles.kpiMapIconButton}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setKpiLosesAllPitchPlayersModalOpen(true);
                                        }}
                                        title="Lista zawodników – straty na całym boisku"
                                        aria-label="Lista zawodników – straty na całym boisku"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                          <circle cx="9" cy="7" r="4" />
                                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                      </button>
                                    </span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {allPitchLosesTotal}
                                      {allPitchLosesTotal > 0 && allPitchLosesPlayerSummary.playersWithActions > 0 ? (
                                        <span className={styles.kpiScoreRowValuesPossessionTime}>
                                          {' '}
                                          · {allPitchLosesPlayerSummary.playersWithActions} zaw., max {allPitchLosesPlayerSummary.maxSharePct.toFixed(1)}%
                                        </span>
                                      ) : null}
                                    </span>
                                  </div>
                                </div>
                                <div className={styles.kpiScoreGoalsDetails}>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>8s CA Strzał</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {(() => {
                                        const ourTotal = ppRegainsTotalForShare;
                                        const ourWithShot = regainsPPWithShot8s;
                                        const ourWithPct = ourTotal > 0 ? (ourWithShot / ourTotal) * 100 : 0;

                                        const oppTotal = teamLosesStats.totalLosesOwnHalfFull;
                                        const oppWithShot = losesOwnHalfWithShot8s;
                                        const oppWithPct = oppTotal > 0 ? (oppWithShot / oppTotal) * 100 : 0;

                                        if (ourTotal === 0 && oppTotal === 0) return 'brak danych';

                                        return (
                                          <>
                                            {ourWithShot}{' '}
                                            <span className={styles.kpiScoreRowValuesPct}>
                                              ({ourWithPct.toFixed(1)}%)
                                            </span>
                                            <span className={styles.kpiScoreRowCombinedDivider}> : </span>
                                            {oppWithShot}{' '}
                                            <span className={styles.kpiScoreRowValuesPct}>
                                              ({oppWithPct.toFixed(1)}%)
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </span>
                                  </div>
                                  <div className={styles.kpiScoreRow}>
                                    <span className={styles.kpiScoreRowLabel}>8s CA PK</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {(() => {
                                        const ourTotal = ppRegainsTotalForShare;
                                        const ourWithPK = regainsPPWithPK8s;
                                        const ourWithPct = ourTotal > 0 ? (ourWithPK / ourTotal) * 100 : 0;

                                        const oppTotal = teamLosesStats.totalLosesOwnHalfFull;
                                        const oppWithPK = losesOwnHalfWithPK8s;
                                        const oppWithPct = oppTotal > 0 ? (oppWithPK / oppTotal) * 100 : 0;

                                        if (ourTotal === 0 && oppTotal === 0) return 'brak danych';

                                        return (
                                          <>
                                            {ourWithPK}{' '}
                                            <span className={styles.kpiScoreRowValuesPct}>
                                              ({ourWithPct.toFixed(1)}%)
                                            </span>
                                            <span className={styles.kpiScoreRowCombinedDivider}> : </span>
                                            {oppWithPK}{' '}
                                            <span className={styles.kpiScoreRowValuesPct}>
                                              ({oppWithPct.toFixed(1)}%)
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            </div>
                            <div
                              className={`${styles.kpiScoreRowCombined} ${kpiPossessionRowExpanded ? styles.kpiScoreRowCombinedExpanded : ''}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setKpiPossessionRowExpanded(!kpiPossessionRowExpanded)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setKpiPossessionRowExpanded(!kpiPossessionRowExpanded);
                                }
                              }}
                              aria-label="Posiadanie i czas martwy"
                              title={kpiPossessionRowExpanded ? 'Kliknij, aby zwinąć' : 'Kliknij, aby rozwinąć szczegóły posiadania'}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.kpiScoreRowCombinedMain}>
                                <div className={styles.kpiScoreRowCombinedBlock}>
                                  <div className={styles.kpiScoreRowPossessionLeft}>
                                    <span className={styles.kpiScoreRowLabel}>Posiadanie</span>
                                    <span className={styles.kpiScoreRowCombinedDeadTime} aria-hidden>
                                      Czas martwy: {Math.round(deadPercent)}% ({formatMinutesToMMSS(deadMinutes)})
                                    </span>
                                  </div>
                                  <span className={styles.kpiScoreRowValuesPossessionWrap}>
                                    <span className={styles.kpiScoreRowValues}>
                                      {Math.round(teamPossessionPercent)}%{' '}
                                      <span className={styles.kpiScoreRowValuesPossessionTime}>
                                        ({formatMinutesToMMSS(teamPossessionMinutes)})
                                      </span>
                                    </span>
                                    <span className={styles.kpiScoreRowCombinedDivider}>:</span>
                                    <span className={styles.kpiScoreRowValues}>
                                      {Math.round(opponentPossessionPercent)}%{' '}
                                      <span className={styles.kpiScoreRowValuesPossessionTime}>
                                        ({formatMinutesToMMSS(opponentPossessionMinutes)})
                                      </span>
                                    </span>
                                  </span>
                                </div>
                                <span className={styles.kpiScoreRowExpandIcon} aria-hidden>
                                  {kpiPossessionRowExpanded ? (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  ) : (
                                    <svg className={styles.kpiScoreRowExpandIconSvg} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  )}
                                </span>
                              </div>
                            </div>
                            {(() => {
                              const findKey = (t: Record<string, any>, keys: string[]) => keys.find(k => Object.prototype.hasOwnProperty.call(t, k));
                              const totalDistM = gpsMatchDayData.reduce((sum, e) => {
                                const k = findKey(e.total ?? {}, ['Total Distance', 'Total distance', 'Distance']);
                                const v = k != null && e.total?.[k] != null ? Number(e.total[k]) : NaN;
                                return sum + (Number.isFinite(v) ? v : 0);
                              }, 0);
                              const totalSprintDistM = gpsMatchDayData.reduce((sum, e) => {
                                const k = findKey(e.total ?? {}, ['Sprint Distance', 'Sprint distance']);
                                const v = k != null && e.total?.[k] != null ? Number(e.total[k]) : NaN;
                                return sum + (Number.isFinite(v) ? v : 0);
                              }, 0);
                              const totalHSRM = gpsMatchDayData.reduce((sum, e) => {
                                const k = findKey(e.total ?? {}, ['High Speed Running (Relative)', 'High Speed Running (relative)', 'High Speed Running (m)', 'High Speed Running']);
                                const v = k != null && e.total?.[k] != null ? Number(e.total[k]) : NaN;
                                return sum + (Number.isFinite(v) ? v : 0);
                              }, 0);
                              const hasAny = totalDistM > 0 || totalSprintDistM > 0 || totalHSRM > 0;
                              if (!hasAny) return null;
                              const distStr = totalDistM > 0 ? (totalDistM >= 1000 ? `${(totalDistM / 1000).toFixed(1)} km` : `${Math.round(totalDistM)} m`) : '—';
                              const sprintDistStr = totalSprintDistM > 0 ? (totalSprintDistM >= 1000 ? `${(totalSprintDistM / 1000).toFixed(1)} km` : `${Math.round(totalSprintDistM)} m`) : '—';
                              const hsrStr = totalHSRM > 0 ? (totalHSRM >= 1000 ? `${(totalHSRM / 1000).toFixed(1)} km` : `${Math.round(totalHSRM)} m`) : '—';
                              return (
                                <div className={styles.kpiScoreRow}>
                                  <span className={styles.kpiScoreRowLabel}>Dystans/Sprint/HSR</span>
                                  <span className={styles.kpiScoreRowValues}>
                                    {distStr} / {sprintDistStr} / {hsrStr}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className={styles.kpiMainGrid}>
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* Kafelki statystyk */}
                        <div className={`${styles.statsTiles} ${styles.kpiCompactTiles}`} style={{ marginTop: 'auto' }}>
                          {(() => {
                            const isPKOpponentBad = opponentPKEntriesCount > kpiPKEntries;
                            const isLosesPMAreaBad = losesInPMAreaCount > kpiLosesPMAreaCount;
                            const isXGPerShotGood = teamXGPerShot >= kpiXGPerShot;
                            const is1TPercentageGood = team1TContact1Percentage >= kpi1TPercentage;
                            const is8sAccGood = shotAndPK8sPercentage >= target8sAcc;
                            const isReaction5sGood = reaction5sPercentage >= kpiReaction5s;
                            const isRegainsOpponentHalfGood = ppRegainsTotalForShare >= kpiRegainsOpponentHalf;
                            const isRegainsPPToPKShot8sGood = regainsPPToPKShot8sPercentage >= kpiRegainsPPToPKShot8s;

                            const pkDelta = opponentPKEntriesCount - kpiPKEntries;
                            const xgPerShotDelta = kpiXGPerShot - teamXGPerShot;
                            const oneTPercentageDelta = kpi1TPercentage - team1TContact1Percentage;
                            const losesPmDelta = losesInPMAreaCount - kpiLosesPMAreaCount;
                            const accDelta = target8sAcc - shotAndPK8sPercentage;
                            const reactionDelta = kpiReaction5s - reaction5sPercentage;
                            const regainsOpponentHalfDelta = kpiRegainsOpponentHalf - ppRegainsTotalForShare;
                            const regainsPPToPKShot8sDelta = kpiRegainsPPToPKShot8s - regainsPPToPKShot8sPercentage;

                            return (
                              <>
                          <div 
                            className={`${styles.statTile} ${is8sAccGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={() => {
                              setSelectedKpiForVideo(selectedKpiForVideo === '8s-acc' ? null : '8s-acc');
                              setExpandedKpiForPlayers(null);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : '8s ACC'}</div>
                            <div className={styles.statTileValue}>
                              {shotAndPK8sPercentage.toFixed(1)}%
                              <span className={styles.statTileValueDelta}>
                                {accDelta > 0 ? `(-${accDelta.toFixed(1)}%)` : `(+${Math.abs(accDelta).toFixed(1)}%)`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {shotAndPK8sCount}/{total8sAcc} • KPI ≥ {target8sAcc}%
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isXGPerShotGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKpiForVideo(selectedKpiForVideo === 'xg-per-shot' ? null : 'xg-per-shot');
                              setExpandedKpiForPlayers(expandedKpiForPlayers === 'xg-per-shot' ? null : 'xg-per-shot');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : 'xG/strzał'}</div>
                            <div className={styles.statTileValue}>
                              {teamXGPerShot.toFixed(2)}
                              <span className={styles.statTileValueDelta}>
                                {xgPerShotDelta > 0 ? `(-${xgPerShotDelta.toFixed(2)})` : `(+${Math.abs(xgPerShotDelta).toFixed(2)})`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {teamShotsCount} strzałów • KPI &gt; {kpiXGPerShot.toFixed(2)}
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${is1TPercentageGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKpiForVideo(selectedKpiForVideo === '1t-percentage' ? null : '1t-percentage');
                              setExpandedKpiForPlayers(expandedKpiForPlayers === '1t-percentage' ? null : '1t-percentage');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : '1T'}</div>
                            <div className={styles.statTileValue}>
                              {team1TContact1Percentage.toFixed(1)}%
                              <span className={styles.statTileValueDelta}>
                                {oneTPercentageDelta > 0 ? `(-${oneTPercentageDelta.toFixed(1)}%)` : `(+${Math.abs(oneTPercentageDelta).toFixed(1)}%)`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {teamShots1TCount} strzały w 1T • KPI ≥ {kpi1TPercentage}%
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isPKOpponentBad ? styles.statTileBad : styles.statTileGood}`}
                            onClick={() => {
                              setSelectedKpiForVideo(selectedKpiForVideo === 'pk-opponent' ? null : 'pk-opponent');
                              setExpandedKpiForPlayers(null);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : 'PK przeciwnik'}</div>
                            <div className={styles.statTileValue}>
                              {opponentPKEntriesCount}
                              <span className={styles.statTileValueDelta}>
                                {pkDelta > 0 ? `(+${pkDelta})` : `(-${Math.abs(pkDelta)})`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              KPI &lt; {kpiPKEntries}
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isReaction5sGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={() => {
                              setSelectedKpiForVideo(selectedKpiForVideo === '5s' ? null : '5s');
                              setExpandedKpiForPlayers(null);
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={`${styles.statTileLabel} ${styles.tooltipTrigger}`} data-tooltip="KPI 5s (counterpressing) = (Liczba strat z isReaction5s === true) / (Wszystkie straty z zaznaczonym przyciskiem ✓ 5s LUB ✗ 5s, bez isAut) × 100%. KPI > 50%">
                              {isPresentationMode ? 'KPI' : '5s (counterpressing)'}
                            </div>
                            <div className={styles.statTileValue}>
                              {reaction5sPercentage.toFixed(1)}%
                              <span className={styles.statTileValueDelta}>
                                {reactionDelta > 0 ? `(-${reactionDelta.toFixed(1)}%)` : `(+${Math.abs(reactionDelta).toFixed(1)}%)`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {reaction5sLoses.length}/{losesWith5sFlags.length} • KPI &gt; {kpiReaction5s}%
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isLosesPMAreaBad ? styles.statTileBad : styles.statTileGood}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKpiForVideo(selectedKpiForVideo === 'pm-area-loses' ? null : 'pm-area-loses');
                              setExpandedKpiForPlayers(expandedKpiForPlayers === 'pm-area-loses' ? null : 'pm-area-loses');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : 'PM Area straty'}</div>
                            <div className={styles.statTileValue}>
                              {losesInPMAreaCount}
                              <span className={styles.statTileValueDelta}>
                                {losesPmDelta >= 0 ? `(+${losesPmDelta})` : `(-${Math.abs(losesPmDelta)})`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {losesInPMAreaPercentage.toFixed(1)}% ({losesInPMAreaCount}/{allLoses.length}) • KPI ≤ {kpiLosesPMAreaCount}
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isRegainsOpponentHalfGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKpiForVideo(selectedKpiForVideo === 'regains-pp' ? null : 'regains-pp');
                              setExpandedKpiForPlayers(expandedKpiForPlayers === 'regains-pp' ? null : 'regains-pp');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : 'Przechwyty PP'}</div>
                            <div className={styles.statTileValue}>
                              {ppRegainsTotalForShare}
                              <span className={styles.statTileValueDelta}>
                                {regainsOpponentHalfDelta > 0 ? `(-${regainsOpponentHalfDelta})` : `(+${Math.abs(regainsOpponentHalfDelta)})`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              KPI ≥ {kpiRegainsOpponentHalf}
                            </div>
                          </div>
                          <div 
                            className={`${styles.statTile} ${isRegainsPPToPKShot8sGood ? styles.statTileGood : styles.statTileBad}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKpiForVideo(selectedKpiForVideo === '8s-ca' ? null : '8s-ca');
                              setExpandedKpiForPlayers(expandedKpiForPlayers === '8s-ca' ? null : '8s-ca');
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={styles.statTileLabel}>{isPresentationMode ? 'KPI' : '8s CA'}</div>
                            <div className={styles.statTileValue}>
                              {regainsPPToPKShot8sPercentage.toFixed(1)}%
                              <span className={styles.statTileValueDelta}>
                                {regainsPPToPKShot8sDelta > 0 ? `(-${regainsPPToPKShot8sDelta.toFixed(1)}%)` : `(+${Math.abs(regainsPPToPKShot8sDelta).toFixed(1)}%)`}
                              </span>
                            </div>
                            <div className={styles.statTileSecondary}>
                              {regainsPPWithPKOrShot8s}/{regainsOnOpponentHalfWithTimestamp.length} • KPI ≥ {kpiRegainsPPToPKShot8s}%
                            </div>
                          </div>
                              </>
                            );
                          })()}
                          </div>
                      </div>
                    </div>
                    
                    {/* Legenda dla xG/strzał - nad listą zawodników i panelem wideo */}
                    {expandedKpiForPlayers === 'xg-per-shot' && (
                      <div style={{ 
                        marginTop: '12px',
                        marginBottom: '4px',
                        padding: '4px 8px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#6b7280',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        width: '100%'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: TEAM_STATS_GREEN, 
                            borderRadius: '3px',
                            border: 'none'
                          }}></div>
                          <span>Skuteczny (xG ≥ 0.15)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: '#757575', 
                            borderRadius: '3px',
                            border: 'none'
                          }}></div>
                          <span>Nieskuteczny</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: TEAM_STATS_GREEN, 
                            borderRadius: '3px',
                            border: `1px solid ${TEAM_STATS_RED}`
                          }}></div>
                          <span>Gol</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Legenda dla 1T */}
                    {expandedKpiForPlayers === '1t-percentage' && (
                      <div style={{ 
                        marginTop: '12px',
                        marginBottom: '4px',
                        padding: '4px 8px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#6b7280',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        width: '100%'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: TEAM_STATS_GREEN, 
                            borderRadius: '3px',
                            border: 'none'
                          }}></div>
                          <span>1T</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: '#757575', 
                            borderRadius: '3px',
                            border: 'none'
                          }}></div>
                          <span>Nie 1T</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: TEAM_STATS_GREEN, 
                            borderRadius: '3px',
                            border: `1px solid ${TEAM_STATS_RED}`
                          }}></div>
                          <span>Gol</span>
                        </div>
                      </div>
                    )}
                    {/* Legenda dla PK przeciwnika */}
                    {expandedKpiForPlayers === 'pk-opponent' && (
                      <div style={{ 
                        marginTop: '12px',
                        marginBottom: '4px',
                        padding: '4px 8px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#6b7280',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        width: '100%'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: TEAM_STATS_RED, 
                            borderRadius: '3px',
                            border: 'none'
                          }}></div>
                          <span>Strzał</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            backgroundColor: '#757575', 
                            borderRadius: '3px',
                            border: `1px solid ${TEAM_STATS_GREEN}`
                          }}></div>
                          <span>Gol</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Lista zawodników dla wybranych KPI - na samym dole kontenera, na pełnej szerokości */}
                    {expandedKpiForPlayers && selectedMatchInfo && (() => {
                if (expandedKpiForPlayers === 'xg-per-shot') {
                  // Oblicz potrzebne zmienne
                  const isSelectedTeamHome = selectedMatchInfo.isHome;
                  const teamIdInMatch = selectedTeam;
                  
                  // Filtruj strzały naszego zespołu
                  const teamShots = allShots.filter(shot => {
                    const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                      ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                      : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                    return shotTeamId === teamIdInMatch;
                  });
                  
                  const teamShotsCount = teamShots.length;
                  const kpiXGPerShot = 0.15;
                  
                  // Oblicz statystyki per zawodnik dla strzałów
                  const playerShotsMap = new Map<string, { shots: any[]; totalXG: number }>();
                  teamShots.forEach((shot: any) => {
                    if (shot.playerId) {
                      if (!playerShotsMap.has(shot.playerId)) {
                        playerShotsMap.set(shot.playerId, { shots: [], totalXG: 0 });
                      }
                      const playerData = playerShotsMap.get(shot.playerId)!;
                      playerData.shots.push(shot);
                      playerData.totalXG += shot.xG || 0;
                    }
                  });
                  
                  const playerStats = Array.from(playerShotsMap.entries())
                    .map(([playerId, data]) => {
                      const player = players.find(p => p.id === playerId);
                      return {
                        playerId,
                        playerName: getPlayerLabel(playerId, playersIndex),
                        count: data.shots.length,
                        totalXG: data.totalXG,
                        percentage: teamShotsCount > 0 ? (data.shots.length / teamShotsCount) * 100 : 0,
                        shots: data.shots
                      };
                    })
                    .sort((a, b) => b.count - a.count);
                  
                  return (
                    <div style={{ 
                        marginTop: '0', 
                        padding: '8px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb',
                        width: '100%'
                      }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px'
                          }}
                          onClick={() => setIsPlayersListCollapsed(!isPlayersListCollapsed)}
                        >
                          <div style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                            Zawodnicy - xG/strzał ({playerStats.length})
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', transform: isPlayersListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                        </div>
                        {!isPlayersListCollapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {playerStats.map((stat) => (
                          <div 
                            key={stat.playerId} 
                            onClick={() => {
                              setSelectedPlayerForVideo(selectedPlayerForVideo === stat.playerId ? null : stat.playerId);
                              setSelectedKpiForVideo('xg-per-shot');
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            style={{ 
                              padding: '6px 8px',
                              backgroundColor: selectedPlayerForVideo === stat.playerId ? '#eff6ff' : 'transparent',
                              borderRadius: '4px',
                              border: selectedPlayerForVideo === stat.playerId ? '1px solid #3b82f6' : 'none',
                              borderBottom: selectedPlayerForVideo !== stat.playerId ? '1px solid #f3f4f6' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: '0 0 140px', fontWeight: '500', color: '#374151' }}>
                              {stat.playerName}
                            </div>
                            <div style={{ flex: '0 0 auto', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {stat.count} strzałów ({stat.percentage.toFixed(1)}%) • xG: {stat.totalXG.toFixed(2)} • xG/strz: {(stat.totalXG / stat.count).toFixed(2)}
                            </div>
                            <div style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {stat.shots.map((shot: any, idx: number) => {
                                const time = shot.videoTimestamp !== undefined && shot.videoTimestamp !== null
                                  ? shot.videoTimestamp
                                  : shot.videoTimestampRaw;
                                if (!time) return null;
                                const minutes = Math.floor(time / 60);
                                const seconds = Math.floor(time % 60);
                                  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                const isGoal = shot.shotType === 'goal' || shot.isGoal === true;
                                const xgValue = shot.xG || 0;
                                const isSuccessful = xgValue >= kpiXGPerShot;
                                
                                return (
                                  <button
                                    key={shot.id || idx}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (youtubeVideoRef.current) {
                                        await youtubeVideoRef.current.seekTo(time);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: isSuccessful ? TEAM_STATS_GREEN : '#757575',
                                      color: 'white',
                                      border: isGoal ? `1px solid ${TEAM_STATS_RED}` : 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      position: 'relative'
                                    }}
                                    title={`${isGoal ? 'GOL • ' : ''}xG: ${xgValue.toFixed(2)} • Minuta: ${shot.minute}'`}
                                  >
                                    {timeString}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        </div>
                        )}
                      </div>
                  );
                } else if (expandedKpiForPlayers === '1t-percentage') {
                  // Oblicz potrzebne zmienne
                  const isSelectedTeamHome = selectedMatchInfo.isHome;
                  const teamIdInMatch = selectedTeam;
                  
                  // Filtruj strzały naszego zespołu
                  const teamShots = allShots.filter(shot => {
                    const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                      ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                      : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                    return shotTeamId === teamIdInMatch;
                  });
                  
                  // Filtruj strzały w strefie 1T
                  const teamShots1T = teamShots.filter(isIn1TZoneCanonical);
                  const teamShots1TCount = teamShots1T.length;
                  const kpi1TPercentage = 85;
                  
                  // Oblicz statystyki per zawodnik dla strzałów w strefie 1T
                  const playerShotsMap = new Map<string, { shots: any[]; totalXG: number; contact1Count: number }>();
                  teamShots1T.forEach((shot: any) => {
                    if (shot.playerId) {
                      if (!playerShotsMap.has(shot.playerId)) {
                        playerShotsMap.set(shot.playerId, { shots: [], totalXG: 0, contact1Count: 0 });
                      }
                      const playerData = playerShotsMap.get(shot.playerId)!;
                      playerData.shots.push(shot);
                      playerData.totalXG += shot.xG || 0;
                      if (shot.isContact1 === true) {
                        playerData.contact1Count++;
                      }
                    }
                  });
                  
                  const playerStats = Array.from(playerShotsMap.entries())
                    .map(([playerId, data]) => {
                      const player = players.find(p => p.id === playerId);
                      const contact1Percentage = data.shots.length > 0 ? (data.contact1Count / data.shots.length) * 100 : 0;
                      return {
                        playerId,
                        playerName: getPlayerLabel(playerId, playersIndex),
                        count: data.shots.length,
                        totalXG: data.totalXG,
                        contact1Count: data.contact1Count,
                        contact1Percentage,
                        percentage: teamShots1TCount > 0 ? (data.shots.length / teamShots1TCount) * 100 : 0,
                        shots: data.shots
                      };
                    })
                    .sort((a, b) => b.count - a.count);
                  
                  return (
                    <div style={{ 
                        marginTop: '0', 
                        padding: '8px', 
                        backgroundColor: 'white', 
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb',
                        width: '100%'
                      }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px'
                          }}
                          onClick={() => setIsPlayersListCollapsed(!isPlayersListCollapsed)}
                        >
                          <div style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                            Zawodnicy - 1T ({playerStats.length})
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', transform: isPlayersListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                        </div>
                        {!isPlayersListCollapsed && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {playerStats.map((stat) => (
                          <div 
                            key={stat.playerId} 
                            onClick={() => {
                              setSelectedPlayerForVideo(selectedPlayerForVideo === stat.playerId ? null : stat.playerId);
                              setSelectedKpiForVideo('1t-percentage');
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            style={{ 
                              padding: '6px 8px',
                              backgroundColor: selectedPlayerForVideo === stat.playerId ? '#eff6ff' : 'transparent',
                              borderRadius: '4px',
                              border: selectedPlayerForVideo === stat.playerId ? '1px solid #3b82f6' : 'none',
                              borderBottom: selectedPlayerForVideo !== stat.playerId ? '1px solid #f3f4f6' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: '0 0 140px', fontWeight: '500', color: '#374151' }}>
                              {stat.playerName}
                            </div>
                            <div style={{ flex: '0 0 auto', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {stat.count} strzałów ({stat.percentage.toFixed(1)}%) • {stat.contact1Percentage.toFixed(1)}% 1T • xG: {stat.totalXG.toFixed(2)}
                            </div>
                            <div style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {stat.shots.map((shot: any, idx: number) => {
                                const time = shot.videoTimestamp !== undefined && shot.videoTimestamp !== null
                                  ? shot.videoTimestamp
                                  : shot.videoTimestampRaw;
                                if (!time) return null;
                                const minutes = Math.floor(time / 60);
                                const seconds = Math.floor(time % 60);
                                  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                const isGoal = shot.shotType === 'goal' || shot.isGoal === true;
                                const isContact1 = shot.isContact1 === true;
                                
                                return (
                                  <button
                                    key={shot.id || idx}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (youtubeVideoRef.current) {
                                        await youtubeVideoRef.current.seekTo(time);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: isContact1 ? TEAM_STATS_GREEN : '#757575',
                                      color: 'white',
                                      border: isGoal ? `1px solid ${TEAM_STATS_RED}` : 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      position: 'relative'
                                    }}
                                    title={`${isGoal ? 'GOL • ' : ''}${isContact1 ? '1T • ' : ''}xG: ${(shot.xG || 0).toFixed(2)} • Minuta: ${shot.minute}'`}
                                  >
                                    {timeString}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        </div>
                        )}
                      </div>
                  );
                } else if (expandedKpiForPlayers === 'pm-area-loses') {
                  // Oblicz potrzebne zmienne
                  const allLoses = derivedLosesActions;
                  
                  // Funkcje pomocnicze do konwersji stref
                  const convertZoneToName = (zone: any): string | null => {
                    if (!zone) return null;
                    const raw = (typeof zone === 'string' || typeof zone === 'number')
                      ? zone
                      : (zone?.name ?? zone?.zone ?? null);
                    if (!raw) return null;
                    return String(raw).toUpperCase().replace(/\s+/g, '');
                  };
                  
                  const isPMArea = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                    return pmZones.includes(normalized);
                  };
                  
                  // Filtruj straty w PM Area
                  const losesInPMArea = allLoses.filter((action: any) => {
                    const zoneName = action.losesAttackZone || action.toZone || action.endZone || action.zone;
                    return isPMArea(zoneName);
                  });
                  
                  const losesInPMAreaCount = losesInPMArea.length;
                  
                  // Oblicz statystyki per zawodnik dla strat w PM Area
                  const playerLosesMap = new Map<string, { loses: any[] }>();
                  losesInPMArea.forEach((action: any) => {
                    const playerId = action.senderId || action.playerId;
                    if (playerId) {
                      if (!playerLosesMap.has(playerId)) {
                        playerLosesMap.set(playerId, { loses: [] });
                      }
                      playerLosesMap.get(playerId)!.loses.push(action);
                    }
                  });
                  
                  const playerStats = Array.from(playerLosesMap.entries())
                    .map(([playerId, data]) => {
                      const player = players.find(p => p.id === playerId);
                      return {
                        playerId,
                        playerName: getPlayerLabel(playerId, playersIndex),
                        count: data.loses.length,
                        percentage: losesInPMAreaCount > 0 ? (data.loses.length / losesInPMAreaCount) * 100 : 0,
                        loses: data.loses
                      };
                    })
                    .sort((a, b) => b.count - a.count);
                                  
                                  return (
                    <div style={{ 
                      marginTop: '0', 
                      padding: '8px', 
                      backgroundColor: 'white', 
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      width: '100%'
                    }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '6px',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '4px'
                        }}
                        onClick={() => setIsPlayersListCollapsed(!isPlayersListCollapsed)}
                      >
                        <div style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                          Zawodnicy - PM Area straty ({playerStats.length})
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', transform: isPlayersListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                      </div>
                      {!isPlayersListCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {playerStats.map((stat) => (
                          <div 
                            key={stat.playerId} 
                            onClick={() => {
                              setSelectedPlayerForVideo(selectedPlayerForVideo === stat.playerId ? null : stat.playerId);
                              setSelectedKpiForVideo('pm-area-loses');
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            style={{ 
                              padding: '6px 8px',
                              backgroundColor: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === 'pm-area-loses' ? '#eff6ff' : 'transparent',
                              borderRadius: '4px',
                              border: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === 'pm-area-loses' ? '1px solid #3b82f6' : 'none',
                              borderBottom: selectedPlayerForVideo !== stat.playerId ? '1px solid #f3f4f6' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: '0 0 140px', fontWeight: '500', color: '#374151' }}>
                              {stat.playerName}
                            </div>
                            <div style={{ flex: '0 0 auto', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {stat.count} strat ({stat.percentage.toFixed(1)}%)
                            </div>
                            <div style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {stat.loses.map((lose: any, idx: number) => {
                                const time = lose.videoTimestamp !== undefined && lose.videoTimestamp !== null
                                  ? lose.videoTimestamp
                                  : lose.videoTimestampRaw;
                                if (!time) return null;
                                const minutes = Math.floor(time / 60);
                                const seconds = Math.floor(time % 60);
                                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                
                                return (
                                  <button
                                    key={lose.id || idx}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (youtubeVideoRef.current) {
                                        await youtubeVideoRef.current.seekTo(time);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: '#757575',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '500'
                                    }}
                                    title={`Minuta: ${lose.minute}'`}
                                  >
                                    {timeString}
                                  </button>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                        </div>
                  );
                } else if (expandedKpiForPlayers === 'regains-pp') {
                  // Oblicz potrzebne zmienne
                  const isSelectedTeamHome = selectedMatchInfo.isHome;
                  const teamIdInMatch = selectedTeam;
                  
                  // Funkcja pomocnicza - używa globalnych helperów
                  const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    return isOwnHalfByZoneColumn(normalized);
                  };
                  
                  // Filtruj przechwyty na połowie przeciwnika
                  const regainsOnOpponentHalfWithTimestamp = (derivedRegainActions || [])
                    .map((action: any) => {
                      const attackZoneRaw = regainAttackZoneRawForMap(action);
                      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                      const attackZoneName = attackZoneRaw
                        ? convertZoneToName(attackZoneRaw)
                        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                      
                      if (!attackZoneName) return null;
                      const isOwn = isOwnHalf(attackZoneName);
                      
                      if (isOwn) return null;
                      
                      const timestamp = action.videoTimestampRaw ?? action.videoTimestamp ?? 0;
                      if (!timestamp || timestamp <= 0) return null;
                      
                      return { action, timestamp };
                    })
                    .filter((item: any) => item !== null)
                    .sort((a: any, b: any) => a.timestamp - b.timestamp);
                  
                  const totalRegainsOpponentHalf = regainsOnOpponentHalfWithTimestamp.length;
                  
                  // Oblicz statystyki per zawodnik dla przechwytów na połowie przeciwnika
                  const playerRegainsMap = new Map<string, { regains: any[] }>();
                  regainsOnOpponentHalfWithTimestamp.forEach((item: any) => {
                    const action = item.action;
                    const playerId = action?.senderId || action?.playerId;
                    if (action && playerId) {
                      if (!playerRegainsMap.has(playerId)) {
                        playerRegainsMap.set(playerId, { regains: [] });
                      }
                      playerRegainsMap.get(playerId)!.regains.push(action);
                    }
                  });
                  
                  const playerStats = Array.from(playerRegainsMap.entries())
                    .map(([playerId, data]) => {
                      const player = players.find(p => p.id === playerId);
                      return {
                        playerId,
                        playerName: getPlayerLabel(playerId, playersIndex),
                        count: data.regains.length,
                        percentage: totalRegainsOpponentHalf > 0 
                          ? (data.regains.length / totalRegainsOpponentHalf) * 100 
                          : 0,
                        regains: data.regains
                      };
                    })
                    .sort((a, b) => b.count - a.count);
                                  
                                  return (
                    <div style={{ 
                      marginTop: '0', 
                      padding: '8px', 
                      backgroundColor: 'white', 
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      width: '100%'
                    }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '6px',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '4px'
                        }}
                        onClick={() => setIsPlayersListCollapsed(!isPlayersListCollapsed)}
                      >
                        <div style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                          Zawodnicy - Przechwyty PP ({playerStats.length})
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', transform: isPlayersListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                      </div>
                      {!isPlayersListCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {playerStats.map((stat) => (
                          <div 
                            key={stat.playerId} 
                            onClick={() => {
                              setSelectedPlayerForVideo(selectedPlayerForVideo === stat.playerId ? null : stat.playerId);
                              setSelectedKpiForVideo('regains-pp');
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            style={{ 
                              padding: '6px 8px',
                              backgroundColor: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === 'regains-pp' ? '#eff6ff' : 'transparent',
                              borderRadius: '4px',
                              border: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === 'regains-pp' ? '1px solid #3b82f6' : 'none',
                              borderBottom: selectedPlayerForVideo !== stat.playerId ? '1px solid #f3f4f6' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: '0 0 140px', fontWeight: '500', color: '#374151' }}>
                              {stat.playerName}
                            </div>
                            <div style={{ flex: '0 0 auto', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {stat.count} przechwytów ({stat.percentage.toFixed(1)}%)
                            </div>
                            <div style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {stat.regains.map((regain: any, idx: number) => {
                                const time = regain.videoTimestamp !== undefined && regain.videoTimestamp !== null
                                  ? regain.videoTimestamp
                                  : regain.videoTimestampRaw;
                                if (!time) return null;
                                const minutes = Math.floor(time / 60);
                                const seconds = Math.floor(time % 60);
                                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                
                                return (
                                  <button
                                    key={regain.id || idx}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (youtubeVideoRef.current) {
                                        await youtubeVideoRef.current.seekTo(time);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: TEAM_STATS_GREEN,
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '500'
                                    }}
                                    title={`Minuta: ${regain.minute}'`}
                                  >
                                    {timeString}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  );
                } else if (expandedKpiForPlayers === '8s-ca') {
                  // Oblicz potrzebne zmienne
                  const isSelectedTeamHome = selectedMatchInfo.isHome;
                  const teamIdInMatch = selectedTeam;
                  
                  // Funkcja pomocnicza - używa globalnych helperów
                  const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    return isOwnHalfByZoneColumn(normalized);
                  };
                  
                  // Filtruj przechwyty na połowie przeciwnika - użyj DOKŁADNIE tej samej logiki co w głównym bloku KPI
                  const regainsOnOpponentHalfWithTimestamp = (derivedRegainActions || [])
                    .filter((action: any) => {
                      const attackZoneRaw = regainAttackZoneRawForMap(action);
                      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                      const attackZoneName = attackZoneRaw
                        ? convertZoneToName(attackZoneRaw)
                        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                      
                      if (!attackZoneName) return false;
                      const isOwn = isOwnHalf(attackZoneName);
                      // Z perspektywy ataku: strefy 7-12 to połowa przeciwnika
                      return !isOwn; // attackZone na połowie przeciwnika (7-12)
                    })
                    .filter((action: any) => {
                      const timestamp = action.videoTimestampRaw ?? action.videoTimestamp ?? 0;
                      return timestamp > 0;
                    })
                    .map((action: any) => ({
                      action,
                      timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                    }))
                    .sort((a: any, b: any) => a.timestamp - b.timestamp);
                  
                  // Filtruj strzały naszego zespołu - użyj tej samej logiki co w głównym bloku KPI
                  const teamShots = allShots.filter(shot => {
                    const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                      ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                      : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                    return shotTeamId === teamIdInMatch;
                  });
                  
                  // Przygotuj PK entries i shots w ataku z timestampami - użyj tej samej logiki co w głównym bloku KPI
                  const pkEntriesAttackWithTimestamp = (allPKEntries || [])
                    .filter((entry: any) => {
                      if (!entry) return false;
                      const teamContext = entry.teamContext ?? "attack";
                      return teamContext === "attack" || (entry.teamId && entry.teamId === teamIdInMatch);
                    })
                    .map((entry: any) => ({
                      entry,
                      timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  const shotsAttackWithTimestamp = teamShots
                    .map(shot => ({
                      shot,
                      timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
                    }))
                    .filter(item => item.timestamp > 0)
                    .sort((a, b) => a.timestamp - b.timestamp);
                  
                  // Przygotuj loses z timestampami
                  const losesWithTimestamp = derivedLosesActions
                    .map((lose: any) => ({
                      lose,
                      timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
                    }))
                    .filter((item: any) => item.timestamp > 0)
                    .sort((a: any, b: any) => a.timestamp - b.timestamp);
                  
                  // Oblicz statystyki per zawodnik dla przechwytów PP z PK/strzałem w 8s
                  const successfulRegainsIds = new Set<string>();
                  regainsOnOpponentHalfWithTimestamp.forEach((regainItem: any) => {
                    const regainTime = regainItem.timestamp;
                    const timeWindowEnd = regainTime + 8;
                    
                    const pkEntryInWindow = pkEntriesAttackWithTimestamp.find((item: any) =>
                      item.timestamp > regainTime &&
                      item.timestamp <= timeWindowEnd &&
                      isPkEntryFromRegainSequence(item.entry)
                    );
                    const shotInWindow = shotsAttackWithTimestamp.find((item: any) =>
                      item.timestamp > regainTime &&
                      item.timestamp <= timeWindowEnd &&
                      isShotFromRegainSequence(item.shot)
                    );
                    
                    let validShot = false;
                    if (shotInWindow) {
                      const hasLoseBeforeShot = losesWithTimestamp.some((loseItem: any) => 
                        loseItem.timestamp > regainTime && loseItem.timestamp < shotInWindow.timestamp
                      );
                      if (!hasLoseBeforeShot) validShot = true;
                    }

                    let validPK = false;
                    if (pkEntryInWindow) {
                      const hasLoseBeforePK = losesWithTimestamp.some((loseItem: any) => 
                        loseItem.timestamp > regainTime && loseItem.timestamp < pkEntryInWindow.timestamp
                      );
                      if (!hasLoseBeforePK) validPK = true;
                    }

                    if (validShot || validPK) {
                      successfulRegainsIds.add(regainItem.action.id);
                    }
                  });
                  
                  const playerRegainsMap = new Map<string, { regains: any[]; successful: any[] }>();
                  regainsOnOpponentHalfWithTimestamp.forEach((item: any) => {
                    const action = item.action;
                    // Użyj senderId lub playerId, tak jak w innych miejscach
                    const playerId = action?.senderId || action?.playerId;
                    if (action && playerId) {
                      if (!playerRegainsMap.has(playerId)) {
                        playerRegainsMap.set(playerId, { regains: [], successful: [] });
                      }
                      const playerData = playerRegainsMap.get(playerId)!;
                      playerData.regains.push(action);
                      if (successfulRegainsIds.has(action.id)) {
                        playerData.successful.push(action);
                      }
                    }
                  });
                  
                  // Dla "8s CA" pokazuj wszystkie przechwyty, ale tylko skuteczne będą zaznaczone na zielono
                  // Dla "Przechwyty PP" pokazuj wszystkie przechwyty (wszystkie są liczone w KPI)
                  const totalSuccessfulRegains = successfulRegainsIds.size;
                  const is8sCA = expandedKpiForPlayers === '8s-ca';
                  const playerStats = Array.from(playerRegainsMap.entries())
                    .map(([playerId, data]) => {
                      const player = players.find(p => p.id === playerId);
                      // Zawsze pokazuj wszystkie przechwyty, niezależnie od KPI
                      const regainsToShow = data.regains;
                      const countToShow = regainsToShow.length;
                      // Dla "8s CA" procent udziału liczony jest od wszystkich przechwytów, nie tylko skutecznych
                      const totalForPercentage = regainsOnOpponentHalfWithTimestamp.length;
                      return {
                        playerId,
                        playerName: getPlayerLabel(playerId, playersIndex),
                        count: countToShow,
                        successfulCount: data.successful.length,
                        percentage: totalForPercentage > 0 
                          ? (countToShow / totalForPercentage) * 100 
                          : 0,
                        successfulPercentage: data.regains.length > 0
                          ? (data.successful.length / data.regains.length) * 100
                          : 0,
                        regains: regainsToShow // Zawsze wszystkie przechwyty
                      };
                    })
                    .filter(stat => stat.count > 0) // Filtruj zawodników bez przechwytów
                    .sort((a, b) => b.successfulCount - a.successfulCount);
                                  
                                  return (
                    <div style={{ 
                      marginTop: '0', 
                      padding: '8px', 
                      backgroundColor: 'white', 
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      width: '100%'
                    }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '6px',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '4px'
                        }}
                        onClick={() => setIsPlayersListCollapsed(!isPlayersListCollapsed)}
                      >
                        <div style={{ fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                          Zawodnicy - 8s CA ({playerStats.length})
                                    </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', transform: isPlayersListCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</div>
                      </div>
                      {!isPlayersListCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {playerStats.map((stat) => (
                          <div 
                            key={stat.playerId} 
                            onClick={() => {
                              setSelectedPlayerForVideo(selectedPlayerForVideo === stat.playerId ? null : stat.playerId);
                              setSelectedKpiForVideo('8s-ca');
                            }}
                            onMouseEnter={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedPlayerForVideo !== stat.playerId) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                            style={{ 
                              padding: '6px 8px',
                              backgroundColor: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === '8s-ca' ? '#eff6ff' : 'transparent',
                              borderRadius: '4px',
                              border: selectedPlayerForVideo === stat.playerId && expandedKpiForPlayers === '8s-ca' ? '1px solid #3b82f6' : 'none',
                              borderBottom: selectedPlayerForVideo !== stat.playerId ? '1px solid #f3f4f6' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: '0 0 140px', fontWeight: '500', color: '#374151' }}>
                              {stat.playerName}
                            </div>
                            <div style={{ flex: '0 0 auto', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '11px' }}>
                              {stat.successfulCount}/{stat.count} skutecznych ({stat.successfulPercentage.toFixed(0)}%) • {stat.percentage.toFixed(1)}% udziału
                            </div>
                            <div style={{ flex: '1', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
                              {stat.regains.map((regain: any, idx: number) => {
                                const time = regain.videoTimestamp !== undefined && regain.videoTimestamp !== null
                                  ? regain.videoTimestamp
                                  : regain.videoTimestampRaw;
                                if (!time) return null;
                                const minutes = Math.floor(time / 60);
                                const seconds = Math.floor(time % 60);
                                const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                // Sprawdź czy regain jest skuteczny - używamy action.id
                                const regainActionId = regain.id || (regain.action && regain.action.id);
                                const isSuccessful = successfulRegainsIds.has(regainActionId);
                                
                                return (
                                  <button
                                    key={regain.id || regain.action?.id || idx}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (youtubeVideoRef.current) {
                                        await youtubeVideoRef.current.seekTo(time);
                                      }
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: isSuccessful ? TEAM_STATS_GREEN : '#757575',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      fontWeight: '500',
                                      flexShrink: 0
                                    }}
                                    title={`Minuta: ${regain.minute}' • ${isSuccessful ? 'Skuteczny' : 'Nieskuteczny'}`}
                                  >
                                    {timeString}
                                  </button>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                        </div>
                  );
                }
                return null;
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Legenda dla xG/strzał - nad panelem wideo */}
              {selectedKpiForVideo === 'xg-per-shot' && (
                <div style={{ 
                  marginTop: '12px',
                  marginBottom: '4px',
                  padding: '4px 8px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#6b7280',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: TEAM_STATS_GREEN, 
                      borderRadius: '3px',
                      border: 'none'
                    }}></div>
                    <span>Skuteczny (xG ≥ 0.15)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: '#757575', 
                      borderRadius: '3px',
                      border: 'none'
                    }}></div>
                    <span>Nieskuteczny</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: TEAM_STATS_GREEN, 
                      borderRadius: '3px',
                      border: `1px solid ${TEAM_STATS_RED}`
                    }}></div>
                    <span>Gol</span>
                  </div>
                </div>
              )}
              
              {/* Legenda dla 1T - nad panelem wideo */}
              {selectedKpiForVideo === '1t-percentage' && (
                <div style={{ 
                  marginTop: '12px',
                  marginBottom: '4px',
                  padding: '4px 8px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#6b7280',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: TEAM_STATS_GREEN, 
                      borderRadius: '3px',
                      border: 'none'
                    }}></div>
                    <span>1T</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: '#757575', 
                      borderRadius: '3px',
                      border: 'none'
                    }}></div>
                    <span>Nie 1T</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: TEAM_STATS_GREEN, 
                      borderRadius: '3px',
                      border: `1px solid ${TEAM_STATS_RED}`
                    }}></div>
                    <span>Gol</span>
                  </div>
                </div>
              )}
              
              {/* Legenda dla PK przeciwnika - nad panelem wideo */}
              {selectedKpiForVideo === 'pk-opponent' && (
                <div style={{ 
                  marginTop: '12px',
                  marginBottom: '4px',
                  padding: '4px 8px', 
                  backgroundColor: 'white', 
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#6b7280',
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: TEAM_STATS_RED, 
                      borderRadius: '3px',
                      border: 'none'
                    }}></div>
                    <span>Strzał</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      backgroundColor: '#757575', 
                      borderRadius: '3px',
                      border: `1px solid ${TEAM_STATS_GREEN}`
                    }}></div>
                    <span>Gol</span>
                  </div>
                </div>
              )}
              
              {/* Wideo YouTube dla wybranego meczu - osadzone na pełnej szerokości i wysokości */}
              <div 
                style={{ 
                  width: '100vw', 
                  height: '100vh',
                  marginLeft: 'calc(-50vw + 50%)',
                  marginRight: 'calc(-50vw + 50%)',
                  position: 'relative',
                  backgroundColor: '#000',
                  marginTop: (selectedKpiForVideo === 'xg-per-shot' || selectedKpiForVideo === '1t-percentage') ? '0' : '24px'
                }}
              >
                {/* Wyświetl czasy zagrań nad wideo dla wybranego KPI */}
                {selectedKpiForVideo && selectedMatchInfo && (() => {
                  // Oblicz potrzebne zmienne (takie same jak w bloku KPI)
                  const teamIdInMatch = selectedTeam;
                  const opponentIdInMatch = selectedMatchInfo.opponent;
                  const resolveShotTeamId = (shot: any): string | null => {
                    if (shot.teamId) return shot.teamId;
                    if (shot.teamContext === "attack") return teamIdInMatch;
                    if (shot.teamContext === "defense") return opponentIdInMatch;
                    return null;
                  };
                  
                  // Funkcje pomocnicze
                  const convertZoneToName = (zone: any): string | null => {
                    if (typeof zone === 'string') return zone;
                    if (zone && typeof zone === 'object') {
                      if (zone.name) return zone.name;
                      if (zone.zone) return zone.zone;
                    }
                    return null;
                  };
                  
                  const getOppositeZoneName = (zoneName: string): string | null => {
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return null;
                    return getOppositeXTValueForZone(normalized)?.zone || null;
                  };
                  
                  const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    return isOwnHalfByZoneColumn(normalized);
                  };
                  
                  const isPMArea = (zoneName: string | null | undefined): boolean => {
                    if (!zoneName) return false;
                    const normalized = convertZoneToName(zoneName);
                    if (!normalized) return false;
                    const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                    return pmZones.includes(normalized);
                  };
                  
                  const kpiXGPerShot = 0.15;
                  
                  let entriesWithTime: Array<{ item: any; time: number; isSuccessful: boolean }> = [];
                  
                  if (selectedKpiForVideo === '8s-acc') {
                    // Pobierz wszystkie zagrańia 8s ACC dla wybranego meczu
                    const all8sAccEntries = (allAcc8sEntries || []).filter((entry: any) => 
                      entry && 
                      entry.videoTimestampRaw !== undefined && 
                      entry.videoTimestampRaw !== null
                    );
                    
                    // Zidentyfikuj skuteczne zagrańia (te które spełniają KPI - mają strzał lub wejście PK w 8s)
                    const successfulEntriesIds = new Set(
                      all8sAccEntries
                        .filter((entry: any) => 
                          entry.isShotUnder8s === true || entry.isPKEntryUnder8s === true
                        )
                        .map((entry: any) => entry.id)
                    );
                    
                    entriesWithTime = all8sAccEntries
                      .map((entry: any) => ({
                        item: entry,
                        time: entry.videoTimestamp !== undefined && entry.videoTimestamp !== null 
                          ? entry.videoTimestamp 
                          : entry.videoTimestampRaw,
                        isSuccessful: successfulEntriesIds.has(entry.id)
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === 'xg-per-shot') {
                    // Wszystkie strzały naszego zespołu
                    let teamShotsFiltered = (allShots || []).filter((shot: any) => {
                      const shotTeamId = resolveShotTeamId(shot);
                      return shotTeamId === teamIdInMatch &&
                        shot && 
                        (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null ||
                         shot.videoTimestamp !== undefined && shot.videoTimestamp !== null);
                    });
                    
                    // Jeśli wybrano zawodnika, filtruj tylko jego strzały
                    if (selectedPlayerForVideo) {
                      teamShotsFiltered = teamShotsFiltered.filter((shot: any) => 
                        shot.playerId === selectedPlayerForVideo
                      );
                    }
                    
                    // Skuteczne to te z xG >= 0.15 (KPI)
                    entriesWithTime = teamShotsFiltered
                      .map((shot: any) => ({
                        item: shot,
                        time: shot.videoTimestamp !== undefined && shot.videoTimestamp !== null
                          ? shot.videoTimestamp
                          : shot.videoTimestampRaw,
                        isSuccessful: (shot.xG || 0) >= kpiXGPerShot,
                        isGoal: shot.shotType === 'goal' || shot.isGoal === true
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === '1t-percentage') {
                    // Wszystkie strzały naszego zespołu w strefie 1T
                    let teamShots1TFiltered = (allShots || []).filter((shot: any) => {
                      const shotTeamId = resolveShotTeamId(shot);
                      return shotTeamId === teamIdInMatch &&
                        isIn1TZoneCanonical(shot) &&
                        shot && 
                        (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null ||
                         shot.videoTimestamp !== undefined && shot.videoTimestamp !== null);
                    });
                    
                    // Jeśli wybrano zawodnika, filtruj tylko jego strzały
                    if (selectedPlayerForVideo) {
                      teamShots1TFiltered = teamShots1TFiltered.filter((shot: any) => 
                        shot.playerId === selectedPlayerForVideo
                      );
                    }
                    
                    const kpi1TPercentage = 85;
                    // Skuteczne to te z isContact1 === true (1T)
                    entriesWithTime = teamShots1TFiltered
                      .map((shot: any) => ({
                        item: shot,
                        time: shot.videoTimestamp !== undefined && shot.videoTimestamp !== null
                          ? shot.videoTimestamp
                          : shot.videoTimestampRaw,
                        isSuccessful: shot.isContact1 === true,
                        isGoal: shot.shotType === 'goal' || shot.isGoal === true
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === 'pk-opponent') {
                    // Wszystkie wejścia PK przeciwnika
                    const opponentPKEntriesFiltered = (allPKEntries || []).filter((entry: any) => 
                      entry && 
                      entry.teamId === selectedTeam && 
                      (entry.teamContext ?? "attack") === "defense" &&
                      (entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null ||
                       entry.videoTimestamp !== undefined && entry.videoTimestamp !== null)
                    );
                    
                    // Wszystkie są "złe" bo KPI < 11
                    entriesWithTime = opponentPKEntriesFiltered
                      .map((entry: any) => ({
                        item: entry,
                        time: entry.videoTimestamp !== undefined && entry.videoTimestamp !== null
                          ? entry.videoTimestamp
                          : entry.videoTimestampRaw,
                        isSuccessful: false, // Wszystkie są złe
                        isShot: entry.isShot === true, // Czy zakończyło się strzałem
                        isGoal: entry.isGoal === true // Czy zakończyło się golem
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === '5s') {
                    // Wszystkie straty z flagą 5s
                    const allLoses = derivedLosesActions;
                    const losesWith5sFlags = allLoses.filter((action: any) => {
                      if (action.isAut === true) return false;
                      const hasBad5s = action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true;
                      return action.isReaction5s === true || hasBad5s;
                    });
                    const reaction5sLoses = losesWith5sFlags.filter((action: any) => action.isReaction5s === true);
                    
                    const losesWith5sFiltered = losesWith5sFlags.filter((action: any) => 
                      action && 
                      (action.videoTimestampRaw !== undefined && action.videoTimestampRaw !== null ||
                       action.videoTimestamp !== undefined && action.videoTimestamp !== null)
                    );
                    
                    // Skuteczne to te z isReaction5s === true
                    const successfulLosesIds = new Set(
                      reaction5sLoses.map((action: any) => action.id)
                    );
                    
                    entriesWithTime = losesWith5sFiltered
                      .map((action: any) => ({
                        item: action,
                        time: action.videoTimestamp !== undefined && action.videoTimestamp !== null
                          ? action.videoTimestamp
                          : action.videoTimestampRaw,
                        isSuccessful: successfulLosesIds.has(action.id)
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === 'pm-area-loses') {
                    // Wszystkie straty w PM Area
                    const allLoses = derivedLosesActions;
                    let losesInPMAreaFiltered = allLoses.filter((action: any) => {
                      const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                      const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                      return isPMArea(losesZoneName) &&
                        action && 
                        (action.videoTimestampRaw !== undefined && action.videoTimestampRaw !== null ||
                         action.videoTimestamp !== undefined && action.videoTimestamp !== null);
                    });
                    
                    // Jeśli wybrano zawodnika, filtruj tylko jego straty
                    if (selectedPlayerForVideo) {
                      losesInPMAreaFiltered = losesInPMAreaFiltered.filter((action: any) => {
                        const playerId = action.senderId || action.playerId;
                        return playerId === selectedPlayerForVideo;
                      });
                    }
                    
                    // Wszystkie są "złe" bo KPI ≤ 6
                    entriesWithTime = losesInPMAreaFiltered
                      .map((action: any) => ({
                        item: action,
                        time: action.videoTimestamp !== undefined && action.videoTimestamp !== null
                          ? action.videoTimestamp
                          : action.videoTimestampRaw,
                        isSuccessful: false // Wszystkie są złe
                      }))
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === 'regains-pp') {
                    // Przechwyty na połowie przeciwnika - użyj tej samej logiki co w liście zawodników
                    const regainsOnOpponentHalfWithTimestamp = (derivedRegainActions || [])
                      .map((action: any) => {
                        const attackZoneRaw = regainAttackZoneRawForMap(action);
                        const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                        const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                        const attackZoneName = attackZoneRaw
                          ? convertZoneToName(attackZoneRaw)
                          : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                        
                        if (!attackZoneName) return null;
                        const isOwn = isOwnHalf(attackZoneName);
                        
                        if (isOwn) return null;
                        
                        const timestamp = action.videoTimestampRaw ?? action.videoTimestamp ?? 0;
                        if (!timestamp || timestamp <= 0) return null;
                        
                        return { action, timestamp };
                      })
                      .filter((item: any) => item !== null)
                      .sort((a: any, b: any) => a.timestamp - b.timestamp);
                    
                    // Jeśli wybrano zawodnika, filtruj tylko jego przechwyty
                    let filteredRegains = regainsOnOpponentHalfWithTimestamp;
                    if (selectedPlayerForVideo) {
                      filteredRegains = filteredRegains.filter((item: any) => {
                        const action = item.action;
                        const playerId = action.senderId || action.playerId;
                        return playerId === selectedPlayerForVideo;
                      });
                    }
                    
                    // Wszystkie są "dobre" bo KPI ≥ 27
                    // Użyj tej samej logiki co w liście zawodników - w liście używamy action.videoTimestamp lub action.videoTimestampRaw
                    entriesWithTime = filteredRegains
                      .map((item: any) => {
                        const action = item.action;
                        // Użyj tej samej logiki co w liście zawodników - videoTimestamp lub videoTimestampRaw
                        const time = action.videoTimestamp !== undefined && action.videoTimestamp !== null
                          ? action.videoTimestamp
                          : action.videoTimestampRaw;
                        return {
                          item: action,
                          time: time,
                          isSuccessful: true // Wszystkie są dobre
                        };
                      })
                      .filter((entry: any) => entry.time) // Filtruj tylko te z timestamp (tak jak w liście zawodników - if (!time) return null)
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === '8s-ca') {
                    // Przechwyty na połowie przeciwnika - użyj tej samej logiki co w liście zawodników
                    const regainsOnOpponentHalf = (derivedRegainActions || []).filter((action: any) => {
                      const attackZoneRaw = regainAttackZoneRawForMap(action);
                      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                      const attackZoneName = attackZoneRaw
                        ? convertZoneToName(attackZoneRaw)
                        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                      
                      if (!attackZoneName) return false;
                      const isOwn = isOwnHalf(attackZoneName);
                      return !isOwn && // attackZone na połowie przeciwnika
                        action && 
                        (action.videoTimestampRaw !== undefined && action.videoTimestampRaw !== null ||
                         action.videoTimestamp !== undefined && action.videoTimestamp !== null);
                    });
                    
                    // Przygotuj regainsOnOpponentHalfWithTimestamp - użyj tej samej struktury co w liście zawodników
                    // W liście zawodników używamy action.videoTimestampRaw ?? action.videoTimestamp ?? 0
                    let regainsOnOpponentHalfWithTimestamp = regainsOnOpponentHalf
                      .map((action: any) => ({
                        action,
                        timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                      }))
                      .filter((item: any) => item.timestamp > 0)
                      .sort((a: any, b: any) => a.timestamp - b.timestamp);
                    
                    // Jeśli wybrano zawodnika, filtruj tylko jego przechwyty
                    if (selectedPlayerForVideo) {
                      regainsOnOpponentHalfWithTimestamp = regainsOnOpponentHalfWithTimestamp.filter((item: any) => {
                        const action = item.action;
                        const playerId = action.senderId || action.playerId;
                        return playerId === selectedPlayerForVideo;
                      });
                    }
                    
                    // Przygotuj PK entries i shots w ataku z timestampami
                    const pkEntriesAttackWithTimestamp = (allPKEntries || [])
                      .filter((entry: any) => {
                        if (!entry) return false;
                        const teamContext = entry.teamContext ?? "attack";
                        return teamContext === "attack" || (entry.teamId && entry.teamId === teamIdInMatch);
                      })
                      .map((entry: any) => ({
                        entry,
                        timestamp: entry.videoTimestampRaw ?? entry.videoTimestamp ?? 0,
                      }))
                      .filter(item => item.timestamp > 0)
                      .sort((a, b) => a.timestamp - b.timestamp);
                    
                    const teamShotsForCA = (allShots || []).filter((shot: any) => {
                      const shotTeamId = resolveShotTeamId(shot);
                      return shotTeamId === teamIdInMatch;
                    });
                    
                    const shotsAttackWithTimestamp = teamShotsForCA
                      .map((shot: any) => ({
                        shot,
                        timestamp: shot.videoTimestampRaw ?? shot.videoTimestamp ?? 0,
                      }))
                      .filter(item => item.timestamp > 0)
                      .sort((a, b) => a.timestamp - b.timestamp);
                    
                    // Przygotuj loses z timestampami
                    const losesWithTimestamp = (derivedLosesActions || [])
                      .map((lose: any) => ({
                        lose,
                        timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
                      }))
                      .filter(item => item.timestamp > 0)
                      .sort((a, b) => a.timestamp - b.timestamp);
                    
                    // Sprawdź które przechwyty mają PK lub strzał w 8s - użyj tej samej logiki co w liście zawodników
                    const successfulRegainsIds = new Set<string>();
                    regainsOnOpponentHalfWithTimestamp.forEach((regainItem: any) => {
                      const regainTime = regainItem.timestamp;
                      const timeWindowEnd = regainTime + 8;
                      
                      // Sprawdź czy jest PK entry lub shot w oknie 8s
                      const pkEntryInWindow = pkEntriesAttackWithTimestamp.find((item: any) =>
                        item.timestamp > regainTime &&
                        item.timestamp <= timeWindowEnd &&
                        isPkEntryFromRegainSequence(item.entry)
                      );
                      const shotInWindow = shotsAttackWithTimestamp.find((item: any) =>
                        item.timestamp > regainTime &&
                        item.timestamp <= timeWindowEnd &&
                        isShotFromRegainSequence(item.shot)
                      );
                      
                      let validShot = false;
                      if (shotInWindow) {
                        const hasLoseBeforeShot = losesWithTimestamp.some((loseItem: any) => 
                          loseItem.timestamp > regainTime && loseItem.timestamp < shotInWindow.timestamp
                        );
                        if (!hasLoseBeforeShot) validShot = true;
                      }

                      let validPK = false;
                      if (pkEntryInWindow) {
                        const hasLoseBeforePK = losesWithTimestamp.some((loseItem: any) => 
                          loseItem.timestamp > regainTime && loseItem.timestamp < pkEntryInWindow.timestamp
                        );
                        if (!hasLoseBeforePK) validPK = true;
                      }

                      if (validShot || validPK) {
                        successfulRegainsIds.add(regainItem.action.id);
                      }
                    });
                    
                    // Użyj tej samej logiki co w liście zawodników - videoTimestamp lub videoTimestampRaw
                    // W liście zawodników: regain.videoTimestamp !== undefined && regain.videoTimestamp !== null ? regain.videoTimestamp : regain.videoTimestampRaw
                    // Jeśli time jest falsy (0, null, undefined), to w liście zawodników używamy if (!time) return null
                    entriesWithTime = regainsOnOpponentHalfWithTimestamp
                      .map((item: any) => {
                        const action = item.action;
                        // Użyj tej samej logiki co w liście zawodników - videoTimestamp lub videoTimestampRaw
                        let time = action.videoTimestamp !== undefined && action.videoTimestamp !== null
                          ? action.videoTimestamp
                          : action.videoTimestampRaw;
                        // Jeśli time jest falsy, użyj timestamp z item jako fallback (który jest obliczony jako action.videoTimestampRaw ?? action.videoTimestamp ?? 0)
                        if (!time) {
                          time = item.timestamp;
                        }
                        return {
                          item: action,
                          time: time,
                          isSuccessful: successfulRegainsIds.has(action.id)
                        };
                      })
                      .filter((entry: any) => entry.time) // Filtruj tylko te z timestamp (tak jak w liście zawodników - if (!time) return null)
                      .sort((a, b) => a.time - b.time);
                  } else if (selectedKpiForVideo === 'p2p3-passes') {
                    // Podania naszego zespołu kończące się w P2 lub P3
                    let p2p3PassesWithTime = (allActions || []).filter((action: any) => {
                      const isOwnAction = !action.teamId || action.teamId === selectedTeam;
                      return isOwnAction &&
                        action.actionType === 'pass' &&
                        (action.isP2 === true || action.isP3 === true) &&
                        (
                          (action.videoTimestampRaw !== undefined && action.videoTimestampRaw !== null) ||
                          (action.videoTimestamp !== undefined && action.videoTimestamp !== null)
                        );
                    });

                    if (selectedPlayerForVideo) {
                      p2p3PassesWithTime = p2p3PassesWithTime.filter((action: any) => action.senderId === selectedPlayerForVideo);
                    }

                    entriesWithTime = p2p3PassesWithTime
                      .map((action: any) => ({
                        item: action,
                        time: action.videoTimestamp !== undefined && action.videoTimestamp !== null
                          ? action.videoTimestamp
                          : action.videoTimestampRaw,
                        isSuccessful: true
                      }))
                      .sort((a, b) => a.time - b.time);
                  }
                  
                  return entriesWithTime.length > 0 ? (
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      left: '0',
                      right: '0',
                      zIndex: 1000,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      maxHeight: '60px',
                      overflowY: 'auto',
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      padding: '6px 8px',
                      borderRadius: '0 0 6px 6px',
                      borderBottom: '2px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {entriesWithTime.map((item, index) => {
                        const minutes = Math.floor(item.time / 60);
                        const seconds = Math.floor(item.time % 60);
                        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                        const isGoal = item.isGoal === true;
                        const isShot = item.isShot === true;
                        const isXGPerShot = selectedKpiForVideo === 'xg-per-shot';
                        const is1TPercentage = selectedKpiForVideo === '1t-percentage';
                        const isPKOpponent = selectedKpiForVideo === 'pk-opponent';

                        // Określ kolor tła i ramki
                        let backgroundColor = item.isSuccessful ? TEAM_STATS_GREEN : '#757575';
                        let borderStyle = 'none';
                        
                        if (isPKOpponent) {
                          // Dla PK przeciwnika: czerwony dla strzałów, zielony border dla goli
                          if (isShot) {
                            backgroundColor = TEAM_STATS_RED;
                          }
                          if (isGoal) {
                            borderStyle = `1px solid ${TEAM_STATS_GREEN}`;
                          }
                        } else if ((isXGPerShot || is1TPercentage) && isGoal) {
                          // Dla xG/strzał i 1T: zielony border dla goli
                          borderStyle = `1px solid ${TEAM_STATS_RED}`;
                        }

                          return (
                          <button
                            key={item.item.id || index}
                            onClick={async () => {
                              if (youtubeVideoRef.current) {
                                await youtubeVideoRef.current.seekTo(item.time);
                              }
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: backgroundColor,
                              color: 'white',
                              border: borderStyle,
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              lineHeight: '1.2'
                            }}
                            onMouseEnter={(e) => {
                              if (isPKOpponent && isShot) {
                                e.currentTarget.style.backgroundColor = TEAM_STATS_RED;
                              } else {
                                e.currentTarget.style.backgroundColor = item.isSuccessful ? TEAM_STATS_GREEN : '#9e9e9e';
                              }
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (isPKOpponent && isShot) {
                                e.currentTarget.style.backgroundColor = TEAM_STATS_RED;
                              } else {
                                e.currentTarget.style.backgroundColor = item.isSuccessful ? TEAM_STATS_GREEN : '#757575';
                              }
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {timeString}
                          </button>
                        );
                      })}
                      </div>
                  ) : null;
                })()}
                
                <YouTubeVideo 
                  ref={youtubeVideoRef}
                  matchInfo={selectedMatchInfo}
                  isVisible={true}
                  isFullscreen={true}
                />
              </div>
              </div>
              </Fragment>
            )}
            {expandedCategory === 'pkEntries' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>Wejścia w PK</h3>

                {/* Przełącznik atak/obrona (atak = nasze wejścia, obrona = wejścia przeciwnika) */}
                <div className={styles.heatmapModeToggle}>
                  <button
                    className={`${styles.heatmapModeButton} ${pkSide === 'attack' ? styles.active : ''}`}
                    onClick={() => setPkSide('attack')}
                    type="button"
                  >
                    W ataku
                  </button>
                  <button
                    className={`${styles.heatmapModeButton} ${pkSide === 'defense' ? styles.active : ''}`}
                    onClick={() => setPkSide('defense')}
                    type="button"
                  >
                    W obronie
                  </button>
                </div>

                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>WEJŚCIA W PK:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}><strong>{pkEntriesSideStats.total}</strong></span>
                      <span className={styles.valueSecondary}>({pkEntriesSideStats.total.toFixed(1)} / 90 min)</span>
                    </span>
                  </div>
                  {selectedMatchInfo?.matchData?.possession && (() => {
                    const pos = selectedMatchInfo.matchData!.possession!;
                    const isOurTeamHome = selectedMatchInfo.team === selectedTeam;
                    const ourPossessionMin = (isOurTeamHome ? (pos.teamFirstHalf ?? 0) + (pos.teamSecondHalf ?? 0) : (pos.opponentFirstHalf ?? 0) + (pos.opponentSecondHalf ?? 0));
                    const pkPerMinPossession = ourPossessionMin > 0 ? (pkEntriesSideStats.total / ourPossessionMin) : null;
                    return pkPerMinPossession !== null ? (
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>WEJŚCIA W PK/MIN POSIADANIA ({teamsObject[selectedTeam]?.name ?? selectedTeam}):</span>
                        <span className={styles.detailsValue}>
                          <span className={styles.valueMain}>{pkPerMinPossession.toFixed(2)}</span>
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>GOLE:</span>
                    <span className={styles.detailsValue}><span className={styles.valueMain}>{pkEntriesSideStats.goals}</span></span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>STRZAŁY:</span>
                    <span className={styles.detailsValue}><span className={styles.valueMain}>{pkEntriesSideStats.shots}</span></span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>WEJŚCIA PO PRZECHWYCIE:</span>
                    <span className={styles.detailsValue} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={styles.valueMain}>{pkEntriesSideStats.regains}</span>
                      <span className={styles.valueSecondary}>({pkEntriesSideStats.regainPct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZEWAGA W PK:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>
                        {(pkEntriesSideStats.avgPartners - pkEntriesSideStats.avgOpponents).toFixed(2)}
                      </span>
                      <span className={styles.valueSecondary}>
                        {" "}• Partnerzy: {pkEntriesSideStats.avgPartners.toFixed(2)} • Przeciwnicy: {pkEntriesSideStats.avgOpponents.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <div className={styles.heatmapModeToggle} style={{ flexWrap: 'wrap' }}>
                    <button
                      className={`${styles.heatmapModeButton} ${pkEntryTypeFilter === 'all' ? styles.active : ''}`}
                      onClick={() => setPkEntryTypeFilter('all')}
                    >
                      Wszystkie
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${pkEntryTypeFilter === 'dribble' ? styles.active : ''}`}
                      onClick={() => setPkEntryTypeFilter('dribble')}
                    >
                      Drybling
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${pkEntryTypeFilter === 'pass' ? styles.active : ''}`}
                      onClick={() => setPkEntryTypeFilter('pass')}
                    >
                      Podanie
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${pkEntryTypeFilter === 'sfg' ? styles.active : ''}`}
                      onClick={() => setPkEntryTypeFilter('sfg')}
                    >
                      SFG
                    </button>
                  </div>

                  <div className={styles.heatmapModeToggle} style={{ marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      className={`${styles.heatmapModeButton} ${pkOnlyRegain ? styles.active : ''}`}
                      onClick={() => setPkOnlyRegain(!pkOnlyRegain)}
                    >
                      Przechwyt
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${pkOnlyShot ? styles.active : ''}`}
                      onClick={() => setPkOnlyShot(!pkOnlyShot)}
                    >
                      Strzał
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${pkOnlyGoal ? styles.active : ''}`}
                      onClick={() => setPkOnlyGoal(!pkOnlyGoal)}
                    >
                      Gol
                    </button>
                  </div>
                </div>

                <div className={styles.detailsSection}>
                  <div className={styles.matchChartContainer}>
                    <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                      Kliknij w strzałkę na boisku, aby zobaczyć szczegóły.
                    </div>
                    <PKEntriesPitch
                      pkEntries={pkEntriesFilteredForView}
                      playersIndex={playersIndex}
                      onEntryClick={(entry) => setSelectedPKEntryIdForView(entry.id)}
                      selectedEntryId={selectedPKEntryIdForView}
                      matchInfo={selectedMatchInfo}
                      allTeams={availableTeams}
                      hideTeamLogos={false}
                      hideFlipButton={false}
                      hideInstructions={true}
                    />
                    {/* Legenda mapy wejść w PK */}
                    <div className={styles.pkMapLegend} role="img" aria-label="Legenda wejść w pole karne">
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendLine} style={{ background: TEAM_STATS_RED }} />
                        <span>Podanie</span>
                      </span>
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendLine} style={{ background: '#1e40af' }} />
                        <span>Drybling</span>
                      </span>
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendLine} style={{ background: TEAM_STATS_GREEN }} />
                        <span>SFG</span>
                      </span>
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendDot} style={{ background: '#86efac', border: '1px solid #fff', boxSizing: 'border-box' }} />
                        <span>Gol</span>
                      </span>
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendDot} style={{ background: '#111827', border: '1px solid #fff', boxSizing: 'border-box' }} />
                        <span>Strzał</span>
                      </span>
                      <span className={styles.pkMapLegendItem}>
                        <span className={styles.pkMapLegendDot} style={{ background: 'white', border: '1.5px solid #f59e0b', boxSizing: 'border-box' }} />
                        <span>Regain (kropka)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {selectedPKEntry && (
                  <div className={styles.detailsSection}>
                    <div className={styles.detailsRow}>
                      <span className={styles.detailsLabel}>MINUTA:</span>
                      <span className={styles.detailsValue}><span className={styles.valueMain}>{selectedPKEntry.minute}</span></span>
                    </div>
                    <div className={styles.detailsRow}>
                      <span className={styles.detailsLabel}>TYP:</span>
                      <span className={styles.detailsValue}><span className={styles.valueMain}>{(selectedPKEntry.entryType || 'pass').toUpperCase()}</span></span>
                    </div>
                    <div className={styles.detailsRow}>
                      <span className={styles.detailsLabel}>FLGI:</span>
                      <span className={styles.detailsValue}>
                        <span className={styles.valueMain}>
                          {(selectedPKEntry.isRegain ? 'Przechwyt ' : '')}
                          {(selectedPKEntry.isShot ? 'Strzał ' : '')}
                          {(selectedPKEntry.isGoal ? 'Gol' : '')}
                        </span>
                      </span>
                    </div>
                    {(selectedPKEntry.senderId || selectedPKEntry.receiverId) && (
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>ZAWODNICY:</span>
                        <span className={styles.detailsValue}>
                          <span className={styles.valueMain}>
                            {getPlayerLabel(selectedPKEntry.senderId, playersIndex)}
                            {selectedPKEntry.receiverId ? ` → ${getPlayerLabel(selectedPKEntry.receiverId, playersIndex)}` : ''}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Wykres wejść w PK co 5 minut */}
                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Wejścia w PK co 5 minut</h3>
                    <span className={styles.chartInfo}>
                      Zespół vs Przeciwnik
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pkEntriesTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="minute" label={{ value: 'Przedział minutowy', position: 'insideBottom', offset: -5 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        content={({ payload, label }) => {
                          if (!payload || payload.length === 0) return null;
                          const data = payload[0]?.payload || {};
                          return (
                            <div className={styles.tooltip}>
                              <p className={styles.tooltipLabel}>{`Przedział: ${label} min`}</p>
                              <p><strong>Zespół:</strong> {data.team}</p>
                              <p><strong>Przeciwnik:</strong> {data.opponent}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="team" name="Zespół" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="opponent" name="Przeciwnik" fill={TEAM_STATS_RED} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {expandedCategory === 'regains' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                {/* Przełącznik połowy boiska */}
                <div className={styles.detailsSection}>
                  <div className={styles.heatmapModeToggle}>
                    <button
                      className={`${styles.heatmapModeButton} ${regainHalfFilter === 'all' ? styles.active : ''}`}
                      onClick={() => setRegainHalfFilter('all')}
                      type="button"
                    >
                      Całe boisko
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${regainHalfFilter === 'own' ? styles.active : ''}`}
                      onClick={() => setRegainHalfFilter('own')}
                      type="button"
                    >
                      Własna połowa
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${regainHalfFilter === 'opponent' ? styles.active : ''}`}
                      onClick={() => setRegainHalfFilter('opponent')}
                      type="button"
                    >
                      Połowa przeciwnika
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${regainHalfFilter === 'pm' ? styles.active : ''}`}
                      onClick={() => setRegainHalfFilter('pm')}
                      type="button"
                    >
                      PM Area
                    </button>
                  </div>
                </div>

                {/* Filtr z kafelkami P0-P3 */}
                <div className={styles.detailsSection}>
                  <div className={styles.countItemsWrapper}>
                    {(['p0', 'p1', 'p2', 'p3'] as const).map((pValue) => {
                      const isActive = isFilterActive(pValue);
                      // Używamy wartości "all" (wszystkie przechwyty) do wyświetlania w kafelkach
                      const count = pValue === 'p0' ? teamRegainStats.allRegainP0Count :
                                   pValue === 'p1' ? teamRegainStats.allRegainP1Count :
                                   pValue === 'p2' ? teamRegainStats.allRegainP2Count :
                                   teamRegainStats.allRegainP3Count;
                      const lateralCount = pValue === 'p0' ? teamRegainStats.allRegainP0CountLateral :
                                          pValue === 'p1' ? teamRegainStats.allRegainP1CountLateral :
                                          pValue === 'p2' ? teamRegainStats.allRegainP2CountLateral :
                                          teamRegainStats.allRegainP3CountLateral;
                      const centralCount = pValue === 'p0' ? teamRegainStats.allRegainP0CountCentral :
                                          pValue === 'p1' ? teamRegainStats.allRegainP1CountCentral :
                                          pValue === 'p2' ? teamRegainStats.allRegainP2CountCentral :
                                          teamRegainStats.allRegainP3CountCentral;
                      
                      return (
                        <div
                          key={pValue}
                          className={`${styles.countItem} ${isActive ? styles.countItemSelected : ''} ${count === 0 ? styles.countItemDisabled : ''}`}
                          onClick={() => {
                            if (count === 0) return;
                            setSelectedActionFilter(prev => {
                              const filters = Array.isArray(prev) ? prev : [];
                              const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                              if (filters.includes(pValue)) {
                                return withoutEndFilters;
                              }
                              return [...withoutEndFilters, pValue];
                            });
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <span className={styles.countLabel}>{pValue.toUpperCase()}:</span>
                            <span className={styles.countValue}>{count}</span>
                          </div>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{lateralCount}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{centralCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Podstawowe statystyki */}
                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYTY:</span>
                    <span className={styles.detailsValue}>
                      {(() => {
                        const regainsCount = teamRegainStats.visibleRegainsCount ?? teamRegainStats.totalRegains;
                        const noP = teamRegainStats.allRegainNoPCount ?? 0;
                        const totalMinutes = teamStats.totalMinutes || 90;
                        const regainsPer90 = totalMinutes > 0 ? (regainsCount * 90) / totalMinutes : 0;
                        return (
                          <>
                            <span className={styles.valueMain}>{regainsCount}</span>
                            {regainsCount > 0 && (
                              <span className={styles.valueSecondary}>/{regainsCount} (100.0%)</span>
                            )}
                            <span className={styles.valueSecondary}> • ({regainsPer90.toFixed(1)} / 90)</span>
                            {noP > 0 && (
                              <span className={styles.valueSecondary}> • bez P0–P3: {noP}</span>
                            )}
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYTY/MIN POSIADANIA PRZECIWNIKA:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>
                        {aggregatedPossession && aggregatedPossession.opponentMin > 0
                          ? ((teamRegainStats.visibleRegainsCount ?? teamRegainStats.totalRegains) / aggregatedPossession.opponentMin).toFixed(2)
                          : "brak danych"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W OBRONIE/MIN POSIADANIA PRZECIWNIKA:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>
                        {aggregatedPossession && aggregatedPossession.opponentMin > 0
                          ? (teamRegainStats.regainXTInDefense / aggregatedPossession.opponentMin).toFixed(3)
                          : "brak danych"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYTY NA POŁOWIE PRZECIWNIKA:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamRegainStats.visibleRegainsOpponentHalf}</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W ATAKU:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamRegainStats.regainXTInAttack.toFixed(3)}</span>
                      {teamRegainStats.regainAttackCount > 0 && (
                        <span className={styles.valueSecondary}>• {teamRegainStats.regainXTInAttackPerAction.toFixed(3)} / akcję</span>
                      )}
                      {totalRegainsXT.totalXTInAttack > 0 && (
                        <span className={styles.valueSecondary}> • {((teamRegainStats.regainXTInAttack / totalRegainsXT.totalXTInAttack) * 100).toFixed(1)}% z xT</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W OBRONIE:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamRegainStats.regainXTInDefense.toFixed(3)}</span>
                      {teamRegainStats.regainDefenseCount > 0 && (
                        <span className={styles.valueSecondary}>• {teamRegainStats.regainXTInDefensePerAction.toFixed(3)} / akcję</span>
                      )}
                      {totalRegainsXT.totalXTInDefense > 0 && (
                        <span className={styles.valueSecondary}> • {((teamRegainStats.regainXTInDefense / totalRegainsXT.totalXTInDefense) * 100).toFixed(1)}% z xT</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Konsekwencje Przechwytów */}
                <div className={styles.detailsSection}>
                  <h4>Konsekwencje Przechwytów</h4>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>8s od przechwytu:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{regainAfterStats.totalXG8s.toFixed(2)}</span>
                      <span className={styles.valueSecondary}> xG ({regainAfterStats.totalShots8s}) • </span>
                      <span className={styles.valueMain}>{regainAfterStats.totalPKEntries8s}</span>
                      <span className={styles.valueSecondary}> PK • </span>
                      <span className={styles.valueMain}>{regainAfterStats.totalPXT8s.toFixed(3)}</span>
                      <span className={styles.valueSecondary}> <span className={styles.preserveCase}>PxT</span> ({regainAfterStats.totalPasses8s})</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Counterpressing 5s przeciwnika:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{regainAfterStats.totalLosesAfterRegain5s || 0}</span>
                      <span className={styles.valueSecondary}> ({(regainAfterStats.losesAfterRegain5sPct || 0).toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>15s od przechwytu:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{regainAfterStats.totalXG15s.toFixed(2)}</span>
                      <span className={styles.valueSecondary}> xG ({regainAfterStats.totalShots15s}) • </span>
                      <span className={styles.valueMain}>{regainAfterStats.totalPKEntries15s}</span>
                      <span className={styles.valueSecondary}> PK • </span>
                      <span className={styles.valueMain}>{regainAfterStats.totalPXT15s.toFixed(3)}</span>
                      <span className={styles.valueSecondary}> <span className={styles.preserveCase}>PxT</span> ({regainAfterStats.totalPasses15s})</span>
                    </span>
                  </div>
                </div>

                {/* Heatmapa */}
                <div className={styles.detailsSection}>
                  <div className={styles.heatmapHeaderInPanel}>
                    <h4>Heatmapa przechwytów</h4>
                    <div className={styles.heatmapControlsInPanel}>
                      {/* Przełącznik atak/obrona */}
                      <div className={styles.heatmapModeToggle}>
                        <button
                          className={`${styles.heatmapModeButton} ${teamRegainAttackDefenseMode === 'defense' ? styles.active : ''}`}
                          onClick={() => setTeamRegainAttackDefenseMode('defense')}
                          type="button"
                        >
                          W obronie
                        </button>
                        <button
                          className={`${styles.heatmapModeButton} ${teamRegainAttackDefenseMode === 'attack' ? styles.active : ''}`}
                          onClick={() => setTeamRegainAttackDefenseMode('attack')}
                          type="button"
                        >
                          W ataku
                        </button>
                      </div>
                      <div className={styles.heatmapModeToggle}>
                        <button
                          className={`${styles.heatmapModeButton} ${teamRegainHeatmapMode === 'xt' ? styles.active : ''}`}
                          onClick={() => setTeamRegainHeatmapMode('xt')}
                          type="button"
                        >
                          xT odbiorców
                        </button>
                        <button
                          className={`${styles.heatmapModeButton} ${teamRegainHeatmapMode === 'count' ? styles.active : ''}`}
                          onClick={() => setTeamRegainHeatmapMode('count')}
                          type="button"
                        >
                          Liczba akcji
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.heatmapWrapperInPanel}>
                    <div className={styles.heatmapContainerInPanel}>
                      <PlayerHeatmapPitch
                        heatmapData={teamRegainHeatmap}
                        category="regains"
                        mode={teamRegainHeatmapMode === 'xt' ? 'pxt' : 'count'}
                        mirrored={false}
                        selectedZone={selectedRegainZone}
                        onZoneClick={(zoneName) => {
                          const normalizedZone = typeof zoneName === 'string' 
                            ? zoneName.toUpperCase().replace(/\s+/g, '') 
                            : String(zoneName).toUpperCase().replace(/\s+/g, '');
                          
                          if (!normalizedZone) {
                            setRegainZoneDetails(null);
                            setSelectedRegainZone(null);
                            return;
                          }

                          // Zawsze używaj regainAttackZone do filtrowania (pola z ataku)
                          // Używamy przefiltrowanych akcji z teamRegainStats
                          const filteredRegainActionsForHeatmap = regainHalfFilter === "all"
                            ? derivedRegainActions
                            : regainHalfFilter === "pm"
                            ? derivedRegainActions.filter(action => {
                                const attackZoneRaw = regainAttackZoneRawForMap(action);
                                const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                                const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                                return attackZoneName && pmZones.includes(attackZoneName);
                              })
                            : derivedRegainActions.filter(action => {
                                const attackZoneRaw = regainAttackZoneRawForMap(action);
                                const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                                if (!attackZoneName) return false;
                                const isOwn = isOwnHalf(attackZoneName);
                                return regainHalfFilter === "own" ? isOwn : !isOwn;
                              });
                          
                          let zoneActions = filteredRegainActionsForHeatmap.filter(action => {
                            const attackZoneRaw = regainAttackZoneRawForMap(action);
                            const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                            return attackZoneName?.toUpperCase().replace(/\s+/g, '') === normalizedZone;
                          });
                          
                          // Filtruj według selectedActionFilter (P0-P3)
                          if (selectedActionFilter && selectedActionFilter.length > 0) {
                            zoneActions = zoneActions.filter(action => matchesSelectedActionFilter(action));
                          }

                          const playersMap = new Map<string, { 
                            regainXT: number; 
                            regains: number;
                            actions: Array<{
                              minute: number;
                              zone: string;
                              isBelow8s?: boolean;
                              xT: number;
                            }>;
                          }>();
                          let totalXT = 0;
                          let totalRegains = 0;

                          zoneActions.forEach(action => {
                            const playerId = action.senderId;
                            if (!playerId) return;

                            // Wartość xT zależy od trybu, ale zawsze używamy regainAttackZone dla strefy
                            const actionXT = teamRegainAttackDefenseMode === 'attack'
                              ? (action.regainAttackXT ?? 0)
                              : (action.regainDefenseXT ?? 0);

                            // Zawsze używaj regainAttackZone dla strefy
                            const actionZone = action.regainAttackZone ? convertZoneToName(action.regainAttackZone) : null;

                            totalXT += actionXT;
                            totalRegains += 1;

                            if (!playersMap.has(playerId)) {
                              playersMap.set(playerId, { 
                                regainXT: 0, 
                                regains: 0,
                                actions: []
                              });
                            }

                            const stats = playersMap.get(playerId)!;
                            stats.regainXT += actionXT;
                            stats.regains += 1;
                            
                            // Dodaj szczegóły akcji
                            stats.actions.push({
                              minute: action.minute ?? 0,
                              zone: actionZone || normalizedZone,
                              isBelow8s: action.isBelow8s,
                              xT: actionXT,
                            });
                          });

                          const playersList = Array.from(playersMap.entries())
                            .map(([playerId, stats]) => {
                              const player = players.find(p => p.id === playerId);
                              return {
                                playerId,
                                playerName: getPlayerLabel(playerId, playersIndex),
                                regainXT: stats.regainXT,
                                regains: stats.regains,
                                actions: stats.actions.sort((a, b) => a.minute - b.minute),
                              };
                            })
                            .sort((a, b) => b.regainXT - a.regainXT);

                          setRegainZoneDetails({
                            zoneName: normalizedZone,
                            totalXT,
                            totalRegains,
                            players: playersList,
                          });
                          setSelectedRegainZone(normalizedZone);
                        }}
                      />
                    </div>
                    <div className={styles.zoneDetailsPanel}>
                      {regainZoneDetails ? (
                        <>
                          <div className={styles.zoneDetailsHeader}>
                            <h4>Strefa {regainZoneDetails.zoneName}</h4>
                            <button
                              onClick={() => {
                                setRegainZoneDetails(null);
                                setSelectedRegainZone(null);
                              }}
                              className={styles.zoneDetailsClose}
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.zoneDetailsBody}>
                            <p className={styles.zoneDetailsSubtitle}>
                              Zawodnicy, którzy wykonali przechwyt w tej strefie:
                            </p>
                            <div className={styles.zonePlayerStats} style={{ marginBottom: '12px' }}>
                              <div className={styles.zonePlayerStat}>
                                <span className={styles.zoneLabel}>xT:</span>
                                <span className={styles.zoneValue}>{regainZoneDetails.totalXT.toFixed(2)}</span>
                              </div>
                              <div className={styles.zonePlayerStat}>
                                <span className={styles.zoneLabel}>Przechwyty:</span>
                                <span className={styles.zoneValue}>{regainZoneDetails.totalRegains}</span>
                              </div>
                            </div>
                            <div className={styles.zonePlayersList}>
                              {regainZoneDetails.players.length > 0 ? regainZoneDetails.players.map((player) => (
                                <div key={player.playerId} className={styles.zonePlayerItem}>
                                  <div className={styles.zonePlayerName}>{getPlayerLabel(player.playerId, playersIndex)}</div>
                                  <div className={styles.zonePlayerStats}>
                                    <div className={styles.zonePlayerStat}>
                                      <span className={styles.zoneLabel}>xT:</span>
                                      <span className={styles.zoneValue}>{player.regainXT.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.zonePlayerStat}>
                                      <span className={styles.zoneLabel}>Przechwyty:</span>
                                      <span className={styles.zoneValue}>{player.regains}</span>
                                    </div>
                                  </div>
                                  {/* Szczegóły akcji */}
                                  {player.actions && player.actions.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                                      {player.actions.map((action, idx) => (
                                        <div key={idx} style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span><strong>Min:</strong> {action.minute}</span>
                                            <span><strong>Strefa:</strong> {action.zone}</span>
                                            <span><strong>xT:</strong> {action.xT.toFixed(2)}</span>
                                            {action.isBelow8s === true && (
                                              <span style={{ color: TEAM_STATS_GREEN, fontWeight: '600' }}>Reakcja 5s</span>
                                            )}
                                            {action.isBelow8s !== true && (
                                              <span style={{ color: '#6b7280' }}>—</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    className={styles.viewActionsButton}
                                    onClick={() => {
                                      setSelectedPlayerForModal({
                                        playerId: player.playerId,
                                        playerName: getPlayerLabel(player.playerId, playersIndex),
                                        zoneName: regainZoneDetails.zoneName
                                      });
                                      setActionsModalOpen(true);
                                    }}
                                    title="Zobacz szczegóły akcji"
                                    style={{ marginTop: '8px' }}
                                  >
                                    Zobacz akcje
                                  </button>
                                </div>
                              )) : (
                                <div className={styles.zoneDetailsPlaceholder}>
                                  Brak danych zawodników dla tej strefy.
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className={styles.zoneDetailsPlaceholder}>
                          Kliknij na kafelek, aby zobaczyć szczegóły
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Wiersz TRYB */}
                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>TRYB:</span>
                    <span className={styles.detailsValue}>
                      {teamRegainStats.regainAttackCount}W ataku ({teamRegainStats.attackPct.toFixed(1)}%) • {teamRegainStats.regainDefenseCount}W obronie ({teamRegainStats.defensePct.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Przechwyty: liczba i <span className={styles.preserveCase}>xT</span> co 5 minut</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={regainsTimelineXT} margin={{ top: 10, right: 20, left: 0, bottom: 10 }} barGap={0} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                      <XAxis dataKey="minute" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} />
                      <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const data = payload[0].payload;
                          return (
                            <div className={styles.tooltip}>
                              <p className={styles.tooltipLabel}>{`Przedział: ${data.minute} min`}</p>
                              <p style={{ color: '#3b82f6' }}>Przechwyty: {data.regains}</p>
                              <p style={{ color: TEAM_STATS_RED }}>xT w ataku: {data.xtAttack?.toFixed(3)}</p>
                              <p style={{ color: '#6b7280' }}>xT w obronie: {data.xtDefense?.toFixed(3)}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="regains" name="Przechwyty" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtAttack" name="xT w ataku" fill={TEAM_STATS_RED} radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtDefense" name="xT w obronie" fill="#6b7280" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Wykres na dole - jak w oryginalnej wersji */}
                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Przechwyty i straty co 5 minut</h3>
                    <span className={styles.chartInfo}>
                      {teamStats.totalRegains} przechwytów • {teamLosesStats.totalLosesOwnHalfFull + teamLosesStats.totalLosesOpponentHalfFull} strat
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={regainLosesTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                      <XAxis dataKey="minute" label={{ value: 'Przedział minutowy', position: 'insideBottom', offset: -5 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        content={({ payload, label }) => {
                          if (!payload || payload.length === 0) return null;
                          const data = payload[0]?.payload || {};
                          return (
                            <div className={styles.tooltip}>
                              <p className={styles.tooltipLabel}>{`Przedział: ${label} min`}</p>
                              <p><strong>Przechwyty:</strong> {data.regains}</p>
                              <p><strong>Straty:</strong> {data.loses}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar dataKey="regains" name="Przechwyty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="loses" name="Straty" fill={TEAM_STATS_RED} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {expandedCategory === 'loses' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                {/* Przełącznik połowy boiska */}
                <div className={styles.detailsSection}>
                  <div className={styles.heatmapModeToggle}>
                    <button
                      className={`${styles.heatmapModeButton} ${losesHalfFilter === 'all' ? styles.active : ''}`}
                      onClick={() => setLosesHalfFilter('all')}
                      type="button"
                    >
                      Całe boisko
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${losesHalfFilter === 'own' ? styles.active : ''}`}
                      onClick={() => setLosesHalfFilter('own')}
                      type="button"
                    >
                      Własna połowa
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${losesHalfFilter === 'opponent' ? styles.active : ''}`}
                      onClick={() => setLosesHalfFilter('opponent')}
                      type="button"
                    >
                      Połowa przeciwnika
                    </button>
                    <button
                      className={`${styles.heatmapModeButton} ${losesHalfFilter === 'pm' ? styles.active : ''}`}
                      onClick={() => setLosesHalfFilter('pm')}
                      type="button"
                    >
                      PM Area
                    </button>
                  </div>
                </div>

                {/* Filtr z kafelkami P0-P3 */}
                <div className={styles.detailsSection}>
                  <div className={styles.countItemsWrapper}>
                    {(['p0', 'p1', 'p2', 'p3'] as const).map((pValue) => {
                      const isActive = isFilterActive(pValue);
                      // Używamy wartości "all" (wszystkie straty) do wyświetlania w kafelkach
                      const count = pValue === 'p0' ? teamLosesStats.allLosesP0Count :
                                   pValue === 'p1' ? teamLosesStats.allLosesP1Count :
                                   pValue === 'p2' ? teamLosesStats.allLosesP2Count :
                                   teamLosesStats.allLosesP3Count;
                      const lateralCount = pValue === 'p0' ? teamLosesStats.allLosesP0CountLateral :
                                          pValue === 'p1' ? teamLosesStats.allLosesP1CountLateral :
                                          pValue === 'p2' ? teamLosesStats.allLosesP2CountLateral :
                                          teamLosesStats.allLosesP3CountLateral;
                      const centralCount = pValue === 'p0' ? teamLosesStats.allLosesP0CountCentral :
                                          pValue === 'p1' ? teamLosesStats.allLosesP1CountCentral :
                                          pValue === 'p2' ? teamLosesStats.allLosesP2CountCentral :
                                          teamLosesStats.allLosesP3CountCentral;
                      
                      return (
                        <div
                          key={pValue}
                          className={`${styles.countItem} ${isActive ? styles.countItemSelected : ''} ${count === 0 ? styles.countItemDisabled : ''}`}
                          onClick={() => {
                            if (count === 0) return;
                            setSelectedActionFilter(prev => {
                              const filters = Array.isArray(prev) ? prev : [];
                              const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                              if (filters.includes(pValue)) {
                                return withoutEndFilters;
                              }
                              return [...withoutEndFilters, pValue];
                            });
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <span className={styles.countLabel}>{pValue.toUpperCase()}:</span>
                            <span className={styles.countValue}>{count}</span>
                          </div>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{lateralCount}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{centralCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Podstawowe statystyki */}
                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>STRATY:</span>
                    <span className={styles.detailsValue}>
                      {(() => {
                        const filteredLosesCount = teamLosesStats.visibleLosesCount;
                        const autysCount = teamLosesStats.visibleAutCount;
                        const noPLoses = teamLosesStats.allLosesNoPCount ?? 0;
                        const autOnMapOwnHalf = teamLosesStats.allLosesOwnHalfAutOnMapCount ?? 0;
                        const totalMinutes = teamStats.totalMinutes || 90;
                        const losesPer90Filtered = totalMinutes > 0
                          ? ((filteredLosesCount * 90) / totalMinutes).toFixed(1)
                          : '0.0';
                        return (
                          <>
                            <span className={styles.valueMain}>{filteredLosesCount}</span>
                            <span className={styles.valueSecondary}>
                              {' '}
                              • ({losesPer90Filtered} / 90){autysCount > 0 ? ` • w tym auty: ${autysCount}` : ''}
                              {noPLoses > 0 ? ` • bez P0–P3: ${noPLoses}` : ''}
                              {autOnMapOwnHalf > 0 ? ` • aut (wł. poł., mapa): ${autOnMapOwnHalf}` : ''}
                            </span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>STRATY/MIN POSIADANIA ({teamsObject[selectedTeam]?.name ?? selectedTeam}):</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>
                        {aggregatedPossession && aggregatedPossession.teamMin > 0
                          ? (teamLosesStats.visibleLosesCount / aggregatedPossession.teamMin).toFixed(2)
                          : "brak danych"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W OBRONIE/MIN POSIADANIA ({teamsObject[selectedTeam]?.name ?? selectedTeam}):</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>
                        {aggregatedPossession && aggregatedPossession.teamMin > 0
                          ? (teamLosesStats.losesXTInDefense / aggregatedPossession.teamMin).toFixed(3)
                          : "brak danych"}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W ATAKU:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamLosesStats.losesXTInAttack.toFixed(3)}</span>
                      {teamLosesStats.losesAttackCount > 0 && (
                        <span className={styles.valueSecondary}>• {(teamLosesStats.losesXTInAttack / teamLosesStats.losesAttackCount).toFixed(3)} / akcję</span>
                      )}
                      {totalLosesXT.totalXTInAttack > 0 && (
                        <span className={styles.valueSecondary}> • {((teamLosesStats.losesXTInAttack / totalLosesXT.totalXTInAttack) * 100).toFixed(1)}% z xT</span>
                      )}
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W OBRONIE:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamLosesStats.losesXTInDefense.toFixed(3)}</span>
                      {teamLosesStats.losesDefenseCount > 0 && (
                        <span className={styles.valueSecondary}>• {(teamLosesStats.losesXTInDefense / teamLosesStats.losesDefenseCount).toFixed(3)} / akcję</span>
                      )}
                      {totalLosesXT.totalXTInDefense > 0 && (
                        <span className={styles.valueSecondary}> • {((teamLosesStats.losesXTInDefense / totalLosesXT.totalXTInDefense) * 100).toFixed(1)}% z xT</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Konsekwencje strat */}
                <div className={styles.detailsSection}>
                  <h4>Konsekwencje strat</h4>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Kontrpressing 5s:</span>
                    <span className={styles.detailsValue}>
                      {(() => {
                        // Użyj tej samej logiki co w głównym KPI - wszystkie straty (derivedLosesActions)
                        // Wszystkie straty bez isAut, które mają zaznaczony jeden z przycisków 5s (✓ 5s LUB ✗ 5s)
                        // Wsparcie wsteczne: isReaction5sNotApplicable jest traktowane jak isBadReaction5s
                        const allLoses = derivedLosesActions;
                        const losesWith5sFlags = allLoses.filter(action => {
                          if (action.isAut === true) return false;
                          const hasBad5s = action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true;
                          return action.isReaction5s === true || hasBad5s;
                        });
                        // Straty z flagą isReaction5s === true (✓ 5s - dobre)
                        const reaction5sLoses = losesWith5sFlags.filter(action => 
                          action.isReaction5s === true
                        );
                        const reaction5sPercentage = losesWith5sFlags.length > 0 
                          ? (reaction5sLoses.length / losesWith5sFlags.length) * 100 
                          : 0;
                        
                        return (
                          <>
                      <span className={styles.valueMain}>
                              {reaction5sPercentage.toFixed(1)}%
                      </span>
                      <span className={styles.valueSecondary}>
                              • {reaction5sLoses.length}/{losesWith5sFlags.length} • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentRegains5s}</span>
                      <span className={styles.valueSecondary}> Nasz Regain</span>
                          </>
                        );
                      })()}
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Przeciwnik 8s od straty:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentXG8s.toFixed(2)}</span>
                      <span className={styles.valueSecondary}> xG ({losesAfterStats.totalOpponentShots8s}) • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentPKEntries8s}</span>
                      <span className={styles.valueSecondary}> PK • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentRegains8s}</span>
                      <span className={styles.valueSecondary}> Nasz Regain</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>Przeciwnik 15s od straty:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentXG15s.toFixed(2)}</span>
                      <span className={styles.valueSecondary}> xG ({losesAfterStats.totalOpponentShots15s}) • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentPKEntries15s}</span>
                      <span className={styles.valueSecondary}> PK • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentRegains15s}</span>
                      <span className={styles.valueSecondary}> Nasz Regain</span>
                    </span>
                  </div>
                </div>

                {/* Heatmapa strat */}
                <div className={styles.detailsSection}>
                  <div className={styles.heatmapHeaderInPanel}>
                    <h4>Heatmapa strat</h4>
                    <div className={styles.heatmapControlsInPanel}>
                      {/* Przełącznik atak/obrona */}
                      <div className={styles.heatmapModeToggle}>
                        <button
                          className={`${styles.heatmapModeButton} ${teamLosesAttackDefenseMode === 'defense' ? styles.active : ''}`}
                          onClick={() => setTeamLosesAttackDefenseMode('defense')}
                          type="button"
                        >
                          W obronie
                        </button>
                        <button
                          className={`${styles.heatmapModeButton} ${teamLosesAttackDefenseMode === 'attack' ? styles.active : ''}`}
                          onClick={() => setTeamLosesAttackDefenseMode('attack')}
                          type="button"
                        >
                          W ataku
                        </button>
                      </div>
                      <div className={styles.heatmapModeToggle}>
                        <button
                          className={`${styles.heatmapModeButton} ${teamLosesHeatmapMode === 'xt' ? styles.active : ''}`}
                          onClick={() => setTeamLosesHeatmapMode('xt')}
                          type="button"
                        >
                          xT odbiorców
                        </button>
                        <button
                          className={`${styles.heatmapModeButton} ${teamLosesHeatmapMode === 'count' ? styles.active : ''}`}
                          onClick={() => setTeamLosesHeatmapMode('count')}
                          type="button"
                        >
                          Liczba akcji
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.heatmapWrapperInPanel}>
                    <div className={styles.heatmapContainerInPanel}>
                      <PlayerHeatmapPitch
                        heatmapData={teamLosesHeatmap}
                        category="loses"
                        mode={teamLosesHeatmapMode === 'xt' ? 'pxt' : 'count'}
                        mirrored={false}
                        selectedZone={selectedLosesZone}
                        onZoneClick={(zoneName) => {
                          const normalizedZone = typeof zoneName === 'string' 
                            ? zoneName.toUpperCase().replace(/\s+/g, '') 
                            : String(zoneName).toUpperCase().replace(/\s+/g, '');
                          
                          if (!normalizedZone) {
                            setLosesZoneDetails(null);
                            setSelectedLosesZone(null);
                            return;
                          }

                          // Zawsze zbierz akcje dla wybranej strefy z ataku (losesAttackZone)
                          // Używamy przefiltrowanych akcji z teamLosesStats
                          const filteredLosesActionsForHeatmap = losesHalfFilter === "all"
                            ? derivedLosesActions
                            : losesHalfFilter === "pm"
                            ? derivedLosesActions.filter(action => {
                                const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                                const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                                const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                                return losesZoneName && pmZones.includes(losesZoneName);
                              })
                            : derivedLosesActions.filter(action => {
                                const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                                const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                                if (!losesZoneName) return false;
                                const isOwn = isOwnHalfByZoneColumn(losesZoneName);
                                return losesHalfFilter === "own" ? isOwn : !isOwn;
                              });
                          
                          let zoneActions = filteredLosesActionsForHeatmap.filter(action => {
                            const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
                            const attackZoneName = attackZoneRaw ? convertZoneToName(attackZoneRaw) : null;
                            return attackZoneName?.toUpperCase().replace(/\s+/g, '') === normalizedZone;
                          });
                          
                          // Filtruj według selectedActionFilter (P0-P3)
                          if (selectedActionFilter && selectedActionFilter.length > 0) {
                            zoneActions = zoneActions.filter(action => matchesSelectedActionFilter(action));
                          }

                          const playersMap = new Map<string, { 
                            losesXT: number; 
                            loses: number;
                            actions: Array<{
                              minute: number;
                              zone: string;
                              isReaction5s?: boolean;
                              isAut?: boolean;
                              isBadReaction5s?: boolean;
                              xT: number;
                            }>;
                          }>();
                          let totalXT = 0;
                          let totalLoses = 0;

                          zoneActions.forEach(action => {
                            const playerId = action.senderId;
                            if (!playerId) return;

                            // Wartości xT zależą od trybu, ale zawsze używamy strefy z ataku
                            const actionXT = teamLosesAttackDefenseMode === 'attack'
                              ? (action.losesAttackXT ?? 0)
                              : (action.losesDefenseXT ?? 0);

                            // Zawsze pobierz strefę z ataku
                            const actionZone = action.losesAttackZone ? convertZoneToName(action.losesAttackZone) : null;

                            totalXT += actionXT;
                            totalLoses += 1;

                            if (!playersMap.has(playerId)) {
                              playersMap.set(playerId, { 
                                losesXT: 0, 
                                loses: 0,
                                actions: []
                              });
                            }

                            const stats = playersMap.get(playerId)!;
                            stats.losesXT += actionXT;
                            stats.loses += 1;
                            
                            // Dodaj szczegóły akcji
                            stats.actions.push({
                              minute: action.minute ?? 0,
                              zone: actionZone || normalizedZone,
                              isReaction5s: action.isReaction5s,
                              isAut: action.isAut,
                              isBadReaction5s: action.isBadReaction5s,
                              xT: actionXT,
                            });
                          });

                          const playersList = Array.from(playersMap.entries())
                            .map(([playerId, stats]) => {
                              const player = players.find(p => p.id === playerId);
                              return {
                                playerId,
                                playerName: getPlayerLabel(playerId, playersIndex),
                                losesXT: stats.losesXT,
                                loses: stats.loses,
                                actions: stats.actions.sort((a, b) => a.minute - b.minute),
                              };
                            })
                            .sort((a, b) => b.losesXT - a.losesXT);

                          setLosesZoneDetails({
                            zoneName: normalizedZone,
                            totalXT,
                            totalLoses,
                            players: playersList,
                          });
                          setSelectedLosesZone(normalizedZone);
                        }}
                      />
                    </div>
                    <div className={styles.zoneDetailsPanel}>
                      {losesZoneDetails ? (
                        <>
                          <div className={styles.zoneDetailsHeader}>
                            <h4>Strefa {losesZoneDetails.zoneName}</h4>
                            <button
                              onClick={() => {
                                setLosesZoneDetails(null);
                                setSelectedLosesZone(null);
                              }}
                              className={styles.zoneDetailsClose}
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.zoneDetailsBody}>
                            <p className={styles.zoneDetailsSubtitle}>
                              Zawodnicy, którzy stracili piłkę w tej strefie:
                            </p>
                            <div className={styles.zonePlayerStats} style={{ marginBottom: '12px' }}>
                              <div className={styles.zonePlayerStat}>
                                <span className={styles.zoneLabel}>xT:</span>
                                <span className={styles.zoneValue}>{losesZoneDetails.totalXT.toFixed(2)}</span>
                              </div>
                              <div className={styles.zonePlayerStat}>
                                <span className={styles.zoneLabel}>Straty:</span>
                                <span className={styles.zoneValue}>{losesZoneDetails.totalLoses}</span>
                              </div>
                            </div>
                            <div className={styles.zonePlayersList}>
                              {losesZoneDetails.players.length > 0 ? losesZoneDetails.players.map((player) => (
                                <div key={player.playerId} className={styles.zonePlayerItem}>
                                  <div className={styles.zonePlayerName}>{getPlayerLabel(player.playerId, playersIndex)}</div>
                                  <div className={styles.zonePlayerStats}>
                                    <div className={styles.zonePlayerStat}>
                                      <span className={styles.zoneLabel}>xT:</span>
                                      <span className={styles.zoneValue}>{player.losesXT.toFixed(2)}</span>
                                    </div>
                                    <div className={styles.zonePlayerStat}>
                                      <span className={styles.zoneLabel}>Straty:</span>
                                      <span className={styles.zoneValue}>{player.loses}</span>
                                    </div>
                                  </div>
                                  {/* Szczegóły akcji */}
                                  {player.actions && player.actions.length > 0 && (
                                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                                      {player.actions.map((action, idx) => (
                                        <div key={idx} style={{ marginBottom: '6px', padding: '6px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                            <span><strong>Min:</strong> {action.minute}</span>
                                            <span><strong>Strefa:</strong> {action.zone}</span>
                                            <span><strong>xT:</strong> {action.xT.toFixed(2)}</span>
                                            {action.isAut === true ? (
                                              <span style={{ color: TEAM_STATS_RED, fontWeight: '600' }}>Aut</span>
                                            ) : action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true ? (
                                              <span style={{ color: TEAM_STATS_RED, fontWeight: '600' }}>✗ 5s</span>
                                            ) : action.isReaction5s === true ? (
                                              <span style={{ color: TEAM_STATS_GREEN, fontWeight: '600' }}>Reakcja 5s</span>
                                            ) : (
                                              <span style={{ color: '#6b7280', fontWeight: '600' }}>Brak reakcji</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <button
                                    className={styles.viewActionsButton}
                                    onClick={() => {
                                      setSelectedPlayerForModal({
                                        playerId: player.playerId,
                                        playerName: getPlayerLabel(player.playerId, playersIndex),
                                        zoneName: losesZoneDetails.zoneName
                                      });
                                      setActionsModalOpen(true);
                                    }}
                                    title="Zobacz szczegóły akcji"
                                    style={{ marginTop: '8px' }}
                                  >
                                    Zobacz akcje
                                  </button>
                                </div>
                              )) : (
                                <div className={styles.zoneDetailsPlaceholder}>
                                  Brak danych zawodników dla tej strefy.
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className={styles.zoneDetailsPlaceholder}>
                          Kliknij na kafelek, aby zobaczyć szczegóły
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Wykres na dole */}
                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Straty: liczba i <span className={styles.preserveCase}>xT</span> co 5 minut</h3>
                    <span className={styles.chartInfo}>{teamLosesStats.totalLosesOwnHalfFull + teamLosesStats.totalLosesOpponentHalfFull} strat</span>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={losesTimelineXT} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={0} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                      <XAxis dataKey="minute" label={{ value: 'Przedział minutowy', position: 'insideBottom', offset: -5 }} tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={50} />
                      <YAxis yAxisId="left" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        content={({ payload, label }) => {
                          if (!payload || payload.length === 0) return null;
                          const data = payload[0]?.payload || {};
                          return (
                            <div className={styles.tooltip}>
                              <p className={styles.tooltipLabel}>{`Przedział: ${label} min`}</p>
                              <p style={{ color: '#3b82f6' }}><strong>Straty:</strong> {data.loses}</p>
                              <p style={{ color: TEAM_STATS_RED }}><strong>xT w ataku:</strong> {data.xtAttack?.toFixed(3)}</p>
                              <p style={{ color: '#6b7280' }}><strong>xT w obronie:</strong> {data.xtDefense?.toFixed(3)}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="loses" name="Straty" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtAttack" name="xT w ataku" fill={TEAM_STATS_RED} radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtDefense" name="xT w obronie" fill="#6b7280" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {expandedCategory === 'gps' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>GPS</h3>
                <div className={styles.gpsControlsRow}>
                  <div className={styles.gpsControlGroup}>
                    <p className={styles.compactSelectorGroupLabel}>Pozycja (mecz)</p>
                    <select
                      className={styles.compactSelect}
                      value={gpsMatchPositionFilter}
                      onChange={(e) => setGpsMatchPositionFilter(e.target.value)}
                    >
                      <option value="all">Wszystkie</option>
                      {Array.from(new Set((selectedMatchInfo.playerMinutes || [])
                        .map(pm => {
                          const pos = pm.position || '';
                          if (pos === 'LW' || pos === 'RW') return 'Skrzydłowi';
                          return pos || 'Brak';
                        })
                        .filter(Boolean)
                      )).map((pos) => (
                        <option key={pos} value={pos}>
                          {pos === 'Skrzydłowi' ? 'W' : pos}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.gpsControlGroup}>
                    <p className={styles.compactSelectorGroupLabel}>Widok</p>
                    <div className={styles.gpsValueModeToggle}>
                      <button
                        type="button"
                        className={`${styles.gpsValueModeButton} ${gpsMatchValueMode === 'raw' ? styles.active : ''}`}
                        onClick={() => setGpsMatchValueMode('raw')}
                      >
                        Dane
                      </button>
                      <button
                        type="button"
                        className={`${styles.gpsValueModeButton} ${gpsMatchValueMode === 'perMinute' ? styles.active : ''}`}
                        onClick={() => setGpsMatchValueMode('perMinute')}
                      >
                        Na minutę gry
                      </button>
                    </div>
                  </div>
                </div>
                <div className={styles.detailsSection}>
                  <button
                    type="button"
                    className={styles.gpsSectionHeader}
                    style={{ width: '100%' }}
                    onClick={() => setGpsMatchDayExpanded(!gpsMatchDayExpanded)}
                    aria-expanded={gpsMatchDayExpanded}
                  >
                    <span>Mecz</span>
                    <span className={`${styles.expandIcon} ${gpsMatchDayExpanded ? styles.expanded : ''}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </button>
                  {gpsMatchDayExpanded && (
                    <div className={styles.gpsMatchDayContent}>
                      {gpsMatchDayLoading ? (
                        <p className={styles.gpsMatchDayLoading}>Ładowanie danych GPS...</p>
                      ) : gpsMatchDayData.length === 0 ? (
                        <p className={styles.gpsMatchDayEmpty}>Brak danych GPS dla dnia meczowego (MD) w dniu wybranego meczu.</p>
                      ) : (() => {
                        const findKey = (total: Record<string, any>, keys: string[]) => keys.find(k => Object.prototype.hasOwnProperty.call(total, k));
                        const getPeriodData = (entry: { firstHalf: Record<string, any>; secondHalf: Record<string, any>; total: Record<string, any> }) => {
                          if (gpsMatchDayPeriod === 'firstHalf') return entry.firstHalf || {};
                          if (gpsMatchDayPeriod === 'secondHalf') return entry.secondHalf || {};
                          return entry.total || {};
                        };
                        const toNum = (v: any): number => {
                          if (v == null) return NaN;
                          if (typeof v === 'number') return v;
                          if (typeof v === 'string') {
                            const cleaned = v.trim().replace(',', '.');
                            const direct = Number(cleaned);
                            if (Number.isFinite(direct)) return direct;
                            // Fallback: strip jednostki/znaki, zostaw liczby
                            const stripped = Number(cleaned.replace(/[^\d.\-]/g, ''));
                            return Number.isFinite(stripped) ? stripped : NaN;
                          }
                          const coerced = Number(v);
                          return Number.isFinite(coerced) ? coerced : NaN;
                        };
                        const durationToSeconds = (v: any): number => {
                          if (v == null) return NaN;
                          if (typeof v === 'number') return v;
                          if (typeof v !== 'string') return toNum(v);
                          const s = v.trim();
                          if (!s.includes(':')) return toNum(s);
                          const parts = s.split(':').map(p => p.trim());
                          if (parts.some(p => p === '' || Number.isNaN(Number(p)))) return NaN;
                          const nums = parts.map(Number);
                          if (nums.length === 2) {
                            const [mm, ss] = nums;
                            return mm * 60 + ss;
                          }
                          if (nums.length === 3) {
                            const [hh, mm, ss] = nums;
                            return hh * 3600 + mm * 60 + ss;
                          }
                          return NaN;
                        };

                        const getHibSeconds = (total: Record<string, any>) => {
                          const k = findKey(total, [
                            'Duration Of High Intensity Bursts (s)',
                            'Duration Of High Intensity Bursts (Seconds)',
                            'Duration Of High Intensity Bursts',
                            'Duration of High Intensity Bursts (s)',
                            'HIB Duration (s)',
                          ]);
                          if (!k || total[k] == null) return NaN;
                          const v = total[k];
                          // Wspieramy zarówno liczbę (sekundy) jak i format czasu
                          return typeof v === 'string' && v.includes(':') ? durationToSeconds(v) : toNum(v);
                        };

                        const getHibCount = (total: Record<string, any>) => {
                          const k = findKey(total, [
                            'Number Of High Intensity Bursts',
                            'Number of High Intensity Bursts',
                            'High Intensity Bursts',
                            'HIB Count',
                          ]);
                          if (!k || total[k] == null) return NaN;
                          return toNum(total[k]);
                        };

                        const getAccDecAbs56 = (total: Record<string, any>) => {
                          const acc5Key = findKey(total, ['Accelerations Zone 5 (Absolute)']);
                          const acc6Key = findKey(total, ['Accelerations Zone 6 (Absolute)']);
                          const dec5Key = findKey(total, ['Decelerations Zone 5 (Absolute)']);
                          const dec6Key = findKey(total, ['Decelerations Zone 6 (Absolute)']);

                          const acc5 = acc5Key != null ? toNum(total[acc5Key]) : NaN;
                          const acc6 = acc6Key != null ? toNum(total[acc6Key]) : NaN;
                          const dec5 = dec5Key != null ? toNum(total[dec5Key]) : NaN;
                          const dec6 = dec6Key != null ? toNum(total[dec6Key]) : NaN;

                          const hasAcc = Number.isFinite(acc5) || Number.isFinite(acc6);
                          const hasDec = Number.isFinite(dec5) || Number.isFinite(dec6);

                          const acc = hasAcc ? (Number.isFinite(acc5) ? acc5 : 0) + (Number.isFinite(acc6) ? acc6 : 0) : NaN;
                          const dec = hasDec ? (Number.isFinite(dec5) ? dec5 : 0) + (Number.isFinite(dec6) ? dec6 : 0) : NaN;

                          return { acc, dec };
                        };

                        const getDistance56 = (total: Record<string, any>) => {
                          const d5Key = findKey(total, ['Distance Zone 5 (Absolute)']);
                          const d6Key = findKey(total, ['Distance Zone 6 (Absolute)']);

                          const d5 = d5Key != null ? toNum(total[d5Key]) : NaN;
                          const d6 = d6Key != null ? toNum(total[d6Key]) : NaN;

                          const hasAny = Number.isFinite(d5) || Number.isFinite(d6);
                          const sum = hasAny ? (Number.isFinite(d5) ? d5 : 0) + (Number.isFinite(d6) ? d6 : 0) : NaN;
                          return sum;
                        };

                        const formatNum = (n: number) => {
                          if (!Number.isFinite(n)) return '—';
                          return Number.isInteger(n) ? String(n) : n.toFixed(2);
                        };

                        const normalizePosition = (pos?: string) => {
                          if (!pos) return 'Brak';
                          if (pos === 'LW' || pos === 'RW') return 'Skrzydłowi';
                          return pos;
                        };

                        const getPlayerMinutesInPeriod = (playerId: string): number => {
                          const pm = (selectedMatchInfo.playerMinutes || []).find(p => p.playerId === playerId);
                          if (!pm) return NaN;
                          const start = pm.startMinute ?? 0;
                          const end = pm.endMinute ?? 0;
                          if (start === 0 && end === 0) return 0;

                          const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
                            const s = Math.max(aStart, bStart);
                            const e = Math.min(aEnd, bEnd);
                            return e >= s ? (e - s + 1) : 0;
                          };

                          if (gpsMatchDayPeriod === 'firstHalf') {
                            return overlap(start, end, 1, 45);
                          }
                          if (gpsMatchDayPeriod === 'secondHalf') {
                            // bez górnego limitu, ale minimum od 46
                            return overlap(start, end, 46, end);
                          }
                          return Math.max(0, end - start + 1);
                        };

                        const getPlayerPositionInMatch = (playerId: string): string => {
                          const pm = (selectedMatchInfo.playerMinutes || []).find(p => p.playerId === playerId);
                          return normalizePosition(pm?.position);
                        };

                        const isPerMinute = gpsMatchValueMode === 'perMinute';
                        const normalizeColumns = new Set<string>([
                          'accRel',
                          'decRel',
                          'distance56',
                          'sprintDistance',
                          'sprints',
                          'hib',
                          'hibCount',
                          'hmlDistance',
                        ]);
                        const applyNormalization = (col: string, raw: number, minutes: number) => {
                          if (!isPerMinute) return raw;
                          if (!normalizeColumns.has(col)) return raw;
                          if (!Number.isFinite(minutes) || minutes <= 0) return NaN;
                          return raw / minutes;
                        };

                        const getSortValue = (
                          entry: { playerId: string; playerName: string; firstHalf: Record<string, any>; secondHalf: Record<string, any>; total: Record<string, any> },
                          col: string
                        ): number | string => {
                          const total = getPeriodData(entry);
                          const minutes = getPlayerMinutesInPeriod(entry.playerId);

                          if (col === 'playerName') return getPlayerLabel(entry.playerId, playersIndex);
                          if (col === 'position') return getPlayerPositionInMatch(entry.playerId);
                          if (col === 'minutes') return Number.isFinite(minutes) ? minutes : NaN;

                          if (col === 'accRel') { const { acc } = getAccDecAbs56(total); return Number.isFinite(acc) ? applyNormalization(col, acc, minutes) : NaN; }
                          if (col === 'decRel') { const { dec } = getAccDecAbs56(total); return Number.isFinite(dec) ? applyNormalization(col, dec, minutes) : NaN; }

                          if (col === 'distance56') { return applyNormalization(col, getDistance56(total), minutes); }
                          if (col === 'sprintDistance') { const k = findKey(total, ['Sprint Distance', 'Sprint distance']); return k != null && total[k] != null ? applyNormalization(col, toNum(total[k]), minutes) : NaN; }
                          if (col === 'sprints') { const k = findKey(total, ['Sprints', 'Sprint Count']); return k != null && total[k] != null ? applyNormalization(col, toNum(total[k]), minutes) : NaN; }

                          if (col === 'maxSpeed') { const k = findKey(total, ['Max Speed', 'Max speed', 'Max Speed (km/h)', 'Max Speed (kph)']); return k != null && total[k] != null ? toNum(total[k]) : NaN; }
                          if (col === 'distancePerMin') { const k = findKey(total, ['Distance Per Min', 'Distance per min']); return k != null && total[k] != null ? toNum(total[k]) : NaN; }
                          if (col === 'distanceZone46') {
                            const k = findKey(total, [
                              'High Speed Running (Relative)',
                              'High Speed Running (relative)',
                              'High Speed Running (m)',
                              'High Speed Running',
                            ]);
                            return k != null && total[k] != null ? toNum(total[k]) : NaN;
                          }

                          if (col === 'hib') { return applyNormalization(col, getHibSeconds(total), minutes); }
                          if (col === 'hibCount') { return applyNormalization(col, getHibCount(total), minutes); }

                          if (col === 'hmlDistance') { const k = findKey(total, ['HML Distance', 'HML distance']); return k != null && total[k] != null ? applyNormalization(col, toNum(total[k]), minutes) : NaN; }
                          return '';
                        };
                        const gpsMatchDaySortColumn = gpsMatchDaySort.column;
                        const gpsMatchDaySortDir = gpsMatchDaySort.dir;
                        const filteredGpsData = gpsMatchDayData.filter((e) => {
                          if (gpsMatchPositionFilter === 'all') return true;
                          return getPlayerPositionInMatch(e.playerId) === gpsMatchPositionFilter;
                        });

                        const sortedData = [...filteredGpsData].sort((a, b) => {
                          if (!gpsMatchDaySortColumn) {
                            // Domyślnie: grupuj po pozycji, potem alfabetycznie
                            const pa = getPlayerPositionInMatch(a.playerId);
                            const pb = getPlayerPositionInMatch(b.playerId);
                            const pc = pa.localeCompare(pb, 'pl', { sensitivity: 'base' });
                            if (pc !== 0) return pc;
                            return (a.playerName || '').localeCompare((b.playerName || ''), 'pl', { sensitivity: 'base' });
                          }
                          const va = getSortValue(a, gpsMatchDaySortColumn);
                          const vb = getSortValue(b, gpsMatchDaySortColumn);
                          const cmp = typeof va === 'number' && typeof vb === 'number'
                            ? (Number.isNaN(va) && Number.isNaN(vb) ? 0 : Number.isNaN(va) ? 1 : Number.isNaN(vb) ? -1 : va - vb)
                            : String(va).localeCompare(String(vb), 'pl', { numeric: true });
                          return gpsMatchDaySortDir === 'asc' ? cmp : -cmp;
                        });
                        const handleSort = (col: string) => {
                          setGpsMatchDaySort(prev => prev.column === col
                            ? { ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                            : { column: col, dir: 'asc' });
                        };
                        return (
                        <>
                        <div className={styles.gpsPeriodSelector}>
                          <button
                            type="button"
                            className={`${styles.periodButton} ${gpsMatchDayPeriod === 'total' ? styles.active : ''}`}
                            onClick={() => setGpsMatchDayPeriod('total')}
                          >
                            Suma
                          </button>
                          <button
                            type="button"
                            className={`${styles.periodButton} ${gpsMatchDayPeriod === 'firstHalf' ? styles.active : ''}`}
                            onClick={() => setGpsMatchDayPeriod('firstHalf')}
                          >
                            1. połowa
                          </button>
                          <button
                            type="button"
                            className={`${styles.periodButton} ${gpsMatchDayPeriod === 'secondHalf' ? styles.active : ''}`}
                            onClick={() => setGpsMatchDayPeriod('secondHalf')}
                          >
                            2. połowa
                          </button>
                        </div>

                        <div className={styles.gpsMatchDayTableWrap}>
                          <table className={styles.gpsMatchDayTable}>
                            <thead>
                              <tr>
                                <th
                                  className={styles.gpsSortableTh}
                                  onClick={() => handleSort('playerName')}
                                  role="button"
                                  aria-sort={gpsMatchDaySortColumn === 'playerName' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                                >
                                  Zawodnik{gpsMatchDaySortColumn === 'playerName' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}
                                </th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('minutes')} role="button" aria-sort={gpsMatchDaySortColumn === 'minutes' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Min{gpsMatchDaySortColumn === 'minutes' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('accRel')} role="button" aria-sort={gpsMatchDaySortColumn === 'accRel' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>ACC 5-6{gpsMatchDaySortColumn === 'accRel' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('decRel')} role="button" aria-sort={gpsMatchDaySortColumn === 'decRel' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>DCC 5-6{gpsMatchDaySortColumn === 'decRel' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('distance56')} role="button" aria-sort={gpsMatchDaySortColumn === 'distance56' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Distance 5-6{gpsMatchDaySortColumn === 'distance56' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('sprintDistance')} role="button" aria-sort={gpsMatchDaySortColumn === 'sprintDistance' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Sprint Distance{gpsMatchDaySortColumn === 'sprintDistance' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('sprints')} role="button" aria-sort={gpsMatchDaySortColumn === 'sprints' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Sprints{gpsMatchDaySortColumn === 'sprints' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('maxSpeed')} role="button" aria-sort={gpsMatchDaySortColumn === 'maxSpeed' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Max Speed{gpsMatchDaySortColumn === 'maxSpeed' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('distancePerMin')} role="button" aria-sort={gpsMatchDaySortColumn === 'distancePerMin' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>Distance Per Min{gpsMatchDaySortColumn === 'distancePerMin' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('distanceZone46')} role="button" aria-sort={gpsMatchDaySortColumn === 'distanceZone46' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>HSR (m){gpsMatchDaySortColumn === 'distanceZone46' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('hib')} role="button" aria-sort={gpsMatchDaySortColumn === 'hib' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>HIB (s){gpsMatchDaySortColumn === 'hib' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('hibCount')} role="button" aria-sort={gpsMatchDaySortColumn === 'hibCount' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>HIB (n){gpsMatchDaySortColumn === 'hibCount' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                                <th className={styles.gpsSortableTh} onClick={() => handleSort('hmlDistance')} role="button" aria-sort={gpsMatchDaySortColumn === 'hmlDistance' ? (gpsMatchDaySortDir === 'asc' ? 'ascending' : 'descending') : undefined}>HML Distance{gpsMatchDaySortColumn === 'hmlDistance' && (gpsMatchDaySortDir === 'asc' ? ' ↑' : ' ↓')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedData.map((entry) => {
                                const total = getPeriodData(entry);
                                const minutes = getPlayerMinutesInPeriod(entry.playerId);
                                const minutesLabel = Number.isFinite(minutes) ? String(minutes) : '—';
                                const accDecAbs56 = getAccDecAbs56(total);
                                const accRelLabel = Number.isFinite(accDecAbs56.acc) ? formatNum(applyNormalization('accRel', accDecAbs56.acc, minutes)) : '—';
                                const decRelLabel = Number.isFinite(accDecAbs56.dec) ? formatNum(applyNormalization('decRel', accDecAbs56.dec, minutes)) : '—';
                                const distance56 = getDistance56(total);
                                const distance56Label = Number.isFinite(distance56) ? formatNum(applyNormalization('distance56', distance56, minutes)) : '—';
                                const maxSpeedKey = findKey(total, ['Max Speed', 'Max speed', 'Max Speed (km/h)', 'Max Speed (kph)']);
                                const maxSpeedLabel = maxSpeedKey != null && total[maxSpeedKey] != null ? formatNum(toNum(total[maxSpeedKey])) : '—';
                                const distancePerMinKey = findKey(total, ['Distance Per Min', 'Distance per min']);
                                const distancePerMinLabel = distancePerMinKey != null && total[distancePerMinKey] != null ? formatNum(toNum(total[distancePerMinKey])) : '—';
                                const distanceZone46Key = findKey(total, [
                                  'High Speed Running (Relative)',
                                  'High Speed Running (relative)',
                                  'High Speed Running (m)',
                                  'High Speed Running',
                                ]);
                                const distanceZone46Raw = distanceZone46Key != null && total[distanceZone46Key] != null ? toNum(total[distanceZone46Key]) : NaN;
                                const distanceZone46Label = Number.isFinite(distanceZone46Raw) ? formatNum(distanceZone46Raw) : '—';
                                const sprintsKey = findKey(total, ['Sprints', 'Sprint Count']);
                                const sprintsRaw = sprintsKey != null && total[sprintsKey] != null ? toNum(total[sprintsKey]) : NaN;
                                const sprintsLabel = Number.isFinite(sprintsRaw) ? formatNum(applyNormalization('sprints', sprintsRaw, minutes)) : '—';
                                const sprintDistanceKey = findKey(total, ['Sprint Distance', 'Sprint distance']);
                                const sprintDistanceRaw = sprintDistanceKey != null && total[sprintDistanceKey] != null ? toNum(total[sprintDistanceKey]) : NaN;
                                const sprintDistanceLabel = Number.isFinite(sprintDistanceRaw) ? formatNum(applyNormalization('sprintDistance', sprintDistanceRaw, minutes)) : '—';
                                const hibSeconds = getHibSeconds(total);
                                const hibLabel = Number.isFinite(hibSeconds) ? formatNum(applyNormalization('hib', hibSeconds, minutes)) : '—';
                                const hibCount = getHibCount(total);
                                const hibCountLabel = Number.isFinite(hibCount) ? formatNum(applyNormalization('hibCount', hibCount, minutes)) : '—';
                                const hmlDistanceKey = findKey(total, ['HML Distance', 'HML distance']);
                                const hmlDistanceRaw = hmlDistanceKey != null && total[hmlDistanceKey] != null ? toNum(total[hmlDistanceKey]) : NaN;
                                const hmlDistanceLabel = Number.isFinite(hmlDistanceRaw) ? formatNum(applyNormalization('hmlDistance', hmlDistanceRaw, minutes)) : '—';
                                return (
                                  <tr key={entry.id}>
                                    <td>{getPlayerLabel(entry.playerId, playersIndex)}</td>
                                    <td>{minutesLabel}</td>
                                    <td>{accRelLabel}</td>
                                    <td>{decRelLabel}</td>
                                    <td>{distance56Label}</td>
                                    <td>{sprintDistanceLabel}</td>
                                    <td>{sprintsLabel}</td>
                                    <td>{maxSpeedLabel}</td>
                                    <td>{distancePerMinLabel}</td>
                                    <td>{distanceZone46Label}</td>
                                    <td>{hibLabel}</td>
                                    <td>{hibCountLabel}</td>
                                    <td>{hmlDistanceLabel}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
            {expandedCategory === 'xg' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>xG</h3>
                
                {/* Boisko z otagowanymi strzałami */}
                {selectedMatches.length > 0 && allShots.length > 0 && (
                  <div className={styles.xgPitchSection}>
                    {/* Przełącznik połowy i filtr kategorii - na samej górze */}
                    <div className={styles.xgHalfSelector}>
                      <button
                        className={`${styles.xgHalfButton} ${xgHalf === 'all' ? styles.active : ''}`}
                        onClick={() => setXgHalf('all')}
                      >
                        Wszystkie
                      </button>
                      <button
                        className={`${styles.xgHalfButton} ${xgHalf === 'first' ? styles.active : ''}`}
                        onClick={() => setXgHalf('first')}
                      >
                        I połowa
                      </button>
                      <button
                        className={`${styles.xgHalfButton} ${xgHalf === 'second' ? styles.active : ''}`}
                        onClick={() => setXgHalf('second')}
                      >
                        II połowa
                      </button>
                    </div>
                    
                    {/* Filtr kategorii xG */}
                    <div className={styles.xgFilterContainer}>
                      <button
                        className={`${styles.xgFilterButton} ${xgFilter === 'all' ? styles.active : ''}`}
                        onClick={() => setXgFilter('all')}
                      >
                        Wszystkie
                      </button>
                      <button
                        className={`${styles.xgFilterButton} ${xgFilter === 'sfg' ? styles.active : ''}`}
                        onClick={() => setXgFilter('sfg')}
                      >
                        xG SFG
                      </button>
                      <button
                        className={`${styles.xgFilterButton} ${xgFilter === 'open_play' ? styles.active : ''}`}
                        onClick={() => setXgFilter('open_play')}
                      >
                        xG Otwarta gra
                      </button>
                    </div>
                    
                    {(() => {
                      // Oblicz statystyki xG dla wybranej połowy i kategorii
                      let filteredShotsForStats = allShots.filter(shot => {
                        if (xgHalf === 'first') {
                          return shot.minute <= 45;
                        } else if (xgHalf === 'second') {
                          return shot.minute > 45;
                        }
                        return true; // all - wszystkie strzały
                      });
                      
                      // Filtruj według kategorii xG
                      if (xgFilter === 'sfg') {
                        filteredShotsForStats = filteredShotsForStats.filter(shot => {
                          if ((shot as any).actionCategory === 'sfg') return true;
                          return shot.actionType === 'corner' || 
                                 shot.actionType === 'free_kick' || 
                                 shot.actionType === 'direct_free_kick' || 
                                 shot.actionType === 'penalty' || 
                                 shot.actionType === 'throw_in';
                        });
                      } else if (xgFilter === 'open_play') {
                        filteredShotsForStats = filteredShotsForStats.filter(shot => {
                          if ((shot as any).actionCategory === 'open_play') return true;
                          return shot.actionType === 'open_play' || 
                                 shot.actionType === 'counter' || 
                                 shot.actionType === 'regain';
                        });
                      }
                      // xgFilter === 'all' - nie filtruj
                      
                      // Określ, który zespół jest wybrany (selectedTeam) i który jest przeciwnikiem w meczu
                      const isSelectedTeamHome = selectedMatchInfo.team === selectedTeam;
                      const teamIdInMatch = selectedTeam; // Wybrany zespół
                      const opponentIdInMatch = isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;
                      
                      const teamName = selectedMatchInfo.team ? (availableTeams.find(t => t.id === selectedTeam)?.name || 'Nasz zespół') : 'Nasz zespół';
                      const opponentName = opponentIdInMatch ? (availableTeams.find(t => t.id === opponentIdInMatch)?.name || 'Przeciwnik') : 'Przeciwnik';
                      
                      const teamShots = filteredShotsForStats.filter(shot => {
                        const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                          ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                          : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                        return shotTeamId === teamIdInMatch;
                      });
                      
                      const opponentShots = filteredShotsForStats.filter(shot => {
                        const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                          ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                          : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                        return shotTeamId === opponentIdInMatch;
                      });
                      
                      const teamXG = teamShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXG = opponentShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      
                      // xG bez rzutów karnych (NP xG)
                      const teamShotsNoPenalty = teamShots.filter(shot => shot.actionType !== 'penalty');
                      const opponentShotsNoPenalty = opponentShots.filter(shot => shot.actionType !== 'penalty');
                      const teamXGNoPenalty = teamShotsNoPenalty.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXGNoPenalty = opponentShotsNoPenalty.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      
                      const teamShotsCount = teamShots.length;
                      const opponentShotsCount = opponentShots.length;
                      const teamXGPerShotValue = teamShotsCount > 0 ? (teamXG / teamShotsCount) : 0;
                      const opponentXGPerShotValue = opponentShotsCount > 0 ? (opponentXG / opponentShotsCount) : 0;
                      const teamXGPerShot = teamXGPerShotValue.toFixed(2);
                      const opponentXGPerShot = opponentXGPerShotValue.toFixed(2);
                      
                      // xG OT (on target) - strzały celne i gole
                      const teamShotsOnTarget = teamShots.filter(shot => 
                        shot.shotType === 'on_target' || shot.shotType === 'goal' || shot.isGoal
                      );
                      const opponentShotsOnTarget = opponentShots.filter(shot => 
                        shot.shotType === 'on_target' || shot.shotType === 'goal' || shot.isGoal
                      );
                      const teamXGOT = teamShotsOnTarget.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXGOT = opponentShotsOnTarget.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      
                      const teamGoals = teamShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                      const opponentGoals = opponentShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                      const teamXGDiff = teamXG - teamGoals;
                      const opponentXGDiff = opponentXG - opponentGoals;
                      
                      // Oblicz czas posiadania dla wybranej połowy xG
                      const getPossessionForXG = (field: 'team' | 'opponent') => {
                        if (xgHalf === 'first') {
                          return selectedMatchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0;
                        } else if (xgHalf === 'second') {
                          return selectedMatchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0;
                        } else {
                          // all - suma obu połów
                          return (selectedMatchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0) + 
                                 (selectedMatchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0);
                        }
                      };
                      
                      const teamPossession = isSelectedTeamHome ? getPossessionForXG('team') : getPossessionForXG('opponent');
                      const opponentPossession = isSelectedTeamHome ? getPossessionForXG('opponent') : getPossessionForXG('team');
                      const teamXGPerMinPossession = teamPossession > 0 ? (teamXG / teamPossession) : 0;
                      const opponentXGPerMinPossession = opponentPossession > 0 ? (opponentXG / opponentPossession) : 0;
                      
                      // xG zablokowane - suma xG ze strzałów zablokowanych
                      const teamShotsBlocked = teamShots.filter(shot => shot.shotType === 'blocked');
                      const opponentShotsBlocked = opponentShots.filter(shot => shot.shotType === 'blocked');
                      const teamXGBlocked = teamShotsBlocked.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXGBlocked = opponentShotsBlocked.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      
                      // Średnia liczba zawodników na linii strzału/strzał
                      // Dla ataku używamy linePlayersCount, dla obrony używamy długości tablicy linePlayers
                      const teamLinePlayersTotal = teamShots.reduce((sum, shot) => {
                        if (shot.teamContext === 'attack') {
                          return sum + ((shot as any).linePlayersCount || 0);
                        } else {
                          // Dla obrony - liczba przeciwników na linii to długość tablicy linePlayers
                          return sum + ((shot as any).linePlayers?.length || 0);
                        }
                      }, 0);
                      const opponentLinePlayersTotal = opponentShots.reduce((sum, shot) => {
                        if (shot.teamContext === 'attack') {
                          return sum + ((shot as any).linePlayersCount || 0);
                        } else {
                          // Dla obrony - liczba przeciwników na linii to długość tablicy linePlayers
                          return sum + ((shot as any).linePlayers?.length || 0);
                        }
                      }, 0);
                      const teamAvgLinePlayers = teamShotsCount > 0 ? (teamLinePlayersTotal / teamShotsCount) : 0;
                      const opponentAvgLinePlayers = opponentShotsCount > 0 ? (opponentLinePlayersTotal / opponentShotsCount) : 0;
                      
                      // Strefa 1T - prostokąt w linii ataku (reaguje na obrót boiska)
                      // Prostokąt: szerokość 10%, wysokość 22%, wyśrodkowany pionowo (39-61%)
                      // Strefa 1T liczona kanonicznie (nie zależy od obrotu UI)
                      
                      // Statystyki strzałów w strefie 1T
                      const teamShots1T = teamShots.filter(isIn1TZoneCanonical);
                      const opponentShots1T = opponentShots.filter(isInOpponent1TZoneCanonical);
                      const teamShots1TCount = teamShots1T.length;
                      const opponentShots1TCount = opponentShots1T.length;
                      
                      // % strzałów z 1 kontaktu w strefie 1T
                      const teamShots1TContact1 = teamShots1T.filter(shot => shot.isContact1 === true).length;
                      const opponentShots1TContact1 = opponentShots1T.filter(shot => shot.isContact1 === true).length;
                      const team1TContact1Percentage = teamShots1TCount > 0 ? (teamShots1TContact1 / teamShots1TCount) * 100 : 0;
                      const opponent1TContact1Percentage = opponentShots1TCount > 0 ? (opponentShots1TContact1 / opponentShots1TCount) * 100 : 0;
                      
                      // xG w strefie 1T
                      const teamXG1T = teamShots1T.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXG1T = opponentShots1T.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      
                      // Sytuacje z pkEntries (isPossible1T) w strefie 1T
                      // Filtruj pkEntries według wybranej połowy
                      let filteredPKEntriesForStats = allPKEntries.filter((entry: any) => {
                        if (xgHalf === 'first') {
                          return entry.minute <= 45;
                        } else if (xgHalf === 'second') {
                          return entry.minute > 45;
                        }
                        return true; // all - wszystkie wejścia
                      });
                      
                      // Funkcja sprawdzająca, czy pkEntry kończy się w strefie 1T
                      const isPKEntryIn1TZone = (entry: any) => {
                        // Kanonicznie: nasza strefa 1T zawsze po prawej (nie zależy od obrotu UI)
                        const x = Number(entry.endX) || 0;
                        const y = Number(entry.endY) || 0;
                        return y >= 39 && y <= 61 && x >= 90 && x <= 100;
                      };
                      
                      // Filtruj pkEntries z isPossible1T w strefie 1T
                      // teamContext: 'attack' = nasze wejścia, 'defense' = wejścia przeciwnika
                      // Wszystkie pkEntries mają teamId === selectedTeam (matchInfo.team)
                      // Filtruj pkEntries z isPossible1T w strefie 1T - tylko dla naszego zespołu
                      // Dla przeciwnika nie sprawdzamy wejść w PK, bo tam nie dodajemy tych informacji
                      const teamPKEntries1T = filteredPKEntriesForStats.filter((entry: any) => {
                        if (!entry.isPossible1T) return false;
                        if (!isPKEntryIn1TZone(entry)) return false;
                        // Nasze wejścia: teamContext === 'attack'
                        const teamContext = entry.teamContext ?? 'attack';
                        return teamContext === 'attack';
                      });
                      
                      const teamPKEntries1TCount = teamPKEntries1T.length;
                      
                      // Łączna liczba sytuacji (strzały + sytuacje z pkEntries) - tylko dla naszego zespołu
                      // Dla przeciwnika tylko strzały
                      const teamTotal1TSituations = teamShots1TCount + teamPKEntries1TCount;
                      
                      // KPI dla xG/strzał: 0.15
                      const XG_PER_SHOT_KPI = 0.15;
                      
                      return (
                        <>
                          {/* Statystyki xG */}
                          <div className={styles.xgStatsSummary}>
                            <div className={styles.detailsSection}>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>NP xG:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXGNoPenalty.toFixed(2)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGNoPenalty.toFixed(2)}</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXG.toFixed(2)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXG.toFixed(2)}</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG/STRZAŁ:</span>
                                <span className={styles.detailsValue}>
                                  <span 
                                    className={styles.valueMain}
                                  style={{
                                    color: teamXGPerShotValue >= XG_PER_SHOT_KPI ? TEAM_STATS_GREEN : TEAM_STATS_RED
                                  }}
                                >
                                  {teamXGPerShot}
                                  </span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGPerShot}</span>
                                  <span className={styles.valueSecondary}> • KPI: {XG_PER_SHOT_KPI.toFixed(2)}</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG STRZAŁÓW CELNYCH:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXGOT.toFixed(2)}</span>
                                  <span className={styles.valueSecondary}> ({teamShotsOnTarget.length}/{teamShotsCount})</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGOT.toFixed(2)} ({opponentShotsOnTarget.length}/{opponentShotsCount})</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>STREFA 1T:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamTotal1TSituations}</span>
                                  <span className={styles.valueSecondary}> ({teamShots1TCount} strzałów{teamPKEntries1TCount > 0 ? `, ${teamPKEntries1TCount} bez strzału` : ''}) • {team1TContact1Percentage.toFixed(1)}% 1T • xG: {teamXG1T.toFixed(2)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentShots1TCount} ({opponent1TContact1Percentage.toFixed(1)}%) • xG: {opponentXG1T.toFixed(2)}</span>
                                </span>
                              </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG/MIN POSIADANIA:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXGPerMinPossession.toFixed(3)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGPerMinPossession.toFixed(3)}</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>RÓŻNICA xG-BRAMKI:</span>
                                <span className={styles.detailsValue}>
                                  <span 
                                    className={styles.valueMain}
                                  style={{
                                    color: teamXGDiff > 0 ? TEAM_STATS_RED : teamXGDiff < 0 ? TEAM_STATS_GREEN : '#6b7280'
                                  }}
                                >
                                  {teamXGDiff > 0 ? '+' : ''}{teamXGDiff.toFixed(2)}
                                  </span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGDiff > 0 ? '+' : ''}{opponentXGDiff.toFixed(2)}</span>
                                </span>
                                </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG ZABLOKOWANE:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXGBlocked.toFixed(2)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGBlocked.toFixed(2)}</span>
                                </span>
                              </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>xG/MIN POSIADANIA ({teamsObject[selectedTeam]?.name ?? selectedTeam}):</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamXGPerMinPossession.toFixed(3)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentXGPerMinPossession.toFixed(3)}</span>
                                </span>
                              </div>
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>ZAWODNICY NA LINII/STRZAŁ:</span>
                                <span className={styles.detailsValue}>
                                  <span className={styles.valueMain}>{teamAvgLinePlayers.toFixed(1)}</span>
                                  <span className={styles.valueSecondary}> • Przeciwnik: {opponentAvgLinePlayers.toFixed(1)}</span>
                                </span>
                                </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                    
                    <div className={styles.xgPitchContainer}>
                    <div className={styles.xgPitchWrapper}>
                      <XGPitch
                        shots={(() => {
                          // Najpierw filtruj według połowy
                          let filteredByHalf = allShots;
                          if (xgHalf === 'first') {
                            filteredByHalf = allShots.filter(shot => shot.minute <= 45);
                          } else if (xgHalf === 'second') {
                            filteredByHalf = allShots.filter(shot => shot.minute > 45);
                          }
                          
                          // Następnie filtruj według kategorii
                          let filteredByCategory = filteredByHalf;
                          if (xgFilter === 'sfg') {
                            filteredByCategory = filteredByHalf.filter(shot => {
                              if ((shot as any).actionCategory === 'sfg') return true;
                              return shot.actionType === 'corner' || 
                                     shot.actionType === 'free_kick' || 
                                     shot.actionType === 'direct_free_kick' || 
                                     shot.actionType === 'penalty' || 
                                     shot.actionType === 'throw_in';
                            });
                          } else if (xgFilter === 'open_play') {
                            filteredByCategory = filteredByHalf.filter(shot => {
                              if ((shot as any).actionCategory === 'open_play') return true;
                              return shot.actionType === 'open_play' || 
                                     shot.actionType === 'counter' || 
                                     shot.actionType === 'regain';
                            });
                          }
                          
                          // Filtruj według filtrów mapy
                          return filteredByCategory.filter(shot => {
                            // Filtr części ciała (foot = wszystkie nogi: foot, foot_left, foot_right)
                            if (xgMapFilters.bodyPart !== 'all') {
                              const bp = xgMapFilters.bodyPart;
                              const shotBp = shot.bodyPart;
                              if (bp === 'foot') {
                                if (shotBp !== 'foot' && shotBp !== 'foot_left' && shotBp !== 'foot_right') return false;
                              } else if (shotBp !== bp) {
                                return false;
                              }
                            }
                            
                            // Sprawdź czy wszystkie filtry typu są wyłączone
                            const allTypeFiltersOff = !xgMapFilters.sfg && !xgMapFilters.regain && !xgMapFilters.goal && !xgMapFilters.blocked && !xgMapFilters.onTarget;
                            
                            // Jeśli wszystkie filtry typu są wyłączone, pokazuj wszystko
                            if (allTypeFiltersOff) {
                              return true;
                            }
                            
                            // Sprawdź czy strzał pasuje do PRZYNAJMNIEJ JEDNEGO włączonego filtra typu
                            let matchesAnyFilter = false;
                            
                            // Filtr SFG
                            if (xgMapFilters.sfg) {
                              const isSFG = (shot as any).actionCategory === 'sfg' ||
                                           shot.actionType === 'corner' ||
                                           shot.actionType === 'free_kick' ||
                                           shot.actionType === 'direct_free_kick' ||
                                           shot.actionType === 'penalty' ||
                                           shot.actionType === 'throw_in';
                              if (isSFG) matchesAnyFilter = true;
                            }
                            
                            // Filtr Regain
                            if (xgMapFilters.regain && shot.actionType === 'regain') {
                              matchesAnyFilter = true;
                            }
                            
                            // Filtr Gol
                            if (xgMapFilters.goal && shot.isGoal) {
                              matchesAnyFilter = true;
                            }
                            
                            // Filtr Zablokowane
                            if (xgMapFilters.blocked && shot.shotType === 'blocked') {
                              matchesAnyFilter = true;
                            }
                            
                            // Filtr Celne
                            if (xgMapFilters.onTarget && (shot.shotType === 'on_target' || shot.shotType === 'goal')) {
                              matchesAnyFilter = true;
                            }
                            
                            // Jeśli żaden z włączonych filtrów nie pasuje, ale są też inne typy strzałów
                            // (np. off_target, counter, open_play bez regain), pokazuj je tylko jeśli wszystkie filtry są wyłączone
                            if (!matchesAnyFilter) {
                              // Sprawdź czy to jest strzał, który nie pasuje do żadnego z włączonych filtrów
                              const isOffTarget = shot.shotType === 'off_target';
                              const isOpenPlay = shot.actionType === 'open_play' || shot.actionType === 'counter';
                              const isOtherType = isOffTarget || (isOpenPlay && shot.actionType !== 'regain');
                              
                              // Jeśli to inny typ strzału i wszystkie filtry są wyłączone, pokazuj
                              if (isOtherType && allTypeFiltersOff) {
                                return true;
                              }
                              
                              // W przeciwnym razie ukryj
                              return false;
                            }
                            
                            return true;
                          });
                        })()}
                        onShotAdd={() => {}}
                        players={players}
                          onShotClick={(shot) => setSelectedShot(shot)}
                          selectedShotId={selectedShot?.id}
                        matchInfo={selectedMatchInfo}
                        allTeams={availableTeams}
                          hideToggleButton={true}
                        />
                      
                      {/* Legenda mapy xG – nad filtrami */}
                      <div className={styles.xgMapLegend} role="img" aria-label="Legenda mapy xG">
                        <span className={styles.xgMapLegendItem}>
                          <span className={styles.xgMapLegendDot} style={{ background: TEAM_STATS_GREEN }} />
                          <span>Niski xG</span>
                        </span>
                        <span className={styles.xgMapLegendItem}>
                          <span className={styles.xgMapLegendDot} style={{ background: '#fbbf24' }} />
                          <span>Średni xG</span>
                        </span>
                        <span className={styles.xgMapLegendItem}>
                          <span className={styles.xgMapLegendDot} style={{ background: TEAM_STATS_RED }} />
                          <span>Wysoki xG</span>
                        </span>
                        <span className={styles.xgMapLegendItem}>
                          <span className={`${styles.xgMapLegendDot} ${styles.goalRing}`} />
                          <span>Gol</span>
                        </span>
                        <span className={styles.xgMapLegendItem}>
                          <span className={`${styles.xgMapLegendDot} ${styles.hex}`} style={{ background: '#94a3b8' }} />
                          <span>Stały fragment</span>
                        </span>
                      </div>
                      {/* Filtry na mapie - pod mapą */}
                      <div className={styles.xgMapFilters}>
                        <div className={styles.xgMapFilterGroup}>
                          <span className={styles.xgMapFilterLabel}>Część ciała:</span>
                          <div className={styles.xgMapFilterButtons}>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'all' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'all' }))}
                            >
                              Wszystkie
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'foot' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'foot' }))}
                            >
                              Noga (wszystkie)
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'foot_left' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'foot_left' }))}
                            >
                              Noga lewa
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'foot_right' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'foot_right' }))}
                            >
                              Noga prawa
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'head' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'head' }))}
                            >
                              Głowa
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.bodyPart === 'other' ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, bodyPart: 'other' }))}
                            >
                              Inne
                            </button>
                          </div>
                        </div>
                        <div className={styles.xgMapFilterGroup}>
                          <span className={styles.xgMapFilterLabel}>Typ:</span>
                          <div className={styles.xgMapFilterButtons}>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.sfg ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, sfg: !prev.sfg }))}
                            >
                              SFG
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.regain ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, regain: !prev.regain }))}
                            >
                              Regain
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.goal ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, goal: !prev.goal }))}
                            >
                              Gol
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.blocked ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, blocked: !prev.blocked }))}
                            >
                              Zablokowane
                            </button>
                            <button
                              className={`${styles.xgMapFilterButton} ${xgMapFilters.onTarget ? styles.active : ''}`}
                              onClick={() => setXgMapFilters(prev => ({ ...prev, onTarget: !prev.onTarget }))}
                            >
                              Celne
                            </button>
                          </div>
                        </div>
                      </div>
                      </div>
                      
                      {/* Panel informacji o strzale */}
                      {selectedShot && (
                        <div className={styles.shotInfoPanel}>
                          <div className={styles.shotInfoHeader}>
                            <h5>Informacje o strzale</h5>
                            <button 
                              className={styles.shotInfoClose}
                              onClick={() => setSelectedShot(null)}
                              aria-label="Zamknij"
                            >
                              ×
                            </button>
                          </div>
                          <div className={styles.shotInfoContent}>
                            <div className={styles.shotInfoRow}>
                              <span className={styles.shotInfoLabel}>Zawodnik:</span>
                              <span className={styles.shotInfoValue}>{getPlayerLabel(selectedShot.playerId, playersIndex)}</span>
                            </div>
                            <div className={styles.shotInfoRow}>
                              <span className={styles.shotInfoLabel}>Minuta:</span>
                              <span className={styles.shotInfoValue}>{selectedShot.minute}'</span>
                            </div>
                            <div className={styles.shotInfoRow}>
                              <span className={styles.shotInfoLabel}>xG:</span>
                              <span className={styles.shotInfoValue}>{selectedShot.xG.toFixed(2)}</span>
                            </div>
                            <div className={styles.shotInfoRow}>
                              <span className={styles.shotInfoLabel}>Typ strzału:</span>
                              <span className={styles.shotInfoValue}>
                                {selectedShot.isGoal ? 'Gol' : 
                                 selectedShot.shotType === 'on_target' ? 'Celny' :
                                 selectedShot.shotType === 'off_target' ? 'Niecelny' :
                                 selectedShot.shotType === 'blocked' ? 'Zablokowany' : 'Nieznany'}
                              </span>
                            </div>
                            {selectedShot.actionType && (
                              <div className={styles.shotInfoRow}>
                                <span className={styles.shotInfoLabel}>Rodzaj akcji:</span>
                                <span className={styles.shotInfoValue}>
                                  {selectedShot.actionType === 'open_play' ? 'Otwarta gra' :
                                   selectedShot.actionType === 'counter' ? 'Kontratak' :
                                   selectedShot.actionType === 'corner' ? 'Rzut rożny' :
                                   selectedShot.actionType === 'free_kick' ? 'Rzut wolny' :
                                   selectedShot.actionType === 'direct_free_kick' ? 'Rzut wolny bezpośredni' :
                                   selectedShot.actionType === 'penalty' ? 'Rzut karny' :
                                   selectedShot.actionType === 'throw_in' ? 'Wrzut' :
                                   selectedShot.actionType === 'regain' ? 'Odzyskanie' :
                                   selectedShot.actionType}
                                </span>
                              </div>
                            )}
                            {selectedShot.bodyPart && (
                              <div className={styles.shotInfoRow}>
                                <span className={styles.shotInfoLabel}>Część ciała:</span>
                                <span className={styles.shotInfoValue}>
                                  {selectedShot.bodyPart === 'foot_left' ? 'Noga lewa' :
                                   selectedShot.bodyPart === 'foot_right' ? 'Noga prawa' :
                                   selectedShot.bodyPart === 'foot' ? 'Noga' :
                                   selectedShot.bodyPart === 'head' ? 'Głowa' : 'Inna'}
                                </span>
                              </div>
                            )}
                            {selectedShot.assistantId && (
                              <div className={styles.shotInfoRow}>
                                <span className={styles.shotInfoLabel}>Asysta:</span>
                                <span className={styles.shotInfoValue}>{getPlayerLabel(selectedShot.assistantId, playersIndex)}</span>
                              </div>
                            )}
                            {selectedShot.actionPhase && (
                              <div className={styles.shotInfoRow}>
                                <span className={styles.shotInfoLabel}>Faza akcji:</span>
                                <span className={styles.shotInfoValue}>
                                  {selectedShot.actionPhase === 'phase1' ? 'I faza' :
                                   selectedShot.actionPhase === 'phase2' ? 'II faza' :
                                   selectedShot.actionPhase === 'under8s' ? 'Do 8s' :
                                   selectedShot.actionPhase === 'over8s' ? 'Powyżej 8s' :
                                   selectedShot.actionPhase}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Wykres przyrostu xG w czasie meczu (skumulowany) */}
                    {xgChartData.length > 0 ? (
                      <div className={styles.chartContainerInPanel}>
                        <div className={styles.chartHeader}>
                          <h3>Przyrost xG w czasie meczu</h3>
                          {selectedMatches.length > 0 && xgChartData.length > 0 && (
                            <span className={styles.chartInfo}>{allShots.length} strzałów</span>
                          )}
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={xgChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="minute" 
                              label={{ value: 'Minuta', position: 'insideBottom', offset: -5 }}
                              tick={{ fontSize: 12 }}
                              domain={[0, 90]}
                              ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]}
                            />
                            <YAxis 
                              label={{ value: 'xG', angle: -90, position: 'insideLeft' }}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className={styles.tooltip}>
                                      <p className={styles.tooltipLabel}>{`Minuta: ${data.minute}'`}</p>
                                      <p style={{ color: '#3b82f6' }}>xG zespołu: {data.teamXG?.toFixed(2)}</p>
                                      <p style={{ color: TEAM_STATS_RED }}>xG przeciwnika: {data.opponentXG?.toFixed(2)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                            <Line 
                              type="monotone" 
                              dataKey="teamXG" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              name="xG zespołu (skumulowane)"
                              connectNulls={true}
                              dot={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="opponentXG" 
                              stroke={TEAM_STATS_RED} 
                              strokeWidth={2}
                              name="xG przeciwnika (skumulowane)"
                              connectNulls={true}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : null}
                    
                    {/* Wykres przyrostu xG co 5 minut */}
                    {xgChartData5Min.length > 0 && (
                      <div className={styles.chartContainerInPanel}>
                        <div className={styles.chartHeader}>
                          <h3>Przyrost xG co 5 minut</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={250}>
                          <ComposedChart data={xgChartData5Min} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                            <XAxis 
                              dataKey="minute" 
                              label={{ value: 'Przedział minutowy', position: 'insideBottom', offset: -5 }}
                              tick={{ fontSize: 11 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis 
                              label={{ value: 'xG', angle: -90, position: 'insideLeft' }}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className={styles.tooltip}>
                                      <p className={styles.tooltipLabel}>{`Przedział: ${data.minute} min`}</p>
                                      <p style={{ color: '#3b82f6' }}>xG zespołu: {data.teamXG?.toFixed(2)}</p>
                                      <p style={{ color: TEAM_STATS_RED }}>xG przeciwnika: {data.opponentXG?.toFixed(2)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar 
                              dataKey="opponentXG" 
                              fill={TEAM_STATS_RED} 
                              name="xG przeciwnika"
                              radius={[4, 4, 0, 0]}
                              opacity={0.8}
                            />
                            <Bar 
                              dataKey="teamXG" 
                              fill="#3b82f6" 
                              name="xG zespołu"
                              radius={[4, 4, 0, 0]}
                              opacity={0.8}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
            {false && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>Dane meczowe</h3>
                
                {selectedMatchInfo.matchData ? (
                  <div className={styles.matchDataDetails}>
                    {/* Przełącznik połowy */}
                    <div className={styles.matchDataPeriodSelector}>
                      <button
                        className={`${styles.periodButton} ${matchDataPeriod === 'total' ? styles.active : ''}`}
                        onClick={() => setMatchDataPeriod('total')}
                      >
                        Suma
                      </button>
                      <button
                        className={`${styles.periodButton} ${matchDataPeriod === 'firstHalf' ? styles.active : ''}`}
                        onClick={() => setMatchDataPeriod('firstHalf')}
                      >
                        1. połowa
                      </button>
                      <button
                        className={`${styles.periodButton} ${matchDataPeriod === 'secondHalf' ? styles.active : ''}`}
                        onClick={() => setMatchDataPeriod('secondHalf')}
                      >
                        2. połowa
                      </button>
                    </div>
                    {(() => {
                      const isHome = selectedMatchInfo.isHome;
                      const teamName = selectedMatchInfo.team ? (availableTeams.find(t => t.id === selectedMatchInfo.team)?.name || 'Nasz zespół') : 'Nasz zespół';
                      const opponentName = selectedMatchInfo.opponent || 'Przeciwnik';
                      
                      // Określ, który zespół jest gospodarzem, a który gościem
                      const homeTeamName = isHome ? teamName : opponentName;
                      const awayTeamName = isHome ? opponentName : teamName;
                      
                      // Funkcja pomocnicza do pobierania danych w zależności od wybranego okresu
                      const getData = (field: 'team' | 'opponent', half: 'FirstHalf' | 'SecondHalf' | null = null) => {
                        const period = matchDataPeriod === 'firstHalf' ? 'FirstHalf' : matchDataPeriod === 'secondHalf' ? 'SecondHalf' : null;
                        const useHalf = half || period;
                        
                        if (field === 'team') {
                          if (useHalf === 'FirstHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passes?.[`team${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInaccurate?.[`team${useHalf}`] || 0,
                            };
                          } else if (useHalf === 'SecondHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passes?.[`team${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInaccurate?.[`team${useHalf}`] || 0,
                            };
                          } else {
                            return {
                              accurate: (selectedMatchInfo.matchData?.passes?.teamFirstHalf || 0) + (selectedMatchInfo.matchData?.passes?.teamSecondHalf || 0),
                              inaccurate: (selectedMatchInfo.matchData?.passesInaccurate?.teamFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInaccurate?.teamSecondHalf || 0),
                            };
                          }
                        } else {
                          if (useHalf === 'FirstHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passes?.[`opponent${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInaccurate?.[`opponent${useHalf}`] || 0,
                            };
                          } else if (useHalf === 'SecondHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passes?.[`opponent${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInaccurate?.[`opponent${useHalf}`] || 0,
                            };
                          } else {
                            return {
                              accurate: (selectedMatchInfo.matchData?.passes?.opponentFirstHalf || 0) + (selectedMatchInfo.matchData?.passes?.opponentSecondHalf || 0),
                              inaccurate: (selectedMatchInfo.matchData?.passesInaccurate?.opponentFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInaccurate?.opponentSecondHalf || 0),
                            };
                          }
                        }
                      };
                      
                      const getOpponentHalfData = (field: 'team' | 'opponent', half: 'FirstHalf' | 'SecondHalf' | null = null) => {
                        const period = matchDataPeriod === 'firstHalf' ? 'FirstHalf' : matchDataPeriod === 'secondHalf' ? 'SecondHalf' : null;
                        const useHalf = half || period;
                        
                        if (field === 'team') {
                          if (useHalf === 'FirstHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passesInOpponentHalf?.[`team${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.[`team${useHalf}`] || 0,
                            };
                          } else if (useHalf === 'SecondHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passesInOpponentHalf?.[`team${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.[`team${useHalf}`] || 0,
                            };
                          } else {
                            return {
                              accurate: (selectedMatchInfo.matchData?.passesInOpponentHalf?.teamFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInOpponentHalf?.teamSecondHalf || 0),
                              inaccurate: (selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.teamFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.teamSecondHalf || 0),
                            };
                          }
                        } else {
                          if (useHalf === 'FirstHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passesInOpponentHalf?.[`opponent${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.[`opponent${useHalf}`] || 0,
                            };
                          } else if (useHalf === 'SecondHalf') {
                            return {
                              accurate: selectedMatchInfo.matchData?.passesInOpponentHalf?.[`opponent${useHalf}`] || 0,
                              inaccurate: selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.[`opponent${useHalf}`] || 0,
                            };
                          } else {
                            return {
                              accurate: (selectedMatchInfo.matchData?.passesInOpponentHalf?.opponentFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInOpponentHalf?.opponentSecondHalf || 0),
                              inaccurate: (selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.opponentFirstHalf || 0) + (selectedMatchInfo.matchData?.passesInOpponentHalfInaccurate?.opponentSecondHalf || 0),
                            };
                          }
                        }
                      };
                      
                      const get8sActions = (field: 'team' | 'opponent', type: 'successful' | 'unsuccessful') => {
                        const dataField = type === 'successful' ? 'successful8sActions' : 'unsuccessful8sActions';
                        if (matchDataPeriod === 'firstHalf') {
                          return selectedMatchInfo.matchData?.[dataField]?.[`${field}FirstHalf`] || 0;
                        } else if (matchDataPeriod === 'secondHalf') {
                          return selectedMatchInfo.matchData?.[dataField]?.[`${field}SecondHalf`] || 0;
                        } else {
                          return (selectedMatchInfo.matchData?.[dataField]?.[`${field}FirstHalf`] || 0) + (selectedMatchInfo.matchData?.[dataField]?.[`${field}SecondHalf`] || 0);
                        }
                      };
                      
                      const getPossession = (field: 'team' | 'opponent') => {
                        if (matchDataPeriod === 'firstHalf') {
                          return selectedMatchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0;
                        } else if (matchDataPeriod === 'secondHalf') {
                          return selectedMatchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0;
                        } else {
                          return (selectedMatchInfo.matchData?.possession?.[`${field}FirstHalf`] || 0) + (selectedMatchInfo.matchData?.possession?.[`${field}SecondHalf`] || 0);
                        }
                      };
                      
                      // Dane dla gospodarza i gościa
                      const homeOwnHalf = isHome ? getData('team') : getData('opponent');
                      const awayOwnHalf = isHome ? getData('opponent') : getData('team');
                      const homeOpponentHalf = isHome ? getOpponentHalfData('team') : getOpponentHalfData('opponent');
                      const awayOpponentHalf = isHome ? getOpponentHalfData('opponent') : getOpponentHalfData('team');
                      const home8s = isHome ? get8sActions('team', 'successful') : get8sActions('opponent', 'successful');
                      const away8s = isHome ? get8sActions('opponent', 'successful') : get8sActions('team', 'successful');
                      const home8sUnsuccessful = isHome ? get8sActions('team', 'unsuccessful') : get8sActions('opponent', 'unsuccessful');
                      const away8sUnsuccessful = isHome ? get8sActions('opponent', 'unsuccessful') : get8sActions('team', 'unsuccessful');
                      const homePossession = isHome ? getPossession('team') : getPossession('opponent');
                      const awayPossession = isHome ? getPossession('opponent') : getPossession('team');
                      const totalPossession = homePossession + awayPossession;
                      const homePossessionPercent = totalPossession > 0 ? ((homePossession / totalPossession) * 100).toFixed(1) : '0.0';
                      const awayPossessionPercent = totalPossession > 0 ? ((awayPossession / totalPossession) * 100).toFixed(1) : '0.0';
                      
                      // Oblicz sumy podań
                      const homeTotalPasses = (homeOwnHalf.accurate + homeOwnHalf.inaccurate) + (homeOpponentHalf.accurate + homeOpponentHalf.inaccurate);
                      const homeTotalAccurate = homeOwnHalf.accurate + homeOpponentHalf.accurate;
                      const homeTotalInaccurate = homeOwnHalf.inaccurate + homeOpponentHalf.inaccurate;
                      const homeTotalPercent = homeTotalPasses > 0 ? ((homeTotalAccurate / homeTotalPasses) * 100).toFixed(1) : '0.0';
                      
                      const awayTotalPasses = (awayOwnHalf.accurate + awayOwnHalf.inaccurate) + (awayOpponentHalf.accurate + awayOpponentHalf.inaccurate);
                      const awayTotalAccurate = awayOwnHalf.accurate + awayOpponentHalf.accurate;
                      const awayTotalInaccurate = awayOwnHalf.inaccurate + awayOpponentHalf.inaccurate;
                      const awayTotalPercent = awayTotalPasses > 0 ? ((awayTotalAccurate / awayTotalPasses) * 100).toFixed(1) : '0.0';
                      
                      const homeOwnTotal = homeOwnHalf.accurate + homeOwnHalf.inaccurate;
                      const homeOwnPercent = homeOwnTotal > 0 ? ((homeOwnHalf.accurate / homeOwnTotal) * 100).toFixed(1) : '0.0';
                      const awayOwnTotal = awayOwnHalf.accurate + awayOwnHalf.inaccurate;
                      const awayOwnPercent = awayOwnTotal > 0 ? ((awayOwnHalf.accurate / awayOwnTotal) * 100).toFixed(1) : '0.0';
                      
                      const homeOppTotal = homeOpponentHalf.accurate + homeOpponentHalf.inaccurate;
                      const homeOppPercent = homeOppTotal > 0 ? ((homeOpponentHalf.accurate / homeOppTotal) * 100).toFixed(1) : '0.0';
                      const awayOppTotal = awayOpponentHalf.accurate + awayOpponentHalf.inaccurate;
                      const awayOppPercent = awayOppTotal > 0 ? ((awayOpponentHalf.accurate / awayOppTotal) * 100).toFixed(1) : '0.0';
                      
                      
                      return (
                        <div className={styles.matchDataTable}>
                          {/* Nagłówek tabeli */}
                          <div className={styles.matchDataTableHeader}>
                            <div className={styles.matchDataTableHeaderCell}>
                              {(() => {
                                const homeTeam = isHome 
                                  ? availableTeams.find(t => t.id === selectedMatchInfo.team)
                                  : null;
                                const homeLogo = isHome 
                                  ? ((homeTeam as any)?.logo || null)
                                  : (selectedMatchInfo.opponentLogo || null);
                                return (
                                  <>
                                    {homeLogo && (
                                      <img 
                                        src={homeLogo} 
                                        alt={homeTeamName}
                                        className={styles.teamLogoInHeader}
                                      />
                                    )}
                                    <span>{homeTeamName}</span>
                                  </>
                                );
                              })()}
                            </div>
                            <div className={styles.matchDataTableHeaderCell}></div>
                            <div className={styles.matchDataTableHeaderCell}>
                              {(() => {
                                const awayTeam = isHome 
                                  ? null
                                  : availableTeams.find(t => t.id === selectedMatchInfo.team);
                                const awayLogo = isHome 
                                  ? (selectedMatchInfo.opponentLogo || null)
                                  : ((awayTeam as any)?.logo || null);
                                return (
                                  <>
                                    {awayLogo && (
                                      <img 
                                        src={awayLogo} 
                                        alt={awayTeamName}
                                        className={styles.teamLogoInHeader}
                                      />
                                    )}
                                    <span>{awayTeamName}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          
                          {/* Wynik meczu */}
                          {(() => {
                            // Filtruj strzały według wybranego okresu
                            const filteredShots = allShots.filter(shot => {
                              if (matchDataPeriod === 'firstHalf') {
                                return shot.minute <= 45;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return shot.minute > 45;
                              }
                              return true; // total - wszystkie strzały
                            });
                            
                            // Oblicz gole dla gospodarza i gościa
                            const homeShots = filteredShots.filter(shot => {
                        const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent);
                            });
                            const awayShots = filteredShots.filter(shot => {
                              const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team);
                            });
                            
                            const homeGoals = homeShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                            const awayGoals = awayShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                            const homeNPGoals = homeShots.filter(shot => 
                              (shot.isGoal || shot.shotType === 'goal') && shot.actionType !== 'penalty'
                      ).length;
                            const awayNPGoals = awayShots.filter(shot => 
                              (shot.isGoal || shot.shotType === 'goal') && shot.actionType !== 'penalty'
                      ).length;
                      
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell}>
                                    {homeGoals}
                                  </div>
                                  <div className={styles.matchDataTableLabel}>Wynik</div>
                                  <div className={styles.matchDataTableCell}>
                                    {awayGoals}
                                  </div>
                                </div>
                                {homeNPGoals !== homeGoals || awayNPGoals !== awayGoals ? (
                                  <div className={styles.matchDataTableRow}>
                                    <div className={styles.matchDataTableCell} style={{ fontSize: '0.85em', color: '#6b7280' }}>
                                      NP {homeNPGoals}
                                    </div>
                                    <div className={styles.matchDataTableSubLabel}>NPgole</div>
                                    <div className={styles.matchDataTableCell} style={{ fontSize: '0.85em', color: '#6b7280' }}>
                                      NP {awayNPGoals}
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                          
                          {/* xG - wynik - PRZED strzałami */}
                          {(() => {
                            // Filtruj strzały według wybranego okresu
                            const filteredShots = allShots.filter(shot => {
                              if (matchDataPeriod === 'firstHalf') {
                                return shot.minute <= 45;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return shot.minute > 45;
                              }
                              return true; // total - wszystkie strzały
                            });
                            
                            // Oblicz xG dla gospodarza i gościa
                            const homeShots = filteredShots.filter(shot => {
                              // Określ zespół strzału na podstawie teamId lub teamContext
                              const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent);
                            });
                            const awayShots = filteredShots.filter(shot => {
                              const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team);
                            });
                            
                            const homeXG = homeShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            const awayXG = awayShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            const homeShotsCount = homeShots.length;
                            const awayShotsCount = awayShots.length;
                            
                            // Oblicz NPxG (non-penalty xG) - bez rzutów karnych
                            const homeShotsNonPenalty = homeShots.filter(shot => 
                              shot.actionType !== 'penalty'
                            );
                            const awayShotsNonPenalty = awayShots.filter(shot => 
                              shot.actionType !== 'penalty'
                            );
                            const homeNPxG = homeShotsNonPenalty.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            const awayNPxG = awayShotsNonPenalty.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            const homeNPxGPerShot = homeShotsNonPenalty.length > 0 ? (homeNPxG / homeShotsNonPenalty.length).toFixed(2) : '0.00';
                            const awayNPxGPerShot = awayShotsNonPenalty.length > 0 ? (awayNPxG / awayShotsNonPenalty.length).toFixed(2) : '0.00';
                            const homeXGPerShot = homeShotsCount > 0 ? (homeXG / homeShotsCount).toFixed(3) : '0.000';
                            const awayXGPerShot = awayShotsCount > 0 ? (awayXG / awayShotsCount).toFixed(3) : '0.000';
                            
                            // Oblicz xG SFG - strzały z akcji SFG
                            const homeShotsSFG = homeShots.filter(shot => 
                        (shot as any).actionCategory === 'sfg' || 
                        shot.actionType === 'corner' || 
                        shot.actionType === 'free_kick' || 
                        shot.actionType === 'direct_free_kick' || 
                        shot.actionType === 'penalty' || 
                        shot.actionType === 'throw_in'
                      );
                            const awayShotsSFG = awayShots.filter(shot => 
                              (shot as any).actionCategory === 'sfg' || 
                              shot.actionType === 'corner' || 
                              shot.actionType === 'free_kick' || 
                              shot.actionType === 'direct_free_kick' || 
                              shot.actionType === 'penalty' || 
                              shot.actionType === 'throw_in'
                            );
                            const homeXGSFG = homeShotsSFG.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            const awayXGSFG = awayShotsSFG.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                            
                            // Oblicz xG z akcji Regain - strzały w ciągu 8s po akcjach regain
                            const homeTeamId = isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent;
                            const awayTeamId = isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;
                            
                            // Znajdź wszystkie akcje z flagą regain (z actions_packing lub actions_regain)
                            const allRegainActionsCombined = [
                              ...allRegainActions,
                              ...allActions.filter(action => {
                                // Sprawdź czy akcja ma flagę isRegain lub jest z actions_regain
                                return (action as any).isRegain === true || isRegainAction(action);
                              })
                            ];
                            
                            // Usuń duplikaty na podstawie id lub unikalnego identyfikatora
                            const uniqueRegainActions = Array.from(
                              new Map(allRegainActionsCombined.map(action => [action.id || `${action.minute}_${action.x}_${action.y}`, action])).values()
                            );
                            
                            // Przygotuj regain actions z timestampami
                            const regainActionsWithTimestamp = uniqueRegainActions
                              .map(action => {
                                const timestamp = (action as any).videoTimestampRaw ?? action.videoTimestamp ?? 0;
                                return { action, timestamp };
                              })
                              .filter(item => item.timestamp > 0)
                              .sort((a, b) => a.timestamp - b.timestamp);
                            
                            // Filtruj regain actions według okresu
                            const filteredRegainActions = regainActionsWithTimestamp.filter(item => {
                              if (matchDataPeriod === 'firstHalf') {
                                return item.action.minute <= 45;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return item.action.minute > 45;
                              }
                              return true;
                            });
                            
                            // Przygotuj strzały z timestampami
                            const shotsWithTimestamp = filteredShots.map(shot => {
                              const timestamp = (shot as any).videoTimestampRaw ?? shot.videoTimestamp ?? 0;
                              return { shot, timestamp };
                            }).filter(item => item.timestamp > 0);
                            
                            // Oblicz xG z akcji Regain dla home i away
                            let homeXGRegain = 0;
                            let awayXGRegain = 0;
                            
                            filteredRegainActions.forEach((regainItem, index) => {
                              const regainTimestamp = regainItem.timestamp;
                              const nextRegainTimestamp = index < filteredRegainActions.length - 1
                                ? filteredRegainActions[index + 1].timestamp
                                : Infinity;
                              const eightSecondsAfterRegain = regainTimestamp + 8;
                              
                              // Określ zespół akcji regain
                              const regainTeamId = regainItem.action.teamId || 
                                ((regainItem.action as any).teamContext === 'attack'
                                  ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                  : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              
                              // Znajdź strzały w ciągu 8s po akcji regain
                              const shots8s = shotsWithTimestamp.filter(item => {
                                if (item.timestamp <= regainTimestamp || item.timestamp > eightSecondsAfterRegain || item.timestamp >= nextRegainTimestamp) {
                                  return false;
                                }
                                const shotTeamId = item.shot.teamId || (item.shot.teamContext === 'attack' 
                                  ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                  : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                                return shotTeamId === regainTeamId;
                              });
                              
                              const xg8s = shots8s.reduce((sum, item) => sum + (item.shot.xG || 0), 0);
                              
                              if (regainTeamId === homeTeamId) {
                                homeXGRegain += xg8s;
                              } else if (regainTeamId === awayTeamId) {
                                awayXGRegain += xg8s;
                              }
                            });
                            
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell}>
                                    {homeXG.toFixed(2)}
                                  </div>
                                  <div 
                                    className={`${styles.matchDataTableLabel} ${styles.clickable}`}
                                    onClick={() => setXgExpandedMatchData(!xgExpandedMatchData)}
                                  >
                                    xG
                                    <span className={`${styles.expandIcon} ${xgExpandedMatchData ? styles.expanded : ''}`}>
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </span>
                                  </div>
                                  <div className={styles.matchDataTableCell}>
                                    {awayXG.toFixed(2)}
                                  </div>
                                </div>
                                
                                {/* Szczegóły xG - zwijane */}
                                {xgExpandedMatchData && (
                                  <>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homeNPxG.toFixed(2)}
                                      </div>
                                      <div 
                                        className={`${styles.matchDataTableSubLabel} ${styles.tooltipTrigger}`}
                                        data-tooltip="xG bez karnych"
                                      >
                                        NP xG
                                      </div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayNPxG.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homeXGRegain.toFixed(2)}
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>xG z akcji Regain</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayXGRegain.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homeXGSFG.toFixed(2)}
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>xG SFG</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayXGSFG.toFixed(2)}
                                      </div>
                                    </div>
                                    
                                    {/* Wejścia w PK - szczegóły (wszystkie - atak i obrona) */}
                                    {(() => {
                                      // Filtruj wejścia w PK według wybranego okresu i meczu (WSZYSTKIE - atak i obrona)
                                      const filteredPKEntries = allPKEntries.filter((entry: any) => {
                                        // Filtruj według meczu (teamId jest zawsze nasz zespół)
                                        if (entry.teamId !== selectedTeam) {
                                          return false;
                                        }
                                        // Filtruj według okresu
                                        if (matchDataPeriod === 'firstHalf') {
                                          return entry.minute <= 45;
                                        } else if (matchDataPeriod === 'secondHalf') {
                                          return entry.minute > 45;
                                        }
                                        return true;
                                      });
                                      
                                      // Określ zespół wejścia w PK (wszystkie - atak i obrona)
                                      // UWAGA: teamId jest zawsze nasz zespół (selectedTeam), nawet dla defense
                                      // teamContext === 'attack' = nasze wejścia, teamContext === 'defense' = wejścia przeciwnika
                                      // homePKEntries = wejścia gospodarza, awayPKEntries = wejścia gościa
                                      const homePKEntries = filteredPKEntries.filter((entry: any) => {
                                        const teamContext = entry.teamContext ?? 'attack';
                                        if (teamContext === 'attack') {
                                          // Nasze wejścia - jeśli nasz zespół jest gospodarzem, to to są wejścia gospodarza
                                          return isHome;
                                        } else {
                                          // Wejścia przeciwnika (defense) - jeśli nasz zespół jest gościem, to przeciwnik jest gospodarzem
                                          return !isHome;
                                        }
                                      });
                                      const awayPKEntries = filteredPKEntries.filter((entry: any) => {
                                        const teamContext = entry.teamContext ?? 'attack';
                                        if (teamContext === 'attack') {
                                          // Nasze wejścia - jeśli nasz zespół jest gościem, to to są wejścia gościa
                                          return !isHome;
                                        } else {
                                          // Wejścia przeciwnika (defense) - jeśli nasz zespół jest gospodarzem, to przeciwnik jest gościem
                                          return isHome;
                                        }
                                      });
                                      
                                      // Podania (wszystkie - atak i obrona)
                                      const homePKPasses = homePKEntries.filter((entry: any) => 
                                        (entry.entryType === 'pass' || entry.actionType === 'pass')
                                      ).length;
                                      const awayPKPasses = awayPKEntries.filter((entry: any) => 
                                        (entry.entryType === 'pass' || entry.actionType === 'pass')
                                      ).length;
                                      
                                      // Drybling (wszystkie - atak i obrona)
                                      const homePKDribbles = homePKEntries.filter((entry: any) => 
                                        (entry.entryType === 'dribble' || entry.actionType === 'dribble')
                                      ).length;
                                      const awayPKDribbles = awayPKEntries.filter((entry: any) => 
                                        (entry.entryType === 'dribble' || entry.actionType === 'dribble')
                                      ).length;
                                      
                                      return (
                                        <>
                                          <div className={styles.matchDataTableRow}>
                                            <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                              {homePKPasses}
                                            </div>
                                            <div className={styles.matchDataTableSubLabel}>Podania</div>
                                            <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                              {awayPKPasses}
                                            </div>
                                          </div>
                                          <div className={styles.matchDataTableRow}>
                                            <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                              {homePKDribbles}
                                            </div>
                                            <div className={styles.matchDataTableSubLabel}>Drybling</div>
                                            <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                              {awayPKDribbles}
                                            </div>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                              </>
                            );
                          })()}
                          
                          {/* Strzały - bezpośrednio pod xG */}
                          {(() => {
                            // Filtruj strzały według wybranego okresu
                            const filteredShots = allShots.filter(shot => {
                              if (matchDataPeriod === 'firstHalf') {
                                return shot.minute <= 45;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return shot.minute > 45;
                              }
                              return true;
                            });
                            
                            // Oblicz gole dla gospodarza i gościa
                            const homeShots = filteredShots.filter(shot => {
                              const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent);
                            });
                            const awayShots = filteredShots.filter(shot => {
                              const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                                ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                                : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                              return shotTeamId === (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team);
                            });
                            
                            // Statystyki strzałów
                            const homeShotsTotal = homeShots.length;
                            const awayShotsTotal = awayShots.length;
                            const homeShotsOnTarget = homeShots.filter(shot => 
                              shot.shotType === 'on_target' || shot.shotType === 'goal' || shot.isGoal
                            ).length;
                            const awayShotsOnTarget = awayShots.filter(shot => 
                              shot.shotType === 'on_target' || shot.shotType === 'goal' || shot.isGoal
                            ).length;
                            const homeShotsOffTarget = homeShots.filter(shot => 
                              shot.shotType === 'off_target'
                            ).length;
                            const awayShotsOffTarget = awayShots.filter(shot => 
                              shot.shotType === 'off_target'
                            ).length;
                            const homeShotsBlocked = homeShots.filter(shot => 
                              shot.shotType === 'blocked'
                            ).length;
                            const awayShotsBlocked = awayShots.filter(shot => 
                              shot.shotType === 'blocked'
                            ).length;
                            const homeAccuracy = homeShotsTotal > 0 
                              ? ((homeShotsOnTarget / homeShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                            const awayAccuracy = awayShotsTotal > 0 
                              ? ((awayShotsOnTarget / awayShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                            
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell}>
                                    {homeShotsTotal}
                                  </div>
                                  <div 
                                    className={`${styles.matchDataTableLabel} ${styles.clickable}`}
                                    onClick={() => setShotsExpanded(!shotsExpanded)}
                                  >
                                    Strzały
                                    <span className={`${styles.expandIcon} ${shotsExpanded ? styles.expanded : ''}`}>
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </span>
                                  </div>
                                  <div className={styles.matchDataTableCell}>
                                    {awayShotsTotal}
                                  </div>
                                </div>
                                
                                {/* Szczegóły strzałów - zwijane */}
                                {shotsExpanded && (
                                  <>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right', fontSize: '0.85em', color: '#6b7280' }}>
                                        {homeShotsOnTarget} / {homeShotsOffTarget} / {homeShotsBlocked}
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>celne / niecelne / zablokowane</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left', fontSize: '0.85em', color: '#6b7280' }}>
                                        {awayShotsOnTarget} / {awayShotsOffTarget} / {awayShotsBlocked}
                                      </div>
                                    </div>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({homeShotsOnTarget}/{homeShotsTotal})</span> <span>{homeAccuracy}%</span>
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>% celności</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        <span>{awayAccuracy}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({awayShotsOnTarget}/{awayShotsTotal})</span>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                          
                          {/* Wejścia w PK - liczba (tylko w ataku) */}
                          {(() => {
                            // Filtruj wejścia w PK według wybranego okresu i meczu
                            const filteredPKEntries = allPKEntries.filter((entry: any) => {
                              // Filtruj według meczu (teamId jest zawsze nasz zespół)
                              if (entry.teamId !== selectedTeam) {
                                return false;
                              }
                              // Filtruj według okresu
                              if (matchDataPeriod === 'firstHalf') {
                                return entry.minute <= 45;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return entry.minute > 45;
                              }
                              return true;
                            });
                            
                            // Wejścia w ataku dla gospodarza (nasze wejścia w ataku)
                            // UWAGA: teamId jest zawsze nasz zespół (selectedTeam), nawet dla defense
                            // teamContext === 'attack' = nasze wejścia, teamContext === 'defense' = wejścia przeciwnika
                            const homePKEntriesAttack = filteredPKEntries.filter((entry: any) => {
                              const teamContext = entry.teamContext ?? 'attack';
                              if (teamContext === 'attack') {
                                // Nasze wejścia - jeśli nasz zespół jest gospodarzem, to to są wejścia gospodarza
                                return isHome;
                              }
                              return false;
                            });
                            
                            // Wejścia w ataku dla gościa (wejścia przeciwnika w ataku = nasze wejścia w obronie)
                            // UWAGA: teamId jest zawsze nasz zespół (selectedTeam), nawet dla defense
                            // teamContext === 'defense' = wejścia przeciwnika (czyli przeciwnik w ataku = nasze wejścia w obronie)
                            const awayPKEntriesAttack = filteredPKEntries.filter((entry: any) => {
                              const teamContext = entry.teamContext ?? 'attack';
                              if (teamContext === 'defense') {
                                // Wejścia przeciwnika (defense) - jeśli nasz zespół jest gospodarzem, to przeciwnik jest gościem
                                return isHome;
                              }
                              return false;
                            });
                            
                            // Oblicz podania i drybling dla rozwijanej sekcji (wszystkie wejścia w ataku)
                            const homePKPasses = homePKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'pass' || entry.actionType === 'pass')
                            ).length;
                            const awayPKPasses = awayPKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'pass' || entry.actionType === 'pass')
                            ).length;
                            
                            const homePKDribbles = homePKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'dribble' || entry.actionType === 'dribble')
                            ).length;
                            const awayPKDribbles = awayPKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'dribble' || entry.actionType === 'dribble')
                            ).length;
                            
                            // Oblicz regain dla dryblingu
                            const homePKDribblesRegain = homePKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'dribble' || entry.actionType === 'dribble') && entry.isRegain === true
                            ).length;
                            const awayPKDribblesRegain = awayPKEntriesAttack.filter((entry: any) => 
                              (entry.entryType === 'dribble' || entry.actionType === 'dribble') && entry.isRegain === true
                            ).length;
                            
                            const homePKDribblesRegainPerc = homePKDribbles > 0 ? ((homePKDribblesRegain / homePKDribbles) * 100).toFixed(1) : '0.0';
                            const awayPKDribblesRegainPerc = awayPKDribbles > 0 ? ((awayPKDribblesRegain / awayPKDribbles) * 100).toFixed(1) : '0.0';
                            
                            // Oblicz procenty dla podań
                            const homePKPassesPerc = homePKEntriesAttack.length > 0 ? ((homePKPasses / homePKEntriesAttack.length) * 100).toFixed(1) : '0.0';
                            const awayPKPassesPerc = awayPKEntriesAttack.length > 0 ? ((awayPKPasses / awayPKEntriesAttack.length) * 100).toFixed(1) : '0.0';
                            
                            // Oblicz różnicę bezwzględną względem KPI=11 dla "Wejścia w PK"
                            // KPI = 11, więc wszystko powyżej 11 to źle (czerwony), poniżej 11 to dobrze (zielony)
                            const kpiPKEntriesAttack = 11;
                            const homePKEntriesAttackCount = homePKEntriesAttack.length;
                            const awayPKEntriesAttackCount = awayPKEntriesAttack.length;
                            
                            const awayAttackDiff = awayPKEntriesAttackCount - kpiPKEntriesAttack;
                            
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                    {homePKEntriesAttackCount}
                                  </div>
                                  <div 
                                    className={`${styles.matchDataTableLabel} ${styles.clickable}`}
                                    onClick={() => setPkEntriesExpandedMatchData(!pkEntriesExpandedMatchData)}
                                  >
                                    Wejścia w PK
                                    <span className={`${styles.expandIcon} ${pkEntriesExpandedMatchData ? styles.expanded : ''}`}>
                                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </span>
                                  </div>
                                  <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                    {awayPKEntriesAttackCount}
                                    {awayAttackDiff !== 0 && (
                                      <span style={{ 
                                        color: awayPKEntriesAttackCount > kpiPKEntriesAttack ? TEAM_STATS_RED : TEAM_STATS_GREEN, 
                                        marginLeft: '4px', 
                                        fontSize: '0.85em' 
                                      }}>
                                        {awayAttackDiff > 0 ? '+' : ''}{awayAttackDiff}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Szczegóły wejść w PK - zwijane */}
                                {pkEntriesExpandedMatchData && (
                                  <>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homePKPasses} ({homePKPassesPerc}%)
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>Podania</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayPKPasses} ({awayPKPassesPerc}%)
                                      </div>
                                    </div>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homePKDribbles} ({homePKEntriesAttack.length > 0 ? ((homePKDribbles / homePKEntriesAttack.length) * 100).toFixed(1) : '0.0'}%)
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>Drybling</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayPKDribbles} ({awayPKEntriesAttack.length > 0 ? ((awayPKDribbles / awayPKEntriesAttack.length) * 100).toFixed(1) : '0.0'}%)
                                      </div>
                                    </div>
                                    <div className={styles.matchDataTableRow}>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                        {homePKDribblesRegain} ({homePKDribblesRegainPerc}%)
                                      </div>
                                      <div className={styles.matchDataTableSubLabel}>Po regain</div>
                                      <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                        {awayPKDribblesRegain} ({awayPKDribblesRegainPerc}%)
                                      </div>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                          
                          {/* Przechwyty na połowie przeciwnika - osobny wiersz */}
                          {(() => {
                            // Oblicz dla każdego zespołu osobno (użyj tej samej logiki co teamRegainStats i teamLosesStats)
                            const homeTeamId = isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent;
                            const awayTeamId = isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;
                            
                            // Funkcja pomocnicza (ta sama co w teamRegainStats)
                            const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                              if (!zoneName) return false;
                              const normalized = convertZoneToName(zoneName);
                              if (!normalized) return false;
                              const zoneIdx = zoneNameToIndex(normalized);
                              if (zoneIdx === null) return false;
                              return isOwnHalfByZoneColumn(zoneName);
                            };
                            
                            // Oblicz przechwyty na połowie przeciwnika dla gospodarza
                            // Używamy tej samej logiki co teamRegainStats: sprawdzamy regainAttackZone
                            const calculateRegainOpponentHalf = (teamId: string) => {
                              const teamRegainActionsFiltered = allRegainActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedRegainActionsForTeam = teamRegainActionsFiltered.length > 0
                                ? teamRegainActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isRegainAction(action);
                                    }
                                    return false;
                                  });
                              
                              const filtered = derivedRegainActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              let total = 0;
                              filtered.forEach((action: any) => {
                                const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                                
                                // Strefa ataku przechwytu (jak na mapie) + fallback z obrony
                                const attackZoneRaw = regainAttackZoneRawForMap(action);
                                const attackZoneName = attackZoneRaw
                                  ? convertZoneToName(attackZoneRaw)
                                  : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);
                                
                                if (attackZoneName) {
                                  const isOwn = isOwnHalf(attackZoneName);
                                  // Jeśli attackZone jest na własnej połowie (isOwn = true), to regain nastąpił na połowie przeciwnika
                                  if (isOwn) total += 1;
                                }
                              });
                              return total;
                            };
                            
                            const homeRegainsOpponentHalf = calculateRegainOpponentHalf(homeTeamId);
                            // Dla gości: użyj tej samej funkcji
                            const awayRegainsOpponentHalf = calculateRegainOpponentHalf(awayTeamId);
                            
                            // Oblicz liczbę strat do 5s od przechwytów na połowie przeciwnika dla danego zespołu
                            const calculateLosesAfterRegain5s = (teamId: string) => {
                              // Filtruj przechwyty dla danego zespołu
                              const teamRegainActionsFiltered = allRegainActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedRegainActionsForTeam = teamRegainActionsFiltered.length > 0
                                ? teamRegainActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isRegainAction(action);
                                    }
                                    return false;
                                  });
                              
                              // Filtruj według okresu meczu
                              const filtered = derivedRegainActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              // Filtruj tylko przechwyty na połowie przeciwnika
                              const regainsOnOpponentHalf = filtered.filter((action: any) => {
                                const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                                if (defenseZoneName) {
                                  const isOwn = isOwnHalf(defenseZoneName);
                                  if (!isOwn) return true; // Na połowie przeciwnika
                                }
                                return false;
                              });
                              
                              // Przygotuj straty z timestampami
                              const allLosesWithTimestamp = allLosesActions
                                .map(lose => ({
                                  lose,
                                  timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
                                }))
                                .filter(item => item.timestamp > 0)
                                .sort((a, b) => a.timestamp - b.timestamp);
                              
                              // Przygotuj przechwyty z timestampami
                              const regainsWithTimestamp = regainsOnOpponentHalf
                                .map(action => ({
                                  action,
                                  timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                                }))
                                .filter(item => item.timestamp > 0)
                                .sort((a, b) => a.timestamp - b.timestamp);
                              
                              let totalLoses = 0;
                              
                              // Dla każdego przechwytu na połowie przeciwnika, znajdź straty w ciągu 5s
                              regainsWithTimestamp.forEach((regainItem, index) => {
                                const regainTimestamp = regainItem.timestamp;
                                const nextRegainTimestamp = index < regainsWithTimestamp.length - 1
                                  ? regainsWithTimestamp[index + 1].timestamp
                                  : Infinity;
                                const fiveSecondsAfterRegain = regainTimestamp + 5;
                                
                                // Znajdź straty tego samego zespołu w ciągu 5s
                                const loses5s = allLosesWithTimestamp.filter(item => {
                                  if (item.timestamp <= regainTimestamp || item.timestamp > fiveSecondsAfterRegain || item.timestamp >= nextRegainTimestamp) {
                                    return false;
                                  }
                                  const loseTeamId = item.lose.teamId || teamId;
                                  return loseTeamId === teamId;
                                });
                                
                                totalLoses += loses5s.length;
                              });
                              
                              return totalLoses;
                            };
                            
                            const homeLosesAfterRegain5s = calculateLosesAfterRegain5s(homeTeamId);
                            const homeLosesAfterRegain5sPct = homeRegainsOpponentHalf > 0 
                              ? (homeLosesAfterRegain5s / homeRegainsOpponentHalf) * 100 
                              : 0;
                            
                            // Oblicz liczbę strat do 5s od przechwytów dla całego boiska (nie tylko na połowie przeciwnika)
                            const calculateLosesAfterRegain5sAllField = (teamId: string) => {
                              // Filtruj przechwyty dla danego zespołu
                              const teamRegainActionsFiltered = allRegainActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedRegainActionsForTeam = teamRegainActionsFiltered.length > 0
                                ? teamRegainActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isRegainAction(action);
                                    }
                                    return false;
                                  });
                              
                              // Filtruj według okresu meczu
                              const filtered = derivedRegainActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              // Użyj wszystkich przechwytów (nie filtruj według połowy)
                              const allRegains = filtered;
                              
                              // Przygotuj straty z timestampami
                              const allLosesWithTimestamp = allLosesActions
                                .map(lose => ({
                                  lose,
                                  timestamp: lose.videoTimestampRaw ?? lose.videoTimestamp ?? 0,
                                }))
                                .filter(item => item.timestamp > 0)
                                .sort((a, b) => a.timestamp - b.timestamp);
                              
                              // Przygotuj przechwyty z timestampami
                              const regainsWithTimestamp = allRegains
                                .map(action => ({
                                  action,
                                  timestamp: action.videoTimestampRaw ?? action.videoTimestamp ?? 0,
                                }))
                                .filter(item => item.timestamp > 0)
                                .sort((a, b) => a.timestamp - b.timestamp);
                              
                              let totalLoses = 0;
                              
                              // Dla każdego przechwytu, znajdź straty w ciągu 5s
                              regainsWithTimestamp.forEach((regainItem, index) => {
                                const regainTimestamp = regainItem.timestamp;
                                const nextRegainTimestamp = index < regainsWithTimestamp.length - 1
                                  ? regainsWithTimestamp[index + 1].timestamp
                                  : Infinity;
                                const fiveSecondsAfterRegain = regainTimestamp + 5;
                                
                                // Znajdź straty tego samego zespołu w ciągu 5s
                                const loses5s = allLosesWithTimestamp.filter(item => {
                                  if (item.timestamp <= regainTimestamp || item.timestamp > fiveSecondsAfterRegain || item.timestamp >= nextRegainTimestamp) {
                                    return false;
                                  }
                                  const loseTeamId = item.lose.teamId || teamId;
                                  return loseTeamId === teamId;
                                });
                                
                                totalLoses += loses5s.length;
                              });
                              
                              return totalLoses;
                            };
                            
                            // Oblicz całkowitą liczbę przechwytów dla każdego zespołu
                            const calculateTotalRegains = (teamId: string) => {
                              const teamRegainActionsFiltered = allRegainActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedRegainActionsForTeam = teamRegainActionsFiltered.length > 0
                                ? teamRegainActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isRegainAction(action);
                                    }
                                    return false;
                                  });
                              
                              const filtered = derivedRegainActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              return filtered.length;
                            };
                            
                            const homeLosesAfterRegain5sAllField = calculateLosesAfterRegain5sAllField(homeTeamId);
                            const homeTotalRegains = calculateTotalRegains(homeTeamId);
                            const homeLosesAfterRegain5sAllFieldPct = homeTotalRegains > 0 
                              ? (homeLosesAfterRegain5sAllField / homeTotalRegains) * 100 
                              : 0;
                            
                            // Dla gościa: oblicz straty do 5s od wszystkich strat (używamy countedLoses z calculateReaction5sForOwnHalfLoses)
                            // Ale potrzebujemy wszystkich przechwytów gościa
                            const awayTotalRegains = calculateTotalRegains(awayTeamId);
                            const awayLosesAfterRegain5sAllField = calculateLosesAfterRegain5sAllField(awayTeamId);
                            const awayLosesAfterRegain5sAllFieldPct = awayTotalRegains > 0 
                              ? (awayLosesAfterRegain5sAllField / awayTotalRegains) * 100 
                              : 0;
                            
                            // Oblicz straty na całym boisku i counterpressing (isReaction5s === true)
                            const calculateTotalLosesAndCounterpressing = (teamId: string) => {
                              // Filtruj straty dla danego zespołu
                              const teamLosesActionsFiltered = allLosesActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedLosesActionsForTeam = teamLosesActionsFiltered.length > 0
                                ? teamLosesActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isLosesAction(action);
                                    }
                                    return false;
                                  });
                              
                              // Filtruj według okresu meczu
                              const filtered = derivedLosesActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              // Policz wszystkie straty (bez isAut)
                              const totalLoses = filtered.filter((action: any) => 
                                action.isAut !== true
                              ).length;
                              
                              // Policz straty z flagą isReaction5s === true
                              const counterpressingLoses = filtered.filter((action: any) => {
                                return action.isReaction5s === true;
                              }).length;
                              
                              const counterpressingPct = totalLoses > 0 
                                ? (counterpressingLoses / totalLoses) * 100 
                                : 0;
                              
                              return {
                                totalLoses,
                                counterpressingLoses,
                                counterpressingPct,
                              };
                            };
                            
                            const homeLosesStats = calculateTotalLosesAndCounterpressing(homeTeamId);
                            const awayLosesStats = calculateTotalLosesAndCounterpressing(awayTeamId);
                            
                            // Oblicz liczbę strat na własnej połowie z flagą reakcji 5s (dla gości)
                            // Użyj dokładnie tych samych strat co teamLosesStats.totalLosesOwnHalf
                            // Musimy użyć tych samych danych co teamLosesStats - czyli filteredLosesActions
                            const calculateReaction5sForOwnHalfLoses = () => {
                              // Użyj dokładnie tych samych danych co teamLosesStats
                              // teamLosesStats używa filteredLosesActions, które są filtrowane według losesHalfFilter
                              // Musimy odtworzyć ten sam filtr
                              const isOwnHalf = (zoneName: string | null | undefined): boolean => {
                                if (!zoneName) return false;
                                const normalized = convertZoneToName(zoneName);
                                if (!normalized) return false;
                                return isOwnHalfByZoneColumn(normalized);
                              };
                              
                              // Filtruj według losesHalfFilter (tak samo jak teamLosesStats)
                              const filteredLosesActions = losesHalfFilter === "all"
                                ? derivedLosesActions
                                : losesHalfFilter === "pm"
                                ? derivedLosesActions.filter(action => {
                                    const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                                    const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                                    if (!losesZoneName) return false;
                                    const pmZones = ['C5', 'C6', 'C7', 'C8', 'D5', 'D6', 'D7', 'D8', 'E5', 'E6', 'E7', 'E8', 'F5', 'F6', 'F7', 'F8'];
                                    return pmZones.includes(losesZoneName);
                                  })
                                : derivedLosesActions.filter(action => {
                                    const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                                    const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                                    if (!losesZoneName) return false;
                                    const isOwn = isOwnHalf(losesZoneName);
                                    return losesHalfFilter === "own" ? isOwn : !isOwn;
                                  });
                              
                            // Filtruj straty dokładnie tak jak w teamLosesStats:
                            // totalLosesOwnHalf + totalLosesOpponentHalf
                            const countedLoses = filteredLosesActions.filter((action: any) => {
                                const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
                                const losesZoneName = losesZoneRaw ? convertZoneToName(losesZoneRaw) : null;
                              if (!losesZoneName) return false;
                              const isOwn = isOwnHalf(losesZoneName);
                              // Ten sam warunek co w teamLosesStats:
                              // - własna połowa: tylko bez aut
                              // - połowa przeciwnika: bez dodatkowego warunku
                              if (isOwn) {
                                return action.isAut !== true;
                              }
                              return true;
                              });
                              
                              // Policz tylko te z flagą isReaction5s === true (bez żadnych wykluczeń)
                              let reaction5sCount = 0;
                              
                            countedLoses.forEach(action => {
                                if (action.isReaction5s === true) {
                                  reaction5sCount += 1;
                                }
                              });
                              
                              return {
                                count: reaction5sCount,
                              };
                            };
                            
                            const awayReaction5s = calculateReaction5sForOwnHalfLoses();
                            
                            // Oblicz liczbę przechwytów na połowie przeciwnika z flagą isBelow8s === true
                            const calculateRegainsOpponentHalfBelow8s = (teamId: string) => {
                              // Filtruj przechwyty dla danego zespołu
                              const teamRegainActionsFiltered = allRegainActions.filter((action: any) => {
                                if (!action.teamId) return true;
                                return action.teamId === teamId;
                              });
                              
                              const derivedRegainActionsForTeam = teamRegainActionsFiltered.length > 0
                                ? teamRegainActionsFiltered
                                : allActions.filter((action: any) => {
                                    if (!action.teamId || action.teamId === teamId) {
                                      return isRegainAction(action);
                                    }
                                    return false;
                                  });
                              
                              // Filtruj według okresu meczu
                              const filtered = derivedRegainActionsForTeam.filter((action: any) => {
                                if (matchDataPeriod === 'firstHalf') return action.minute <= 45;
                                if (matchDataPeriod === 'secondHalf') return action.minute > 45;
                                return true;
                              });
                              
                              // Filtruj tylko przechwyty na połowie przeciwnika z flagą isBelow8s === true
                              const regainsOnOpponentHalfBelow8s = filtered.filter((action: any) => {
                                const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                                if (defenseZoneName) {
                                  const isOwn = isOwnHalf(defenseZoneName);
                                  if (!isOwn && action.isBelow8s === true) {
                                    return true; // Na połowie przeciwnika i isBelow8s === true
                                  }
                                }
                                return false;
                              });
                              
                              return regainsOnOpponentHalfBelow8s.length;
                            };
                            
                            const homeRegainsOpponentHalfBelow8s = calculateRegainsOpponentHalfBelow8s(homeTeamId);
                            const awayRegainsOpponentHalfBelow8s = calculateRegainsOpponentHalfBelow8s(awayTeamId);
                            
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                    {homeLosesStats.totalLoses > 0 ? (
                                      `${homeLosesStats.counterpressingPct.toFixed(1)}% (${homeLosesStats.counterpressingLoses}/${homeLosesStats.totalLoses})`
                                    ) : '—'}
                                  </div>
                                  <div className={styles.matchDataTableLabel}>5s Counterpressing</div>
                                  <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                    {awayLosesStats.totalLoses > 0 ? (
                                      `${awayLosesStats.counterpressingPct.toFixed(1)}% (${awayLosesStats.counterpressingLoses}/${awayLosesStats.totalLoses})`
                                    ) : '—'}
                                  </div>
                                </div>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell}>
                                    {homeRegainsOpponentHalf}
                                  </div>
                                  <div className={styles.matchDataTableLabel}>
                                    Przechwyty na połowie przeciwnika
                                  </div>
                                  <div className={styles.matchDataTableCell}>
                                    {awayRegainsOpponentHalf}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                          
                          {/* Podań - suma */}
                          <div className={styles.matchDataTableRow}>
                            <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({homeTotalAccurate}/{homeTotalPasses})</span> <span>{homeTotalPercent}%</span>
                          </div>
                            <div 
                              className={`${styles.matchDataTableLabel} ${styles.clickable}`}
                              onClick={() => setPassesExpanded(!passesExpanded)}
                            >
                              Podania
                              <span className={`${styles.expandIcon} ${passesExpanded ? styles.expanded : ''}`}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                          </div>
                            <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                              <span>{awayTotalPercent}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({awayTotalAccurate}/{awayTotalPasses})</span>
                          </div>
                          </div>
                          
                          {/* Podań - na swojej połowie - zwijane */}
                          {passesExpanded && (
                            <div className={styles.matchDataTableRow}>
                              <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({homeOwnHalf.accurate}/{homeOwnTotal})</span> <span>{homeOwnPercent}%</span>
                          </div>
                              <div className={styles.matchDataTableSubLabel}>Własna poł.</div>
                              <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                <span>{awayOwnPercent}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({awayOwnHalf.accurate}/{awayOwnTotal})</span>
                              </div>
                  </div>
                )}
                
                          {/* Podań - na połowie przeciwnika - zwijane */}
                          {passesExpanded && (
                            <div className={styles.matchDataTableRow}>
                              <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({homeOpponentHalf.accurate}/{homeOppTotal})</span> <span>{homeOppPercent}%</span>
                              </div>
                              <div className={styles.matchDataTableSubLabel}>Poł. przeciwnika</div>
                              <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                <span>{awayOppPercent}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({awayOpponentHalf.accurate}/{awayOppTotal})</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Udane wejścia (8s ACC z flagą strzału lub PK) */}
                          {(() => {
                            // Filtruj akcje 8s ACC według wybranego okresu i zespołu
                            const filteredAcc8s = allAcc8sEntries.filter((entry: any) => {
                              if (matchDataPeriod === 'firstHalf') {
                                return !entry.isSecondHalf;
                              } else if (matchDataPeriod === 'secondHalf') {
                                return entry.isSecondHalf;
                              }
                              return true; // total - wszystkie akcje
                            });
                            
                            // Określ, które akcje należą do gospodarza, a które do gościa
                            const homeAcc8s = filteredAcc8s.filter((entry: any) => {
                              const entryTeamId = entry.teamId;
                              return entryTeamId === (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent);
                            });
                            const awayAcc8s = filteredAcc8s.filter((entry: any) => {
                              const entryTeamId = entry.teamId;
                              return entryTeamId === (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team);
                            });
                            
                            // Zlicz udane wejścia (z flagą strzału LUB PK)
                            const homeSuccessful = homeAcc8s.filter((entry: any) => 
                              entry.isShotUnder8s === true || entry.isPKEntryUnder8s === true
                            ).length;
                            const awaySuccessful = awayAcc8s.filter((entry: any) => 
                              entry.isShotUnder8s === true || entry.isPKEntryUnder8s === true
                            ).length;
                            
                            const homeTotal = homeAcc8s.length;
                            const awayTotal = awayAcc8s.length;
                            
                            const homePercent = homeTotal > 0 ? ((homeSuccessful / homeTotal) * 100).toFixed(1) : '0.0';
                            const awayPercent = awayTotal > 0 ? ((awaySuccessful / awayTotal) * 100).toFixed(1) : '0.0';
                            
                            const target8sAcc = 25;
                            const homeDiff = homeTotal > 0 ? ((homeSuccessful / homeTotal) * 100) - target8sAcc : 0;
                            const awayDiff = awayTotal > 0 ? ((awaySuccessful / awayTotal) * 100) - target8sAcc : 0;
                            
                            return (
                              <div className={styles.matchDataTableRow}>
                                <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                  {homeTotal > 0 ? (
                                    <>
                                      <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({homeSuccessful}/{homeTotal})</span> <span>{homePercent}%</span>
                                      {homeDiff < 0 ? (
                                        <span style={{ color: TEAM_STATS_RED, marginLeft: '4px', fontSize: '0.85em' }}>-{Math.abs(homeDiff).toFixed(1)}%</span>
                                      ) : homeDiff > 0 ? (
                                        <span style={{ color: TEAM_STATS_GREEN, marginLeft: '4px', fontSize: '0.85em' }}>+{homeDiff.toFixed(1)}%</span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                                <div className={styles.matchDataTableLabel}>Udane wejścia</div>
                                <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                  {awayTotal > 0 ? (
                                    <>
                                      <span>{awayPercent}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({awaySuccessful}/{awayTotal})</span>
                                      {awayDiff < 0 ? (
                                        <span style={{ color: TEAM_STATS_RED, marginLeft: '4px', fontSize: '0.85em' }}>-{Math.abs(awayDiff).toFixed(1)}%</span>
                                      ) : awayDiff > 0 ? (
                                        <span style={{ color: TEAM_STATS_GREEN, marginLeft: '4px', fontSize: '0.85em' }}>+{awayDiff.toFixed(1)}%</span>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Czas posiadania */}
                          {(() => {
                            const possession = selectedMatchInfo.matchData?.possession;
                            const teamFirstHalf = possession?.teamFirstHalf || 0;
                            const oppFirstHalf = possession?.opponentFirstHalf || 0;
                            const teamSecondHalf = possession?.teamSecondHalf || 0;
                            const oppSecondHalf = possession?.opponentSecondHalf || 0;
                            
                            const sumFirst = teamFirstHalf + oppFirstHalf;
                            const sumSecond = teamSecondHalf + oppSecondHalf;
                            
                            const firstHalfDuration = sumFirst > 0 ? Math.max(45, sumFirst) : 45;
                            const secondHalfDuration = sumSecond > 0 ? Math.max(45, sumSecond) : 45;
                            const matchDuration = firstHalfDuration + secondHalfDuration;
                            
                            const deadFirst = Math.max(0, firstHalfDuration - sumFirst);
                            const deadSecond = Math.max(0, secondHalfDuration - sumSecond);
                            const deadTotal = deadFirst + deadSecond;
                            
                            const deadMatchPerc = matchDuration > 0 ? (deadTotal / matchDuration) * 100 : 0;
                            
                            const minutesToMMSS = (minutes: number): string => {
                              if (!Number.isFinite(minutes) || minutes <= 0) return '0:00';
                              const totalSeconds = Math.round(minutes * 60);
                              const mins = Math.floor(totalSeconds / 60);
                              const secs = totalSeconds % 60;
                              return `${mins}:${secs.toString().padStart(2, '0')}`;
                            };
                            
                            // Oblicz wartości dla P1 i P2
                            const homeFirstHalf = isHome ? teamFirstHalf : oppFirstHalf;
                            const homeSecondHalf = isHome ? teamSecondHalf : oppSecondHalf;
                            const awayFirstHalf = isHome ? oppFirstHalf : teamFirstHalf;
                            const awaySecondHalf = isHome ? oppSecondHalf : teamSecondHalf;
                            
                            const homeFirstPerc = firstHalfDuration > 0 ? (homeFirstHalf / firstHalfDuration) * 100 : 0;
                            const homeSecondPerc = secondHalfDuration > 0 ? (homeSecondHalf / secondHalfDuration) * 100 : 0;
                            const awayFirstPerc = firstHalfDuration > 0 ? (awayFirstHalf / firstHalfDuration) * 100 : 0;
                            const awaySecondPerc = secondHalfDuration > 0 ? (awaySecondHalf / secondHalfDuration) * 100 : 0;
                            
                            const deadFirstPerc = firstHalfDuration > 0 ? (deadFirst / firstHalfDuration) * 100 : 0;
                            const deadSecondPerc = secondHalfDuration > 0 ? (deadSecond / secondHalfDuration) * 100 : 0;
                            
                            return (
                              <div className={styles.matchDataTableRow}>
                                <div className={styles.matchDataTableCell}>
                                  <div className={styles.possessionValue}>{homePossessionPercent}%</div>
                                  <div className={styles.possessionTime}>{homePossession.toFixed(1)} min</div>
                                </div>
                                <div className={styles.matchDataTableLabel}>
                                  Posiadanie
                                  <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px', fontWeight: 'normal' }}>czas martwy: {minutesToMMSS(deadTotal)}</div>
                                </div>
                                <div className={styles.matchDataTableCell}>
                                  <div className={styles.possessionValue}>{awayPossessionPercent}%</div>
                                  <div className={styles.possessionTime}>{awayPossession.toFixed(1)} min</div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className={styles.noDataText}>Brak danych meczu dla wybranego meczu.</p>
                )}
              </div>
            )}
            {expandedCategory === 'pxt' && (
              <div className={styles.detailsPanel}>
                <h3>Szczegóły PxT</h3>

      {/* Statystyki połówek */}
      {selectedMatches.length > 0 && allActions.length > 0 && (
                  <div className={styles.halfTimeStatsInPanel}>
                    <div className={styles.halfTimeHeaderWithType}>
                      <h4>Statystyki połówek</h4>
                      <div className={styles.actionTypeSelector}>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'all' ? styles.active : ''}`}
                          onClick={() => {
                            setSelectedActionType('all');
                            setSelectedActionFilter([]);
                          }}
                        >
                          Wszystkie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'pass' ? styles.active : ''}`}
                          onClick={() => {
                            setSelectedActionType('pass');
                            setSelectedActionFilter([]);
                          }}
                        >
                          Podanie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'dribble' ? styles.active : ''}`}
                          onClick={() => {
                            setSelectedActionType('dribble');
                            setSelectedActionFilter([]);
                          }}
                        >
                          Drybling
                        </button>
                      </div>
                    </div>
          <div className={styles.metricSelector}>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'pxt' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('pxt')}
            >
              PxT
            </button>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'xt' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('xt')}
            >
              xT
            </button>
            <button 
              className={`${styles.metricButton} ${selectedMetric === 'packing' ? styles.active : ''}`}
              onClick={() => setSelectedMetric('packing')}
            >
              Packing
            </button>
          </div>
          
                    <div className={styles.halfTimeContainerInPanel}>
                      {/* Karta "Łącznie" - pierwsza */}
                      <div className={styles.halfTimeCardInPanel}>
                        <div className={styles.halfTimeLabel}>Łącznie</div>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && (halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt).toFixed(2)}
                {selectedMetric === 'xt' && (halfTimeStats.firstHalf.xt + halfTimeStats.secondHalf.xt).toFixed(3)}
                {selectedMetric === 'packing' && (halfTimeStats.firstHalf.packing + halfTimeStats.secondHalf.packing).toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
              {/* PxT/min posiadania dla łącznie */}
              {selectedMetric === 'pxt' && selectedMatchInfo?.matchData?.possession && (() => {
                const isHome = selectedMatchInfo.isHome;
                const teamPossession = isHome 
                  ? ((selectedMatchInfo.matchData.possession.teamFirstHalf || 0) + (selectedMatchInfo.matchData.possession.teamSecondHalf || 0))
                  : ((selectedMatchInfo.matchData.possession.opponentFirstHalf || 0) + (selectedMatchInfo.matchData.possession.opponentSecondHalf || 0));
                const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                if (teamPossession > 0) {
                  return (
                    <div className={styles.statSubValue}>
                      {(totalPxt / teamPossession).toFixed(3)} PxT/min posiadania
                    </div>
                  );
                }
                return null;
              })()}
              {(halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount) > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {(() => {
                      const totalPasses = halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount;
                      if (selectedMetric === 'pxt') {
                        const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                        return totalPasses > 0 ? `${(totalPxt / totalPasses).toFixed(3)} PxT/podanie` : '0.000 PxT/podanie';
                      } else if (selectedMetric === 'xt') {
                        const totalXt = halfTimeStats.firstHalf.xt + halfTimeStats.secondHalf.xt;
                        return totalPasses > 0 ? `${(totalXt / totalPasses).toFixed(3)} xT/podanie` : '0.000 xT/podanie';
                      } else {
                        const totalPacking = halfTimeStats.firstHalf.packing + halfTimeStats.secondHalf.packing;
                        return totalPasses > 0 ? `${(totalPacking / totalPasses).toFixed(1)} Packing/podanie` : '0.0 Packing/podanie';
                      }
                    })()}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount} podań
                  </div>
                </>
              )}
              {(halfTimeStats.firstHalf.dribbleCount + halfTimeStats.secondHalf.dribbleCount) > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {(() => {
                      const totalDribbles = halfTimeStats.firstHalf.dribbleCount + halfTimeStats.secondHalf.dribbleCount;
                      if (selectedMetric === 'pxt') {
                        const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                        return totalDribbles > 0 ? `${(totalPxt / totalDribbles).toFixed(3)} PxT/drybling` : '0.000 PxT/drybling';
                      } else if (selectedMetric === 'xt') {
                        const totalXt = halfTimeStats.firstHalf.xt + halfTimeStats.secondHalf.xt;
                        return totalDribbles > 0 ? `${(totalXt / totalDribbles).toFixed(3)} xT/drybling` : '0.000 xT/drybling';
                      } else {
                        const totalPacking = halfTimeStats.firstHalf.packing + halfTimeStats.secondHalf.packing;
                        return totalDribbles > 0 ? `${(totalPacking / totalDribbles).toFixed(1)} Packing/drybling` : '0.0 Packing/drybling';
                      }
                    })()}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.firstHalf.dribbleCount + halfTimeStats.secondHalf.dribbleCount} dryblingów
                  </div>
                </>
              )}
            </div>
            
                      {/* Karta "1. połowa" - druga */}
                      <div className={styles.halfTimeCardInPanel}>
                        <div className={styles.halfTimeLabel}>1. połowa</div>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && halfTimeStats.firstHalf.pxt.toFixed(2)}
                {selectedMetric === 'xt' && halfTimeStats.firstHalf.xt.toFixed(3)}
                {selectedMetric === 'packing' && halfTimeStats.firstHalf.packing.toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
              {/* PxT/min posiadania dla 1. połowy – ujednolicone z kafelkiem Łącznie; fallback na połowę łącznego posiadania */}
              {selectedMetric === 'pxt' && selectedMatchInfo?.matchData?.possession && (() => {
                const isHome = selectedMatchInfo.isHome;
                const totalPossession = isHome
                  ? ((selectedMatchInfo.matchData.possession.teamFirstHalf || 0) + (selectedMatchInfo.matchData.possession.teamSecondHalf || 0))
                  : ((selectedMatchInfo.matchData.possession.opponentFirstHalf || 0) + (selectedMatchInfo.matchData.possession.opponentSecondHalf || 0));
                const teamPossessionFirst = isHome
                  ? (selectedMatchInfo.matchData.possession.teamFirstHalf ?? totalPossession / 2)
                  : (selectedMatchInfo.matchData.possession.opponentFirstHalf ?? totalPossession / 2);
                if (totalPossession > 0 && teamPossessionFirst > 0) {
                  return (
                    <div className={styles.statSubValue}>
                      {(halfTimeStats.firstHalf.pxt / teamPossessionFirst).toFixed(3)} PxT/min posiadania
                    </div>
                  );
                }
                return null;
              })()}
              {halfTimeStats.firstHalf.passCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.firstHalf.pxtPerPass.toFixed(3)} PxT/podanie`}
                    {selectedMetric === 'xt' && `${halfTimeStats.firstHalf.xtPerPass.toFixed(3)} xT/podanie`}
                    {selectedMetric === 'packing' && `${halfTimeStats.firstHalf.packingPerPass.toFixed(1)} Packing/podanie`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.firstHalf.passCount} podań
                  </div>
                </>
              )}
              {halfTimeStats.firstHalf.dribbleCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.firstHalf.pxtPerDribble.toFixed(3)} PxT/drybling`}
                    {selectedMetric === 'xt' && `${halfTimeStats.firstHalf.xtPerDribble.toFixed(3)} xT/drybling`}
                    {selectedMetric === 'packing' && `${halfTimeStats.firstHalf.packingPerDribble.toFixed(1)} Packing/drybling`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.firstHalf.dribbleCount} dryblingów
                  </div>
                </>
              )}
            </div>
            
                      {/* Karta "2. połowa" - trzecia */}
                      <div className={styles.halfTimeCardInPanel}>
                        <div className={styles.halfTimeLabel}>2. połowa</div>
              <div className={styles.statValue}>
                {selectedMetric === 'pxt' && halfTimeStats.secondHalf.pxt.toFixed(2)}
                {selectedMetric === 'xt' && halfTimeStats.secondHalf.xt.toFixed(3)}
                {selectedMetric === 'packing' && halfTimeStats.secondHalf.packing.toFixed(0)}
              </div>
              <div className={styles.statLabel}>
                {selectedMetric === 'pxt' && 'PxT'}
                {selectedMetric === 'xt' && 'xT'}
                {selectedMetric === 'packing' && 'Packing'}
              </div>
              {/* PxT/min posiadania dla 2. połowy – ujednolicone z kafelkiem Łącznie; fallback na połowę łącznego posiadania */}
              {selectedMetric === 'pxt' && selectedMatchInfo?.matchData?.possession && (() => {
                const isHome = selectedMatchInfo.isHome;
                const totalPossession = isHome
                  ? ((selectedMatchInfo.matchData.possession.teamFirstHalf || 0) + (selectedMatchInfo.matchData.possession.teamSecondHalf || 0))
                  : ((selectedMatchInfo.matchData.possession.opponentFirstHalf || 0) + (selectedMatchInfo.matchData.possession.opponentSecondHalf || 0));
                const teamPossessionSecond = isHome
                  ? (selectedMatchInfo.matchData.possession.teamSecondHalf ?? totalPossession / 2)
                  : (selectedMatchInfo.matchData.possession.opponentSecondHalf ?? totalPossession / 2);
                if (totalPossession > 0 && teamPossessionSecond > 0) {
                  return (
                    <div className={styles.statSubValue}>
                      {(halfTimeStats.secondHalf.pxt / teamPossessionSecond).toFixed(3)} PxT/min posiadania
                    </div>
                  );
                }
                return null;
              })()}
              {halfTimeStats.secondHalf.passCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.secondHalf.pxtPerPass.toFixed(3)} PxT/podanie`}
                    {selectedMetric === 'xt' && `${halfTimeStats.secondHalf.xtPerPass.toFixed(3)} xT/podanie`}
                    {selectedMetric === 'packing' && `${halfTimeStats.secondHalf.packingPerPass.toFixed(1)} Packing/podanie`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.secondHalf.passCount} podań
                  </div>
                </>
              )}
              {halfTimeStats.secondHalf.dribbleCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.secondHalf.pxtPerDribble.toFixed(3)} PxT/drybling`}
                    {selectedMetric === 'xt' && `${halfTimeStats.secondHalf.xtPerDribble.toFixed(3)} xT/drybling`}
                    {selectedMetric === 'packing' && `${halfTimeStats.secondHalf.packingPerDribble.toFixed(1)} Packing/drybling`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.secondHalf.dribbleCount} dryblingów
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Szczegółowe dane o punktach */}
          <div className={styles.actionCounts}>
            {(selectedActionType === 'pass' || selectedActionType === 'all') && (
              <div className={styles.countItemsWrapper} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)', marginBottom: '4px' }}>Start akcji</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <div 
                      className={`${styles.countItem} ${isFilterActive('p0start') ? styles.countItemSelected : ''} ${teamStats.senderP0StartCount === 0 ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                        if (teamStats.senderP0StartCount === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Start: usuń wszystkie Start filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                          if (filters.includes('p0start')) {
                            return withoutStartFilters; // Odznacz
                          } else {
                            return [...withoutStartFilters, 'p0start']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P0 Start:</span>
                    <span className={styles.countValue}>{teamStats.senderP0StartCount}</span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP0StartCountLateral}</span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP0StartCountCentral}</span>
                    </div>
                  </div>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('p1start') ? styles.countItemSelected : ''} ${teamStats.senderP1StartCount === 0 ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                        if (teamStats.senderP1StartCount === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Start: usuń wszystkie Start filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                          if (filters.includes('p1start')) {
                            return withoutStartFilters; // Odznacz
                          } else {
                            return [...withoutStartFilters, 'p1start']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P1 Start:</span>
                    <span className={styles.countValue}>{teamStats.senderP1StartCount}</span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP1StartCountLateral}</span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP1StartCountCentral}</span>
                    </div>
                  </div>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('p2start') ? styles.countItemSelected : ''} ${teamStats.senderP2StartCount === 0 ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                        if (teamStats.senderP2StartCount === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Start: usuń wszystkie Start filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                          if (filters.includes('p2start')) {
                            return withoutStartFilters; // Odznacz
                          } else {
                            return [...withoutStartFilters, 'p2start']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P2 Start:</span>
                    <span className={styles.countValue}>{teamStats.senderP2StartCount}</span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP2StartCountLateral}</span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP2StartCountCentral}</span>
                    </div>
                  </div>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('p3start') ? styles.countItemSelected : ''} ${teamStats.senderP3StartCount === 0 ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                        if (teamStats.senderP3StartCount === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Start: usuń wszystkie Start filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                          if (filters.includes('p3start')) {
                            return withoutStartFilters; // Odznacz
                          } else {
                            return [...withoutStartFilters, 'p3start']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P3 Start:</span>
                    <span className={styles.countValue}>{teamStats.senderP3StartCount}</span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP3StartCountLateral}</span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>{teamStats.senderP3StartCountCentral}</span>
                    </div>
                  </div>
                </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)', marginBottom: '4px' }}>Koniec akcji</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div 
                      className={`${styles.countItem} ${isFilterActive('p0') ? styles.countItemSelected : ''} ${(() => {
                        const p0Value = selectedActionType === 'all' ? teamStats.senderP0Count + (teamStats.dribblingP0Count || 0) : teamStats.senderP0Count;
                        return p0Value === 0 ? styles.countItemDisabled : '';
                      })()}`}
                    onClick={() => {
                        const p0Value = selectedActionType === 'all' ? teamStats.senderP0Count + (teamStats.dribblingP0Count || 0) : teamStats.senderP0Count;
                        if (p0Value === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Koniec: usuń wszystkie Koniec filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3'].includes(f));
                          if (filters.includes('p0')) {
                            return withoutEndFilters; // Odznacz
                          } else {
                            return [...withoutEndFilters, 'p0']; // Zaznacz
                          }
                        });
                      }}
                    >
                      <span className={styles.countLabel}>P0:</span>
                      <span className={styles.countValue}>
                        {selectedActionType === 'all' ? teamStats.senderP0Count + (teamStats.dribblingP0Count || 0) : teamStats.senderP0Count}
                      </span>
                      <div className={styles.zoneBreakdown}>
                        <span className={styles.zoneLabel}>Strefy boczne:</span>
                        <span className={styles.zoneValue}>
                          {selectedActionType === 'all' ? teamStats.senderP0CountLateral + (teamStats.dribblingP0CountLateral || 0) : teamStats.senderP0CountLateral}
                        </span>
                        <span className={styles.zoneLabel}>Strefy centralne:</span>
                        <span className={styles.zoneValue}>
                          {selectedActionType === 'all' ? teamStats.senderP0CountCentral + (teamStats.dribblingP0CountCentral || 0) : teamStats.senderP0CountCentral}
                        </span>
                      </div>
                    </div>
                    <div 
                      className={`${styles.countItem} ${isFilterActive('p1') ? styles.countItemSelected : ''} ${(() => {
                        const p1Value = selectedActionType === 'all' ? teamStats.senderP1Count + teamStats.dribblingP1Count : teamStats.senderP1Count;
                        return p1Value === 0 ? styles.countItemDisabled : '';
                      })()}`}
                      onClick={() => {
                        const p1Value = selectedActionType === 'all' ? teamStats.senderP1Count + teamStats.dribblingP1Count : teamStats.senderP1Count;
                        if (p1Value === 0) return;
                        setSelectedActionFilter(prev => {
                          const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Koniec: usuń wszystkie Koniec filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3'].includes(f));
                          if (filters.includes('p1')) {
                            return withoutEndFilters; // Odznacz
                          } else {
                            return [...withoutEndFilters, 'p1']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P1:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderP1Count + teamStats.dribblingP1Count : teamStats.senderP1Count}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP1CountLateral + teamStats.dribblingP1CountLateral : teamStats.senderP1CountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP1CountCentral + teamStats.dribblingP1CountCentral : teamStats.senderP1CountCentral}
                      </span>
                    </div>
                  </div>
                  <div 
                      className={`${styles.countItem} ${isFilterActive('p2') ? styles.countItemSelected : ''} ${(() => {
                        const p2Value = selectedActionType === 'all' ? teamStats.senderP2Count + teamStats.dribblingP2Count : teamStats.senderP2Count;
                        return p2Value === 0 ? styles.countItemDisabled : '';
                      })()}`}
                    onClick={() => {
                        const p2Value = selectedActionType === 'all' ? teamStats.senderP2Count + teamStats.dribblingP2Count : teamStats.senderP2Count;
                        if (p2Value === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Koniec: usuń wszystkie Koniec filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3'].includes(f));
                          if (filters.includes('p2')) {
                            return withoutEndFilters; // Odznacz
                          } else {
                            return [...withoutEndFilters, 'p2']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P2:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderP2Count + teamStats.dribblingP2Count : teamStats.senderP2Count}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP2CountLateral + teamStats.dribblingP2CountLateral : teamStats.senderP2CountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP2CountCentral + teamStats.dribblingP2CountCentral : teamStats.senderP2CountCentral}
                      </span>
                    </div>
                  </div>
                  <div 
                      className={`${styles.countItem} ${isFilterActive('p3') ? styles.countItemSelected : ''} ${(() => {
                        const p3Value = selectedActionType === 'all' ? teamStats.senderP3Count + teamStats.dribblingP3Count : teamStats.senderP3Count;
                        return p3Value === 0 ? styles.countItemDisabled : '';
                      })()}`}
                    onClick={() => {
                        const p3Value = selectedActionType === 'all' ? teamStats.senderP3Count + teamStats.dribblingP3Count : teamStats.senderP3Count;
                        if (p3Value === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Koniec: usuń wszystkie Koniec filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutEndFilters = filters.filter(f => !['p0', 'p1', 'p2', 'p3'].includes(f));
                          if (filters.includes('p3')) {
                            return withoutEndFilters; // Odznacz
                          } else {
                            return [...withoutEndFilters, 'p3']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>P3:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderP3Count + teamStats.dribblingP3Count : teamStats.senderP3Count}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP3CountLateral + teamStats.dribblingP3CountLateral : teamStats.senderP3CountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderP3CountCentral + teamStats.dribblingP3CountCentral : teamStats.senderP3CountCentral}
                      </span>
                    </div>
                  </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)', marginBottom: '4px' }}>Dodatkowy rezultat akcji</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <div 
                      className={`${styles.countItem} ${isFilterActive('pk') ? styles.countItemSelected : ''} ${(() => {
                        const pkValue = selectedActionType === 'all' ? teamStats.senderPKCount + teamStats.dribblingPKCount : teamStats.senderPKCount;
                        return pkValue === 0 ? styles.countItemDisabled : '';
                      })()}`}
                    onClick={() => {
                        const pkValue = selectedActionType === 'all' ? teamStats.senderPKCount + teamStats.dribblingPKCount : teamStats.senderPKCount;
                        if (pkValue === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Dodatkowy rezultat: usuń wszystkie rezultat filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutResultFilters = filters.filter(f => !['pk', 'shot', 'goal'].includes(f));
                          if (filters.includes('pk')) {
                            return withoutResultFilters; // Odznacz
                          } else {
                            return [...withoutResultFilters, 'pk']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>PK:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderPKCount + teamStats.dribblingPKCount : teamStats.senderPKCount}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderPKCountLateral + teamStats.dribblingPKCountLateral : teamStats.senderPKCountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderPKCountCentral + teamStats.dribblingPKCountCentral : teamStats.senderPKCountCentral}
                      </span>
                    </div>
                  </div>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('shot') ? styles.countItemSelected : ''} ${(() => {
                      const shotValue = selectedActionType === 'all' ? teamStats.senderShotCount + teamStats.dribblingShotCount : teamStats.senderShotCount;
                      return shotValue === 0 ? styles.countItemDisabled : '';
                    })()}`}
                    onClick={() => {
                        const shotValue = selectedActionType === 'all' ? teamStats.senderShotCount + teamStats.dribblingShotCount : teamStats.senderShotCount;
                        if (shotValue === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Dodatkowy rezultat: usuń wszystkie rezultat filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutResultFilters = filters.filter(f => !['pk', 'shot', 'goal'].includes(f));
                          if (filters.includes('shot')) {
                            return withoutResultFilters; // Odznacz
                          } else {
                            return [...withoutResultFilters, 'shot']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>Strzał:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderShotCount + teamStats.dribblingShotCount : teamStats.senderShotCount}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderShotCountLateral + teamStats.dribblingShotCountLateral : teamStats.senderShotCountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderShotCountCentral + teamStats.dribblingShotCountCentral : teamStats.senderShotCountCentral}
                      </span>
                    </div>
                  </div>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('goal') ? styles.countItemSelected : ''} ${(() => {
                      const goalValue = selectedActionType === 'all' ? teamStats.senderGoalCount + teamStats.dribblingGoalCount : teamStats.senderGoalCount;
                      return goalValue === 0 ? styles.countItemDisabled : '';
                    })()}`}
                    onClick={() => {
                        const goalValue = selectedActionType === 'all' ? teamStats.senderGoalCount + teamStats.dribblingGoalCount : teamStats.senderGoalCount;
                        if (goalValue === 0) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                          // Radio behavior w obrębie sekcji Dodatkowy rezultat: usuń wszystkie rezultat filtry, jeśli kliknięty był już zaznaczony - odznacz, w przeciwnym razie zaznacz
                          const withoutResultFilters = filters.filter(f => !['pk', 'shot', 'goal'].includes(f));
                          if (filters.includes('goal')) {
                            return withoutResultFilters; // Odznacz
                          } else {
                            return [...withoutResultFilters, 'goal']; // Zaznacz
                          }
                      });
                    }}
                  >
                    <span className={styles.countLabel}>Gol:</span>
                    <span className={styles.countValue}>
                      {selectedActionType === 'all' ? teamStats.senderGoalCount + teamStats.dribblingGoalCount : teamStats.senderGoalCount}
                    </span>
                    <div className={styles.zoneBreakdown}>
                      <span className={styles.zoneLabel}>Strefy boczne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderGoalCountLateral + teamStats.dribblingGoalCountLateral : teamStats.senderGoalCountLateral}
                      </span>
                      <span className={styles.zoneLabel}>Strefy centralne:</span>
                      <span className={styles.zoneValue}>
                        {selectedActionType === 'all' ? teamStats.senderGoalCountCentral + teamStats.dribblingGoalCountCentral : teamStats.senderGoalCountCentral}
                      </span>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {selectedActionType === 'dribble' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
                <div 
                  className={`${styles.countItem} ${isFilterActive('p1') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('p1') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('p1')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('p1')) return withoutEndFilters;
                      return [...withoutEndFilters, 'p1'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>P1:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP1Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP1CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP1CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${isFilterActive('p2') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('p2') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('p2')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('p2')) return withoutEndFilters;
                      return [...withoutEndFilters, 'p2'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP2CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${isFilterActive('p3') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('p3') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('p3')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('p3')) return withoutEndFilters;
                      return [...withoutEndFilters, 'p3'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP3CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${isFilterActive('pk') ? styles.countItemSelected : ''}`}
                  onClick={() => {
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      // Radio button behavior: zawsze zaznacz, tylko jeden może być aktywny
                      return [...withoutEndFilters, 'pk'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.dribblingPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingPKCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${isFilterActive('shot') ? styles.countItemSelected : ''}`}
                  onClick={() => {
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      // Radio button behavior: zawsze zaznacz, tylko jeden może być aktywny
                      return [...withoutEndFilters, 'shot'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.dribblingShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingShotCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${isFilterActive('goal') ? styles.countItemSelected : ''}`}
                  onClick={() => {
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      // Radio button behavior: zawsze zaznacz, tylko jeden może być aktywny
                      return [...withoutEndFilters, 'goal'];
                    });
                  }}
                >
                  <span className={styles.countLabel}>Gol:</span>
                  <span className={styles.countValue}>{teamStats.dribblingGoalCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingGoalCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingGoalCountCentral}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

                {/* Heatmapa zespołu */}
                {selectedMatches.length > 0 && allActions.length > 0 && (
                  <div className={styles.teamHeatmapSectionInPanel}>
                    <div className={styles.heatmapHeaderInPanel}>
                      <h4>Heatmapa</h4>
                      <div className={styles.heatmapControlsInPanel}>
                        {/* Przełącznik kategorii */}
                        <div className={styles.categoryToggle}>
                          <button
                            className={`${styles.categoryButton} ${selectedPxtCategory === 'sender' ? styles.active : ''}`}
                            onClick={() => setSelectedPxtCategory('sender')}
                          >
                            Podanie
                          </button>
                          <button
                            className={`${styles.categoryButton} ${selectedPxtCategory === 'receiver' ? styles.active : ''}`}
                            onClick={() => setSelectedPxtCategory('receiver')}
                          >
                            Przyjęcie
                          </button>
                          <button
                            className={`${styles.categoryButton} ${selectedPxtCategory === 'dribbler' ? styles.active : ''}`}
                            onClick={() => setSelectedPxtCategory('dribbler')}
                          >
                            Drybling
                          </button>
                        </div>
                        {/* Przełącznik kierunku (tylko dla sender i receiver) */}
                        {(selectedPxtCategory === 'sender' || selectedPxtCategory === 'receiver') && (
                          <div className={styles.heatmapDirectionToggle}>
                            <button
                              className={`${styles.heatmapDirectionButton} ${heatmapDirection === 'from' ? styles.active : ''}`}
                              onClick={() => setHeatmapDirection('from')}
                            >
                              Z której strefy
                            </button>
                            <button
                              className={`${styles.heatmapDirectionButton} ${heatmapDirection === 'to' ? styles.active : ''}`}
                              onClick={() => setHeatmapDirection('to')}
                            >
                              Do której strefy
                            </button>
                          </div>
                        )}
                        {/* Przełącznik trybu (PxT / Liczba akcji) */}
                        <div className={styles.heatmapModeToggle}>
                          <button
                            className={`${styles.heatmapModeButton} ${heatmapMode === 'pxt' ? styles.active : ''}`}
                            onClick={() => setHeatmapMode('pxt')}
                          >
                            PxT
                          </button>
                          <button
                            className={`${styles.heatmapModeButton} ${heatmapMode === 'count' ? styles.active : ''}`}
                            onClick={() => setHeatmapMode('count')}
                          >
                            Liczba akcji
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={styles.heatmapWrapperInPanel}>
                      <div className={styles.heatmapContainerInPanel}>
                        <PlayerHeatmapPitch
                          heatmapData={teamHeatmapData}
                          category={selectedPxtCategory}
                          mode={heatmapMode}
                          selectedZone={selectedZone}
                          onZoneClick={(zoneName) => {
                            const normalizedZone = typeof zoneName === 'string' 
                              ? zoneName.toUpperCase().replace(/\s+/g, '') 
                              : String(zoneName).toUpperCase().replace(/\s+/g, '');
                            
                            const zoneStats = zonePlayerStats.get(normalizedZone);
                            
                            if (zoneStats && zoneStats.size > 0) {
                              const playersList = Array.from(zoneStats.entries())
                                .map(([playerId, stats]) => {
                                  const player = players.find(p => p.id === playerId);
                                  return {
                                    playerId,
                                    playerName: getPlayerLabel(playerId, playersIndex),
                                    pxt: stats.pxt,
                                    passes: stats.passes,
                                  };
                                })
                                .sort((a, b) => b.pxt - a.pxt);
                              
                              setZoneDetails({
                                zoneName: normalizedZone,
                                players: playersList,
                              });
                              setSelectedZone(normalizedZone);
                            } else {
                              setZoneDetails(null);
                              setSelectedZone(null);
                            }
                          }}
                        />
                      </div>
                      <div className={styles.zoneDetailsPanel}>
                        {zoneDetails ? (
                          <>
                            <div className={styles.zoneDetailsHeader}>
                              <h4>Strefa {zoneDetails.zoneName}</h4>
                              <button
                                onClick={() => {
                                  setZoneDetails(null);
                                  setSelectedZone(null);
                                }}
                                className={styles.zoneDetailsClose}
                              >
                                ×
                              </button>
                            </div>
                            <div className={styles.zoneDetailsBody}>
                              <p className={styles.zoneDetailsSubtitle}>
                                {selectedPxtCategory === 'dribbler' && 'Zawodnicy, którzy wykonali drybling z tej strefy:'}
                                {selectedPxtCategory === 'sender' && `Zawodnicy, którzy ${heatmapDirection === 'from' ? 'zagrali z' : 'zagrali do'} tej strefy jako podający:`}
                                {selectedPxtCategory === 'receiver' && `Zawodnicy, którzy ${heatmapDirection === 'to' ? 'przyjęli podanie w' : 'przyjęli podanie z'} tej strefy:`}
                              </p>
                              <div className={styles.zonePlayersList}>
                                {zoneDetails.players.map((player) => (
                                  <div key={player.playerId} className={styles.zonePlayerItem}>
                                    <div className={styles.zonePlayerName}>{getPlayerLabel(player.playerId, playersIndex)}</div>
                                    <div className={styles.zonePlayerStats}>
                                      <div className={styles.zonePlayerStat}>
                                        <span className={styles.zoneLabel}>PxT:</span>
                                        <span className={styles.zoneValue}>{player.pxt.toFixed(2)}</span>
                                      </div>
                                      <div className={styles.zonePlayerStat}>
                                        <span className={styles.zoneLabel}>Podań:</span>
                                        <span className={styles.zoneValue}>{player.passes}</span>
                                      </div>
                                    </div>
                                    <button
                                      className={styles.viewActionsButton}
                                      onClick={() => {
                                        setSelectedPlayerForModal({
                                          playerId: player.playerId,
                                          playerName: getPlayerLabel(player.playerId, playersIndex),
                                          zoneName: zoneDetails.zoneName
                                        });
                                        setActionsModalOpen(true);
                                      }}
                                      title="Zobacz szczegóły akcji"
                                    >
                                      Zobacz akcje
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className={styles.zoneDetailsPlaceholder}>
                            <p>Kliknij na strefę, aby zobaczyć szczegóły</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {/* Wykresy */}
        {isLoadingActions ? (
                  <p className={styles.loadingText}>Ładowanie akcji...</p>
) : selectedMatches.length === 0 ? (
          <p className={styles.noDataText}>Wybierz mecz, aby zobaczyć statystyki.</p>
        ) : teamChartData.length === 0 ? (
                  <p className={styles.noDataText}>Brak danych dla wybranego meczu.</p>
                ) : (
                  <>
                    <div className={styles.chartContainerInPanel}>
                      <div className={styles.chartHeader}>
                        <h3>Przyrost statystyk zespołu w czasie meczu</h3>
                        {!isLoadingActions && selectedMatches.length > 0 && teamChartData.length > 0 && (
                          <span className={styles.chartInfo}>{allActions.length} akcji</span>
                        )}
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={teamChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="minute" 
                    label={{ value: 'Minuta', position: 'insideBottom', offset: -5 }}
                            tick={{ fontSize: 12 }}
                            domain={[0, 90]}
                            ticks={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left"
                    label={{ value: 'xT / PxT', angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    label={{ value: 'Packing', angle: 90, position: 'insideRight' }}
                            tick={{ fontSize: 12 }}
                  />
                  <Tooltip content={CustomTooltip} />
                  <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="xt" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="xT (skumulowane)"
                    connectNulls={true}
                            dot={false}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="pxt" 
                    stroke={TEAM_STATS_GREEN} 
                    strokeWidth={2}
                    name="PxT (skumulowane)"
                    connectNulls={true}
                            dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="packing" 
                    stroke="#ffc658" 
                    strokeWidth={2}
                    name="Packing (skumulowane)"
                    connectNulls={true}
                            dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
                    <div className={styles.chartContainerInPanel}>
                      <div className={styles.chartHeader}>
                        <h3>Przyrost statystyk co 5 minut</h3>
          </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <ComposedChart data={teamChartData5Min} margin={{ top: 10, right: 30, left: 20, bottom: 5 }} barGap={0} barCategoryGap="20%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                          <XAxis 
                            dataKey="minute" 
                            label={{ value: 'Przedział minutowy', position: 'insideBottom', offset: -5 }}
                            tick={{ fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            yAxisId="left" 
                            orientation="left"
                            label={{ value: 'xT / PxT', angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right"
                            label={{ value: 'Packing', angle: 90, position: 'insideRight' }}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className={styles.tooltip}>
                                    <p className={styles.tooltipLabel}>{`Przedział: ${data.minute} min`}</p>
                                    <p style={{ color: TEAM_STATS_RED }}>xT: {data.xt?.toFixed(3)}</p>
                                    <p style={{ color: '#3b82f6' }}>PxT: {data.pxt?.toFixed(2)}</p>
                                    <p style={{ color: '#6b7280' }}>Packing: {data.packing?.toFixed(0)}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                          <Bar 
                            yAxisId="left"
                            dataKey="pxt" 
                            fill="#3b82f6" 
                            name="PxT"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="xt" 
                            fill={TEAM_STATS_RED} 
                            name="xT"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                          />
                          <Bar 
                            yAxisId="right"
                            dataKey="packing" 
                            fill="#6b7280" 
                            name="Packing"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </>
        )}
      </div>
            )}
      </div>
        </div>
      )}

      {/* Modal – mapa xG (strzały) */}
      {xgMapModalOpen && selectedMatchInfo && (
        <div className={styles.mapsModalOverlay} onClick={() => setXgMapModalOpen(false)}>
          <div className={styles.mapsModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mapsModalBody}>
              <div className={styles.mapsModalPitchWrap}>
                {allShots.length > 0 ? (
                  <XGPitch
                    shots={allShots}
                    onShotAdd={() => {}}
                    players={players}
                    onShotClick={(shot) => setSelectedShot(shot)}
                    selectedShotId={selectedShot?.id}
                    matchInfo={selectedMatchInfo}
                    allTeams={availableTeams}
                    hideToggleButton={true}
                  />
                ) : (
                  <p className={styles.mapsModalEmpty}>Brak strzałów do wyświetlenia.</p>
                )}
              </div>

              {/* Legenda mapy xG w modalu – taka sama jak na stronie */}
              <div className={styles.xgMapLegend} role="img" aria-label="Legenda mapy xG">
                <span className={styles.xgMapLegendItem}>
                  <span className={styles.xgMapLegendDot} style={{ background: TEAM_STATS_GREEN }} />
                  <span>Niski xG</span>
                </span>
                <span className={styles.xgMapLegendItem}>
                  <span className={styles.xgMapLegendDot} style={{ background: "#fbbf24" }} />
                  <span>Średni xG</span>
                </span>
                <span className={styles.xgMapLegendItem}>
                  <span className={styles.xgMapLegendDot} style={{ background: TEAM_STATS_RED }} />
                  <span>Wysoki xG</span>
                </span>
                <span className={styles.xgMapLegendItem}>
                  <span className={`${styles.xgMapLegendDot} ${styles.goalRing}`} />
                  <span>Gol</span>
                </span>
                <span className={styles.xgMapLegendItem}>
                  <span
                    className={`${styles.xgMapLegendDot} ${styles.hex}`}
                    style={{ background: "#94a3b8" }}
                  />
                  <span>Stały fragment</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal – mapa wejść w PK */}
      {pkMapModalOpen && selectedMatchInfo && (
        <div className={styles.mapsModalOverlay} onClick={() => setPkMapModalOpen(false)}>
          <div className={styles.mapsModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mapsModalBody}>
              <div className={styles.mapsModalPitchWrap}>
                {pkEntriesFilteredForMap.length > 0 ? (
                  <PKEntriesPitch
                    pkEntries={pkEntriesFilteredForMap}
                    playersIndex={playersIndex}
                    onEntryClick={() => {}}
                    selectedEntryId={undefined}
                    matchInfo={selectedMatchInfo}
                    allTeams={availableTeams}
                    hideTeamLogos={false}
                    hideFlipButton={false}
                    hideInstructions={true}
                  />
                ) : (
                  <p className={styles.mapsModalEmpty}>Brak wejść w PK do wyświetlenia.</p>
                )}
              </div>

              {/* Legenda mapy wejść w PK w modalu – taka sama jak na stronie */}
              <div
                className={styles.pkMapLegend}
                role="img"
                aria-label="Legenda wejść w pole karne"
              >
                <span className={styles.pkMapLegendItem}>
                  <span className={styles.pkMapLegendLine} style={{ background: TEAM_STATS_RED }} />
                  <span>Podanie</span>
                </span>
                <span className={styles.pkMapLegendItem}>
                  <span className={styles.pkMapLegendLine} style={{ background: "#1e40af" }} />
                  <span>Drybling</span>
                </span>
                <span className={styles.pkMapLegendItem}>
                  <span className={styles.pkMapLegendLine} style={{ background: TEAM_STATS_GREEN }} />
                  <span>SFG</span>
                </span>
                <span className={styles.pkMapLegendItem}>
                  <span
                    className={styles.pkMapLegendDot}
                    style={{
                      background: "#86efac",
                      border: "1px solid #fff",
                      boxSizing: "border-box",
                    }}
                  />
                  <span>Gol</span>
                </span>
                <span className={styles.pkMapLegendItem}>
                  <span
                    className={styles.pkMapLegendDot}
                    style={{
                      background: "#111827",
                      border: "1px solid #fff",
                      boxSizing: "border-box",
                    }}
                  />
                  <span>Strzał</span>
                </span>
                <span className={styles.pkMapLegendItem}>
                  <span
                    className={styles.pkMapLegendDot}
                    style={{
                      background: "white",
                      border: "1.5px solid #f59e0b",
                      boxSizing: "border-box",
                    }}
                  />
                  <span>Regain (kropka)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal z akcjami zawodnika */}
      {actionsModalOpen && selectedPlayerForModal && (
        <div className={styles.modalOverlay} onClick={() => setActionsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Akcje: {selectedPlayerForModal.playerName}</h3>
              <p className={styles.modalSubtitle}>Strefa: {selectedPlayerForModal.zoneName}</p>
              <button
                className={styles.modalCloseButton}
                onClick={() => setActionsModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              {(() => {
                // Filtruj akcje dla wybranego zawodnika w wybranej strefie
                const filteredActions = allActions.filter(action => {
                  // Filtruj według kategorii
                  if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return false;
                  if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return false;
                  
                  // Filtruj według zawodnika
                  let matchesPlayer = false;
                  if (selectedPxtCategory === 'dribbler') {
                    matchesPlayer = action.senderId === selectedPlayerForModal.playerId;
                  } else if (selectedPxtCategory === 'sender') {
                    matchesPlayer = action.senderId === selectedPlayerForModal.playerId;
                  } else if (selectedPxtCategory === 'receiver') {
                    matchesPlayer = action.receiverId === selectedPlayerForModal.playerId;
                  }
                  
                  if (!matchesPlayer) return false;
                  
                  // Filtruj według strefy
                  let zone: string | undefined;
                  if (selectedPxtCategory === 'dribbler') {
                    zone = action.startZone || action.fromZone;
                  } else if (selectedPxtCategory === 'sender') {
                    zone = heatmapDirection === "from" 
                      ? (action.fromZone || action.startZone) 
                      : (action.toZone || action.endZone);
                  } else if (selectedPxtCategory === 'receiver') {
                    zone = heatmapDirection === "to" 
                      ? (action.toZone || action.endZone) 
                      : (action.fromZone || action.startZone);
                  }
                  
                  if (!zone) return false;
                  
                  const normalizedZone = typeof zone === 'string' 
                    ? zone.toUpperCase().replace(/\s+/g, '') 
                    : String(zone).toUpperCase().replace(/\s+/g, '');
                  
                  return normalizedZone === selectedPlayerForModal.zoneName;
                });
                
                if (filteredActions.length === 0) {
                  return <p className={styles.noActionsText}>Brak akcji dla tego zawodnika w tej strefie.</p>;
                }
                
                return (
                  <div className={styles.actionsList}>
                    {filteredActions.map((action, index) => {
                      const match = teamMatches.find(m => m.matchId === action.matchId);
                      const matchName = match 
                        ? `${match.opponent} (${new Date(match.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })})`
                        : `Mecz ${action.matchId || 'nieznany'}`;
                      
                      const packingPoints = action.packingPoints || 0;
                      const xTDifference = getXTDifferenceForAction(action);
                      const pxtValue = xTDifference * packingPoints;
                      
                      return (
                        <div key={index} className={styles.actionItem}>
                          <div className={styles.actionHeader}>
                            <span className={styles.actionMatch}>{matchName}</span>
                            <span className={styles.actionMinute}>{action.minute}'</span>
                          </div>
                          <div className={styles.actionDetails}>
                            <span className={styles.actionDetailRow}>
                              <span className={styles.actionLabel}>Typ:</span>
                              <span className={styles.actionValue}>{action.actionType === 'pass' ? 'Podanie' : 'Drybling'}</span>
                            </span>
                            <span className={styles.actionDetailRow}>
                              <span className={styles.actionLabel}>Packing:</span>
                              <span className={styles.actionValue}>{packingPoints.toFixed(1)}</span>
                            </span>
                            <span className={styles.actionDetailRow}>
                              <span className={styles.actionLabel}>PxT:</span>
                              <span className={styles.actionValue}>{pxtValue.toFixed(2)}</span>
                            </span>
                            <span className={styles.actionDetailRow}>
                              <span className={styles.actionLabel}>xT:</span>
                              <span className={styles.actionValue}>{xTDifference.toFixed(3)}</span>
                            </span>
                            {action.isPenaltyAreaEntry && (
                              <span className={styles.actionDetailRow}>
                                <span className={styles.actionLabel}>PK:</span>
                                <span className={styles.actionValue}>Tak</span>
                              </span>
                            )}
                            {action.isShot && (
                              <span className={styles.actionDetailRow}>
                                <span className={styles.actionLabel}>Strzał:</span>
                                <span className={styles.actionValue}>Tak</span>
                              </span>
                            )}
                            {action.isGoal && (
                              <span className={styles.actionDetailRow}>
                                <span className={styles.actionLabel}>Gol:</span>
                                <span className={styles.actionValue}>Tak</span>
                              </span>
                            )}
                            {action.fromZone && (
                              <span className={styles.actionDetailRow}>
                                <span className={styles.actionLabel}>Z:</span>
                                <span className={styles.actionValue}>{action.fromZone}</span>
                              </span>
                            )}
                            {action.toZone && (
                              <span className={styles.actionDetailRow}>
                                <span className={styles.actionLabel}>Do:</span>
                                <span className={styles.actionValue}>{action.toZone}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Panel boczny z menu */}
      <SidePanel
        players={players}
        actions={allActions}
        matchInfo={selectedMatchInfo || null}
        isAdmin={isAdmin}
        userRole={userRole}
        linkedPlayerId={linkedPlayerId}
        selectedTeam={selectedTeam}
        onRefreshData={() => forceRefreshFromFirebase().then(() => {})}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
    </div>
  );
} 