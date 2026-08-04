import type {
  TrainingDayTitleTemplate,
  TrainingDayTitleTemplatesState,
} from "@/types/trainingMicrocycle";
import { TRAINING_DAY_TITLE_TEMPLATES_VERSION } from "@/types/trainingMicrocycle";
import { extractDayTitleTemplatesFromMicrocycleRaw } from "@/lib/trainingMicrocycleFirestore";
import { sanitizeDefaultMatchDayOffset } from "@/utils/dayTitleDefaults";

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

export function defaultTrainingDayTitleTemplatesState(): TrainingDayTitleTemplatesState {
  return { templates: [] };
}

export function sanitizeTrainingDayTitleTemplate(
  raw: Record<string, unknown>
): TrainingDayTitleTemplate {
  return {
    id: String(raw.id ?? ""),
    generalFocus: String(raw.generalFocus ?? "").slice(0, 200),
    gameMoments: String(raw.gameMoments ?? "").slice(0, 300),
    defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(raw.defaultMatchDayOffset),
  };
}

export function migrateTrainingDayTitleTemplatesFromFirestore(
  raw: Record<string, unknown>
): TrainingDayTitleTemplatesState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  if (Array.isArray(inner.templates)) {
    return {
      templates: (inner.templates as Record<string, unknown>[])
        .map(sanitizeTrainingDayTitleTemplate)
        .filter((t) => t.id && t.generalFocus.trim()),
    };
  }

  return {
    templates: extractDayTitleTemplatesFromMicrocycleRaw(inner).map((t) =>
      sanitizeTrainingDayTitleTemplate(t as unknown as Record<string, unknown>)
    ),
  };
}

export function buildSanitizedTrainingDayTitleTemplatesState(
  state: TrainingDayTitleTemplatesState
): Record<string, unknown> {
  return {
    templates: state.templates.map((t) => ({
      id: String(t.id ?? ""),
      generalFocus: String(t.generalFocus ?? "").slice(0, 200),
      gameMoments: String(t.gameMoments ?? "").slice(0, 300),
      defaultMatchDayOffset: sanitizeDefaultMatchDayOffset(t.defaultMatchDayOffset),
    })),
  };
}

export function mergeTrainingDayTitleTemplates(
  existing: TrainingDayTitleTemplate[],
  incoming: TrainingDayTitleTemplate[]
): TrainingDayTitleTemplate[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const tpl of incoming) {
    if (!tpl.id || !tpl.generalFocus.trim()) continue;
    if (!byId.has(tpl.id)) {
      byId.set(tpl.id, sanitizeTrainingDayTitleTemplate(tpl as unknown as Record<string, unknown>));
    }
  }
  return [...byId.values()];
}

export function buildTrainingDayTitleTemplatesTaskDocument(
  state: TrainingDayTitleTemplatesState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedTrainingDayTitleTemplatesState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(TRAINING_DAY_TITLE_TEMPLATES_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : TRAINING_DAY_TITLE_TEMPLATES_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
