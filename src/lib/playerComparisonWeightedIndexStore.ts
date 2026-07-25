import {
  buildDefaultWeightedIndexConfigs,
  parsePlayerComparisonWeightedIndexStorage,
  serializePlayerComparisonWeightedIndexStorage,
  type PlayerComparisonWeightedIndexPreset,
} from "@/utils/playerComparisonWeightedIndexPreferences";

export const WEIGHTED_INDEX_FIRESTORE_DOC_ID = "state" as const;
export const WEIGHTED_INDEX_STORAGE_VERSION = 1;

/** Wspólne pakiety wag — kolekcja `settings` (read: auth, write: admin). */
export const WEIGHTED_INDEX_SHARED_PRESETS_COLLECTION = "settings" as const;
export const WEIGHTED_INDEX_SHARED_PRESETS_DOC_ID = "playerComparisonWeightedIndexPresets" as const;

export type WeightedIndexFirestoreDocument = {
  stateJson: string;
  version: number;
  updatedAt: number;
};

export type SharedWeightedIndexPresetsDocument = {
  presetsJson: string;
  version: number;
  updatedAt: number;
};

export type ResolveSharedWeightedIndexPresetsResult = {
  presets: PlayerComparisonWeightedIndexPreset[];
  shouldWriteShared: boolean;
};

export function buildWeightedIndexFirestoreDocument(
  stateJson: string,
  updatedAt: number,
): Record<string, string | number> {
  const ts = Number.isFinite(updatedAt) ? Math.floor(updatedAt) : Date.now();
  return {
    stateJson,
    version: WEIGHTED_INDEX_STORAGE_VERSION,
    updatedAt: ts,
  };
}

export function readWeightedIndexStateJson(raw: Record<string, unknown>): string | null {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  if (!jsonStr) return null;

  const version = typeof raw.version === "number" ? raw.version : Number(raw.version);
  if (Number.isFinite(version) && version !== WEIGHTED_INDEX_STORAGE_VERSION) {
    return null;
  }

  return jsonStr;
}

export function readWeightedIndexUpdatedAt(raw: Record<string, unknown>): number {
  const value = typeof raw.updatedAt === "number" ? raw.updatedAt : Number(raw.updatedAt);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function isSupportedWeightedIndexVersion(raw: Record<string, unknown>): boolean {
  const version = typeof raw.version === "number" ? raw.version : Number(raw.version);
  if (!Number.isFinite(version)) return true;
  return version === WEIGHTED_INDEX_STORAGE_VERSION;
}

export function buildSharedWeightedIndexPresetsDocument(
  presets: PlayerComparisonWeightedIndexPreset[],
  updatedAt: number,
): SharedWeightedIndexPresetsDocument {
  const ts = Number.isFinite(updatedAt) ? Math.floor(updatedAt) : Date.now();
  return {
    presetsJson: serializePlayerComparisonWeightedIndexStorage({
      presets,
      activePresetId: null,
      draftConfigs: buildDefaultWeightedIndexConfigs(),
    }),
    version: WEIGHTED_INDEX_STORAGE_VERSION,
    updatedAt: ts,
  };
}

/** `null` = brak / nieczytelny dokument; pusta tablica = poprawny, pusty stan. */
export function readSharedWeightedIndexPresets(
  raw: Record<string, unknown> | null | undefined,
): PlayerComparisonWeightedIndexPreset[] | null {
  if (!raw) return null;
  if (!isSupportedWeightedIndexVersion(raw)) return null;

  const jsonStr =
    typeof raw.presetsJson === "string" && raw.presetsJson.trim().length > 0
      ? raw.presetsJson
      : null;
  if (!jsonStr) return null;

  return parsePlayerComparisonWeightedIndexStorage(jsonStr).presets;
}

/**
 * Wspólna lista ma pierwszeństwo. Gdy jest pusta, admin może jednorazowo
 * zaseedować ją z prywatnych / lokalnych pakietów.
 */
export function resolveSharedWeightedIndexPresets(input: {
  isAdmin: boolean;
  sharedPresets: PlayerComparisonWeightedIndexPreset[] | null;
  privatePresets: PlayerComparisonWeightedIndexPreset[];
  localPresets: PlayerComparisonWeightedIndexPreset[];
}): ResolveSharedWeightedIndexPresetsResult {
  const shared = input.sharedPresets ?? [];
  if (shared.length > 0) {
    return { presets: shared, shouldWriteShared: false };
  }

  if (!input.isAdmin) {
    return { presets: [], shouldWriteShared: false };
  }

  const candidate =
    input.privatePresets.length > 0 ? input.privatePresets : input.localPresets;
  if (candidate.length === 0) {
    return { presets: [], shouldWriteShared: false };
  }

  return { presets: candidate, shouldWriteShared: true };
}
