"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Acc8sEntry, TeamInfo, Player } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./Acc8sModal.module.css";

export interface Acc8sModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Acc8sEntry, "id" | "timestamp">) => void;
  onDelete?: (entryId: string) => void;
  editingEntry?: Acc8sEntry;
  matchId: string;
  matchInfo?: TeamInfo | null;
  players: Player[];
}

const Acc8sModal: React.FC<Acc8sModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingEntry,
  matchId,
  matchInfo,
  players,
}) => {
  const [formData, setFormData] = useState({
    minute: 1,
    isSecondHalf: false,
    isShotUnder8s: false,
    isPKEntryUnder8s: false,
    passingPlayerIds: [] as string[],
  });

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

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        minute: editingEntry.minute,
        isSecondHalf: editingEntry.isSecondHalf,
        isShotUnder8s: editingEntry.isShotUnder8s,
        isPKEntryUnder8s: editingEntry.isPKEntryUnder8s,
        passingPlayerIds: editingEntry.passingPlayerIds || [],
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

  const handlePlayerToggle = (playerId: string) => {
    setFormData((prev) => {
      if (prev.passingPlayerIds.includes(playerId)) {
        return {
          ...prev,
          passingPlayerIds: prev.passingPlayerIds.filter(id => id !== playerId),
        };
      } else {
        return {
          ...prev,
          passingPlayerIds: [...prev.passingPlayerIds, playerId],
        };
      }
    });
  };

  // Funkcja do obsługi zmiany połowy
  const handleSecondHalfToggle = (value: boolean) => {
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
    
    // Pobierz czas wideo z localStorage (tak jak w packingu)
    const videoTimestamp = typeof window !== 'undefined' 
      ? localStorage.getItem('tempVideoTimestamp') 
      : null;
    const parsedVideoTimestamp = videoTimestamp ? parseInt(videoTimestamp, 10) : undefined;
    const isValidTimestamp = parsedVideoTimestamp !== undefined && !isNaN(parsedVideoTimestamp) && parsedVideoTimestamp >= 0;
    
    console.log('Acc8sModal handleSubmit - videoTimestamp z localStorage:', videoTimestamp);
    console.log('Acc8sModal handleSubmit - parsedVideoTimestamp:', parsedVideoTimestamp);
    console.log('Acc8sModal handleSubmit - isValidTimestamp:', isValidTimestamp);
    console.log('Acc8sModal handleSubmit - editingEntry?.videoTimestamp:', editingEntry?.videoTimestamp);
    
    // Przy edycji zachowaj istniejący videoTimestamp, jeśli nowy nie jest dostępny
    const finalVideoTimestamp = isValidTimestamp 
      ? parsedVideoTimestamp 
      : (editingEntry?.videoTimestamp);

    const entryData = {
      matchId,
      teamId: matchInfo?.team || "",
      minute: formData.minute,
      isSecondHalf: formData.isSecondHalf,
      teamContext: "attack" as const, // Zawsze atak
      isShotUnder8s: formData.isShotUnder8s,
      isPKEntryUnder8s: formData.isPKEntryUnder8s,
      passingPlayerIds: formData.passingPlayerIds,
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
    };

    console.log('Acc8sModal handleSubmit - entryData:', entryData);
    console.log('Acc8sModal handleSubmit - isSecondHalf:', entryData.isSecondHalf);
    console.log('Acc8sModal handleSubmit - videoTimestamp w entryData:', entryData.videoTimestamp);

    onSave(entryData);

    // Wyczyść tempVideoTimestamp po zapisaniu
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tempVideoTimestamp');
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
    <div className={styles.overlay} onClick={onClose}>
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
              >
                P1
              </button>
              <button
                type="button"
                className={`${styles.halfButton} ${formData.isSecondHalf ? styles.activeHalf : ''}`}
                onClick={() => handleSecondHalfToggle(true)}
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

          {/* Liczba podań */}
          <div 
            className={styles.compactPointsButton}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Liczba podań = liczba wybranych zawodników
            }}
            title="Liczba podań = liczba wybranych zawodników"
          >
            <span className={styles.compactLabel}>Liczba podań</span>
            <span className={styles.pointsValue}><b>{formData.passingPlayerIds.length}</b></span>
          </div>

          {/* Wielokrotny wybór zawodników biorących udział w akcji */}
          <div className={styles.fieldGroup}>
            <label className={styles.playerTitle}>
              Zawodnicy biorący udział w akcji ({formData.passingPlayerIds.length}):
            </label>
            <div className={styles.playersGrid}>
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  className={`${styles.playerTile} ${
                    formData.passingPlayerIds.includes(player.id) 
                      ? styles.playerSelectedTile
                      : ''
                  } ${player.imageUrl ? styles.withImage : ''}`}
                  onClick={() => handlePlayerToggle(player.id)}
                >
                  {player.imageUrl && (
                    <>
                      <img
                        src={player.imageUrl}
                        alt=""
                        className={styles.playerTileImage}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className={styles.playerTileOverlay}></div>
                    </>
                  )}
                  <div className={styles.playerContent}>
                    <div className={styles.number}>{player.number}</div>
                    <div className={styles.playerInfo}>
                      <div className={styles.name}>{getPlayerFullName(player)}</div>
                      <div className={styles.details}>
                        {player.position && (
                          <span className={styles.position}>{player.position}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Anuluj
            </button>
            <div className={styles.minuteInput}>
              <label htmlFor="minute">Minuta:</label>
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

