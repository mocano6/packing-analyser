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
    firstName: "",
    lastName: "",
    name: "",
    number: 1,
    position: "",
    birthYear: undefined,
    imageUrl: "",
    teams: [],
    isTestPlayer: false,
  });

  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    number?: string;
    general?: string;
  }>({});

  const positions = [
    { value: "GK", label: "Bramkarz (GK)" },
    { value: "CB", label: "Środkowy obrońca (CB)" },
    { value: "DM", label: "Defensywny pomocnik (DM)" },
    { value: "AM", label: "Ofensywny pomocnik (AM)" },
    { value: "LW", label: "Lewy skrzydłowy (LW)" },
    { value: "RW", label: "Prawy skrzydłowy (RW)" },
    { value: "ST", label: "Napastnik (ST)" },
  ];

  // Mapowanie starych pozycji na nowe (dla kompatybilności wstecznej)
  const mapOldPositionToNew = (position: string): string => {
    const mapping: { [key: string]: string } = {
      'LS': 'LW',  // Left Side -> Left Wing
      'RS': 'RW',  // Right Side -> Right Wing
      'CF': 'ST',  // Center Forward -> Striker
      'CAM': 'AM', // Central Attacking Midfielder -> Attacking Midfielder
      'CDM': 'DM', // Central Defensive Midfielder -> Defensive Midfielder
    };
    
    return mapping[position] || position;
  };

  // Funkcja walidacji duplikatów
  const validateForDuplicates = (playerData: Omit<Player, "id">): string[] => {
    const errors: string[] = [];
    const firstNameLower = playerData.firstName.toLowerCase().trim();
    const lastNameLower = playerData.lastName.toLowerCase().trim();

    // Sprawdź duplikaty imienia, nazwiska i roku urodzenia
    const duplicateExists = existingPlayers.some(player => {
      // Pomijamy aktualnie edytowanego zawodnika
      if (editingPlayer && player.id === editingPlayer.id) {
        return false;
      }
      
      // Sprawdź po firstName i lastName lub po starym name (dla kompatybilności)
      let sameNameAndSurname = false;
      
      if (player.firstName && player.lastName) {
        // Nowy format z firstName i lastName
        sameNameAndSurname = 
          player.firstName.toLowerCase().trim() === firstNameLower &&
          player.lastName.toLowerCase().trim() === lastNameLower;
      } else if (player.name) {
        // Stary format z name - porównaj z połączonym firstName lastName
        const fullName = `${playerData.firstName} ${playerData.lastName}`.toLowerCase().trim();
        sameNameAndSurname = player.name.toLowerCase().trim() === fullName;
      }
      
      const sameBirthYear = player.birthYear === playerData.birthYear;
      
      // Duplikat to ten sam zawodnik (imię + nazwisko) z tym samym rokiem urodzenia
      // Jeśli rok nie jest podany u żadnego z zawodników, to sprawdzamy tylko imię i nazwisko
      return sameNameAndSurname && (
        (!player.birthYear && !playerData.birthYear) || 
        sameBirthYear
      );
    });

    if (duplicateExists) {
      const fullName = `${playerData.firstName} ${playerData.lastName}`;
      if (playerData.birthYear) {
        errors.push(`Zawodnik o imieniu ${fullName} urodzony w ${playerData.birthYear} już istnieje!`);
      } else {
        errors.push(`Zawodnik o imieniu ${fullName} już istnieje! Jeśli to inny zawodnik, dodaj rok urodzenia.`);
      }
    }

    return errors;
  };

  useEffect(() => {
    if (isOpen) {
      if (editingPlayer) {
        
        // Obsługa migracji danych - jeśli są firstName i lastName używaj ich, 
        // w przeciwnym razie podziel name na firstName i lastName
        let firstName = editingPlayer.firstName || "";
        let lastName = editingPlayer.lastName || "";
        
        if (!firstName && !lastName && editingPlayer.name) {
          // Migracja starych danych - podziel name na firstName i lastName
          const nameParts = editingPlayer.name.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(" "); // Wszystko po pierwszym słowie to nazwisko
          } else if (nameParts.length === 1) {
            firstName = nameParts[0];
            lastName = "";
          }
        }
        
        const formDataToSet = {
          firstName: firstName,
          lastName: lastName,
          name: editingPlayer.name || `${firstName} ${lastName}`.trim(),
          number: editingPlayer.number,
          position: editingPlayer.position || "", // Używaj pozycji bezpośrednio z Firebase bez mapowania
          birthYear: editingPlayer.birthYear,
          imageUrl: editingPlayer.imageUrl || "",
          teams: Array.isArray(editingPlayer.teams) ? editingPlayer.teams : (editingPlayer.teams ? [editingPlayer.teams] : [currentTeam]),
          isTestPlayer: editingPlayer.isTestPlayer,
        };
        

        setFormData(formDataToSet);
      } else {
        setFormData({
          firstName: "",
          lastName: "",
          name: "",
          number: 1,
          position: "",
          birthYear: undefined,
          imageUrl: "",
          teams: [currentTeam],
          isTestPlayer: false,
        });
      }
      setErrors({});
    }
  }, [isOpen, editingPlayer, currentTeam]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;

    if (type === "checkbox") {
      const target = e.target as HTMLInputElement;
      processedValue = target.checked;
    } else if (name === "number") {
      processedValue = parseInt(value) || 1;
    } else if (name === "birthYear") {
      processedValue = value ? parseInt(value) : undefined;
    }

    const updatedFormData = {
      ...formData,
      [name]: processedValue,
    };

    // Jeśli zmieniono firstName lub lastName, zaktualizuj też pole name
    if (name === "firstName" || name === "lastName") {
      const firstName = name === "firstName" ? processedValue : formData.firstName;
      const lastName = name === "lastName" ? processedValue : formData.lastName;
      updatedFormData.name = `${firstName.trim()} ${lastName.trim()}`.trim();
    }

    setFormData(updatedFormData);

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
    setFormData((prev) => {
      const currentTeams = prev.teams || [];
      
      if (currentTeams.includes(teamId)) {
        // Jeśli zespół jest już wybrany, usuń go
        return {
          ...prev,
          teams: currentTeams.filter(id => id !== teamId),
        };
      } else {
        // Jeśli zespół nie jest wybrany, dodaj go
        return {
          ...prev,
          teams: [...currentTeams, teamId],
        };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Podstawowa walidacja
    const newErrors: typeof errors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = "Imię jest wymagane";
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Nazwisko jest wymagane";
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

    // Ustaw pole name z firstName i lastName dla kompatybilności
    const playerDataToSave = {
      ...formData,
      name: `${formData.firstName.trim()} ${formData.lastName.trim()}`
    };



    onSave(playerDataToSave);
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
            <label className={styles.formLabel} htmlFor="firstName">Imię</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className={`${styles.formInput} ${errors.firstName ? styles.inputError : ''}`}
            />
            {errors.firstName && (
              <div className={styles.fieldError}>{errors.firstName}</div>
            )}
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
              className={`${styles.formInput} ${errors.lastName ? styles.inputError : ''}`}
            />
            {errors.lastName && (
              <div className={styles.fieldError}>{errors.lastName}</div>
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
            <label className={styles.formLabel}>
              <input
                type="checkbox"
                name="isTestPlayer"
                checked={formData.isTestPlayer || false}
                onChange={handleChange}
                className={styles.checkbox}
              />
              Zawodnik testowany
            </label>
          </div>

          <div className={styles.formTeams}>
            <label>Zespoły (można wybrać wiele):</label>
            <div className={styles.teamsButtonContainer}>
              {allTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={`${styles.teamButton} ${
                    (formData.teams && Array.isArray(formData.teams) && formData.teams.includes(team.id)) ? styles.activeTeam : ""
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
