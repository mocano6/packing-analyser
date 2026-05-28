import type { Action, PKEntry, Player, PlayerMinutes, Shot, TeamInfo } from "@/types";
import { shotIsPenalty } from "@/lib/xgNonPenalty";
import {
  isLoseOnOpponentHalfForMap,
  isLoseOnOwnHalfForMap,
  isRegainOnOpponentHalfForMap,
  isRegainOnOwnHalfForMap,
  losesZoneRawForMap,
} from "./kpiRegainLosesZoneRaw";
import { getOppositeXTValueForZone, getXTValueForZone, zoneNameToIndex } from "@/constants/xtValues";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";
import { packingActionMetrics } from "./wiedzaPackingZoneFlow";
import {
  buildOnPitchPlayersByMinuteIndex,
  getOnPitchPlayerIdsAtMinute,
} from "./playerOnPitchMinutes";

export type PlayerComparisonMode = "sum" | "per90";

export type PlayerComparisonMetricId =
  | "packing"
  | "packingSender"
  | "packingReceiver"
  | "packingDribble"
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
  | "xgOnPitchAttack"
  | "xgOnPitchDefense"
  | "pkEntriesOnPitchAttack"
  | "pkEntriesOnPitchDefense"
  | "regains"
  | "regainsOwnHalf"
  | "regainsOpponentHalf"
  | "regainsXt"
  | "regainsXtAttack"
  | "regainsXtDefense"
  | "loses"
  | "losesOwnHalf"
  | "losesOpponentHalf"
  | "losesXt"
  | "losesXtAttack"
  | "losesXtDefense"
  | "phaseP1Sender"
  | "phaseP1Receiver"
  | "phaseP2Sender"
  | "phaseP2Receiver"
  | "phaseP3Sender"
  | "phaseP3Receiver";

/** Metryki widoczne w jednym wyborze (ranking) — rola wybierana osobno tam, gdzie ma sens. */
export type PlayerComparisonMetricFamily =
  | "packing"
  | "pxt"
  | "xt"
  | "phaseP1"
  | "phaseP2"
  | "phaseP3"
  | "xg"
  | "shots"
  | "goals"
  | "xgPerShot"
  | "shotsPerGoal"
  | "xgPerGoal"
  | "pkEntries"
  | "xgOnPitchAttack"
  | "xgOnPitchDefense"
  | "pkEntriesOnPitchAttack"
  | "pkEntriesOnPitchDefense"
  | "regains"
  | "regainsOwnHalf"
  | "regainsOpponentHalf"
  | "regainsXt"
  | "regainsXtAttack"
  | "regainsXtDefense"
  | "loses"
  | "losesOwnHalf"
  | "losesOpponentHalf"
  | "losesXt"
  | "losesXtAttack"
  | "losesXtDefense";

export type PlayerComparisonMetricRole = "sender" | "receiver" | "dribble";

export const PLAYER_COMPARISON_FAMILY_OPTIONS: { id: PlayerComparisonMetricFamily; label: string }[] = [
  { id: "packing", label: "Packing" },
  { id: "pxt", label: "PXT" },
  { id: "xt", label: "xT" },
  { id: "phaseP1", label: "P1" },
  { id: "phaseP2", label: "P2" },
  { id: "phaseP3", label: "P3" },
  { id: "xg", label: "NPxG" },
  { id: "shots", label: "Liczba strzałów" },
  { id: "goals", label: "Liczba goli" },
  { id: "xgPerShot", label: "NPxG/strzał" },
  { id: "shotsPerGoal", label: "Strzały/gol" },
  { id: "xgPerGoal", label: "NPxG/gol" },
  { id: "pkEntries", label: "Wejścia w pole karne" },
  { id: "xgOnPitchAttack", label: "xG w ataku (na boisku)" },
  { id: "xgOnPitchDefense", label: "xG w obronie (na boisku)" },
  { id: "pkEntriesOnPitchAttack", label: "PK w ataku (na boisku)" },
  { id: "pkEntriesOnPitchDefense", label: "PK w obronie (na boisku)" },
  { id: "regains", label: "Przechwyty" },
  { id: "regainsOwnHalf", label: "Przechwyty WP" },
  { id: "regainsOpponentHalf", label: "Przechwyty PP" },
  { id: "regainsXt", label: "xT/przechwyty" },
  { id: "regainsXtAttack", label: "xT przechwytów (atak)" },
  { id: "regainsXtDefense", label: "xT przechwytów (obrona)" },
  { id: "loses", label: "Straty" },
  { id: "losesOwnHalf", label: "Straty WP" },
  { id: "losesOpponentHalf", label: "Straty PP" },
  { id: "losesXt", label: "xT/straty" },
  { id: "losesXtAttack", label: "xT strat (atak)" },
  { id: "losesXtDefense", label: "xT strat (obrona)" },
];

