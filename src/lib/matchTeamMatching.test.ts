import assert from "node:assert/strict";
import { resolveMatchTeamId, matchBelongsToTeam, matchBelongsToAnyTeam } from "./matchTeamMatching";

// resolveMatchTeamId — kolejność team → teamId → teams[0]
{
  assert.equal(resolveMatchTeamId({ team: "A", teamId: "B" }), "A");
  assert.equal(resolveMatchTeamId({ teamId: "B" }), "B");
  assert.equal(resolveMatchTeamId({ team: "  ", teamId: " B " }), "B");
  assert.equal(resolveMatchTeamId({ teams: ["C", "D"] }), "C");
  assert.equal(resolveMatchTeamId({ teams: "E" }), "E");
  assert.equal(resolveMatchTeamId({}), "");
  assert.equal(resolveMatchTeamId({ team: "", teamId: "", teams: [] }), "");
}

// matchBelongsToTeam — dopasowanie po dowolnym polu
{
  assert.equal(matchBelongsToTeam({ team: "A" }, "A"), true);
  assert.equal(matchBelongsToTeam({ teamId: "B" }, "B"), true); // legacy: tylko teamId
  assert.equal(matchBelongsToTeam({ teams: ["X", "B"] }, "B"), true);
  assert.equal(matchBelongsToTeam({ teams: "B" }, "B"), true);
  assert.equal(matchBelongsToTeam({ team: "A", teamId: "B" }, "C"), false);
  assert.equal(matchBelongsToTeam({ team: "A" }, ""), false);
}

// matchBelongsToAnyTeam — pusta lista = brak filtra
{
  assert.equal(matchBelongsToAnyTeam({ teamId: "B" }, []), true);
  assert.equal(matchBelongsToAnyTeam({ teamId: "B" }, ["A", "B"]), true);
  assert.equal(matchBelongsToAnyTeam({ team: "Z" }, ["A", "B"]), false);
}

console.log("matchTeamMatching tests: OK");
