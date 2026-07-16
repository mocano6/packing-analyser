import type { GameModelState } from "@/types/gameModel";
import type { GameModelPack, GameModelPacksState } from "@/types/gameModelPack";
import type { PositionSystemState } from "@/types/positionSystem";

export function defaultGameModelPacksState(): GameModelPacksState {
  return { packs: [] };
}

export function cloneGameModelState(state: GameModelState): GameModelState {
  return JSON.parse(JSON.stringify(state)) as GameModelState;
}

export function clonePositionSystemState(state: PositionSystemState): PositionSystemState {
  return JSON.parse(JSON.stringify(state)) as PositionSystemState;
}

export function packSummary(pack: GameModelPack): {
  templateCount: number;
  gameNodeCount: number;
  positionNodeCount: number;
} {
  return {
    templateCount: pack.gameModel.templates.length,
    gameNodeCount: pack.gameModel.nodes.length,
    positionNodeCount: pack.positionSystem.nodes.length,
  };
}

export function createGameModelPack(input: {
  id: string;
  name: string;
  gameModel: GameModelState;
  positionSystem: PositionSystemState;
  now?: number;
  /** Przy nadpisaniu zachowaj oryginalną datę utworzenia. */
  createdAt?: number;
}): GameModelPack {
  const now = input.now ?? Date.now();
  return {
    id: input.id,
    name: input.name.trim(),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    gameModel: cloneGameModelState(input.gameModel),
    positionSystem: clonePositionSystemState(input.positionSystem),
  };
}

/** Zapisuje nowy pack albo nadpisuje istniejący o tym samym id. */
export function upsertGameModelPack(
  packs: GameModelPack[],
  pack: GameModelPack
): GameModelPack[] {
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx < 0) return [...packs, pack];
  const next = packs.slice();
  next[idx] = pack;
  return next;
}

/** Znajduje pack po znormalizowanej nazwie (trim + lower). */
export function findPackByName(packs: GameModelPack[], name: string): GameModelPack | undefined {
  const key = name.trim().toLowerCase();
  if (!key) return undefined;
  return packs.find((p) => p.name.trim().toLowerCase() === key);
}

export function removeGameModelPack(packs: GameModelPack[], packId: string): GameModelPack[] {
  return packs.filter((p) => p.id !== packId);
}

export function applyGameModelPack(pack: GameModelPack): {
  gameModel: GameModelState;
  positionSystem: PositionSystemState;
} {
  return {
    gameModel: cloneGameModelState(pack.gameModel),
    positionSystem: clonePositionSystemState(pack.positionSystem),
  };
}

export function sortPacksByUpdatedAtDesc(packs: GameModelPack[]): GameModelPack[] {
  return [...packs].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name, "pl"));
}
