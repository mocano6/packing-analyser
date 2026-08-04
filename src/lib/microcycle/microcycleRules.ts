import type {
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
} from "@/types/trainingMicrocycle";
import type { MotorTagId } from "@/types/microcycleMotor";
import { MOTOR_DOMINANT_BY_ID } from "@/types/microcycleMotor";
import { MICROCYCLE_ALERT_THRESHOLDS } from "@/lib/microcycle/motorModel";
import { blockAreaPerPlayer } from "@/utils/microcycleTrainingBlocks";
import {
  computeAcwr,
  isHeavyDay,
  resolveWeekLoads,
  summarizeWeeklyLoad,
  weekOverWeekChangePct,
  type ResolvedDayLoad,
} from "@/utils/microcycleLoad";
import { formatMatchDayLabel, weekdayShortPl } from "@/utils/matchDayLabels";

export type MicrocycleRuleSeverity = "critical" | "warning" | "info";

export interface MicrocycleViolation {
  ruleId: string;
  severity: MicrocycleRuleSeverity;
  /** Krótka nazwa złamanej zasady. */
  title: string;
  /** Co konkretnie jest nie tak. */
  message: string;
  /** Co zrobić. */
  hint?: string;
  /** Dzień, którego dotyczy (0 = pn), null = cały mikrocykl. */
  dayIndex: number | null;
}

export interface MicrocycleRuleContext {
  microcycle: TrainingMicrocycle;
  blocks: MicrocycleTrainingBlock[];
  /** sRPE poprzednich mikrocykli, od najnowszego do najstarszego. */
  previousWeeklySrpe: number[];
}

function dayLabel(load: ResolvedDayLoad): string {
  return `${weekdayShortPl(load.dayIndex)} (${formatMatchDayLabel(load.offset)})`;
}

function trainingDays(loads: ResolvedDayLoad[]): ResolvedDayLoad[] {
  return loads.filter((l) => !l.isMatchDay && l.targets.srpe > 0);
}

function byOffset(loads: ResolvedDayLoad[], offset: number): ResolvedDayLoad | undefined {
  return loads.find((l) => !l.isMatchDay && l.offset === offset);
}

function countTag(blocks: MicrocycleTrainingBlock[], tag: MotorTagId): number {
  const days = new Set<number>();
  for (const b of blocks) {
    if (b.tags.includes(tag)) days.add(b.dayIndex);
  }
  return days.size;
}

function dayMinutes(load: ResolvedDayLoad): number {
  return load.plannedMinutes ?? load.targets.minutes;
}

function checkDayOrdering(loads: ResolvedDayLoad[]): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  const training = trainingDays(loads);
  if (training.length < 2) return out;

  const md3 = byOffset(loads, -3);
  if (md3) {
    const heavier = training.filter((l) => l.targets.srpe > md3.targets.srpe);
    if (heavier.length > 0) {
      out.push({
        ruleId: "md3_heaviest",
        severity: "critical",
        title: "MD-3 musi być najcięższym dniem",
        message: `Cięższy niż MD-3 (${md3.targets.srpe} AU) jest: ${heavier
          .map((l) => `${dayLabel(l)} ${l.targets.srpe} AU`)
          .join(", ")}.`,
        hint: "Przenieś objętość na MD-3 albo obniż sRPE pozostałych dni.",
        dayIndex: md3.dayIndex,
      });
    }
  }

  const md1 = byOffset(loads, -1);
  if (md1) {
    const others = training.filter((l) => l.offset !== -1 && l.offset <= -2);
    const lighter = others.filter((l) => l.targets.srpe < md1.targets.srpe);
    if (lighter.length > 0) {
      out.push({
        ruleId: "md1_lightest",
        severity: "critical",
        title: "MD-1 musi być najlżejszym dniem treningowym",
        message: `MD-1 ma ${md1.targets.srpe} AU, a lżejsze są: ${lighter
          .map((l) => `${dayLabel(l)} ${l.targets.srpe} AU`)
          .join(", ")}.`,
        hint: "Skróć MD-1 do aktywacji i primingu — bez bloków rozwojowych.",
        dayIndex: md1.dayIndex,
      });
    }
    const minutes = dayMinutes(md1);
    if (minutes > MICROCYCLE_ALERT_THRESHOLDS.md1MaxMinutes) {
      out.push({
        ruleId: "md1_duration",
        severity: "warning",
        title: "MD-1 zbyt długi",
        message: `Zaplanowano ${minutes} min, limit to ${MICROCYCLE_ALERT_THRESHOLDS.md1MaxMinutes} min.`,
        hint: "Skróć odprawę i taktykę — ostatnie 24 h przed meczem: nic nowego.",
        dayIndex: md1.dayIndex,
      });
    }
  }

  for (let i = 0; i < 6; i += 1) {
    const a = loads[i];
    const b = loads[i + 1];
    if (!a || !b) continue;
    if (isHeavyDay(a) && isHeavyDay(b)) {
      out.push({
        ruleId: "no_two_heavy_in_row",
        severity: "warning",
        title: "Dwa ciężkie dni pod rząd",
        message: `${dayLabel(a)} ${a.targets.srpe} AU i ${dayLabel(b)} ${b.targets.srpe} AU — oba powyżej ${MICROCYCLE_ALERT_THRESHOLDS.heavyDaySrpe} AU.`,
        hint: "Wstaw dzień o niższym obciążeniu między nimi.",
        dayIndex: b.dayIndex,
      });
    }
  }

  return out;
}

