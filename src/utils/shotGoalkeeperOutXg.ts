/** Bramkarz poza bramką dodaje 15 punktów procentowych do finalnego xG. */
export const GOALKEEPER_OUT_XG_BONUS_PERCENT = 15;

export function applyGoalkeeperOutXgBoost(xgPercent: number, isGoalkeeperOut: boolean): number {
  if (!isGoalkeeperOut) return xgPercent;
  return xgPercent + GOALKEEPER_OUT_XG_BONUS_PERCENT;
}

export function reverseGoalkeeperOutXgBoost(xgPercent: number, isGoalkeeperOut: boolean): number {
  if (!isGoalkeeperOut) return xgPercent;
  return xgPercent - GOALKEEPER_OUT_XG_BONUS_PERCENT;
}
