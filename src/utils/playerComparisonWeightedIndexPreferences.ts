import type { PlayerComparisonMetricFamily, PlayerComparisonMetricId } from "./playerComparisonMetrics";
import type { PlayerComparisonWeightedMetricConfig } from "./playerComparisonWeightedIndex";
import {
  getDefaultWeightedIndexBetterWhen,
  isWeightedIndexSelectableMetricId,
  sanitizeWeightedIndexConfigs,
  WEIGHTED_INDEX_SELECTABLE_METRIC_IDS,
  type WeightedIndexBetterWhen,
} from "./playerComparisonWeightedIndex";

export const PLAYER_COMPARISON_WEIGHTED_INDEX_STORAGE_KEY = "playerComparison_weightedIndex_v1";

export type PlayerComparisonWeightedIndexPreset = {
  id: string;
  name: string;
  configs: PlayerComparisonWeightedMetricConfig[];
  selectedPositions: string[];
};

export type PlayerComparisonWeightedIndexStorage = {
  presets: PlayerComparisonWeightedIndexPreset[];
  activePresetId: string | null;
  draftConfigs: PlayerComparisonWeightedMetricConfig[];
};

const DEFAULT_ENABLED_METRIC_IDS: PlayerComparisonMetricId[] = [
  "pxtSender",
  "xtSender",
  "xg",
  "regains",
];

