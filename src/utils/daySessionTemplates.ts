import type {
  MicrocycleTrainingBlock,
  TrainingDaySessionBlockDraft,
  TrainingDaySessionTemplate,
  TrainingMicrocycleState,
} from "@/types/trainingMicrocycle";
import type {
  GymSessionCharacter,
  MicrocycleDayLoadTargets,
  MotorDominantId,
  MotorSessionRole,
} from "@/types/microcycleMotor";
import {
  MOTOR_CORE_SESSION_ROLES,
  isGymSessionCharacter,
  isMotorDominantId,
  isMotorSessionRole,
  isMotorTagId,
} from "@/types/microcycleMotor";
import type { MotorDayPreset, MotorPresetBlock, MotorSessionPreset } from "@/lib/microcycle/motorModel";
import { findSsgFormat, sessionPresetForRole } from "@/lib/microcycle/motorModel";
import { generateMicrocycleId } from "@/utils/trainingMicrocycle";
import { sanitizeDefaultMatchDayOffset } from "@/utils/dayTitleDefaults";
import { periodizationOffset, normalizeMatchDaysArray } from "@/utils/matchDayLabels";
import { setDayLoadOverride } from "@/utils/microcycleTrainingBlocks";
import { EMPTY_DAY_LOAD_TARGETS } from "@/utils/microcycleLoad";
import { normalizeRestDays, setRestDay } from "@/utils/microcycleRestDays";
import {
  MAX_WEEK_TRAINING_SESSIONS,
  assignSessionRolesToWeek,
  daysToNextMatch,
  restDaysForWeekFill,
  roleForDaysToMatch,
  type MicrocycleSessionRoleAssignment,
} from "@/utils/microcycleSessionRoles";

export {
  MAX_WEEK_TRAINING_SESSIONS,
  assignSessionRolesToWeek,
  daysToNextMatch,
  restDaysForWeekFill,
  roleForDaysToMatch,
};
export type { MicrocycleSessionRoleAssignment };

export const DAY_SESSION_ASSIGNABLE_OFFSETS = [-5, -4, -3, -2, -1, 1] as const;

export function seedKeyForRole(role: MotorSessionRole): string {
  return `seed-role-${role}`;
}

function draftFromPresetBlock(block: MotorPresetBlock): TrainingDaySessionBlockDraft {
  return {
    name: block.name,
    minutes: block.minutes,
    tags: [...block.tags],
    formatId: block.formatId ?? null,
    notes: block.notes ?? "",
  };
}

export function minutesFromDrafts(blocks: TrainingDaySessionBlockDraft[]): number {
  return blocks.reduce((sum, b) => sum + b.minutes, 0);
}

export function templateFromSessionPreset(
  preset: MotorSessionPreset,
  id = seedKeyForRole(preset.role)
): TrainingDaySessionTemplate {
  const blocks = preset.blocks.map(draftFromPresetBlock);
  return {
    id,
    name: preset.title,
    role: preset.role,
    matchDayOffset: null,
    gymCharacter: preset.gymCharacter,
    dominant: preset.dominant,
    motorGoal: preset.motorGoal,
    tacticalGoal: preset.tacticalGoal,
    targets: { ...preset.targets, minutes: minutesFromDrafts(blocks) },
    blocks,
    notes: "",
    seedKey: seedKeyForRole(preset.role),
  };
}

/**
 * Preset dodatkowy z modelu MD (np. dzień siłowni MD+1) — bez roli i bez przypięcia do dnia,
 * więc nie wchodzi do automatycznego rozpisania tygodnia.
 */
export function optionalTemplateFromMotorPreset(
  preset: MotorDayPreset
): TrainingDaySessionTemplate {
  const blocks = preset.blocks.map(draftFromPresetBlock);
  return {
    id: generateMicrocycleId(),
    name: preset.title,
    role: null,
    matchDayOffset: null,
    gymCharacter: preset.gymCharacter,
    dominant: preset.dominant,
    motorGoal: preset.motorGoal,
    tacticalGoal: preset.tacticalGoal,
    targets: { ...preset.targets, minutes: minutesFromDrafts(blocks) },
    blocks,
    notes: "",
  };
}

