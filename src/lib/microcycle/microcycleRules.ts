import type {
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
} from "@/types/trainingMicrocycle";
import type { MotorTagId } from "@/types/microcycleMotor";
import {
  MICROCYCLE_ALERT_THRESHOLDS,
  methodologyPrincipleCatalog,
  type MicrocycleControlPrincipleId,
} from "@/lib/microcycle/motorModel";
import {
  isHeavyDay,
  resolveWeekLoads,
  summarizeWeeklyLoad,
  type ResolvedDayLoad,
} from "@/utils/microcycleLoad";
import { formatMatchDayLabel, weekdayShortPl } from "@/utils/matchDayLabels";

export type MicrocycleRuleSeverity = "critical" | "warning" | "info";

export interface MicrocycleViolation {
  ruleId: string;
  /** Zasada ze ściągawki metodyki — null = wyjątek poza listą 10. */
  principleId: MicrocycleControlPrincipleId | null;
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

export type MethodologyCheckStatus = "ok" | "warn" | "fail" | "skip";

export interface MethodologyPrincipleCheck {
  id: MicrocycleControlPrincipleId;
  shortLabel: string;
  text: string;
  status: MethodologyCheckStatus;
  items: MicrocycleViolation[];
}

const BLOCK_BASED_PRINCIPLES = new Set<MicrocycleControlPrincipleId>([
  "gym_first",
  "nordic_timing",
  "sprint_week",
  "split_groups",
  "gym_serves_match",
]);

export function extraMethodologyViolations(
  violations: MicrocycleViolation[]
): MicrocycleViolation[] {
  return violations.filter((v) => v.principleId == null);
}

export function methodologyPrincipleChecks(
  violations: MicrocycleViolation[],
  options: { hasBlocks: boolean }
): MethodologyPrincipleCheck[] {
  return methodologyPrincipleCatalog().map((p) => {
    const items = violations.filter((v) => v.principleId === p.id);
    let status: MethodologyCheckStatus;
    if (items.length === 0) {
      status =
        !options.hasBlocks && BLOCK_BASED_PRINCIPLES.has(p.id) ? "skip" : "ok";
    } else if (items.some((v) => v.severity === "critical")) {
      status = "fail";
    } else {
      status = "warn";
    }
    return { ...p, status, items };
  });
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

function volumeLoad(loads: ResolvedDayLoad[]): ResolvedDayLoad | undefined {
  const duration = trainingDays(loads).find((l) => l.dominant === "duration");
  if (duration && duration.targets.srpe > 0) return duration;
  const md3 = byOffset(loads, -3);
  if (md3 && md3.targets.srpe > 0) return md3;
  return undefined;
}

function checkDayOrdering(loads: ResolvedDayLoad[]): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  const training = trainingDays(loads);
  if (training.length < 2) return out;

  const volume = volumeLoad(loads);
  if (volume) {
    const heavier = training.filter((l) => l.targets.srpe > volume.targets.srpe);
    if (heavier.length > 0) {
      out.push({
        ruleId: "volume_heaviest",
        principleId: "load_shape",
        severity: "critical",
        title: "Dzień objętości musi być najcięższy",
        message: `Cięższy niż ${dayLabel(volume)} (${volume.targets.srpe} AU) jest: ${heavier
          .map((l) => `${dayLabel(l)} ${l.targets.srpe} AU`)
          .join(", ")}.`,
        hint: "Przenieś objętość na dzień trwania albo obniż sRPE pozostałych dni.",
        dayIndex: volume.dayIndex,
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
        principleId: "load_shape",
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
        principleId: "nothing_new_md1",
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
        principleId: "no_two_heavy",
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
      principleId: "sprint_week",
      severity: "critical",
      title: "Brak ekspozycji na sprint maksymalny",
      message: "W mikrocyklu nie ma bloku z tagiem sprintu ≥90% Vmax.",
      hint: "Dodaj sprinty na MD-2 — unikanie sprintu zwiększa ryzyko urazu tylnej taśmy.",
      dayIndex: byOffset(loads, -2)?.dayIndex ?? null,
    });
  }

  const tension = trainingDays(loads).find((l) => l.dominant === "tension") ?? byOffset(loads, -5);
  if (tension) {
    const tensionSprint = blocks.some(
      (b) => b.dayIndex === tension.dayIndex && b.tags.includes("sprint_max")
    );
    if (tensionSprint) {
      out.push({
        ruleId: "sprint_on_tension",
        principleId: "sprint_week",
        severity: "warning",
        title: "Sprint maksymalny na dniu napięcia / mocy",
        message: "MD-5 to dzień mocy i małych formatów — sprint ≥90% Vmax zostaw na MD-2.",
        hint: "Na dniu mocy zostaw akceleracje; max sprint 72 h+ po ciężkiej siłowni, w MD-2.",
        dayIndex: tension.dayIndex,
      });
    }
  }

  const nordicDays = countTag(blocks, "nordic");
  if (nordicDays < t.minNordicSessions) {
    out.push({
      ruleId: "nordic_exposure",
      principleId: "nordic_timing",
      severity: "warning",
      title: "Brak Nordic Hamstring",
      message: "Nordic nie występuje w żadnym dniu mikrocyklu.",
      hint: `Zaplanuj ${t.minNordicSessions}–${t.maxNordicSessions}× w tygodniu — redukcja urazów hamstringów o 50–70%.`,
      dayIndex: byOffset(loads, 1)?.dayIndex ?? byOffset(loads, -4)?.dayIndex ?? null,
    });
  }

  const strengthDays = countTag(blocks, "strength_max");
  if (strengthDays < t.minStrengthSessions) {
    out.push({
      ruleId: "strength_exposure",
      principleId: "gym_serves_match",
      severity: "warning",
      title: "Brak siły maksymalnej",
      message: "W mikrocyklu nie ma bloku siłowego.",
      hint: `Utrzymaj ${t.minStrengthSessions}–${t.maxStrengthSessions}× w tygodniu — siłownia ma podnosić jakość dnia meczu.`,
      dayIndex: byOffset(loads, 1)?.dayIndex ?? null,
    });
  }

  return out;
}

const PITCH_TAGS: MotorTagId[] = [
  "ssg",
  "positional",
  "transitions",
  "sprint_max",
  "acceleration",
  "rsa",
  "compensation",
];

function isGymBlock(block: MicrocycleTrainingBlock): boolean {
  return block.tags.includes("gym");
}

function isPitchBlock(block: MicrocycleTrainingBlock): boolean {
  if (isGymBlock(block) || block.tags.includes("transfer")) return false;
  return PITCH_TAGS.some((tag) => block.tags.includes(tag));
}

function checkGymStructure(
  loads: ResolvedDayLoad[],
  blocks: MicrocycleTrainingBlock[]
): MicrocycleViolation[] {
  const out: MicrocycleViolation[] = [];
  const t = MICROCYCLE_ALERT_THRESHOLDS;

  for (const load of loads) {
    const dayBlocks = blocks
      .filter((b) => b.dayIndex === load.dayIndex)
      .sort((a, b) => a.order - b.order);
    if (dayBlocks.length === 0) continue;

    const gymBlocks = dayBlocks.filter(isGymBlock);
    const pitchBlocks = dayBlocks.filter(isPitchBlock);
    const transferBlocks = dayBlocks.filter((b) => b.tags.includes("transfer"));
    const gymMin = gymBlocks.reduce((s, b) => s + b.minutes, 0);

    if (gymBlocks.length > 0 && pitchBlocks.length > 0) {
      const firstGym = gymBlocks[0].order;
      const firstPitch = pitchBlocks[0].order;
      if (firstGym > firstPitch) {
        out.push({
          ruleId: "gym_after_pitch",
          principleId: "gym_first",
          severity: "warning",
          title: "Siłownia po boisku",
          message: `${dayLabel(load)} — blok siłowy stoi za pracą na murawie.`,
          hint: "Kolejność: siłownia → transfer 10–15' → boisko. Po piłce technika przysiadu się rozpada.",
          dayIndex: load.dayIndex,
        });
      }
    }

    if (gymMin >= t.gymTransferMinMinutes && transferBlocks.length === 0) {
      out.push({
        ruleId: "gym_transfer_missing",
        principleId: "gym_first",
        severity: "warning",
        title: "Brak okna transferowego po siłowni",
        message: `${dayLabel(load)} — ${gymMin} min siłowni bez bloku transferu.`,
        hint: "Wstaw 10–15 min: woda, przejście, mobilność dynamiczna. Inaczej pierwsze 10 min na murawie jest martwe.",
        dayIndex: load.dayIndex,
      });
    }

    const hasNordic = dayBlocks.some((b) => b.tags.includes("nordic"));
    if (hasNordic && (load.offset === -1 || load.offset === -2)) {
      out.push({
        ruleId: "nordic_too_close",
        principleId: "nordic_timing",
        severity: "critical",
        title: "Nordic za blisko meczu",
        message: `${dayLabel(load)} — Nordic wymaga min. 72 h przed meczem (DOMS 24–72 h).`,
        hint: "Nordic tylko w dniu siłowym (≥72 h przed meczem). Nigdy w MD-2 ani MD-1.",
        dayIndex: load.dayIndex,
      });
    }

    const hasHeavy = dayBlocks.some((b) => b.tags.includes("strength_max"));
    if (hasHeavy && load.dominant === "duration") {
      out.push({
        ruleId: "heavy_on_volume",
        principleId: "no_heavy_before_volume",
        severity: "warning",
        title: "Ciężka siła w dniu objętości",
        message: `${dayLabel(load)} — przysiad / RDL przed 8v8 i 11v11 zjada ekonomię biegu.`,
        hint: "W dniu objętości zostaw 10–12 min core i mobilności. Ciężką dolną część przenieś na dzień siłowy (najdalej od meczu).",
        dayIndex: load.dayIndex,
      });
    }

    if (load.offset === -1 && gymBlocks.length > 0) {
      out.push({
        ruleId: "gym_on_md1",
        principleId: "nothing_new_md1",
        severity: "warning",
        title: "Siłownia w ostatnich 24 h",
        message: `${dayLabel(load)} — zero siłowni przed meczem.`,
        hint: "Zostaw aktywację i priming. Siłownia ma podnosić jakość dnia meczu, nie obciążać nóg.",
        dayIndex: load.dayIndex,
      });
    }

    if (hasHeavy && (load.offset === -1 || load.offset === -2)) {
      out.push({
        ruleId: "heavy_legs_near_match",
        principleId: "gym_serves_match",
        severity: "warning",
        title: "Ciężkie nogi zbyt blisko meczu",
        message: `${dayLabel(load)} — siła maksymalna w MD-2/MD-1 zostawia nogi na meczu.`,
        hint: "Ciężką dolną część przenieś na MD+1 — najdalej od meczu.",
        dayIndex: load.dayIndex,
      });
    }
  }

  for (let i = 0; i < 6; i += 1) {
    const today = loads[i];
    const tomorrow = loads[i + 1];
    if (!today || !tomorrow || tomorrow.dominant !== "duration") continue;
    const heavyToday = blocks.some(
      (b) => b.dayIndex === today.dayIndex && b.tags.includes("strength_max")
    );
    if (heavyToday) {
      out.push({
        ruleId: "heavy_before_volume",
        principleId: "no_heavy_before_volume",
        severity: "warning",
        title: "Ciężka dolna część ciała przed dniem objętości",
        message: `${dayLabel(today)} ma siłę maksymalną, a ${dayLabel(tomorrow)} to dzień największego dystansu.`,
        hint: "Zostaw moc/skoki; przysiad i RDL trzymaj w dniu siłowym, nie tuż przed objętością.",
        dayIndex: today.dayIndex,
      });
    }
  }

  return out;
}

function hasSplitGroupsSignal(
  blocks: MicrocycleTrainingBlock[],
  dayIndex: number
): boolean {
  return blocks.some((b) => {
    if (b.dayIndex !== dayIndex) return false;
    if (b.tags.includes("compensation")) return true;
    const text = `${b.name} ${b.notes ?? ""}`;
    return /niegraj/i.test(text) || /grając/i.test(text);
  });
}

function checkSplitGroups(
  loads: ResolvedDayLoad[],
  blocks: MicrocycleTrainingBlock[]
): MicrocycleViolation[] {
  const recovery =
    byOffset(loads, 1) ?? trainingDays(loads).find((l) => l.dominant === "recovery");
  if (!recovery) return [];
  const dayBlocks = blocks.filter((b) => b.dayIndex === recovery.dayIndex);
  if (dayBlocks.length === 0) return [];
  if (!dayBlocks.some(isGymBlock)) return [];
  if (hasSplitGroupsSignal(blocks, recovery.dayIndex)) return [];
  return [
    {
      ruleId: "split_groups_missing",
      principleId: "split_groups",
      severity: "warning",
      title: "Brak rozdzielenia grup w MD+1",
      message: `${dayLabel(recovery)} — siłownia bez oznaczenia grający / niegrający.`,
      hint: "Grających: 3 serie (−30%). Niegrających: pełna siła + blok kompensacyjny. Przesuń start o 45 min.",
      dayIndex: recovery.dayIndex,
    },
  ];
}

function checkDeload(
  microcycle: TrainingMicrocycle,
  loads: ResolvedDayLoad[],
  previousWeeklySrpe: number[]
): MicrocycleViolation[] {
  const t = MICROCYCLE_ALERT_THRESHOLDS;
  const isDeloadWeek =
    microcycle.number > 0 && microcycle.number % t.deloadEveryWeeks === 0;
  const previous = previousWeeklySrpe[0];
  if (!isDeloadWeek || !previous || previous <= 0) return [];
  const summary = summarizeWeeklyLoad(loads);
  const pctOfPrevious = (summary.totalSrpe / previous) * 100;
  if (pctOfPrevious <= t.deloadMaxPctOfPrevious) return [];
  return [
    {
      ruleId: "deload_due",
      principleId: "deload",
      severity: "warning",
      title: "Zaplanuj deload",
      message: `Mikrocykl ${microcycle.number} to co ${t.deloadEveryWeeks}. tydzień, a obciążenie to ${Math.round(pctOfPrevious)}% poprzedniego.`,
      hint: `Zejdź do ${t.deloadMaxPctOfPrevious}% lub niżej — deload co ${t.deloadEveryWeeks} tygodnie, bezwarunkowo.`,
      dayIndex: null,
    },
  ];
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
      principleId: null,
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
    ...checkDeload(microcycle, loads, previousWeeklySrpe),
    ...checkTwoMatchWeek(microcycle, loads),
  ];

  if (blocks.length > 0) {
    violations.push(
      ...checkTagExposure(loads, blocks),
      ...checkGymStructure(loads, blocks),
      ...checkSplitGroups(loads, blocks)
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
