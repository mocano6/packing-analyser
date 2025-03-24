// src/components/PointsButtons/PointsButtons.tsx
"use client";

import React, { memo, useCallback } from "react";
import styles from "./PointsButtons.module.css";
import { ACTION_BUTTONS } from "./constants";

export interface PointsButtonsProps {
  currentPoints: number;
  onAddPoints: (points: number) => void;
  isP3Active: boolean;
  onP3Toggle: () => void;
  isShot: boolean;
  onShotToggle: (checked: boolean) => void;
  isGoal: boolean;
  onGoalToggle: (checked: boolean) => void;
  onSaveAction: () => void;
  onReset: () => void;
}

const PointsButtons = memo(function PointsButtons({
  currentPoints,
  onAddPoints,
  isP3Active,
  onP3Toggle,
  isShot,
  onShotToggle,
  isGoal,
  onGoalToggle,
  onSaveAction,
  onReset,
}: PointsButtonsProps) {
  const handlePointsAdd = useCallback(
    (points: number) => {
      onAddPoints(points);
    },
    [onAddPoints]
  );

  const handleShotToggle = useCallback(() => {
    onShotToggle(!isShot);
  }, [isShot, onShotToggle]);

  const handleGoalToggle = useCallback(() => {
    onGoalToggle(!isGoal);
  }, [isGoal, onGoalToggle]);

  return (
    <div className={styles.container}>
      <div className={styles.pointsDisplay} role="status" aria-live="polite">
        <span className={styles.pointsLabel}>Punkty:</span>
        <span className={styles.pointsValue}>{currentPoints}</span>
      </div>

      <div
        className={styles.buttonsGrid}
        role="group"
        aria-label="Opcje punktacji"
      >
        {ACTION_BUTTONS.map((button, index) =>
          button.type === "toggle" ? (
            <button
              key={index}
              className={`${styles.actionButton} ${
                isP3Active ? styles.activeButton : ""
              }`}
              onClick={onP3Toggle}
              title={button.description}
              aria-pressed={isP3Active}
              type="button"
            >
              <span className={styles.buttonLabel}>{button.label}</span>
              <span className={styles.buttonDescription}>
                {button.description}
              </span>
            </button>
          ) : (
            <button
              key={index}
              className={styles.actionButton}
              onClick={() => handlePointsAdd(button.points)}
              title={button.description}
              type="button"
            >
              <span className={styles.buttonLabel}>{button.label}</span>
              <span className={styles.buttonDescription}>
                {button.description}
              </span>
            </button>
          )
        )}

        {/* Przycisk "Strzał" jako toggle button */}
        <button
          className={`${styles.actionButton} ${
            isShot ? styles.activeButton : ""
          }`}
          onClick={handleShotToggle}
          aria-pressed={isShot}
          type="button"
        >
          <span className={styles.buttonLabel}>Strzał</span>
          <span className={styles.buttonDescription}>
            Zaznacz jeśli akcja zakończyła się strzałem
          </span>
        </button>

        {/* Przycisk "Bramka" jako toggle button, wyłączony gdy nie ma strzału */}
        <button
          className={`${styles.actionButton} ${
            isGoal ? styles.activeButton : ""
          }`}
          onClick={handleGoalToggle}
          disabled={!isShot}
          aria-pressed={isGoal}
          aria-disabled={!isShot}
          type="button"
          style={{
            opacity: !isShot ? 0.5 : 1,
            cursor: !isShot ? "not-allowed" : "pointer",
          }}
        >
          <span className={styles.buttonLabel}>Bramka</span>
          <span className={styles.buttonDescription}>
            Zaznacz jeśli strzał zakończył się bramką
          </span>
        </button>
      </div>

      <div
        className={styles.controlButtons}
        role="group"
        aria-label="Kontrolki akcji"
      >
        <button
          className={`${styles.controlButton} ${styles.resetButton}`}
          onClick={onReset}
          type="button"
        >
          Resetuj
        </button>
        <button
          className={`${styles.controlButton} ${styles.saveButton}`}
          onClick={onSaveAction}
          type="button"
        >
          Zapisz akcję
        </button>
      </div>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
PointsButtons.displayName = "PointsButtons";

export default PointsButtons;
