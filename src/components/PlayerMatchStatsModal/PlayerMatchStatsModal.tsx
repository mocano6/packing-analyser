"use client";

import React, { useEffect, useState } from "react";
import { Player, TeamInfo, PlayerMatchStats } from "@/types";
import { buildPlayersIndex, getPlayerLabel } from "@/utils/playerUtils";
import { getDB } from "@/lib/firebase";
import { doc, getDoc } from "@/lib/firestoreWithMetrics";
import styles from "./PlayerMatchStatsModal.module.css";

/** Jedna pozycja z listy meczów dla trybu "zawodnik wpisuje sobie" */
export interface MatchOption {
  matchId: string;
  team?: string;
  opponent?: string;
  date?: unknown;
}

interface PlayerMatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Gdy przekazany matchId (tryb self), zapis idzie do tego meczu */
  onSave: (stats: PlayerMatchStats, matchId?: string) => Promise<void> | void;
  matchInfo: TeamInfo | null;
  players: Player[];
  /** Tryb "zawodnik wpisuje sobie": zawodnik z góry ustawiony, bez wyboru z listy */
  presetPlayerId?: string | null;
  /** Lista meczów do wyboru (np. mecze zespołu) – używana gdy presetPlayerId */
  matchesForPlayer?: MatchOption[];
}

