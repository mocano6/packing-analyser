import assert from "node:assert/strict";
import {
  filterPermanentDeleteEligiblePlayers,
  permanentDeleteEligiblePlayerIds,
} from "./listaZawodnikowPermanentDeleteEligible";

const players = [
  { id: "a", isDeleted: true, globalDataTotal: 0 },
  { id: "b", isDeleted: true, globalDataTotal: 5 },
  { id: "c", isDeleted: false, globalDataTotal: 0 },
  { id: "d", isDeleted: true, globalDataTotal: 0 },
];

assert.deepEqual(permanentDeleteEligiblePlayerIds(players), ["a", "d"]);
assert.strictEqual(filterPermanentDeleteEligiblePlayers(players).length, 2);

console.log("listaZawodnikowPermanentDeleteEligible tests: OK");