/** Oś spider / karty liderów; metryki faz P1–P3 pokazują liczbę wystąpień wg przełącznika podanie/przyjęcie. */
export const PLAYER_COMPARISON_AXIS_METRIC_IDS: readonly PlayerComparisonMetricFamily[] = [
  "packing",
  "pxt",
  "xt",
  "phaseP1",
  "phaseP2",
  "phaseP3",
  "xg",
  "shots",
  "goals",
  "xgPerShot",
  "shotsPerGoal",
  "xgPerGoal",
  "pkEntries",
  "xgOnPitchAttack",
  "xgOnPitchDefense",
  "pkEntriesOnPitchAttack",
  "pkEntriesOnPitchDefense",
  "regains",
  "regainsOwnHalf",
  "regainsOpponentHalf",
  "regainsXt",
  "regainsXtAttack",
  "regainsXtDefense",
  "loses",
  "losesOwnHalf",
  "losesOpponentHalf",
  "losesXt",
  "losesXtAttack",
  "losesXtDefense",
];

export function supportsComparisonMetricRole(family: PlayerComparisonMetricFamily): boolean {
  return (
    family === "pxt" ||
    family === "xt" ||
    family === "pkEntries" ||
    family === "phaseP1" ||
    family === "phaseP2" ||
    family === "phaseP3"
  );
}

/** Rola „drybling” ma sens tylko dla PXT, xT i wejść PK — nie dla liczników faz P1–P3. */
export function supportsComparisonMetricDribbleRole(family: PlayerComparisonMetricFamily): boolean {
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
  if (family === "phaseP1") {
    return role === "receiver" ? "phaseP1Receiver" : "phaseP1Sender";
  }
  if (family === "phaseP2") {
    return role === "receiver" ? "phaseP2Receiver" : "phaseP2Sender";
  }
  if (family === "phaseP3") {
    return role === "receiver" ? "phaseP3Receiver" : "phaseP3Sender";
  }
  return family;
}

/** Dla osi spider / kart KPI: metryka z wartością w `row.values` (fazy P1–P3 zależą od roli podanie/przyjęcie). */
export function resolveComparisonAxisValueId(
  axisFamily: PlayerComparisonMetricFamily,
  metricRole: PlayerComparisonMetricRole,
): PlayerComparisonMetricId {
  if (familyIsPhaseParticipation(axisFamily)) {
    return resolvePlayerComparisonMetricId(axisFamily, metricRole === "receiver" ? "receiver" : "sender");
  }
  return axisFamily as PlayerComparisonMetricId;
}

function familyIsPhaseParticipation(family: PlayerComparisonMetricFamily): boolean {
  return family === "phaseP1" || family === "phaseP2" || family === "phaseP3";
}

