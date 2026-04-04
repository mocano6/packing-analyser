import { Action, PKEntry, Shot, TeamInfo } from "@/types";
import { zoneNameToIndex } from "../constants/xtValues";
import { isIn1TZoneCanonical } from "./pitchZones";

export type TrendyKpiDirection = "higher" | "lower";
export type TrendyKpiUnit = "percent" | "number" | "ratio" | "seconds";

export interface TrendyKpiDefinition {
  id: string;
  label: string;
  target: number;
  direction: TrendyKpiDirection;
  unit: TrendyKpiUnit;
  active: boolean;
  order: number;
  description?: string;
}

export const DEFAULT_TRENDY_KPI_DEFINITIONS: TrendyKpiDefinition[] = [
  { id: "xg_for", label: "xG", target: 1.0, direction: "higher", unit: "number", active: true, order: 10 },
  { id: "shots_for", label: "Strzały", target: 12, direction: "higher", unit: "number", active: true, order: 20 },
  { id: "pk_for", label: "PK", target: 20, direction: "higher", unit: "number", active: true, order: 30 },
  { id: "pxt", label: "PxT", target: 2, direction: "higher", unit: "number", active: true, order: 40 },
  { id: "pxt_p2p3", label: "PxT P2/P3", target: 25, direction: "higher", unit: "number", active: true, order: 50 },
  { id: "regains_opp_half", label: "Przechwyty na połowie przeciwnika", target: 27, direction: "higher", unit: "number", active: true, order: 60 },
  { id: "loses_pm_area", label: "PM AREA STRATY", target: 6, direction: "lower", unit: "number", active: true, order: 65 },
  { id: "possession_pct", label: "Posiadanie", target: 55, direction: "higher", unit: "percent", active: true, order: 70 },
  { id: "dead_time_pct", label: "Czas martwy", target: 45, direction: "higher", unit: "percent", active: true, order: 80 },
  { id: "acc8s_pct", label: "8S ACC", target: 25, direction: "higher", unit: "percent", active: true, order: 90 },
  { id: "regains_pp_8s_ca_pct", label: "8S CA", target: 25, direction: "higher", unit: "percent", active: true, order: 95 },
  { id: "xg_per_shot", label: "XG/STRZAŁ", target: 0.15, direction: "higher", unit: "ratio", active: true, order: 100 },
  { id: "one_touch_pct", label: "1T", target: 85, direction: "higher", unit: "percent", active: true, order: 110 },
  { id: "pk_opponent", label: "PK PRZECIWNIK", target: 11, direction: "lower", unit: "number", active: true, order: 120 },
  { id: "counterpress_5s_pct", label: "5S (COUNTERPRESSING)", target: 50, direction: "higher", unit: "percent", active: true, order: 130 },
];

const ATTACK_ZONE_HINTS = ["7", "8", "9", "10", "11", "12", "P7", "P8", "P9", "P10", "P11", "P12"];

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const isAttackShot = (shot: Shot): boolean => shot.teamContext === "attack";
const isAttackPK = (entry: PKEntry): boolean => (entry.teamContext ?? "attack") === "attack";

const getTeamShots = (match: TeamInfo): Shot[] => (match.shots ?? []).filter(isAttackShot);
const getOpponentShots = (match: TeamInfo): Shot[] => (match.shots ?? []).filter((shot) => shot.teamContext === "defense");
const getTeamPKEntries = (match: TeamInfo): PKEntry[] => (match.pkEntries ?? []).filter(isAttackPK);
const getOpponentPKEntries = (match: TeamInfo): PKEntry[] =>
  (match.pkEntries ?? []).filter((entry) => (entry.teamContext ?? "attack") === "defense");

const getTeamXG = (match: TeamInfo): number =>
  getTeamShots(match).reduce((sum, shot) => sum + toNumber(shot.xG), 0);

const getOpponentXG = (match: TeamInfo): number =>
  getOpponentShots(match).reduce((sum, shot) => sum + toNumber(shot.xG), 0);

