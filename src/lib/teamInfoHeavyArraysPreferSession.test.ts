import assert from "assert";
import {
  mergeTeamInfoMetaWithSessionCache,
  preferNonEmptyArray,
} from "./teamInfoHeavyArraysPreferSession";

assert.deepStrictEqual(preferNonEmptyArray([], [1, 2]), [1, 2]);
assert.deepStrictEqual(preferNonEmptyArray([3], [1, 2]), [3]);
assert.deepStrictEqual(preferNonEmptyArray(undefined, undefined), []);

const meta = { team: "t", opponent: "o", isHome: true, competition: "c", date: "2020-01-01" };
const merged = mergeTeamInfoMetaWithSessionCache(meta as any, {
  ...meta,
  actions_packing: [{ id: "1" } as any],
  shots: [{ id: "s" } as any],
});
assert.strictEqual(merged.actions_packing?.length, 1);
assert.strictEqual(merged.shots?.length, 1);

const compact = mergeTeamInfoMetaWithSessionCache(
  {
    ...meta,
    actions_packing: [],
    actions_unpacking: [],
    actions_regain: [],
    actions_loses: [],
    shots: [],
    pkEntries: [],
    acc8sEntries: [],
    playerMinutes: [],
    gpsData: [],
  } as any,
  { ...meta, actions_packing: [{ id: "p" } as any] } as any,
);
assert.strictEqual(compact.actions_packing?.length, 1);

console.log("teamInfoHeavyArraysPreferSession.test: ok");
