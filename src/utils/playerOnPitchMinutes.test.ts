import assert from "assert";
import {
  buildOnPitchPlayersByMinuteIndex,
  getOnPitchPlayerIdsAtMinute,
  getPlayerMinuteSegmentsForMatch,
  isPlayerOnPitchAtMinute,
  playerOnPitchMinutesInMatch,
} from "./playerOnPitchMinutes";
import type { PlayerMinutes } from "@/types";

const segments: PlayerMinutes[] = [
  { playerId: "p1", startMinute: 0, endMinute: 45 },
  { playerId: "p1", startMinute: 46, endMinute: 90 },
];

assert.equal(playerOnPitchMinutesInMatch(segments), 89);
assert.equal(isPlayerOnPitchAtMinute(segments, 0), true);
assert.equal(isPlayerOnPitchAtMinute(segments, 44), true);
assert.equal(isPlayerOnPitchAtMinute(segments, 45), false);
assert.equal(isPlayerOnPitchAtMinute(segments, 46), true);
assert.equal(isPlayerOnPitchAtMinute(segments, 89), true);
assert.equal(isPlayerOnPitchAtMinute(segments, 90), false);

const index = buildOnPitchPlayersByMinuteIndex(
  [
    { playerId: "p1", startMinute: 0, endMinute: 45 },
    { playerId: "p2", startMinute: 10, endMinute: 20 },
    { playerId: "p3", startMinute: 0, endMinute: 0 },
  ],
  new Set(["p1", "p2", "p3"]),
);

assert.deepStrictEqual([...(getOnPitchPlayerIdsAtMinute(index, 15) ?? [])].sort(), ["p1", "p2"]);
assert.deepStrictEqual([...(getOnPitchPlayerIdsAtMinute(index, 45) ?? [])], []);

const p1Segs = getPlayerMinuteSegmentsForMatch(
  [
    { playerId: "p1", startMinute: 0, endMinute: 45 },
    { playerId: "p2", startMinute: 10, endMinute: 20 },
  ],
  "p1",
);
assert.equal(p1Segs.length, 1);

console.log("playerOnPitchMinutes.test: OK");
