"use client";

import React, { useState, useEffect } from "react";
import { TEAMS } from "@/constants/teams";
import { fetchTeams, Team } from "@/constants/teamsLoader";
import styles from "./TeamsSelector.module.css";

interface TeamsSelectorProps {
  selectedTeam: string;
  onChange: (teamId: string) => void;
  className?: string;
}

const TeamsSelector: React.FC<TeamsSelectorProps> = ({ 
  selectedTeam, 
  onChange,
  className = ""
}) => {
  const [teams, setTeams] = useState<Record<string, Team>>(TEAMS);
  const [isLoading, setIsLoading] = useState(false);

  // Pobieranie zespołów z Firebase
  useEffect(() => {
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
  }, []);

  return (
    <select 
      value={selectedTeam} 
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.teamsSelector} ${className} ${isLoading ? styles.loading : ''}`}
      disabled={isLoading}
    >
      {Object.values(teams).map(team => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
};

export default TeamsSelector; 