"use client";

import React, { useState, useEffect, useMemo } from "react";
import { fetchTeams, Team } from "@/constants/teamsLoader";
import styles from "./TeamsSelector.module.css";

interface TeamsSelectorProps {
  selectedTeam: string;
  onChange: (teamId: string) => void;
  className?: string;
  availableTeams?: Team[];
  showLabel?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const TeamsSelector: React.FC<TeamsSelectorProps> = ({ 
  selectedTeam, 
  onChange,
  className = "",
  availableTeams,
  showLabel = false,
  isExpanded = false,
  onToggle
}) => {
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [isLoading, setIsLoading] = useState(false);

  const getTeamInitials = (name: string): string => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    if (/^u\d+/i.test(trimmed)) return trimmed.toUpperCase(); // U16, U19, itp.
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Pobieranie zespołów z Firebase (tylko jeśli availableTeams nie jest przekazane)
  useEffect(() => {
    
    if (availableTeams !== undefined) {
      // Jeśli dostępne zespoły są przekazane jako props, użyj ich
      const teamsRecord: Record<string, Team> = {};
      availableTeams.forEach(team => {
        teamsRecord[team.id] = team;
      });
      setTeams(teamsRecord);
      return;
    }

    // W przeciwnym razie pobierz wszystkie zespoły z Firebase
    const loadTeams = async () => {
      setIsLoading(true);
      try {
        const fetchedTeams = await fetchTeams();
        setTeams(fetchedTeams);
      } catch (error) {
        console.error("Błąd podczas ładowania zespołów:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, [availableTeams]);

  const teamsList = useMemo(() => {
    return Object.values(teams)
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), "pl", { sensitivity: "base", numeric: true })
      );
  }, [teams]);
  const selectedTeamName = teams[selectedTeam]?.name || "Wybierz zespół";

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleTeamSelect = (teamId: string) => {
    onChange(teamId);
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <>
      <div className={styles.teamsSelectorContainer}>
        {showLabel && (
          <label className={styles.teamsSelectorLabel}>
            Wybierz zespół:
          </label>
        )}
        <button 
          className={`${styles.teamsSelectorHeader} ${isExpanded ? styles.teamsSelectorHeaderActive : ''} ${className}`}
          onClick={handleToggle}
          aria-label={isExpanded ? "Zwiń listę zespołów" : "Rozwiń listę zespołów"}
          type="button"
          disabled={isLoading || teamsList.length === 0}
        >
          <span>{selectedTeamName} ({teamsList.length})</span>
        </button>
      </div>
      {isExpanded && (
        <div className={styles.teamsSelectorOverlay} onClick={handleToggle}>
          <div className={styles.teamsSelectorModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.teamsSelectorModalHeader}>
              <h3 className={styles.teamsSelectorModalTitle}>Zespoły</h3>
              <button
                className={styles.closeTeamsSelectorButton}
                onClick={handleToggle}
                aria-label="Zamknij"
                title="Zamknij"
              >
                ×
              </button>
            </div>
            <div className={styles.teamsSelectorModalContent}>
              {isLoading ? (
                <div className={styles.loadingMessage}>Ładowanie zespołów...</div>
              ) : teamsList.length === 0 ? (
                <div className={styles.noTeamsMessage}>Brak dostępnych zespołów</div>
              ) : (
                <div className={styles.teamsList}>
                  {teamsList.map(team => (
                    <button
                      key={team.id}
                      className={`${styles.teamItem} ${
                        selectedTeam === team.id ? styles.teamItemActive : ""
                      }`}
                      onClick={() => handleTeamSelect(team.id)}
                      type="button"
                      title={team.name}
                    >
                      <div className={styles.teamTile}>
                        <div className={styles.teamLogoWrapper} aria-hidden="true">
                          {team.logo ? (
                            <img
                              src={team.logo}
                              alt=""
                              className={styles.teamLogo}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className={styles.teamInitials}>{getTeamInitials(team.name)}</div>
                          )}
                        </div>
                        <div className={styles.teamName}>{team.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsSelector; 