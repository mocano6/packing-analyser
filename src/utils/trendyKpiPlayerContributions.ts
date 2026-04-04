/**
 * Suma wkładów zawodników w wybranym KPI trendów (wszystkie mecze w zakresie).
 */

import type { Acc8sEntry, Action, PKEntry, Shot, TeamInfo } from "@/types";
import { isIn1TZoneCanonical } from "./pitchZones";
import { isLoseInPmAreaZone, isRegainInOpponentHalfZone } from "./trendyKpis";

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

function addCount(map: Map<string, number>, playerId: string | undefined, delta: number): void {
  const id = String(playerId ?? "").trim();
  if (!id || delta === 0) return;
  map.set(id, (map.get(id) || 0) + delta);
}

function addPxtSplit(map: Map<string, number>, senderId: string | undefined, receiverId: string | undefined, pxt: number): void {
  if (pxt === 0) return;
  const s = String(senderId ?? "").trim();
  const r = String(receiverId ?? "").trim();
  if (s && r && s !== r) {
    const half = pxt / 2;
    addCount(map, s, half);
    addCount(map, r, half);
  } else {
    addCount(map, s || r, pxt);
  }
}

export type TrendyPlayerContributionRow = {
  playerId: string;
  playerName: string;
  value: number;
  sharePct: number;
  /** Dodatkowa kolumna (np. strzały przy xG, ✓5s przy stratach) */
  extra?: string;
  /** Suma ΔxT (xT koniec − start) na packing — podział jak PxT */
  xtDeltaSum?: number;
  /** Suma punktów packing — podział jak PxT */
  packingPointsSum?: number;
};

export type TrendyPlayerContributionResult =
  | {
      kind: "table";
      rows: TrendyPlayerContributionRow[];
      totalValue: number;
      valueHeader: string;
      extraHeader?: string;
      footnote?: string;
      /** Dodatkowe kolumny przy KPI PxT */
      pxtColumns?: { xtHeader: string; packingHeader: string };
    }
  | { kind: "info"; message: string };

function buildTable(
  countByPlayer: Map<string, number>,
  totalDenominator: number,
  resolveName: (id: string) => string,
  valueHeader: string,
  extraByPlayer?: Map<string, string>,
  footnote?: string,
): TrendyPlayerContributionResult {
  const rows: TrendyPlayerContributionRow[] = [];
  for (const [playerId, value] of countByPlayer) {
    const sharePct = totalDenominator > 0 ? (value / totalDenominator) * 100 : 0;
    rows.push({
      playerId,
      playerName: resolveName(playerId),
      value,
      sharePct,
      extra: extraByPlayer?.get(playerId),
    });
  }
  rows.sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName, "pl"));
  if (rows.length === 0) {
    return {
      kind: "table",
      rows: [],
      totalValue: totalDenominator,
      valueHeader,
      extraHeader: extraByPlayer ? "Szczegół" : undefined,
      footnote: footnote ?? "Brak przypisanych zawodników w danych.",
    };
  }
  return {
    kind: "table",
    rows,
    totalValue: totalDenominator,
    valueHeader,
    extraHeader: extraByPlayer ? "Szczegół" : undefined,
    footnote,
  };
}

/**
 * Agregacja wkładów zawodników dla jednego KPI i listy meczów (ten sam zakres co analiza trendów).
 */
