// src/components/SeasonSelector/SeasonSelector.tsx
"use client";

import React from 'react';
import styles from './SeasonSelector.module.css';

interface SeasonSelectorProps {
  selectedSeason: string;
  onChange: (seasonId: string) => void;
  availableSeasons: { id: string; name: string }[];
  className?: string;
  showLabel?: boolean;
}

const SeasonSelector: React.FC<SeasonSelectorProps> = ({ 
  selectedSeason, 
  onChange,
  availableSeasons,
  className = "",
  showLabel = false
}) => {
  return (
    <div className={styles.seasonSelectorContainer}>
      {showLabel && (
        <label className={styles.seasonSelectorLabel}>
          Wybierz sezon:
        </label>
      )}
      <select 
        value={selectedSeason} 
        onChange={(e) => onChange(e.target.value)}
        className={`${styles.seasonSelector} ${className}`}
        disabled={availableSeasons.length === 0}
      >
        <option value="all">Wszystkie sezony</option>
        {availableSeasons.map(season => (
          <option key={season.id} value={season.id}>
            {season.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeasonSelector; 