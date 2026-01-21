"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Action, TeamInfo, Shot } from "@/types";
import { getOppositeXTValueForZone, getZoneName, getXTValueForZone, zoneNameToIndex, zoneNameToString } from "@/constants/xtValues";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { usePlayersState } from "@/hooks/usePlayersState";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { getCurrentSeason, filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import PlayerHeatmapPitch from "@/components/PlayerHeatmapPitch/PlayerHeatmapPitch";
import XGPitch from "@/components/XGPitch/XGPitch";
import PKEntriesPitch from "@/components/PKEntriesPitch/PKEntriesPitch";
import { getPlayerFullName } from "@/utils/playerUtils";
import SidePanel from "@/components/SidePanel/SidePanel";
import styles from "./statystyki-zespolu.module.css";

export default function StatystykiZespoluPage() {
  const { teams, isLoading: isTeamsLoading } = useTeams();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, logout } = useAuth();
  const { players } = usePlayersState();

  // Filtruj dostępne zespoły na podstawie uprawnień użytkownika (tak jak w głównej aplikacji)
  const availableTeams = useMemo(() => {
    if (isAdmin) {
      // Administratorzy mają dostęp do wszystkich zespołów
      return teams;
    }
    
    if (!userTeams || userTeams.length === 0) {
      return [];
    }
    
    // Filtruj zespoły na podstawie uprawnień użytkownika
    return teams.filter(team => userTeams.includes(team.id));
  }, [userTeams, isAdmin, teams]);
  
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

  const [selectedMatch, setSelectedMatch] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("teamStats_selectedMatch") || "";
    }
    return "";
  });
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allRegainActions, setAllRegainActions] = useState<Action[]>([]);
  const [allLosesActions, setAllLosesActions] = useState<Action[]>([]);
  const [allShots, setAllShots] = useState<any[]>([]);
  const [allPKEntries, setAllPKEntries] = useState<any[]>([]);
  const [allAcc8sEntries, setAllAcc8sEntries] = useState<any[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<'kpi' | 'pxt' | 'xg' | 'matchData' | 'pkEntries' | 'regains' | 'loses' | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('statystykiZespolu_expandedCategory');
      if (saved && ['pxt', 'xg', 'matchData', 'pkEntries', 'regains', 'loses'].includes(saved)) {
        return saved as 'pxt' | 'xg' | 'matchData' | 'pkEntries' | 'regains' | 'loses';
      }
      return 'pxt';
    }
    return 'pxt';
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("teamStats_selectedMatch", selectedMatch);
    }
  }, [selectedMatch]);
  const [selectedMetric, setSelectedMetric] = useState<'pxt' | 'xt' | 'packing'>('pxt');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble' | 'all'>('all');
  const [heatmapMode, setHeatmapMode] = useState<"pxt" | "count">("pxt");
  const [heatmapDirection, setHeatmapDirection] = useState<"from" | "to">("from");
  const [selectedPxtCategory, setSelectedPxtCategory] = useState<"sender" | "receiver" | "dribbler">("sender");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [teamRegainAttackDefenseMode, setTeamRegainAttackDefenseMode] = useState<"attack" | "defense">("defense");
  const [teamRegainHeatmapMode, setTeamRegainHeatmapMode] = useState<"xt" | "count">("xt");
  const [teamLosesAttackDefenseMode, setTeamLosesAttackDefenseMode] = useState<"attack" | "defense">("defense");
  const [teamLosesHeatmapMode, setTeamLosesHeatmapMode] = useState<"xt" | "count">("xt");
  const [losesHalfFilter, setLosesHalfFilter] = useState<"all" | "own" | "opponent" | "pm">("own");
  const [regainHalfFilter, setRegainHalfFilter] = useState<"all" | "own" | "opponent" | "pm">("own");
  const [selectedActionFilter, setSelectedActionFilter] = useState<Array<'p1' | 'p2' | 'p3' | 'p0start' | 'p1start' | 'p2start' | 'p3start' | 'pk' | 'shot' | 'goal'>>([]);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{ playerId: string; playerName: string; zoneName: string } | null>(null);
  const [matchDataPeriod, setMatchDataPeriod] = useState<'total' | 'firstHalf' | 'secondHalf'>('total');
  const [passesExpanded, setPassesExpanded] = useState(false);
  const [xgExpanded, setXgExpanded] = useState(false);
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [xgFilter, setXgFilter] = useState<'all' | 'sfg' | 'open_play'>('all');
  const [xgHalf, setXgHalf] = useState<'all' | 'first' | 'second'>('all');
  const [selectedPKEntryIdForView, setSelectedPKEntryIdForView] = useState<string | undefined>(undefined);
  const [pkEntryTypeFilter, setPkEntryTypeFilter] = useState<"all" | "pass" | "dribble" | "sfg">("all");
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

  // Helpery do filtrów akcji (Start/Koniec)
  const isFilterActive = (filter: 'p1' | 'p2' | 'p3' | 'p0start' | 'p1start' | 'p2start' | 'p3start' | 'pk' | 'shot' | 'goal'): boolean => {
    return Array.isArray(selectedActionFilter) && selectedActionFilter.includes(filter);
  };

  const hasStartFilterSelected = (): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    return filters.some(f => ['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
  };

  const hasEndFilterSelected = (): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    return filters.some(f => ['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
  };

  const matchesSelectedActionFilter = (action: Action): boolean => {
    const filters = Array.isArray(selectedActionFilter) ? selectedActionFilter : [];
    if (filters.length === 0) return true;

    const startFilters = filters.filter(f => ['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
    const endFilters = filters.filter(f => ['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));

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
      const isP1 = action.isP1 || action.isP1Start;
      const isP2 = action.isP2 || action.isP2Start;
      const isP3 = action.isP3 || action.isP3Start;
      const isPK = action.isPenaltyAreaEntry;
      const isShot = action.isShot;
      const isGoal = action.isGoal;

      matchesEndFilter = endFilters.some(filter => {
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
      fetchMatches(selectedTeam).catch(error => {
        console.error('❌ Błąd podczas pobierania meczów:', error);
      });
    }
  }, [selectedTeam]); // Tylko selectedTeam w dependency - bez funkcji żeby uniknąć infinite loop

  // Filtruj mecze według wybranego zespołu i sezonu
  const teamMatches = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return selectedSeason ? filterMatchesBySeason(teamFiltered, selectedSeason) : teamFiltered;
  }, [allMatches, selectedTeam, selectedSeason]);

  // Oblicz dostępne sezony na podstawie meczów wybranego zespołu
  const availableSeasons = useMemo(() => {
    const teamFiltered = allMatches.filter(match => match.team === selectedTeam);
    return getAvailableSeasonsFromMatches(teamFiltered);
  }, [allMatches, selectedTeam]);

  // Wybierz pierwszy mecz domyślnie przy zmianie zespołu
  useEffect(() => {
    if (teamMatches.length === 0) {
      if (selectedMatch) {
        setSelectedMatch("");
      }
      return;
    }

    const availableMatchIds = new Set(
      teamMatches
        .map(match => match.matchId)
        .filter((matchId): matchId is string => !!matchId)
    );

    if (selectedMatch && availableMatchIds.has(selectedMatch)) {
      return;
    }

    setSelectedMatch(teamMatches[0].matchId || "");
  }, [teamMatches, selectedMatch]);

  // Pobierz akcje dla wybranego meczu
  useEffect(() => {
    const loadActionsForMatch = async () => {
      if (!selectedMatch) {
        setAllActions([]);
        setAllRegainActions([]);
        setAllLosesActions([]);
        return;
      }

      setIsLoadingActions(true);

      try {
        if (!db) {
          console.error("Firebase nie jest zainicjalizowane");
          setAllActions([]);
          setAllRegainActions([]);
          setAllLosesActions([]);
          return;
        }

        const matchDoc = await getDoc(doc(db, "matches", selectedMatch));
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
          const actions = matchData.actions_packing || [];
          const shots = matchData.shots || [];
          const pkEntries = matchData.pkEntries || [];
          const acc8sEntries = (matchData as any).acc8sEntries || [];

          // Pobierz actions_regain i actions_loses BEZPOŚREDNIO z pól dokumentu (nie z subkolekcji!)
          const regainActions = (matchData.actions_regain || []).map(action => ({
            ...action,
            _actionSource: "regain"
          })) as Action[];
          
          const losesActions = (matchData.actions_loses || []).map(action => ({
            ...action,
            _actionSource: "loses"
          })) as Action[];

          setAllActions(actions);
          setAllRegainActions(regainActions);
          setAllLosesActions(losesActions);
          setAllShots(shots);
          setAllPKEntries(pkEntries);
          setAllAcc8sEntries(acc8sEntries);
        } else {
          setAllActions([]);
          setAllRegainActions([]);
          setAllLosesActions([]);
          setAllShots([]);
          setAllPKEntries([]);
          setAllAcc8sEntries([]);
        }
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
        setAllRegainActions([]);
        setAllLosesActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadActionsForMatch();
  }, [selectedMatch, selectedTeam]);

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
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
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
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
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

    // Filtruj akcje według wybranego typu
    const filteredActions = allActions.filter(action => {
      if (selectedActionType === 'all') return true;
      if (selectedActionType === 'pass') return action.actionType === 'pass';
      if (selectedActionType === 'dribble') return action.actionType === 'dribble';
      return true;
    });

    filteredActions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      const isPass = action.actionType === 'pass';
      const isDribble = action.actionType === 'dribble';
      
      if (action.minute <= 45) {
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
  }, [allActions, selectedActionType]);

  // Znajdź wybrany mecz dla wyświetlenia informacji
  const selectedMatchInfo = useMemo(() => {
    return teamMatches.find(match => match.matchId === selectedMatch);
  }, [teamMatches, selectedMatch]);

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
    if (!selectedMatch || allShots.length === 0 || !selectedMatchInfo) return [];

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
  }, [allShots, selectedMatch, selectedMatchInfo]);

  // Przygotuj dane dla wykresu xG co 5 min
  const xgChartData5Min = useMemo(() => {
    if (!selectedMatch || allShots.length === 0 || !selectedMatchInfo) return [];

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
  }, [allShots, selectedMatch, selectedMatchInfo]);

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
    const actionSource = action?._actionSource;
    if (actionSource) {
      return actionSource === 'lose' || actionSource === 'loses' || actionSource === 'loss';
    }
    const hasRegainFields = action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined;
    return action.isReaction5s !== undefined ||
      (action.isBelow8s !== undefined && !hasRegainFields);
  };

  const isRegainAction = (action: any): boolean => {
    const actionSource = action?._actionSource;
    if (actionSource) {
      return actionSource === 'regain';
    }
    const hasRegainFields = action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined;
    return hasRegainFields && !isLosesAction(action);
  };

  const teamActions = useMemo(() => {
    if (!selectedTeam) return allActions;
    return allActions.filter(action => !action.teamId || action.teamId === selectedTeam);
  }, [allActions, selectedTeam]);

  const teamRegainActions = useMemo(() => {
    if (!selectedTeam) return allRegainActions;
    const filtered = allRegainActions.filter(action => !action.teamId || action.teamId === selectedTeam);
    return filtered.length > 0 ? filtered : allRegainActions;
  }, [allRegainActions, selectedTeam]);

  const teamLosesActions = useMemo(() => {
    if (!selectedTeam) return allLosesActions;
    const filtered = allLosesActions.filter(action => !action.teamId || action.teamId === selectedTeam);
    return filtered.length > 0 ? filtered : allLosesActions;
  }, [allLosesActions, selectedTeam]);

  const derivedRegainActions = useMemo(() => {
    if (teamRegainActions.length > 0) return teamRegainActions;
    const filtered = teamActions.filter(action => isRegainAction(action));
    return filtered;
  }, [teamRegainActions, teamActions]);

  const derivedLosesActions = useMemo(() => {
    if (teamLosesActions.length > 0) return teamLosesActions;
    return teamActions.filter(action => isLosesAction(action));
  }, [teamLosesActions, teamActions]);

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
        senderP1Count: 0,
        senderP2Count: 0,
        senderP3Count: 0,
        senderPKCount: 0,
        senderShotCount: 0,
        senderGoalCount: 0,
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
        receiverP1Count: 0,
        receiverP2Count: 0,
        receiverP3Count: 0,
        receiverPKCount: 0,
        receiverShotCount: 0,
        receiverGoalCount: 0,
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
        dribblingP1Count: 0,
        dribblingP2Count: 0,
        dribblingP3Count: 0,
        dribblingPKCount: 0,
        dribblingShotCount: 0,
        dribblingGoalCount: 0,
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
    let senderP1Count = 0;
    let senderP2Count = 0;
    let senderP3Count = 0;
    let senderPKCount = 0;
    let senderShotCount = 0;
    let senderGoalCount = 0;
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
    let receiverP1Count = 0;
    let receiverP2Count = 0;
    let receiverP3Count = 0;
    let receiverPKCount = 0;
    let receiverShotCount = 0;
    let receiverGoalCount = 0;
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
    let dribblingP1Count = 0;
    let dribblingP2Count = 0;
    let dribblingP3Count = 0;
    let dribblingPKCount = 0;
    let dribblingShotCount = 0;
    let dribblingGoalCount = 0;
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
    allActions.forEach(action => {
      // Filtruj akcje według kategorii (tak jak w heatmapie)
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return;
      if (!matchesSelectedActionFilter(action)) return;
      
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;

      const isDribble = action.actionType === 'dribble';
      const isPass = action.actionType === 'pass';

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
        const endFilters = filters.filter(f => ['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));

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
          const isP1 = action.isP1 || action.isP1Start;
          const isP2 = action.isP2 || action.isP2Start;
          const isP3 = action.isP3 || action.isP3Start;
          const isPK = action.isPenaltyAreaEntry;
          const isShot = action.isShot;
          const isGoal = action.isGoal;

          matchesEndFilterForCounts = endFilters.some(filter => {
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

          // P3, P2, P1 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          if ((action.isP3 || action.isP3Start) && matchesFiltersForEndCounts) {
            senderP3Count += 1;
            if (senderIsLateral) senderP3CountLateral += 1;
            else senderP3CountCentral += 1;
          }
          if ((action.isP2 || action.isP2Start) && matchesFiltersForEndCounts) {
            senderP2Count += 1;
            if (senderIsLateral) senderP2CountLateral += 1;
            else senderP2CountCentral += 1;
          }
          if ((action.isP1 || action.isP1Start) && matchesFiltersForEndCounts) {
            senderP1Count += 1;
            if (senderIsLateral) senderP1CountLateral += 1;
            else senderP1CountCentral += 1;
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
          
          // P3, P2, P1 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Użyj tej samej logiki co w profilu zawodnika (action.isP1 || action.isP1Start)
          if (action.isP3 || action.isP3Start) {
            receiverP3Count += 1;
            if (receiverIsLateral) receiverP3CountLateral += 1;
            else receiverP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            receiverP2Count += 1;
            if (receiverIsLateral) receiverP2CountLateral += 1;
            else receiverP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
            receiverP1Count += 1;
            if (receiverIsLateral) receiverP1CountLateral += 1;
            else receiverP1CountCentral += 1;
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
          
          // P3, P2, P1 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Użyj tej samej logiki co w profilu zawodnika (action.isP1 || action.isP1Start)
          if (action.isP3 || action.isP3Start) {
            dribblingP3Count += 1;
            if (dribblingIsLateral) dribblingP3CountLateral += 1;
            else dribblingP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            dribblingP2Count += 1;
            if (dribblingIsLateral) dribblingP2CountLateral += 1;
            else dribblingP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
            dribblingP1Count += 1;
            if (dribblingIsLateral) dribblingP1CountLateral += 1;
            else dribblingP1CountCentral += 1;
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
      senderP1Count,
      senderP2Count,
      senderP3Count,
      senderPKCount,
      senderShotCount,
      senderGoalCount,
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
      receiverP1Count,
      receiverP2Count,
      receiverP3Count,
      receiverPKCount,
      receiverShotCount,
      receiverGoalCount,
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
      dribblingP1Count,
      dribblingP2Count,
      dribblingP3Count,
      dribblingPKCount,
      dribblingShotCount,
      dribblingGoalCount,
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
  }, [allActions, teamActions, allShots, allPKEntries, selectedTeam, heatmapDirection, selectedPxtCategory, derivedRegainActions, derivedLosesActions]);

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
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      // Kolumna (0-11): 0-5 to własna połowa, 6-11 to połowa przeciwnika
      const col = zoneIndex % 12;
      return col <= 5; // Własna połowa: kolumny 0-5 (strefy 1-6)
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
    const filteredRegainActions = regainHalfFilter === "all"
      ? derivedRegainActions
      : regainHalfFilter === "pm"
      ? derivedRegainActions.filter(action => {
          const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          return isPMArea(defenseZoneName);
        })
      : derivedRegainActions.filter(action => {
          const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          
          if (!defenseZoneName) return false;
          
          const isOwn = isOwnHalf(defenseZoneName);
          
          return regainHalfFilter === "own" ? isOwn : !isOwn;
        });

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

    let attackContextCount = 0;
    let defenseContextCount = 0;
    let attackPlayersBehindSum = 0;
    let attackOpponentsBehindSum = 0;
    let defensePlayersBehindSum = 0;
    let defenseOpponentsBehindSum = 0;

    filteredRegainActions.forEach(action => {
      totalRegains += 1;

      const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
      
      // Policz przechwyty według połowy boiska
      if (defenseZoneName) {
        const isOwn = isOwnHalf(defenseZoneName);
        if (isOwn) {
          totalRegainsOwnHalf += 1;
        } else {
          totalRegainsOpponentHalf += 1;
        }
      }
      const attackZoneRaw = action.regainAttackZone || action.oppositeZone;
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
    };
    
    return result;
  }, [derivedRegainActions, regainHalfFilter]);

  // Statystyki po akcjach regain (xG, wejścia w PK, PXT 8s, 15s)
  const regainAfterStats = useMemo(() => {
    // Funkcja pomocnicza do określenia czy strefa jest na własnej połowie (A-H, 1-6) czy połowie przeciwnika (A-H, 7-12)
    const isOwnHalf = (zoneName: string | null | undefined): boolean => {
      if (!zoneName) return false;
      const normalized = convertZoneToName(zoneName);
      if (!normalized) return false;
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      // Kolumna (0-11): 0-5 to własna połowa, 6-11 to połowa przeciwnika
      const col = zoneIndex % 12;
      return col <= 5; // Własna połowa: kolumny 0-5 (strefy 1-6)
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
    const filteredRegainActions = regainHalfFilter === "all"
      ? derivedRegainActions
      : regainHalfFilter === "pm"
      ? derivedRegainActions.filter(action => {
          const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          return isPMArea(defenseZoneName);
        })
      : derivedRegainActions.filter(action => {
          const defenseZoneRaw = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          
          if (!defenseZoneName) return false;
          
          const isOwn = isOwnHalf(defenseZoneName);
          
          return regainHalfFilter === "own" ? isOwn : !isOwn;
        });

    if (!selectedMatch || !selectedMatchInfo || filteredRegainActions.length === 0) {
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
        const xTDifference = (item.action.xTValueEnd || 0) - (item.action.xTValueStart || 0);
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

      // Znajdź wszystkie akcje packing w ciągu 15 sekund po tej akcji regain
      const actionsWithin15s = allActionsWithTimestamp.filter(
        item => item.timestamp > regainTimestamp && item.timestamp <= fifteenSecondsAfterRegain && item.timestamp < nextRegainTimestamp
      );

      // Policz podania (akcje typu "pass")
      const passes15s = actionsWithin15s.filter(item => item.action.actionType === 'pass');
      totalPasses15s += passes15s.length;

      // Oblicz PXT z akcji w ciągu 15 sekund
      actionsWithin15s.forEach(item => {
        const xTDifference = (item.action.xTValueEnd || 0) - (item.action.xTValueStart || 0);
        const packingPoints = item.action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        totalPXT15s += pxtValue;
      });
    });

    const totalRegains = derivedRegainActions.length;

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
      xGPerRegain: totalRegains > 0 ? totalXG8s / totalRegains : 0,
      pkEntriesPerRegain: totalRegains > 0 ? totalPKEntries8s / totalRegains : 0,
      pxt8sPerRegain: totalRegains > 0 ? totalPXT8s / totalRegains : 0,
    };
  }, [selectedMatch, selectedMatchInfo, derivedRegainActions, allActions, allShots, allPKEntries, regainHalfFilter]);

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
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      // Kolumna (0-11): 0-5 to własna połowa, 6-11 to połowa przeciwnika
      const col = zoneIndex % 12;
      return col <= 5; // Własna połowa: kolumny 0-5 (strefy 1-6)
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
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          return isPMArea(defenseZoneName);
        })
      : derivedLosesActions.filter(action => {
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          
          if (!defenseZoneName) return false;
          
          const isOwn = isOwnHalf(defenseZoneName);
          
          return losesHalfFilter === "own" ? isOwn : !isOwn;
        });

    if (filteredLosesActions.length === 0) {
      return {
        losesXTInAttack: 0,
        losesXTInDefense: 0,
        losesAttackCount: 0,
        losesDefenseCount: 0,
        totalLosesOwnHalf: 0,
        totalLosesOpponentHalf: 0,
        attackXTHeatmap: new Map<string, number>(),
        defenseXTHeatmap: new Map<string, number>(),
        attackCountHeatmap: new Map<string, number>(),
        defenseCountHeatmap: new Map<string, number>(),
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
      const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
      
      // Policz straty według połowy boiska
      if (defenseZoneName) {
        if (isOwnHalf(defenseZoneName)) {
          totalLosesOwnHalf += 1;
        } else {
          totalLosesOpponentHalf += 1;
        }
      }
      const attackZoneRaw = action.losesAttackZone || action.oppositeZone;
      const attackZoneName = attackZoneRaw
        ? convertZoneToName(attackZoneRaw)
        : (defenseZoneName ? getOppositeZoneName(defenseZoneName) : null);

      const defenseXT = action.losesDefenseXT !== undefined
        ? action.losesDefenseXT
        : (() => {
            const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
            if (idx !== null) return getXTValueForZone(idx);
            return action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0);
          })();

      const attackXT = action.losesAttackXT !== undefined
        ? action.losesAttackXT
        : (action.oppositeXT !== undefined
          ? action.oppositeXT
          : (() => {
              const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
              return idx !== null ? getOppositeXTValueForZone(idx) : 0;
            })());

      if (defenseZoneName) {
        defenseXTHeatmap.set(defenseZoneName, (defenseXTHeatmap.get(defenseZoneName) || 0) + defenseXT);
        defenseCountHeatmap.set(defenseZoneName, (defenseCountHeatmap.get(defenseZoneName) || 0) + 1);
      }
      if (attackZoneName) {
        attackXTHeatmap.set(attackZoneName, (attackXTHeatmap.get(attackZoneName) || 0) + attackXT);
        attackCountHeatmap.set(attackZoneName, (attackCountHeatmap.get(attackZoneName) || 0) + 1);
      }

      losesXTInDefense += defenseXT;
      losesDefenseCount += 1;
      losesXTInAttack += attackXT;
      losesAttackCount += 1;
    });

    return {
      losesXTInAttack,
      losesXTInDefense,
      losesAttackCount,
      losesDefenseCount,
      totalLosesOwnHalf,
      totalLosesOpponentHalf,
      attackXTHeatmap,
      defenseXTHeatmap,
      attackCountHeatmap,
      defenseCountHeatmap,
    };
  }, [derivedLosesActions, losesHalfFilter]);

  // Oblicz całkowite xT dla wszystkich strat w meczu (bez filtra)
  const totalLosesXT = useMemo(() => {
    let totalXTInAttack = 0;
    let totalXTInDefense = 0;

    derivedLosesActions.forEach(action => {
      const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;

      const defenseXT = action.losesDefenseXT !== undefined
        ? action.losesDefenseXT
        : (() => {
            const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
            if (idx !== null) return getXTValueForZone(idx);
            return action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0);
          })();

      const attackXT = action.losesAttackXT !== undefined
        ? action.losesAttackXT
        : (action.oppositeXT !== undefined
          ? action.oppositeXT
          : (() => {
              const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
              return idx !== null ? getOppositeXTValueForZone(idx) : 0;
            })());

      totalXTInDefense += defenseXT;
      totalXTInAttack += attackXT;
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
      const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
      const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
      const defenseXT = action.losesDefenseXT !== undefined
        ? action.losesDefenseXT
        : (() => {
            const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
            if (idx !== null) return getXTValueForZone(idx);
            return action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0);
          })();
      const attackXT = action.losesAttackXT !== undefined
        ? action.losesAttackXT
        : (action.oppositeXT !== undefined
          ? action.oppositeXT
          : (() => {
              const idx = defenseZoneName ? zoneNameToIndex(defenseZoneName) : null;
              return idx !== null ? getOppositeXTValueForZone(idx) : 0;
            })());
      intervals[interval].loses += 1;
      intervals[interval].xtAttack += attackXT;
      intervals[interval].xtDefense += defenseXT;
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
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      // Kolumna (0-11): 0-5 to własna połowa, 6-11 to połowa przeciwnika
      const col = zoneIndex % 12;
      return col <= 5; // Własna połowa: kolumny 0-5 (strefy 1-6)
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
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          return isPMArea(defenseZoneName);
        })
      : derivedLosesActions.filter(action => {
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          
          if (!defenseZoneName) return false;
          
          const isOwn = isOwnHalf(defenseZoneName);
          
          if (losesHalfFilter === "own") return isOwn;
          if (losesHalfFilter === "opponent") return !isOwn;
          
          return false;
        });

    if (filteredLosesActions.length === 0) {
      return {
        reaction5sCount: 0,
        below8sCount: 0,
        unknownCount: 0,
        totalLosesForReaction5s: 0, // Całkowita liczba strat bez isAut i isReaction5sNotApplicable
      };
    }

    let reaction5sCount = 0;
    let below8sCount = 0;
    let unknownCount = 0;
    let totalLosesForReaction5s = 0;

    filteredLosesActions.forEach(action => {
      // Wyklucz akcje z isAut lub isReaction5sNotApplicable z liczenia dla reaction5s
      const isExcluded = action.isAut === true || action.isReaction5sNotApplicable === true;
      
      if (!isExcluded) {
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
      const zoneIndex = zoneNameToIndex(normalized);
      if (zoneIndex === null) return false;
      // Kolumna (0-11): 0-5 to własna połowa, 6-11 to połowa przeciwnika
      const col = zoneIndex % 12;
      return col <= 5; // Własna połowa: kolumny 0-5 (strefy 1-6)
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
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          return isPMArea(defenseZoneName);
        })
      : derivedLosesActions.filter(action => {
          const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
          const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
          
          if (!defenseZoneName) return false;
          
          const isOwn = isOwnHalf(defenseZoneName);
          
          if (losesHalfFilter === "own") return isOwn;
          if (losesHalfFilter === "opponent") return !isOwn;
          
          return false;
        });

    if (!selectedMatch || !selectedMatchInfo || filteredLosesActions.length === 0) {
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
  }, [selectedMatch, selectedMatchInfo, selectedTeam, derivedLosesActions, derivedRegainActions, allShots, allPKEntries, losesHalfFilter]);

  // Wykres PK entries co 5 minut (zespół vs przeciwnik)
  const pkEntriesTimeline = useMemo(() => {
    if (!selectedMatch || allPKEntries.length === 0) return [];

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
  }, [selectedMatch, allPKEntries]);

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

  const teamRegainHeatmap =
    teamRegainAttackDefenseMode === "attack"
      ? (teamRegainHeatmapMode === "xt" ? teamRegainStats.attackXTHeatmap : teamRegainStats.attackCountHeatmap)
      : (teamRegainHeatmapMode === "xt" ? teamRegainStats.defenseXTHeatmap : teamRegainStats.defenseCountHeatmap);

  const teamLosesHeatmap =
    teamLosesAttackDefenseMode === "attack"
      ? (teamLosesHeatmapMode === "xt" ? teamLosesStats.attackXTHeatmap : teamLosesStats.attackCountHeatmap)
      : (teamLosesHeatmapMode === "xt" ? teamLosesStats.defenseXTHeatmap : teamLosesStats.defenseCountHeatmap);

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

      // Normalizuj nazwę strefy do formatu "A1"
      const normalizedZone = typeof zone === 'string' 
        ? zone.toUpperCase().replace(/\s+/g, '') 
        : String(zone).toUpperCase().replace(/\s+/g, '');

      if (heatmapMode === "pxt") {
        const packingPoints = action.packingPoints || 0;
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
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
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
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
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      playerStats.pxt += pxtValue;
    });

    return stats;
  }, [allActions, heatmapMode, heatmapDirection, selectedPxtCategory, selectedActionFilter]);

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
              playerName: player ? getPlayerFullName(player) : `Zawodnik ${playerId}`,
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
          <p style={{ color: '#82ca9d' }}>PxT: {data.pxt?.toFixed(2)}</p>
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
          <Link href="/" className={styles.backButton}>
            Powrót do aplikacji
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/" className={styles.backButton} title="Powrót do głównej">
          ←
        </Link>
        <h1>Statystyki zespołu - Analiza meczu</h1>
      </div>

      {/* Kompaktowa sekcja wyboru */}
      <div className={styles.compactSelectorsContainer}>
        <div className={`${styles.compactSelectorGroup} ${styles.teamGroup}`}>
          <label htmlFor="team-select" className={styles.compactLabel}>
            Zespół:
          </label>
          {isTeamsLoading ? (
            <p className={styles.loadingText}>Ładowanie...</p>
          ) : (
          <select
            id="team-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
              className={styles.compactSelect}
              disabled={availableTeams.length === 0}
          >
              {availableTeams.length === 0 ? (
                <option value="">Brak dostępnych zespołów</option>
              ) : (
                Object.values(teamsObject).map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
                ))
              )}
          </select>
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

        <div className={styles.compactSelectorGroup}>
          <label htmlFor="match-select" className={styles.compactLabel}>
            Mecz:
          </label>
          {teamMatches.length === 0 ? (
            <p className={styles.noMatchesCompact}>Brak meczów</p>
          ) : (
            <select
              id="match-select"
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className={styles.compactSelect}
            >
              <option value="">-- Wybierz mecz --</option>
              {teamMatches.map(match => (
                <option key={match.matchId || match.opponent} value={match.matchId || ""}>
                  {match.opponent} ({match.date}) - {match.competition} - {match.isHome ? 'Dom' : 'Wyjazd'}
                </option>
              ))}
            </select>
          )}
        </div>
        </div>

      {/* Zakładki z metrykami */}
      {selectedMatch && !isLoadingActions && (
        <div className={styles.statsContainer}>
          <div className={styles.statsLayout}>
            {/* Lista kategorii na górze */}
            <div className={styles.categoriesList}>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'kpi' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'kpi' ? null : 'kpi')}
              >
                <span className={styles.categoryName}>KPI</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'pxt' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'pxt' ? null : 'pxt')}
              >
                <span className={styles.categoryName}>PxT</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'xg' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'xg' ? null : 'xg')}
              >
                <span className={styles.categoryName}>xG</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`${styles.categoryItem} ${expandedCategory === 'matchData' ? styles.active : ''}`}
                  onClick={() => setExpandedCategory(expandedCategory === 'matchData' ? null : 'matchData')}
                >
                  <span className={styles.categoryName}>Dane meczowe</span>
                </button>
              )}
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'regains' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'regains' ? null : 'regains')}
              >
                <span className={styles.categoryName}>Przechwyty</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'loses' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'loses' ? null : 'loses')}
              >
                <span className={styles.categoryName}>Straty</span>
              </button>
              <button
                type="button"
                className={`${styles.categoryItem} ${expandedCategory === 'pkEntries' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'pkEntries' ? null : 'pkEntries')}
              >
                <span className={styles.categoryName}>Wejścia w PK</span>
              </button>
      </div>

            {/* Szczegóły poniżej */}
            {expandedCategory === 'kpi' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>KPI</h3>
                
                {(() => {
                  // Oblicz dane dla spidermapy
                  const isSelectedTeamHome = selectedMatchInfo.isHome;
                  const teamIdInMatch = selectedTeam;
                  const opponentIdInMatch = isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;
                  
                  // Filtruj strzały przeciwnika
                  const opponentShots = allShots.filter(shot => {
                    const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                      ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                      : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                    return shotTeamId === opponentIdInMatch;
                  });
                  
                  // Filtruj strzały naszego zespołu
                  const teamShots = allShots.filter(shot => {
                    const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                      ? (isSelectedTeamHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                      : (isSelectedTeamHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                    return shotTeamId === teamIdInMatch;
                  });
                  
                  const opponentXG = opponentShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                  const opponentShotsCount = opponentShots.length;
                  const opponentXGPerShot = opponentShotsCount > 0 ? (opponentXG / opponentShotsCount) : 0;
                  
                  const teamXG = teamShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                  const teamShotsCount = teamShots.length;
                  const teamXGPerShot = teamShotsCount > 0 ? (teamXG / teamShotsCount) : 0;
                  
                  // Wejścia w PK przeciwnika (teamContext === 'defense')
                  const opponentPKEntries = (allPKEntries || []).filter((e: any) => 
                    e && e.teamId === selectedTeam && (e.teamContext ?? "attack") === "defense"
                  );
                  const opponentPKEntriesCount = opponentPKEntries.length;
                  
                  // Oblicz % strat z isReaction5s === true
                  // 1. Wliczamy wszystkie straty z loses
                  // 2. Odejmujemy straty z flagami isReaction5sNotApplicable i isAut
                  // 3. Sprawdzamy, jaki % i ile jest strat z flagą isReaction5s w tym zbiorze
                  const allLoses = derivedLosesActions;
                  const losesExcludingNotApplicableAndAut = allLoses.filter(action => 
                    action.isReaction5sNotApplicable !== true && action.isAut !== true
                  );
                  const reaction5sLoses = losesExcludingNotApplicableAndAut.filter(action => 
                    action.isReaction5s === true
                  );
                  const reaction5sPercentage = losesExcludingNotApplicableAndAut.length > 0 
                    ? (reaction5sLoses.length / losesExcludingNotApplicableAndAut.length) * 100 
                    : 0;
                  
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
                    const defenseZoneRaw = action.losesDefenseZone || action.fromZone || action.toZone || action.startZone;
                    const defenseZoneName = defenseZoneRaw ? convertZoneToName(defenseZoneRaw) : null;
                    return isPMArea(defenseZoneName);
                  });
                  const losesInPMAreaCount = losesInPMArea.length;
                  const losesInPMAreaPercentage = allLoses.length > 0 
                    ? (losesInPMAreaCount / allLoses.length) * 100 
                    : 0;
                  
                  // Oblicz statystyki 8s ACC
                  // allAcc8sEntries są już przefiltrowane dla wybranego meczu w useEffect
                  const all8sAccEntries = (allAcc8sEntries || []).filter((entry: any) => entry);
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
                  
                  const pkEntriesWithTimestamp = (allPKEntries || []).filter((entry: any) => 
                    entry && (entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null || 
                              entry.videoTimestamp !== undefined && entry.videoTimestamp !== null)
                  );
                  
                  const shotsWithTimestamp = (allShots || []).filter((entry: any) => 
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
                  // Zakładamy maksymalne wartości: xG = 3.0, xG/strzał = 0.15, wejścia w PK = 20, % = 100
                  const maxXG = 3.0;
                  const maxXGPerShot = 0.15;
                  const maxPKEntries = 20;
                  const maxPercentage = 100;
                  
                  const normalizedOpponentXG = Math.min((opponentXG / maxXG) * 100, 100);
                  const normalizedOpponentXGPerShot = Math.min((opponentXGPerShot / maxXGPerShot) * 100, 100);
                  const normalizedTeamXG = Math.min((teamXG / maxXG) * 100, 100);
                  const normalizedTeamXGPerShot = Math.min((teamXGPerShot / maxXGPerShot) * 100, 100);
                  const normalizedOpponentPKEntries = Math.min((opponentPKEntriesCount / maxPKEntries) * 100, 100);
                  const normalizedReaction5sPercentage = Math.min((reaction5sPercentage / maxPercentage) * 100, 100);
                  const normalizedLosesInPMAreaPercentage = Math.min((losesInPMAreaPercentage / maxPercentage) * 100, 100);
                  
                  // Normalizacja dla "Udane wejścia" - cel to 25%, więc normalizujemy do skali gdzie 25% = 100%
                  const target8sAcc = 25;
                  const normalized8sAcc = Math.min((shotAndPK8sPercentage / target8sAcc) * 100, 100);
                  
                  const radarData = [
                    {
                      subject: 'xG - xG przeciwnika',
                      value: normalizedOpponentXG,
                      fullMark: 100,
                    },
                    {
                      subject: 'xG/strzał',
                      value: normalizedOpponentXGPerShot,
                      fullMark: 100,
                    },
                    {
                      subject: 'PK przeciwnik',
                      value: normalizedOpponentPKEntries,
                      fullMark: 100,
                    },
                    {
                      subject: '5s',
                      value: normalizedReaction5sPercentage,
                      fullMark: 100,
                    },
                    {
                      subject: 'Straty PM Area',
                      value: normalizedLosesInPMAreaPercentage,
                      fullMark: 100,
                    },
                    {
                      subject: '8s ACC',
                      value: normalized8sAcc,
                      fullMark: 100,
                    },
                  ];
                  
                  return (
                    <div className={styles.chartContainerInPanel}>
                      <div className={styles.chartHeader}>
                        <h3>Spidermapa</h3>
                        <span className={styles.chartInfo}>
                          xG przeciwnika: {opponentXG.toFixed(2)} • xG/strzał: {opponentXGPerShot.toFixed(3)} ({opponentShotsCount} strzałów) • 
                          PK przeciwnik: {opponentPKEntriesCount} • 
                          5s: {reaction5sPercentage.toFixed(1)}% ({reaction5sLoses.length}/{losesExcludingNotApplicableAndAut.length}) • 
                          Straty PM Area: {losesInPMAreaPercentage.toFixed(1)}% ({losesInPMAreaCount}/{allLoses.length}) • 
                          Udane wejścia: {shotAndPK8sPercentage.toFixed(1)}% ({shotAndPK8sCount}/{total8sAcc}) [Cel: 25%]
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={400}>
                        <RadarChart data={radarData}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) return null;
                              const data = payload[0].payload;
                              let displayValue = '';
                              
                              // Wyświetlaj rzeczywiste wartości zamiast znormalizowanych
                              if (data.subject === 'xG - xG przeciwnika') {
                                displayValue = `${opponentXG.toFixed(2)}`;
                              } else if (data.subject === 'xG/strzał') {
                                displayValue = `${opponentXGPerShot.toFixed(3)} (${opponentShotsCount} strzałów)`;
                              } else if (data.subject === 'PK przeciwnik') {
                                displayValue = `${opponentPKEntriesCount}`;
                              } else if (data.subject === '5s') {
                                displayValue = `${reaction5sPercentage.toFixed(1)}% (${reaction5sLoses.length}/${losesExcludingNotApplicableAndAut.length})`;
                              } else if (data.subject === 'Straty PM Area') {
                                displayValue = `${losesInPMAreaPercentage.toFixed(1)}% (${losesInPMAreaCount}/${allLoses.length})`;
                              } else if (data.subject === '8s ACC') {
                                displayValue = `${shotAndPK8sPercentage.toFixed(1)}% (${shotAndPK8sCount}/${total8sAcc}) [Cel: 25%]`;
                              }
                              
                              return (
                                <div style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  border: '1px solid #ccc',
                                  borderRadius: '4px',
                                  padding: '8px 12px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}>
                                  <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '4px' }}>{data.subject}</p>
                                  <p style={{ margin: 0, color: '#8884d8' }}>{displayValue}</p>
                                </div>
                              );
                            }}
                          />
                          <Radar
                            name="Wartości"
                            dataKey="value"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.6}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      
                      {/* Sekcja KPI 8s ACC pod spidermapą */}
                      <div className={styles.detailsSection} style={{ marginTop: '24px' }}>
                        <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Statystyki</h4>
                        <div className={styles.detailsRow}>
                          <span className={styles.detailsLabel}>Udane wejścia:</span>
                          <span className={styles.detailsValue}>
                            <span className={styles.valueMain}><strong>{shotAndPK8sPercentage.toFixed(1)}%</strong></span>
                            <span className={styles.valueSecondary}> ({shotAndPK8sCount}/{total8sAcc})</span>
                            {shotAndPK8sPercentage < target8sAcc ? (
                              <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '13px' }}>
                                -{(target8sAcc - shotAndPK8sPercentage).toFixed(1)}%
                              </span>
                            ) : shotAndPK8sPercentage > target8sAcc ? (
                              <span style={{ color: '#10b981', marginLeft: '8px', fontSize: '13px' }}>
                                +{(shotAndPK8sPercentage - target8sAcc).toFixed(1)}%
                              </span>
                            ) : (
                              <span style={{ color: '#10b981', marginLeft: '8px', fontSize: '13px' }}>
                                [Cel osiągnięty]
                              </span>
                            )}
                          </span>
                        </div>
                        {shotAndPK8sCount > 0 && (
                          <details style={{ marginTop: '8px', marginLeft: '0' }}>
                            <summary style={{ cursor: 'pointer', color: '#2196f3', fontSize: '14px', fontWeight: '500' }}>
                              Pokaż czasy eventów ({shotAndPK8sCount})
                            </summary>
                            <div style={{ marginTop: '8px', paddingLeft: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                              {shotAndPK8sEntries
                                .filter((entry: any) => entry.videoTimestampRaw !== undefined && entry.videoTimestampRaw !== null)
                                .sort((a: any, b: any) => (a.videoTimestampRaw || 0) - (b.videoTimestampRaw || 0))
                                .map((entry: any, index: number) => {
                                  // Użyj videoTimestampRaw dla czasu 8s ACC
                                  const acc8sTimeRaw = entry.videoTimestampRaw;
                                  const minutes = Math.floor(acc8sTimeRaw / 60);
                                  const seconds = Math.floor(acc8sTimeRaw % 60);
                                  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                  const flags = [];
                                  if (entry.isShotUnder8s) flags.push('Strzał');
                                  if (entry.isPKEntryUnder8s) flags.push('PK');
                                  
                                  // Znajdź najbliższe wejście w PK LUB strzał (następujące po czasie 8s ACC, bez limitu czasu)
                                  // Szukaj w wejściach PK (używamy videoTimestampRaw, jeśli nie ma, użyj videoTimestamp + 10s)
                                  const followingPKEntries = (allPKEntries || []).filter((pkEntry: any) => {
                                    if (!pkEntry) return false;
                                    let pkTime: number | null = null;
                                    if (pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null) {
                                      pkTime = pkEntry.videoTimestampRaw;
                                    } else if (pkEntry.videoTimestamp !== undefined && pkEntry.videoTimestamp !== null) {
                                      pkTime = pkEntry.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    if (pkTime === null) return false;
                                    return pkTime >= acc8sTimeRaw; // Następuje po (bez limitu)
                                  });
                                  
                                  // Szukaj w strzałach (używamy videoTimestampRaw, jeśli nie ma, użyj videoTimestamp + 10s)
                                  const followingShots = (allShots || []).filter((shot: any) => {
                                    if (!shot) return false;
                                    let shotTime: number | null = null;
                                    if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                                      shotTime = shot.videoTimestampRaw;
                                    } else if (shot.videoTimestamp !== undefined && shot.videoTimestamp !== null) {
                                      shotTime = shot.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    if (shotTime === null) return false;
                                    return shotTime >= acc8sTimeRaw; // Następuje po (bez limitu)
                                  });
                                  
                                  // Znajdź najbliższe wejście w PK
                                  let nearestPK: { time: number; diff: number } | null = null;
                                  followingPKEntries.forEach((pkEntry: any) => {
                                    let pkTime: number;
                                    if (pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null) {
                                      pkTime = pkEntry.videoTimestampRaw;
                                    } else {
                                      pkTime = pkEntry.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    const diff = pkTime - acc8sTimeRaw;
                                    if (!nearestPK || diff < nearestPK.diff) {
                                      nearestPK = { time: pkTime, diff };
                                    }
                                  });
                                  
                                  // Znajdź najbliższy strzał
                                  let nearestShot: { time: number; diff: number } | null = null;
                                  followingShots.forEach((shot: any) => {
                                    let shotTime: number;
                                    if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                                      shotTime = shot.videoTimestampRaw;
                                    } else {
                                      shotTime = shot.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    const diff = shotTime - acc8sTimeRaw;
                                    if (!nearestShot || diff < nearestShot.diff) {
                                      nearestShot = { time: shotTime, diff };
                                    }
                                  });
                                  
                                  // Wybierz najbliższe zdarzenie (albo PK, albo strzał - to które jest bliżej)
                                  let nearestEvent: { time: number; diff: number; type: string } | null = null;
                                  
                                  if (nearestPK && nearestShot) {
                                    // Jeśli są oba, wybierz to które jest bliżej
                                    nearestEvent = nearestPK.diff <= nearestShot.diff ? 
                                      { ...nearestPK, type: 'PK' } : 
                                      { ...nearestShot, type: 'Strzał' };
                                  } else if (nearestPK) {
                                    nearestEvent = { ...nearestPK, type: 'PK' };
                                  } else if (nearestShot) {
                                    nearestEvent = { ...nearestShot, type: 'Strzał' };
                                  }
                                  
                                  let nearestEventString = '';
                                  if (nearestEvent) {
                                    const eventMinutes = Math.floor(nearestEvent.time / 60);
                                    const eventSeconds = Math.floor(nearestEvent.time % 60);
                                    const eventTimeString = `${eventMinutes}:${eventSeconds.toString().padStart(2, '0')}`;
                                    nearestEventString = ` → ${eventTimeString} (${nearestEvent.type}, +${nearestEvent.diff}s)`;
                                  }
                                  
                                  return (
                                    <div key={entry.id || index} style={{ padding: '4px 0', fontSize: '13px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{timeString} - {flags.join(', ')}</span>
                                      {nearestEventString && (
                                        <span style={{ color: '#2196f3', marginLeft: '16px' }}>{nearestEventString}</span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </details>
                        )}
                        <div className={styles.detailsRow}>
                          <span className={styles.detailsLabel}>Wejścia w PK w 8s od akcji 8s ACC:</span>
                          <span className={styles.detailsValue}>
                            <span className={styles.valueMain}><strong>{pkEntriesWithin8sPercentage.toFixed(1)}%</strong></span>
                            <span className={styles.valueSecondary}> ({pkEntriesWithin8sCount}/{total8sAcc})</span>
                          </span>
                        </div>
                        {pkEntriesWithin8sCount > 0 && (
                          <details style={{ marginTop: '8px', marginLeft: '0' }}>
                            <summary style={{ cursor: 'pointer', color: '#2196f3', fontSize: '14px', fontWeight: '500' }}>
                              Pokaż czasy eventów 8s ({pkEntriesWithin8sCount})
                            </summary>
                            <div style={{ marginTop: '8px', paddingLeft: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                              {acc8sWithPKOrShot8s
                                .map((acc8sEntry: any) => {
                                  const acc8sTimeRaw = acc8sEntry.videoTimestampRaw;
                                  const timeWindowEnd = acc8sTimeRaw + 8;
                                  
                                  // Znajdź wejścia w PK w przedziale 8s (używamy videoTimestampRaw, jeśli nie ma, użyj videoTimestamp + 10s)
                                  const nearbyPKEntries = pkEntriesWithTimestamp.filter((pkEntry: any) => {
                                    let pkTime: number | null = null;
                                    if (pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null) {
                                      pkTime = pkEntry.videoTimestampRaw;
                                    } else if (pkEntry.videoTimestamp !== undefined && pkEntry.videoTimestamp !== null) {
                                      pkTime = pkEntry.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    if (pkTime === null) return false;
                                    return pkTime >= acc8sTimeRaw && pkTime <= timeWindowEnd;
                                  });
                                  
                                  // Znajdź strzały w przedziale 8s (używamy videoTimestampRaw, jeśli nie ma, użyj videoTimestamp + 10s)
                                  const nearbyShots = shotsWithTimestamp.filter((shot: any) => {
                                    let shotTime: number | null = null;
                                    if (shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null) {
                                      shotTime = shot.videoTimestampRaw;
                                    } else if (shot.videoTimestamp !== undefined && shot.videoTimestamp !== null) {
                                      shotTime = shot.videoTimestamp + 10; // Dodaj 10s, bo videoTimestamp ma odjęte 10s
                                    }
                                    if (shotTime === null) return false;
                                    return shotTime >= acc8sTimeRaw && shotTime <= timeWindowEnd;
                                  });
                                  
                                  if (nearbyPKEntries.length === 0 && nearbyShots.length === 0) return null;
                                  
                                  const acc8sMinutes = Math.floor(acc8sTimeRaw / 60);
                                  const acc8sSeconds = Math.floor(acc8sTimeRaw % 60);
                                  const acc8sTimeString = `${acc8sMinutes}:${acc8sSeconds.toString().padStart(2, '0')}`;
                                  
                                  const eventStrings: string[] = [];
                                  
                                  if (nearbyPKEntries.length > 0) {
                                    const pkTimes = nearbyPKEntries.map((pkEntry: any) => {
                                      const pkTime = pkEntry.videoTimestampRaw !== undefined && pkEntry.videoTimestampRaw !== null
                                        ? pkEntry.videoTimestampRaw
                                        : pkEntry.videoTimestamp + 10;
                                      const pkMinutes = Math.floor(pkTime / 60);
                                      const pkSeconds = Math.floor(pkTime % 60);
                                      const pkTimeString = `${pkMinutes}:${pkSeconds.toString().padStart(2, '0')}`;
                                      const diff = Math.floor(pkTime - acc8sTimeRaw);
                                      return `${pkTimeString} (+${diff}s)`;
                                    });
                                    eventStrings.push(`PK: ${pkTimes.join(', ')}`);
                                  }
                                  
                                  if (nearbyShots.length > 0) {
                                    const shotTimes = nearbyShots.map((shot: any) => {
                                      const shotTime = shot.videoTimestampRaw !== undefined && shot.videoTimestampRaw !== null
                                        ? shot.videoTimestampRaw
                                        : shot.videoTimestamp + 10;
                                      const shotMinutes = Math.floor(shotTime / 60);
                                      const shotSeconds = Math.floor(shotTime % 60);
                                      const shotTimeString = `${shotMinutes}:${shotSeconds.toString().padStart(2, '0')}`;
                                      const diff = Math.floor(shotTime - acc8sTimeRaw);
                                      return `${shotTimeString} (+${diff}s)`;
                                    });
                                    eventStrings.push(`Strzał: ${shotTimes.join(', ')}`);
                                  }
                                  
                                  return (
                                    <div key={acc8sEntry.id} style={{ padding: '4px 0', fontSize: '13px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{acc8sTimeString}</span>
                                      <span style={{ color: '#2196f3', marginLeft: '16px' }}>→ {eventStrings.join(', ')}</span>
                                    </div>
                                  );
                                })
                                .filter(Boolean)}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
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
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>GOLE:</span>
                    <span className={styles.detailsValue}><span className={styles.valueMain}>{pkEntriesSideStats.goals}</span></span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>STRZAŁY:</span>
                    <span className={styles.detailsValue}><span className={styles.valueMain}>{pkEntriesSideStats.shots}</span></span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYT:</span>
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
                      onEntryClick={(entry) => setSelectedPKEntryIdForView(entry.id)}
                      selectedEntryId={selectedPKEntryIdForView}
                      matchInfo={selectedMatchInfo}
                      allTeams={availableTeams}
                      hideTeamLogos={true}
                      hideFlipButton={false}
                      hideInstructions={true}
                    />
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
                    {(selectedPKEntry.senderName || selectedPKEntry.receiverName) && (
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>ZAWODNICY:</span>
                        <span className={styles.detailsValue}>
                          <span className={styles.valueMain}>
                            {selectedPKEntry.senderName ? selectedPKEntry.senderName : '—'}
                            {selectedPKEntry.receiverName ? ` → ${selectedPKEntry.receiverName}` : ''}
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
                      <Bar dataKey="opponent" name="Przeciwnik" fill="#ef4444" radius={[4, 4, 0, 0]} />
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

                {/* Podstawowe statystyki */}
                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYTY:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamRegainStats.totalRegains}</span>
                      {teamStats.totalRegains > 0 && (
                        <span className={styles.valueSecondary}>/{teamStats.totalRegains} ({((teamRegainStats.totalRegains / teamStats.totalRegains) * 100).toFixed(1)}%)</span>
                      )}
                      <span className={styles.valueSecondary}> • ({teamStats.regainsPer90.toFixed(1)} / 90)</span>
                    </span>
                  </div>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>PRZECHWYTY NA POŁOWIE PRZECIWNIKA:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamRegainStats.totalRegainsOpponentHalf}</span>
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
                      />
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
                              <p style={{ color: '#ef4444' }}>xT w ataku: {data.xtAttack?.toFixed(3)}</p>
                              <p style={{ color: '#6b7280' }}>xT w obronie: {data.xtDefense?.toFixed(3)}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="regains" name="Przechwyty" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtAttack" name="xT w ataku" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtDefense" name="xT w obronie" fill="#6b7280" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Wykres na dole - jak w oryginalnej wersji */}
                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Przechwyty i straty co 5 minut</h3>
                    <span className={styles.chartInfo}>
                      {teamStats.totalRegains} przechwytów • {teamStats.totalLoses} strat
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
                      <Bar dataKey="loses" name="Straty" fill="#ef4444" radius={[4, 4, 0, 0]} />
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

                {/* Podstawowe statystyki */}
                <div className={styles.detailsSection}>
                  <div className={styles.detailsRow}>
                    <span className={styles.detailsLabel}>STRATY:</span>
                    <span className={styles.detailsValue}>
                      <span className={styles.valueMain}>{teamLosesStats.totalLosesOwnHalf + teamLosesStats.totalLosesOpponentHalf}</span>
                      {teamStats.totalLoses > 0 && (
                        <span className={styles.valueSecondary}>/{teamStats.totalLoses} ({(((teamLosesStats.totalLosesOwnHalf + teamLosesStats.totalLosesOpponentHalf) / teamStats.totalLoses) * 100).toFixed(1)}%)</span>
                      )}
                      <span className={styles.valueSecondary}> • ({teamStats.losesPer90.toFixed(1)} / 90)</span>
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
                      <span className={styles.valueMain}>
                        {losesContextStats.totalLosesForReaction5s > 0 ? ((losesContextStats.reaction5sCount / losesContextStats.totalLosesForReaction5s) * 100).toFixed(1) : 0}%
                      </span>
                      <span className={styles.valueSecondary}>
                        • {losesContextStats.reaction5sCount}/{losesContextStats.totalLosesForReaction5s} • </span>
                      <span className={styles.valueMain}>{losesAfterStats.totalOpponentRegains5s}</span>
                      <span className={styles.valueSecondary}> Nasz Regain</span>
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
                      />
                    </div>
                  </div>
                </div>

                {/* Wykres na dole */}
                <div className={styles.chartContainerInPanel}>
                  <div className={styles.chartHeader}>
                    <h3>Straty: liczba i <span className={styles.preserveCase}>xT</span> co 5 minut</h3>
                    <span className={styles.chartInfo}>{teamStats.totalLoses} strat</span>
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
                              <p style={{ color: '#ef4444' }}><strong>xT w ataku:</strong> {data.xtAttack?.toFixed(3)}</p>
                              <p style={{ color: '#6b7280' }}><strong>xT w obronie:</strong> {data.xtDefense?.toFixed(3)}</p>
                            </div>
                          );
                        }}
                      />
                      <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                      <Bar yAxisId="left" dataKey="loses" name="Straty" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtAttack" name="xT w ataku" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.85} />
                      <Bar yAxisId="right" dataKey="xtDefense" name="xT w obronie" fill="#6b7280" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {expandedCategory === 'xg' && selectedMatchInfo && (
              <div className={styles.detailsPanel}>
                <h3>xG</h3>
                
                {/* Boisko z otagowanymi strzałami */}
                {selectedMatch && allShots.length > 0 && (
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
                      
                      // KPI dla xG/strzał: 0.15
                      const XG_PER_SHOT_KPI = 0.15;
                      
                      return (
                        <>
                          {/* Statystyki xG */}
                          <div className={styles.xgStatsSummary}>
                            <div className={styles.xgComparisonTable}>
                              {/* Nagłówek tabeli */}
                              <div className={styles.xgTableHeaderRow}>
                                <div className={styles.xgTableHeaderCell}></div>
                                <div 
                                  className={`${styles.xgTableHeaderCell} ${styles.tooltipTrigger}`}
                                  data-tooltip="xG bez karnych"
                                >
                                  NP xG
                                </div>
                                <div className={styles.xgTableHeaderCell}>xG</div>
                                <div 
                                  className={`${styles.xgTableHeaderCell} ${styles.tooltipTrigger}`}
                                  data-tooltip={`KPI: ${XG_PER_SHOT_KPI.toFixed(2)}`}
                                >
                                  xG/strzał
                                </div>
                                <div className={styles.xgTableHeaderCell}>
                                  xG OT
                                  <div className={styles.xgTableHeaderSubtext}>
                                    ({teamShotsOnTarget.length}/{teamShotsCount} / {opponentShotsOnTarget.length}/{opponentShotsCount})
                                  </div>
                                </div>
                                <div className={styles.xgTableHeaderCell}>xG/min posiadania</div>
                                <div className={styles.xgTableHeaderCell}>Różnica xG-Bramki</div>
                                <div 
                                  className={`${styles.xgTableHeaderCell} ${styles.tooltipTrigger}`}
                                  data-tooltip="xG, które przeciwnik zablokował"
                                >
                                  xG zablokowane
                                </div>
                                <div 
                                  className={`${styles.xgTableHeaderCell} ${styles.tooltipTrigger}`}
                                  data-tooltip="Średnia liczba przeciwników na linii strzału"
                                >
                                  Zawodnicy na linii/strzał
                                </div>
                              </div>
                              
                              {/* Wiersz zespołu */}
                              <div className={styles.xgTableDataRow}>
                                <div className={styles.xgTableTeamCell}>
                                  {availableTeams.find(t => t.id === selectedTeam)?.name || 'ZESPÓŁ'}
                                </div>
                                <div className={styles.xgTableValueCell}>{teamXGNoPenalty.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{teamXG.toFixed(2)}</div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGPerShotValue >= XG_PER_SHOT_KPI ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {teamXGPerShot}
                                </div>
                                <div className={styles.xgTableValueCell}>{teamXGOT.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{teamXGPerMinPossession.toFixed(3)}</div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGDiff > 0 ? '#10b981' : teamXGDiff < 0 ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGDiff > 0 ? '+' : ''}{teamXGDiff.toFixed(2)}
                                </div>
                                <div className={styles.xgTableValueCell}>{teamXGBlocked.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{teamAvgLinePlayers.toFixed(1)}</div>
                              </div>
                              
                              {/* Wiersz przeciwnika */}
                              <div className={styles.xgTableDataRow}>
                                <div className={styles.xgTableTeamCell}>PRZECIWNIK</div>
                                <div className={styles.xgTableValueCell}>{opponentXGNoPenalty.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{opponentXG.toFixed(2)}</div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: opponentXGPerShotValue >= XG_PER_SHOT_KPI ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {opponentXGPerShot}
                                </div>
                                <div className={styles.xgTableValueCell}>{opponentXGOT.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{opponentXGPerMinPossession.toFixed(3)}</div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: opponentXGDiff > 0 ? '#10b981' : opponentXGDiff < 0 ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {opponentXGDiff > 0 ? '+' : ''}{opponentXGDiff.toFixed(2)}
                                </div>
                                <div className={styles.xgTableValueCell}>{opponentXGBlocked.toFixed(2)}</div>
                                <div className={styles.xgTableValueCell}>{opponentAvgLinePlayers.toFixed(1)}</div>
                              </div>
                              
                              {/* Wiersz różnic */}
                              <div className={styles.xgTableDataRow}>
                                <div className={styles.xgTableTeamCell}>RÓŻNICA</div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXG > opponentXG ? '#10b981' : teamXG < opponentXG ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXG > opponentXG ? '+' : ''}{(teamXG - opponentXG).toFixed(2)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGPerShotValue > opponentXGPerShotValue ? '#10b981' : teamXGPerShotValue < opponentXGPerShotValue ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGPerShotValue > opponentXGPerShotValue ? '+' : ''}{(teamXGPerShotValue - opponentXGPerShotValue).toFixed(2)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGOT > opponentXGOT ? '#10b981' : teamXGOT < opponentXGOT ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGOT > opponentXGOT ? '+' : ''}{(teamXGOT - opponentXGOT).toFixed(2)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGPerMinPossession > opponentXGPerMinPossession ? '#10b981' : teamXGPerMinPossession < opponentXGPerMinPossession ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGPerMinPossession > opponentXGPerMinPossession ? '+' : ''}{(teamXGPerMinPossession - opponentXGPerMinPossession).toFixed(3)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGDiff > opponentXGDiff ? '#10b981' : teamXGDiff < opponentXGDiff ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGDiff > opponentXGDiff ? '+' : ''}{(teamXGDiff - opponentXGDiff).toFixed(2)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamXGBlocked > opponentXGBlocked ? '#10b981' : teamXGBlocked < opponentXGBlocked ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGBlocked > opponentXGBlocked ? '+' : ''}{(teamXGBlocked - opponentXGBlocked).toFixed(2)}
                                </div>
                                <div 
                                  className={styles.xgTableValueCell}
                                  style={{
                                    color: teamAvgLinePlayers > opponentAvgLinePlayers ? '#10b981' : teamAvgLinePlayers < opponentAvgLinePlayers ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamAvgLinePlayers > opponentAvgLinePlayers ? '+' : ''}{(teamAvgLinePlayers - opponentAvgLinePlayers).toFixed(1)}
                                </div>
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
                          if (xgFilter === 'all') {
                            return filteredByHalf;
                          } else if (xgFilter === 'sfg') {
                            return filteredByHalf.filter(shot => {
                              // Sprawdź actionCategory jeśli jest dostępne
                              if ((shot as any).actionCategory === 'sfg') return true;
                              // W przeciwnym razie sprawdź actionType
                              return shot.actionType === 'corner' || 
                                     shot.actionType === 'free_kick' || 
                                     shot.actionType === 'direct_free_kick' || 
                                     shot.actionType === 'penalty' || 
                                     shot.actionType === 'throw_in';
                            });
                          } else if (xgFilter === 'open_play') {
                            return filteredByHalf.filter(shot => {
                              // Sprawdź actionCategory jeśli jest dostępne
                              if ((shot as any).actionCategory === 'open_play') return true;
                              // W przeciwnym razie sprawdź actionType
                              return shot.actionType === 'open_play' || 
                                     shot.actionType === 'counter' || 
                                     shot.actionType === 'regain';
                            });
                          }
                          return filteredByHalf;
                        })()}
                        onShotAdd={() => {}}
                          onShotClick={(shot) => setSelectedShot(shot)}
                          selectedShotId={selectedShot?.id}
                        matchInfo={selectedMatchInfo}
                        allTeams={availableTeams}
                          hideToggleButton={true}
                        />
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
                              <span className={styles.shotInfoValue}>{selectedShot.playerName || 'Nieznany'}</span>
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
                                  {selectedShot.bodyPart === 'foot' ? 'Noga' :
                                   selectedShot.bodyPart === 'head' ? 'Głowa' : 'Inna'}
                                </span>
                              </div>
                            )}
                            {selectedShot.assistantName && (
                              <div className={styles.shotInfoRow}>
                                <span className={styles.shotInfoLabel}>Asysta:</span>
                                <span className={styles.shotInfoValue}>{selectedShot.assistantName}</span>
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
                          {selectedMatch && xgChartData.length > 0 && (
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
                                      <p style={{ color: '#ef4444' }}>xG przeciwnika: {data.opponentXG?.toFixed(2)}</p>
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
                              stroke="#ef4444" 
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
                                      <p style={{ color: '#ef4444' }}>xG przeciwnika: {data.opponentXG?.toFixed(2)}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend iconSize={10} wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar 
                              dataKey="opponentXG" 
                              fill="#ef4444" 
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
            {expandedCategory === 'matchData' && selectedMatchInfo && (
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
                            
                            return (
                              <>
                                <div className={styles.matchDataTableRow}>
                                  <div className={styles.matchDataTableCell}>
                                    {homeXG.toFixed(2)}
                                  </div>
                                  <div className={styles.matchDataTableLabel}>
                                    xG
                                  </div>
                                  <div className={styles.matchDataTableCell}>
                                    {awayXG.toFixed(2)}
                                  </div>
                                </div>
                                
                              </>
                            );
                          })()}
                          
                          
                          {/* Strzały - PO xG */}
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
                            const homeGoals = homeShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                            const awayGoals = awayShots.filter(shot => shot.isGoal || shot.shotType === 'goal').length;
                            const homeAccuracy = homeShotsTotal > 0 
                              ? ((homeShotsOnTarget / homeShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                            const awayAccuracy = awayShotsTotal > 0 
                              ? ((awayShotsOnTarget / awayShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                            const homeConversion = homeShotsTotal > 0 
                              ? ((homeGoals / homeShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                            const awayConversion = awayShotsTotal > 0 
                              ? ((awayGoals / awayShotsTotal) * 100).toFixed(1) 
                              : '0.0';
                      
                      return (
                              <>
                                {/* Strzały */}
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
                          
                          {/* Przewaga terytorialna (Field tilt) */}
                          {(() => {
                            const totalOpponentHalfPasses = homeOppTotal + awayOppTotal;
                            const homeFieldTilt = totalOpponentHalfPasses > 0 
                              ? ((homeOppTotal / totalOpponentHalfPasses) * 100).toFixed(1) 
                              : '0.0';
                            const awayFieldTilt = totalOpponentHalfPasses > 0 
                              ? ((awayOppTotal / totalOpponentHalfPasses) * 100).toFixed(1) 
                              : '0.0';
                            
                            return (
                              <div className={styles.matchDataTableRow}>
                                <div className={styles.matchDataTableCell}>
                                  {homeFieldTilt}%
                                </div>
                                <div className={styles.matchDataTableLabel}>Przewaga terytorialna (Field tilt)</div>
                                <div className={styles.matchDataTableCell}>
                                  {awayFieldTilt}%
                          </div>
                        </div>
                      );
                    })()}
                          
                          {/* Akcje 8s ACC */}
                          {(() => {
                            const homeTotal8s = home8s + home8sUnsuccessful;
                            const awayTotal8s = away8s + away8sUnsuccessful;
                            const home8sPercent = homeTotal8s > 0 ? ((home8s / homeTotal8s) * 100).toFixed(1) : '0.0';
                            const away8sPercent = awayTotal8s > 0 ? ((away8s / awayTotal8s) * 100).toFixed(1) : '0.0';
                            
                            const hasHome8sData = home8s > 0 || home8sUnsuccessful > 0;
                            const hasAway8sData = away8s > 0 || away8sUnsuccessful > 0;
                            
                            return (
                              <div className={styles.matchDataTableRow}>
                                <div className={styles.matchDataTableCell} style={{ textAlign: 'right' }}>
                                  {hasHome8sData ? (
                                    <>
                                      <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({home8s}/{homeTotal8s})</span> <span>{home8sPercent}%</span>
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                  </div>
                                <div className={styles.matchDataTableLabel}>Akcje 8s ACC</div>
                                <div className={styles.matchDataTableCell} style={{ textAlign: 'left' }}>
                                  {hasAway8sData ? (
                                    <>
                                      <span>{away8sPercent}%</span> <span style={{ fontSize: '0.85em', color: '#6b7280' }}>({away8s}/{awayTotal8s})</span>
                                    </>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Czas posiadania */}
                          <div className={styles.matchDataTableRow}>
                            <div className={styles.matchDataTableCell}>
                              <div className={styles.possessionValue}>{homePossessionPercent}%</div>
                              <div className={styles.possessionTime}>{homePossession.toFixed(1)} min</div>
                            </div>
                            <div className={styles.matchDataTableLabel}>Czas posiadania</div>
                            <div className={styles.matchDataTableCell}>
                              <div className={styles.possessionValue}>{awayPossessionPercent}%</div>
                              <div className={styles.possessionTime}>{awayPossession.toFixed(1)} min</div>
                            </div>
                          </div>
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
      {selectedMatch && allActions.length > 0 && (
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
              {/* PxT/min posiadania dla 1. połowy */}
              {selectedMetric === 'pxt' && selectedMatchInfo?.matchData?.possession && (() => {
                const isHome = selectedMatchInfo.isHome;
                const teamPossession = isHome 
                  ? (selectedMatchInfo.matchData.possession.teamFirstHalf || 0)
                  : (selectedMatchInfo.matchData.possession.opponentFirstHalf || 0);
                if (teamPossession > 0) {
                  return (
                    <div className={styles.statSubValue}>
                      {(halfTimeStats.firstHalf.pxt / teamPossession).toFixed(3)} PxT/min posiadania
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
              {/* PxT/min posiadania dla 2. połowy */}
              {selectedMetric === 'pxt' && selectedMatchInfo?.matchData?.possession && (() => {
                const isHome = selectedMatchInfo.isHome;
                const teamPossession = isHome 
                  ? (selectedMatchInfo.matchData.possession.teamSecondHalf || 0)
                  : (selectedMatchInfo.matchData.possession.opponentSecondHalf || 0);
                if (teamPossession > 0) {
                  return (
                    <div className={styles.statSubValue}>
                      {(halfTimeStats.secondHalf.pxt / teamPossession).toFixed(3)} PxT/min posiadania
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
              <div className={styles.countItemsWrapper} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxWidth: '100%' }}>
                  <div 
                    className={`${styles.countItem} ${isFilterActive('p0start') ? styles.countItemSelected : ''} ${hasStartFilterSelected() && !isFilterActive('p0start') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasStartFilterSelected() && !isFilterActive('p0start')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                        if (filters.includes('p0start')) return withoutStartFilters;
                        return [...withoutStartFilters, 'p0start'];
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
                    className={`${styles.countItem} ${isFilterActive('p1start') ? styles.countItemSelected : ''} ${hasStartFilterSelected() && !isFilterActive('p1start') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasStartFilterSelected() && !isFilterActive('p1start')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                        if (filters.includes('p1start')) return withoutStartFilters;
                        return [...withoutStartFilters, 'p1start'];
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
                    className={`${styles.countItem} ${isFilterActive('p2start') ? styles.countItemSelected : ''} ${hasStartFilterSelected() && !isFilterActive('p2start') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasStartFilterSelected() && !isFilterActive('p2start')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                        if (filters.includes('p2start')) return withoutStartFilters;
                        return [...withoutStartFilters, 'p2start'];
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
                    className={`${styles.countItem} ${isFilterActive('p3start') ? styles.countItemSelected : ''} ${hasStartFilterSelected() && !isFilterActive('p3start') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasStartFilterSelected() && !isFilterActive('p3start')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutStartFilters = filters.filter(f => !['p0start', 'p1start', 'p2start', 'p3start'].includes(f));
                        if (filters.includes('p3start')) return withoutStartFilters;
                        return [...withoutStartFilters, 'p3start'];
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
                  <div 
                    className={`${styles.countItem} ${isFilterActive('pk') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('pk') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasEndFilterSelected() && !isFilterActive('pk')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                        if (filters.includes('pk')) return withoutEndFilters;
                        return [...withoutEndFilters, 'pk'];
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
                    className={`${styles.countItem} ${isFilterActive('shot') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('shot') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasEndFilterSelected() && !isFilterActive('shot')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                        if (filters.includes('shot')) return withoutEndFilters;
                        return [...withoutEndFilters, 'shot'];
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
                    className={`${styles.countItem} ${isFilterActive('goal') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('goal') ? styles.countItemDisabled : ''}`}
                    onClick={() => {
                      if (hasEndFilterSelected() && !isFilterActive('goal')) return;
                      setSelectedActionFilter(prev => {
                        const filters = Array.isArray(prev) ? prev : [];
                        const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                        if (filters.includes('goal')) return withoutEndFilters;
                        return [...withoutEndFilters, 'goal'];
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
                  className={`${styles.countItem} ${isFilterActive('pk') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('pk') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('pk')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('pk')) return withoutEndFilters;
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
                  className={`${styles.countItem} ${isFilterActive('shot') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('shot') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('shot')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('shot')) return withoutEndFilters;
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
                  className={`${styles.countItem} ${isFilterActive('goal') ? styles.countItemSelected : ''} ${hasEndFilterSelected() && !isFilterActive('goal') ? styles.countItemDisabled : ''}`}
                  onClick={() => {
                    if (hasEndFilterSelected() && !isFilterActive('goal')) return;
                    setSelectedActionFilter(prev => {
                      const filters = Array.isArray(prev) ? prev : [];
                      const withoutEndFilters = filters.filter(f => !['p1', 'p2', 'p3', 'pk', 'shot', 'goal'].includes(f));
                      if (filters.includes('goal')) return withoutEndFilters;
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
                {selectedMatch && allActions.length > 0 && (
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
                                    playerName: player ? getPlayerFullName(player) : `Zawodnik ${playerId}`,
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
                                    <div className={styles.zonePlayerName}>{player.playerName}</div>
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
                                          playerName: player.playerName,
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
        ) : !selectedMatch ? (
                  <p className={styles.noDataText}>Wybierz mecz, aby zobaczyć statystyki.</p>
        ) : teamChartData.length === 0 ? (
                  <p className={styles.noDataText}>Brak danych dla wybranego meczu.</p>
                ) : (
                  <>
                    <div className={styles.chartContainerInPanel}>
                      <div className={styles.chartHeader}>
                        <h3>Przyrost statystyk zespołu w czasie meczu</h3>
                        {!isLoadingActions && selectedMatch && teamChartData.length > 0 && (
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
                  <Tooltip content={<CustomTooltip />} />
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
                    stroke="#82ca9d" 
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
                                    <p style={{ color: '#ef4444' }}>xT: {data.xt?.toFixed(3)}</p>
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
                            fill="#ef4444" 
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
                      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
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
        selectedTeam={selectedTeam}
        onRefreshData={() => forceRefreshFromFirebase().then(() => {})}
        onImportSuccess={() => {}}
        onImportError={() => {}}
        onLogout={logout}
      />
    </div>
  );
} 