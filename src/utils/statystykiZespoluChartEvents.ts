import type { PKEntry, Shot, TeamInfo } from "@/types";
import { resolveShotTeamIdForSelectedTeam } from "@/utils/statystykiZespoluXgStats";

export type ChartMatchHalfFilter = "all" | "first" | "second";
export type ChartMatchEventType = "pk" | "goal" | "shot" | "assist";

export interface ChartMatchEvent {
  exactMinute: number;
  intervalLabel: string;
  type: ChartMatchEventType;
  side: "team" | "opponent";
}

export interface ChartMarkerPoint {
  key: string;
  x: string | number;
  y: number;
  type: ChartMatchEventType;
  side: "team" | "opponent";
  count: number;
  offsetIndex: number;
  offsetTotal: number;
}

export interface ChartIntervalMarkers {
  intervalLabel: string;
  teamPkCount: number;
  oppPkCount: number;
  teamGoalMinutes: number[];
  oppGoalMinutes: number[];
}

export function minuteTo5MinIntervalLabel(minute: number): string {
  const m = Math.max(0, Math.floor(minute));
  const start = Math.floor(m / 5) * 5;
  return `${start}-${start + 5}`;
}

function isGoalShot(shot: Shot): boolean {
  return shot.isGoal === true || shot.shotType === "goal";
}

export function passesChartMatchHalfFilter(
  minute: number,
  isSecondHalf: boolean | undefined,
  half: ChartMatchHalfFilter,
): boolean {
  if (half === "all") return true;
  if (half === "first") {
    if (isSecondHalf === true) return false;
    if (isSecondHalf === false) return true;
    return minute <= 45;
  }
  if (isSecondHalf === false) return false;
  if (isSecondHalf === true) return true;
  return minute > 45;
}

function resolveShotSide(
  shot: Shot,
  matchInfo: TeamInfo,
  selectedTeam: string,
): "team" | "opponent" | null {
  const shotTeamId = resolveShotTeamIdForSelectedTeam(shot, matchInfo, selectedTeam);
  if (!shotTeamId) return null;
  return shotTeamId === selectedTeam ? "team" : "opponent";
}

function resolvePkSide(entry: PKEntry): "team" | "opponent" {
  return (entry.teamContext ?? "attack") === "attack" ? "team" : "opponent";
}

function markerTypeSortWeight(type: ChartMatchEventType): number {
  if (type === "pk") return 0;
  if (type === "shot") return 1;
  return 2;
}

type AggregatedMarkerGroup = {
  x: string | number;
  side: ChartMarkerPoint["side"];
  type: ChartMatchEventType;
  count: number;
  sample: ChartMatchEvent;
};

