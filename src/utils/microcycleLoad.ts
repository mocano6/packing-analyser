import type {
  MicrocycleDayLoad,
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
} from "@/types/trainingMicrocycle";
import type {
  MicrocycleDayLoadTargets,
  MotorDominantId,
} from "@/types/microcycleMotor";
import { isMotorDominantId } from "@/types/microcycleMotor";
import { MICROCYCLE_ALERT_THRESHOLDS, presetForOffset, sessionPresetForRole } from "@/lib/microcycle/motorModel";
import { normalizeMatchDaysArray, periodizationOffset } from "@/utils/matchDayLabels";
import { isRestDay } from "@/utils/microcycleRestDays";
import {
  assignSessionRolesToWeek,
  restDaysForWeekFill,
} from "@/utils/microcycleSessionRoles";

export const EMPTY_DAY_LOAD_TARGETS: MicrocycleDayLoadTargets = {
  totalDistancePct: 0,
  hsrPct: 0,
  sprintPct: 0,
  accDecPct: 0,
  srpe: 0,
  minutes: 0,
};

export interface ResolvedDayLoad {
  dayIndex: number;
  /** Offset względem głównego (pierwszego) dnia meczu. */
  offset: number;
  dominant: MotorDominantId;
  targets: MicrocycleDayLoadTargets;
  /** Czy dominanta lub cele zostały nadpisane ręcznie. */
  customized: boolean;
  /** Suma minut z bloków (null = brak bloków). */
  plannedMinutes: number | null;
  isMatchDay: boolean;
}

export function primaryMatchDayIndex(microcycle: TrainingMicrocycle | null | undefined): number {
  const days = normalizeMatchDaysArray((microcycle?.matches ?? []).map((m) => m.dayIndex));
  return days[0] ?? 5;
}

function dayLoadEntry(
  dayLoads: MicrocycleDayLoad[] | undefined,
  dayIndex: number
): MicrocycleDayLoad | undefined {
  return dayLoads?.find((d) => d.dayIndex === dayIndex);
}

/**
 * Rozwiązuje obciążenie dnia: nadpisania użytkownika → rola jednostki w tygodniu
 * (siła/napięcie/objętość/prędkość) → dopiero potem stary preset MD.
 * Dzień meczowy zawsze „match”; dzień wolny zawsze zero.
 */
export function resolveDayLoad(
  microcycle: TrainingMicrocycle,
  dayIndex: number,
  blocks: MicrocycleTrainingBlock[] = []
): ResolvedDayLoad {
  const matchDays = normalizeMatchDaysArray((microcycle.matches ?? []).map((m) => m.dayIndex));
  const primary = matchDays[0] ?? 5;
  const isMatchDay = matchDays.includes(dayIndex);
  const offset = isMatchDay ? 0 : periodizationOffset(dayIndex, primary);
  const rest = !isMatchDay && isRestDay(microcycle.restDays, dayIndex);

  if (rest) {
    return {
      dayIndex,
      offset,
      dominant: "off",
      targets: { ...EMPTY_DAY_LOAD_TARGETS },
      customized: false,
      plannedMinutes: 0,
      isMatchDay: false,
    };
  }

  const entry = dayLoadEntry(microcycle.dayLoads, dayIndex);
  const fillRest = restDaysForWeekFill(matchDays, microcycle.restDays ?? []);
  const roleAssignment = isMatchDay
    ? undefined
    : assignSessionRolesToWeek(matchDays, fillRest).find((a) => a.dayIndex === dayIndex);
  const rolePreset = roleAssignment
    ? sessionPresetForRole(roleAssignment.role)
    : null;
  /** Dzień poza rotacją 4 jednostek (np. piątek przy pustych restDays) — traktuj jak wolne w obciążeniu. */
  const outsideRotation =
    !isMatchDay && !roleAssignment && fillRest.includes(dayIndex) && !entry;

  const fallback = outsideRotation
    ? { dominant: "off" as MotorDominantId, targets: EMPTY_DAY_LOAD_TARGETS }
    : rolePreset
      ? { dominant: rolePreset.dominant, targets: rolePreset.targets }
      : presetForOffset(offset);

  const dominant: MotorDominantId = isMatchDay
    ? "match"
    : isMotorDominantId(entry?.dominant)
      ? entry.dominant
      : fallback.dominant;

  const targets: MicrocycleDayLoadTargets = isMatchDay
    ? { ...presetForOffset(0).targets, ...(entry?.targets ?? {}) }
    : outsideRotation
      ? { ...EMPTY_DAY_LOAD_TARGETS }
      : {
          ...fallback.targets,
          ...(entry?.targets ?? {}),
        };

  const dayBlocks = blocks.filter((b) => b.dayIndex === dayIndex);
  const plannedMinutes =
    dayBlocks.length > 0
      ? dayBlocks.reduce((sum, b) => sum + (Number.isFinite(b.minutes) ? b.minutes : 0), 0)
      : null;

  return {
    dayIndex,
    offset,
    dominant,
    targets,
    customized: Boolean(entry && (entry.dominant != null || entry.targets)),
    plannedMinutes,
    isMatchDay,
  };
}

