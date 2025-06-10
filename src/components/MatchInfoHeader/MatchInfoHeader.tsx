// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React, { useState, KeyboardEvent, useEffect } from "react";
import { TeamInfo, Player } from "@/types";
import { TEAMS } from "@/constants/teams";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import styles from "./MatchInfoHeader.module.css";

// Nowy komponent do wyświetlania informacji o bieżącym meczu
interface CurrentMatchInfoProps {
  matchInfo: TeamInfo | null;
  players: Player[];
}

const CurrentMatchInfo: React.FC<CurrentMatchInfoProps> = ({ matchInfo, players }) => {
  const [isPlayerMinutesCollapsed, setIsPlayerMinutesCollapsed] = useState(true);

  if (!matchInfo || !matchInfo.matchId) {
    return null;
  }

  // Pobierz informacje o pozycji i minutach dla aktualnie zalogowanego zawodnika
  const renderPlayerMinutes = () => {
    if (!matchInfo.playerMinutes || matchInfo.playerMinutes.length === 0) {
      return null;
    }

    // Filtruj zawodników z co najmniej 1 minutą rozegrana
    const filteredPlayerMinutes = matchInfo.playerMinutes.filter(playerMinute => {
      const playTime = playerMinute.startMinute === 0 && playerMinute.endMinute === 0 
        ? 0 
        : playerMinute.endMinute - playerMinute.startMinute + 1;
      return playTime >= 1;
    });

    if (filteredPlayerMinutes.length === 0) {
      return null;
    }

    return (
      <div className={styles.playerMinutesInfo}>
        <div 
          className={styles.playerMinutesHeader}
          onClick={() => setIsPlayerMinutesCollapsed(!isPlayerMinutesCollapsed)}
        >
          <h4>Czas gry zawodników ({filteredPlayerMinutes.length})</h4>
          <button 
            className={styles.collapseButton}
            aria-label={isPlayerMinutesCollapsed ? "Rozwiń listę minut zawodników" : "Zwiń listę minut zawodników"}
          >
            {isPlayerMinutesCollapsed ? "▼" : "▲"}
          </button>
        </div>
        
        {!isPlayerMinutesCollapsed && (
        <div className={styles.playerMinutesList}>
            {filteredPlayerMinutes.map((playerMinute) => {
            const player = players.find(p => p.id === playerMinute.playerId);
            if (!player) return null;

            return (
              <div key={playerMinute.playerId} className={styles.playerMinuteItem}>
                <span className={styles.playerName}>{player.name}</span>
                <span className={styles.playerPosition}>{playerMinute.position || player.position}</span>
                <span className={styles.playerMinutes}>
                  {playerMinute.startMinute === 0 && playerMinute.endMinute === 0 ? 0 : playerMinute.endMinute - playerMinute.startMinute + 1} min
                </span>
              </div>
            );
          })}
        </div>
        )}
      </div>
    );
  };

  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };

  return (
    <div className={styles.currentMatchInfo}>
      <div className={styles.matchTitle}>
        <h3>
          {matchInfo.isHome 
            ? `${getTeamName(matchInfo.team)} vs ${matchInfo.opponent}` 
            : `${matchInfo.opponent} vs ${getTeamName(matchInfo.team)}`}
        </h3>
        <div className={styles.matchMeta}>
          <span className={styles.matchDate}>{matchInfo.date}</span>
          <span className={styles.matchCompetitionInfo}>
            <span className={styles.competition}>{matchInfo.competition}</span>
            <span className={matchInfo.isHome ? styles.home : styles.away}>
              {matchInfo.isHome ? "Dom" : "Wyjazd"}
            </span>
          </span>
        </div>
      </div>
      {renderPlayerMinutes()}
    </div>
  );
};

interface MatchInfoHeaderProps {
  matchInfo: TeamInfo | null;
  onChangeMatch: () => void;
  allMatches: TeamInfo[];
  onSelectMatch: (match: TeamInfo | null) => void;
  onDeleteMatch: (matchId: string) => void;
  selectedTeam: string;
  onChangeTeam: (team: string) => void;
  onManagePlayerMinutes: (match: TeamInfo) => void;
  onAddNewMatch: () => void;
  refreshCounter?: number;
  isOfflineMode?: boolean;
  players?: Player[]; // Dodajemy players jako nową właściwość
}

