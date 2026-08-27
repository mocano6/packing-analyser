import type {
  TrainingProceduralTaskTemplate,
  TrainingProceduralTaskTemplatesState,
} from "@/types/trainingMicrocycle";
import { TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION } from "@/types/trainingMicrocycle";
import { sanitizeDefaultMatchDayOffset } from "@/utils/dayTitleDefaults";
import {
  createSeedProceduralTaskTemplates,
  sanitizeOptionalCoachId,
} from "@/utils/proceduralTaskDefaults";

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

export function defaultTrainingProceduralTaskTemplatesState(
  seed = false
): TrainingProceduralTaskTemplatesState {
  return { templates: seed ? createSeedProceduralTaskTemplates() : [] };
}

export function sanitizeTrainingProceduralTaskTemplate(
  raw: Record<string, unknown>
): TrainingProceduralTaskTemplate {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "").slice(0, 200),
    notes: String(raw.notes ?? "").slice(0, 400),
    defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(raw.defaultMatchDayOffset),
    defaultCoachId: sanitizeOptionalCoachId(raw.defaultCoachId),
  };
}

export function migrateTrainingProceduralTaskTemplatesFromFirestore(
  raw: Record<string, unknown>
): TrainingProceduralTaskTemplatesState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  if (Array.isArray(inner.templates)) {
    return {
      templates: (inner.templates as Record<string, unknown>[])
        .map(sanitizeTrainingProceduralTaskTemplate)
        .filter((t) => t.id && t.title.trim()),
    };
  }

  return defaultTrainingProceduralTaskTemplatesState(false);
}

export function buildSanitizedTrainingProceduralTaskTemplatesState(
  state: TrainingProceduralTaskTemplatesState
): Record<string, unknown> {
  return {
    templates: state.templates.map((t) => ({
      id: String(t.id ?? ""),
      title: String(t.title ?? "").slice(0, 200),
      notes: String(t.notes ?? "").slice(0, 400),
      defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(t.defaultMatchDayOffset),
      defaultCoachId: sanitizeOptionalCoachId(t.defaultCoachId),
    })),
  };
}

export function buildTrainingProceduralTaskTemplatesTaskDocument(
  state: TrainingProceduralTaskTemplatesState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedTrainingProceduralTaskTemplatesState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : TRAINING_PROCEDURAL_TASK_TEMPLATES_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