function phaseAxisRoleLabels(metricRole: PlayerComparisonMetricRole): { longRole: string; shortRole: string } {
  if (metricRole === "receiver") {
    return { longRole: "przyjęcie", shortRole: "prz." };
  }
  return { longRole: "podanie", shortRole: "pod." };
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
  { id: "packingSender", label: "Packing/podanie", shortLabel: "Packing pod.", direction: "higher", fractionDigits: 1 },
  { id: "packingReceiver", label: "Packing/przyjęcie", shortLabel: "Packing prz.", direction: "higher", fractionDigits: 1 },
  { id: "packingDribble", label: "Packing/drybling", shortLabel: "Packing dr.", direction: "higher", fractionDigits: 1 },
  { id: "pxt", label: "PXT", shortLabel: "PXT", direction: "higher", fractionDigits: 2 },
  { id: "pxtSender", label: "PXT/podanie", shortLabel: "PXT/pod.", direction: "higher", fractionDigits: 2 },
  { id: "pxtReceiver", label: "PXT/przyjęcie", shortLabel: "PXT/prz.", direction: "higher", fractionDigits: 2 },
  { id: "pxtDribble", label: "PXT/drybling", shortLabel: "PXT/dr.", direction: "higher", fractionDigits: 2 },
  { id: "xt", label: "xT", shortLabel: "xT", direction: "higher", fractionDigits: 2 },
  { id: "xtSender", label: "xT/podanie", shortLabel: "xT/pod.", direction: "higher", fractionDigits: 2 },
  { id: "xtReceiver", label: "xT/przyjęcie", shortLabel: "xT/prz.", direction: "higher", fractionDigits: 2 },
  { id: "xtDribble", label: "xT/drybling", shortLabel: "xT/dr.", direction: "higher", fractionDigits: 2 },
  { id: "xg", label: "NPxG", shortLabel: "NPxG", direction: "higher", fractionDigits: 2 },
  { id: "shots", label: "Liczba strzałów", shortLabel: "Strzały", direction: "higher", fractionDigits: 0 },
  { id: "goals", label: "Liczba goli", shortLabel: "Gole", direction: "higher", fractionDigits: 0 },
  {
    id: "xgPerShot",
    label: "NPxG/strzał",
    shortLabel: "NPxG/str.",
    direction: "higher",
    fractionDigits: 3,
  },
  {
    id: "shotsPerGoal",
    label: "Strzały/gol",
    shortLabel: "Strz./gol",
    direction: "lower",
    fractionDigits: 2,
  },
  { id: "xgPerGoal", label: "NPxG/gol", shortLabel: "NPxG/gol", direction: "lower", fractionDigits: 2 },
  { id: "pkEntries", label: "Wejścia w pole karne", shortLabel: "PK", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesSender", label: "PK/podanie", shortLabel: "PK/pod.", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesReceiver", label: "PK/przyjęcie", shortLabel: "PK/prz.", direction: "higher", fractionDigits: 1 },
  { id: "pkEntriesDribble", label: "PK/drybling", shortLabel: "PK/dr.", direction: "higher", fractionDigits: 1 },
  {
    id: "xgOnPitchAttack",
    label: "xG w ataku (na boisku)",
    shortLabel: "xG atk. NB",
    direction: "higher",
    fractionDigits: 2,
  },
  {
    id: "xgOnPitchDefense",
    label: "xG w obronie (na boisku)",
    shortLabel: "xG obr. NB",
    direction: "lower",
    fractionDigits: 2,
  },
  {
    id: "pkEntriesOnPitchAttack",
    label: "Wejścia PK w ataku (na boisku)",
    shortLabel: "PK atk. NB",
    direction: "higher",
    fractionDigits: 1,
  },
  {
    id: "pkEntriesOnPitchDefense",
    label: "Wejścia PK w obronie (na boisku)",
    shortLabel: "PK obr. NB",
    direction: "lower",
    fractionDigits: 1,
  },
  { id: "regains", label: "Przechwyty", shortLabel: "Przechwyty", direction: "higher", fractionDigits: 1 },
  {
    id: "regainsOwnHalf",
    label: "Przechwyty na własnej połowie",
    shortLabel: "Przechw. WP",
    direction: "higher",
    fractionDigits: 1,
  },
  {
    id: "regainsOpponentHalf",
    label: "Przechwyty na połowie przeciwnika",
    shortLabel: "Przechw. PP",
    direction: "higher",
    fractionDigits: 1,
  },
  { id: "regainsXt", label: "xT/przechwyty", shortLabel: "xT/przch.", direction: "higher", fractionDigits: 2 },
  {
    id: "regainsXtAttack",
    label: "xT przechwytów (atak)",
    shortLabel: "xT prz. atk.",
    direction: "higher",
    fractionDigits: 2,
  },
  {
    id: "regainsXtDefense",
    label: "xT przechwytów (obrona)",
    shortLabel: "xT prz. obr.",
    direction: "higher",
    fractionDigits: 2,
  },
  { id: "loses", label: "Straty", shortLabel: "Straty", direction: "lower", fractionDigits: 1 },
  {
    id: "losesOwnHalf",
    label: "Straty na własnej połowie",
    shortLabel: "Straty WP",
    direction: "lower",
    fractionDigits: 1,
  },
  {
    id: "losesOpponentHalf",
    label: "Straty na połowie przeciwnika",
    shortLabel: "Straty PP",
    direction: "lower",
    fractionDigits: 1,
  },
  { id: "losesXt", label: "xT/straty", shortLabel: "xT/str.", direction: "lower", fractionDigits: 2 },
  {
    id: "losesXtAttack",
    label: "xT strat (atak)",
    shortLabel: "xT str. atk.",
    direction: "lower",
    fractionDigits: 2,
  },
  {
    id: "losesXtDefense",
    label: "xT strat (obrona)",
    shortLabel: "xT str. obr.",
    direction: "lower",
    fractionDigits: 2,
  },
  { id: "phaseP1Sender", label: "P1 (podanie)", shortLabel: "P1 pod.", direction: "higher", fractionDigits: 0 },
  { id: "phaseP1Receiver", label: "P1 (przyjęcie)", shortLabel: "P1 prz.", direction: "higher", fractionDigits: 0 },
  { id: "phaseP2Sender", label: "P2 (podanie)", shortLabel: "P2 pod.", direction: "higher", fractionDigits: 0 },
  { id: "phaseP2Receiver", label: "P2 (przyjęcie)", shortLabel: "P2 prz.", direction: "higher", fractionDigits: 0 },
  { id: "phaseP3Sender", label: "P3 (podanie)", shortLabel: "P3 pod.", direction: "higher", fractionDigits: 0 },
  { id: "phaseP3Receiver", label: "P3 (przyjęcie)", shortLabel: "P3 prz.", direction: "higher", fractionDigits: 0 },
];

