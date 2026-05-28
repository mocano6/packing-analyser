import assert from "assert";
import type { TeamInfo } from "@/types";
import { prepareMatchDocumentForFirestore } from "./prepareMatchDocumentForFirestore";

const base: TeamInfo = {
  team: "team-a",
  opponent: "X",
  isHome: true,
  competition: "Liga",
  date: "2025-01-01",
};

function testStripsForbiddenKeysAndSetsTeamId() {
  const withNoise = {
    ...base,
    number: 9,
    name: "bad",
    matchId: "m1",
  } as TeamInfo;
  const out = prepareMatchDocumentForFirestore(withNoise);
  assert.strictEqual(out.team, "team-a");
  assert.strictEqual(out.teamId, "team-a");
  assert.strictEqual(out.number, undefined);
  assert.strictEqual(out.name, undefined);
}

function testDerivesTeamFromTeamIdOrTeams() {
  const fromTeamId = prepareMatchDocumentForFirestore({
    ...base,
    team: "",
    teamId: "  tid-1  ",
  } as TeamInfo);
  assert.strictEqual(fromTeamId.team, "tid-1");
  assert.strictEqual(fromTeamId.teamId, "tid-1");

  const fromTeams = prepareMatchDocumentForFirestore({
    ...base,
    team: "",
    teams: ["solo"],
  } as TeamInfo);
  assert.strictEqual(fromTeams.team, "solo");
  assert.strictEqual(fromTeams.teamId, "solo");
}

function testStripsInvalidHalfStartTimes() {
  const z = prepareMatchDocumentForFirestore({
    ...base,
    firstHalfStartTime: 0,
    secondHalfStartTime: null as unknown as number | undefined,
  } as TeamInfo);
  assert.strictEqual(z.firstHalfStartTime, undefined);
  assert.strictEqual(z.secondHalfStartTime, undefined);

  const ok = prepareMatchDocumentForFirestore({
    ...base,
    firstHalfStartTime: 60,
    secondHalfStartTime: 3000,
  });
  assert.strictEqual(ok.firstHalfStartTime, 60);
  assert.strictEqual(ok.secondHalfStartTime, 3000);
}

testStripsForbiddenKeysAndSetsTeamId();
testDerivesTeamFromTeamIdOrTeams();
testStripsInvalidHalfStartTimes();
console.log("prepareMatchDocumentForFirestore tests: OK");
