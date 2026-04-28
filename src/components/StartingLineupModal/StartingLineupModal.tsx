"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Player, PlayerMinutes, StartingLineup } from "@/types";
import { TEAMS } from "@/constants/teams";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import {
  assignPlayerToLineupSlot,
  createStartingLineup,
  FOOTBALL_FORMATIONS,
  mergeStartingLineupIntoPlayerMinutes,
  removePlayerFromLineup,
} from "@/lib/startingLineup";
import styles from "./StartingLineupModal.module.css";

interface StartingLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lineup: StartingLineup, playerMinutes: PlayerMinutes[]) => void;
  match: {
    team: string;
    opponent: string;
    startingLineup?: StartingLineup;
    playerMinutes?: PlayerMinutes[];
  };
  players: Player[];
  currentPlayerMinutes?: PlayerMinutes[];
  currentStartingLineup?: StartingLineup;
}

const StartingLineupModal: React.FC<StartingLineupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  match,
  players,
  currentPlayerMinutes = [],
  currentStartingLineup,
}) => {
  const initialFormationId = currentStartingLineup?.formationId ?? FOOTBALL_FORMATIONS[0].id;
  const [lineup, setLineup] = useState<StartingLineup>(() =>
    createStartingLineup(initialFormationId, currentStartingLineup)
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

  useEffect(() => {
    if (!isOpen) return;
    const formationId = currentStartingLineup?.formationId ?? FOOTBALL_FORMATIONS[0].id;
    setLineup(createStartingLineup(formationId, currentStartingLineup));
    setSelectedPlayerId(null);
  }, [isOpen, currentStartingLineup]);

  const getTeamName = (teamId: string) => {
    const team = Object.values(TEAMS).find((item) => item.id === teamId);
    return team ? team.name : teamId;
  };

  const assignedPlayerIds = useMemo(
    () => new Set(lineup.slots.map((slot) => slot.playerId).filter(Boolean) as string[]),
    [lineup.slots]
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const positionCompare = (a.position || "").localeCompare(b.position || "", "pl", { sensitivity: "base" });
      if (positionCompare !== 0) return positionCompare;
      return getPlayerLabel(a.id, playersIndex).localeCompare(getPlayerLabel(b.id, playersIndex), "pl", {
        sensitivity: "base",
      });
    });
  }, [players, playersIndex]);

  const selectedPlayersCount = assignedPlayerIds.size;

  const handleFormationChange = (formationId: string) => {
    setLineup((prev) => createStartingLineup(formationId, prev));
  };

  const assignPlayer = (slotId: string, playerId: string) => {
    setLineup((prev) => assignPlayerToLineupSlot(prev, slotId, playerId));
    setSelectedPlayerId(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>, slotId: string) => {
    event.preventDefault();
    const playerId = event.dataTransfer.getData("text/plain");
    if (playerId) {
      assignPlayer(slotId, playerId);
    }
  };

  const handleSlotClick = (slotId: string) => {
    if (selectedPlayerId) {
      assignPlayer(slotId, selectedPlayerId);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextLineup = { ...lineup, updatedAt: new Date().toISOString() };
    onSave(nextLineup, mergeStartingLineupIntoPlayerMinutes(currentPlayerMinutes, nextLineup));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>
              Pierwszy skład: {getTeamName(match.team)} vs {match.opponent}
            </h2>
            <p className={styles.modalSubtitle}>
              Wybierz system, a następnie przeciągnij zawodników na konkretne pozycje.
            </p>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Zamknij">
            ×
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.toolbar}>
            <label className={styles.formationLabel}>
              System
              <select
                value={lineup.formationId}
                onChange={(event) => handleFormationChange(event.target.value)}
                className={styles.formationSelect}
              >
                {FOOTBALL_FORMATIONS.map((formation) => (
                  <option key={formation.id} value={formation.id}>
                    {formation.name}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.counter} aria-live="polite">
              Wybrano {selectedPlayersCount}/11
            </span>
          </div>

          <div className={styles.workspace}>
            <aside className={styles.playersPanel} aria-label="Lista zawodników">
              <h3 className={styles.sectionTitle}>Zawodnicy</h3>
              <div className={styles.playersList}>
                {sortedPlayers.map((player) => {
                  const isAssigned = assignedPlayerIds.has(player.id);
                  const isSelected = selectedPlayerId === player.id;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", player.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setSelectedPlayerId(isSelected ? null : player.id)}
                      className={`${styles.playerChip} ${isAssigned ? styles.playerAssigned : ""} ${
                        isSelected ? styles.playerSelected : ""
                      }`}
                      aria-pressed={isSelected}
                      title="Przeciągnij na boisko albo kliknij i wybierz pozycję"
                    >
                      <span className={styles.playerNumber}>{player.number}</span>
                      <span className={styles.playerName}>{getPlayerLabel(player.id, playersIndex)}</span>
                      <span className={styles.playerPosition}>{player.position || "-"}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className={styles.pitchSection} aria-label="Boisko z pierwszym składem">
              <div className={styles.pitch}>
                <div className={styles.centerLine} />
                <div className={styles.centerCircle} />
                <div className={styles.penaltyBoxTop} />
                <div className={styles.penaltyBoxBottom} />
                {lineup.slots.map((slot) => {
                  const player = slot.playerId ? players.find((item) => item.id === slot.playerId) : undefined;
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      className={`${styles.pitchSlot} ${player ? styles.pitchSlotFilled : ""}`}
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, slot.slotId)}
                      onClick={() => handleSlotClick(slot.slotId)}
                      aria-label={`Pozycja ${slot.label}${player ? `, ${getPlayerLabel(player.id, playersIndex)}` : ""}`}
                    >
                      <span className={styles.slotRole}>{slot.label}</span>
                      <span className={styles.slotPlayer}>
                        {player ? getPlayerLabel(player.id, playersIndex) : selectedPlayerId ? "Kliknij" : "Upuść"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.assignedList}>
                {lineup.slots
                  .filter((slot) => slot.playerId)
                  .map((slot) => {
                    const player = players.find((item) => item.id === slot.playerId);
                    if (!player || !slot.playerId) return null;
                    return (
                      <button
                        key={`${slot.slotId}-${slot.playerId}`}
                        type="button"
                        className={styles.assignedItem}
                        onClick={() => setLineup((prev) => removePlayerFromLineup(prev, slot.playerId as string))}
                        title="Usuń zawodnika z pozycji"
                      >
                        {slot.label}: {getPlayerLabel(player.id, playersIndex)} ×
                      </button>
                    );
                  })}
              </div>
            </section>
          </div>

          <div className={styles.buttonGroup}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton} disabled={selectedPlayersCount === 0}>
              Zapisz skład
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartingLineupModal;
