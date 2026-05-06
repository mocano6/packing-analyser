"use client";

import React, { useCallback, useEffect, useState } from "react";
import pitchHeaderStyles from "../PitchHeader/PitchHeader.module.css";
import {
  POSSESSION_COUNTER_CHANGED_EVENT,
  POSSESSION_COUNTER_STORAGE_KEY,
  applyPossessionCounterEnabledInBrowser,
  isPossessionCounterEnabledStoredValue,
} from "@/utils/possessionCounterPreference";

/** Przełącznik licznika posiadania (Z/X/C); synchronizacja przez localStorage + CustomEvent. */
const PossessionCounterToggle: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(POSSESSION_COUNTER_STORAGE_KEY);
    setEnabled(isPossessionCounterEnabledStoredValue(v));
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent;
      if (typeof e?.detail?.enabled === "boolean") {
        setEnabled(Boolean(e.detail.enabled));
      }
    };
    window.addEventListener(POSSESSION_COUNTER_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(POSSESSION_COUNTER_CHANGED_EVENT, handler as EventListener);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    applyPossessionCounterEnabledInBrowser(next);
  }, [enabled]);

  return (
    <button
      type="button"
      className={pitchHeaderStyles.headerButton}
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Wyłącz licznik posiadania (Z/X/C)" : "Włącz licznik posiadania (Z/X/C)"}
    >
      Posiadanie: {enabled ? "ON" : "OFF"}
    </button>
  );
};

export default PossessionCounterToggle;
