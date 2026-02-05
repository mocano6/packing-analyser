"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PlayerMinutesModalProps, PlayerMinutes } from "@/types";
import styles from "./PlayerMinutesModal.module.css";
import { POSITIONS, getDefaultPosition } from "@/constants/positions";
import { TEAMS } from "@/constants/teams";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";

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
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

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
          position: getDefaultPosition(player.position),
          status: 'dostepny' as const
        }));

        setPlayerMinutes([...filteredMinutes, ...missingPlayers]);
      } else {
        // Jeśli nie mamy zapisanych minut, inicjalizujemy domyślne wartości
        const initialPlayerMinutes = teamPlayers.map(player => ({
          playerId: player.id,
          startMinute: 0,
          endMinute: 0,
          position: getDefaultPosition(player.position),
          status: 'dostepny' as const
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

  // Aktualizacja statusu zawodnika (z automatycznym zerowaniem minut)
  const handleStatusChange = (playerId: string, status: 'dostepny' | 'kontuzja' | 'brak_powolania' | 'inny_zespol') => {
    setPlayerMinutes(prev => 
      prev.map(pm => 
        pm.playerId === playerId 
          ? { 
              ...pm, 
              status,
              // Automatycznie zeruj minuty jeśli zawodnik nie jest dostępny
              startMinute: status !== 'dostepny' ? 0 : pm.startMinute,
              endMinute: status !== 'dostepny' ? 0 : pm.endMinute
            }
          : pm
      )
    );
  };

  // Obliczenie czasu gry zawodnika na podstawie przedziału minut
  const calculatePlayTime = (startMinute: number, endMinute: number) => {
    if (startMinute === 0 && endMinute === 0) {
      return 0;
    }
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

  // Filtruj i grupuj graczy z wybranego zespołu według pozycji
  const teamPlayersByPosition = useMemo(() => {
    const teamPlayers = players.filter(player => 
      player.teams && player.teams.includes(match.team)
    );
    
    // Grupuj według pozycji - łączymy LW i RW w jedną grupę
    const byPosition = teamPlayers.reduce((acc, player) => {
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
    }, {} as Record<string, typeof teamPlayers>);
    
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
        // Dla grupy "Skrzydłowi" sortuj najpierw po pozycji
        if (position === 'Skrzydłowi') {
          const posA = a.position || '';
          const posB = b.position || '';
          if (posA !== posB) {
            // LW przed RW
            if (posA === 'LW') return -1;
            if (posB === 'LW') return 1;
          }
        }
        
        const getLastName = (fullName: string) => {
          const words = fullName.trim().split(/\s+/);
          return words[words.length - 1].toLowerCase();
        };
        const lastNameA = getLastName(a.name);
        const lastNameB = getLastName(b.name);
        return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
      });
    });
    
    return { byPosition, sortedPositions };
  }, [players, match.team]);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              Minuty zawodników: {getTeamName(match.team)} vs {match.opponent}
            </h2>
            <p className={styles.modalSubtitle}>
              Wpisz czas rozpoczęcia i zakończenia gry zawodników (w minutach).
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Zamknij"
            title="Zamknij"
          >
            ×
          </button>
        </div>
        
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.tableHeader}>
            <div className={styles.headerCell}>Zawodnik</div>
            <div className={styles.headerCell}>Pozycja</div>
            <div className={styles.headerCell}>Od</div>
            <div className={styles.headerCell}>Do</div>
            <div className={styles.headerCell}>Status</div>
            <div className={styles.headerCell}>Czas gry</div>
          </div>
          <div className={styles.playersList}>
            {teamPlayersByPosition.sortedPositions.map(position => {
              const positionPlayers = teamPlayersByPosition.byPosition[position];
              
              return (
                <div key={position} className={styles.positionGroup}>
                  <div className={styles.positionGroupHeader}>
                    {position === 'Skrzydłowi' ? 'W' : position}
                  </div>
                  <div className={styles.positionGroupContent}>
                    {positionPlayers.map(player => {
              // Znajdź zapisane minuty dla tego zawodnika
              const minutes = playerMinutes.find(pm => pm.playerId === player.id) || {
                playerId: player.id,
                startMinute: 0,
                endMinute: 0,
                position: player.position || "CB", // Domyślna pozycja z danych zawodnika
                status: 'dostepny' as const
              };
              
              const playTime = calculatePlayTime(minutes.startMinute, minutes.endMinute);
              
              return (
                <div key={player.id} className={styles.playerRow}>
                      <div className={styles.playerName}>
                        <span className={styles.playerNumber}>{player.number}</span>
                        <span>{getPlayerLabel(player.id, playersIndex)}</span>
                        {player.isTestPlayer && (
                          <span className={styles.testPlayerBadge}>T</span>
                        )}
                      </div>
                      <div className={styles.positionInput}>
                        <select
                          value={minutes.position || getDefaultPosition(player.position)}
                          onChange={(e) => handlePositionChange(
                            player.id,
                            e.target.value
                          )}
                          className={styles.positionSelect}
                        >
                          {POSITIONS.map(pos => (
                            <option key={pos.value} value={pos.value}>
                              {pos.value}
                            </option>
                          ))}
                        </select>
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
                          disabled={minutes.status === 'kontuzja' || minutes.status === 'brak_powolania' || minutes.status === 'inny_zespol'}
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
                          disabled={minutes.status === 'kontuzja' || minutes.status === 'brak_powolania' || minutes.status === 'inny_zespol'}
                        />
                      </div>
                      <div className={styles.statusInput}>
                        <select
                          value={minutes.status || 'dostepny'}
                          onChange={(e) => handleStatusChange(
                            player.id,
                            e.target.value as 'dostepny' | 'kontuzja' | 'brak_powolania' | 'inny_zespol'
                          )}
                          className={styles.statusSelect}
                        >
                          <option value="dostepny">Dostępny</option>
                          <option value="kontuzja">Kontuzja</option>
                          <option value="brak_powolania">Brak powołania</option>
                          <option value="inny_zespol">Inny zespół</option>
                        </select>
                      </div>
                      <div className={styles.playTime}>
                        {playTime} min
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
              );
            })}

            {teamPlayersByPosition.sortedPositions.length === 0 && (
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