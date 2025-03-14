// src/components/MatchInfoModal/MatchInfoModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import styles from "./MatchInfoModal.module.css";

interface MatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (info: TeamInfo) => void;
  currentInfo: TeamInfo | null;
}

const MatchInfoModal: React.FC<MatchInfoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentInfo,
}) => {
  const teamOptions = ["Rezerwy", "U19", "U17", "U16", "U15"];

  const [matchId, setMatchId] = useState("");
  const [team, setTeam] = useState(teamOptions[0]);
  const [opponent, setOpponent] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [competition, setCompetition] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("12:00");

  // Resetowanie formularza gdy komponent jest otwierany/zamykany
  useEffect(() => {
    if (isOpen) {
      setMatchId(currentInfo?.matchId || "");
      setTeam(currentInfo?.team || teamOptions[0]);
      setOpponent(currentInfo?.opponent || "");
      setIsHome(currentInfo?.isHome ?? true);
      setCompetition(currentInfo?.competition || "");
      setDate(currentInfo?.date || new Date().toISOString().split("T")[0]);
      setTime(currentInfo?.time || "12:00");
    }
  }, [isOpen, currentInfo, teamOptions]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent.trim()) {
      alert("Podaj nazwę przeciwnika");
      return;
    }
    if (!competition.trim()) {
      alert("Podaj nazwę rozgrywek");
      return;
    }

    // Generujemy nowe ID, jeśli nie istnieje (tylko dla nowych meczów)
    const newMatchId = matchId || crypto.randomUUID();

    onSave({
      matchId: newMatchId,
      team,
      opponent,
      isHome,
      competition,
      date,
      time,
    });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>
          {currentInfo
            ? "Edytuj informacje o meczu"
            : "Dodaj informacje o meczu"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="team">Zespół:</label>
            <select
              id="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              required
            >
              {teamOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="opponent">Przeciwnik:</label>
            <input
              type="text"
              id="opponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Lokalizacja:</label>
            <div className={styles.locationToggle}>
              <button
                type="button"
                className={`${styles.locationButton} ${
                  isHome ? styles.locationActive : ""
                }`}
                onClick={() => setIsHome(true)}
              >
                Dom
              </button>
              <button
                type="button"
                className={`${styles.locationButton} ${
                  !isHome ? styles.locationActive : ""
                }`}
                onClick={() => setIsHome(false)}
              >
                Wyjazd
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="competition">Rozgrywki:</label>
            <input
              type="text"
              id="competition"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="date">Data:</label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="time">Godzina:</label>
              <input
                type="time"
                id="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.modalButtons}>
            <button type="submit" className={styles.saveButton}>
              {currentInfo ? "Zapisz zmiany" : "Dodaj mecz"}
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

export default MatchInfoModal;
