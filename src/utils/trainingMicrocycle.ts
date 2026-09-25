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

function assignmentDayKey(
  assignment: Pick<MicrocycleDayAssignment, "microcycleId" | "dayIndex" | "templateId">
): string {
  return `${assignment.microcycleId}|${assignment.dayIndex}|${assignment.templateId}`;
}

/**
 * Na jednym dniu mikrocyklu każda zasada / sub-zasada / sub-sub-zasada tylko raz
 * (współdzielone potomki z kilku rodziców nie dublują się na kafelku).
 */
export function uniqueAssignmentsPerDay(
  assignments: MicrocycleDayAssignment[]
): MicrocycleDayAssignment[] {
  const seen = new Set<string>();
  const out: MicrocycleDayAssignment[] = [];
  for (const assignment of assignments) {
    const key = assignment.templateId
      ? assignmentDayKey(assignment)
      : `id:${assignment.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(assignment);
  }
  return out;
}

export function uniqueAssignmentsPerDayAdjustingCounts(
  assignments: MicrocycleDayAssignment[],
  trainingCounts: Record<string, number>
): { assignments: MicrocycleDayAssignment[]; trainingCounts: Record<string, number> } {
  const unique = uniqueAssignmentsPerDay(assignments);
  if (unique.length === assignments.length) {
    return { assignments: unique, trainingCounts };
  }
  const keptIds = new Set(unique.map((a) => a.id));
  let counts = trainingCounts;
  for (const assignment of assignments) {
    if (keptIds.has(assignment.id)) continue;
    counts = applyTrainingCountDelta(counts, assignment.templateId, -1);
  }
  return { assignments: unique, trainingCounts: counts };
}

export function templateIdsOnMicrocycleDay(
  assignments: MicrocycleDayAssignment[],
  microcycleId: string,
  dayIndex: number
): Set<string> {
  const ids = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.microcycleId !== microcycleId || assignment.dayIndex !== dayIndex) continue;
    if (assignment.templateId) ids.add(assignment.templateId);
  }
  return ids;
}

/** Przenosi cel na inny dzień; jeśli ta zasada już tam jest — zostaje jedna kopia. */
export function moveAssignmentToDay(
  state: TrainingMicrocycleState,
  assignmentId: string,
  dayIndex: number
): TrainingMicrocycleState {
  const moving = state.assignments.find((a) => a.id === assignmentId);
  if (!moving || moving.dayIndex === dayIndex) return state;
  const clash = state.assignments.some(
    (a) =>
      a.id !== moving.id &&
      a.microcycleId === moving.microcycleId &&
      a.dayIndex === dayIndex &&
      a.templateId === moving.templateId
  );
  if (clash) {
    return {
      ...state,
      assignments: state.assignments.filter((a) => a.id !== moving.id),
      trainingCounts: applyTrainingCountDelta(state.trainingCounts, moving.templateId, -1),
    };
  }
  return {
    ...state,
    assignments: state.assignments.map((a) =>
      a.id === assignmentId ? { ...a, dayIndex } : a
    ),
  };
}

export function removeTemplateFromMicrocycleDay(
  state: TrainingMicrocycleState,
  assignmentId: string
): TrainingMicrocycleState {
  const target = state.assignments.find((a) => a.id === assignmentId);
  if (!target) return state;
  const toRemove = state.assignments.filter(
    (a) =>
      a.microcycleId === target.microcycleId &&
      a.dayIndex === target.dayIndex &&
      a.templateId === target.templateId
  );
  if (toRemove.length === 0) return state;
  const removeIds = new Set(toRemove.map((a) => a.id));
  let trainingCounts = state.trainingCounts;
  for (const assignment of toRemove) {
    trainingCounts = applyTrainingCountDelta(trainingCounts, assignment.templateId, -1);
  }
  return {
    ...state,
    assignments: state.assignments.filter((a) => !removeIds.has(a.id)),
    trainingCounts,
  };
}

export function assignTemplatesToMicrocycleDay(
  state: TrainingMicrocycleState,
  params: {
    microcycleId: string;
    dayIndex: number;
    templates: Array<{ id: string; title: string; level: MicrocycleDayAssignment["level"] }>;
    generateId?: () => string;
  }
): TrainingMicrocycleState {
  const { microcycleId, dayIndex, templates, generateId = generateMicrocycleId } = params;
  if (templates.length === 0) return state;
  const already = templateIdsOnMicrocycleDay(state.assignments, microcycleId, dayIndex);
  const seenIncoming = new Set<string>();
  const toAdd: typeof templates = [];
  for (const tpl of templates) {
    if (!tpl.id || seenIncoming.has(tpl.id) || already.has(tpl.id)) continue;
    seenIncoming.add(tpl.id);
    toAdd.push(tpl);
  }
  if (toAdd.length === 0) return state;
  const newAssignments: MicrocycleDayAssignment[] = toAdd.map((tpl) => ({
    id: generateId(),
    microcycleId,
    dayIndex,
    templateId: tpl.id,
    title: tpl.title,
    level: tpl.level,
  }));
  let trainingCounts = state.trainingCounts;
  for (const tpl of toAdd) {
    trainingCounts = applyTrainingCountDelta(trainingCounts, tpl.id, 1);
  }
  return {
    ...state,
    assignments: [...state.assignments, ...newAssignments],
    trainingCounts,
  };
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
    matchProtocols: [],
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
