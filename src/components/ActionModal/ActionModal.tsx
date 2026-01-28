"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./ActionModal.module.css";
import { Player, Action, TeamInfo } from "@/types";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "./PlayerCard";
import { TEAMS } from "@/constants/teams";
import { sortPlayersByLastName } from '@/utils/playerUtils';

interface ActionModalProps {
  isOpen: boolean;
  isVideoInternal?: boolean;
  onClose: () => void;
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  onSenderSelect: (id: string | null) => void;
  onReceiverSelect: (id: string | null) => void;
  actionMinute: number;
  onMinuteChange: (minute: number) => void;
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
  onGetVideoTime?: () => Promise<number>; // Funkcja do pobierania surowego czasu z wideo w sekundach
  actionType: "pass" | "dribble";
  onActionTypeChange: (type: "pass" | "dribble") => void;
  currentPoints: number;
  onAddPoints: (points: number) => void;
  isP0StartActive: boolean;
  onP0StartToggle: () => void;
  isP1StartActive: boolean;
  onP1StartToggle: () => void;
  isP2StartActive: boolean;
  onP2StartToggle: () => void;
  isP3StartActive: boolean;
  onP3StartToggle: () => void;
  isP0Active: boolean;
  onP0Toggle: () => void;
  isP1Active: boolean;
  onP1Toggle: () => void;
  isP2Active: boolean;
  onP2Toggle: () => void;
  isP3Active: boolean;
  onP3Toggle: () => void;
  isContact1Active: boolean;
  onContact1Toggle: () => void;
  isContact2Active: boolean;
  onContact2Toggle: () => void;
  isContact3PlusActive: boolean;
  onContact3PlusToggle: () => void;
  isShot: boolean;
  onShotToggle: (checked: boolean) => void;
  isGoal: boolean;
  onGoalToggle: (checked: boolean) => void;
  isPenaltyAreaEntry: boolean;
  onPenaltyAreaEntryToggle: (checked: boolean) => void;
  isSecondHalf: boolean;
  onSecondHalfToggle: (checked: boolean) => void;
  onSaveAction: () => void;
  onReset: () => void;
  onResetPoints: () => void;
  editingAction?: Action | null;
  allMatches?: TeamInfo[];
  selectedMatchId?: string | null;
  onMatchSelect?: (matchId: string) => void;
  matchInfo?: TeamInfo | null;
  // Nowe propsy dla trybu unpacking
  mode?: "attack" | "defense";
  onModeChange?: (mode: "attack" | "defense") => void;
  selectedDefensePlayers?: string[];
  onDefensePlayersChange?: (playerIds: string[]) => void;
  isControversial: boolean;
  onControversialToggle: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  isVideoInternal = false,
  onClose,
  players,
  selectedPlayerId,
  selectedReceiverId,
  onSenderSelect,
  onReceiverSelect,
  actionMinute,
  onMinuteChange,
  onCalculateMinuteFromVideo,
  onGetVideoTime,
  actionType,
  onActionTypeChange,
  currentPoints,
  onAddPoints,
  isP0StartActive,
  onP0StartToggle,
  isP1StartActive,
  onP1StartToggle,
  isP2StartActive,
  onP2StartToggle,
  isP3StartActive,
  onP3StartToggle,
  isP0Active,
  onP0Toggle,
  isP1Active,
  onP1Toggle,
  isP2Active,
  onP2Toggle,
  isP3Active,
  onP3Toggle,
  isContact1Active,
  onContact1Toggle,
  isContact2Active,
  onContact2Toggle,
  isContact3PlusActive,
  onContact3PlusToggle,
  isShot,
  onShotToggle,
  isGoal,
  onGoalToggle,
  isPenaltyAreaEntry,
  onPenaltyAreaEntryToggle,
  isSecondHalf,
  onSecondHalfToggle,
  onSaveAction,
  onReset,
  onResetPoints,
  editingAction,
  allMatches,
  selectedMatchId,
  onMatchSelect,
  matchInfo,
  // Nowe propsy dla trybu unpacking
  mode = "attack",
  onModeChange,
  selectedDefensePlayers = [],
  onDefensePlayersChange,
  isControversial,
  onControversialToggle,
}) => {
  const [currentSelectedMatch, setCurrentSelectedMatch] = useState<string | null>(null);
  const isAutoSettingFromVideo = React.useRef(false);
  const [videoTimeMMSS, setVideoTimeMMSS] = useState<string>("00:00"); // Czas wideo w formacie MM:SS
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null); // Aktualna minuta meczu
  const [controversyNote, setControversyNote] = useState<string>(""); // Notatka dotycząca kontrowersyjnej akcji
  
  // Refs do śledzenia poprzednich wartości, aby uniknąć nadpisywania podczas edycji
  const prevVideoTimestampRawRef = React.useRef<number | undefined>(undefined);
  const prevVideoTimestampRef = React.useRef<number | undefined>(undefined);
  const prevEditingActionIdRef = React.useRef<string | undefined>(undefined);

  // Ładujemy ostatnio wybraną opcję trybu
  useEffect(() => {
    if (onModeChange) {
      const lastMode = localStorage.getItem('lastActionMode');
      if (lastMode === 'defense' && mode !== 'defense') {
        onModeChange('defense');
      }
    }
  }, [onModeChange, mode]);

  // W trybie unpacking automatycznie synchronizujemy punkty za "Minięty przeciwnik" z liczbą zaznaczonych zawodników
  useEffect(() => {
    // Działamy tylko w trybie defense
    if (mode !== "defense") {
      return;
    }
    
    const expectedPoints = selectedDefensePlayers ? selectedDefensePlayers.length : 0;
    
    // Jeśli punkty nie odpowiadają liczbie zaznaczonych zawodników, synchronizujemy
    if (currentPoints !== expectedPoints) {
      const pointsDifference = expectedPoints - currentPoints;
      if (pointsDifference !== 0) {
        onAddPoints(pointsDifference);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDefensePlayers?.length, mode]);

  // Określamy czy jesteśmy w trybie edycji
  const isEditMode = !!editingAction;

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

  // Inicjalizacja notatki przy otwarciu modalu lub zmianie akcji
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingAction) {
        setControversyNote(editingAction.controversyNote || "");
      } else {
        setControversyNote("");
      }
    } else {
      setControversyNote("");
    }
  }, [isOpen, isEditMode, editingAction?.id, editingAction?.controversyNote]);

  // Pobieranie czasu z wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingAction) {
        // W trybie edycji - używamy zapisanego czasu z akcji
        // Preferujemy videoTimestampRaw (surowy czas), jeśli nie ma, obliczamy z videoTimestamp (czas z korektą -10s)
        let savedTime: number | undefined;
        if (editingAction.videoTimestampRaw !== undefined && editingAction.videoTimestampRaw !== null) {
          savedTime = editingAction.videoTimestampRaw;
        } else if (editingAction.videoTimestamp !== undefined && editingAction.videoTimestamp !== null) {
          // Jeśli mamy tylko videoTimestamp (z korektą -10s), dodajemy 10 sekund z powrotem
          savedTime = editingAction.videoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          setVideoTimeMMSS(secondsToMMSS(savedTime));
          // Zaktualizuj refs przy pierwszym otwarciu
          prevVideoTimestampRawRef.current = editingAction.videoTimestampRaw;
          prevVideoTimestampRef.current = editingAction.videoTimestamp;
          prevEditingActionIdRef.current = editingAction.id;
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
      prevEditingActionIdRef.current = undefined;
    }
  }, [isOpen, isEditMode, editingAction?.id, editingAction?.videoTimestampRaw, editingAction?.videoTimestamp, onGetVideoTime]);

  // Dodatkowy useEffect do aktualizacji videoTimeMMSS gdy editingAction się zmienia (np. po zapisaniu)
  useEffect(() => {
    if (isOpen && isEditMode && editingAction) {
      const currentVideoTimestampRaw = editingAction.videoTimestampRaw;
      const currentVideoTimestamp = editingAction.videoTimestamp;
      const currentActionId = editingAction.id;
      
      // Sprawdź czy to nowa akcja (zmiana ID) lub czy wartości się zmieniły
      const isNewAction = currentActionId !== prevEditingActionIdRef.current;
      const hasChanged = 
        isNewAction ||
        currentVideoTimestampRaw !== prevVideoTimestampRawRef.current ||
        currentVideoTimestamp !== prevVideoTimestampRef.current;
      
      // Aktualizuj tylko jeśli wartości się zmieniły
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
        prevEditingActionIdRef.current = currentActionId;
      }
    } else if (!isOpen) {
      // Reset refs gdy modal się zamyka
      prevVideoTimestampRawRef.current = undefined;
      prevVideoTimestampRef.current = undefined;
      prevEditingActionIdRef.current = undefined;
    }
  }, [isOpen, isEditMode, editingAction?.id, editingAction?.videoTimestampRaw, editingAction?.videoTimestamp]);

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
    } else if (isEditMode && editingAction) {
      // W trybie edycji - używamy minuty z akcji
      setCurrentMatchMinute(editingAction.minute);
    }
  }, [isOpen, isEditMode, editingAction, onCalculateMinuteFromVideo]);

  // Automatycznie ustaw sugerowaną wartość minuty na podstawie czasu wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen && !isEditMode && onCalculateMinuteFromVideo) {
      isAutoSettingFromVideo.current = true;
      onCalculateMinuteFromVideo().then((result) => {
        if (result !== null && result.minute > 0) {
          // Ustawiamy połowę meczu
          onSecondHalfToggle(result.isSecondHalf);
          // Ustawiamy minutę
          onMinuteChange(result.minute);
        }
        // Resetujemy flagę po ustawieniu wartości
        setTimeout(() => {
          isAutoSettingFromVideo.current = false;
        }, 100);
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
        isAutoSettingFromVideo.current = false;
      });
    }
  }, [isOpen, isEditMode, onCalculateMinuteFromVideo, onMinuteChange, onSecondHalfToggle]);

  // Funkcja do pobierania nazwy zespołu
  const getTeamName = (teamId: string) => {
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId;
  };

  // Efekt do aktualizacji wybranego meczu przy edycji
  useEffect(() => {
    if (editingAction && editingAction.matchId) {
      setCurrentSelectedMatch(editingAction.matchId);
      if (onMatchSelect) {
        onMatchSelect(editingAction.matchId);
      }
    } else if (selectedMatchId) {
      setCurrentSelectedMatch(selectedMatchId);
    }
  }, [editingAction?.matchId, selectedMatchId]);

  // Funkcja obsługi zmiany meczu z useCallback dla lepszej optymalizacji
  const handleMatchChange = useCallback((matchId: string) => {
    setCurrentSelectedMatch(matchId);
    if (onMatchSelect) {
      onMatchSelect(matchId);
    }
  }, [onMatchSelect]);

  // Filtrowanie zawodników według wybranego meczu i minut rozegranych
  const filteredPlayers = React.useMemo(() => {
    let playersToFilter: Player[] = [];
    let selectedMatch: TeamInfo | null = null;

    if (isEditMode && allMatches && currentSelectedMatch) {
      // W trybie edycji używamy wybranego meczu
      selectedMatch = allMatches.find(match => match.matchId === currentSelectedMatch) || null;
    } else if (matchInfo) {
      // W trybie dodawania nowej akcji używamy aktualnego meczu
      selectedMatch = matchInfo;
    }

    if (selectedMatch) {
      // Filtruj zawodników należących do zespołu
      const teamPlayers = players.filter(player => 
        player.teams?.includes(selectedMatch!.team)
      );

      // Filtruj tylko zawodników z co najmniej 1 minutą rozegranych w tym meczu
      playersToFilter = teamPlayers.filter(player => {
        const playerMinutes = selectedMatch!.playerMinutes?.find(pm => pm.playerId === player.id);
        
        if (!playerMinutes) {
          return false; // Jeśli brak danych o minutach, nie pokazuj zawodnika
        }

        // Oblicz czas gry
        const playTime = playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
          ? 0
          : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

        return playTime >= 1; // Pokazuj tylko zawodników z co najmniej 1 minutą
      });


    } else {
      // Jeśli nie ma wybranego meczu, pokazuj wszystkich zawodników z zespołu
      playersToFilter = players;
    }
    
    // Sortowanie alfabetyczne po nazwisku
    const sortedPlayers = sortPlayersByLastName(playersToFilter);
    
    return sortedPlayers;
  }, [players, isEditMode, allMatches, currentSelectedMatch, matchInfo]);

  // Grupowanie zawodników według pozycji z meczu
  const playersByPosition = useMemo(() => {
    // Pobierz wybrany mecz
    let selectedMatch = null;
    if (isEditMode && currentSelectedMatch) {
      selectedMatch = allMatches?.find(match => match.matchId === currentSelectedMatch) || null;
    } else if (matchInfo) {
      selectedMatch = matchInfo;
    }

    const byPosition = filteredPlayers.reduce((acc, player) => {
      // Pobierz pozycję z meczu, jeśli dostępna
      let position = player.position || 'Brak pozycji';
      
      if (selectedMatch?.playerMinutes) {
        const playerMinutes = selectedMatch.playerMinutes.find(pm => pm.playerId === player.id);
        if (playerMinutes?.position) {
          position = playerMinutes.position;
        }
      }
      
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
        // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji z meczu
        if (position === 'Skrzydłowi') {
          // Pobierz pozycje z meczu
          let posA = a.position || '';
          let posB = b.position || '';
          
          if (selectedMatch?.playerMinutes) {
            const playerMinutesA = selectedMatch.playerMinutes.find(pm => pm.playerId === a.id);
            const playerMinutesB = selectedMatch.playerMinutes.find(pm => pm.playerId === b.id);
            if (playerMinutesA?.position) posA = playerMinutesA.position;
            if (playerMinutesB?.position) posB = playerMinutesB.position;
          }
          
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
        const lastNameA = getLastName(a.name || '');
        const lastNameB = getLastName(b.name || '');
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  }, [filteredPlayers, matchInfo, allMatches, currentSelectedMatch, isEditMode]);

  if (!isOpen) return null;

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEditMode) return;
    onMinuteChange(parseInt(e.target.value) || 0);
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
      if (isEditMode && editingAction) {
        // W trybie edycji - przywróć zapisany czas
        let savedTime: number | undefined;
        if (editingAction.videoTimestampRaw !== undefined && editingAction.videoTimestampRaw !== null) {
          savedTime = editingAction.videoTimestampRaw;
        } else if (editingAction.videoTimestamp !== undefined && editingAction.videoTimestamp !== null) {
          savedTime = editingAction.videoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          setVideoTimeMMSS(secondsToMMSS(savedTime));
        } else if (onGetVideoTime) {
          onGetVideoTime().then((time) => {
            if (time >= 0) {
              setVideoTimeMMSS(secondsToMMSS(time));
            }
          }).catch((error) => {
            console.warn('Nie udało się pobrać czasu z wideo:', error);
          });
        }
      } else if (onGetVideoTime) {
        // W trybie dodawania - pobierz z wideo
        onGetVideoTime().then((time) => {
          if (time >= 0) {
            setVideoTimeMMSS(secondsToMMSS(time));
          }
        }).catch((error) => {
          console.warn('Nie udało się pobrać czasu z wideo:', error);
        });
      } else {
        // Jeśli nie ma żadnej wartości, ustaw domyślną
        setVideoTimeMMSS('00:00');
      }
    }
  };

  const handleActionTypeChange = (type: "pass" | "dribble") => {
    onActionTypeChange(type);
    
    // Jeśli zmieniamy na drybling, usuwamy odbiorcę
    if (type === "dribble" && selectedReceiverId) {
      onReceiverSelect(null);
    }
  };

  const handlePlayerClick = (playerId: string) => {
    // Obsługa trybu obrony - wielokrotny wybór zawodników
    if (mode === "defense") {
      if (onDefensePlayersChange) {
        const currentDefensePlayers = selectedDefensePlayers || [];
        if (currentDefensePlayers.includes(playerId)) {
          // Usuń zawodnika z listy
          onDefensePlayersChange(currentDefensePlayers.filter(id => id !== playerId));
        } else {
          // Dodaj zawodnika do listy
          onDefensePlayersChange([...currentDefensePlayers, playerId]);
        }
      }
      return;
    }
    
    // Cykliczny wybór: zawodnik podający -> zawodnik przyjmujący -> usunięcie wyboru
    
    if (actionType === "dribble") {
      // Dla dryblingu - umożliwiamy zaznaczenie i odznaczenie zawodnika
      if (playerId === selectedPlayerId) {
        // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
        onSenderSelect(null);
      } else {
        // W przeciwnym razie zaznaczamy nowego zawodnika
        onSenderSelect(playerId);
      }
      
      // Upewniamy się, że nie ma odbiorcy przy dryblingu
      if (selectedReceiverId) {
        onReceiverSelect(null);
      }
    } else {
      // Dla podania implementujemy cykliczny wybór
      
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === selectedPlayerId) {
        onSenderSelect(null);
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go 
      if (playerId === selectedReceiverId) {
        onReceiverSelect(null);
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!selectedPlayerId) {
        onSenderSelect(playerId);
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go
      if (selectedPlayerId && !selectedReceiverId) {
        onReceiverSelect(playerId);
        return;
      }
      
      // Przypadek 5: Mamy obu i klikamy na nowego - zmieniamy podającego
      onSenderSelect(playerId);
      onReceiverSelect(null);
    }
  };

  const handlePointsAdd = (points: number) => {
    onAddPoints(points);
  };


  const handleShotToggle = () => {
    if (isShot) {
      onShotToggle(false);
      onGoalToggle(false);
      return;
    }
    onShotToggle(true);
  };

  const handleGoalToggle = () => {
    onGoalToggle(!isGoal);
  };

  const handlePenaltyAreaEntryToggle = () => {
    onPenaltyAreaEntryToggle(!isPenaltyAreaEntry);
  };

  const handleSecondHalfToggle = (value: boolean) => {
    if (isEditMode) return;
    onSecondHalfToggle(value);
    
    // Jeśli ustawiamy wartości automatycznie z wideo, nie zmieniajmy minuty
    if (isAutoSettingFromVideo.current) {
      return;
    }
    
    // Jeśli włączamy drugą połowę, a minuta jest mniejsza niż 46, ustawiamy na 46
    if (value && actionMinute < 46) {
      onMinuteChange(46);
    }
    // Jeśli włączamy pierwszą połowę, a minuta jest większa niż 65, ustawiamy na 45
    else if (!value && actionMinute > 65) {
      onMinuteChange(45);
    }
    
  };

  const handleSave = async () => {
    // Walidacja w zależności od trybu
    if (mode === "defense") {
      // W trybie obrony sprawdzamy czy są wybrani zawodnicy obrony
      if (!selectedDefensePlayers || selectedDefensePlayers.length === 0) {
        alert("Wybierz co najmniej jednego zawodnika miniętego przez przeciwnika!");
        return;
      }
    } else {
      // W trybie ataku sprawdzamy standardowe warunki
      if (!selectedPlayerId) {
        alert("Wybierz zawodnika rozpoczynającego akcję!");
        return;
      }
      
      // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
      if (actionType === "pass" && !selectedReceiverId) {
        alert("Wybierz zawodnika kończącego podanie!");
        return;
      }
    }

    // Zapisz videoTimestamp z pola MM:SS do localStorage
    const videoTimeSeconds = mmssToSeconds(videoTimeMMSS);
    if (videoTimeSeconds >= 0) {
      // Zapisujemy surowy czas (videoTimestampRaw) - bez korekty (może być 0)
      localStorage.setItem('tempVideoTimestampRaw', videoTimeSeconds.toString());
      // Zapisujemy czas z korektą -10s (videoTimestamp) - maksymalnie do 0, nie może być poniżej 0
      // Jeśli czas jest poniżej 10s, odejmujemy maksymalnie do 0
      const correctedTime = Math.max(0, videoTimeSeconds - 10);
      localStorage.setItem('tempVideoTimestamp', correctedTime.toString());
    } else if (isEditMode && editingAction?.videoTimestamp !== undefined) {
      // W trybie edycji, jeśli pole jest puste lub niepoprawne, zachowaj istniejący timestamp
      localStorage.setItem('tempVideoTimestamp', editingAction.videoTimestamp.toString());
      if (editingAction.videoTimestampRaw !== undefined) {
        localStorage.setItem('tempVideoTimestampRaw', editingAction.videoTimestampRaw.toString());
      }
    }

    // Zapisz notatkę kontrowersyjną do localStorage
    if (isControversial && controversyNote.trim()) {
      localStorage.setItem('tempControversyNote', controversyNote.trim());
    } else {
      localStorage.removeItem('tempControversyNote');
    }

    // W trybie edycji nie sprawdzamy stref z localStorage
    if (!isEditMode) {
      // Sprawdzamy czy strefy są zapisane w localStorage (tylko dla nowych akcji)
      const tempStartZone = localStorage.getItem('tempStartZone');
      const tempEndZone = localStorage.getItem('tempEndZone');
      
      // Jeśli brakuje stref w localStorage, wyświetlamy alert
      if (!tempStartZone || !tempEndZone) {
        alert("Błąd: Brak informacji o wybranych strefach. Proszę wybrać strefy początkową i końcową na boisku.");
        return;
      }
    }


    // Wywołaj funkcję zapisującą akcję, ale nie zamykaj modalu od razu
    // Komponent nadrzędny sam zadecyduje czy i kiedy zamknąć modal
    onSaveAction();
  };

  const handleCancel = () => {
    onReset();
    onClose();
  };

  const handleReset = () => {
    if (isEditMode) {
      // W trybie edycji - użyj oryginalnej funkcji onReset (przywraca oryginalną akcję)
      onReset();
    } else {
      // W trybie dodawania nowej akcji - użyj funkcji onResetPoints z hooka
      // która resetuje TYLKO punkty i przełączniki, zachowując zawodników, minutę, połowę, strefy
      onResetPoints();
    }
  };

  return (
    <div className={`${styles.overlay} ${isVideoInternal ? styles.overlayInternal : ''}`} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{isEditMode ? "Edytuj akcję" : "Dodaj akcję"}</h3>
          <button className={styles.closeButton} onClick={handleCancel}>×</button>
        </div>
        
        {/* Przełącznik trybu Atak/Obrona */}
        {onModeChange && (
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeButton} ${mode === "attack" ? styles.activeMode : ""}`}
              onClick={() => {
                onModeChange("attack");
                localStorage.setItem('lastActionMode', 'attack');
              }}
            >
              Packing
            </button>
            <button
              className={`${styles.modeButton} ${mode === "defense" ? styles.activeMode : ""}`}
              onClick={() => {
                onModeChange("defense");
                localStorage.setItem('lastActionMode', 'defense');
              }}
            >
              Unpacking
            </button>
          </div>
        )}
        
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* Wybór meczu - tylko w trybie edycji */}
          {isEditMode && allMatches && allMatches.length > 0 && (
            <div className={styles.formGroup}>
              <label>Mecz:</label>
              <select
                value={currentSelectedMatch || ''}
                onChange={(e) => {
                  const matchId = e.target.value;
                  handleMatchChange(matchId);
                }}
                className={styles.select}
              >
                <option value="">-- Wybierz mecz --</option>
                {allMatches.map(match => (
                  <option key={match.matchId} value={match.matchId}>
                    {match.opponent} ({match.date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Połowa */}
          <div className={styles.formGroup}>
            <div className={styles.togglesRow}>
              <div className={styles.toggleGroup}>
                <label>Połowa:</label>
                <div className={styles.halfToggle}>
                  <button
                    type="button"
                    className={`${styles.halfButton} ${!isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={() => handleSecondHalfToggle(false)}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                  >
                    P1
                  </button>
                  <button
                    type="button"
                    className={`${styles.halfButton} ${isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={() => handleSecondHalfToggle(true)}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                  >
                    P2
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Lista zawodników */}
          <div className={styles.formGroup}>
            <label className={styles.playerTitle}>
              {mode === "defense" 
                ? "Wybierz zawodników miniętych przez przeciwnika:" 
                : actionType === "dribble" 
                  ? "Wybierz zawodnika dryblującego:" 
                  : "Wybierz zawodników:"
              }
            </label>
            <div className={styles.playerSelectionInfo}>
              {mode === "defense" ? (
                <p>Kliknij, aby wybrać zawodników naszego zespołu, którzy zostali minięci przez przeciwnika. Możesz wybrać wielu zawodników.</p>
              ) : actionType === "pass" ? (
                <p>Kliknij, aby wybrać zawodnika rozpoczynającego, a następnie kliknij na innego zawodnika, aby wybrać kończącego.</p>
              ) : (
                <p>Kliknij, aby wybrać zawodnika wykonującego drybling.</p>
              )}
            </div>
            <div className={styles.playersGridContainer}>
              {filteredPlayers.length > 0 ? (
                <>
                  {isEditMode && filteredPlayers.length < 3 && (
                    <div className={styles.warningMessage}>
                      ⚠️ Tylko {filteredPlayers.length} zawodnik{filteredPlayers.length === 1 ? '' : 'ów'} dostępn{filteredPlayers.length === 1 ? 'y' : 'ych'} w tym meczu
                    </div>
                  )}
                  {playersByPosition.sortedPositions.map((position) => (
                    <div key={position} className={styles.positionGroup}>
                      <div className={styles.playersGrid}>
                        <div className={styles.positionLabel}>
                          {position === 'Skrzydłowi' ? 'W' : position}
                        </div>
                        <div className={styles.playersGridItems}>
                          {playersByPosition.byPosition[position].map((player) => (
                            <PlayerCard
                              key={player.id}
                              player={player}
                              isSender={mode === "defense" ? false : actionType === "pass" ? player.id === selectedPlayerId : false}
                              isReceiver={mode === "defense" ? false : actionType === "pass" ? player.id === selectedReceiverId : false}
                              isDribbler={mode === "defense" ? false : actionType === "dribble" ? player.id === selectedPlayerId : false}
                              isDefensePlayer={mode === "defense" ? (selectedDefensePlayers || []).includes(player.id) : false}
                            onSelect={handlePlayerClick}
                          />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className={styles.noPlayersMessage}>
                  {isEditMode && currentSelectedMatch ? (
                    <>
                      Brak zawodników z ustawionymi minutami w wybranym meczu.<br/>
                      <small>Sprawdź czy zostały ustawione minuty zawodników w meczu lub wybierz inny mecz.</small>
                    </>
                  ) : matchInfo ? (
                    <>
                      Brak zawodników z co najmniej 1 minutą rozegranych w tym meczu.<br/>
                      <small>Sprawdź czy zostały ustawione minuty zawodników w meczu.</small>
                    </>
                  ) : (
                    "Wybierz mecz, aby zobaczyć dostępnych zawodników."
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Wszystkie przyciski w jednym rzędzie */}
          <div className={styles.compactButtonsRow}>
            {/* Typ akcji - Podanie/Drybling */}
            <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Typ akcji">
              <button
                className={`${styles.actionTypeButton} ${actionType === "pass" ? styles.activePassButton : ""}`}
                onClick={handleActionTypeChange.bind(null, "pass")}
                aria-pressed={actionType === "pass"}
                type="button"
              >
                Podanie
              </button>
              <button
                className={`${styles.actionTypeButton} ${actionType === "dribble" ? styles.activeDribbleButton : ""}`}
                onClick={handleActionTypeChange.bind(null, "dribble")}
                aria-pressed={actionType === "dribble"}
                type="button"
              >
                Drybling
              </button>
            </div>
            {/* Sekcja "Początek i koniec działania" z przyciskami P0-P3 */}
            <div className={styles.pSectionContainer}>
              <div className={styles.pStartEndContainer}>
                <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Początek działania">
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP0StartActive ? styles.active : ""
                    }`}
                    onClick={onP0StartToggle}
                    title="Aktywuj/Dezaktywuj P0"
                    aria-pressed={isP0StartActive}
                    type="button"
                  >
                    P0
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP1StartActive ? styles.active : ""
                    }`}
                    onClick={onP1StartToggle}
                    title="Aktywuj/Dezaktywuj P1"
                    aria-pressed={isP1StartActive}
                    type="button"
                  >
                    P1
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP2StartActive ? styles.active : ""
                    }`}
                    onClick={onP2StartToggle}
                    title="Aktywuj/Dezaktywuj P2"
                    aria-pressed={isP2StartActive}
                    type="button"
                  >
                    P2
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP3StartActive ? styles.active : ""
                    }`}
                    onClick={onP3StartToggle}
                    title="Aktywuj/Dezaktywuj P3"
                    aria-pressed={isP3StartActive}
                    type="button"
                  >
                    P3
                  </button>
                </div>
                <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Koniec działania">
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP0Active ? styles.active : ""
                    }`}
                    onClick={onP0Toggle}
                    title="Aktywuj/Dezaktywuj P0"
                    aria-pressed={isP0Active}
                    type="button"
                  >
                    P0
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP1Active ? styles.active : ""
                    }`}
                    onClick={onP1Toggle}
                    title="Aktywuj/Dezaktywuj P1"
                    aria-pressed={isP1Active}
                    type="button"
                  >
                    P1
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP2Active ? styles.active : ""
                    }`}
                    onClick={onP2Toggle}
                    title="Aktywuj/Dezaktywuj P2"
                    aria-pressed={isP2Active}
                    type="button"
                  >
                    P2
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isP3Active ? styles.active : ""
                    }`}
                    onClick={onP3Toggle}
                    title="Aktywuj/Dezaktywuj P3"
                    aria-pressed={isP3Active}
                    type="button"
                  >
                    P3
                  </button>
                </div>
              </div>
            </div>

            {/* Grupa przycisków kontaktów i przycisków pionowych obok siebie */}
            <div className={styles.rightSideContainer}>
              {/* Grupa przycisków kontaktów */}
              <div className={styles.pSectionContainer}>
                <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Liczba kontaktów">
                  <button
                    className={`${styles.actionTypeButton} ${
                      isContact1Active ? styles.active : ""
                    }`}
                    onClick={onContact1Toggle}
                    title="Aktywuj/Dezaktywuj 1T"
                    aria-pressed={isContact1Active}
                    type="button"
                  >
                    1T
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isContact2Active ? styles.active : ""
                    }`}
                    onClick={onContact2Toggle}
                    title="Aktywuj/Dezaktywuj 2T"
                    aria-pressed={isContact2Active}
                    type="button"
                  >
                    2T
                  </button>
                  <button
                    className={`${styles.actionTypeButton} ${
                      isContact3PlusActive ? styles.active : ""
                    }`}
                    onClick={onContact3PlusToggle}
                    title="Aktywuj/Dezaktywuj 3T+"
                    aria-pressed={isContact3PlusActive}
                    type="button"
                  >
                    3T+
                  </button>
                </div>
                {/* Przycisk "Minięty przeciwnik" */}
                {ACTION_BUTTONS.map((button, index) => {
                  if (button.type === "points" && button.label === "Minięty przeciwnik") {
                    return (
                      <div 
                        key={index} 
                        className={styles.compactPointsButtonSmall}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // W trybie unpacking wyłączamy przycisk "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                          if (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0) {
                            return; // Nie wykonuj kliknięcia
                          }
                          handlePointsAdd(button.points);
                        }}
                        title={button.description}
                        style={{
                          // W trybie unpacking wyłączamy przycisk "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                          pointerEvents: mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0 ? 'none' : 'auto',
                          opacity: mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0 ? 0.6 : 1
                        }}
                      >
                        <span className={styles.compactLabelSmall}>{button.label}</span>
                        <span className={styles.pointsValueSmall}><b>{currentPoints}</b></span>
                        <button
                          className={styles.compactSubtractButtonSmall}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // W trybie unpacking wyłączamy przycisk odejmowania dla "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                            if (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0) {
                              return; // Nie wykonuj kliknięcia
                            }
                            handlePointsAdd(-button.points);
                          }}
                          title={`Odejmij ${button.points} pkt`}
                          type="button"
                          disabled={currentPoints < button.points || (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0)}
                        >
                          −
                        </button>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Przyciski ułożone pionowo: Wejście PK, Strzał, Gol */}
              <div className={styles.verticalButtonsContainer}>
              {/* Przycisk "Wejście PK" */}
              <button
                className={`${styles.compactButton} ${
                  isPenaltyAreaEntry ? styles.activeButton : ""
                }`}
                onClick={handlePenaltyAreaEntryToggle}
                aria-pressed={isPenaltyAreaEntry}
                type="button"
                title="Wejście w pole karne"
              >
                <span className={styles.compactLabel}>Wejście PK</span>
              </button>

              {/* Przycisk "Strzał" */}
              <button
                className={`${styles.compactButton} ${
                  isShot ? styles.activeButton : ""
                }`}
                onClick={handleShotToggle}
                aria-pressed={isShot}
                type="button"
                title="Strzał"
              >
                <span className={styles.compactLabel}>Strzał</span>
              </button>

              {/* Przycisk "Gol" */}
              <button
                className={`${styles.compactButton} ${
                  isGoal ? styles.activeButton : ""
                } ${!isShot ? styles.disabledButton : ""}`}
                onClick={handleGoalToggle}
                disabled={!isShot}
                aria-pressed={isGoal}
                aria-disabled={!isShot}
                type="button"
                title={!isShot ? "Musisz najpierw zaznaczyć Strzał" : "Gol"}
              >
                <span className={styles.compactLabel}>Gol</span>
              </button>
            </div>
          </div>
          </div>
          
          {/* Pole notatki kontrowersyjnej - pojawia się gdy isControversial jest true */}
          {isControversial && (
            <div className={styles.controversyNoteContainer}>
              <label htmlFor="controversy-note" className={styles.controversyNoteLabel}>
                Notatka dotycząca problemu:
              </label>
              <textarea
                id="controversy-note"
                className={styles.controversyNoteInput}
                value={controversyNote}
                onChange={(e) => setControversyNote(e.target.value)}
                placeholder="Opisz problem z interpretacją akcji..."
                rows={3}
                maxLength={500}
              />
              <div className={styles.controversyNoteCounter}>
                {controversyNote.length}/500
              </div>
            </div>
          )}

          {/* Przyciski kontrolne z polem minuty pomiędzy */}
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.controversyButton} ${styles.tooltipTrigger} ${isControversial ? styles.controversyButtonActive : ""}`}
              onClick={onControversialToggle}
              aria-pressed={isControversial}
              aria-label="Oznacz jako kontrowersja"
              data-tooltip="Sytuacja kontrowersyjna - zaznacz, aby omówić później."
            >
              !
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              type="button"
            >
              Anuluj
            </button>
            
            <div className={styles.minuteInput}>
              <div className={styles.videoTimeWrapper}>
                <input
                  id="video-time-input"
                  type="text"
                  value={videoTimeMMSS}
                  onChange={handleVideoTimeChange}
                  onBlur={handleVideoTimeBlur}
                  placeholder="MM:SS"
                  pattern="^([0-9]{1,2}):([0-5][0-9])$"
                  className={styles.videoTimeField}
                  maxLength={5}
                />
                <span className={styles.matchMinuteInfo}>
                  {currentMatchMinute !== null ? currentMatchMinute : (editingAction?.minute || actionMinute)}'
                </span>
              </div>
            </div>
            
            <button
              className={styles.saveButton}
              onClick={handleSave}
              type="submit"
            >
              Zapisz akcję
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActionModal; 