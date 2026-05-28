// src/components/MatchInfoModal/MatchInfoModal.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { TeamInfo } from "@/types";
import { TEAMS } from "@/constants/teams";
import { Team } from "@/constants/teamsLoader";
import TeamsSelector from "@/components/TeamsSelector/TeamsSelector";
import OpponentLogoInput from "@/components/OpponentLogoInput/OpponentLogoInput";
import VideoUploadInput from "@/components/VideoUploadInput/VideoUploadInput";
import styles from "./MatchInfoModal.module.css";
import { filterTeamsByUserAccess, type UserTeamAccess } from "@/lib/teamsForUserAccess";
import {
  formatHalfSecondsDisplay,
  halfSecondsFromRaw,
  sanitizeHalfSecondsRaw,
} from "@/utils/matchInfoHalfTimeInput";
import {
  findSuggestedOpponentLogoFromMatches,
  normalizeOpponentNameForLogoLookup,
} from "@/utils/findSuggestedOpponentLogoFromMatches";

interface MatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (matchInfo: TeamInfo) => void;
  currentInfo: TeamInfo | null;
  /** Pełny katalog zespołów; dostęp ogranicza userTeamAccess. */
  teamsCatalog: Team[];
  userTeamAccess: UserTeamAccess;
  selectedTeam?: string;
  /** Istniejące meczu (np. z cache / Firebase) — do podpowiedzi logo przeciwnika po nazwie. */
  matchesForOpponentLogoLookup?: TeamInfo[];
}

const getDefaultMatchInfo = (teamsCatalog: Team[], userTeamAccess: UserTeamAccess, selectedTeam?: string): TeamInfo => {
  const allowed = filterTeamsByUserAccess(teamsCatalog, userTeamAccess);
  const st = typeof selectedTeam === "string" ? selectedTeam.trim() : "";
  if (st && allowed.some((t) => t.id === st)) {
    return {
      team: st,
      opponent: "",
      competition: "",
      date: new Date().toISOString().split("T")[0],
      isHome: true,
      videoUrl: "",
    };
  }
  if (typeof window !== "undefined") {
    const ls = localStorage.getItem("selectedTeam")?.trim();
    if (ls && allowed.some((t) => t.id === ls)) {
      return {
        team: ls,
        opponent: "",
        competition: "",
        date: new Date().toISOString().split("T")[0],
        isHome: true,
        videoUrl: "",
      };
    }
  }
  if (allowed.length > 0) {
    return {
      team: allowed[0].id,
      opponent: "",
      competition: "",
      date: new Date().toISOString().split("T")[0],
      isHome: true,
      videoUrl: "",
    };
  }
  return {
    team: TEAMS.REZERWY.id,
    opponent: "",
    competition: "",
    date: new Date().toISOString().split("T")[0],
    isHome: true,
    videoUrl: "",
  };
};

// Funkcje pomocnicze do konwersji sekund na minuty i sekundy (poza komponentem, żeby były dostępne w useState)
const secondsToMinutesAndSeconds = (seconds?: number | null): { minutes: number; seconds: number } => {
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return { minutes: 0, seconds: 0 };
  }
  const total = Math.max(0, Math.floor(Number(seconds)));
  return {
    minutes: Math.floor(total / 60),
    seconds: total % 60,
  };
};

const minutesAndSecondsToSeconds = (minutes: number, seconds: number): number => {
  return minutes * 60 + seconds;
};

