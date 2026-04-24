import assert from "node:assert/strict";
import { getModalPlayersForMatch } from "./modalMatchPlayersFilter";
import type { Player, TeamInfo } from "@/types";

const basePlayer = (id: string, team: string): Player => ({
  id,
  firstName: "A",
  lastName: "B",
  name: "A B",
  number: 1,
  position: "ST",
  teams: [team],
});

const teamId = "t1";
const p1 = basePlayer("p1", teamId);
const p2 = basePlayer("p2", teamId);

assert.deepEqual(getModalPlayersForMatch([p1], null), [p1]);

const emptyMinutes: TeamInfo = {
  matchId: "m1",
  team: teamId,
  opponent: "x",
  isHome: true,
  competition: "liga",
  date: "2026-01-01",
  playerMinutes: [],
};
assert.deepEqual(getModalPlayersForMatch([p1, p2], emptyMinutes), [p1, p2]);

const noMinutesField = { matchId: "m1", team: teamId } as TeamInfo;
assert.deepEqual(getModalPlayersForMatch([p1, p2], noMinutesField), [p1, p2]);

const withMinutes: TeamInfo = {
  ...emptyMinutes,
  playerMinutes: [
    { playerId: "p1", startMinute: 1, endMinute: 5, position: "ST" },
    { playerId: "p2", startMinute: 0, endMinute: 0, position: "ST" },
  ],
};
const filtered = getModalPlayersForMatch([p1, p2], withMinutes);
assert.deepEqual(
  filtered.map((x) => x.id),
  ["p1"]
);

const oppId = "opp1";
const o1 = basePlayer("o1", oppId);
const o2 = basePlayer("o2", oppId);
const matchAsOpponent: TeamInfo = {
  ...emptyMinutes,
  team: oppId,
  opponent: teamId,
};
assert.deepEqual(
  getModalPlayersForMatch([o1, o2], matchAsOpponent).map((x) => x.id),
  ["o1", "o2"]
);

console.log("modalMatchPlayersFilter tests: OK");
