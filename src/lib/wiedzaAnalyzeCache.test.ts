import assert from "node:assert/strict";
import { parseWiedzaAnalyzeCache, sanitizeWiedzaCache } from "./wiedzaAnalyzeCache";

assert.equal(parseWiedzaAnalyzeCache(null), null);
assert.equal(parseWiedzaAnalyzeCache(""), null);
assert.equal(parseWiedzaAnalyzeCache("{"), null);

const ok = parseWiedzaAnalyzeCache(
  JSON.stringify({
    v: 1,
    dateFrom: "2026-01-01",
    dateTo: "2026-03-01",
    selectedTeams: ["a", "b"],
    matches: [{ id: "m1", team: "a", opponent: "x", date: "2026-02-01", isHome: true, competition: "L" }],
    activeTab: "weights",
  }),
);
assert.ok(ok != null && ok.v === 1);
if (ok && ok.v === 1) {
  assert.equal(ok.activeTab, "correlations");
  const s = sanitizeWiedzaCache(ok, new Set(["a"]));
  assert.equal(s.needsRefetch, false);
  assert.deepEqual(s.selectedTeams, ["a"]);
  assert.equal(s.matches.length, 1);
}

const v2raw = JSON.stringify({
  v: 2,
  dateFrom: "2026-01-01",
  dateTo: "2026-03-01",
  selectedTeams: ["a", "b"],
  activeTab: "regains",
});
const v2 = parseWiedzaAnalyzeCache(v2raw);
assert.ok(v2 != null && v2.v === 2);
if (v2 && v2.v === 2) {
  const s2 = sanitizeWiedzaCache(v2, new Set(["a"]));
  assert.equal(s2.needsRefetch, true);
  assert.equal(s2.matches.length, 0);
  assert.deepEqual(s2.selectedTeams, ["a"]);
}

const v3 = parseWiedzaAnalyzeCache(
  JSON.stringify({
    v: 3,
    dateFrom: "2026-01-01",
    dateTo: "2026-03-01",
    selectedTeams: ["a"],
    activeTab: "weights",
    matches: [{ id: "x", team: "a", opponent: "o", date: "2026-02-01", isHome: true, competition: "L" }],
  }),
);
assert.ok(v3 != null && v3.v === 3);
if (v3 && v3.v === 3) {
  assert.equal(v3.activeTab, "correlations");
  const s3 = sanitizeWiedzaCache(v3, new Set(["a"]));
  assert.equal(s3.needsRefetch, false);
  assert.equal(s3.matches.length, 1);
}

console.log("wiedzaAnalyzeCache tests: OK");
