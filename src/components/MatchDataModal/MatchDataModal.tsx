// src/components/MatchDataModal/MatchDataModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PossessionSegment, TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import styles from "./MatchDataModal.module.css";

type MatchDataFormData = NonNullable<TeamInfo['matchData']>;
type PossessionSegmentType = PossessionSegment["type"];

interface MatchDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchData: TeamInfo['matchData']) => Promise<void> | void;
  currentMatch: TeamInfo | null;
  allAvailableTeams?: { id: string; name: string }[];
}

const MatchDataModal: React.FC<MatchDataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentMatch,
  allAvailableTeams = [],
}) => {
  // Helpery do konwersji czasu posiadania
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
      // Jeśli użytkownik wpisze tylko minuty, traktujemy je jako pełne minuty
      const mins = Number(trimmed);
      if (Number.isNaN(mins) || mins < 0) return undefined;
      return mins;
    }

    const [minsStr, secsStr] = trimmed.split(":");
    const mins = Number(minsStr);
    const secs = Number(secsStr);
    if (
      Number.isNaN(mins) ||
      Number.isNaN(secs) ||
      mins < 0 ||
      secs < 0 ||
      secs >= 60
    ) {
      return undefined;
    }
    const totalSeconds = mins * 60 + secs;
    return totalSeconds / 60;
  };

  const formatSeconds = (seconds: number): string => {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const totalSeconds = Math.round(safe);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const buildPossessionSegmentStats = (segments: PossessionSegment[]) => {
    const summarize = (type: PossessionSegmentType) => {
      const rows = segments.filter((segment) => segment.type === type);
      const total = rows.reduce((sum, segment) => sum + Number(segment.durationSec || 0), 0);
      return {
        count: rows.length,
        total,
        avg: rows.length > 0 ? total / rows.length : 0,
      };
    };

    return {
      totalCount: segments.length,
      team: summarize("team"),
      opponent: summarize("opponent"),
      dead: summarize("dead"),
    };
  };

  // Funkcja do pobierania nazwy zespołu
  const getTeamName = (teamId: string) => {
    const team = allAvailableTeams.find(t => t.id === teamId);
    if (team) return team.name;
    const defaultTeam = Object.values(TEAMS).find(t => t.id === teamId);
    return defaultTeam ? defaultTeam.name : teamId;
  };

  const [formData, setFormData] = useState<MatchDataFormData>({
    possession: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
      deadFirstHalf: undefined,
      deadSecondHalf: undefined,
    },
    passes: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
    passesInaccurate: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
    passesInOpponentHalf: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
    passesInOpponentHalfInaccurate: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lokalne wartości tekstowe dla pól czasu posiadania (format MM:SS)
  const [possessionTimeInputs, setPossessionTimeInputs] = useState<{
    teamFirstHalf: string;
    opponentFirstHalf: string;
    teamSecondHalf: string;
    opponentSecondHalf: string;
  }>({
    teamFirstHalf: "",
    opponentFirstHalf: "",
    teamSecondHalf: "",
    opponentSecondHalf: "",
  });

  // Lokalne wartości tekstowe dla czasu martwego (format MM:SS)
  const [deadTimeInputs, setDeadTimeInputs] = useState<{
    deadFirstHalf: string;
    deadSecondHalf: string;
  }>({
    deadFirstHalf: "",
    deadSecondHalf: "",
  });

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    if (currentMatch?.matchData) {
      setFormData({
        possession: {
          teamFirstHalf: currentMatch.matchData.possession?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.possession?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.possession?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.possession?.opponentSecondHalf,
          deadFirstHalf: currentMatch.matchData.possession?.deadFirstHalf,
          deadSecondHalf: currentMatch.matchData.possession?.deadSecondHalf,
        },
        passes: {
          teamFirstHalf: currentMatch.matchData.passes?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passes?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passes?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passes?.opponentSecondHalf,
        },
        passesInaccurate: {
          teamFirstHalf: currentMatch.matchData.passesInaccurate?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passesInaccurate?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passesInaccurate?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passesInaccurate?.opponentSecondHalf,
        },
        passesInOpponentHalf: {
          teamFirstHalf: currentMatch.matchData.passesInOpponentHalf?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passesInOpponentHalf?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passesInOpponentHalf?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passesInOpponentHalf?.opponentSecondHalf,
        },
        passesInOpponentHalfInaccurate: {
          teamFirstHalf: currentMatch.matchData.passesInOpponentHalfInaccurate?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passesInOpponentHalfInaccurate?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passesInOpponentHalfInaccurate?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passesInOpponentHalfInaccurate?.opponentSecondHalf,
        },
      });

      // Zainicjalizuj pola tekstowe czasu posiadania na podstawie istniejących wartości (minuty dziesiętne -> MM:SS)
      setPossessionTimeInputs({
        teamFirstHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.teamFirstHalf),
        opponentFirstHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.opponentFirstHalf),
        teamSecondHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.teamSecondHalf),
        opponentSecondHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.opponentSecondHalf),
      });

      setDeadTimeInputs({
        deadFirstHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.deadFirstHalf),
        deadSecondHalf: minutesDecimalToMMSS(currentMatch.matchData.possession?.deadSecondHalf),
      });
    } else {
      setFormData({
        possession: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
          deadFirstHalf: undefined,
          deadSecondHalf: undefined,
        },
        passes: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
        },
        passesInaccurate: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
        },
        passesInOpponentHalf: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
        },
        passesInOpponentHalfInaccurate: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
        },
      });
      setPossessionTimeInputs({
        teamFirstHalf: "",
        opponentFirstHalf: "",
        teamSecondHalf: "",
        opponentSecondHalf: "",
      });
      setDeadTimeInputs({
        deadFirstHalf: "",
        deadSecondHalf: "",
      });
    }
  }, [currentMatch, isOpen]);

  const handlePossessionTimeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target; // name w formacie "possession.teamFirstHalf"
    const parts = name.split(".");
    const field = parts[1] as keyof typeof possessionTimeInputs | undefined;

    if (!field) return;

    const safeValue = value.toUpperCase();

    // Aktualizuj lokalny tekst (żeby użytkownik widział dokładnie to, co wpisuje)
    setPossessionTimeInputs((prev) => ({
      ...prev,
      [field]: safeValue,
    }));

    // Spróbuj sparsować do minut dziesiętnych i zaktualizować formData
    const minutesDecimal = mmssToMinutesDecimal(safeValue);

    setFormData((prev) => {
      const newData = { ...prev };
      newData.possession = {
        ...newData.possession,
        [field]: minutesDecimal,
      };
      return newData;
    });
  };

  const handleDeadTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; // name: "possession.deadFirstHalf" / "possession.deadSecondHalf"
    const parts = name.split(".");
    const field = parts[1] as keyof typeof deadTimeInputs | undefined;
    if (!field) return;

    const safeValue = value.toUpperCase();
    setDeadTimeInputs((prev) => ({ ...prev, [field]: safeValue }));

    const minutesDecimal = mmssToMinutesDecimal(safeValue);
    setFormData((prev) => {
      const newData = { ...prev };
      newData.possession = {
        ...newData.possession,
        [field]: minutesDecimal,
      };
      return newData;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    const numValue = value === '' ? undefined : Number(value);
    
    // Parsowanie nazwy pola (np. "possession.teamFirstHalf" lub "passes.teamFirstHalf")
    const parts = name.split('.');
    const category = parts[0];
    const field = parts[1]; // np. "teamFirstHalf", "opponentFirstHalf"
    
    setFormData((prev) => {
      const newData = { ...prev };
      
      if (category === 'possession' && field) {
        newData.possession = {
          ...newData.possession,
          [field]: numValue,
        };
      } else if (category === 'passes' && field) {
        newData.passes = {
          ...newData.passes,
          [field]: numValue,
        };
      } else if (category === 'passesInOpponentHalf' && field) {
        newData.passesInOpponentHalf = {
          ...newData.passesInOpponentHalf,
          [field]: numValue,
        };
      } else if (category === 'passesInaccurate' && field) {
        newData.passesInaccurate = {
          ...newData.passesInaccurate,
          [field]: numValue,
        };
      } else if (category === 'passesInOpponentHalfInaccurate' && field) {
        newData.passesInOpponentHalfInaccurate = {
          ...newData.passesInOpponentHalfInaccurate,
          [field]: numValue,
        };
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const matchDataForSave: TeamInfo["matchData"] = {
        ...formData,
        ...(Array.isArray(currentMatch?.matchData?.possessionSegments)
          ? { possessionSegments: currentMatch.matchData.possessionSegments }
          : {}),
      };
      const result = onSave(matchDataForSave);
      
      // Jeśli onSave zwraca Promise, czekamy na jego zakończenie
      if (result instanceof Promise) {
        await result;
      }
      
      // Zamykamy modal tylko jeśli zapis się powiódł
      onClose();
    } catch (error) {
      console.error("Błąd podczas zapisywania danych meczu:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Wystąpił błąd podczas zapisywania danych meczu. Spróbuj ponownie.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPossession = async () => {
    const segmentsCount = currentMatch?.matchData?.possessionSegments?.length ?? 0;
    const ok = window.confirm(
      `Zresetować całe posiadanie dla tego meczu? Usunięte zostaną zapisane czasy i ${segmentsCount} segmentów akcji. Tej operacji nie cofniemy automatycznie.`
    );
    if (!ok) return;

    setError(null);
    setIsSaving(true);

    const resetMatchData: TeamInfo["matchData"] = {
      ...(currentMatch?.matchData || {}),
      possession: {
        teamFirstHalf: 0,
        opponentFirstHalf: 0,
        teamSecondHalf: 0,
        opponentSecondHalf: 0,
        deadFirstHalf: 0,
        deadSecondHalf: 0,
      },
      possessionSegments: [],
    };

    try {
      const result = onSave(resetMatchData);
      if (result instanceof Promise) {
        await result;
      }

      setFormData((prev) => ({
        ...prev,
        possession: resetMatchData.possession,
        possessionSegments: [],
      }));
      setPossessionTimeInputs({
        teamFirstHalf: "00:00",
        opponentFirstHalf: "00:00",
        teamSecondHalf: "00:00",
        opponentSecondHalf: "00:00",
      });
      setDeadTimeInputs({
        deadFirstHalf: "00:00",
        deadSecondHalf: "00:00",
      });
    } catch (error) {
      console.error("Błąd podczas resetowania posiadania:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : "Wystąpił błąd podczas resetowania posiadania. Spróbuj ponownie.";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const teamName = currentMatch?.team ? getTeamName(currentMatch.team) : 'Nasz zespół';
  const opponentName = currentMatch?.opponent || 'Przeciwnik';
  const possessionSegments = currentMatch?.matchData?.possessionSegments || [];
  const possessionSegmentStats = buildPossessionSegmentStats(possessionSegments);

  return (
    <div className={styles.modal} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="match-data-modal-title">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 id="match-data-modal-title">Dane meczu</h2>
        <div className={styles.matchInfo}>
          <span className={styles.teamLabel}>{teamName}</span>
          <span className={styles.vsLabel}>vs</span>
          <span className={styles.teamLabel}>{opponentName}</span>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.dataTable}>
            <div className={styles.tableHeader}>
              <div className={styles.headerCell}>Kategoria</div>
              <div className={styles.headerCell}>{teamName} 1p</div>
              <div className={styles.headerCell}>{opponentName} 1p</div>
              <div className={styles.headerCell}>{teamName} 2p</div>
              <div className={styles.headerCell}>{opponentName} 2p</div>
            </div>
            
            {/* Czas posiadania */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Czas posiadania (min)</div>
              <input
                className={styles.tableInput}
                name="possession.teamFirstHalf"
                type="text"
                value={possessionTimeInputs.teamFirstHalf}
                onChange={handlePossessionTimeChange}
                placeholder="MM:SS"
              />
              <input
                className={styles.tableInput}
                name="possession.opponentFirstHalf"
                type="text"
                value={possessionTimeInputs.opponentFirstHalf}
                onChange={handlePossessionTimeChange}
                placeholder="MM:SS"
              />
              <input
                className={styles.tableInput}
                name="possession.teamSecondHalf"
                type="text"
                value={possessionTimeInputs.teamSecondHalf}
                onChange={handlePossessionTimeChange}
                placeholder="MM:SS"
              />
              <input
                className={styles.tableInput}
                name="possession.opponentSecondHalf"
                type="text"
                value={possessionTimeInputs.opponentSecondHalf}
                onChange={handlePossessionTimeChange}
                placeholder="MM:SS"
              />
            </div>

            {/* Czas martwy */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Czas martwy (min)</div>
              <input
                className={styles.tableInput}
                name="possession.deadFirstHalf"
                type="text"
                value={deadTimeInputs.deadFirstHalf}
                onChange={handleDeadTimeChange}
                placeholder="MM:SS"
              />
              <input
                className={styles.tableInput}
                type="text"
                value="-"
                disabled
                aria-disabled="true"
                title="Czas martwy nie jest przypisany do zespołu"
              />
              <input
                className={styles.tableInput}
                name="possession.deadSecondHalf"
                type="text"
                value={deadTimeInputs.deadSecondHalf}
                onChange={handleDeadTimeChange}
                placeholder="MM:SS"
              />
              <input
                className={styles.tableInput}
                type="text"
                value="-"
                disabled
                aria-disabled="true"
                title="Czas martwy nie jest przypisany do zespołu"
              />
            </div>

            <div className={styles.possessionSegmentsSummary}>
              <div className={styles.possessionSegmentsHeader}>
                <div>
                  <h3 className={styles.possessionSegmentsTitle}>Zapisane akcje posiadania</h3>
                  <p className={styles.possessionSegmentsLead}>
                    Te segmenty zostaną wyczyszczone przy resecie całego posiadania.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.resetPossessionButton}
                  onClick={handleResetPossession}
                  disabled={isSaving}
                >
                  Reset posiadania
                </button>
              </div>
              <div className={styles.possessionSegmentsGrid}>
                <div className={styles.possessionSegmentCard}>
                  <span className={styles.possessionSegmentLabel}>{teamName}</span>
                  <strong>{possessionSegmentStats.team.count} akcji</strong>
                  <span>Śr. {formatSeconds(possessionSegmentStats.team.avg)}</span>
                </div>
                <div className={styles.possessionSegmentCard}>
                  <span className={styles.possessionSegmentLabel}>{opponentName}</span>
                  <strong>{possessionSegmentStats.opponent.count} akcji</strong>
                  <span>Śr. {formatSeconds(possessionSegmentStats.opponent.avg)}</span>
                </div>
                <div className={styles.possessionSegmentCard}>
                  <span className={styles.possessionSegmentLabel}>Czas martwy</span>
                  <strong>{possessionSegmentStats.dead.count} przerw</strong>
                  <span>Śr. {formatSeconds(possessionSegmentStats.dead.avg)}</span>
                </div>
                <div className={styles.possessionSegmentCard}>
                  <span className={styles.possessionSegmentLabel}>Razem</span>
                  <strong>{possessionSegmentStats.totalCount} segmentów</strong>
                  <span>W 1. i 2. połowie</span>
                </div>
              </div>
            </div>

            {/* Liczba podań celnych na swojej połowie */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Podań celnych na swojej połowie</div>
              <input
                className={styles.tableInput}
                name="passes.teamFirstHalf"
                type="number"
                min="0"
                value={formData.passes?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passes.opponentFirstHalf"
                type="number"
                min="0"
                value={formData.passes?.opponentFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passes.teamSecondHalf"
                type="number"
                min="0"
                value={formData.passes?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passes.opponentSecondHalf"
                type="number"
                min="0"
                value={formData.passes?.opponentSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Liczba podań niecelnych na swojej połowie */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Podań niecelnych na swojej połowie</div>
              <input
                className={styles.tableInput}
                name="passesInaccurate.teamFirstHalf"
                type="number"
                min="0"
                value={formData.passesInaccurate?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInaccurate.opponentFirstHalf"
                type="number"
                min="0"
                value={formData.passesInaccurate?.opponentFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInaccurate.teamSecondHalf"
                type="number"
                min="0"
                value={formData.passesInaccurate?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInaccurate.opponentSecondHalf"
                type="number"
                min="0"
                value={formData.passesInaccurate?.opponentSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Podań celnych na połowie przeciwnika */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Podań celnych na połowie przeciwnika</div>
              <input
                className={styles.tableInput}
                name="passesInOpponentHalf.teamFirstHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalf?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalf.opponentFirstHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalf?.opponentFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalf.teamSecondHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalf?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalf.opponentSecondHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalf?.opponentSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            {/* Podań niecelnych na połowie przeciwnika */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Podań niecelnych na połowie przeciwnika</div>
              <input
                className={styles.tableInput}
                name="passesInOpponentHalfInaccurate.teamFirstHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalfInaccurate?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalfInaccurate.opponentFirstHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalfInaccurate?.opponentFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalfInaccurate.teamSecondHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalfInaccurate?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="passesInOpponentHalfInaccurate.opponentSecondHalf"
                type="number"
                min="0"
                value={formData.passesInOpponentHalfInaccurate?.opponentSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving}
            >
              Anuluj
            </button>
            <button 
              type="submit" 
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchDataModal;

