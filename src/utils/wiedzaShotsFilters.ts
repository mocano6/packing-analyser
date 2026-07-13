import { Shot } from "@/types";
import { isSfgCategoryShot } from "./matchXgSplits";
import {
  getShotXgForMapFilter,
  shotMatchesTrendyXgRange,
  TrendyXgMapBodyPartFilter,
} from "./trendyMapFilters";

/** Rodzaj akcji — jeden wybór (niezależny od wyniku strzału). */
export type WiedzaShotActionCategoryFilter = "all" | "sfg" | "counter" | "regain" | "open_play";

/** Wynik strzału — osobna grupa, łączy się z akcją (np. SFG + Gol). */
export type WiedzaShotOutcomeFilter = "all" | "goal" | "on_target" | "off_target" | "blocked";

/** Podtyp SFG — widoczny po wyborze kategorii SFG. */
export type WiedzaSfgTypeFilter =
  | "all"
  | "corner"
  | "free_kick"
  | "direct_free_kick"
  | "penalty"
  | "throw_in";

/** Bezpośredni (B) vs kombinacyjny (K) — jak w analizatorze. */
export type WiedzaSfgSubtypeFilter = "all" | "direct" | "combination";

/** Faza SFG — I / II faza (jak w modalu xG). */
export type WiedzaSfgPhaseFilter = "all" | "phase1" | "phase2";

export type WiedzaShotsFilterState = {
  bodyPart: TrendyXgMapBodyPartFilter;
  actionCategory: WiedzaShotActionCategoryFilter;
  outcome: WiedzaShotOutcomeFilter;
  sfgType: WiedzaSfgTypeFilter;
  sfgSubtype: WiedzaSfgSubtypeFilter;
  sfgPhase: WiedzaSfgPhaseFilter;
  xgMin: number | null;
  xgMax: number | null;
};

export const DEFAULT_WIEDZA_SHOTS_FILTERS: WiedzaShotsFilterState = {
  bodyPart: "all",
  actionCategory: "all",
  outcome: "all",
  sfgType: "all",
  sfgSubtype: "all",
  sfgPhase: "all",
  xgMin: null,
  xgMax: null,
};

export const WIEDZA_SHOT_ACTION_CATEGORY_OPTIONS: {
  value: WiedzaShotActionCategoryFilter;
  label: string;
}[] = [
  { value: "all", label: "Wszystkie" },
  { value: "sfg", label: "SFG" },
  { value: "counter", label: "Kontra" },
  { value: "regain", label: "Regain" },
  { value: "open_play", label: "Otwarta gra" },
];

export const WIEDZA_SHOT_OUTCOME_OPTIONS: { value: WiedzaShotOutcomeFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "goal", label: "Gol" },
  { value: "on_target", label: "Celne" },
  { value: "off_target", label: "Niecelne" },
  { value: "blocked", label: "Zablokowane" },
];

export const WIEDZA_SFG_TYPE_OPTIONS: { value: WiedzaSfgTypeFilter; label: string }[] = [
  { value: "all", label: "Wszystkie SFG" },
  { value: "corner", label: "Rożny" },
  { value: "free_kick", label: "Wolny" },
  { value: "direct_free_kick", label: "Bezpośredni wolny" },
  { value: "penalty", label: "Karny" },
  { value: "throw_in", label: "Rzut za autu" },
];

export const WIEDZA_SFG_SUBTYPE_OPTIONS: { value: WiedzaSfgSubtypeFilter; label: string }[] = [
  { value: "all", label: "Wszystkie" },
  { value: "direct", label: "Bezpośredni (B)" },
  { value: "combination", label: "Kombinacyjny (K)" },
];

export const WIEDZA_SFG_PHASE_OPTIONS: { value: WiedzaSfgPhaseFilter; label: string }[] = [
  { value: "all", label: "Wszystkie fazy" },
  { value: "phase1", label: "I faza" },
  { value: "phase2", label: "II faza" },
];

