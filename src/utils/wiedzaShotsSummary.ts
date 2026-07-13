import { Shot } from "@/types";
import { getShotXgForMapFilter } from "./trendyMapFilters";
import { isSfgCategoryShot } from "./matchXgSplits";

export type WiedzaShotActionCategory = "sfg" | "counter" | "regain" | "open_play";

export type WiedzaShotTypeKey = Shot["shotType"];

export type WiedzaShotBodyPartKey = "foot" | "foot_left" | "foot_right" | "head" | "other" | "unknown";

export type WiedzaXgBucketKey = "0-0.05" | "0.05-0.1" | "0.1-0.2" | "0.2-0.35" | "0.35+";

export type WiedzaShotBreakdownRow = {
  key: string;
  label: string;
  count: number;
  pct: number;
  xg: number;
  avgXg: number;
  goals: number;
  conversionPct: number;
};

export type WiedzaShotsSummary = {
  totalShots: number;
  totalXg: number;
  goals: number;
  avgXg: number;
  conversionPct: number;
  onTargetPct: number;
  blockedPct: number;
  offTargetPct: number;
  byActionCategory: WiedzaShotBreakdownRow[];
  byShotType: WiedzaShotBreakdownRow[];
  byBodyPart: WiedzaShotBreakdownRow[];
  byXgBucket: WiedzaShotBreakdownRow[];
};

const ACTION_CATEGORY_LABELS: Record<WiedzaShotActionCategory, string> = {
  sfg: "SFG",
  counter: "Kontra",
  regain: "Regain",
  open_play: "Otwarta gra",
};

const SHOT_TYPE_LABELS: Record<WiedzaShotTypeKey, string> = {
  goal: "Gol",
  on_target: "Celny",
  off_target: "Niecelny",
  blocked: "Zablokowany",
};

const BODY_PART_LABELS: Record<WiedzaShotBodyPartKey, string> = {
  foot: "Noga",
  foot_left: "Lewa noga",
  foot_right: "Prawa noga",
  head: "Głowa",
  other: "Inne",
  unknown: "Nieznane",
};

const XG_BUCKET_LABELS: Record<WiedzaXgBucketKey, string> = {
  "0-0.05": "0–0,05",
  "0.05-0.1": "0,05–0,10",
  "0.1-0.2": "0,10–0,20",
  "0.2-0.35": "0,20–0,35",
  "0.35+": "0,35+",
};

export function classifyWiedzaShotActionCategory(shot: Shot): WiedzaShotActionCategory {
  if (isSfgCategoryShot(shot)) return "sfg";
  if (shot.actionType === "counter") return "counter";
  if (shot.actionType === "regain") return "regain";
  return "open_play";
}

export function classifyWiedzaShotBodyPart(shot: Shot): WiedzaShotBodyPartKey {
  const bp = shot.bodyPart;
  if (bp === "foot" || bp === "foot_left" || bp === "foot_right" || bp === "head" || bp === "other") {
    return bp;
  }
  return "unknown";
}

export function classifyWiedzaXgBucket(xg: number): WiedzaXgBucketKey {
  if (xg < 0.05) return "0-0.05";
  if (xg < 0.1) return "0.05-0.1";
  if (xg < 0.2) return "0.1-0.2";
  if (xg < 0.35) return "0.2-0.35";
  return "0.35+";
}

function isGoalShot(shot: Shot): boolean {
  return Boolean(shot.isGoal || shot.shotType === "goal");
}

function isOnTargetShot(shot: Shot): boolean {
  return shot.shotType === "on_target" || shot.shotType === "goal" || isGoalShot(shot);
}

type MutableAgg = {
  count: number;
  xg: number;
  goals: number;
};

function bumpAgg(map: Map<string, MutableAgg>, key: string, xg: number, goals: number): void {
  const prev = map.get(key) ?? { count: 0, xg: 0, goals: 0 };
  prev.count += 1;
  prev.xg += xg;
  prev.goals += goals ? 1 : 0;
  map.set(key, prev);
}

function rowsFromAgg(
  map: Map<string, MutableAgg>,
  labels: Record<string, string>,
  order: string[],
  total: number,
): WiedzaShotBreakdownRow[] {
  return order
    .map((key) => {
      const agg = map.get(key) ?? { count: 0, xg: 0, goals: 0 };
      const count = agg.count;
      const pct = total > 0 ? (count / total) * 100 : 0;
      const avgXg = count > 0 ? agg.xg / count : 0;
      const conversionPct = count > 0 ? (agg.goals / count) * 100 : 0;
      return {
        key,
        label: labels[key] ?? key,
        count,
        pct,
        xg: agg.xg,
        avgXg,
        goals: agg.goals,
        conversionPct,
      };
    })
    .filter((row) => row.count > 0 || order.includes(row.key));
}

/** Agregacja strzałów po filtrach mapy — udziały % liczone względem widocznej próby. */
export function buildWiedzaShotsSummary(shots: Shot[]): WiedzaShotsSummary {
  const totalShots = shots.length;
  let totalXg = 0;
  let goals = 0;
  let onTarget = 0;
  let blocked = 0;
  let offTarget = 0;

  const byAction = new Map<string, MutableAgg>();
  const byType = new Map<string, MutableAgg>();
  const byBody = new Map<string, MutableAgg>();
  const byBucket = new Map<string, MutableAgg>();

  for (const shot of shots) {
    const xg = getShotXgForMapFilter(shot);
    const goal = isGoalShot(shot);
    totalXg += xg;
    if (goal) goals += 1;
    if (isOnTargetShot(shot)) onTarget += 1;
    if (shot.shotType === "blocked") blocked += 1;
    if (shot.shotType === "off_target") offTarget += 1;

    bumpAgg(byAction, classifyWiedzaShotActionCategory(shot), xg, goal ? 1 : 0);
    bumpAgg(byType, shot.shotType, xg, goal ? 1 : 0);
    bumpAgg(byBody, classifyWiedzaShotBodyPart(shot), xg, goal ? 1 : 0);
    bumpAgg(byBucket, classifyWiedzaXgBucket(xg), xg, goal ? 1 : 0);
  }

  const pct = (n: number) => (totalShots > 0 ? (n / totalShots) * 100 : 0);

  return {
    totalShots,
    totalXg,
    goals,
    avgXg: totalShots > 0 ? totalXg / totalShots : 0,
    conversionPct: pct(goals),
    onTargetPct: pct(onTarget),
    blockedPct: pct(blocked),
    offTargetPct: pct(offTarget),
    byActionCategory: rowsFromAgg(
      byAction,
      ACTION_CATEGORY_LABELS,
      ["open_play", "counter", "regain", "sfg"],
      totalShots,
    ).filter((row) => row.count > 0),
    byShotType: rowsFromAgg(
      byType,
      SHOT_TYPE_LABELS,
      ["goal", "on_target", "off_target", "blocked"],
      totalShots,
    ).filter((row) => row.count > 0),
    byBodyPart: rowsFromAgg(
      byBody,
      BODY_PART_LABELS,
      ["foot", "foot_left", "foot_right", "head", "other", "unknown"],
      totalShots,
    ).filter((row) => row.count > 0),
    byXgBucket: rowsFromAgg(
      byBucket,
      XG_BUCKET_LABELS,
      ["0-0.05", "0.05-0.1", "0.1-0.2", "0.2-0.35", "0.35+"],
      totalShots,
    ).filter((row) => row.count > 0),
  };
}
