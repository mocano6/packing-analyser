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
import { MICROCYCLE_ALERT_THRESHOLDS, presetForOffset } from "@/lib/microcycle/motorModel";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";

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
 * Rozwiązuje obciążenie dnia: preset z offsetu MD + ewentualne nadpisania.
 * Dzień meczowy zawsze dostaje dominantę "match", niezależnie od offsetu.
 */
export function resolveDayLoad(
  microcycle: TrainingMicrocycle,
  dayIndex: number,
  blocks: MicrocycleTrainingBlock[] = []
): ResolvedDayLoad {
  const matchDays = normalizeMatchDaysArray((microcycle.matches ?? []).map((m) => m.dayIndex));
  const primary = matchDays[0] ?? 5;
  const isMatchDay = matchDays.includes(dayIndex);
  const offset = dayIndex - primary;
  const preset = presetForOffset(isMatchDay ? 0 : offset);
  const entry = dayLoadEntry(microcycle.dayLoads, dayIndex);

  const dominant: MotorDominantId = isMotorDominantId(entry?.dominant)
    ? entry.dominant
    : preset.dominant;

  const targets: MicrocycleDayLoadTargets = {
    ...preset.targets,
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
