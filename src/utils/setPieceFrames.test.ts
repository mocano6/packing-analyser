import assert from "assert";
import {
  computePlaybackElapsed,
  easeInOutCubic,
  interpolateFrames,
  interpolateMarkers,
  interpolateZones,
  syncSetupPlayers,
} from "./setPieceFrames";
import type { SetPieceFrame, SetPieceSetup } from "@/types/setPieces";

function testInterpolateMarkers() {
  const from = [{ playerId: "p1", x: 0, y: 0 }];
  const to = [{ playerId: "p1", x: 100, y: 50 }];
  const mid = interpolateMarkers(from, to, 0.5);
  assert.strictEqual(mid[0].x, 50);
  assert.strictEqual(mid[0].y, 25);
}

function testInterpolateFrames() {
  const a: SetPieceFrame = {
    id: "a",
    label: "A",
    markers: [{ playerId: "p1", x: 10, y: 10 }],
    zones: [],
    assignments: [],
  };
  const b: SetPieceFrame = {
    id: "b",
    label: "B",
    markers: [{ playerId: "p1", x: 30, y: 40 }],
    zones: [],
    assignments: [],
  };
  const snap = interpolateFrames(a, b, 0.5);
  assert.ok(snap.markers[0].x > 10 && snap.markers[0].x < 30);
}

function testInterpolateZonesKeepsTask() {
  const from = [
    {
      id: "z1",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      label: "Strefa 1",
      kind: "movement" as const,
      task: "wybieg",
    },
  ];
  const to = [
    {
      id: "z1",
      x: 20,
      y: 0,
      width: 10,
      height: 10,
      label: "Strefa 1",
      kind: "movement" as const,
      task: "zagranie",
    },
  ];
  const early = interpolateZones(from, to, 0.25);
  const late = interpolateZones(from, to, 0.75);
  assert.strictEqual(early[0].task, "wybieg");
  assert.strictEqual(late[0].task, "zagranie");
}

function testPlaybackElapsed() {
  const start = 1000;
  const r = computePlaybackElapsed(start, start + 400, 800, 3, false);
  assert.strictEqual(r.segmentIndex, 0);
  assert.strictEqual(r.segmentProgress, 0.5);
}

function testEase() {
  assert.strictEqual(easeInOutCubic(0), 0);
  assert.strictEqual(easeInOutCubic(1), 1);
}

function testSyncSetupPlayersAllFrames() {
  const setup: SetPieceSetup = {
    type: "corner_attack",
    variant: "1",
    matchId: "m1",
    teamId: "t1",
    updatedAt: "",
    selectedPlayerIds: ["p1"],
    opponentPlayers: [],
    selectedOpponentIds: [],
    frames: [
      {
        id: "f1",
        label: "Klatka 1",
        markers: [{ playerId: "p1", x: 1, y: 2 }],
        zones: [],
        assignments: [{ playerId: "p1", task: "a" }],
      },
      {
        id: "f2",
        label: "Klatka 2",
        markers: [{ playerId: "p1", x: 3, y: 4 }],
        zones: [],
        assignments: [{ playerId: "p1", task: "b" }],
      },
    ],
  };
  const next = syncSetupPlayers(setup, ["p1", "p2"]);
  assert.strictEqual(next.frames.length, 2);
  assert.strictEqual(next.frames[0].markers.find((m) => m.playerId === "p1")?.x, 1);
  assert.ok(next.frames.every((frame) => frame.markers.some((m) => m.playerId === "p2")));
}

testInterpolateMarkers();
testInterpolateFrames();
testInterpolateZonesKeepsTask();
testPlaybackElapsed();
testEase();
testSyncSetupPlayersAllFrames();

console.log("setPieceFrames.test.ts — OK");
