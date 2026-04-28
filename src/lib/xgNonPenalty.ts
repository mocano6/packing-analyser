/** Strzał karny w danych strzałów — wyłączany z NPxG. */
export function shotIsPenalty(shot: { actionType?: string }): boolean {
  return shot.actionType === "penalty";
}

/** Suma xG ze strzałów innych niż karny (NPxG). */
export function sumNonPenaltyXg<T extends { xG?: number; actionType?: string }>(shots: T[]): number {
  return shots
    .filter((s) => !shotIsPenalty(s))
    .reduce((sum, s) => sum + (Number(s.xG) || 0), 0);
}
