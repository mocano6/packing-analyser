import { PKEntry } from "@/types";
import {
  isPkDribbleEntry,
  isPkPassEntry,
  isPkSfgEntry,
} from "@/lib/pkEntryKpiBreakdown";

export type WiedzaPkEntryTypeKey = "pass" | "dribble" | "sfg" | "regain" | "other";

export type WiedzaPkOutcomeKey = "goal" | "shot" | "regain" | "none";

export type WiedzaPkBreakdownRow = {
  key: string;
  label: string;
  count: number;
  pct: number;
  shots: number;
  goals: number;
  regains: number;
  shotPct: number;
  goalFromShotPct: number;
};

export type WiedzaPkEntriesSummary = {
  totalEntries: number;
  shots: number;
  goals: number;
  regains: number;
  shotPct: number;
  goalFromShotPct: number;
  regainPct: number;
  avgPartners: number;
  avgOpponents: number;
  avgDiffOppMinusPartners: number;
  byEntryType: WiedzaPkBreakdownRow[];
  byOutcome: WiedzaPkBreakdownRow[];
};

const ENTRY_TYPE_LABELS: Record<WiedzaPkEntryTypeKey, string> = {
  pass: "Podanie",
  dribble: "Drybling",
  sfg: "SFG",
  regain: "Regain",
  other: "Inne",
};

const OUTCOME_LABELS: Record<WiedzaPkOutcomeKey, string> = {
  goal: "Gol",
  shot: "Strzał (bez gola)",
  regain: "Po regainie",
  none: "Bez strzału",
};

export function classifyWiedzaPkEntryType(entry: PKEntry): WiedzaPkEntryTypeKey {
  if (isPkSfgEntry(entry)) return "sfg";
  if (isPkDribbleEntry(entry)) return "dribble";
  if (isPkPassEntry(entry)) return "pass";
  if ((entry.entryType || "pass") === "regain") return "regain";
  return "other";
}

export function classifyWiedzaPkOutcome(entry: PKEntry): WiedzaPkOutcomeKey {
  if (entry.isGoal) return "goal";
  if (entry.isShot) return "shot";
  if (entry.isRegain) return "regain";
  return "none";
}

function aggregateRows(
  entries: PKEntry[],
  keys: string[],
  labelFor: (key: string) => string,
  classify: (entry: PKEntry) => string,
): WiedzaPkBreakdownRow[] {
  const total = entries.length;
  const buckets = new Map<string, PKEntry[]>();

  for (const key of keys) {
    buckets.set(key, []);
  }

  for (const entry of entries) {
    const key = classify(entry);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(entry);
  }

  return keys
    .map((key) => {
      const group = buckets.get(key) ?? [];
      const count = group.length;
      const shots = group.filter((e) => e.isShot).length;
      const goals = group.filter((e) => e.isGoal).length;
      const regains = group.filter((e) => e.isRegain).length;
      return {
        key,
        label: labelFor(key),
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
        shots,
        goals,
        regains,
        shotPct: count > 0 ? (shots / count) * 100 : 0,
        goalFromShotPct: shots > 0 ? (goals / shots) * 100 : 0,
      };
    })
    .filter((row) => row.count > 0);
}

export function buildWiedzaPkEntriesSummary(entries: PKEntry[]): WiedzaPkEntriesSummary {
  const totalEntries = entries.length;
  const shots = entries.filter((e) => e.isShot).length;
  const goals = entries.filter((e) => e.isGoal).length;
  const regains = entries.filter((e) => e.isRegain).length;

  const partnersSum = entries.reduce((s, e) => s + (e.pkPlayersCount ?? 0), 0);
  const oppSum = entries.reduce((s, e) => s + (e.opponentsInPKCount ?? 0), 0);
  const avgPartners = totalEntries > 0 ? partnersSum / totalEntries : 0;
  const avgOpponents = totalEntries > 0 ? oppSum / totalEntries : 0;

  const entryTypeKeys: WiedzaPkEntryTypeKey[] = ["pass", "dribble", "sfg", "regain", "other"];
  const outcomeKeys: WiedzaPkOutcomeKey[] = ["goal", "shot", "regain", "none"];

  return {
    totalEntries,
    shots,
    goals,
    regains,
    shotPct: totalEntries > 0 ? (shots / totalEntries) * 100 : 0,
    goalFromShotPct: shots > 0 ? (goals / shots) * 100 : 0,
    regainPct: totalEntries > 0 ? (regains / totalEntries) * 100 : 0,
    avgPartners,
    avgOpponents,
    avgDiffOppMinusPartners: avgOpponents - avgPartners,
    byEntryType: aggregateRows(
      entries,
      entryTypeKeys,
      (key) => ENTRY_TYPE_LABELS[key as WiedzaPkEntryTypeKey],
      classifyWiedzaPkEntryType,
    ),
    byOutcome: aggregateRows(
      entries,
      outcomeKeys,
      (key) => OUTCOME_LABELS[key as WiedzaPkOutcomeKey],
      classifyWiedzaPkOutcome,
    ),
  };
}
