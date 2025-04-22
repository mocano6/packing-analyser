// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React, { useState, KeyboardEvent, useEffect } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import styles from "./MatchInfoHeader.module.css";

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
}) => {
  const [sortKey, setSortKey] = useState<keyof TeamInfo>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Dodajemy zależność refreshCounter do useEffect dla lepszego debugowania
  useEffect(() => {
    console.log('🔄 MatchInfoHeader - refreshCounter zmieniony na:', refreshCounter);
    console.log('📋 MatchInfoHeader - allMatches:', allMatches.length, 'elementów');
    console.log('👥 MatchInfoHeader - selectedTeam:', selectedTeam);
  }, [allMatches, selectedTeam, refreshCounter]);
  
  // Funkcja do pobierania nazwy zespołu na podstawie identyfikatora
  const getTeamName = (teamId: string) => {
    // Znajdź zespół w obiekcie TEAMS
    const team = Object.values(TEAMS).find(team => team.id === teamId);
    return team ? team.name : teamId; // Jeśli nie znaleziono, zwróć ID jako fallback
  };
  
  // Filtrowanie meczów wybranego zespołu - używamy useMemo dla optymalizacji
  const teamMatches = React.useMemo(() => {
    console.log(`🔍 Filtruję mecze dla zespołu ${selectedTeam}, dostępnych meczów: ${allMatches.length}`);
    console.log('🔢 Aktualna wartość refreshCounter:', refreshCounter);
    
    // Dodajemy dodatkowe debugowanie
    console.log('🧾 Szczegóły meczów:', allMatches.map(m => `${m.matchId}: ${m.team} vs ${m.opponent}`));
    
    const filtered = allMatches.filter(match => match.team === selectedTeam);
    console.log(`📊 Po filtrowaniu: ${filtered.length} meczów dla zespołu ${selectedTeam}`);
    
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
    
  // Dodajemy debugowanie wyników filtrowania
  useEffect(() => {
    console.log('📊 MatchInfoHeader - teamMatches po filtrowaniu:', teamMatches.length, 'elementów');
  }, [teamMatches]);

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

        <div className={styles.tableBody}>
          {teamMatches.length > 0 ? (
            teamMatches.map((match) => {
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
                                console.log("Usuwanie i odświeżanie obsługiwane przez hook useMatchInfo");
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
                                console.log("Usuwanie i odświeżanie obsługiwane przez hook useMatchInfo");
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
      </div>
    </div>
  );
};

export default MatchInfoHeader;
