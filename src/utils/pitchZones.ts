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

/**
 * Pole karne (nasze) w kanonicznym układzie – strzał z pola karnego w kierunku bramki przeciwnika:
 * - x: 84.3..100 (16.5 m od linii bramkowej = 15.7% długości)
 * - y: 20.3..79.7 (40.32 m szerokości wyśrodkowane)
 */
export function isInPenaltyAreaCanonical(shot: ShotLike): boolean {
  const { x, y } = getShotXYCanonical(shot);
  return x >= 84.3 && x <= 100 && y >= 20.3 && y <= 79.7;
}

/**
 * Pole karne przeciwnika w kanonicznym układzie – strzał przeciwnika z pola karnego (obrona):
 * - x: 0..15.7 (lewa strona boiska, przed naszą bramką)
 * - y: 20.3..79.7 (40.32 m szerokości wyśrodkowane)
 */
export function isInOpponentPenaltyAreaCanonical(shot: ShotLike): boolean {
  const { x, y } = getShotXYCanonical(shot);
  return x >= 0 && x <= 15.7 && y >= 20.3 && y <= 79.7;
}