/** Etykiety osi / kart — dla faz P1–P3 zależą od wybranej roli (podanie vs przyjęcie). */
export function getPlayerComparisonAxisDisplay(
  axisId: PlayerComparisonMetricFamily,
  metricRole: PlayerComparisonMetricRole,
): { kpiCard: string; compareTable: string; radarAxis: string } {
  const valueId = resolveComparisonAxisValueId(axisId, metricRole);
  const def = PLAYER_COMPARISON_METRICS.find((m) => m.id === valueId);
  const longLabel = def?.label ?? String(valueId);
  const shortLabel = def?.shortLabel ?? String(valueId);
  if (familyIsPhaseParticipation(axisId)) {
    const { shortRole } = phaseAxisRoleLabels(metricRole);
    const phaseShort =
      axisId === "phaseP1" ? "P1" : axisId === "phaseP2" ? "P2" : "P3";
    return {
      kpiCard: longLabel,
      compareTable: longLabel,
      radarAxis: `${phaseShort} ${shortRole}`,
    };
  }
  return { kpiCard: longLabel, compareTable: longLabel, radarAxis: shortLabel };
}

/** Straty / xT strat na radarze: większa wartość surowa → dalszy wierzchołek (czytelne „więcej strat = gorzej”). */
const RADAR_RAW_HIGHER_WORSE_METRICS: ReadonlySet<PlayerComparisonMetricId> = new Set([
  "loses",
  "losesOwnHalf",
  "losesOpponentHalf",
  "losesXt",
  "losesXtAttack",
  "losesXtDefense",
  "xgOnPitchDefense",
  "pkEntriesOnPitchDefense",
]);

/**
 * Ta sama precyzja co w UI (`formatMetricValue` / toLocaleString z fractionDigits).
 * Bez tego per90 i float dają ten sam tekst w tabeli, ale różne surowe liczby → mylące kolory / spider.
 */
