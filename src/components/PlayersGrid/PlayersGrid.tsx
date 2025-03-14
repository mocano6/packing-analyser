// src/components/PlayersGrid/PlayersGrid.tsx
"use client";

import React, { memo } from "react";
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
  return (
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
        role="button"
        tabIndex={0}
        aria-label="Dodaj nowego zawodnika"
      >
        +
      </div>
    </div>
  );
});

// Wyświetlamy nazwę komponentu w DevTools dla łatwiejszego debugowania
PlayersGrid.displayName = "PlayersGrid";

export default PlayersGrid;
