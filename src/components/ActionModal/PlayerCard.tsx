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
  return (
    <div
      className={`${styles.playerTile} 
        ${isSender ? styles.playerSenderTile : ''} 
        ${isReceiver ? styles.playerReceiverTile : ''} 
        ${isDribbler ? styles.playerDribblerTile : ''}
        ${isDefensePlayer ? styles.playerDefenseTile : ''}`}
      onClick={() => onSelect(player.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isSender || isReceiver || isDribbler || isDefensePlayer}
    >
      <div className={styles.playerContent}>
        <div className={styles.number}>{player.number}</div>
        <div className={styles.playerInfo}>
          <div className={styles.name}>{getPlayerFullName(player)}</div>
        </div>
      </div>
    </div>
  );
});

export default PlayerCard; 