const getTeamGoals = (match: TeamInfo): number =>
  getTeamShots(match).filter((shot) => shot.isGoal === true).length;

const getOpponentGoals = (match: TeamInfo): number =>
  getOpponentShots(match).filter((shot) => shot.isGoal === true).length;

export const getTeamGoalsForMatch = (match: TeamInfo): number => getTeamGoals(match);

export const getOpponentGoalsForMatch = (match: TeamInfo): number => getOpponentGoals(match);

/**
 * Punkty meczu z perspektywy naszego zespołu (na podstawie goli ze strzałów): 3 = wygrana, 1 = remis, 0 = porażka.
 * Do korelacji z innymi metrykami (np. w Bazie wiedzy).
 */
export const getTeamMatchPointsForMatch = (match: TeamInfo): number => {
  const gf = getTeamGoals(match);
  const ga = getOpponentGoals(match);
  if (gf > ga) return 3;
  if (gf < ga) return 0;
  return 1;
};

/** 1 przy wygranej (3 pkt), 0 inaczej — do macierzy korelacji obok remisu. */
export const getTeamMatchWinIndicatorForMatch = (match: TeamInfo): number =>
  getTeamMatchPointsForMatch(match) === 3 ? 1 : 0;

/** 1 przy remisie (1 pkt), 0 inaczej. */
export const getTeamMatchDrawIndicatorForMatch = (match: TeamInfo): number =>
  getTeamMatchPointsForMatch(match) === 1 ? 1 : 0;

/** 1 przy przegranej (0 pkt), 0 inaczej. Razem z wygraną i remisem: dokładnie jedna z trzech ma 1. */
export const getTeamMatchLossIndicatorForMatch = (match: TeamInfo): number =>
  getTeamMatchPointsForMatch(match) === 0 ? 1 : 0;

/** Liczba strzałów zespołu (atak) w meczu — jak KPI Strzały. */
export const getTeamShotsCountForMatch = (match: TeamInfo): number => getTeamShots(match).length;

/** Liczba strzałów przeciwnika (obrona) w meczu. */
export const getOpponentShotsCountForMatch = (match: TeamInfo): number => getOpponentShots(match).length;

/** Strzał celny — jak panel xG (celny, gol lub isGoal). */
const isShotOnTargetRecord = (shot: Shot): boolean =>
  shot.shotType === "on_target" || shot.shotType === "goal" || shot.isGoal === true;

const isShotBlockedRecord = (shot: Shot): boolean => shot.shotType === "blocked";

/** Strzały celne zespołu (kontekst ataku) — sytuacje pod obronę BR / do siatki. */
export const getTeamShotsOnTargetCountForMatch = (match: TeamInfo): number =>
  getTeamShots(match).filter(isShotOnTargetRecord).length;

/** Strzały celne przeciwnika (kontekst obrony w dokumencie meczu). */
export const getOpponentShotsOnTargetCountForMatch = (match: TeamInfo): number =>
  getOpponentShots(match).filter(isShotOnTargetRecord).length;

/** Strzały zablokowane zespołu. */
export const getTeamShotsBlockedCountForMatch = (match: TeamInfo): number =>
  getTeamShots(match).filter(isShotBlockedRecord).length;

/** Strzały zablokowane przeciwnika. */
export const getOpponentShotsBlockedCountForMatch = (match: TeamInfo): number =>
  getOpponentShots(match).filter(isShotBlockedRecord).length;

/** Liczba wejść w PK zespołu (atak) — to samo co KPI pk_for. */
export const getTeamPKEntriesCountForMatch = (match: TeamInfo): number => getTeamPKEntries(match).length;

/** Liczba wejść w PK przeciwnika (kontekst obrony) — to samo co KPI pk_opponent. */
export const getOpponentPKEntriesCountForMatch = (match: TeamInfo): number => getOpponentPKEntries(match).length;

/** xG na strzał zespołu (atak); 0 gdy brak strzałów. */
export const getTeamXgPerShotForMatch = (match: TeamInfo): number => {
  const n = getTeamShots(match).length;
  if (n === 0) return 0;
  return getTeamXG(match) / n;
};

