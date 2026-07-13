import assert from "node:assert/strict";
import {
  buildWiedzaShotMatchLabelLookup,
  formatWiedzaShotMatchLabel,
  getWiedzaShotMatchLabel,
} from "./wiedzaShotMatchLabels";
import { TeamInfo } from "@/types";

const teams = [
  { id: "t1", name: "Górnik" },
  { id: "t2", name: "Legia" },
];

(function testFormatLabel() {
  const match = {
    matchId: "m1",
    team: "t1",
    opponent: "t2",
    date: "2025-03-01",
    competition: "Ekstraklasa",
  } as TeamInfo;
  const label = formatWiedzaShotMatchLabel(match, new Map(teams.map((t) => [t.id, t.name])));
  assert.equal(label, "Górnik vs Legia · 2025-03-01 · Ekstraklasa");
})();

(function testLookup() {
  const lookup = buildWiedzaShotMatchLabelLookup(
    [
      {
        id: "m1",
        matchId: "m1",
        team: "t1",
        opponent: "t2",
        date: "2025-03-01",
        competition: "Ekstraklasa",
      } as TeamInfo & { id: string },
    ],
    teams,
  );
  assert.equal(getWiedzaShotMatchLabel("m1", lookup), "Górnik vs Legia · 2025-03-01 · Ekstraklasa");
  assert.equal(getWiedzaShotMatchLabel("missing", lookup), undefined);
})();

console.log("wiedzaShotMatchLabels tests: OK");
