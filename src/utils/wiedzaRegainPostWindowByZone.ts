import { Action, TeamInfo } from "../types";
import { normalizeWiedzaPitchZone } from "./wiedzaZoneHeatmaps";

/** Okna czasu po przechwycie (s) — bez straty własnej w (t0, t0+W]. */
export const REGAIN_POST_WINDOW_SECS = [8, 12, 20] as const;
export type RegainPostWindowSec = (typeof REGAIN_POST_WINDOW_SECS)[number];

export type RegainPostWindowAgg = {
  /** Liczba przechwytów z tej strefy spełniających warunek „brak straty w oknie”. */
  eligibleRegains: number;
  totalPk: number;
  totalXg: number;
  /** Σ (ΔxT × pkt packing) na akcjach packing w oknie. */
  totalPxt: number;
  /** Suma samych ΔxT na packing (bez mnożenia przez pkt). */
  totalXtDelta: number;
  /** Suma punktów packing w oknie. */
  totalPackingPoints: number;
};

export type RegainZonePostWindowRow = {
  zone: string;
  byWindow: Record<RegainPostWindowSec, RegainPostWindowAgg>;
};

function emptyAgg(): RegainPostWindowAgg {
  return {
    eligibleRegains: 0,
    totalPk: 0,
    totalXg: 0,
    totalPxt: 0,
    totalXtDelta: 0,
    totalPackingPoints: 0,
  };
}

function loseTimeSeconds(l: Action): number {
  return l.videoTimestampRaw ?? (l.videoTimestamp !== undefined ? l.videoTimestamp + 10 : 0);
}

function regainTimeSeconds(r: Action): number {
  return r.videoTimestampRaw ?? r.videoTimestamp ?? 0;
}

/**
 * Dla każdej strefy przechwytu (regainAttackZone / opposite): sumy PK, xG, PxT, ΔxT, pkt packing
 * w 8 / 12 / 20 s po przechwycie. Liczymy tylko gdy **w całym oknie (t0, t0+W] nie ma straty** naszej drużyny
 * (pierwsza strata musi być po t0+W lub jej brak). Zgodnie z resztą Wiedzy: ten sam timestamp co w wykresach.
 */
export function buildRegainZonePostWindowStats(matches: TeamInfo[]): RegainZonePostWindowRow[] {
  const acc = new Map<
    string,
    { 8: RegainPostWindowAgg; 12: RegainPostWindowAgg; 20: RegainPostWindowAgg }
  >();

  const ensureZone = (zone: string) => {
    let row = acc.get(zone);
    if (!row) {
      row = { 8: emptyAgg(), 12: emptyAgg(), 20: emptyAgg() };
      acc.set(zone, row);
    }
    return row;
  };

  for (const match of matches) {
    const regains = match.actions_regain ?? [];
    const loses = match.actions_loses ?? [];
    const packing = match.actions_packing ?? [];
    const shots = match.shots ?? [];
    const pkEntries = match.pkEntries ?? [];

    const sortedLoses = loses
      .filter((l) => l && (l.isAut !== true) && (!l.teamId || l.teamId === match.team))
      .map((l) => ({ ...l, t: loseTimeSeconds(l) }))
      .filter((l) => l.t > 0)
      .sort((a, b) => a.t - b.t);

    const sortedPacking = packing
      .map((p) => ({ ...p, t: p.videoTimestampRaw ?? p.videoTimestamp ?? 0 }))
      .filter((p) => p.t > 0)
      .sort((a, b) => a.t - b.t);

    const sortedShots = shots
      .filter(
        (s) => s.teamContext === "attack" || (!s.teamContext && (!s.teamId || s.teamId === match.team)),
      )
      .map((s) => ({ ...s, t: s.videoTimestampRaw ?? s.videoTimestamp ?? 0 }))
      .filter((s) => s.t > 0)
      .sort((a, b) => a.t - b.t);

    const sortedPk = pkEntries
      .filter(
        (e) => e.teamContext === "attack" || (!e.teamContext && (!e.teamId || e.teamId === match.team)),
      )
      .map((e) => ({ ...e, t: e.videoTimestampRaw ?? e.videoTimestamp ?? 0 }))
      .filter((e) => e.t > 0)
      .sort((a, b) => a.t - b.t);

    for (const regain of regains) {
      if (!regain) continue;
      if (regain.teamId && regain.teamId !== match.team) continue;

      const zone = normalizeWiedzaPitchZone(regain.regainAttackZone || regain.oppositeZone);
      if (!zone) continue;

      const t0 = regainTimeSeconds(regain);
      if (t0 <= 0) continue;

      const playersBehind = regain.playersBehindBall ?? 0;
      const totalPlayers = regain.totalPlayersOnField ?? 11;
      const playersAhead = totalPlayers - playersBehind;
      const opponentsBehind = regain.opponentsBehindBall ?? 0;
      const totalOpponents = regain.totalOpponentsOnField ?? 11;
      const opponentsAhead = totalOpponents - opponentsBehind;
      if ((playersAhead === 0 && opponentsAhead === 0) || (playersAhead === 10 && opponentsAhead === 10)) {
        continue;
      }

      const nextLose = sortedLoses.find((l) => l.t > t0);

      for (const W of REGAIN_POST_WINDOW_SECS) {
        if (nextLose != null && nextLose.t <= t0 + W) continue;

        const tEnd = t0 + W;
        let sumPxt = 0;
        let sumXtDelta = 0;
        let sumPackingPts = 0;
        sortedPacking.forEach((p) => {
          if (p.t > t0 && p.t <= tEnd) {
            const xtDiff = (p.xTValueEnd || 0) - (p.xTValueStart || 0);
            sumPxt += xtDiff * (p.packingPoints || 0);
            sumXtDelta += xtDiff;
            sumPackingPts += p.packingPoints || 0;
          }
        });
        let sumXg = 0;
        sortedShots.forEach((s) => {
          if (s.t > t0 && s.t <= tEnd) sumXg += Number(s.xG || 0);
        });
        let countPk = 0;
        sortedPk.forEach((e) => {
          if (e.t > t0 && e.t <= tEnd) countPk += 1;
        });

        const zRow = ensureZone(zone);
        const a = zRow[W];
        a.eligibleRegains += 1;
        a.totalPk += countPk;
        a.totalXg += sumXg;
        a.totalPxt += sumPxt;
        a.totalXtDelta += sumXtDelta;
        a.totalPackingPoints += sumPackingPts;
      }
    }
  }

  const rows: RegainZonePostWindowRow[] = [...acc.entries()].map(([zone, byWindow]) => ({
    zone,
    byWindow,
  }));

  rows.sort((a, b) => {
    const pk20b = b.byWindow[20].totalPk;
    const pk20a = a.byWindow[20].totalPk;
    if (pk20b !== pk20a) return pk20b - pk20a;
    const n20b = b.byWindow[20].eligibleRegains;
    const n20a = a.byWindow[20].eligibleRegains;
    if (n20b !== n20a) return n20b - n20a;
    return a.zone.localeCompare(b.zone, "pl");
  });

  return rows;
}
