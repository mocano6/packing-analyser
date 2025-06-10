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
}: PlayersGridProps) {
  // Stan do śledzenia czy komponent został zamontowany na kliencie
  const [isMounted, setIsMounted] = useState(false);
  // Stan dla collapse/expand
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // Po hydratacji renderujemy pełną wersję komponentu
  return (
    <div className={styles.playersGridContainer}>
      <div 
        className={styles.playersGridHeader} 
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3>Zawodnicy ({players.length})</h3>
        <button 
          className={styles.collapseButton}
          aria-label={isCollapsed ? "Rozwiń listę zawodników" : "Zwiń listę zawodników"}
        >
          {isCollapsed ? "▼" : "▲"}
        </button>
      </div>
      
      {!isCollapsed && (
    <div className={styles.playersGrid}>
      {players.map((player) => (
        <PlayerTile
          key={player.id}
          player={player}
          isSelected={player.id === selectedPlayerId}
          onSelect={onPlayerSelect}
          onEdit={onEditPlayer}
          onDelete={onDeletePlayer}
        />
      ))}
      <div
        className={`${styles.playerTile} ${styles.addPlayerTile}`}
        onClick={onAddPlayer}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAddPlayer();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Dodaj nowego zawodnika"
      >
        +
      </div>
        </div>
      )}
    </div>
  );
});

// Wyświetlamy nazwę komponentu w DevTools dla łatwiejszego debugowania
PlayersGrid.displayName = "PlayersGrid";

export default PlayersGrid;
