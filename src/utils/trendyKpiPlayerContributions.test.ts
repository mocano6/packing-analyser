import assert from "node:assert/strict";
import type { Action, Shot, TeamInfo } from "../types";
import { getTrendyKpiPlayerContributions } from "./trendyKpiPlayerContributions";

const id = (x: string) => x;

const minimalMatch = (partial: Partial<TeamInfo>): TeamInfo =>
  ({
    team: "team-a",
    opponent: "opp",
    isHome: true,
    competition: "liga",
    date: "2024-06-01",
    ...partial,
  }) as TeamInfo;

assert.equal(getTrendyKpiPlayerContributions([], "xg_for", id).kind, "info");

const poss = getTrendyKpiPlayerContributions([minimalMatch({})], "possession_pct", id);
assert.equal(poss.kind, "info");
if (poss.kind === "info") assert.match(poss.message, /poziomie meczu/i);

const m = minimalMatch({
  shots: [
    { playerId: "p1", teamContext: "attack", xG: 0.5 } as Shot,
    { playerId: "p2", teamContext: "attack", xG: 0.3 } as Shot,
    { playerId: "p-ignore", teamContext: "defense", xG: 0.9 } as Shot,
  ],
});

const xg = getTrendyKpiPlayerContributions([m], "xg_for", id);
assert.equal(xg.kind, "table");
if (xg.kind === "table") {
  assert.equal(xg.rows.length, 2);
  assert.ok(Math.abs(xg.totalValue - 0.8) < 1e-6);
  const r1 = xg.rows.find((r) => r.playerId === "p1");
  assert.ok(r1);
  assert.ok(r1 && Math.abs(r1.sharePct - (0.5 / 0.8) * 100) < 1e-3);
}

const mPxt = minimalMatch({
  actions_packing: [
    {
      senderId: "a",
      receiverId: "b",
      xTValueStart: 0,
      xTValueEnd: 0.1,
      packingPoints: 2,
    } as Action,
  ],
});

const pxt = getTrendyKpiPlayerContributions([mPxt], "pxt", id);
assert.equal(pxt.kind, "table");
if (pxt.kind === "table") {
  assert.ok(Math.abs(pxt.totalValue - 0.2) < 1e-6);
  assert.ok(pxt.pxtColumns);
  const ra = pxt.rows.find((r) => r.playerId === "a");
  const rb = pxt.rows.find((r) => r.playerId === "b");
  assert.ok(ra && rb && Math.abs(ra.value - 0.1) < 1e-6 && Math.abs(rb.value - 0.1) < 1e-6);
  assert.ok(ra && Math.abs((ra.xtDeltaSum ?? 0) - 0.05) < 1e-6 && Math.abs((ra.packingPointsSum ?? 0) - 1) < 1e-6);
  assert.ok(rb && Math.abs((rb.xtDeltaSum ?? 0) - 0.05) < 1e-6 && Math.abs((rb.packingPointsSum ?? 0) - 1) < 1e-6);
}

console.log("trendyKpiPlayerContributions tests: OK");
