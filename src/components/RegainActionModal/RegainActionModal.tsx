"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./RegainActionModal.module.css";
import { Player, Action, TeamInfo } from "@/types";
import ActionTypeToggle from "../ActionTypeToggle/ActionTypeToggle";
import { ACTION_BUTTONS } from "../PointsButtons/constants";
import PlayerCard from "../ActionModal/PlayerCard";
import { TEAMS } from "@/constants/teams";
import { sortPlayersByLastName } from '@/utils/playerUtils';

interface RegainActionModalProps {
  isOpen: boolean;
  isVideoInternal?: boolean;
  onClose: () => void;
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  onSenderSelect: (id: string | null) => void;
  onReceiverSelect: (id: string | null) => void;
  actionMinute: number;
  onMinuteChange: (minute: number) => void;
  onCalculateMinuteFromVideo?: () => Promise<{ minute: number; isSecondHalf: boolean } | null>;
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
  // Nowy prop dla przycisku "Poniżej 8s"
  isBelow8sActive: boolean;
  onBelow8sToggle: () => void;
  // Nowy prop dla liczby partnerów przed piłką
  playersBehindBall: number;
  onPlayersBehindBallChange: (count: number) => void;
  // Nowy prop dla liczby przeciwników za piłką
  opponentsBehindBall: number;
  onOpponentsBehindBallChange: (count: number) => void;
  // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
  playersLeftField: number;
  onPlayersLeftFieldChange: (count: number) => void;
  // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
  opponentsLeftField: number;
  onOpponentsLeftFieldChange: (count: number) => void;
  isControversial: boolean;
  onControversialToggle: () => void;
}

