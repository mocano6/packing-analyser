import assert from "assert";
import type { Action, TeamInfo } from "../types";
import { buildMatchExportData } from "./matchExportPayload";

const fixedDate = new Date("2026-01-15T12:00:00.000Z");

const matchInfo: TeamInfo = {
  matchId: "m-export-1",
  team: "TeamA",
  opponent: "TeamB",
  isHome: true,
  competition: "Liga",
  date: "2026-01-10",
};

const mkAction = (id: string, matchId: string, mode: "attack" | "defense" = "attack"): Action =>
  ({
    id,
    matchId,
    teamId: "TeamA",
    minute: 1,
    senderId: "p1",
    actionType: "pass",
    isSecondHalf: false,
    mode,
  }) as Action;

// Zawsze pusta lista zawodników
const empty = buildMatchExportData(
  [],
  matchInfo,
  null,
  () => null,
  fixedDate,
);
assert.deepStrictEqual(empty.players, []);
assert.equal(empty.actions.length, 0);

// Przy zgodnym dokumencie meczu — akcje z dokumentu, nie z mieszanej tablicy
const cachedDoc: TeamInfo = {
  ...matchInfo,
  actions_packing: [mkAction("a1", "m-export-1")],
  actions_unpacking: [],
  actions_regain: [],
  actions_loses: [],
};

const withCache = buildMatchExportData(
  [mkAction("noise", "other-match")],
  matchInfo,
  cachedDoc,
  () => null,
  fixedDate,
);
assert.deepStrictEqual(withCache.players, []);
assert.equal(withCache.actions.length, 1);
assert.equal(withCache.actions[0]?.id, "a1");

// Bez cache — tylko akcje dla matchId bieżącego meczu
const mixed = [
  mkAction("keep", "m-export-1"),
  mkAction("drop", "other"),
];
const filtered = buildMatchExportData(mixed, matchInfo, null, () => null, fixedDate);
assert.deepStrictEqual(filtered.players, []);
assert.equal(filtered.actions.length, 1);
assert.equal(filtered.actions[0]?.id, "keep");

console.log("matchExportPayload tests: OK");
