// src/components/ActionTypeToggle/ActionTypeToggle.tsx
"use client";

import React, { memo, useCallback } from "react";
import styles from "./ActionTypeToggle.module.css";

export interface ActionTypeToggleProps {
  actionType: "pass" | "dribble";
  onActionTypeChange: (type: "pass" | "dribble") => void;
}

const ActionTypeToggle = memo(function ActionTypeToggle({
  actionType,
  onActionTypeChange,
}: ActionTypeToggleProps) {
  const handlePassClick = useCallback(() => {
    console.log("🔵 ActionTypeToggle: Kliknięto przycisk 'Podanie'");
    onActionTypeChange("pass");
  }, [onActionTypeChange]);

  const handleDribbleClick = useCallback(() => {
    console.log("🟣 ActionTypeToggle: Kliknięto przycisk 'Drybling'");
    onActionTypeChange("dribble");
  }, [onActionTypeChange]);

  console.log("🔄 ActionTypeToggle render - actionType:", actionType);

  return (
    <div
      className={styles.toggleContainer}
      role="radiogroup"
      aria-label="Typ akcji"
    >
      <button
        className={`${styles.toggleButton} ${
          actionType === "pass" ? styles.active : ""
        }`}
        onClick={handlePassClick}
        aria-pressed={actionType === "pass"}
        type="button"
      >
        Podanie
      </button>
      <button
        className={`${styles.toggleButton} ${
          actionType === "dribble" ? styles.active : ""
        }`}
        onClick={handleDribbleClick}
        aria-pressed={actionType === "dribble"}
        type="button"
      >
        Drybling
      </button>
    </div>
  );
});

// Dla łatwiejszego debugowania w React DevTools
ActionTypeToggle.displayName = "ActionTypeToggle";

export default ActionTypeToggle;
