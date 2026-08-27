import type {
  TrainingDaySessionTemplate,
  TrainingDaySessionTemplatesState,
} from "@/types/trainingMicrocycle";
import { TRAINING_DAY_SESSION_TEMPLATES_VERSION } from "@/types/trainingMicrocycle";
import {
  createSeedDaySessionTemplates,
  migrateLegacyDaySessionTemplates,
  sanitizeDaySessionTemplate,
} from "@/utils/daySessionTemplates";

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

export function defaultTrainingDaySessionTemplatesState(
  seed = false
): TrainingDaySessionTemplatesState {
  return { templates: seed ? createSeedDaySessionTemplates() : [] };
}

export function migrateTrainingDaySessionTemplatesFromFirestore(
  raw: Record<string, unknown>
): TrainingDaySessionTemplatesState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  if (Array.isArray(inner.templates)) {
    const templates = (inner.templates as Record<string, unknown>[])
      .map(sanitizeDaySessionTemplate)
      .filter((t): t is TrainingDaySessionTemplate => t != null);
    return { templates: migrateLegacyDaySessionTemplates(templates) };
  }

  return defaultTrainingDaySessionTemplatesState(false);
}

export function buildSanitizedTrainingDaySessionTemplatesState(
  state: TrainingDaySessionTemplatesState
): Record<string, unknown> {
  return {
    templates: state.templates.map((t) => ({
      id: String(t.id ?? ""),
      name: String(t.name ?? "").slice(0, 160),
      role: t.role ?? null,
      matchDayOffset: t.matchDayOffset ?? null,
      gymCharacter: t.gymCharacter,
      dominant: t.dominant,
      motorGoal: String(t.motorGoal ?? "").slice(0, 400),
      tacticalGoal: String(t.tacticalGoal ?? "").slice(0, 400),
      targets: t.targets,
      blocks: t.blocks.map((b) => ({
        name: b.name,
        minutes: b.minutes,
        tags: b.tags,
        formatId: b.formatId ?? null,
        notes: b.notes ?? "",
      })),
      notes: String(t.notes ?? "").slice(0, 400),
      seedKey: t.seedKey ?? null,
    })),
  };
}

export function buildTrainingDaySessionTemplatesTaskDocument(
  state: TrainingDaySessionTemplatesState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedTrainingDaySessionTemplatesState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(TRAINING_DAY_SESSION_TEMPLATES_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : TRAINING_DAY_SESSION_TEMPLATES_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
