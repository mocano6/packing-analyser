import assert from "node:assert/strict";
import {
  buildMainTableMergeTargetCandidates,
  rawFirstLastFromPlayer,
} from "./listaZawodnikowMergeCandidates";

const label = (id: string) =>
  ({ oskar: "Oskar Figurski", eryk: "Eryk Figurski", other: "Jan Kowalski" } as Record<string, string>)[id] ??
  id;

const players = [
  { id: "oskar", firstName: "Oskar", lastName: "Figurski", globalDataTotal: 5, isDeleted: false },
  { id: "eryk", firstName: "Eryk", lastName: "Figurski", globalDataTotal: 120, isDeleted: false },
  { id: "other", name: "Jan Kowalski", globalDataTotal: 50, isDeleted: false },
  { id: "deleted", name: "Ghost", globalDataTotal: 99, isDeleted: true },
];

assert.deepEqual(rawFirstLastFromPlayer(players[0]), { first: "Oskar", last: "Figurski" });

const sameLast = buildMainTableMergeTargetCandidates(players[0], players, "", label);
assert.deepEqual(
  sameLast.map((p) => p.id),
  ["eryk"],
  "bez wyszukiwania: ten sam nazwisko, bez źródła",
);

const searchFig = buildMainTableMergeTargetCandidates(players[0], players, "figurski", label);
assert.deepEqual(
  searchFig.map((p) => p.id),
  ["eryk"],
  "wyszukiwanie: obie karty Figurski, źródło wykluczone, sort wg total",
);

const searchOskar = buildMainTableMergeTargetCandidates(players[1], players, "oskar", label);
assert.deepEqual(searchOskar.map((p) => p.id), ["oskar"]);

assert.ok(!buildMainTableMergeTargetCandidates(players[0], players, "", label).some((p) => p.id === "oskar"));
assert.ok(!buildMainTableMergeTargetCandidates(players[0], players, "", label).some((p) => p.id === "deleted"));

console.log("listaZawodnikowMergeCandidates tests: OK");
