"use client";

import React, { useState, useEffect } from "react";
import { PlayerMinutesModalProps, PlayerMinutes } from "@/types";
import styles from "./PlayerMinutesModal.module.css";
import { TEAMS } from "@/constants/teams";

// Lista pozycji do wyboru - taka sama jak w PlayerModal
const POSITIONS = [
  { value: "GK", label: "Bramkarz (GK)" },
  { value: "CB", label: "Środkowy obrońca (CB)" },
  { value: "DM", label: "Defensywny pomocnik (DM)" },
  { value: "AM", label: "Ofensywny pomocnik (AM)" },
  { value: "RS", label: "Prawy skrzydłowy (RW)" },
  { value: "LS", label: "Lewy skrzydłowy (LW)" },
  { value: "ST", label: "Napastnik (ST)" },
];

const PlayerMinutesModal: React.FC<PlayerMinutesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match,
  players,
  currentPlayerMinutes = [],
}) => {
  const [playerMinutes, setPlayerMinutes] = useState<PlayerMinutes[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };

  // Inicjalizacja stanu przy otwarciu modalu
  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
      return;
    }

    if (!initialized) {
      const teamPlayers = players.filter(player => 
        player.teams && player.teams.includes(match.team)
      );
      
      // Jeśli mamy zapisane minuty, używamy ich bezpośrednio
      if (currentPlayerMinutes && currentPlayerMinutes.length > 0) {
        // Filtrujemy tylko minuty dla zawodników z aktualnego zespołu
        const filteredMinutes = currentPlayerMinutes.filter(pm => 
          teamPlayers.some(player => player.id === pm.playerId)
        );
        
        // Dodajemy brakujących zawodników z domyślnymi wartościami
        const missingPlayers = teamPlayers.filter(player => 
          !filteredMinutes.some(pm => pm.playerId === player.id)
        ).map(player => ({
          playerId: player.id,
          startMinute: 0,
          endMinute: 0,
          position: player.position || "CB"
        }));

        setPlayerMinutes([...filteredMinutes, ...missingPlayers]);
      } else {
        // Jeśli nie mamy zapisanych minut, inicjalizujemy domyślne wartości
        const initialPlayerMinutes = teamPlayers.map(player => ({
          playerId: player.id,
          startMinute: 0,
          endMinute: 0,
          position: player.position || "CB"
        }));
        setPlayerMinutes(initialPlayerMinutes);
      }
      
      setInitialized(true);
    }
  }, [isOpen, players, currentPlayerMinutes, match.team, initialized]);

  // Aktualizacja minut konkretnego zawodnika
  const handleMinuteChange = (
    playerId: string, 
    field: 'startMinute' | 'endMinute', 
    value: number
  ) => {
    const minValue = 0;
    const newValue = Math.max(minValue, Math.min(130, value));
    
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { ...pm, [field]: newValue } 
          : pm
      )
    );
  };

  // Aktualizacja pozycji konkretnego zawodnika
  const handlePositionChange = (
    playerId: string,
    position: string
  ) => {
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { ...pm, position } 
          : pm
      )
    );
  };

  // Obliczenie czasu gry zawodnika na podstawie przedziału minut
  const calculatePlayTime = (startMinute: number, endMinute: number) => {
    return Math.max(0, endMinute - startMinute + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sprawdź, czy wartości są poprawne
    const validPlayerMinutes = playerMinutes.filter(pm => 
      pm.startMinute >= 0 &&
      pm.endMinute >= pm.startMinute && 
      pm.endMinute <= 130
    );
    
    onSave(validPlayerMinutes);
    onClose();
  };

  if (!isOpen) return null;

  // Filtruj graczy z wybranego zespołu
  const teamPlayers = players.filter(player => 
    player.teams && player.teams.includes(match.team)
  );

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          Minuty zawodników: {getTeamName(match.team)} vs {match.opponent}
        </h2>
        <p className={styles.modalSubtitle}>
          Wpisz czas rozpoczęcia i zakończenia gry zawodników (w minutach).
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.tableHeader}>
            <div className={styles.headerCell}>Zawodnik</div>
            <div className={styles.headerCell}>Od (min)</div>
            <div className={styles.headerCell}>Do (min)</div>
            <div className={styles.headerCell}>Pozycja</div>
            <div className={styles.headerCell}>Łączny czas</div>
          </div>

          <div className={styles.playersList}>
            {teamPlayers.map(player => {
              // Znajdź zapisane minuty dla tego zawodnika
              const minutes = playerMinutes.find(pm => pm.playerId === player.id) || {
                playerId: player.id,
                startMinute: 0,
                endMinute: 0,
                position: player.position || "CB" // Domyślna pozycja z danych zawodnika
              };
              
              const playTime = calculatePlayTime(minutes.startMinute, minutes.endMinute);
              
              return (
                <div key={player.id} className={styles.playerRow}>
                  <div className={styles.playerName}>
                    <span className={styles.playerNumber}>{player.number}</span>
                    {player.name}
                  </div>
                  <div className={styles.timeInput}>
                    <input
                      type="number"
                      min="0"
                      max="130"
                      value={minutes.startMinute}
                      onChange={(e) => handleMinuteChange(
                        player.id, 
                        'startMinute', 
                        parseInt(e.target.value) || 0
                      )}
                      className={styles.numberInput}
                    />
                  </div>
                  <div className={styles.timeInput}>
                    <input
                      type="number"
                      min="0"
                      max="130"
                      value={minutes.endMinute}
                      onChange={(e) => handleMinuteChange(
                        player.id, 
                        'endMinute', 
                        parseInt(e.target.value) || 0
                      )}
                      className={styles.numberInput}
                    />
                  </div>
                  <div className={styles.positionInput}>
                    <select
                      value={minutes.position || "CB"}
                      onChange={(e) => handlePositionChange(
                        player.id,
                        e.target.value
                      )}
                      className={styles.positionSelect}
                    >
                      {POSITIONS.map(pos => (
                        <option key={pos.value} value={pos.value}>
                          {pos.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.playTime}>
                    {playTime} min
                  </div>
                </div>
              );
            })}

            {teamPlayers.length === 0 && (
              <div className={styles.noPlayers}>
                Brak zawodników przypisanych do zespołu {getTeamName(match.team)}
              </div>
            )}
          </div>
          
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton}>
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerMinutesModal; 