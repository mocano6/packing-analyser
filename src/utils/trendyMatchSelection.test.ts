import assert from "node:assert/strict";
import {
  filterIncludedMatches,
  formatTrendyIncludedMatchCount,
  getTrendyMatchId,
  isTrendyMatchIncluded,
  toggleExcludedMatchId,
  trendyMatchCountNoun,
} from "./trendyMatchSelection";

{
  const withId = getTrendyMatchId({ matchId: "abc", date: "2026-05-23", opponent: "Lech" }, 0);
  assert.equal(withId, "abc");
}

{
  const fallback = getTrendyMatchId({ date: "2026-05-23", opponent: "Lech Poznań" }, 2);
  assert.equal(fallback, "fallback:2026-05-23:Lech Poznań:2");
}

{
  const trimmed = getTrendyMatchId({ matchId: "  ", date: "2026-01-01", opponent: "X" }, 1);
  assert.equal(trimmed, "fallback:2026-01-01:X:1");
}

{
  const excluded = toggleExcludedMatchId(new Set(), "m1");
  assert.equal(isTrendyMatchIncluded(excluded, "m1"), false);
  assert.equal(isTrendyMatchIncluded(excluded, "m2"), true);

  const restored = toggleExcludedMatchId(excluded, "m1");
  assert.equal(isTrendyMatchIncluded(restored, "m1"), true);
  assert.notEqual(restored, excluded);
}

{
  const matches = [
    { matchId: "a", opponent: "Lech" },
    { matchId: "b", opponent: "Zagłębie" },
    { matchId: "c", opponent: "Wisła" },
  ];
  const included = filterIncludedMatches(matches, new Set(["b"]));
  assert.deepEqual(
    included.map((m) => m.matchId),
    ["a", "c"],
  );
}

{
  assert.equal(trendyMatchCountNoun(0), "meczów");
  assert.equal(trendyMatchCountNoun(1), "mecz");
  assert.equal(trendyMatchCountNoun(3), "mecze");
  assert.equal(trendyMatchCountNoun(9), "meczów");
}

{
  const all = formatTrendyIncludedMatchCount(9, 9);
  assert.equal(all.numberLabel, "9");
  assert.equal(all.noun, "meczów");

  const few = formatTrendyIncludedMatchCount(3, 9);
  assert.equal(few.numberLabel, "3 z 9");
  assert.equal(few.noun, "meczów");

  const many = formatTrendyIncludedMatchCount(7, 9);
  assert.equal(many.numberLabel, "7 z 9");
  assert.equal(many.noun, "meczów");
}