function matchesBodyPart(shot: Shot, bodyPart: TrendyXgMapBodyPartFilter): boolean {
  if (bodyPart === "all") return true;
  const shotBodyPart = shot.bodyPart;
  if (bodyPart === "foot") {
    return shotBodyPart === "foot" || shotBodyPart === "foot_left" || shotBodyPart === "foot_right";
  }
  return shotBodyPart === bodyPart;
}

function matchesSfgSubtype(shot: Shot, subtype: WiedzaSfgSubtypeFilter): boolean {
  if (subtype === "all") return true;
  if (shot.actionType === "penalty") return true;
  return shot.sfgSubtype === subtype;
}

function matchesSfgPhase(shot: Shot, phase: WiedzaSfgPhaseFilter): boolean {
  if (phase === "all") return true;
  if (shot.actionType === "penalty") return false;
  return shot.actionPhase === phase;
}

function matchesSfgType(shot: Shot, sfgType: WiedzaSfgTypeFilter): boolean {
  if (!isSfgCategoryShot(shot)) return false;
  if (sfgType === "all") return true;
  return shot.actionType === sfgType;
}

function matchesActionCategory(shot: Shot, category: WiedzaShotActionCategoryFilter): boolean {
  if (category === "all") return true;
  if (category === "sfg") return isSfgCategoryShot(shot);
  if (category === "counter") return shot.actionType === "counter";
  if (category === "regain") return shot.actionType === "regain";
  if (category === "open_play") {
    return (
      !isSfgCategoryShot(shot) &&
      shot.actionType !== "counter" &&
      shot.actionType !== "regain"
    );
  }
  return true;
}

function matchesOutcome(shot: Shot, outcome: WiedzaShotOutcomeFilter): boolean {
  if (outcome === "all") return true;
  if (outcome === "goal") return Boolean(shot.isGoal || shot.shotType === "goal");
  if (outcome === "blocked") return shot.shotType === "blocked";
  if (outcome === "on_target") return shot.shotType === "on_target" || shot.shotType === "goal";
  if (outcome === "off_target") return shot.shotType === "off_target";
  return true;
}

/** Filtr strzałów — akcja AND wynik AND (opcjonalnie) podtypy SFG. */
export function filterShotsForWiedzaTab(shots: Shot[], filters: WiedzaShotsFilterState): Shot[] {
  return shots.filter((shot) => {
    if (!shotMatchesTrendyXgRange(shot, filters.xgMin, filters.xgMax)) return false;
    if (!matchesBodyPart(shot, filters.bodyPart)) return false;
    if (!matchesActionCategory(shot, filters.actionCategory)) return false;
    if (!matchesOutcome(shot, filters.outcome)) return false;
    if (filters.actionCategory === "sfg") {
      if (!matchesSfgType(shot, filters.sfgType)) return false;
      if (!matchesSfgSubtype(shot, filters.sfgSubtype)) return false;
      if (!matchesSfgPhase(shot, filters.sfgPhase)) return false;
    }
    return true;
  });
}

/** Przy zmianie akcji poza SFG — reset podfiltrów SFG. */
export function withWiedzaShotActionCategory(
  prev: WiedzaShotsFilterState,
  actionCategory: WiedzaShotActionCategoryFilter,
): WiedzaShotsFilterState {
  if (actionCategory === prev.actionCategory) return prev;
  if (actionCategory === "sfg") {
    return { ...prev, actionCategory };
  }
  return {
    ...prev,
    actionCategory,
    sfgType: "all",
    sfgSubtype: "all",
    sfgPhase: "all",
  };
}

export function summarizeWiedzaShotsXg(shots: Shot[]): { count: number; totalXg: number } {
  let totalXg = 0;
  for (const shot of shots) {
    totalXg += getShotXgForMapFilter(shot);
  }
  return { count: shots.length, totalXg };
}
