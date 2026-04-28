"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./RegainActionModal.module.css";
import { Player, Action, TeamInfo } from "@/types";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "../ActionModal/PlayerCard";
import { TEAMS } from "@/constants/teams";
import { getOpponentLabelForPackingModal } from "@/lib/matchInfoPackingLabels";
import { sortPlayersByLastName } from '@/utils/playerUtils';
import { getModalPlayersForMatch } from "@/lib/modalMatchPlayersFilter";
import { submitParentFormOnEnter } from "@/utils/submitParentFormOnEnter";

interface RegainActionModalProps {
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
  onSaveAction: (patch?: Partial<Action>) => void;
  onReset: () => void;
  onResetPoints: () => void;
  editingAction?: Action | null;
  allMatches?: TeamInfo[];
  selectedMatchId?: string | null;
  onMatchSelect?: (matchId: string) => void;
  matchInfo?: TeamInfo | null;
  // Nowy prop dla przycisku "Poniżej 8s"
  isBelow8sActive: boolean;
  onBelow8sToggle: () => void;
  /** Liczba „miniętych” z perspektywy meczu (0–10). Firestore: regainOppRosterSquadTallyF1. */
  receptionBackAllyCount: number;
  onReceptionBackAllyCountChange: (count: number) => void;
  // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
  playersLeftField: number;
  onPlayersLeftFieldChange: (count: number) => void;
  // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
  opponentsLeftField: number;
  onOpponentsLeftFieldChange: (count: number) => void;
  isControversial: boolean;
  onControversialToggle: () => void;
}

