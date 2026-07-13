import assert from "node:assert/strict";
import {
  buildGlobalCountsRecordFromMatchDocs,
  getGlobalDataContactTotalForPlayer,
  playerHasAnyGlobalDataContact,
} from "./playerHardDeleteEligibility";

const matchWithAction: Record<string, unknown> = {
  actions_packing: [
    {
      id: "a1",
      senderId: "player-a",
      receiverId: "player-b",
      minute: 1,
      actionType: "pass",
      isSecondHalf: false,
    },
  ],
};

const record = buildGlobalCountsRecordFromMatchDocs([matchWithAction], []);
assert.equal(playerHasAnyGlobalDataContact(record, "player-a"), true);
assert.equal(playerHasAnyGlobalDataContact(record, "player-b"), true);
assert.equal(playerHasAnyGlobalDataContact(record, "orphan"), false);
assert.equal(getGlobalDataContactTotalForPlayer(record, "player-a"), 2);

const gpsOnly = buildGlobalCountsRecordFromMatchDocs([], [{ playerId: "gps-p" }]);
assert.equal(playerHasAnyGlobalDataContact(gpsOnly, "gps-p"), true);

console.log("playerHardDeleteEligibility.test: ok");