/** Gole na strzał zespołu (atak); 0 gdy brak strzałów — jak xG/strz., ale z rzeczywistych bramek. */
export const getTeamGoalsPerShotForMatch = (match: TeamInfo): number => {
  const n = getTeamShots(match).length;
  if (n === 0) return 0;
  return getTeamGoals(match) / n;
};

/** Gole na strzał przeciwnika (strzały w kontekście obrony); 0 gdy brak strzałów. */
export const getOpponentGoalsPerShotForMatch = (match: TeamInfo): number => {
  const shots = getOpponentShots(match);
  if (shots.length === 0) return 0;
  return getOpponentGoals(match) / shots.length;
};

/** xG zespołu (atak) — to samo co KPI xG w trendach. */
export const getTeamXgForMatch = (match: TeamInfo): number => getTeamXG(match);

/** Wszystkie przechwyty zespołu w meczu (bez filtrowania połowy). */
export const getRegainsFullPitchCount = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter(Boolean).length;

/** Przechwyty przypisane do klubu z dokumentu meczu (brak teamId → nasz). */
export const getTeamRegainsFullPitchCountForMatch = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter((a) => a && (!a.teamId || a.teamId === match.team)).length;

/** Przechwyty z teamId przeciwnika. */
export const getOpponentRegainsFullPitchCountForMatch = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter((a) => a && a.teamId === match.opponent).length;

/** Straty zespołu na całym boisku (auty pomijane). */
export const getLosesFullPitchCount = (match: TeamInfo): number =>
  (match.actions_loses ?? []).filter((a) => a && a.isAut !== true).length;

/** Straty nasze (bez autów). */
export const getTeamLosesFullPitchCountForMatch = (match: TeamInfo): number =>
  (match.actions_loses ?? []).filter(
    (a) => a && a.isAut !== true && (!a.teamId || a.teamId === match.team),
  ).length;

/** Straty przeciwnika (bez autów). */
export const getOpponentLosesFullPitchCountForMatch = (match: TeamInfo): number =>
  (match.actions_loses ?? []).filter((a) => a && a.isAut !== true && a.teamId === match.opponent).length;

/** Średnie xG na strzał przeciwnika (strzały w kontekście obrony). */
export const getOpponentXgPerShot = (match: TeamInfo): number => {
  const shots = getOpponentShots(match);
  if (shots.length === 0) return 0;
  return getOpponentXG(match) / shots.length;
};

const getPxt = (match: TeamInfo): number =>
  (match.actions_packing ?? []).reduce((sum, action) => {
    const xtDiff = toNumber(action.xTValueEnd) - toNumber(action.xTValueStart);
    return sum + xtDiff * toNumber(action.packingPoints);
  }, 0);

const countP2InActions = (actions: Action[] | undefined): number =>
  (actions ?? []).filter((action) => Boolean((action as any).isP2)).length;

const countP3InActions = (actions: Action[] | undefined): number =>
  (actions ?? []).filter((action) => Boolean((action as any).isP3)).length;

/** P2: packing + przechwyty (regain) z flagą isP2. */
const getP2Count = (match: TeamInfo): number =>
  countP2InActions(match.actions_packing) + countP2InActions(match.actions_regain);

/** P3: packing + przechwyty (regain) z flagą isP3. */
const getP3Count = (match: TeamInfo): number =>
  countP3InActions(match.actions_packing) + countP3InActions(match.actions_regain);

const getP2P3Count = (match: TeamInfo): number => getP2Count(match) + getP3Count(match);

/** PxT meczu (jak wiersz KPI w Statystykach zespołu). */
export const getTeamPxtForMatch = (match: TeamInfo): number => getPxt(match);