function checkTagExposure(
  loads: ResolvedDayLoad[],
  blocks: MicrocycleTrainingBlock[]
): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  const t = MICROCYCLE_ALERT_THRESHOLDS;

  const sprintDays = countTag(blocks, "sprint_max");
  if (sprintDays < t.minSprintExposures) {
    out.push({
      ruleId: "sprint_exposure",
      severity: "critical",
      title: "Brak ekspozycji na sprint maksymalny",
      message: "W mikrocyklu nie ma bloku z tagiem sprintu ≥90% Vmax.",
      hint: "Dodaj sprinty na MD-2 — unikanie sprintu zwiększa ryzyko urazu tylnej taśmy.",
      dayIndex: byOffset(loads, -2)?.dayIndex ?? null,
    });
  }

  const md4 = byOffset(loads, -4);
  if (md4) {
    const md4Sprint = blocks.some(
      (b) => b.dayIndex === md4.dayIndex && b.tags.includes("sprint_max")
    );
    if (md4Sprint) {
      out.push({
        ruleId: "sprint_on_md4",
        severity: "warning",
        title: "Sprint maksymalny na MD-4",
        message: "MD-4 to dzień napięcia — mięśnie są jeszcze w fazie remodelingu po meczu.",
        hint: "Przenieś sprinty na MD-2, na MD-4 zostaw akceleracje i hamowania.",
        dayIndex: md4.dayIndex,
      });
    }
  }

  const nordicDays = countTag(blocks, "nordic");
  if (nordicDays < t.minNordicSessions) {
    out.push({
      ruleId: "nordic_exposure",
      severity: "warning",
      title: "Brak Nordic Hamstring",
      message: "Nordic nie występuje w żadnym dniu mikrocyklu.",
      hint: `Zaplanuj ${t.minNordicSessions}–${t.maxNordicSessions}× w tygodniu — redukcja urazów hamstringów o 50–70%.`,
      dayIndex: byOffset(loads, -4)?.dayIndex ?? null,
    });
  }

  const strengthDays = countTag(blocks, "strength_max");
  if (strengthDays < t.minStrengthSessions) {
    out.push({
      ruleId: "strength_exposure",
      severity: "warning",
      title: "Brak siły maksymalnej",
      message: "W mikrocyklu nie ma bloku siłowego.",
      hint: `Utrzymaj ${t.minStrengthSessions}–${t.maxStrengthSessions}× w tygodniu, inaczej strata siły w sezonie 5–10%.`,
      dayIndex: byOffset(loads, -4)?.dayIndex ?? null,
    });
  } else if (strengthDays > t.maxStrengthSessions) {
    out.push({
      ruleId: "strength_volume",
      severity: "info",
      title: "Dużo dni z siłą maksymalną",
      message: `Siła występuje w ${strengthDays} dniach — model przewiduje ${t.maxStrengthSessions}.`,
      dayIndex: null,
    });
  }

  return out;
}