export function roundPlayerComparisonMetricForDisplay(metricId: PlayerComparisonMetricId, value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  const digits = PLAYER_COMPARISON_METRICS.find((m) => m.id === metricId)?.fractionDigits ?? 1;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Punkty 0–100 na spider mapie: w obrębie `rows` skala względna do maksimum grupy.
 * Dla strat i xT/strat wyższa wartość surowa daje wyższy wynik na wykresie (odwrócenie względem rankingu „mniej = lepiej”).
 * Używa wartości zaokrąglonych jak w tabeli — ta sama liczba w komórce = ten sam punkt na osi.
 */
export function normalizePlayerComparisonRadarScore(
  rows: PlayerComparisonRow[],
  row: PlayerComparisonRow,
  metricId: PlayerComparisonMetricId,
): number {
  const definition = PLAYER_COMPARISON_METRICS.find((m) => m.id === metricId);
  const values = rows
    .map((item) => roundPlayerComparisonMetricForDisplay(metricId, item.values[metricId]))
    .filter(Number.isFinite);
  if (!definition || values.length === 0) return 0;
  const max = Math.max(...values, 0);
  const rawHigherIsWorseOnRadar = RADAR_RAW_HIGHER_WORSE_METRICS.has(metricId);

  if (max <= 0) {
    if (!rawHigherIsWorseOnRadar && definition.direction === "lower") return 100;
    return 0;
  }

  const value = roundPlayerComparisonMetricForDisplay(metricId, row.values[metricId]);
  if (!Number.isFinite(value)) return 0;

  const scoreHigherIsBetterOnRadar = definition.direction === "higher" || rawHigherIsWorseOnRadar;
  const score = scoreHigherIsBetterOnRadar ? (value / max) * 100 : (1 - value / max) * 100;
  return Math.max(0, Math.min(100, score));
}

/** Ton komórki tabeli 1:1 — „lepszy/gorszy” względem interpretacji metryki (wyżej vs niżej lepiej). */
export type PlayerComparisonPairCellTone = "better" | "worse" | "even" | "neutral";

export function getPlayerComparisonPairCellTone(
  primaryValue: number,
  secondaryValue: number,
  direction: "higher" | "lower",
  metricId: PlayerComparisonMetricId,
): { primary: PlayerComparisonPairCellTone; secondary: PlayerComparisonPairCellTone } {
  const aOk = Number.isFinite(primaryValue);
  const bOk = Number.isFinite(secondaryValue);
  if (!aOk || !bOk) {
    return { primary: "neutral", secondary: "neutral" };
  }
  const a = roundPlayerComparisonMetricForDisplay(metricId, primaryValue);
  const b = roundPlayerComparisonMetricForDisplay(metricId, secondaryValue);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { primary: "neutral", secondary: "neutral" };
  }
  if (a === b) {
    return { primary: "even", secondary: "even" };
  }
  const primaryHigher = a > b;
  if (direction === "higher") {
    return primaryHigher
      ? { primary: "better", secondary: "worse" }
      : { primary: "worse", secondary: "better" };
  }
  return primaryHigher
    ? { primary: "worse", secondary: "better" }
    : { primary: "better", secondary: "worse" };
}

export type PlayerComparisonRawAmountSide = "primaryMore" | "secondaryMore" | "even" | "neutral";

/** Który zawodnik ma wyższą wartość surową (niezależnie od tego, czy to dobrze). */
export function getPlayerComparisonRawAmountSide(
  primaryValue: number,
  secondaryValue: number,
  metricId: PlayerComparisonMetricId,
): PlayerComparisonRawAmountSide {
  const aOk = Number.isFinite(primaryValue);
  const bOk = Number.isFinite(secondaryValue);
  if (!aOk || !bOk) return "neutral";
  const a = roundPlayerComparisonMetricForDisplay(metricId, primaryValue);
  const b = roundPlayerComparisonMetricForDisplay(metricId, secondaryValue);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "neutral";
  if (a === b) return "even";
  return a > b ? "primaryMore" : "secondaryMore";
}

/**
 * Tekst nadwyżki surowej względem rywala — tylko gdy ownValue jest wyższe (np. "(+0,15)" w pl-PL).
 * Przy remisie lub słabszej wartości zwraca null.
 */
export function formatPlayerComparisonRawSurplusParen(
  metricId: PlayerComparisonMetricId,
  ownValue: number,
  otherValue: number,
  locale = "pl-PL",
): string | null {
  const aOk = Number.isFinite(ownValue);
  const bOk = Number.isFinite(otherValue);
  if (!aOk || !bOk) return null;
  const ownR = roundPlayerComparisonMetricForDisplay(metricId, ownValue);
  const otherR = roundPlayerComparisonMetricForDisplay(metricId, otherValue);
  if (!Number.isFinite(ownR) || !Number.isFinite(otherR)) return null;
  const surplus = ownR - otherR;
  if (surplus <= 0) return null;
  const digits = PLAYER_COMPARISON_METRICS.find((m) => m.id === metricId)?.fractionDigits ?? 1;
  const formatted = surplus.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `(+${formatted})`;
}

export type PlayerComparisonRankingSelectOption = { value: string; label: string };

