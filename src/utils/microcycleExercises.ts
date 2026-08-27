import type {
  MicrocycleDayExercise,
  MicrocycleMatch,
  TrainingExerciseKind,
  TrainingExerciseTemplate,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import {
  dayIndexFromMatchDayOffset,
  sanitizeDefaultMatchDayOffset,
} from "@/utils/dayTitleDefaults";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";
import { isRestDay, normalizeRestDays } from "@/utils/microcycleRestDays";

export const EXERCISE_ASSIGNABLE_MD_OFFSETS = [-5, -4, -3, -2, -1, 1] as const;

/** Nordic jest w zestawach jednostek (bloki siłowe) — nie dublujemy go w bibliotece Ćwiczenia. */
export const RETIRED_SEED_EXERCISE_NAMES = ["Nordic Hamstring"] as const;

const VALID_KINDS = new Set<TrainingExerciseKind>(["gym", "prevention"]);

export function isRetiredSeedExerciseName(name: string): boolean {
  return (RETIRED_SEED_EXERCISE_NAMES as readonly string[]).includes(name.trim());
}

export function withoutRetiredSeedTemplates<T extends { name: string }>(templates: T[]): T[] {
  return templates.filter((t) => !isRetiredSeedExerciseName(t.name));
}

export function withoutRetiredSeedExercises<T extends { name: string }>(exercises: T[]): T[] {
  return exercises.filter((e) => !isRetiredSeedExerciseName(e.name));
}

export function isTrainingExerciseKind(v: unknown): v is TrainingExerciseKind {
  return typeof v === "string" && VALID_KINDS.has(v as TrainingExerciseKind);
}

export function sanitizeExerciseMinutes(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 8;
  return Math.min(90, Math.max(1, Math.round(n)));
}

export function sanitizeTrainingExerciseTemplate(
  raw: Record<string, unknown>
): TrainingExerciseTemplate {
  const kind: TrainingExerciseKind = isTrainingExerciseKind(raw.kind) ? raw.kind : "prevention";
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "").slice(0, 120),
    kind,
    minutes: sanitizeExerciseMinutes(raw.minutes),
    notes: String(raw.notes ?? "").slice(0, 400),
    artificialTurfFocus: raw.artificialTurfFocus === true,
    defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(raw.defaultMatchDayOffset),
  };
}

export function sanitizeMicrocycleDayExercise(
  raw: Record<string, unknown>
): MicrocycleDayExercise {
  const kind: TrainingExerciseKind = isTrainingExerciseKind(raw.kind) ? raw.kind : "prevention";
  const dayRaw = typeof raw.dayIndex === "number" ? raw.dayIndex : Number(raw.dayIndex);
  const dayIndex = Number.isInteger(dayRaw) && dayRaw >= 0 && dayRaw <= 6 ? dayRaw : 0;
  const orderRaw = typeof raw.order === "number" ? raw.order : Number(raw.order);
  return {
    id: String(raw.id ?? ""),
    microcycleId: String(raw.microcycleId ?? ""),
    dayIndex,
    templateId:
      raw.templateId == null || raw.templateId === "" ? null : String(raw.templateId),
    name: String(raw.name ?? "").slice(0, 120),
    kind,
    minutes: sanitizeExerciseMinutes(raw.minutes),
    notes: String(raw.notes ?? "").slice(0, 400),
    artificialTurfFocus: raw.artificialTurfFocus === true,
    done: raw.done === true,
    order: Number.isFinite(orderRaw) ? Math.max(0, Math.trunc(orderRaw)) : 0,
  };
}

export function normalizeMicrocycleExercises(raw: unknown): MicrocycleDayExercise[] {
  if (!Array.isArray(raw)) return [];
  return withoutRetiredSeedExercises(
    (raw as Record<string, unknown>[])
      .map(sanitizeMicrocycleDayExercise)
      .filter((e) => e.id && e.microcycleId && e.name.trim())
  );
}

export function weekHasArtificialSurface(matches: MicrocycleMatch[] | undefined): boolean {
  return (matches ?? []).some((m) => m.surface === "artificial");
}

