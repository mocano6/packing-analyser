// components/FootballPitch/ZoneCell.tsx
"use client";

import React, { memo, useEffect, useMemo } from "react";
import styles from "./FootballPitch.module.css";
import { getXTColor } from "./utils";

export interface ZoneCellProps {
  zoneIndex: number;
  xTValue: number;
  isSelected: boolean;
  isFirstSelection: boolean;
  isSecondSelection: boolean;
  onSelect: (zoneIndex: number) => void;
}

const ZoneCell = memo(function ZoneCell({
  zoneIndex,
  xTValue,
  isSelected,
  isFirstSelection,
  isSecondSelection,
  onSelect,
}: ZoneCellProps) {
  // Pomocnicza funkcja do określenia klasy CSS na podstawie stanu selekcji
  const getSelectionClass = () => {
    if (isFirstSelection) return styles.firstSelection;
    if (isSecondSelection) return styles.secondSelection;
    if (isSelected) return styles.selected;
    return "";
  };

  // Określamy kategorię wartości xT
  const xtValueCategory = useMemo(() => {
    if (xTValue >= 0.1) return "extreme";
    if (xTValue >= 0.04) return "veryhigh";
    if (xTValue >= 0.02) return "high";
    return "";
  }, [xTValue]);

  const handleClick = () => {
    console.log(`Kliknięto strefę ${zoneIndex} z wartością xT: ${xTValue.toFixed(3)}`);
    onSelect(zoneIndex);
  };

  // Debugowanie (opcjonalne) - usuń w wersji produkcyjnej
  useEffect(() => {
    if (isFirstSelection || isSecondSelection) {
      console.log(`ZoneCell ${zoneIndex}: `, { 
        isFirstSelection, 
        isSecondSelection,
        xTValue: xTValue.toFixed(3),
        label: isFirstSelection ? "PASS" : isSecondSelection ? "RECEIVE" : "NONE" 
      });
    }
  }, [zoneIndex, isFirstSelection, isSecondSelection, xTValue]);

  const cellClassName = `${styles.zoneCell} ${getSelectionClass()}`;

  return (
    <div
      className={cellClassName}
      onClick={handleClick}
      style={{
        backgroundColor: getXTColor(xTValue),
      }}
      role="gridcell"
      aria-selected={isSelected || isFirstSelection || isSecondSelection}
      tabIndex={0}
      data-zone-index={zoneIndex}
      data-xt-value={xtValueCategory}
      data-selection-type={isFirstSelection ? "pass" : isSecondSelection ? "receive" : "none"}
    >
      {!isFirstSelection && !isSecondSelection && (
        <span className={styles.xTValue}>{xTValue.toFixed(3)}</span>
      )}
      {isFirstSelection && <span className={styles.actionText}>PASS</span>}
      {isSecondSelection && <span className={styles.actionText}>RECEIVE</span>}
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ZoneCell.displayName = "ZoneCell";

export default ZoneCell;