export function buildPlayerComparisonRankingSelectOptions(): PlayerComparisonRankingSelectOption[] {
  return PLAYER_COMPARISON_FAMILY_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }));
}

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
  packingSender: 0,
  packingReceiver: 0,
  packingDribble: 0,
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
  xgOnPitchAttack: 0,
  xgOnPitchDefense: 0,
  pkEntriesOnPitchAttack: 0,
  pkEntriesOnPitchDefense: 0,
  regains: 0,
  regainsOwnHalf: 0,
  regainsOpponentHalf: 0,
  regainsXt: 0,
  regainsXtAttack: 0,
  regainsXtDefense: 0,
  loses: 0,
  losesOwnHalf: 0,
  losesOpponentHalf: 0,
  losesXt: 0,
  losesXtAttack: 0,
  losesXtDefense: 0,
  phaseP1Sender: 0,
  phaseP1Receiver: 0,
  phaseP2Sender: 0,
  phaseP2Receiver: 0,
  phaseP3Sender: 0,
  phaseP3Receiver: 0,
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

const isTeamDefenseShot = (shot: Shot, match: TeamInfo): boolean =>
  shot.teamContext === "defense" && (!shot.teamId || shot.teamId === match.opponent);

const isTeamPKEntryDefense = (entry: PKEntry): boolean =>
  (entry.teamContext ?? "attack") === "defense";

const addValueToOnPitchPlayers = (
  rowsByPlayerId: Map<string, PlayerComparisonRow>,
  onPitchByMinute: Map<number, Set<string>>,
  minute: number,
  metricId: PlayerComparisonMetricId,
  value: number,
): void => {
  if (value === 0) return;
  const players = getOnPitchPlayerIdsAtMinute(onPitchByMinute, minute);
  if (!players) return;
  for (const playerId of players) {
    addValue(rowsByPlayerId, playerId, metricId, value);
  }
};

const isTeamAction = (action: Action, match: TeamInfo): boolean =>
  !action.teamId || action.teamId === match.team;

const isDribblePackingAction = (action: Action): boolean =>
  String(action.actionType ?? "").toLowerCase() === "dribble";

/** Liczba wystąpień zawodnika w danej fazie (P1–P3) jako podający / przyjmujący; drybling tylko u nadawcy. */
const bumpPhasePackingParticipation = (
  rowsByPlayerId: Map<string, PlayerComparisonRow>,
  action: Action,
): void => {
  const isDribble = isDribblePackingAction(action);
  const triples: [keyof Action, PlayerComparisonMetricId, PlayerComparisonMetricId][] = [
    ["isP1", "phaseP1Sender", "phaseP1Receiver"],
    ["isP2", "phaseP2Sender", "phaseP2Receiver"],
    ["isP3", "phaseP3Sender", "phaseP3Receiver"],
  ];
  for (const [flag, senderMetric, receiverMetric] of triples) {
    if (action[flag] !== true) continue;
    addValue(rowsByPlayerId, action.senderId, senderMetric, 1);
    if (!isDribble) addValue(rowsByPlayerId, action.receiverId, receiverMetric, 1);
  }
};

const getLosesZoneXtValue = (action: Action): number => {
  const explicitThreat = toNumber(action.losesAttackXT);
  if (action.losesAttackXT !== undefined && action.losesAttackXT !== null) {
    return explicitThreat;
  }

  const zoneName = normalizeWiedzaPitchZone(losesZoneRawForMap(action));
  if (zoneName) {
    const idx = zoneNameToIndex(zoneName);
    if (idx !== null) return getXTValueForZone(idx);
  }

  return toNumber(action.xTValueStart ?? action.xTValueEnd);
};

const getRegainAttackXtValue = (action: Action): number => {
  if (action.regainAttackXT !== undefined && action.regainAttackXT !== null) {
    return toNumber(action.regainAttackXT);
  }
  const explicitOpposite = toNumber(action.oppositeXT);
  if (explicitOpposite > 0) return explicitOpposite;

  const defenseZoneRaw =
    action.regainDefenseZone || action.fromZone || action.toZone || action.startZone;
  const zoneName = normalizeWiedzaPitchZone(defenseZoneRaw);
  if (!zoneName) return 0;
  const idx = zoneNameToIndex(zoneName);
  return idx !== null ? getOppositeXTValueForZone(idx) : 0;
};

