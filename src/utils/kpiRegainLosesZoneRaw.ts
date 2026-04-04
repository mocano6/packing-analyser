import type { Action } from "@/types";

/** Strefa ataku przechwytu do mapy / liczników — jak w statystykach zespołu (fallback toZone/endZone). */
export function regainAttackZoneRawForMap(action: Action): string | undefined {
  return (
    action.regainAttackZone ||
    action.oppositeZone ||
    action.toZone ||
    action.endZone ||
    undefined
  );
}

/** Strefa straty do mapy / liczników — jak w statystykach zespołu (from/to/start). */
export function losesAttackZoneRawForMap(action: Action): string | undefined {
  return (
    action.losesAttackZone ||
    action.fromZone ||
    action.toZone ||
    action.startZone ||
    undefined
  );
}
