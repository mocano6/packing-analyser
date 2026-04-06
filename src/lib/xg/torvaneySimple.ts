/**
 * Simple xG z narzędzia Bena Torvaney (źródło: torvaney.github.io/projects/xG.html).
 * Współrzędne pikseli jak w oryginale: pole klikalne x ∈ [5,385], y ∈ [5,285].
 */

import type { XgModelVersion } from "./constants";
import { getClassicXGFromPercent } from "./classicXG";

export type TeamContextForXG = "attack" | "defense";

/** Mapowanie współrzędnych aplikacji (%, bramka ataku po prawej dla ataku) → piksele Torvaney. */
export function percentToTorvaneyPixels(
  xPercent: number,
  yPercent: number,
  teamContext: TeamContextForXG
): { sx: number; sy: number } {
  const sx = 5 + (yPercent / 100) * 380;
  const sy =
    teamContext === "attack"
      ? 5 + ((100 - xPercent) / 100) * 280
      : 5 + (xPercent / 100) * 280;
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

/** xG po kliknięciu: domyślnie noga (modal może zmienić na głowę). */
export function computePitchClickXG(
  xPercent: number,
  yPercent: number,
  model: XgModelVersion
): number {
  const teamContext: TeamContextForXG = xPercent < 50 ? "defense" : "attack";
  if (model === "classic") {
    return getClassicXGFromPercent(xPercent, yPercent);
  }
  return getTorvaneySimpleXGProbabilityFromPercent(xPercent, yPercent, {
    isHeader: false,
    teamContext,
  });
}