function checkPitchDensity(
  loads: ResolvedDayLoad[],
  blocks: MicrocycleTrainingBlock[]
): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  for (const load of loads) {
    const range = MOTOR_DOMINANT_BY_ID[load.dominant]?.areaPerPlayer;
    if (!range) continue;
    for (const block of blocks.filter((b) => b.dayIndex === load.dayIndex)) {
      const area = blockAreaPerPlayer(block);
      if (area == null) continue;
      if (area < range.min || area > range.max) {
        const dominantLabel = MOTOR_DOMINANT_BY_ID[load.dominant].label.toLowerCase();
        out.push({
          ruleId: "pitch_density_mismatch",
          severity: "warning",
          title: "Boisko niezgodne z dominantą dnia",
          message: `${dayLabel(load)} — „${block.name}" ma ${area} m²/gracz, a dominanta „${dominantLabel}" wymaga ${range.min}–${range.max} m²/gracz.`,
          hint:
            area > range.max
              ? "Zwęź boisko albo dodaj graczy — większa gęstość daje więcej akcji i hamowań."
              : "Powiększ boisko albo zdejmij graczy — potrzebujesz przestrzeni na bieg i sprint.",
          dayIndex: load.dayIndex,
        });
      }
    }
  }
  return out;
}

function checkWeeklyLoad(
  microcycle: TrainingMicrocycle,
  loads: ResolvedDayLoad[],
  previousWeeklySrpe: number[]
): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  const t = MICROCYCLE_ALERT_THRESHOLDS;
  const summary = summarizeWeeklyLoad(loads);

  const acwr = computeAcwr(summary.totalSrpe, previousWeeklySrpe);
  if (acwr.ratio == null || !acwr.reliable) {
    out.push({
      ruleId: "acwr_history",
      severity: "info",
      title: "ACWR bez pełnej historii",
      message: `Do wyliczenia potrzebne są 4 tygodnie, mamy ${acwr.weeksOfHistory + 1}.`,
      hint: "Wskaźnik będzie wiarygodny po kolejnych mikrocyklach.",
      dayIndex: null,
    });
  } else {
    const ratio = acwr.ratio;
    const rounded = ratio.toFixed(2);
    if (ratio > t.acwrCriticalMax || ratio < t.acwrMin) {
      out.push({
        ruleId: "acwr_range",
        severity: "critical",
        title: "ACWR w strefie ryzyka",
        message: `ACWR = ${rounded} (bezpieczny zakres ${t.acwrMin}–${t.acwrMax}).`,
        hint:
          ratio < t.acwrMin
            ? "Za mały bodziec względem historii — podnieś objętość MD-3."
            : "Skok obciążenia zbyt duży — obetnij objętość w tym tygodniu.",
        dayIndex: null,
      });
    } else if (ratio > t.acwrMax) {
      out.push({
        ruleId: "acwr_range",
        severity: "warning",
        title: "ACWR powyżej zalecanego zakresu",
        message: `ACWR = ${rounded} (zalecane ${t.acwrMin}–${t.acwrMax}).`,
        hint: "Rozważ obniżenie objętości albo wcześniejszy deload.",
        dayIndex: null,
      });
    }
  }

  const jump = weekOverWeekChangePct(summary.totalSrpe, previousWeeklySrpe[0]);
  if (jump != null && jump > t.weeklyJumpPctMax) {
    out.push({
      ruleId: "weekly_jump",
      severity: "warning",
      title: "Zbyt duży skok obciążenia tygodniowego",
      message: `Wzrost o ${Math.round(jump)}% względem poprzedniego mikrocyklu (limit ${t.weeklyJumpPctMax}%).`,
      hint: "Rozłóż wzrost na dwa tygodnie.",
      dayIndex: null,
    });
  }

  if (summary.monotony != null && summary.monotony > t.monotonyMax) {
    out.push({
      ruleId: "monotony",
      severity: "warning",
      title: "Wysoka monotonia obciążenia",
      message: `Monotonia ${summary.monotony.toFixed(2)} (limit ${t.monotonyMax.toFixed(1)}).`,
      hint: "Zróżnicuj dni — wyraźniej rozjedź MD-3 i MD-1.",
      dayIndex: null,
    });
  }

  if (summary.strain != null && summary.strain > t.strainMax) {
    out.push({
      ruleId: "strain",
      severity: "warning",
      title: "Strain powyżej progu",
      message: `Strain ${Math.round(summary.strain)} AU (limit ${t.strainMax}).`,
      hint: "Obniż obciążenie lub zwiększ zróżnicowanie dni.",
      dayIndex: null,
    });
  }

  const isDeloadWeek =
    microcycle.number > 0 && microcycle.number % t.deloadEveryWeeks === 0;
  const previous = previousWeeklySrpe[0];
  if (isDeloadWeek && previous && previous > 0) {
    const pctOfPrevious = (summary.totalSrpe / previous) * 100;
    if (pctOfPrevious > t.deloadMaxPctOfPrevious) {
      out.push({
        ruleId: "deload_due",
        severity: "warning",
        title: "Zaplanuj deload",
        message: `Mikrocykl ${microcycle.number} to co ${t.deloadEveryWeeks}. tydzień, a obciążenie to ${Math.round(pctOfPrevious)}% poprzedniego.`,
        hint: `Zejdź do ${t.deloadMaxPctOfPrevious}% lub niżej — deload co ${t.deloadEveryWeeks} tygodnie, bezwarunkowo.`,
        dayIndex: null,
      });
    }
  }

  return out;
}

