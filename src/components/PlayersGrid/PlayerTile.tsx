// src/components/PlayersGrid/PlayerTile.tsx
"use client";

import React, { memo } from "react";
import { PlayerTileProps } from "./PlayersGrid.types";
import styles from "./PlayersGrid.module.css";

const PlayerTile = memo(function PlayerTile({
  player,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: PlayerTileProps) {
  const hasImage = !!player.imageUrl;

  // Obsługa błędu ładowania obrazka
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
  };

  return (
    <div
      className={`${styles.playerTile} ${isSelected ? styles.selected : ""} ${
        hasImage ? styles.withImage : ""
      }`}
      onClick={() => onSelect(player.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Wybierz gracza: ${player.name}, numer ${player.number}`}
    >
      {hasImage && (
        <>
          {/* Użycie zwykłego img zamiast next/image, ponieważ nie znamy wymiarów z góry */}
          <img
            src={player.imageUrl}
            alt=""
            className={styles.playerTileImage}
            onError={handleImageError}
          />
          <div className={styles.playerTileOverlay}></div>
        </>
      )}

      <div className={styles.playerContent}>
        <div className={styles.number}>{player.number}</div>

        <button
          className={styles.editBtn}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(player.id);
          }}
          title="Edytuj"
          aria-label={`Edytuj gracza: ${player.name}`}
        >
          ✎
        </button>
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(player.id);
          }}
          title="Usuń"
          aria-label={`Usuń gracza: ${player.name}`}
        >
          ✕
        </button>

        <div className={styles.playerInfo}>
          <div className={styles.name}>{player.name}</div>
          <div className={styles.details}>
            {player.position && (
              <span className={styles.position}>{player.position}</span>
            )}
            {player.birthYear && (
              <span className={styles.birthYear}>{player.birthYear}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Dla lepszego debugowania
PlayerTile.displayName = "PlayerTile";

export default PlayerTile;