const LEGACY_AXIS_TO_METRIC: Partial<Record<PlayerComparisonMetricFamily, PlayerComparisonMetricId>> = {
  packing: "packingSender",
  pxt: "pxtSender",
  xt: "xtSender",
  phaseP1: "phaseP1Sender",
  phaseP2: "phaseP2Sender",
  phaseP3: "phaseP3Sender",
  xg: "xg",
  shots: "shots",
  goals: "goals",
  xgPerShot: "xgPerShot",
  shotsPerGoal: "shotsPerGoal",
  xgPerGoal: "xgPerGoal",
  pkEntries: "pkEntriesSender",
  xgOnPitchAttack: "xgOnPitchAttack",
  xgOnPitchDefense: "xgOnPitchDefense",
  pkEntriesOnPitchAttack: "pkEntriesOnPitchAttack",
  pkEntriesOnPitchDefense: "pkEntriesOnPitchDefense",
  regains: "regains",
  regainsOwnHalf: "regainsOwnHalf",
  regainsOpponentHalf: "regainsOpponentHalf",
  regainsXt: "regainsXt",
  regainsXtAttack: "regainsXtAttack",
  regainsXtDefense: "regainsXtDefense",
  loses: "loses",
  losesOwnHalf: "losesOwnHalf",
  losesOpponentHalf: "losesOpponentHalf",
  losesXt: "losesXt",
  losesXtAttack: "losesXtAttack",
  losesXtDefense: "losesXtDefense",
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readWeight(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

const LEGACY_WEIGHTED_METRIC_ID: Partial<Record<string, PlayerComparisonMetricId>> = {
  defenseShotBlock: "defenseShotBlockXg",
};

function resolveStoredMetricId(item: Record<string, unknown>): PlayerComparisonMetricId | null {
  const rawMetricId = item.metricId;
  if (typeof rawMetricId === "string") {
    const migrated = LEGACY_WEIGHTED_METRIC_ID[rawMetricId];
    if (migrated) return migrated;
    if (isWeightedIndexSelectableMetricId(rawMetricId)) return rawMetricId;
  }

  const rawAxisId = item.axisId;
  if (typeof rawAxisId === "string") {
    const migrated = LEGACY_AXIS_TO_METRIC[rawAxisId as PlayerComparisonMetricFamily];
    if (migrated) return migrated;
  }

  return null;
}

function readBetterWhen(value: unknown, metricId: PlayerComparisonMetricId): WeightedIndexBetterWhen {
  if (value === "lower" || value === "higher") return value;
  return getDefaultWeightedIndexBetterWhen(metricId);
}

export function buildDefaultWeightedIndexConfigs(): PlayerComparisonWeightedMetricConfig[] {
  const defaultWeight =
    DEFAULT_ENABLED_METRIC_IDS.length > 0 ? 100 / DEFAULT_ENABLED_METRIC_IDS.length : 0;
  return WEIGHTED_INDEX_SELECTABLE_METRIC_IDS.map((metricId) => ({
    metricId,
    enabled: DEFAULT_ENABLED_METRIC_IDS.includes(metricId),
    weight: DEFAULT_ENABLED_METRIC_IDS.includes(metricId) ? defaultWeight : 0,
    betterWhen: getDefaultWeightedIndexBetterWhen(metricId),
  }));
}

export function cloneWeightedIndexConfigs(
  configs: PlayerComparisonWeightedMetricConfig[],
): PlayerComparisonWeightedMetricConfig[] {
  return configs.map((config) => ({ ...config }));
}

export function normalizeWeightedIndexSelectedPositions(positions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const position of positions) {
    if (typeof position !== "string") continue;
    const trimmed = position.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function readSelectedPositions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeWeightedIndexSelectedPositions(
    value.filter((position): position is string => typeof position === "string"),
  );
}

export function normalizeWeightedIndexPresetName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidWeightedIndexPresetName(name: string): boolean {
  const normalized = normalizeWeightedIndexPresetName(name);
  return normalized.length >= 1 && normalized.length <= 48;
}

export function createWeightedIndexPresetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseConfigList(raw: unknown): PlayerComparisonWeightedMetricConfig[] | null {
  if (!Array.isArray(raw)) return null;

  const byMetricId = new Map<PlayerComparisonMetricId, PlayerComparisonWeightedMetricConfig>();
  for (const item of raw) {
    if (!isPlainRecord(item)) continue;
    const metricId = resolveStoredMetricId(item);
    if (!metricId) continue;
    byMetricId.set(metricId, {
      metricId,
      enabled: item.enabled === true,
      weight: readWeight(item.weight),
      betterWhen: readBetterWhen(item.betterWhen, metricId),
    });
  }

  return sanitizeWeightedIndexConfigs(
    WEIGHTED_INDEX_SELECTABLE_METRIC_IDS.map(
      (metricId) =>
        byMetricId.get(metricId) ?? {
          metricId,
          enabled: false,
          weight: 0,
          betterWhen: getDefaultWeightedIndexBetterWhen(metricId),
        },
    ),
  );
}

function parsePreset(raw: unknown): PlayerComparisonWeightedIndexPreset | null {
  if (!isPlainRecord(raw)) return null;
  const id = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : null;
  const name = typeof raw.name === "string" ? normalizeWeightedIndexPresetName(raw.name) : "";
  const configs = parseConfigList(raw.configs);
  if (!id || !isValidWeightedIndexPresetName(name) || !configs) return null;
  return { id, name, configs, selectedPositions: readSelectedPositions(raw.selectedPositions) };
}

export function buildDefaultWeightedIndexStorage(): PlayerComparisonWeightedIndexStorage {
  const draftConfigs = buildDefaultWeightedIndexConfigs();
  return { presets: [], activePresetId: null, draftConfigs };
}

/** @deprecated Użyj parsePlayerComparisonWeightedIndexStorage. */
export function parsePlayerComparisonWeightedIndexConfigs(raw: string | null): PlayerComparisonWeightedMetricConfig[] {
  return parsePlayerComparisonWeightedIndexStorage(raw).draftConfigs;
}

export function parsePlayerComparisonWeightedIndexStorage(raw: string | null): PlayerComparisonWeightedIndexStorage {
  const defaults = buildDefaultWeightedIndexStorage();
  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const draftConfigs = parseConfigList(parsed) ?? defaults.draftConfigs;
      return { presets: [], activePresetId: null, draftConfigs };
    }

    if (!isPlainRecord(parsed)) return defaults;

    const draftConfigs = parseConfigList(parsed.draftConfigs) ?? defaults.draftConfigs;
    const presetsRaw = Array.isArray(parsed.presets) ? parsed.presets : [];
    const presets = presetsRaw
      .map(parsePreset)
      .filter((preset): preset is PlayerComparisonWeightedIndexPreset => preset !== null);

    // activePresetId jest prywatne (ostatnio wczytany pakiet); lista presets może być pusta
    // w lokalnym blobie, bo pakiety są współdzielone w settings/.
    const activePresetId =
      typeof parsed.activePresetId === "string" && parsed.activePresetId.trim().length > 0
        ? parsed.activePresetId.trim()
        : null;

    return { presets, activePresetId, draftConfigs };
  } catch {
    return defaults;
  }
}

