"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  subscribeFirestoreMetrics,
  resetFirestoreMetrics,
  getFirestoreMetricsSnapshot,
  type FirestoreMetricsState,
} from "@/lib/firestoreMetricsStore";
import styles from "./FirestoreMetricsBadge.module.css";

const DEBUG_SHOW_KEY = "firestore_metrics_show";

export default function FirestoreMetricsBadge() {
  const { isAdmin } = useAuth();
  const [state, setState] = useState<FirestoreMetricsState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [debugShow, setDebugShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDebugShow(localStorage.getItem(DEBUG_SHOW_KEY) === "true");
    const onStorage = () => setDebugShow(localStorage.getItem(DEBUG_SHOW_KEY) === "true");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const showBadge = isAdmin || debugShow;

  useEffect(() => {
    if (!showBadge) return;
    setState(getFirestoreMetricsSnapshot());
    return subscribeFirestoreMetrics(setState);
  }, [showBadge]);

  if (!showBadge) return null;

  const displayState = state ?? getFirestoreMetricsSnapshot();

  const handleReset = () => {
    resetFirestoreMetrics();
  };

  return (
    <div className={styles.wrapper} role="region" aria-label="Metryki zapytań Firestore">
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsExpanded((e) => !e)}
        aria-expanded={isExpanded}
        aria-controls="firestore-metrics-panel"
        id="firestore-metrics-trigger"
      >
        <span className={styles.icon} aria-hidden="true">
          📊
        </span>
        <span className={styles.counts}>
          <span title="Odczyty">R: {displayState.sessionReads}</span>
          <span title="Zapisy">Z: {displayState.sessionWrites}</span>
        </span>
      </button>
      {isExpanded && (
        <div
          id="firestore-metrics-panel"
          className={styles.panel}
          aria-labelledby="firestore-metrics-trigger"
        >
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Zapytania Firestore (sesja)</span>
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              title="Zeruj liczniki"
            >
              Zeruj
            </button>
          </div>
          <div className={styles.summary}>
            <span>Odczyty: <strong>{displayState.sessionReads}</strong></span>
            <span>Zapisy: <strong>{displayState.sessionWrites}</strong></span>
          </div>
          {displayState.lastOperations.length > 0 && (
            <div className={styles.operations}>
              <span className={styles.operationsTitle}>Ostatnie operacje</span>
              <ul className={styles.operationsList}>
                {[...displayState.lastOperations].reverse().slice(0, 15).map((op, i) => (
                  <li key={`${op.timestamp}-${i}`} className={styles.operationItem}>
                    <span className={op.type === "read" ? styles.opRead : styles.opWrite}>
                      {op.type === "read" ? "R" : "Z"}
                    </span>
                    <span className={styles.opLabel}>{op.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
