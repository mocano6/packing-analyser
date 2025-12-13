"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Player, Action, TeamInfo } from "@/types";
import { usePlayersState } from "@/hooks/usePlayersState";
import { useMatchInfo } from "@/hooks/useMatchInfo";
import { useTeams } from "@/hooks/useTeams";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { getPlayerFullName } from "@/utils/playerUtils";
import SeasonSelector from "@/components/SeasonSelector/SeasonSelector";
import { filterMatchesBySeason, getAvailableSeasonsFromMatches } from "@/utils/seasonUtils";
import PlayerHeatmapPitch from "@/components/PlayerHeatmapPitch/PlayerHeatmapPitch";
import SidePanel from "@/components/SidePanel/SidePanel";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import styles from "./page.module.css";

export default function PlayerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params?.playerId as string;

  const { players } = usePlayersState();
  const { allMatches, fetchMatches, forceRefreshFromFirebase } = useMatchInfo();
  const { teams, isLoading: isTeamsLoading } = useTeams();
  const { isAuthenticated, isLoading: authLoading, userTeams, isAdmin, logout } = useAuth();

  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allShots, setAllShots] = useState<any[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("all");
  const [showMatchSelector, setShowMatchSelector] = useState<boolean>(false);
  // Inicjalizuj selectedTeam z localStorage lub pustym stringiem
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedTeam');
      return saved || "";
    }
    return "";
  });
  // Inicjalizuj selectedPlayerForView z localStorage lub pustym stringiem
  const [selectedPlayerForView, setSelectedPlayerForView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedPlayerForView');
      return saved || "";
    }
    return "";
  });
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedPxtCategory, setSelectedPxtCategory] = useState<"sender" | "receiver" | "dribbler">("sender");
  const [heatmapMode, setHeatmapMode] = useState<"pxt" | "count">("pxt");
  const [heatmapDirection, setHeatmapDirection] = useState<"from" | "to">("from"); // Domyślnie "from" dla sender
  const [chartMode, setChartMode] = useState<"pxt" | "pxtPerMinute">("pxt"); // Tryb wykresu: PxT lub PxT/minutę
  const [isPositionStatsExpanded, setIsPositionStatsExpanded] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [zoneDetails, setZoneDetails] = useState<{
    zoneName: string;
    players: Array<{ playerId: string; playerName: string; passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>;
  } | null>(null);

  // Znajdź zawodnika
  const player = useMemo(() => {
    return players.find(p => p.id === playerId);
  }, [players, playerId]);

  // Pobierz wszystkie akcje dla zawodnika
  useEffect(() => {
    const loadPlayerActions = async () => {
      if (!playerId || !db) return;

      setIsLoadingActions(true);
      try {
        const allActionsData: Action[] = [];
        const allShotsData: any[] = [];

        // Pobierz akcje ze wszystkich meczów
        for (const match of allMatches) {
          if (!match.matchId) continue;

          try {
            const matchDoc = await getDoc(doc(db, "matches", match.matchId));
            if (matchDoc.exists()) {
              const matchData = matchDoc.data() as TeamInfo;
              
              // Pobierz akcje z różnych kolekcji
              const packingActions = matchData.actions_packing || [];
              const unpackingActions = matchData.actions_unpacking || [];
              const regainActions = matchData.actions_regain || [];
              const losesActions = matchData.actions_loses || [];

              // Dodaj matchId do każdej akcji
              const allMatchActions = [
                ...packingActions.map(a => ({ ...a, matchId: match.matchId! })),
                ...unpackingActions.map(a => ({ ...a, matchId: match.matchId! })),
                ...regainActions.map(a => ({ ...a, matchId: match.matchId! })),
                ...losesActions.map(a => ({ ...a, matchId: match.matchId! }))
              ];

              // Filtruj akcje dla wybranego zawodnika
              const playerActions = allMatchActions.filter(
                action =>
                  action.senderId === playerId ||
                  action.receiverId === playerId ||
                  (action as any).playerId === playerId
              );

              allActionsData.push(...playerActions);
              
              // Pobierz strzały dla zawodnika
              const matchShots = matchData.shots || [];
              const playerShots = matchShots.filter((shot: any) => shot.playerId === playerId);
              allShotsData.push(...playerShots.map((shot: any) => ({ ...shot, matchId: match.matchId! })));
            }
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
          }
        }

        setAllActions(allActionsData);
        setAllShots(allShotsData);
        
        // Zaznacz wszystkie mecze domyślnie
        const matchIds = allMatches
          .filter(m => m.matchId)
          .map(m => m.matchId!);
        setSelectedMatchIds(matchIds);
      } catch (error) {
        console.error("Błąd podczas pobierania akcji:", error);
        setAllActions([]);
      } finally {
        setIsLoadingActions(false);
      }
    };

    loadPlayerActions();
  }, [playerId, allMatches]);

  // Filtruj mecze według sezonu
  const filteredMatchesBySeason = useMemo(() => {
    if (!selectedSeason || selectedSeason === "all") {
      return allMatches;
    }
    return filterMatchesBySeason(allMatches, selectedSeason);
  }, [allMatches, selectedSeason]);

  // Oblicz dostępne sezony
  const availableSeasons = useMemo(() => {
    return getAvailableSeasonsFromMatches(allMatches);
  }, [allMatches]);

  // Oblicz domyślny sezon
  const defaultSeason = useMemo(() => {
    return availableSeasons.length > 0 ? availableSeasons[0].id : "all";
  }, [availableSeasons]);

  // Ustaw domyślny sezon na ostatni dostępny
  useEffect(() => {
    if (selectedSeason === "all" && defaultSeason !== "all") {
      setSelectedSeason(defaultSeason);
    }
  }, [selectedSeason, defaultSeason]);

  // Dostępne zespoły
  const availableTeams = useMemo(() => {
    return teams || [];
  }, [teams]);

  // Filtrowani zawodnicy według wybranego zespołu
  const filteredPlayers = useMemo(() => {
    if (!selectedTeam) return players;
    return players.filter(player => {
      let playerTeams = player.teams;
      if (typeof playerTeams === 'string') {
        playerTeams = [playerTeams];
      } else if (!Array.isArray(playerTeams)) {
        playerTeams = [];
      }
      return playerTeams.includes(selectedTeam);
    });
  }, [players, selectedTeam]);

  // Inicjalizuj selectedTeam - sprawdź czy wybrany zespół jest dostępny, jeśli nie - ustaw pierwszy dostępny
  useEffect(() => {
    if (availableTeams.length > 0) {
      // Jeśli selectedTeam jest pusty lub wybrany zespół nie jest dostępny, ustaw pierwszy dostępny
      if (!selectedTeam || !availableTeams.some(team => team.id === selectedTeam)) {
        setSelectedTeam(availableTeams[0].id);
        // Zapisz pierwszy dostępny zespół w localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedTeam', availableTeams[0].id);
        }
      }
    }
  }, [selectedTeam, availableTeams]);

  // Inicjalizuj selectedPlayerForView - priorytet ma playerId z URL
  useEffect(() => {
    if (filteredPlayers.length > 0) {
      // Sprawdź czy aktualny playerId z URL jest w filteredPlayers
      if (filteredPlayers.some(p => p.id === playerId)) {
        // Jeśli aktualny zawodnik jest w filteredPlayers, użyj go (priorytet nad localStorage)
        if (selectedPlayerForView !== playerId) {
          setSelectedPlayerForView(playerId);
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedPlayerForView', playerId);
          }
        }
      } else if (!selectedPlayerForView || !filteredPlayers.some(p => p.id === selectedPlayerForView)) {
        // Jeśli aktualny zawodnik nie jest dostępny, sprawdź localStorage
        const savedPlayerId = typeof window !== 'undefined' ? localStorage.getItem('selectedPlayerForView') : null;
        if (savedPlayerId && filteredPlayers.some(p => p.id === savedPlayerId)) {
          // Jeśli zapisany zawodnik jest dostępny, użyj go
          setSelectedPlayerForView(savedPlayerId);
        } else {
          // Jeśli zapisany zawodnik nie jest dostępny, ustaw pierwszego dostępnego
          setSelectedPlayerForView(filteredPlayers[0].id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedPlayerForView', filteredPlayers[0].id);
          }
        }
      }
    }
  }, [filteredPlayers, playerId]); // Usunięto selectedPlayerForView z zależności, aby uniknąć nieskończonej pętli

  // Zaznacz wszystkie mecze domyślnie przy zmianie sezonu
  useEffect(() => {
    const matchIds = filteredMatchesBySeason
      .filter(m => m.matchId)
      .map(m => m.matchId!);
    setSelectedMatchIds(matchIds);
  }, [filteredMatchesBySeason]);

  // Oblicz minuty gry zawodnika i według pozycji
  const { totalMinutes, positionMinutes } = useMemo(() => {
    let minutes = 0;
    const posMinutes = new Map<string, number>();
    
    const matchesToCheck = selectedMatchIds.length > 0
      ? filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || ""))
      : filteredMatchesBySeason;

    matchesToCheck.forEach((match) => {
      if (match.playerMinutes) {
        const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === playerId);
        if (playerMinute) {
          const playTime = playerMinute.startMinute === 0 && playerMinute.endMinute === 0
            ? 0
            : playerMinute.endMinute - playerMinute.startMinute + 1;
          minutes += playTime;
          
          // Minuty według pozycji
          const position = playerMinute.position || 'Unknown';
          posMinutes.set(position, (posMinutes.get(position) || 0) + playTime);
        }
      }
    });

    return { totalMinutes: minutes, positionMinutes: posMinutes };
  }, [playerId, filteredMatchesBySeason, selectedMatchIds]);

  // Oblicz dane mecz po meczu dla wykresu
  const matchByMatchData = useMemo(() => {
    if (!player || !allActions.length) return [];

    const matchesToCheck = selectedMatchIds.length > 0
      ? filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || ""))
      : filteredMatchesBySeason;

    return matchesToCheck.map((match) => {
      // Oblicz minuty dla tego meczu
      let minutes = 0;
      if (match.playerMinutes) {
        const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === player.id);
        if (playerMinute) {
          minutes = playerMinute.startMinute === 0 && playerMinute.endMinute === 0
            ? 0
            : playerMinute.endMinute - playerMinute.startMinute + 1;
        }
      }

      // Oblicz PxT dla tego meczu
      let matchPxt = 0;
      const matchActions = allActions.filter(a => a.matchId === match.matchId);
      
      matchActions.forEach((action) => {
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        const packingPoints = action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;

        // PxT jako podający
        if (action.senderId === player.id && action.actionType === 'pass') {
          matchPxt += pxtValue;
        }
        // PxT jako przyjmujący
        else if (action.receiverId === player.id && action.actionType === 'pass') {
          matchPxt += pxtValue;
        }
        // PxT jako drybling
        else if (action.senderId === player.id && action.actionType === 'dribble') {
          matchPxt += pxtValue;
        }
      });

      // Nazwa meczu
      const matchName = match.isHome 
        ? `${match.opponent} (D)`
        : `${match.opponent} (W)`;
      
      const matchDate = new Date(match.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });

      return {
        matchId: match.matchId,
        matchName: `${matchDate} ${matchName}`,
        pxt: matchPxt,
        minutes: minutes,
        pxtPerMinute: minutes > 0 ? matchPxt / minutes : 0,
      };
    }).filter(m => m.minutes > 0).sort((a, b) => {
      // Sortuj według daty meczu
      const matchA = filteredMatchesBySeason.find(m => m.matchId === a.matchId);
      const matchB = filteredMatchesBySeason.find(m => m.matchId === b.matchId);
      if (!matchA || !matchB) return 0;
      return new Date(matchA.date).getTime() - new Date(matchB.date).getTime();
    });
  }, [player, allActions, filteredMatchesBySeason, selectedMatchIds]);

  // Oblicz statystyki zawodnika
  const playerStats = useMemo(() => {
    if (!player) return null;

    // Filtruj akcje dla wybranych meczów
    let filteredActions = allActions;
    if (selectedMatchIds.length > 0) {
      filteredActions = allActions.filter(action =>
        selectedMatchIds.includes(action.matchId || "")
      );
    }

    let totalPxT = 0;
    let pxtAsSender = 0; // PxT jako podający
    let pxtAsReceiver = 0; // PxT jako przyjmujący
    let pxtAsDribbler = 0; // PxT z dryblingu
    let totalXT = 0;
    let totalxG = 0;
    let totalRegains = 0;
    let totalLoses = 0;
    let totalPKEntries = 0;
    
    // Oblicz xG z strzałów
    const filteredShots = allShots.filter(shot => {
      if (selectedMatchIds.length > 0) {
        return selectedMatchIds.includes((shot as any).matchId || "");
      }
      return true;
    });
    
    filteredShots.forEach((shot: any) => {
      if (shot.playerId === player.id && shot.xG) {
        totalxG += shot.xG;
      }
    });
    
    // Liczniki akcji
    let senderActionsCount = 0;
    let receiverActionsCount = 0;
    let dribblingActionsCount = 0;
    
    // Liczniki podań (tylko dla pass actions)
    let senderPassCount = 0;
    let receiverPassCount = 0;
    
    // Statystyki według pozycji
    const positionStatsMap = new Map<string, {
      pxtAsSender: number;
      pxtAsReceiver: number;
      pxtAsDribbler: number;
      senderActionsCount: number;
      receiverActionsCount: number;
      dribblingActionsCount: number;
      senderPassCount: number;
      receiverPassCount: number;
      dribblingCount: number;
      minutes: number;
    }>();
    
    // Funkcja do pobrania pozycji zawodnika w meczu
    const getPlayerPositionInMatch = (matchId: string): string | null => {
      const match = filteredMatchesBySeason.find(m => m.matchId === matchId);
      if (!match || !match.playerMinutes) return null;
      const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === playerId);
      return playerMinute?.position || null;
    };

    // Breakdown PxT jako podający
    let pxtSenderFromPK = 0;
    let pxtSenderFromShot = 0;
    let pxtSenderFromP3 = 0;
    let pxtSenderFromP2 = 0;
    let pxtSenderFromP1 = 0;
    let pxtSenderFromOther = 0;
    
    // Liczniki akcji jako podający
    let senderP1Count = 0;
    let senderP2Count = 0;
    let senderP3Count = 0;
    let senderPKCount = 0;
    let senderShotCount = 0;
    let senderGoalCount = 0;

    // Breakdown PxT jako przyjmujący
    let pxtReceiverFromPK = 0;
    let pxtReceiverFromShot = 0;
    let pxtReceiverFromP3 = 0;
    let pxtReceiverFromP2 = 0;
    let pxtReceiverFromP1 = 0;
    let pxtReceiverFromOther = 0;
    
    // Liczniki akcji jako przyjmujący
    let receiverP1Count = 0;
    let receiverP2Count = 0;
    let receiverP3Count = 0;
    let receiverPKCount = 0;
    let receiverShotCount = 0;
    let receiverGoalCount = 0;

    // Breakdown PxT z dryblingu
    let pxtDribblingFromPK = 0;
    let pxtDribblingFromShot = 0;
    let pxtDribblingFromP3 = 0;
    let pxtDribblingFromP2 = 0;
    let pxtDribblingFromP1 = 0;
    let pxtDribblingFromOther = 0;
    
    // Liczniki akcji z dryblingu
    let dribblingP1Count = 0;
    let dribblingP2Count = 0;
    let dribblingP3Count = 0;
    let dribblingPKCount = 0;
    let dribblingShotCount = 0;
    let dribblingGoalCount = 0;

    // Funkcja pomocnicza do sprawdzania, czy strefa jest boczna (A, B, G, H) czy centralna (C, D, E, F)
    const isLateralZone = (zoneName: string | null): boolean => {
      if (!zoneName) return false;
      const letter = zoneName.charAt(0).toUpperCase();
      return letter === 'A' || letter === 'B' || letter === 'G' || letter === 'H';
    };

    // Liczniki akcji jako podający - strefy boczne
    let senderP1CountLateral = 0;
    let senderP2CountLateral = 0;
    let senderP3CountLateral = 0;
    let senderPKCountLateral = 0;
    let senderShotCountLateral = 0;
    let senderGoalCountLateral = 0;

    // Liczniki akcji jako podający - strefy centralne
    let senderP1CountCentral = 0;
    let senderP2CountCentral = 0;
    let senderP3CountCentral = 0;
    let senderPKCountCentral = 0;
    let senderShotCountCentral = 0;
    let senderGoalCountCentral = 0;

    // Liczniki akcji jako przyjmujący - strefy boczne
    let receiverP1CountLateral = 0;
    let receiverP2CountLateral = 0;
    let receiverP3CountLateral = 0;
    let receiverPKCountLateral = 0;
    let receiverShotCountLateral = 0;
    let receiverGoalCountLateral = 0;

    // Liczniki akcji jako przyjmujący - strefy centralne
    let receiverP1CountCentral = 0;
    let receiverP2CountCentral = 0;
    let receiverP3CountCentral = 0;
    let receiverPKCountCentral = 0;
    let receiverShotCountCentral = 0;
    let receiverGoalCountCentral = 0;

    // Liczniki akcji z dryblingu - strefy boczne
    let dribblingP1CountLateral = 0;
    let dribblingP2CountLateral = 0;
    let dribblingP3CountLateral = 0;
    let dribblingPKCountLateral = 0;
    let dribblingShotCountLateral = 0;
    let dribblingGoalCountLateral = 0;

    // Liczniki akcji z dryblingu - strefy centralne
    let dribblingP1CountCentral = 0;
    let dribblingP2CountCentral = 0;
    let dribblingP3CountCentral = 0;
    let dribblingPKCountCentral = 0;
    let dribblingShotCountCentral = 0;
    let dribblingGoalCountCentral = 0;

    // Heatmapy dla każdej kategorii - Map<zoneName, xTValue>
    // Podający: from (z której strefy) i to (do której strefy)
    const senderFromHeatmap = new Map<string, number>();
    const senderToHeatmap = new Map<string, number>();
    // Przyjmujący: to (do której strefy) i from (z której strefy były podania)
    const receiverToHeatmap = new Map<string, number>();
    const receiverFromHeatmap = new Map<string, number>();
    // Drybling: tylko from (z której strefy)
    const dribblerHeatmap = new Map<string, number>();
    
    // Heatmapy liczby akcji dla każdej kategorii - Map<zoneName, count>
    const senderFromActionCountHeatmap = new Map<string, number>();
    const senderToActionCountHeatmap = new Map<string, number>();
    const receiverToActionCountHeatmap = new Map<string, number>();
    const receiverFromActionCountHeatmap = new Map<string, number>();
    const dribblerActionCountHeatmap = new Map<string, number>();
    
    // Statystyki dla każdej strefy - kto podawał do wybranego zawodnika (tylko dla receiver)
    // Map<zoneName, Map<playerId, { passes: number, pxt: number, p1Count: number, p2Count: number, p3Count: number, pkCount: number, shotCount: number, goalCount: number }>>
    // Dla kierunku "from": zawodnicy, którzy podawali Z tej strefy do wybranego zawodnika
    // Dla kierunku "to": zawodnicy, którzy podawali DO tej strefy (gdzie wybrany zawodnik przyjmował)
    const zonePlayerStatsFrom = new Map<string, Map<string, { passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>>();
    const zonePlayerStatsTo = new Map<string, Map<string, { passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>>();
    
    // Statystyki dla każdej strefy - kto przyjmował podania od wybranego zawodnika (tylko dla sender)
    // Map<zoneName, Map<playerId, { passes: number, pxt: number, p1Count: number, p2Count: number, p3Count: number, pkCount: number, shotCount: number, goalCount: number }>>
    // Dla kierunku "from": zawodnicy, którzy przyjmowali podania Z tej strefy (gdzie wybrany zawodnik podawał)
    // Dla kierunku "to": zawodnicy, którzy przyjmowali podania DO tej strefy (gdzie wybrany zawodnik podawał)
    const senderZonePlayerStatsFrom = new Map<string, Map<string, { passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>>();
    const senderZonePlayerStatsTo = new Map<string, Map<string, { passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>>();

    filteredActions.forEach((action) => {
      // PxT i xT
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const packingPoints = action.packingPoints || 0;
      const pxtValue = xTDifference * packingPoints;

      // PxT jako podający (sender) - tylko dla podań
      if (action.senderId === player.id && action.actionType === 'pass') {
        pxtAsSender += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        senderActionsCount += 1;
        senderPassCount += 1;

        // Funkcja pomocnicza do konwersji strefy na format "A1"
        const convertZoneToName = (zone: string | number | undefined): string | null => {
          if (!zone) return null;
          let zoneName = zone;
          if (typeof zoneName === 'number') {
            const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const row = Math.floor(zoneName / 12);
            const col = (zoneName % 12) + 1;
            zoneName = `${rowLetters[row].toUpperCase()}${col}`;
          }
          if (typeof zoneName === 'string') {
            return zoneName.trim().toUpperCase();
          }
          return null;
        };

        // Strefa źródłowa (z której podawał)
        const fromZoneName = convertZoneToName(action.fromZone || action.startZone);
        if (fromZoneName) {
          const currentValue = senderFromHeatmap.get(fromZoneName) || 0;
          senderFromHeatmap.set(fromZoneName, currentValue + pxtValue);
          const currentCount = senderFromActionCountHeatmap.get(fromZoneName) || 0;
          senderFromActionCountHeatmap.set(fromZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który przyjmował podania z tej strefy
          if (action.receiverId) {
            if (!senderZonePlayerStatsFrom.has(fromZoneName)) {
              senderZonePlayerStatsFrom.set(fromZoneName, new Map());
            }
            const zoneStats = senderZonePlayerStatsFrom.get(fromZoneName)!;
            if (!zoneStats.has(action.receiverId)) {
              zoneStats.set(action.receiverId, { passes: 0, pxt: 0, p1Count: 0, p2Count: 0, p3Count: 0, pkCount: 0, shotCount: 0, goalCount: 0 });
            }
            const playerStats = zoneStats.get(action.receiverId)!;
            playerStats.passes += 1;
            playerStats.pxt += pxtValue;
            if (action.isPenaltyAreaEntry) {
              playerStats.pkCount += 1;
            } else if (action.isShot) {
              playerStats.shotCount += 1;
              if (action.isGoal) {
                playerStats.goalCount += 1;
              }
            } else if (action.isP3 || action.isP3Start) {
              playerStats.p3Count += 1;
            } else if (action.isP2 || action.isP2Start) {
              playerStats.p2Count += 1;
            } else if (action.isP1 || action.isP1Start) {
              playerStats.p1Count += 1;
            }
          }
        }

        // Strefa docelowa (do której podawał)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        if (toZoneName) {
          const currentValue = senderToHeatmap.get(toZoneName) || 0;
          senderToHeatmap.set(toZoneName, currentValue + pxtValue);
          const currentCount = senderToActionCountHeatmap.get(toZoneName) || 0;
          senderToActionCountHeatmap.set(toZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który przyjmował podania do tej strefy
          if (action.receiverId) {
            if (!senderZonePlayerStatsTo.has(toZoneName)) {
              senderZonePlayerStatsTo.set(toZoneName, new Map());
            }
            const zoneStats = senderZonePlayerStatsTo.get(toZoneName)!;
            if (!zoneStats.has(action.receiverId)) {
              zoneStats.set(action.receiverId, { passes: 0, pxt: 0, p1Count: 0, p2Count: 0, p3Count: 0, pkCount: 0, shotCount: 0, goalCount: 0 });
            }
            const playerStats = zoneStats.get(action.receiverId)!;
            playerStats.passes += 1;
            playerStats.pxt += pxtValue;
            if (action.isPenaltyAreaEntry) {
              playerStats.pkCount += 1;
            } else if (action.isShot) {
              playerStats.shotCount += 1;
              if (action.isGoal) {
                playerStats.goalCount += 1;
              }
            } else if (action.isP3 || action.isP3Start) {
              playerStats.p3Count += 1;
            } else if (action.isP2 || action.isP2Start) {
              playerStats.p2Count += 1;
            } else if (action.isP1 || action.isP1Start) {
              playerStats.p1Count += 1;
            }
          }
        }

        // Statystyki według pozycji
        const position = getPlayerPositionInMatch(action.matchId || '');
        if (position) {
          if (!positionStatsMap.has(position)) {
            positionStatsMap.set(position, {
              pxtAsSender: 0,
              pxtAsReceiver: 0,
              pxtAsDribbler: 0,
              senderActionsCount: 0,
              receiverActionsCount: 0,
              dribblingActionsCount: 0,
              senderPassCount: 0,
              receiverPassCount: 0,
              dribblingCount: 0,
              minutes: 0,
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsSender += pxtValue;
          posStats.senderActionsCount += 1;
          posStats.senderPassCount += 1;
        }

        // Breakdown PxT jako podający według typu akcji
        // Sprawdź strefę docelową (do której podawał) dla podziału na boczne/centralne
        const senderToZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        const senderIsLateral = isLateralZone(senderToZoneName);

        if (action.isPenaltyAreaEntry) {
          pxtSenderFromPK += pxtValue;
          senderPKCount += 1;
          if (senderIsLateral) senderPKCountLateral += 1;
          else senderPKCountCentral += 1;
        } else if (action.isShot) {
          pxtSenderFromShot += pxtValue;
          senderShotCount += 1;
          if (senderIsLateral) senderShotCountLateral += 1;
          else senderShotCountCentral += 1;
          if (action.isGoal) {
            senderGoalCount += 1;
            if (senderIsLateral) senderGoalCountLateral += 1;
            else senderGoalCountCentral += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          pxtSenderFromP3 += pxtValue;
          senderP3Count += 1;
          if (senderIsLateral) senderP3CountLateral += 1;
          else senderP3CountCentral += 1;
        } else if (action.isP2 || action.isP2Start) {
          pxtSenderFromP2 += pxtValue;
          senderP2Count += 1;
          if (senderIsLateral) senderP2CountLateral += 1;
          else senderP2CountCentral += 1;
        } else if (action.isP1 || action.isP1Start) {
          pxtSenderFromP1 += pxtValue;
          senderP1Count += 1;
          if (senderIsLateral) senderP1CountLateral += 1;
          else senderP1CountCentral += 1;
        } else {
          pxtSenderFromOther += pxtValue;
        }
      }

      // PxT jako przyjmujący (receiver) - tylko dla podań
      if (action.receiverId === player.id && action.actionType === 'pass') {
        pxtAsReceiver += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        receiverActionsCount += 1;
        receiverPassCount += 1;

        // Funkcja pomocnicza do konwersji strefy na format "A1"
        const convertZoneToName = (zone: string | number | undefined): string | null => {
          if (!zone) return null;
          let zoneName = zone;
          if (typeof zoneName === 'number') {
            const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const row = Math.floor(zoneName / 12);
            const col = (zoneName % 12) + 1;
            zoneName = `${rowLetters[row].toUpperCase()}${col}`;
          }
          if (typeof zoneName === 'string') {
            return zoneName.trim().toUpperCase();
          }
          return null;
        };

        // Strefa docelowa (do której przyjmował)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        if (toZoneName) {
          const currentValue = receiverToHeatmap.get(toZoneName) || 0;
          receiverToHeatmap.set(toZoneName, currentValue + pxtValue);
          const currentCount = receiverToActionCountHeatmap.get(toZoneName) || 0;
          receiverToActionCountHeatmap.set(toZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który podawał do tej strefy (gdzie zawodnik przyjmował)
          if (action.senderId) {
            if (!zonePlayerStatsTo.has(toZoneName)) {
              zonePlayerStatsTo.set(toZoneName, new Map());
            }
            const zoneStats = zonePlayerStatsTo.get(toZoneName)!;
            if (!zoneStats.has(action.senderId)) {
              zoneStats.set(action.senderId, { passes: 0, pxt: 0, p1Count: 0, p2Count: 0, p3Count: 0, pkCount: 0, shotCount: 0, goalCount: 0 });
            }
            const playerStats = zoneStats.get(action.senderId)!;
            playerStats.passes += 1;
            playerStats.pxt += pxtValue;
            if (action.isPenaltyAreaEntry) {
              playerStats.pkCount += 1;
            } else if (action.isShot) {
              playerStats.shotCount += 1;
              if (action.isGoal) {
                playerStats.goalCount += 1;
              }
            } else if (action.isP3 || action.isP3Start) {
              playerStats.p3Count += 1;
            } else if (action.isP2 || action.isP2Start) {
              playerStats.p2Count += 1;
            } else if (action.isP1 || action.isP1Start) {
              playerStats.p1Count += 1;
            }
          }
        }

        // Strefa źródłowa (z której były podania do niego)
        const fromZoneName = convertZoneToName(action.fromZone ?? action.startZone ?? undefined);
        if (fromZoneName) {
          const currentValue = receiverFromHeatmap.get(fromZoneName) || 0;
          receiverFromHeatmap.set(fromZoneName, currentValue + pxtValue);
          const currentCount = receiverFromActionCountHeatmap.get(fromZoneName) || 0;
          receiverFromActionCountHeatmap.set(fromZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który podawał z tej strefy
          if (action.senderId) {
            if (!zonePlayerStatsFrom.has(fromZoneName)) {
              zonePlayerStatsFrom.set(fromZoneName, new Map());
            }
            const zoneStats = zonePlayerStatsFrom.get(fromZoneName)!;
            if (!zoneStats.has(action.senderId)) {
              zoneStats.set(action.senderId, { passes: 0, pxt: 0, p1Count: 0, p2Count: 0, p3Count: 0, pkCount: 0, shotCount: 0, goalCount: 0 });
            }
            const playerStats = zoneStats.get(action.senderId)!;
            playerStats.passes += 1;
            playerStats.pxt += pxtValue;
            if (action.isPenaltyAreaEntry) {
              playerStats.pkCount += 1;
            } else if (action.isShot) {
              playerStats.shotCount += 1;
              if (action.isGoal) {
                playerStats.goalCount += 1;
              }
            } else if (action.isP3 || action.isP3Start) {
              playerStats.p3Count += 1;
            } else if (action.isP2 || action.isP2Start) {
              playerStats.p2Count += 1;
            } else if (action.isP1 || action.isP1Start) {
              playerStats.p1Count += 1;
            }
          }
        }

        // Statystyki według pozycji
        const position = getPlayerPositionInMatch(action.matchId || '');
        if (position) {
          if (!positionStatsMap.has(position)) {
            positionStatsMap.set(position, {
              pxtAsSender: 0,
              pxtAsReceiver: 0,
              pxtAsDribbler: 0,
              senderActionsCount: 0,
              receiverActionsCount: 0,
              dribblingActionsCount: 0,
              senderPassCount: 0,
              receiverPassCount: 0,
              dribblingCount: 0,
              minutes: 0,
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsReceiver += pxtValue;
          posStats.receiverActionsCount += 1;
          posStats.receiverPassCount += 1;
        }

        // Breakdown PxT jako przyjmujący według typu akcji
        // Sprawdź strefę docelową (do której przyjmował) dla podziału na boczne/centralne
        const receiverToZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        const receiverIsLateral = isLateralZone(receiverToZoneName);

        if (action.isPenaltyAreaEntry) {
          pxtReceiverFromPK += pxtValue;
          receiverPKCount += 1;
          if (receiverIsLateral) receiverPKCountLateral += 1;
          else receiverPKCountCentral += 1;
        } else if (action.isShot) {
          pxtReceiverFromShot += pxtValue;
          receiverShotCount += 1;
          if (receiverIsLateral) receiverShotCountLateral += 1;
          else receiverShotCountCentral += 1;
          if (action.isGoal) {
            receiverGoalCount += 1;
            if (receiverIsLateral) receiverGoalCountLateral += 1;
            else receiverGoalCountCentral += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          pxtReceiverFromP3 += pxtValue;
          receiverP3Count += 1;
          if (receiverIsLateral) receiverP3CountLateral += 1;
          else receiverP3CountCentral += 1;
        } else if (action.isP2 || action.isP2Start) {
          pxtReceiverFromP2 += pxtValue;
          receiverP2Count += 1;
          if (receiverIsLateral) receiverP2CountLateral += 1;
          else receiverP2CountCentral += 1;
        } else if (action.isP1 || action.isP1Start) {
          pxtReceiverFromP1 += pxtValue;
          receiverP1Count += 1;
          if (receiverIsLateral) receiverP1CountLateral += 1;
          else receiverP1CountCentral += 1;
        } else {
          pxtReceiverFromOther += pxtValue;
        }
      }

      // PxT z dryblingu (dribble)
      if ((action.senderId === player.id) && action.actionType === 'dribble') {
        pxtAsDribbler += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        dribblingActionsCount += 1;

        // Dodaj do heatmapy dryblingu (używamy fromZone lub startZone) - używamy pxtValue, nie xTDifference
        let zoneName = action.fromZone || action.startZone || '';
        // Konwertuj numer strefy na format "A1" jeśli potrzeba
        if (zoneName && typeof zoneName === 'number') {
          const rowLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const row = Math.floor(zoneName / 12);
          const col = (zoneName % 12) + 1;
          zoneName = `${rowLetters[row].toUpperCase()}${col}`;
        }
        if (zoneName && typeof zoneName === 'string') {
          // Normalizuj format - upewnij się, że jest w formacie "A1"
          zoneName = zoneName.trim().toUpperCase();
          const currentValue = dribblerHeatmap.get(zoneName) || 0;
          dribblerHeatmap.set(zoneName, currentValue + pxtValue);
          // Dodaj do heatmapy liczby akcji
          const currentCount = dribblerActionCountHeatmap.get(zoneName) || 0;
          dribblerActionCountHeatmap.set(zoneName, currentCount + 1);
        }

        // Statystyki według pozycji
        const position = getPlayerPositionInMatch(action.matchId || '');
        if (position) {
          if (!positionStatsMap.has(position)) {
            positionStatsMap.set(position, {
              pxtAsSender: 0,
              pxtAsReceiver: 0,
              pxtAsDribbler: 0,
              senderActionsCount: 0,
              receiverActionsCount: 0,
              dribblingActionsCount: 0,
              senderPassCount: 0,
              receiverPassCount: 0,
              dribblingCount: 0,
              minutes: 0,
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsDribbler += pxtValue;
          posStats.dribblingActionsCount += 1;
          posStats.dribblingCount += 1;
        }

        // Breakdown PxT z dryblingu według typu akcji
        if (action.isPenaltyAreaEntry) {
          pxtDribblingFromPK += pxtValue;
          dribblingPKCount += 1;
        } else if (action.isShot) {
          pxtDribblingFromShot += pxtValue;
          dribblingShotCount += 1;
          if (action.isGoal) {
            dribblingGoalCount += 1;
          }
        } else if (action.isP3 || action.isP3Start) {
          pxtDribblingFromP3 += pxtValue;
          dribblingP3Count += 1;
        } else if (action.isP2 || action.isP2Start) {
          pxtDribblingFromP2 += pxtValue;
          dribblingP2Count += 1;
        } else if (action.isP1 || action.isP1Start) {
          pxtDribblingFromP1 += pxtValue;
          dribblingP1Count += 1;
        } else {
          pxtDribblingFromOther += pxtValue;
        }
      }

      // xG będzie obliczane z osobnej kolekcji shots

      // Regainy
      if (
        (action.isBelow8s !== undefined ||
         action.playersBehindBall !== undefined ||
         action.opponentsBeforeBall !== undefined) &&
        action.senderId === player.id &&
        !action.isReaction5s
      ) {
        totalRegains += 1;
      }

      // Straty
      if (
        (action.isReaction5s !== undefined ||
         (action.isBelow8s !== undefined &&
          action.playersBehindBall === undefined &&
          action.opponentsBeforeBall === undefined)) &&
        action.senderId === player.id
      ) {
        totalLoses += 1;
      }

      // Wejścia w PK
      if (action.isPenaltyAreaEntry && (action.senderId === player.id || action.receiverId === player.id)) {
        totalPKEntries += 1;
      }
    });

    // Dodaj minuty dla każdej pozycji
    positionMinutes.forEach((minutes, position) => {
      if (!positionStatsMap.has(position)) {
        positionStatsMap.set(position, {
          pxtAsSender: 0,
          pxtAsReceiver: 0,
          pxtAsDribbler: 0,
          senderActionsCount: 0,
          receiverActionsCount: 0,
          dribblingActionsCount: 0,
          senderPassCount: 0,
          receiverPassCount: 0,
          dribblingCount: 0,
          minutes: 0,
        });
      }
      const posStats = positionStatsMap.get(position)!;
      posStats.minutes = minutes;
    });

    // Oblicz wartości per 90 minut
    const per90Multiplier = totalMinutes > 0 ? 90 / totalMinutes : 0;
    
    // Konwertuj Map na obiekt dla łatwiejszego użycia
    const positionStats: { [key: string]: {
      pxtAsSender: number;
      pxtAsReceiver: number;
      pxtAsDribbler: number;
      senderActionsCount: number;
      receiverActionsCount: number;
      dribblingActionsCount: number;
      senderPassCount: number;
      receiverPassCount: number;
      dribblingCount: number;
      minutes: number;
      pxtSenderPer90: number;
      pxtReceiverPer90: number;
      pxtDribblingPer90: number;
      senderActionsPer90: number;
      receiverActionsPer90: number;
      dribblingActionsPer90: number;
      senderPassPer90: number;
      receiverPassPer90: number;
      dribblingPer90: number;
      pxtSenderPerPass: number;
      pxtReceiverPerPass: number;
      pxtDribblingPerDribble: number;
    } } = {};
    
    positionStatsMap.forEach((stats, position) => {
      const posPer90Multiplier = stats.minutes > 0 ? 90 / stats.minutes : 0;
      positionStats[position] = {
        ...stats,
        pxtSenderPer90: stats.pxtAsSender * posPer90Multiplier,
        pxtReceiverPer90: stats.pxtAsReceiver * posPer90Multiplier,
        pxtDribblingPer90: stats.pxtAsDribbler * posPer90Multiplier,
        senderActionsPer90: stats.senderActionsCount * posPer90Multiplier,
        receiverActionsPer90: stats.receiverActionsCount * posPer90Multiplier,
        dribblingActionsPer90: stats.dribblingActionsCount * posPer90Multiplier,
        senderPassPer90: stats.senderPassCount * posPer90Multiplier,
        receiverPassPer90: stats.receiverPassCount * posPer90Multiplier,
        dribblingPer90: stats.dribblingCount * posPer90Multiplier,
        pxtSenderPerPass: stats.senderPassCount > 0 ? stats.pxtAsSender / stats.senderPassCount : 0,
        pxtReceiverPerPass: stats.receiverPassCount > 0 ? stats.pxtAsReceiver / stats.receiverPassCount : 0,
        pxtDribblingPerDribble: stats.dribblingCount > 0 ? stats.pxtAsDribbler / stats.dribblingCount : 0,
      };
    });

    // Oblicz procenty dla breakdown PxT jako podający
    const pxtSenderBreakdown = pxtAsSender > 0 ? {
      pk: { value: pxtSenderFromPK, percent: (pxtSenderFromPK / pxtAsSender) * 100 },
      shot: { value: pxtSenderFromShot, percent: (pxtSenderFromShot / pxtAsSender) * 100 },
      p3: { value: pxtSenderFromP3, percent: (pxtSenderFromP3 / pxtAsSender) * 100 },
      p2: { value: pxtSenderFromP2, percent: (pxtSenderFromP2 / pxtAsSender) * 100 },
      p1: { value: pxtSenderFromP1, percent: (pxtSenderFromP1 / pxtAsSender) * 100 },
      other: { value: pxtSenderFromOther, percent: (pxtSenderFromOther / pxtAsSender) * 100 },
    } : {
      pk: { value: 0, percent: 0 },
      shot: { value: 0, percent: 0 },
      p3: { value: 0, percent: 0 },
      p2: { value: 0, percent: 0 },
      p1: { value: 0, percent: 0 },
      other: { value: 0, percent: 0 },
    };

    // Oblicz procenty dla breakdown PxT jako przyjmujący
    const pxtReceiverBreakdown = pxtAsReceiver > 0 ? {
      pk: { value: pxtReceiverFromPK, percent: (pxtReceiverFromPK / pxtAsReceiver) * 100 },
      shot: { value: pxtReceiverFromShot, percent: (pxtReceiverFromShot / pxtAsReceiver) * 100 },
      p3: { value: pxtReceiverFromP3, percent: (pxtReceiverFromP3 / pxtAsReceiver) * 100 },
      p2: { value: pxtReceiverFromP2, percent: (pxtReceiverFromP2 / pxtAsReceiver) * 100 },
      p1: { value: pxtReceiverFromP1, percent: (pxtReceiverFromP1 / pxtAsReceiver) * 100 },
      other: { value: pxtReceiverFromOther, percent: (pxtReceiverFromOther / pxtAsReceiver) * 100 },
    } : {
      pk: { value: 0, percent: 0 },
      shot: { value: 0, percent: 0 },
      p3: { value: 0, percent: 0 },
      p2: { value: 0, percent: 0 },
      p1: { value: 0, percent: 0 },
      other: { value: 0, percent: 0 },
    };

    // Oblicz procenty dla breakdown PxT z dryblingu
    const pxtDribblingBreakdown = pxtAsDribbler > 0 ? {
      pk: { value: pxtDribblingFromPK, percent: (pxtDribblingFromPK / pxtAsDribbler) * 100 },
      shot: { value: pxtDribblingFromShot, percent: (pxtDribblingFromShot / pxtAsDribbler) * 100 },
      p3: { value: pxtDribblingFromP3, percent: (pxtDribblingFromP3 / pxtAsDribbler) * 100 },
      p2: { value: pxtDribblingFromP2, percent: (pxtDribblingFromP2 / pxtAsDribbler) * 100 },
      p1: { value: pxtDribblingFromP1, percent: (pxtDribblingFromP1 / pxtAsDribbler) * 100 },
      other: { value: pxtDribblingFromOther, percent: (pxtDribblingFromOther / pxtAsDribbler) * 100 },
    } : {
      pk: { value: 0, percent: 0 },
      shot: { value: 0, percent: 0 },
      p3: { value: 0, percent: 0 },
      p2: { value: 0, percent: 0 },
      p1: { value: 0, percent: 0 },
      other: { value: 0, percent: 0 },
    };

    // Znajdź mecze, w których grał zawodnik
    const playerMatches = filteredMatchesBySeason.filter((match) => {
      if (selectedMatchIds.length > 0) {
        return selectedMatchIds.includes(match.matchId || "");
      }
      return true;
    });

    return {
      totalPxT,
      pxtAsSender,
      pxtAsReceiver,
      pxtAsDribbler,
      totalXT,
      totalxG,
      totalRegains,
      totalLoses,
      totalPKEntries,
      actionsCount: filteredActions.length,
      matchesCount: playerMatches.length,
      totalMinutes,
      // Wartości per 90 minut
      pxtPer90: totalPxT * per90Multiplier,
      pxtSenderPer90: pxtAsSender * per90Multiplier,
      pxtReceiverPer90: pxtAsReceiver * per90Multiplier,
      pxtDribblingPer90: pxtAsDribbler * per90Multiplier,
      xtPer90: totalXT * per90Multiplier,
      xgPer90: totalxG * per90Multiplier,
      regainsPer90: totalRegains * per90Multiplier,
      losesPer90: totalLoses * per90Multiplier,
      pkEntriesPer90: totalPKEntries * per90Multiplier,
      // Średnie PxT/akcje
      pxtSenderPerAction: senderActionsCount > 0 ? pxtAsSender / senderActionsCount : 0,
      pxtReceiverPerAction: receiverActionsCount > 0 ? pxtAsReceiver / receiverActionsCount : 0,
      pxtDribblingPerAction: dribblingActionsCount > 0 ? pxtAsDribbler / dribblingActionsCount : 0,
      // Liczniki akcji
      senderActionsCount,
      receiverActionsCount,
      dribblingActionsCount,
      // Akcje per 90 minut
      senderActionsPer90: senderActionsCount * per90Multiplier,
      receiverActionsPer90: receiverActionsCount * per90Multiplier,
      dribblingActionsPer90: dribblingActionsCount * per90Multiplier,
      // Breakdown PxT
      pxtSenderBreakdown,
      pxtReceiverBreakdown,
      pxtDribblingBreakdown,
      // Liczniki podań
      senderPassCount,
      receiverPassCount,
      // Liczniki akcji jako podający
      senderP1Count,
      senderP2Count,
      senderP3Count,
      senderPKCount,
      senderShotCount,
      senderGoalCount,
      // Liczniki akcji jako podający - strefy boczne
      senderP1CountLateral,
      senderP2CountLateral,
      senderP3CountLateral,
      senderPKCountLateral,
      senderShotCountLateral,
      senderGoalCountLateral,
      // Liczniki akcji jako podający - strefy centralne
      senderP1CountCentral,
      senderP2CountCentral,
      senderP3CountCentral,
      senderPKCountCentral,
      senderShotCountCentral,
      senderGoalCountCentral,
      // Liczniki akcji jako przyjmujący
      receiverP1Count,
      receiverP2Count,
      receiverP3Count,
      receiverPKCount,
      receiverShotCount,
      receiverGoalCount,
      // Liczniki akcji jako przyjmujący - strefy boczne
      receiverP1CountLateral,
      receiverP2CountLateral,
      receiverP3CountLateral,
      receiverPKCountLateral,
      receiverShotCountLateral,
      receiverGoalCountLateral,
      // Liczniki akcji jako przyjmujący - strefy centralne
      receiverP1CountCentral,
      receiverP2CountCentral,
      receiverP3CountCentral,
      receiverPKCountCentral,
      receiverShotCountCentral,
      receiverGoalCountCentral,
      // Liczniki akcji z dryblingu
      dribblingP1Count,
      dribblingP2Count,
      dribblingP3Count,
      dribblingPKCount,
      dribblingShotCount,
      dribblingGoalCount,
      // Liczniki akcji z dryblingu - strefy boczne
      dribblingP1CountLateral,
      dribblingP2CountLateral,
      dribblingP3CountLateral,
      dribblingPKCountLateral,
      dribblingShotCountLateral,
      dribblingGoalCountLateral,
      // Liczniki akcji z dryblingu - strefy centralne
      dribblingP1CountCentral,
      dribblingP2CountCentral,
      dribblingP3CountCentral,
      dribblingPKCountCentral,
      dribblingShotCountCentral,
      dribblingGoalCountCentral,
      // Statystyki według pozycji
      positionStats,
      // Heatmapy - Podający
      senderFromHeatmap: new Map(senderFromHeatmap),
      senderToHeatmap: new Map(senderToHeatmap),
      // Heatmapy - Przyjmujący
      receiverToHeatmap: new Map(receiverToHeatmap),
      receiverFromHeatmap: new Map(receiverFromHeatmap),
      // Heatmapy - Drybling
      dribblerHeatmap: new Map(dribblerHeatmap),
      // Heatmapy liczby akcji - Podający
      senderFromActionCountHeatmap: new Map(senderFromActionCountHeatmap),
      senderToActionCountHeatmap: new Map(senderToActionCountHeatmap),
      // Heatmapy liczby akcji - Przyjmujący
      receiverToActionCountHeatmap: new Map(receiverToActionCountHeatmap),
      receiverFromActionCountHeatmap: new Map(receiverFromActionCountHeatmap),
      // Heatmapy liczby akcji - Drybling
      dribblerActionCountHeatmap: new Map(dribblerActionCountHeatmap),
      // Statystyki zawodników dla każdej strefy (dla receiver)
      // Dla kierunku "from": zawodnicy, którzy podawali Z tej strefy
      zonePlayerStatsFrom: new Map(Array.from(zonePlayerStatsFrom.entries()).map(([zone, players]) => [
        zone,
        new Map(players)
      ])),
      // Dla kierunku "to": zawodnicy, którzy podawali DO tej strefy
      zonePlayerStatsTo: new Map(Array.from(zonePlayerStatsTo.entries()).map(([zone, players]) => [
        zone,
        new Map(players)
      ])),
      // Statystyki zawodników dla każdej strefy (dla sender)
      // Dla kierunku "from": zawodnicy, którzy przyjmowali podania Z tej strefy
      senderZonePlayerStatsFrom: new Map(Array.from(senderZonePlayerStatsFrom.entries()).map(([zone, players]) => [
        zone,
        new Map(players)
      ])),
      // Dla kierunku "to": zawodnicy, którzy przyjmowali podania DO tej strefy
      senderZonePlayerStatsTo: new Map(Array.from(senderZonePlayerStatsTo.entries()).map(([zone, players]) => [
        zone,
        new Map(players)
      ])),
    };
  }, [player, allActions, filteredMatchesBySeason, selectedMatchIds, totalMinutes, positionMinutes]);

  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Ładowanie...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (!player) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Zawodnik nie znaleziony</h2>
          <Link href="/zawodnicy" className={styles.backLink}>
            ← Powrót do listy zawodników
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
        <h1>Profil zawodnika</h1>
      </div>

      {/* Selektor zespołu, zawodnika, sezonu i meczów na górze */}
      <div className={styles.playerSelectorContainer}>
        <div className={styles.selectorGroup}>
          <label htmlFor="team-select" className={styles.selectorLabel}>Zespół:</label>
          <select
            id="team-select"
            value={selectedTeam}
            onChange={(e) => {
              const newTeam = e.target.value;
              setSelectedTeam(newTeam);
              // Zapisz wybór zespołu w localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('selectedTeam', newTeam);
              }
              // Resetuj wybór zawodnika przy zmianie zespołu, ale nie usuwaj z localStorage
              // (zostanie zaktualizowany przez useEffect jeśli zawodnik nie będzie dostępny w nowym zespole)
              setSelectedPlayerForView("");
            }}
            className={styles.selectorSelect}
          >
            {availableTeams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.selectorGroup}>
          <label htmlFor="player-select" className={styles.selectorLabel}>Zawodnik:</label>
          <select
            id="player-select"
            value={selectedPlayerForView || ""}
            onChange={(e) => {
              if (e.target.value) {
                const newPlayerId = e.target.value;
                setSelectedPlayerForView(newPlayerId);
                // Zapisz wybór zawodnika w localStorage
                if (typeof window !== 'undefined') {
                  localStorage.setItem('selectedPlayerForView', newPlayerId);
                }
                router.push(`/profile/${newPlayerId}`);
              }
            }}
            className={styles.selectorSelect}
          >
            <option value="">Wybierz zawodnika...</option>
            {filteredPlayers.map(player => (
              <option key={player.id} value={player.id}>
                {getPlayerFullName(player)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.selectorGroup}>
          <label htmlFor="season-select" className={styles.selectorLabel}>Sezon:</label>
          <SeasonSelector
            selectedSeason={selectedSeason ?? defaultSeason}
            onChange={setSelectedSeason}
            showLabel={false}
            availableSeasons={availableSeasons}
          />
        </div>
        <div className={styles.selectorGroup}>
          <button
            className={styles.matchToggleButton}
            onClick={() => setShowMatchSelector(!showMatchSelector)}
          >
            {showMatchSelector ? "Ukryj" : "Pokaż"} wybór meczów ({filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || "")).length}/{filteredMatchesBySeason.length})
          </button>
        </div>
      </div>

      {/* Lista meczów do wyboru */}
      {showMatchSelector && (
        <div className={styles.matchesListContainer}>
          <div className={styles.matchListHeader}>
            <button
              className={styles.selectAllButton}
              onClick={() => {
                const allIds = filteredMatchesBySeason
                  .filter(m => m.matchId)
                  .map(m => m.matchId!);
                setSelectedMatchIds(allIds);
              }}
            >
              Zaznacz wszystkie
            </button>
            <button
              className={styles.deselectAllButton}
              onClick={() => setSelectedMatchIds([])}
            >
              Odznacz wszystkie
            </button>
          </div>
          <div className={styles.matchesCheckboxes}>
            {filteredMatchesBySeason.map((match) => (
              <label key={match.matchId} className={styles.matchCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedMatchIds.includes(match.matchId || "")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMatchIds([...selectedMatchIds, match.matchId!]);
                    } else {
                      setSelectedMatchIds(selectedMatchIds.filter(id => id !== match.matchId));
                    }
                  }}
                />
                <span>
                  {match.opponent} ({new Date(match.date).toLocaleDateString('pl-PL')}) - {match.competition}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={styles.playerCard}>
        <div className={styles.playerHeader}>
          {player.imageUrl && (
            <div className={styles.imageContainer}>
              <img
                src={player.imageUrl}
                alt={getPlayerFullName(player)}
                className={styles.playerImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className={styles.playerInfo}>
            <h2 className={styles.playerName}>{getPlayerFullName(player)}</h2>
            {player.number && (
              <div className={styles.playerNumber}>#{player.number}</div>
            )}
            {player.position && (
              <div className={styles.playerPosition}>{player.position}</div>
            )}
          </div>
        </div>


        {isLoadingActions ? (
          <div className={styles.loading}>Ładowanie statystyk...</div>
        ) : playerStats ? (
          <div className={styles.statsContainer}>
            <div className={styles.minutesInfo}>
              <p>
                <strong>Minuty gry:</strong> {playerStats.totalMinutes} min
              </p>
            </div>

            <div className={styles.statsLayout}>
              {/* Lista kategorii po lewej */}
              <div className={styles.categoriesList}>
                <div
                  className={`${styles.categoryItem} ${expandedCategory === 'pxt' ? styles.active : ''}`}
                  onClick={() => setExpandedCategory(expandedCategory === 'pxt' ? null : 'pxt')}
                >
                  <span className={styles.categoryName}>PxT</span>
                  <span className={styles.categoryValue}>{playerStats.pxtPer90.toFixed(2)}</span>
                </div>
                <div className={styles.categoryItem}>
                  <span className={styles.categoryName}>xG</span>
                  <span className={styles.categoryValue}>{playerStats.xgPer90.toFixed(2)}</span>
                </div>
                <div className={styles.categoryItem}>
                  <span className={styles.categoryName}>Regainy</span>
                  <span className={styles.categoryValue}>{playerStats.regainsPer90.toFixed(1)}</span>
                </div>
                <div className={styles.categoryItem}>
                  <span className={styles.categoryName}>Straty</span>
                  <span className={styles.categoryValue}>{playerStats.losesPer90.toFixed(1)}</span>
                </div>
                <div className={styles.categoryItem}>
                  <span className={styles.categoryName}>Wejścia w PK</span>
                  <span className={styles.categoryValue}>{playerStats.pkEntriesPer90.toFixed(1)}</span>
                </div>
              </div>

              {/* Szczegóły po prawej */}
              <div className={styles.detailsPanel}>
                {expandedCategory === 'pxt' && (
                  <div className={styles.pxtDetails}>
                    <h3>Szczegóły PxT</h3>
                    
                    {/* Przyciski wyboru kategorii na górze */}
                    <div className={styles.categoryControls}>
                      <button
                        className={`${styles.categoryButton} ${selectedPxtCategory === 'sender' ? styles.active : ''}`}
                        onClick={() => {
                          setSelectedPxtCategory('sender');
                          setHeatmapDirection('from'); // Domyślnie pokazuj z której strefy
                        }}
                      >
                        Podający
                      </button>
                      <button
                        className={`${styles.categoryButton} ${selectedPxtCategory === 'receiver' ? styles.active : ''}`}
                        onClick={() => {
                          setSelectedPxtCategory('receiver');
                          setHeatmapDirection('to'); // Domyślnie pokazuj do której strefy
                        }}
                      >
                        Przyjmujący
                      </button>
                      <button
                        className={`${styles.categoryButton} ${selectedPxtCategory === 'dribbler' ? styles.active : ''}`}
                        onClick={() => setSelectedPxtCategory('dribbler')}
                      >
                        Drybling
                      </button>
                    </div>

                    {/* Wyświetlanie danych dla wybranej kategorii */}
                    {selectedPxtCategory === 'sender' && (
                      <div className={styles.detailsSection}>
                        <h4>Podanie</h4>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtAsSender.toFixed(2)} ({playerStats.pxtSenderPer90.toFixed(2)} / 90 min)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                        <span className={styles.detailsValue}>{playerStats.senderActionsPer90.toFixed(1)} ({playerStats.senderPassCount} podań)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT / podanie:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtSenderPerAction.toFixed(2)}</span>
                      </div>
                      <div className={styles.actionCounts}>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P1:</span>
                          <span className={styles.countValue}>{playerStats.senderP1Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP1CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP1CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P2:</span>
                          <span className={styles.countValue}>{playerStats.senderP2Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP2CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP2CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P3:</span>
                          <span className={styles.countValue}>{playerStats.senderP3Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP3CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderP3CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>PK:</span>
                          <span className={styles.countValue}>{playerStats.senderPKCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderPKCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderPKCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Strzał:</span>
                          <span className={styles.countValue}>{playerStats.senderShotCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderShotCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderShotCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Gol:</span>
                          <span className={styles.countValue}>{playerStats.senderGoalCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderGoalCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.senderGoalCountCentral}</span>
                          </div>
                        </div>
                      </div>
                      </div>
                    )}

                    {selectedPxtCategory === 'receiver' && (
                      <div className={styles.detailsSection}>
                        <h4>Przyjęcie</h4>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtAsReceiver.toFixed(2)} ({playerStats.pxtReceiverPer90.toFixed(2)} / 90 min)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                        <span className={styles.detailsValue}>{playerStats.receiverActionsPer90.toFixed(1)} ({playerStats.receiverPassCount} podań)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT / podanie:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtReceiverPerAction.toFixed(2)}</span>
                      </div>
                      <div className={styles.actionCounts}>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P1:</span>
                          <span className={styles.countValue}>{playerStats.receiverP1Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP1CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP1CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P2:</span>
                          <span className={styles.countValue}>{playerStats.receiverP2Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP2CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP2CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P3:</span>
                          <span className={styles.countValue}>{playerStats.receiverP3Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP3CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverP3CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>PK:</span>
                          <span className={styles.countValue}>{playerStats.receiverPKCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverPKCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverPKCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Strzał:</span>
                          <span className={styles.countValue}>{playerStats.receiverShotCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverShotCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverShotCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Gol:</span>
                          <span className={styles.countValue}>{playerStats.receiverGoalCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverGoalCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.receiverGoalCountCentral}</span>
                          </div>
                        </div>
                      </div>
                      </div>
                    )}

                    {selectedPxtCategory === 'dribbler' && (
                      <div className={styles.detailsSection}>
                        <h4>Drybling</h4>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtAsDribbler.toFixed(2)} ({playerStats.pxtDribblingPer90.toFixed(2)} / 90 min)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                        <span className={styles.detailsValue}>{playerStats.dribblingActionsPer90.toFixed(1)} ({playerStats.dribblingActionsCount} dryblingów)</span>
                      </div>
                      <div className={styles.detailsRow}>
                        <span className={styles.detailsLabel}>PxT / drybling:</span>
                        <span className={styles.detailsValue}>{playerStats.pxtDribblingPerAction.toFixed(2)}</span>
                      </div>
                      <div className={styles.actionCounts}>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P1:</span>
                          <span className={styles.countValue}>{playerStats.dribblingP1Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP1CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP1CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P2:</span>
                          <span className={styles.countValue}>{playerStats.dribblingP2Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP2CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP2CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>P3:</span>
                          <span className={styles.countValue}>{playerStats.dribblingP3Count}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP3CountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingP3CountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>PK:</span>
                          <span className={styles.countValue}>{playerStats.dribblingPKCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingPKCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingPKCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Strzał:</span>
                          <span className={styles.countValue}>{playerStats.dribblingShotCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingShotCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingShotCountCentral}</span>
                          </div>
                        </div>
                        <div className={styles.countItem}>
                          <span className={styles.countLabel}>Gol:</span>
                          <span className={styles.countValue}>{playerStats.dribblingGoalCount}</span>
                          <div className={styles.zoneBreakdown}>
                            <span className={styles.zoneLabel}>Strefy boczne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingGoalCountLateral}</span>
                            <span className={styles.zoneLabel}>Strefy centralne:</span>
                            <span className={styles.zoneValue}>{playerStats.dribblingGoalCountCentral}</span>
                          </div>
                        </div>
                      </div>
                      </div>
                    )}

                    {/* Boisko z heatmapą */}
                    <div className={styles.detailsSection}>
                      <div className={styles.heatmapHeader}>
                        <h4>Heatmapa</h4>
                        <div className={styles.heatmapControls}>
                          {/* Przełącznik kierunku (tylko dla sender i receiver) */}
                          {(selectedPxtCategory === 'sender' || selectedPxtCategory === 'receiver') && (
                            <div className={styles.heatmapDirectionToggle}>
                              <button
                                className={`${styles.heatmapDirectionButton} ${heatmapDirection === 'from' ? styles.active : ''}`}
                                onClick={() => setHeatmapDirection('from')}
                              >
                                {selectedPxtCategory === 'sender' ? 'Z której strefy' : 'Z której strefy'}
                              </button>
                              <button
                                className={`${styles.heatmapDirectionButton} ${heatmapDirection === 'to' ? styles.active : ''}`}
                                onClick={() => setHeatmapDirection('to')}
                              >
                                {selectedPxtCategory === 'sender' ? 'Do której strefy' : 'Do której strefy'}
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
                      <div className={styles.heatmapWrapper}>
                        <div className={styles.heatmapContainer}>
                          <PlayerHeatmapPitch
                            heatmapData={
                              (() => {
                                if (selectedPxtCategory === 'sender') {
                                  if (heatmapMode === 'pxt') {
                                    return heatmapDirection === 'from' 
                                      ? playerStats.senderFromHeatmap 
                                      : playerStats.senderToHeatmap;
                                  } else {
                                    return heatmapDirection === 'from'
                                      ? playerStats.senderFromActionCountHeatmap
                                      : playerStats.senderToActionCountHeatmap;
                                  }
                                } else if (selectedPxtCategory === 'receiver') {
                                  if (heatmapMode === 'pxt') {
                                    return heatmapDirection === 'to'
                                      ? playerStats.receiverToHeatmap
                                      : playerStats.receiverFromHeatmap;
                                  } else {
                                    return heatmapDirection === 'to'
                                      ? playerStats.receiverToActionCountHeatmap
                                      : playerStats.receiverFromActionCountHeatmap;
                                  }
                                } else {
                                  // Drybling - tylko from
                                  return heatmapMode === 'pxt'
                                    ? playerStats.dribblerHeatmap
                                    : playerStats.dribblerActionCountHeatmap;
                                }
                              })()
                            }
                            category={selectedPxtCategory}
                            mode={heatmapMode}
                            onZoneClick={(zoneName) => {
                              // Dla receiver i sender pokazujemy szczegóły dla obu kierunków
                              if (selectedPxtCategory === 'receiver') {
                                const zoneStats = heatmapDirection === 'from' 
                                  ? playerStats.zonePlayerStatsFrom?.get(zoneName)
                                  : playerStats.zonePlayerStatsTo?.get(zoneName);
                                
                                if (zoneStats && zoneStats.size > 0) {
                                  const playersList = Array.from(zoneStats.entries())
                                    .map(([playerId, stats]) => {
                                      const player = players.find(p => p.id === playerId);
                                      return {
                                        playerId,
                                        playerName: player ? getPlayerFullName(player) : `Zawodnik ${playerId}`,
                                        passes: stats.passes,
                                        pxt: stats.pxt,
                                        p1Count: stats.p1Count,
                                        p2Count: stats.p2Count,
                                        p3Count: stats.p3Count,
                                        pkCount: stats.pkCount,
                                        shotCount: stats.shotCount,
                                        goalCount: stats.goalCount,
                                      };
                                    })
                                    .sort((a, b) => b.pxt - a.pxt); // Sortuj według PxT
                                  
                                  setZoneDetails({
                                    zoneName,
                                    players: playersList,
                                  });
                                  setSelectedZone(zoneName);
                                } else {
                                  setZoneDetails(null);
                                  setSelectedZone(null);
                                }
                              } else if (selectedPxtCategory === 'sender') {
                                const zoneStats = heatmapDirection === 'from' 
                                  ? playerStats.senderZonePlayerStatsFrom?.get(zoneName)
                                  : playerStats.senderZonePlayerStatsTo?.get(zoneName);
                                
                                if (zoneStats && zoneStats.size > 0) {
                                  const playersList = Array.from(zoneStats.entries())
                                    .map(([playerId, stats]) => {
                                      const player = players.find(p => p.id === playerId);
                                      return {
                                        playerId,
                                        playerName: player ? getPlayerFullName(player) : `Zawodnik ${playerId}`,
                                        passes: stats.passes,
                                        pxt: stats.pxt,
                                        p1Count: stats.p1Count,
                                        p2Count: stats.p2Count,
                                        p3Count: stats.p3Count,
                                        pkCount: stats.pkCount,
                                        shotCount: stats.shotCount,
                                        goalCount: stats.goalCount,
                                      };
                                    })
                                    .sort((a, b) => b.pxt - a.pxt); // Sortuj według PxT
                                  
                                  setZoneDetails({
                                    zoneName,
                                    players: playersList,
                                  });
                                  setSelectedZone(zoneName);
                                } else {
                                  setZoneDetails(null);
                                  setSelectedZone(null);
                                }
                              }
                            }}
                          />
                        </div>
                        
                        {/* Panel z informacjami o strefie po prawej stronie */}
                        {zoneDetails && (selectedPxtCategory === 'receiver' || selectedPxtCategory === 'sender') && (
                          <div className={styles.zoneDetailsPanel}>
                            <div className={styles.zoneDetailsHeader}>
                              <h4>Strefa {zoneDetails.zoneName}</h4>
                              <button 
                                className={styles.zoneDetailsClose}
                                onClick={() => {
                                  setZoneDetails(null);
                                  setSelectedZone(null);
                                }}
                              >
                                ×
                              </button>
                            </div>
                            <div className={styles.zoneDetailsBody}>
                              <p className={styles.zoneDetailsSubtitle}>
                                {selectedPxtCategory === 'receiver' ? (
                                  heatmapDirection === 'from' 
                                    ? `Zawodnicy, którzy podawali z tej strefy do ${getPlayerFullName(player!)}:`
                                    : `Zawodnicy, którzy podawali do tej strefy (gdzie ${getPlayerFullName(player!)} przyjmował):`
                                ) : (
                                  heatmapDirection === 'from' 
                                    ? `Zawodnicy, którzy przyjmowali podania z tej strefy (gdzie ${getPlayerFullName(player!)} podawał):`
                                    : `Zawodnicy, którzy przyjmowali podania do tej strefy (gdzie ${getPlayerFullName(player!)} podawał):`
                                )}
                              </p>
                              <div className={styles.zonePlayersList}>
                                {zoneDetails.players.map((playerInfo) => (
                                  <div key={playerInfo.playerId} className={styles.zonePlayerItem}>
                                    <div className={styles.zonePlayerName}>{playerInfo.playerName}</div>
                                    <div className={styles.zonePlayerStats}>
                                      <span className={styles.zonePlayerStat}>
                                        <strong>{playerInfo.passes}</strong> {playerInfo.passes === 1 ? 'podań' : 'podań'}
                                      </span>
                                      <span className={styles.zonePlayerStat}>
                                        <strong>{playerInfo.pxt.toFixed(2)}</strong> PxT
                                      </span>
                                      <span className={styles.zonePlayerStat}>
                                        <strong>{(playerInfo.pxt / playerInfo.passes).toFixed(2)}</strong> PxT/podanie
                                      </span>
                                    </div>
                                    {(playerInfo.p1Count > 0 || playerInfo.p2Count > 0 || playerInfo.p3Count > 0 || playerInfo.pkCount > 0 || playerInfo.shotCount > 0 || playerInfo.goalCount > 0) && (
                                      <div className={styles.zonePlayerActionBreakdown}>
                                        {playerInfo.p1Count > 0 && (
                                          <span className={styles.zonePlayerActionItem}>P1: {playerInfo.p1Count}</span>
                                        )}
                                        {playerInfo.p2Count > 0 && (
                                          <span className={styles.zonePlayerActionItem}>P2: {playerInfo.p2Count}</span>
                                        )}
                                        {playerInfo.p3Count > 0 && (
                                          <span className={styles.zonePlayerActionItem}>P3: {playerInfo.p3Count}</span>
                                        )}
                                        {playerInfo.pkCount > 0 && (
                                          <span className={styles.zonePlayerActionItem}>PK: {playerInfo.pkCount}</span>
                                        )}
                                        {playerInfo.shotCount > 0 && (
                                          <span className={styles.zonePlayerActionItem}>Strzał: {playerInfo.shotCount}</span>
                                        )}
                                        {playerInfo.goalCount > 0 && (
                                          <span className={styles.zonePlayerActionItem}>Gol: {playerInfo.goalCount}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Wykres mecz po meczu */}
                    {matchByMatchData.length > 0 && (
                      <div className={styles.detailsSection}>
                        <div className={styles.chartHeader}>
                          <h4>Wykres mecz po meczu</h4>
                          <div className={styles.chartModeToggle}>
                            <button
                              className={`${styles.chartModeButton} ${chartMode === 'pxt' ? styles.active : ''}`}
                              onClick={() => setChartMode('pxt')}
                            >
                              PxT
                            </button>
                            <button
                              className={`${styles.chartModeButton} ${chartMode === 'pxtPerMinute' ? styles.active : ''}`}
                              onClick={() => setChartMode('pxtPerMinute')}
                            >
                              PxT/min
                            </button>
                          </div>
                        </div>
                        <div className={styles.matchChartContainer}>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={matchByMatchData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis 
                                dataKey="matchName" 
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                interval={0}
                                tick={{ fontSize: 11 }}
                                stroke="#6b7280"
                              />
                              <YAxis 
                                label={{ 
                                  value: chartMode === 'pxt' ? 'PxT' : 'PxT/min', 
                                  angle: -90, 
                                  position: 'insideLeft', 
                                  style: { textAnchor: 'middle' } 
                                }}
                                stroke="#6b7280"
                              />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className={styles.chartTooltip}>
                                        <p><strong>{data.matchName}</strong></p>
                                        <p>PxT: {data.pxt.toFixed(2)}</p>
                                        <p>Minuty: {data.minutes}</p>
                                        <p>PxT/minutę: {data.pxtPerMinute.toFixed(3)}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey={chartMode === 'pxt' ? 'pxt' : 'pxtPerMinute'} 
                                stroke="#2196f3" 
                                strokeWidth={2}
                                dot={{ fill: '#2196f3', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6 }}
                                name={chartMode === 'pxt' ? 'PxT' : 'PxT/min'}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Według pozycji */}
                    {playerStats.positionStats && Object.keys(playerStats.positionStats).length > 0 && (
                      <div className={styles.detailsSection}>
                        <div 
                          className={styles.expandableHeader}
                          onClick={() => setIsPositionStatsExpanded(!isPositionStatsExpanded)}
                        >
                          <h4>Według pozycji</h4>
                          <span className={styles.expandIcon}>
                            {isPositionStatsExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                        {isPositionStatsExpanded && (
                          <div className={styles.positionStatsContent}>
                            {Object.entries(playerStats.positionStats).map(([position, stats]) => (
                          <div key={position} className={styles.positionDetails}>
                            <h5>{position} ({stats.minutes} min)</h5>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Podanie:</span>
                              <span className={styles.detailsValue}>{stats.pxtAsSender.toFixed(2)} ({stats.pxtSenderPer90.toFixed(2)} / 90 min) - {stats.senderPassCount} podań - {stats.pxtSenderPerPass.toFixed(2)} PxT/podanie</span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Przyjęcie:</span>
                              <span className={styles.detailsValue}>{stats.pxtAsReceiver.toFixed(2)} ({stats.pxtReceiverPer90.toFixed(2)} / 90 min) - {stats.receiverPassCount} podań - {stats.pxtReceiverPerPass.toFixed(2)} PxT/podanie</span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Drybling:</span>
                              <span className={styles.detailsValue}>{stats.pxtAsDribbler.toFixed(2)} ({stats.pxtDribblingPer90.toFixed(2)} / 90 min) - {stats.dribblingCount} dryblingów - {stats.pxtDribblingPerDribble.toFixed(2)} PxT/drybling</span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                              <span className={styles.detailsValue}>Podania: {stats.senderActionsPer90.toFixed(1)}, Przyjęcia: {stats.receiverActionsPer90.toFixed(1)}, Dryblingi: {stats.dribblingActionsPer90.toFixed(1)}</span>
                            </div>
                          </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>


            <div className={styles.matchesInfo}>
              <p>
                Statystyki z {playerStats.matchesCount}{" "}
                {playerStats.matchesCount === 1 ? "meczu" : "meczów"}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.noData}>Brak danych do wyświetlenia</div>
        )}
      </div>

      {/* Panel boczny z menu */}
      <SidePanel
        players={players}
        actions={allActions}
        matchInfo={null}
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

