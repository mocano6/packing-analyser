import type { GameModelState } from "@/types/gameModel";
import type { PositionSystemState } from "@/types/positionSystem";

/**
 * Nazwany snapshot biblioteki zasad + modelu drużyny + systemu pozycji.
 * Służy do ponownego użycia tego samego modelu u innych zespołów.
 */
export interface GameModelPack {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  gameModel: GameModelState;
  positionSystem: PositionSystemState;
}

export interface GameModelPacksState {
  packs: GameModelPack[];
}

export const GAME_MODEL_PACKS_VERSION = 1 as const;

/** Dokument w `users/{uid}/tasks/` — nie pokazuj w kwadrancie Eisenhowera. */
export const GAME_MODEL_PACKS_DOC_ID = "gameModelPacksState" as const;
