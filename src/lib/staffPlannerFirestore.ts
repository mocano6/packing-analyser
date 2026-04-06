import type { StaffPlannerState } from "../types/staffPlanner";
import { DEFAULT_STAFF_TASK_CATEGORY_ID, STAFF_PLANNER_VERSION } from "../types/staffPlanner";
import { normalizeMatchDaysArray } from "../utils/matchDayLabels";

/** Firestore odrzuca NaN / Infinity w polach liczbowych (invalid-argument). */
function safeInt(n: unknown, min: number, max: number, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  const i = Math.trunc(x);
  if (i < min || i > max) return fallback;
  return i;
}

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

/** Normalizacja dayIndex przy odczycie z JSON / Firestore. */
export function safeDayIndex(n: unknown): number {
  return safeInt(n, 0, 6, 0);
}

/**
 * Spłaszczony stan (bez pól meta) — serializowany do JSON w polu `stateJson`.
 */
export function buildSanitizedInnerState(state: StaffPlannerState): Record<string, unknown> {
  const matchDays = normalizeMatchDaysArray(
    Array.isArray(state.matchDays) ? state.matchDays : [5]
  );

  return {
    coaches: state.coaches.map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? ""),
      color: String(c.color ?? "#64748b"),
    })),
    templates: state.templates.map((t) => ({
      id: String(t.id ?? ""),
      title: String(t.title ?? ""),
      repeatable: Boolean(t.repeatable),
      defaultCoachId: t.defaultCoachId == null || t.defaultCoachId === "" ? null : String(t.defaultCoachId),
      categoryId: String(t.categoryId || DEFAULT_STAFF_TASK_CATEGORY_ID),
    })),
    assignments: state.assignments.map((a) => ({
      id: String(a.id ?? ""),
      weekStartIso: String(a.weekStartIso ?? ""),
      dayIndex: safeInt(a.dayIndex, 0, 6, 0),
      coachId: String(a.coachId ?? ""),
      title: String(a.title ?? ""),
      templateId: a.templateId == null || a.templateId === "" ? null : String(a.templateId),
      categoryId: String(a.categoryId || DEFAULT_STAFF_TASK_CATEGORY_ID),
    })),
    matchDays,
  };
}

/**
 * Dokument w `users/{uid}/tasks/{id}`: tylko string + liczby całkowite.
 * Stan w polu `stateJson` (JSON). Pole `blob` było wcześniej — nadal obsługiwane przy odczycie.
 */
export function buildPlannerTaskDocument(
  state: StaffPlannerState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedInnerState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(STAFF_PLANNER_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : STAFF_PLANNER_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