const RegainActionModal: React.FC<RegainActionModalProps> = ({
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
  // Nowy prop dla przycisku "Poniżej 8s"
  isBelow8sActive,
  onBelow8sToggle,
  receptionBackAllyCount,
  onReceptionBackAllyCountChange,
  // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
  playersLeftField,
  onPlayersLeftFieldChange,
  // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
  opponentsLeftField,
  onOpponentsLeftFieldChange,
  isControversial,
  onControversialToggle,
}) => {
  const clamp0to10 = (value: number) => Math.max(0, Math.min(10, value));
  const [currentSelectedMatch, setCurrentSelectedMatch] = useState<string | null>(null);

  const opponentLineLabel = useMemo(
    () => getOpponentLabelForPackingModal(matchInfo),
    [matchInfo],
  );
  const backAllyTooltip = opponentLineLabel
    ? `Ilu zawodników przeciwnika (${opponentLineLabel}) zostało miniętych w tej sytuacji (0–10).`
    : "Ilu zawodników przeciwnika zostało miniętych w tej sytuacji (0–10).";
  const [controversyNote, setControversyNote] = useState<string>(""); // Notatka dotycząca kontrowersyjnej akcji

  const renderCountRow = useCallback(
    (
      title: string,
      subtitle: string | null,
      value: number,
      onChange: (next: number) => void,
      ariaLabelPrefix: string,
      groupDomId: string,
    ) => {
      const values = Array.from({ length: 11 }, (_, i) => i); // 0..10
      const ariaLabel = subtitle
        ? `${ariaLabelPrefix}. Przeciwnik: ${subtitle}.`
        : ariaLabelPrefix;

      return (
        <div className={styles.countRow}>
          <div className={styles.countRowLabelBlock}>
            <div className={styles.countRowTitle}>{title}</div>
            {subtitle ? <div className={styles.countRowSub}>{subtitle}</div> : null}
          </div>
          <div
            id={groupDomId}
            className={styles.countButtons}
            role="group"
            aria-label={ariaLabel}
          >
            {values.map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.countButton} ${value === n ? styles.countButtonActive : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(n);
                }}
                aria-pressed={value === n}
                title={`Ustaw ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    },
    [],
  );


  // Określamy czy jesteśmy w trybie edycji
  const isEditMode = !!editingAction;
  const [videoTimeMMSS, setVideoTimeMMSS] = useState<string>("00:00"); // Czas wideo w formacie MM:SS
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null); // Aktualna minuta meczu
  
  // Refs do śledzenia poprzednich wartości, aby uniknąć nadpisywania podczas edycji
  const prevVideoTimestampRawRef = React.useRef<number | undefined>(undefined);
  const prevVideoTimestampRef = React.useRef<number | undefined>(undefined);
  const prevEditingActionIdRef = React.useRef<string | undefined>(undefined);

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

  // Minuta meczu na żywo z pola MM:SS - spójna z logiką calculateMatchMinuteFromVideoTime
  const calculateMatchMinuteFromVideoSeconds = useCallback(
    (videoSeconds: number) => {
      const firstHalfStart = matchInfo?.firstHalfStartTime;
      const secondHalfStart = matchInfo?.secondHalfStartTime;

      if (secondHalfStart !== undefined && videoSeconds >= secondHalfStart) {
        const secondsIntoSecondHalf = videoSeconds - secondHalfStart;
        const minute = Math.floor(secondsIntoSecondHalf / 60) + 46;
        return Math.max(46, minute);
      }

      if (firstHalfStart !== undefined && videoSeconds >= firstHalfStart) {
        const secondsIntoFirstHalf = videoSeconds - firstHalfStart;
        const minute = Math.floor(secondsIntoFirstHalf / 60) + 1;
        return Math.max(1, Math.min(45, minute));
      }

      if (secondHalfStart !== undefined && videoSeconds < secondHalfStart) {
        const minute = Math.floor(videoSeconds / 60) + 1;
        return Math.max(1, Math.min(45, minute));
      }

      // Fallback gdy brak czasów startu połów: MM:SS = czas absolutny w nagraniu, 2. połowa od 45:00
      const DEFAULT_SECOND_HALF_START = 45 * 60;
      if (videoSeconds >= DEFAULT_SECOND_HALF_START) {
        const secondsIntoSecondHalf = videoSeconds - DEFAULT_SECOND_HALF_START;
        const minute = Math.floor(secondsIntoSecondHalf / 60) + 46;
        return Math.max(46, minute);
      }
      const minute = Math.floor(videoSeconds / 60) + 1;
      return Math.max(1, Math.min(45, minute));
    },
    [matchInfo?.firstHalfStartTime, matchInfo?.secondHalfStartTime]
  );

  const matchMinuteFromVideoInput = useMemo(() => {
    const rawSeconds = mmssToSeconds(videoTimeMMSS);
    return calculateMatchMinuteFromVideoSeconds(rawSeconds);
  }, [videoTimeMMSS, calculateMatchMinuteFromVideoSeconds]);

  // Pobieranie czasu z wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingAction) {
        // W trybie edycji - używamy zapisanego czasu z akcji
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
      onCalculateMinuteFromVideo().then((result) => {
        if (result !== null && result.minute > 0) {
          onMinuteChange(result.minute);
          // Ustaw również połowę meczu
          if (result.isSecondHalf !== isSecondHalf) {
            onSecondHalfToggle(result.isSecondHalf);
          }
        }
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
      });
    }
  }, [isOpen, isEditMode, onCalculateMinuteFromVideo, onMinuteChange, isSecondHalf, onSecondHalfToggle]);

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
      playersToFilter = getModalPlayersForMatch(players, selectedMatch, {
        requirePlayerMinutes: true,
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
    
    // Kolejność pozycji: GK, CB, DM, Skrzydłowi (LW/RW), AM, ST (ST zawsze na końcu)
    const positionOrder = ['GK', 'CB', 'DM', 'Skrzydłowi', 'AM'];
    const lastPosition = 'ST';
    
    // Sortuj pozycje według określonej kolejności
    const sortedPositions = Object.keys(byPosition).sort((a, b) => {
      // ST zawsze na końcu
      if (a === lastPosition) return 1;
      if (b === lastPosition) return -1;
      
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
        const lastNameA = getLastName(a.name ?? "");
        const lastNameB = getLastName(b.name ?? "");
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
    const partialPattern = /^([0-9]{0,3})?(:([0-5]?[0-9]?)?)?$/;
    const fullPattern = /^([0-9]{1,3}):([0-5][0-9])$/;
    const minutesOnlyPattern = /^[0-9]{1,3}$/; // Stary format: tylko minuty (1-999)
    
    if (value === '' || partialPattern.test(value) || fullPattern.test(value) || minutesOnlyPattern.test(value)) {
      setVideoTimeMMSS(value);
    }
  };

  const handleVideoTimeBlur = () => {
    // Upewnij się, że format jest poprawny
    const fullPattern = /^([0-9]{1,3}):([0-5][0-9])$/;
    
    if (!fullPattern.test(videoTimeMMSS)) {
      // Kompatybilność wsteczna: jeśli to tylko liczba (stary format - minuty), konwertuj na MM:SS
      if (!videoTimeMMSS.includes(':') && /^[0-9]{1,3}$/.test(videoTimeMMSS)) {
        const mins = parseInt(videoTimeMMSS, 10);
        if (!isNaN(mins) && mins >= 0) {
          // Konwertuj minuty na format MM:SS (sekundy = 0)
          const normalizedMins = Math.min(999, mins);
          const formatted = `${normalizedMins < 100 ? normalizedMins.toString().padStart(2, '0') : normalizedMins.toString()}:00`;
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
        
        // Ograniczenia: minuty 0-999, sekundy 0-59
        mins = Math.max(0, Math.min(999, mins));
        secs = Math.max(0, Math.min(59, secs));
        
        // Formatuj z zerami wiodącymi
        const formattedMins = mins < 100 ? mins.toString().padStart(2, '0') : mins.toString();
        const formatted = `${formattedMins}:${secs.toString().padStart(2, '0')}`;
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
    // W regain wybieramy tylko jednego zawodnika (odbiorcę piłki)
    if (playerId === selectedPlayerId) {
      // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
      onSenderSelect(null);
    } else {
      // W przeciwnym razie zaznaczamy nowego zawodnika
      onSenderSelect(playerId);
    }
    
    // Upewniamy się, że nie ma odbiorcy w regain
    if (selectedReceiverId) {
      onReceiverSelect(null);
    }
  };

  const handlePointsAdd = (points: number) => {
    onAddPoints(points);
  };


  const handleShotToggle = () => {
    if (isShot) {
      onShotToggle(false);
      if (!isEditMode) {
        onGoalToggle(false);
      }
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
    // Walidacja dla regain - sprawdzamy tylko jednego zawodnika (odbiorcę piłki)
    if (!selectedPlayerId) {
      alert("Wybierz zawodnika odbierającego piłkę!");
      return;
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

    // W trybie edycji aktualizujemy minutę i połowę na podstawie bieżącego czasu z wideo
    if (isEditMode && matchMinuteFromVideoInput > 0) {
      const nextMinute = matchMinuteFromVideoInput;
      const nextIsSecondHalf = nextMinute >= 46;
      onMinuteChange(nextMinute);
      onSecondHalfToggle(nextIsSecondHalf);
      localStorage.setItem('tempEditedActionMinute', String(nextMinute));
      localStorage.setItem('tempEditedActionIsSecondHalf', nextIsSecondHalf ? 'true' : 'false');
    }

    // Zapisz videoTimestamp z pola MM:SS do localStorage
    const videoTimeSeconds = mmssToSeconds(videoTimeMMSS);
    if (videoTimeSeconds >= 0) {
      // Zapisujemy surowy czas (videoTimestampRaw) - bez korekty (może być 0)
      localStorage.setItem('tempVideoTimestampRaw', videoTimeSeconds.toString());
      // Zapisujemy czas z korektą -10s (videoTimestamp) - maksymalnie do 0, nie może być poniżej 0
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

    // Wywołaj funkcję zapisującą akcję, ale nie zamykaj modalu od razu
    // Komponent nadrzędny sam zadecyduje czy i kiedy zamknąć modal
    if (isEditMode) {
      onSaveAction({
        regainOppRosterSquadTallyF1: receptionBackAllyCount,
        receptionBackAllyCount: undefined,
        receptionAllyCountBehindBall: undefined,
        playersBehindBall: undefined,
        opponentsBehindBall: undefined,
      });
    } else {
      onSaveAction();
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void handleSave();
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
          <h3>{isEditMode ? "Edytuj akcję Regain" : "Dodaj akcję Regain"}</h3>
          <button type="button" className={styles.closeButton} onClick={handleCancel}>
            ×
          </button>
        </div>
        
        <form className={styles.form} onSubmit={handleFormSubmit}>
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
                <div 
                  className={styles.halfToggle}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`${styles.halfButton} ${!isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSecondHalfToggle(false);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                    style={{ pointerEvents: 'auto', zIndex: 11 }}
                  >
                    P1
                  </button>
                  <button
                    type="button"
                    className={`${styles.halfButton} ${isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSecondHalfToggle(true);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                    style={{ pointerEvents: 'auto', zIndex: 11 }}
                  >
                    P2
                  </button>
                </div>
              </div>
              {/* Przyciski dla zawodników, którzy opuścili boisko */}
              <div className={styles.toggleGroup}>
                <div 
                  className={styles.compactPointsButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlayersLeftFieldChange(Math.min(10, playersLeftField + 1));
                  }}
                  title="Kliknij, aby dodać 1 partnera"
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <span className={styles.compactLabel}>
                    {matchInfo?.team ? getTeamName(matchInfo.team) : "Partnerzy"}
                  </span>
                  <span className={styles.pointsValue}><b>{playersLeftField}</b></span>
                  <button
                    className={styles.compactSubtractButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPlayersLeftFieldChange(Math.max(0, playersLeftField - 1));
                    }}
                    title="Odejmij 1 partnera"
                    type="button"
                    disabled={playersLeftField <= 0}
                  >
                    −
                  </button>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px', 
                    display: 'flex',
                    gap: '2px',
                    fontSize: '10px',
                    lineHeight: '1'
                  }}>
                    <span>🟥</span>
                    <span style={{ color: '#dc2626' }}>✚</span>
                  </div>
                </div>
              </div>
              <div className={styles.toggleGroup}>
                <div 
                  className={styles.compactPointsButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpponentsLeftFieldChange(Math.min(10, opponentsLeftField + 1));
                  }}
                  title="Kliknij, aby dodać 1 przeciwnika"
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <span className={styles.compactLabel}>
                    Przeciwnicy
                  </span>
                  <span className={styles.pointsValue}><b>{opponentsLeftField}</b></span>
                  <button
                    className={styles.compactSubtractButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpponentsLeftFieldChange(Math.max(0, opponentsLeftField - 1));
                    }}
                    title="Odejmij 1 przeciwnika"
                    type="button"
                    disabled={opponentsLeftField <= 0}
                  >
                    −
                  </button>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px', 
                    display: 'flex',
                    gap: '2px',
                    fontSize: '10px',
                    lineHeight: '1'
                  }}>
                    <span>🟥</span>
                    <span style={{ color: '#dc2626' }}>✚</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista zawodników */}
          <div className={styles.formGroup}>
            <label className={styles.playerTitle}>
              Wybierz zawodnika odbierającego piłkę:
            </label>
            <div className={styles.playerSelectionInfo}>
              <p>Kliknij, aby wybrać zawodnika, który odebrał piłkę od przeciwnika.</p>
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
                          {playersByPosition.byPosition[position].map(player => (
                            <PlayerCard
                              key={player.id}
                              player={player}
                              isSender={player.id === selectedPlayerId}
                              isReceiver={false}
                              isDribbler={false}
                              isDefensePlayer={false}
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
            {/* Lewa strona: Typ akcji - Podanie/Drybling i P0-P3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              
              {/* P0-P3 */}
              <div className={styles.pSectionContainer}>
                <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Przestrzeń w której piłka została odebrana">
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
            
            <div
              className={`${styles.countSelectorContainer} ${styles.tooltipTrigger}`}
              data-tooltip={backAllyTooltip}
            >
              {renderCountRow(
                "Zawodnicy minięci",
                opponentLineLabel,
                clamp0to10(receptionBackAllyCount),
                (n) => onReceptionBackAllyCountChange(clamp0to10(n)),
                "Liczba zawodników miniętych (0-10)",
                "packingRegain",
              )}
            </div>
            

            {/* Pozostałe przyciski punktów (bez "Minięty przeciwnik") */}
            {ACTION_BUTTONS.map((button, index) => {
              if (button.type === "points" && button.label !== "Minięty przeciwnik") {
                return (
                  <div 
                    key={index} 
                    className={styles.compactPointsButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePointsAdd(button.points);
                    }}
                    title={button.description}
                  >
                    <span className={styles.compactLabel}>{button.label}</span>
                    <span className={styles.pointsValue}><b>{currentPoints}</b></span>
                    <button
                      className={styles.compactSubtractButton}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePointsAdd(-button.points);
                      }}
                      title={`Odejmij ${button.points} pkt`}
                      type="button"
                      disabled={currentPoints < button.points}
                    >
                      −
                    </button>
                  </div>
                );
              }
              return null;
            })}
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
                onKeyDown={submitParentFormOnEnter}
                placeholder="Opisz problem z interpretacją akcji regain..."
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
                  pattern="^([0-9]{1,3}):([0-5][0-9])$"
                  className={styles.videoTimeField}
                  maxLength={6}
                />
                <span className={styles.matchMinuteInfo}>
                  {matchMinuteFromVideoInput}'
                </span>
              </div>
            </div>
            
            <button className={styles.saveButton} type="submit">
              Zapisz akcję
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegainActionModal;