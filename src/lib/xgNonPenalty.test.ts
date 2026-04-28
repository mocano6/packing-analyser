import assert from "node:assert/strict";
import { shotIsPenalty, sumNonPenaltyXg } from "./xgNonPenalty";

assert.equal(shotIsPenalty({ actionType: "penalty" }), true);
assert.equal(shotIsPenalty({ actionType: "open_play" }), false);
assert.equal(shotIsPenalty({}), false);

const shots = [
  { xG: 0.5, actionType: "open_play" },
  { xG: 0.76, actionType: "penalty" },
  { xG: 0.1, actionType: "direct_free_kick" },
];
assert.equal(sumNonPenaltyXg(shots), 0.6);