/** Suma zmian xT na akcjach packing (bez mnożenia przez punkty packing) — do macierzy korelacji. */
export const getTeamXtDeltaSumForMatch = (match: TeamInfo): number =>
  (match.actions_packing ?? []).reduce((sum, action) => {
    const xtDiff = toNumber(action.xTValueEnd) - toNumber(action.xTValueStart);
    return sum + xtDiff;
  }, 0);

/** Suma punktów packing na akcjach packing — do macierzy korelacji. */
export const getTeamPackingPointsSumForMatch = (match: TeamInfo): number =>
  (match.actions_packing ?? []).reduce((sum, action) => sum + toNumber(action.packingPoints), 0);

/** Liczba akcji P2 (jak pierwsza liczba w „P2/P3 53/4”). */
export const getTeamP2CountForMatch = (match: TeamInfo): number => getP2Count(match);

/** Liczba akcji P3 (jak druga liczba w „P2/P3 53/4”). */
export const getTeamP3CountForMatch = (match: TeamInfo): number => getP3Count(match);

const isRegainInOppHalf = (action: Action): boolean => {
  const zoneRaw = action.regainAttackZone || action.oppositeZone || action.toZone || action.endZone || "";
  const zoneNormalized = String(zoneRaw).toUpperCase().replace(/\s+/g, "");
  return ATTACK_ZONE_HINTS.some((hint) => zoneNormalized.includes(hint));
};

/** Strefa ataku przechwytu jak w KPI „Przechwyty na połowie przeciwnika”. */
export function isRegainInOpponentHalfZone(action: Action): boolean {
  return isRegainInOppHalf(action);
}

const getRegainsInOpponentHalf = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter(isRegainInOppHalf).length;

/** Przechwyty naszego zespołu na połowie przeciwnika (strefa ataku przechwytu — jak filtr „Połowa przeciwnika” / KPI). */
export const getTeamRegainsOpponentHalfCountForMatch = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter((a) => a && a.teamId === match.team && isRegainInOppHalf(a)).length;

/**
 * Przechwyty przeciwnika na naszej połowie: miejsce odzyskania (strefa obrony przechwytu) w kolumnach 1–6 siatki.
 */
export const getOpponentRegainsOurHalfCountForMatch = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter((a) => {
    if (!a || a.teamId !== match.opponent) return false;
    const defRaw = a.regainDefenseZone || a.fromZone || a.toZone || a.startZone;
    return isOwnHalfGridFromRawZone(defRaw);
  }).length;

/**
 * Straty naszego zespołu na własnej połowie (strefa straty jak heatmapa „Własna połowa”), bez autów.
 */
export const getTeamLosesOwnHalfNonAutCountForMatch = (match: TeamInfo): number =>
  (match.actions_loses ?? []).filter((a) => {
    if (!a || a.isAut === true) return false;
    if (a.teamId !== match.team) return false;
    const z = a.losesAttackZone || a.fromZone || a.toZone || a.startZone;
    return isOwnHalfGridFromRawZone(z);
  }).length;

const normalizeZoneName = (zone: unknown): string | null => {
  if (zone == null) return null;
  const str = typeof zone === "string" ? zone : String(zone);
  const normalized = str.toUpperCase().replace(/\s+/g, "");
  return normalized || null;
};

/** Kolumna siatki 0–5 = własna połowa, 6–11 = połowa przeciwnika (jak Statystyki zespołu / heatmapy). */
const isOwnHalfGridFromRawZone = (zoneRaw: unknown): boolean => {
  const name = normalizeZoneName(zoneRaw);
  if (!name) return false;
  const idx = zoneNameToIndex(name);
  if (idx == null) return false;
  return idx % 12 <= 5;
};

const PM_AREA_ZONES = [
  "C5",
  "C6",
  "C7",
  "C8",
  "D5",
  "D6",
  "D7",
  "D8",
  "E5",
  "E6",
  "E7",
  "E8",
  "F5",
  "F6",
  "F7",
  "F8",
];

const isLoseInPMAreaZone = (action: Action): boolean => {
  const losesZoneRaw = action.losesAttackZone || action.fromZone || action.toZone || action.startZone;
  const losesZoneName = normalizeZoneName(losesZoneRaw);
  return losesZoneName != null && PM_AREA_ZONES.includes(losesZoneName);
};

