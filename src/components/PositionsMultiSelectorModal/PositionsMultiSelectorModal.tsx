"use client";

import React, { useEffect, useMemo, useState } from "react";
import baseStyles from "@/components/TeamsSelector/TeamsSelector.module.css";

export interface PositionsMultiSelectorModalProps {
  positionsCatalog: string[];
  /** Pusty = wszystkie pozycje (bez filtrowania po pozycji). */
  selectedPositions: string[];
  onChange: (positions: string[]) => void;
  disabled?: boolean;
}

const PositionsMultiSelectorModal: React.FC<PositionsMultiSelectorModalProps> = ({
  positionsCatalog,
  selectedPositions,
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...new Set(positionsCatalog.map((p) => String(p).trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pl", { sensitivity: "base", numeric: true }),
      ),
    [positionsCatalog],
  );

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

  const allMode = selectedPositions.length === 0;

  const togglePosition = (pos: string) => {
    if (allMode) {
      onChange([pos]);
      return;
    }
    if (selectedPositions.includes(pos)) {
      const next = selectedPositions.filter((p) => p !== pos);
      onChange(next);
      return;
    }
    onChange([...selectedPositions, pos]);
  };

  const selectAll = () => onChange([]);

  const headerText = allMode ? "Wszystkie pozycje" : `${selectedPositions.length} wybranych`;

  return (
    <>
      <div className={baseStyles.teamsSelectorContainer}>
        <span className={baseStyles.teamsSelectorLabel} id="positions-multi-selector-label">
          Pozycje
        </span>
        <button
          type="button"
          className={`${baseStyles.teamsSelectorHeader} ${isOpen ? baseStyles.teamsSelectorHeaderActive : ""}`}
          onClick={() => setIsOpen(true)}
          disabled={disabled || sorted.length === 0}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-labelledby="positions-multi-selector-label"
        >
          <span>
            {headerText} ({sorted.length})
          </span>
        </button>
      </div>

      {isOpen && (
        <div className={baseStyles.teamsSelectorOverlay} onClick={() => setIsOpen(false)} role="presentation">
          <div
            className={`${baseStyles.teamsSelectorModal} ${baseStyles.teamsSelectorModalWithFooter}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="positions-multi-modal-title"
          >
            <div className={baseStyles.teamsSelectorModalHeader}>
              <h3 className={baseStyles.teamsSelectorModalTitle} id="positions-multi-modal-title">
                Wybierz pozycje
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
              {sorted.length === 0 ? (
                <div className={baseStyles.noTeamsMessage}>Brak pozycji w załadowanych danych</div>
              ) : (
                <>
                  <div className={baseStyles.modalToolbar}>
                    <button type="button" className={baseStyles.modalToolbarButton} onClick={selectAll}>
                      Pokaż wszystkie pozycje
                    </button>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
                    Zaznacz kafelki, aby ograniczyć widok. „Pokaż wszystkie” czyści filtr.
                  </p>
                  <div className={baseStyles.teamsList}>
                    {sorted.map((pos) => {
                      const active = !allMode && selectedPositions.includes(pos);
                      return (
                        <button
                          key={pos}
                          type="button"
                          className={`${baseStyles.teamItem} ${active ? baseStyles.teamItemActive : ""}`}
                          onClick={() => togglePosition(pos)}
                          title={pos}
                          aria-pressed={active}
                        >
                          <div className={baseStyles.teamTile}>
                            <div className={baseStyles.teamLogoWrapper} aria-hidden="true">
                              <div className={baseStyles.teamInitials}>{pos.slice(0, 3).toUpperCase()}</div>
                            </div>
                            <div className={baseStyles.teamName}>{pos}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className={baseStyles.teamsSelectorModalFooter}>
              <button type="button" className={baseStyles.modalPrimaryButton} onClick={() => setIsOpen(false)}>
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PositionsMultiSelectorModal;
