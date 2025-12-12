"use client";

import React, { useMemo } from "react";
import { Player, Action, TeamInfo } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./PlayerDetailsPanel.module.css";

interface PlayerDetailsPanelProps {
  player: Player | null;
  actions: Action[];
  matches: TeamInfo[];
  selectedMatchIds?: string[];
  onClose: () => void;
}

const PlayerDetailsPanel: React.FC<PlayerDetailsPanelProps> = ({
  player,
  actions,
  matches,
  selectedMatchIds,
  onClose,
}) => {
  // Filtruj akcje dla wybranego zawodnika i meczów
  const playerStats = useMemo(() => {
    if (!player) return null;

    // Filtruj akcje dla wybranego zawodnika
    let filteredActions = actions.filter(
      (action) =>
        action.senderId === player.id ||
        action.receiverId === player.id ||
        action.playerId === player.id
    );

    // Jeśli wybrano konkretne mecze, filtruj po nich
    if (selectedMatchIds && selectedMatchIds.length > 0) {
      filteredActions = filteredActions.filter((action) =>
        selectedMatchIds.includes(action.matchId || "")
      );
    }

    // Oblicz statystyki
    let totalPxT = 0;
    let totalXT = 0;
    let totalxG = 0;
    let totalRegains = 0;
    let totalLoses = 0;
    let totalPKEntries = 0;

    filteredActions.forEach((action) => {
      // PxT i xT
      const xTDifference = (action.xTValueEnd || 0) - (action.xTValueStart || 0);
      const packingPoints = action.packingPoints || 0;
      const pxtValue = xTDifference * packingPoints;

      if (action.senderId === player.id || action.playerId === player.id) {
        totalPxT += pxtValue;
        totalXT += xTDifference;
      }

      // xG (z akcji strzałów)
      if (action.shot && action.xG) {
        if (action.playerId === player.id) {
          totalxG += action.xG;
        }
      }

      // Regainy - sprawdzamy czy akcja ma pola charakterystyczne dla regain
      // (np. isBelow8s, playersBehindBall, opponentsBeforeBall)
      if (
        (action.isBelow8s !== undefined || 
         action.playersBehindBall !== undefined || 
         action.opponentsBeforeBall !== undefined) &&
        action.senderId === player.id &&
        !action.isReaction5s
      ) {
        totalRegains += 1;
      }

      // Straty - sprawdzamy czy akcja ma pola charakterystyczne dla loses
      // (np. isReaction5s, isBelow8s bez playersBehindBall)
      if (
        (action.isReaction5s !== undefined ||
         (action.isBelow8s !== undefined && 
          action.playersBehindBall === undefined && 
          action.opponentsBeforeBall === undefined)) &&
        action.senderId === player.id
      ) {
        totalLoses += 1;
      }

      // Wejścia w PK (penalty area entries)
      if (action.isPenaltyAreaEntry && (action.senderId === player.id || action.receiverId === player.id)) {
        totalPKEntries += 1;
      }
    });

    // Znajdź mecze, w których grał zawodnik
    const playerMatches = matches.filter((match) => {
      if (selectedMatchIds && selectedMatchIds.length > 0) {
        return selectedMatchIds.includes(match.matchId || "");
      }
      return true;
    });

    return {
      totalPxT,
      totalXT,
      totalxG,
      totalRegains,
      totalLoses,
      totalPKEntries,
      actionsCount: filteredActions.length,
      matchesCount: playerMatches.length,
    };
  }, [player, actions, matches, selectedMatchIds]);

  if (!player) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <div className={styles.header}>
          {player.imageUrl && (
            <div className={styles.imageContainer}>
              <img
                src={player.imageUrl}
                alt={getPlayerFullName(player)}
                className={styles.playerImage}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className={styles.playerInfo}>
            <h2 className={styles.playerName}>{getPlayerFullName(player)}</h2>
            {player.number && (
              <div className={styles.playerNumber}>#{player.number}</div>
            )}
            {player.position && (
              <div className={styles.playerPosition}>{player.position}</div>
            )}
          </div>
        </div>

        {playerStats && (
          <div className={styles.statsContainer}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalPxT.toFixed(2)}</div>
                <div className={styles.statLabel}>PxT</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalxG.toFixed(2)}</div>
                <div className={styles.statLabel}>xG</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalRegains}</div>
                <div className={styles.statLabel}>Regainy</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalLoses}</div>
                <div className={styles.statLabel}>Straty</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.totalPKEntries}</div>
                <div className={styles.statLabel}>Wejścia w PK</div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statValue}>{playerStats.actionsCount}</div>
                <div className={styles.statLabel}>Akcje</div>
              </div>
            </div>

            <div className={styles.matchesInfo}>
              <p>
                Statystyki z {playerStats.matchesCount}{" "}
                {playerStats.matchesCount === 1 ? "meczu" : "meczów"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerDetailsPanel;