const MatchInfoHeader: React.FC<MatchInfoHeaderProps> = ({
  matchInfo,
  onChangeMatch,
  allMatches,
  onSelectMatch,
  onDeleteMatch,
  selectedTeam,
  onChangeTeam,
  onManagePlayerMinutes,
  onAddNewMatch,
  refreshCounter = 0,
  isOfflineMode = false,
  players = [], // Domyślna wartość to pusta tablica
}) => {
  const [sortKey, setSortKey] = useState<keyof TeamInfo>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMatchesTableExpanded, setIsMatchesTableExpanded] = useState(false);
  
  // Automatycznie aktywuj tryb deweloperski (obejście uwierzytelniania)
  React.useEffect(() => {
    localStorage.setItem('packing_app_bypass_auth', 'true');
  }, []);
  
  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };

  // Filtrowanie meczów wybranego zespołu - używamy useMemo dla optymalizacji
  const teamMatches = React.useMemo(() => {
    const filtered = allMatches.filter(match => match.team === selectedTeam);
    
    return filtered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (aValue !== undefined && bValue !== undefined) {
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [allMatches, selectedTeam, sortKey, sortDirection, refreshCounter]);
    
  // Oblicz mecze do wyświetlenia na podstawie stanu collapse/expand
  const { displayedMatches, hasMoreMatches, needsScroll } = React.useMemo(() => {
    const totalMatches = teamMatches.length;
    
    if (totalMatches === 0) {
      return { displayedMatches: [], hasMoreMatches: false, needsScroll: false };
    }
    
    // Jeśli tabela jest zwinięta, pokazuj maksymalnie 2 mecze
    if (!isMatchesTableExpanded) {
      return {
        displayedMatches: teamMatches.slice(0, 2),
        hasMoreMatches: totalMatches > 2,
        needsScroll: false
      };
    }
    
    // Jeśli tabela jest rozwinięta, pokazuj wszystkie mecze z suwakiem jeśli potrzeba
    return {
      displayedMatches: teamMatches, // Pokazuj wszystkie mecze
      hasMoreMatches: false,
      needsScroll: totalMatches > 5 // Suwak pojawi się gdy więcej niż 5 meczów
    };
  }, [teamMatches, isMatchesTableExpanded]);

  // Funkcja do dodania nowego meczu
  const handleAddMatch = () => {
    onAddNewMatch();
  };

  // Obsługa klawiszy dla przycisków edycji i usunięcia
  const handleEditKeyDown = (e: KeyboardEvent, match: TeamInfo) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectMatch(match);
      onChangeMatch();
    }
  };

  const handleDeleteKeyDown = (e: KeyboardEvent, matchId: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
        onDeleteMatch(matchId);
      }
    }
  };

  // Funkcja zmiany sortowania
  const handleSort = (key: keyof TeamInfo) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div className={styles.matchInfoContainer}>
      {/* Dodajemy komponent wyświetlający szczegóły bieżącego meczu */}
      <CurrentMatchInfo matchInfo={matchInfo} players={players} />
      
      <div className={styles.headerControls}>
        <div className={styles.teamSelector}>
          <TeamsSelector
            selectedTeam={selectedTeam}
            onChange={onChangeTeam}
            className={styles.teamDropdown}
          />
        </div>
        
        <div className={styles.controlsContainer}>
          {isOfflineMode && (
            <div className={styles.offlineBadge || 'offlineBadge'}>
              Tryb offline 📴
            </div>
          )}
          <button 
            className={styles.addButton}
            onClick={handleAddMatch}
          >
            + Dodaj mecz
          </button>
        </div>
      </div>

      <div className={styles.matchesTable}>
        <div className={styles.tableHeader}>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("date")}
          >
            Data {sortKey === "date" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("team")}
          >
            Zespół {sortKey === "team" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("opponent")}
          >
            Przeciwnik {sortKey === "opponent" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("competition")}
          >
            Rozgrywki {sortKey === "competition" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div 
            className={styles.headerCell} 
            onClick={() => handleSort("isHome")}
          >
            Lokalizacja {sortKey === "isHome" && (sortDirection === "asc" ? "↑" : "↓")}
          </div>
          <div className={styles.headerCell}>Akcje</div>
        </div>

        <div className={`${styles.tableBody} ${needsScroll ? styles.scrollableTable : ''}`}>
          {displayedMatches.length > 0 ? (
            displayedMatches.map((match) => {
              const isSelected = matchInfo?.matchId === match.matchId;
              const isHomeMatch = match.isHome === true;
              const isBeingDeleted = isDeleting === match.matchId;
              
              return (
                <div 
                  key={match.matchId}
                  className={`${styles.matchRow} ${isSelected ? styles.selected : ""} ${isHomeMatch ? styles.homeRow : styles.awayRow} ${isBeingDeleted ? styles.deleteInProgress : ""}`}
                  onClick={() => onSelectMatch(match)}
                >
                  <div className={styles.cell}>{match.date}</div>
                  <div className={styles.cell}>{getTeamName(match.team)}</div>
                  <div className={styles.cell}>{match.opponent}</div>
                  <div className={styles.cell}>
                    <span className={styles.competition}>{match.competition}</span>
                  </div>
                  <div className={styles.cell}>
                    <span className={isHomeMatch ? styles.home : styles.away}>
                      {isHomeMatch ? "Dom" : "Wyjazd"}
                    </span>
                  </div>
                  <div className={styles.cellActions}>
                    {isSelected && (
                      <>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch(match);
                            onChangeMatch();
                          }}
                          onKeyDown={(e) => handleEditKeyDown(e, match)}
                          title="Edytuj"
                          aria-label={`Edytuj mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ✎
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ⌚
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Zabezpieczenie przed wielokrotnym kliknięciem
                            if (match.matchId && !isBeingDeleted) {
                              if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
                                // Ustawienie flagi usuwania
                                setIsDeleting(match.matchId);
                                // Wywołujemy funkcję usuwania, a funkcja ta zajmie się także odświeżeniem listy
                                onDeleteMatch(match.matchId);
                              }
                            }
                          }}
                          onKeyDown={(e) => match.matchId && !isBeingDeleted ? handleDeleteKeyDown(e, match.matchId) : undefined}
                          title="Usuń"
                          aria-label={`Usuń mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          {isBeingDeleted ? "⌛" : "✕"}
                        </button>
                      </>
                    )}
                    {!isSelected && (
                      <>
                        <button
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMatch(match);
                            onChangeMatch();
                          }}
                          onKeyDown={(e) => handleEditKeyDown(e, match)}
                          title="Edytuj"
                          aria-label={`Edytuj mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ✎
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          ⌚
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Zabezpieczenie przed wielokrotnym kliknięciem
                            if (match.matchId && !isBeingDeleted) {
                              if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
                                // Ustawienie flagi usuwania
                                setIsDeleting(match.matchId);
                                // Wywołujemy funkcję usuwania, a funkcja ta zajmie się także odświeżeniem listy
                                onDeleteMatch(match.matchId);
                              }
                            }
                          }}
                          onKeyDown={(e) => match.matchId && !isBeingDeleted ? handleDeleteKeyDown(e, match.matchId) : undefined}
                          title="Usuń"
                          aria-label={`Usuń mecz: ${getTeamName(match.team)} vs ${match.opponent}`}
                          disabled={isBeingDeleted}
                        >
                          {isBeingDeleted ? "⌛" : "✕"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.noMatches}>
              Brak zapisanych meczów dla tego zespołu
            </div>
          )}
        </div>
        
        {/* Przycisk rozwijania/zwijania tabeli meczów */}
        {(hasMoreMatches || isMatchesTableExpanded) && (
          <div className={styles.tableExpandButton}>
            <button 
              className={styles.expandBtn}
              onClick={() => setIsMatchesTableExpanded(!isMatchesTableExpanded)}
              aria-label={isMatchesTableExpanded ? "Zwiń listę meczów" : "Rozwiń listę meczów"}
            >
              {isMatchesTableExpanded ? (
                <>
                  <span>Pokaż mniej</span>
                  <span className={styles.expandIcon}>▲</span>
                </>
              ) : (
                <>
                  <span>Pokaż więcej ({teamMatches.length - 2})</span>
                  <span className={styles.expandIcon}>▼</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchInfoHeader;
