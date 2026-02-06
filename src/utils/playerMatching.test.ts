import assert from "node:assert/strict";
import { Player } from "../types";
import { getPlayerMatchSuggestions } from "./playerMatching";

const players: Player[] = [
  {
    id: "p1",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 7,
    position: "ST",
    birthYear: 2006,
    teams: []
  },
  {
    id: "p2",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 11,
    position: "AM",
    birthYear: 2005,
    teams: []
  },
  {
    id: "p3",
    firstName: "Adam",
    lastName: "Nowak",
    number: 9,
    position: "ST",
    birthYear: 2006,
    teams: []
  },
  {
    id: "p4",
    firstName: "Świętosław",
    lastName: "Zieliński",
    number: 5,
    position: "CB",
    birthYear: 2004,
    teams: []
  }
];

const suggestions = getPlayerMatchSuggestions(players, {
  firstName: "Jan",
  lastName: "Kowalski",
  birthYear: 2006
});

assert.equal(suggestions.length, 3);
assert.equal(suggestions[0].id, "p1");
assert.equal(suggestions[1].id, "p2");
assert.equal(suggestions[2].id, "p3");

const diacriticsMatch = getPlayerMatchSuggestions(players, {
  firstName: "Swietoslaw",
  lastName: "Zielinski",
  birthYear: 2004
});

assert.equal(diacriticsMatch.length, 1);
assert.equal(diacriticsMatch[0].id, "p4");

console.log("playerMatching tests: OK");
