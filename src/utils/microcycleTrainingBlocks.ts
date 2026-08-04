import type {
  MicrocycleDayLoad,
  MicrocycleTrainingBlock,
  TrainingMicrocycle,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import type { MicrocycleDayLoadTargets, MotorTagId } from "@/types/microcycleMotor";
import { isMotorTagId } from "@/types/microcycleMotor";
import {
  areaPerPlayer,
  findSsgFormat,
  presetForOffset,
  type MotorPresetBlock,
} from "@/lib/microcycle/motorModel";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";

const MAX_BLOCK_MINUTES = 240;

export function safeBlockMinutes(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_BLOCK_MINUTES, Math.round(n));
}

function safePitchSide(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(130, Math.round(n));
}

function safePlayersPerSide(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(11, Math.round(n));
}

function safeTags(raw: unknown): MotorTagId[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isMotorTagId))];
}

function safeDayIndex(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  return i < 0 || i > 6 ? 0 : i;
}

export function blockAreaPerPlayer(block: MicrocycleTrainingBlock): number | null {
  return areaPerPlayer(block.pitchLength, block.pitchWidth, block.playersPerSide);
}

export function blocksForMicrocycle(
  blocks: MicrocycleTrainingBlock[] | undefined,
  microcycleId: string | null
): MicrocycleTrainingBlock[] {
  if (!blocks || !microcycleId) return [];
  return blocks
    .filter((b) => b.microcycleId === microcycleId)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
}

export function blocksForDay(
  blocks: MicrocycleTrainingBlock[],
  dayIndex: number
): MicrocycleTrainingBlock[] {
  return blocks.filter((b) => b.dayIndex === dayIndex).sort((a, b) => a.order - b.order);
}

function blockFromPreset(
  presetBlock: MotorPresetBlock,
  microcycleId: string,
  dayIndex: number,
  order: number
): MicrocycleTrainingBlock {
  const format = findSsgFormat(presetBlock.formatId ?? null);
  return {
    id: generateMicrocycleId(),
    microcycleId,
    dayIndex,
    order,
    name: presetBlock.name,
    minutes: safeBlockMinutes(presetBlock.minutes),
    formatId: format?.id ?? null,
    pitchLength: format?.length ?? null,
    pitchWidth: format?.width ?? null,
    playersPerSide: format?.playersPerSide ?? null,
    tags: safeTags(presetBlock.tags),
    notes: presetBlock.notes ?? "",
  };
}

/** Bloki z presetu dla jednego dnia (offset liczony od głównego meczu). */
export function presetBlocksForDay(
  microcycleId: string,
  dayIndex: number,
  matchDays: number[]
): MicrocycleTrainingBlock[] {
  const days = normalizeMatchDaysArray(matchDays);
  const primary = days[0] ?? 5;
  const isMatchDay = days.includes(dayIndex);
  const preset = presetForOffset(isMatchDay ? 0 : dayIndex - primary);
  return preset.blocks.map((b, i) => blockFromPreset(b, microcycleId, dayIndex, i));
}

/** Bloki z presetów dla całego tygodnia. */
export function presetBlocksForMicrocycle(
  microcycle: TrainingMicrocycle
): MicrocycleTrainingBlock[] {
  const matchDays = (microcycle.matches ?? []).map((m) => m.dayIndex);
  return Array.from({ length: 7 }, (_, dayIndex) =>
    presetBlocksForDay(microcycle.id, dayIndex, matchDays)
  ).flat();
}

export function createEmptyBlock(
  microcycleId: string,
  dayIndex: number,
  order: number
): MicrocycleTrainingBlock {
  return {
    id: generateMicrocycleId(),
    microcycleId,
    dayIndex,
    order,
    name: "Nowy blok",
    minutes: 15,
    formatId: null,
    pitchLength: null,
    pitchWidth: null,
    playersPerSide: null,
    tags: [],
    notes: "",
  };
}