/** Strefa straty jak w KPI „PM AREA STRATY”. */
export function isLoseInPmAreaZone(action: Action): boolean {
  return isLoseInPMAreaZone(action);
}

const isRegainInPMAreaZone = (action: Action): boolean => {
  const zoneRaw = action.regainAttackZone || action.oppositeZone || action.toZone || action.endZone;
  const z = normalizeZoneName(zoneRaw);
  return z != null && PM_AREA_ZONES.includes(z);
};

const getLosesInPMAreaCount = (match: TeamInfo): number => {
  const allLoses = match.actions_loses ?? [];
  if (!allLoses.length) return 0;

  return allLoses.filter((action) => isLoseInPMAreaZone(action)).length;
};

/** Straty w PM Area — tylko nasz zespół (teamId === match.team), auty pomijane. */
export const getTeamLosesInPMAreaCountForMatch = (match: TeamInfo): number =>
  (match.actions_loses ?? []).filter(
    (a) => a && a.isAut !== true && a.teamId === match.team && isLoseInPMAreaZone(a),
  ).length;

/** Przechwyty w PM Area (strefa ataku przechwytu) — tylko nasz zespół. */
export const getTeamRegainsInPMAreaCountForMatch = (match: TeamInfo): number =>
  (match.actions_regain ?? []).filter((a) => a && a.teamId === match.team && isRegainInPMAreaZone(a)).length;

const getPossessionData = (match: TeamInfo) => match.matchData?.possession ?? {};

export const getTeamPossessionPct = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  const team = getTeamPossessionMinutes(match);
  const opponent = getOpponentPossessionMinutes(match);
  const total = team + opponent;
  return total > 0 ? (team / total) * 100 : 0;
};

export const getOpponentPossessionPct = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  const team = getTeamPossessionMinutes(match);
  const opponent = getOpponentPossessionMinutes(match);
  const total = team + opponent;
  return total > 0 ? (opponent / total) * 100 : 0;
};

export const getDeadTimePct = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  const dead = getDeadTimeMinutes(match);
  const team = getTeamPossessionMinutes(match);
  const opponent = getOpponentPossessionMinutes(match);
  const total = dead + team + opponent;
  return total > 0 ? (dead / total) * 100 : 0;
};

export const getTeamPossessionMinutes = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  return toNumber(p.teamFirstHalf) + toNumber(p.teamSecondHalf);
};

export const getOpponentPossessionMinutes = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  return toNumber(p.opponentFirstHalf) + toNumber(p.opponentSecondHalf);
};

export const getDeadTimeMinutes = (match: TeamInfo): number => {
  const p = getPossessionData(match);
  return toNumber(p.deadFirstHalf) + toNumber(p.deadSecondHalf);
};

/** KPI acc8s_pct: % akcji 8s ACC (atak), gdzie jest strzał do 8s LUB wejście w PK do 8s (wystarczy jedno true). */
const get8sAccPct = (match: TeamInfo): number => {
  const entries = (match.acc8sEntries ?? []).filter((entry) => entry.teamContext === "attack");
  if (entries.length === 0) return 0;
  const successful = entries.filter((entry) => entry.isShotUnder8s || entry.isPKEntryUnder8s).length;
  return (successful / entries.length) * 100;
};

const getOneTouchPct = (match: TeamInfo): number => {
  const shots = getTeamShots(match).filter((shot) => isIn1TZoneCanonical(shot));
  if (shots.length === 0) return 0;
  // spójnie z logiką ze "Statystyki zespołu": liczymy tylko gdy isContact1 === true
  const oneTouchShots = shots.filter((shot) => shot.isContact1 === true).length;
  return (oneTouchShots / shots.length) * 100;
};

