// components/FootballPitch/FootballPitch.tsx
"use client";

import React, { useCallback, memo, useEffect, useState } from "react";
import styles from "./FootballPitch.module.css";
import { getXTValueFromMatrix, getZoneName, zoneNameToString, zoneNameToIndex } from "@/constants/xtValues";
import ZoneCell from "./ZoneCell";

export interface FootballPitchProps {
  selectedZone: string | number | null;
  onZoneSelect: (
    zone: number | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => void;
  startZone: number | null;
  endZone: number | null;
}

const FootballPitch = memo(function FootballPitch({
  selectedZone,
  onZoneSelect,
  startZone,
  endZone,
}: FootballPitchProps) {
  // Stan przełącznika orientacji boiska
  const [isFlipped, setIsFlipped] = useState(false);

  // Logowanie zmian stref dla debugowania
  useEffect(() => {
    
  }, [startZone, endZone, selectedZone]);

  // Funkcja do pobierania wartości xT z uwzględnieniem orientacji
  const getXTValueForPosition = useCallback((visualRow: number, visualCol: number): number => {
    if (!isFlipped) {
      // Standardowa orientacja - wartości rosną w prawo, A1-A12 na górze
      return getXTValueFromMatrix(visualRow, visualCol);
    } else {
      // Odbita orientacja - wartości rosną w lewo, A1-A12 na dole
      // Odbijamy zarówno wiersz jak i kolumnę dla pobierania wartości xT
      const sourceRow = 7 - visualRow;  // Odbicie wierszy
      const sourceCol = 11 - visualCol; // Odbicie kolumn
      return getXTValueFromMatrix(sourceRow, sourceCol);
    }
  }, [isFlipped]);

  // Funkcja do pobierania nazwy strefy z uwzględnieniem orientacji
  const getZoneNameForPosition = useCallback((visualRow: number, visualCol: number): string => {
    if (!isFlipped) {
      // Standardowa orientacja - A1-A12 na górze, H1-H12 na dole
      const visualIndex = visualRow * 12 + visualCol;
      const zoneName = getZoneName(visualIndex);
      return zoneName ? zoneNameToString(zoneName) : '';
    } else {
      // Odbita orientacja - A1-A12 na dole, H1-H12 na górze
      // Odbijamy zarówno wiersz jak i kolumnę
      const nameRow = 7 - visualRow;  // Odbicie wierszy (0->7, 1->6, etc.)
      const nameCol = 11 - visualCol; // Odbicie kolumn (0->11, 1->10, etc.)
      const nameIndex = nameRow * 12 + nameCol;
      const zoneName = getZoneName(nameIndex);
      return zoneName ? zoneNameToString(zoneName) : '';
    }
  }, [isFlipped]);
  
  // Obsługa kliknięcia na strefę
  const handleZoneClick = useCallback(
    (visualZoneIndex: number) => {
      // Konwertujemy wizualny indeks na pozycję wiersz/kolumna
      const row = Math.floor(visualZoneIndex / 12);
      const col = visualZoneIndex % 12;
      
      // Pobierz wartości xT dla tej pozycji z uwzględnieniem orientacji
      const xTValue = getXTValueForPosition(row, col);
      
      // Pobierz nazwę strefy dla sprawdzenia
      const zoneNameStr = getZoneNameForPosition(row, col);
      
      // Oblicz indeks na podstawie NAZWY strefy (a nie pozycji wizualnej)
      const realZoneIndex = zoneNameToIndex(zoneNameStr);
      

      
      // Przekaż indeks odpowiadający nazwie strefy i wartości xT
      if (realZoneIndex !== null) {
        onZoneSelect(realZoneIndex, xTValue);
      }
    },
    [onZoneSelect, getXTValueForPosition, getZoneNameForPosition, isFlipped]
  );

  // Przełącznik orientacji boiska
  const handleFlipToggle = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // Memoizujemy tablicę komórek, aby uniknąć zbędnego renderowania
  const cells = React.useMemo(
    () =>
      Array.from({ length: 96 }, (_, visualIndex) => {
        // Konwertujemy wizualny indeks na pozycję wiersz/kolumna
        const row = Math.floor(visualIndex / 12);
        const col = visualIndex % 12;
        
        // Pobierz wartości xT dla tej pozycji z uwzględnieniem orientacji
        const xTValue = getXTValueForPosition(row, col);
        
        // Pobierz nazwę strefy z uwzględnieniem orientacji
        const zoneNameStr = getZoneNameForPosition(row, col);

        // Oblicz indeks dla porównań na podstawie nazwy strefy
        const realIndexForComparison = zoneNameToIndex(zoneNameStr);
        
        // Porównania z selectedZone, startZone, endZone na podstawie indeksu odpowiadającego nazwie
        const isSelected = realIndexForComparison !== null && (selectedZone === realIndexForComparison || selectedZone === realIndexForComparison.toString());
        const isFirstSelection = realIndexForComparison !== null && startZone === realIndexForComparison;
        const isSecondSelection = realIndexForComparison !== null && endZone === realIndexForComparison;

        return (
          <ZoneCell
            key={visualIndex}
            zoneIndex={visualIndex}
            xTValue={xTValue}
            zoneName={zoneNameStr}
            isSelected={isSelected}
            isFirstSelection={isFirstSelection}
            isSecondSelection={isSecondSelection}
            onSelect={handleZoneClick}
          />
        );
              }),
    [selectedZone, startZone, endZone, handleZoneClick, getXTValueForPosition, getZoneNameForPosition, isFlipped]
  );

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
        aria-label="Boisko piłkarskie podzielone na strefy"
      >
        <div className={styles.grid}>{cells}</div>
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
FootballPitch.displayName = "FootballPitch";

export default FootballPitch;
