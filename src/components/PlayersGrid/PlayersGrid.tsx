// src/components/PlayersGrid/PlayersGrid.tsx
"use client";

import React, { memo, useState, useEffect } from "react";
import styles from "./PlayersGrid.module.css";
import { PlayersGridProps } from "./PlayersGrid.types";
import PlayerTile from "./PlayerTile";

// Używamy memo do optymalizacji ponownego renderowania
const PlayersGrid = memo(function PlayersGrid({
  players,
  selectedPlayerId,
  onPlayerSelect,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  isExpanded = false,
  onToggle,
}: PlayersGridProps) {
  // Stan do śledzenia czy komponent został zamontowany na kliencie
  const [isMounted, setIsMounted] = useState(false);

  // Po pierwszym renderze na kliencie, oznaczamy komponent jako zamontowany
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Podczas SSR i pierwszego renderowania na kliencie pokazujemy uproszczony placeholder
  if (!isMounted) {
    return (
      <div className={styles.playersGridPlaceholder}>
        Ładowanie zawodników...
      </div>
    );
  }

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  // Po hydratacji renderujemy pełną wersję komponentu
  return (
    <div className={styles.playersGridContainer}>
      <label className={styles.playersGridLabel}>
        Pokaż zawodników:
      </label>
      <button 
        className={`${styles.playersGridHeader} ${isExpanded ? styles.playersGridHeaderActive : ''}`}
        onClick={handleToggle}
        aria-label={isExpanded ? "Zwiń listę zawodników" : "Rozwiń listę zawodników"}
        type="button"
      >
        <span>Zawodnicy ({players.length})</span>
      </button>
    </div>
  );
});

// Wyświetlamy nazwę komponentu w DevTools dla łatwiejszego debugowania
PlayersGrid.displayName = "PlayersGrid";

export default PlayersGrid;