const getCounterpress5sPct = (match: TeamInfo): number => {
  // Zgodnie z logiką z "Statystyki zespołu":
  // mianownik: straty z zaznaczonym ✓ 5s lub ✗ 5s,
  // przy czym "isReaction5sNotApplicable" jest traktowane jak ✗ 5s.
  const losesWith5sFlags = (match.actions_loses ?? []).filter((action) => {
    if (!action) return false;
    if (action.isAut === true) return false;
    const hasBad5s = action.isBadReaction5s === true || (action as any).isReaction5sNotApplicable === true;
    return action.isReaction5s === true || hasBad5s;
  });

  if (losesWith5sFlags.length === 0) return 0;

  const reaction5sLoses = losesWith5sFlags.filter((action) => action.isReaction5s === true);
  return (reaction5sLoses.length / losesWith5sFlags.length) * 100;
};

/** % 5s (✓) w stratach z flagą 5s — jak kafelek KPI / Statystyki zespołu. */
export const getTeamCounterpress5sPctForMatch = (match: TeamInfo): number => getCounterpress5sPct(match);

const getRegainsPPToPKShot8sPct = (match: TeamInfo): number => {
  const regainsRaw = (match.actions_regain ?? []).filter((a) => a);
  if (!regainsRaw.length) return 0;

  const regainsOnOpponentHalfWithTimestamp = regainsRaw
    .filter((action) => isRegainInOppHalf(action as any))
    .map((action) => ({
      action,
      timestamp: (action as any).videoTimestampRaw ?? (action as any).videoTimestamp ?? 0,
    }))
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!regainsOnOpponentHalfWithTimestamp.length) return 0;

  const pkEntriesAttackWithTimestamp = (match.pkEntries ?? [])
    .filter((entry) => {
      if (!entry) return false;
      const teamContext = (entry.teamContext ?? "attack") as "attack" | "defense";
      return teamContext === "attack" || (entry.teamId && entry.teamId === match.team);
    })
    .map((entry) => ({
      entry,
      timestamp: (entry as any).videoTimestampRaw ?? (entry as any).videoTimestamp ?? 0,
    }))
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const shotsAttackWithTimestamp = (match.shots ?? [])
    .filter((shot) => shot.teamContext === "attack")
    .map((shot) => ({
      shot,
      timestamp: (shot as any).videoTimestampRaw ?? (shot as any).videoTimestamp ?? 0,
    }))
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const losesWithTimestamp = (match.actions_loses ?? [])
    .map((lose) => ({
      lose,
      timestamp: (lose as any).videoTimestampRaw ?? ((lose as any).videoTimestamp !== undefined ? (lose as any).videoTimestamp + 10 : 0),
    }))
    .filter((item) => item.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  let regainsPPWithPKOrShot8s = 0;

  regainsOnOpponentHalfWithTimestamp.forEach((regainItem) => {
    const regainTime = regainItem.timestamp;
    const timeWindowEnd = regainTime + 8;

    const pkEntryInWindow = pkEntriesAttackWithTimestamp.find(
      (item) => item.timestamp > regainTime && item.timestamp <= timeWindowEnd,
    );

    const shotInWindow = shotsAttackWithTimestamp.find(
      (item) => item.timestamp > regainTime && item.timestamp <= timeWindowEnd,
    );

    if (!pkEntryInWindow && !shotInWindow) {
      return;
    }

    const targetEventTime =
      pkEntryInWindow && shotInWindow
        ? Math.min(pkEntryInWindow.timestamp, shotInWindow.timestamp)
        : pkEntryInWindow
        ? pkEntryInWindow.timestamp
        : shotInWindow
        ? shotInWindow.timestamp
        : null;

    if (!targetEventTime) return;

    const hasLoseBetween = losesWithTimestamp.some(
      (loseItem) => loseItem.timestamp > regainTime && loseItem.timestamp < targetEventTime,
    );

    if (!hasLoseBetween) {
      regainsPPWithPKOrShot8s += 1;
    }
  });

  return regainsPPWithPKOrShot8s > 0
    ? (regainsPPWithPKOrShot8s / regainsOnOpponentHalfWithTimestamp.length) * 100
    : 0;
};

