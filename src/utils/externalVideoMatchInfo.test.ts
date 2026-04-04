import assert from "node:assert/strict";
import type { TeamInfo } from "@/types";
import {
  hasExternalVideoSource,
  pickExternalVideoMatchInfoPayload,
} from "./externalVideoMatchInfo";

/** Symulacja ciężkiego dokumentu meczu (np. logo base64 + wiele akcji w runtime). */
const heavy: TeamInfo = {
  team: "A",
  opponent: "B",
  isHome: true,
  competition: "Liga",
  date: "2024-01-01",
  videoUrl: "https://youtube.com/watch?v=abc",
  opponentLogo: "x".repeat(500_000),
};

const minimalYoutube: TeamInfo = {
  team: "A",
  opponent: "B",
  isHome: true,
  competition: "Liga",
  date: "2024-01-01",
  videoUrl: "https://youtu.be/xyz",
};

const minimalStorage: TeamInfo = {
  team: "A",
  opponent: "B",
  isHome: true,
  competition: "Liga",
  date: "2024-01-01",
  videoStorageUrl: "https://storage.example.com/v.mp4?token=long",
};

assert.deepEqual(pickExternalVideoMatchInfoPayload(heavy), {
  videoUrl: "https://youtube.com/watch?v=abc",
});

assert.deepEqual(pickExternalVideoMatchInfoPayload(minimalYoutube), {
  videoUrl: "https://youtu.be/xyz",
});

assert.deepEqual(pickExternalVideoMatchInfoPayload(minimalStorage), {
  videoStorageUrl: "https://storage.example.com/v.mp4?token=long",
});

const emptyVideo: TeamInfo = {
  team: "A",
  opponent: "B",
  isHome: true,
  competition: "Liga",
  date: "2024-01-01",
};

assert.deepEqual(pickExternalVideoMatchInfoPayload(emptyVideo), {});

assert.equal(hasExternalVideoSource(minimalYoutube), true);
assert.equal(hasExternalVideoSource(minimalStorage), true);
assert.equal(hasExternalVideoSource(emptyVideo), false);

const jsonHeavy = JSON.stringify(pickExternalVideoMatchInfoPayload(heavy));
assert.ok(jsonHeavy.length < 500, "payload bez tablic akcji musi być mały");

console.log("externalVideoMatchInfo tests: OK");
