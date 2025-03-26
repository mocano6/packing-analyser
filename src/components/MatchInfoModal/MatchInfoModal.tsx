// src/components/MatchInfoModal/MatchInfoModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import styles from "./MatchInfoModal.module.css";

interface MatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchInfo: TeamInfo) => void;
  currentInfo: TeamInfo | null;
}

const defaultMatchInfo: TeamInfo = {
  matchId: "", // Zostanie wygenerowane przy zapisie
  team: "Rezerwy",
  opponent: "",
  competition: "",
  date: new Date().toISOString().split("T")[0],
  isHome: true,
};

const MatchInfoModal: React.FC<MatchInfoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentInfo,
}) => {
  const [formData, setFormData] = useState<TeamInfo>(
    currentInfo || defaultMatchInfo
  );

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    setFormData(currentInfo || defaultMatchInfo);
  }, [currentInfo, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const target = e.target as HTMLInputElement;
      setFormData((prev) => ({
        ...prev,
        [name]: target.checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Kopiujemy obiekt, aby uniknąć modyfikacji oryginalnego obiektu
    const infoToSave = { ...formData };
    
    // Jeśli to nowy mecz, usuwamy puste ID
    if (!infoToSave.matchId) {
      delete infoToSave.matchId; // ID zostanie wygenerowane w useMatchInfo
    }
    
    onSave(infoToSave);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <h2>{currentInfo ? "Edit Match" : "Add New Match"}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="team">Team:</label>
            <select
              id="team"
              name="team"
              value={formData.team}
              onChange={handleChange}
              required
            >
              <option value="Rezerwy">Rezerwy</option>
              <option value="U19">U19</option>
              <option value="U17">U17</option>
              <option value="U16">U16</option>
              <option value="U15">U15</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="opponent">Opponent:</label>
            <input
              id="opponent"
              name="opponent"
              type="text"
              value={formData.opponent}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="competition">Competition:</label>
            <input
              id="competition"
              name="competition"
              type="text"
              value={formData.competition}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="date">Date:</label>
            <input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isHome"
                checked={formData.isHome}
                onChange={handleChange}
              />
              Home Match
            </label>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.saveButton}>
              Save
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchInfoModal;
