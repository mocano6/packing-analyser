"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Action, TeamInfo } from "@/types";
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>('pxt');
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<'pxt' | 'xt' | 'packing'>('pxt');
  const [selectedActionType, setSelectedActionType] = useState<'pass' | 'dribble' | 'all'>('all');
  const [heatmapMode, setHeatmapMode] = useState<"pxt" | "count">("pxt");
  const [heatmapDirection, setHeatmapDirection] = useState<"from" | "to">("from");
  const [selectedPxtCategory, setSelectedPxtCategory] = useState<"sender" | "receiver" | "dribbler">("sender");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
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

    return data;
  }, [allActions]);

  // Przygotuj podsumowanie połówek
  const halfTimeStats = useMemo(() => {
    if (allActions.length === 0) return { 
      firstHalf: { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0 }, 
      secondHalf: { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0 } 
    };

    let firstHalf = { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0 };
    let secondHalf = { packing: 0, pxt: 0, xt: 0, passCount: 0, dribbleCount: 0, pxtPerPass: 0, pxtPerDribble: 0 };

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

    return { firstHalf, secondHalf };
  }, [allActions, selectedActionType]);

  // Znajdź wybrany mecz dla wyświetlenia informacji
  const selectedMatchInfo = useMemo(() => {
    return teamMatches.find(match => match.matchId === selectedMatch);
  }, [teamMatches, selectedMatch]);

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
    allActions.forEach(action => {
      const packingPoints = action.packingPoints || 0;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const pxtValue = xTDifference * packingPoints;
      totalPxT += pxtValue;

      const isDribble = action.actionType === 'dribble';
      const isPass = action.actionType === 'pass';

      // PxT jako podający (sender)
      if (isPass && action.senderId) {
        pxtAsSender += pxtValue;
        senderActionsCount += 1;
        senderPassCount += 1;

        const senderToZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        const senderIsLateral = isLateralZone(senderToZoneName);

        if (action.isPenaltyAreaEntry) {
          senderPKCount += 1;
          if (senderIsLateral) senderPKCountLateral += 1;
          else senderPKCountCentral += 1;
        } else if (action.isShot) {
          senderShotCount += 1;
          if (senderIsLateral) senderShotCountLateral += 1;
          else senderShotCountCentral += 1;
          if (action.isGoal) {
            senderGoalCount += 1;
            if (senderIsLateral) senderGoalCountLateral += 1;
            else senderGoalCountCentral += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          senderP3Count += 1;
          if (senderIsLateral) senderP3CountLateral += 1;
          else senderP3CountCentral += 1;
        } else if (action.isP2 || action.isP2Start) {
          senderP2Count += 1;
          if (senderIsLateral) senderP2CountLateral += 1;
          else senderP2CountCentral += 1;
        } else if (action.isP1 || action.isP1Start) {
          senderP1Count += 1;
          if (senderIsLateral) senderP1CountLateral += 1;
          else senderP1CountCentral += 1;
        }
      }

      // PxT jako przyjmujący (receiver)
      if (isPass && action.receiverId) {
        pxtAsReceiver += pxtValue;
        receiverActionsCount += 1;
        receiverPassCount += 1;

        const receiverToZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        const receiverIsLateral = isLateralZone(receiverToZoneName);

        if (action.isPenaltyAreaEntry) {
          receiverPKCount += 1;
          if (receiverIsLateral) receiverPKCountLateral += 1;
          else receiverPKCountCentral += 1;
        } else if (action.isShot) {
          receiverShotCount += 1;
          if (receiverIsLateral) receiverShotCountLateral += 1;
          else receiverShotCountCentral += 1;
          if (action.isGoal) {
            receiverGoalCount += 1;
            if (receiverIsLateral) receiverGoalCountLateral += 1;
            else receiverGoalCountCentral += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          receiverP3Count += 1;
          if (receiverIsLateral) receiverP3CountLateral += 1;
          else receiverP3CountCentral += 1;
        } else if (action.isP2 || action.isP2Start) {
          receiverP2Count += 1;
          if (receiverIsLateral) receiverP2CountLateral += 1;
          else receiverP2CountCentral += 1;
        } else if (action.isP1 || action.isP1Start) {
          receiverP1Count += 1;
          if (receiverIsLateral) receiverP1CountLateral += 1;
          else receiverP1CountCentral += 1;
        }
      }

      // PxT z dryblingu
      if (isDribble && action.senderId) {
        pxtAsDribbler += pxtValue;
        dribblingActionsCount += 1;

        const dribblingToZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        const dribblingIsLateral = isLateralZone(dribblingToZoneName);

        if (action.isPenaltyAreaEntry) {
          dribblingPKCount += 1;
          if (dribblingIsLateral) dribblingPKCountLateral += 1;
          else dribblingPKCountCentral += 1;
        } else if (action.isShot) {
          dribblingShotCount += 1;
          if (dribblingIsLateral) dribblingShotCountLateral += 1;
          else dribblingShotCountCentral += 1;
          if (action.isGoal) {
            dribblingGoalCount += 1;
            if (dribblingIsLateral) dribblingGoalCountLateral += 1;
            else dribblingGoalCountCentral += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          dribblingP3Count += 1;
          if (dribblingIsLateral) dribblingP3CountLateral += 1;
          else dribblingP3CountCentral += 1;
        } else if (action.isP2 || action.isP2Start) {
          dribblingP2Count += 1;
          if (dribblingIsLateral) dribblingP2CountLateral += 1;
          else dribblingP2CountCentral += 1;
        } else if (action.isP1 || action.isP1Start) {
          dribblingP1Count += 1;
          if (dribblingIsLateral) dribblingP1CountLateral += 1;
          else dribblingP1CountCentral += 1;
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
  }, [allActions, allShots, allPKEntries, selectedTeam]);

  // Przygotuj dane dla heatmapy zespołu i agregacja danych zawodników
  const teamHeatmapData = useMemo(() => {
    if (allActions.length === 0) return new Map<string, number>();

    const heatmap = new Map<string, number>();

    allActions.forEach(action => {
      // Filtruj akcje według kategorii
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
      if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return;

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
  }, [allActions, heatmapMode, heatmapDirection, selectedPxtCategory]);

  // Agregacja danych zawodników dla każdej strefy
  const zonePlayerStats = useMemo(() => {
    const stats = new Map<string, Map<string, { pxt: number; passes: number }>>();

    allActions.forEach(action => {
      // Filtruj akcje według kategorii
      if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return;
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
  }, [allActions, heatmapMode, heatmapDirection, selectedPxtCategory]);

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
              <div className={styles.categoryItem}>
                <span className={styles.categoryName}>xG</span>
                <span className={styles.categoryValue}>{teamStats.xgPer90.toFixed(2)}</span>
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
                          onClick={() => setSelectedActionType('all')}
                        >
                          Wszystkie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'pass' ? styles.active : ''}`}
                          onClick={() => setSelectedActionType('pass')}
                        >
                          Podanie
                        </button>
                        <button
                          className={`${styles.actionTypeButton} ${selectedActionType === 'dribble' ? styles.active : ''}`}
                          onClick={() => setSelectedActionType('dribble')}
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
              {selectedMetric === 'pxt' && (
                <>
                  {halfTimeStats.firstHalf.passCount > 0 && (
                    <>
                      <div className={styles.statSubValue}>
                        {halfTimeStats.firstHalf.pxtPerPass.toFixed(2)} PxT/podanie
                      </div>
                      <div className={styles.statSubLabel}>
                        {halfTimeStats.firstHalf.passCount} podań
                      </div>
                    </>
                  )}
                  {halfTimeStats.firstHalf.dribbleCount > 0 && (
                    <>
                      <div className={styles.statSubValue}>
                        {halfTimeStats.firstHalf.pxtPerDribble.toFixed(2)} PxT/drybling
                      </div>
                      <div className={styles.statSubLabel}>
                        {halfTimeStats.firstHalf.dribbleCount} dryblingów
                      </div>
                    </>
                  )}
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
              {selectedMetric === 'pxt' && (
                <>
                  {halfTimeStats.secondHalf.passCount > 0 && (
                    <>
                      <div className={styles.statSubValue}>
                        {halfTimeStats.secondHalf.pxtPerPass.toFixed(2)} PxT/podanie
                      </div>
                      <div className={styles.statSubLabel}>
                        {halfTimeStats.secondHalf.passCount} podań
                      </div>
                    </>
                  )}
                  {halfTimeStats.secondHalf.dribbleCount > 0 && (
                    <>
                      <div className={styles.statSubValue}>
                        {halfTimeStats.secondHalf.pxtPerDribble.toFixed(2)} PxT/drybling
                      </div>
                      <div className={styles.statSubLabel}>
                        {halfTimeStats.secondHalf.dribbleCount} dryblingów
                      </div>
                    </>
                  )}
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
              {selectedMetric === 'pxt' && (
                <>
                  {(halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount) > 0 && (
                    <>
                      <div className={styles.statSubValue}>
                        {(() => {
                          const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                          const totalPasses = halfTimeStats.firstHalf.passCount + halfTimeStats.secondHalf.passCount;
                          return totalPasses > 0 ? (totalPxt / totalPasses).toFixed(2) : '0.00';
                        })()} PxT/podanie
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
                          const totalPxt = halfTimeStats.firstHalf.pxt + halfTimeStats.secondHalf.pxt;
                          const totalDribbles = halfTimeStats.firstHalf.dribbleCount + halfTimeStats.secondHalf.dribbleCount;
                          return totalDribbles > 0 ? (totalPxt / totalDribbles).toFixed(2) : '0.00';
                        })()} PxT/drybling
        </div>
                      <div className={styles.statSubLabel}>
                        {halfTimeStats.firstHalf.dribbleCount + halfTimeStats.secondHalf.dribbleCount} dryblingów
                      </div>
                    </>
                  )}
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
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.senderP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.senderP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.senderPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.senderShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
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
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P1:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP1Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP1CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP1CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP2CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.dribblingP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingP3CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.dribblingPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingPKCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.dribblingShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.dribblingShotCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
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
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P1:</span>
                  <span className={styles.countValue}>{teamStats.senderP1Count + teamStats.dribblingP1Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountLateral + teamStats.dribblingP1CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP1CountCentral + teamStats.dribblingP1CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P2:</span>
                  <span className={styles.countValue}>{teamStats.senderP2Count + teamStats.dribblingP2Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountLateral + teamStats.dribblingP2CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP2CountCentral + teamStats.dribblingP2CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>P3:</span>
                  <span className={styles.countValue}>{teamStats.senderP3Count + teamStats.dribblingP3Count}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountLateral + teamStats.dribblingP3CountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderP3CountCentral + teamStats.dribblingP3CountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>PK:</span>
                  <span className={styles.countValue}>{teamStats.senderPKCount + teamStats.dribblingPKCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountLateral + teamStats.dribblingPKCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderPKCountCentral + teamStats.dribblingPKCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
                  <span className={styles.countLabel}>Strzał:</span>
                  <span className={styles.countValue}>{teamStats.senderShotCount + teamStats.dribblingShotCount}</span>
                  <div className={styles.zoneBreakdown}>
                    <span className={styles.zoneLabel}>Strefy boczne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountLateral + teamStats.dribblingShotCountLateral}</span>
                    <span className={styles.zoneLabel}>Strefy centralne:</span>
                    <span className={styles.zoneValue}>{teamStats.senderShotCountCentral + teamStats.dribblingShotCountCentral}</span>
                  </div>
                </div>
                <div className={styles.countItem}>
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
                      {zoneDetails && (
                        <div className={styles.zoneDetailsPanel}>
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
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
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
                        <BarChart data={teamChartData5Min} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
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
                            fill="#82ca9d" 
                            name="PxT"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="xt" 
                            fill="#8884d8" 
                            name="xT"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar 
                            yAxisId="right"
                            dataKey="packing" 
                            fill="#ffc658" 
                            name="Packing"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
        )}
      </div>
            )}
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