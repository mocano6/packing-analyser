"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { LaczyTeamFixture, TrainingMicrocycle } from "@/types/trainingMicrocycle";
import { toIsoDateLocal } from "@/utils/matchDayLabels";
import {
  buildMonthCalendarCells,
  fixtureCalendarChip,
  fixtureIsoDate,
  formatFixtureChipLabel,
  groupFixturesByIsoDate,
  groupManualCalendarChipsByIsoDate,
  isIsoInWeek,
  monthFromIso,
  shiftCalendarMonth,
  weekStartIsoFromDateIso,
} from "@/utils/microcycleFixtures";
import styles from "./TrainingMicrocycleTab.module.css";

const WEEKDAY_HEADERS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"] as const;
const MONTHS_PL = [
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
] as const;

function formatMonthHeadingPl(year: number, monthIndex: number): string {
  const name = MONTHS_PL[monthIndex] ?? "";
  const cap = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
  return `${cap} ${year}`;
}

export type MicrocycleFixturesCalendarProps = {
  weekStartIso: string;
  ownFixtures: LaczyTeamFixture[];
  ownTeamId: string | null;
  ownTeamName: string | null;
  watchFixtures: LaczyTeamFixture[];
  watchTeamId: string | null;
  watchTeamName: string | null;
  /** Mikrocykle sezonu — terminy dodane ręcznie też widać na kalendarzu. */
  microcycles?: Pick<TrainingMicrocycle, "weekStartIso" | "matches">[];
  onSelectWeek: (weekStartIso: string) => void;
};

