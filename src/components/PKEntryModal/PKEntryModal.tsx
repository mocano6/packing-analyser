"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PKEntry, Player, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./PKEntryModal.module.css";
import PlayerCard from "../ActionModal/PlayerCard";

export interface PKEntryModalProps {
  isOpen: boolean;
  isVideoInternal?: boolean;
  onClose: () => void;
  onSave: (entry: Omit<PKEntry, "id" | "timestamp">) => void;
  onDelete?: (entryId: string) => void;
  editingEntry?: PKEntry;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  matchId: string;
  players: Player[];
  matchInfo?: TeamInfo | null;
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
  onGetVideoTime?: () => Promise<number>; // Funkcja do pobierania surowego czasu z wideo w sekundach
}

const PKEntryModal: React.FC<PKEntryModalProps> = ({
  isOpen,
  isVideoInternal = false,
  onClose,
  onSave,
  onDelete,
  editingEntry,
  startX,
  startY,
  endX,
  endY,
  matchId,
  players,
  matchInfo,
  onCalculateMinuteFromVideo,
  onGetVideoTime,
}) => {
  const [formData, setFormData] = useState({
    senderId: "",
    senderName: "",
    receiverId: "",
    receiverName: "",
    minute: 1,
    isSecondHalf: false,
    entryType: "pass" as "pass" | "dribble" | "sfg",
    teamContext: "attack" as "attack" | "defense",
    isPossible1T: false,
    pkPlayersCount: 0,
    opponentsInPKCount: 0,
    isShot: false,
    isGoal: false,
    isRegain: false,
    isControversial: false,
  });
  const isEditMode = Boolean(editingEntry);
  const [videoTimeMMSS, setVideoTimeMMSS] = useState<string>("00:00"); // Czas wideo w formacie MM:SS
  const [currentMatchMinute, setCurrentMatchMinute] = useState<number | null>(null); // Aktualna minuta meczu
  const [controversyNote, setControversyNote] = useState<string>(""); // Notatka dotycząca kontrowersyjnej akcji
  
  // Refs do śledzenia poprzednich wartości, aby uniknąć nadpisywania podczas edycji
  const prevVideoTimestampRawRef = useRef<number | undefined>(undefined);
  const prevVideoTimestampRef = useRef<number | undefined>(undefined);
  const prevEditingEntryIdRef = useRef<string | undefined>(undefined);

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

  // Pobieranie czasu z wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingEntry) {
        // W trybie edycji - używamy zapisanego czasu z akcji
        let savedTime: number | undefined;
        if (editingEntry.videoTimestampRaw !== undefined && editingEntry.videoTimestampRaw !== null) {
          savedTime = editingEntry.videoTimestampRaw;
        } else if (editingEntry.videoTimestamp !== undefined && editingEntry.videoTimestamp !== null) {
          // Jeśli mamy tylko videoTimestamp (z korektą -10s), dodajemy 10 sekund z powrotem
          savedTime = editingEntry.videoTimestamp + 10;
        }
        
        if (savedTime !== undefined && savedTime >= 0) {
          setVideoTimeMMSS(secondsToMMSS(savedTime));
          // Zaktualizuj refs przy pierwszym otwarciu
          prevVideoTimestampRawRef.current = editingEntry.videoTimestampRaw;
          prevVideoTimestampRef.current = editingEntry.videoTimestamp;
          prevEditingEntryIdRef.current = editingEntry.id;
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
      prevEditingEntryIdRef.current = undefined;
    }
  }, [isOpen, isEditMode, editingEntry?.id, editingEntry?.videoTimestampRaw, editingEntry?.videoTimestamp, onGetVideoTime]);

  // Dodatkowy useEffect do aktualizacji videoTimeMMSS gdy editingEntry się zmienia (np. po zapisaniu)
  useEffect(() => {
    if (isOpen && isEditMode && editingEntry) {
      const currentVideoTimestampRaw = editingEntry.videoTimestampRaw;
      const currentVideoTimestamp = editingEntry.videoTimestamp;
      const currentEntryId = editingEntry.id;
      
      // Sprawdź czy to nowa akcja (zmiana ID) lub czy wartości się zmieniły
      const isNewEntry = currentEntryId !== prevEditingEntryIdRef.current;
      const hasChanged = 
        isNewEntry ||
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
        prevEditingEntryIdRef.current = currentEntryId;
      }
    } else if (!isOpen) {
      // Reset refs gdy modal się zamyka
      prevVideoTimestampRawRef.current = undefined;
      prevVideoTimestampRef.current = undefined;
      prevEditingEntryIdRef.current = undefined;
    }
  }, [isOpen, isEditMode, editingEntry?.id, editingEntry?.videoTimestampRaw, editingEntry?.videoTimestamp]);

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
    } else if (isEditMode && editingEntry) {
      // W trybie edycji - używamy minuty z akcji
      setCurrentMatchMinute(editingEntry.minute);
    }
  }, [isOpen, isEditMode, editingEntry?.id, editingEntry?.minute, onCalculateMinuteFromVideo]);

  // Filtrowanie zawodników grających w danym meczu (podobnie jak w ShotModal)
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

  // Funkcja pomocnicza do ograniczania wartości do zakresu 0-10
  const clamp0to10 = (value: number) => Math.max(0, Math.min(10, value));

  // Funkcja renderująca rząd przycisków numerycznych (0-10)
  const renderCountRow = useCallback(
    (
      label: string,
      value: number,
      onChange: (next: number) => void,
      ariaLabelPrefix: string
    ) => {
      const values = Array.from({ length: 11 }, (_, i) => i); // 0..10

      return (
        <div className={styles.countRow}>
          <div className={styles.countRowLabel}>{label}</div>
          <div className={styles.countButtons} role="group" aria-label={ariaLabelPrefix}>
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
    []
  );

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
        const lastNameA = getLastName(a.name);
        const lastNameB = getLastName(b.name);
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  };

  // Automatycznie ustaw sugerowaną wartość minuty i połowy na podstawie czasu wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen && !editingEntry && onCalculateMinuteFromVideo) {
      onCalculateMinuteFromVideo().then((result) => {
        if (result !== null && result.minute > 0) {
          setFormData(prev => ({
            ...prev,
            minute: result.minute,
            isSecondHalf: result.isSecondHalf,
          }));
        }
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
      });
    }
  }, [isOpen, editingEntry, onCalculateMinuteFromVideo]);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        senderId: editingEntry.senderId || "",
        senderName: editingEntry.senderName || "",
        receiverId: editingEntry.receiverId || "",
        receiverName: editingEntry.receiverName || "",
        minute: editingEntry.minute,
        isSecondHalf: editingEntry.isSecondHalf,
        entryType: editingEntry.entryType || "pass",
        teamContext: editingEntry.teamContext || "attack",
        isPossible1T: editingEntry.isPossible1T || false,
        pkPlayersCount: editingEntry.pkPlayersCount || 0,
        opponentsInPKCount: editingEntry.opponentsInPKCount || 0,
        isShot: editingEntry.isShot || false,
        isGoal: editingEntry.isGoal || false,
        isRegain: editingEntry.isRegain || false,
        isControversial: editingEntry.isControversial || false,
      });
      setControversyNote(editingEntry.controversyNote || "");
    } else {
      // Pobierz aktualną połowę z localStorage
      const savedHalf = typeof window !== 'undefined' ? localStorage.getItem('currentHalf') : null;
      const isP2 = savedHalf === 'P2';
      
      // Automatyczne wykrywanie kontekstu zespołu na podstawie pozycji
      // Lewa strona boiska (startX < 50%) = obrona, prawa strona (startX >= 50%) = atak
      const autoTeamContext = startX < 50 ? "defense" : "attack";
      
      setFormData({
        senderId: "",
        senderName: "",
        receiverId: "",
        receiverName: "",
        minute: 1,
        isSecondHalf: isP2,
        entryType: "pass",
        teamContext: autoTeamContext,
        isPossible1T: false,
        pkPlayersCount: 0,
        opponentsInPKCount: 0,
        isShot: false,
        isGoal: false,
        isRegain: false,
      });
      setControversyNote("");
    }
  }, [editingEntry, isOpen, startX]);

  // Reset controversyNote gdy modal się zamyka
  useEffect(() => {
    if (!isOpen) {
      setControversyNote("");
    }
  }, [isOpen]);

  const handlePlayerClick = (playerId: string) => {
    const player = filteredPlayers.find(p => p.id === playerId);
    const playerName = player ? `${player.firstName} ${player.lastName}` : "";
    
    // Dla dryblingu - tylko jeden zawodnik (sender)
    if (formData.entryType === "dribble") {
      if (playerId === formData.senderId) {
        // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
        setFormData({
          ...formData,
          senderId: "",
          senderName: "",
        });
      } else {
        // W przeciwnym razie zaznaczamy nowego zawodnika jako sender
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
          receiverId: "", // Upewniamy się, że nie ma odbiorcy przy dryblingu
          receiverName: "",
        });
      }
      return;
    }
    
    // Dla podania i SFG - zawsze dwóch zawodników
    if (formData.entryType === "pass" || formData.entryType === "sfg") {
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === formData.senderId) {
        setFormData({
          ...formData,
          senderId: "",
          senderName: "",
        });
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go
      if (playerId === formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!formData.senderId) {
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
        });
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go
      if (formData.senderId && !formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: playerId,
          receiverName: playerName,
        });
        return;
      }
      
      // Przypadek 5: Mamy obu zawodników - zamieniamy podającego
      setFormData({
        ...formData,
        senderId: playerId,
        senderName: playerName,
        receiverId: "",
        receiverName: "",
      });
      return;
    }
    
    // Dla regain - może być jeden lub dwóch zawodników
    if (formData.entryType === "regain") {
      // Przypadek 1: Kliknięty zawodnik jest obecnie podającym - usuwamy go
      if (playerId === formData.senderId) {
        setFormData({
          ...formData,
          senderId: formData.receiverId || "",
          senderName: formData.receiverName || "",
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 2: Kliknięty zawodnik jest obecnie przyjmującym - usuwamy go
      if (playerId === formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: "",
          receiverName: "",
        });
        return;
      }
      
      // Przypadek 3: Nie mamy jeszcze podającego - ustawiamy go
      if (!formData.senderId) {
        setFormData({
          ...formData,
          senderId: playerId,
          senderName: playerName,
        });
        return;
      }
      
      // Przypadek 4: Mamy podającego, ale nie mamy przyjmującego - ustawiamy go jako otrzymującego
      if (formData.senderId && !formData.receiverId) {
        setFormData({
          ...formData,
          receiverId: playerId,
          receiverName: playerName,
        });
        return;
      }
      
      // Przypadek 5: Mamy obu zawodników - zamieniamy podającego
      setFormData({
        ...formData,
        senderId: playerId,
        senderName: playerName,
        receiverId: "",
        receiverName: "",
      });
    }
  };

  // Funkcja do obsługi zmiany połowy
  const handleSecondHalfToggle = (value: boolean) => {
    if (isEditMode) return;
    setFormData((prev) => {
      const newMinute = value 
        ? Math.max(46, prev.minute) 
        : Math.min(45, prev.minute);
      
      return {
        ...prev,
        isSecondHalf: value,
        minute: newMinute,
      };
    });
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
      if (isEditMode && editingEntry) {
        // W trybie edycji - przywróć zapisany czas
        let savedTime: number | undefined;
        if (editingEntry.videoTimestampRaw !== undefined && editingEntry.videoTimestampRaw !== null) {
          savedTime = editingEntry.videoTimestampRaw;
        } else if (editingEntry.videoTimestamp !== undefined && editingEntry.videoTimestamp !== null) {
          savedTime = editingEntry.videoTimestamp + 10;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const lockedMinute = isEditMode ? (editingEntry?.minute ?? formData.minute) : formData.minute;
    const lockedIsSecondHalf = isEditMode ? (editingEntry?.isSecondHalf ?? formData.isSecondHalf) : formData.isSecondHalf;
    
    // Zapisz videoTimestamp z pola MM:SS do localStorage
    const videoTimeSeconds = mmssToSeconds(videoTimeMMSS);
    if (videoTimeSeconds >= 0) {
      // Zapisujemy surowy czas (videoTimestampRaw) - bez korekty (może być 0)
      localStorage.setItem('tempVideoTimestampRaw', videoTimeSeconds.toString());
      // Zapisujemy czas z korektą -10s (videoTimestamp) - maksymalnie do 0, nie może być poniżej 0
      const correctedTime = Math.max(0, videoTimeSeconds - 10);
      localStorage.setItem('tempVideoTimestamp', correctedTime.toString());
    } else if (isEditMode && editingEntry?.videoTimestamp !== undefined) {
      // W trybie edycji, jeśli pole jest puste lub niepoprawne, zachowaj istniejący timestamp
      localStorage.setItem('tempVideoTimestamp', editingEntry.videoTimestamp.toString());
      if (editingEntry.videoTimestampRaw !== undefined) {
        localStorage.setItem('tempVideoTimestampRaw', editingEntry.videoTimestampRaw.toString());
      }
    }
    
    // Walidacja w zależności od kontekstu zespołu
    // W obronie nie wymagamy wyboru zawodników
    if (formData.teamContext === "defense") {
      // W obronie nie zapisujemy zawodników
      const entryDataToSave = {
        matchId,
        teamId: matchInfo?.team || "",
        startX: editingEntry ? editingEntry.startX : startX,
        startY: editingEntry ? editingEntry.startY : startY,
        endX: editingEntry ? editingEntry.endX : endX,
        endY: editingEntry ? editingEntry.endY : endY,
        minute: lockedMinute,
        isSecondHalf: lockedIsSecondHalf,
        senderId: "",
        senderName: "",
        entryType: formData.entryType,
        teamContext: formData.teamContext,
        isPossible1T: formData.isPossible1T,
        pkPlayersCount: formData.pkPlayersCount,
        opponentsInPKCount: formData.opponentsInPKCount,
        isShot: formData.isShot,
        isGoal: formData.isGoal,
        isRegain: formData.isRegain,
        isControversial: formData.isControversial,
        ...(formData.isControversial && controversyNote && controversyNote.trim() ? { controversyNote: controversyNote.trim() } : {}),
        receiverId: undefined,
        receiverName: undefined,
      };
      
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

      // W trybie edycji używamy nowych wartości z localStorage, jeśli są dostępne, w przeciwnym razie starych z editingEntry
      const finalVideoTimestamp = isEditMode
        ? (isValidTimestamp ? parsedVideoTimestamp : editingEntry?.videoTimestamp)
        : (isValidTimestamp ? parsedVideoTimestamp : undefined);

      const finalVideoTimestampRaw = isEditMode
        ? (isValidTimestampRaw ? parsedVideoTimestampRaw : (editingEntry as any)?.videoTimestampRaw)
        : (isValidTimestampRaw ? parsedVideoTimestampRaw : undefined);
      
      onSave({
        ...entryDataToSave,
        ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
        ...(finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw }),
      });
      
      // Wyczyść tempVideoTimestamp po zapisaniu
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tempVideoTimestamp');
        localStorage.removeItem('tempVideoTimestampRaw');
      }
      
      onClose();
      return;
    }
    
    // Walidacja w zależności od typu akcji (tylko dla ataku)
    if (!formData.senderId || formData.senderId.trim() === "") {
      alert("Wybierz zawodnika podającego z listy");
      return;
    }
    
    // Dla podania i SFG wymagamy dwóch zawodników
    if (formData.entryType === "pass" || formData.entryType === "sfg") {
      if (!formData.receiverId || formData.receiverId.trim() === "") {
        alert("Wybierz zawodnika otrzymującego z listy");
        return;
      }
    }
    
    // Dla dryblingu i regain - receiverId jest opcjonalne
    // Jeśli jest pusty string, ustawiamy na undefined
    const receiverId = formData.receiverId && formData.receiverId.trim() !== "" 
      ? formData.receiverId 
      : undefined;
    const receiverName = formData.receiverName && formData.receiverName.trim() !== "" 
      ? formData.receiverName 
      : undefined;

    // Pobierz czas wideo z localStorage (tak jak w Acc8sModal)
    const videoTimestamp = typeof window !== 'undefined' 
      ? localStorage.getItem('tempVideoTimestamp') 
      : null;
    // Obsługa wartości "0" - parseInt("0", 10) zwraca 0, ale "0" jest truthy jako string
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
    
    // W trybie edycji używamy nowych wartości z localStorage, jeśli są dostępne, w przeciwnym razie starych z editingEntry
    const finalVideoTimestamp = isEditMode
      ? (isValidTimestamp ? parsedVideoTimestamp : editingEntry?.videoTimestamp)
      : (isValidTimestamp ? parsedVideoTimestamp : undefined);

    const finalVideoTimestampRaw = isEditMode
      ? (isValidTimestampRaw ? parsedVideoTimestampRaw : (editingEntry as any)?.videoTimestampRaw)
      : (isValidTimestampRaw ? parsedVideoTimestampRaw : undefined);

    // Przygotuj obiekt do zapisania
    const entryDataToSave = {
      matchId,
      teamId: matchInfo?.team || "",
      startX: editingEntry ? editingEntry.startX : startX,
      startY: editingEntry ? editingEntry.startY : startY,
      endX: editingEntry ? editingEntry.endX : endX,
      endY: editingEntry ? editingEntry.endY : endY,
      minute: lockedMinute,
      isSecondHalf: lockedIsSecondHalf,
      senderId: formData.senderId,
      senderName: formData.senderName,
      entryType: formData.entryType,
      teamContext: formData.teamContext,
      isPossible1T: formData.isPossible1T,
      pkPlayersCount: formData.pkPlayersCount,
      opponentsInPKCount: formData.opponentsInPKCount,
      isShot: formData.isShot,
      isGoal: formData.isGoal,
      isRegain: formData.isRegain,
      isControversial: formData.isControversial,
      ...(formData.isControversial && controversyNote && controversyNote.trim() ? { controversyNote: controversyNote.trim() } : {}),
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
      ...(finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw }),
    };

    // Dla dryblingu - upewniamy się, że nie ma odbiorcy
    if (formData.entryType === "dribble") {
      onSave({
        ...entryDataToSave,
        receiverId: undefined,
        receiverName: undefined,
      });
    } else {
      // Dla pozostałych typów (pass, sfg, regain)
      onSave({
        ...entryDataToSave,
        receiverId: receiverId,
        receiverName: receiverName,
      });
    }

    // Wyczyść tempVideoTimestamp po zapisaniu
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tempVideoTimestamp');
      localStorage.removeItem('tempVideoTimestampRaw');
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingEntry && onDelete) {
      if (confirm("Czy na pewno chcesz usunąć to wejście PK?")) {
        onDelete(editingEntry.id);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isVideoInternal ? styles.overlayInternal : ''}`} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editingEntry ? "Edytuj wejście PK" : "Dodaj wejście PK"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Informacja o czasie wideo */}
          <div className={styles.videoTimeInfo}>
            ⏱️ Czas wideo musi zaczynać się w momencie 1 kontaktu w PK
          </div>
          
          {/* Przełącznik atak/obrona */}
          <div className={styles.teamContextToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "attack" ? styles.active : ""}`}
              onClick={() => setFormData({...formData, teamContext: "attack"})}
            >
              Atak
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${formData.teamContext === "defense" ? styles.active : ""}`}
              onClick={() => setFormData({
                ...formData, 
                teamContext: "defense",
                senderId: "",
                senderName: "",
                receiverId: "",
                receiverName: "",
              })}
            >
              Obrona
            </button>
          </div>

          {/* Przełącznik połowy */}
          <div className={styles.toggleGroup}>
            <label>Połowa:</label>
            <div className={styles.halfToggle}>
              <button
                type="button"
                className={`${styles.halfButton} ${!formData.isSecondHalf ? styles.activeHalf : ''}`}
                onClick={() => handleSecondHalfToggle(false)}
                disabled={isEditMode}
                aria-disabled={isEditMode}
              >
                P1
              </button>
              <button
                type="button"
                className={`${styles.halfButton} ${formData.isSecondHalf ? styles.activeHalf : ''}`}
                onClick={() => handleSecondHalfToggle(true)}
                disabled={isEditMode}
                aria-disabled={isEditMode}
              >
                P2
              </button>
            </div>
          </div>

          {/* Typ akcji - kolor strzałki */}
          <div className={styles.fieldGroup}>
            <label>Typ akcji:</label>
            <div className={styles.actionTypeSelector}>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "pass" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "pass",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje
                  receiverName: formData.receiverName || "",
                })}
              >
                Podanie
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "dribble" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "dribble",
                  receiverId: "", // Usuń odbiorcę przy dryblingu
                  receiverName: "",
                })}
              >
                Drybling
              </button>
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "sfg" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "sfg",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje
                  receiverName: formData.receiverName || "",
                })}
              >
                SFG
              </button>
            </div>
          </div>

          {/* Lista zawodników - jedna lista z zielonym i czerwonym obramowaniem - tylko dla ataku */}
          {formData.teamContext === "attack" && (
            <div className={`${styles.fieldGroup} ${styles.verticalLabel}`}>
              <label>
                {formData.entryType === "dribble" 
                  ? "Wybierz zawodnika dryblującego:" 
                  : formData.entryType === "regain"
                  ? "Wybierz zawodników (regain - może być jeden lub dwóch):"
                  : "Wybierz zawodników:"
                }
              </label>
              <div className={styles.playersGridContainer}>
                {(() => {
                  const playersByPosition = getPlayersByPosition(filteredPlayers);
                  return playersByPosition.sortedPositions.map((position) => (
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
                              isSender={formData.senderId === player.id}
                              isReceiver={formData.receiverId === player.id}
                              isDribbler={false}
                              isDefensePlayer={false}
                              onSelect={handlePlayerClick}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* 1T bez strzału, Partnerzy w PK, Przeciwnicy w PK, Strzał, Gol, Regain */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              {/* Przyciski 1T bez strzału, Strzał, Gol, Regain */}
              <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Opcje akcji">
                {formData.teamContext === "attack" && (
                  <button
                    type="button"
                    className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${formData.isPossible1T ? styles.active : ""}`}
                    onClick={() => setFormData({...formData, isPossible1T: !formData.isPossible1T})}
                    data-tooltip="Był kontakt w 1T, ale strzału nie było"
                    aria-pressed={formData.isPossible1T}
                  >
                    1T bez strzału
                  </button>
                )}
                <button
                  type="button"
                  className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${formData.isShot ? styles.active : ""}`}
                  onClick={() => {
                    // Jeśli odznaczamy strzał, odznaczamy też gol
                    if (formData.isShot) {
                      setFormData({...formData, isShot: false, isGoal: false});
                    } else {
                      setFormData({...formData, isShot: true});
                    }
                  }}
                  data-tooltip="Po wejściu w PK był strzał"
                  aria-pressed={formData.isShot}
                >
                  Strzał
                </button>
                <button
                  type="button"
                  className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${formData.isGoal ? styles.active : ""}`}
                  onClick={() => {
                    // Jeśli zaznaczamy gol, automatycznie zaznaczamy strzał
                    if (!formData.isGoal) {
                      setFormData({...formData, isGoal: true, isShot: true});
                    } else {
                      setFormData({...formData, isGoal: false});
                    }
                  }}
                  data-tooltip="Po wejściu w PK był gol"
                  aria-pressed={formData.isGoal}
                >
                  Gol
                </button>
                <button
                  type="button"
                  className={`${styles.actionTypeButton} ${styles.tooltipTrigger} ${formData.isRegain ? styles.active : ""}`}
                  onClick={() => setFormData({...formData, isRegain: !formData.isRegain})}
                  data-tooltip="Przechwyt piłki"
                  aria-pressed={formData.isRegain}
                >
                  Regain
                </button>
              </div>
              
              {/* Sekcja z przyciskami numerycznymi dla Partnerzy w PK i Przeciwnicy w PK */}
              <div
                className={`${styles.countSelectorContainer} ${styles.tooltipTrigger}`}
                data-tooltip="Liczba zawodników w polu karnym"
              >
                {renderCountRow(
                  "Partnerzy w PK",
                  clamp0to10(formData.pkPlayersCount),
                  (n) => setFormData({...formData, pkPlayersCount: clamp0to10(n)}),
                  "Partnerzy w PK (0-10)"
                )}
                {renderCountRow(
                  "Przeciwnicy w PK",
                  clamp0to10(formData.opponentsInPKCount),
                  (n) => setFormData({...formData, opponentsInPKCount: clamp0to10(n)}),
                  "Przeciwnicy w PK (0-10)"
                )}
              </div>
            </div>
          </div>

          <div className={styles.buttonGroup}>
            {editingEntry && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className={styles.deleteButton}
              >
                Usuń wejście
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
                placeholder="Opisz problem z interpretacją wejścia PK..."
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
              onClick={() => {
                const newIsControversial = !formData.isControversial;
                setFormData({ ...formData, isControversial: newIsControversial });
                // Resetuj notatkę gdy odznaczamy kontrowersję
                if (!newIsControversial) {
                  setControversyNote("");
                }
              }}
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
                    pattern="^([0-9]{1,2}):([0-5][0-9])$"
                    className={styles.videoTimeField}
                    maxLength={5}
                  />
                  <span className={styles.matchMinuteInfo}>
                    {currentMatchMinute !== null ? currentMatchMinute : (editingEntry?.minute || formData.minute)}'
                  </span>
                </div>
              </div>
              <button type="submit" className={styles.saveButton}>
                {editingEntry ? "Zapisz zmiany" : "Zapisz akcję"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PKEntryModal;
