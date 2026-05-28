import assert from "node:assert/strict";
import type { TeamInfo } from "@/types";
import {
  findSuggestedOpponentLogoFromMatches,
  normalizeOpponentNameForLogoLookup,
} from "./findSuggestedOpponentLogoFromMatches";

assert.equal(normalizeOpponentNameForLogoLookup("  Legia  Warszawa "), "legia warszawa");

function base(over: Partial<TeamInfo>): TeamInfo {
  return {
    team: "t1",
    opponent: "Legia",
    competition: "Liga",
    date: "2024-01-01",
    isHome: true,
    ...over,
  };
}

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [
      base({
        matchId: "a",
        opponent: "  legia ",
        opponentLogo: "data:old",
        date: "2024-01-01",
      }),
      base({
        matchId: "b",
        opponent: "Legia",
        opponentLogo: "data:new",
        date: "2025-06-01",
      }),
    ],
    "t1",
    "Legia Warszawa"
  ),
  undefined
);

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [
      base({ matchId: "a", opponent: "Legia", opponentLogo: "data:old", date: "2024-01-01" }),
      base({ matchId: "b", opponent: "Legia", opponentLogo: "data:new", date: "2025-06-01" }),
    ],
    "t1",
    "  LEGIA  "
  ),
  "data:new"
);

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [base({ matchId: "x", opponent: "Cracovia", opponentLogo: "data:x", date: "2025-01-01" })],
    "t1",
    "Legia"
  ),
  undefined
);

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [base({ matchId: "x", team: "other", opponent: "Legia", opponentLogo: "data:x" })],
    "t1",
    "Legia"
  ),
  undefined
);

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [
      base({ matchId: "self", opponent: "Legia", opponentLogo: "data:self", date: "2025-01-01" }),
      base({ matchId: "other", opponent: "Legia", opponentLogo: "data:other", date: "2024-01-01" }),
    ],
    "t1",
    "Legia",
    { excludeMatchId: "self" }
  ),
  "data:other"
);

assert.equal(
  findSuggestedOpponentLogoFromMatches(
    [base({ matchId: "a", opponent: "Legia", opponentLogo: "" })],
    "t1",
    "Legia"
  ),
  undefined
);