/** Seed tygodniowy: siłownia + prewencja, część tylko na sztuczną nawierzchnię. */
export function createSeedExerciseTemplates(): TrainingExerciseTemplate[] {
  return [
    {
      id: generateMicrocycleId(),
      name: "RDL / hip hinge",
      kind: "gym",
      minutes: 10,
      notes: "Tylny łańcuch — 3×6",
      artificialTurfFocus: false,
      defaultMatchDayOffset: -5,
    },
    {
      id: generateMicrocycleId(),
      name: "Split squat",
      kind: "gym",
      minutes: 10,
      notes: "Jednonóż, kontrola kolana",
      artificialTurfFocus: false,
      defaultMatchDayOffset: -5,
    },
    {
      id: generateMicrocycleId(),
      name: "Core anti-rotacja",
      kind: "gym",
      minutes: 8,
      notes: "Pallof / dead bug",
      artificialTurfFocus: false,
      defaultMatchDayOffset: -3,
    },
    {
      id: generateMicrocycleId(),
      name: "Soleus / calf raise",
      kind: "gym",
      minutes: 6,
      notes: "Sztywność stawu skokowego na sztucznym",
      artificialTurfFocus: true,
      defaultMatchDayOffset: -4,
    },
    {
      id: generateMicrocycleId(),
      name: "Mobilność bioder 90/90",
      kind: "prevention",
      minutes: 6,
      notes: "",
      artificialTurfFocus: false,
      defaultMatchDayOffset: -3,
    },
    {
      id: generateMicrocycleId(),
      name: "Glute med / clamshell",
      kind: "prevention",
      minutes: 5,
      notes: "Stabilizacja miednicy",
      artificialTurfFocus: false,
      defaultMatchDayOffset: -2,
    },
    {
      id: generateMicrocycleId(),
      name: "Mobilność stawu skokowego",
      kind: "prevention",
      minutes: 6,
      notes: "Kostka — szczególnie na sztucznym",
      artificialTurfFocus: true,
      defaultMatchDayOffset: -2,
    },
    {
      id: generateMicrocycleId(),
      name: "Copenhagen / przywodziciele",
      kind: "prevention",
      minutes: 8,
      notes: "Prewencja pachwiny na sztucznym",
      artificialTurfFocus: true,
      defaultMatchDayOffset: -4,
    },
    {
      id: generateMicrocycleId(),
      name: "Stabilizacja kolana 1-nóż",
      kind: "prevention",
      minutes: 6,
      notes: "Single-leg balance + control",
      artificialTurfFocus: true,
      defaultMatchDayOffset: -5,
    },
    {
      id: generateMicrocycleId(),
      name: "Rozluźnienie łydek",
      kind: "prevention",
      minutes: 6,
      notes: "MD+1 po sztucznym",
      artificialTurfFocus: true,
      defaultMatchDayOffset: 1,
    },
  ];
}

export function setExerciseTemplateDefaultMatchDayOffset(
  templates: TrainingExerciseTemplate[],
  templateId: string,
  offset: number | null
): TrainingExerciseTemplate[] {
  return templates.map((t) =>
    t.id === templateId
      ? { ...t, defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(offset) }
      : t
  );
}

export function exercisesForDay(
  exercises: MicrocycleDayExercise[] | undefined,
  microcycleId: string | null,
  dayIndex: number
): MicrocycleDayExercise[] {
  if (!microcycleId) return [];
  return (exercises ?? [])
    .filter((e) => e.microcycleId === microcycleId && e.dayIndex === dayIndex)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pl"));
}

function nextOrderForDay(
  exercises: MicrocycleDayExercise[],
  microcycleId: string,
  dayIndex: number
): number {
  let max = -1;
  for (const e of exercises) {
    if (e.microcycleId === microcycleId && e.dayIndex === dayIndex) {
      max = Math.max(max, e.order);
    }
  }
  return max + 1;
}

export function exerciseFromTemplate(
  template: TrainingExerciseTemplate,
  microcycleId: string,
  dayIndex: number,
  order: number
): MicrocycleDayExercise {
  return {
    id: generateMicrocycleId(),
    microcycleId,
    dayIndex,
    templateId: template.id,
    name: template.name,
    kind: template.kind,
    minutes: template.minutes,
    notes: template.notes ?? "",
    artificialTurfFocus: template.artificialTurfFocus,
    done: false,
    order,
  };
}

