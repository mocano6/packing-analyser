export const WEIGHTED_INDEX_FIRESTORE_DOC_ID = "state" as const;
export const WEIGHTED_INDEX_STORAGE_VERSION = 1;

export type WeightedIndexFirestoreDocument = {
  stateJson: string;
  version: number;
  updatedAt: number;
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
