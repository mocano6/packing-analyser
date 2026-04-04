import assert from "node:assert/strict";
import {
  getOpponentXgRegainWindowsForMatch,
  getTeamXgOpenPlayForMatch,
  getTeamXgRegainWindowsForMatch,
  getTeamXgSfgForMatch,
  isSfgCategoryShot,
} from "./matchXgSplits";
import { TeamInfo } from "../types";
import { Shot } from "../types";

const cornerShot: Shot = {
  id: "s1",
  x: 50,
  y: 50,
  minute: 1,
  xG: 0.2,
  isGoal: false,
  matchId: "m",
  timestamp: 1,
  shotType: "on_target",
  teamContext: "attack",
  teamId: "t1",
  actionType: "corner",
};

assert.equal(isSfgCategoryShot(cornerShot), true);

const m: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-01",
  shots: [
    cornerShot,
    {
      id: "s2",
      x: 40,
      y: 40,
      minute: 2,
      xG: 0.5,
      isGoal: false,
      matchId: "m",
      timestamp: 2,
      shotType: "on_target",
      teamContext: "attack",
      teamId: "t1",
      actionType: "open_play",
    } as Shot,
  ],
} as TeamInfo;

assert.ok(Math.abs(getTeamXgSfgForMatch(m) - 0.2) < 1e-9);
assert.ok(Math.abs(getTeamXgOpenPlayForMatch(m) - 0.5) < 1e-9);

// Bez timestampów okna = 0 → fallback ze strzałów actionType "regain" (strona przeciwnika)
const regainTaggedOnly: TeamInfo = {
  team: "t1",
  opponent: "op",
  isHome: true,
  competition: "L",
  date: "2026-01-02",
  shots: [
    {
      id: "oppRg",
      x: 55,
      y: 50,
      minute: 10,
      xG: 0.33,
      isGoal: false,
      matchId: "m2",
      timestamp: 10,
      shotType: "on_target",
      teamId: "op",
      actionType: "regain",
    } as Shot,
  ],
} as TeamInfo;
assert.ok(Math.abs(getOpponentXgRegainWindowsForMatch(regainTaggedOnly) - 0.33) < 1e-9);
assert.equal(getTeamXgRegainWindowsForMatch(regainTaggedOnly), 0);

console.log("matchXgSplits tests: OK");
