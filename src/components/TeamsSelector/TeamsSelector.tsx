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
}

const TeamsSelector: React.FC<TeamsSelectorProps> = ({ 
  selectedTeam, 
  onChange,
  className = "",
  availableTeams,
  showLabel = false
}) => {
  const [teams, setTeams] = useState<Record<string, Team>>(TEAMS);
  const [isLoading, setIsLoading] = useState(false);

  // Pobieranie zespołów z Firebase (tylko jeśli availableTeams nie jest przekazane)
  useEffect(() => {
    if (availableTeams && availableTeams.length > 0) {
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

  return (
    <div className={styles.teamsSelectorContainer}>
      {showLabel && (
        <label className={styles.teamsSelectorLabel}>
          Wybierz zespół:
        </label>
      )}
      <select 
        value={selectedTeam} 
        onChange={(e) => onChange(e.target.value)}
        className={`${styles.teamsSelector} ${className} ${isLoading ? styles.loading : ''}`}
        disabled={isLoading || teamsList.length === 0}
      >
        {teamsList.length === 0 ? (
          <option value="">Brak dostępnych zespołów</option>
        ) : (
          teamsList.map(team => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
};

export default TeamsSelector; 