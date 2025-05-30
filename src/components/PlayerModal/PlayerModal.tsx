// src/components/PlayerModal/PlayerModal.tsx
"use client";
"use client";

import React, { useState, useEffect } from "react";
import { Player } from "@/types";
import { TEAMS } from "@/constants/teams";
import { Team } from "@/constants/teamsLoader";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import styles from "./PlayerModal.module.css";

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Omit<Player, "id">) => void;
  editingPlayer?: Player;
  currentTeam?: string;
  allTeams: Team[];
  existingPlayers?: Player[]; // Dodaję listę istniejących zawodników
}

const PlayerModal: React.FC<PlayerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlayer,
  currentTeam = TEAMS.REZERWY.id,
  allTeams,
  existingPlayers = [],
}) => {
  const [formData, setFormData] = useState<Omit<Player, "id">>({
    name: "",
    number: 1,
    position: "",
    birthYear: undefined,
    imageUrl: "",
    teams: [currentTeam],
  });

  const [errors, setErrors] = useState<{
    name?: string;
    number?: string;
    general?: string;
  }>({});

  const positions = [
    { value: "GK", label: "Bramkarz (GK)" },
    { value: "CB", label: "Środkowy obrońca (CB)" },
    { value: "LB", label: "Lewy obrońca (LB)" },
    { value: "RB", label: "Prawy obrońca (RB)" },
    { value: "DM", label: "Defensywny pomocnik (DM)" },
    { value: "CM", label: "Środkowy pomocnik (CM)" },
    { value: "AM", label: "Ofensywny pomocnik (AM)" },
    { value: "LW", label: "Lewy skrzydłowy (LW)" },
    { value: "RW", label: "Prawy skrzydłowy (RW)" },
    { value: "ST", label: "Napastnik (ST)" },
  ];

  // Funkcja walidacji duplikatów
  const validateForDuplicates = (playerData: Omit<Player, "id">): string[] => {
    const errors: string[] = [];
    const nameLower = playerData.name.toLowerCase().trim();

    // Sprawdź duplikaty imienia i nazwiska
    const nameExists = existingPlayers.some(player => {
      // Pomijamy aktualnie edytowanego zawodnika
      if (editingPlayer && player.id === editingPlayer.id) {
        return false;
      }
      return player.name.toLowerCase().trim() === nameLower;
    });

    if (nameExists) {
      errors.push("Zawodnik o takim imieniu i nazwisku już istnieje!");
    }

    // Sprawdź duplikaty numeru w tym samym zespole
    const numberExists = existingPlayers.some(player => {
      // Pomijamy aktualnie edytowanego zawodnika
      if (editingPlayer && player.id === editingPlayer.id) {
        return false;
      }
      
      // Sprawdź czy numer jest zajęty w którymkolwiek z zespołów
      const hasCommonTeam = player.teams?.some(team => 
        playerData.teams.includes(team)
      );
      
      return player.number === playerData.number && hasCommonTeam;
    });

    if (numberExists) {
      errors.push(`Numer ${playerData.number} jest już zajęty w tym zespole!`);
    }

    return errors;
  };

  useEffect(() => {
    if (isOpen) {
      if (editingPlayer) {
        setFormData({
          name: editingPlayer.name,
          number: editingPlayer.number,
          position: editingPlayer.position || "",
          birthYear: editingPlayer.birthYear,
          imageUrl: editingPlayer.imageUrl || "",
          teams: editingPlayer.teams || [currentTeam],
        });
      } else {
        setFormData({
          name: "",
          number: 1,
          position: "",
          birthYear: undefined,
          imageUrl: "",
          teams: [currentTeam],
        });
      }
      setErrors({});
    }
  }, [isOpen, editingPlayer, currentTeam]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    let processedValue: any = value;

    if (name === "number") {
      processedValue = parseInt(value) || 1;
    } else if (name === "birthYear") {
      processedValue = value ? parseInt(value) : undefined;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));

    // Czyść błędy związane z tym polem
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof typeof errors];
        return newErrors;
      });
    }
  };

  const handleTeamChange = (teamId: string) => {
    setFormData((prev) => ({
      ...prev,
      teams: [teamId],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Podstawowa walidacja
    const newErrors: typeof errors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Imię i nazwisko są wymagane";
    }
    
    if (formData.number < 1 || formData.number > 99) {
      newErrors.number = "Numer musi być między 1 a 99";
    }

    // Walidacja duplikatów
    const duplicateErrors = validateForDuplicates(formData);
    if (duplicateErrors.length > 0) {
      newErrors.general = duplicateErrors.join(" ");
    }

    setErrors(newErrors);

    // Jeśli są błędy, zatrzymaj submit
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>{editingPlayer ? "Edytuj zawodnika" : "Dodaj zawodnika"}</h2>
        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div className={styles.errorMessage}>
              {errors.general}
            </div>
          )}
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="name">Imię i nazwisko</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={`${styles.formInput} ${errors.name ? styles.inputError : ''}`}
            />
            {errors.name && (
              <div className={styles.fieldError}>{errors.name}</div>
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="number">Numer</label>
            <input
              type="number"
              id="number"
              name="number"
              min="1"
              max="99"
              value={formData.number}
              onChange={handleChange}
              required
              className={`${styles.formInput} ${errors.number ? styles.inputError : ''}`}
            />
            {errors.number && (
              <div className={styles.fieldError}>{errors.number}</div>
            )}
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

          <div className={styles.formTeams}>
            <label>Zespoły:</label>
            <div className={styles.teamsButtonContainer}>
              {allTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={`${styles.teamButton} ${
                    formData.teams.includes(team.id) ? styles.activeTeam : ""
                  }`}
                  onClick={() => handleTeamChange(team.id)}
                >
                  {team.name}
                </button>
              ))}
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

export default PlayerModal;