const toDateStr = (v: unknown): string => {
  if (!v) return "";
  if (typeof v === "string") return String(v).slice(0, 10);
  if (typeof (v as { toDate?: () => Date }).toDate === "function") return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

const PlayerMatchStatsModal: React.FC<PlayerMatchStatsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  matchInfo,
  players,
  presetPlayerId,
  matchesForPlayer = [],
}) => {
  const isSelfMode = Boolean(presetPlayerId && String(presetPlayerId).trim());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
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
  const effectivePlayerId = isSelfMode ? (presetPlayerId || "") : selectedPlayerId;
  const effectiveMatchId = isSelfMode ? selectedMatchId : matchInfo?.matchId ?? null;

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

  // Przy otwarciu w trybie self: ustaw zawodnika; przy zamknięciu reset
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlayerId("");
      setSelectedMatchId("");
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
    if (isSelfMode && presetPlayerId) {
      setSelectedPlayerId(presetPlayerId);
    }
  }, [isOpen, isSelfMode, presetPlayerId]);

  // Pobierz dane meczu: w trybie self z wybranego matchId, w trybie admin z matchInfo
  useEffect(() => {
    const matchIdToLoad = isSelfMode ? selectedMatchId : matchInfo?.matchId;
    if (!isOpen || !matchIdToLoad) {
      setCurrentMatchData(null);
      return;
    }

    const loadMatchData = async () => {
      setIsLoadingMatchData(true);
      try {
        const db = getDB();
        const matchRef = doc(db, "matches", matchIdToLoad);
        const matchDoc = await getDoc(matchRef);
        if (matchDoc.exists()) {
          setCurrentMatchData(matchDoc.data() as TeamInfo);
        } else if (!isSelfMode && matchInfo?.matchId === matchIdToLoad) {
          setCurrentMatchData(matchInfo);
        } else {
          setCurrentMatchData(null);
        }
      } catch {
        setCurrentMatchData(null);
      } finally {
        setIsLoadingMatchData(false);
      }
    };

    loadMatchData();
  }, [isOpen, isSelfMode, selectedMatchId, matchInfo]);

  // Uzupełnij formularz danymi z currentMatchData dla effectivePlayerId
  useEffect(() => {
    if (!effectivePlayerId) {
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

    const matchDataToUse = currentMatchData || (!isSelfMode ? matchInfo : null);
    const existing = matchDataToUse?.matchData?.playerStats?.find(
      (stat) => stat.playerId === effectivePlayerId
    );

    if (existing) {
      setFormData({
        ...existing,
        playerId: effectivePlayerId,
      });
      setPossessionInput(minutesDecimalToMMSS(existing.possessionMinutes));
    } else {
      setFormData({
        playerId: effectivePlayerId,
        possessionMinutes: undefined,
        passesOwnHalfAccurate: undefined,
        passesOwnHalfInaccurate: undefined,
        passesOppHalfAccurate: undefined,
        passesOppHalfInaccurate: undefined,
      });
      setPossessionInput("");
    }
  }, [effectivePlayerId, currentMatchData, matchInfo, isSelfMode]);

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

    if (!effectivePlayerId) {
      setError("Wybierz zawodnika.");
      return;
    }
    if (isSelfMode && !effectiveMatchId) {
      setError("Wybierz mecz.");
      return;
    }

    setIsSaving(true);
    try {
      const result = onSave(
        { ...formData, playerId: effectivePlayerId },
        isSelfMode ? effectiveMatchId || undefined : undefined
      );
      if (result instanceof Promise) {
        await result;
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
  const presetPlayer = isSelfMode && presetPlayerId ? players.find((p) => p.id === presetPlayerId) : null;
  const hasMatchSelected = !isSelfMode || Boolean(selectedMatchId);
  const noMatchesAvailable = isSelfMode && matchesForPlayer.length === 0;

  return (
    <div className={styles.modal} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="player-stats-modal-title">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <h2 id="player-stats-modal-title">{isSelfMode ? "Moje statystyki meczowe" : "Statystyki zawodnika"}</h2>
            <p className={styles.modalSubtitle}>
              {isSelfMode
                ? "Wybierz mecz i wpisz swoje wartości."
                : "Wybierz zawodnika i uzupełnij statystyki meczowe."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Zamknij okno statystyk zawodnika"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.contextCard}>
            {isSelfMode ? (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="match-select">Mecz</label>
                  <select
                    id="match-select"
                    value={selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                    required={isSelfMode}
                    disabled={noMatchesAvailable}
                  >
                    <option value="">
                      {noMatchesAvailable
                        ? "-- Brak meczów z rozegranymi minutami --"
                        : "-- Wybierz mecz, do którego przypisać statystyki --"}
                    </option>
                    {matchesForPlayer.map((m) => (
                      <option key={m.matchId} value={m.matchId}>
                        {`${toDateStr(m.date)} • ${m.opponent || "Przeciwnik"}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Zawodnik</label>
                  <div id="player-readonly" className={styles.presetPlayerName} aria-live="polite">
                    {presetPlayer
                      ? `${getPlayerLabel(presetPlayer.id, playersIndex)}${presetPlayer.number ? ` #${presetPlayer.number}` : ""}`
                      : presetPlayerId || "—"}
                  </div>
                </div>
              </>
            ) : (
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
            )}
          </div>

          {!hasMatchSelected && isSelfMode && (
            <div className={styles.infoMessage}>
              Najpierw wybierz mecz, aby uzupełnić i zapisać statystyki.
            </div>
          )}

          <div className={styles.sectionHeader}>Podania</div>
          <div className={styles.formRowFour}>
            <div className={styles.formGroup}>
              <label htmlFor="passes-own-acc">Własna - celne</label>
              <input
                id="passes-own-acc"
                type="number"
                min="0"
                disabled={!hasMatchSelected}
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
                disabled={!hasMatchSelected}
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
                disabled={!hasMatchSelected}
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
                disabled={!hasMatchSelected}
                value={formData.passesOppHalfInaccurate ?? ""}
                onChange={(e) => handleNumberChange("passesOppHalfInaccurate", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.sectionHeader}>Czas posiadania</div>
          <div className={styles.formGroupCentered}>
            <label htmlFor="possession-time">Format MM:SS</label>
            <input
              id="possession-time"
              type="text"
              disabled={!hasMatchSelected}
              value={possessionInput}
              onChange={(e) => handlePossessionChange(e.target.value)}
              placeholder="MM:SS"
            />
          </div>

          {isLoadingMatchData && <div className={styles.infoMessage}>Ładowanie danych meczu...</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}

          <div className={styles.buttonGroup}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton} disabled={isSaving || !hasMatchSelected || noMatchesAvailable}>
              {isSaving ? "Zapisywanie..." : "Zapisz statystyki"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerMatchStatsModal;
