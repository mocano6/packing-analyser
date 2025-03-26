// src/components/MatchInfoHeader/MatchTile.tsx
"use client";

import React, { memo, useCallback, KeyboardEvent, useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import styles from "./MatchInfoHeader.module.css";

interface MatchTileProps {
  match: TeamInfo;
  isSelected: boolean;
  onSelect: (match: TeamInfo) => void;
  onEdit: (match: TeamInfo) => void;
  onDelete: (matchId: string) => void;
}

const MatchTile = memo(function MatchTile({
  match,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: MatchTileProps) {
  // Stan śledzący czy komponent jest już wyrenderowany na kliencie
  const [isMounted, setIsMounted] = useState(false);

  // Ustawienie flagi mounted po wyrenderowaniu na kliencie
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Obsługa naciśnięcia klawisza dla lepszej dostępności
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(match);
      }
    },
    [match, onSelect]
  );

  // Obsługa kliknięcia
  const handleClick = useCallback(() => {
    if (isMounted) {
      onSelect(match);
    }
  }, [isMounted, match, onSelect]);

  // Obsługa usuwania
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Zatrzymaj propagację, aby nie wybierać meczu
    if (window.confirm(`Czy na pewno chcesz usunąć mecz ${match.team} vs ${match.opponent}?`)) {
      onDelete(match.matchId);
    }
  }, [match, onDelete]);

  // Obsługa edycji
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Zatrzymaj propagację, aby nie wybierać meczu
    onEdit(match);
  }, [match, onEdit]);

  // Formatowanie daty
  const matchDate = new Date(match.date).toLocaleDateString('pl-PL');

  // Nazwa meczu - zależy od tego czy gospodarz czy gość
  const matchName = match.isHome 
    ? `${match.team} vs ${match.opponent}`
    : `${match.opponent} vs ${match.team}`;

  // Renderujemy prosty placeholder dla pierwszego renderowania na serwerze
  if (!isMounted) {
    return <div className={styles.matchRow}></div>;
  }

  // Dla klienta renderujemy pełną funkcjonalność
  return (
    <div
      className={`${styles.matchRow} ${isSelected ? styles.selected : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
    >
      <div className={styles.matchDate}>{matchDate}</div>
      <div className={styles.matchInfo}>
        <div className={styles.matchName}>{matchName}</div>
        <div className={styles.matchOpponent}>{match.opponent}</div>
      </div>
      <div className={styles.matchCompetition}>
        <span className={styles.competitionTag}>{match.competition}</span>
      </div>
      <div className={styles.matchLocation}>
        <span className={styles.locationTag}>{match.isHome ? "Dom" : "Wyjazd"}</span>
      </div>
      <div className={styles.matchActions}>
        <button
          className={styles.editBtn}
          onClick={handleEdit}
          title="Edytuj"
          aria-label={`Edytuj mecz: ${matchName}`}
        >
          ✎
        </button>
        <button
          className={styles.deleteBtn}
          onClick={handleDelete}
          title="Usuń"
          aria-label={`Usuń mecz: ${matchName}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
});

// Dla lepszego debugowania
MatchTile.displayName = "MatchTile";

export default MatchTile;
