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
  isP0StartActive: boolean;
  onP0StartToggle: () => void;
  isP1StartActive: boolean;
  onP1StartToggle: () => void;
  isP2StartActive: boolean;
  onP2StartToggle: () => void;
  isP3StartActive: boolean;
  onP3StartToggle: () => void;
  isP0Active: boolean;
  onP0Toggle: () => void;
  isP1Active: boolean;
  onP1Toggle: () => void;
  isP2Active: boolean;
  onP2Toggle: () => void;
  isP3Active: boolean;
  onP3Toggle: () => void;
  isContact1Active: boolean;
  onContact1Toggle: () => void;
  isContact2Active: boolean;
  onContact2Toggle: () => void;
  isContact3PlusActive: boolean;
  onContact3PlusToggle: () => void;
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
  // Nowe propsy dla trybu unpacking
  mode?: "attack" | "defense";
  onModeChange?: (mode: "attack" | "defense") => void;
  selectedDefensePlayers?: string[];
  onDefensePlayersChange?: (playerIds: string[]) => void;
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
  isP0StartActive,
  onP0StartToggle,
  isP1StartActive,
  onP1StartToggle,
  isP2StartActive,
  onP2StartToggle,
  isP3StartActive,
  onP3StartToggle,
  isP0Active,
  onP0Toggle,
  isP1Active,
  onP1Toggle,
  isP2Active,
  onP2Toggle,
  isP3Active,
  onP3Toggle,
  isContact1Active,
  onContact1Toggle,
  isContact2Active,
  onContact2Toggle,
  isContact3PlusActive,
  onContact3PlusToggle,
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
  // Nowe propsy dla trybu unpacking
  mode = "attack",
  onModeChange,
  selectedDefensePlayers = [],
  onDefensePlayersChange,
}) => {
  const [currentSelectedMatch, setCurrentSelectedMatch] = useState<string | null>(null);

  // Ładujemy ostatnio wybraną opcję trybu
  useEffect(() => {
    if (onModeChange) {
      const lastMode = localStorage.getItem('lastActionMode');
      if (lastMode === 'defense' && mode !== 'defense') {
        onModeChange('defense');
      }
    }
  }, [onModeChange, mode]);

  // W trybie unpacking automatycznie synchronizujemy punkty za "Minięty przeciwnik" z liczbą zaznaczonych zawodników
  useEffect(() => {
    // Działamy tylko w trybie defense
    if (mode !== "defense") {
      return;
    }
    
    const expectedPoints = selectedDefensePlayers ? selectedDefensePlayers.length : 0;
    
    // Jeśli punkty nie odpowiadają liczbie zaznaczonych zawodników, synchronizujemy
    if (currentPoints !== expectedPoints) {
      const pointsDifference = expectedPoints - currentPoints;
      if (pointsDifference !== 0) {
        onAddPoints(pointsDifference);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDefensePlayers?.length, mode]);

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
    // Obsługa trybu obrony - wielokrotny wybór zawodników
    if (mode === "defense") {
      if (onDefensePlayersChange) {
        const currentDefensePlayers = selectedDefensePlayers || [];
        if (currentDefensePlayers.includes(playerId)) {
          // Usuń zawodnika z listy
          onDefensePlayersChange(currentDefensePlayers.filter(id => id !== playerId));
        } else {
          // Dodaj zawodnika do listy
          onDefensePlayersChange([...currentDefensePlayers, playerId]);
        }
      }
      return;
    }
    
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
    // Walidacja w zależności od trybu
    if (mode === "defense") {
      // W trybie obrony sprawdzamy czy są wybrani zawodnicy obrony
      if (!selectedDefensePlayers || selectedDefensePlayers.length === 0) {
        alert("Wybierz co najmniej jednego zawodnika miniętego przez przeciwnika!");
        return;
      }
    } else {
      // W trybie ataku sprawdzamy standardowe warunki
      if (!selectedPlayerId) {
        alert("Wybierz zawodnika rozpoczynającego akcję!");
        return;
      }
      
      // W przypadku podania sprawdzamy, czy wybrany jest odbiorca
      if (actionType === "pass" && !selectedReceiverId) {
        alert("Wybierz zawodnika kończącego podanie!");
        return;
      }
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
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{isEditMode ? "Edytuj akcję" : "Dodaj akcję"}</h3>
          <button className={styles.closeButton} onClick={handleCancel}>×</button>
        </div>
        
        {/* Przełącznik trybu Atak/Obrona */}
        {onModeChange && (
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeButton} ${mode === "attack" ? styles.activeMode : ""}`}
              onClick={() => {
                onModeChange("attack");
                localStorage.setItem('lastActionMode', 'attack');
              }}
            >
              Packing
            </button>
            <button
              className={`${styles.modeButton} ${mode === "defense" ? styles.activeMode : ""}`}
              onClick={() => {
                onModeChange("defense");
                localStorage.setItem('lastActionMode', 'defense');
              }}
            >
              Unpacking
            </button>
          </div>
        )}
        
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
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
              {mode === "defense" 
                ? "Wybierz zawodników miniętych przez przeciwnika:" 
                : actionType === "dribble" 
                  ? "Wybierz zawodnika dryblującego:" 
                  : "Wybierz zawodników:"
              }
            </label>
            <div className={styles.playerSelectionInfo}>
              {mode === "defense" ? (
                <p>Kliknij, aby wybrać zawodników naszego zespołu, którzy zostali minięci przez przeciwnika. Możesz wybrać wielu zawodników.</p>
              ) : actionType === "pass" ? (
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
                    isSender={mode === "defense" ? false : actionType === "pass" ? player.id === selectedPlayerId : false}
                    isReceiver={mode === "defense" ? false : actionType === "pass" ? player.id === selectedReceiverId : false}
                    isDribbler={mode === "defense" ? false : actionType === "dribble" ? player.id === selectedPlayerId : false}
                    isDefensePlayer={mode === "defense" ? (selectedDefensePlayers || []).includes(player.id) : false}
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
            {/* Sekcja "Początek działania:" z przyciskami P0-P3 */}
            <div className={styles.pSectionContainer}>
              <div className={styles.pSectionLabel}>Początek działania:</div>
              <div className={styles.pButtonsGroup}>
                <div className={styles.pTopRow}>
                <button
                  className={`${styles.compactButton} ${
                    isP0StartActive ? styles.activeButton : ""
                  }`}
                  onClick={onP0StartToggle}
                  title="Aktywuj/Dezaktywuj P0"
                  aria-pressed={isP0StartActive}
                  type="button"
                >
                  <span className={styles.compactLabel}>P0</span>
                </button>
                
                <button
                  className={`${styles.compactButton} ${
                    isP1StartActive ? styles.activeButton : ""
                  }`}
                  onClick={onP1StartToggle}
                  title="Aktywuj/Dezaktywuj P1"
                  aria-pressed={isP1StartActive}
                  type="button"
                >
                  <span className={styles.compactLabel}>P1</span>
                </button>
              </div>
              
              <div className={styles.pBottomRow}>
                <button
                  className={`${styles.compactButton} ${
                    isP2StartActive ? styles.activeButton : ""
                  }`}
                  onClick={onP2StartToggle}
                  title="Aktywuj/Dezaktywuj P2"
                  aria-pressed={isP2StartActive}
                  type="button"
                >
                  <span className={styles.compactLabel}>P2</span>
                </button>
                
                <button
                  className={`${styles.compactButton} ${
                    isP3StartActive ? styles.activeButton : ""
                  }`}
                  onClick={onP3StartToggle}
                  title="Aktywuj/Dezaktywuj P3"
                  aria-pressed={isP3StartActive}
                  type="button"
                >
                  <span className={styles.compactLabel}>P3</span>
                </button>
              </div>
              </div>
            </div>

            {/* Sekcja "koniec działania:" z przyciskami P0-P3 */}
            <div className={styles.pSectionContainer}>
              <div className={styles.pSectionLabel}>Koniec działania:</div>
              <div className={styles.pButtonsGroup}>
                <div className={styles.pTopRow}>
                <button
                  className={`${styles.compactButton} ${
                    isP0Active ? styles.activeButton : ""
                  }`}
                  onClick={onP0Toggle}
                  title="Aktywuj/Dezaktywuj P0"
                  aria-pressed={isP0Active}
                  type="button"
                >
                  <span className={styles.compactLabel}>P0</span>
                </button>
                
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
              </div>
              
              <div className={styles.pBottomRow}>
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
                
                <button
                  className={`${styles.compactButton} ${
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
              </div>
            </div>

            {/* Grupa przycisków kontaktów */}
            <div className={styles.pSectionContainer}>
              <div className={styles.pSectionLabel}>Liczba kontaktów:</div>
              <div className={styles.pButtonsGroupNoBorder}>
                <div className={styles.pTopRow}>
                <button
                  className={`${styles.compactButton} ${
                    isContact1Active ? styles.activeButton : ""
                  }`}
                  onClick={onContact1Toggle}
                  title="Aktywuj/Dezaktywuj 1T"
                  aria-pressed={isContact1Active}
                  type="button"
                >
                  <span className={styles.compactLabel}>1T</span>
                </button>
                
                <button
                  className={`${styles.compactButton} ${
                    isContact2Active ? styles.activeButton : ""
                  }`}
                  onClick={onContact2Toggle}
                  title="Aktywuj/Dezaktywuj 2T"
                  aria-pressed={isContact2Active}
                  type="button"
                >
                  <span className={styles.compactLabel}>2T</span>
                </button>
              </div>
              
              <div className={styles.pBottomRow}>
                <button
                  className={`${styles.compactButton} ${
                    isContact3PlusActive ? styles.activeButton : ""
                  }`}
                  onClick={onContact3PlusToggle}
                  title="Aktywuj/Dezaktywuj 3T+"
                  aria-pressed={isContact3PlusActive}
                  type="button"
                >
                  <span className={styles.compactLabel}>3T+</span>
                </button>
              </div>
              </div>
            </div>

            {/* Pozostałe przyciski punktów (bez "Minięty przeciwnik") */}
            {ACTION_BUTTONS.map((button, index) => {
              if (button.type === "points" && button.label !== "Minięty przeciwnik") {
                return (
                  <div 
                    key={index} 
                    className={styles.compactPointsButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePointsAdd(button.points);
                    }}
                    title={button.description}
                  >
                    <span className={styles.compactLabel}>{button.label}</span>
                    <span className={styles.pointsValue}><b>{currentPoints}</b></span>
                    <button
                      className={styles.compactSubtractButton}
                      onClick={(e) => {
                        e.preventDefault();
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

            {/* Przyciski ułożone pionowo: Minięty przeciwnik, Wejście PK, Strzał, Gol */}
            <div className={styles.verticalButtonsContainer}>
              {/* Przycisk "Minięty przeciwnik" */}
              {ACTION_BUTTONS.map((button, index) => {
                if (button.type === "points" && button.label === "Minięty przeciwnik") {
                  return (
                    <div 
                      key={index} 
                      className={styles.compactPointsButton}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // W trybie unpacking wyłączamy przycisk "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                        if (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0) {
                          return; // Nie wykonuj kliknięcia
                        }
                        handlePointsAdd(button.points);
                      }}
                      title={button.description}
                      style={{
                        // W trybie unpacking wyłączamy przycisk "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                        pointerEvents: mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0 ? 'none' : 'auto',
                        opacity: mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0 ? 0.6 : 1
                      }}
                    >
                      <span className={styles.compactLabel}>{button.label}</span>
                      <span className={styles.pointsValue}><b>{currentPoints}</b></span>
                      <button
                        className={styles.compactSubtractButton}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // W trybie unpacking wyłączamy przycisk odejmowania dla "Minięty przeciwnik" gdy są zaznaczeni zawodnicy
                          if (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0) {
                            return; // Nie wykonuj kliknięcia
                          }
                          handlePointsAdd(-button.points);
                        }}
                        title={`Odejmij ${button.points} pkt`}
                        type="button"
                        disabled={currentPoints < button.points || (mode === "defense" && selectedDefensePlayers && selectedDefensePlayers.length > 0)}
                      >
                        −
                      </button>
                    </div>
                  );
                }
                return null;
              })}

              {/* Przycisk "Wejście PK" */}
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

              {/* Przycisk "Strzał" */}
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

              {/* Przycisk "Gol" */}
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
          </div>
          
          {/* Przyciski kontrolne z polem minuty pomiędzy */}
          <div className={styles.buttonGroup}>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              type="button"
            >
              Anuluj
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
              className={styles.saveButton}
              onClick={handleSave}
              type="submit"
            >
              Zapisz akcję
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActionModal; 