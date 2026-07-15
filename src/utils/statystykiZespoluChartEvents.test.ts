import assert from "node:assert/strict";
import type { PKEntry, Shot, TeamInfo } from "@/types";
import {
  buildChartMatchEvents,
  buildCumulativeMarkerPoints,
  buildIntervalMarkerPoints,
  groupChartMatchEvents,
  minuteTo5MinIntervalLabel,
  passesChartMatchHalfFilter,
} from "./statystykiZespoluChartEvents";

const match = {
  matchId: "m1",
  team: "home",
  opponent: "away",
  isHome: true,
  competition: "test",
  date: "2024-01-01",
} as TeamInfo;

const goalShot = (minute: number, teamId?: string): Shot => ({
  id: `s-${minute}`,
  x: 50,
  y: 50,
  minute,
  xG: 0.4,
  isGoal: true,
  shotType: "goal",
  teamContext: "attack",
  teamId: teamId ?? "home",
  assistantId: minute === 23 ? "p9" : undefined,
  matchId: "m1",
  timestamp: minute * 60,
});

const regularShot = (minute: number): Shot => ({
  id: `shot-${minute}`,
  x: 50,
  y: 50,
  minute,
  xG: 0.12,
  isGoal: false,
  shotType: "on_target",
  teamContext: "attack",
  teamId: "home",
  matchId: "m1",
  timestamp: minute * 60,
});

const pkEntry = (
  minute: number,
  teamContext: "attack" | "defense" = "attack",
  isSecondHalf = false,
): PKEntry => ({
  id: `pk-${minute}`,
  matchId: "m1",
  teamId: "home",
  startX: 40,
  startY: 40,
  endX: 50,
  endY: 50,
  minute,
  isSecondHalf,
  teamContext,
  timestamp: minute * 60,
});

assert.equal(minuteTo5MinIntervalLabel(23), "20-25");

const events = buildChartMatchEvents(
  [goalShot(23), regularShot(24), goalShot(67, "away")],
  [pkEntry(21), pkEntry(70, "defense", true)],
  match,
  "home",
  "all",
);
assert.equal(events.length, 6);
assert.ok(events.some((event) => event.type === "assist"));
assert.ok(events.some((event) => event.type === "shot"));

const intervalPoints = buildIntervalMarkerPoints(events, [
  { minute: "20-25", teamTotal: 0.4, oppTotal: 0.1 },
  { minute: "65-70", teamTotal: 0, oppTotal: 0.5 },
], { variant: "signed", teamValueKey: "teamTotal", oppValueKey: "oppTotal" });
assert.equal(intervalPoints.length, 2);
assert.ok(intervalPoints.every((point) => point.type === "goal"));
assert.ok(intervalPoints.some((point) => point.x === "20-25" && point.side === "team"));
assert.ok(intervalPoints.some((point) => point.x === "65-70" && point.side === "opponent"));

const cumulative = [
  { minute: 21, teamXG: 0.1, opponentXG: 0 },
  { minute: 23, teamXG: 0.5, opponentXG: 0 },
  { minute: 24, teamXG: 0.62, opponentXG: 0 },
];
const cumulativePoints = buildCumulativeMarkerPoints(events, cumulative);
assert.equal(cumulativePoints.length, 2);
assert.ok(cumulativePoints.some((point) => point.x === 23 && point.type === "goal"));
assert.ok(cumulativePoints.some((point) => point.x === 67 && point.type === "goal"));
assert.ok(!cumulativePoints.some((point) => point.type === "pk" || point.type === "shot"));

const intervalGoalsOnly = buildIntervalMarkerPoints(events, [
  { minute: "20-25", teamTotal: 0.4, oppTotal: 0.1 },
], { variant: "signed", teamValueKey: "teamTotal", oppValueKey: "oppTotal" });
assert.equal(intervalGoalsOnly.length, 1);
assert.equal(intervalGoalsOnly[0]?.type, "goal");
assert.equal(intervalGoalsOnly[0]?.count, 1);

const grouped = groupChartMatchEvents(events);
const bucket20 = grouped.find((group) => group.intervalLabel === "20-25");
assert.ok(bucket20);
assert.equal(bucket20?.teamPkCount, 1);

console.log("statystykiZespoluChartEvents.test: OK");