/** Seed biblioteki — cztery jednostki treningowe tygodnia opisane rolą. */
export function createSeedDaySessionTemplates(): TrainingDaySessionTemplate[] {
  return MOTOR_CORE_SESSION_ROLES.map((role) =>
    templateFromSessionPreset(sessionPresetForRole(role))
  );
}

export function sanitizeSessionBlockDraft(raw: unknown): TrainingDaySessionBlockDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = String(rec.name ?? "").slice(0, 160);
  const minutes = Number(rec.minutes);
  if (!name.trim()) return null;
  const tags = Array.isArray(rec.tags)
    ? [...new Set(rec.tags.filter(isMotorTagId))]
    : [];
  return {
    name,
    minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(240, Math.round(minutes)) : 10,
    tags,
    formatId: findSsgFormat(rec.formatId as string | null)?.id ?? null,
    notes: String(rec.notes ?? "").slice(0, 400),
  };
}

export function sanitizeDaySessionTemplate(raw: Record<string, unknown>): TrainingDaySessionTemplate | null {
  const id = String(raw.id ?? "");
  const name = String(raw.name ?? "").slice(0, 160);
  if (!id || !name.trim()) return null;
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map(sanitizeSessionBlockDraft).filter((b): b is TrainingDaySessionBlockDraft => b != null)
    : [];
  const targetsSrc =
    raw.targets && typeof raw.targets === "object" ? (raw.targets as Record<string, unknown>) : {};
  const targets: MicrocycleDayLoadTargets = { ...EMPTY_DAY_LOAD_TARGETS };
  (Object.keys(EMPTY_DAY_LOAD_TARGETS) as (keyof MicrocycleDayLoadTargets)[]).forEach((key) => {
    const n = Number(targetsSrc[key]);
    if (Number.isFinite(n) && n >= 0) targets[key] = Math.round(n);
  });
  const dominantRaw = raw.dominant;
  return {
    id,
    name,
    role: isMotorSessionRole(raw.role) ? raw.role : null,
    matchDayOffset: sanitizeDefaultMatchDayOffset(raw.matchDayOffset),
    gymCharacter: isGymSessionCharacter(raw.gymCharacter) ? raw.gymCharacter : "none",
    dominant: isMotorDominantId(dominantRaw) ? dominantRaw : "activation",
    motorGoal: String(raw.motorGoal ?? "").slice(0, 400),
    tacticalGoal: String(raw.tacticalGoal ?? "").slice(0, 400),
    targets,
    blocks,
    notes: String(raw.notes ?? "").slice(0, 400),
    seedKey: typeof raw.seedKey === "string" && raw.seedKey ? raw.seedKey.slice(0, 80) : undefined,
  };
}

export function gymMinutesFromDrafts(blocks: TrainingDaySessionBlockDraft[]): number {
  return blocks
    .filter((b) => b.tags.includes("gym") || b.tags.includes("strength_max"))
    .reduce((sum, b) => sum + b.minutes, 0);
}

export function pitchMinutesFromDrafts(blocks: TrainingDaySessionBlockDraft[]): number {
  return blocks
    .filter((b) => !b.tags.includes("gym") && !b.tags.includes("transfer") && !b.tags.includes("video"))
    .reduce((sum, b) => sum + b.minutes, 0);
}

export function inferGymCharacter(blocks: TrainingDaySessionBlockDraft[]): GymSessionCharacter {
  const gymMin = gymMinutesFromDrafts(blocks);
  const tags = new Set(blocks.flatMap((b) => b.tags));
  if (gymMin <= 0 && !tags.has("gym")) return "none";
  if (tags.has("priming") && gymMin <= 18) return "priming";
  if (tags.has("strength_max") && gymMin >= 35) return "heavy";
  if (tags.has("power") || (tags.has("gym") && gymMin >= 20 && gymMin <= 40)) return "power";
  if (tags.has("gym") && gymMin <= 15) return "minimal";
  if (tags.has("strength_max")) return "heavy";
  return gymMin > 0 ? "power" : "none";
}

/** Pierwszy preset użytkownika dla danego offsetu MD (ręczne przypięcie do dnia). */
export function sessionTemplateForOffset(
  templates: TrainingDaySessionTemplate[],
  offset: number
): TrainingDaySessionTemplate | undefined {
  return templates.find((t) => t.matchDayOffset === offset && t.blocks.length > 0);
}

