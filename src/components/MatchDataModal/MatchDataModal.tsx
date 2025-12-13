// src/components/MatchDataModal/MatchDataModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import styles from "./MatchDataModal.module.css";

interface MatchDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchData: TeamInfo['matchData']) => void;
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
    passesInOpponentHalf: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
    successful8sActions: {
      teamFirstHalf: undefined,
      opponentFirstHalf: undefined,
      teamSecondHalf: undefined,
      opponentSecondHalf: undefined,
    },
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
        },
        passes: {
          teamFirstHalf: currentMatch.matchData.passes?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passes?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passes?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passes?.opponentSecondHalf,
        },
        passesInOpponentHalf: {
          teamFirstHalf: currentMatch.matchData.passesInOpponentHalf?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.passesInOpponentHalf?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.passesInOpponentHalf?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.passesInOpponentHalf?.opponentSecondHalf,
        },
        successful8sActions: {
          teamFirstHalf: currentMatch.matchData.successful8sActions?.teamFirstHalf,
          opponentFirstHalf: currentMatch.matchData.successful8sActions?.opponentFirstHalf,
          teamSecondHalf: currentMatch.matchData.successful8sActions?.teamSecondHalf,
          opponentSecondHalf: currentMatch.matchData.successful8sActions?.opponentSecondHalf,
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
        passesInOpponentHalf: {
          teamFirstHalf: undefined,
          opponentFirstHalf: undefined,
          teamSecondHalf: undefined,
          opponentSecondHalf: undefined,
        },
        successful8sActions: {
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
      } else if (category === 'successful8sActions' && field) {
        newData.successful8sActions = {
          ...newData.successful8sActions,
          [field]: numValue,
        };
      }
      
      return newData;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
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

            {/* Liczba podań */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Liczba podań na swojej połowie</div>
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

            {/* Podań na połowie przeciwnika */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Podań na połowie przeciwnika</div>
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

            {/* Skuteczne akcje 8s ACC */}
            <div className={styles.tableRow}>
              <div className={styles.rowLabel}>Skuteczne akcje 8s ACC</div>
              <input
                className={styles.tableInput}
                name="successful8sActions.teamFirstHalf"
                type="number"
                min="0"
                value={formData.successful8sActions?.teamFirstHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <div className={styles.emptyCell}></div>
              <input
                className={styles.tableInput}
                name="successful8sActions.teamSecondHalf"
                type="number"
                min="0"
                value={formData.successful8sActions?.teamSecondHalf || ''}
                onChange={handleChange}
                placeholder="0"
              />
              <div className={styles.emptyCell}></div>
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Anuluj
            </button>
            <button type="submit" className={styles.saveButton}>
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchDataModal;

