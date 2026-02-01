export type ShotLike = {
  x?: unknown;
  y?: unknown;
};

function toFiniteNumberOrZero(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Kanoniczny układ współrzędnych (niezależny od UI flip):
 * - oś X: 0..100 (atak "naszego" zespołu w prawo, czyli bramka po prawej)
 * - oś Y: 0..100 (0 = góra, 100 = dół)
 */
export function getShotXYCanonical(shot: ShotLike): { x: number; y: number } {
  return {
    x: toFiniteNumberOrZero(shot?.x),
    y: toFiniteNumberOrZero(shot?.y),
  };
}

/**
 * Strefa 1T (nasza) w kanonicznym układzie:
 * - y: 39..61
 * - x: 90..100 (prawa strona boiska)
 */
export function isIn1TZoneCanonical(shot: ShotLike): boolean {
  const { x, y } = getShotXYCanonical(shot);
  return y >= 39 && y <= 61 && x >= 90 && x <= 100;
}

/**
 * Strefa 1T przeciwnika w kanonicznym układzie (po przeciwnej stronie):
 * - y: 39..61
 * - x: 0..10 (lewa strona boiska)
 */
export function isInOpponent1TZoneCanonical(shot: ShotLike): boolean {
  const { x, y } = getShotXYCanonical(shot);
  return y >= 39 && y <= 61 && x >= 0 && x <= 10;
}

