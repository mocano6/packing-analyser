import assert from "node:assert/strict";
import {
  buildPlayersIndex,
  getPlayerLabel,
  getPositionInMatch,
  normalizePlayerTeamIdsFromFirestoreDoc,
  playerTeamIdEntriesFromFirestoreDoc,
} from "./playerUtils";
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
assert.equal(getPlayerLabel("p1", deletedIndex), "Jan Kowalski");

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

assert.deepEqual(normalizePlayerTeamIdsFromFirestoreDoc({}), []);
assert.deepEqual(
  normalizePlayerTeamIdsFromFirestoreDoc({
    teams: ["  a  ", "a", "b"],
    team: "b",
    teamId: "c",
  }),
  ["a", "b", "c"],
);
assert.deepEqual(
  normalizePlayerTeamIdsFromFirestoreDoc({ teams: "solo-id", team: "solo-id" }),
  ["solo-id"],
);
assert.deepEqual(
  normalizePlayerTeamIdsFromFirestoreDoc({ teams: [], team: "only-legacy" }),
  ["only-legacy"],
);

assert.deepEqual(
  playerTeamIdEntriesFromFirestoreDoc({
    teams: ["  ab  ", "ab"],
  }),
  [{ canonical: "ab", storage: "  ab  " }],
);

console.log("playerUtils tests: OK");
