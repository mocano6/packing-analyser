// src/components/PlayerModal/PlayerModal.tsx
"use client";
"use client";

import React, { useState, useEffect } from "react";
import { Player, PlayerModalProps } from "@/types";
import styles from "./PlayerModal.module.css";

const PlayerModal: React.FC<PlayerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlayer,
  currentTeam,
  allTeams,
}) => {
  const [formData, setFormData] = useState<Omit<Player, "id"> & { firstName: string; lastName: string }>({
    name: "",
    firstName: "",
    lastName: "",
    number: 0,
    position: "",
    birthYear: undefined,
    imageUrl: "",
    teams: [],
  });

  const positions = [
    { value: "GK", label: "Bramkarz (GK)" },
    { value: "CB", label: "Środkowy obrońca (CB)" },
    { value: "DM", label: "Defensywny pomocnik (DM)" },
    { value: "AM", label: "Ofensywny pomocnik (AM)" },
    { value: "RS", label: "Prawy skrzydłowy (RW)" },
    { value: "LS", label: "Lewy skrzydłowy (LW)" },
    { value: "ST", label: "Napastnik (ST)" },
  ];

  useEffect(() => {
    // Ustaw formularz z danymi edytowanego zawodnika lub wyczyść formularz
    if (editingPlayer) {
      // Rozbicie imienia i nazwiska
      const nameParts = editingPlayer.name.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      setFormData({
        name: editingPlayer.name,
        firstName: firstName,
        lastName: lastName,
        number: editingPlayer.number,
        position: editingPlayer.position,
        birthYear: editingPlayer.birthYear,
        imageUrl: editingPlayer.imageUrl || "",
        teams: editingPlayer.teams || [],
      });
    } else {
      // Dla nowego zawodnika, automatycznie dodaj aktualnie wybrany zespół
      const initialTeams = currentTeam ? [currentTeam] : [];
      
      setFormData({
        name: "",
        firstName: "",
        lastName: "",
        number: 0,
        position: "",
        birthYear: undefined,
        imageUrl: "",
        teams: initialTeams,
      });
    }
  }, [editingPlayer, isOpen, currentTeam]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // Jeśli zmieniamy imię lub nazwisko, aktualizujemy też pole name
      if (name === "firstName" || name === "lastName") {
        const newFirstName = name === "firstName" ? value : prev.firstName;
        const newLastName = name === "lastName" ? value : prev.lastName;
        const fullName = `${newFirstName} ${newLastName}`.trim();
        
        return {
          ...prev,
          [name]: value,
          name: fullName
        };
      }
      
      return {
        ...prev,
        [name]: name === "number" || name === "birthYear" ? Number(value) : value,
      };
    });
  };

  const handleTeamToggle = (teamId: string) => {
    setFormData((prev) => {
      const teams = [...prev.teams];
      
      if (teams.includes(teamId)) {
        // Usuń zespół, jeśli jest już na liście
        return {
          ...prev,
          teams: teams.filter(id => id !== teamId),
        };
      } else {
        // Dodaj zespół do listy
        return {
          ...prev,
          teams: [...teams, teamId],
        };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Przekazujemy dane bez pól firstName i lastName
    const { firstName, lastName, ...playerData } = formData;
    onSave(playerData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>{editingPlayer ? "Edytuj zawodnika" : "Dodaj zawodnika"}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="firstName">Imię</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="lastName">Nazwisko</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="number">Numer</label>
            <input
              type="number"
              id="number"
              name="number"
              value={formData.number}
              onChange={handleChange}
              required
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="position">Pozycja</label>
            <select
              id="position"
              name="position"
              value={formData.position}
              onChange={handleChange}
              required
              className={styles.formSelect}
            >
              <option value="">Wybierz pozycję</option>
              {positions.map(pos => (
                <option key={pos.value} value={pos.value}>{pos.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="birthYear">Rok urodzenia</label>
            <input
              type="number"
              id="birthYear"
              name="birthYear"
              value={formData.birthYear || ""}
              onChange={handleChange}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="imageUrl">URL zdjęcia</label>
            <input
              type="text"
              id="imageUrl"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className={styles.formInput}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Zespoły</label>
            <div className={styles.teamsButtons}>
              {allTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={`${styles.teamButton} ${formData.teams.includes(team.id) ? styles.active : ''}`}
                  onClick={() => handleTeamToggle(team.id)}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.saveButton}>
              Zapisz
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerModal;
