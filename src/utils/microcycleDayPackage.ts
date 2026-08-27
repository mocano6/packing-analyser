import type {
  MicrocycleDayPlan,
  MicrocycleDaySchedule,
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { moveResolvedDayLoad, swapResolvedDayLoads } from "@/utils/microcycleLoad";
import { isRestDay, moveRestDay, swapRestDays } from "@/utils/microcycleRestDays";

function clampDayIndex(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const i = Math.trunc(raw);
  if (i < 0 || i > 6) return null;
  return i;
}

function swapDayIndex<T extends { dayIndex: number }>(
  items: T[],
  from: number,
  to: number
): T[] {
  return items.map((item) => {
    if (item.dayIndex === from) return { ...item, dayIndex: to };
    if (item.dayIndex === to) return { ...item, dayIndex: from };
    return item;
  });
}

function swapScopedDayIndex<T extends { microcycleId: string; dayIndex: number }>(
  items: T[],
  microcycleId: string,
  from: number,
  to: number
): T[] {
  return items.map((item) => {
    if (item.microcycleId !== microcycleId) return item;
    if (item.dayIndex === from) return { ...item, dayIndex: to };
    if (item.dayIndex === to) return { ...item, dayIndex: from };
    return item;
  });
}

/** Po swapie ustaw order 0..n-1 w obu dniach, zachowując kolejność względną. */
export function reindexBlockOrdersForDays(
  blocks: MicrocycleTrainingBlock[],
  microcycleId: string,
  dayIndexes: number[]
): MicrocycleTrainingBlock[] {
  const orderById = new Map<string, number>();
  for (const dayIndex of dayIndexes) {
    const dayBlocks = blocks
      .filter((b) => b.microcycleId === microcycleId && b.dayIndex === dayIndex)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    dayBlocks.forEach((b, i) => orderById.set(b.id, i));
  }
  if (orderById.size === 0) return blocks;
  return blocks.map((b) => {
    const nextOrder = orderById.get(b.id);
    return nextOrder === undefined || nextOrder === b.order ? b : { ...b, order: nextOrder };
  });
}

/**
 * Swap tytułów dni z regułami MD:
 * - nie wstawiaj planu na dzień meczowy (tytuł zawsze „Mecz”),
 * - plan z MD można wynieść na dzień nietreningowy (jeśli był zapisany).
 */
export function swapDayPlansForMicrocycle(
  plans: MicrocycleDayPlan[],
  microcycleId: string,
  from: number,
  to: number,
  matchDayIndexes: number[]
): MicrocycleDayPlan[] {
  const fromIsMd = matchDayIndexes.includes(from);
  const toIsMd = matchDayIndexes.includes(to);
  const planFrom = plans.find((p) => p.microcycleId === microcycleId && p.dayIndex === from);
  const planTo = plans.find((p) => p.microcycleId === microcycleId && p.dayIndex === to);

  const without = plans.filter(
    (p) =>
      !(p.microcycleId === microcycleId && (p.dayIndex === from || p.dayIndex === to))
  );

  const next = [...without];
  if (planFrom && !toIsMd) next.push({ ...planFrom, dayIndex: to });
  if (planTo && !fromIsMd) next.push({ ...planTo, dayIndex: from });
  // Gdy cel jest MD, planFrom nie wraca na from (dzień źródłowy zostaje bez tytułu).
  // Gdy źródło jest MD a planFrom istnieje i to nie-MD — już przeniesiony wyżej.
  void fromIsMd;
  return next;
}

function swapSchedules(
  schedules: MicrocycleDaySchedule[] | undefined,
  from: number,
  to: number
): MicrocycleDaySchedule[] {
  return swapDayIndex(schedules ?? [], from, to).sort((a, b) => a.dayIndex - b.dayIndex);
}

/** Sekcje kolumny dnia — da się przenosić jako całą grupę. */
export type MicrocycleDaySectionKind =
  | "zadania"
  | "trening"
  | "cele"
  | "cwiczenia"
  | "trening_cele"
  | "obciazenie";

function moveScopedDayIndex<T extends { microcycleId: string; dayIndex: number }>(
  items: T[],
  microcycleId: string,
  from: number,
  to: number
): T[] {
  return items.map((item) =>
    item.microcycleId === microcycleId && item.dayIndex === from
      ? { ...item, dayIndex: to }
      : item
  );
}

/** Przenieś bloki z `from` na koniec listy dnia `to` (kolejność zachowana). */
export function moveBlocksToDay(
  blocks: MicrocycleTrainingBlock[],
  microcycleId: string,
  from: number,
  to: number
): MicrocycleTrainingBlock[] {
  if (from === to) return blocks;
  const moving = blocks
    .filter((b) => b.microcycleId === microcycleId && b.dayIndex === from)
    .sort((a, b) => a.order - b.order);
  if (moving.length === 0) return blocks;
  const destBase = blocks.filter(
    (b) => b.microcycleId === microcycleId && b.dayIndex === to
  ).length;
  const orderById = new Map(moving.map((b, i) => [b.id, destBase + i]));
  return blocks.map((b) => {
    const nextOrder = orderById.get(b.id);
    if (nextOrder === undefined) return b;
    return { ...b, dayIndex: to, order: nextOrder };
  });
}

function moveDayPlanToDay(
  plans: MicrocycleDayPlan[],
  microcycleId: string,
  from: number,
  to: number,
  matchDayIndexes: number[]
): MicrocycleDayPlan[] {
  if (matchDayIndexes.includes(to)) {
    // Cel MD — nie przenoś tytułu; usuń plan ze źródła tylko jeśli źródło nie-MD? Zostaw plan na from.
    return plans;
  }
  const planFrom = plans.find((p) => p.microcycleId === microcycleId && p.dayIndex === from);
  if (!planFrom) return plans;
  return [
    ...plans.filter(
      (p) =>
        !(
          p.microcycleId === microcycleId &&
          (p.dayIndex === from || p.dayIndex === to)
        )
    ),
    { ...planFrom, dayIndex: to },
  ];
}

function moveScheduleToDay(
  schedules: MicrocycleDaySchedule[] | undefined,
  from: number,
  to: number
): MicrocycleDaySchedule[] {
  const list = schedules ?? [];
  const fromEntry = list.find((s) => s.dayIndex === from);
  const without = list.filter((s) => s.dayIndex !== from && s.dayIndex !== to);
  if (!fromEntry) return without.sort((a, b) => a.dayIndex - b.dayIndex);
  return [...without, { ...fromEntry, dayIndex: to }].sort((a, b) => a.dayIndex - b.dayIndex);
}

/**
 * Przenosi (nie zamienia) całą sekcję dnia na inny dzień.
 * - zadania → zadania procesowe
 * - trening → bloki + godziny + obciążenie (rozwiązane) + tytuł dnia
 * - cele → cele modelu gry (assignments)
 * - trening_cele → trening + cele naraz
 * - obciazenie → tylko obciążenie motoryczne dnia
 */
export function moveDaySectionContent(
  state: TrainingMicrocycleState,
  microcycleId: string,
  section: MicrocycleDaySectionKind,
  fromDayIndex: number,
  toDayIndex: number,
  matchDayIndexes: number[] = []
): TrainingMicrocycleState {
  const from = clampDayIndex(fromDayIndex);
  const to = clampDayIndex(toDayIndex);
  if (from == null || to == null || from === to) return state;

  let next: TrainingMicrocycleState = state;
  const moveZadania = section === "zadania";
  const moveCwiczenia = section === "cwiczenia";
  const moveTrening = section === "trening" || section === "trening_cele";
  const moveCele = section === "cele" || section === "trening_cele";
  const moveObciazenie =
    section === "obciazenie" || section === "trening" || section === "trening_cele";

  if (moveZadania) {
    next = {
      ...next,
      proceduralTasks: moveScopedDayIndex(next.proceduralTasks ?? [], microcycleId, from, to),
    };
  }

  if (moveCwiczenia) {
    next = {
      ...next,
      exercises: moveScopedDayIndex(next.exercises ?? [], microcycleId, from, to),
    };
  }

  if (moveCele) {
    next = {
      ...next,
      assignments: moveScopedDayIndex(next.assignments, microcycleId, from, to),
    };
  }

  if (moveTrening) {
    next = {
      ...next,
      trainingBlocks: moveBlocksToDay(next.trainingBlocks ?? [], microcycleId, from, to),
      dayPlans: moveDayPlanToDay(next.dayPlans ?? [], microcycleId, from, to, matchDayIndexes),
      microcycles: next.microcycles.map((m) => {
        if (m.id !== microcycleId) return m;
        return {
          ...m,
          daySchedules: moveScheduleToDay(m.daySchedules, from, to),
        };
      }),
    };
  }

  if (moveObciazenie) {
    next = {
      ...next,
      microcycles: next.microcycles.map((m) => {
        if (m.id !== microcycleId) return m;
        return moveResolvedDayLoad(m, from, to);
      }),
    };
  }

  return next;
}

/**
 * Zamienia cały pakiet dnia treningowego: zadania, bloki, cele modelu,
 * tytuł (z wyjątkami MD), godziny treningu i nadpisania obciążenia.
 * Mecze (`matches`) pozostają bez zmian.
 */
export function swapMicrocycleDayContent(
  state: TrainingMicrocycleState,
  microcycleId: string,
  fromDayIndex: number,
  toDayIndex: number,
  matchDayIndexes: number[] = []
): TrainingMicrocycleState {
  const from = clampDayIndex(fromDayIndex);
  const to = clampDayIndex(toDayIndex);
  if (from == null || to == null || from === to) return state;

  const assignments = swapScopedDayIndex(state.assignments, microcycleId, from, to);
  const proceduralTasks = swapScopedDayIndex(
    state.proceduralTasks ?? [],
    microcycleId,
    from,
    to
  );
  const exercises = swapScopedDayIndex(state.exercises ?? [], microcycleId, from, to);
  let trainingBlocks = swapScopedDayIndex(
    state.trainingBlocks ?? [],
    microcycleId,
    from,
    to
  );
  trainingBlocks = reindexBlockOrdersForDays(trainingBlocks, microcycleId, [from, to]);

  const dayPlans = swapDayPlansForMicrocycle(
    state.dayPlans ?? [],
    microcycleId,
    from,
    to,
    matchDayIndexes
  );

  const microcycles = state.microcycles.map((m: TrainingMicrocycle) => {
    if (m.id !== microcycleId) return m;
    return {
      ...swapResolvedDayLoads(m, from, to),
      daySchedules: swapSchedules(m.daySchedules, from, to),
      restDays: swapRestDays(m.restDays, from, to),
    };
  });

  return {
    ...state,
    assignments,
    proceduralTasks,
    exercises,
    trainingBlocks,
    dayPlans,
    microcycles,
  };
}

/**
 * Przenosi cały pakiet dnia (zadania + trening + cele) na inny dzień.
 * Źródło zostaje puste; na celu treść jest doklejana / nadpisywana (tytuł, godziny, load).
 */
export function moveMicrocycleDayContent(
  state: TrainingMicrocycleState,
  microcycleId: string,
  fromDayIndex: number,
  toDayIndex: number,
  matchDayIndexes: number[] = []
): TrainingMicrocycleState {
  let next = moveDaySectionContent(
    state,
    microcycleId,
    "zadania",
    fromDayIndex,
    toDayIndex,
    matchDayIndexes
  );
  next = moveDaySectionContent(
    next,
    microcycleId,
    "cwiczenia",
    fromDayIndex,
    toDayIndex,
    matchDayIndexes
  );
  next = moveDaySectionContent(
    next,
    microcycleId,
    "trening_cele",
    fromDayIndex,
    toDayIndex,
    matchDayIndexes
  );
  const from = clampDayIndex(fromDayIndex);
  const to = clampDayIndex(toDayIndex);
  if (from == null || to == null) return next;
  return {
    ...next,
    microcycles: next.microcycles.map((m) =>
      m.id === microcycleId ? { ...m, restDays: moveRestDay(m.restDays, from, to) } : m
    ),
  };
}

/** Czy dzień ma jakąkolwiek treść treningową do przeniesienia (bez meczu). */
export function dayHasMovableContent(
  state: TrainingMicrocycleState,
  microcycleId: string,
  dayIndex: number
): boolean {
  const day = clampDayIndex(dayIndex);
  if (day == null) return false;
  if (state.assignments.some((a) => a.microcycleId === microcycleId && a.dayIndex === day)) {
    return true;
  }
  if (
    (state.proceduralTasks ?? []).some(
      (t) => t.microcycleId === microcycleId && t.dayIndex === day
    )
  ) {
    return true;
  }
  if (
    (state.exercises ?? []).some((e) => e.microcycleId === microcycleId && e.dayIndex === day)
  ) {
    return true;
  }
  if (
    (state.trainingBlocks ?? []).some(
      (b) => b.microcycleId === microcycleId && b.dayIndex === day
    )
  ) {
    return true;
  }
  if ((state.dayPlans ?? []).some((p) => p.microcycleId === microcycleId && p.dayIndex === day)) {
    return true;
  }
  const mc = state.microcycles.find((m) => m.id === microcycleId);
  if (mc?.daySchedules?.some((s) => s.dayIndex === day)) return true;
  if (mc?.dayLoads?.some((l) => l.dayIndex === day)) return true;
  if (isRestDay(mc?.restDays, day)) return true;
  return false;
}
