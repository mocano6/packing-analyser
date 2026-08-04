import assert from "node:assert/strict";
import type { Player } from "@/types";
import { filterActionsByAnalyzedTeamSquad } from "./filterActionsByTeamSquad";

const players: Pick<Player, "id" | "teams" | "isDeleted">[] = [
  { id: "p1", teams: ["clubA"], isDeleted: undefined },
  { id: "p2", teams: ["clubB"], isDeleted: undefined },
  // Były zawodnik clubA — teraz w clubC (kolejny sezon / transfer)
  { id: "p3", teams: ["clubC"], isDeleted: undefined },
];

const loses = [
  { senderId: "p1" },
  { senderId: "p2" },
  { senderId: "p3" },
  { senderId: "" },
  {},
] as { senderId?: string }[];

assert.deepEqual(filterActionsByAnalyzedTeamSquad(loses, "clubA", players), [{ senderId: "p1" }]);

assert.strictEqual(filterActionsByAnalyzedTeamSquad(loses, undefined, players), loses);
assert.deepEqual(filterActionsByAnalyzedTeamSquad(loses, "clubA", []), []);

const noSquadTeam = filterActionsByAnalyzedTeamSquad(loses, "clubZ", players);
assert.deepEqual(noSquadTeam, []);

// Historyczny uczestnik meczu: p3 już nie ma clubA w teams[], ale był w protokole
const withMatchRoster = filterActionsByAnalyzedTeamSquad(loses, "clubA", players, {
  matchParticipantIds: ["p3", "p1"],
});
assert.deepEqual(withMatchRoster, [{ senderId: "p1" }, { senderId: "p3" }]);

// Sam protokół meczu wystarczy, gdy aktualna kadra nie pokrywa historycznych ID
const onlyMatchRoster = filterActionsByAnalyzedTeamSquad(loses, "clubA", [], {
  matchParticipantIds: ["p3"],
});
assert.deepEqual(onlyMatchRoster, [{ senderId: "p3" }]);

// Przeciwnik z protokołu innego meczu nie wchodzi — tylko podane ID
const opponentExcluded = filterActionsByAnalyzedTeamSquad(loses, "clubA", players, {
  matchParticipantIds: ["p1"],
});
assert.deepEqual(opponentExcluded, [{ senderId: "p1" }]);

console.log("filterActionsByTeamSquad tests: OK");
