import type {
  MicrocycleDayAssignment,
  MicrocycleDayPlan,
  TrainingDayTitleTemplate,
  TrainingMicrocycle,
  TrainingMicrocycleSeason,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { createDefaultMicrocycleMatch } from "@/utils/microcycleMatches";
import { startOfWeekMonday, toIsoDateLocal } from "@/utils/matchDayLabels";

export function defaultSeasonName(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (m >= 6) return `${y}/${y + 1}`;
  return `${y - 1}/${y}`;
}

export function generateMicrocycleId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function microcyclesForSeason(
  microcycles: TrainingMicrocycle[],
  seasonId: string
): TrainingMicrocycle[] {
  return microcycles
    .filter((m) => m.seasonId === seasonId)
    .sort((a, b) => a.number - b.number);
}

export function nextMicrocycleNumber(
  microcycles: TrainingMicrocycle[],
  seasonId: string
): number {
  const inSeason = microcyclesForSeason(microcycles, seasonId);
  if (inSeason.length === 0) return 1;
  return Math.max(...inSeason.map((m) => m.number)) + 1;
}

/**
 * Numeruje mikrocykle sezonu kolejno 1…n według daty poniedziałku (potem starego numeru).
 */
export function renumberSeasonMicrocycles(
  microcycles: TrainingMicrocycle[],
  seasonId: string
): TrainingMicrocycle[] {
  const inSeason = [...microcycles.filter((m) => m.seasonId === seasonId)].sort(
    (a, b) =>
      a.weekStartIso.localeCompare(b.weekStartIso) || a.number - b.number || a.id.localeCompare(b.id)
  );
  const newNumberById = new Map(inSeason.map((m, i) => [m.id, i + 1]));
  return microcycles.map((m) => {
    const next = newNumberById.get(m.id);
    if (next == null || next === m.number) return m;
    return { ...m, number: next };
  });
}

export function applyTrainingCountDelta(
  counts: Record<string, number>,
  templateId: string,
  delta: number
): Record<string, number> {
  if (!templateId || delta === 0) return counts;
  const prev = counts[templateId] ?? 0;
  const next = Math.max(0, prev + delta);
  if (next === 0) {
    const { [templateId]: _removed, ...rest } = counts;
    return rest;
  }
  return { ...counts, [templateId]: next };
}

export function assignmentsForMicrocycle(
  assignments: MicrocycleDayAssignment[],
  microcycleId: string
): MicrocycleDayAssignment[] {
  return assignments.filter((a) => a.microcycleId === microcycleId);
}

export function dayPlansForMicrocycle(
  dayPlans: MicrocycleDayPlan[],
  microcycleId: string
): MicrocycleDayPlan[] {
  return dayPlans.filter((p) => p.microcycleId === microcycleId);
}

export function dayPlanForDay(
  dayPlans: MicrocycleDayPlan[],
  microcycleId: string,
  dayIndex: number
): MicrocycleDayPlan | undefined {
  return dayPlans.find((p) => p.microcycleId === microcycleId && p.dayIndex === dayIndex);
}

export function createDefaultTrainingMicrocycleState(now = new Date()): TrainingMicrocycleState {
  const seasonId = generateMicrocycleId();
  const microcycleId = generateMicrocycleId();
  const weekStartIso = toIsoDateLocal(startOfWeekMonday(now));
  return {
    seasons: [{ id: seasonId, name: defaultSeasonName(now), order: 0 }],
    microcycles: [
      {
        id: microcycleId,
        seasonId,
        number: 1,
        weekStartIso,
        matches: [createDefaultMicrocycleMatch(5)],
        daySchedules: [],
      },
    ],
    assignments: [],
    dayPlans: [],
    proceduralTasks: [],
    exercises: [],
    trainingCounts: {},
    activeSeasonId: seasonId,
    activeMicrocycleId: microcycleId,
    lnpTeamUrl: "",
    lnpTeamId: null,
    lnpTeamName: null,
    lnpFixtures: [],
    lnpFixturesFetchedAt: null,
    lnpWatchTeamUrl: "",
    lnpWatchTeamId: null,
    lnpWatchTeamName: null,
    lnpWatchFixtures: [],
    lnpWatchFixturesFetchedAt: null,
  };
}

export function sortSeasons(seasons: TrainingMicrocycleSeason[]): TrainingMicrocycleSeason[] {
  return [...seasons].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pl"));
}
