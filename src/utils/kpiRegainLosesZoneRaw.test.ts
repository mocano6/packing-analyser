import assert from "assert";
import type { Action } from "@/types";
import { losesAttackZoneRawForMap, regainAttackZoneRawForMap } from "./kpiRegainLosesZoneRaw";

const base = {} as Action;

assert.strictEqual(regainAttackZoneRawForMap({ ...base, regainAttackZone: "A1" } as Action), "A1");
assert.strictEqual(
  regainAttackZoneRawForMap({ ...base, toZone: "B2", endZone: "C3" } as Action),
  "B2",
);
assert.strictEqual(
  regainAttackZoneRawForMap({ ...base, oppositeZone: "D4", endZone: "E5" } as Action),
  "D4",
);
assert.strictEqual(
  regainAttackZoneRawForMap({ ...base, endZone: "F6" } as Action),
  "F6",
);
assert.strictEqual(regainAttackZoneRawForMap({ ...base } as Action), undefined);

assert.strictEqual(losesAttackZoneRawForMap({ ...base, losesAttackZone: "G1" } as Action), "G1");
assert.strictEqual(
  losesAttackZoneRawForMap({ ...base, fromZone: "H2", toZone: "I3" } as Action),
  "H2",
);
assert.strictEqual(
  losesAttackZoneRawForMap({ ...base, toZone: "J4", startZone: "K5" } as Action),
  "J4",
);
assert.strictEqual(
  losesAttackZoneRawForMap({ ...base, startZone: "L6" } as Action),
  "L6",
);
assert.strictEqual(losesAttackZoneRawForMap({ ...base } as Action), undefined);

console.log("kpiRegainLosesZoneRaw.test: OK");