export function exercisesFromDefaults(
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingExerciseTemplate[],
  includeArtificialTurf: boolean,
  previousDoneByTemplateId: Map<string, boolean> = new Map(),
  restDays: number[] = []
): MicrocycleDayExercise[] {
  const rest = normalizeRestDays(restDays);
  const eligible = templates.filter((t) => {
    if (sanitizeDefaultMatchDayOffset(t.defaultMatchDayOffset) == null) return false;
    if (t.artificialTurfFocus && !includeArtificialTurf) return false;
    return true;
  });
  const sorted = [...eligible].sort((a, b) => {
    const ao = a.defaultMatchDayOffset ?? 999;
    const bo = b.defaultMatchDayOffset ?? 999;
    if (ao !== bo) return ao - bo;
    if (a.kind !== b.kind) return a.kind === "gym" ? -1 : 1;
    return a.name.localeCompare(b.name, "pl");
  });
  const countByDay = new Map<number, number>();
  const out: MicrocycleDayExercise[] = [];
  for (const tpl of sorted) {
    const offset = sanitizeDefaultMatchDayOffset(tpl.defaultMatchDayOffset);
    if (offset == null) continue;
    const dayIndex = dayIndexFromMatchDayOffset(primaryMatchDayIndex, offset);
    if (dayIndex == null) continue;
    if (isRestDay(rest, dayIndex)) continue;
    const order = countByDay.get(dayIndex) ?? 0;
    countByDay.set(dayIndex, order + 1);
    out.push({
      ...exerciseFromTemplate(tpl, microcycleId, dayIndex, order),
      done: previousDoneByTemplateId.get(tpl.id) ?? false,
    });
  }
  return out;
}

/**
 * Uzupełnia ćwiczenia z biblioteki (offset MD).
 * Prewencja „sztuczne” tylko gdy mecz jest na sztucznej nawierzchni.
 */
export function mergeDefaultExercisesIntoState(
  state: TrainingMicrocycleState,
  microcycleId: string,
  primaryMatchDayIndex: number,
  templates: TrainingExerciseTemplate[],
  includeArtificialTurf: boolean,
  restDays: number[] = []
): TrainingMicrocycleState {
  const defaultIds = new Set(
    templates
      .filter((t) => {
        if (sanitizeDefaultMatchDayOffset(t.defaultMatchDayOffset) == null) return false;
        if (t.artificialTurfFocus && !includeArtificialTurf) return false;
        return true;
      })
      .map((t) => t.id)
  );

  const previousDone = new Map<string, boolean>();
  for (const e of state.exercises ?? []) {
    if (e.microcycleId !== microcycleId) continue;
    if (e.templateId && defaultIds.has(e.templateId)) {
      previousDone.set(e.templateId, e.done);
    }
  }

  const generated = exercisesFromDefaults(
    microcycleId,
    primaryMatchDayIndex,
    templates,
    includeArtificialTurf,
    previousDone,
    restDays
  );

  const kept = (state.exercises ?? []).filter((e) => {
    if (isRetiredSeedExerciseName(e.name)) return false;
    if (e.microcycleId !== microcycleId) return true;
    if (e.templateId && defaultIds.has(e.templateId)) return false;
    // Usuń auto-sztuczne, gdy nawierzchnia nie jest już sztuczna.
    if (
      e.templateId &&
      templates.some((t) => t.id === e.templateId && t.artificialTurfFocus) &&
      !includeArtificialTurf
    ) {
      return false;
    }
    return true;
  });

  return { ...state, exercises: [...kept, ...generated] };
}

/** Dodaje ćwiczenie z presetu albo przenosi istniejące w tym mikrocyklu. */
export function addOrMoveExerciseFromTemplate(
  state: TrainingMicrocycleState,
  microcycleId: string,
  dayIndex: number,
  template: TrainingExerciseTemplate
): TrainingMicrocycleState {
  const all = state.exercises ?? [];
  const existing = all.find(
    (e) => e.microcycleId === microcycleId && e.templateId === template.id
  );
  if (existing) {
    if (existing.dayIndex === dayIndex) return state;
    return {
      ...state,
      exercises: all.map((e) =>
        e.id === existing.id
          ? { ...e, dayIndex, order: nextOrderForDay(all, microcycleId, dayIndex) }
          : e
      ),
    };
  }
  const created = exerciseFromTemplate(
    template,
    microcycleId,
    dayIndex,
    nextOrderForDay(all, microcycleId, dayIndex)
  );
  return { ...state, exercises: [...all, created] };
}

export function moveExerciseToDay(
  exercises: MicrocycleDayExercise[],
  exerciseId: string,
  dayIndex: number
): MicrocycleDayExercise[] {
  const target = exercises.find((e) => e.id === exerciseId);
  if (!target || target.dayIndex === dayIndex) return exercises;
  const order = nextOrderForDay(exercises, target.microcycleId, dayIndex);
  return exercises.map((e) => (e.id === exerciseId ? { ...e, dayIndex, order } : e));
}

export function toggleExerciseDone(
  exercises: MicrocycleDayExercise[],
  exerciseId: string
): MicrocycleDayExercise[] {
  return exercises.map((e) => (e.id === exerciseId ? { ...e, done: !e.done } : e));
}

export function removeExercise(
  exercises: MicrocycleDayExercise[],
  exerciseId: string
): MicrocycleDayExercise[] {
  return exercises.filter((e) => e.id !== exerciseId);
}
