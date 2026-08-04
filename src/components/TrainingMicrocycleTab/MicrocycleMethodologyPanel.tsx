"use client";

import React, { useCallback, useState } from "react";
import { MOTOR_DOMINANTS } from "@/types/microcycleMotor";
import {
  MICROCYCLE_ALERT_THRESHOLDS,
  MICROCYCLE_PRINCIPLES,
  MOTOR_DAY_PRESETS,
  PITCH_MANIPULATION_RULES,
  SSG_FORMATS,
} from "@/lib/microcycle/motorModel";
import { formatMatchDayLabel } from "@/utils/matchDayLabels";
import styles from "./TrainingMicrocycleTab.module.css";

const STORAGE_KEY = "microcycle_methodology_open";

export default function MicrocycleMethodologyPanel() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
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

  const t = MICROCYCLE_ALERT_THRESHOLDS;

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
          <span className={styles.dayTitlesCountBadge}>
            dominanty · boiska · progi · zasady
          </span>
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
        <p className={styles.dayTitlesHint}>
          Periodyzacja Taktyczna (Frade) połączona z modelem obciążeniowym GPS. Obciążenie rośnie do
          środka tygodnia i spada przed meczem: MD-3 to szczyt objętości, MD-2 szczyt intensywności,
          MD-1 tylko aktywacja.
        </p>

        <h3 className={styles.methodologyHeading}>Dominanty wysiłkowe</h3>
        <div className={styles.methodologyTableWrap}>
          <table className={styles.methodologyTable}>
            <thead>
              <tr>
                <th>Dominanta</th>
                <th>Co obciąża</th>
                <th>m²/gracz</th>
              </tr>
            </thead>
            <tbody>
              {MOTOR_DOMINANTS.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span
                      className={styles.motorDominantChip}
                      style={{ borderColor: d.color, color: d.color }}
                    >
                      {d.shortLabel}
                    </span>
                  </td>
                  <td>{d.loadFocus}</td>
                  <td>
                    {d.areaPerPlayer
                      ? `${d.areaPerPlayer.min}–${d.areaPerPlayer.max}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.methodologyHeading}>Dni mikrocyklu (% obciążenia meczowego)</h3>
        <div className={styles.methodologyTableWrap}>
          <table className={styles.methodologyTable}>
            <thead>
              <tr>
                <th>Dzień</th>
                <th>Dominanta</th>
                <th>Dyst.</th>
                <th>HSR</th>
                <th>Sprint</th>
                <th>Acc/Dec</th>
                <th>sRPE</th>
                <th>Czas</th>
              </tr>
            </thead>
            <tbody>
              {[...MOTOR_DAY_PRESETS]
                .sort((a, b) => a.offset - b.offset)
                .map((p) => (
                  <tr key={p.offset}>
                    <td>
                      <strong>{formatMatchDayLabel(p.offset)}</strong>
                    </td>
                    <td>{p.title}</td>
                    <td>{p.targets.totalDistancePct}%</td>
                    <td>{p.targets.hsrPct}%</td>
                    <td>{p.targets.sprintPct}%</td>
                    <td>{p.targets.accDecPct}%</td>
                    <td>{p.targets.srpe} AU</td>
                    <td>{p.targets.minutes}′</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.methodologyHeading}>Dobór boiska</h3>
        <div className={styles.methodologyTableWrap}>
          <table className={styles.methodologyTable}>
            <thead>
              <tr>
                <th>Format</th>
                <th>Wymiary</th>
                <th>m²/gracz</th>
                <th>Efekt fizjologiczny</th>
                <th>Efekt taktyczny</th>
                <th>Dzień</th>
              </tr>
            </thead>
            <tbody>
              {SSG_FORMATS.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.label}</strong>
                  </td>
                  <td>
                    {f.length}×{f.width}
                  </td>
                  <td>{f.areaPerPlayer}</td>
                  <td>{f.physiological}</td>
                  <td>{f.tactical}</td>
                  <td>{f.recommendedOffsets.map(formatMatchDayLabel).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={styles.methodologyHeading}>Manipulacja obciążeniem</h3>
        <ul className={styles.methodologyList}>
          {PITCH_MANIPULATION_RULES.map((r) => (
            <li key={r.rule}>
              <strong>{r.rule}</strong> — {r.effect}
            </li>
          ))}
        </ul>

        <h3 className={styles.methodologyHeading}>Progi alarmowe</h3>
        <ul className={styles.methodologyList}>
          <li>
            ACWR poza <strong>{t.acwrMin}–{t.acwrMax}</strong> — ostrzeżenie, powyżej{" "}
            <strong>{t.acwrCriticalMax}</strong> strefa ryzyka.
          </li>
          <li>
            Skok obciążenia tygodniowego powyżej <strong>{t.weeklyJumpPctMax}%</strong>.
          </li>
          <li>
            Monotonia Fostera powyżej <strong>{t.monotonyMax.toFixed(1)}</strong>, strain powyżej{" "}
            <strong>{t.strainMax} AU</strong>.
          </li>
          <li>
            Dzień ciężki od <strong>{t.heavyDaySrpe} AU</strong> — nigdy dwa pod rząd.
          </li>
          <li>
            MD-1 maksymalnie <strong>{t.md1MaxMinutes} min</strong>.
          </li>
          <li>
            Sprint ≥90% Vmax minimum <strong>{t.minSprintExposures}×</strong> w mikrocyklu, Nordic{" "}
            <strong>{t.minNordicSessions}–{t.maxNordicSessions}×</strong>, siła{" "}
            <strong>{t.minStrengthSessions}–{t.maxStrengthSessions}×</strong>.
          </li>
          <li>
            Deload co <strong>{t.deloadEveryWeeks}</strong> mikrocykle, do{" "}
            <strong>{t.deloadMaxPctOfPrevious}%</strong> poprzedniego tygodnia.
          </li>
        </ul>

        <h3 className={styles.methodologyHeading}>Dziesięć zasad</h3>
        <ol className={styles.methodologyList}>
          {MICROCYCLE_PRINCIPLES.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>

        <p className={styles.methodologySources}>
          Źródła: Frade (Periodização Táctica), Buchheit i Lacome (monitoring obciążenia),
          Martín-García i in. 2018 (JSCR), Malone / Owen / Gabbett (HSR i ryzyko urazu),
          Van Dyk i in. 2019 (meta-analiza Nordic), Sarmento i in. (SSG), Bangsbo, Tamarit.
        </p>
      </div>
    </section>
  );
}
