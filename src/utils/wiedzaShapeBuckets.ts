/**
 * Buckety „kształtu” kontry / straty: liczba partnerów lub przeciwników nad piłką albo różnica (nasi − oni).
 * Te same przedziały co na wykresie słupkowym Wiedzy.
 */

export type WiedzaShapeGrouping = "partners" | "opponents" | "diff";

export type WiedzaShapeBucketMeta = { key: string; label: string; sortOrder: number };

export function bucketMetaForWiedzaShape(
  partners: number,
  opponents: number,
  diff: number,
  grouping: WiedzaShapeGrouping,
): WiedzaShapeBucketMeta {
  if (grouping === "diff") {
    if (diff < -2) return { key: "<-2", label: "Poniżej -2", sortOrder: 1 };
    if (diff >= -2 && diff <= -1) return { key: "-2to-1", label: "Od -2 do -1", sortOrder: 2 };
    if (diff === 0) return { key: "0", label: "0 (Równowaga)", sortOrder: 3 };
    if (diff >= 1 && diff <= 2) return { key: "1to2", label: "Od +1 do +2", sortOrder: 4 };
    return { key: ">2", label: "Powyżej +2", sortOrder: 5 };
  }
  const p = grouping === "partners" ? partners : opponents;
  if (p <= 2) return { key: "1-2", label: "1 - 2", sortOrder: 1 };
  if (p <= 4) return { key: "3-4", label: "3 - 4", sortOrder: 2 };
  if (p <= 6) return { key: "5-6", label: "5 - 6", sortOrder: 3 };
  return { key: "7+", label: "7 - 9", sortOrder: 4 };
}

export type RegainShapeInputRow = {
  partners: number;
  opponents: number;
  diff: number;
  pxt: number;
  xg: number;
  pk: number;
  xtDelta: number;
  packingPoints: number;
  hasLose: boolean;
};

export type RegainShapeBucketSummary = WiedzaShapeBucketMeta & {
  n: number;
  avgPxt: number;
  avgXg: number;
  avgPk: number;
  avgXtDelta: number;
  avgPackingPts: number;
  losePct: number;
};

export function summarizeRegainShapeBuckets(
  rows: RegainShapeInputRow[],
  grouping: WiedzaShapeGrouping,
): RegainShapeBucketSummary[] {
  type Acc = {
    meta: WiedzaShapeBucketMeta;
    n: number;
    sumPxt: number;
    sumXg: number;
    sumPk: number;
    sumXtDelta: number;
    sumPack: number;
    loses: number;
  };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const meta = bucketMetaForWiedzaShape(r.partners, r.opponents, r.diff, grouping);
    let a = map.get(meta.key);
    if (!a) {
      a = { meta, n: 0, sumPxt: 0, sumXg: 0, sumPk: 0, sumXtDelta: 0, sumPack: 0, loses: 0 };
      map.set(meta.key, a);
    }
    a.n += 1;
    a.sumPxt += r.pxt;
    a.sumXg += r.xg;
    a.sumPk += r.pk;
    a.sumXtDelta += r.xtDelta;
    a.sumPack += r.packingPoints;
    if (r.hasLose) a.loses += 1;
  }

  return [...map.values()]
    .sort((x, y) => x.meta.sortOrder - y.meta.sortOrder)
    .map((a) => {
      const n = a.n;
      return {
        ...a.meta,
        n,
        avgPxt: n > 0 ? a.sumPxt / n : 0,
        avgXg: n > 0 ? a.sumXg / n : 0,
        avgPk: n > 0 ? a.sumPk / n : 0,
        avgXtDelta: n > 0 ? a.sumXtDelta / n : 0,
        avgPackingPts: n > 0 ? a.sumPack / n : 0,
        losePct: n > 0 ? (a.loses / n) * 100 : 0,
      };
    });
}

export type LoseShapeInputRow = {
  partners: number;
  opponents: number;
  diff: number;
  opponentXg: number;
  opponentPk: number;
  hasOpponentLose: boolean;
};

export type LoseShapeBucketSummary = WiedzaShapeBucketMeta & {
  n: number;
  avgOpponentXg: number;
  avgOpponentPk: number;
  regainPct: number;
};

export function summarizeLoseShapeBuckets(
  rows: LoseShapeInputRow[],
  grouping: WiedzaShapeGrouping,
): LoseShapeBucketSummary[] {
  type Acc = { meta: WiedzaShapeBucketMeta; n: number; sumXg: number; sumPk: number; regains: number };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const meta = bucketMetaForWiedzaShape(r.partners, r.opponents, r.diff, grouping);
    let a = map.get(meta.key);
    if (!a) {
      a = { meta, n: 0, sumXg: 0, sumPk: 0, regains: 0 };
      map.set(meta.key, a);
    }
    a.n += 1;
    a.sumXg += r.opponentXg;
    a.sumPk += r.opponentPk;
    if (r.hasOpponentLose) a.regains += 1;
  }

  return [...map.values()]
    .sort((x, y) => x.meta.sortOrder - y.meta.sortOrder)
    .map((a) => {
      const n = a.n;
      return {
        ...a.meta,
        n,
        avgOpponentXg: n > 0 ? a.sumXg / n : 0,
        avgOpponentPk: n > 0 ? a.sumPk / n : 0,
        regainPct: n > 0 ? (a.regains / n) * 100 : 0,
      };
    });
}
