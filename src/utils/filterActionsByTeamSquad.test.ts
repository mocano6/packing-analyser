import assert from "node:assert/strict";
import type { Player } from "@/types";
import { filterActionsByAnalyzedTeamSquad } from "./filterActionsByTeamSquad";

const players: Pick<Player, "id" | "teams" | "isDeleted">[] = [
  { id: "p1", teams: ["clubA"], isDeleted: undefined },
  { id: "p2", teams: ["clubB"], isDeleted: undefined },
];

const loses = [
  { senderId: "p1" },
  { senderId: "p2" },
  { senderId: "" },
  {},
] as { senderId?: string }[];

assert.deepEqual(filterActionsByAnalyzedTeamSquad(loses, "clubA", players), [{ senderId: "p1" }]);

assert.strictEqual(filterActionsByAnalyzedTeamSquad(loses, undefined, players), loses);
assert.deepEqual(filterActionsByAnalyzedTeamSquad(loses, "clubA", []), []);

const noSquadTeam = filterActionsByAnalyzedTeamSquad(loses, "clubZ", players);
assert.deepEqual(noSquadTeam, []);

console.log("filterActionsByTeamSquad tests: OK");
