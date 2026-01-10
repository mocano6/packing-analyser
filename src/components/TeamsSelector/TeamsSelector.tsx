"use client";

import React, { useState, useEffect } from "react";
import { TEAMS } from "@/constants/teams";
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

  const teamsList = Object.values(teams);
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
                    >
                      {team.name}
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