"use client";

import React, { useEffect, useState } from "react";
import { Player, TeamInfo, PlayerMatchStats } from "@/types";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { getDB } from "@/lib/firebase";
import { doc, getDoc } from "@/lib/firestoreWithMetrics";
import styles from "./PlayerMatchStatsModal.module.css";

interface PlayerMatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (stats: PlayerMatchStats) => Promise<void> | void;
  matchInfo: TeamInfo | null;
  players: Player[];
}

const PlayerMatchStatsModal: React.FC<PlayerMatchStatsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  matchInfo,
  players,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [possessionInput, setPossessionInput] = useState("");
  const [currentMatchData, setCurrentMatchData] = useState<TeamInfo | null>(null);
  const [isLoadingMatchData, setIsLoadingMatchData] = useState(false);
  const playersIndex = React.useMemo(() => buildPlayersIndex(players), [players]);
  const [formData, setFormData] = useState<PlayerMatchStats>({
    playerId: "",
    possessionMinutes: undefined,
    passesOwnHalfAccurate: undefined,
    passesOwnHalfInaccurate: undefined,
    passesOppHalfAccurate: undefined,
    passesOppHalfInaccurate: undefined,
  });

  const secondsToMMSS = (seconds?: number): string => {
    if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "";
    const totalSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const minutesDecimalToMMSS = (minutes?: number): string => {
    if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return "";
    const totalSeconds = Math.max(0, Math.round(minutes * 60));
    return secondsToMMSS(totalSeconds);
  };

  const mmssToMinutesDecimal = (mmss: string): number | undefined => {
    if (!mmss || !mmss.trim()) return undefined;
    const trimmed = mmss.trim();
    if (!trimmed.includes(":")) {
      const mins = Number(trimmed);
      if (Number.isNaN(mins) || mins < 0) return undefined;
      return mins;
    }

    const [minsStr, secsStr] = trimmed.split(":");
    const mins = Number(minsStr);
    const secs = Number(secsStr);
    if (Number.isNaN(mins) || Number.isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) {
      return undefined;
    }
    const totalSeconds = mins * 60 + secs;
    return totalSeconds / 60;
  };

  // Pobierz aktualne dane meczu z Firebase przy otwarciu modala
  useEffect(() => {
    if (!isOpen || !matchInfo?.matchId) {
      setCurrentMatchData(null);
      return;
    }

    const loadMatchData = async () => {
      setIsLoadingMatchData(true);
      try {
        const db = getDB();
        const matchRef = doc(db, "matches", matchInfo.matchId);
        const matchDoc = await getDoc(matchRef);
        if (matchDoc.exists()) {
          setCurrentMatchData(matchDoc.data() as TeamInfo);
        } else {
          setCurrentMatchData(matchInfo);
        }
      } catch {
        setCurrentMatchData(matchInfo);
      } finally {
        setIsLoadingMatchData(false);
      }
    };

    loadMatchData();
  }, [isOpen, matchInfo]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayerId("");
      setFormData({
        playerId: "",
        possessionMinutes: undefined,
        passesOwnHalfAccurate: undefined,
        passesOwnHalfInaccurate: undefined,
        passesOppHalfAccurate: undefined,
        passesOppHalfInaccurate: undefined,
      });
      setPossessionInput("");
      setError(null);
      setIsSaving(false);
      setCurrentMatchData(null);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedPlayerId) {
      setFormData({
        playerId: "",
        possessionMinutes: undefined,
        passesOwnHalfAccurate: undefined,
        passesOwnHalfInaccurate: undefined,
        passesOppHalfAccurate: undefined,
        passesOppHalfInaccurate: undefined,
      });
      setPossessionInput("");
      return;
    }

    // Użyj aktualnych danych z Firebase (currentMatchData) lub fallback do matchInfo
    const matchDataToUse = currentMatchData || matchInfo;
    
    // Sprawdź czy są zapisane dane dla tego zawodnika
    const existing = matchDataToUse?.matchData?.playerStats?.find(
      (stat) => stat.playerId === selectedPlayerId
    );

    if (existing) {
      setFormData({
        ...existing,
        playerId: selectedPlayerId,
      });
      setPossessionInput(minutesDecimalToMMSS(existing.possessionMinutes));
    } else {
      setFormData({
        playerId: selectedPlayerId,
        possessionMinutes: undefined,
        passesOwnHalfAccurate: undefined,
        passesOwnHalfInaccurate: undefined,
        passesOppHalfAccurate: undefined,
        passesOppHalfInaccurate: undefined,
      });
      setPossessionInput("");
    }
  }, [selectedPlayerId, currentMatchData, matchInfo]);

  const handleNumberChange = (key: keyof PlayerMatchStats, value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    setFormData((prev) => ({
      ...prev,
      [key]: Number.isNaN(numValue) ? undefined : numValue,
    }));
  };

  const handlePossessionChange = (value: string) => {
    const safeValue = value.toUpperCase();
    setPossessionInput(safeValue);
    const minutesDecimal = mmssToMinutesDecimal(safeValue);
    setFormData((prev) => ({
      ...prev,
      possessionMinutes: minutesDecimal,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPlayerId) {
      setError("Wybierz zawodnika.");
      return;
    }

    setIsSaving(true);
    try {
      const result = onSave({
        ...formData,
        playerId: selectedPlayerId,
      });
      if (result instanceof Promise) {
        await result;
      }
      
      // Odśwież dane meczu po zapisie
      if (matchInfo?.matchId) {
        try {
          const db = getDB();
          const matchRef = doc(db, "matches", matchInfo.matchId);
          const matchDoc = await getDoc(matchRef);
          if (matchDoc.exists()) {
            setCurrentMatchData(matchDoc.data() as TeamInfo);
          }
        } catch {
          // Ignoruj błędy przy odświeżaniu
        }
      }
      
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Nie udało się zapisać statystyk.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const matchDataToUse = currentMatchData || matchInfo;
  const teamId = matchDataToUse?.team;
  const teamPlayers = players.filter(
    (player) => teamId && (player.teams?.includes(teamId) || player.teamId === teamId)
  );

  return (
    <div className={styles.modal} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="player-stats-modal-title">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 id="player-stats-modal-title">Statystyki zawodnika</h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="player-select">Zawodnik</label>
            <select
              id="player-select"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
            >
              <option value="">-- Wybierz zawodnika --</option>
              {teamPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {getPlayerLabel(player.id, playersIndex)} {player.number ? `#${player.number}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Wszystkie podania w jednej linii */}
          <div className={styles.formRowFour}>
            <div className={styles.formGroup}>
              <label htmlFor="passes-own-acc">Własna - celne</label>
              <input
                id="passes-own-acc"
                type="number"
                min="0"
                value={formData.passesOwnHalfAccurate ?? ""}
                onChange={(e) => handleNumberChange("passesOwnHalfAccurate", e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="passes-own-inacc">Własna - niecelne</label>
              <input
                id="passes-own-inacc"
                type="number"
                min="0"
                value={formData.passesOwnHalfInaccurate ?? ""}
                onChange={(e) => handleNumberChange("passesOwnHalfInaccurate", e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="passes-opp-acc">Przeciwnik - celne</label>
              <input
                id="passes-opp-acc"
                type="number"
                min="0"
                value={formData.passesOppHalfAccurate ?? ""}
                onChange={(e) => handleNumberChange("passesOppHalfAccurate", e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="passes-opp-inacc">Przeciwnik - niecelne</label>
              <input
                id="passes-opp-inacc"
                type="number"
                min="0"
                value={formData.passesOppHalfInaccurate ?? ""}
                onChange={(e) => handleNumberChange("passesOppHalfInaccurate", e.target.value)}
              />
            </div>
          </div>

          {/* Czas posiadania */}
          <div className={styles.formGroupCentered}>
            <label htmlFor="possession-time">Czas posiadania</label>
            <input
              id="possession-time"
              type="text"
              value={possessionInput}
              onChange={(e) => handlePossessionChange(e.target.value)}
              placeholder="MM:SS"
            />
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.buttonGroup}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton} disabled={isSaving}>
              {isSaving ? "Zapisywanie..." : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerMatchStatsModal;
