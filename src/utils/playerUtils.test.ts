import assert from "node:assert/strict";
import { buildPlayersIndex, getPlayerLabel, getPositionInMatch } from "./playerUtils";
import { TeamInfo } from "../types";

const basePlayer = {
  id: "p1",
  firstName: "Jan",
  lastName: "Kowalski",
  number: 7,
  position: "CM",
  teams: []
};

const playersIndex = buildPlayersIndex([basePlayer]);

assert.equal(getPlayerLabel("p1", playersIndex), "Jan Kowalski");
assert.equal(getPlayerLabel("p1", playersIndex, { includeNumber: true }), "Jan Kowalski #7");
assert.equal(getPlayerLabel("missing", playersIndex), "Zawodnik usunięty");
assert.equal(getPlayerLabel(null, playersIndex), "Zawodnik usunięty");

const deletedIndex = buildPlayersIndex([{ ...basePlayer, isDeleted: true }]);
assert.equal(getPlayerLabel("p1", deletedIndex), "Zawodnik usunięty");

const match: TeamInfo = {
  team: "TEAM_A",
  opponent: "TEAM_B",
  isHome: true,
  competition: "Liga",
  date: "2026-02-02",
  playerMinutes: [
    { playerId: "p1", startMinute: 1, endMinute: 10, position: "GK" }
  ]
};

assert.equal(getPositionInMatch(match, "p1"), "GK");
assert.equal(getPositionInMatch(match, "missing"), undefined);

console.log("playerUtils tests: OK");
