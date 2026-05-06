"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Team } from "@/constants/teamsLoader";
import baseStyles from "@/components/TeamsSelector/TeamsSelector.module.css";
import { usePresentationMode } from "@/contexts/PresentationContext";
import {
  filterTeamsByUserAccess,
  isTeamIdAccessibleForUser,
  type UserTeamAccess,
} from "@/lib/teamsForUserAccess";
import {
  getTeamInitialsForMultiSelector,
  teamsMultiSelectorSummaryLabel,
} from "@/utils/teamsMultiSelectorSummary";

export interface TeamsMultiSelectorModalProps {
  teamsCatalog: Team[];
  userTeamAccess: UserTeamAccess;
  selectedTeamIds: string[];
  onChange: (teamIds: string[]) => void;
  showLabel?: boolean;
  disabled?: boolean;
  /** Np. max-width w jednym rzędzie filtrów (CSS module rodzica) */
  containerClassName?: string;
}

const TeamsMultiSelectorModal: React.FC<TeamsMultiSelectorModalProps> = ({
  teamsCatalog,
  userTeamAccess,
  selectedTeamIds,
  onChange,
  showLabel = true,
  disabled = false,
  containerClassName,
}) => {
  const { isPresentationMode } = usePresentationMode();
  const [isOpen, setIsOpen] = useState(false);

  const teamsList = useMemo(() => {
    const visible = filterTeamsByUserAccess(teamsCatalog, userTeamAccess);
    return visible.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "pl", { sensitivity: "base", numeric: true }),
    );
  }, [teamsCatalog, userTeamAccess]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const toggleTeam = useCallback(
    (teamId: string) => {
      if (!isTeamIdAccessibleForUser(teamId, userTeamAccess)) return;
      const next = selectedTeamIds.includes(teamId)
        ? selectedTeamIds.filter((id) => id !== teamId)
        : [...selectedTeamIds, teamId];
      onChange(next);
    },
    [onChange, selectedTeamIds, userTeamAccess],
  );

  const selectAll = useCallback(() => {
    onChange(teamsList.map((t) => t.id));
  }, [onChange, teamsList]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const headerText = teamsMultiSelectorSummaryLabel(
    selectedTeamIds,
    teamsList,
    isPresentationMode,
  );

  return (
    <>
      <div className={`${baseStyles.teamsSelectorContainer} ${containerClassName ?? ""}`.trim()}>
        {showLabel && (
          <span className={baseStyles.teamsSelectorLabel} id="teams-multi-selector-label">
            Zespoły
          </span>
        )}
        <button
          type="button"
          className={`${baseStyles.teamsSelectorHeader} ${isOpen ? baseStyles.teamsSelectorHeaderActive : ""}`}
          onClick={() => setIsOpen(true)}
          disabled={disabled || teamsList.length === 0}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-labelledby={showLabel ? "teams-multi-selector-label" : undefined}
        >
          <span>
            {headerText} ({selectedTeamIds.length}/{teamsList.length})
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className={baseStyles.teamsSelectorOverlay}
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className={`${baseStyles.teamsSelectorModal} ${baseStyles.teamsSelectorModalWithFooter}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="teams-multi-modal-title"
          >
            <div className={baseStyles.teamsSelectorModalHeader}>
              <h3 className={baseStyles.teamsSelectorModalTitle} id="teams-multi-modal-title">
                Wybierz zespoły
              </h3>
              <button
                type="button"
                className={baseStyles.closeTeamsSelectorButton}
                onClick={() => setIsOpen(false)}
                aria-label="Zamknij"
                title="Zamknij"
              >
                ×
              </button>
            </div>
            <div className={baseStyles.teamsSelectorModalContent}>
              {teamsList.length === 0 ? (
                <div className={baseStyles.noTeamsMessage}>Brak dostępnych zespołów</div>
              ) : (
                <>
                  <div className={baseStyles.modalToolbar}>
                    <button type="button" className={baseStyles.modalToolbarButton} onClick={selectAll}>
                      Zaznacz wszystkie
                    </button>
                    <button type="button" className={baseStyles.modalToolbarButton} onClick={clearAll}>
                      Wyczyść
                    </button>
                  </div>
                  <div className={baseStyles.teamsList}>
                    {teamsList.map((team) => {
                      const selected = selectedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          type="button"
                          className={`${baseStyles.teamItem} ${selected ? baseStyles.teamItemActive : ""}`}
                          onClick={() => toggleTeam(team.id)}
                          title={isPresentationMode ? "Zespół" : team.name}
                          aria-pressed={selected}
                        >
                          <div className={baseStyles.teamTile}>
                            <div className={baseStyles.teamLogoWrapper} aria-hidden="true">
                              {team.logo && !isPresentationMode ? (
                                <img
                                  src={team.logo}
                                  alt=""
                                  className={baseStyles.teamLogo}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <div className={baseStyles.teamInitials}>
                                  {isPresentationMode ? "Z" : getTeamInitialsForMultiSelector(team.name)}
                                </div>
                              )}
                            </div>
                            <div className={baseStyles.teamName}>
                              {isPresentationMode ? "Zespół" : team.name}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className={baseStyles.teamsSelectorModalFooter}>
              <button
                type="button"
                className={baseStyles.modalPrimaryButton}
                onClick={() => setIsOpen(false)}
              >
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamsMultiSelectorModal;
