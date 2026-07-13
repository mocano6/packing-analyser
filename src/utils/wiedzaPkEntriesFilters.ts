import { PKEntry } from "@/types";
import { isPkDribbleEntry, isPkPassEntry, isPkSfgEntry } from "@/lib/pkEntryKpiBreakdown";

/** Typ wejścia — jeden wybór (jak „Akcja” przy strzałach). */
export type WiedzaPkEntryTypeFilter = "all" | "pass" | "dribble" | "sfg" | "regain";

/** Skutek po wejściu — osobna grupa (np. SFG + Gol). */
export type WiedzaPkOutcomeFilter = "all" | "regain" | "shot" | "goal";

export type WiedzaPkEntriesFilterState = {
  entryType: WiedzaPkEntryTypeFilter;
  outcome: WiedzaPkOutcomeFilter;
};

export const DEFAULT_WIEDZA_PK_ENTRIES_FILTERS: WiedzaPkEntriesFilterState = {
  entryType: "all",
  outcome: "all",
};

export const WIEDZA_PK_ENTRY_TYPE_OPTIONS: { value: WiedzaPkEntryTypeFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "pass", label: "Podanie" },
  { value: "dribble", label: "Drybling" },
  { value: "sfg", label: "SFG" },
  { value: "regain", label: "Regain" },
];

export const WIEDZA_PK_OUTCOME_OPTIONS: { value: WiedzaPkOutcomeFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "regain", label: "Po regainie" },
  { value: "shot", label: "Strzał" },
  { value: "goal", label: "Gol" },
];

function matchesEntryType(entry: PKEntry, entryType: WiedzaPkEntryTypeFilter): boolean {
  if (entryType === "all") return true;
  if (entryType === "sfg") return isPkSfgEntry(entry);
  if (entryType === "dribble") return isPkDribbleEntry(entry);
  if (entryType === "pass") return isPkPassEntry(entry);
  if (entryType === "regain") return (entry.entryType || "pass") === "regain";
  return true;
}

function matchesOutcome(entry: PKEntry, outcome: WiedzaPkOutcomeFilter): boolean {
  if (outcome === "all") return true;
  if (outcome === "goal") return Boolean(entry.isGoal);
  if (outcome === "shot") return Boolean(entry.isShot);
  if (outcome === "regain") return Boolean(entry.isRegain);
  return true;
}

/** Filtr wejść PK — typ AND skutek (jak w zakładce Strzały). */
export function filterPkEntriesForWiedzaTab(
  entries: PKEntry[],
  filters: WiedzaPkEntriesFilterState,
): PKEntry[] {
  return entries.filter((entry) => {
    if (!matchesEntryType(entry, filters.entryType)) return false;
    if (!matchesOutcome(entry, filters.outcome)) return false;
    return true;
  });
}