function checkTwoMatchWeek(
  microcycle: TrainingMicrocycle,
  loads: ResolvedDayLoad[]
): MicrocycleViolation[] {
  const matchCount = (microcycle.matches ?? []).filter((m) => m.opponent.trim()).length;
  if (matchCount < 2) return [];
  const heavy = trainingDays(loads).filter(isHeavyDay);
  if (heavy.length === 0) return [];
  return [
    {
      ruleId: "two_matches_development",
      severity: "warning",
      title: "Trening rozwojowy w tygodniu z dwoma meczami",
      message: `Ciężkie dni: ${heavy.map(dayLabel).join(", ")}.`,
      hint: "Przy dwóch meczach zostaje utrzymanie i regeneracja — rotacja składu jest częścią periodyzacji.",
      dayIndex: heavy[0].dayIndex,
    },
  ];
}

const SEVERITY_ORDER: Record<MicrocycleRuleSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/** Ocena mikrocyklu — zwraca listę naruszeń posortowaną po wadze. */
export function evaluateMicrocycleRules(ctx: MicrocycleRuleContext): MicrocycleViolation[] {
  const { microcycle, blocks, previousWeeklySrpe } = ctx;
  const loads = resolveWeekLoads(microcycle, blocks);

  const violations: MicrocycleViolation[] = [
    ...checkDayOrdering(loads),
    ...checkWeeklyLoad(microcycle, loads, previousWeeklySrpe),
    ...checkTwoMatchWeek(microcycle, loads),
  ];

  if (blocks.length === 0) {
    violations.push({
      ruleId: "no_blocks",
      severity: "info",
      title: "Brak rozpisanych bloków",
      message: "Reguły dotyczące sprintu, siły i boisk włączą się po dodaniu bloków treningowych.",
      hint: "Użyj przycisku „Z presetu” w dniu, aby wstawić bloki z modelu.",
      dayIndex: null,
    });
  } else {
    violations.push(
      ...checkTagExposure(loads, blocks),
      ...checkPitchDensity(loads, blocks)
    );
  }

  return violations.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.dayIndex ?? 9) - (b.dayIndex ?? 9) ||
      a.ruleId.localeCompare(b.ruleId)
  );
}

export function countBySeverity(
  violations: MicrocycleViolation[]
): Record<MicrocycleRuleSeverity, number> {
  return violations.reduce(
    (acc, v) => {
      acc[v.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 } as Record<MicrocycleRuleSeverity, number>
  );
}
