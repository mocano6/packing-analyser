// src/components/MatchDataModal/MatchDataModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import styles from "./MatchDataModal.module.css";

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
  // Funkcja do pobierania nazwy zespołu
  const getTeamName = (teamId: string) => {
    const team = allAvailableTeams.find(t => t.id === teamId);
    if (team) return team.name;
    const defaultTeam = Object.values(TEAMS).find(t => t.id === teamId);
    return defaultTeam ? defaultTeam.name : teamId;
  };

  const [formData, setFormData] = useState<TeamInfo['matchData']>({
    possession: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
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

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    if (currentMatch?.matchData) {
      setFormData({
        possession: {
          teamFirstHalf: currentMatch.matchData.possession?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.possession?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.possession?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.possession?.opponentSecondHalf,
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
    } else {
      setFormData({
        possession: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
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
    }
  }, [currentMatch, isOpen]);

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
      const result = onSave(formData);
      
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

  if (!isOpen) {
    return null;
  }

  const teamName = currentMatch?.team ? getTeamName(currentMatch.team) : 'Nasz zespół';
  const opponentName = currentMatch?.opponent || 'Przeciwnik';

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
                type="number"
                min="0"
                step="0.1"
                value={formData.possession?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="possession.opponentFirstHalf"
                type="number"
                min="0"
                step="0.1"
                value={formData.possession?.opponentFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="possession.teamSecondHalf"
                type="number"
                min="0"
                step="0.1"
                value={formData.possession?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <input
                className={styles.tableInput}
                name="possession.opponentSecondHalf"
                type="number"
                min="0"
                step="0.1"
                value={formData.possession?.opponentSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
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

