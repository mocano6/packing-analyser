import type { Action, PKEntry, Player, PlayerMinutes, Shot, TeamInfo } from "@/types";
import { packingActionMetrics } from "./wiedzaPackingZoneFlow";

export type PlayerComparisonMode = "sum" | "per90";

export type PlayerComparisonMetricId =
  | "packing"
  | "pxt"
  | "pxtSender"
  | "pxtReceiver"
  | "pxtDribble"
  | "xt"
  | "xtSender"
  | "xtReceiver"
  | "xtDribble"
  | "xg"
  | "shots"
  | "goals"
  | "xgPerShot"
  | "shotsPerGoal"
  | "xgPerGoal"
  | "pkEntries"
  | "pkEntriesSender"
  | "pkEntriesReceiver"
  | "pkEntriesDribble"
  | "regains"
  | "regainsXt"
  | "loses"
  | "losesXt";

/** Metryki widoczne w jednym wyborze (ranking) — rola wybierana osobno tam, gdzie ma sens. */
export type PlayerComparisonMetricFamily =
  | "packing"
  | "pxt"
  | "xt"
  | "xg"
  | "shots"
  | "goals"
  | "xgPerShot"
  | "shotsPerGoal"
  | "xgPerGoal"
  | "pkEntries"
  | "regains"
  | "regainsXt"
  | "loses"
  | "losesXt";

export type PlayerComparisonMetricRole = "sender" | "receiver" | "dribble";

export const PLAYER_COMPARISON_FAMILY_OPTIONS: { id: PlayerComparisonMetricFamily; label: string }[] = [
  { id: "packing", label: "Packing" },
  { id: "pxt", label: "PXT" },
  { id: "xt", label: "xT" },
  { id: "xg", label: "xG" },
  { id: "shots", label: "Liczba strzałów" },
  { id: "goals", label: "Liczba goli" },
  { id: "xgPerShot", label: "xG / strzał" },
  { id: "shotsPerGoal", label: "Strzały / gol" },
  { id: "xgPerGoal", label: "xG / gol" },
  { id: "pkEntries", label: "Wejścia w pole karne" },
  { id: "regains", label: "Przechwyty" },
  { id: "regainsXt", label: "xT przechwytów" },
  { id: "loses", label: "Straty" },
  { id: "losesXt", label: "xT strat" },
];

/** Oś spider / karty liderów — bez podziału ról (jedna seria na zagadnienie). */
export const PLAYER_COMPARISON_AXIS_METRIC_IDS: readonly PlayerComparisonMetricFamily[] = [
  "packing",
  "pxt",
  "xt",
  "xg",
  "shots",
  "goals",
  "xgPerShot",
  "shotsPerGoal",
  "xgPerGoal",
  "pkEntries",
  "regains",
  "regainsXt",
  "loses",
  "losesXt",
];

export function supportsComparisonMetricRole(family: PlayerComparisonMetricFamily): boolean {
  return family === "pxt" || family === "xt" || family === "pkEntries";
}

export function resolvePlayerComparisonMetricId(
  family: PlayerComparisonMetricFamily,
  role: PlayerComparisonMetricRole,
): PlayerComparisonMetricId {
  if (family === "pxt") {
    if (role === "sender") return "pxtSender";
    if (role === "receiver") return "pxtReceiver";
    return "pxtDribble";
  }
  if (family === "xt") {
    if (role === "sender") return "xtSender";
    if (role === "receiver") return "xtReceiver";
    return "xtDribble";
  }
  if (family === "pkEntries") {
    if (role === "sender") return "pkEntriesSender";
    if (role === "receiver") return "pkEntriesReceiver";
    return "pkEntriesDribble";
  }
  return family;
}

export type PlayerComparisonMetricDefinition = {
  id: PlayerComparisonMetricId;
  label: string;
  shortLabel: string;
  direction: "higher" | "lower";
  fractionDigits: number;
};