/** Wybór formatu podstawia wymiary i liczbę graczy z tabeli referencyjnej. */
export function applyFormatToBlock(
  block: MicrocycleTrainingBlock,
  formatId: string | null
): MicrocycleTrainingBlock {
  const format = findSsgFormat(formatId);
  if (!format) {
    return { ...block, formatId: null };
  }
  return {
    ...block,
    formatId: format.id,
    pitchLength: format.length,
    pitchWidth: format.width,
    playersPerSide: format.playersPerSide,
  };
}

export function normalizeTrainingBlocks(raw: unknown): MicrocycleTrainingBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: MicrocycleTrainingBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const microcycleId = String(rec.microcycleId ?? "");
    if (!microcycleId) continue;
    out.push({
      id: String(rec.id ?? "") || generateMicrocycleId(),
      microcycleId,
      dayIndex: safeDayIndex(rec.dayIndex),
      order: Number.isFinite(Number(rec.order)) ? Math.trunc(Number(rec.order)) : 0,
      name: String(rec.name ?? ""),
      minutes: safeBlockMinutes(rec.minutes),
      formatId: findSsgFormat(rec.formatId as string | null)?.id ?? null,
      pitchLength: safePitchSide(rec.pitchLength),
      pitchWidth: safePitchSide(rec.pitchWidth),
      playersPerSide: safePlayersPerSide(rec.playersPerSide),
      tags: safeTags(rec.tags),
      notes: String(rec.notes ?? ""),
    });
  }
  return out.sort(
    (a, b) =>
      a.microcycleId.localeCompare(b.microcycleId) ||
      a.dayIndex - b.dayIndex ||
      a.order - b.order
  );
}

const TARGET_KEYS: (keyof MicrocycleDayLoadTargets)[] = [
  "totalDistancePct",
  "hsrPct",
  "sprintPct",
  "accDecPct",
  "srpe",
  "minutes",
];

export function normalizeDayLoads(raw: unknown): MicrocycleDayLoad[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<number, MicrocycleDayLoad>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const dayIndex = safeDayIndex(rec.dayIndex);
    const dominant =
      typeof rec.dominant === "string" && rec.dominant.length > 0 ? rec.dominant : null;

    let targets: Partial<MicrocycleDayLoadTargets> | undefined;
    if (rec.targets && typeof rec.targets === "object") {
      const src = rec.targets as Record<string, unknown>;
      const acc: Partial<MicrocycleDayLoadTargets> = {};
      for (const key of TARGET_KEYS) {
        const n = Number(src[key]);
        if (Number.isFinite(n) && n >= 0) acc[key] = Math.round(n);
      }
      if (Object.keys(acc).length > 0) targets = acc;
    }

    if (!dominant && !targets) continue;
    byDay.set(dayIndex, {
      dayIndex,
      dominant: dominant as MicrocycleDayLoad["dominant"],
      ...(targets ? { targets } : {}),
    });
  }
  return [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
}

export function setDayLoadOverride(
  dayLoads: MicrocycleDayLoad[] | undefined,
  dayIndex: number,
  patch: Partial<MicrocycleDayLoad>
): MicrocycleDayLoad[] {
  const current = (dayLoads ?? []).find((d) => d.dayIndex === dayIndex);
  const next: MicrocycleDayLoad = {
    dayIndex,
    dominant: patch.dominant !== undefined ? patch.dominant : current?.dominant ?? null,
    ...(patch.targets !== undefined
      ? patch.targets
        ? { targets: { ...(current?.targets ?? {}), ...patch.targets } }
        : {}
      : current?.targets
        ? { targets: current.targets }
        : {}),
  };
  const without = (dayLoads ?? []).filter((d) => d.dayIndex !== dayIndex);
  const isEmpty = next.dominant == null && !next.targets;
  if (isEmpty) return without.sort((a, b) => a.dayIndex - b.dayIndex);
  return [...without, next].sort((a, b) => a.dayIndex - b.dayIndex);
}

/** Usuwa bloki mikrocyklu — przy kasowaniu mikrocyklu. */
export function removeBlocksForMicrocycle(
  state: TrainingMicrocycleState,
  microcycleId: string
): TrainingMicrocycleState {
  if (!state.trainingBlocks?.length) return state;
  return {
    ...state,
    trainingBlocks: state.trainingBlocks.filter((b) => b.microcycleId !== microcycleId),
  };
}
