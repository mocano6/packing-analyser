// src/components/PlayerModal/PlayerModal.tsx
"use client";
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Player } from "@/types";
import styles from "./PlayerModal.module.css";

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (player: Omit<Player, "id">) => void;
  editingPlayer?: Player;
}

const PlayerModal: React.FC<PlayerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlayer,
}) => {
  // Zmodyfikowane initialFormData z osobnymi polami firstName i lastName
  const initialFormData = useMemo(
    () => ({
      firstName: "",
      lastName: "",
      number: "",
      position: "",
      birthYear: "",
      imageUrl: "",
    }),
    []
  );

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({ ...initialFormData });

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
    if (editingPlayer) {
      // Rozdzielenie imienia i nazwiska z pola name, gdy edytujemy gracza
      const nameParts = editingPlayer.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setFormData({
        firstName,
        lastName,
        number: editingPlayer.number.toString(),
        position: editingPlayer.position,
        birthYear: editingPlayer.birthYear?.toString() || "",
        imageUrl: editingPlayer.imageUrl || "",
      });
    } else {
      setFormData(initialFormData);
    }
  }, [editingPlayer, isOpen, initialFormData]);

  const validateForm = () => {
    const newErrors = { ...initialFormData };
    let isValid = true;

    // Walidacja dla firstName
    if (!formData.firstName.trim()) {
      newErrors.firstName = "Imię jest wymagane";
      isValid = false;
    }

    // Walidacja dla lastName
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Nazwisko jest wymagane";
      isValid = false;
    }

    if (!formData.number.trim()) {
      newErrors.number = "Numer jest wymagany";
      isValid = false;
    } else if (isNaN(Number(formData.number))) {
      newErrors.number = "Numer musi być liczbą";
      isValid = false;
    }

    if (!formData.position) {
      newErrors.position = "Pozycja jest wymagana";
      isValid = false;
    }

    if (formData.birthYear && isNaN(Number(formData.birthYear))) {
      newErrors.birthYear = "Rok urodzenia musi być liczbą";
      isValid = false;
    } else if (formData.birthYear) {
      const year = Number(formData.birthYear);
      const currentYear = new Date().getFullYear();
      if (year < 1950 || year > currentYear) {
        newErrors.birthYear = `Rok musi być między 1950 a ${currentYear}`;
        isValid = false;
      }
    }

    if (formData.imageUrl) {
      try {
        new URL(formData.imageUrl);
      } catch (e) {
        newErrors.imageUrl = "Nieprawidłowy format URL";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave({
        // Łączenie firstName i lastName w pole name
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        number: parseInt(formData.number),
        position: formData.position,
        birthYear: formData.birthYear
          ? parseInt(formData.birthYear)
          : undefined,
        imageUrl: formData.imageUrl.trim() || undefined,
      });
    }
  };

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData({ ...formData, [field]: e.target.value });
    };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          {editingPlayer ? "Edytuj zawodnika" : "Dodaj zawodnika"}
        </h2>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Pole dla imienia */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="firstName">
              Imię:
            </label>
            <input
              id="firstName"
              value={formData.firstName}
              onChange={handleChange("firstName")}
              className={`${styles.input} ${errors.firstName ? styles.error : ""}`}
            />
            {errors.firstName && (
              <span className={styles.errorMessage}>{errors.firstName}</span>
            )}
          </div>

          {/* Pole dla nazwiska */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="lastName">
              Nazwisko:
            </label>
            <input
              id="lastName"
              value={formData.lastName}
              onChange={handleChange("lastName")}
              className={`${styles.input} ${errors.lastName ? styles.error : ""}`}
            />
            {errors.lastName && (
              <span className={styles.errorMessage}>{errors.lastName}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="number">
              Numer:
            </label>
            <input
              id="number"
              value={formData.number}
              onChange={handleChange("number")}
              className={`${styles.input} ${errors.number ? styles.error : ""}`}
            />
            {errors.number && (
              <span className={styles.errorMessage}>{errors.number}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="position">
              Pozycja:
            </label>
            <select
              id="position"
              value={formData.position}
              onChange={handleChange("position")}
              className={`${styles.input} ${
                errors.position ? styles.error : ""
              }`}
            >
              <option value="">Wybierz pozycję</option>
              {positions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
            {errors.position && (
              <span className={styles.errorMessage}>{errors.position}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="birthYear">
              Rok urodzenia:
            </label>
            <input
              type="number"
              id="birthYear"
              placeholder="np. 2008"
              value={formData.birthYear}
              onChange={handleChange("birthYear")}
              className={`${styles.input} ${
                errors.birthYear ? styles.error : ""
              }`}
            />
            {errors.birthYear && (
              <span className={styles.errorMessage}>{errors.birthYear}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="imageUrl">
              URL obrazu (opcjonalnie):
            </label>
            <input
              type="text"
              id="imageUrl"
              placeholder="https://przykład.com/obraz.jpg"
              value={formData.imageUrl}
              onChange={handleChange("imageUrl")}
              className={`${styles.input} ${
                errors.imageUrl ? styles.error : ""
              }`}
            />
            {errors.imageUrl && (
              <span className={styles.errorMessage}>{errors.imageUrl}</span>
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.button} ${styles.cancelButton}`}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.saveButton}`}
            >
              Zapisz
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerModal;
