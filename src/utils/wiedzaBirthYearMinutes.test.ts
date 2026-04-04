import assert from "node:assert/strict";
import {
  buildBirthYearMinutePercentagesByTeam,
  minutesFromPlayerMinutesEntry,
  weightedMeanBirthYearForTeam,
} from "./wiedzaBirthYearMinutes";
import { Player, TeamInfo } from "../types";

assert.equal(minutesFromPlayerMinutesEntry({ playerId: "a", startMinute: 0, endMinute: 0, isSecondHalf: false } as any), 0);
assert.equal(minutesFromPlayerMinutesEntry({ playerId: "a", startMinute: 1, endMinute: 45, isSecondHalf: false } as any), 45);

const players = new Map<string, Pick<Player, "id" | "birthYear">>([
  ["p2006", { id: "p2006", birthYear: 2006 }],
  ["p2008", { id: "p2008", birthYear: 2008 }],
]);

const matchA: TeamInfo = {
  team: "tA",
  opponent: "x",
  isHome: true,
  competition: "L",
  date: "2026-02-01",
  playerMinutes: [
    { playerId: "p2006", startMinute: 0, endMinute: 45, isSecondHalf: false } as any,
    { playerId: "p2008", startMinute: 0, endMinute: 45, isSecondHalf: false } as any,
  ],
  matchData: {},
};

const matchB: TeamInfo = {
  team: "tB",
  opponent: "y",
  isHome: false,
  competition: "L",
  date: "2026-02-02",
  playerMinutes: [
    { playerId: "p2006", startMinute: 0, endMinute: 90, isSecondHalf: false } as any,
    { playerId: "p2008", startMinute: 0, endMinute: 10, isSecondHalf: false } as any,
  ],
  matchData: {},
};

const model = buildBirthYearMinutePercentagesByTeam([matchA, matchB], players, ["tA", "tB"]);
assert.ok(model);
assert.equal(model!.rows.length, 2);
const row2006 = model!.rows.find((r) => r.birthYear === 2006);
const row2008 = model!.rows.find((r) => r.birthYear === 2008);
assert.ok(row2006 && row2008);
// tA: 45+45=90, half each year → 50%
assert.ok(Math.abs((row2006 as any).pct_tA - 50) < 1e-6);
assert.ok(Math.abs((row2008 as any).pct_tA - 50) < 1e-6);
// tB: 0–90 → 91 min, 0–10 → 11 min (włącznie)
const tB2006Pct = (91 / 102) * 100;
assert.ok(Math.abs((row2006 as any).pct_tB - tB2006Pct) < 1e-4);
assert.ok(Math.abs((row2008 as any).pct_tB - (11 / 102) * 100) < 1e-4);

const wm = weightedMeanBirthYearForTeam([matchA], players, "tA");
assert.ok(wm != null && Math.abs(wm - 2007) < 1e-6);

assert.equal(buildBirthYearMinutePercentagesByTeam([], players, ["tA"]), null);

console.log("wiedzaBirthYearMinutes tests: OK");
