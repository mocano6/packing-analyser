export type PositionPhaseViewMode = "graph" | "list";

export const POSITION_PHASE_VIEW_STORAGE_KEY = "positionSystem_phaseView" as const;

export const DEFAULT_POSITION_PHASE_VIEW: PositionPhaseViewMode = "graph";

export function parsePositionPhaseViewMode(raw: unknown): PositionPhaseViewMode | null {
  if (raw === "graph" || raw === "list") return raw;
  return null;
}

function browserLocalStorage(): Storage | null {
  try {
    const w = (globalThis as { window?: Window }).window;
    return w?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readPositionPhaseViewMode(): PositionPhaseViewMode {
  const storage = browserLocalStorage();
  if (!storage) return DEFAULT_POSITION_PHASE_VIEW;
  try {
    return (
      parsePositionPhaseViewMode(storage.getItem(POSITION_PHASE_VIEW_STORAGE_KEY)) ??
      DEFAULT_POSITION_PHASE_VIEW
    );
  } catch {
    return DEFAULT_POSITION_PHASE_VIEW;
  }
}

export function writePositionPhaseViewMode(mode: PositionPhaseViewMode): void {
  if (!parsePositionPhaseViewMode(mode)) return;
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(POSITION_PHASE_VIEW_STORAGE_KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}
