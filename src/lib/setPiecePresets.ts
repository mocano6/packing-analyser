import type { SetPieceMarker, SetPieceOpponentPlayer, SetPieceTypeId, SetPieceVariantId } from "@/types/setPieces";

export const SET_PIECE_TYPE_OPTIONS: { id: SetPieceTypeId; label: string; description: string }[] = [
  {
    id: "corner_attack",
    label: "Rzut rożny — atak",
    description: "Ustawienie przy rzucie rożnym w strefie ataku (atak w prawo).",
  },
  {
    id: "free_kick_attack",
    label: "Rzut wolny — atak",
    description: "Ustawienie przy rzucie wolnym w strefie ataku (atak w prawo).",
  },
];

export const SET_PIECE_VARIANT_IDS: SetPieceVariantId[] = ["1", "2", "3", "4", "5"];

export const DEFAULT_SET_PIECE_VARIANT: SetPieceVariantId = "1";

const TYPE_LABEL_PL: Record<SetPieceTypeId, string> = {
  corner_attack: "rzut rożny",
  free_kick_attack: "rzut wolny",
};

export function getVariantsForSetPieceType(type: SetPieceTypeId) {
  const typeLabel = TYPE_LABEL_PL[type];
  return SET_PIECE_VARIANT_IDS.map((id) => ({
    id,
    label: id,
    title: `Wariant ${id} — ${typeLabel}`,
  }));
}

export function buildSetupStorageKey(type: SetPieceTypeId, variant: SetPieceVariantId): string {
  return `${type}__${variant}`;
}

const ROW_Y = [18, 32, 50, 68, 82];

/** Lekkie przesunięcie domyślnych pozycji w zależności od numeru wariantu. */
function variantOffsetX(type: SetPieceTypeId, variant: SetPieceVariantId): number {
  const index = SET_PIECE_VARIANT_IDS.indexOf(variant);
  if (index <= 0) return 0;
  const step = type === "corner_attack" ? 1.8 : 1.5;
  return -index * step;
}

/**
 * Rozmieszcza zaznaczonych zawodników w polu karnym / okolicy rzutu (atak w prawo).
 */
export function createDefaultMarkers(
  playerIds: string[],
  type: SetPieceTypeId,
  variant: SetPieceVariantId = DEFAULT_SET_PIECE_VARIANT,
): SetPieceMarker[] {
  const baseX = (type === "corner_attack" ? 78 : 70) + variantOffsetX(type, variant);
  return playerIds.map((playerId, index) => {
    const row = index % ROW_Y.length;
    const col = Math.floor(index / ROW_Y.length);
    return {
      playerId,
      x: Math.min(100, Math.max(50, baseX - col * 7)),
      y: ROW_Y[row] ?? 50,
      side: "own",
    };
  });
}

const OPPONENT_ROW_Y = [20, 35, 50, 65, 80];

/** Domyślne pozycje przeciwników w polu karnym (widok ataku w prawo). */
export function createDefaultOpponentMarkers(
  opponentIds: string[],
  _opponents: SetPieceOpponentPlayer[],
  _variant: SetPieceVariantId = DEFAULT_SET_PIECE_VARIANT,
): SetPieceMarker[] {
  return opponentIds.map((playerId, index) => ({
    playerId,
    side: "opponent",
    x: Math.min(90, 54 + Math.floor(index / OPPONENT_ROW_Y.length) * 8),
    y: OPPONENT_ROW_Y[index % OPPONENT_ROW_Y.length] ?? 50,
  }));
}

export function generateOpponentPlayerId(): string {
  return `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