/** 8s ACC % (atak) — jak radar KPI. */
export const getTeamAcc8sPctForMatch = (match: TeamInfo): number => get8sAccPct(match);

/** 1T % w strefie 1T — jak radar KPI. */
export const getTeamOneTouchPctForMatch = (match: TeamInfo): number => getOneTouchPct(match);

/** 8s CA % — jak radar KPI / trendy `regains_pp_8s_ca_pct`. */
export const getTeamRegainsPp8sCaPctForMatch = (match: TeamInfo): number => getRegainsPPToPKShot8sPct(match);

export const calculateTrendyKpiValue = (match: TeamInfo, kpiId: string): number => {
  switch (kpiId) {
    case "xg_for":
      return getTeamXG(match);
    case "shots_for":
      return getTeamShots(match).length;
    case "pk_for":
      return getTeamPKEntries(match).length;
    case "pxt":
      return getPxt(match);
    case "pxt_p2p3":
      return getP2P3Count(match);
    case "regains_opp_half":
      return getRegainsInOpponentHalf(match);
    case "loses_pm_area":
      return getLosesInPMAreaCount(match);
    case "possession_pct":
      return getTeamPossessionPct(match);
    case "dead_time_pct":
      return getDeadTimePct(match);
    case "acc8s_pct":
      return get8sAccPct(match);
    case "regains_pp_8s_ca_pct":
      return getRegainsPPToPKShot8sPct(match);
    case "xg_per_shot": {
      const shots = getTeamShots(match).length;
      if (shots === 0) return 0;
      return getTeamXG(match) / shots;
    }
    case "one_touch_pct":
      return getOneTouchPct(match);
    case "pk_opponent":
      return getOpponentPKEntries(match).length;
    case "counterpress_5s_pct":
      return getCounterpress5sPct(match);
    default:
      return 0;
  }
};

export const getOpponentXGForMatch = (match: TeamInfo): number => getOpponentXG(match);

export type PearsonCorrelationOptions = {
  /**
   * Gdy true: pomija indeks meczu, jeśli którakolwiek z wartości to 0 (np. brak GPS / brak zdarzenia).
   * Dla wskaźników wyniku (1/0) ustaw zeroIsValidForX / zeroIsValidForY, inaczej wszystkie mecze z „nie” znikają z próby.
   */
  omitZeroValues?: boolean;
  /** Przy omitZeroValues: 0 w serii X to nadal obserwacja (np. brak wygranej). */
  zeroIsValidForX?: boolean;
  /** Przy omitZeroValues: 0 w serii Y to nadal obserwacja. */
  zeroIsValidForY?: boolean;
};

/** Opcje budowy macierzy: które kolumny traktują 0 jako obserwację (wynik meczu 1/0). */
export type BuildPearsonCorrelationMatrixOptions = PearsonCorrelationOptions & {
  binaryIndicatorColumnIndices?: ReadonlySet<number>;
};

/** Współczynnik korelacji Pearsona; null przy zbyt małej próbie lub braku wariancji. */
export function pearsonCorrelation(
  x: number[],
  y: number[],
  minSamples = 2,
  options?: PearsonCorrelationOptions,
): number | null {
  const len = Math.min(x.length, y.length);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < len; i += 1) {
    const xi = x[i];
    const yi = y[i];
    if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
    if (options?.omitZeroValues) {
      const dropX = xi === 0 && !options.zeroIsValidForX;
      const dropY = yi === 0 && !options.zeroIsValidForY;
      if (dropX || dropY) continue;
    }
    xs.push(xi);
    ys.push(yi);
  }
  const n = xs.length;
  if (n < minSamples) return null;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, xi, i) => sum + xi * ys[i], 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumYY = ys.reduce((a, b) => a + b * b, 0);
  const num = n * sumXY - sumX * sumY;
  const denom = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  if (denom === 0 || !Number.isFinite(denom)) return null;
  const r = num / denom;
  return Number.isFinite(r) ? r : null;
}