/** Pierwszy preset użytkownika dla danej roli jednostki. */
export function sessionTemplateForRole(
  templates: TrainingDaySessionTemplate[],
  role: MotorSessionRole
): TrainingDaySessionTemplate | undefined {
  return templates.find((t) => t.role === role && t.blocks.length > 0);
}

/**
 * Preset dla konkretnego dnia: najpierw ręczne przypięcie do MD, potem rola dnia,
 * na końcu wbudowany preset modelu.
 */
export function sessionTemplateForDay(
  templates: TrainingDaySessionTemplate[],
  dayIndex: number,
  matchDays: number[],
  restDays: number[] = []
): TrainingDaySessionTemplate | null {
  const days = normalizeMatchDaysArray(matchDays);
  if (days.includes(dayIndex)) return null;
  if (normalizeRestDays(restDays).includes(dayIndex)) return null;
  const offset = periodizationOffset(dayIndex, days[0]);
  const pinned = sessionTemplateForOffset(templates, offset);
  if (pinned) return pinned;
  const role =
    assignSessionRolesToWeek(days, restDays).find((a) => a.dayIndex === dayIndex)?.role ??
    roleForDaysToMatch(daysToNextMatch(dayIndex, days));
  return (
    sessionTemplateForRole(templates, role) ??
    templateFromSessionPreset(sessionPresetForRole(role), `builtin-${role}`)
  );
}

export function blocksFromSessionTemplate(
  template: TrainingDaySessionTemplate,
  microcycleId: string,
  dayIndex: number
): MicrocycleTrainingBlock[] {
  return template.blocks.map((block, order) => {
    const format = findSsgFormat(block.formatId ?? null);
    return {
      id: generateMicrocycleId(),
      microcycleId,
      dayIndex,
      order,
      name: block.name,
      minutes: block.minutes,
      formatId: format?.id ?? null,
      pitchLength: format?.length ?? null,
      pitchWidth: format?.width ?? null,
      playersPerSide: format?.playersPerSide ?? null,
      tags: [...block.tags],
      notes: block.notes ?? "",
    };
  });
}

/**
 * Wstawia preset dnia do mikrocyklu: podmienia bloki i nadpisuje obciążenie.
 */
export function applyDaySessionTemplateToState(
  state: TrainingMicrocycleState,
  microcycleId: string,
  dayIndex: number,
  template: TrainingDaySessionTemplate
): TrainingMicrocycleState {
  if (dayIndex < 0 || dayIndex > 6) return state;
  const fresh = blocksFromSessionTemplate(template, microcycleId, dayIndex);
  const trainingBlocks = [
    ...(state.trainingBlocks ?? []).filter(
      (b) => !(b.microcycleId === microcycleId && b.dayIndex === dayIndex)
    ),
    ...fresh,
  ];
  const microcycles = state.microcycles.map((m) => {
    if (m.id !== microcycleId) return m;
    return {
      ...m,
      restDays: setRestDay(m.restDays, dayIndex, false),
      dayLoads: setDayLoadOverride(m.dayLoads, dayIndex, {
        dominant: template.dominant as MotorDominantId,
        targets: { ...template.targets },
      }),
    };
  });
  return { ...state, trainingBlocks, microcycles };
}

/**
 * Rozpisuje tydzień z presetów: maksymalnie 4 jednostki (pn–czw),
 * pozostałe dni nie-meczowe stają się wolne z zerowym sRPE.
 */
