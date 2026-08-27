import {
  PLAYER_COMPARISON_FAMILY_OPTIONS,
  supportsComparisonMetricDribbleRole,
  supportsComparisonMetricRole,
  type PlayerComparisonMetricFamily,
  type PlayerComparisonMetricId,
  type PlayerComparisonMetricRole,
  type PlayerComparisonMode,
} from "./playerComparisonMetrics";

export const PLAYER_COMPARISON_PREFERENCES_STORAGE_KEY = "playerComparison_preferences_v1";

export type PlayerComparisonPreferences = {
  selectedTeamIds: string[];
  birthYearFrom: string;
  birthYearTo: string;
  mode: PlayerComparisonMode;
  comparisonMetricFamily: PlayerComparisonMetricFamily;
  comparisonMetricRole: PlayerComparisonMetricRole;
  /** Minimalna liczba minut (surowy string z inputa, pusty = 0). */
  minMinutes: string;
  /** Minimalna liczba rozegranych meczów (pusty = 0). */
  minMatches: string;
  /** Pusty = wszystkie pozycje. */
  selectedPositions: string[];
};

const DEFAULT_PREFERENCES: PlayerComparisonPreferences = {
  selectedTeamIds: [],
  birthYearFrom: "",
  birthYearTo: "",
  mode: "per90",
  comparisonMetricFamily: "pxt",
  comparisonMetricRole: "sender",
  minMinutes: "",
  minMatches: "",
  selectedPositions: [],
};

const FAMILY_IDS = new Set(PLAYER_COMPARISON_FAMILY_OPTIONS.map((item) => item.id));

const LEGACY_METRIC_TO_PREF: Partial<
  Record<PlayerComparisonMetricId, { family: PlayerComparisonMetricFamily; role: PlayerComparisonMetricRole }>
