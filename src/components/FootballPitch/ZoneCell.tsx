// components/FootballPitch/ZoneCell.tsx
"use client";

import React, { memo } from "react";
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

  const handleClick = () => {
    onSelect(zoneIndex);
  };

  return (
    <div
      className={`${styles.zoneCell} ${getSelectionClass()}`}
      onClick={handleClick}
      style={{
        backgroundColor: getXTColor(xTValue),
      }}
      role="gridcell"
      aria-selected={isSelected || isFirstSelection || isSecondSelection}
      tabIndex={0}
      data-zone-index={zoneIndex}
      data-xt-value={xTValue.toFixed(3)}
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
