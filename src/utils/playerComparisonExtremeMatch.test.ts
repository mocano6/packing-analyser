import assert from "assert";
import type { PKEntry, Shot, TeamInfo } from "@/types";
import {
  PLAYER_COMPARISON_EXTREME_MIN_SIGNALS,
  countPlayerComparisonExtremeDominationSignals,
  filterPlayerComparisonMatchesExcludingExtreme,
  isPlayerComparisonExtremeDominationMatch,
} from "./playerComparisonExtremeMatch";

const baseShot = {
  minute: 1,
  timestamp: 1,
  matchId: "m1",
  x: 80,
  y: 50,
} as const;

function shotForSide(ctx: "attack" | "defense", xG: number, isGoal?: boolean): Shot {
  return {
    ...baseShot,
    id: `${ctx}_${xG}_${isGoal ? "g" : "n"}_${Math.random()}`,
    shotType: isGoal ? "goal" : "on_target",
    teamContext: ctx,
    teamId: ctx === "attack" ? "t1" : "op1",
    xG,
    isGoal: isGoal === true,
  } as Shot;
}

function pk(ctx: "attack" | "defense", id: string): PKEntry {
  return {
    id,
    matchId: "m1",
    teamId: "t1",
    startX: 1,
    startY: 1,
    endX: 2,
    endY: 2,
    minute: 1,
    isSecondHalf: false,
    teamContext: ctx,
    timestamp: 1,
  };
}

function matchWith(shots: Shot[], pkEntries: PKEntry[]): TeamInfo {
  return {
    team: "t1",
    opponent: "op1",
    isHome: true,
    competition: "test",
    date: "2026-01-01",
    shots,
    pkEntries,
  };
}

assert.strictEqual(PLAYER_COMPARISON_EXTREME_MIN_SIGNALS, 2);

// Różnica 2 goli — brak sygnału goli
let m = matchWith(
  [
    shotForSide("attack", 0.3, true),
    shotForSide("attack", 0.2, true),
    shotForSide("defense", 0.1, true),
  ],
  [],
);
assert.strictEqual(countPlayerComparisonExtremeDominationSignals(m), 0);

// xG diff 2.1 + PK +8 → dokładnie 2 sygnały → skrajny
const pkAttackMany = Array.from({ length: 10 }, (_, i) => pk("attack", `pa${i}`));
const pkDefenseFew = Array.from({ length: 2 }, (_, i) => pk("defense", `pd${i}`));
m = matchWith([shotForSide("attack", 2.1, false), shotForSide("defense", 0, false)], [
  ...pkAttackMany,
  ...pkDefenseFew,
]);
assert.strictEqual(countPlayerComparisonExtremeDominationSignals(m), 2);
assert.strictEqual(isPlayerComparisonExtremeDominationMatch(m), true);

// Granica xG: dokładnie 2 → nie liczy się jako sygnał xG (tylko PK)
m = matchWith([shotForSide("attack", 2, false), shotForSide("defense", 0, false)], [
  ...pkAttackMany,
  ...pkDefenseFew,
]);
assert.strictEqual(countPlayerComparisonExtremeDominationSignals(m), 1);

// Trzy gole więcej (bez xG/PK) — jeden sygnał
m = matchWith(
  [
    shotForSide("attack", 0.02, true),
    shotForSide("attack", 0.02, true),
    shotForSide("attack", 0.02, true),
    shotForSide("defense", 0.02, false),
  ],
  [],
);
assert.strictEqual(countPlayerComparisonExtremeDominationSignals(m), 1);

// Filtr — zostaje jeden mecz (bardziej zrównany)
const extreme = matchWith([shotForSide("attack", 2.1, false), shotForSide("defense", 0, false)], [
  ...pkAttackMany,
  ...pkDefenseFew,
]);
const normal = matchWith([shotForSide("attack", 0.1, false), shotForSide("defense", 0.1, false)], []);
const kept = filterPlayerComparisonMatchesExcludingExtreme([extreme, normal]);
assert.strictEqual(kept.length, 1);
assert.strictEqual(kept[0], normal);

console.log("playerComparisonExtremeMatch tests: OK");