function aggregateMarkerPoints(
  events: ChartMatchEvent[],
  resolveY: (event: ChartMatchEvent) => number,
  resolveX: (event: ChartMatchEvent) => string | number,
): ChartMarkerPoint[] {
  const markerEvents = events.filter((event) => event.type === "goal");
  const grouped = new Map<string, AggregatedMarkerGroup>();

  for (const event of markerEvents) {
    const x = resolveX(event);
    const key = `${x}|${event.side}|${event.type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(key, {
      x,
      side: event.side,
      type: event.type,
      count: 1,
      sample: event,
    });
  }

  const byBucketSide = new Map<string, AggregatedMarkerGroup[]>();
  for (const group of grouped.values()) {
    const bucketKey = `${group.x}|${group.side}`;
    const bucket = byBucketSide.get(bucketKey) ?? [];
    bucket.push(group);
    byBucketSide.set(bucketKey, bucket);
  }

  const points: ChartMarkerPoint[] = [];
  for (const bucketGroups of byBucketSide.values()) {
    const sorted = [...bucketGroups].sort(
      (a, b) => markerTypeSortWeight(a.type) - markerTypeSortWeight(b.type),
    );

    sorted.forEach((group, index) => {
      points.push({
        key: `${group.type}-${group.side}-${group.x}-${index}`,
        x: group.x,
        y: resolveY(group.sample),
        type: group.type,
        side: group.side,
        count: group.count,
        offsetIndex: index,
        offsetTotal: sorted.length,
      });
    });
  }

  return points;
}

export function buildChartMatchEvents(
  shots: Shot[],
  pkEntries: PKEntry[],
  matchInfo: TeamInfo,
  selectedTeam: string,
  matchHalf: ChartMatchHalfFilter = "all",
): ChartMatchEvent[] {
  const events: ChartMatchEvent[] = [];
  const matchId = matchInfo.matchId;
  const scopedShots = matchId
    ? shots.filter((shot) => !shot.matchId || shot.matchId === matchId)
    : shots;
  const scopedPkEntries = matchId
    ? pkEntries.filter((entry) => !entry.matchId || entry.matchId === matchId)
    : pkEntries;

  for (const shot of scopedShots) {
    const minute = Number(shot.minute);
    if (!Number.isFinite(minute)) continue;
    if (!passesChartMatchHalfFilter(minute, undefined, matchHalf)) continue;
    const side = resolveShotSide(shot, matchInfo, selectedTeam);
    if (!side) continue;

    if (isGoalShot(shot) && shot.assistantId) {
      events.push({
        exactMinute: minute,
        intervalLabel: minuteTo5MinIntervalLabel(minute),
        type: "assist",
        side,
      });
    }

    events.push({
      exactMinute: minute,
      intervalLabel: minuteTo5MinIntervalLabel(minute),
      type: isGoalShot(shot) ? "goal" : "shot",
      side,
    });
  }

  const matchPkEntries = scopedPkEntries.filter((entry) => entry && entry.teamId === selectedTeam);
  for (const entry of matchPkEntries) {
    const minute = Number(entry.minute);
    if (!Number.isFinite(minute)) continue;
    if (!passesChartMatchHalfFilter(minute, entry.isSecondHalf, matchHalf)) continue;
    events.push({
      exactMinute: minute,
      intervalLabel: minuteTo5MinIntervalLabel(minute),
      type: "pk",
      side: resolvePkSide(entry),
    });
  }

  return events.sort((a, b) => a.exactMinute - b.exactMinute);
}

export function filterChartEventsToIntervals(
  events: ChartMatchEvent[],
  chartData: Array<{ minute: string }>,
): ChartMatchEvent[] {
  const visible = new Set(chartData.map((row) => row.minute));
  return events.filter((event) => visible.has(event.intervalLabel));
}

export function computeChartIconAnchorY(
  chartData: Array<Record<string, number | string>>,
  valueKeys: string[],
  paddingRatio = 0.1,
): number {
  let max = 0;
  for (const row of chartData) {
    for (const key of valueKeys) {
      const value = Number(row[key]);
      if (Number.isFinite(value)) max = Math.max(max, Math.abs(value));
    }
  }
  return max <= 0 ? 0.5 : max * (1 + paddingRatio);
}

type IntervalRow = { minute: string } & Record<string, unknown>;

export function buildIntervalMarkerPoints(
  events: ChartMatchEvent[],
  chartData: IntervalRow[],
  options?: {
    variant?: "default" | "signed";
    teamValueKey?: string;
    oppValueKey?: string;
    valueKeys?: string[];
  },
): ChartMarkerPoint[] {
  const visible = new Set(chartData.map((row) => row.minute));
  const visibleEvents = events.filter((event) => visible.has(event.intervalLabel));
  const rowByMinute = new Map(chartData.map((row) => [row.minute, row]));
  const variant = options?.variant ?? "default";
  const teamValueKey = options?.teamValueKey ?? "teamTotal";
  const oppValueKey = options?.oppValueKey ?? "oppTotal";
  const valueKeys = options?.valueKeys ?? ["regains", "loses", "teamTotal", "oppTotal"];
  const defaultAnchor = computeChartIconAnchorY(
    chartData as Array<Record<string, number | string>>,
    valueKeys,
  ) * 0.92;

  return aggregateMarkerPoints(
    visibleEvents,
    (event) => {
      const row = rowByMinute.get(event.intervalLabel);
      if (variant === "signed" && row) {
        if (event.side === "team") {
          const height = Math.max(Number(row[teamValueKey]) || 0, 0.02);
          return height * 1.08;
        }
        const height = Math.max(Math.abs(Number(row[oppValueKey]) || 0), 0.02);
        return -height * 1.08;
      }
      return defaultAnchor;
    },
    (event) => event.intervalLabel,
  );
}

type CumulativeRow = {
  minute: number;
} & Record<string, number>;

function cumulativeValueAtMinute(
  rows: CumulativeRow[],
  minute: number,
  side: "team" | "opponent",
  teamValueKey: string,
  opponentValueKey: string,
): number {
  let best: CumulativeRow | undefined;
  for (const row of rows) {
    if (row.minute <= minute) best = row;
    else break;
  }
  if (!best && rows.length > 0) best = rows[0];
  if (!best) return 0.2;
  const value = side === "team" ? Number(best[teamValueKey]) : Number(best[opponentValueKey]);
  return Math.max(value, 0.05) * 1.08;
}

export function buildCumulativeMarkerPoints(
  events: ChartMatchEvent[],
  cumulativeData: CumulativeRow[],
  options?: {
    teamValueKey?: string;
    opponentValueKey?: string;
  },
): ChartMarkerPoint[] {
  if (cumulativeData.length === 0 || events.length === 0) return [];

  const teamValueKey = options?.teamValueKey ?? "teamXG";
  const opponentValueKey = options?.opponentValueKey ?? "opponentXG";

  return aggregateMarkerPoints(
    events,
    (event) => cumulativeValueAtMinute(
      cumulativeData,
      event.exactMinute,
      event.side,
      teamValueKey,
      opponentValueKey,
    ),
    (event) => event.exactMinute,
  );
}

export function groupChartMatchEvents(events: ChartMatchEvent[]): ChartIntervalMarkers[] {
  const byInterval = new Map<string, ChartIntervalMarkers>();

  const ensure = (intervalLabel: string): ChartIntervalMarkers => {
    const existing = byInterval.get(intervalLabel);
    if (existing) return existing;
    const row: ChartIntervalMarkers = {
      intervalLabel,
      teamPkCount: 0,
      oppPkCount: 0,
      teamGoalMinutes: [],
      oppGoalMinutes: [],
    };
    byInterval.set(intervalLabel, row);
    return row;
  };

  for (const event of events) {
    const row = ensure(event.intervalLabel);
    if (event.type === "pk") {
      if (event.side === "team") row.teamPkCount += 1;
      else row.oppPkCount += 1;
      continue;
    }
    if (event.type !== "goal") continue;
    if (event.side === "team") row.teamGoalMinutes.push(event.exactMinute);
    else row.oppGoalMinutes.push(event.exactMinute);
  }

  for (const row of byInterval.values()) {
    row.teamGoalMinutes.sort((a, b) => a - b);
    row.oppGoalMinutes.sort((a, b) => a - b);
  }

  return [...byInterval.values()].sort((a, b) => {
    const aStart = Number(a.intervalLabel.split("-")[0]) || 0;
    const bStart = Number(b.intervalLabel.split("-")[0]) || 0;
    return aStart - bStart;
  });
}