> = {
  packing: { family: "packing", role: "sender" },
  pxt: { family: "pxt", role: "sender" },
  pxtSender: { family: "pxt", role: "sender" },
  pxtReceiver: { family: "pxt", role: "receiver" },
  pxtDribble: { family: "pxt", role: "dribble" },
  xt: { family: "xt", role: "sender" },
  xtSender: { family: "xt", role: "sender" },
  xtReceiver: { family: "xt", role: "receiver" },
  xtDribble: { family: "xt", role: "dribble" },
  xg: { family: "xg", role: "sender" },
  pkEntries: { family: "pkEntries", role: "sender" },
  pkEntriesSender: { family: "pkEntries", role: "sender" },
  pkEntriesReceiver: { family: "pkEntries", role: "receiver" },
  pkEntriesDribble: { family: "pkEntries", role: "dribble" },
  xgOnPitchAttack: { family: "xgOnPitchAttack", role: "sender" },
  xgOnPitchDefense: { family: "xgOnPitchDefense", role: "sender" },
  pkEntriesOnPitchAttack: { family: "pkEntriesOnPitchAttack", role: "sender" },
  pkEntriesOnPitchDefense: { family: "pkEntriesOnPitchDefense", role: "sender" },
  phaseP1Sender: { family: "phaseP1", role: "sender" },
  phaseP1Receiver: { family: "phaseP1", role: "receiver" },
  phaseP1Dribble: { family: "phaseP1", role: "dribble" },
  phaseP2Sender: { family: "phaseP2", role: "sender" },
  phaseP2Receiver: { family: "phaseP2", role: "receiver" },
  phaseP2Dribble: { family: "phaseP2", role: "dribble" },
  phaseP3Sender: { family: "phaseP3", role: "sender" },
  phaseP3Receiver: { family: "phaseP3", role: "receiver" },
  phaseP3Dribble: { family: "phaseP3", role: "dribble" },
  regains: { family: "regains", role: "sender" },
  regainsOwnHalf: { family: "regainsOwnHalf", role: "sender" },
  regainsOpponentHalf: { family: "regainsOpponentHalf", role: "sender" },
  regainsXt: { family: "regainsXt", role: "sender" },
  regainsXtAttack: { family: "regainsXtAttack", role: "sender" },
  regainsXtDefense: { family: "regainsXtDefense", role: "sender" },
  loses: { family: "loses", role: "sender" },
  losesOwnHalf: { family: "losesOwnHalf", role: "sender" },
  losesOpponentHalf: { family: "losesOpponentHalf", role: "sender" },
  losesXt: { family: "losesXt", role: "sender" },
  losesXtAttack: { family: "losesXtAttack", role: "sender" },
  losesXtDefense: { family: "losesXtDefense", role: "sender" },
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string => (typeof value === "string" ? value : "");

function readMetricRole(value: unknown): PlayerComparisonMetricRole | null {
  if (value === "sender" || value === "receiver" || value === "dribble") return value;
  return null;
}

function normalizeFamilyRole(
  family: PlayerComparisonMetricFamily,
  role: PlayerComparisonMetricRole,
): { family: PlayerComparisonMetricFamily; role: PlayerComparisonMetricRole } {
  if (!supportsComparisonMetricRole(family)) {
    return { family, role: "sender" };
  }
  if (!supportsComparisonMetricDribbleRole(family) && role === "dribble") {
    return { family, role: "sender" };
  }
  return { family, role };
}

export function parsePlayerComparisonPreferences(raw: string | null): PlayerComparisonPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return { ...DEFAULT_PREFERENCES };

    const mode = parsed.mode === "sum" || parsed.mode === "per90" ? parsed.mode : DEFAULT_PREFERENCES.mode;

    let family: PlayerComparisonMetricFamily = DEFAULT_PREFERENCES.comparisonMetricFamily;
    let role: PlayerComparisonMetricRole = DEFAULT_PREFERENCES.comparisonMetricRole;

    const rawFamily = parsed.comparisonMetricFamily;
    if (typeof rawFamily === "string" && FAMILY_IDS.has(rawFamily as PlayerComparisonMetricFamily)) {
      family = rawFamily as PlayerComparisonMetricFamily;
      const rr = readMetricRole(parsed.comparisonMetricRole);
      role = rr ?? "sender";
    } else {
      const legacyId = parsed.selectedMetricId as PlayerComparisonMetricId | undefined;
      if (typeof legacyId === "string" && LEGACY_METRIC_TO_PREF[legacyId]) {
        const migrated = LEGACY_METRIC_TO_PREF[legacyId]!;
        family = migrated.family;
        role = migrated.role;
      }
    }

    const normalized = normalizeFamilyRole(family, role);

    return {
      selectedTeamIds: Array.isArray(parsed.selectedTeamIds)
        ? parsed.selectedTeamIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [],
      birthYearFrom: readString(parsed.birthYearFrom),
      birthYearTo: readString(parsed.birthYearTo),
      mode,
      comparisonMetricFamily: normalized.family,
      comparisonMetricRole: normalized.role,
      minMinutes: readString(parsed.minMinutes),
      minMatches: readString(parsed.minMatches),
      selectedPositions: Array.isArray(parsed.selectedPositions)
        ? parsed.selectedPositions.filter((p): p is string => typeof p === "string" && p.length > 0)
        : [],
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function serializePlayerComparisonPreferences(preferences: PlayerComparisonPreferences): string {
  return JSON.stringify({
    selectedTeamIds: preferences.selectedTeamIds,
    birthYearFrom: preferences.birthYearFrom,
    birthYearTo: preferences.birthYearTo,
    mode: preferences.mode,
    comparisonMetricFamily: preferences.comparisonMetricFamily,
    comparisonMetricRole: preferences.comparisonMetricRole,
    minMinutes: preferences.minMinutes,
    minMatches: preferences.minMatches,
    selectedPositions: preferences.selectedPositions,
  });
}
