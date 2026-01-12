"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PKEntry, Player, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./PKEntryModal.module.css";
import PlayerCard from "../ActionModal/PlayerCard";

export interface PKEntryModalProps {
  isOpen: boolean;
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
}

const PKEntryModal: React.FC<PKEntryModalProps> = ({
  isOpen,
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
}) => {
  const [formData, setFormData] = useState({
    senderId: "",
    senderName: "",
    receiverId: "",
    receiverName: "",
    minute: 1,
    isSecondHalf: false,
    entryType: "pass" as "pass" | "dribble" | "sfg" | "regain",
    teamContext: "attack" as "attack" | "defense",
    isPossible1T: false,
    pkPlayersCount: 0,
  });

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
      console.log('PKEntryModal: wywołuję onCalculateMinuteFromVideo');
      onCalculateMinuteFromVideo().then((result) => {
        console.log('PKEntryModal: wynik obliczenia:', result);
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
      });
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
      });
    }
  }, [editingEntry, isOpen, startX]);

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
    
    // Walidacja w zależności od typu akcji
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
    
    // Przy edycji zachowaj istniejący videoTimestamp, jeśli nowy nie jest dostępny
    const finalVideoTimestamp = isValidTimestamp 
      ? parsedVideoTimestamp 
      : (editingEntry?.videoTimestamp);

    // Przygotuj obiekt do zapisania
    const entryDataToSave = {
      matchId,
      teamId: matchInfo?.team || "",
      startX: editingEntry ? editingEntry.startX : startX,
      startY: editingEntry ? editingEntry.startY : startY,
      endX: editingEntry ? editingEntry.endX : endX,
      endY: editingEntry ? editingEntry.endY : endY,
      minute: formData.minute,
      isSecondHalf: formData.isSecondHalf,
      senderId: formData.senderId,
      senderName: formData.senderName,
      entryType: formData.entryType,
      teamContext: formData.teamContext,
      isPossible1T: formData.isPossible1T,
      pkPlayersCount: formData.pkPlayersCount,
      ...(finalVideoTimestamp !== undefined && finalVideoTimestamp !== null && { videoTimestamp: finalVideoTimestamp }),
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{editingEntry ? "Edytuj wejście PK" : "Dodaj wejście PK"}</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
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
              onClick={() => setFormData({...formData, teamContext: "defense"})}
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
              <button
                type="button"
                className={`${styles.actionTypeButton} ${formData.entryType === "regain" ? styles.active : ""}`}
                onClick={() => setFormData({
                  ...formData, 
                  entryType: "regain",
                  receiverId: formData.receiverId || "", // Zachowaj odbiorcę jeśli istnieje (opcjonalny)
                  receiverName: formData.receiverName || "",
                })}
              >
                Regain
              </button>
            </div>
          </div>

          {/* Niewykorzystane 1T i Liczba zawodników w PK */}
          <div className={styles.fieldGroup}>
            <div className={styles.compactButtonsRow}>
              <button
                type="button"
                className={`${styles.compactButton} ${formData.isPossible1T ? styles.activeButton : ""}`}
                onClick={() => setFormData({...formData, isPossible1T: !formData.isPossible1T})}
                title="Niewykorzystane 1T"
                aria-pressed={formData.isPossible1T}
              >
                <span className={styles.compactLabel}>Niewykorzystane 1T</span>
              </button>
              <div 
                className={styles.compactPointsButtonSmall}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFormData({...formData, pkPlayersCount: formData.pkPlayersCount + 1});
                }}
                title="Kliknij aby zwiększyć liczbę zawodników w PK"
              >
                <span className={styles.compactLabel}>Liczba zawodników w PK</span>
                <span className={styles.pointsValue}><b>{formData.pkPlayersCount}</b></span>
                <button
                  type="button"
                  className={styles.compactSubtractButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFormData({...formData, pkPlayersCount: Math.max(0, formData.pkPlayersCount - 1)});
                  }}
                  title="Odejmij 1"
                >
                  −
                </button>
              </div>
            </div>
          </div>

          {/* Lista zawodników - jedna lista z zielonym i czerwonym obramowaniem */}
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
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Anuluj
            </button>
            <div className={styles.minuteAndSave}>
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
                      setFormData((prev) => ({
                        ...prev,
                        minute: formData.isSecondHalf ? Math.max(46, Math.min(120, newMinute)) : Math.min(45, Math.max(1, newMinute)),
                      }));
                    }}
                    min={formData.isSecondHalf ? 46 : 1}
                    max="120"
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default PKEntryModal;
