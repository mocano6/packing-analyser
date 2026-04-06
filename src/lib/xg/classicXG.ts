/**
 * Klasyczny model xG z komponentu XGPitch (przed Torvaney).
 * Współrzędne: x, y w procentach 0–100, bramka przeciwnika po prawej (x = 100).
 */
export function getClassicXGFromPercent(x: number, y: number): number {
  const goalX = 100;
  const goalY = 50;

  const distanceFromGoal = Math.sqrt(
    Math.pow(goalX - x, 2) + Math.pow((goalY - y) * 1.544, 2)
  );

  let xG = Math.max(0.01, Math.min(0.95, 1 - distanceFromGoal / 100));

  const angleFromGoal = Math.abs(y - goalY);

  if (angleFromGoal > 20) {
    xG *= 0.6;
  } else if (angleFromGoal > 10) {
    xG *= 0.8;
  }

  if (x > 84.3) {
    xG *= 1.3;
  }

  if (x > 94.8) {
    xG *= 1.8;
  }

  return Math.max(0.01, Math.min(0.95, xG));
}