export const PLAYER_COMPARISON_METRICS: PlayerComparisonMetricDefinition[] = [
  { id: "packing", label: "Packing", shortLabel: "Packing", direction: "higher", fractionDigits: 1 },
  { id: "pxt", label: "PXT", shortLabel: "PXT", direction: "higher", fractionDigits: 2 },
  { id: "pxtSender", label: "PXT podający", shortLabel: "PXT pod.", direction: "higher", fractionDigits: 2 },
  { id: "pxtReceiver", label: "PXT przyjmujący", shortLabel: "PXT przyj.", direction: "higher", fractionDigits: 2 },
  { id: "pxtDribble", label: "PXT drybling", shortLabel: "PXT dr.", direction: "higher", fractionDigits: 2 },
  { id: "xt", label: "xT", shortLabel: "xT", direction: "higher", fractionDigits: 2 },
  { id: "xtSender", label: "xT podający", shortLabel: "xT pod.", direction: "higher", fractionDigits: 2 },
  { id: "xtReceiver", label: "xT przyjmujący", shortLabel: "xT przyj.", direction: "higher", fractionDigits: 2 },
  { id: "xtDribble", label: "xT drybling", shortLabel: "xT dr.", direction: "higher", fractionDigits: 2 },
  { id: "xg", label: "xG", shortLabel: "xG", direction: "higher", fractionDigits: 2 },
  { id: "shots", label: "Liczba strzałów", shortLabel: "Strzały", direction: "higher", fractionDigits: 0 },
  { id: "goals", label: "Liczba goli", shortLabel: "Gole", direction: "higher", fractionDigits: 0 },
  {
    id: "xgPerShot",
    label: "xG na strzał",
    shortLabel: "xG/str.",
    direction: "higher",
    fractionDigits: 3,
  },
  {
    id: "shotsPerGoal",
    label: "Strzały na gola",
    shortLabel: "Strz./gol",
    direction: "lower",
    fractionDigits: 2,
  },
  { id: "xgPerGoal", label: "xG na gola", shortLabel: "xG/gol", direction: "lower", fractionDigits: 2 },
  { id: "pkEntries", label: "Wejścia w pole karne", shortLabel: "PK", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesSender", label: "PK jako podający", shortLabel: "PK pod.", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesReceiver", label: "PK jako przyjmujący", shortLabel: "PK przyj.", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesDribble", label: "PK jako drybler", shortLabel: "PK dryb.", direction: "higher", fractionDigits: 1 },
  { id: "regains", label: "Przechwyty", shortLabel: "Przechwyty", direction: "higher", fractionDigits: 1 },
  { id: "regainsXt", label: "xT przechwytów", shortLabel: "xT przechw.", direction: "higher", fractionDigits: 2 },
  { id: "loses", label: "Straty", shortLabel: "Straty", direction: "lower", fractionDigits: 1 },
  { id: "losesXt", label: "xT strat", shortLabel: "xT strat", direction: "lower", fractionDigits: 2 },
];

export type PlayerComparisonRawMetrics = Record<PlayerComparisonMetricId, number>;

export type PlayerComparisonRow = {
  playerId: string;
  playerName: string;
  /** Do sortowania alfabetycznego (nazwisko → imię). */
  lastName: string;
  firstName: string;
  position: string;
  number: number;
  birthYear?: number;
  teamIds: string[];
  minutes: number;
  /** Liczba meczów z wpisanymi minutami &gt; 0 dla zawodnika (zakres załadowanych meczów). */
  matchesPlayed: number;
  raw: PlayerComparisonRawMetrics;
  values: PlayerComparisonRawMetrics;
  hasMinutes: boolean;
};

export type PlayerComparisonResult = {
  rows: PlayerComparisonRow[];
  mode: PlayerComparisonMode;
  usedPer90Fallback: boolean;
};

const emptyMetrics = (): PlayerComparisonRawMetrics => ({
  packing: 0,
  pxt: 0,
  pxtSender: 0,
  pxtReceiver: 0,
  pxtDribble: 0,
  xt: 0,
  xtSender: 0,
  xtReceiver: 0,
  xtDribble: 0,
  xg: 0,
  shots: 0,
  goals: 0,
  xgPerShot: 0,
  shotsPerGoal: 0,
  xgPerGoal: 0,
  pkEntries: 0,
  pkEntriesSender: 0,
  pkEntriesReceiver: 0,
  pkEntriesDribble: 0,
  regains: 0,
  regainsXt: 0,
  loses: 0,
  losesXt: 0,
});

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const playerDisplayName = (player: Player): string => {
  const ln = String(player.lastName ?? "").trim();
  const fn = String(player.firstName ?? "").trim();
  if (ln || fn) {
    return [ln, fn].filter(Boolean).join(" ");
  }
  const legacy = String(player.name ?? "").trim();
  if (legacy) return legacy;
  return player.id;
};

const addValue = (
  rowsByPlayerId: Map<string, PlayerComparisonRow>,
  playerId: string | undefined,
  metricId: PlayerComparisonMetricId,
  value: number,
): void => {
  const id = String(playerId ?? "").trim();
  if (!id || value === 0) return;
  const row = rowsByPlayerId.get(id);
  if (!row) return;
  row.raw[metricId] += value;
};

const addSplitValue = (
  rowsByPlayerId: Map<string, PlayerComparisonRow>,
  senderId: string | undefined,
  receiverId: string | undefined,
  metricId: PlayerComparisonMetricId,
  value: number,
): void => {
  if (value === 0) return;
  const sender = String(senderId ?? "").trim();
  const receiver = String(receiverId ?? "").trim();

  if (sender && receiver && sender !== receiver) {
    addValue(rowsByPlayerId, sender, metricId, value / 2);
    addValue(rowsByPlayerId, receiver, metricId, value / 2);
    return;
  }

  addValue(rowsByPlayerId, sender || receiver, metricId, value);
};

const isTeamAttackShot = (shot: Shot, match: TeamInfo): boolean =>
  shot.teamContext === "attack" && (!shot.teamId || shot.teamId === match.team);

const isTeamPKEntry = (entry: PKEntry, match: TeamInfo): boolean =>
  (entry.teamContext ?? "attack") === "attack" && (!entry.teamId || entry.teamId === match.team);

const isTeamAction = (action: Action, match: TeamInfo): boolean =>
  !action.teamId || action.teamId === match.team;

const isDribblePackingAction = (action: Action): boolean =>
  String(action.actionType ?? "").toLowerCase() === "dribble";

const getLosesXtValue = (action: Action): number => {
  const explicitThreat = toNumber(action.losesAttackXT);
  if (explicitThreat > 0) return explicitThreat;

  const endThreat = toNumber(action.xTValueEnd);
  if (endThreat > 0) return endThreat;

  const attack = toNumber(action.regainAttackXT ?? action.oppositeXT);
  const defense = toNumber(action.losesDefenseXT ?? action.regainDefenseXT);
  return Math.max(0, attack - defense);
};

const getRegainXtValue = (action: Action): number => {
  const attack = toNumber(action.regainAttackXT ?? action.oppositeXT);
  const defense = toNumber(action.regainDefenseXT);
  return Math.max(0, attack - defense);
};

const getMinutes = (minutes: PlayerMinutes[] | undefined, playerId: string): number =>
  (minutes ?? [])
    .filter((entry) => entry.playerId === playerId)
    .reduce((sum, entry) => sum + Math.max(0, toNumber(entry.endMinute) - toNumber(entry.startMinute)), 0);

const normalizeValues = (
  raw: PlayerComparisonRawMetrics,
  minutes: number,
  mode: PlayerComparisonMode,
): PlayerComparisonRawMetrics => {
  if (mode !== "per90" || minutes <= 0) {
    return {
      ...raw,
      xgPerShot: 0,
      shotsPerGoal: 0,
      xgPerGoal: 0,
    };
  }

  const factor = 90 / minutes;
  return {
    packing: raw.packing * factor,
    pxt: raw.pxt * factor,
    pxtSender: raw.pxtSender * factor,
    pxtReceiver: raw.pxtReceiver * factor,
    pxtDribble: raw.pxtDribble * factor,
    xt: raw.xt * factor,
    xtSender: raw.xtSender * factor,
    xtReceiver: raw.xtReceiver * factor,
    xtDribble: raw.xtDribble * factor,
    xg: raw.xg * factor,
    shots: raw.shots * factor,
    goals: raw.goals * factor,
    xgPerShot: 0,
    shotsPerGoal: 0,
    xgPerGoal: 0,
    pkEntries: raw.pkEntries * factor,
    pkEntriesSender: raw.pkEntriesSender * factor,
    pkEntriesReceiver: raw.pkEntriesReceiver * factor,
    pkEntriesDribble: raw.pkEntriesDribble * factor,
    regains: raw.regains * factor,
    regainsXt: raw.regainsXt * factor,
    loses: raw.loses * factor,
    losesXt: raw.losesXt * factor,
  };
};

const applyShootingDerivedValues = (values: PlayerComparisonRawMetrics): void => {
  const shots = values.shots;
  const goals = values.goals;
  const xg = values.xg;
  values.xgPerShot = shots > 0 ? xg / shots : 0;
  values.shotsPerGoal = goals > 0 ? shots / goals : Number.POSITIVE_INFINITY;
  values.xgPerGoal = goals > 0 ? xg / goals : Number.POSITIVE_INFINITY;
};

export function buildPlayerComparisonRows(
  players: Player[],
  matches: TeamInfo[],
  mode: PlayerComparisonMode,
): PlayerComparisonResult {
  const rowsByPlayerId = new Map<string, PlayerComparisonRow>();

  for (const player of players) {
    if (player.isDeleted === true) continue;
    rowsByPlayerId.set(player.id, {
      playerId: player.id,
      playerName: playerDisplayName(player),
      lastName: String(player.lastName ?? "").trim(),
      firstName: String(player.firstName ?? "").trim(),
      position: player.position || "-",
      number: player.number || 0,
      birthYear: player.birthYear,
      teamIds: Array.isArray(player.teams) ? player.teams : [],
      minutes: 0,
      matchesPlayed: 0,
      raw: emptyMetrics(),
      values: emptyMetrics(),
      hasMinutes: false,
    });
  }

  for (const match of matches) {
    for (const row of rowsByPlayerId.values()) {
      const m = getMinutes(match.playerMinutes, row.playerId);
      row.minutes += m;
      if (m > 0) {
        row.matchesPlayed += 1;
      }
    }

    for (const action of match.actions_packing ?? []) {
      if (!action || action.mode === "defense" || !isTeamAction(action, match)) continue;
      const metrics = packingActionMetrics(action);
      addSplitValue(rowsByPlayerId, action.senderId, action.receiverId, "packing", metrics.packPts);
      addSplitValue(rowsByPlayerId, action.senderId, action.receiverId, "pxt", metrics.pxt);
      addValue(rowsByPlayerId, action.senderId, "pxtSender", metrics.pxt);
      addValue(rowsByPlayerId, action.receiverId, "pxtReceiver", metrics.pxt);
      addSplitValue(rowsByPlayerId, action.senderId, action.receiverId, "xt", metrics.xtDelta);
      addValue(rowsByPlayerId, action.senderId, "xtSender", metrics.xtDelta);
      addValue(rowsByPlayerId, action.receiverId, "xtReceiver", metrics.xtDelta);
      if (isDribblePackingAction(action)) {
        addValue(rowsByPlayerId, action.senderId, "pxtDribble", metrics.pxt);
        addValue(rowsByPlayerId, action.senderId, "xtDribble", metrics.xtDelta);
      }
    }

    for (const shot of match.shots ?? []) {
      if (!shot || !isTeamAttackShot(shot, match)) continue;
      addValue(rowsByPlayerId, shot.playerId, "shots", 1);
      addValue(rowsByPlayerId, shot.playerId, "xg", toNumber(shot.xG));
      if (shot.isGoal === true && shot.isOwnGoal !== true) {
        addValue(rowsByPlayerId, shot.playerId, "goals", 1);
      }
    }

    for (const entry of match.pkEntries ?? []) {
      if (!entry || !isTeamPKEntry(entry, match)) continue;
      if (entry.entryType === "dribble") {
        addValue(rowsByPlayerId, entry.senderId, "pkEntries", 1);
        addValue(rowsByPlayerId, entry.senderId, "pkEntriesDribble", 1);
      } else {
        addSplitValue(rowsByPlayerId, entry.senderId, entry.receiverId, "pkEntries", 1);
        addValue(rowsByPlayerId, entry.senderId, "pkEntriesSender", 1);
        addValue(rowsByPlayerId, entry.receiverId, "pkEntriesReceiver", 1);
      }
    }

    for (const action of match.actions_regain ?? []) {
      if (!action || !isTeamAction(action, match)) continue;
      addValue(rowsByPlayerId, action.senderId, "regains", 1);
      addValue(rowsByPlayerId, action.senderId, "regainsXt", getRegainXtValue(action));
    }

    for (const action of match.actions_loses ?? []) {
      if (!action || action.isAut === true || !isTeamAction(action, match)) continue;
      addValue(rowsByPlayerId, action.senderId, "loses", 1);
      addValue(rowsByPlayerId, action.senderId, "losesXt", getLosesXtValue(action));
    }
  }

  let usedPer90Fallback = false;
  const rows = Array.from(rowsByPlayerId.values()).map((row) => {
    row.hasMinutes = row.minutes > 0;
    if (mode === "per90" && !row.hasMinutes) {
      usedPer90Fallback = true;
    }
    row.values = normalizeValues(row.raw, row.minutes, mode);
    applyShootingDerivedValues(row.values);
    return row;
  });

  rows.sort((a, b) => {
    const byMetric = b.values.pxt - a.values.pxt;
    if (byMetric !== 0) return byMetric;
    const byLast = a.lastName.localeCompare(b.lastName, "pl", { sensitivity: "base", numeric: true });
    if (byLast !== 0) return byLast;
    return a.firstName.localeCompare(b.firstName, "pl", { sensitivity: "base", numeric: true });
  });

  return { rows, mode, usedPer90Fallback };
}

export function getMetricLeader(
  rows: PlayerComparisonRow[],
  metricId: PlayerComparisonMetricId,
): PlayerComparisonRow | null {
  const definition = PLAYER_COMPARISON_METRICS.find((metric) => metric.id === metricId);
  if (!definition || rows.length === 0) return null;

  return rows.reduce((best, row) => {
    const rowValue = row.values[metricId];
    const bestValue = best.values[metricId];
    if (definition.direction === "lower") {
      return rowValue < bestValue ? row : best;
    }
    return rowValue > bestValue ? row : best;
  }, rows[0]);
}
