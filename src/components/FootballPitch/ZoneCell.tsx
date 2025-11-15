// components/FootballPitch/ZoneCell.tsx
"use client";

import React, { memo, useEffect, useMemo } from "react";
import styles from "./FootballPitch.module.css";
import { getXTColor } from "./utils";

export interface ZoneCellProps {
  zoneIndex: number;
  xTValue: number;
  zoneName: string;
  isSelected: boolean;
  isFirstSelection: boolean;
  isSecondSelection: boolean;
  onSelect: (zoneIndex: number) => void;
  actionCategory?: "packing" | "regain" | "loses";
}

const ZoneCell = memo(function ZoneCell({
  zoneIndex,
  xTValue,
  zoneName,
  isSelected,
  isFirstSelection,
  isSecondSelection,
  onSelect,
  actionCategory = "packing",
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
    onSelect(zoneIndex);
  };

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
        <div className={styles.cellContent}>
          <span className={styles.xTValue}>{xTValue.toFixed(3)}</span>
          <span className={styles.zoneName}>{zoneName}</span>
        </div>
      )}
      {isFirstSelection && actionCategory === "packing" && <span className={styles.actionText}>PASS</span>}
      {isSecondSelection && actionCategory === "packing" && <span className={styles.actionText}>RECEIVE</span>}
      {isFirstSelection && actionCategory === "regain" && <span className={styles.actionText}>REGAIN</span>}
      {isFirstSelection && actionCategory === "loses" && <span className={styles.actionText}>LOSES</span>}
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ZoneCell.displayName = "ZoneCell";

export default ZoneCell;
