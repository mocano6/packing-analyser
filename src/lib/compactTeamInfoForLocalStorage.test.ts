import assert from "node:assert/strict";
import type { Action, TeamInfo } from "@/types";
import { compactTeamInfoForLocalStorage } from "./compactTeamInfoForLocalStorage";

const heavy: TeamInfo = {
  team: "t1",
  opponent: "o1",
  isHome: true,
  competition: "liga",
  date: "2026-01-01",
  matchId: "m1",
  actions_packing: [{ id: "a1" } as Action],
  actions_unpacking: [{ id: "b1" } as Action],
  matchData: { possession: { teamFirstHalf: 1 } } as TeamInfo["matchData"],
};

const slim = compactTeamInfoForLocalStorage(heavy);
assert.deepEqual(slim.actions_packing, []);
assert.deepEqual(slim.actions_unpacking, []);
assert.equal(slim.matchData, undefined);
assert.equal(slim.team, "t1");
assert.equal(slim.matchId, "m1");

const heavyBig: TeamInfo = {
  ...heavy,
  actions_packing: Array.from({ length: 50 }, (_, i) => ({ id: `a${i}` } as Action)),
};
const slimBig = compactTeamInfoForLocalStorage(heavyBig);
assert.ok(
  JSON.stringify(slimBig).length < JSON.stringify(heavyBig).length,
  "przy wielu akcjach kompakt jest wyraźnie mniejszy",
);

console.log("compactTeamInfoForLocalStorage.test: OK");
