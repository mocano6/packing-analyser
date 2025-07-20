// src/components/PlayersGrid/PlayerTile.tsx
"use client";

import React, {
  memo,
  useCallback,
  KeyboardEvent,
  useState,
  useEffect,
} from "react";
import { PlayerTileProps } from "./PlayersGrid.types";
import styles from "./PlayersGrid.module.css";

const PlayerTile = memo(function PlayerTile({
  player,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: PlayerTileProps) {
  // Stan śledzący czy komponent jest już wyrenderowany na kliencie
  const [isMounted, setIsMounted] = useState(false);

  // Ustawienie flagi mounted po wyrenderowaniu na kliencie
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const hasImage = !!player.imageUrl;

  // Obsługa błędu ładowania obrazka - zoptymalizowana z useCallback
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.display = "none";
    },
    []
  );

  // Obsługa naciśnięcia klawisza dla lepszej dostępności
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(player.id);
      }
    },
    [player.id, onSelect]
  );

  // Obsługa edycji z klawiaturą
  const handleEditKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onEdit(player.id);
      }
    },
    [player.id, onEdit]
  );

  // Obsługa usuwania z klawiaturą
  const handleDeleteKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onDelete(player.id);
      }
    },
    [player.id, onDelete]
  );

  // Obsługa kliknięcia - dodajemy dodatkowe zabezpieczenie
  const handleClick = useCallback(() => {
    if (isMounted) {
      onSelect(player.id);
    }
  }, [isMounted, player.id, onSelect]);

  // Renderujemy prosty placeholder dla pierwszego renderowania
  if (!isMounted) {
    return (
      <div
        className={`${styles.playerTile} ${hasImage ? styles.withImage : ""}`}
        aria-label="Ładowanie zawodnika..."
      >
        <div className={styles.playerContent}>
          <div className={styles.number}>{player.number}</div>
          <div className={styles.playerInfo}>
            <div className={styles.name}>{player.name}</div>
          </div>
        </div>
      </div>
    );
  }

  // Dla klienta renderujemy pełną funkcjonalność
  return (
    <div
      className={`${styles.playerTile} ${isSelected ? styles.selected : ""} ${
        hasImage ? styles.withImage : ""
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Wybierz gracza: ${player.name}, numer ${player.number}`}
    >
      {hasImage && (
        <>
          <img
            src={player.imageUrl}
            alt=""
            className={styles.playerTileImage}
            onError={handleImageError}
          />
          <div className={styles.playerTileOverlay}></div>
        </>
      )}

      {player.isTestPlayer && (
        <div className={styles.testPlayerBadge}>T</div>
      )}

      <div className={styles.playerContent}>
        <div className={styles.number}>{player.number}</div>

        <button
          className={styles.editBtn}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(player.id);
          }}
          onKeyDown={handleEditKeyDown}
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
          onKeyDown={handleDeleteKeyDown}
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
