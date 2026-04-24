import assert from "node:assert/strict";
import { getLosesBackAllyCountForDisplay, isLosesBackAllyCountModel } from "./losesBackAllyDisplay";
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
  getLosesBackAllyCountForDisplay({
    ...base,
    losesBackAllyCount: 5,
    totalPlayersOnField: 11,
    playersBehindBall: 2,
  }),
  5
);

assert.equal(
  getLosesBackAllyCountForDisplay({
    ...base,
    losesOppRosterSquadTallyF1: 8,
    losesBackAllyCount: 5,
    totalPlayersOnField: 11,
    playersBehindBall: 2,
  }),
  8
);

assert.equal(
  getLosesBackAllyCountForDisplay({
    ...base,
    totalPlayersOnField: 10,
    playersBehindBall: 3,
  }),
  7
);

assert.equal(isLosesBackAllyCountModel({ ...base, losesBackAllyCount: 0 }), true);
assert.equal(isLosesBackAllyCountModel({ ...base, losesOppRosterSquadTallyF1: 0 }), true);
assert.equal(isLosesBackAllyCountModel({ ...base, playersBehindBall: 2, opponentsBehindBall: 1 }), false);

console.log("losesBackAllyDisplay tests: OK");
