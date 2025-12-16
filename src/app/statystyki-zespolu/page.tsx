"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Action, TeamInfo, Shot } from "@/types";
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

  const [selectedMatch, setSelectedMatch] = useState<string>("");
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allShots, setAllShots] = useState<any[]>([]);
  const [allPKEntries, setAllPKEntries] = useState<any[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<'pxt' | 'xg' | 'matchData' | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('statystykiZespolu_expandedCategory');
      if (saved && ['pxt', 'xg', 'matchData'].includes(saved)) {
        return saved as 'pxt' | 'xg' | 'matchData';
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
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<'pxt' | 'xt' | 'packing'>('pxt');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble' | 'all'>('all');
  const [heatmapMode, setHeatmapMode] = useState<"pxt" | "count">("pxt");
  const [heatmapDirection, setHeatmapDirection] = useState<"from" | "to">("from");
  const [selectedPxtCategory, setSelectedPxtCategory] = useState<"sender" | "receiver" | "dribbler">("sender");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedActionFilter, setSelectedActionFilter] = useState<'p1' | 'p2' | 'p3' | 'pk' | 'shot' | 'goal' | null>(null);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{ playerId: string; playerName: string; zoneName: string } | null>(null);
  const [matchDataPeriod, setMatchDataPeriod] = useState<'total' | 'firstHalf' | 'secondHalf'>('total');
  const [passesExpanded, setPassesExpanded] = useState(false);
  const [xgExpanded, setXgExpanded] = useState(false);
  const [shotsExpanded, setShotsExpanded] = useState(false);
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [xgFilter, setXgFilter] = useState<'all' | 'sfg' | 'open_play'>('all');
  const [xgHalf, setXgHalf] = useState<'all' | 'first' | 'second'>('all');
  const [zoneDetails, setZoneDetails] = useState<{
    zoneName: string;
    players: Array<{
      playerId: string;
      playerName: string;
      pxt: number;
      passes: number;
    }>;
  } | null>(null);

  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();

  // Inicjalizuj selectedSeason na najnowszy sezon na podstawie meczów
  useEffect(() => {
    if (!selectedSeason && allMatches.length > 0) {
      const availableSeasons = getAvailableSeasonsFromMatches(allMatches);
      if (availableSeasons.length > 0) {
        // Wybierz najnowszy sezon (pierwszy w posortowanej liście)
        setSelectedSeason(availableSeasons[0].id);
      } else {
        setSelectedSeason("all");
      }
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
    if (teamMatches.length > 0 && teamMatches[0].matchId) {
      setSelectedMatch(teamMatches[0].matchId);
    } else {
      setSelectedMatch("");
    }
  }, [teamMatches]);

  // Pobierz akcje dla wybranego meczu
  useEffect(() => {
    const loadActionsForMatch = async () => {
      if (!selectedMatch) {
        setAllActions([]);
        return;
      }

      setIsLoadingActions(true);

             try {
         if (!db) {
           console.error("Firebase nie jest zainicjalizowane");
           setAllActions([]);
           return;
         }

         const matchDoc = await getDoc(doc(db, "matches", selectedMatch));
        
        if (matchDoc.exists()) {
          const matchData = matchDoc.data() as TeamInfo;
           const actions = matchData.actions_packing || [];
           const shots = matchData.shots || [];
           const pkEntries = matchData.pkEntries || [];
           setAllActions(actions);
           setAllShots(shots);
           setAllPKEntries(pkEntries);
        } else {
          setAllActions([]);
          setAllShots([]);
          setAllPKEntries([]);
        }
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadActionsForMatch();
  }, [selectedMatch]);

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

  // Przygotuj dane dla wykresu skumulowanego xG w czasie (jak w PxT)
  const xgChartData = useMemo(() => {
    if (!selectedMatch || allShots.length === 0 || !selectedMatchInfo) return [];

    const isHome = selectedMatchInfo.isHome;
    const teamId = isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent;
    const opponentId = isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team;

    // Filtruj strzały według połowy i kategorii
    let filteredShots = allShots;
    
    // Filtruj według połowy
    if (xgHalf === 'first') {
      filteredShots = filteredShots.filter(shot => shot.minute <= 45);
    } else if (xgHalf === 'second') {
      filteredShots = filteredShots.filter(shot => shot.minute > 45);
    }
    
    // Filtruj według kategorii
    if (xgFilter === 'sfg') {
      filteredShots = filteredShots.filter(shot => {
        if ((shot as any).actionCategory === 'sfg') return true;
        return shot.actionType === 'corner' || 
               shot.actionType === 'free_kick' || 
               shot.actionType === 'direct_free_kick' || 
               shot.actionType === 'penalty' || 
               shot.actionType === 'throw_in';
      });
    } else if (xgFilter === 'open_play') {
      filteredShots = filteredShots.filter(shot => {
        if ((shot as any).actionCategory === 'open_play') return true;
        return shot.actionType === 'open_play' || 
               shot.actionType === 'counter' || 
               shot.actionType === 'regain';
      });
    }

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

    // Filtruj strzały według połowy i kategorii
    let filteredShots = allShots;
    
    // Filtruj według połowy
    if (xgHalf === 'first') {
      filteredShots = filteredShots.filter(shot => shot.minute <= 45);
    } else if (xgHalf === 'second') {
      filteredShots = filteredShots.filter(shot => shot.minute > 45);
    }
    
    // Filtruj według kategorii
    if (xgFilter === 'sfg') {
      filteredShots = filteredShots.filter(shot => {
        if ((shot as any).actionCategory === 'sfg') return true;
        return shot.actionType === 'corner' || 
               shot.actionType === 'free_kick' || 
               shot.actionType === 'direct_free_kick' || 
               shot.actionType === 'penalty' || 
               shot.actionType === 'throw_in';
      });
    } else if (xgFilter === 'open_play') {
      filteredShots = filteredShots.filter(shot => {
        if ((shot as any).actionCategory === 'open_play') return true;
        return shot.actionType === 'open_play' || 
               shot.actionType === 'counter' || 
               shot.actionType === 'regain';
      });
    }

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
  }, [allShots, selectedMatch, selectedMatchInfo, xgHalf, xgFilter]);

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

    // Oblicz PxT z akcji
    // WAŻNE: Liczniki są obliczane tylko dla akcji z wybranej kategorii (selectedPxtCategory),
    // aby zgadzały się z heatmapą
    allActions.forEach(action => {
      // Filtruj akcje według kategorii (tak jak w heatmapie)
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return;
      
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
        
        // Licz tylko akcje, które mają strefę (tak jak heatmapa)
        if (senderZoneName) {
          const senderIsLateral = isLateralZone(senderZoneName);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            senderPKCount += 1;
            if (senderIsLateral) senderPKCountLateral += 1;
            else senderPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            senderShotCount += 1;
            if (senderIsLateral) senderShotCountLateral += 1;
            else senderShotCountCentral += 1;
            if (action.isGoal) {
              senderGoalCount += 1;
              if (senderIsLateral) senderGoalCountLateral += 1;
              else senderGoalCountCentral += 1;
            }
          }
          
          // P3, P2, P1 mogą być jednocześnie strzałami lub PK, więc sprawdzamy niezależnie
          // Użyj tej samej logiki co w profilu zawodnika (action.isP1 || action.isP1Start)
          if (action.isP3 || action.isP3Start) {
            senderP3Count += 1;
            if (senderIsLateral) senderP3CountLateral += 1;
            else senderP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            senderP2Count += 1;
            if (senderIsLateral) senderP2CountLateral += 1;
            else senderP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
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

      // Regainy
      if (
        (action.isBelow8s !== undefined || 
         action.playersBehindBall !== undefined || 
         action.opponentsBeforeBall !== undefined) &&
        !action.isReaction5s
      ) {
        totalRegains += 1;
      }

      // Straty
      if (
        action.isReaction5s !== undefined ||
        (action.isBelow8s !== undefined && 
         action.playersBehindBall === undefined && 
         action.opponentsBeforeBall === undefined)
      ) {
        totalLoses += 1;
      }

      // Wejścia w PK
      if (action.isPenaltyAreaEntry) {
        totalPKEntries += 1;
      }
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
    };
  }, [allActions, allShots, allPKEntries, selectedTeam, heatmapDirection, selectedPxtCategory]);

  // Przygotuj dane dla heatmapy zespołu i agregacja danych zawodników
  const teamHeatmapData = useMemo(() => {
    if (allActions.length === 0) return new Map<string, number>();

    const heatmap = new Map<string, number>();

    allActions.forEach(action => {
      // Filtruj akcje według kategorii
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return;

      // Filtruj akcje według wybranego typu akcji (P1, P2, P3, PK, Strzał, Gol)
      if (selectedActionFilter) {
        // Użyj tej samej logiki co w profilu zawodnika (action.isP1 || action.isP1Start)
        const isP1 = action.isP1 || action.isP1Start || false;
        const isP2 = action.isP2 || action.isP2Start || false;
        const isP3 = action.isP3 || action.isP3Start || false;
        const isPK = action.isPenaltyAreaEntry || false;
        const isShot = action.isShot || false;
        const isGoal = action.isGoal || false;

        if (selectedActionFilter === 'p1' && !isP1) return;
        if (selectedActionFilter === 'p2' && !isP2) return;
        if (selectedActionFilter === 'p3' && !isP3) return;
        if (selectedActionFilter === 'pk' && !isPK) return;
        if (selectedActionFilter === 'shot' && !isShot) return;
        if (selectedActionFilter === 'goal' && !isGoal) return;
      }

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
      
      // Filtruj akcje według wybranego typu akcji (P1, P2, P3, PK, Strzał, Gol)
      if (selectedActionFilter) {
        // Użyj tej samej logiki co w profilu zawodnika (action.isP1 || action.isP1Start)
        const isP1 = action.isP1 || action.isP1Start || false;
        const isP2 = action.isP2 || action.isP2Start || false;
        const isP3 = action.isP3 || action.isP3Start || false;
        const isPK = action.isPenaltyAreaEntry || false;
        const isShot = action.isShot || false;
        const isGoal = action.isGoal || false;

        if (selectedActionFilter === 'p1' && !isP1) return;
        if (selectedActionFilter === 'p2' && !isP2) return;
        if (selectedActionFilter === 'p3' && !isP3) return;
        if (selectedActionFilter === 'pk' && !isPK) return;
        if (selectedActionFilter === 'shot' && !isShot) return;
        if (selectedActionFilter === 'goal' && !isGoal) return;
      }
      
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
            {/* Lista kategorii po lewej */}
            <div className={styles.categoriesList}>
              <div
                className={`${styles.categoryItem} ${expandedCategory === 'pxt' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'pxt' ? null : 'pxt')}
              >
                <span className={styles.categoryName}>PxT</span>
                <span className={styles.categoryValue}>{teamStats.pxtPer90.toFixed(2)}</span>
              </div>
              <div
                className={`${styles.categoryItem} ${expandedCategory === 'xg' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'xg' ? null : 'xg')}
              >
                <span className={styles.categoryName}>xG</span>
                <span className={styles.categoryValue}>{teamStats.xgPer90.toFixed(2)}</span>
          </div>
              <div
                className={`${styles.categoryItem} ${expandedCategory === 'matchData' ? styles.active : ''}`}
                onClick={() => setExpandedCategory(expandedCategory === 'matchData' ? null : 'matchData')}
              >
                <span className={styles.categoryName}>Dane meczowe</span>
                <span className={styles.categoryValue}>-</span>
          </div>
              <div className={styles.categoryItem}>
                <span className={styles.categoryName}>Regainy</span>
                <span className={styles.categoryValue}>{teamStats.regainsPer90.toFixed(1)}</span>
              </div>
              <div className={styles.categoryItem}>
                <span className={styles.categoryName}>Straty</span>
                <span className={styles.categoryValue}>{teamStats.losesPer90.toFixed(1)}</span>
              </div>
              <div className={styles.categoryItem}>
                <span className={styles.categoryName}>Wejścia w PK</span>
                <span className={styles.categoryValue}>{teamStats.pkEntriesPer90.toFixed(1)}</span>
              </div>
      </div>

            {/* Szczegóły po prawej */}
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
                      
                      const isHome = selectedMatchInfo.isHome;
                      const teamName = selectedMatchInfo.team ? (availableTeams.find(t => t.id === selectedMatchInfo.team)?.name || 'Nasz zespół') : 'Nasz zespół';
                      const opponentName = selectedMatchInfo.opponent || 'Przeciwnik';
                      
                      const teamShots = filteredShotsForStats.filter(shot => {
                        const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                          ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                          : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                        return shotTeamId === (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent);
                      });
                      
                      const opponentShots = filteredShotsForStats.filter(shot => {
                        const shotTeamId = shot.teamId || (shot.teamContext === 'attack' 
                          ? (isHome ? selectedMatchInfo.team : selectedMatchInfo.opponent)
                          : (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team));
                        return shotTeamId === (isHome ? selectedMatchInfo.opponent : selectedMatchInfo.team);
                      });
                      
                      const teamXG = teamShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
                      const opponentXG = opponentShots.reduce((sum, shot) => sum + (shot.xG || 0), 0);
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
                      
                      const teamPossession = isHome ? getPossessionForXG('team') : getPossessionForXG('opponent');
                      const opponentPossession = isHome ? getPossessionForXG('opponent') : getPossessionForXG('team');
                      const teamXGPerMinPossession = teamPossession > 0 ? (teamXG / teamPossession) : 0;
                      const opponentXGPerMinPossession = opponentPossession > 0 ? (opponentXG / opponentPossession) : 0;
                      
                      // KPI dla xG/strzał: 0.15
                      const XG_PER_SHOT_KPI = 0.15;
                      
                      return (
                        <>
                          {/* Statystyki xG */}
                          <div className={styles.xgStatsSummary}>
                            <div className={styles.halfTimeContainerInPanel}>
                              {/* Karta zespołu */}
                              <div className={styles.halfTimeCardInPanel}>
                                <div className={styles.halfTimeLabel}>ZESPÓŁ</div>
                                <div className={styles.statValue}>{teamXG.toFixed(2)}</div>
                                <div className={styles.statLabel}>xG</div>
                                
                                <div 
                                  className={styles.statSubValue}
                                  style={{
                                    color: teamXGPerShotValue >= XG_PER_SHOT_KPI ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {teamXGPerShot}
                                </div>
                                <div className={styles.statSubLabel}>
                                  xG/strzał
                                </div>
                                
                                <div className={styles.statSubValue}>{teamXGOT.toFixed(2)}</div>
                                <div className={styles.statSubLabel}>xG OT</div>
                                
                                <div className={styles.statSubValue}>{teamXGPerMinPossession.toFixed(3)}</div>
                                <div className={styles.statSubLabel}>xG/min posiadania</div>
                                
                                <div 
                                  className={styles.statSubValue}
                                  style={{
                                    color: teamXGDiff > 0 ? '#10b981' : teamXGDiff < 0 ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {teamXGDiff > 0 ? '+' : ''}{teamXGDiff.toFixed(2)}
                                </div>
                                <div className={styles.statSubLabel}>Różnica xG-Bramki</div>
                              </div>
                              
                              {/* Karta przeciwnika */}
                              <div className={styles.halfTimeCardInPanel}>
                                <div className={styles.halfTimeLabel}>PRZECIWNIK</div>
                                <div className={styles.statValue}>{opponentXG.toFixed(2)}</div>
                                <div className={styles.statLabel}>xG</div>
                                
                                <div 
                                  className={styles.statSubValue}
                                  style={{
                                    color: opponentXGPerShotValue >= XG_PER_SHOT_KPI ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {opponentXGPerShot}
                                </div>
                                <div className={styles.statSubLabel}>
                                  xG/strzał
                                </div>
                                
                                <div className={styles.statSubValue}>{opponentXGOT.toFixed(2)}</div>
                                <div className={styles.statSubLabel}>xG OT</div>
                                
                                <div className={styles.statSubValue}>{opponentXGPerMinPossession.toFixed(3)}</div>
                                <div className={styles.statSubLabel}>xG/min posiadania</div>
                                
                                <div 
                                  className={styles.statSubValue}
                                  style={{
                                    color: opponentXGDiff > 0 ? '#10b981' : opponentXGDiff < 0 ? '#ef4444' : '#6b7280'
                                  }}
                                >
                                  {opponentXGDiff > 0 ? '+' : ''}{opponentXGDiff.toFixed(2)}
                                </div>
                                <div className={styles.statSubLabel}>Różnica xG-Bramki</div>
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
                            <Legend />
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
                            <Legend />
                            <Bar 
                              dataKey="teamXG" 
                              fill="#3b82f6" 
                              name="xG zespołu"
                              radius={[4, 4, 0, 0]}
                              opacity={0.8}
                            />
                            <Bar 
                              dataKey="opponentXG" 
                              fill="#ef4444" 
                              name="xG przeciwnika"
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
                            setSelectedActionFilter(null);
                          }}
                        >
                          Wszystkie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'pass' ? styles.active : ''}`}
                          onClick={() => {
                            setSelectedActionType('pass');
                            setSelectedActionFilter(null);
                          }}
                        >
                          Podanie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'dribble' ? styles.active : ''}`}
                          onClick={() => {
                            setSelectedActionType('dribble');
                            setSelectedActionFilter(null);
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
              {halfTimeStats.firstHalf.passCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.firstHalf.pxtPerPass.toFixed(2)} PxT/podanie`}
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
                    {selectedMetric === 'pxt' && `${halfTimeStats.firstHalf.pxtPerDribble.toFixed(2)} PxT/drybling`}
                    {selectedMetric === 'xt' && `${halfTimeStats.firstHalf.xtPerDribble.toFixed(3)} xT/drybling`}
                    {selectedMetric === 'packing' && `${halfTimeStats.firstHalf.packingPerDribble.toFixed(1)} Packing/drybling`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.firstHalf.dribbleCount} dryblingów
                  </div>
                </>
              )}
            </div>
            
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
              {halfTimeStats.secondHalf.passCount > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {selectedMetric === 'pxt' && `${halfTimeStats.secondHalf.pxtPerPass.toFixed(2)} PxT/podanie`}
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
                    {selectedMetric === 'pxt' && `${halfTimeStats.secondHalf.pxtPerDribble.toFixed(2)} PxT/drybling`}
                    {selectedMetric === 'xt' && `${halfTimeStats.secondHalf.xtPerDribble.toFixed(3)} xT/drybling`}
                    {selectedMetric === 'packing' && `${halfTimeStats.secondHalf.packingPerDribble.toFixed(1)} Packing/drybling`}
                  </div>
                  <div className={styles.statSubLabel}>
                    {halfTimeStats.secondHalf.dribbleCount} dryblingów
                  </div>
                </>
              )}
            </div>
            
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
              {(halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount) > 0 && (
                <>
                  <div className={styles.statSubValue}>
                    {(() => {
                      const totalPasses = halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount;
                      if (selectedMetric === 'pxt') {
                        const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                        return totalPasses > 0 ? `${(totalPxt / totalPasses).toFixed(2)} PxT/podanie` : '0.00 PxT/podanie';
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
                        return totalDribbles > 0 ? `${(totalPxt / totalDribbles).toFixed(2)} PxT/drybling` : '0.00 PxT/drybling';
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
          </div>

          {/* Szczegółowe dane o punktach */}
          <div className={styles.actionCounts}>
            {selectedActionType === 'pass' && (
              <>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P1:</span>
                  <span className={styles.countValue}>{teamStats.senderP1Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
                >
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.senderP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
                >
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.senderP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'pk' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'pk' ? null : 'pk')}
                >
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.senderPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
                >
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.senderShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
                >
                  <span className={styles.countLabel}>Gol:</span>
                  <span className={styles.countValue}>{teamStats.senderGoalCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderGoalCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderGoalCountCentral}</span>
                  </div>
                </div>
              </>
            )}
            {selectedActionType === 'dribble' && (
              <>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p1' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p1' ? null : 'p1')}
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
                  className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
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
                  className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
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
                  className={`${styles.countItem} ${selectedActionFilter === 'pk' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'pk' ? null : 'pk')}
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
                  className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
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
                  className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
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
              </>
            )}
            {selectedActionType === 'all' && (
              <>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p1' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p1' ? null : 'p1')}
                >
                  <span className={styles.countLabel}>P1:</span>
                  <span className={styles.countValue}>{teamStats.senderP1Count + teamStats.dribblingP1Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountLateral + teamStats.dribblingP1CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountCentral + teamStats.dribblingP1CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
                >
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.senderP2Count + teamStats.dribblingP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountLateral + teamStats.dribblingP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountCentral + teamStats.dribblingP2CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
                >
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.senderP3Count + teamStats.dribblingP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountLateral + teamStats.dribblingP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountCentral + teamStats.dribblingP3CountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'pk' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'pk' ? null : 'pk')}
                >
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.senderPKCount + teamStats.dribblingPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountLateral + teamStats.dribblingPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountCentral + teamStats.dribblingPKCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
                >
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.senderShotCount + teamStats.dribblingShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountLateral + teamStats.dribblingShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountCentral + teamStats.dribblingShotCountCentral}</span>
                  </div>
                </div>
                <div 
                  className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                  onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
                >
                  <span className={styles.countLabel}>Gol:</span>
                  <span className={styles.countValue}>{teamStats.senderGoalCount + teamStats.dribblingGoalCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderGoalCountLateral + teamStats.dribblingGoalCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderGoalCountCentral + teamStats.dribblingGoalCountCentral}</span>
                  </div>
                </div>
              </>
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
                  <Legend />
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
                        <ComposedChart data={teamChartData5Min} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
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
                                    <p style={{ color: '#8884d8' }}>xT: {data.xt?.toFixed(3)}</p>
                                    <p style={{ color: '#82ca9d' }}>PxT: {data.pxt?.toFixed(2)}</p>
                                    <p style={{ color: '#ffc658' }}>Packing: {data.packing?.toFixed(0)}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend />
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
                            fill="#8b5cf6" 
                            name="xT"
                            radius={[4, 4, 0, 0]}
                            opacity={0.8}
                          />
                          <Bar 
                            yAxisId="right"
                            dataKey="packing" 
                            fill="#ec4899" 
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