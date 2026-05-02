/**
 * Simple xG z narzędzia Bena Torvaney (źródło: torvaney.github.io/projects/xG.html).
 * Współrzędne pikseli jak w oryginale: pole klikalne x ∈ [5,385], y ∈ [5,285].
 */

export type TeamContextForXG = "attack" | "defense";

const PITCH_WIDTH_M = 68;
const PITCH_LENGTH_M = 105;
const TORVANEY_HALF_LENGTH_M = PITCH_LENGTH_M / 2;
const PENALTY_AREA_DEPTH_M = 16.5;
const GOAL_AREA_DEPTH_M = 5.5;
const PENALTY_AREA_WIDTH_M = 40.32;
const GOAL_AREA_WIDTH_M = 18.32;

type AxisAnchor = { meters: number; pixels: number };

const TORVANEY_LENGTH_ANCHORS: AxisAnchor[] = [
  { meters: 0, pixels: 5 },
  { meters: GOAL_AREA_DEPTH_M, pixels: 37.5 },
  { meters: PENALTY_AREA_DEPTH_M, pixels: 100 },
  { meters: TORVANEY_HALF_LENGTH_M, pixels: 285 },
];

const TORVANEY_WIDTH_ANCHORS: AxisAnchor[] = [
  { meters: 0, pixels: 5 },
  { meters: (PITCH_WIDTH_M - PENALTY_AREA_WIDTH_M) / 2, pixels: 85 },
  { meters: (PITCH_WIDTH_M - GOAL_AREA_WIDTH_M) / 2, pixels: 140 },
  { meters: PITCH_WIDTH_M / 2, pixels: 195 },
  { meters: (PITCH_WIDTH_M + GOAL_AREA_WIDTH_M) / 2, pixels: 240 },
  { meters: (PITCH_WIDTH_M + PENALTY_AREA_WIDTH_M) / 2, pixels: 304 },
  { meters: PITCH_WIDTH_M, pixels: 385 },
];

function interpolateTorvaneyAxis(valueMeters: number, anchors: AxisAnchor[]): number {
  if (valueMeters <= anchors[0].meters) return anchors[0].pixels;

  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const next = anchors[i];
    if (valueMeters <= next.meters) {
      const t = (valueMeters - prev.meters) / (next.meters - prev.meters);
      return prev.pixels + t * (next.pixels - prev.pixels);
    }
  }

  return anchors[anchors.length - 1].pixels;
}

/** Mapowanie współrzędnych aplikacji → piksele SVG Torvaney, z kotwicami na ich narysowanych liniach pól. */
export function percentToTorvaneyPixels(
  xPercent: number,
  yPercent: number,
  teamContext: TeamContextForXG
): { sx: number; sy: number } {
  const lateralMeters = (yPercent / 100) * PITCH_WIDTH_M;
  const sx = interpolateTorvaneyAxis(lateralMeters, TORVANEY_WIDTH_ANCHORS);
  const distanceToGoalMeters =
    teamContext === "attack"
      ? ((100 - xPercent) / 100) * PITCH_LENGTH_M
      : (xPercent / 100) * PITCH_LENGTH_M;
  const sy = interpolateTorvaneyAxis(distanceToGoalMeters, TORVANEY_LENGTH_ANCHORS);
  return { sx, sy };
}

/**
 * Prawdopodobieństwo bramki 0–1 (jak w getSimpleXG przed ×100 w oryginale).
 * `isHeader`: true tylko dla strzału głową (jak paramArray[0] === "yes").
 */
export function getTorvaneySimpleXGProbability(
  sx: number,
  sy: number,
  isHeader: boolean
): number {
  const x = sx;
  const y = sy;

  const pitchX = ((x - 5) * 68) / 380;
  const pitchY = ((y - 5) * 52.5) / 280;
  const leftPostXY = [(162.5 * 68) / 380, (0 * 52.5) / 280];
  const rightPostXY = [(207.5 * 68) / 380, (0 * 52.5) / 280];
  const centreGoalXY = [(185 * 68) / 380, (0 * 52.5) / 280];
  const goalWidth = (45 * 68) / 380;

  if (x < 5 || y < 5 || x > 385 || y > 285) {
    return 0;
  }

  let distNearPost: number;
  let distFarPost: number;

  if (x < 190) {
    distNearPost = Math.sqrt(
      Math.pow(pitchX - leftPostXY[0], 2) + Math.pow(pitchY - leftPostXY[1], 2)
    );
    distFarPost = Math.sqrt(
      Math.pow(pitchX - rightPostXY[0], 2) + Math.pow(pitchY - rightPostXY[1], 2)
    );
  } else {
    distFarPost = Math.sqrt(
      Math.pow(pitchX - leftPostXY[0], 2) + Math.pow(pitchY - leftPostXY[1], 2)
    );
    distNearPost = Math.sqrt(
      Math.pow(pitchX - rightPostXY[0], 2) + Math.pow(pitchY - rightPostXY[1], 2)
    );
  }

  const cosNumerator =
    Math.pow(distNearPost, 2) + Math.pow(distFarPost, 2) - Math.pow(goalWidth, 2);
  const cosDen = 2 * distNearPost * distFarPost;
  if (cosDen === 0 || !Number.isFinite(cosNumerator / cosDen)) {
    return 0;
  }
  const clamped = Math.max(-1, Math.min(1, cosNumerator / cosDen));
  const goalAngle = Math.acos(clamped);

  const goalDistance = Math.sqrt(
    Math.pow(centreGoalXY[0] - pitchX, 2) + Math.pow(centreGoalXY[1] - pitchY, 2)
  );

  const headerNum = isHeader ? 1 : 0;

  const logit =
    -1.745598 +
    1.338737 * goalAngle -
    0.110384 * goalDistance +
    0.64673 * headerNum +
    0.168798 * goalAngle * goalDistance -
    0.424885 * goalAngle * headerNum -
    0.134178 * goalDistance * headerNum -
    0.055093 * goalAngle * goalDistance * headerNum;

  const prob = 1 / (1 + Math.exp(-logit));
  if (!Number.isFinite(prob)) return 0;
  return Math.max(0, Math.min(1, prob));
}

/** Ułamek 0–1 z pozycji w % (jak w aplikacji). Domyślnie strzał z nogi. */
export function getTorvaneySimpleXGProbabilityFromPercent(
  xPercent: number,
  yPercent: number,
  opts: { isHeader: boolean; teamContext: TeamContextForXG }
): number {
  const { sx, sy } = percentToTorvaneyPixels(xPercent, yPercent, opts.teamContext);
  return getTorvaneySimpleXGProbability(sx, sy, opts.isHeader);
}

/** Procenty całkowite jak na stronie Torvaney (toFixed(0) po ×100). */
export function getTorvaneySimpleXGPercentRounded(
  xPercent: number,
  yPercent: number,
  opts: { isHeader: boolean; teamContext: TeamContextForXG }
): number {
  const p = getTorvaneySimpleXGProbabilityFromPercent(xPercent, yPercent, opts);
  return Math.round(p * 100);
}

/** xG po kliknięciu (Simple xG / Torvaney); domyślnie noga (modal może zmienić na głowę). */
export function computePitchClickXG(xPercent: number, yPercent: number): number {
  const teamContext: TeamContextForXG = xPercent < 50 ? "defense" : "attack";
  return getTorvaneySimpleXGProbabilityFromPercent(xPercent, yPercent, {
    isHeader: false,
    teamContext,
  });
}
