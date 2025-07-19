"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./ActionModal.module.css";
import { Player, Action, TeamInfo } from "@/types";
import ActionTypeToggle from "../ActionTypeToggle/ActionTypeToggle";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "./PlayerCard";
import { TEAMS } from "@/constants/teams";
import { sortPlayersByLastName } from '@/utils/playerUtils';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  onSenderSelect: (id: string | null) => void;
  onReceiverSelect: (id: string | null) => void;
  actionMinute: number;
  onMinuteChange: (minute: number) => void;
  actionType: "pass" | "dribble";
  onActionTypeChange: (type: "pass" | "dribble") => void;
  currentPoints: number;
  onAddPoints: (points: number) => void;
  isP1Active: boolean;
  onP1Toggle: () => void;
  isP2Active: boolean;
  onP2Toggle: () => void;
  isP3Active: boolean;
  onP3Toggle: () => void;
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
}

const ActionModal: React.FC<ActionModalProps> = ({
  isOpen,
  onClose,
  players,
  selectedPlayerId,
  selectedReceiverId,
  onSenderSelect,
  onReceiverSelect,
  actionMinute,
  onMinuteChange,
  actionType,
  onActionTypeChange,
  currentPoints,
  onAddPoints,
  isP1Active,
  onP1Toggle,
  isP2Active,
  onP2Toggle,
  isP3Active,
  onP3Toggle,
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
}) => {
  const [currentSelectedMatch, setCurrentSelectedMatch] = useState<string | null>(null);

  // Określamy czy jesteśmy w trybie edycji
  const isEditMode = !!editingAction;

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

  if (!isOpen) return null;

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onMinuteChange(parseInt(e.target.value) || 0);
  };

  const handleActionTypeChange = (type: "pass" | "dribble") => {
    onActionTypeChange(type);
    
    // Jeśli zmieniamy na drybling, usuwamy odbiorcę
    if (type === "dribble" && selectedReceiverId) {
      onReceiverSelect(null);
    }
  };

  const handlePlayerClick = (playerId: string) => {
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
    onShotToggle(!isShot);
  };

  const handleGoalToggle = () => {
    onGoalToggle(!isGoal);
  };

  const handlePenaltyAreaEntryToggle = () => {
    onPenaltyAreaEntryToggle(!isPenaltyAreaEntry);
  };

  const handleSecondHalfToggle = (value: boolean) => {
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
    // Najpierw sprawdźmy czy wszystkie wymagane pola są wypełnione
    if (!selectedPlayerId) {
      alert("Wybierz zawodnika rozpoczynającego akcję!");
      return;
    }
    
    // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
    if (actionType === "pass" && !selectedReceiverId) {
      alert("Wybierz zawodnika kończącego podanie!");
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
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{isEditMode ? "Edytuj akcję" : "Dodaj akcję"}</h2>
        <div className={styles.form}>
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

          {/* Typ akcji */}
          <div className={styles.formGroup}>
            <div className={styles.togglesRow}>
              <div className={styles.toggleGroup}>
                <label>Typ akcji:</label>
                <ActionTypeToggle
                  actionType={actionType}
                  onActionTypeChange={handleActionTypeChange}
                />
              </div>
              <div className={styles.toggleGroup}>
                <label>Połowa:</label>
                <div className={styles.halfToggle}>
                  <button
                    className={`${styles.halfButton} ${!isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={() => handleSecondHalfToggle(false)}
                  >
                    P1
                  </button>
                  <button
                    className={`${styles.halfButton} ${isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={() => handleSecondHalfToggle(true)}
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
              {actionType === "dribble" ? "Wybierz zawodnika dryblującego:" : "Wybierz zawodników:"}
            </label>
            <div className={styles.playerSelectionInfo}>
              {actionType === "pass" ? (
                <p>Kliknij, aby wybrać zawodnika rozpoczynającego, a następnie kliknij na innego zawodnika, aby wybrać kończącego.</p>
              ) : (
                <p>Kliknij, aby wybrać zawodnika wykonującego drybling.</p>
              )}
            </div>
            <div className={styles.playersGrid}>
              {filteredPlayers.length > 0 ? (
                <>
                  {isEditMode && filteredPlayers.length < 3 && (
                    <div className={styles.warningMessage}>
                      ⚠️ Tylko {filteredPlayers.length} zawodnik{filteredPlayers.length === 1 ? '' : 'ów'} dostępn{filteredPlayers.length === 1 ? 'y' : 'ych'} w tym meczu
                    </div>
                  )}
                  {filteredPlayers.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    isSender={actionType === "pass" ? player.id === selectedPlayerId : false}
                    isReceiver={actionType === "pass" ? player.id === selectedReceiverId : false}
                    isDribbler={actionType === "dribble" ? player.id === selectedPlayerId : false}
                    onSelect={handlePlayerClick}
                  />
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
            {/* Połączony element P1, P2, P3 */}
            <div className={styles.pButtonsGroup}>
              <div className={styles.pTopRow}>
                <button
                  className={`${styles.compactButton} ${
                    isP1Active ? styles.activeButton : ""
                  }`}
                  onClick={onP1Toggle}
                  title="Aktywuj/Dezaktywuj P1"
                  aria-pressed={isP1Active}
                  type="button"
                >
                  <span className={styles.compactLabel}>P1</span>
                </button>
                
                <button
                  className={`${styles.compactButton} ${
                    isP2Active ? styles.activeButton : ""
                  }`}
                  onClick={onP2Toggle}
                  title="Aktywuj/Dezaktywuj P2"
                  aria-pressed={isP2Active}
                  type="button"
                >
                  <span className={styles.compactLabel}>P2</span>
                </button>
              </div>
              
              <button
                className={`${styles.compactButton} ${styles.pButtonBottom} ${
                  isP3Active ? styles.activeButton : ""
                }`}
                onClick={onP3Toggle}
                title="Aktywuj/Dezaktywuj P3"
                aria-pressed={isP3Active}
                type="button"
              >
                <span className={styles.compactLabel}>P3</span>
              </button>
            </div>

            {/* Pozostałe przyciski punktów */}
            {ACTION_BUTTONS.map((button, index) => {
              if (button.type === "points") {
                return (
                  <div 
                    key={index} 
                    className={styles.compactPointsButton}
                    onClick={() => handlePointsAdd(button.points)}
                    title={button.description}
                  >
                    <span className={styles.compactLabel}>{button.label}</span>
                    <span className={styles.pointsValue}><b>{currentPoints}</b></span>
                    <button
                      className={styles.compactSubtractButton}
                      onClick={(e) => {
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

            {/* Pozostałe przyciski toggle */}
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
          
          {/* Przyciski kontrolne z polem minuty pomiędzy */}
          <div className={styles.controlButtons}>
            <button
              className={`${styles.controlButton} ${styles.resetButton}`}
              onClick={handleCancel}
              type="button"
            >
              Anuluj
            </button>
            
            <button
              className={`${styles.controlButton} ${styles.clearButton}`}
              onClick={handleReset}
              type="button"
            >
              ⌫ Resetuj
            </button>
            
            <div className={styles.minuteInput}>
              <label htmlFor="action-minute-modal">Minuta:</label>
              <div className={styles.minuteControls}>
                <button
                  type="button"
                  className={styles.minuteButton}
                  onClick={() => {
                    const newMinute = Math.max(
                      isSecondHalf ? 46 : 1, 
                      actionMinute - 1
                    );
                    onMinuteChange(newMinute);
                  }}
                  title="Zmniejsz minutę"
                >
                  −
                </button>
                <input
                  id="action-minute-modal"
                  type="number"
                  value={actionMinute}
                  onChange={handleMinuteChange}
                  min={isSecondHalf ? 46 : 1}
                  max={isSecondHalf ? 130 : 65}
                  className={styles.minuteField}
                />
                <button
                  type="button"
                  className={styles.minuteButton}
                  onClick={() => {
                    const newMinute = Math.min(
                      isSecondHalf ? 130 : 65, 
                      actionMinute + 1
                    );
                    onMinuteChange(newMinute);
                  }}
                  title="Zwiększ minutę"
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              className={`${styles.controlButton} ${styles.saveButton}`}
              onClick={handleSave}
              type="button"
            >
              Zapisz akcję
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionModal; 