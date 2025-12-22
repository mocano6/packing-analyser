// src/components/MatchInfoModal/MatchInfoModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import { Team } from "@/constants/teamsLoader";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import OpponentLogoInput from "@/components/OpponentLogoInput/OpponentLogoInput";
import VideoUploadInput from "@/components/VideoUploadInput/VideoUploadInput";
import styles from "./MatchInfoModal.module.css";

interface MatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchInfo: TeamInfo) => void;
  currentInfo: TeamInfo | null;
  availableTeams?: Team[];
  selectedTeam?: string; // Dodany prop
}

const getDefaultMatchInfo = (availableTeams?: Team[], selectedTeam?: string): TeamInfo => ({
  team: selectedTeam || (availableTeams && availableTeams.length > 0 ? availableTeams[0].id : TEAMS.REZERWY.id),
  opponent: "",
  competition: "",
  date: new Date().toISOString().split("T")[0],
  isHome: true,
  videoUrl: "",
});

const MatchInfoModal: React.FC<MatchInfoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentInfo,
  availableTeams,
  selectedTeam,
}) => {
  const [formData, setFormData] = useState<TeamInfo>(
    currentInfo || getDefaultMatchInfo(availableTeams, selectedTeam)
  );

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    setFormData(currentInfo || getDefaultMatchInfo(availableTeams, selectedTeam));
  }, [currentInfo, isOpen, availableTeams, selectedTeam]);

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
    
    // Zachowujemy ID meczu jeśli istnieje
    if (currentInfo?.matchId) {
      infoToSave.matchId = currentInfo.matchId;
    }
    
    // Usuwamy pole time z danych przed zapisaniem
    if ('time' in infoToSave) {
      delete infoToSave.time;
    }
    
    // Zapamiętaj ID zespołu przed zapisem
    const teamId = infoToSave.team;
    
    // Wywołujemy funkcję zapisu
    try {
      // Blokuj przycisk zapisu i pokaż wskaźnik ładowania
      (document.querySelector('button[type="submit"]') as HTMLButtonElement)?.setAttribute('disabled', 'true');
      
      // Dodaj klasę wskazującą na trwający zapis
      const modalContent = document.querySelector(`.${styles.modalContent}`) as HTMLElement;
      if (modalContent) {
        modalContent.classList.add(styles.savingInProgress);
      }
      
      // Wywołaj funkcję zapisu
      onSave(infoToSave);
      
      // Zamykamy modal
      onClose();
      
      // Lepsze rozwiązanie: Użyj hash URL do wymuszenia odświeżenia listy meczów
      // To pozwala na odświeżenie listy bez pełnego przeładowania strony
      window.location.hash = `refresh=${teamId}`;
      
    } catch (error) {
      console.error("Błąd podczas zapisywania meczu:", error);
      alert("Wystąpił błąd podczas zapisywania meczu. Spróbuj ponownie.");
      
      // Odblokuj przycisk zapisu w przypadku błędu
      (document.querySelector('button[type="submit"]') as HTMLButtonElement)?.removeAttribute('disabled');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>{currentInfo ? "Edytuj mecz" : "Dodaj nowy mecz"}</h2>
        <form onSubmit={handleSubmit}>
          {/* Sekcja podstawowych informacji */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Podstawowe informacje</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="team">Zespół:</label>
              <TeamsSelector
                selectedTeam={formData.team}
                onChange={(teamId) => 
                  setFormData(prev => ({ ...prev, team: teamId }))
                }
                availableTeams={availableTeams}
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
                placeholder="Nazwa przeciwnika"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Logo przeciwnika (opcjonalne):</label>
              <OpponentLogoInput
                value={formData.opponentLogo}
                onChange={(logoUrl) => setFormData(prev => ({ ...prev, opponentLogo: logoUrl }))}
                onRemove={() => setFormData(prev => ({ ...prev, opponentLogo: undefined }))}
              />
            </div>
          </div>

          {/* Sekcja szczegółów meczu */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Szczegóły meczu</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="competition">Rozgrywki:</label>
              <input
                id="competition"
                name="competition"
                type="text"
                value={formData.competition}
                onChange={handleChange}
                placeholder="Nazwa rozgrywek"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="matchType">Typ meczu:</label>
              <select
                id="matchType"
                name="matchType"
                value={formData.matchType || 'liga'}
                onChange={handleChange}
                className={styles.formSelect}
              >
                <option value="liga">Liga</option>
                <option value="puchar">Puchar</option>
                <option value="towarzyski">Towarzyski</option>
              </select>
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
          </div>

          {/* Sekcja wideo */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Wideo (opcjonalne)</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="videoUrl">URL wideo z YouTube:</label>
              <input
                id="videoUrl"
                name="videoUrl"
                type="text"
                value={formData.videoUrl || ""}
                onChange={handleChange}
                placeholder="https://www.youtube.com/watch?v=... lub https://youtu.be/..."
                className={styles.formInput}
              />
              <small className={styles.helpText}>
                Obsługiwane formaty: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
              </small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="videoUpload">Lub wgraj wideo z komputera:</label>
              <VideoUploadInput
                matchId={formData.matchId}
                currentVideoPath={formData.videoStoragePath}
                currentVideoUrl={formData.videoStorageUrl}
                onUploadComplete={(storagePath, storageUrl) => {
                  setFormData(prev => ({
                    ...prev,
                    videoStoragePath: storagePath,
                    videoStorageUrl: storageUrl
                  }));
                }}
                onRemove={() => {
                  setFormData(prev => ({
                    ...prev,
                    videoStoragePath: undefined,
                    videoStorageUrl: undefined
                  }));
                }}
              />
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
              {currentInfo ? "Zapisz zmiany" : "Dodaj mecz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchInfoModal;
