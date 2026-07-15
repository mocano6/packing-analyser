import type { TrainingDayTitleTemplate, TrainingMicrocycleState } from "@/types/trainingMicrocycle";
import { TRAINING_MICROCYCLE_VERSION } from "@/types/trainingMicrocycle";
import { normalizeMatchDaysArray } from "../utils/matchDayLabels";
import {
  normalizeMicrocycleMatches,
} from "../utils/microcycleMatches";
import { normalizeMicrocycleDaySchedules } from "../utils/microcycleDaySchedules";
import { safeDayIndex } from "./staffPlannerFirestore";

function safeLevel(v: unknown): 0 | 1 | 2 {
  const n = typeof v === "number" ? v : Number(v);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
}

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

function safeInt(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

export function extractDayTitleTemplatesFromMicrocycleRaw(
  inner: Record<string, unknown>
): TrainingDayTitleTemplate[] {
  if (!Array.isArray(inner.dayTitleTemplates)) return [];
  return (inner.dayTitleTemplates as Record<string, unknown>[]).map((t) => ({
    id: String(t.id ?? ""),
    generalFocus: String(t.generalFocus ?? ""),
    gameMoments: String(t.gameMoments ?? ""),
  }));
}

export function buildSanitizedTrainingMicrocycleState(
  state: TrainingMicrocycleState
): Record<string, unknown> {
  const trainingCounts: Record<string, number> = {};
  for (const [key, val] of Object.entries(state.trainingCounts ?? {})) {
    const n = safeInt(val, 0);
    if (n > 0) trainingCounts[String(key)] = n;
  }

  return {
    seasons: state.seasons.map((s) => ({
      id: String(s.id ?? ""),
      name: String(s.name ?? ""),
      order: safeInt(s.order, 0),
    })),
    microcycles: state.microcycles.map((m) => ({
      id: String(m.id ?? ""),
      seasonId: String(m.seasonId ?? ""),
      number: Math.max(1, safeInt(m.number, 1)),
      weekStartIso: String(m.weekStartIso ?? ""),
      matches: normalizeMicrocycleMatches(m.matches, (m as { matchDays?: number[] }).matchDays),
      daySchedules: normalizeMicrocycleDaySchedules(m.daySchedules),
    })),
    assignments: state.assignments.map((a) => ({
      id: String(a.id ?? ""),
      microcycleId: String(a.microcycleId ?? ""),
      dayIndex: safeDayIndex(a.dayIndex),
      templateId: String(a.templateId ?? ""),
      title: String(a.title ?? ""),
      level: safeLevel(a.level),
    })),
    dayPlans: (state.dayPlans ?? []).map((p) => ({
      id: String(p.id ?? ""),
      microcycleId: String(p.microcycleId ?? ""),
      dayIndex: safeDayIndex(p.dayIndex),
      templateId:
        p.templateId == null || p.templateId === "" ? null : String(p.templateId),
      generalFocus: String(p.generalFocus ?? ""),
      gameMoments: String(p.gameMoments ?? ""),
    })),
    trainingCounts,
    activeSeasonId:
      state.activeSeasonId == null || state.activeSeasonId === ""
        ? null
        : String(state.activeSeasonId),
    activeMicrocycleId:
      state.activeMicrocycleId == null || state.activeMicrocycleId === ""
        ? null
        : String(state.activeMicrocycleId),
  };
}

export function migrateTrainingMicrocycleFromFirestore(
  raw: Record<string, unknown>
): TrainingMicrocycleState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  const seasons = Array.isArray(inner.seasons)
    ? (inner.seasons as Record<string, unknown>[]).map((s) => ({
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        order: safeInt(s.order, 0),
      }))
    : [];

  const microcycles = Array.isArray(inner.microcycles)
    ? (inner.microcycles as Record<string, unknown>[]).map((m) => ({
        id: String(m.id ?? ""),
        seasonId: String(m.seasonId ?? ""),
        number: Math.max(1, safeInt(m.number, 1)),
        weekStartIso: String(m.weekStartIso ?? ""),
        matches: normalizeMicrocycleMatches(m.matches, m.matchDays),
        daySchedules: normalizeMicrocycleDaySchedules(m.daySchedules),
      }))
    : [];

  const assignments = Array.isArray(inner.assignments)
    ? (inner.assignments as Record<string, unknown>[]).map((a) => ({
        id: String(a.id ?? ""),
        microcycleId: String(a.microcycleId ?? ""),
        dayIndex: safeDayIndex(a.dayIndex),
        templateId: String(a.templateId ?? ""),
        title: String(a.title ?? ""),
        level: safeLevel(a.level),
      }))
    : [];

  const dayPlans = Array.isArray(inner.dayPlans)
    ? (inner.dayPlans as Record<string, unknown>[]).map((p) => ({
        id: String(p.id ?? ""),
        microcycleId: String(p.microcycleId ?? ""),
        dayIndex: safeDayIndex(p.dayIndex),
        templateId:
          p.templateId == null || p.templateId === "" ? null : String(p.templateId),
        generalFocus: String(p.generalFocus ?? ""),
        gameMoments: String(p.gameMoments ?? ""),
      }))
    : [];

  const trainingCounts: Record<string, number> = {};
  if (inner.trainingCounts && typeof inner.trainingCounts === "object") {
    for (const [key, val] of Object.entries(inner.trainingCounts as Record<string, unknown>)) {
      const n = safeInt(val, 0);
      if (n > 0) trainingCounts[String(key)] = n;
    }
  }

  const activeSeasonId =
    inner.activeSeasonId == null || inner.activeSeasonId === ""
      ? seasons[0]?.id ?? null
      : String(inner.activeSeasonId);
  const activeMicrocycleId =
    inner.activeMicrocycleId == null || inner.activeMicrocycleId === ""
      ? microcycles.find((m) => m.seasonId === activeSeasonId)?.id ?? microcycles[0]?.id ?? null
      : String(inner.activeMicrocycleId);

  return {
    seasons,
    microcycles,
    assignments,
    dayPlans,
    trainingCounts,
    activeSeasonId,
    activeMicrocycleId,
  };
}

export function buildTrainingMicrocycleTaskDocument(
  state: TrainingMicrocycleState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedTrainingMicrocycleState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(TRAINING_MICROCYCLE_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : TRAINING_MICROCYCLE_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
