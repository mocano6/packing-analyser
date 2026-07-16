import type { GameModelState } from "@/types/gameModel";
import type { GameModelPack, GameModelPacksState } from "@/types/gameModelPack";
import { GAME_MODEL_PACKS_VERSION } from "@/types/gameModelPack";
import type { PositionSystemState } from "@/types/positionSystem";
import {
  buildSanitizedGameModelState,
  migrateGameModelFromFirestore,
} from "@/lib/gameModelFirestore";
import {
  buildSanitizedPositionSystemState,
  migratePositionSystemFromFirestore,
} from "@/lib/positionSystemFirestore";
import { defaultGameModelPacksState } from "@/utils/gameModelPacks";

function safeUnixMs(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x) || x < 0) return Date.now();
  return Math.floor(x);
}

function sanitizePackName(name: unknown): string {
  return String(name ?? "").trim().slice(0, 120);
}

function sanitizePack(raw: Record<string, unknown>): GameModelPack | null {
  const id = String(raw.id ?? "").trim();
  const name = sanitizePackName(raw.name);
  if (!id || !name) return null;

  const gameModelRaw = (raw.gameModel ?? {}) as Record<string, unknown>;
  const positionSystemRaw = (raw.positionSystem ?? {}) as Record<string, unknown>;

  const gameModel: GameModelState = migrateGameModelFromFirestore(gameModelRaw);
  const positionSystem: PositionSystemState = migratePositionSystemFromFirestore(positionSystemRaw);

  const createdAt = safeUnixMs(raw.createdAt);
  const updatedAt = safeUnixMs(raw.updatedAt ?? raw.createdAt);

  return {
    id,
    name,
    createdAt,
    updatedAt,
    gameModel,
    positionSystem,
  };
}

export function buildSanitizedGameModelPacksState(
  state: GameModelPacksState
): Record<string, unknown> {
  return {
    packs: state.packs
      .map((pack) => {
        const name = sanitizePackName(pack.name);
        const id = String(pack.id ?? "").trim();
        if (!id || !name) return null;
        return {
          id,
          name,
          createdAt: safeUnixMs(pack.createdAt),
          updatedAt: safeUnixMs(pack.updatedAt),
          gameModel: buildSanitizedGameModelState(pack.gameModel),
          positionSystem: buildSanitizedPositionSystemState(pack.positionSystem),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  };
}

export function migrateGameModelPacksFromFirestore(
  raw: Record<string, unknown>
): GameModelPacksState {
  const jsonStr =
    typeof raw.stateJson === "string" && raw.stateJson.trim().length > 0 ? raw.stateJson : null;
  const inner = jsonStr ? (JSON.parse(jsonStr) as Record<string, unknown>) : raw;

  if (!Array.isArray(inner.packs)) {
    return defaultGameModelPacksState();
  }

  const packs = (inner.packs as Record<string, unknown>[])
    .map(sanitizePack)
    .filter((p): p is GameModelPack => p !== null);

  return { packs };
}

export function buildGameModelPacksTaskDocument(
  state: GameModelPacksState,
  updatedAt: number
): Record<string, string | number> {
  const inner = buildSanitizedGameModelPacksState(state);
  const stateJson = JSON.stringify(JSON.parse(JSON.stringify(inner)));
  const ver = Number(GAME_MODEL_PACKS_VERSION);
  const ts = safeUnixMs(updatedAt);
  return {
    stateJson,
    version: Number.isFinite(ver) ? ver : GAME_MODEL_PACKS_VERSION,
    updatedAt: Number.isFinite(ts) ? ts : Date.now(),
  };
}
