import assert from "assert";
import { buildSetupStorageKey } from "../lib/setPiecePresets";
import {
  applyPlayerOverride,
  getMatchSquadPlayerIds,
  migrateSetups,
  normalizeSetPieceMatchDocument,
  syncSetupPlayers,
} from "./setPiecesStorage";
import type { SetPieceSetup } from "@/types/setPieces";
import { createEmptyFrame } from "./setPieceFrames";

function testGetMatchSquadPlayerIds() {
  const ids = getMatchSquadPlayerIds({
    playerMinutes: [{ playerId: "p1", startMinute: 0, endMinute: 90 }],
    startingLineup: {
      formationId: "4-3-3",
      slots: [{ slotId: "st", label: "ST", role: "ST", x: 50, y: 50, playerId: "p2" }],
      updatedAt: "",
    },
  });
  assert.deepStrictEqual(ids.sort(), ["p1", "p2"]);
}

function testApplyPlayerOverride() {
  const doc = normalizeSetPieceMatchDocument(null, "m1", "team-a");
  const next = applyPlayerOverride(doc, "p1", { displayName: "Kapitan" });
  assert.strictEqual(next.playerOverrides.p1?.displayName, "Kapitan");
  const again = applyPlayerOverride(next, "p1", { imageUrl: "data:image/png;base64,abc" });
  assert.strictEqual(again.playerOverrides.p1?.displayName, "Kapitan");
  assert.strictEqual(again.playerOverrides.p1?.imageUrl, "data:image/png;base64,abc");
}

function testSyncSetupPlayersKeepsPositions() {
  const setup: SetPieceSetup = {
    type: "corner_attack",
    variant: "1",
    matchId: "m1",
    teamId: "team-a",
    updatedAt: "",
    selectedPlayerIds: ["p1", "p2"],
    opponentPlayers: [],
    selectedOpponentIds: [],
    frames: [
      createEmptyFrame(0, {
        markers: [
          { playerId: "p1", x: 10, y: 20 },
          { playerId: "p2", x: 30, y: 40 },
        ],
        zones: [],
        assignments: [
          { playerId: "p1", task: "blokada" },
          { playerId: "p2", task: "wybieg" },
        ],
      }),
    ],
  };
  const synced = syncSetupPlayers(setup, ["p1", "p3"]);
  const frame = synced.frames[0]!;
  const p1 = frame.markers.find((marker) => marker.playerId === "p1");
  assert.strictEqual(p1?.x, 10);
  assert.strictEqual(p1?.y, 20);
  assert.ok(frame.markers.some((marker) => marker.playerId === "p3"));
  assert.strictEqual(frame.assignments.find((item) => item.playerId === "p1")?.task, "blokada");
}

function testMigrateLegacySetupKeys() {
  const migrated = migrateSetups({
    corner_attack: {
      type: "corner_attack",
      matchId: "m1",
      teamId: "t1",
      selectedPlayerIds: ["p1"],
      frames: [
        createEmptyFrame(0, { markers: [], zones: [], assignments: [] }),
      ],
    },
    "free_kick_attack__5": {
      type: "free_kick_attack",
      variant: "5",
      matchId: "m1",
      teamId: "t1",
      selectedPlayerIds: [],
      frames: [
        createEmptyFrame(0, { markers: [], zones: [], assignments: [] }),
      ],
    },
  });
  assert.ok(migrated["corner_attack__1"]);
  assert.strictEqual(migrated["corner_attack__1"].variant, "1");
  assert.ok(migrated["free_kick_attack__5"]);
  assert.strictEqual(migrated["free_kick_attack__5"].variant, "5");
}

function testBuildSetupStorageKey() {
  assert.strictEqual(buildSetupStorageKey("corner_attack", "5"), "corner_attack__5");
}

testGetMatchSquadPlayerIds();
testApplyPlayerOverride();
testSyncSetupPlayersKeepsPositions();
testMigrateLegacySetupKeys();
testBuildSetupStorageKey();

console.log("setPiecesStorage.test.ts — OK");
