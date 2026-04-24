import assert from "node:assert/strict";
import type { Action, TeamInfo } from "@/types";
import { computeFirestoreWriteForMatchImport } from "./matchImportMergeApply";

const meta: TeamInfo = {
  team: "team-a",
  opponent: "op",
  isHome: true,
  competition: "liga",
  date: "2024-01-01",
  matchId: "mid-1",
};

const incoming: Action = {
  id: "a1",
  teamId: "team-a",
  matchId: "mid-1",
  isSecondHalf: false,
} as Action;

const create = computeFirestoreWriteForMatchImport(undefined, {
  matchId: "mid-1",
  matchMeta: meta,
  incomingByField: { actions_packing: [incoming] },
});
assert.equal(create?.op, "set");
assert.ok(create && "data" in create);
const packing = (create as { data: Record<string, unknown> }).data.actions_packing as Action[];
assert.equal(packing.length, 1);
assert.equal(packing[0].id, "a1");

const existing: TeamInfo = {
  ...meta,
  actions_packing: [{ id: "old", teamId: "team-a", matchId: "mid-1", isSecondHalf: false } as Action],
};

const upd = computeFirestoreWriteForMatchImport(existing, {
  matchId: "mid-1",
  matchMeta: meta,
  incomingByField: { actions_packing: [incoming] },
});
assert.equal(upd?.op, "update");
const upPacking = (upd as { data: Record<string, unknown> }).data.actions_packing as Action[];
assert.equal(upPacking.length, 2);
const ids = new Set(upPacking.map((x) => x.id));
assert.ok(ids.has("old") && ids.has("a1"));

const noop = computeFirestoreWriteForMatchImport(undefined, {
  matchId: "mid-1",
  matchMeta: meta,
  incomingByField: {},
});
assert.equal(noop, null);

console.log("matchImportMergeApply.test: OK");