const MatchInfoModal: React.FC<MatchInfoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentInfo,
  teamsCatalog,
  userTeamAccess,
  selectedTeam,
  matchesForOpponentLogoLookup,
}) => {
  const [formData, setFormData] = useState<TeamInfo>(
    currentInfo || getDefaultMatchInfo(teamsCatalog, userTeamAccess, selectedTeam)
  );

  /** Po „Usuń logo” nie wstawiamy ponownie automatycznie, dopóki nazwa się nie zmieni lub użytkownik nie kliknie przycisku. */
  const [dismissedLogoForNormalizedOpponent, setDismissedLogoForNormalizedOpponent] = useState<string | null>(
    null
  );

  const normalizedOpponentKey = useMemo(
    () => normalizeOpponentNameForLogoLookup(formData.opponent ?? ""),
    [formData.opponent]
  );

  const suggestedLogoFromExistingMatches = useMemo(() => {
    if (!matchesForOpponentLogoLookup?.length || !formData.team || !normalizedOpponentKey) {
      return undefined;
    }
    return findSuggestedOpponentLogoFromMatches(
      matchesForOpponentLogoLookup,
      formData.team,
      formData.opponent ?? "",
      { excludeMatchId: currentInfo?.matchId }
    );
  }, [
    matchesForOpponentLogoLookup,
    formData.team,
    formData.opponent,
    normalizedOpponentKey,
    currentInfo?.matchId,
  ]);

  // Stany dla czasu startu połów: minuty jako liczba, sekundy jako tekst (np. "07"), żeby number input nie ucinał zer
  const [firstHalfTime, setFirstHalfTime] = useState(() => {
    const time = secondsToMinutesAndSeconds(currentInfo?.firstHalfStartTime);
    return { minutes: time.minutes, secondsStr: formatHalfSecondsDisplay(time.seconds) };
  });

  const [secondHalfTime, setSecondHalfTime] = useState(() => {
    const time = secondsToMinutesAndSeconds(currentInfo?.secondHalfStartTime);
    return { minutes: time.minutes, secondsStr: formatHalfSecondsDisplay(time.seconds) };
  });

  // Reset formularza przy otwarciu modalu
  useEffect(() => {
    const newFormData = currentInfo || getDefaultMatchInfo(teamsCatalog, userTeamAccess, selectedTeam);
    setFormData(newFormData);
    
    // Resetuj również czasy połów
    const firstHalf = secondsToMinutesAndSeconds(newFormData.firstHalfStartTime);
    const secondHalf = secondsToMinutesAndSeconds(newFormData.secondHalfStartTime);
    setFirstHalfTime({
      minutes: firstHalf.minutes,
      secondsStr: formatHalfSecondsDisplay(firstHalf.seconds),
    });
    setSecondHalfTime({
      minutes: secondHalf.minutes,
      secondsStr: formatHalfSecondsDisplay(secondHalf.seconds),
    });
  }, [currentInfo, isOpen, teamsCatalog, userTeamAccess, selectedTeam]);

  useEffect(() => {
    if (!isOpen) return;
    setDismissedLogoForNormalizedOpponent(null);
  }, [isOpen, currentInfo?.matchId]);

  useEffect(() => {
    setDismissedLogoForNormalizedOpponent((prev) =>
      prev !== null && prev !== normalizedOpponentKey ? null : prev
    );
  }, [normalizedOpponentKey]);

  useEffect(() => {
    if (!suggestedLogoFromExistingMatches) return;
    if (formData.opponentLogo) return;
    if (dismissedLogoForNormalizedOpponent === normalizedOpponentKey) return;
    setFormData((prev) => ({ ...prev, opponentLogo: suggestedLogoFromExistingMatches }));
  }, [
    suggestedLogoFromExistingMatches,
    formData.opponentLogo,
    dismissedLogoForNormalizedOpponent,
    normalizedOpponentKey,
  ]);

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
    
    // Konwertuj minuty i sekundy na sekundy dla czasu startu połów
    const firstHalfSeconds = minutesAndSecondsToSeconds(
      firstHalfTime.minutes,
      halfSecondsFromRaw(firstHalfTime.secondsStr)
    );
    const secondHalfSeconds = minutesAndSecondsToSeconds(
      secondHalfTime.minutes,
      halfSecondsFromRaw(secondHalfTime.secondsStr)
    );

    if (firstHalfSeconds > 0) {
      infoToSave.firstHalfStartTime = firstHalfSeconds;
    } else {
      delete infoToSave.firstHalfStartTime;
    }

    if (secondHalfSeconds > 0) {
      infoToSave.secondHalfStartTime = secondHalfSeconds;
    } else {
      delete infoToSave.secondHalfStartTime;
    }
    
    // Zachowujemy ID meczu jeśli istnieje
    if (currentInfo?.matchId) {
      infoToSave.matchId = currentInfo.matchId;
    }
    
    // Usuwamy pole time z danych przed zapisaniem
    if ('time' in infoToSave) {
      delete infoToSave.time;
    }
    
    // Usuwamy wszystkie pola z wartością undefined (Firebase nie akceptuje undefined)
    Object.keys(infoToSave).forEach(key => {
      if (infoToSave[key as keyof TeamInfo] === undefined) {
        delete infoToSave[key as keyof TeamInfo];
      }
    });
    
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
                  setFormData((prev) => ({ ...prev, team: teamId }))
                }
                teamsCatalog={teamsCatalog}
                userTeamAccess={userTeamAccess}
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
                onRemove={() => {
                  setDismissedLogoForNormalizedOpponent(normalizeOpponentNameForLogoLookup(formData.opponent ?? ""));
                  setFormData((prev) => ({ ...prev, opponentLogo: undefined }));
                }}
              />
              {suggestedLogoFromExistingMatches &&
                !formData.opponentLogo &&
                dismissedLogoForNormalizedOpponent === normalizedOpponentKey && (
                  <div className={styles.logoSuggestionRow}>
                    <small className={styles.helpText}>
                      W bazie jest już logo dla tego przeciwnika — możesz je wstawić zamiast wklejać ponownie.
                    </small>
                    <button
                      type="button"
                      className={styles.suggestionButton}
                      onClick={() => {
                        setDismissedLogoForNormalizedOpponent(null);
                        setFormData((prev) => ({
                          ...prev,
                          opponentLogo: suggestedLogoFromExistingMatches,
                        }));
                      }}
                    >
                      Wstaw zapisane logo
                    </button>
                  </div>
                )}
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
              <label className={styles.tooltipTrigger} data-tooltip="Czas startu na nagraniu">Czas startu:</label>
              <div className={styles.halvesTimeContainer}>
                <div className={styles.halfTimeRow}>
                  <span className={styles.halfLabel}>I połowa:</span>
                  <div className={styles.timeInputContainer}>
                    <input
                      id="firstHalfMinutes"
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={firstHalfTime.minutes === 0 ? 0 : (firstHalfTime.minutes || "")}
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                        if (value !== undefined && !isNaN(value)) {
                          setFirstHalfTime(prev => ({ ...prev, minutes: Math.max(0, value) }));
                        } else {
                          setFirstHalfTime(prev => ({ ...prev, minutes: 0 }));
                        }
                      }}
                      placeholder="0"
                      className={styles.timeInput}
                    />
                    <span className={styles.timeSeparator}>:</span>
                    <input
                      id="firstHalfSeconds"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      value={firstHalfTime.secondsStr}
                      onChange={(e) => {
                        const next = sanitizeHalfSecondsRaw(e.target.value);
                        setFirstHalfTime((prev) => ({ ...prev, secondsStr: next }));
                      }}
                      onBlur={() => {
                        setFirstHalfTime((prev) => ({
                          ...prev,
                          secondsStr: formatHalfSecondsDisplay(halfSecondsFromRaw(prev.secondsStr)),
                        }));
                      }}
                      placeholder="00"
                      className={`${styles.timeInput} ${styles.timeInputSeconds}`}
                      aria-label="Sekundy (0–59), pierwsza połowa"
                    />
                  </div>
                </div>
                <div className={styles.halfTimeRow}>
                  <span className={styles.halfLabel}>II połowa:</span>
                  <div className={styles.timeInputContainer}>
                    <input
                      id="secondHalfMinutes"
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={secondHalfTime.minutes === 0 ? 0 : (secondHalfTime.minutes || "")}
                      onChange={(e) => {
                        const value = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                        if (value !== undefined && !isNaN(value)) {
                          setSecondHalfTime(prev => ({ ...prev, minutes: Math.max(0, value) }));
                        } else {
                          setSecondHalfTime(prev => ({ ...prev, minutes: 0 }));
                        }
                      }}
                      placeholder="0"
                      className={styles.timeInput}
                    />
                    <span className={styles.timeSeparator}>:</span>
                    <input
                      id="secondHalfSeconds"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      value={secondHalfTime.secondsStr}
                      onChange={(e) => {
                        const next = sanitizeHalfSecondsRaw(e.target.value);
                        setSecondHalfTime((prev) => ({ ...prev, secondsStr: next }));
                      }}
                      onBlur={() => {
                        setSecondHalfTime((prev) => ({
                          ...prev,
                          secondsStr: formatHalfSecondsDisplay(halfSecondsFromRaw(prev.secondsStr)),
                        }));
                      }}
                      placeholder="00"
                      className={`${styles.timeInput} ${styles.timeInputSeconds}`}
                      aria-label="Sekundy (0–59), druga połowa"
                    />
                  </div>
                </div>
              </div>
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
