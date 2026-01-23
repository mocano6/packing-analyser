"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Shot, Player, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./ShotModal.module.css";

export interface ShotModalProps {
  isOpen: boolean;
  isVideoInternal?: boolean;
  onClose: () => void;
  onSave: (shot: Omit<Shot, "id" | "timestamp">) => void;
  onDelete?: (shotId: string) => void;
  editingShot?: Shot;
  x: number;
  y: number;
  xG: number;
  matchId: string;
  players: Player[];
  matchInfo?: TeamInfo | null;
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
  onGetVideoTime?: () => Promise<number>; // Funkcja do pobierania surowego czasu z wideo w sekundach
  shots?: Shot[]; // Tablica wszystkich strzałów w meczu (dla dobitki)
}

const ShotModal: React.FC<ShotModalProps> = ({
  isOpen,
  isVideoInternal = false,
  onClose,
  onSave,
  onDelete,
  editingShot,
  x,
  y,
  xG,
  matchId,
  players,
  matchInfo,
  onCalculateMinuteFromVideo,
  onGetVideoTime,
  shots = [],
}) => {
  const [formData, setFormData] = useState({
    playerId: "",
    playerName: "",
    minute: 1,
    xG: 0,
    bodyPart: "foot" as "foot" | "head" | "other",
    shotType: "on_target" as "on_target" | "off_target" | "blocked" | "goal",
    teamContext: "attack" as "attack" | "defense",
    teamId: "",
    actionType: "open_play" as "open_play" | "counter" | "corner" | "free_kick" | "direct_free_kick" | "penalty" | "throw_in" | "regain",
    actionCategory: "open_play" as "open_play" | "sfg",
    sfgSubtype: "direct" as "direct" | "combination",
    actionPhase: "phase1" as "phase1" | "phase2",
    blockingPlayers: [] as string[],
    linePlayers: [] as string[],
    linePlayersCount: 0,
    pkPlayersCount: 0,
    isP1Active: true,
    isP2Active: false,
    isContact1: false,
    isContact2: false,
    isContact3Plus: false,
    assistantId: "",
    assistantName: "",
    isControversial: false,
    previousShotId: "",
    isFromPK: false,
  });
  const isEditMode = Boolean(editingShot);
  const [videoTimeMMSS, setVideoTimeMMSS] = useState<string>("00:00"); // Czas wideo w formacie MM:SS
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null); // Aktualna minuta meczu
  const [controversyNote, setControversyNote] = useState<string>(""); // Notatka dotycząca kontrowersyjnej akcji

  // Funkcje pomocnicze do konwersji czasu
  const secondsToMMSS = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mmssToSeconds = (mmss: string): number => {
    // Kompatybilność wsteczna: obsługa starego formatu (tylko minuty) i nowego (MM:SS)
    if (!mmss || mmss.trim() === '') return 0;
    
    // Jeśli nie ma dwukropka, traktuj jako minuty (stary format)
    if (!mmss.includes(':')) {
      const mins = parseInt(mmss, 10);
      if (isNaN(mins)) return 0;
      return mins * 60; // Konwertuj minuty na sekundy
    }
    
    // Nowy format MM:SS
    const [mins, secs] = mmss.split(':').map(Number);
    if (isNaN(mins)) return 0;
    if (isNaN(secs)) return mins * 60; // Jeśli sekundy są niepoprawne, traktuj jako minuty
    return mins * 60 + secs;
  };

  // Refs do śledzenia poprzednich wartości, aby uniknąć nadpisywania podczas edycji
  const prevVideoTimestampRawRef = useRef<number | undefined>(undefined);
  const prevVideoTimestampRef = useRef<number | undefined>(undefined);
  const prevEditingShotIdRef = useRef<string | undefined>(undefined);

  // Pobieranie czasu z wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingShot) {
        // W trybie edycji - używamy zapisanego czasu z akcji
        let savedTime: number | undefined;
        if (editingShot.videoTimestampRaw !== undefined && editingShot.videoTimestampRaw !== null) {
          savedTime = editingShot.videoTimestampRaw;
        } else if (editingShot.videoTimestamp !== undefined && editingShot.videoTimestamp !== null) {
          // Jeśli mamy tylko videoTimestamp (z korektą -10s), dodajemy 10 sekund z powrotem
          savedTime = editingShot.videoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          setVideoTimeMMSS(secondsToMMSS(savedTime));
          // Zaktualizuj refs przy pierwszym otwarciu
          prevVideoTimestampRawRef.current = editingShot.videoTimestampRaw;
          prevVideoTimestampRef.current = editingShot.videoTimestamp;
          prevEditingShotIdRef.current = editingShot.id;
        } else if (onGetVideoTime) {
          // Jeśli nie ma zapisanego czasu, spróbuj pobrać z wideo
          onGetVideoTime().then((time) => {
            if (time >= 0) {
              setVideoTimeMMSS(secondsToMMSS(time));
            }
          }).catch((error) => {
            console.warn('Nie udało się pobrać czasu z wideo:', error);
          });
        }
      } else if (!isEditMode && onGetVideoTime) {
        // W trybie dodawania - pobieramy aktualny czas z wideo
        onGetVideoTime().then((time) => {
          if (time >= 0) {
            setVideoTimeMMSS(secondsToMMSS(time));
          }
        }).catch((error) => {
          console.warn('Nie udało się pobrać czasu z wideo:', error);
        });
      }
    } else {
      // Reset refs gdy modal się zamyka
      prevVideoTimestampRawRef.current = undefined;
      prevVideoTimestampRef.current = undefined;
      prevEditingShotIdRef.current = undefined;
    }
  }, [isOpen, isEditMode, editingShot?.id, editingShot?.videoTimestampRaw, editingShot?.videoTimestamp, onGetVideoTime]);

  // Dodatkowy useEffect do aktualizacji videoTimeMMSS gdy editingShot się zmienia (np. po zapisaniu)
  useEffect(() => {
    if (isOpen && isEditMode && editingShot) {
      const currentVideoTimestampRaw = editingShot.videoTimestampRaw;
      const currentVideoTimestamp = editingShot.videoTimestamp;
      const currentShotId = editingShot.id;
      
      // Sprawdź czy to nowy strzał (zmiana ID) lub czy wartości się zmieniły
      const isNewShot = currentShotId !== prevEditingShotIdRef.current;
      const hasChanged = 
        isNewShot ||
        currentVideoTimestampRaw !== prevVideoTimestampRawRef.current ||
        currentVideoTimestamp !== prevVideoTimestampRef.current;
      
      if (hasChanged) {
        let savedTime: number | undefined;
        if (currentVideoTimestampRaw !== undefined && currentVideoTimestampRaw !== null) {
          savedTime = currentVideoTimestampRaw;
        } else if (currentVideoTimestamp !== undefined && currentVideoTimestamp !== null) {
          savedTime = currentVideoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          const newTimeMMSS = secondsToMMSS(savedTime);
          setVideoTimeMMSS(newTimeMMSS);
        }
        
        // Zaktualizuj refs
        prevVideoTimestampRawRef.current = currentVideoTimestampRaw;
        prevVideoTimestampRef.current = currentVideoTimestamp;
        prevEditingShotIdRef.current = currentShotId;
      }
    }
  }, [isOpen, isEditMode, editingShot?.id, editingShot?.videoTimestampRaw, editingShot?.videoTimestamp]);

  // Aktualizacja aktualnej minuty meczu na podstawie czasu wideo
  useEffect(() => {
    if (isOpen && onCalculateMinuteFromVideo && !isEditMode) {
      const updateMatchMinute = async () => {
        const result = await onCalculateMinuteFromVideo();
        if (result !== null && result.minute > 0) {
          setCurrentMatchMinute(result.minute);
        }
      };
      updateMatchMinute();
      // Aktualizuj co sekundę
      const interval = setInterval(updateMatchMinute, 1000);
      return () => clearInterval(interval);
    } else if (isEditMode && editingShot) {
      // W trybie edycji - używamy minuty z akcji
      setCurrentMatchMinute(editingShot.minute);
    }
  }, [isOpen, isEditMode, editingShot, onCalculateMinuteFromVideo]);

  // Filtrowanie zawodników grających w danym meczu (podobnie jak w ActionModal)
  const filteredPlayers = useMemo(() => {
    if (!matchInfo) return players;

    // Filtruj zawodników należących do zespołu
    const teamPlayers = players.filter(player => 
      player.teams?.includes(matchInfo.team)
    );

    // Filtruj tylko zawodników z co najmniej 1 minutą rozegranych w tym meczu
    const playersWithMinutes = teamPlayers.filter(player => {
      const playerMinutes = matchInfo.playerMinutes?.find(pm => pm.playerId === player.id);
      
      if (!playerMinutes) {
        return false; // Jeśli brak danych o minutach, nie pokazuj zawodnika
      }

      // Oblicz czas gry
      const playTime = playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
        ? 0
        : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

      return playTime >= 1; // Pokazuj tylko zawodników z co najmniej 1 minutą
    });

    return playersWithMinutes;
  }, [players, matchInfo]);

  // Filtrowanie bramkarzy dla obrony
  const filteredGoalkeepers = useMemo(() => {
    if (!matchInfo || formData.teamContext !== "defense") return [];
    
    return filteredPlayers.filter(player => 
      player.position === "GK" || player.position === "Bramkarz"
    );
  }, [filteredPlayers, matchInfo, formData.teamContext]);

  // Funkcja do grupowania zawodników według pozycji
  const getPlayersByPosition = (playersList: Player[]) => {
    const byPosition = playersList.reduce((acc, player) => {
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
    }, {} as Record<string, typeof playersList>);
    
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
    sortedPositions.forEach(position => {
      byPosition[position].sort((a, b) => {
        const getLastName = (name: string) => {
          const words = name.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(a.name || '');
        const lastNameB = getLastName(b.name || '');
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  };

  // Znajdź bramkarza z największą liczbą minut
  const defaultGoalkeeper = useMemo(() => {
    if (filteredGoalkeepers.length === 0) return null;
    
    return filteredGoalkeepers.reduce((max, current) => {
      const currentMinutes = matchInfo?.playerMinutes?.find(pm => pm.playerId === current.id);
      const maxMinutes = matchInfo?.playerMinutes?.find(pm => pm.playerId === max.id);
      
      const currentTime = currentMinutes ? currentMinutes.endMinute - currentMinutes.startMinute + 1 : 0;
      const maxTime = maxMinutes ? maxMinutes.endMinute - maxMinutes.startMinute + 1 : 0;
      
      return currentTime > maxTime ? current : max;
    });
  }, [filteredGoalkeepers, matchInfo]);

  // Filtrowanie zawodników blokujących (wszyscy oprócz bramkarzy)
  const filteredBlockingPlayers = useMemo(() => {
    if (!matchInfo || formData.teamContext !== "defense") return [];
    
    return filteredPlayers.filter(player => 
      player.position !== "GK" && player.position !== "Bramkarz"
    );
  }, [filteredPlayers, matchInfo, formData.teamContext]);

  // Automatycznie ustaw sugerowaną wartość minuty i połowy na podstawie czasu wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen && !editingShot && onCalculateMinuteFromVideo) {
      onCalculateMinuteFromVideo().then((result) => {
        if (result !== null && result.minute > 0) {
          setFormData(prev => ({
            ...prev,
            minute: result.minute,
            isP1Active: !result.isSecondHalf,
            isP2Active: result.isSecondHalf,
          }));
        }
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
      });
    }
  }, [isOpen, editingShot, onCalculateMinuteFromVideo]);

  useEffect(() => {
    if (editingShot) {
      setFormData({
        playerId: editingShot.playerId || "",
        playerName: editingShot.playerName || "",
        minute: editingShot.minute,
        // Odwróć modyfikatory, aby uzyskać bazowe xG (przed modyfikatorami)
        xG: reverseFinalXG(Math.round(editingShot.xG * 100), editingShot),
        bodyPart: editingShot.bodyPart || "foot",
        shotType: editingShot.isGoal ? "goal" : (editingShot.shotType || "on_target"),
        teamContext: editingShot.teamContext || "attack",
        teamId: editingShot.teamId || "",
        actionType: editingShot.actionType || "open_play",
        actionCategory: editingShot.actionType && ["corner", "free_kick", "direct_free_kick", "penalty", "throw_in"].includes(editingShot.actionType) ? "sfg" : "open_play",
        sfgSubtype: (editingShot as any)?.sfgSubtype || "direct",
        actionPhase: (editingShot as any)?.actionPhase || "phase1",
        blockingPlayers: editingShot.blockingPlayers || [],
        linePlayers: (editingShot as any)?.linePlayers || [],
        linePlayersCount: (editingShot as any)?.linePlayersCount || 0,
        pkPlayersCount: (editingShot as any)?.pkPlayersCount || 1,
        isP1Active: (editingShot as any)?.pkPlayersCount === 1 || (editingShot as any)?.pkPlayersCount === 2 ? false : true,
        isP2Active: (editingShot as any)?.pkPlayersCount === 2 || false,
        isContact1: editingShot.isContact1 || false,
        isContact2: editingShot.isContact2 || false,
        isContact3Plus: editingShot.isContact3Plus || false,
        assistantId: (editingShot as any)?.assistantId || "",
        assistantName: (editingShot as any)?.assistantName || "",
        isControversial: editingShot.isControversial || false,
        previousShotId: editingShot.previousShotId || "",
        isFromPK: (editingShot as any)?.isFromPK || false,
      });
      setControversyNote(editingShot.controversyNote || "");
    } else {
      // Automatyczne wykrywanie kontekstu zespołu na podstawie pozycji
      // Lewa strona boiska (x < 50%) = obrona, prawa strona (x >= 50%) = atak
      const autoTeamContext = x < 50 ? "defense" : "attack";
      const autoTeamId = autoTeamContext === "defense" ? matchInfo?.opponent : matchInfo?.team;
      
      setFormData({
        playerId: "",
        playerName: "",
        minute: 1,
        xG: Math.round(xG * 100), // Konwersja z ułamka na całe procenty
        bodyPart: "foot",
        shotType: "on_target",
        teamContext: autoTeamContext,
        teamId: autoTeamId || "",
        actionType: "open_play",
        actionCategory: "open_play",
        sfgSubtype: "direct",
        actionPhase: "phase1",
        blockingPlayers: [],
        linePlayers: [],
        linePlayersCount: 0,
        pkPlayersCount: 1,
        isP1Active: true,
        isP2Active: false,
        isContact1: false,
        isContact2: false,
        isContact3Plus: false,
        assistantId: "",
        assistantName: "",
        isControversial: false,
        previousShotId: "",
        isFromPK: false,
      });
    }
  }, [editingShot, isOpen, matchInfo, xG, x]);

  // Ustaw domyślnego bramkarza gdy zmienia się na obronę
  useEffect(() => {
    if (formData.teamContext === "defense" && defaultGoalkeeper && !formData.playerId) {
      setFormData(prev => ({
        ...prev,
        playerId: defaultGoalkeeper.id,
        playerName: `${defaultGoalkeeper.firstName} ${defaultGoalkeeper.lastName}`,
      }));
    }
  }, [formData.teamContext, defaultGoalkeeper, formData.playerId]);

  const handlePlayerSelect = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    setFormData({
      ...formData,
      playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : "",
    });
  };

  const handleAssistantSelect = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    setFormData({
      ...formData,
      assistantId: playerId,
      assistantName: player ? `${player.firstName} ${player.lastName}` : "",
    });
  };

  const handleShotTypeSelect = (shotType: "on_target" | "off_target" | "blocked" | "goal") => {
    setFormData(prev => ({
      ...prev,
      shotType,
      // Dla strzałów zablokowanych zachowujemy informacje o blokujących,
      // dla pozostałych typów czyścimy tylko dane stricte związane z blokadą.
      blockingPlayers: shotType === "blocked" ? prev.blockingPlayers : [],
      linePlayers: shotType === "blocked" ? prev.linePlayers : [],
      linePlayersCount: shotType === "blocked" ? prev.linePlayersCount : 0,
      // NIE zmieniamy pkPlayersCount ani wyboru 1P/2P przy zmianie typu strzału
    }));
  };

  const handleTeamContextChange = (teamContext: "attack" | "defense") => {
    setFormData({
      ...formData,
      teamContext,
      playerId: "", // Reset wyboru zawodnika przy zmianie kontekstu
      playerName: "",
      blockingPlayers: [], // Reset zawodników blokujących
      linePlayers: [], // Reset zawodników na linii
      linePlayersCount: 0, // Reset liczby zawodników na linii
      pkPlayersCount: 1, // Reset liczby zawodników w PK
      isP1Active: true,
      isP2Active: false,
    });
  };

  const handleBlockingPlayerToggle = (playerId: string) => {
    setFormData(prev => ({
      ...prev,
      blockingPlayers: prev.blockingPlayers.includes(playerId)
        ? [] // Usuń wybór jeśli już zaznaczony
        : [playerId] // Wybierz tylko tego zawodnika (jeden na raz)
    }));
  };

  const handleLinePlayerToggle = (playerId: string) => {
    setFormData(prev => ({
      ...prev,
      linePlayers: prev.linePlayers.includes(playerId)
        ? prev.linePlayers.filter(id => id !== playerId) // Usuń z listy
        : [...prev.linePlayers, playerId] // Dodaj do listy
    }));
  };

  // Funkcja pomocnicza do budowania łańcucha dobitek dla wyświetlenia
  // Funkcja odwracająca modyfikatory xG (używana przy ładowaniu edytowanego strzału)
  const reverseFinalXG = (finalXG: number, shot: Shot): number => {
    let baseXG = finalXG;
    
    // Odwróć obniżenie o 27% dla strzałów głową lub inną częścią ciała
    if (shot.bodyPart === "head" || shot.bodyPart === "other") {
      baseXG = baseXG / 0.73; // Odwróć * 0.73
    }
    
    // Odwróć modyfikację dla dobitki
    if (shot.previousShotId) {
      const shotChain: Shot[] = [];
      const visitedIds = new Set<string>(); // Zabezpieczenie przed cyklicznymi referencjami
      let currentShotId: string | undefined = shot.previousShotId;
      const maxDepth = 100; // Maksymalna głębokość łańcucha
      
      let depth = 0;
      while (currentShotId && depth < maxDepth) {
        // Sprawdź czy nie ma cyklicznej referencji
        if (visitedIds.has(currentShotId)) {
          console.warn(`Cyclic reference detected in reverseFinalXG: ${currentShotId}`);
          break;
        }
        
        visitedIds.add(currentShotId);
        
        const prevShot = shots.find(s => s.id === currentShotId);
        if (!prevShot) break;
        shotChain.push(prevShot);
        currentShotId = prevShot.previousShotId;
        depth++;
      }
      
      if (depth >= maxDepth) {
        console.warn(`Maximum chain depth reached in reverseFinalXG for shot: ${shot.id}`);
      }
      
      // Odwróć: xG_dobitki = xG_base * (1 - xG_prev1/100) * (1 - xG_prev2/100) * ...
      // Więc: xG_base = xG_dobitki / ((1 - xG_prev1/100) * (1 - xG_prev2/100) * ...)
      let remainingProbability = 1;
      for (const chainShot of shotChain.reverse()) {
        const chainXG = chainShot.xG * 100;
        remainingProbability *= (1 - chainXG / 100);
      }
      if (remainingProbability > 0) {
        baseXG = baseXG / remainingProbability;
      }
    }
    
    // Odwróć mnożenie przez 1.65 dla bezpośredni wolny + bezpośredni SFG
    if (shot.actionType === "direct_free_kick" && (shot as any)?.sfgSubtype === "direct") {
      baseXG = baseXG / 1.65;
    }
    
    // Odwróć obniżenie za zawodników na linii
    if (shot.teamContext === "defense") {
      const linePlayers = (shot as any)?.linePlayers || [];
      baseXG += linePlayers.length;
    } else if (shot.teamContext === "attack") {
      const linePlayersCount = (shot as any)?.linePlayersCount || 0;
      baseXG += linePlayersCount;
    }
    
    return Math.max(1, Math.round(baseXG)); // Minimum 1%, zaokrąglij do całej liczby
  };

  const getShotChain = (shotId: string): Shot[] => {
    const chain: Shot[] = [];
    const visitedIds = new Set<string>(); // Zabezpieczenie przed cyklicznymi referencjami
    let currentShotId: string | undefined = shotId;
    const maxDepth = 100; // Maksymalna głębokość łańcucha (zabezpieczenie)
    
    let depth = 0;
    while (currentShotId && depth < maxDepth) {
      // Sprawdź czy nie ma cyklicznej referencji
      if (visitedIds.has(currentShotId)) {
        console.warn(`Cyclic reference detected in shot chain: ${currentShotId}`);
        break;
      }
      
      visitedIds.add(currentShotId);
      
      const shot = shots.find(s => s.id === currentShotId);
      if (!shot) break;
      
      chain.push(shot);
      currentShotId = shot.previousShotId;
      depth++;
    }
    
    if (depth >= maxDepth) {
      console.warn(`Maximum chain depth reached for shot: ${shotId}`);
    }
    
    return chain.reverse(); // Odwróć, aby pokazać od pierwszego do ostatniego
  };

  // Funkcja do formatowania tekstu strzału z łańcuchem dobitek
  const formatShotLabel = (shot: Shot): string => {
    const chain = getShotChain(shot.id);
    if (chain.length > 1) {
      // Jeśli jest łańcuch, pokaż go
      const chainText = chain.map(s => `${s.minute}'`).join(' → ');
      return `${chainText} | ${shot.playerName || "Brak"} | xG: ${Math.round(shot.xG * 100)}%`;
    }
    return `${shot.minute}' | ${shot.playerName || "Brak"} | xG: ${Math.round(shot.xG * 100)}%`;
  };

  const handlePreviousShotSelect = (shotId: string) => {
    setFormData({
      ...formData,
      previousShotId: shotId,
    });
  };

  // Oblicz finalny xG z uwzględnieniem zawodników na linii, SFG bezpośredni, dobitki i części ciała
  const calculateFinalXG = () => {
    let finalXG = formData.xG;
    
    // Każdy zawodnik na linii obniża xG o 1%
    if (formData.teamContext === "defense") {
      finalXG -= formData.linePlayers.length;
    } else if (formData.teamContext === "attack") {
      finalXG -= formData.linePlayersCount || 0;
    }
    
    // Mnożenie przez 1.65 tylko dla bezpośredni wolny + bezpośredni SFG
    if (formData.actionType === "direct_free_kick" && formData.sfgSubtype === "direct") {
      finalXG *= 1.65;
    }
    
    // Oblicz xG dla dobitki: p2 * (1-p1) gdzie p1 to poprzedni strzał
    // Obsługujemy łańcuch dobitek: p3 * (1-p2) * (1-p1), itd.
    if (formData.previousShotId) {
      // Znajdź poprzedni strzał i wszystkie poprzedzające go w łańcuchu
      const shotChain: Shot[] = [];
      const visitedIds = new Set<string>(); // Zabezpieczenie przed cyklicznymi referencjami
      let currentShotId: string | undefined = formData.previousShotId;
      const maxDepth = 100; // Maksymalna głębokość łańcucha
      
      let depth = 0;
      while (currentShotId && depth < maxDepth) {
        // Sprawdź czy nie ma cyklicznej referencji
        if (visitedIds.has(currentShotId)) {
          console.warn(`Cyclic reference detected in calculateFinalXG: ${currentShotId}`);
          break;
        }
        
        visitedIds.add(currentShotId);
        
        const prevShot = shots.find(s => s.id === currentShotId);
        if (!prevShot) break;
        shotChain.push(prevShot);
        currentShotId = prevShot.previousShotId;
        depth++;
      }
      
      if (depth >= maxDepth) {
        console.warn(`Maximum chain depth reached in calculateFinalXG`);
      }
      
      // Oblicz xG dla dobitki: xG_dobitki = xG_current * (1 - xG_prev1/100) * (1 - xG_prev2/100) * ...
      // gdzie xG jest w procentach
      let remainingProbability = 1;
      for (const chainShot of shotChain.reverse()) {
        const chainXG = chainShot.xG * 100; // Konwersja z ułamka na procenty
        remainingProbability *= (1 - chainXG / 100);
      }
      finalXG = finalXG * remainingProbability;
    }
    
    // Obniżenie o 27% dla strzałów głową lub inną częścią ciała
    if (formData.bodyPart === "head" || formData.bodyPart === "other") {
      finalXG *= 0.73; // -27% = * 0.73
    }
    
    return Math.max(1, Math.round(finalXG)); // Minimum 1%, zaokrąglij do całej liczby
  };

  const handleActionCategoryChange = (category: "open_play" | "sfg") => {
    setFormData(prev => ({
      ...prev,
      actionCategory: category,
      actionType: category === "open_play" ? "open_play" : "corner", // Reset to default for category
      actionPhase: category === "sfg" ? "phase1" : prev.actionPhase, // Reset phase for SFG
    }));
  };

  const getAvailableActionTypes = (): Array<{value: string, label: string}> => {
    if (formData.actionCategory === "sfg") {
      return [
        { value: "corner", label: "Rożny" },
        { value: "free_kick", label: "Wolny" },
        { value: "direct_free_kick", label: "Bezpośredni wolny" },
        { value: "penalty", label: "Karny" },
        { value: "throw_in", label: "Rzut za autu" }
      ];
    } else {
      return [
        { value: "open_play", label: "Budowanie (open play)" },
        { value: "regain", label: "Regain" }
      ];
    }
  };

  const getSfgSubtypes = (): Array<{value: string, label: string}> => {
    return [
      { value: "direct", label: "Bezpośredni" },
      { value: "combination", label: "Kombinacyjny" }
    ];
  };

  const getActionPhases = (): Array<{value: string, label: string}> => {
    return [
      { value: "phase1", label: "I faza" },
      { value: "phase2", label: "II faza" }
    ];
  };

  const handleVideoTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Kompatybilność wsteczna: pozwól na format MM:SS lub tylko liczby (minuty)
    const partialPattern = /^([0-9]?[0-9]?)?(:([0-5]?[0-9]?)?)?$/;
    const fullPattern = /^([0-9]{1,2}):([0-5][0-9])$/;
    const minutesOnlyPattern = /^[0-9]{1,3}$/; // Stary format: tylko minuty (1-999)
    
    if (value === '' || partialPattern.test(value) || fullPattern.test(value) || minutesOnlyPattern.test(value)) {
      setVideoTimeMMSS(value);
    }
  };

  const handleVideoTimeBlur = () => {
    // Upewnij się, że format jest poprawny
    const fullPattern = /^([0-9]{1,2}):([0-5][0-9])$/;
    
    if (!fullPattern.test(videoTimeMMSS)) {
      // Kompatybilność wsteczna: jeśli to tylko liczba (stary format - minuty), konwertuj na MM:SS
      if (!videoTimeMMSS.includes(':') && /^[0-9]{1,3}$/.test(videoTimeMMSS)) {
        const mins = parseInt(videoTimeMMSS, 10);
        if (!isNaN(mins) && mins >= 0) {
          // Konwertuj minuty na format MM:SS (sekundy = 0)
          const formatted = `${Math.min(99, mins).toString().padStart(2, '0')}:00`;
          setVideoTimeMMSS(formatted);
          return;
        }
      }
      
      // Próbuj naprawić format - sprawdź czy jest dwukropek
      if (videoTimeMMSS.includes(':')) {
        const parts = videoTimeMMSS.split(':');
        let mins = parseInt(parts[0] || '0', 10);
        let secs = parseInt(parts[1] || '0', 10);
        
        // Walidacja i korekta wartości
        if (isNaN(mins)) mins = 0;
        if (isNaN(secs)) secs = 0;
        
        // Ograniczenia: minuty 0-99 (dla kompatybilności), sekundy 0-59
        mins = Math.max(0, Math.min(99, mins));
        secs = Math.max(0, Math.min(59, secs));
        
        // Formatuj z zerami wiodącymi
        const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        setVideoTimeMMSS(formatted);
        return;
      }
      
      // Jeśli nie ma dwukropka lub format jest całkowicie niepoprawny, przywróć poprzednią wartość
      if (isEditMode && editingShot) {
        // W trybie edycji - przywróć zapisany czas
        let savedTime: number | undefined;
        if (editingShot.videoTimestampRaw !== undefined && editingShot.videoTimestampRaw !== null) {
          savedTime = editingShot.videoTimestampRaw;
        } else if (editingShot.videoTimestamp !== undefined && editingShot.videoTimestamp !== null) {
          savedTime = editingShot.videoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          setVideoTimeMMSS(secondsToMMSS(savedTime));
        } else if (onGetVideoTime) {
          onGetVideoTime().then((time) => {
            if (time >= 0) {
              setVideoTimeMMSS(secondsToMMSS(time));
            }
          });
        }
      } else if (onGetVideoTime) {
        // W trybie dodawania - pobierz z wideo
        onGetVideoTime().then((time) => {
          if (time >= 0) {
            setVideoTimeMMSS(secondsToMMSS(time));
          }
        });
      } else {
        // Jeśli nie ma żadnej wartości, ustaw domyślną
        setVideoTimeMMSS('00:00');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.playerId) {
      alert("Wybierz zawodnika z listy");
      return;
    }

    // Walidacja i normalizacja formatu czasu wideo przed zapisem (z kompatybilnością wsteczną)
    const fullPattern = /^([0-9]{1,2}):([0-5][0-9])$/;
    const minutesOnlyPattern = /^[0-9]{1,3}$/;
    
    // Normalizuj wartość - konwertuj stary format (tylko minuty) na MM:SS
    let normalizedVideoTime = videoTimeMMSS;
    if (minutesOnlyPattern.test(videoTimeMMSS) && !videoTimeMMSS.includes(':')) {
      // Stary format: tylko minuty - konwertuj na MM:SS
      const mins = parseInt(videoTimeMMSS, 10);
      if (!isNaN(mins) && mins >= 0) {
        normalizedVideoTime = `${Math.min(99, mins).toString().padStart(2, '0')}:00`;
        // Zaktualizuj state dla przyszłości
        setVideoTimeMMSS(normalizedVideoTime);
      }
    } else if (!fullPattern.test(videoTimeMMSS)) {
      // Jeśli format jest niepoprawny, spróbuj naprawić
      if (videoTimeMMSS.includes(':')) {
        // Próbuj naprawić format z dwukropkiem
        const parts = videoTimeMMSS.split(':');
        let mins = parseInt(parts[0] || '0', 10);
        let secs = parseInt(parts[1] || '0', 10);
        
        if (isNaN(mins)) mins = 0;
        if (isNaN(secs)) secs = 0;
        
        mins = Math.max(0, Math.min(99, mins));
        secs = Math.max(0, Math.min(59, secs));
        
        normalizedVideoTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        setVideoTimeMMSS(normalizedVideoTime);
      } else {
        alert("Niepoprawny format czasu wideo. Użyj formatu MM:SS (np. 65:03) lub tylko minuty (np. 65)");
        handleVideoTimeBlur();
        return;
      }
    }

    // Zapisz videoTimestamp z pola MM:SS do localStorage
    const videoTimeSeconds = mmssToSeconds(normalizedVideoTime);
    if (videoTimeSeconds >= 0) {
      // Zapisujemy surowy czas (videoTimestampRaw) - bez korekty (może być 0)
      localStorage.setItem('tempVideoTimestampRaw', videoTimeSeconds.toString());
      // Zapisujemy czas z korektą -10s (videoTimestamp) - maksymalnie do 0, nie może być poniżej 0
      const correctedTime = Math.max(0, videoTimeSeconds - 10);
      localStorage.setItem('tempVideoTimestamp', correctedTime.toString());
    } else if (isEditMode && editingShot?.videoTimestamp !== undefined) {
      // W trybie edycji, jeśli pole jest puste lub niepoprawne, zachowaj istniejący timestamp
      localStorage.setItem('tempVideoTimestamp', editingShot.videoTimestamp.toString());
      if (editingShot.videoTimestampRaw !== undefined) {
        localStorage.setItem('tempVideoTimestampRaw', editingShot.videoTimestampRaw.toString());
      }
    }

    // Pobierz czas wideo z localStorage
    const videoTimestamp = typeof window !== 'undefined' 
      ? localStorage.getItem('tempVideoTimestamp') 
      : null;
    const parsedVideoTimestamp = videoTimestamp !== null && videoTimestamp !== '' 
      ? parseInt(videoTimestamp, 10) 
      : undefined;
    const isValidTimestamp = parsedVideoTimestamp !== undefined && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp >= 0;

    const videoTimestampRaw = typeof window !== 'undefined'
      ? localStorage.getItem('tempVideoTimestampRaw')
      : null;
    const parsedVideoTimestampRaw = videoTimestampRaw !== null && videoTimestampRaw !== ''
      ? parseInt(videoTimestampRaw, 10)
      : undefined;
    const isValidTimestampRaw = parsedVideoTimestampRaw !== undefined && !isNaN(parsedVideoTimestampRaw) && parsedVideoTimestampRaw >= 0;

    // W trybie edycji używamy nowych wartości z localStorage, jeśli są dostępne, w przeciwnym razie starych z editingShot
    const finalVideoTimestamp = isEditMode
      ? (isValidTimestamp ? parsedVideoTimestamp : editingShot?.videoTimestamp)
      : (isValidTimestamp ? parsedVideoTimestamp : undefined);

    const finalVideoTimestampRaw = isEditMode
      ? (isValidTimestampRaw ? parsedVideoTimestampRaw : (editingShot as any)?.videoTimestampRaw)
      : (isValidTimestampRaw ? parsedVideoTimestampRaw : undefined);

    const finalXG = calculateFinalXG();
    const lockedMinute = editingShot ? editingShot.minute : formData.minute;
    
    onSave({
      x: editingShot ? editingShot.x : x,
      y: editingShot ? editingShot.y : y,
      xG: finalXG / 100, // Konwersja z procentów na ułamek
      playerId: formData.playerId,
      playerName: formData.playerName,
      minute: lockedMinute,
      isGoal: formData.shotType === "goal",
      bodyPart: formData.bodyPart,
      shotType: formData.shotType === "goal" ? "on_target" : formData.shotType,
      teamContext: formData.teamContext,
      teamId: formData.teamId,
      actionType: formData.actionType,
      sfgSubtype: formData.sfgSubtype,
      actionPhase: formData.actionCategory === "sfg" ? formData.actionPhase : undefined,
      blockingPlayers: formData.blockingPlayers,
      linePlayers: formData.linePlayers,
      linePlayersCount: formData.linePlayersCount,
      pkPlayersCount: formData.isP1Active ? 1 : formData.isP2Active ? 2 : 0,
      isContact1: formData.isContact1,
      isContact2: formData.isContact2,
      isContact3Plus: formData.isContact3Plus,
      assistantId: formData.assistantId || undefined,
      assistantName: formData.assistantName || undefined,
      isControversial: formData.isControversial,
      controversyNote: formData.isControversial && controversyNote.trim() ? controversyNote.trim() : undefined,
      previousShotId: formData.previousShotId || undefined,
      isFromPK: formData.isFromPK || undefined,
      matchId,
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
      ...(finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw }),
    });

    // Wyczyść tempVideoTimestamp po zapisaniu
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tempVideoTimestamp');
      localStorage.removeItem('tempVideoTimestampRaw');
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingShot && onDelete) {
      if (confirm("Czy na pewno chcesz usunąć ten strzał?")) {
        onDelete(editingShot.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isVideoInternal ? styles.overlayInternal : ''}`} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editingShot ? "Edytuj strzał" : "Dodaj strzał"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* xG i dodatkowe pola */}
          <div className={styles.topRow}>
            <div className={styles.xgInput}>
              <label htmlFor="xg-input">xG (%):</label>
              <input
                type="number"
                id="xg-input"
                step="1"
                min="0"
                max="100"
                value={formData.xG}
                onChange={(e) => setFormData({...formData, xG: parseInt(e.target.value) || 0})}
                className={styles.input}
                required
              />
              <button
                type="button"
                className={`${styles.pkFlagButton} ${styles.tooltipTrigger} ${formData.isFromPK ? styles.pkFlagButtonActive : ""}`}
                onClick={() => setFormData({ ...formData, isFromPK: !formData.isFromPK })}
                aria-pressed={formData.isFromPK}
                aria-label="Czy strzał był z pola karnego?"
                data-tooltip="Czy strzał był z pola karnego?"
                title="Czy strzał był z pola karnego?"
              >
                PK
              </button>
              {formData.teamContext === "attack" && (
                <div className={styles.linePlayersCountInput}>
                  <label htmlFor="line-players-count">Przeciwnik na linii strzału:</label>
                  <input
                    type="number"
                    id="line-players-count"
                    step="1"
                    min="0"
                    max="11"
                    value={formData.linePlayersCount}
                    onChange={(e) => setFormData({...formData, linePlayersCount: parseInt(e.target.value) || 0})}
                    className={styles.input}
                  />
                </div>
              )}
              <div className={styles.pkPlayersCountInput}>
                <div className={styles.pkToggle}>
                  <button
                    type="button"
                    className={`${styles.pkButton} ${formData.isP1Active ? styles.activeP1 : ''}`}
                    onClick={() => setFormData({
                      ...formData,
                      isP1Active: true,
                      isP2Active: false,
                    })}
                  >
                    1P
                  </button>
                  <button
                    type="button"
                    className={`${styles.pkButton} ${formData.isP2Active ? styles.activeP2 : ''}`}
                    onClick={() => setFormData({
                      ...formData,
                      isP1Active: false,
                      isP2Active: true,
                    })}
                  >
                    2P
                  </button>
                </div>
              </div>
              <div className={styles.finalXG}>
                Finalny xG: {calculateFinalXG()}%
              </div>
            </div>
          </div>

          {/* Przełącznik atak/obrona */}
          <div className={styles.teamContextToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "attack" ? styles.active : ""}`}
              onClick={() => handleTeamContextChange("attack")}
            >
              Atak
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "defense" ? styles.active : ""}`}
              onClick={() => handleTeamContextChange("defense")}
            >
              Obrona
            </button>
          </div>

          {/* Wybór zawodnika z kafelków */}
          <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
            <label>
              {formData.teamContext === "attack" 
                ? "Zawodnik (atak - zielony):" 
                : "Bramkarz (obrona - czerwony):"
              }
            </label>
            <div className={styles.playersGridContainer}>
              {(() => {
                const playersToShow = formData.teamContext === "defense" ? filteredGoalkeepers : filteredPlayers;
                const playersByPosition = getPlayersByPosition(playersToShow);
                return playersByPosition.sortedPositions.map((position) => (
                  <div key={position} className={styles.positionGroup}>
                    <div className={styles.playersGrid}>
                      <div className={styles.positionLabel}>
                        {position === 'Skrzydłowi' ? 'W' : position}
                      </div>
                      <div className={styles.playersGridItems}>
                        {playersByPosition.byPosition[position].map(player => (
                          <div
                            key={player.id}
                            className={`${styles.playerTile} ${
                              formData.playerId === player.id 
                                ? (formData.teamContext === "attack" ? styles.playerAttackerTile : styles.playerDefenderTile)
                                : ''
                            }`}
                            onClick={() => handlePlayerSelect(player.id)}
                          >
                            <div className={styles.playerContent}>
                              <div className={styles.number}>{player.number}</div>
                              <div className={styles.playerInfo}>
                                <div className={styles.name}>{getPlayerFullName(player)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Zawodnicy na linii strzału (tylko w obronie) */}
          {formData.teamContext === "defense" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Przeciwnik na linii strzału:</label>
              <div className={styles.playersGridContainer}>
                {(() => {
                  // Filtruj bramkarzy - w obronie bramkarz nie liczy się w linii strzału
                  const playersWithoutGK = filteredPlayers.filter(player => 
                    player.position !== "GK" && player.position !== "Bramkarz"
                  );
                  const playersByPosition = getPlayersByPosition(playersWithoutGK);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.linePlayers.includes(player.id) ? styles.playerLineTile : ''
                              }`}
                              onClick={() => handleLinePlayerToggle(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}


          {/* Kategoria akcji */}
          <div className={styles.fieldGroup}>
            <label>Kategoria akcji:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.actionCategory === "open_play" ? styles.active : ""}`}
                onClick={() => handleActionCategoryChange("open_play")}
              >
                Otwarta gra
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.actionCategory === "sfg" ? styles.active : ""}`}
                onClick={() => handleActionCategoryChange("sfg")}
              >
                SFG
              </button>
            </div>
          </div>

          {/* Rodzaj akcji */}
          <div className={styles.fieldGroup}>
            <label>Rodzaj akcji:</label>
            <div className={styles.actionTypeSelector}>
              {getAvailableActionTypes().map((actionType) => {
                let tooltipText = "";
                if (actionType.value === "open_play") {
                  tooltipText = "Open play";
                } else if (actionType.value === "regain") {
                  tooltipText = "Strzał do 8s po odbiorze na połowie przeciwnika";
                }
                
                return (
                  <button
                    key={actionType.value}
                    type="button"
                    className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${formData.actionType === actionType.value ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, actionType: actionType.value as any})}
                    data-tooltip={tooltipText || undefined}
                    title={tooltipText || undefined}
                  >
                    {actionType.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Podrodzaj SFG */}
          {formData.actionCategory === "sfg" && formData.actionType !== "penalty" && (
            <div className={styles.fieldGroup}>
              <label>Podrodzaj SFG:</label>
              <div className={styles.actionTypeSelector}>
                {getSfgSubtypes().map((subtype) => (
                  <button
                    key={subtype.value}
                    type="button"
                    className={`${styles.actionTypeButton} ${formData.sfgSubtype === subtype.value ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, sfgSubtype: subtype.value as any})}
                  >
                    {subtype.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Faza akcji (tylko dla SFG) */}
          {formData.actionCategory === "sfg" && formData.actionType !== "penalty" && (
            <div className={styles.fieldGroup}>
              <label className={styles.tooltipTrigger} data-tooltip="Czy strzał był w 'pierwsze tempo', czy w późniejszej fazie SFG." title="Czy strzał był w 'pierwsze tempo', czy w późniejszej fazie SFG.">
                Faza akcji:
              </label>
              <div className={styles.actionTypeSelector}>
                {getActionPhases().map((phase) => (
                  <button
                    key={phase.value}
                    type="button"
                    className={`${styles.actionTypeButton} ${formData.actionPhase === phase.value ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, actionPhase: phase.value as any})}
                  >
                    {phase.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typ strzału w jednej linii */}
          <div className={styles.fieldGroup}>
            <label>Typ strzału:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "on_target" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("on_target");
                }}
              >
                Celny
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "off_target" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("off_target");
                }}
              >
                Niecelny
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.shotType === "blocked" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("blocked");
                }}
              >
                Zablokowany
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${styles.goalButton} ${formData.shotType === "goal" ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShotTypeSelect("goal");
                }}
              >
                Gol ⚽
              </button>
            </div>
          </div>

          {/* Wybór asystenta (tylko gdy gol) */}
          {formData.shotType === "goal" && formData.teamContext === "attack" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Asystent:</label>
              <div className={styles.playersGridContainer}>
                <div className={styles.positionGroup}>
                  <div className={styles.playersGrid}>
                    <div className={styles.positionLabel} style={{ visibility: 'hidden' }}>
                      GK
                    </div>
                    <div className={styles.playersGridItems}>
                      <div
                        className={`${styles.playerTile} ${
                          formData.assistantId === "" ? styles.playerAttackerTile : ''
                        }`}
                        onClick={() => handleAssistantSelect("")}
                      >
                        <div className={styles.playerContent}>
                          <div className={styles.playerInfo}>
                            <div className={styles.name}>Brak asysty</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {(() => {
                  const assistantPlayers = filteredPlayers.filter(player => player.id !== formData.playerId);
                  const playersByPosition = getPlayersByPosition(assistantPlayers);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.assistantId === player.id 
                                  ? styles.playerAttackerTile
                                  : ''
                              }`}
                              onClick={() => handleAssistantSelect(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* Liczba kontaktów */}
          <div className={styles.fieldGroup}>
            <label>Liczba kontaktów:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact1 ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact1 = !prev.isContact1;
                    return {
                      ...prev,
                      isContact1: newIsContact1,
                      // Wyłącz inne opcje kontaktów gdy włączamy 1T
                      isContact2: newIsContact1 ? false : prev.isContact2,
                      isContact3Plus: newIsContact1 ? false : prev.isContact3Plus,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 1T"
                aria-pressed={formData.isContact1}
              >
                1T
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact2 ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact2 = !prev.isContact2;
                    return {
                      ...prev,
                      isContact2: newIsContact2,
                      // Wyłącz inne opcje kontaktów gdy włączamy 2T
                      isContact1: newIsContact2 ? false : prev.isContact1,
                      isContact3Plus: newIsContact2 ? false : prev.isContact3Plus,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 2T"
                aria-pressed={formData.isContact2}
              >
                2T
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.isContact3Plus ? styles.active : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData(prev => {
                    const newIsContact3Plus = !prev.isContact3Plus;
                    return {
                      ...prev,
                      isContact3Plus: newIsContact3Plus,
                      // Wyłącz inne opcje kontaktów gdy włączamy 3T+
                      isContact1: newIsContact3Plus ? false : prev.isContact1,
                      isContact2: newIsContact3Plus ? false : prev.isContact2,
                    };
                  });
                }}
                title="Aktywuj/Dezaktywuj 3T+"
                aria-pressed={formData.isContact3Plus}
              >
                3T+
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Część ciała:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "foot" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "foot"})}
              >
                Noga
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "head" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "head"})}
              >
                Głowa
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.bodyPart === "other" ? styles.active : ""}`}
                onClick={() => setFormData({...formData, bodyPart: "other"})}
              >
                Inne
              </button>
            </div>
          </div>

          {/* Wybór poprzedniego strzału (dobitka) */}
          <div className={styles.fieldGroup}>
            <label>Dobitki:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${
                  formData.previousShotId === "" ? styles.active : ''
                }`}
                onClick={() => handlePreviousShotSelect("")}
                data-tooltip="Pierwszy strzał w akcji - nie jest dobitką. xG pozostaje bez zmian."
              >
                Brak (pierwszy strzał)
              </button>
              {(() => {
                // Użyj minuty aktualnego strzału jako referencji
                const currentMinute = editingShot?.minute || formData.minute;
                
                // Filtruj tylko strzały z tej samej minuty (dobitki są zwykle w tej samej minucie)
                // Jeśli nie ma strzałów w tej minucie, pokaż też z minuty wcześniejszej
                const availableShots = shots
                  .filter(shot => {
                    // Wyklucz aktualnie edytowany strzał
                    if (shot.id === editingShot?.id) return false;
                    // Pokazuj tylko strzały z tej samej minuty lub maksymalnie 1 minutę wstecz
                    return shot.minute >= currentMinute - 1 && shot.minute <= currentMinute;
                  })
                  // Jeśli są strzały w tej samej minucie, pokaż tylko je
                  .filter(shot => {
                    const sameMinuteShots = shots.filter(s => s.minute === currentMinute && s.id !== editingShot?.id);
                    if (sameMinuteShots.length > 0) {
                      return shot.minute === currentMinute;
                    }
                    return true; // Jeśli nie ma strzałów w tej minucie, pokaż z minuty wcześniejszej
                  })
                  .sort((a, b) => {
                    // Sortuj po minucie (od najnowszych), potem po timestamp
                    if (a.minute !== b.minute) return b.minute - a.minute;
                    return (b.timestamp || 0) - (a.timestamp || 0);
                  });

                return availableShots.map(shot => {
                  const chain = getShotChain(shot.id);
                  const isChain = chain.length > 1;
                  const tooltipText = isChain 
                    ? `Dobitka - wybierz ten strzał jako poprzedni. Łańcuch dobitek: ${chain.map(s => `${s.minute}'`).join(' → ')}. xG tego strzału będzie obliczone jako: xG * (1 - xG_poprzedni/100)`
                    : `Dobitka - wybierz ten strzał jako poprzedni. xG tego strzału będzie obliczone jako: xG * (1 - xG_poprzedni/100)`;
                  // Czytelniejszy tekst: minuta, zawodnik i xG z separatorami
                  const playerName = shot.playerName || "Brak";
                  const xgValue = Math.round(shot.xG * 100);
                  const buttonText = `${shot.minute}' - ${playerName} (xG: ${xgValue}%)`;
                  return (
                    <button
                      key={shot.id}
                      type="button"
                      className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${
                        formData.previousShotId === shot.id ? styles.active : ''
                      }`}
                      onClick={() => handlePreviousShotSelect(shot.id)}
                      data-tooltip={tooltipText}
                    >
                      {buttonText}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Zawodnicy blokujący (tylko w obronie i gdy typ strzału to zablokowany) */}
          {formData.teamContext === "defense" && formData.shotType === "blocked" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>Zawodnik blokujący strzał:</label>
              <div className={styles.playersGridContainer}>
                {(() => {
                  // Filtruj bramkarzy - bramkarz nie liczy się w blokowaniu strzału
                  const playersWithoutGK = filteredPlayers.filter(player => 
                    player.position !== "GK" && player.position !== "Bramkarz"
                  );
                  const playersByPosition = getPlayersByPosition(playersWithoutGK);
                  return playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map(player => (
                            <div
                              key={player.id}
                              className={`${styles.playerTile} ${
                                formData.blockingPlayers.includes(player.id) ? styles.playerBlockingTile : ''
                              }`}
                              onClick={() => handleBlockingPlayerToggle(player.id)}
                            >
                              <div className={styles.playerContent}>
                                <div className={styles.number}>{player.number}</div>
                                <div className={styles.playerInfo}>
                                  <div className={styles.name}>{getPlayerFullName(player)}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            {editingShot && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={styles.deleteButton}
              >
                Usuń strzał
              </button>
            )}
          </div>
          
          {/* Pole notatki kontrowersyjnej - pojawia się gdy isControversial jest true */}
          {formData.isControversial && (
            <div className={styles.controversyNoteContainer}>
              <label htmlFor="controversy-note" className={styles.controversyNoteLabel}>
                Notatka dotycząca problemu:
              </label>
              <textarea
                id="controversy-note"
                className={styles.controversyNoteInput}
                value={controversyNote}
                onChange={(e) => setControversyNote(e.target.value)}
                placeholder="Opisz problem z interpretacją strzału..."
                rows={3}
                maxLength={500}
              />
              <div className={styles.controversyNoteCounter}>
                {controversyNote.length}/500
              </div>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.controversyButton} ${styles.tooltipTrigger} ${formData.isControversial ? styles.controversyButtonActive : ""}`}
              onClick={() => setFormData({ ...formData, isControversial: !formData.isControversial })}
              aria-pressed={formData.isControversial}
              aria-label="Oznacz jako kontrowersja"
              data-tooltip="Sytuacja kontrowersyjna - zaznacz, aby omówić później."
            >
              !
            </button>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Anuluj
            </button>
            <div className={styles.minuteAndSave}>
              <div className={styles.minuteInput}>
                <div className={styles.videoTimeWrapper}>
                  <input
                    id="video-time-input"
                    type="text"
                    value={videoTimeMMSS}
                    onChange={handleVideoTimeChange}
                    onBlur={handleVideoTimeBlur}
                    placeholder="MM:SS"
                    className={styles.videoTimeField}
                    maxLength={5}
                  />
                  <span className={styles.matchMinuteInfo}>
                    {currentMatchMinute !== null ? currentMatchMinute : (editingShot?.minute || formData.minute)}'
                  </span>
                </div>
              </div>
              <button type="submit" className={styles.saveButton}>
                {editingShot ? "Zapisz zmiany" : "Zapisz akcję"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ShotModal;

