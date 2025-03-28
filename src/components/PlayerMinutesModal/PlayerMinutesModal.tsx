"use client";

import React, { useState, useEffect, useRef } from "react";
import { PlayerMinutesModalProps, PlayerMinutes } from "@/types";
import styles from "./PlayerMinutesModal.module.css";
import { TEAMS } from "@/constants/teams";

const PlayerMinutesModal: React.FC<PlayerMinutesModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match,
  players,
  currentPlayerMinutes = [],
}) => {
  const [playerMinutes, setPlayerMinutes] = useState<PlayerMinutes[]>([]);
  const initialMinutesRef = useRef<PlayerMinutes[]>([]);

  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };

  // Inicjalizacja stanu przy otwarciu modalu
  useEffect(() => {
    if (!isOpen) {
      setPlayerMinutes([]);
      return;
    }

    // Inicjalizuj tylko raz przy pierwszym otwarciu
    if (initialMinutesRef.current.length === 0) {
      const teamPlayers = players.filter(player => 
        player.teams && player.teams.includes(match.team)
      );
      
      initialMinutesRef.current = currentPlayerMinutes.length > 0 
        ? currentPlayerMinutes 
        : teamPlayers.map(player => ({
            playerId: player.id,
            startMinute: 0,
            endMinute: 130
          }));
    }

    setPlayerMinutes(initialMinutesRef.current);
  }, [isOpen]);

  // Reset przy zamknięciu modalu
  useEffect(() => {
    if (!isOpen) {
      initialMinutesRef.current = [];
    }
  }, [isOpen]);

  // Aktualizacja minut konkretnego zawodnika
  const handleMinuteChange = (
    playerId: string, 
    field: 'startMinute' | 'endMinute', 
    value: number
  ) => {
    const newValue = Math.max(0, Math.min(130, value));
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { ...pm, [field]: newValue } 
          : pm
      )
    );
  };

  // Obliczenie czasu gry zawodnika na podstawie przedziału minut
  const calculatePlayTime = (startMinute: number, endMinute: number) => {
    return Math.max(0, endMinute - startMinute);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Sprawdź, czy wartości są poprawne
    const validPlayerMinutes = playerMinutes.filter(pm => 
      pm.startMinute >= 0 && 
      pm.endMinute >= pm.startMinute && 
      pm.endMinute <= 130 // Zwiększamy maksymalny czas do 130 minut
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
          Wpisz przedziały minut, w których zawodnicy grali w meczu.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.tableHeader}>
            <div className={styles.headerCell}>Zawodnik</div>
            <div className={styles.headerCell}>Od (min)</div>
            <div className={styles.headerCell}>Do (min)</div>
            <div className={styles.headerCell}>Czas gry</div>
          </div>

          <div className={styles.playersList}>
            {teamPlayers.map(player => {
              // Znajdź zapisane minuty dla tego zawodnika
              const minutes = playerMinutes.find(pm => pm.playerId === player.id) || {
                playerId: player.id,
                startMinute: 0,
                endMinute: 130
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