export function getTrendyKpiPlayerContributions(
  matches: TeamInfo[],
  kpiId: string,
  resolveName: (playerId: string) => string,
): TrendyPlayerContributionResult {
  if (matches.length === 0) {
    return { kind: "info", message: "Najpierw uruchom analizę (wybierz mecze)." };
  }

  switch (kpiId) {
    case "possession_pct":
    case "dead_time_pct":
      return {
        kind: "info",
        message:
          "Posiadanie i czas martwy są zapisywane na poziomie meczu — w aplikacji nie ma podziału tej metryki na zawodników.",
      };

    case "xg_for": {
      const map = new Map<string, number>();
      let totalXg = 0;
      for (const match of matches) {
        for (const shot of match.shots ?? []) {
          if (!isAttackShot(shot)) continue;
          const xg = toNumber(shot.xG);
          totalXg += xg;
          addCount(map, shot.playerId, xg);
        }
      }
      const shotsBy = new Map<string, number>();
      for (const match of matches) {
        for (const shot of match.shots ?? []) {
          if (!isAttackShot(shot)) continue;
          addCount(shotsBy, shot.playerId, 1);
        }
      }
      const extra = new Map<string, string>();
      for (const [pid, xg] of map) {
        const sh = shotsBy.get(pid) ?? 0;
        extra.set(pid, `${sh} strz.`);
      }
      return buildTable(map, totalXg, resolveName, "Suma xG", extra);
    }

    case "shots_for": {
      const map = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const shot of match.shots ?? []) {
          if (!isAttackShot(shot)) continue;
          total += 1;
          addCount(map, shot.playerId, 1);
        }
      }
      return buildTable(map, total, resolveName, "Strzały");
    }

    case "pk_for": {
      const map = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const entry of match.pkEntries ?? []) {
          if (!isAttackPK(entry)) continue;
          total += 1;
          const pid = entry.senderId || entry.receiverId;
          addCount(map, pid, 1);
        }
      }
      return buildTable(map, total, resolveName, "Wejścia PK");
    }

    case "pxt": {
      const pxtMap = new Map<string, number>();
      const xtMap = new Map<string, number>();
      const ppMap = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const action of match.actions_packing ?? []) {
          if (!action) continue;
          const xtDiff = toNumber(action.xTValueEnd) - toNumber(action.xTValueStart);
          const pp = toNumber(action.packingPoints);
          const pxt = xtDiff * pp;
          total += pxt;
          addPxtSplit(pxtMap, action.senderId, action.receiverId, pxt);
          addPxtSplit(xtMap, action.senderId, action.receiverId, xtDiff);
          addPxtSplit(ppMap, action.senderId, action.receiverId, pp);
        }
      }
      const rows: TrendyPlayerContributionRow[] = [];
      for (const playerId of new Set([...pxtMap.keys(), ...xtMap.keys(), ...ppMap.keys()])) {
        const value = pxtMap.get(playerId) ?? 0;
        const sharePct = total > 0 ? (value / total) * 100 : 0;
        rows.push({
          playerId,
          playerName: resolveName(playerId),
          value,
          sharePct,
          xtDeltaSum: xtMap.get(playerId) ?? 0,
          packingPointsSum: ppMap.get(playerId) ?? 0,
        });
      }
      rows.sort((a, b) => b.value - a.value || a.playerName.localeCompare(b.playerName, "pl"));
      if (rows.length === 0) {
        return {
          kind: "table",
          rows: [],
          totalValue: total,
          valueHeader: "PxT (łącznie)",
          footnote: "Brak przypisanych zawodników w danych.",
          pxtColumns: { xtHeader: "Suma ΔxT", packingHeader: "Suma packing" },
        };
      }
      return {
        kind: "table",
        rows,
        totalValue: total,
        valueHeader: "PxT (łącznie)",
        pxtColumns: { xtHeader: "Suma ΔxT", packingHeader: "Suma packing" },
      };
    }

    case "pxt_p2p3": {
      const map = new Map<string, number>();
      let total = 0;
      const bump = (a: Action | null | undefined) => {
        if (!a) return;
        if (Boolean((a as Action).isP2)) {
          total += 1;
          addCount(map, a.senderId, 1);
        }
        if (Boolean((a as Action).isP3)) {
          total += 1;
          addCount(map, a.senderId, 1);
        }
      };
      for (const match of matches) {
        for (const a of match.actions_packing ?? []) bump(a);
        for (const a of match.actions_regain ?? []) bump(a);
      }
      return buildTable(map, total, resolveName, "Akcje P2+P3 (liczba flag)");
    }

    case "regains_opp_half": {
      const map = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const a of match.actions_regain ?? []) {
          if (!a || !isRegainInOpponentHalfZone(a)) continue;
          total += 1;
          addCount(map, a.senderId, 1);
        }
      }
      return buildTable(map, total, resolveName, "Przechwyty (PP)");
    }

    case "loses_pm_area": {
      const map = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const a of match.actions_loses ?? []) {
          if (!a || !isLoseInPmAreaZone(a)) continue;
          total += 1;
          addCount(map, a.senderId, 1);
        }
      }
      return buildTable(map, total, resolveName, "Straty PM");
    }

    case "acc8s_pct": {
      const map = new Map<string, number>();
      let entryCount = 0;
      for (const match of matches) {
        const entries = (match.acc8sEntries ?? []).filter((e: Acc8sEntry) => e.teamContext === "attack");
        for (const e of entries) {
          entryCount += 1;
          const ids = (e.passingPlayerIds ?? []).filter(Boolean);
          if (ids.length === 0) continue;
          const w = 1 / ids.length;
          for (const id of ids) addCount(map, id, w);
        }
      }
      return buildTable(map, entryCount, resolveName, "Udział w akcjach 8s ACC (waga)", undefined, `Łącznie akcji (atak): ${entryCount}. Przy wielu zawodnikach w jednym wpisie kredyt jest dzielony równo.`);
    }

    case "counterpress_5s_pct": {
      const denomMap = new Map<string, number>();
      const okMap = new Map<string, number>();
      for (const match of matches) {
        const losesWith5sFlags = (match.actions_loses ?? []).filter((action) => {
          if (!action || action.isAut === true) return false;
          const hasBad5s =
            action.isBadReaction5s === true || (action as Action & { isReaction5sNotApplicable?: boolean }).isReaction5sNotApplicable === true;
          return action.isReaction5s === true || hasBad5s;
        });
        for (const action of losesWith5sFlags) {
          addCount(denomMap, action.senderId, 1);
          if (action.isReaction5s === true) addCount(okMap, action.senderId, 1);
        }
      }
      let totalDenom = 0;
      for (const v of denomMap.values()) totalDenom += v;
      const extra = new Map<string, string>();
      for (const pid of new Set([...denomMap.keys(), ...okMap.keys()])) {
        const d = denomMap.get(pid) ?? 0;
        const o = okMap.get(pid) ?? 0;
        extra.set(pid, `${Math.round(o)}/${Math.round(d)} ✓5s`);
      }
      return buildTable(denomMap, totalDenom, resolveName, "Straty z reakcją 5s", extra);
    }

    case "xg_per_shot": {
      const xgMap = new Map<string, number>();
      const shotMap = new Map<string, number>();
      for (const match of matches) {
        for (const shot of match.shots ?? []) {
          if (!isAttackShot(shot)) continue;
          const xg = toNumber(shot.xG);
          addCount(xgMap, shot.playerId, xg);
          addCount(shotMap, shot.playerId, 1);
        }
      }
      let totalXg = 0;
      const pids = new Set([...xgMap.keys(), ...shotMap.keys()]);
      for (const pid of pids) {
        totalXg += xgMap.get(pid) ?? 0;
      }
      const rows: TrendyPlayerContributionRow[] = [];
      for (const pid of pids) {
        const xg = xgMap.get(pid) ?? 0;
        const sh = shotMap.get(pid) ?? 0;
        const ratio = sh > 0 ? xg / sh : 0;
        rows.push({
          playerId: pid,
          playerName: resolveName(pid),
          value: ratio,
          sharePct: totalXg > 0 ? (xg / totalXg) * 100 : 0,
          extra: `${xg.toFixed(2)} xG / ${sh} strz.`,
        });
      }
      rows.sort((a, b) => (xgMap.get(b.playerId) ?? 0) - (xgMap.get(a.playerId) ?? 0) || a.playerName.localeCompare(b.playerName, "pl"));
      if (rows.length === 0) {
        return {
          kind: "table",
          rows: [],
          totalValue: 0,
          valueHeader: "xG / strzał (śr.)",
          extraHeader: "Szczegół",
          footnote: "Brak strzałów w ataku w zakresie.",
        };
      }
      return {
        kind: "table",
        rows,
        totalValue: totalXg,
        valueHeader: "xG / strzał (śr.)",
        extraHeader: "Szczegół",
        footnote: "Kolumna % to udział w sumie xG zespołu w zakresie.",
      };
    }

    case "one_touch_pct": {
      const eligibleMap = new Map<string, number>();
      const oneTouchMap = new Map<string, number>();
      for (const match of matches) {
        const shots = (match.shots ?? []).filter(isAttackShot).filter((shot) => isIn1TZoneCanonical(shot));
        for (const shot of shots) {
          addCount(eligibleMap, shot.playerId, 1);
          if (shot.isContact1 === true) addCount(oneTouchMap, shot.playerId, 1);
        }
      }
      let totalEligible = 0;
      for (const el of eligibleMap.values()) totalEligible += el;
      const rows: TrendyPlayerContributionRow[] = [];
      for (const pid of eligibleMap.keys()) {
        const el = eligibleMap.get(pid) ?? 0;
        const ot = oneTouchMap.get(pid) ?? 0;
        const pct = el > 0 ? (ot / el) * 100 : 0;
        rows.push({
          playerId: pid,
          playerName: resolveName(pid),
          value: pct,
          sharePct: totalEligible > 0 ? (el / totalEligible) * 100 : 0,
          extra: `${ot}/${el} 1T`,
        });
      }
      rows.sort((a, b) => (eligibleMap.get(b.playerId) ?? 0) - (eligibleMap.get(a.playerId) ?? 0) || a.playerName.localeCompare(b.playerName, "pl"));
      if (rows.length === 0) {
        return {
          kind: "table",
          rows: [],
          totalValue: 0,
          valueHeader: "1T % (strefa 1T)",
          extraHeader: "Balans",
          footnote: "Brak strzałów w strefie 1T w zakresie.",
        };
      }
      return {
        kind: "table",
        rows,
        totalValue: totalEligible,
        valueHeader: "1T % (strefa 1T)",
        extraHeader: "Balans",
        footnote: "Kolumna % to udział w liczbie kwalifikujących się strzałów w strefie 1T (wolumen).",
      };
    }

    case "pk_opponent": {
      const map = new Map<string, number>();
      let total = 0;
      for (const match of matches) {
        for (const entry of match.pkEntries ?? []) {
          if ((entry.teamContext ?? "attack") !== "defense") continue;
          total += 1;
          addCount(map, entry.senderId || entry.receiverId, 1);
        }
      }
      return buildTable(
        map,
        total,
        resolveName,
        "Wejścia PK przeciwnika (wpisy obronne)",
        undefined,
        "Liczba według wpisów w dokumencie meczu (kontekst obrony).",
      );
    }

    case "regains_pp_8s_ca_pct": {
      const map = new Map<string, number>();
      let totalRegains = 0;
      for (const match of matches) {
        for (const a of match.actions_regain ?? []) {
          if (!a || !isRegainInOpponentHalfZone(a)) continue;
          totalRegains += 1;
          addCount(map, a.senderId, 1);
        }
      }
      return buildTable(
        map,
        totalRegains,
        resolveName,
        "Przechwyty PP (szt.)",
        undefined,
        "Liczba przechwytów z akcją na połowie przeciwnika (jak część KPI). Pełna zgodność z % „8s CA” wymagałaby przypisania sekwencji PK/strzał do każdego przechwytu.",
      );
    }

    default:
      return { kind: "info", message: "Dla tego KPI nie zdefiniowano jeszcze podziału na zawodników." };
  }
}