const RegainActionModal: React.FC<RegainActionModalProps> = ({
  isOpen,
  isVideoInternal = false,
  onClose,
  players,
  selectedPlayerId,
  selectedReceiverId,
  onSenderSelect,
  onReceiverSelect,
  actionMinute,
  onMinuteChange,
  onCalculateMinuteFromVideo,
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
  // Nowy prop dla przycisku "Poniżej 8s"
  isBelow8sActive,
  onBelow8sToggle,
  // Nowy prop dla liczby partnerów przed piłką
  playersBehindBall,
  onPlayersBehindBallChange,
  // Nowy prop dla liczby przeciwników przed piłką
  opponentsBehindBall,
  onOpponentsBehindBallChange,
  // Nowy prop dla liczby zawodników naszego zespołu, którzy opuścili boisko
  playersLeftField,
  onPlayersLeftFieldChange,
  // Nowy prop dla liczby zawodników przeciwnika, którzy opuścili boisko
  opponentsLeftField,
  onOpponentsLeftFieldChange,
  isControversial,
  onControversialToggle,
}) => {
  const clamp0to10 = (value: number) => Math.max(0, Math.min(10, value));
  const [currentSelectedMatch, setCurrentSelectedMatch] = useState<string | null>(null);


  // Określamy czy jesteśmy w trybie edycji
  const isEditMode = !!editingAction;

  // Automatycznie ustaw sugerowaną wartość minuty na podstawie czasu wideo przy otwarciu modalu
  useEffect(() => {
    if (isOpen && !isEditMode && onCalculateMinuteFromVideo) {
      onCalculateMinuteFromVideo().then((result) => {
        if (result !== null && result.minute > 0) {
          onMinuteChange(result.minute);
          // Ustaw również połowę meczu
          if (result.isSecondHalf !== isSecondHalf) {
            onSecondHalfToggle(result.isSecondHalf);
          }
        }
      }).catch((error) => {
        console.warn('Nie udało się obliczyć minuty z wideo:', error);
      });
    }
  }, [isOpen, isEditMode, onCalculateMinuteFromVideo, onMinuteChange, isSecondHalf, onSecondHalfToggle]);

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

  // Grupowanie zawodników według pozycji
  const playersByPosition = useMemo(() => {
    const byPosition = filteredPlayers.reduce((acc, player) => {
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
    }, {} as Record<string, typeof filteredPlayers>);
    
    // Kolejność pozycji: GK, CB, DM, Skrzydłowi (LW/RW), AM, ST (ST zawsze na końcu)
    const positionOrder = ['GK', 'CB', 'DM', 'Skrzydłowi', 'AM'];
    const lastPosition = 'ST';
    
    // Sortuj pozycje według określonej kolejności
    const sortedPositions = Object.keys(byPosition).sort((a, b) => {
      // ST zawsze na końcu
      if (a === lastPosition) return 1;
      if (b === lastPosition) return -1;
      
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
  }, [filteredPlayers]);

  if (!isOpen) return null;

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEditMode) return;
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
    // W regain wybieramy tylko jednego zawodnika (odbiorcę piłki)
    if (playerId === selectedPlayerId) {
      // Jeśli klikamy na już zaznaczonego zawodnika, odznaczamy go
      onSenderSelect(null);
    } else {
      // W przeciwnym razie zaznaczamy nowego zawodnika
      onSenderSelect(playerId);
    }
    
    // Upewniamy się, że nie ma odbiorcy w regain
    if (selectedReceiverId) {
      onReceiverSelect(null);
    }
  };

  const handlePointsAdd = (points: number) => {
    onAddPoints(points);
  };


  const handleShotToggle = () => {
    if (isShot) {
      onShotToggle(false);
      onGoalToggle(false);
      return;
    }
    onShotToggle(true);
  };

  const handleGoalToggle = () => {
    onGoalToggle(!isGoal);
  };

  const handlePenaltyAreaEntryToggle = () => {
    onPenaltyAreaEntryToggle(!isPenaltyAreaEntry);
  };

  const handleSecondHalfToggle = (value: boolean) => {
    if (isEditMode) return;
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
    // Walidacja dla regain - sprawdzamy tylko jednego zawodnika (odbiorcę piłki)
    if (!selectedPlayerId) {
      alert("Wybierz zawodnika odbierającego piłkę!");
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
    <div className={`${styles.overlay} ${isVideoInternal ? styles.overlayInternal : ''}`} onClick={handleCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>{isEditMode ? "Edytuj akcję Regain" : "Dodaj akcję Regain"}</h3>
          <button className={styles.closeButton} onClick={handleCancel}>×</button>
        </div>
        
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
                <div 
                  className={styles.halfToggle}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`${styles.halfButton} ${!isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSecondHalfToggle(false);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                    style={{ pointerEvents: 'auto', zIndex: 11 }}
                  >
                    P1
                  </button>
                  <button
                    type="button"
                    className={`${styles.halfButton} ${isSecondHalf ? styles.activeHalf : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSecondHalfToggle(true);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={isEditMode}
                    aria-disabled={isEditMode}
                    style={{ pointerEvents: 'auto', zIndex: 11 }}
                  >
                    P2
                  </button>
                </div>
              </div>
              {/* Przyciski dla zawodników, którzy opuścili boisko */}
              <div className={styles.toggleGroup}>
                <div 
                  className={styles.compactPointsButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlayersLeftFieldChange(Math.min(10, playersLeftField + 1));
                  }}
                  title="Kliknij, aby dodać 1 partnera"
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <span className={styles.compactLabel}>
                    Partnerzy
                  </span>
                  <span className={styles.pointsValue}><b>{playersLeftField}</b></span>
                  <button
                    className={styles.compactSubtractButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPlayersLeftFieldChange(Math.max(0, playersLeftField - 1));
                    }}
                    title="Odejmij 1 partnera"
                    type="button"
                    disabled={playersLeftField <= 0}
                  >
                    −
                  </button>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px', 
                    display: 'flex',
                    gap: '2px',
                    fontSize: '10px',
                    lineHeight: '1'
                  }}>
                    <span>🟥</span>
                    <span style={{ color: '#dc2626' }}>✚</span>
                  </div>
                </div>
              </div>
              <div className={styles.toggleGroup}>
                <div 
                  className={styles.compactPointsButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpponentsLeftFieldChange(Math.min(10, opponentsLeftField + 1));
                  }}
                  title="Kliknij, aby dodać 1 przeciwnika"
                  style={{ cursor: 'pointer', position: 'relative' }}
                >
                  <span className={styles.compactLabel}>
                    Przeciwnicy
                  </span>
                  <span className={styles.pointsValue}><b>{opponentsLeftField}</b></span>
                  <button
                    className={styles.compactSubtractButton}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpponentsLeftFieldChange(Math.max(0, opponentsLeftField - 1));
                    }}
                    title="Odejmij 1 przeciwnika"
                    type="button"
                    disabled={opponentsLeftField <= 0}
                  >
                    −
                  </button>
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '4px', 
                    right: '4px', 
                    display: 'flex',
                    gap: '2px',
                    fontSize: '10px',
                    lineHeight: '1'
                  }}>
                    <span>🟥</span>
                    <span style={{ color: '#dc2626' }}>✚</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista zawodników */}
          <div className={styles.formGroup}>
            <label className={styles.playerTitle}>
              Wybierz zawodnika odbierającego piłkę:
            </label>
            <div className={styles.playerSelectionInfo}>
              <p>Kliknij, aby wybrać zawodnika, który odebrał piłkę od przeciwnika.</p>
            </div>
            <div className={styles.playersGridContainer}>
              {filteredPlayers.length > 0 ? (
                <>
                  {isEditMode && filteredPlayers.length < 3 && (
                    <div className={styles.warningMessage}>
                      ⚠️ Tylko {filteredPlayers.length} zawodnik{filteredPlayers.length === 1 ? '' : 'ów'} dostępn{filteredPlayers.length === 1 ? 'y' : 'ych'} w tym meczu
                    </div>
                  )}
                  {playersByPosition.sortedPositions.map((position) => (
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
                              isSender={player.id === selectedPlayerId}
                              isReceiver={false}
                              isDribbler={false}
                              isDefensePlayer={false}
                              onSelect={handlePlayerClick}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
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
            {/* Box 1: P0-P3, Poniżej 8s, Wejście PK, Strzał, Gol */}
            <div className={styles.pSectionContainer}>
              {/* Sekcja z przyciskami P0-P3 - przestrzeń w której piłka została odebrana */}
              <div className={`${styles.actionTypeSelector} ${styles.tooltipTrigger}`} data-tooltip="Przestrzeń w której piłka została odebrana">
                <button
                  className={`${styles.actionTypeButton} ${
                    isP0Active ? styles.active : ""
                  }`}
                  onClick={onP0Toggle}
                  title="Aktywuj/Dezaktywuj P0"
                  aria-pressed={isP0Active}
                  type="button"
                >
                  P0
                </button>
                <button
                  className={`${styles.actionTypeButton} ${
                    isP1Active ? styles.active : ""
                  }`}
                  onClick={onP1Toggle}
                  title="Aktywuj/Dezaktywuj P1"
                  aria-pressed={isP1Active}
                  type="button"
                >
                  P1
                </button>
                <button
                  className={`${styles.actionTypeButton} ${
                    isP2Active ? styles.active : ""
                  }`}
                  onClick={onP2Toggle}
                  title="Aktywuj/Dezaktywuj P2"
                  aria-pressed={isP2Active}
                  type="button"
                >
                  P2
                </button>
                <button
                  className={`${styles.actionTypeButton} ${
                    isP3Active ? styles.active : ""
                  }`}
                  onClick={onP3Toggle}
                  title="Aktywuj/Dezaktywuj P3"
                  aria-pressed={isP3Active}
                  type="button"
                >
                  P3
                </button>
              </div>
              {/* Rząd z "Poniżej 8s" i "Wejście PK, Strzał, Gol" */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                {/* Przycisk "Poniżej 8s" */}
                <button
                  className={`${styles.compactButton} ${styles.tooltipTrigger} ${
                    isBelow8sActive ? styles.activeButton : ""
                  }`}
                  onClick={onBelow8sToggle}
                  aria-pressed={isBelow8sActive}
                  type="button"
                  data-tooltip={`8 sekund od jego rozpoczęcia (1T):\n• wejść w pole karne rywala\n• oddać strzał na bramkę lub strzelić gola`}
                >
                  <span className={styles.compactLabel}>Poniżej 8s</span>
                </button>
                {/* Przyciski ułożone pionowo: Wejście PK, Strzał, Gol */}
                <div className={styles.verticalButtonsContainer}>
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
              </div>
            </div>
            {/* Box 2: Sekcja z przyciskami "przed piłką" - ułożone pionowo */}
            <div
              className={`${styles.verticalButtonsContainer} ${styles.tooltipTrigger}`}
              data-tooltip="Liczymy zawodników wyraźnie do bramki przeciwnika."
            >
              {/* Przycisk "Liczba partnerów przed piłką" */}
              <div 
                className={styles.compactPointsButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onPlayersBehindBallChange(clamp0to10(playersBehindBall + 1));
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.compactLabel}>Partner przed piłką</span>
                <input
                  className={styles.compactNumberInput}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10}
                  step={1}
                  value={playersBehindBall}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const raw = e.target.value;
                    const next = raw === "" ? 0 : Number(raw);
                    onPlayersBehindBallChange(clamp0to10(Number.isFinite(next) ? next : 0));
                  }}
                  onWheel={(e) => {
                    // zapobiega zmianie wartości scrollem
                    (e.currentTarget as HTMLInputElement).blur();
                  }}
                  aria-label="Partnerzy przed piłką (0-10)"
                  title="Wpisz liczbę 0–10"
                />
                <button
                  className={styles.compactSubtractButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlayersBehindBallChange(clamp0to10(playersBehindBall - 1));
                  }}
                  title="Odejmij 1 partnera"
                  type="button"
                  disabled={playersBehindBall <= 0}
                >
                  −
                </button>
              </div>

              {/* Przycisk "Liczba przeciwników przed piłką" */}
              <div 
                className={styles.compactPointsButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpponentsBehindBallChange(clamp0to10(opponentsBehindBall + 1));
                }}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.compactLabel}>Przeciwnik przed piłką (bez bramkarza)</span>
                <input
                  className={styles.compactNumberInput}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10}
                  step={1}
                  value={opponentsBehindBall}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const raw = e.target.value;
                    const next = raw === "" ? 0 : Number(raw);
                    onOpponentsBehindBallChange(clamp0to10(Number.isFinite(next) ? next : 0));
                  }}
                  onWheel={(e) => {
                    (e.currentTarget as HTMLInputElement).blur();
                  }}
                  aria-label="Przeciwnicy przed piłką (0-10)"
                  title="Wpisz liczbę 0–10"
                />
                <button
                  className={styles.compactSubtractButton}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpponentsBehindBallChange(clamp0to10(opponentsBehindBall - 1));
                  }}
                  title="Odejmij 1 przeciwnika"
                  type="button"
                  disabled={opponentsBehindBall <= 0}
                >
                  −
                </button>
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
          </div>
          
          {/* Przyciski kontrolne z polem minuty pomiędzy */}
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.controversyButton} ${styles.tooltipTrigger} ${isControversial ? styles.controversyButtonActive : ""}`}
              onClick={onControversialToggle}
              aria-pressed={isControversial}
              aria-label="Oznacz jako kontrowersja"
              data-tooltip="Sytuacja kontrowersyjna - zaznacz, aby omówić później."
            >
              !
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              type="button"
            >
              Anuluj
            </button>
            
            <div className={styles.minuteInput}>
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
                  disabled={isEditMode}
                >
                  −
                </button>
                <input
                  id="action-minute-modal"
                  type="number"
                  value={actionMinute}
                  onChange={handleMinuteChange}
                  onInput={handleMinuteChange}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  min={isSecondHalf ? 46 : 1}
                  max={isSecondHalf ? 130 : 65}
                  className={styles.minuteField}
                  readOnly={isEditMode}
                  disabled={isEditMode}
                  style={{ pointerEvents: 'auto', zIndex: 11 }}
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
                  disabled={isEditMode}
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
        </div>
      </div>
    </div>
  );
};

export default RegainActionModal;