// src/components/MatchInfoHeader/MatchInfoHeader.tsx
"use client";

import React, { useState, KeyboardEvent } from "react";
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
}) => {
  const [sortKey, setSortKey] = useState<keyof TeamInfo>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Filtrowanie meczów wybranego zespołu
  const teamMatches = allMatches
    .filter(match => match.team === selectedTeam)
    .sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      
      if (aValue !== undefined && bValue !== undefined) {
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      }
      return 0;
    });

  // Funkcja do dodania nowego meczu
  const handleAddMatch = () => {
    onSelectMatch(null); // Resetowanie wybranego meczu
    onChangeMatch(); // Otwieranie modalu
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
        
        <button 
          className={styles.addButton}
          onClick={handleAddMatch}
        >
          + Dodaj mecz
        </button>
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
              
              return (
                <div 
                  key={match.matchId}
                  className={`${styles.matchRow} ${isSelected ? styles.selected : ""}`}
                  onClick={() => onSelectMatch(match)}
                >
                  <div className={styles.cell}>{match.date}</div>
                  <div className={styles.cell}>{match.team}</div>
                  <div className={styles.cell}>{match.opponent}</div>
                  <div className={styles.cell}>
                    <span className={styles.competition}>{match.competition}</span>
                  </div>
                  <div className={styles.cell}>{match.isHome ? "Dom" : "Wyjazd"}</div>
                  <div className={styles.cellActions}>
                    {isSelected && (
                      <>
                        <button 
                          className={styles.editSelectedBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeMatch();
                          }}
                        >
                          Edytuj
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${match.team} vs ${match.opponent}`}
                        >
                          ⌚
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
                          aria-label={`Edytuj mecz: ${match.team} vs ${match.opponent}`}
                        >
                          ✎
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Czy na pewno chcesz usunąć ten mecz?")) {
                              if (match.matchId) {
                                onDeleteMatch(match.matchId);
                              }
                            }
                          }}
                          onKeyDown={(e) => match.matchId ? handleDeleteKeyDown(e, match.matchId) : undefined}
                          title="Usuń"
                          aria-label={`Usuń mecz: ${match.team} vs ${match.opponent}`}
                        >
                          ✕
                        </button>
                        <button
                          className={`${styles.editBtn} ${styles.minutesBtn}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onManagePlayerMinutes(match);
                          }}
                          title="Minuty zawodników"
                          aria-label={`Zarządzaj minutami zawodników w meczu: ${match.team} vs ${match.opponent}`}
                        >
                          ⌚
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
      
      {/* Usunąłem osobny element z aktualnie wybranym meczem */}
    </div>
  );
};

export default MatchInfoHeader;
