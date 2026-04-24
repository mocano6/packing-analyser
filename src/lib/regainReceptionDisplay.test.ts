import assert from "node:assert/strict";
import {
  getReceptionBackAllyCountForDisplay,
  isRegainReceptionBackCountModel,
} from "./regainReceptionDisplay";
import type { Action } from "@/types";

const base: Action = {
  id: "a1",
  matchId: "m1",
  teamId: "t1",
  minute: 1,
  actionType: "pass",
  isSecondHalf: false,
} as Action;

assert.equal(
  getReceptionBackAllyCountForDisplay({
    ...base,
    receptionBackAllyCount: 5,
    totalPlayersOnField: 11,
    playersBehindBall: 2,
  }),
  5
);

assert.equal(
  getReceptionBackAllyCountForDisplay({
    ...base,
    regainOppRosterSquadTallyF1: 6,
    receptionBackAllyCount: 5,
    totalPlayersOnField: 11,
    playersBehindBall: 2,
  }),
  6
);

assert.equal(
  getReceptionBackAllyCountForDisplay({
    ...base,
    receptionAllyCountBehindBall: 4,
    totalPlayersOnField: 11,
  }),
  4
);

assert.equal(
  getReceptionBackAllyCountForDisplay({
    ...base,
    totalPlayersOnField: 10,
    playersBehindBall: 3,
  }),
  7
);

assert.equal(isRegainReceptionBackCountModel({ ...base, receptionBackAllyCount: 0 }), true);
assert.equal(isRegainReceptionBackCountModel({ ...base, regainOppRosterSquadTallyF1: 0 }), true);
assert.equal(
  isRegainReceptionBackCountModel({ ...base, receptionAllyCountBehindBall: 1 }),
  true
);
assert.equal(isRegainReceptionBackCountModel({ ...base, playersBehindBall: 2, opponentsBehindBall: 1 }), false);

console.log("regainReceptionDisplay tests: OK");
