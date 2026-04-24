"use client";

import React, { useMemo } from "react";
import { Team } from "@/constants/teamsLoader";
import styles from "./TeamsSelector.module.css";
import { usePresentationMode } from "@/contexts/PresentationContext";
import {
  filterTeamsByUserAccess,
  isTeamIdAccessibleForUser,
  type UserTeamAccess,
} from "@/lib/teamsForUserAccess";

export interface TeamsSelectorProps {
  selectedTeam: string;
  onChange: (teamId: string) => void;
  /** Pełny katalog zespołów (np. z Firebase); podlega filtrowi wg uprawnień. */
  teamsCatalog: Team[];
  userTeamAccess: UserTeamAccess;
  className?: string;
  showLabel?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

const TeamsSelector: React.FC<TeamsSelectorProps> = ({
  selectedTeam,
  onChange,
  teamsCatalog,
  userTeamAccess,
  className = "",
  showLabel = false,
  isExpanded = false,
  onToggle,
}) => {
  const { isPresentationMode } = usePresentationMode();

  const getTeamInitials = (name: string): string => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return "?";
    if (/^u\d+/i.test(trimmed)) return trimmed.toUpperCase(); // U16, U19, itp.
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const teamsList = useMemo(() => {
    const visible = filterTeamsByUserAccess(teamsCatalog, userTeamAccess);
    return visible.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "pl", { sensitivity: "base", numeric: true })
    );
  }, [teamsCatalog, userTeamAccess]);

  const byId = useMemo(() => {
    const m: Record<string, Team> = {};
    teamsList.forEach((t) => {
      m[t.id] = t;
    });
    return m;
  }, [teamsList]);

  const rawSelectedTeamName = byId[selectedTeam]?.name || "Wybierz zespół";
  const selectedTeamName = isPresentationMode && byId[selectedTeam] ? "Zespół" : rawSelectedTeamName;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleTeamSelect = (teamId: string) => {
    if (!isTeamIdAccessibleForUser(teamId, userTeamAccess)) {
      return;
    }
    onChange(teamId);
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <>
      <div className={styles.teamsSelectorContainer}>
        {showLabel && (
          <label className={styles.teamsSelectorLabel}>
            Wybierz zespół:
          </label>
        )}
        <button
          className={`${styles.teamsSelectorHeader} ${isExpanded ? styles.teamsSelectorHeaderActive : ""} ${className}`}
          onClick={handleToggle}
          aria-label={isExpanded ? "Zwiń listę zespołów" : "Rozwiń listę zespołów"}
          type="button"
          disabled={teamsList.length === 0}
        >
          <span>
            {selectedTeamName} ({teamsList.length})
          </span>
        </button>
      </div>
      {isExpanded && (
        <div className={styles.teamsSelectorOverlay} onClick={handleToggle}>
          <div className={styles.teamsSelectorModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.teamsSelectorModalHeader}>
              <h3 className={styles.teamsSelectorModalTitle}>Zespoły</h3>
              <button
                className={styles.closeTeamsSelectorButton}
                onClick={handleToggle}
                aria-label="Zamknij"
                title="Zamknij"
              >
                ×
              </button>
            </div>
            <div className={styles.teamsSelectorModalContent}>
              {teamsList.length === 0 ? (
                <div className={styles.noTeamsMessage}>Brak dostępnych zespołów</div>
              ) : (
                <div className={styles.teamsList}>
                  {teamsList.map((team) => (
                    <button
                      key={team.id}
                      className={`${styles.teamItem} ${
                        selectedTeam === team.id ? styles.teamItemActive : ""
                      }`}
                      onClick={() => handleTeamSelect(team.id)}
                      type="button"
                      title={isPresentationMode ? "Zespół" : team.name}
                    >
                      <div className={styles.teamTile}>
                        <div className={styles.teamLogoWrapper} aria-hidden="true">
                          {team.logo && !isPresentationMode ? (
                            <img
                              src={team.logo}
                              alt=""
                              className={styles.teamLogo}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className={styles.teamInitials}>
                              {isPresentationMode ? "Z" : getTeamInitials(team.name)}
                            </div>
                          )}
                        </div>
                        <div className={styles.teamName}>{isPresentationMode ? "Zespół" : team.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsSelector;