export default function MicrocycleFixturesCalendar({
  weekStartIso,
  ownFixtures,
  ownTeamId,
  ownTeamName,
  watchFixtures,
  watchTeamId,
  watchTeamName,
  microcycles = [],
  onSelectWeek,
}: MicrocycleFixturesCalendarProps) {
  const [{ year, monthIndex }, setMonth] = useState(() => monthFromIso(weekStartIso));

  useEffect(() => {
    const next = monthFromIso(weekStartIso);
    setMonth((prev) =>
      prev.year === next.year && prev.monthIndex === next.monthIndex ? prev : next
    );
  }, [weekStartIso]);

  const cells = useMemo(
    () => buildMonthCalendarCells(year, monthIndex),
    [year, monthIndex]
  );
  const ownByDay = useMemo(() => groupFixturesByIsoDate(ownFixtures), [ownFixtures]);
  const watchByDay = useMemo(() => groupFixturesByIsoDate(watchFixtures), [watchFixtures]);
  const manualByDay = useMemo(() => {
    const occupied = new Set<string>();
    for (const f of ownFixtures) {
      const iso = fixtureIsoDate(f);
      if (iso) occupied.add(iso);
    }
    return groupManualCalendarChipsByIsoDate(microcycles, occupied);
  }, [microcycles, ownFixtures]);
  const todayIso = toIsoDateLocal(new Date());

  const goMonth = (delta: number) => {
    setMonth((prev) => shiftCalendarMonth(prev.year, prev.monthIndex, delta));
  };

  const hasAny = ownFixtures.length > 0 || watchFixtures.length > 0 || manualByDay.size > 0;

  return (
    <div className={styles.lnpCalendar} role="region" aria-label="Kalendarz meczów">
      <div className={styles.lnpCalendarNav}>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => goMonth(-1)}
          aria-label="Poprzedni miesiąc"
        >
          ←
        </button>
        <p className={styles.lnpCalendarTitle}>{formatMonthHeadingPl(year, monthIndex)}</p>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => goMonth(1)}
          aria-label="Następny miesiąc"
        >
          →
        </button>
        <button
          type="button"
          className={styles.smallBtn}
          onClick={() => setMonth(monthFromIso(weekStartIso))}
        >
          Tydzień mikrocyklu
        </button>
      </div>
      <p className={styles.lnpCalendarHint}>
        Mecze z linku ŁNP wpadają same do mikrocyklu, którego tydzień (zaznaczony)
        pokrywa się z datą meczu. Terminy dodane ręcznie też widać na kalendarzu.
      </p>
      <div className={styles.lnpCalendarGrid} role="grid" aria-label={formatMonthHeadingPl(year, monthIndex)}>
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className={styles.lnpCalendarDow} role="columnheader">
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const own = ownByDay.get(cell.iso) ?? [];
          const watch = watchByDay.get(cell.iso) ?? [];
          const manual = manualByDay.get(cell.iso) ?? [];
          const inWeek = isIsoInWeek(cell.iso, weekStartIso);
          const isToday = cell.iso === todayIso;
          const weekStart = weekStartIsoFromDateIso(cell.iso);
          const ownChips = ownTeamId
            ? own.map((f) => fixtureCalendarChip(f, ownTeamId))
            : [];
          const hasOwnHome = ownChips.some((c) => c.isHome) || manual.some((c) => c.isHome);
          const hasOwnAway = ownChips.some((c) => !c.isHome) || manual.some((c) => !c.isHome);
          const labelParts = [String(cell.dayOfMonth)];
          if (own.length > 0 && ownTeamId) {
            labelParts.push(own.map((f) => formatFixtureChipLabel(f, ownTeamId)).join(", "));
          }
          if (manual.length > 0) {
            labelParts.push(manual.map((c) => c.label).join(", "));
          }
          if (watch.length > 0 && watchTeamId) {
            labelParts.push(
              `podgląd: ${watch.map((f) => formatFixtureChipLabel(f, watchTeamId)).join(", ")}`
            );
          }
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              className={[
                styles.lnpCalendarCell,
                cell.inMonth ? "" : styles.lnpCalendarCellMuted,
                inWeek ? styles.lnpCalendarCellInWeek : "",
                isToday ? styles.lnpCalendarCellToday : "",
                hasOwnHome && !hasOwnAway ? styles.lnpCalendarCellHome : "",
                hasOwnAway && !hasOwnHome ? styles.lnpCalendarCellAway : "",
                hasOwnHome && hasOwnAway ? styles.lnpCalendarCellOwn : "",
                watch.length > 0 && own.length === 0 && manual.length === 0
                  ? styles.lnpCalendarCellWatch
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectWeek(weekStart)}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={inWeek}
              aria-label={labelParts.join(" · ")}
            >
              <span className={styles.lnpCalendarDayNum}>{cell.dayOfMonth}</span>
              {own.map((f, i) => {
                const chip = ownChips[i] ?? null;
                return (
                  <span
                    key={f.matchId}
                    className={`${styles.lnpCalendarChip} ${
                      chip
                        ? chip.isHome
                          ? styles.lnpCalendarChipHome
                          : styles.lnpCalendarChipAway
                        : styles.lnpCalendarChipOwn
                    }`}
                  >
                    {chip ? (
                      <>
                        <span className={styles.lnpCalendarVenue} aria-hidden>
                          {chip.venueShort}
                        </span>
                        <span className={styles.lnpCalendarChipText}>
                          {[chip.timeLabel, chip.opponent, f.scoreFinal]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                      </>
                    ) : (
                      f.guestName
                    )}
                  </span>
                );
              })}
              {manual.map((chip, i) => (
                <span
                  key={`m-${cell.iso}-${i}`}
                  className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipManual} ${
                    chip.isHome ? styles.lnpCalendarChipHome : styles.lnpCalendarChipAway
                  }`}
                >
                  <span className={styles.lnpCalendarVenue} aria-hidden>
                    {chip.venueShort}
                  </span>
                  <span className={styles.lnpCalendarChipText}>
                    {[chip.timeLabel, chip.opponent].filter(Boolean).join(" ")}
                  </span>
                </span>
              ))}
              {watch.map((f) => {
                const chip = watchTeamId ? fixtureCalendarChip(f, watchTeamId) : null;
                return (
                  <span
                    key={`w-${f.matchId}`}
                    className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipWatch} ${
                      chip
                        ? chip.isHome
                          ? styles.lnpCalendarChipWatchHome
                          : styles.lnpCalendarChipWatchAway
                        : ""
                    }`}
                  >
                    {chip ? (
                      <>
                        <span className={styles.lnpCalendarVenue} aria-hidden>
                          {chip.venueShort}
                        </span>
                        <span className={styles.lnpCalendarChipText}>
                          {[chip.timeLabel, chip.opponent].filter(Boolean).join(" ")}
                        </span>
                      </>
                    ) : (
                      f.guestName
                    )}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
      <div className={styles.lnpCalendarLegend} aria-hidden={!hasAny}>
        <span className={styles.lnpCalendarLegendItem}>
          <span className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipHome}`}>
            <span className={styles.lnpCalendarVenue} aria-hidden>
              D
            </span>
            <span className={styles.lnpCalendarChipText}>Dom</span>
          </span>
        </span>
        <span className={styles.lnpCalendarLegendItem}>
          <span className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipAway}`}>
            <span className={styles.lnpCalendarVenue} aria-hidden>
              W
            </span>
            <span className={styles.lnpCalendarChipText}>Wyjazd</span>
          </span>
        </span>
        {(watchFixtures.length > 0 || watchTeamName) && (
          <span className={styles.lnpCalendarLegendItem}>
            <span className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipWatch}`}>
              {watchTeamName ? `Podgląd: ${watchTeamName}` : "Podgląd"}
            </span>
          </span>
        )}
        {ownTeamName && (
          <span className={styles.lnpCalendarLegendItem}>
            <span className={styles.lnpCalendarLegendTeam}>{ownTeamName}</span>
          </span>
        )}
        {manualByDay.size > 0 && (
          <span className={styles.lnpCalendarLegendItem}>
            <span className={`${styles.lnpCalendarChip} ${styles.lnpCalendarChipManual} ${styles.lnpCalendarChipHome}`}>
              Ręczny
            </span>
          </span>
        )}
        <span className={styles.lnpCalendarLegendWeek}>Tydzień mikrocyklu</span>
      </div>
    </div>
  );
}