export function resolveWeekLoads(
  microcycle: TrainingMicrocycle,
  blocks: MicrocycleTrainingBlock[] = []
): ResolvedDayLoad[] {
  return Array.from({ length: 7 }, (_, dayIndex) =>
    resolveDayLoad(microcycle, dayIndex, blocks)
  );
}

/** Zrzut rozwiązanego obciążenia jako nadpisanie dnia (do przenoszenia między dniami). */
export function resolvedLoadToOverride(resolved: ResolvedDayLoad): MicrocycleDayLoad {
  return {
    dayIndex: resolved.dayIndex,
    dominant: resolved.dominant,
    targets: { ...resolved.targets },
  };
}

/**
 * Przenosi obciążenie dnia (preset + nadpisania) na inny dzień jako pełne nadpisanie.
 * Źródło wraca do presetu MD; cel dostaje dominantę i cele ze źródła.
 */
export function moveResolvedDayLoad(
  microcycle: TrainingMicrocycle,
  fromDayIndex: number,
  toDayIndex: number
): TrainingMicrocycle {
  if (fromDayIndex === toDayIndex) return microcycle;
  if (fromDayIndex < 0 || fromDayIndex > 6 || toDayIndex < 0 || toDayIndex > 6) {
    return microcycle;
  }
  const snapshot = resolvedLoadToOverride(resolveDayLoad(microcycle, fromDayIndex));
  const without = (microcycle.dayLoads ?? []).filter(
    (l) => l.dayIndex !== fromDayIndex && l.dayIndex !== toDayIndex
  );
  return {
    ...microcycle,
    dayLoads: [
      ...without,
      {
        dayIndex: toDayIndex,
        dominant: snapshot.dominant,
        targets: snapshot.targets,
      },
    ].sort((a, b) => a.dayIndex - b.dayIndex),
  };
}

/** Zamienia obciążenia dwóch dni (oba jako pełne nadpisania z aktualnego widoku). */
export function swapResolvedDayLoads(
  microcycle: TrainingMicrocycle,
  dayA: number,
  dayB: number
): TrainingMicrocycle {
  if (dayA === dayB) return microcycle;
  if (dayA < 0 || dayA > 6 || dayB < 0 || dayB > 6) return microcycle;
  const loadA = resolvedLoadToOverride(resolveDayLoad(microcycle, dayA));
  const loadB = resolvedLoadToOverride(resolveDayLoad(microcycle, dayB));
  const without = (microcycle.dayLoads ?? []).filter(
    (l) => l.dayIndex !== dayA && l.dayIndex !== dayB
  );
  return {
    ...microcycle,
    dayLoads: [
      ...without,
      { dayIndex: dayB, dominant: loadA.dominant, targets: loadA.targets },
      { dayIndex: dayA, dominant: loadB.dominant, targets: loadB.targets },
    ].sort((a, b) => a.dayIndex - b.dayIndex),
  };
}