const getRegainDefenseXtValue = (action: Action): number => {
  if (action.regainDefenseXT !== undefined && action.regainDefenseXT !== null) {
    return toNumber(action.regainDefenseXT);
  }
  return toNumber(action.xTValueEnd ?? action.xTValueStart);
};

const getLosesXtValue = (action: Action): number => {
  const explicitThreat = toNumber(action.losesAttackXT);
  if (explicitThreat > 0) return explicitThreat;

  const endThreat = toNumber(action.xTValueEnd);
  if (endThreat > 0) return endThreat;

  const attack = toNumber(action.regainAttackXT ?? action.oppositeXT);
  const defense = toNumber(action.losesDefenseXT ?? action.regainDefenseXT);
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
    packingSender: raw.packingSender * factor,
    packingReceiver: raw.packingReceiver * factor,
    packingDribble: raw.packingDribble * factor,
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
    xgOnPitchAttack: raw.xgOnPitchAttack * factor,
    xgOnPitchDefense: raw.xgOnPitchDefense * factor,
    pkEntriesOnPitchAttack: raw.pkEntriesOnPitchAttack * factor,
    pkEntriesOnPitchDefense: raw.pkEntriesOnPitchDefense * factor,
    regains: raw.regains * factor,
    regainsOwnHalf: raw.regainsOwnHalf * factor,
    regainsOpponentHalf: raw.regainsOpponentHalf * factor,
    regainsXt: raw.regainsXt * factor,
    regainsXtAttack: raw.regainsXtAttack * factor,
    regainsXtDefense: raw.regainsXtDefense * factor,
    loses: raw.loses * factor,
    losesOwnHalf: raw.losesOwnHalf * factor,
    losesOpponentHalf: raw.losesOpponentHalf * factor,
    losesXt: raw.losesXt * factor,
    losesXtAttack: raw.losesXtAttack * factor,
    losesXtDefense: raw.losesXtDefense * factor,
    phaseP1Sender: raw.phaseP1Sender * factor,
    phaseP1Receiver: raw.phaseP1Receiver * factor,
    phaseP2Sender: raw.phaseP2Sender * factor,
    phaseP2Receiver: raw.phaseP2Receiver * factor,
    phaseP3Sender: raw.phaseP3Sender * factor,
    phaseP3Receiver: raw.phaseP3Receiver * factor,
  };
};

type PlayerComparisonNonPenaltyShootingDenoms = { shots: number; goals: number };

const applyShootingDerivedValues = (
  values: PlayerComparisonRawMetrics,
  nonPenalty: PlayerComparisonNonPenaltyShootingDenoms,
): void => {
  const shots = values.shots;
  const goals = values.goals;
  const xg = values.xg;
  values.xgPerShot = nonPenalty.shots > 0 ? xg / nonPenalty.shots : 0;
  values.shotsPerGoal = goals > 0 ? shots / goals : Number.POSITIVE_INFINITY;
  values.xgPerGoal = nonPenalty.goals > 0 ? xg / nonPenalty.goals : Number.POSITIVE_INFINITY;
};

