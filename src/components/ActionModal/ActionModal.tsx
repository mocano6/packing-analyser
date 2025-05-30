"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./ActionModal.module.css";
import { Player, Action, TeamInfo } from "@/types";
import ActionTypeToggle from "../ActionTypeToggle/ActionTypeToggle";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "./PlayerCard";
import { TEAMS } from "@/constants/teams";

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
  editingAction?: Action | null;
  allMatches?: TeamInfo[];
  selectedMatchId?: string | null;
  onMatchSelect?: (matchId: string) => void;
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
  editingAction,
  allMatches,
  selectedMatchId,
  onMatchSelect,
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
      console.log("ActionModal: Ustawiam mecz z editingAction:", editingAction.matchId);
      setCurrentSelectedMatch(editingAction.matchId);
      if (onMatchSelect) {
        onMatchSelect(editingAction.matchId);
      }
    } else if (selectedMatchId) {
      console.log("ActionModal: Ustawiam mecz z selectedMatchId:", selectedMatchId);
      setCurrentSelectedMatch(selectedMatchId);
    }
  }, [editingAction?.matchId, selectedMatchId]);

  // Funkcja obsługi zmiany meczu z useCallback dla lepszej optymalizacji
  const handleMatchChange = useCallback((matchId: string) => {
    console.log("ActionModal: Zmiana meczu na:", matchId);
    setCurrentSelectedMatch(matchId);
    if (onMatchSelect) {
      onMatchSelect(matchId);
    }
  }, [onMatchSelect]);

  // Filtrowanie zawodników według wybranego meczu (tylko w trybie edycji)
  const filteredPlayers = React.useMemo(() => {
    let playersToFilter = isEditMode && allMatches && currentSelectedMatch ? 
      players.filter(player => {
        const selectedMatch = allMatches.find(match => match.matchId === currentSelectedMatch);
        return selectedMatch ? player.teams?.includes(selectedMatch.team) : false;
      }) : 
      players;
    
    // Sortowanie alfabetyczne po nazwisku
    return playersToFilter.sort((a, b) => {
      // Wyciągnij nazwisko (ostatnie słowo) z pełnej nazwy
      const getLastName = (fullName: string) => {
        const words = fullName.trim().split(/\s+/);
        return words[words.length - 1].toLowerCase();
      };
      
      const lastNameA = getLastName(a.name);
      const lastNameB = getLastName(b.name);
      
      return lastNameA.localeCompare(lastNameB, 'pl', { sensitivity: 'base' });
    });
  }, [isEditMode, allMatches, currentSelectedMatch, players]);

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
    
    console.log(`Zmieniono połowę na: ${value ? 'P2' : 'P1'}`);
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
        console.error("ActionModal: Brak informacji o strefach w localStorage!");
        alert("Błąd: Brak informacji o wybranych strefach. Proszę wybrać strefy początkową i końcową na boisku.");
        return;
      }
    }

    // Dodajemy log przed zapisaniem, aby sprawdzić stan w konsoli
    console.log("ActionModal: Zapisuję akcję, stan przed zapisem:", {
      selectedPlayerId,
      selectedReceiverId,
      actionType,
      actionMinute,
      currentPoints,
      isP3Active,
      isShot,
      isGoal,
      isPenaltyAreaEntry,
      isEditMode
    });

    // Wywołaj funkcję zapisującą akcję, ale nie zamykaj modalu od razu
    // Komponent nadrzędny sam zadecyduje czy i kiedy zamknąć modal
    onSaveAction();
  };

  const handleCancel = () => {
    onReset();
    onClose();
  };

  const handleReset = () => {
    // Zapisz aktualną wartość minuty oraz zachowaj informację o połowie meczu
    const currentMinute = actionMinute;
    const currentHalf = isSecondHalf;
    
    // Zresetuj tylko dane z formularza: 
    // - punkty, 
    // - przełączniki P3, strzał, bramka, wejście w PK
    // - NIE resetujemy wyboru zawodników ani stref (startZone, endZone)
    
    // Wywołaj funkcję resetowania stanu z komponentu nadrzędnego
    onReset();
    
    // Przywróć zapisane wartości minuty i połowy meczu
    onMinuteChange(currentMinute);
    onSecondHalfToggle(currentHalf);
    
    console.log("Reset formularza akcji - zachowano wartości stref i zaznaczonych zawodników");
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
            </div>
          </div>

          {/* Przyciski punktów */}
          <div className={styles.buttonsGrid}>
            {ACTION_BUTTONS.map((button, index) =>
              button.type === "toggle" ? (
                <button
                  key={index}
                  className={`${styles.actionButton} ${
                    isP3Active ? styles.activeButton : ""
                  }`}
                  onClick={onP3Toggle}
                  title={button.description}
                  aria-pressed={isP3Active}
                  type="button"
                >
                  <span className={styles.buttonLabel}>{button.label}</span>
                  <span className={styles.buttonDescription}>
                    {button.description}
                  </span>
                </button>
              ) : (
                <button
                  key={index}
                  className={styles.actionButton}
                  onClick={() => handlePointsAdd(button.points)}
                  title={button.description}
                  type="button"
                >
                  <span className={styles.buttonLabel}>{button.label}: <b>{currentPoints}</b></span>
                  <span className={styles.buttonDescription}>
                    {button.description}
                  </span>
                </button>
              )
            )}

            {/* Przycisk "Wejście w PK" */}
            <button
              className={`${styles.actionButton} ${
                isPenaltyAreaEntry ? styles.activeButton : ""
              }`}
              onClick={handlePenaltyAreaEntryToggle}
              aria-pressed={isPenaltyAreaEntry}
              type="button"
            >
              <span className={styles.buttonLabel}>Wejście w PK</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli akcja zakończyła się wejściem w pole karne
              </span>
            </button>

            {/* Przycisk "Strzał" */}
            <button
              className={`${styles.actionButton} ${
                isShot ? styles.activeButton : ""
              }`}
              onClick={handleShotToggle}
              aria-pressed={isShot}
              type="button"
            >
              <span className={styles.buttonLabel}>Strzał</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli akcja zakończyła się strzałem
              </span>
            </button>

            {/* Przycisk "Bramka" */}
            <button
              className={`${styles.actionButton} ${
                isGoal ? styles.activeButton : ""
              }`}
              onClick={handleGoalToggle}
              disabled={!isShot}
              aria-pressed={isGoal}
              aria-disabled={!isShot}
              type="button"
              style={{
                opacity: !isShot ? 0.5 : 1,
                cursor: !isShot ? "not-allowed" : "pointer",
              }}
            >
              <span className={styles.buttonLabel}>Bramka</span>
              <span className={styles.buttonDescription}>
                Zaznacz jeśli strzał zakończył się bramką
              </span>
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
              <input
                id="action-minute-modal"
                type="number"
                value={actionMinute}
                onChange={handleMinuteChange}
                min={isSecondHalf ? 46 : 1}
                max={isSecondHalf ? 130 : 65}
              />
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