// components/FootballPitch/FootballPitch.tsx
"use client";

import React, { useCallback, memo, useEffect } from "react";
import styles from "./FootballPitch.module.css";
import { getXTValueFromMatrix } from "@/constants/xtValues";
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
  // Logowanie zmian stref dla debugowania
  useEffect(() => {
    console.log("FootballPitch - zmiany stref:", {
      startZone,
      endZone,
      selectedZone
    });
  }, [startZone, endZone, selectedZone]);
  
  // Obsługa kliknięcia na strefę
  const handleZoneClick = useCallback(
    (zoneIndex: number) => {
      // Pobierz wartości xT dla klikniętej strefy
      const row = Math.floor(zoneIndex / 12);
      const col = zoneIndex % 12;
      const xTValue = getXTValueFromMatrix(row, col);
      
      console.log(`FootballPitch - handleZoneClick: strefa ${zoneIndex}, xT: ${xTValue.toFixed(3)}`);
      
      // Przekaż strefę i wartości do rodzica
      onZoneSelect(zoneIndex, xTValue);
    },
    [onZoneSelect]
  );

  // Memoizujemy tablicę komórek, aby uniknąć zbędnego renderowania
  const cells = React.useMemo(
    () =>
      Array.from({ length: 96 }, (_, index) => {
        const row = Math.floor(index / 12);
        const col = index % 12;
        const xTValue = getXTValueFromMatrix(row, col);

        // Sprawdzamy, czy selectedZone jako string lub number odpowiada indeksowi
        const isSelected = selectedZone === index || selectedZone === index.toString();

        return (
          <ZoneCell
            key={index}
            zoneIndex={index}
            xTValue={xTValue}
            isSelected={isSelected}
            isFirstSelection={startZone === index}
            isSecondSelection={endZone === index}
            onSelect={handleZoneClick}
          />
        );
      }),
    [selectedZone, startZone, endZone, handleZoneClick]
  );

  return (
    <div className={styles.pitchContainer}>
      <div
        className={styles.pitch}
        role="grid"
        aria-label="Boisko piłkarskie podzielone na strefy"
      >
        <div className={styles.grid}>{cells}</div>
        <div className={styles.pitchLines} aria-hidden="true">
          <div className={styles.centerLine} />
          <div className={styles.centerCircle} />
          <div className={styles.penaltyAreaLeft} />
          <div className={styles.goalAreaLeft} />
          <div className={styles.penaltyAreaRight} />
          <div className={styles.goalAreaRight} />
        </div>
      </div>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
FootballPitch.displayName = "FootballPitch";

export default FootballPitch;