export function buildPlayerComparisonRows(players: Player[], matches: TeamInfo[], mode: PlayerComparisonMode): PlayerComparisonResult {
  const rowsByPlayerId = new Map<string, PlayerComparisonRow>();
  const nonPenaltyShootingByPlayerId = new Map<string, PlayerComparisonNonPenaltyShootingDenoms>();

  for (const player of players) {
    if (player.isDeleted === true) continue;
    nonPenaltyShootingByPlayerId.set(player.id, { shots: 0, goals: 0 });
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
    const onPitchByMinute = buildOnPitchPlayersByMinuteIndex(
      match.playerMinutes,
      new Set(rowsByPlayerId.keys()),
    );

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
      if (isDribblePackingAction(action)) {
        addValue(rowsByPlayerId, action.senderId, "packingDribble", metrics.packPts);
      } else {
        addValue(rowsByPlayerId, action.senderId, "packingSender", metrics.packPts);
        addValue(rowsByPlayerId, action.receiverId, "packingReceiver", metrics.packPts);
      }
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
      bumpPhasePackingParticipation(rowsByPlayerId, action);
    }

    for (const shot of match.shots ?? []) {
      if (!shot) continue;
      const shotMinute = toNumber(shot.minute);
      if (isTeamAttackShot(shot, match)) {
        addValueToOnPitchPlayers(
          rowsByPlayerId,
          onPitchByMinute,
          shotMinute,
          "xgOnPitchAttack",
          toNumber(shot.xG),
        );
        const playerId = String(shot.playerId ?? "").trim();
        addValue(rowsByPlayerId, shot.playerId, "shots", 1);
        const isPenalty = shotIsPenalty(shot);
        if (!isPenalty) {
          addValue(rowsByPlayerId, shot.playerId, "xg", toNumber(shot.xG));
          if (playerId) {
            const np = nonPenaltyShootingByPlayerId.get(playerId);
            if (np) np.shots += 1;
          }
        }
        if (shot.isGoal === true && shot.isOwnGoal !== true) {
          addValue(rowsByPlayerId, shot.playerId, "goals", 1);
          if (!isPenalty && playerId) {
            const np = nonPenaltyShootingByPlayerId.get(playerId);
            if (np) np.goals += 1;
          }
        }
      } else if (isTeamDefenseShot(shot, match)) {
        addValueToOnPitchPlayers(
          rowsByPlayerId,
          onPitchByMinute,
          shotMinute,
          "xgOnPitchDefense",
          toNumber(shot.xG),
        );
      }
    }

    for (const entry of match.pkEntries ?? []) {
      if (!entry) continue;
      const entryMinute = toNumber(entry.minute);
      if (isTeamPKEntry(entry, match)) {
        addValueToOnPitchPlayers(rowsByPlayerId, onPitchByMinute, entryMinute, "pkEntriesOnPitchAttack", 1);
        if (entry.entryType === "dribble") {
          addValue(rowsByPlayerId, entry.senderId, "pkEntries", 1);
          addValue(rowsByPlayerId, entry.senderId, "pkEntriesDribble", 1);
        } else {
          addSplitValue(rowsByPlayerId, entry.senderId, entry.receiverId, "pkEntries", 1);
          addValue(rowsByPlayerId, entry.senderId, "pkEntriesSender", 1);
          addValue(rowsByPlayerId, entry.receiverId, "pkEntriesReceiver", 1);
        }
      } else if (isTeamPKEntryDefense(entry)) {
        addValueToOnPitchPlayers(rowsByPlayerId, onPitchByMinute, entryMinute, "pkEntriesOnPitchDefense", 1);
      }
    }

    for (const action of match.actions_regain ?? []) {
      if (!action || !isTeamAction(action, match)) continue;
      addValue(rowsByPlayerId, action.senderId, "regains", 1);
      if (isRegainOnOwnHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "regainsOwnHalf", 1);
      }
      if (isRegainOnOpponentHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "regainsOpponentHalf", 1);
      }
      const regainAttackXt = getRegainAttackXtValue(action);
      const regainDefenseXt = getRegainDefenseXtValue(action);
      addValue(rowsByPlayerId, action.senderId, "regainsXtAttack", regainAttackXt);
      addValue(rowsByPlayerId, action.senderId, "regainsXtDefense", regainDefenseXt);
      addValue(rowsByPlayerId, action.senderId, "regainsXt", Math.max(0, regainAttackXt - regainDefenseXt));
    }

    for (const action of match.actions_loses ?? []) {
      if (!action || action.isAut === true || !isTeamAction(action, match)) continue;
      addValue(rowsByPlayerId, action.senderId, "loses", 1);
      if (isLoseOnOwnHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "losesOwnHalf", 1);
      }
      if (isLoseOnOpponentHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "losesOpponentHalf", 1);
      }
      const loseZoneXt = getLosesZoneXtValue(action);
      addValue(rowsByPlayerId, action.senderId, "losesXt", getLosesXtValue(action));
      if (isLoseOnOwnHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "losesXtDefense", loseZoneXt);
      }
      if (isLoseOnOpponentHalfForMap(action)) {
        addValue(rowsByPlayerId, action.senderId, "losesXtAttack", loseZoneXt);
      }
    }
  }

  let usedPer90Fallback = false;
  const rows = Array.from(rowsByPlayerId.values()).map((row) => {
    row.hasMinutes = row.minutes > 0;
    if (mode === "per90" && !row.hasMinutes) {
      usedPer90Fallback = true;
    }
    row.values = normalizeValues(row.raw, row.minutes, mode);
    applyShootingDerivedValues(
      row.values,
      nonPenaltyShootingByPlayerId.get(row.playerId) ?? { shots: 0, goals: 0 },
    );
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
