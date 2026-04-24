import assert from "assert";
import type { Action } from "@/types";
import {
  inferMatchArrayFieldForAction,
  resolveImportedActionsByField,
  splitActionsByMatchField,
} from "./inferActionMatchField";

const base: Pick<Action, "id" | "matchId" | "teamId" | "minute" | "senderId" | "actionType" | "isSecondHalf"> = {
  id: "a1",
  matchId: "m1",
  teamId: "t1",
  minute: 1,
  senderId: "p1",
  actionType: "pass",
  isSecondHalf: false,
};

assert.equal(inferMatchArrayFieldForAction({ ...base, mode: "attack" } as Action), "actions_packing");
assert.equal(inferMatchArrayFieldForAction({ ...base, mode: "defense" } as Action), "actions_unpacking");
assert.equal(
  inferMatchArrayFieldForAction({ ...base, playersBehindBall: 3 } as Action),
  "actions_regain",
);
assert.equal(
  inferMatchArrayFieldForAction({ ...base, receptionBackAllyCount: 4 } as Action),
  "actions_regain",
);
assert.equal(
  inferMatchArrayFieldForAction({ ...base, regainOppRosterSquadTallyF1: 2 } as Action),
  "actions_regain",
);
assert.equal(
  inferMatchArrayFieldForAction({ ...base, isReaction5s: true } as Action),
  "actions_loses",
);
assert.equal(
  inferMatchArrayFieldForAction({ ...base, losesBackAllyCount: 3 } as Action),
  "actions_loses",
);
assert.equal(
  inferMatchArrayFieldForAction({ ...base, losesOppRosterSquadTallyF1: 1 } as Action),
  "actions_loses",
);

const byField = resolveImportedActionsByField({
  actionsByField: {
    actions_packing: [{ ...base, id: "p" } as Action],
    actions_regain: [{ ...base, id: "r", playersBehindBall: 1 } as Action],
  },
});
assert.equal(byField.actions_packing.length, 1);
assert.equal(byField.actions_regain.length, 1);
assert.equal(byField.actions_loses.length, 0);

const flat = splitActionsByMatchField([
  { ...base, id: "u", mode: "defense" } as Action,
  { ...base, id: "l", isReaction5s: false } as Action,
]);
assert.equal(flat.actions_unpacking.length, 1);
assert.equal(flat.actions_loses.length, 1);

console.log("inferActionMatchField tests: OK");
