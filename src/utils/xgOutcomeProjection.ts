export interface XgOutcomeProjection {
  winProbability: number;
  drawProbability: number;
  lossProbability: number;
  expectedPoints: number;
  opponentExpectedPoints: number;
}

type ShotLike = {
  xG?: number | null;
};

function clampShotProbability(value: unknown): number {
  const probability = Number(value);
  if (!Number.isFinite(probability)) return 0;
  return Math.min(1, Math.max(0, probability));
}

function buildGoalDistribution(shots: ShotLike[]): number[] {
  return shots.reduce<number[]>((distribution, shot) => {
    const probability = clampShotProbability(shot.xG);
    const next = Array(distribution.length + 1).fill(0) as number[];

    distribution.forEach((currentProbability, goals) => {
      next[goals] += currentProbability * (1 - probability);
      next[goals + 1] += currentProbability * probability;
    });

    return next;
  }, [1]);
}

export function calculateXgOutcomeProjection(
  teamShots: ShotLike[],
  opponentShots: ShotLike[]
): XgOutcomeProjection {
  const teamGoalsDistribution = buildGoalDistribution(teamShots);
  const opponentGoalsDistribution = buildGoalDistribution(opponentShots);

  let winProbability = 0;
  let drawProbability = 0;
  let lossProbability = 0;

  teamGoalsDistribution.forEach((teamProbability, teamGoals) => {
    opponentGoalsDistribution.forEach((opponentProbability, opponentGoals) => {
      const outcomeProbability = teamProbability * opponentProbability;

      if (teamGoals > opponentGoals) {
        winProbability += outcomeProbability;
      } else if (teamGoals === opponentGoals) {
        drawProbability += outcomeProbability;
      } else {
        lossProbability += outcomeProbability;
      }
    });
  });

  return {
    winProbability,
    drawProbability,
    lossProbability,
    expectedPoints: (winProbability * 3) + drawProbability,
    opponentExpectedPoints: (lossProbability * 3) + drawProbability,
  };
}
