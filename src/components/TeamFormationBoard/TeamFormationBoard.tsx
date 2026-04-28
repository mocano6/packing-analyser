"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Player } from "@/types";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { FOOTBALL_FORMATIONS, getFormationById } from "@/lib/startingLineup";
import {
  assignPlayerToFormationSlot,
  normalizeTeamFormationBoardStorage,
  pruneFormationBoardPlayers,
  removePlayerFromFormationBoard,
  type TeamFormationBoardStorage,
} from "@/lib/teamFormationBoard";
import styles from "./TeamFormationBoard.module.css";

interface TeamFormationBoardProps {
  teamId: string;
  players: Player[];
}

const STORAGE_PREFIX = "teamFormationBoard";

const TeamFormationBoard: React.FC<TeamFormationBoardProps> = ({ teamId, players }) => {
  const [storage, setStorage] = useState<TeamFormationBoardStorage>(() =>
    normalizeTeamFormationBoardStorage(null)
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const playersIndex = useMemo(() => buildPlayersIndex(players), [players]);

  const storageKey = `${STORAGE_PREFIX}_${teamId || "unknown"}`;

  useEffect(() => {
    if (!teamId || typeof window === "undefined") {
      setStorage(normalizeTeamFormationBoardStorage(null));
      return;
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null") as Partial<TeamFormationBoardStorage> | null;
      setStorage(normalizeTeamFormationBoardStorage(parsed));
    } catch {
      setStorage(normalizeTeamFormationBoardStorage(null));
    }
  }, [storageKey, teamId]);

  useEffect(() => {
    if (!teamId || typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(storage));
  }, [storage, storageKey, teamId]);

  const selectedFormation = getFormationById(storage.selectedFormationId);
  const availablePlayerIds = useMemo(() => new Set(players.map((player) => player.id)), [players]);
  const currentBoard = useMemo(
    () => pruneFormationBoardPlayers(storage.formations[storage.selectedFormationId] ?? {}, availablePlayerIds),
    [availablePlayerIds, storage.formations, storage.selectedFormationId]
  );
  const assignedPlayerIds = useMemo(
    () => new Set(Object.values(currentBoard).flat()),
    [currentBoard]
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const assignedCompare = Number(assignedPlayerIds.has(a.id)) - Number(assignedPlayerIds.has(b.id));
      if (assignedCompare !== 0) return assignedCompare;
      return getPlayerLabel(a.id, playersIndex).localeCompare(getPlayerLabel(b.id, playersIndex), "pl", {
        sensitivity: "base",
      });
    });
  }, [assignedPlayerIds, players, playersIndex]);

  const saveCurrentBoard = (nextBoard: Record<string, string[]>) => {
    setStorage((prev) => ({
      ...prev,
      formations: {
        ...prev.formations,
        [prev.selectedFormationId]: nextBoard,
      },
    }));
  };

  const handleFormationChange = (formationId: string) => {
    setSelectedPlayerId(null);
    setStorage((prev) => {
      const normalized = normalizeTeamFormationBoardStorage(prev);
      return {
        ...normalized,
        selectedFormationId: formationId,
      };
    });
  };

  const assignPlayer = (slotId: string, playerId: string) => {
    saveCurrentBoard(assignPlayerToFormationSlot(currentBoard, slotId, playerId));
    setSelectedPlayerId(null);
  };

  const removePlayer = (playerId: string) => {
    saveCurrentBoard(removePlayerFromFormationBoard(currentBoard, playerId));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, slotId: string) => {
    event.preventDefault();
    const playerId = event.dataTransfer.getData("text/plain");
    if (playerId) assignPlayer(slotId, playerId);
  };

  const clearFormation = () => {
    if (!window.confirm(`Wyczyścić obsadę systemu ${selectedFormation.name}?`)) return;
    saveCurrentBoard(Object.fromEntries(selectedFormation.slots.map((slot) => [slot.slotId, []])));
  };

  return (
    <div className={styles.board}>
      <div className={styles.toolbar}>
        <label className={styles.formationLabel}>
          System
          <select
            value={storage.selectedFormationId}
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
        <button type="button" className={styles.clearButton} onClick={clearFormation}>
          Wyczyść system
        </button>
      </div>

      <div className={styles.content}>
        <aside className={styles.playersPanel}>
          <h4 className={styles.sectionTitle}>Dostępni zawodnicy</h4>
          <p className={styles.helpText}>Przeciągnij zawodnika na rolę lub kliknij zawodnika i potem rolę.</p>
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
                >
                  <span className={styles.playerNumber}>{player.number}</span>
                  <span className={styles.playerName}>{getPlayerLabel(player.id, playersIndex)}</span>
                  <span className={styles.playerPosition}>{player.position || "-"}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.slotsGrid} aria-label={`Baza zawodników dla systemu ${selectedFormation.name}`}>
          {selectedFormation.slots.map((slot) => {
            const slotPlayerIds = currentBoard[slot.slotId] ?? [];
            return (
              <div
                key={slot.slotId}
                className={styles.slotCard}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, slot.slotId)}
                onClick={() => {
                  if (selectedPlayerId) assignPlayer(slot.slotId, selectedPlayerId);
                }}
                role="button"
                tabIndex={0}
                aria-label={`Rola ${slot.label}`}
              >
                <div className={styles.slotHeader}>
                  <span className={styles.slotLabel}>{slot.label}</span>
                  <span className={styles.slotRole}>{slot.role}</span>
                </div>
                <div className={styles.slotPlayers}>
                  {slotPlayerIds.length === 0 && (
                    <div className={styles.emptySlot}>{selectedPlayerId ? "Kliknij, aby dodać" : "Upuść zawodnika"}</div>
                  )}
                  {slotPlayerIds.map((playerId, index) => {
                    const player = players.find((item) => item.id === playerId);
                    if (!player) return null;
                    return (
                      <button
                        key={playerId}
                        type="button"
                        className={styles.assignedPlayer}
                        onClick={(event) => {
                          event.stopPropagation();
                          removePlayer(playerId);
                        }}
                        title="Usuń z tej roli"
                      >
                        <span className={styles.optionIndex}>{index + 1}</span>
                        <span className={styles.assignedName}>{getPlayerLabel(player.id, playersIndex)}</span>
                        <span className={styles.removeMark}>×</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default TeamFormationBoard;
