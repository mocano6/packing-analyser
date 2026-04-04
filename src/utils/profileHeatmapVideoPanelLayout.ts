/** Prostokąt panelu wideo (heatmap profilu) — fixed względem viewportu. */
export type ProfileVideoPanelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const PROFILE_HEATMAP_VIDEO_PANEL_LAYOUT_KEY = "profileHeatmapVideoPanelLayout_v1";

const MIN_W = 260;
const MIN_H = 180;

export function clampProfileVideoPanelRect(
  r: ProfileVideoPanelRect,
  vw: number,
  vh: number,
  minW = MIN_W,
  minH = MIN_H,
): ProfileVideoPanelRect {
  const width = Math.min(Math.max(r.width, minW), Math.max(minW, vw - 8));
  const height = Math.min(Math.max(r.height, minH), Math.max(minH, vh - 8));
  const left = Math.min(Math.max(0, r.left), Math.max(0, vw - width));
  const top = Math.min(Math.max(0, r.top), Math.max(0, vh - height));
  return { left, top, width, height };
}

export function parseStoredProfileVideoPanelLayout(raw: string | null): ProfileVideoPanelRect | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const left = Number(o.left);
    const top = Number(o.top);
    const width = Number(o.width);
    const height = Number(o.height);
    if (![left, top, width, height].every((n) => Number.isFinite(n))) return null;
    if (width < MIN_W || height < MIN_H) return null;
    return { left, top, width, height };
  } catch {
    return null;
  }
}
