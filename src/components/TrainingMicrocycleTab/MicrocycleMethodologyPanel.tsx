"use client";

import React, { useCallback, useMemo, useState } from "react";
import { MOTOR_DOMINANT_BY_ID, MOTOR_DOMINANTS } from "@/types/microcycleMotor";
import {
  MOTOR_DAY_PRESETS,
  PITCH_MANIPULATION_RULES,
  methodologyPrincipleCatalog,
} from "@/lib/microcycle/motorModel";
import {
  AMATEUR_MODEL_EXCEPTIONS,
  AMATEUR_SATURDAY_SHIFT,
  AMATEUR_SESSION_PLACEMENT,
  groupAmateurPlacementByDay,
} from "@/lib/microcycle/microcycleDayPrinciples";
import { formatMatchDayLabel } from "@/utils/matchDayLabels";
import styles from "./TrainingMicrocycleTab.module.css";

const STORAGE_KEY = "microcycle_methodology_open";
const VIEW_STORAGE_KEY = "microcycle_methodology_view";

type MethodologyViewId = "week" | "when" | "exceptions" | "rules";

const VIEW_OPTIONS: { id: MethodologyViewId; label: string }[] = [
  { id: "week", label: "Tydzień" },
  { id: "when", label: "Co kiedy" },
  { id: "exceptions", label: "Wyjątki" },
  { id: "rules", label: "Zasady" },
];

function parseMethodologyView(raw: string | null): MethodologyViewId {
  if (raw === "week" || raw === "when" || raw === "exceptions" || raw === "rules") {
    return raw;
  }
  return "week";
}

export default function MicrocycleMethodologyPanel() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [view, setView] = useState<MethodologyViewId>(() => {
    if (typeof window === "undefined") return "week";
    try {
      return parseMethodologyView(window.localStorage.getItem(VIEW_STORAGE_KEY));
    } catch {
      return "week";
    }
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const selectView = useCallback((next: MethodologyViewId) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const weekDays = useMemo(
    () => [...MOTOR_DAY_PRESETS].sort((a, b) => a.offset - b.offset),
    []
  );
  const placementByDay = useMemo(
    () => groupAmateurPlacementByDay(AMATEUR_SESSION_PLACEMENT),
    []
  );

  return (
    <section
      className={`${styles.dayTitlesSection} ${open ? "" : styles.dayTitlesSectionCollapsed}`}
      aria-label="Metodyka mikrocyklu"
    >
      <button
        type="button"
        className={styles.dayTitlesToggle}
        onClick={toggle}
        aria-expanded={open}
        aria-controls="microcycle-methodology-panel"
        id="microcycle-methodology-toggle"
      >
        <span className={styles.dayTitlesToggleLeft}>
          <span className={styles.dayTitlesChevron} aria-hidden>
            {open ? "▾" : "▸"}
          </span>
          <span className={styles.dayTitlesToggleTitle}>Metodyka</span>
          <span className={styles.dayTitlesCountBadge}>ściągawka tygodnia</span>
        </span>
        <span className={styles.dayTitlesToggleHint}>{open ? "Zwiń" : "Rozwiń"}</span>
      </button>

      <div
        id="microcycle-methodology-panel"
        className={styles.dayTitlesPanel}
        hidden={!open}
        role="region"
        aria-labelledby="microcycle-methodology-toggle"
      >
        <p className={styles.methodologyGlance}>
          Siłownia → transfer 10–15′ → boisko. Szczyt obciążenia najdalej od meczu, potem schodzisz.
        </p>

        <div
          className={`${styles.viewSwitcher} ${styles.methodologyTabs}`}
          role="tablist"
          aria-label="Widok metodyki"
        >
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              id={`methodology-tab-${opt.id}`}
              aria-selected={view === opt.id}
              aria-controls={`methodology-panel-${opt.id}`}
              className={`${styles.viewSwitcherBtn} ${
                view === opt.id ? styles.viewSwitcherBtnActive : ""
              }`}
              onClick={() => selectView(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {view === "week" && (
          <div
            id="methodology-panel-week"
            role="tabpanel"
            aria-labelledby="methodology-tab-week"
            className={styles.methodologyView}
          >
            <div className={styles.methodologyWeekStrip}>
              {weekDays.map((p) => {
                const dominant = MOTOR_DOMINANT_BY_ID[p.dominant];
                return (
                  <article
                    key={p.offset}
                    className={styles.methodologyWeekCard}
                    style={{ borderTopColor: dominant?.color ?? "#94a3b8" }}
                  >
                    <p className={styles.methodologyWeekMd}>
                      {formatMatchDayLabel(p.offset)}
                    </p>
                    <span
                      className={styles.motorDominantChip}
                      style={{
                        borderColor: dominant?.color,
                        color: dominant?.color,
                      }}
                    >
                      {dominant?.shortLabel ?? p.dominant}
                    </span>
                    <p className={styles.methodologyWeekMeta}>
                      {p.targets.minutes}′ · {p.targets.srpe} AU
                    </p>
                    <p className={styles.methodologyWeekLoad}>
                      D {p.targets.totalDistancePct}% · HSR {p.targets.hsrPct}% · Sp{" "}
                      {p.targets.sprintPct}%
                    </p>
                  </article>
                );
              })}
            </div>
            <ul className={styles.methodologyLegend} aria-label="Dominanty">
              {MOTOR_DOMINANTS.filter((d) => d.id !== "off").map((d) => (
                <li key={d.id} title={d.loadFocus}>
                  <span
                    className={styles.methodologyLegendDot}
                    style={{ background: d.color }}
                    aria-hidden
                  />
                  {d.shortLabel}
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "when" && (
          <div
            id="methodology-panel-when"
            role="tabpanel"
            aria-labelledby="methodology-tab-when"
            className={styles.methodologyView}
          >
            <div className={styles.methodologyWhenGrid}>
              {placementByDay.map((group) => (
                <article key={group.day} className={styles.methodologyWhenCard}>
                  <h3 className={styles.methodologyWhenDay}>{group.day}</h3>
                  <ul>
                    {group.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === "exceptions" && (
          <div
            id="methodology-panel-exceptions"
            role="tabpanel"
            aria-labelledby="methodology-tab-exceptions"
            className={styles.methodologyView}
          >
            <h3 className={styles.methodologyHeading}>Mecz w sobotę</h3>
            <ol className={styles.methodologySatStrip}>
              {AMATEUR_SATURDAY_SHIFT.map((row) => (
                <li key={row.weekday} title={row.note}>
                  <strong>{row.weekday}</strong>
                  <span>{row.role}</span>
                </li>
              ))}
            </ol>
            <h3 className={styles.methodologyHeading}>Kiedy zejść z modelu</h3>
            <ul className={styles.methodologyExceptionList}>
              {AMATEUR_MODEL_EXCEPTIONS.map((row) => (
                <li key={row.situation}>
                  <strong>{row.situation}</strong>
                  <span>{row.change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "rules" && (
          <div
            id="methodology-panel-rules"
            role="tabpanel"
            aria-labelledby="methodology-tab-rules"
            className={styles.methodologyView}
          >
            <ol className={styles.methodologyRules}>
              {methodologyPrincipleCatalog().map((p) => (
                <li key={p.id}>
                  <strong>{p.shortLabel}</strong>
                  <span>{p.text}</span>
                </li>
              ))}
            </ol>
            <h3 className={styles.methodologyHeading}>Boisko</h3>
            <ul className={styles.methodologyPitchRules}>
              {PITCH_MANIPULATION_RULES.map((r) => (
                <li key={r.rule}>
                  <strong>{r.rule}</strong>
                  <span>{r.effect}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
