import type { Action } from "@/types";

export type PxtPackingFilterKey =
  | "p0"
  | "p1"
  | "p2"
  | "p3"
  | "p0start"
  | "p1start"
  | "p2start"
  | "p3start"
  | "pk"
  | "shot"
  | "goal";

export type PxtActionTypeFilter = "all" | "pass" | "dribble";

export type PxtPackingFilterState = {
  actionType: PxtActionTypeFilter;
  packingFilters: PxtPackingFilterKey[];
};

export const DEFAULT_PXT_PACKING_FILTERS: PxtPackingFilterState = {
  actionType: "all",
  packingFilters: [],
};

export function getPackingActionTypeKey(action: Action): "pass" | "dribble" | "other" {
  const at = action.actionType ?? (action as { type?: string }).type ?? "";
  if (at === "pass" || at === "podanie") return "pass";
  if (at === "dribble" || at === "drybling") return "dribble";
  return "other";
}

export function matchesPackingActionType(action: Action, actionType: PxtActionTypeFilter): boolean {
  if (actionType === "all") return true;
  const key = getPackingActionTypeKey(action);
  if (actionType === "pass") return key === "pass";
  if (actionType === "dribble") return key === "dribble";
  return true;
}

export function matchesPackingOutcomeFilter(action: Action, filters: PxtPackingFilterKey[]): boolean {
  if (filters.length === 0) return true;

  const startFilters = filters.filter((f) => ["p0start", "p1start", "p2start", "p3start"].includes(f));
  const endFilters = filters.filter((f) => ["p0", "p1", "p2", "p3", "pk", "shot", "goal"].includes(f));

  let matchesStart = startFilters.length === 0;
  let matchesEnd = endFilters.length === 0;

  if (startFilters.length > 0) {
    matchesStart = startFilters.some((filter) => {
      if (filter === "p0start") return Boolean(action.isP0Start);
      if (filter === "p1start") return Boolean(action.isP1Start);
      if (filter === "p2start") return Boolean(action.isP2Start);
      if (filter === "p3start") return Boolean(action.isP3Start);
      return false;
    });
  }

  if (endFilters.length > 0) {
    matchesEnd = endFilters.some((filter) => {
      if (filter === "p0") return Boolean(action.isP0);
      if (filter === "p1") return Boolean(action.isP1);
      if (filter === "p2") return Boolean(action.isP2);
      if (filter === "p3") return Boolean(action.isP3);
      if (filter === "pk") return Boolean(action.isPenaltyAreaEntry);
      if (filter === "shot") return Boolean(action.isShot);
      if (filter === "goal") return Boolean(action.isGoal);
      return false;
    });
  }

  return matchesStart && matchesEnd;
}

export function filterPackingActionsForTab(
  actions: Action[],
  filters: PxtPackingFilterState,
): Action[] {
  return actions.filter((action) => {
    if (action.mode === "defense") return false;
    if (!matchesPackingActionType(action, filters.actionType)) return false;
    if (!matchesPackingOutcomeFilter(action, filters.packingFilters)) return false;
    return true;
  });
}