/** Macierz korelacji Pearsona między kolumnami (każda kolumna: wartości w kolejnych meczach). */
export function buildPearsonCorrelationMatrix(
  columns: number[][],
  minSamples = 3,
  options?: BuildPearsonCorrelationMatrixOptions,
): (number | null)[][] {
  const k = columns.length;
  const binary = options?.binaryIndicatorColumnIndices ?? new Set<number>();
  const baseOmit = options?.omitZeroValues;
  const out: (number | null)[][] = [];
  for (let i = 0; i < k; i += 1) {
    const row: (number | null)[] = [];
    for (let j = 0; j < k; j += 1) {
      row.push(
        pearsonCorrelation(columns[i], columns[j], minSamples, {
          omitZeroValues: baseOmit,
          zeroIsValidForX: binary.has(i),
          zeroIsValidForY: binary.has(j),
        }),
      );
    }
    out.push(row);
  }
  return out;
}

/** Sortowanie wg etykiet / średniej |r| (bez kolumny referencyjnej). */
export type CorrelationMatrixLabelSortMode = "trend" | "alpha_pl" | "avg_abs";

/** Wszystkie tryby sortowania macierzy korelacji (UI, eksport). */
export type CorrelationMatrixSortMode =
  | CorrelationMatrixLabelSortMode
  | "column_desc"
  | "column_asc";

export type CorrelationColumnSortDirection = "desc" | "asc";

/**
 * Permutacja wierszy i kolumn wg korelacji każdej metryki z wybraną kolumną (symetryczna macierz).
 * Dla wiersza referencyjnego: klucz sortowania = 1. Wartości null na końcu (stabilnie po indeksie).
 */
export function correlationMatrixRowOrderByReferenceColumn(
  matrix: (number | null)[][],
  refColumnIndex: number,
  direction: CorrelationColumnSortDirection,
): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  const ref = Math.max(0, Math.min(refColumnIndex, n - 1));

  const sortKey = (i: number): number | null => {
    if (i === ref) return 1;
    const v = matrix[i]?.[ref];
    return v != null && Number.isFinite(v) ? v : null;
  };

  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka == null && kb == null) return a - b;
    if (ka == null) return 1;
    if (kb == null) return -1;
    const diff = ka - kb;
    if (direction === "desc") {
      if (diff !== 0) return -diff;
    } else if (diff !== 0) {
      return diff;
    }
    return a - b;
  });
  return order;
}

/** Kolejność indeksów wierszy/kolumn macierzy korelacji (ta sama permutacja dla obu osi). */
export function correlationMatrixRowOrder(
  labels: string[],
  matrix: (number | null)[][],
  mode: CorrelationMatrixLabelSortMode,
): number[] {
  const n = labels.length;
  if (n === 0) return [];
  let order = Array.from({ length: n }, (_, i) => i);
  if (mode === "alpha_pl") {
    order = [...order].sort((a, b) => labels[a].localeCompare(labels[b], "pl", { sensitivity: "base" }));
  } else if (mode === "avg_abs") {
    const avgAbs = (i: number) => {
      let s = 0;
      let c = 0;
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const r = matrix[i]?.[j];
        if (r != null && Number.isFinite(r)) {
          s += Math.abs(r);
          c += 1;
        }
      }
      return c > 0 ? s / c : 0;
    };
    order = [...order].sort((a, b) => avgAbs(b) - avgAbs(a));
  }
  return order;
}

/** Permutacja kwadratowej macierzy (wiersze i kolumny tym samym porządkiem). */
export function permuteSquareCorrelationMatrix<T>(matrix: T[][], order: number[]): T[][] {
  return order.map((i) => order.map((j) => matrix[i][j]));
}

export const formatKpiValue = (value: number, unit: TrendyKpiUnit): string => {
  if (!Number.isFinite(value)) return "0";
  switch (unit) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    case "seconds":
      return `${Math.round(value)} s`;
    case "number":
    default:
      return value.toFixed(2);
  }
};
