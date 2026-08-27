import type {
  TrainingExerciseTemplate,
  TrainingExerciseTemplatesState,
} from "@/types/trainingMicrocycle";
import { TRAINING_EXERCISE_TEMPLATES_VERSION } from "@/types/trainingMicrocycle";
import {
  createSeedExerciseTemplates,
  sanitizeTrainingExerciseTemplate,
  withoutRetiredSeedTemplates,
} from "@/utils/microcycleExercises";

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

export function defaultTrainingExerciseTemplatesState(
  seed = false
): TrainingExerciseTemplatesState {
  return { templates: seed ? createSeedExerciseTemplates() : [] };
}

export function migrateTrainingExerciseTemplatesFromFirestore(
  raw: Record<string, unknown>
): TrainingExerciseTemplatesState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  if (Array.isArray(inner.templates)) {
    return {
      templates: withoutRetiredSeedTemplates(
        (inner.templates as Record<string, unknown>[])
          .map(sanitizeTrainingExerciseTemplate)
          .filter((t) => t.id && t.name.trim())
      ),
    };
  }

  return defaultTrainingExerciseTemplatesState(false);
}

export function buildSanitizedTrainingExerciseTemplatesState(
  state: TrainingExerciseTemplatesState
): Record<string, unknown> {
  return {
    templates: state.templates.map((t: TrainingExerciseTemplate) =>
      sanitizeTrainingExerciseTemplate(t as unknown as Record<string, unknown>)
    ),
  };
}

export function buildTrainingExerciseTemplatesTaskDocument(
  state: TrainingExerciseTemplatesState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedTrainingExerciseTemplatesState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(TRAINING_EXERCISE_TEMPLATES_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : TRAINING_EXERCISE_TEMPLATES_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
