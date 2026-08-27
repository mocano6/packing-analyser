import type { GameModelPhaseId } from "@/types/gameModel";
import type {
  LaczyTeamFixture,
  TrainingDayTitleTemplate,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import { TRAINING_MICROCYCLE_VERSION } from "@/types/trainingMicrocycle";
import { normalizeMatchDaysArray } from "../utils/matchDayLabels";
import {
  normalizeMicrocycleMatches,
} from "../utils/microcycleMatches";
import { normalizeMicrocycleDaySchedules } from "../utils/microcycleDaySchedules";
import { normalizeRestDays } from "../utils/microcycleRestDays";
import {
  normalizeDayLoads,
  normalizeTrainingBlocks,
} from "../utils/microcycleTrainingBlocks";
import { normalizeProceduralTasks } from "../utils/proceduralTaskDefaults";
import { normalizeMicrocycleExercises } from "../utils/microcycleExercises";
import { safeDayIndex } from "./staffPlannerFirestore";

const VALID_DAY_PLAN_PHASES = new Set<string>(["defense", "attack", "set_pieces"]);

function safeLevel(v: unknown): 0 | 1 | 2 {
  const n = typeof v === "number" ? v : Number(v);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
}

function safeDayPlanPhaseId(v: unknown): GameModelPhaseId | null {
  const s = String(v ?? "");
  return VALID_DAY_PLAN_PHASES.has(s) ? (s as GameModelPhaseId) : null;
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

const MAX_STORED_FIXTURES = 120;

function normalizeLaczyFixtures(raw: unknown): LaczyTeamFixture[] {
  if (!Array.isArray(raw)) return [];
  const out: LaczyTeamFixture[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const matchId = String(rec.matchId ?? "");
    if (!matchId) continue;
    out.push({
      matchId,
      dateTime: String(rec.dateTime ?? ""),
      state: String(rec.state ?? ""),
      playId: String(rec.playId ?? ""),
      playName: String(rec.playName ?? ""),
      hostId: String(rec.hostId ?? ""),
      hostName: String(rec.hostName ?? ""),
      guestId: String(rec.guestId ?? ""),
      guestName: String(rec.guestName ?? ""),
      stadium: rec.stadium == null ? "" : String(rec.stadium),
      scoreFinal: rec.scoreFinal == null ? null : String(rec.scoreFinal),
    });
  }
  return out.slice(0, MAX_STORED_FIXTURES);
}

function nullableString(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

export function extractDayTitleTemplatesFromMicrocycleRaw(
  inner: Record<string, unknown>
): TrainingDayTitleTemplate[] {
  if (!Array.isArray(inner.dayTitleTemplates)) return [];
  return (inner.dayTitleTemplates as Record<string, unknown>[]).map((t) => ({
    id: String(t.id ?? ""),
    generalFocus: String(t.generalFocus ?? ""),
    gameMoments: String(t.gameMoments ?? ""),
    defaultMatchDayOffset:
      t.defaultMatchDayOffset === null || t.defaultMatchDayOffset === undefined
        ? null
        : Number(t.defaultMatchDayOffset),
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
      dayLoads: normalizeDayLoads(m.dayLoads),
      restDays: normalizeRestDays(m.restDays),
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
      phaseId: safeDayPlanPhaseId(p.phaseId),
    })),
    proceduralTasks: normalizeProceduralTasks(state.proceduralTasks),
    trainingBlocks: normalizeTrainingBlocks(state.trainingBlocks),
    exercises: normalizeMicrocycleExercises(state.exercises),
    trainingCounts,
    activeSeasonId:
      state.activeSeasonId == null || state.activeSeasonId === ""
        ? null
        : String(state.activeSeasonId),
    activeMicrocycleId:
      state.activeMicrocycleId == null || state.activeMicrocycleId === ""
        ? null
        : String(state.activeMicrocycleId),
    lnpTeamUrl: String(state.lnpTeamUrl ?? ""),
    lnpTeamId: nullableString(state.lnpTeamId),
    lnpTeamName: nullableString(state.lnpTeamName),
    lnpFixtures: normalizeLaczyFixtures(state.lnpFixtures),
    lnpFixturesFetchedAt: nullableString(state.lnpFixturesFetchedAt),
    lnpWatchTeamUrl: String(state.lnpWatchTeamUrl ?? ""),
    lnpWatchTeamId: nullableString(state.lnpWatchTeamId),
    lnpWatchTeamName: nullableString(state.lnpWatchTeamName),
    lnpWatchFixtures: normalizeLaczyFixtures(state.lnpWatchFixtures),
    lnpWatchFixturesFetchedAt: nullableString(state.lnpWatchFixturesFetchedAt),
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
        dayLoads: normalizeDayLoads(m.dayLoads),
        restDays: normalizeRestDays(m.restDays),
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
        phaseId: safeDayPlanPhaseId(p.phaseId),
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
    proceduralTasks: normalizeProceduralTasks(inner.proceduralTasks),
    trainingBlocks: normalizeTrainingBlocks(inner.trainingBlocks),
    exercises: normalizeMicrocycleExercises(inner.exercises),
    trainingCounts,
    activeSeasonId,
    activeMicrocycleId,
    lnpTeamUrl: String(inner.lnpTeamUrl ?? ""),
    lnpTeamId: nullableString(inner.lnpTeamId),
    lnpTeamName: nullableString(inner.lnpTeamName),
    lnpFixtures: normalizeLaczyFixtures(inner.lnpFixtures),
    lnpFixturesFetchedAt: nullableString(inner.lnpFixturesFetchedAt),
    lnpWatchTeamUrl: String(inner.lnpWatchTeamUrl ?? ""),
    lnpWatchTeamId: nullableString(inner.lnpWatchTeamId),
    lnpWatchTeamName: nullableString(inner.lnpWatchTeamName),
    lnpWatchFixtures: normalizeLaczyFixtures(inner.lnpWatchFixtures),
    lnpWatchFixturesFetchedAt: nullableString(inner.lnpWatchFixturesFetchedAt),
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
