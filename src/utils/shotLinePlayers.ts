import { Shot } from "@/types";

type ShotLineFields = Pick<Shot, "teamContext" | "linePlayers" | "linePlayersCount">;

/** Opcje kafelków liczby zawodników na linii strzału (atak). */
export const ATTACK_LINE_PLAYERS_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type AttackLinePlayersCountOption =
  (typeof ATTACK_LINE_PLAYERS_COUNT_OPTIONS)[number];

/** Ponowne kliknięcie wybranej liczby zeruje wybór (brak zawodnika na linii). */
export function toggleAttackLinePlayersCount(
  current: number,
  clicked: number,
): number {
  if (!ATTACK_LINE_PLAYERS_COUNT_OPTIONS.includes(clicked as AttackLinePlayersCountOption)) {
    return Math.max(0, Math.trunc(Number(current) || 0));
  }
  const cur = Math.max(0, Math.trunc(Number(current) || 0));
  return cur === clicked ? 0 : clicked;
}

/** Liczba zawodników na linii strzału (atak: linePlayersCount, obrona: linePlayers). */
export function getShotLinePlayersCount(shot: ShotLineFields): number {
  if (shot.teamContext === "attack") {
    return shot.linePlayersCount ?? 0;
  }
  return shot.linePlayers?.length ?? 0;
}

/** Strzał bez zawodnika na linii strzału (ani przeciwnika, ani własnego). */
export function isCleanShot(shot: ShotLineFields): boolean {
  return getShotLinePlayersCount(shot) === 0;
}

export type CleanShotSummary = {
  xg: number;
  shots: number;
  goals: number;
};

export function isShotGoal(shot: Pick<Shot, "isGoal" | "shotType">): boolean {
  return shot.isGoal === true || shot.shotType === "goal";
}

/** Agreguje xG, liczbę strzałów i bramek dla sytuacji „clean”. */
export function summarizeCleanShots(shots: Shot[]): CleanShotSummary {
  return shots.filter(isCleanShot).reduce(
    (acc, shot) => {
      acc.xg += Number(shot.xG) || 0;
      acc.shots += 1;
      if (isShotGoal(shot)) acc.goals += 1;
      return acc;
    },
    { xg: 0, shots: 0, goals: 0 } satisfies CleanShotSummary,
  );
}
