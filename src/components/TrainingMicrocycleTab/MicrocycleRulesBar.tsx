"use client";

import React, { useMemo, useState } from "react";
import type {
  MicrocycleRuleSeverity,
  MicrocycleViolation,
} from "@/lib/microcycle/microcycleRules";
import { countBySeverity } from "@/lib/microcycle/microcycleRules";
import { weekdayShortPl } from "@/utils/matchDayLabels";
import styles from "./TrainingMicrocycleTab.module.css";

const SEVERITY_LABELS: Record<MicrocycleRuleSeverity, string> = {
  critical: "Złamana zasada",
  warning: "Ostrzeżenie",
  info: "Informacja",
};

export interface MicrocycleRulesBarProps {
  violations: MicrocycleViolation[];
  /** Klik w naruszenie przenosi widok na dzień. */
  onFocusDay?: (dayIndex: number) => void;
}

export default function MicrocycleRulesBar({
  violations,
  onFocusDay,
}: MicrocycleRulesBarProps) {
  const [open, setOpen] = useState(true);
  const counts = useMemo(() => countBySeverity(violations), [violations]);
  const blocking = counts.critical + counts.warning;

  return (
    <section
      className={`${styles.rulesBar} ${
        counts.critical > 0
          ? styles.rulesBarCritical
          : counts.warning > 0
            ? styles.rulesBarWarning
            : styles.rulesBarClean
      }`}
      aria-label="Kontrola zasad mikrocyklu"
    >
      <button
        type="button"
        className={styles.rulesToggle}
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls="microcycle-rules-list"
      >
        <span className={styles.rulesToggleLeft}>
          <span className={styles.dayTitlesChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className={styles.rulesTitle}>
            {blocking === 0 ? "Mikrocykl zgodny z modelem" : "Kontrola zasad"}
          </span>
          {counts.critical > 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeCritical}`}>
              {counts.critical} złamane
            </span>
          )}
          {counts.warning > 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeWarning}`}>
              {counts.warning} ostrzeżeń
            </span>
          )}
          {counts.info > 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeInfo}`}>
              {counts.info} info
            </span>
          )}
        </span>
        <span className={styles.dayTitlesToggleHint}>{open ? "Zwiń" : "Rozwiń"}</span>
      </button>

      {open && (
        <ul className={styles.rulesList} id="microcycle-rules-list">
          {violations.length === 0 && (
            <li className={styles.rulesItem}>
              <span className={styles.rulesItemBody}>
                <span className={styles.rulesItemTitle}>Brak naruszeń</span>
                <span className={styles.rulesItemMessage}>
                  Kształt tygodnia, ekspozycja na sprint i dobór boisk zgadzają się z modelem.
                </span>
              </span>
            </li>
          )}
          {violations.map((v, i) => (
            <li key={`${v.ruleId}-${i}`} className={styles.rulesItem} data-severity={v.severity}>
              <span className={styles.rulesItemSeverity} data-severity={v.severity}>
                {SEVERITY_LABELS[v.severity]}
              </span>
              <span className={styles.rulesItemBody}>
                <span className={styles.rulesItemTitle}>
                  {v.title}
                  {v.dayIndex != null && (
                    <span className={styles.rulesItemDay}>{weekdayShortPl(v.dayIndex)}</span>
                  )}
                </span>
                <span className={styles.rulesItemMessage}>{v.message}</span>
                {v.hint && <span className={styles.rulesItemHint}>{v.hint}</span>}
              </span>
              {v.dayIndex != null && onFocusDay && (
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => onFocusDay(v.dayIndex as number)}
                >
                  Pokaż dzień
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
