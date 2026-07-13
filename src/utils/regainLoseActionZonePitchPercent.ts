import type { Action } from "@/types";
import { resolveZoneIndex, zoneIndexToPitchPercent } from "@/utils/packingActionZonePitchPercent";
import { regainMapZoneName, losesMapZoneName } from "@/utils/statystykiZespoluRegainLosesFilters";

export function regainActionToPitchPercent(action: Action): { x: number; y: number } | null {
  const zone = regainMapZoneName(action);
  if (!zone) return null;
  const idx = resolveZoneIndex(zone);
  if (idx === null) return null;
  return zoneIndexToPitchPercent(idx);
}

export function loseActionToPitchPercent(action: Action): { x: number; y: number } | null {
  const zone = losesMapZoneName(action);
  if (!zone) return null;
  const idx = resolveZoneIndex(zone);
  if (idx === null) return null;
  return zoneIndexToPitchPercent(idx);
}
