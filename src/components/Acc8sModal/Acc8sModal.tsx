"use client";

import React, { useState, useEffect, useMemo } from "react";
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
      console.log('Acc8sModal: wywołuję onCalculateMinuteFromVideo');
      onCalculateMinuteFromVideo().then((result) => {
        console.log('Acc8sModal: wynik obliczenia:', result);
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
        minute: editingEntry.minute,
        isSecondHalf: editingEntry.isSecondHalf,
        isShotUnder8s: editingEntry.isShotUnder8s,
        isPKEntryUnder8s: editingEntry.isPKEntryUnder8s,
        passingPlayerIds: editingEntry.passingPlayerIds || [],
        isControversial: editingEntry.isControversial || false,
      });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const lockedMinute = isEditMode ? (editingEntry?.minute ?? formData.minute) : formData.minute;
    const lockedIsSecondHalf = isEditMode ? (editingEntry?.isSecondHalf ?? formData.isSecondHalf) : formData.isSecondHalf;
    
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
    
    console.log('Acc8sModal handleSubmit - videoTimestamp z localStorage:', videoTimestamp);
    console.log('Acc8sModal handleSubmit - parsedVideoTimestamp:', parsedVideoTimestamp);
    console.log('Acc8sModal handleSubmit - isValidTimestamp:', isValidTimestamp);
    console.log('Acc8sModal handleSubmit - editingEntry?.videoTimestamp:', editingEntry?.videoTimestamp);
    
    // Przy edycji zachowaj istniejący videoTimestamp, jeśli nowy nie jest dostępny
    const finalVideoTimestamp = isEditMode
      ? editingEntry?.videoTimestamp
      : (isValidTimestamp ? parsedVideoTimestamp : undefined);

    const finalVideoTimestampRaw = isEditMode
      ? (editingEntry as any)?.videoTimestampRaw
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
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
      ...(finalVideoTimestampRaw !== undefined && finalVideoTimestampRaw !== null && { videoTimestampRaw: finalVideoTimestampRaw }),
    };

    console.log('Acc8sModal handleSubmit - entryData:', entryData);
    console.log('Acc8sModal handleSubmit - isSecondHalf:', entryData.isSecondHalf);
    console.log('Acc8sModal handleSubmit - videoTimestamp w entryData:', entryData.videoTimestamp);

    onSave(entryData);

    // Wyczyść tempVideoTimestamp po zapisaniu
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tempVideoTimestamp');
      localStorage.removeItem('tempVideoTimestampRaw');
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

          {/* Buttony dla checkboxów */}
          <div className={styles.compactButtonsRow}>
            <button
              type="button"
              className={`${styles.compactButton} ${formData.isShotUnder8s ? styles.activeButton : ""}`}
              onClick={() => setFormData({...formData, isShotUnder8s: !formData.isShotUnder8s})}
              title="Strzał 8s"
              aria-pressed={formData.isShotUnder8s}
            >
              <span className={styles.compactLabel}>Strzał 8s</span>
            </button>
            <button
              type="button"
              className={`${styles.compactButton} ${formData.isPKEntryUnder8s ? styles.activeButton : ""}`}
              onClick={() => setFormData({...formData, isPKEntryUnder8s: !formData.isPKEntryUnder8s})}
              title="PK 8s"
              aria-pressed={formData.isPKEntryUnder8s}
            >
              <span className={styles.compactLabel}>PK 8s</span>
            </button>
          </div>

          {/* Liczba podań - widoczne tylko dla admina */}
          {isAdmin && (
            <div 
              className={styles.compactPointsButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAddPass();
              }}
              title="Liczba podań = liczba wybranych zawodników"
            >
              <span className={styles.compactLabel}>Liczba podań</span>
              <span className={styles.pointsValue}><b>{formData.passingPlayerIds.length}</b></span>
              <button
                className={styles.compactSubtractButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemovePass();
                }}
                title="Odejmij podanie"
                type="button"
                disabled={formData.passingPlayerIds.length === 0}
              >
                −
              </button>
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
              <div className={styles.minuteControls}>
                <button
                  type="button"
                  className={styles.minuteButton}
                  onClick={() => {
                    const newMinute = Math.max(
                      formData.isSecondHalf ? 46 : 1,
                      formData.minute - 1
                    );
                    setFormData({...formData, minute: newMinute});
                  }}
                  title="Zmniejsz minutę"
                  disabled={isEditMode}
                >
                  −
                </button>
                <input
                  id="minute"
                  type="number"
                  value={formData.minute}
                  onChange={(e) => {
                    const newMinute = parseInt(e.target.value) || (formData.isSecondHalf ? 46 : 1);
                    setFormData({
                      ...formData,
                      minute: formData.isSecondHalf ? Math.max(46, newMinute) : Math.min(45, newMinute),
                    });
                  }}
                  min={formData.isSecondHalf ? 46 : 1}
                  max={formData.isSecondHalf ? 130 : 65}
                  className={styles.minuteField}
                  required
                  readOnly={isEditMode}
                  disabled={isEditMode}
                />
                <button
                  type="button"
                  className={styles.minuteButton}
                  onClick={() => {
                    const newMinute = Math.min(
                      formData.isSecondHalf ? 130 : 65,
                      formData.minute + 1
                    );
                    setFormData({...formData, minute: newMinute});
                  }}
                  title="Zwiększ minutę"
                  disabled={isEditMode}
                >
                  +
                </button>
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

