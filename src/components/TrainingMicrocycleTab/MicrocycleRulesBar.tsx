"use client";

import React, { useMemo, useState } from "react";
import type {
  MethodologyCheckStatus,
  MethodologyPrincipleCheck,
  MicrocycleViolation,
} from "@/lib/microcycle/microcycleRules";
import {
  extraMethodologyViolations,
  methodologyPrincipleChecks,
} from "@/lib/microcycle/microcycleRules";
import { weekdayShortPl } from "@/utils/matchDayLabels";
import styles from "./TrainingMicrocycleTab.module.css";

const STATUS_MARK: Record<MethodologyCheckStatus, string> = {
  ok: "✓",
  warn: "!",
  fail: "✕",
  skip: "–",
};

const STATUS_LABEL: Record<MethodologyCheckStatus, string> = {
  ok: "Zgodne",
  warn: "Ostrzeżenie",
  fail: "Złamana",
  skip: "Po blokach",
};

export interface MicrocycleRulesBarProps {
  violations: MicrocycleViolation[];
  hasBlocks: boolean;
  /** Klik w naruszenie przenosi widok na dzień. */
  onFocusDay?: (dayIndex: number) => void;
}

function PrincipleDetails({
  items,
  onFocusDay,
}: {
  items: MicrocycleViolation[];
  onFocusDay?: (dayIndex: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.rulesPrincipleDetails}>
      {items.map((v, i) => (
        <li key={`${v.ruleId}-${i}`}>
          <span className={styles.rulesItemMessage}>{v.message}</span>
          {v.hint && <span className={styles.rulesItemHint}>{v.hint}</span>}
          {v.dayIndex != null && onFocusDay && (
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => onFocusDay(v.dayIndex as number)}
            >
              Pokaż {weekdayShortPl(v.dayIndex)}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function PrincipleRow({
  check,
  onFocusDay,
}: {
  check: MethodologyPrincipleCheck;
  onFocusDay?: (dayIndex: number) => void;
}) {
  return (
    <li className={styles.rulesPrinciple} data-status={check.status}>
      <span className={styles.rulesPrincipleHead}>
        <span className={styles.rulesMark} data-status={check.status} aria-hidden>
          {STATUS_MARK[check.status]}
        </span>
        <span className={styles.rulesPrincipleLabel}>{check.shortLabel}</span>
        <span className={styles.rulesPrincipleStatus}>{STATUS_LABEL[check.status]}</span>
      </span>
      <PrincipleDetails items={check.items} onFocusDay={onFocusDay} />
    </li>
  );
}

export default function MicrocycleRulesBar({
  violations,
  hasBlocks,
  onFocusDay,
}: MicrocycleRulesBarProps) {
  const [open, setOpen] = useState(true);
  const checks = useMemo(
    () => methodologyPrincipleChecks(violations, { hasBlocks }),
    [violations, hasBlocks]
  );
  const extras = useMemo(() => extraMethodologyViolations(violations), [violations]);
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned =
    checks.filter((c) => c.status === "warn").length +
    extras.filter((v) => v.severity !== "info").length;
  const skipped = checks.filter((c) => c.status === "skip").length;
  const blocking = failed + warned;

  return (
    <section
      className={`${styles.rulesBar} ${
        failed > 0
          ? styles.rulesBarCritical
          : warned > 0
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
            {blocking === 0 ? "Mikrocykl zgodny z metodyką" : "Kontrola zasad"}
          </span>
          {failed > 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeCritical}`}>
              {failed} złamane
            </span>
          )}
          {warned > 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeWarning}`}>
              {warned} ostrzeżeń
            </span>
          )}
          {skipped > 0 && blocking === 0 && (
            <span className={`${styles.rulesBadge} ${styles.rulesBadgeInfo}`}>
              {skipped} po blokach
            </span>
          )}
        </span>
        <span className={styles.dayTitlesToggleHint}>{open ? "Zwiń" : "Rozwiń"}</span>
      </button>

      {open && (
        <ol className={styles.rulesList} id="microcycle-rules-list">
          {checks.map((check) => (
            <PrincipleRow key={check.id} check={check} onFocusDay={onFocusDay} />
          ))}
          {extras.length > 0 && (
            <li className={styles.rulesExtras}>
              <span className={styles.rulesExtrasTitle}>Wyjątki</span>
              <ul className={styles.rulesPrincipleDetails}>
                {extras.map((v, i) => (
                  <li key={`${v.ruleId}-${i}`}>
                    <span className={styles.rulesItemTitle}>{v.title}</span>
                    <span className={styles.rulesItemMessage}>{v.message}</span>
                    {v.hint && <span className={styles.rulesItemHint}>{v.hint}</span>}
                    {v.dayIndex != null && onFocusDay && (
                      <button
                        type="button"
                        className={styles.smallBtn}
                        onClick={() => onFocusDay(v.dayIndex as number)}
                      >
                        Pokaż {weekdayShortPl(v.dayIndex)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