export function serializePlayerComparisonWeightedIndexStorage(
  storage: PlayerComparisonWeightedIndexStorage,
): string {
  const serializeConfigs = (configs: PlayerComparisonWeightedMetricConfig[]) =>
    configs.map((config) => ({
      metricId: config.metricId,
      enabled: config.enabled,
      weight: config.weight,
      betterWhen: config.betterWhen,
    }));

  return JSON.stringify({
    presets: storage.presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      configs: serializeConfigs(preset.configs),
      selectedPositions: normalizeWeightedIndexSelectedPositions(preset.selectedPositions),
    })),
    activePresetId: storage.activePresetId,
    draftConfigs: serializeConfigs(storage.draftConfigs),
  });
}

/** @deprecated Użyj serializePlayerComparisonWeightedIndexStorage. */
export function serializePlayerComparisonWeightedIndexConfigs(
  configs: PlayerComparisonWeightedMetricConfig[],
): string {
  return serializePlayerComparisonWeightedIndexStorage({
    presets: [],
    activePresetId: null,
    draftConfigs: configs,
  });
}

export function findWeightedIndexPresetByName(
  presets: PlayerComparisonWeightedIndexPreset[],
  name: string,
): PlayerComparisonWeightedIndexPreset | null {
  const normalized = normalizeWeightedIndexPresetName(name).toLocaleLowerCase("pl");
  if (!normalized) return null;
  return presets.find((preset) => preset.name.toLocaleLowerCase("pl") === normalized) ?? null;
}

export function upsertWeightedIndexPreset(
  presets: PlayerComparisonWeightedIndexPreset[],
  name: string,
  configs: PlayerComparisonWeightedMetricConfig[],
  selectedPositions: string[] = [],
): { presets: PlayerComparisonWeightedIndexPreset[]; presetId: string } {
  const normalizedName = normalizeWeightedIndexPresetName(name);
  if (!isValidWeightedIndexPresetName(normalizedName)) {
    throw new Error("Invalid preset name");
  }

  const existing = findWeightedIndexPresetByName(presets, normalizedName);
  const nextConfigs = sanitizeWeightedIndexConfigs(cloneWeightedIndexConfigs(configs));
  const nextSelectedPositions = normalizeWeightedIndexSelectedPositions(selectedPositions);

  if (existing) {
    return {
      presetId: existing.id,
      presets: presets.map((preset) =>
        preset.id === existing.id
          ? { ...preset, name: normalizedName, configs: nextConfigs, selectedPositions: nextSelectedPositions }
          : preset,
      ),
    };
  }

  const presetId = createWeightedIndexPresetId();
  return {
    presetId,
    presets: [
      ...presets,
      { id: presetId, name: normalizedName, configs: nextConfigs, selectedPositions: nextSelectedPositions },
    ],
  };
}

export function deleteWeightedIndexPreset(
  presets: PlayerComparisonWeightedIndexPreset[],
  presetId: string,
): PlayerComparisonWeightedIndexPreset[] {
  return presets.filter((preset) => preset.id !== presetId);
}
