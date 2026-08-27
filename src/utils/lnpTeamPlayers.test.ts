import assert from "node:assert/strict";
import type { Player } from "../types";
import {
  extractLnpTeamPlayers,
  findExistingLnpDuplicate,
  mapLnpPosition,
  toNewPlayerPayload,
} from "./lnpTeamPlayers";
import { parseLaczyTeamIdFromUrl, buildLaczyTeamPlayersPageUrl } from "./laczyTeamUrl";

assert.equal(mapLnpPosition({ isKeeper: true }), "GK");
assert.equal(mapLnpPosition({ isKeeper: false, position: "Napastnik" }), "ST");
assert.equal(mapLnpPosition({ isKeeper: false, position: "Bramkarz" }), "GK");
assert.equal(mapLnpPosition({ isKeeper: false, position: "Lewy skrzydłowy" }), "LW");
assert.equal(mapLnpPosition({ isKeeper: false, position: "Pomocnik" }), "AM");
assert.equal(mapLnpPosition({ isKeeper: false, position: "Obrońca" }), "CB");
assert.equal(mapLnpPosition({ isKeeper: false }), "");

const fromArray = extractLnpTeamPlayers([
  { id: "p1", firstname: "Jan", lastname: "Kowalski", number: 9, isKeeper: false },
  { id: "p2", firstname: "Adam", lastname: "Nowak", number: 1, isKeeper: true },
  { id: "p1", firstname: "Jan", lastname: "Kowalski", number: 9, isKeeper: false },
]);
assert.equal(fromArray.length, 2);
assert.equal(fromArray[0].firstName, "Jan");
assert.equal(fromArray[1].position, "GK");

const withAge = extractLnpTeamPlayers([
  { id: "p3", firstname: "Ewa", lastname: "Lis", number: 7, age: 20 },
]);
assert.equal(withAge[0].birthYear, new Date().getFullYear() - 20);

const nested = extractLnpTeamPlayers({
  squad: [{ player: { id: "n1", firstName: "Marek", lastName: "Bąk", number: 4, position: "Obrońca" } }],
});
assert.equal(nested[0].position, "CB");
assert.equal(nested[0].lastName, "Bąk");

assert.deepEqual(extractLnpTeamPlayers(null), []);
assert.deepEqual(extractLnpTeamPlayers({ foo: 1 }), []);

const existing: Player[] = [
  {
    id: "local-1",
    firstName: "Jan",
    lastName: "Kowalski",
    number: 9,
    position: "ST",
    birthYear: 2006,
    teams: ["t1"],
  },
];
assert.equal(
  findExistingLnpDuplicate(fromArray[0], existing)?.id,
  "local-1"
);
assert.equal(findExistingLnpDuplicate(fromArray[1], existing), undefined);

const payload = toNewPlayerPayload(fromArray[1], "team-a");
assert.equal(payload.teams[0], "team-a");
assert.equal(payload.position, "GK");
assert.equal(payload.name, "Adam Nowak");

assert.equal(
  parseLaczyTeamIdFromUrl(
    "https://www.laczynaspilka.pl/rozgrywki/druzyna/4b125148-f622-4b9c-88f9-4a83fd8b7b3b?tab=tab-zawodnicy&playDictionary=1101ed4b-a0fc-4a33-8432-19c59038671e"
  ),
  "4b125148-f622-4b9c-88f9-4a83fd8b7b3b"
);
assert.ok(
  buildLaczyTeamPlayersPageUrl("4b125148-f622-4b9c-88f9-4a83fd8b7b3b").includes(
    "tab=tab-zawodnicy"
  )
);

console.log("lnpTeamPlayers.test.ts: OK");
