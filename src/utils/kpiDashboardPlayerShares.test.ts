import assert from "assert";
import {
  attachXtToPlayerShareRows,
  countActionsByPlayerId,
  mapToSortedPlayerShareRows,
  playerStatsSummary,
  sortKpiRegainsLosesPlayerRows,
} from "./kpiDashboardPlayerShares";

{
  const m = countActionsByPlayerId([
    { senderId: "a" },
    { senderId: "a" },
    { playerId: "b" },
    { senderId: "" },
    null,
  ]);
  assert.strictEqual(m.get("a"), 2);
  assert.strictEqual(m.get("b"), 1);
  assert.strictEqual(m.size, 2);
}

{
  const m = new Map([
    ["z", 1],
    ["y", 3],
  ]);
  const rows = mapToSortedPlayerShareRows(m, 4, (id) => id);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].playerId, "y");
  assert.strictEqual(rows[0].count, 3);
  assert.strictEqual(rows[0].sharePct, 75);
  assert.strictEqual(rows[1].sharePct, 25);
}

{
  const m = new Map([
    ["a", 2],
    ["b", 1],
  ]);
  const s = playerStatsSummary(m, 4);
  assert.strictEqual(s.playersWithActions, 2);
  assert.strictEqual(s.maxSharePct, 50);
}

{
  const s = playerStatsSummary(new Map(), 0);
  assert.strictEqual(s.playersWithActions, 0);
  assert.strictEqual(s.maxSharePct, 0);
}

{
  const rows = mapToSortedPlayerShareRows(new Map([["a", 2]]), 4, (id) => id);
  const xtMap = new Map([["a", { xtAttack: 0.1, xtDefense: 0.2 }]]);
  const withXt = attachXtToPlayerShareRows(rows, xtMap);
  assert.strictEqual(withXt.length, 1);
  assert.strictEqual(withXt[0].xtAttack, 0.1);
  assert.strictEqual(withXt[0].xtDefense, 0.2);
}

{
  const base = [
    { playerId: "1", playerName: "B", count: 2, sharePct: 0, xtAttack: 1, xtDefense: 0 },
    { playerId: "2", playerName: "A", count: 5, sharePct: 0, xtAttack: 0, xtDefense: 3 },
  ];
  const byCountDesc = sortKpiRegainsLosesPlayerRows(base, { column: "count", dir: "desc" });
  assert.strictEqual(byCountDesc[0].playerId, "2");
  const byNameAsc = sortKpiRegainsLosesPlayerRows(base, { column: "playerName", dir: "asc" });
  assert.strictEqual(byNameAsc[0].playerId, "2");
  const same = sortKpiRegainsLosesPlayerRows(base, { column: null, dir: "desc" });
  assert.deepStrictEqual(same, base);
}

console.log("kpiDashboardPlayerShares.test: OK");