export function applySessionTemplatesToWeek(
  state: TrainingMicrocycleState,
  microcycleId: string,
  matchDays: number[],
  templates: TrainingDaySessionTemplate[]
): { state: TrainingMicrocycleState; applied: number; blockCount: number } {
  const days = normalizeMatchDaysArray(matchDays);
  const primary = days[0];
  const current = state.microcycles.find((m) => m.id === microcycleId);
  const restDays = restDaysForWeekFill(days, current?.restDays ?? []);
  const restSet = new Set(restDays);

  let next: TrainingMicrocycleState = {
    ...state,
    trainingBlocks: (state.trainingBlocks ?? []).filter(
      (b) => !(b.microcycleId === microcycleId && restSet.has(b.dayIndex))
    ),
    microcycles: state.microcycles.map((m) => {
      if (m.id !== microcycleId) return m;
      let dayLoads = (m.dayLoads ?? []).filter((l) => !restSet.has(l.dayIndex));
      for (const dayIndex of restDays) {
        dayLoads = setDayLoadOverride(dayLoads, dayIndex, {
          dominant: "off",
          targets: { ...EMPTY_DAY_LOAD_TARGETS },
        });
      }
      return { ...m, restDays, dayLoads };
    }),
  };

  let applied = 0;
  let blockCount = 0;
  for (const assignment of assignSessionRolesToWeek(days, restDays)) {
    const offset = periodizationOffset(assignment.dayIndex, primary);
    const template =
      sessionTemplateForOffset(templates, offset) ??
      sessionTemplateForRole(templates, assignment.role) ??
      templateFromSessionPreset(sessionPresetForRole(assignment.role), `builtin-${assignment.role}`);
    if (template.blocks.length === 0) continue;
    next = applyDaySessionTemplateToState(next, microcycleId, assignment.dayIndex, template);
    applied += 1;
    blockCount += template.blocks.length;
  }
  return { state: next, applied, blockCount };
}

export function sessionTemplateFromDayBlocks(
  blocks: MicrocycleTrainingBlock[],
  opts: {
    name: string;
    matchDayOffset: number | null;
    dominant: MotorDominantId;
    targets: MicrocycleDayLoadTargets;
    motorGoal?: string;
    tacticalGoal?: string;
    role?: MotorSessionRole | null;
  }
): TrainingDaySessionTemplate {
  const drafts: TrainingDaySessionBlockDraft[] = [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((b) => ({
      name: b.name,
      minutes: b.minutes,
      tags: [...b.tags],
      formatId: b.formatId,
      notes: b.notes,
    }));
  return {
    id: generateMicrocycleId(),
    name: opts.name.slice(0, 160) || "Preset dnia",
    role: opts.role ?? null,
    matchDayOffset: opts.matchDayOffset,
    gymCharacter: inferGymCharacter(drafts),
    dominant: opts.dominant,
    motorGoal: (opts.motorGoal ?? "").slice(0, 400),
    tacticalGoal: (opts.tacticalGoal ?? "").slice(0, 400),
    targets: { ...opts.targets, minutes: minutesFromDrafts(drafts) },
    blocks: drafts,
    notes: "",
  };
}

export function setSessionTemplateMatchDayOffset(
  templates: TrainingDaySessionTemplate[],
  templateId: string,
  offset: number | null
): TrainingDaySessionTemplate[] {
  return templates.map((t) =>
    t.id === templateId
      ? { ...t, matchDayOffset: sanitizeDefaultMatchDayOffset(offset) }
      : t
  );
}

export function emptySessionBlockDraft(): TrainingDaySessionBlockDraft {
  return { name: "Nowy blok", minutes: 10, tags: [], formatId: null, notes: "" };
}

/** Prefiks seedów z modelu per-offset (biblioteka przed przejściem na role). */
const LEGACY_SEED_KEY_PREFIX = "seed-md";

function isSeedTemplate(template: TrainingDaySessionTemplate, seedKeys: Set<string | undefined>) {
  if (!template.seedKey) return false;
  return seedKeys.has(template.seedKey) || template.seedKey.startsWith(LEGACY_SEED_KEY_PREFIX);
}

export function restoreSeedDaySessionTemplates(
  existing: TrainingDaySessionTemplate[]
): TrainingDaySessionTemplate[] {
  const seed = createSeedDaySessionTemplates();
  const seedKeys = new Set(seed.map((s) => s.seedKey));
  const custom = existing.filter((t) => !isSeedTemplate(t, seedKeys));
  return [...seed, ...custom];
}

/**
 * Migracja bibliotek zapisanych przed wprowadzeniem ról: presety per-offset
 * zamieniamy na zestaw czterech jednostek, własne presety zostają bez zmian.
 */
export function migrateLegacyDaySessionTemplates(
  templates: TrainingDaySessionTemplate[]
): TrainingDaySessionTemplate[] {
  const hasLegacy = templates.some((t) => t.seedKey?.startsWith(LEGACY_SEED_KEY_PREFIX));
  if (!hasLegacy) return templates;
  return restoreSeedDaySessionTemplates(templates);
}
