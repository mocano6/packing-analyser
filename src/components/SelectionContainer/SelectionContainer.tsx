// src/components/SelectionContainer/SelectionContainer.tsx
"use client";

import React, { memo, useEffect, useCallback, useMemo } from "react";
import styles from "./SelectionContainer.module.css";
import ActionTypeToggle from "../ActionTypeToggle/ActionTypeToggle";
import { Player } from "@/types"; // Zaktualizowana ścieżka dla Next.js
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";

export interface SelectionContainerProps {
  players: Player[];
  selectedPlayerId: string | null;
  selectedReceiverId: string | null;
  onReceiverSelect: (id: string | null) => void;
  actionMinute: number;
  onMinuteChange: (minute: number) => void;
  actionType: "pass" | "dribble";
  onActionTypeChange: (type: "pass" | "dribble") => void;
}

const SelectionContainer = memo(function SelectionContainer({
  players,
  selectedPlayerId,
  selectedReceiverId,
  onReceiverSelect,
  actionMinute,
  onMinuteChange,
  actionType,
  onActionTypeChange,
}: SelectionContainerProps) {
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const availableReceivers = players.filter(
    (player) => player.id !== selectedPlayerId
  );
  const playersIndex = useMemo(() => buildPlayersIndex(availableReceivers), [availableReceivers]);

  // Resetujemy odbiorcę jeśli nadawca i odbiorca to ten sam zawodnik
  useEffect(() => {
    if (selectedReceiverId === selectedPlayerId) {
      onReceiverSelect(null);
    }
  }, [selectedPlayerId, selectedReceiverId, onReceiverSelect]);

  const handleMinuteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onMinuteChange(parseInt(e.target.value) || 0);
    },
    [onMinuteChange]
  );

  const handleReceiverChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onReceiverSelect(e.target.value || null);
    },
    [onReceiverSelect]
  );

  return (
    <div className={styles.container}>
      <div className={styles.minuteContainer}>
        <label htmlFor="action-minute" className={styles.label}>
          Minuta:
        </label>
        <input
          id="action-minute"
          type="number"
          value={actionMinute}
          onChange={handleMinuteChange}
          min="0"
          max="125"
          className={styles.input}
          aria-label="Minuta akcji"
        />
      </div>

      <ActionTypeToggle
        actionType={actionType}
        onActionTypeChange={onActionTypeChange}
      />

      <div className={styles.playerSelection}>
        <label id="sender-label">Nadawca:</label>
        <div
          className={styles.selectedPlayer}
          aria-labelledby="sender-label"
          role="status"
        >
          {selectedPlayer
            ? `${selectedPlayer.name} (${selectedPlayer.number})`
            : "Wybierz zawodnika"}
        </div>
      </div>

      {actionType === "pass" && (
        <div className={styles.playerSelection}>
          <label htmlFor="receiver-select">Odbiorca:</label>
          <select
            id="receiver-select"
            value={selectedReceiverId || ""}
            onChange={handleReceiverChange}
            className={styles.select}
            aria-label="Wybierz odbiorcę podania"
          >
            <option value="">Wybierz zawodnika</option>
            {availableReceivers.map((player) => (
              <option key={player.id} value={player.id}>
                {getPlayerLabel(player.id, playersIndex)} ({player.number})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
SelectionContainer.displayName = "SelectionContainer";

export default SelectionContainer;
