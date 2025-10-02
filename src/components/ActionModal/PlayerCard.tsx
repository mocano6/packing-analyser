"use client";

import React, { memo } from "react";
import { Player } from "@/types";
import { getPlayerFullName } from "@/utils/playerUtils";
import styles from "./ActionModal.module.css";

interface PlayerCardProps {
  player: Player;
  isSender: boolean;
  isReceiver: boolean;
  isDribbler?: boolean;
  isDefensePlayer?: boolean;
  onSelect: (playerId: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = memo(function PlayerCard({
  player,
  isSender,
  isReceiver,
  isDribbler = false,
  isDefensePlayer = false,
  onSelect,
}) {
  const hasImage = !!player.imageUrl;
  
  return (
    <div
      className={`${styles.playerTile} 
        ${isSender ? styles.playerSenderTile : ''} 
        ${isReceiver ? styles.playerReceiverTile : ''} 
        ${isDribbler ? styles.playerDribblerTile : ''}
        ${isDefensePlayer ? styles.playerDefenseTile : ''}
        ${hasImage ? styles.withImage : ''}`}
      onClick={() => onSelect(player.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSender || isReceiver || isDribbler || isDefensePlayer}
    >
      {hasImage && (
        <>
          <img
            src={player.imageUrl}
            alt=""
            className={styles.playerTileImage}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className={styles.playerTileOverlay}></div>
        </>
      )}

      <div className={styles.playerContent}>
        <div className={styles.number}>{player.number}</div>

        <div className={styles.playerInfo}>
          <div className={styles.name}>{getPlayerFullName(player)}</div>
          <div className={styles.details}>
            {player.position && (
              <span className={styles.position}>{player.position}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PlayerCard; 