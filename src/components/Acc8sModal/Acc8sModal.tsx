"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Acc8sEntry, TeamInfo, Player } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import styles from "./Acc8sModal.module.css";

export interface Acc8sModalProps {
  isOpen: boolean;
  isVideoInternal?: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Acc8sEntry, "id" | "timestamp">) => void;
  onDelete?: (entryId: string) => void;
  editingEntry?: Acc8sEntry;
  matchId: string;
  matchInfo?: TeamInfo | null;
  players: Player[];
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
  onGetVideoTime?: () => Promise<number>; // Funkcja do pobierania surowego czasu z wideo w sekundach
}

const Acc8sModal: React.FC<Acc8sModalProps> = ({
  isOpen,
  isVideoInternal = false,
  onClose,
  onSave,
  onDelete,
  editingEntry,
  matchId,
  matchInfo,
  players,
  onCalculateMinuteFromVideo,
  onGetVideoTime,
}) => {
  const { isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    minute: 1,
    isSecondHalf: false,
    isShotUnder8s: false,
    isPKEntryUnder8s: false,
    passingPlayerIds: [] as string[],
    isControversial: false,
  });
  const isEditMode = Boolean(editingEntry);
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

  // Minuta meczu na żywo z pola MM:SS (korekta -10s jak w videoTimestamp)
  const matchMinuteFromVideoInput = useMemo(() => {
    const rawSeconds = mmssToSeconds(videoTimeMMSS);
    const correctedSeconds = Math.max(0, rawSeconds - 10);
    const minutesIntoHalf = Math.floor(correctedSeconds / 60);
    if (formData.isSecondHalf) {
      return Math.min(90, 45 + minutesIntoHalf + 1);
    }
    return Math.min(45, minutesIntoHalf + 1);
  }, [videoTimeMMSS, formData.isSecondHalf]);

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
    }
  }, [isOpen, isEditMode, editingEntry?.id, editingEntry?.videoTimestampRaw, editingEntry?.videoTimestamp, onGetVideoTime]);

  // Dodatkowy useEffect do aktualizacji videoTimeMMSS gdy editingEntry się zmienia (np. po zapisaniu)
  // Użyj ref do śledzenia poprzednich wartości, aby uniknąć nadpisywania podczas edycji
  const prevVideoTimestampRawRef = useRef<number | undefined>(undefined);
  const prevVideoTimestampRef = useRef<number | undefined>(undefined);
  
  useEffect(() => {
    if (isOpen && isEditMode && editingEntry) {
      const currentVideoTimestampRaw = editingEntry.videoTimestampRaw;
      const currentVideoTimestamp = editingEntry.videoTimestamp;
      
      // Sprawdź czy wartości się zmieniły (np. po zapisaniu)
      const hasChanged = 
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
          // Aktualizuj tylko jeśli wartość faktycznie się zmieniła
          if (newTimeMMSS !== videoTimeMMSS) {
            setVideoTimeMMSS(newTimeMMSS);
          }
        }
        
        // Zaktualizuj refs
        prevVideoTimestampRawRef.current = currentVideoTimestampRaw;
        prevVideoTimestampRef.current = currentVideoTimestamp;
      }
    }
  }, [isOpen, isEditMode, editingEntry?.videoTimestampRaw, editingEntry?.videoTimestamp, videoTimeMMSS]);

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

  const filteredPlayers = useMemo(() => {
    if (!matchInfo) return players;

    const teamPlayers = players.filter(player => 
      player.teams?.includes(matchInfo.team)
    );

    const playersWithMinutes = teamPlayers.filter(player => {
      const playerMinutes = matchInfo.playerMinutes?.find(pm => pm.playerId === player.id);
      
      if (!playerMinutes) {
        return false;
      }

      const playTime = playerMinutes.startMinute === 0 && playerMinutes.endMinute === 0
        ? 0
        : Math.max(0, playerMinutes.endMinute - playerMinutes.startMinute + 1);

      return playTime >= 1;
    });

    return playersWithMinutes;
  }, [players, matchInfo]);

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

  // Aktualizacja aktualnej minuty meczu na podstawie czasu wideo (dodatkowy useEffect dla currentMatchMinute)
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
  }, [isOpen, isEditMode, editingEntry, onCalculateMinuteFromVideo]);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        minute: editingEntry.minute,
        isSecondHalf: editingEntry.isSecondHalf,
        isShotUnder8s: editingEntry.isShotUnder8s,
        isPKEntryUnder8s: editingEntry.isPKEntryUnder8s,
        passingPlayerIds: editingEntry.passingPlayerIds || [],
        isControversial: editingEntry.isControversial || false,
      });
      setControversyNote(editingEntry.controversyNote || "");
    } else {
      // Pobierz aktualną połowę z localStorage
      const savedHalf = typeof window !== 'undefined' ? localStorage.getItem('currentHalf') : null;
      const isP2 = savedHalf === 'P2';
      
      setFormData({
        minute: isP2 ? 46 : 1,
        isSecondHalf: isP2,
        isShotUnder8s: false,
        isPKEntryUnder8s: false,
        passingPlayerIds: [],
      });
    }
  }, [editingEntry, isOpen]);

  const handleAddPass = () => {
    // Dodaj pierwszego dostępnego zawodnika, który nie jest jeszcze wybrany
    const availablePlayer = filteredPlayers.find(player => !formData.passingPlayerIds.includes(player.id));
    if (availablePlayer) {
      setFormData((prev) => ({
        ...prev,
        passingPlayerIds: [...prev.passingPlayerIds, availablePlayer.id],
      }));
    }
  };

  const handleRemovePass = () => {
    // Usuń ostatniego wybranego zawodnika
    if (formData.passingPlayerIds.length > 0) {
      setFormData((prev) => ({
        ...prev,
        passingPlayerIds: prev.passingPlayerIds.slice(0, -1),
      }));
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
    
    // Pobierz czas wideo z localStorage (tak jak w packingu)
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

    const entryData = {
      matchId,
      teamId: matchInfo?.team || "",
      minute: lockedMinute,
      isSecondHalf: lockedIsSecondHalf,
      teamContext: "attack" as const, // Zawsze atak
      isShotUnder8s: formData.isShotUnder8s,
      isPKEntryUnder8s: formData.isPKEntryUnder8s,
      passingPlayerIds: formData.passingPlayerIds,
      isControversial: formData.isControversial,
      controversyNote: formData.isControversial && controversyNote.trim() ? controversyNote.trim() : undefined,
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
      ...(finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw }),
    };

    onSave(entryData);

    // Wyczyść tempVideoTimestamp po zapisaniu
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tempVideoTimestamp');
      localStorage.removeItem('tempVideoTimestampRaw');
    }

    // Resetuj wartości przycisków kompaktowych po zapisaniu (tylko jeśli nie jesteśmy w trybie edycji)
    if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        isShotUnder8s: false,
        isPKEntryUnder8s: false,
        passingPlayerIds: [],
        isControversial: false,
      }));
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingEntry && onDelete) {
      if (confirm("Czy na pewno chcesz usunąć tę akcję 8s ACC?")) {
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
          <h3>{editingEntry ? "Edytuj akcję 8s ACC" : "Dodaj akcję 8s ACC"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
                placeholder="Opisz problem z interpretacją akcji 8s ACC..."
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
                  {matchMinuteFromVideoInput}'
                </span>
              </div>
            </div>
            <button type="submit" className={styles.saveButton}>
              {editingEntry ? "Zapisz zmiany" : "Zapisz akcję"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Acc8sModal;

