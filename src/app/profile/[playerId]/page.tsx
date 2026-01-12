"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
import { getOppositeXTValueForZone, zoneNameToIndex, getZoneName, zoneNameToString } from "@/constants/xtValues";
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
  const [allTeamActions, setAllTeamActions] = useState<Action[]>([]); // Wszystkie akcje zespołu dla rankingu
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
  const [chartCategory, setChartCategory] = useState<"sender" | "receiver" | "dribbler">("sender"); // Kategoria wykresu: Podający, Przyjmujący, Drybling
  const [isPositionStatsExpanded, setIsPositionStatsExpanded] = useState(false);
  const [isPartnerStatsExpanded, setIsPartnerStatsExpanded] = useState(false);
  const [expandedPositionMatches, setExpandedPositionMatches] = useState<string | null>(null);
  const [partnerStatsMode, setPartnerStatsMode] = useState<"sender" | "receiver">("sender");
  const [partnerSortMode, setPartnerSortMode] = useState<"passes" | "pxt">("passes");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedActionFilter, setSelectedActionFilter] = useState<'p1' | 'p2' | 'p3' | 'pk' | 'shot' | 'goal' | null>(null);
  const [zoneDetails, setZoneDetails] = useState<{
    zoneName: string;
    players: Array<{ playerId: string; playerName: string; passes: number; pxt: number; p1Count: number; p2Count: number; p3Count: number; pkCount: number; shotCount: number; goalCount: number }>;
  } | null>(null);
  const [regainHeatmapMode, setRegainHeatmapMode] = useState<"xt" | "count">("xt"); // Tryb heatmapy regainów: xT odbiorców lub liczba akcji
  const [regainAttackDefenseMode, setRegainAttackDefenseMode] = useState<"attack" | "defense" | null>("defense"); // Tryb atak/obrona: null = wyłączony, "attack" = w ataku, "defense" = w obronie (domyślnie obrona)
  const [selectedRegainZone, setSelectedRegainZone] = useState<string | null>(null);
  const [selectedRegainPackingFilter, setSelectedRegainPackingFilter] = useState<"P0" | "P1" | "P2" | "P3" | null>(null); // Filtr P0-P3 dla regainów
  const [selectedPackingFilter, setSelectedPackingFilter] = useState<"P0" | "P1" | "P2" | "P3" | null>(null); // Filtr dla P0-P3
  const [regainZoneActions, setRegainZoneActions] = useState<Action[] | null>(null);
  const [actionsModalOpen, setActionsModalOpen] = useState(false);
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{ playerId: string; playerName: string; zoneName: string } | null>(null);
  const [isPlayerSelectModalOpen, setIsPlayerSelectModalOpen] = useState(false);
  const [isMatchSelectModalOpen, setIsMatchSelectModalOpen] = useState(false);

  // Ref do śledzenia, czy już załadowaliśmy mecze dla danego zespołu
  const lastLoadedTeamRef = useRef<string | null>(null);
  const isLoadingMatchesRef = useRef(false);

  // Znajdź zawodnika - użyj selectedPlayerForView jeśli jest ustawiony, w przeciwnym razie playerId z URL
  const player = useMemo(() => {
    const targetPlayerId = selectedPlayerForView || playerId;
    return players.find(p => p.id === targetPlayerId);
  }, [players, playerId, selectedPlayerForView]);

  // Filtruj mecze według sezonu i zespołu
  const filteredMatchesBySeason = useMemo(() => {
    let matches = allMatches;
    
    // Filtruj po zespole
    if (selectedTeam) {
      matches = matches.filter(match => match.team === selectedTeam);
    }
    
    // Filtruj po sezonie
    if (selectedSeason && selectedSeason !== "all") {
      matches = filterMatchesBySeason(matches, selectedSeason);
    }
    
    return matches;
  }, [allMatches, selectedSeason, selectedTeam]);

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

  // Grupowanie zawodników według pozycji dla modala wyboru
  const playersByPosition = useMemo(() => {
    const byPosition = filteredPlayers.reduce((acc, player) => {
      let position = player.position || 'Brak pozycji';
      
      // Łączymy LW i RW w jedną grupę "Skrzydłowi"
      if (position === 'LW' || position === 'RW') {
        position = 'Skrzydłowi';
      }
      
      if (!acc[position]) {
        acc[position] = [];
      }
      acc[position].push(player);
      return acc;
    }, {} as Record<string, typeof filteredPlayers>);
    
    // Kolejność pozycji: GK, CB, DM, Skrzydłowi (LW/RW), AM, ST
    const positionOrder = ['GK', 'CB', 'DM', 'Skrzydłowi', 'AM', 'ST'];
    
    // Sortuj pozycje według określonej kolejności
    const sortedPositions = Object.keys(byPosition).sort((a, b) => {
      const indexA = positionOrder.indexOf(a);
      const indexB = positionOrder.indexOf(b);
      
      // Jeśli obie pozycje są w liście, sortuj według kolejności
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // Jeśli tylko jedna jest w liście, ta w liście idzie pierwsza
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Jeśli żadna nie jest w liście, sortuj alfabetycznie
      return a.localeCompare(b, 'pl', { sensitivity: 'base' });
    });
    
    // Sortuj zawodników w każdej pozycji alfabetycznie po nazwisku
    // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji (LW przed RW), potem po nazwisku
    sortedPositions.forEach(position => {
      byPosition[position].sort((a, b) => {
        // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji
        if (position === 'Skrzydłowi') {
          const posA = a.position || '';
          const posB = b.position || '';
          if (posA !== posB) {
            // LW przed RW
            if (posA === 'LW') return -1;
            if (posB === 'LW') return 1;
          }
        }
        
        const getLastName = (name: string) => {
          const words = name.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(a.name);
        const lastNameB = getLastName(b.name);
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  }, [filteredPlayers]);

  // Funkcja do wyboru zawodnika z modala
  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayerForView(playerId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedPlayerForView', playerId);
    }
    setAllActions([]);
    setAllShots([]);
    setSelectedMatchIds([]);
    setIsPlayerSelectModalOpen(false);
  };

  // Pobierz wszystkie akcje dla zawodnika
  useEffect(() => {
    const loadPlayerActions = async () => {
      // Poczekaj aż filteredPlayers się zaktualizuje po zmianie zespołu
      if (filteredPlayers.length === 0) {
        setAllActions([]);
        setAllShots([]);
        setSelectedMatchIds([]);
        setIsLoadingActions(false);
        return;
      }
      
      // Jeśli nie ma wybranego zawodnika, poczekaj aż zostanie ustawiony przez useEffect
      if (!selectedPlayerForView) {
        setAllActions([]);
        setAllShots([]);
        setSelectedMatchIds([]);
        setIsLoadingActions(false);
        return;
      }
      
      const targetPlayerId = selectedPlayerForView;
      if (!targetPlayerId || !db) {
        setAllActions([]);
        setAllShots([]);
        setSelectedMatchIds([]);
        setIsLoadingActions(false);
        return;
      }
      
      // Sprawdź czy zawodnik jest dostępny w przefiltrowanych zawodnikach
      if (!filteredPlayers.some(p => p.id === targetPlayerId)) {
        // Jeśli zawodnik nie jest dostępny, wyczyść dane i poczekaj na ustawienie nowego zawodnika
        setAllActions([]);
        setAllShots([]);
        setSelectedMatchIds([]);
        setIsLoadingActions(false);
        return;
      }
      
      // Sprawdź czy są mecze do załadowania
      // Jeśli nie ma meczów, to też OK - po prostu nie ma danych dla tego zespołu/sezonu
      // Ale musimy załadować dane (nawet jeśli będzie puste), aby pokazać że dane zostały załadowane

      setIsLoadingActions(true);
      try {
        const allActionsData: Action[] = [];
        const allShotsData: any[] = [];

        // Użyj już przefiltrowanych meczów
        const matchesToLoad = filteredMatchesBySeason;

        // Pobierz akcje ze wszystkich meczów
        for (const match of matchesToLoad) {
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

              // Dodaj matchId do każdej akcji oraz informację o źródle (kolekcji)
              const allMatchActions = [
                ...packingActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'packing' as const })),
                ...unpackingActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'unpacking' as const })),
                ...regainActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'regain' as const })),
                ...losesActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'loses' as const }))
              ];

              // Filtruj akcje dla wybranego zawodnika
              const playerActions = allMatchActions.filter(
                action =>
                  action.senderId === targetPlayerId ||
                  action.receiverId === targetPlayerId ||
                  (action as any).playerId === targetPlayerId
              );

              allActionsData.push(...playerActions);
              
              // Pobierz strzały dla zawodnika
              const matchShots = matchData.shots || [];
              const playerShots = matchShots.filter((shot: any) => shot.playerId === targetPlayerId);
              allShotsData.push(...playerShots.map((shot: any) => ({ ...shot, matchId: match.matchId! })));
            }
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji dla meczu ${match.matchId}:`, error);
          }
        }

        setAllActions(allActionsData);
        setAllShots(allShotsData);
        
        // Zaznacz wszystkie mecze domyślnie (tylko z wyfiltrowanych)
        const matchIds = matchesToLoad
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
  }, [playerId, selectedPlayerForView, filteredMatchesBySeason, filteredPlayers, db]);

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

  // Załaduj mecze dla wszystkich zespołów, jeśli allMatches nie zawiera meczów dla aktualnego zespołu
  useEffect(() => {
    const loadMatchesIfNeeded = async () => {
      if (!selectedTeam || isLoadingMatchesRef.current) return;
      
      // Jeśli już załadowaliśmy mecze dla tego zespołu, nie ładuj ponownie
      if (lastLoadedTeamRef.current === selectedTeam) {
        return;
      }
      
      // Sprawdź czy allMatches zawiera mecze dla aktualnego zespołu
      const hasMatchesForTeam = allMatches.some(match => match.team === selectedTeam);
      
      if (!hasMatchesForTeam) {
        // Jeśli allMatches nie ma meczów dla tego zespołu, pobierz wszystkie mecze
        isLoadingMatchesRef.current = true;
        try {
          await forceRefreshFromFirebase();
          lastLoadedTeamRef.current = selectedTeam;
        } catch (error) {
          console.error("Błąd podczas przeładowywania meczów:", error);
        } finally {
          isLoadingMatchesRef.current = false;
        }
      } else {
        // Jeśli mecze już są, oznacz że załadowaliśmy dla tego zespołu
        lastLoadedTeamRef.current = selectedTeam;
      }
    };
    
    // Uruchom tylko raz przy zmianie zespołu, z małym opóźnieniem, aby uniknąć konfliktów
    const timeoutId = setTimeout(() => {
      loadMatchesIfNeeded();
    }, 200);
    
    return () => clearTimeout(timeoutId);
  }, [selectedTeam]); // Tylko selectedTeam w zależnościach

  // Pobierz wszystkie akcje zespołu dla rankingu
  useEffect(() => {
    const loadAllTeamActions = async () => {
      if (!selectedTeam || !db || filteredPlayers.length === 0) {
        setAllTeamActions([]);
        return;
      }

      try {
        const allTeamActionsData: Action[] = [];

        // Użyj filteredMatchesBySeason zamiast allMatches, żeby uwzględnić filtr sezonu
        const matchesToLoad = filteredMatchesBySeason;

        // Pobierz akcje ze wszystkich meczów dla wszystkich zawodników
        for (const match of matchesToLoad) {
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

              // Dodaj matchId do każdej akcji - NIE filtruj po zawodniku!
              const allMatchActions = [
                ...packingActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'packing' as const })),
                ...unpackingActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'unpacking' as const })),
                ...regainActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'regain' as const })),
                ...losesActions.map(a => ({ ...a, matchId: match.matchId!, _actionSource: 'loses' as const }))
              ];

              // Filtruj tylko akcje zawodników z wybranego zespołu
              const teamPlayersIds = filteredPlayers.map(p => p.id);
              const teamMatchActions = allMatchActions.filter(
                action =>
                  (action.senderId && teamPlayersIds.includes(action.senderId)) ||
                  (action.receiverId && teamPlayersIds.includes(action.receiverId)) ||
                  ((action as any).playerId && teamPlayersIds.includes((action as any).playerId))
              );

              allTeamActionsData.push(...teamMatchActions);
            }
          } catch (error) {
            console.error(`Błąd podczas pobierania akcji zespołu dla meczu ${match.matchId}:`, error);
          }
        }

        setAllTeamActions(allTeamActionsData);
      } catch (error) {
        console.error("Błąd podczas pobierania akcji zespołu:", error);
        setAllTeamActions([]);
      }
    };

    loadAllTeamActions();
  }, [selectedTeam, filteredMatchesBySeason, filteredPlayers, db]);

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
    if (filteredPlayers.length === 0) {
      // Jeśli nie ma zawodników, wyczyść selectedPlayerForView
      if (selectedPlayerForView) {
        setSelectedPlayerForView("");
      }
      return;
    }
    
    // Jeśli selectedPlayerForView jest pusty, zawsze ustaw pierwszego dostępnego zawodnika
    if (!selectedPlayerForView) {
      const firstPlayerId = filteredPlayers[0]?.id;
      if (firstPlayerId) {
        setSelectedPlayerForView(firstPlayerId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedPlayerForView', firstPlayerId);
        }
      }
      return;
    }
    
    // Sprawdź czy aktualny selectedPlayerForView jest dostępny w filteredPlayers
    if (!filteredPlayers.some(p => p.id === selectedPlayerForView)) {
      // Jeśli aktualny zawodnik nie jest dostępny w filteredPlayers
      // Sprawdź czy playerId z URL jest dostępny
      if (filteredPlayers.some(p => p.id === playerId)) {
        setSelectedPlayerForView(playerId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedPlayerForView', playerId);
        }
      } else {
        // Jeśli playerId też nie jest dostępny, ustaw pierwszego dostępnego
        const firstPlayerId = filteredPlayers[0]?.id;
        if (firstPlayerId) {
          setSelectedPlayerForView(firstPlayerId);
          if (typeof window !== 'undefined') {
            localStorage.setItem('selectedPlayerForView', firstPlayerId);
          }
        }
      }
    } else if (filteredPlayers.some(p => p.id === playerId) && selectedPlayerForView !== playerId) {
      // Jeśli playerId z URL jest dostępny i różny od aktualnego, użyj go (priorytet)
      setSelectedPlayerForView(playerId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedPlayerForView', playerId);
      }
    }
  }, [filteredPlayers, playerId]);

  // Zaznacz wszystkie mecze domyślnie przy zmianie sezonu (tylko jeśli nie są ręcznie odznaczone)
  const [manuallyDeselectedAll, setManuallyDeselectedAll] = useState(false);
  useEffect(() => {
    if (!manuallyDeselectedAll) {
      const matchIds = filteredMatchesBySeason
        .filter(m => m.matchId)
        .map(m => m.matchId!);
      setSelectedMatchIds(matchIds);
    }
  }, [filteredMatchesBySeason, manuallyDeselectedAll]);

  // Oblicz minuty gry zawodnika i według pozycji
  const { totalMinutes, positionMinutes } = useMemo(() => {
    let minutes = 0;
    const posMinutes = new Map<string, number>();
    
    const matchesToCheck = selectedMatchIds.length > 0
      ? filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || ""))
      : filteredMatchesBySeason;

    const targetPlayerId = selectedPlayerForView || playerId;
    
    matchesToCheck.forEach((match) => {
      if (match.playerMinutes) {
        const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === targetPlayerId);
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
  }, [playerId, selectedPlayerForView, filteredMatchesBySeason, selectedMatchIds]);

  // Oblicz dane mecz po meczu dla wykresu
  const matchByMatchData = useMemo(() => {
    if (!player || !allActions.length) return [];

    const matchesToCheck = selectedMatchIds.length > 0
      ? filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || ""))
      : filteredMatchesBySeason;

    const targetPlayerId = selectedPlayerForView || player.id;
    
    const data = matchesToCheck.map((match) => {
      // Oblicz minuty dla tego meczu i pobierz pozycję
      let minutes = 0;
      let position = null;
      if (match.playerMinutes) {
        const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === targetPlayerId);
        if (playerMinute) {
          minutes = playerMinute.startMinute === 0 && playerMinute.endMinute === 0
            ? 0
            : playerMinute.endMinute - playerMinute.startMinute + 1;
          position = playerMinute.position || null;
        }
      }

      // Oblicz PxT dla tego meczu według wybranej kategorii
      let matchPxt = 0;
      const matchActions = allActions.filter(a => a.matchId === match.matchId);
      
      matchActions.forEach((action) => {
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        const packingPoints = action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;

        // PxT według wybranej kategorii
        if (chartCategory === 'sender' && action.senderId === targetPlayerId && action.actionType === 'pass') {
          matchPxt += pxtValue;
        }
        else if (chartCategory === 'receiver' && action.receiverId === targetPlayerId && action.actionType === 'pass') {
          matchPxt += pxtValue;
        }
        else if (chartCategory === 'dribbler' && action.senderId === targetPlayerId && action.actionType === 'dribble') {
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
        position: position,
        opponent: match.opponent,
        isHome: match.isHome,
        date: match.date,
        competition: match.competition,
      };
    }).filter(m => m.minutes > 0).sort((a, b) => {
      // Sortuj według daty meczu
      const matchA = filteredMatchesBySeason.find(m => m.matchId === a.matchId);
      const matchB = filteredMatchesBySeason.find(m => m.matchId === b.matchId);
      if (!matchA || !matchB) return 0;
      return new Date(matchA.date).getTime() - new Date(matchB.date).getTime();
    });

    // Oblicz linię trendu (regresja liniowa) po sortowaniu
    if (data.length > 1) {
      const n = data.length;
      const sumX = data.reduce((sum, d, i) => sum + i, 0);
      const sumY = data.reduce((sum, d) => sum + (chartMode === 'pxt' ? d.pxt : d.pxtPerMinute), 0);
      const sumXY = data.reduce((sum, d, i) => sum + i * (chartMode === 'pxt' ? d.pxt : d.pxtPerMinute), 0);
      const sumXX = data.reduce((sum, d, i) => sum + i * i, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return data.map((d, i) => ({
        ...d,
        trendLine: slope * i + intercept,
      }));
    }
    
    return data.map(d => ({ ...d, trendLine: chartMode === 'pxt' ? d.pxt : d.pxtPerMinute }));
  }, [player, allActions, filteredMatchesBySeason, selectedMatchIds, chartMode, chartCategory, selectedPlayerForView, playerId]);

  // Funkcja pomocnicza do konwersji strefy na nazwę (używana w wielu miejscach)
  const convertZoneToNameHelper = (zone: string | number | undefined): string | null => {
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

  // Oblicz statystyki zawodnika
  const playerStats = useMemo(() => {
    if (!player) return null;
    
    // Użyj selectedPlayerForView jeśli jest ustawiony, w przeciwnym razie player.id
    const targetPlayerId = selectedPlayerForView || player.id;

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
    // Statystyki regainów - xT w ataku i obronie
    let regainXTInAttack = 0; // Suma oppositeXT dla akcji w ataku
    let regainXTInDefense = 0; // Suma xTValueStart/xTValueEnd dla akcji w obronie
    let regainAttackCount = 0; // Liczba akcji w ataku
    let regainDefenseCount = 0; // Liczba akcji w obronie
    // Liczniki regainów według stref
    let regainP0Count = 0;
    let regainP1Count = 0;
    let regainP2Count = 0;
    let regainP3Count = 0;
    // Liczniki regainów według stref - boczne
    let regainP0CountLateral = 0;
    let regainP1CountLateral = 0;
    let regainP2CountLateral = 0;
    let regainP3CountLateral = 0;
    // Liczniki regainów według stref - centralne
    let regainP0CountCentral = 0;
    let regainP1CountCentral = 0;
    let regainP2CountCentral = 0;
    let regainP3CountCentral = 0;
    // Średnia różnica zawodników w ataku (partnerzy za piłką - przeciwnicy za piłką)
    let totalAttackPlayerDifference = 0; // Suma różnic dla akcji w ataku
    let totalAttackPlayersBehind = 0; // Suma partnerów za piłką dla akcji w ataku
    let totalAttackPlayersBefore = 0; // Suma partnerów przed piłką dla akcji w ataku
    let totalAttackOpponentsBehind = 0; // Suma przeciwników za piłką dla akcji w ataku
    // Średnia różnica zawodników w obronie (zawodnicy za piłką - przeciwnicy przed piłką, uwzględniając zawodników na boisku)
    let totalDefensePlayerDifference = 0; // Suma różnic dla akcji w obronie
    let totalDefensePlayersUnderBall = 0; // Suma partnerów pod piłką dla akcji w obronie
    let totalDefenseOpponentsUnderBall = 0; // Suma przeciwników pod piłką dla akcji w obronie
    // Całkowita różnica zawodników przed piłką dla wszystkich akcji regainów (niezależnie od trybu)
    // Wzór: (liczba zawodników przed piłką - liczba przeciwników za piłką)
    let totalOverallPlayerDifference = 0; // Suma różnic dla wszystkich akcji regainów
    let totalOverallPlayersBefore = 0; // Suma naszych zawodników przed piłką
    let totalOverallOpponentsBehind = 0; // Suma przeciwników za piłką
    
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
      matchIds: Set<string>; // Dodajemy matchIds dla każdej pozycji
    }>();
    
    // Funkcja do pobrania pozycji zawodnika w meczu
    const getPlayerPositionInMatch = (matchId: string, targetId: string): string | null => {
      const match = filteredMatchesBySeason.find(m => m.matchId === matchId);
      if (!match || !match.playerMinutes) return null;
      const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === targetId);
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
    // Drybling: from (z której strefy) i to (do której strefy)
    const dribblerFromHeatmap = new Map<string, number>();
    const dribblerToHeatmap = new Map<string, number>();
    const dribblerHeatmap = new Map<string, number>(); // Backward compatibility - używa from
    
    // Heatmapy liczby akcji dla każdej kategorii - Map<zoneName, count>
    const senderFromActionCountHeatmap = new Map<string, number>();
    const senderToActionCountHeatmap = new Map<string, number>();
    const receiverToActionCountHeatmap = new Map<string, number>();
    const receiverFromActionCountHeatmap = new Map<string, number>();
    const dribblerFromActionCountHeatmap = new Map<string, number>();
    const dribblerToActionCountHeatmap = new Map<string, number>();
    const dribblerActionCountHeatmap = new Map<string, number>(); // Backward compatibility - używa from
    // Regainy: from (z której strefy odzyskiwał piłkę)
    const regainHeatmap = new Map<string, number>(); // xT odbiorców (xTValueEnd)
    const regainActionCountHeatmap = new Map<string, number>(); // Liczba akcji (wszystkie)
    const regainAttackHeatmap = new Map<string, number>(); // xT w ataku (opposite xT dla regainów w ataku) - klucz to opposite strefa
    const regainDefenseHeatmap = new Map<string, number>(); // xT w obronie (opposite xT dla regainów w obronie) - klucz to opposite strefa
    const regainAttackCountHeatmap = new Map<string, number>(); // Liczba akcji w ataku - klucz to opposite strefa
    const regainDefenseCountHeatmap = new Map<string, number>(); // Liczba akcji w obronie - klucz to fromZone/startZone
    const regainZoneStats = new Map<string, Action[]>(); // Lista akcji regainów dla każdej strefy
    
    // Funkcja pomocnicza do konwersji strefy na opposite strefę (nazwę)
    const getOppositeZoneName = (zoneName: string): string | null => {
      const zoneIndex = zoneNameToIndex(zoneName);
      if (zoneIndex === null) return null;
      
      // Oblicz opposite indeks
      const row = Math.floor(zoneIndex / 12);
      const col = zoneIndex % 12;
      const oppositeRow = 7 - row;
      const oppositeCol = 11 - col;
      const oppositeIndex = oppositeRow * 12 + oppositeCol;
      
      // Konwertuj na nazwę strefy
      const oppositeZoneName = getZoneName(oppositeIndex);
      return oppositeZoneName ? zoneNameToString(oppositeZoneName) : null;
    };
    // Loses: from (z której strefy tracił piłkę)
    const losesHeatmap = new Map<string, number>();
    const losesActionCountHeatmap = new Map<string, number>();
    
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
    
    // Statystyki partnerów - top 5 podających/przyjmujących
    // Map<playerId, { passes: number, pxt: number }>
    const partnerStatsAsSender = new Map<string, { passes: number; pxt: number }>(); // Do kogo zawodnik podaje
    const partnerStatsAsReceiver = new Map<string, { passes: number; pxt: number }>(); // Od kogo zawodnik otrzymuje

    // Funkcja pomocnicza do konwersji strefy na format "A1" - używana w obu pętlach
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

    // PIERWSZA PĘTLA: Oblicz liczniki i podstawowe statystyki dla WSZYSTKICH akcji (bez filtrowania)
    // Liczniki powinny pokazywać wszystkie akcje danego typu, niezależnie od filtra
    
    // Filtruj tylko regainy dla tego zawodnika
    // Używamy _actionSource jeśli jest dostępne, w przeciwnym razie używamy logiki polowej
    const regainActionsForPlayer = filteredActions.filter((action: any) => {
      // Jeśli akcja ma _actionSource, użyj tego (najbardziej niezawodne)
      if (action._actionSource) {
        return action._actionSource === 'regain' && action.senderId === targetPlayerId;
      }
      
      // Fallback: sprawdź pola akcji
      // Regain: ma playersBehindBall/opponentsBehindBall i NIE MA isReaction5s
      // Loses: ma isReaction5s LUB ma isBelow8s ale NIE MA playersBehindBall/opponentsBehindBall
      const hasRegainFields = action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined;
      const isLoses = action.isReaction5s !== undefined || 
                     (action.isBelow8s !== undefined && 
                      action.playersBehindBall === undefined && 
                      action.opponentsBehindBall === undefined);
      
      return hasRegainFields && 
             !isLoses && 
             action.senderId === targetPlayerId;
    });
    
    // Console log wszystkich regainów dla zawodnika
    console.log(`🔍 Regainy dla zawodnika ${targetPlayerId}:`, regainActionsForPlayer);
    console.log(`📊 Liczba regainów: ${regainActionsForPlayer.length}`);
    regainActionsForPlayer.forEach((regain, index) => {
      console.log(`\n📋 Regain ${index + 1}:`, {
        id: regain.id,
        matchId: regain.matchId,
        minute: regain.minute,
        // Nowe pola dla regain
        regainDefenseZone: regain.regainDefenseZone || regain.fromZone || regain.toZone || regain.startZone,
        regainAttackZone: regain.regainAttackZone || regain.oppositeZone,
        regainDefenseXT: regain.regainDefenseXT || regain.xTValueStart || regain.xTValueEnd,
        regainAttackXT: regain.regainAttackXT || regain.oppositeXT,
        // Stare pola dla backward compatibility
        fromZone: regain.fromZone,
        startZone: regain.startZone,
        toZone: regain.toZone,
        endZone: regain.endZone,
        senderId: regain.senderId,
        senderName: regain.senderName,
        receiverId: regain.receiverId,
        receiverName: regain.receiverName,
        xTValueStart: regain.xTValueStart,
        xTValueEnd: regain.xTValueEnd,
        // Wartości opposite (po przekątnej) - deprecated
        oppositeXT: regain.oppositeXT,
        oppositeZone: regain.oppositeZone,
        isAttack: regain.isAttack,
        // Obliczenia dla debugowania
        calculatedIsAttack: (regain.regainDefenseXT || regain.xTValueEnd) !== undefined ? ((regain.regainDefenseXT || regain.xTValueEnd || 0) < 0.02) : undefined,
        isBelow8s: regain.isBelow8s,
        playersBehindBall: regain.playersBehindBall,
        opponentsBehindBall: regain.opponentsBehindBall,
        totalPlayersOnField: regain.totalPlayersOnField,
        totalOpponentsOnField: regain.totalOpponentsOnField,
        playersLeftField: regain.playersLeftField,
        opponentsLeftField: regain.opponentsLeftField,
        actionType: regain.actionType,
        isSecondHalf: regain.isSecondHalf,
        videoTimestamp: regain.videoTimestamp
      });
    });
    
    filteredActions.forEach((action) => {
      // PxT i xT
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const packingPoints = action.packingPoints || 0;
      const pxtValue = xTDifference * packingPoints;

      // PxT jako podający (sender) - tylko dla podań
      if (action.senderId === targetPlayerId && action.actionType === 'pass') {
        pxtAsSender += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        senderActionsCount += 1;
        senderPassCount += 1;
        // Strefa źródłowa (z której podawał)
        const fromZoneName = convertZoneToName(action.fromZone || action.startZone);
        // Strefa docelowa (do której podawał)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        
        // Breakdown PxT jako podający według typu akcji
        // Użyj tej samej strefy co heatmapa - jeśli heatmapDirection === 'from', użyj strefy źródłowej, w przeciwnym razie docelowej
        const zoneForBreakdown = heatmapDirection === 'from' 
          ? fromZoneName
          : toZoneName;
        
        // Licz tylko akcje, które mają strefę (tak jak heatmapa)
        if (zoneForBreakdown) {
          const senderIsLateral = isLateralZone(zoneForBreakdown);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            pxtSenderFromPK += pxtValue;
            senderPKCount += 1;
            if (senderIsLateral) senderPKCountLateral += 1;
            else senderPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            pxtSenderFromShot += pxtValue;
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
          if (action.isP3 || action.isP3Start) {
            pxtSenderFromP3 += pxtValue;
            senderP3Count += 1;
            if (senderIsLateral) senderP3CountLateral += 1;
            else senderP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            pxtSenderFromP2 += pxtValue;
            senderP2Count += 1;
            if (senderIsLateral) senderP2CountLateral += 1;
            else senderP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
            pxtSenderFromP1 += pxtValue;
            senderP1Count += 1;
            if (senderIsLateral) senderP1CountLateral += 1;
            else senderP1CountCentral += 1;
          }
          
          // Inne akcje (które nie są PK, strzałem, P1, P2, P3)
          if (!action.isPenaltyAreaEntry && !action.isShot && !(action.isP3 || action.isP3Start) && !(action.isP2 || action.isP2Start) && !(action.isP1 || action.isP1Start)) {
            pxtSenderFromOther += pxtValue;
          }
        }
      }

      // PxT jako przyjmujący (receiver) - tylko dla podań
      if (action.receiverId === targetPlayerId && action.actionType === 'pass') {
        pxtAsReceiver += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        receiverActionsCount += 1;
        receiverPassCount += 1;
        
        // Strefa docelowa (do której przyjmował)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        // Strefa źródłowa (z której były podania do niego)
        const fromZoneName = convertZoneToName(action.fromZone ?? action.startZone ?? undefined);
        
        // Breakdown PxT jako przyjmujący według typu akcji
        const zoneForBreakdown = heatmapDirection === 'to' 
          ? toZoneName
          : fromZoneName;
        
        if (zoneForBreakdown) {
          const receiverIsLateral = isLateralZone(zoneForBreakdown);

          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            pxtReceiverFromPK += pxtValue;
            receiverPKCount += 1;
            if (receiverIsLateral) receiverPKCountLateral += 1;
            else receiverPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            pxtReceiverFromShot += pxtValue;
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
          if (action.isP3 || action.isP3Start) {
            pxtReceiverFromP3 += pxtValue;
            receiverP3Count += 1;
            if (receiverIsLateral) receiverP3CountLateral += 1;
            else receiverP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            pxtReceiverFromP2 += pxtValue;
            receiverP2Count += 1;
            if (receiverIsLateral) receiverP2CountLateral += 1;
            else receiverP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
            pxtReceiverFromP1 += pxtValue;
            receiverP1Count += 1;
            if (receiverIsLateral) receiverP1CountLateral += 1;
            else receiverP1CountCentral += 1;
          }
          
          // Inne akcje (które nie są PK, strzałem, P1, P2, P3)
          if (!action.isPenaltyAreaEntry && !action.isShot && !(action.isP3 || action.isP3Start) && !(action.isP2 || action.isP2Start) && !(action.isP1 || action.isP1Start)) {
            pxtReceiverFromOther += pxtValue;
          }
        }
      }

      // PxT z dryblingu
      if (action.senderId === targetPlayerId && action.actionType === 'dribble') {
        pxtAsDribbler += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        dribblingActionsCount += 1;
        // Strefa źródłowa (z której dryblował)
        const fromZoneName = convertZoneToName(action.fromZone ?? action.startZone ?? undefined);
        // Strefa docelowa (do której dryblował)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        
        // Sprawdź czy strefa jest boczna czy centralna - użyj tej samej strefy co heatmapa
        const zoneForBreakdown = heatmapDirection === 'from' 
          ? fromZoneName
          : toZoneName;
        const dribblingIsLateral = isLateralZone(zoneForBreakdown);

        // Breakdown PxT z dryblingu według typu akcji z podziałem na strefy boczne/centralne
        if (zoneForBreakdown) {
          // PK może być jednocześnie strzałem, więc sprawdzamy oba warunki niezależnie
          if (action.isPenaltyAreaEntry) {
            pxtDribblingFromPK += pxtValue;
            dribblingPKCount += 1;
            if (dribblingIsLateral) dribblingPKCountLateral += 1;
            else dribblingPKCountCentral += 1;
          }
          
          // Strzał może być jednocześnie PK, więc sprawdzamy niezależnie
          if (action.isShot) {
            pxtDribblingFromShot += pxtValue;
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
          if (action.isP3 || action.isP3Start) {
            pxtDribblingFromP3 += pxtValue;
            dribblingP3Count += 1;
            if (dribblingIsLateral) dribblingP3CountLateral += 1;
            else dribblingP3CountCentral += 1;
          }
          if (action.isP2 || action.isP2Start) {
            pxtDribblingFromP2 += pxtValue;
            dribblingP2Count += 1;
            if (dribblingIsLateral) dribblingP2CountLateral += 1;
            else dribblingP2CountCentral += 1;
          }
          if (action.isP1 || action.isP1Start) {
            pxtDribblingFromP1 += pxtValue;
            dribblingP1Count += 1;
            if (dribblingIsLateral) dribblingP1CountLateral += 1;
            else dribblingP1CountCentral += 1;
          }
          
          // Inne akcje (które nie są PK, strzałem, P1, P2, P3)
          if (!action.isPenaltyAreaEntry && !action.isShot && !(action.isP3 || action.isP3Start) && !(action.isP2 || action.isP2Start) && !(action.isP1 || action.isP1Start)) {
            pxtDribblingFromOther += pxtValue;
          }
        }
      }
    });

    // DRUGA PĘTLA: Wypełnij heatmapę i statystyki partnerów (z filtrowaniem)
    filteredActions.forEach((action) => {
      // Filtruj akcje według wybranego typu akcji (P1, P2, P3, PK, Strzał, Gol)
      // Filtr wpływa tylko na heatmapę, nie na liczniki (które są już obliczone powyżej)
      if (selectedActionFilter) {
        // Użyj tej samej logiki co w licznikach - sprawdź isP1, isP2, isP3, isP1Start, isP2Start, isP3Start
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

      // PxT i xT
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const packingPoints = action.packingPoints || 0;
      const pxtValue = xTDifference * packingPoints;

      // PxT jako podający (sender) - tylko dla podań
      // Podstawowe statystyki (pxtAsSender, totalPxT, etc.) są już obliczone w pierwszej pętli
      if (action.senderId === targetPlayerId && action.actionType === 'pass') {

        // Strefa źródłowa (z której podawał)
        const fromZoneName = convertZoneToName(action.fromZone || action.startZone);
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'from' (aby zgadzało się z licznikami)
        if (fromZoneName && heatmapDirection === 'from') {
          const currentValue = senderFromHeatmap.get(fromZoneName) || 0;
          senderFromHeatmap.set(fromZoneName, currentValue + pxtValue);
          const currentCount = senderFromActionCountHeatmap.get(fromZoneName) || 0;
          senderFromActionCountHeatmap.set(fromZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który przyjmował podania z tej strefy
          if (action.receiverId) {
            // Statystyki partnerów - jako podający
            if (!partnerStatsAsSender.has(action.receiverId)) {
              partnerStatsAsSender.set(action.receiverId, { passes: 0, pxt: 0 });
            }
            const partnerStats = partnerStatsAsSender.get(action.receiverId)!;
            partnerStats.passes += 1;
            partnerStats.pxt += pxtValue;
            
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
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'to' (aby zgadzało się z licznikami)
        if (toZoneName && heatmapDirection === 'to') {
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
        const position = getPlayerPositionInMatch(action.matchId || '', targetPlayerId);
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
              matchIds: new Set<string>(),
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsSender += pxtValue;
          posStats.senderActionsCount += 1;
          posStats.senderPassCount += 1;
          if (action.matchId) {
            posStats.matchIds.add(action.matchId);
          }
        }

        // Liczniki są już obliczone w pierwszej pętli - tutaj tylko wypełniamy heatmapę i statystyki partnerów
      }

      // PxT jako przyjmujący (receiver) - tylko dla podań
      if (action.receiverId === targetPlayerId && action.actionType === 'pass') {
        pxtAsReceiver += pxtValue;
        totalPxT += pxtValue;
        totalXT += xTDifference;
        receiverActionsCount += 1;
        receiverPassCount += 1;

        // Strefa docelowa (do której przyjmował)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'to' (aby zgadzało się z licznikami)
        if (toZoneName && heatmapDirection === 'to') {
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
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'from' (aby zgadzało się z licznikami)
        if (fromZoneName && heatmapDirection === 'from') {
          const currentValue = receiverFromHeatmap.get(fromZoneName) || 0;
          receiverFromHeatmap.set(fromZoneName, currentValue + pxtValue);
          const currentCount = receiverFromActionCountHeatmap.get(fromZoneName) || 0;
          receiverFromActionCountHeatmap.set(fromZoneName, currentCount + 1);
          
          // Zbierz statystyki o zawodniku, który podawał z tej strefy
          if (action.senderId) {
            // Statystyki partnerów - jako przyjmujący
            if (!partnerStatsAsReceiver.has(action.senderId)) {
              partnerStatsAsReceiver.set(action.senderId, { passes: 0, pxt: 0 });
            }
            const partnerStats = partnerStatsAsReceiver.get(action.senderId)!;
            partnerStats.passes += 1;
            partnerStats.pxt += pxtValue;
            
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
        const position = getPlayerPositionInMatch(action.matchId || '', targetPlayerId);
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
              matchIds: new Set<string>(),
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsReceiver += pxtValue;
          posStats.receiverActionsCount += 1;
          posStats.receiverPassCount += 1;
          if (action.matchId) {
            posStats.matchIds.add(action.matchId);
          }
        }

        // Liczniki są już obliczone w pierwszej pętli - tutaj tylko wypełniamy heatmapę i statystyki partnerów
      }

      // PxT z dryblingu (dribble)
      // Podstawowe statystyki (pxtAsDribbler, totalPxT, etc.) są już obliczone w pierwszej pętli
      if ((action.senderId === targetPlayerId) && action.actionType === 'dribble') {

        // Strefa źródłowa (z której dryblował)
        const fromZoneName = convertZoneToName(action.fromZone ?? action.startZone ?? undefined);
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'from' (aby zgadzało się z licznikami)
        if (fromZoneName && heatmapDirection === 'from') {
          const currentValue = dribblerFromHeatmap.get(fromZoneName) || 0;
          dribblerFromHeatmap.set(fromZoneName, currentValue + pxtValue);
          const currentCount = dribblerFromActionCountHeatmap.get(fromZoneName) || 0;
          dribblerFromActionCountHeatmap.set(fromZoneName, currentCount + 1);
        }

        // Strefa docelowa (do której dryblował)
        const toZoneName = convertZoneToName(action.toZone ?? action.endZone ?? undefined);
        // Wypełnij heatmapę tylko jeśli heatmapDirection === 'to' (aby zgadzało się z licznikami)
        if (toZoneName && heatmapDirection === 'to') {
          const currentValue = dribblerToHeatmap.get(toZoneName) || 0;
          dribblerToHeatmap.set(toZoneName, currentValue + pxtValue);
          const currentCount = dribblerToActionCountHeatmap.get(toZoneName) || 0;
          dribblerToActionCountHeatmap.set(toZoneName, currentCount + 1);
        }

        // Użyj strefy źródłowej dla głównej heatmapy (backward compatibility)
        const zoneName = fromZoneName;
        if (zoneName) {
          const currentValue = dribblerHeatmap.get(zoneName) || 0;
          dribblerHeatmap.set(zoneName, currentValue + pxtValue);
          const currentCount = dribblerActionCountHeatmap.get(zoneName) || 0;
          dribblerActionCountHeatmap.set(zoneName, currentCount + 1);
        }

        // Statystyki według pozycji
        const position = getPlayerPositionInMatch(action.matchId || '', targetPlayerId);
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
              matchIds: new Set<string>(),
            });
          }
          const posStats = positionStatsMap.get(position)!;
          posStats.pxtAsDribbler += pxtValue;
          posStats.dribblingActionsCount += 1;
          posStats.dribblingCount += 1;
          if (action.matchId) {
            posStats.matchIds.add(action.matchId);
          }
        }

        // Liczniki są już obliczone w pierwszej pętli - tutaj tylko wypełniamy heatmapę
      }

      // xG będzie obliczane z osobnej kolekcji shots

      // Regainy - oblicz heatmapę
      // Używamy _actionSource jeśli jest dostępne, w przeciwnym razie używamy logiki polowej
      const isRegainAction = (action: any) => {
        // Jeśli akcja ma _actionSource, użyj tego (najbardziej niezawodne)
        if (action._actionSource) {
          return action._actionSource === 'regain';
        }
        
        // Fallback: sprawdź pola akcji
        // Regain: ma playersBehindBall/opponentsBehindBall i NIE MA isReaction5s
        // Loses: ma isReaction5s LUB ma isBelow8s ale NIE MA playersBehindBall/opponentsBehindBall
        const hasRegainFields = action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined;
        const isLoses = action.isReaction5s !== undefined || 
                       (action.isBelow8s !== undefined && 
                        action.playersBehindBall === undefined && 
                        action.opponentsBehindBall === undefined);
        
        return hasRegainFields && !isLoses;
      };
      
      if (
        isRegainAction(action) &&
        action.senderId === targetPlayerId
      ) {
        totalRegains += 1;
        
        // Strefa, w której zawodnik odzyskał piłkę - używamy nowych pól
        const regainDefenseZone = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
        const regainZoneName = convertZoneToName(regainDefenseZone);
        
        if (regainZoneName) {
          // Liczba akcji
          const currentCount = regainActionCountHeatmap.get(regainZoneName) || 0;
          regainActionCountHeatmap.set(regainZoneName, currentCount + 1);
          
          // xT odbiorców - dla regain używamy regainDefenseXT (wartość w obronie)
          const receiverXT = action.regainDefenseXT !== undefined 
            ? action.regainDefenseXT 
            : (action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0));
          const currentXT = regainHeatmap.get(regainZoneName) || 0;
          regainHeatmap.set(regainZoneName, currentXT + receiverXT);
          
          // Wartość xT w obronie - używamy regainDefenseXT (nowe pole) lub starych pól dla backward compatibility
          const defenseXT = action.regainDefenseXT !== undefined 
            ? action.regainDefenseXT 
            : (action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0));
          
          // Wartość xT w ataku - używamy regainAttackXT (nowe pole) lub starych pól dla backward compatibility
          const oppositeXT = action.regainAttackXT !== undefined 
            ? action.regainAttackXT 
            : (action.oppositeXT !== undefined 
              ? action.oppositeXT 
              : (() => {
                  // Oblicz dynamicznie jeśli nie ma w obiekcie (dla starych akcji)
                  const zoneIndex = zoneNameToIndex(regainZoneName);
                  return zoneIndex !== null ? getOppositeXTValueForZone(zoneIndex) : 0;
                })());
          
          // Strefa ataku - używamy nowych pól
          const regainAttackZone = action.regainAttackZone || action.oppositeZone;
          const oppositeZoneName = regainAttackZone 
            ? convertZoneToName(regainAttackZone)
            : getOppositeZoneName(regainZoneName);
          
          const isAttack = action.isAttack !== undefined 
            ? action.isAttack 
            : (receiverXT < 0.02); // xT < 0.02 to atak
          
          // Zbierz statystyki xT w ataku i obronie
          // WAŻNE: Dla regainów zawsze dodajemy do obu statystyk (atak i obrona), bo każda akcja ma obie wartości
          // - defenseXT to wartość w obronie (xTValueStart/xTValueEnd)
          // - oppositeXT to wartość w ataku (opposite xT)
          
          // Zawsze dodajemy wartość w obronie (defenseXT)
          regainXTInDefense += defenseXT;
          regainDefenseCount += 1;
          
          // Zawsze dodajemy wartość w ataku (oppositeXT)
          regainXTInAttack += oppositeXT;
          regainAttackCount += 1;
          
          // Różnica zawodników dla akcji w ataku i obronie
          // Używamy totalPlayersOnField i totalOpponentsOnField (które mają wartość 11), od tego odejmujemy bramkarzy (1)
          const playersOnField = action.totalPlayersOnField !== undefined 
            ? action.totalPlayersOnField - 1 // Odejmujemy bramkarza
            : (11 - 1 - (action.playersLeftField || 0)); // Fallback: 11 - 1 (bramkarz) - opuścili boisko
          const opponentsOnField = action.totalOpponentsOnField !== undefined 
            ? action.totalOpponentsOnField - 1 // Odejmujemy bramkarza
            : (11 - 1 - (action.opponentsLeftField || 0)); // Fallback: 11 - 1 (bramkarz) - opuścili boisko
          const opponentsBehind = action.opponentsBehindBall || 0;
          const playersBehind = action.playersBehindBall || 0;
          
          // Różnica dla ataku: partnerzy przed piłką - przeciwnicy za piłką
          // Obliczamy tylko dla akcji w ataku (isAttack === true)
          if (isAttack) {
            const playersBeforeBall = playersOnField - playersBehind; // Zawodnicy przed piłką
            totalAttackPlayerDifference += (playersBeforeBall - opponentsBehind);
            totalAttackPlayersBehind += playersBehind;
            totalAttackPlayersBefore += playersBeforeBall;
            totalAttackOpponentsBehind += opponentsBehind;
          }
          
          // Różnica dla obrony: obliczamy dla WSZYSTKICH akcji regainów (niezależnie od isAttack)
          // 1. Zawodnicy pod piłką (nasz zespół) = (totalPlayersOnField - 1) - playersBehindBall
          // 2. Przeciwnicy pod piłką = (totalOpponentsOnField - 1) - opponentsBehindBall
          // 3. Różnica = partnerzy pod piłką - przeciwnicy pod piłką
          const playersUnderBall = playersOnField - playersBehind; // Zawodnicy pod piłką (na boisku bez bramkarza - za piłką)
          const opponentsUnderBall = opponentsOnField - opponentsBehind; // Przeciwnicy pod piłką (na boisku bez bramkarza - za piłką)
          totalDefensePlayerDifference += (playersUnderBall - opponentsUnderBall);
          totalDefensePlayersUnderBall += playersUnderBall;
          totalDefenseOpponentsUnderBall += opponentsUnderBall;
          
          // Całkowita różnica zawodników przed piłką dla wszystkich akcji regainów (niezależnie od trybu)
          // Wzór: (liczba zawodników przed piłką - liczba przeciwników za piłką)
          const playersBeforeBall = playersOnField - playersBehind; // Zawodnicy przed piłką
          const playerDifference = playersBeforeBall - opponentsBehind; // Różnica: nasi przed piłką - przeciwnicy za piłką
          totalOverallPlayerDifference += playerDifference;
          totalOverallPlayersBefore += playersBeforeBall;
          totalOverallOpponentsBehind += opponentsBehind;
          
          // Dla "W ataku" i "W obronie":
          // - "W obronie": klucz to fromZone/startZone, wartość to xTValueStart/xTValueEnd (wartość w obronie)
          // - "W ataku": klucz to oppositeZone, wartość to oppositeXT (wartość w ataku)
          // Zawsze dodajemy do obu heatmap, niezależnie od isAttack
          // "W ataku" - pokazuje oppositeXT na oppositeZone (lustrzane odbicie)
          if (oppositeZoneName) {
            const currentAttackXT = regainAttackHeatmap.get(oppositeZoneName) || 0;
            regainAttackHeatmap.set(oppositeZoneName, currentAttackXT + oppositeXT);
            // Liczba akcji w ataku - zawsze dodajemy (wszystkie akcje mają opposite strefę)
            const currentAttackCount = regainAttackCountHeatmap.get(oppositeZoneName) || 0;
            regainAttackCountHeatmap.set(oppositeZoneName, currentAttackCount + 1);
          }
          
          // "W obronie" - pokazuje xTValueStart/xTValueEnd na fromZone/startZone
          if (regainZoneName) {
            const currentDefenseXT = regainDefenseHeatmap.get(regainZoneName) || 0;
            regainDefenseHeatmap.set(regainZoneName, currentDefenseXT + defenseXT);
            // Liczba akcji w obronie - zawsze dodajemy (wszystkie akcje mają fromZone/startZone)
            const currentDefenseCount = regainDefenseCountHeatmap.get(regainZoneName) || 0;
            regainDefenseCountHeatmap.set(regainZoneName, currentDefenseCount + 1);
          }
          
          // Zbierz akcje dla tej strefy
          if (!regainZoneStats.has(regainZoneName)) {
            regainZoneStats.set(regainZoneName, []);
          }
          regainZoneStats.get(regainZoneName)!.push(action);
          
          // Liczniki według stref (P0, P1, P2, P3)
          const isLateral = isLateralZone(regainZoneName);
          
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
        
        // Statystyki według pozycji
        const position = getPlayerPositionInMatch(action.matchId || '', targetPlayerId);
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
              matchIds: new Set<string>(),
            });
          }
          const posStats = positionStatsMap.get(position)!;
          // Dodajemy regain do statystyk pozycji - użyjemy specjalnego pola
          if (!posStats.hasOwnProperty('regainsCount')) {
            (posStats as any).regainsCount = 0;
          }
          (posStats as any).regainsCount += 1;
          if (action.matchId) {
            posStats.matchIds.add(action.matchId);
          }
        }
      }

      // Straty
      if (
        (action.isReaction5s !== undefined ||
         (action.isBelow8s !== undefined &&
          action.playersBehindBall === undefined &&
          action.opponentsBehindBall === undefined)) &&
        action.senderId === targetPlayerId
      ) {
        totalLoses += 1;
      }

      // Wejścia w PK
      if (action.isPenaltyAreaEntry && (action.senderId === targetPlayerId || action.receiverId === targetPlayerId)) {
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
          matchIds: new Set<string>(),
        });
      }
      const posStats = positionStatsMap.get(position)!;
      posStats.minutes = minutes;
      // Dodaj matchIds dla tej pozycji z meczów, gdzie zawodnik grał w tej pozycji
      filteredMatchesBySeason.forEach(match => {
        if (selectedMatchIds.length > 0 && !selectedMatchIds.includes(match.matchId || "")) return;
        const playerMinute = match.playerMinutes?.find((pm: any) => pm.playerId === targetPlayerId && pm.position === position);
        if (playerMinute && match.matchId) {
          posStats.matchIds.add(match.matchId);
        }
      });
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
      matchIds: Set<string>;
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
      matchIds: Set<string>;
    } } = {};
    
    positionStatsMap.forEach((stats, position) => {
      const posPer90Multiplier = stats.minutes > 0 ? 90 / stats.minutes : 0;
      const regainsCount = (stats as any).regainsCount || 0;
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
        regainsCount: regainsCount,
        regainsPer90: regainsCount * posPer90Multiplier,
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
      // Statystyki regainów - xT w ataku i obronie
      regainXTInAttack,
      regainXTInDefense,
      regainAttackCount,
      regainDefenseCount,
      regainAverageAttackPlayerDifference: regainAttackCount > 0 ? totalAttackPlayerDifference / regainAttackCount : 0,
      regainAverageAttackPlayersBehind: regainAttackCount > 0 ? totalAttackPlayersBehind / regainAttackCount : 0,
      regainAverageAttackPlayersBefore: regainAttackCount > 0 ? totalAttackPlayersBefore / regainAttackCount : 0,
      regainAverageAttackOpponentsBehind: regainAttackCount > 0 ? totalAttackOpponentsBehind / regainAttackCount : 0,
      regainAverageDefensePlayerDifference: regainDefenseCount > 0 ? totalDefensePlayerDifference / regainDefenseCount : 0,
      regainAverageDefensePlayersUnderBall: regainDefenseCount > 0 ? totalDefensePlayersUnderBall / regainDefenseCount : 0,
      regainAverageDefenseOpponentsUnderBall: regainDefenseCount > 0 ? totalDefenseOpponentsUnderBall / regainDefenseCount : 0,
      // Całkowita średnia różnica zawodników przed piłką dla wszystkich akcji regainów (niezależnie od trybu)
      // Wzór: (liczba zawodników przed piłką - liczba zawodników przed piłką przeciwnika)
      regainAverageOverallPlayerDifference: totalRegains > 0 ? totalOverallPlayerDifference / totalRegains : 0,
      regainAverageOverallPlayersBefore: totalRegains > 0 ? totalOverallPlayersBefore / totalRegains : 0,
      regainAverageOverallOpponentsBehind: totalRegains > 0 ? totalOverallOpponentsBehind / totalRegains : 0,
      // Liczniki regainów według stref
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
      dribblerFromHeatmap: new Map(dribblerFromHeatmap),
      dribblerToHeatmap: new Map(dribblerToHeatmap),
      dribblerHeatmap: new Map(dribblerHeatmap), // Backward compatibility
      // Heatmapy liczby akcji - Podający
      senderFromActionCountHeatmap: new Map(senderFromActionCountHeatmap),
      senderToActionCountHeatmap: new Map(senderToActionCountHeatmap),
      // Heatmapy liczby akcji - Przyjmujący
      receiverToActionCountHeatmap: new Map(receiverToActionCountHeatmap),
      receiverFromActionCountHeatmap: new Map(receiverFromActionCountHeatmap),
      // Heatmapy liczby akcji - Drybling
      dribblerFromActionCountHeatmap: new Map(dribblerFromActionCountHeatmap),
      dribblerToActionCountHeatmap: new Map(dribblerToActionCountHeatmap),
      dribblerActionCountHeatmap: new Map(dribblerActionCountHeatmap), // Backward compatibility
      // Heatmapy - Regainy
      regainHeatmap: new Map(regainHeatmap),
      regainActionCountHeatmap: new Map(regainActionCountHeatmap),
      regainAttackHeatmap: new Map(regainAttackHeatmap),
      regainDefenseHeatmap: new Map(regainDefenseHeatmap),
      regainAttackCountHeatmap: new Map(regainAttackCountHeatmap),
      regainDefenseCountHeatmap: new Map(regainDefenseCountHeatmap),
      regainZoneStats: new Map(Array.from(regainZoneStats.entries()).map(([zone, actions]) => [zone, [...actions]])),
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
      // Statystyki partnerów
      partnerStatsAsSender: new Map(partnerStatsAsSender),
      partnerStatsAsReceiver: new Map(partnerStatsAsReceiver),
    };
  }, [player, allActions, filteredMatchesBySeason, selectedMatchIds, totalMinutes, positionMinutes, selectedPlayerForView, selectedActionFilter, heatmapDirection]);

  // Oblicz ranking w zespole dla statystyk zawodnika
  const teamRanking = useMemo(() => {
    if (!playerStats || !selectedTeam || filteredPlayers.length === 0) return null;
    
    const targetPlayerId = selectedPlayerForView || playerId;
    
    // Oblicz statystyki dla wszystkich zawodników w zespole
    const teamPlayerStats = filteredPlayers.map(teamPlayer => {
      // Oblicz minuty dla zawodnika
      let playerMinutes = 0;
      filteredMatchesBySeason.forEach(match => {
        if (selectedMatchIds.length > 0 && !selectedMatchIds.includes(match.matchId || "")) return;
        const playerMinute = match.playerMinutes?.find((pm: any) => pm.playerId === teamPlayer.id);
        if (playerMinute) {
          playerMinutes += Math.max(0, playerMinute.endMinute - playerMinute.startMinute);
        }
      });
      
      const per90Multiplier = playerMinutes > 0 ? 90 / playerMinutes : 0;
      
      if (teamPlayer.id === targetPlayerId) {
        return {
          playerId: teamPlayer.id,
          pxtAsSender: playerStats.pxtAsSender,
          pxtSenderPer90: playerStats.pxtSenderPer90,
          senderActionsPer90: playerStats.senderActionsPer90,
          pxtSenderPerAction: playerStats.pxtSenderPerAction,
          pxtAsReceiver: playerStats.pxtAsReceiver,
          pxtReceiverPer90: playerStats.pxtReceiverPer90,
          receiverActionsPer90: playerStats.receiverActionsPer90,
          pxtReceiverPerAction: playerStats.pxtReceiverPerAction,
          pxtAsDribbler: playerStats.pxtAsDribbler,
          pxtDribblingPer90: playerStats.pxtDribblingPer90,
          dribblingActionsPer90: playerStats.dribblingActionsPer90,
          pxtDribblingPerAction: playerStats.pxtDribblingPerAction,
          totalRegains: playerStats.totalRegains,
          regainsPer90: playerStats.regainsPer90,
          regainXTInAttack: playerStats.regainXTInAttack || 0,
          regainXTInDefense: playerStats.regainXTInDefense || 0,
          regainXTInAttackPer90: (playerStats.regainXTInAttack || 0) * per90Multiplier,
          regainXTInDefensePer90: (playerStats.regainXTInDefense || 0) * per90Multiplier,
          regainXTInAttackPerAction: (playerStats.regainAttackCount || 0) > 0 ? (playerStats.regainXTInAttack || 0) / (playerStats.regainAttackCount || 1) : 0,
          regainXTInDefensePerAction: (playerStats.regainDefenseCount || 0) > 0 ? (playerStats.regainXTInDefense || 0) / (playerStats.regainDefenseCount || 1) : 0,
        };
      }
      
      // Oblicz statystyki dla innych zawodników - sender
      // Użyj allTeamActions zamiast allActions (które zawiera tylko akcje aktualnego zawodnika)
      const senderActions = allTeamActions.filter(action => {
        if (selectedMatchIds.length > 0) {
          if (!selectedMatchIds.includes(action.matchId || "")) return false;
        }
        return action.senderId === teamPlayer.id && action.actionType === 'pass';
      });
      
      // Oblicz statystyki dla innych zawodników - receiver
      const receiverActions = allTeamActions.filter(action => {
        if (selectedMatchIds.length > 0) {
          if (!selectedMatchIds.includes(action.matchId || "")) return false;
        }
        return action.receiverId === teamPlayer.id && action.actionType === 'pass';
      });
      
      // Oblicz statystyki dla innych zawodników - dribbler
      const dribblerActions = allTeamActions.filter(action => {
        if (selectedMatchIds.length > 0) {
          if (!selectedMatchIds.includes(action.matchId || "")) return false;
        }
        return action.senderId === teamPlayer.id && action.actionType === 'dribble';
      });
      
      let pxtAsSender = 0;
      let senderActionsCount = 0;
      let senderPassCount = 0;
      
      senderActions.forEach(action => {
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        // Pomiń akcje z ujemną lub zerową wartością xT (tak jak w playerStats)
        if (xTDifference <= 0) return;
        const packingPoints = action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        pxtAsSender += pxtValue;
        senderActionsCount += 1;
        senderPassCount += 1;
      });
      
      let pxtAsReceiver = 0;
      let receiverActionsCount = 0;
      let receiverPassCount = 0;
      
      receiverActions.forEach(action => {
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        // Pomiń akcje z ujemną lub zerową wartością xT (tak jak w playerStats)
        if (xTDifference <= 0) return;
        const packingPoints = action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        pxtAsReceiver += pxtValue;
        receiverActionsCount += 1;
        receiverPassCount += 1;
      });
      
      let pxtAsDribbler = 0;
      let dribblingActionsCount = 0;
      
      dribblerActions.forEach(action => {
        const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
        // Pomiń akcje z ujemną lub zerową wartością xT (tak jak w playerStats)
        if (xTDifference <= 0) return;
        const packingPoints = action.packingPoints || 0;
        const pxtValue = xTDifference * packingPoints;
        pxtAsDribbler += pxtValue;
        dribblingActionsCount += 1;
      });
      
      return {
        playerId: teamPlayer.id,
        pxtAsSender,
        pxtSenderPer90: pxtAsSender * per90Multiplier,
        senderActionsPer90: senderActionsCount * per90Multiplier,
        pxtSenderPerAction: senderPassCount > 0 ? pxtAsSender / senderPassCount : 0,
        pxtAsReceiver,
        pxtReceiverPer90: pxtAsReceiver * per90Multiplier,
        receiverActionsPer90: receiverActionsCount * per90Multiplier,
        pxtReceiverPerAction: receiverPassCount > 0 ? pxtAsReceiver / receiverPassCount : 0,
        pxtAsDribbler,
        pxtDribblingPer90: pxtAsDribbler * per90Multiplier,
        dribblingActionsPer90: dribblingActionsCount * per90Multiplier,
        pxtDribblingPerAction: dribblingActionsCount > 0 ? pxtAsDribbler / dribblingActionsCount : 0,
      };
    });
    
    // Sortuj i znajdź ranking dla sender
    const sortedByPxtSender = [...teamPlayerStats].sort((a, b) => b.pxtAsSender - a.pxtAsSender);
    const sortedByPxtPer90Sender = [...teamPlayerStats].sort((a, b) => b.pxtSenderPer90 - a.pxtSenderPer90);
    const sortedByActionsPer90Sender = [...teamPlayerStats].sort((a, b) => b.senderActionsPer90 - a.senderActionsPer90);
    const sortedByPxtPerActionSender = [...teamPlayerStats].sort((a, b) => b.pxtSenderPerAction - a.pxtSenderPerAction);
    
    // Sortuj i znajdź ranking dla receiver
    const sortedByPxtReceiver = [...teamPlayerStats].sort((a, b) => b.pxtAsReceiver - a.pxtAsReceiver);
    const sortedByPxtPer90Receiver = [...teamPlayerStats].sort((a, b) => b.pxtReceiverPer90 - a.pxtReceiverPer90);
    const sortedByActionsPer90Receiver = [...teamPlayerStats].sort((a, b) => b.receiverActionsPer90 - a.receiverActionsPer90);
    const sortedByPxtPerActionReceiver = [...teamPlayerStats].sort((a, b) => b.pxtReceiverPerAction - a.pxtReceiverPerAction);
    
    // Sortuj i znajdź ranking dla dribbler
    const sortedByPxtDribbler = [...teamPlayerStats].sort((a, b) => b.pxtAsDribbler - a.pxtAsDribbler);
    const sortedByPxtPer90Dribbler = [...teamPlayerStats].sort((a, b) => b.pxtDribblingPer90 - a.pxtDribblingPer90);
    const sortedByActionsPer90Dribbler = [...teamPlayerStats].sort((a, b) => b.dribblingActionsPer90 - a.dribblingActionsPer90);
    const sortedByPxtPerActionDribbler = [...teamPlayerStats].sort((a, b) => b.pxtDribblingPerAction - a.pxtDribblingPerAction);
    
    // Sortuj i znajdź ranking dla regainów
    const sortedByRegains = [...teamPlayerStats].sort((a, b) => (b.totalRegains || 0) - (a.totalRegains || 0));
    const sortedByRegainsPer90 = [...teamPlayerStats].sort((a, b) => (b.regainsPer90 || 0) - (a.regainsPer90 || 0));
    const sortedByRegainXTInAttack = [...teamPlayerStats].sort((a, b) => (b.regainXTInAttack || 0) - (a.regainXTInAttack || 0));
    const sortedByRegainXTInAttackPer90 = [...teamPlayerStats].sort((a, b) => (b.regainXTInAttackPer90 || 0) - (a.regainXTInAttackPer90 || 0));
    const sortedByRegainXTInAttackPerAction = [...teamPlayerStats].sort((a, b) => (b.regainXTInAttackPerAction || 0) - (a.regainXTInAttackPerAction || 0));
    const sortedByRegainXTInDefense = [...teamPlayerStats].sort((a, b) => (b.regainXTInDefense || 0) - (a.regainXTInDefense || 0));
    const sortedByRegainXTInDefensePer90 = [...teamPlayerStats].sort((a, b) => (b.regainXTInDefensePer90 || 0) - (a.regainXTInDefensePer90 || 0));
    const sortedByRegainXTInDefensePerAction = [...teamPlayerStats].sort((a, b) => (b.regainXTInDefensePerAction || 0) - (a.regainXTInDefensePerAction || 0));
    
    const currentPlayerStats = teamPlayerStats.find(p => p.playerId === targetPlayerId);
    if (!currentPlayerStats) return null;
    
    // Oblicz całkowite PxT i podania zespołu dla procentów
    const teamTotalPxtAsSender = teamPlayerStats.reduce((sum, p) => sum + p.pxtAsSender, 0);
    const teamTotalPxtAsReceiver = teamPlayerStats.reduce((sum, p) => sum + p.pxtAsReceiver, 0);
    const teamTotalPxtAsDribbler = teamPlayerStats.reduce((sum, p) => sum + p.pxtAsDribbler, 0);
    // Oblicz całkowite regain xT dla zespołu
    const teamTotalRegainXTInAttack = teamPlayerStats.reduce((sum, p) => sum + (p.regainXTInAttack || 0), 0);
    const teamTotalRegainXTInDefense = teamPlayerStats.reduce((sum, p) => sum + (p.regainXTInDefense || 0), 0);
    
    // Oblicz całkowite podania zespołu (sender - podania jako podający)
    const teamTotalSenderPasses = allTeamActions.filter(action => {
      if (selectedMatchIds.length > 0 && !selectedMatchIds.includes(action.matchId || "")) return false;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      return action.senderId && action.actionType === 'pass' && xTDifference > 0;
    }).length;
    
    // Oblicz całkowite podania zespołu (receiver - podania jako przyjmujący)
    const teamTotalReceiverPasses = allTeamActions.filter(action => {
      if (selectedMatchIds.length > 0 && !selectedMatchIds.includes(action.matchId || "")) return false;
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      return action.receiverId && action.actionType === 'pass' && xTDifference > 0;
    }).length;
    
    return {
      // Sender rankings
      pxtRank: sortedByPxtSender.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtPer90Rank: sortedByPxtPer90Sender.findIndex(p => p.playerId === targetPlayerId) + 1,
      actionsPer90Rank: sortedByActionsPer90Sender.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtPerActionRank: sortedByPxtPerActionSender.findIndex(p => p.playerId === targetPlayerId) + 1,
      // Receiver rankings
      pxtReceiverRank: sortedByPxtReceiver.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtReceiverPer90Rank: sortedByPxtPer90Receiver.findIndex(p => p.playerId === targetPlayerId) + 1,
      receiverActionsPer90Rank: sortedByActionsPer90Receiver.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtReceiverPerActionRank: sortedByPxtPerActionReceiver.findIndex(p => p.playerId === targetPlayerId) + 1,
      // Dribbler rankings
      pxtDribblerRank: sortedByPxtDribbler.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtDribblerPer90Rank: sortedByPxtPer90Dribbler.findIndex(p => p.playerId === targetPlayerId) + 1,
      dribblerActionsPer90Rank: sortedByActionsPer90Dribbler.findIndex(p => p.playerId === targetPlayerId) + 1,
      pxtDribblerPerActionRank: sortedByPxtPerActionDribbler.findIndex(p => p.playerId === targetPlayerId) + 1,
      // Regain rankings
      regainsRank: sortedByRegains.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainsPer90Rank: sortedByRegainsPer90.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInAttackRank: sortedByRegainXTInAttack.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInAttackPer90Rank: sortedByRegainXTInAttackPer90.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInAttackPerActionRank: sortedByRegainXTInAttackPerAction.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInDefenseRank: sortedByRegainXTInDefense.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInDefensePer90Rank: sortedByRegainXTInDefensePer90.findIndex(p => p.playerId === targetPlayerId) + 1,
      regainXTInDefensePerActionRank: sortedByRegainXTInDefensePerAction.findIndex(p => p.playerId === targetPlayerId) + 1,
      totalPlayers: teamPlayerStats.length,
      // Procenty udziału w zespole
      pxtSenderPercentage: teamTotalPxtAsSender > 0 ? (currentPlayerStats.pxtAsSender / teamTotalPxtAsSender) * 100 : 0,
      pxtReceiverPercentage: teamTotalPxtAsReceiver > 0 ? (currentPlayerStats.pxtAsReceiver / teamTotalPxtAsReceiver) * 100 : 0,
      pxtDribblerPercentage: teamTotalPxtAsDribbler > 0 ? (currentPlayerStats.pxtAsDribbler / teamTotalPxtAsDribbler) * 100 : 0,
      senderPassesPercentage: teamTotalSenderPasses > 0 ? (playerStats.senderPassCount / teamTotalSenderPasses) * 100 : 0,
      receiverPassesPercentage: teamTotalReceiverPasses > 0 ? (playerStats.receiverPassCount / teamTotalReceiverPasses) * 100 : 0,
      regainXTInAttackPercentage: teamTotalRegainXTInAttack > 0 ? ((currentPlayerStats.regainXTInAttack || 0) / teamTotalRegainXTInAttack) * 100 : 0,
      regainXTInDefensePercentage: teamTotalRegainXTInDefense > 0 ? ((currentPlayerStats.regainXTInDefense || 0) / teamTotalRegainXTInDefense) * 100 : 0,
    };
  }, [playerStats, selectedTeam, filteredPlayers, allTeamActions, selectedMatchIds, filteredMatchesBySeason, selectedPlayerForView, playerId, selectedActionFilter]);

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
            onChange={async (e) => {
              const newTeam = e.target.value;
              setSelectedTeam(newTeam);
              // Zapisz wybór zespołu w localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('selectedTeam', newTeam);
              }
              // Resetuj wybór zawodnika przy zmianie zespołu - ustaw pusty string, aby useEffect mógł ustawić pierwszego dostępnego
              setSelectedPlayerForView("");
              // Wyczyść akcje, aby wymusić przeładowanie
              setAllActions([]);
              setAllShots([]);
              setSelectedMatchIds([]);
              // Wyczyść localStorage dla selectedPlayerForView, aby wymusić wybór pierwszego zawodnika z nowego zespołu
              if (typeof window !== 'undefined') {
                localStorage.removeItem('selectedPlayerForView');
              }
              // Zresetuj lastLoadedTeamRef, aby umożliwić załadowanie meczów dla nowego zespołu
              lastLoadedTeamRef.current = null;
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
          <button
            id="player-select"
            onClick={() => setIsPlayerSelectModalOpen(true)}
            className={styles.playerSelectButton}
          >
            {selectedPlayerForView 
              ? getPlayerFullName(filteredPlayers.find(p => p.id === selectedPlayerForView) || filteredPlayers[0])
              : "Wybierz zawodnika..."}
          </button>
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
          <label className={styles.selectorLabel}>Mecze:</label>
          <button
            className={styles.matchSelectButton}
            onClick={() => setIsMatchSelectModalOpen(true)}
          >
            Wybrane mecze ({filteredMatchesBySeason.filter(m => selectedMatchIds.includes(m.matchId || "")).length}/{filteredMatchesBySeason.length})
          </button>
        </div>
      </div>

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
            <div className={styles.playerNameRow}>
              <h2 className={styles.playerName}>{getPlayerFullName(player)}</h2>
              {player.number && (
                <span className={styles.playerNumber}>#{player.number}</span>
              )}
              {player.position && (
                <span className={styles.playerPosition}>{player.position}</span>
              )}
            </div>
            {playerStats && (
              <div className={styles.playerMinutes}>
                <span className={styles.minutesLabel}>Minuty gry:</span>
                <span className={styles.minutesValue}>{playerStats.totalMinutes} min</span>
              </div>
            )}
          </div>
        </div>


        {isLoadingActions ? (
          <div className={styles.loading}>Ładowanie statystyk...</div>
        ) : playerStats ? (
          <div className={styles.statsContainer}>
            <div className={styles.statsLayout}>
              {/* Lista kategorii na górze */}
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
                <div
                  className={`${styles.categoryItem} ${expandedCategory === 'regains' ? styles.active : ''}`}
                  onClick={() => setExpandedCategory(expandedCategory === 'regains' ? null : 'regains')}
                >
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

              {/* Szczegóły poniżej */}
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
                        onClick={() => {
                          setSelectedPxtCategory('dribbler');
                          setHeatmapDirection('from'); // Domyślnie pokazuj z której strefy
                        }}
                      >
                        Drybling
                      </button>
                    </div>

                    {/* Wyświetlanie danych dla wybranej kategorii */}
                    {selectedPxtCategory === 'sender' && (
                      <div className={`${styles.detailsSection} ${styles.detailsSectionWithTiles}`}>
                        <div className={styles.detailsSectionContent}>
                          <h4>Podanie</h4>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT:</span>
                            <span className={styles.detailsValue}>
                              <span className={styles.valueMain}><strong>{playerStats.pxtAsSender.toFixed(2)}</strong> PxT</span>
                              {teamRanking && teamRanking.pxtSenderPercentage > 0 && (
                                <span className={styles.valueSecondary}>({teamRanking.pxtSenderPercentage.toFixed(1)}% zespołu)</span>
                              )}
                              <span className={styles.valueSecondary}>({playerStats.pxtSenderPer90.toFixed(2)} / 90 min)</span>
                              {teamRanking && (
                                <>
                                  <span 
                                    className={styles.rankingBadge} 
                                    data-tooltip="Miejsce w zespole pod względem całkowitego PxT jako podający"
                                  >
                                    #{teamRanking.pxtRank}/{teamRanking.totalPlayers}
                                  </span>
                                  <span 
                                    className={styles.rankingBadge} 
                                    data-tooltip="Miejsce w zespole pod względem PxT/90min jako podający"
                                  >
                                    #{teamRanking.pxtPer90Rank}/{teamRanking.totalPlayers} (90min)
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                            <span className={styles.detailsValue}>
                              <span className={styles.valueMain}>{playerStats.senderActionsPer90.toFixed(1)}</span>
                              <span className={styles.valueSecondary}>({playerStats.senderPassCount} podań</span>
                              {teamRanking && teamRanking.senderPassesPercentage > 0 && (
                                <span className={styles.valueSecondary}> - {teamRanking.senderPassesPercentage.toFixed(1)}% zespołu</span>
                              )}
                              <span className={styles.valueSecondary}>)</span>
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem liczby akcji/90min jako podający">
                                  #{teamRanking.actionsPer90Rank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT / podanie:</span>
                            <span className={styles.detailsValue}>
                              {playerStats.pxtSenderPerAction.toFixed(2)}
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem PxT/podanie jako podający">
                                  #{teamRanking.pxtPerActionRank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className={styles.actionCounts}>
                          <div className={styles.countItemsWrapper}>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p1' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p1' ? null : 'p1')}
                            >
                              <span className={styles.countLabel}>P1:</span>
                              <span className={styles.countValue}>{playerStats.senderP1Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP1CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP1CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
                            >
                              <span className={styles.countLabel}>P2:</span>
                              <span className={styles.countValue}>{playerStats.senderP2Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP2CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP2CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
                            >
                              <span className={styles.countLabel}>P3:</span>
                              <span className={styles.countValue}>{playerStats.senderP3Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP3CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderP3CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'pk' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'pk' ? null : 'pk')}
                            >
                              <span className={styles.countLabel}>PK:</span>
                              <span className={styles.countValue}>{playerStats.senderPKCount}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderPKCountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderPKCountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
                            >
                              <span className={styles.countLabel}>Strzał:</span>
                              <span className={styles.countValue}>{playerStats.senderShotCount}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderShotCountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.senderShotCountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
                            >
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
                      </div>
                    )}

                    {selectedPxtCategory === 'receiver' && (
                      <div className={`${styles.detailsSection} ${styles.detailsSectionWithTiles}`}>
                        <div className={styles.detailsSectionContent}>
                          <h4>Przyjęcie</h4>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT:</span>
                            <span className={styles.detailsValue}>
                              <span className={styles.valueMain}><strong>{playerStats.pxtAsReceiver.toFixed(2)}</strong> PxT</span>
                              {teamRanking && teamRanking.pxtReceiverPercentage > 0 && (
                                <span className={styles.valueSecondary}>({teamRanking.pxtReceiverPercentage.toFixed(1)}% zespołu)</span>
                              )}
                              <span className={styles.valueSecondary}>({playerStats.pxtReceiverPer90.toFixed(2)} / 90 min)</span>
                              {teamRanking && (
                                <>
                                  <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem całkowitego PxT jako przyjmujący">
                                    #{teamRanking.pxtReceiverRank}/{teamRanking.totalPlayers}
                                  </span>
                                  <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem PxT/90min jako przyjmujący">
                                    #{teamRanking.pxtReceiverPer90Rank}/{teamRanking.totalPlayers} (90min)
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                            <span className={styles.detailsValue}>
                              <span className={styles.valueMain}>{playerStats.receiverActionsPer90.toFixed(1)}</span>
                              <span className={styles.valueSecondary}>({playerStats.receiverPassCount} podań</span>
                              {teamRanking && teamRanking.receiverPassesPercentage > 0 && (
                                <span className={styles.valueSecondary}> - {teamRanking.receiverPassesPercentage.toFixed(1)}% zespołu</span>
                              )}
                              <span className={styles.valueSecondary}>)</span>
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem liczby akcji/90min jako przyjmujący">
                                  #{teamRanking.receiverActionsPer90Rank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT / podanie:</span>
                            <span className={styles.detailsValue}>
                              {playerStats.pxtReceiverPerAction.toFixed(2)}
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem PxT/podanie jako przyjmujący">
                                  #{teamRanking.pxtReceiverPerActionRank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className={styles.actionCounts}>
                          <div className={styles.countItemsWrapper}>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p1' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p1' ? null : 'p1')}
                            >
                              <span className={styles.countLabel}>P1:</span>
                              <span className={styles.countValue}>{playerStats.receiverP1Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP1CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP1CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
                            >
                              <span className={styles.countLabel}>P2:</span>
                              <span className={styles.countValue}>{playerStats.receiverP2Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP2CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP2CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
                            >
                              <span className={styles.countLabel}>P3:</span>
                              <span className={styles.countValue}>{playerStats.receiverP3Count}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP3CountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverP3CountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'pk' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'pk' ? null : 'pk')}
                            >
                              <span className={styles.countLabel}>PK:</span>
                              <span className={styles.countValue}>{playerStats.receiverPKCount}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverPKCountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverPKCountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
                            >
                              <span className={styles.countLabel}>Strzał:</span>
                              <span className={styles.countValue}>{playerStats.receiverShotCount}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverShotCountLateral}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.receiverShotCountCentral}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
                            >
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
                      </div>
                    )}

                    {selectedPxtCategory === 'dribbler' && playerStats && (
                      <div className={`${styles.detailsSection} ${styles.detailsSectionWithTiles}`}>
                        <div className={styles.detailsSectionContent}>
                          <h4>Drybling</h4>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT:</span>
                            <span className={styles.detailsValue}>
                              {(playerStats.pxtAsDribbler ?? 0).toFixed(2)} ({(playerStats.pxtDribblingPer90 ?? 0).toFixed(2)} / 90 min)
                              {teamRanking && (
                                <>
                                  <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem całkowitego PxT z dryblingu">
                                    #{teamRanking.pxtDribblerRank}/{teamRanking.totalPlayers}
                                  </span>
                                  <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem PxT/90min z dryblingu">
                                    #{teamRanking.pxtDribblerPer90Rank}/{teamRanking.totalPlayers} (90min)
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>Akcje / 90 min:</span>
                            <span className={styles.detailsValue}>
                              {(playerStats.dribblingActionsPer90 ?? 0).toFixed(1)} ({(playerStats.dribblingActionsCount ?? 0)} dryblingów)
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem liczby dryblingów/90min">
                                  #{teamRanking.dribblerActionsPer90Rank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={styles.detailsRow}>
                            <span className={styles.detailsLabel}>PxT / drybling:</span>
                            <span className={styles.detailsValue}>
                              {(playerStats.pxtDribblingPerAction ?? 0).toFixed(2)}
                              {teamRanking && (
                                <span className={styles.rankingBadge} data-tooltip="Miejsce w zespole pod względem PxT/drybling">
                                  #{teamRanking.pxtDribblerPerActionRank}/{teamRanking.totalPlayers}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className={styles.actionCounts}>
                          <div className={styles.countItemsWrapper}>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p1' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p1' ? null : 'p1')}
                            >
                              <span className={styles.countLabel}>P1:</span>
                              <span className={styles.countValue}>{playerStats.dribblingP1Count ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP1CountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP1CountCentral ?? 0}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p2' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p2' ? null : 'p2')}
                            >
                              <span className={styles.countLabel}>P2:</span>
                              <span className={styles.countValue}>{playerStats.dribblingP2Count ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP2CountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP2CountCentral ?? 0}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'p3' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'p3' ? null : 'p3')}
                            >
                              <span className={styles.countLabel}>P3:</span>
                              <span className={styles.countValue}>{playerStats.dribblingP3Count ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP3CountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingP3CountCentral ?? 0}</span>
                              </div>
                            </div>
                            <div className={styles.countItem}>
                              <span className={styles.countLabel}>PK:</span>
                              <span className={styles.countValue}>{playerStats.dribblingPKCount ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingPKCountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingPKCountCentral ?? 0}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'shot' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'shot' ? null : 'shot')}
                            >
                              <span className={styles.countLabel}>Strzał:</span>
                              <span className={styles.countValue}>{playerStats.dribblingShotCount ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingShotCountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingShotCountCentral ?? 0}</span>
                              </div>
                            </div>
                            <div 
                              className={`${styles.countItem} ${selectedActionFilter === 'goal' ? styles.countItemSelected : ''}`}
                              onClick={() => setSelectedActionFilter(selectedActionFilter === 'goal' ? null : 'goal')}
                            >
                              <span className={styles.countLabel}>Gol:</span>
                              <span className={styles.countValue}>{playerStats.dribblingGoalCount ?? 0}</span>
                              <div className={styles.zoneBreakdown}>
                                <span className={styles.zoneLabel}>Strefy boczne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingGoalCountLateral ?? 0}</span>
                                <span className={styles.zoneLabel}>Strefy centralne:</span>
                                <span className={styles.zoneValue}>{playerStats.dribblingGoalCountCentral ?? 0}</span>
                              </div>
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
                          {/* Przełącznik kierunku (dla sender, receiver i dribbler) */}
                          {(selectedPxtCategory === 'sender' || selectedPxtCategory === 'receiver' || selectedPxtCategory === 'dribbler') && (
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
                                  // Drybling - from (z której strefy) i to (do której strefy)
                                  if (heatmapMode === 'pxt') {
                                    return heatmapDirection === 'to'
                                      ? playerStats.dribblerToHeatmap
                                      : playerStats.dribblerFromHeatmap;
                                  } else {
                                    return heatmapDirection === 'to'
                                      ? playerStats.dribblerToActionCountHeatmap
                                      : playerStats.dribblerFromActionCountHeatmap;
                                  }
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
                                    <button
                                      className={styles.viewActionsButton}
                                      onClick={() => {
                                        setSelectedPlayerForModal({
                                          playerId: playerInfo.playerId,
                                          playerName: playerInfo.playerName,
                                          zoneName: zoneDetails.zoneName
                                        });
                                        setActionsModalOpen(true);
                                      }}
                                      title="Zobacz szczegóły akcji"
                                    >
                                      Zobacz akcje
                                    </button>
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
                          <div className={styles.chartControls}>
                            <div className={styles.chartCategoryToggle}>
                              <button
                                className={`${styles.chartCategoryButton} ${chartCategory === 'sender' ? styles.active : ''}`}
                                onClick={() => setChartCategory('sender')}
                              >
                                Podający
                              </button>
                              <button
                                className={`${styles.chartCategoryButton} ${chartCategory === 'receiver' ? styles.active : ''}`}
                                onClick={() => setChartCategory('receiver')}
                              >
                                Przyjmujący
                              </button>
                              <button
                                className={`${styles.chartCategoryButton} ${chartCategory === 'dribbler' ? styles.active : ''}`}
                                onClick={() => setChartCategory('dribbler')}
                              >
                                Drybling
                              </button>
                            </div>
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
                        </div>
                        <div className={styles.matchChartContainer}>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={matchByMatchData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
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
                                        <p>Trend: {data.trendLine.toFixed(chartMode === 'pxt' ? 2 : 3)}</p>
                                        {data.position && <p>Pozycja: {data.position}</p>}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey={chartMode === 'pxt' ? 'pxt' : 'pxtPerMinute'} 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                dot={{ 
                                  fill: '#3b82f6', 
                                  strokeWidth: 1, 
                                  r: 4, 
                                  stroke: '#fff'
                                }}
                                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#3b82f6' }}
                                name={chartMode === 'pxt' ? 'PxT' : 'PxT/min'}
                                label={(props: any) => {
                                  const { x, y, payload, value } = props;
                                  // W recharts label otrzymuje payload jako cały obiekt danych
                                  if (!payload || payload.trendLine === undefined || payload.trendLine === null) {
                                    return null;
                                  }
                                  const trendValue = payload.trendLine;
                                  if (typeof trendValue !== 'number' || isNaN(trendValue)) {
                                    return null;
                                  }
                                  return (
                                    <text 
                                      x={x} 
                                      y={y - 10} 
                                      fill="#9ca3af" 
                                      fontSize={10} 
                                      textAnchor="middle"
                                    >
                                      {trendValue.toFixed(chartMode === 'pxt' ? 2 : 3)}
                                    </text>
                                  );
                                }}
                                animationDuration={800}
                                animationEasing="ease-out"
                              />
                              <Line 
                                type="linear" 
                                dataKey="trendLine" 
                                stroke="#9ca3af" 
                                strokeWidth={1.5}
                                strokeDasharray="5 5"
                                dot={false}
                                activeDot={false}
                                name="Trend"
                                legendType="line"
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
                            {Object.entries(playerStats.positionStats).map(([position, stats]) => {
                              const positionMatches = Array.from(stats.matchIds || new Set()).map(matchId => {
                                const match = filteredMatchesBySeason.find(m => m.matchId === matchId);
                                return match;
                              }).filter(Boolean) as TeamInfo[];
                              
                              return (
                          <div key={position} className={styles.positionDetails}>
                            <div className={styles.positionHeader}>
                              <h5>{position} ({stats.minutes} min)</h5>
                              {positionMatches.length > 0 && (
                                <button
                                  className={styles.matchesToggleButton}
                                  onClick={() => setExpandedPositionMatches(expandedPositionMatches === position ? null : position)}
                                >
                                  {expandedPositionMatches === position ? 'Ukryj' : 'Pokaż'} mecze ({positionMatches.length})
                                </button>
                              )}
                            </div>
                            {expandedPositionMatches === position && positionMatches.length > 0 && (
                              <div className={styles.positionMatchesList}>
                                {positionMatches.map((match) => (
                                  <div key={match.matchId} className={styles.positionMatchItem}>
                                    <span className={styles.matchDate}>
                                      {new Date(match.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                    <span className={styles.matchOpponent}>
                                      {match.opponent} {match.isHome ? '(D)' : '(W)'}
                                    </span>
                                    <span className={styles.matchCompetition}>{match.competition}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Podanie</span>
                              <span className={styles.detailsValue}>
                                <span className={styles.valueMain}><strong>{stats.pxtAsSender.toFixed(2)}</strong> PxT</span>
                                <span className={styles.valueSecondary}>({stats.pxtSenderPer90.toFixed(2)} / 90 min)</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.senderPassCount} podań</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.pxtSenderPerPass.toFixed(2)} PxT/podanie</span>
                              </span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Przyjęcie</span>
                              <span className={styles.detailsValue}>
                                <span className={styles.valueMain}><strong>{stats.pxtAsReceiver.toFixed(2)}</strong> PxT</span>
                                <span className={styles.valueSecondary}>({stats.pxtReceiverPer90.toFixed(2)} / 90 min)</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.receiverPassCount} podań</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.pxtReceiverPerPass.toFixed(2)} PxT/podanie</span>
                              </span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>PxT Drybling</span>
                              <span className={styles.detailsValue}>
                                <span className={styles.valueMain}><strong>{stats.pxtAsDribbler.toFixed(2)}</strong> PxT</span>
                                <span className={styles.valueSecondary}>({stats.pxtDribblingPer90.toFixed(2)} / 90 min)</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.dribblingCount} dryblingów</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>{stats.pxtDribblingPerDribble.toFixed(2)} PxT/drybling</span>
                              </span>
                            </div>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>Akcje / 90 min</span>
                              <span className={styles.detailsValue}>
                                <span className={styles.valueSecondary}>Podania: {stats.senderActionsPer90.toFixed(1)}</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>Przyjęcia: {stats.receiverActionsPer90.toFixed(1)}</span>
                                <span className={styles.valueSeparator}>•</span>
                                <span className={styles.valueSecondary}>Dryblingi: {stats.dribblingActionsPer90.toFixed(1)}</span>
                              </span>
                            </div>
                          </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Statystyki partnerów */}
                    {playerStats && (
                      <div className={styles.detailsSection}>
                        <div 
                          className={styles.expandableHeader}
                          onClick={() => setIsPartnerStatsExpanded(!isPartnerStatsExpanded)}
                        >
                          <h4>Najczęstsze połączenia</h4>
                          <span className={styles.expandIcon}>
                            {isPartnerStatsExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                        {isPartnerStatsExpanded && (
                          <div className={styles.partnerStatsContent}>
                            {/* Przełącznik podający/przyjmujący */}
                            <div className={styles.partnerModeToggle}>
                              <button
                                className={`${styles.partnerModeButton} ${partnerStatsMode === 'sender' ? styles.active : ''}`}
                                onClick={() => setPartnerStatsMode('sender')}
                              >
                                Podający
                              </button>
                              <button
                                className={`${styles.partnerModeButton} ${partnerStatsMode === 'receiver' ? styles.active : ''}`}
                                onClick={() => setPartnerStatsMode('receiver')}
                              >
                                Przyjmujący
                              </button>
                            </div>
                            
                            {/* Przełącznik sortowania - Liczba podań / PxT */}
                            <div className={styles.partnerSortToggle}>
                              <button
                                className={`${styles.partnerSortButton} ${partnerSortMode === 'passes' ? styles.active : ''}`}
                                onClick={() => setPartnerSortMode('passes')}
                              >
                                Liczba podań
                              </button>
                              <button
                                className={`${styles.partnerSortButton} ${partnerSortMode === 'pxt' ? styles.active : ''}`}
                                onClick={() => setPartnerSortMode('pxt')}
                              >
                                PxT
                              </button>
                            </div>
                            
                            <div className={styles.partnerStatsList}>
                              {partnerStatsMode === 'sender' ? (
                                <>
                                  <h5>{partnerSortMode === 'passes' ? 'Do kogo zawodnik podaje najczęściej' : 'Z kim na największe PxT'}</h5>
                                  {Array.from(playerStats.partnerStatsAsSender.entries())
                                    .map(([playerId, stats]) => {
                                      const partner = players.find(p => p.id === playerId);
                                      return {
                                        playerId,
                                        playerName: partner ? `${partner.firstName} ${partner.lastName}` : `Zawodnik ${playerId}`,
                                        ...stats
                                      };
                                    })
                                    .sort((a, b) => partnerSortMode === 'passes' ? b.passes - a.passes : b.pxt - a.pxt)
                                    .slice(0, 5)
                                    .map((partner, index) => (
                                      <div key={partner.playerId} className={styles.partnerItem}>
                                        <span className={styles.partnerRank}>{index + 1}.</span>
                                        <span className={styles.partnerName}>{partner.playerName}</span>
                                        <span className={styles.partnerValue}>
                                          {partnerSortMode === 'passes' 
                                            ? `${partner.passes} podań (${partner.pxt.toFixed(2)} PxT)` 
                                            : `${partner.pxt.toFixed(2)} PxT (${partner.passes} podań)`}
                                        </span>
                                      </div>
                                    ))}
                                </>
                              ) : (
                                <>
                                  <h5>{partnerSortMode === 'passes' ? 'Od kogo zawodnik otrzymuje najwięcej' : 'Od kogo największe PxT'}</h5>
                                  {Array.from(playerStats.partnerStatsAsReceiver.entries())
                                    .map(([playerId, stats]) => {
                                      const partner = players.find(p => p.id === playerId);
                                      return {
                                        playerId,
                                        playerName: partner ? `${partner.firstName} ${partner.lastName}` : `Zawodnik ${playerId}`,
                                        ...stats
                                      };
                                    })
                                    .sort((a, b) => partnerSortMode === 'passes' ? b.passes - a.passes : b.pxt - a.pxt)
                                    .slice(0, 5)
                                    .map((partner, index) => (
                                      <div key={partner.playerId} className={styles.partnerItem}>
                                        <span className={styles.partnerRank}>{index + 1}.</span>
                                        <span className={styles.partnerName}>{partner.playerName}</span>
                                        <span className={styles.partnerValue}>
                                          {partnerSortMode === 'passes' 
                                            ? `${partner.passes} podań (${partner.pxt.toFixed(2)} PxT)` 
                                            : `${partner.pxt.toFixed(2)} PxT (${partner.passes} podań)`}
                                        </span>
                                      </div>
                                    ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {expandedCategory === 'regains' && (
                  <div className={styles.regainsDetails}>
                    <h3 style={{ marginBottom: '20px', marginTop: '0' }}>Szczegóły Regainów</h3>
                    
                    {/* Przełącznik atak/obrona - pod tytułem */}
                    <div className={styles.heatmapModeToggle} style={{ marginBottom: '20px', width: 'auto', display: 'inline-flex' }}>
                      <button
                        className={`${styles.heatmapModeButton} ${regainAttackDefenseMode === 'defense' ? styles.active : ''}`}
                        onClick={() => {
                          setRegainAttackDefenseMode(regainAttackDefenseMode === 'defense' ? null : 'defense');
                        }}
                      >
                        W obronie
                      </button>
                      <button
                        className={`${styles.heatmapModeButton} ${regainAttackDefenseMode === 'attack' ? styles.active : ''}`}
                        onClick={() => {
                          setRegainAttackDefenseMode(regainAttackDefenseMode === 'attack' ? null : 'attack');
                        }}
                      >
                        W ataku
                      </button>
                    </div>

                    {/* Statystyki podstawowe */}
                    <div className={styles.detailsSection} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div className={styles.detailsSectionContent}>
                        {playerStats.regainXTInAttack !== undefined && playerStats.regainXTInDefense !== undefined && (
                          <>
                            <div className={styles.detailsRow}>
                              <span className={styles.detailsLabel}>REGAINY:</span>
                              <span className={styles.detailsValue} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className={styles.valueMain}><strong>{playerStats.totalRegains}</strong></span>
                                <span className={styles.valueSecondary}>({playerStats.regainsPer90.toFixed(1)} / 90 min)</span>
                                {teamRanking && (
                                  <>
                                    <span 
                                      className={styles.rankingBadge} 
                                      data-tooltip="Miejsce w zespole pod względem całkowitej liczby regainów"
                                    >
                                      #{teamRanking.regainsRank}/{teamRanking.totalPlayers}
                                    </span>
                                    <span 
                                      className={styles.rankingBadge} 
                                      data-tooltip="Miejsce w zespole pod względem regainów/90min"
                                    >
                                      #{teamRanking.regainsPer90Rank}/{teamRanking.totalPlayers} (90min)
                                    </span>
                                  </>
                                )}
                              </span>
                            </div>
                            {regainAttackDefenseMode === 'attack' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '8px' }}>
                                <div className={styles.detailsRow}>
                                  <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W ATAKU:</span>
                                  <span className={styles.detailsValue} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className={styles.valueMain}>{playerStats.regainXTInAttack.toFixed(3)}</span>
                                    {teamRanking && teamRanking.regainXTInAttackPercentage !== undefined && (
                                      <span className={styles.valueSecondary}>({teamRanking.regainXTInAttackPercentage.toFixed(1)}%)</span>
                                    )}
                                    {playerStats.regainAttackCount > 0 && (
                                      <>
                                        <span className={styles.valueSecondary}> • {(playerStats.regainXTInAttack / playerStats.regainAttackCount).toFixed(3)}/akcję</span>
                                      </>
                                    )}
                                    {teamRanking && (
                                      <>
                                        <span 
                                          className={styles.rankingBadge} 
                                          data-tooltip="Miejsce w zespole pod względem całkowitego xT w ataku"
                                        >
                                          #{teamRanking.regainXTInAttackRank}/{teamRanking.totalPlayers}
                                        </span>
                                        <span 
                                          className={styles.rankingBadge} 
                                          data-tooltip="Miejsce w zespole pod względem xT w ataku/akcję"
                                        >
                                          #{teamRanking.regainXTInAttackPerActionRank}/{teamRanking.totalPlayers}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                            {regainAttackDefenseMode === 'defense' && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '8px' }}>
                                <div className={styles.detailsRow}>
                                  <span className={styles.detailsLabel}><span className={styles.preserveCase}>xT</span> W OBRONIE:</span>
                                  <span className={styles.detailsValue} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className={styles.valueMain}>{playerStats.regainXTInDefense.toFixed(3)}</span>
                                    {teamRanking && teamRanking.regainXTInDefensePercentage !== undefined && (
                                      <span className={styles.valueSecondary}>({teamRanking.regainXTInDefensePercentage.toFixed(1)}%)</span>
                                    )}
                                    {playerStats.regainDefenseCount > 0 && (
                                      <>
                                        <span className={styles.valueSecondary}> • {(playerStats.regainXTInDefense / playerStats.regainDefenseCount).toFixed(3)}/akcję</span>
                                      </>
                                    )}
                                    {teamRanking && (
                                      <>
                                        <span 
                                          className={styles.rankingBadge} 
                                          data-tooltip="Miejsce w zespole pod względem całkowitego xT w obronie"
                                        >
                                          #{teamRanking.regainXTInDefenseRank}/{teamRanking.totalPlayers}
                                        </span>
                                        <span 
                                          className={styles.rankingBadge} 
                                          data-tooltip="Miejsce w zespole pod względem xT w obronie/akcję"
                                        >
                                          #{teamRanking.regainXTInDefensePerActionRank}/{teamRanking.totalPlayers}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {/* Wykres pokazuje różnicę zawodników - używa wartości zależnych od trybu */}
                        {(() => {
                          const actionCount = playerStats.totalRegains;
                          
                          // Wartości zależą od trybu
                          const isAttackMode = regainAttackDefenseMode === 'attack';
                          // Dla ataku: partnerzy za piłką, przeciwnicy przed piłką
                          // Dla obrony: partnerzy za piłką (totalPlayersOnField - bramkarz - playersBehindBall), przeciwnicy za piłką (totalOpponentsOnField - bramkarz - opponentsBehindBall)
                          const displayPlayersValue = isAttackMode
                            ? playerStats.regainAverageAttackPlayersBehind // Zawodnicy za piłką w ataku
                            : playerStats.regainAverageDefensePlayersUnderBall; // Zawodnicy za piłką w obronie
                          const displayOpponentsValue = isAttackMode
                            ? playerStats.regainAverageAttackOpponentsBehind // Przeciwnicy za piłką w ataku
                            : playerStats.regainAverageDefenseOpponentsUnderBall; // Przeciwnicy za piłką w obronie
                          
                          // Oblicz różnicę z wartości wyświetlanych w tekście
                          // Dla ataku: partnerzy za piłką - przeciwnicy za piłką
                          // Dla obrony: przeciwnicy za piłką - nasi za piłką
                          // Wzór dla obrony: (totalOpponentsOnField - bramkarz - opponentsBehindBall) - (totalPlayersOnField - bramkarz - playersBehindBall)
                          const playerDifference = isAttackMode
                            ? (displayPlayersValue || 0) - (displayOpponentsValue || 0) // Atak: partnerzy za piłką - przeciwnicy za piłką
                            : (displayOpponentsValue || 0) - (displayPlayersValue || 0); // Obrona: przeciwnicy za piłką - nasi za piłką
                          
                          if (actionCount > 0) {
                            // Oblicz pozycję na osi: -5 do +5, gdzie 0 to środek
                            // Wartości ujemne (obrona) → w lewo, wartości dodatnie (atak) → w prawo
                            const normalizedValue = Math.max(-5, Math.min(5, playerDifference));
                            
                            // Pozycja w procentach: 
                            // -5 = 0% (skrajna lewa), 0 = 50% (środek), +5 = 100% (skrajna prawa)
                            // Formuła: position = ((value + 5) / 10) * 100
                            const position = ((normalizedValue + 5) / 10) * 100;
                            
                            return (
                              <div className={styles.detailsRow}>
                                <span className={styles.detailsLabel}>
                                  {regainAttackDefenseMode === 'attack' ? 'ZAWODNICY PRZED PIŁKĄ' : 'ZAWODNICY ZA PIŁKĄ'}
                                </span>
                                <div className={styles.attackDefenseSlider}>
                                  <div className={styles.sliderLabels}>
                                    <span className={styles.sliderLabel}>Obrona</span>
                                    <span className={styles.sliderLabel}>Atak</span>
                                  </div>
                                  <div className={styles.sliderTrack}>
                                    <div 
                                      className={styles.sliderFill}
                                      style={{
                                        width: `${position}%`,
                                        backgroundColor: normalizedValue >= 0 
                                          ? '#3b82f6' 
                                          : '#10b981'
                                      }}
                                    />
                                    <div 
                                      className={styles.sliderIndicator}
                                      style={{
                                        left: `${position}%`,
                                        borderColor: normalizedValue >= 0 
                                          ? '#3b82f6' 
                                          : '#10b981'
                                      }}
                                    >
                                      <span className={styles.sliderValue}>{Math.abs(playerDifference).toFixed(2)}</span>
                                    </div>
                                  </div>
                                  <div className={styles.sliderScale}>
                                    <span className={styles.scaleMark}>5</span>
                                    <span className={styles.scaleMark}>4</span>
                                    <span className={styles.scaleMark}>3</span>
                                    <span className={styles.scaleMark}>2</span>
                                    <span className={styles.scaleMark}>1</span>
                                    <span className={styles.scaleMark}>0</span>
                                    <span className={styles.scaleMark}>1</span>
                                    <span className={styles.scaleMark}>2</span>
                                    <span className={styles.scaleMark}>3</span>
                                    <span className={styles.scaleMark}>4</span>
                                    <span className={styles.scaleMark}>5</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className={styles.actionCounts}>
                        <div className={styles.countItemsWrapper}>
                          <div 
                            className={`${styles.countItem} ${selectedRegainPackingFilter === 'P0' ? styles.countItemSelected : ''}`}
                            onClick={() => setSelectedRegainPackingFilter(selectedRegainPackingFilter === 'P0' ? null : 'P0')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.countLabel}>P0:</span>
                            <span className={styles.countValue}>{playerStats.regainP0Count || 0}</span>
                            <div className={styles.zoneBreakdown}>
                              <span className={styles.zoneLabel}>Strefy boczne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP0CountLateral || 0}</span>
                              <span className={styles.zoneLabel}>Strefy centralne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP0CountCentral || 0}</span>
                            </div>
                          </div>
                          <div 
                            className={`${styles.countItem} ${selectedRegainPackingFilter === 'P1' ? styles.countItemSelected : ''}`}
                            onClick={() => setSelectedRegainPackingFilter(selectedRegainPackingFilter === 'P1' ? null : 'P1')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.countLabel}>P1:</span>
                            <span className={styles.countValue}>{playerStats.regainP1Count || 0}</span>
                            <div className={styles.zoneBreakdown}>
                              <span className={styles.zoneLabel}>Strefy boczne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP1CountLateral || 0}</span>
                              <span className={styles.zoneLabel}>Strefy centralne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP1CountCentral || 0}</span>
                            </div>
                          </div>
                          <div 
                            className={`${styles.countItem} ${selectedRegainPackingFilter === 'P2' ? styles.countItemSelected : ''}`}
                            onClick={() => setSelectedRegainPackingFilter(selectedRegainPackingFilter === 'P2' ? null : 'P2')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.countLabel}>P2:</span>
                            <span className={styles.countValue}>{playerStats.regainP2Count || 0}</span>
                            <div className={styles.zoneBreakdown}>
                              <span className={styles.zoneLabel}>Strefy boczne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP2CountLateral || 0}</span>
                              <span className={styles.zoneLabel}>Strefy centralne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP2CountCentral || 0}</span>
                            </div>
                          </div>
                          <div 
                            className={`${styles.countItem} ${selectedRegainPackingFilter === 'P3' ? styles.countItemSelected : ''}`}
                            onClick={() => setSelectedRegainPackingFilter(selectedRegainPackingFilter === 'P3' ? null : 'P3')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className={styles.countLabel}>P3:</span>
                            <span className={styles.countValue}>{playerStats.regainP3Count || 0}</span>
                            <div className={styles.zoneBreakdown}>
                              <span className={styles.zoneLabel}>Strefy boczne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP3CountLateral || 0}</span>
                              <span className={styles.zoneLabel}>Strefy centralne:</span>
                              <span className={styles.zoneValue}>{playerStats.regainP3CountCentral || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Boisko z heatmapą */}
                    <div className={styles.detailsSection}>
                      <div className={styles.heatmapHeader}>
                        <h4>Heatmapa regainów</h4>
                        <div className={styles.heatmapControls}>
                          {/* Przełącznik trybu (xT odbiorców / Liczba akcji) */}
                          <div className={styles.heatmapModeToggle} style={{ width: 'auto', display: 'inline-flex' }}>
                            <button
                              className={`${styles.heatmapModeButton} ${regainHeatmapMode === 'xt' ? styles.active : ''}`}
                              onClick={() => {
                                // Zawsze zmień tryb na 'xt', zachowaj tryb atak/obrona jeśli jest aktywny
                                setRegainHeatmapMode('xt');
                              }}
                            >
                              xT odbiorców
                            </button>
                            <button
                              className={`${styles.heatmapModeButton} ${regainHeatmapMode === 'count' ? styles.active : ''}`}
                              onClick={() => {
                                // Zawsze zmień tryb na 'count', zachowaj tryb atak/obrona jeśli jest aktywny
                                setRegainHeatmapMode('count');
                              }}
                            >
                              Liczba akcji
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className={styles.heatmapWrapper}>
                        {(() => {
                          // Zawsze używaj heatmapy, nawet jeśli jest pusta - PlayerHeatmapPitch obsłuży to poprawnie
                          // Priorytet: najpierw sprawdzamy tryb atak/obrona, potem tryb xT/liczba akcji
                          let currentHeatmap: Map<string, number>;
                          let currentMode: 'pxt' | 'count';
                          
                          // Funkcja pomocnicza do filtrowania heatmapy po P0-P3
                          const filterHeatmapByPacking = (heatmap: Map<string, number>, packingFilter: "P0" | "P1" | "P2" | "P3" | null): Map<string, number> => {
                            if (!packingFilter || !playerStats?.regainZoneStats) return heatmap;
                            
                            const filteredHeatmap = new Map<string, number>();
                            const packingFieldMap: { [key: string]: keyof Action } = {
                              'P0': 'isP0',
                              'P1': 'isP1',
                              'P2': 'isP2',
                              'P3': 'isP3'
                            };
                            
                            const packingField = packingFieldMap[packingFilter];
                            if (!packingField) return heatmap;
                            
                            // Przejdź przez wszystkie strefy i akcje
                            playerStats.regainZoneStats.forEach((actions, zoneName) => {
                              const filteredActions = actions.filter(action => action[packingField] === true);
                              if (filteredActions.length > 0) {
                                // Oblicz sumę xT lub liczbę akcji dla tej strefy
                                if (currentMode === 'pxt') {
                                  const sumXT = filteredActions.reduce((sum, action: any) => {
                                    const receiverXT = action.regainDefenseXT !== undefined 
                                      ? action.regainDefenseXT 
                                      : (action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0));
                                    return sum + receiverXT;
                                  }, 0);
                                  if (sumXT > 0) {
                                    filteredHeatmap.set(zoneName, sumXT);
                                  }
                                } else {
                                  filteredHeatmap.set(zoneName, filteredActions.length);
                                }
                              }
                            });
                            
                            return filteredHeatmap;
                          };
                          
                          if (regainAttackDefenseMode === 'attack') {
                            // W ataku - pokazujemy oppositeXT (wartość pxt) lub liczbę akcji
                            if (regainHeatmapMode === 'count') {
                              currentHeatmap = playerStats?.regainAttackCountHeatmap || new Map<string, number>();
                              currentMode = 'count';
                            } else {
                              currentHeatmap = playerStats?.regainAttackHeatmap || new Map<string, number>();
                              currentMode = 'pxt';
                            }
                          } else if (regainAttackDefenseMode === 'defense') {
                            // W obronie - pokazujemy xTValueStart/xTValueEnd (wartość pxt) lub liczbę akcji
                            if (regainHeatmapMode === 'count') {
                              currentHeatmap = playerStats?.regainDefenseCountHeatmap || new Map<string, number>();
                              currentMode = 'count';
                            } else {
                              currentHeatmap = playerStats?.regainDefenseHeatmap || new Map<string, number>();
                              currentMode = 'pxt';
                            }
                          } else {
                            // Tryb normalny - xT odbiorców lub liczba akcji
                            if (regainHeatmapMode === 'xt') {
                              currentHeatmap = playerStats?.regainHeatmap || new Map<string, number>();
                              currentMode = 'pxt';
                            } else {
                              currentHeatmap = playerStats?.regainActionCountHeatmap || new Map<string, number>();
                              currentMode = 'count';
                            }
                          }
                          
                          // Zastosuj filtr P0-P3 jeśli jest wybrany
                          if (selectedRegainPackingFilter) {
                            currentHeatmap = filterHeatmapByPacking(currentHeatmap, selectedRegainPackingFilter);
                          }
                          
                          return (
                            <div className={styles.heatmapContainer}>
                              <PlayerHeatmapPitch
                                heatmapData={currentHeatmap}
                                category="regains"
                                mode={currentMode}
                                mirrored={false}
                                onZoneClick={(zoneName) => {
                              // Zawsze pokazuj akcje dla klikniętej strefy, niezależnie od trybu
                              // Dla "W ataku" i "W obronie" musimy znaleźć akcje, które mają opposite strefę równą klikniętej strefie
                              if (regainAttackDefenseMode === 'attack' || regainAttackDefenseMode === 'defense') {
                                // Znajdź wszystkie akcje regainów i sprawdź, które mają opposite strefę równą klikniętej
                                const allRegainActions: Action[] = [];
                                playerStats.regainZoneStats?.forEach((actions) => {
                                  allRegainActions.push(...actions);
                                });
                                
                                // Najpierw upewnij się, że to są tylko akcje regainów (nie loses)
                                const onlyRegainActions = allRegainActions.filter((action: any) => {
                                  // Jeśli akcja ma _actionSource, użyj tego (najbardziej niezawodne)
                                  if (action._actionSource) {
                                    return action._actionSource === 'regain';
                                  }
                                  // Fallback: sprawdź pola akcji
                                  const hasRegainFields = action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined;
                                  const isLoses = action.isReaction5s !== undefined || 
                                                 (action.isBelow8s !== undefined && 
                                                  action.playersBehindBall === undefined && 
                                                  action.opponentsBehindBall === undefined);
                                  return hasRegainFields && !isLoses;
                                });
                                
                                const filteredActions = onlyRegainActions.filter((action) => {
                                  if (regainAttackDefenseMode === 'attack') {
                                    // Dla "W ataku" - porównujemy regainAttackZone z klikniętą
                                    const regainAttackZone = action.regainAttackZone || action.oppositeZone;
                                    const oppositeZoneNameStr = regainAttackZone 
                                      ? convertZoneToNameHelper(regainAttackZone)
                                      : (() => {
                                          // Fallback: oblicz z regainDefenseZone
                                          const regainDefenseZone = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                          const actionZoneName = convertZoneToNameHelper(regainDefenseZone);
                                          if (!actionZoneName) return null;
                                          const zoneIndex = zoneNameToIndex(actionZoneName);
                                          if (zoneIndex === null) return null;
                                          const row = Math.floor(zoneIndex / 12);
                                          const col = zoneIndex % 12;
                                          const oppositeRow = 7 - row;
                                          const oppositeCol = 11 - col;
                                          const oppositeIndex = oppositeRow * 12 + oppositeCol;
                                          const oppositeZoneNameData = getZoneName(oppositeIndex);
                                          return oppositeZoneNameData ? zoneNameToString(oppositeZoneNameData) : null;
                                        });
                                    
                                    return oppositeZoneNameStr === zoneName;
                                  } else if (regainAttackDefenseMode === 'defense') {
                                    // Dla "W obronie" - porównujemy regainDefenseZone z klikniętą strefą
                                    // NIE filtrujemy po isAttack - pokazujemy wszystkie akcje dla tej strefy
                                    const regainDefenseZone = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                    const actionZoneName = convertZoneToNameHelper(regainDefenseZone);
                                    return actionZoneName === zoneName;
                                  }
                                  return false;
                                });
                                
                                // Zastosuj filtr P0-P3 jeśli jest wybrany
                                let finalFilteredActions = filteredActions;
                                if (selectedRegainPackingFilter) {
                                  const packingFieldMap: { [key: string]: keyof Action } = {
                                    'P0': 'isP0',
                                    'P1': 'isP1',
                                    'P2': 'isP2',
                                    'P3': 'isP3'
                                  };
                                  const packingField = packingFieldMap[selectedRegainPackingFilter];
                                  if (packingField) {
                                    finalFilteredActions = filteredActions.filter(action => action[packingField] === true);
                                  }
                                }
                                
                                // Zawsze pokazuj akcje, nawet jeśli lista jest pusta (może być pusta, ale panel powinien się pokazać)
                                setRegainZoneActions(finalFilteredActions);
                                setSelectedRegainZone(zoneName);
                              } else {
                                // Dla normalnych trybów używamy standardowej logiki
                                let zoneActions = playerStats.regainZoneStats?.get(zoneName) || [];
                                
                                // Zastosuj filtr P0-P3 jeśli jest wybrany
                                if (selectedRegainPackingFilter) {
                                  const packingFieldMap: { [key: string]: keyof Action } = {
                                    'P0': 'isP0',
                                    'P1': 'isP1',
                                    'P2': 'isP2',
                                    'P3': 'isP3'
                                  };
                                  const packingField = packingFieldMap[selectedRegainPackingFilter];
                                  if (packingField) {
                                    zoneActions = zoneActions.filter(action => action[packingField] === true);
                                  }
                                }
                                
                                setRegainZoneActions(zoneActions);
                                setSelectedRegainZone(zoneName);
                              }
                            }}
                          />
                            </div>
                          );
                        })()}
                        
                        {/* Panel z informacjami o strefie po prawej stronie */}
                        {selectedRegainZone && (
                          <div className={styles.zoneDetailsPanel}>
                            <div className={styles.zoneDetailsHeader}>
                              <h4>Strefa {selectedRegainZone}</h4>
                              <button 
                                className={styles.zoneDetailsClose}
                                onClick={() => {
                                  setRegainZoneActions(null);
                                  setSelectedRegainZone(null);
                                }}
                              >
                                ×
                              </button>
                            </div>
                            <div className={styles.zoneDetailsBody}>
                              <p className={styles.zoneDetailsSubtitle}>
                                Regainy w strefie {selectedRegainZone}:
                              </p>
                              {regainZoneActions && regainZoneActions.length > 0 ? (
                                <div className={styles.zonePlayersList}>
                                {regainZoneActions.map((action, index) => {
                                  // Używamy nowych pól dla regain
                                  const receiverXT = action.regainDefenseXT !== undefined 
                                    ? action.regainDefenseXT 
                                    : (action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0));
                                  const startXT = action.regainDefenseXT !== undefined 
                                    ? action.regainDefenseXT 
                                    : (action.xTValueStart !== undefined ? action.xTValueStart : 0);
                                  const match = filteredMatchesBySeason.find(m => m.matchId === action.matchId);
                                  const matchName = match 
                                    ? `${match.isHome ? match.opponent + ' (D)' : match.opponent + ' (W)'}`
                                    : `Mecz ${action.matchId}`;
                                  
                                  // Określ czy to atak czy obrona - używamy wartości z obiektu
                                  const isAttack = action.isAttack !== undefined 
                                    ? action.isAttack 
                                    : (receiverXT < 0.02); // xT < 0.02 to atak
                                  const isDefense = !isAttack;
                                  
                                  // Używamy regainAttackXT (wartość w ataku) z nowych pól
                                  let oppositeXT = action.regainAttackXT !== undefined 
                                    ? action.regainAttackXT 
                                    : (action.oppositeXT !== undefined 
                                      ? action.oppositeXT 
                                      : (() => {
                                          const regainDefenseZone = action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
                                          const zoneNameStr = convertZoneToNameHelper(regainDefenseZone);
                                          if (zoneNameStr) {
                                            const zoneIndex = zoneNameToIndex(zoneNameStr);
                                            if (zoneIndex !== null) {
                                              return getOppositeXTValueForZone(zoneIndex);
                                            }
                                          }
                                          return 0;
                                        })());
                                  
                                  return (
                                    <div key={`${action.id || action.matchId}-${index}`} className={styles.zonePlayerItem}>
                                      <div className={styles.zonePlayerName}>
                                        <strong>{matchName}</strong>
                                      </div>
                                      <div className={styles.zonePlayerStats}>
                                        <span className={styles.zonePlayerStat}>
                                          <strong>Minuta:</strong> {action.minute}
                                        </span>
                                        {isAttack && (
                                          <>
                                            <span className={styles.zonePlayerStat} style={{ color: '#10b981' }}>
                                              <strong>Atak</strong>
                                            </span>
                                            <span className={styles.zonePlayerStat} style={{ color: '#10b981' }}>
                                              <strong>xT atak:</strong> {oppositeXT.toFixed(3)}
                                            </span>
                                            <span className={styles.zonePlayerStat}>
                                              <strong>xT obrona:</strong> {receiverXT.toFixed(3)}
                                            </span>
                                          </>
                                        )}
                                        {isDefense && (
                                          <>
                                            <span className={styles.zonePlayerStat} style={{ color: '#ef4444' }}>
                                              <strong>Obrona</strong>
                                            </span>
                                            <span className={styles.zonePlayerStat} style={{ color: '#ef4444' }}>
                                              <strong>xT obrona:</strong> {startXT.toFixed(3)}
                                            </span>
                                          </>
                                        )}
                                        <span className={styles.zonePlayerStat}>
                                          <strong>Przeciwnicy za piłką / Partnerzy za piłką:</strong> {action.opponentsBehindBall || 0} / {action.playersBehindBall || 0}
                                        </span>
                                        {action.isBelow8s && (
                                          <span className={styles.zonePlayerStat} style={{ color: '#f59e0b' }}>
                                            <strong>Poniżej 8s</strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                  })}
                                </div>
                              ) : (
                                <p style={{ color: '#6b7280', fontStyle: 'italic', marginTop: '16px' }}>
                                  Brak akcji w tej strefie dla wybranego trybu.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Wykres mecz po meczu */}
                    {(() => {
                      // Oblicz dane mecz po meczu dla regainów
                      const regainMatchData = filteredMatchesBySeason
                        .filter(match => {
                          if (selectedMatchIds.length > 0) {
                            return selectedMatchIds.includes(match.matchId || "");
                          }
                          return true;
                        })
                        .map((match) => {
                          let minutes = 0;
                          if (match.playerMinutes) {
                            const playerMinute = match.playerMinutes.find((pm: any) => pm.playerId === (selectedPlayerForView || player?.id));
                            if (playerMinute) {
                              minutes = playerMinute.startMinute === 0 && playerMinute.endMinute === 0
                                ? 0
                                : playerMinute.endMinute - playerMinute.startMinute + 1;
                            }
                          }
                          
                          const matchRegains = allActions.filter(a => 
                            a.matchId === match.matchId &&
                            a.senderId === (selectedPlayerForView || player?.id) &&
                            (a.isBelow8s !== undefined || a.playersBehindBall !== undefined || a.opponentsBehindBall !== undefined) &&
                            !a.isReaction5s
                          ).length;
                          
                          const matchName = match.isHome 
                            ? `${match.opponent} (D)`
                            : `${match.opponent} (W)`;
                          const matchDate = new Date(match.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
                          
                          // Oblicz xT dla regainów w tym meczu
                          const matchRegainActions = allActions.filter(a => 
                            a.matchId === match.matchId &&
                            a.senderId === (selectedPlayerForView || player?.id) &&
                            (a.isBelow8s !== undefined || a.playersBehindBall !== undefined || a.opponentsBehindBall !== undefined) &&
                            !a.isReaction5s
                          );
                          
                          const matchXT = matchRegainActions.reduce((sum, action: any) => {
                            // Używamy regainDefenseXT (wartość w obronie) jako xT odbiorców
                            const receiverXT = action.regainDefenseXT !== undefined 
                              ? action.regainDefenseXT 
                              : (action.xTValueStart !== undefined ? action.xTValueStart : (action.xTValueEnd !== undefined ? action.xTValueEnd : 0));
                            return sum + receiverXT;
                          }, 0);
                          
                          return {
                            matchId: match.matchId,
                            matchName: `${matchDate} ${matchName}`,
                            regains: matchRegains,
                            xt: matchXT,
                            minutes: minutes,
                            regainsPerMinute: minutes > 0 ? matchRegains / minutes : 0,
                          };
                        })
                        .filter(m => m.minutes > 0)
                        .sort((a, b) => {
                          const matchA = filteredMatchesBySeason.find(m => m.matchId === a.matchId);
                          const matchB = filteredMatchesBySeason.find(m => m.matchId === b.matchId);
                          if (!matchA || !matchB) return 0;
                          return new Date(matchA.date).getTime() - new Date(matchB.date).getTime();
                        });
                      
                      // Przygotuj dane dla wykresu minutowego (co 5 minut)
                      const regainMinuteChartData = (() => {
                        const regainActions = allActions.filter((action: any) => {
                          const isRegain = action._actionSource === 'regain' || 
                            ((action.isBelow8s !== undefined || action.playersBehindBall !== undefined || action.opponentsBehindBall !== undefined) &&
                            !action.isReaction5s && action.senderId === (selectedPlayerForView || player?.id));
                          return isRegain && action.senderId === (selectedPlayerForView || player?.id);
                        });

                        const intervals: { [key: number]: number } = {};
                        
                        regainActions.forEach((action: any) => {
                          const interval = Math.floor(action.minute / 5) * 5;
                          intervals[interval] = (intervals[interval] || 0) + 1;
                        });

                        const data: any[] = [];
                        for (let i = 0; i <= 90; i += 5) {
                          data.push({
                            minute: `${i}-${i + 5}`,
                            minuteValue: i,
                            regains: intervals[i] || 0
                          });
                        }

                        return data;
                      })();

                      if (regainMatchData.length > 0) {
                        return (
                          <>
                            <div className={styles.detailsSection}>
                              <div className={styles.chartHeader}>
                                <h4>Wykres mecz po meczu</h4>
                              </div>
                              <div className={styles.matchChartContainer}>
                                <ResponsiveContainer width="100%" height={300}>
                                  <LineChart data={regainMatchData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
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
                                        value: 'Regainy / xT', 
                                        angle: -90, 
                                        position: 'insideLeft', 
                                        style: { textAnchor: 'middle' } 
                                      }}
                                      stroke="#6b7280"
                                      tick={(props) => {
                                        const { x, y, payload } = props;
                                        const dataPoint = regainMatchData[props.index];
                                        const displayText = dataPoint 
                                          ? `${dataPoint.regains} / ${dataPoint.xt?.toFixed(2) || '0.00'}` 
                                          : `${payload.value}`;
                                        return (
                                          <g transform={`translate(${x},${y})`}>
                                            <text x={0} y={0} dy={4} textAnchor="end" fill="#6b7280" fontSize={11}>
                                              {displayText}
                                            </text>
                                          </g>
                                        );
                                      }}
                                    />
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className={styles.chartTooltip}>
                                              <p><strong>{data.matchName}</strong></p>
                                              <p>Regainy: {data.regains}</p>
                                              <p>xT: {data.xt?.toFixed(3) || '0.000'}</p>
                                              <p>Minuty: {data.minutes}</p>
                                              <p>Regainy/minutę: {data.regainsPerMinute.toFixed(3)}</p>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="regains" 
                                      stroke="#3b82f6" 
                                      strokeWidth={2}
                                      dot={{ 
                                        fill: '#3b82f6', 
                                        strokeWidth: 1, 
                                        r: 4, 
                                        stroke: '#fff'
                                      }}
                                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#3b82f6' }}
                                      name="Regainy"
                                      animationDuration={800}
                                      animationEasing="ease-out"
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="xt" 
                                      stroke="#10b981" 
                                      strokeWidth={2}
                                      dot={{ 
                                        fill: '#10b981', 
                                        strokeWidth: 1, 
                                        r: 4, 
                                        stroke: '#fff'
                                      }}
                                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: '#10b981' }}
                                      name="xT"
                                      animationDuration={800}
                                      animationEasing="ease-out"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                            <div className={styles.detailsSection}>
                              <div className={styles.chartHeader}>
                                <h4>Wykres minutowy</h4>
                              </div>
                              <div className={styles.matchChartContainer}>
                                <ResponsiveContainer width="100%" height={250}>
                                  <LineChart data={regainMinuteChartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
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
                                      label={{ value: 'Regainy', angle: -90, position: 'insideLeft' }}
                                      tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className={styles.chartTooltip}>
                                              <p className={styles.tooltipLabel}>{`Przedział: ${data.minute} min`}</p>
                                              <p style={{ color: '#3b82f6' }}>Regainy: {data.regains}</p>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <Line 
                                      type="monotone" 
                                      dataKey="regains" 
                                      stroke="#3b82f6" 
                                      strokeWidth={2}
                                      dot={{ 
                                        fill: '#3b82f6', 
                                        strokeWidth: 1, 
                                        r: 3, 
                                        stroke: '#fff'
                                      }}
                                      activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#3b82f6' }}
                                      name="Regainy"
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </>
                        );
                      }
                      return null;
                    })()}

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
                            {Object.entries(playerStats.positionStats).map(([position, stats]) => {
                              const positionMatches = Array.from(stats.matchIds || new Set()).map(matchId => {
                                const match = filteredMatchesBySeason.find(m => m.matchId === matchId);
                                return match;
                              }).filter(Boolean) as TeamInfo[];
                              
                              const regainsCount = (stats as any).regainsCount || 0;
                              const posPer90Multiplier = stats.minutes > 0 ? 90 / stats.minutes : 0;
                              const regainsPer90 = regainsCount * posPer90Multiplier;
                              
                              return (
                                <div key={position} className={styles.positionDetails}>
                                  <div className={styles.positionHeader}>
                                    <h5>{position} ({stats.minutes} min)</h5>
                                    {positionMatches.length > 0 && (
                                      <button
                                        className={styles.matchesToggleButton}
                                        onClick={() => setExpandedPositionMatches(expandedPositionMatches === position ? null : position)}
                                      >
                                        {expandedPositionMatches === position ? 'Ukryj' : 'Pokaż'} mecze ({positionMatches.length})
                                      </button>
                                    )}
                                  </div>
                                  {expandedPositionMatches === position && positionMatches.length > 0 && (
                                    <div className={styles.positionMatchesList}>
                                      {positionMatches.map((match) => (
                                        <div key={match.matchId} className={styles.positionMatchItem}>
                                          <span className={styles.matchDate}>
                                            {new Date(match.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                          </span>
                                          <span className={styles.matchOpponent}>
                                            {match.opponent} {match.isHome ? '(D)' : '(W)'}
                                          </span>
                                          <span className={styles.matchCompetition}>{match.competition}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className={styles.detailsRow}>
                                    <span className={styles.detailsLabel}>Regainy</span>
                                    <span className={styles.detailsValue}>
                                      <span className={styles.valueMain}><strong>{regainsCount}</strong> regainów</span>
                                      <span className={styles.valueSecondary}>({regainsPer90.toFixed(1)} / 90 min)</span>
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
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
                // Filtruj akcje między głównym zawodnikiem a wybranym zawodnikiem w wybranej strefie
                const targetPlayerId = selectedPlayerForView || playerId;
                const filteredActions = allActions.filter(action => {
                  // Filtruj według kategorii
                  if (selectedPxtCategory === 'dribbler' && action.actionType !== 'dribble') return false;
                  if (selectedPxtCategory !== 'dribbler' && action.actionType === 'dribble') return false;
                  
                  // Filtruj według zawodników - akcje między głównym zawodnikiem a wybranym zawodnikiem
                  let matchesPlayers = false;
                  if (selectedPxtCategory === 'dribbler') {
                    // Dla dryblingu: wybrany zawodnik wykonuje drybling
                    matchesPlayers = action.senderId === selectedPlayerForModal.playerId;
                  } else if (selectedPxtCategory === 'sender') {
                    // Dla podającego: główny zawodnik podaje, wybrany zawodnik przyjmuje
                    matchesPlayers = action.senderId === targetPlayerId && action.receiverId === selectedPlayerForModal.playerId;
                  } else if (selectedPxtCategory === 'receiver') {
                    // Dla przyjmującego: wybrany zawodnik podaje, główny zawodnik przyjmuje
                    matchesPlayers = action.senderId === selectedPlayerForModal.playerId && action.receiverId === targetPlayerId;
                  }
                  
                  if (!matchesPlayers) return false;
                  
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
                      const match = filteredMatchesBySeason.find(m => m.matchId === action.matchId);
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

      {/* Modal wyboru meczów */}
      {isMatchSelectModalOpen && (
        <div className={styles.matchSelectModalOverlay} onClick={() => setIsMatchSelectModalOpen(false)}>
          <div className={styles.matchSelectModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.matchSelectModalHeader}>
              <h3>Wybierz mecze</h3>
              <button 
                className={styles.matchSelectModalClose}
                onClick={() => setIsMatchSelectModalOpen(false)}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <div className={styles.matchSelectModalBody}>
              <div className={styles.matchSelectModalActions}>
                <button
                  className={styles.matchSelectActionButton}
                  onClick={() => {
                    const allIds = filteredMatchesBySeason
                      .filter(m => m.matchId)
                      .map(m => m.matchId!);
                    setSelectedMatchIds(allIds);
                    setManuallyDeselectedAll(false);
                  }}
                >
                  Zaznacz wszystkie
                </button>
                <button
                  className={styles.matchSelectActionButton}
                  onClick={() => {
                    setSelectedMatchIds([]);
                    setManuallyDeselectedAll(true);
                  }}
                >
                  Odznacz wszystkie
                </button>
              </div>
              <div className={styles.matchSelectMatchesList}>
                {filteredMatchesBySeason.map((match) => {
                  const isSelected = selectedMatchIds.includes(match.matchId || "");
                  return (
                    <div
                      key={match.matchId}
                      className={`${styles.matchSelectTile} ${isSelected ? styles.matchSelectTileActive : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMatchIds(selectedMatchIds.filter(id => id !== match.matchId));
                        } else {
                          setSelectedMatchIds([...selectedMatchIds, match.matchId!]);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (isSelected) {
                            setSelectedMatchIds(selectedMatchIds.filter(id => id !== match.matchId));
                          } else {
                            setSelectedMatchIds([...selectedMatchIds, match.matchId!]);
                          }
                        }
                      }}
                    >
                      <div className={styles.matchSelectMatchInfo}>
                        <span className={styles.matchSelectOpponent}>{match.opponent}</span>
                        <span className={styles.matchSelectDate}>{new Date(match.date).toLocaleDateString('pl-PL')}</span>
                        <span className={styles.matchSelectCompetition}>{match.competition}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal wyboru zawodnika */}
      {isPlayerSelectModalOpen && (
        <div className={styles.playerSelectModalOverlay} onClick={() => setIsPlayerSelectModalOpen(false)}>
          <div className={styles.playerSelectModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.playerSelectModalHeader}>
              <h3>Wybierz zawodnika</h3>
              <button 
                className={styles.playerSelectModalClose}
                onClick={() => setIsPlayerSelectModalOpen(false)}
                aria-label="Zamknij"
              >
                ×
              </button>
            </div>
            <div className={styles.playerSelectModalBody}>
              {playersByPosition.sortedPositions.map((position) => (
                <div key={position} className={styles.playerSelectPositionGroup}>
                  <div className={styles.playerSelectPlayersList}>
                    <div className={styles.playerSelectPositionLabel}>
                      {position === 'Skrzydłowi' ? 'W' : position}
                    </div>
                    <div className={styles.playerSelectPlayersContainer}>
                      {playersByPosition.byPosition[position].map((player) => (
                        <button
                          key={player.id}
                          className={`${styles.playerSelectPlayerItem} ${selectedPlayerForView === player.id ? styles.playerSelectPlayerItemActive : ''}`}
                          onClick={() => handlePlayerSelect(player.id)}
                        >
                          <div className={styles.playerSelectPlayerItemContent}>
                            {player.number && (
                              <span className={styles.playerSelectPlayerNumber}>{player.number}</span>
                            )}
                            <span className={styles.playerSelectPlayerName}>{getPlayerFullName(player)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