export interface WeeklyLoadSummary {
  /** Suma sRPE w AU (z meczem). */
  totalSrpe: number;
  /** Suma sRPE bez dni meczowych — realna objętość treningowa. */
  trainingSrpe: number;
  totalMinutes: number;
  /** Sumy % obciążenia meczowego. */
  totalDistancePct: number;
  hsrPct: number;
  sprintPct: number;
  accDecPct: number;
  /** Liczba dni z jakimkolwiek obciążeniem. */
  activeDays: number;
  /** Monotonia Fostera: średnia dzienna / odchylenie standardowe. */
  monotony: number | null;
  /** Strain: suma obciążenia × monotonia. */
  strain: number | null;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

export function summarizeWeeklyLoad(loads: ResolvedDayLoad[]): WeeklyLoadSummary {
  const srpeByDay = loads.map((l) => Math.max(0, l.targets.srpe));
  const totalSrpe = srpeByDay.reduce((a, b) => a + b, 0);
  const sd = standardDeviation(srpeByDay);
  const monotony = sd > 0 ? totalSrpe / srpeByDay.length / sd : null;

  return {
    totalSrpe,
    trainingSrpe: loads
      .filter((l) => !l.isMatchDay)
      .reduce((sum, l) => sum + Math.max(0, l.targets.srpe), 0),
    totalMinutes: loads.reduce(
      (sum, l) => sum + (l.plannedMinutes ?? Math.max(0, l.targets.minutes)),
      0
    ),
    totalDistancePct: loads.reduce((sum, l) => sum + l.targets.totalDistancePct, 0),
    hsrPct: loads.reduce((sum, l) => sum + l.targets.hsrPct, 0),
    sprintPct: loads.reduce((sum, l) => sum + l.targets.sprintPct, 0),
    accDecPct: loads.reduce((sum, l) => sum + l.targets.accDecPct, 0),
    activeDays: loads.filter((l) => l.targets.srpe > 0).length,
    monotony,
    strain: monotony != null ? totalSrpe * monotony : null,
  };
}

export interface AcwrResult {
  /** Obciążenie ostre = bieżący tydzień. */
  acute: number;
  /** Obciążenie chroniczne = średnia z max 4 tygodni (z bieżącym). */
  chronic: number;
  ratio: number | null;
  /** Ile tygodni historii wykorzystano (bez bieżącego). */
  weeksOfHistory: number;
  /** Czy historia wystarcza, by traktować wynik poważnie. */
  reliable: boolean;
}

/**
 * ACWR (Gabbett): tydzień bieżący do średniej z ostatnich 4 tygodni.
 * `previousWeeklySrpe` posortowane od najnowszego tygodnia.
 */
export function computeAcwr(currentWeekSrpe: number, previousWeeklySrpe: number[]): AcwrResult {
  const history = previousWeeklySrpe.filter((v) => Number.isFinite(v) && v > 0).slice(0, 3);
  const window = [currentWeekSrpe, ...history];
  const chronic = window.reduce((a, b) => a + b, 0) / window.length;
  return {
    acute: currentWeekSrpe,
    chronic,
    ratio: chronic > 0 ? currentWeekSrpe / chronic : null,
    weeksOfHistory: history.length,
    reliable: history.length >= 2,
  };
}

/** Zmiana obciążenia względem poprzedniego tygodnia w %. */
export function weekOverWeekChangePct(
  currentWeekSrpe: number,
  previousWeekSrpe: number | undefined
): number | null {
  if (!previousWeekSrpe || previousWeekSrpe <= 0) return null;
  return ((currentWeekSrpe - previousWeekSrpe) / previousWeekSrpe) * 100;
}

export function isHeavyDay(load: ResolvedDayLoad): boolean {
  return load.targets.srpe >= MICROCYCLE_ALERT_THRESHOLDS.heavyDaySrpe;
}
