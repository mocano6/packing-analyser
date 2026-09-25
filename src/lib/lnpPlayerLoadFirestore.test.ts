import assert from "node:assert/strict";
import { createEmptyLnpPlayerLoadState } from "@/types/lnpPlayerLoad";
import {
  buildLnpPlayerLoadDocument,
  migrateLnpPlayerLoadFromFirestore,
} from "./lnpPlayerLoadFirestore";

const emptyDoc = buildLnpPlayerLoadDocument(createEmptyLnpPlayerLoadState(), 1_700_000_000_000);
assert.equal(emptyDoc.version, 1);
const empty = migrateLnpPlayerLoadFromFirestore({
  stateJson: emptyDoc.stateJson,
  version: 1,
});
assert.deepEqual(empty.matches, []);
assert.equal(empty.lnpTeamId, null);
assert.deepEqual(empty.hiddenPlayerKeys, []);
assert.deepEqual(empty.playerMerges, []);

const sample = {
  matches: [
    {
      matchId: "m1",
      dateTime: "2026-09-01T17:00:00",
      opponent: "Rywal",
      isHome: true,
      playName: "Liga",
      scoreFinal: "2:1",
      fetchedAt: "2026-09-01T20:00:00.000Z",
      hasSquad: true,
      players: [
        { lnpId: "p1", firstName: "Jan", lastName: "Kowalski", number: 9, minutesPlayed: 90.4 },
        { lnpId: "", firstName: "", lastName: "", number: 0, minutesPlayed: 10 },
      ],
    },
    { matchId: "", dateTime: "x" },
  ],
  fetchedAt: "2026-09-02T10:00:00.000Z",
  lnpTeamId: "team-1",
  hiddenPlayerKeys: ["id:p1", "id:p1", ""],
  playerMerges: [
    { sourceKey: "name:foo|bar", targetKey: "id:p1" },
    { sourceKey: "same", targetKey: "same" },
  ],
};
const doc = buildLnpPlayerLoadDocument(sample as never, 1);
const migrated = migrateLnpPlayerLoadFromFirestore({
  stateJson: doc.stateJson,
  version: 1,
});
assert.equal(migrated.matches.length, 1);
assert.equal(migrated.matches[0].players.length, 1);
assert.equal(migrated.matches[0].players[0].minutesPlayed, 90);
assert.equal(migrated.lnpTeamId, "team-1");
assert.deepEqual(migrated.hiddenPlayerKeys, ["id:p1"]);
assert.deepEqual(migrated.playerMerges, [{ sourceKey: "name:foo|bar", targetKey: "id:p1" }]);

const bare = migrateLnpPlayerLoadFromFirestore({ stateJson: "{}", version: 1 });
assert.deepEqual(bare.matches, []);
assert.equal(bare.fetchedAt, null);

console.log("lnpPlayerLoadFirestore.test.ts: OK");
