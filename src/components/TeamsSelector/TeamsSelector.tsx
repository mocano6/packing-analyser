"use client";

import React from "react";
import { TEAMS } from "@/constants/teams";
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
  return (
    <select 
      value={selectedTeam} 
      onChange={(e) => onChange(e.target.value)}
      className={`${styles.teamsSelector} ${className}`}
    >
      {Object.values(TEAMS).map(team => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
};

export default TeamsSelector; 