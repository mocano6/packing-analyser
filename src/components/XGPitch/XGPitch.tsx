"use client";

import React, { memo, useState } from "react";
import styles from "./XGPitch.module.css";

export interface XGPitchProps {
  onShotAdd?: (x: number, y: number) => void;
}

const XGPitch = memo(function XGPitch({
  onShotAdd,
}: XGPitchProps) {
  // Stan przełącznika orientacji boiska
  const [isFlipped, setIsFlipped] = useState(false);

  // Obsługa przełączania orientacji
  const handleFlipToggle = () => {
    setIsFlipped(!isFlipped);
  };

  // Obsługa kliknięcia na boisko
  const handlePitchClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onShotAdd) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    onShotAdd(x, y);
  };

  return (
    <div className={styles.pitchContainer}>
      {/* Przycisk przełączania orientacji */}
      <button 
        className={styles.flipButton}
        onClick={handleFlipToggle}
        title={isFlipped ? "Przełącz na orientację standardową (→)" : "Przełącz na orientację odbita (←)"}
        aria-label={isFlipped ? "Przełącz na orientację standardową" : "Przełącz na orientację odbita"}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Ikona boiska z bramkami */}
          <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <rect x="2" y="9" width="3" height="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <rect x="19" y="9" width="3" height="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1"/>
          
          {/* Strzałka pokazująca kierunek */}
          {isFlipped ? (
            // Strzałka w lewo
            <path d="M8 12L14 8V10H16V14H14V16L8 12Z" fill="currentColor"/>
          ) : (
            // Strzałka w prawo  
            <path d="M16 12L10 8V10H8V14H10V16L16 12Z" fill="currentColor"/>
          )}
        </svg>
      </button>

      <div
        className={`${styles.pitch} ${isFlipped ? styles.flipped : ''}`}
        role="grid"
        aria-label="Boisko piłkarskie do analizy xG"
        onClick={handlePitchClick}
      >
        <div className={styles.pitchLines} aria-hidden="true">
          <div className={styles.centerLine} />
          <div className={styles.centerCircle} />
          <div className={styles.centerSpot} />
          <div className={styles.penaltyAreaLeft} />
          <div className={styles.goalAreaLeft} />
          <div className={styles.penaltyAreaRight} />
          <div className={styles.goalAreaRight} />
          <div className={styles.penaltyArcLeft} />
          <div className={styles.penaltyArcRight} />
          <div className={styles.penaltySpotLeft} />
          <div className={styles.penaltySpotRight} />
          <div className={styles.goalLeft} />
          <div className={styles.goalRight} />
        </div>
      </div>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
XGPitch.displayName = "XGPitch";

export default XGPitch; 