// components/FootballPitch/FootballPitch.tsx
"use client";

import React, { useState, useCallback, memo } from "react";
import styles from "./FootballPitch.module.css";
import { XT_VALUES } from "./constants";
import ZoneCell from "./ZoneCell";

export interface FootballPitchProps {
  selectedZone: number | null;
  onZoneSelect: (
    zone: number | null,
    xT?: number,
    value1?: number,
    value2?: number
  ) => void;
}

const FootballPitch = memo(function FootballPitch({
  selectedZone,
  onZoneSelect,
}: FootballPitchProps) {
  const [firstClickZone, setFirstClickZone] = useState<number | null>(null);
  const [secondClickZone, setSecondClickZone] = useState<number | null>(null);
  const [firstClickValue, setFirstClickValue] = useState<number | null>(null);

  const handleZoneClick = useCallback(
    (zoneIndex: number) => {
      const row = Math.floor(zoneIndex / 12);
      const col = zoneIndex % 12;
      const clickedValue = XT_VALUES[row][col];

      if (!firstClickZone) {
        setFirstClickZone(zoneIndex);
        setFirstClickValue(clickedValue);
        onZoneSelect(zoneIndex, undefined, clickedValue, undefined);
      } else if (!secondClickZone && zoneIndex !== firstClickZone) {
        setSecondClickZone(zoneIndex);
        if (firstClickValue !== null) {
          const xt = clickedValue - firstClickValue;
          onZoneSelect(zoneIndex, xt, firstClickValue, clickedValue);
        }
      } else {
        setSecondClickZone(null);
        setFirstClickZone(zoneIndex);
        setFirstClickValue(clickedValue);
        onZoneSelect(zoneIndex, undefined, clickedValue, undefined);
      }
    },
    [firstClickZone, secondClickZone, firstClickValue, onZoneSelect]
  );

  // Memoizujemy tablicę komórek, aby uniknąć zbędnego renderowania
  const cells = React.useMemo(
    () =>
      Array.from({ length: 96 }, (_, index) => {
        const row = Math.floor(index / 12);
        const col = index % 12;
        const xTValue = XT_VALUES[row][col];

        return (
          <ZoneCell
            key={index}
            zoneIndex={index}
            xTValue={xTValue}
            isSelected={selectedZone === index}
            isFirstSelection={firstClickZone === index}
            isSecondSelection={secondClickZone === index}
            onSelect={handleZoneClick}
          />
        );
      }),
    [selectedZone, firstClickZone, secondClickZone, handleZoneClick]
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
