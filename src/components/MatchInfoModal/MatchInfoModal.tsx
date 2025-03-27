// src/components/MatchInfoModal/MatchInfoModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import styles from "./MatchInfoModal.module.css";

interface MatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchInfo: TeamInfo) => void;
  currentInfo: TeamInfo | null;
}

const defaultMatchInfo: TeamInfo = {
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
  // Dodaję konsolę logującą dla debugowania
  console.log("MatchInfoModal otwarty, currentInfo:", currentInfo);

  const [formData, setFormData] = useState<TeamInfo>(
    currentInfo || defaultMatchInfo
  );

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    console.log("MatchInfoModal useEffect, currentInfo:", currentInfo);
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
    
    // Zamiast usuwać pole, przekazujemy wszystkie dane
    onSave(infoToSave);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <h2>{currentInfo ? "Edytuj mecz" : "Dodaj nowy mecz"}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="team">Zespół:</label>
            <TeamsSelector
              selectedTeam={formData.team}
              onChange={(teamId) => 
                setFormData(prev => ({ ...prev, team: teamId }))
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="opponent">Przeciwnik:</label>
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
            <label htmlFor="competition">Rozgrywki:</label>
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
            <label htmlFor="date">Data:</label>
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
            <label className={`${styles.checkboxLabel} ${formData.isHome ? styles.active : ''}`}>
              <input
                type="checkbox"
                name="isHome"
                checked={formData.isHome}
                onChange={() => setFormData({ ...formData, isHome: !formData.isHome })}
              />
              <span>Mecz u siebie</span>
            </label>
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

export default MatchInfoModal;
