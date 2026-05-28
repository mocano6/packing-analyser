/** Lewa krawędź widoku = linia środkowa; prawa = bramka (atak w prawo). */
export const SET_PIECE_HALF_PITCH_MIN_STORAGE_X = 50;

export function clampPitchPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Współrzędne w widocznym oknie 0–100% → zapis na pełnym boisku (50–100% osi X). */
export function viewportPercentToStorage(viewportX: number, viewportY: number): { x: number; y: number } {
  const vx = clampPitchPercent(viewportX);
  const vy = clampPitchPercent(viewportY);
  return {
    x: SET_PIECE_HALF_PITCH_MIN_STORAGE_X + (vx / 100) * (100 - SET_PIECE_HALF_PITCH_MIN_STORAGE_X),
    y: vy,
  };
}

export function clientPointToStoragePercent(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
): { x: number; y: number } {
  const viewportX = ((clientX - viewportRect.left) / viewportRect.width) * 100;
  const viewportY = ((clientY - viewportRect.top) / viewportRect.height) * 100;
  return viewportPercentToStorage(viewportX, viewportY);
}

/** Środek markera może dojść do linii środkowej, bandy i bramki (widok połowy boiska). */
export function clampPlayerStoragePercent(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(SET_PIECE_HALF_PITCH_MIN_STORAGE_X, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

export function buildZoneRectFromStorage(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): { x: number; y: number; width: number; height: number } {
  const x1 = clampPitchPercent(Math.min(startX, endX));
  const y1 = clampPitchPercent(Math.min(startY, endY));
  const x2 = clampPitchPercent(Math.max(startX, endX));
  const y2 = clampPitchPercent(Math.max(startY, endY));

  let x = Math.max(SET_PIECE_HALF_PITCH_MIN_STORAGE_X, x1);
  let y = y1;
  let width = x2 - x1;
  let height = y2 - y1;

  if (x1 < SET_PIECE_HALF_PITCH_MIN_STORAGE_X) {
    width -= SET_PIECE_HALF_PITCH_MIN_STORAGE_X - x1;
  }

  width = Math.max(0, Math.min(100 - x, width));
  height = Math.max(0, Math.min(100 - y, height));

  return { x, y, width, height };
}
