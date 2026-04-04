/**
 * Agregacja liczby akcji per zawodnik dla tabel KPI (przechwyty / straty).
 */

export type PlayerShareRow = {
  playerId: string;
  playerName: string;
  count: number;
  sharePct: number;
};

export function countActionsByPlayerId(
  actions: ReadonlyArray<{ senderId?: string; playerId?: string } | null | undefined>
): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of actions) {
    if (!a) continue;
    const id = String(a.senderId || a.playerId || "").trim();
    if (!id) continue;
    m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

export function mapToSortedPlayerShareRows(
  countByPlayer: Map<string, number>,
  totalDenominator: number,
  resolveName: (playerId: string) => string
): PlayerShareRow[] {
  const rows: PlayerShareRow[] = [];
  for (const [playerId, count] of countByPlayer) {
    const sharePct = totalDenominator > 0 ? (count / totalDenominator) * 100 : 0;
    rows.push({
      playerId,
      playerName: resolveName(playerId),
      count,
      sharePct,
    });
  }
  return rows.sort((a, b) => b.count - a.count || a.playerName.localeCompare(b.playerName, "pl"));
}

export function playerStatsSummary(
  countByPlayer: Map<string, number>,
  totalDenominator: number
): { playersWithActions: number; maxSharePct: number } {
  const playersWithActions = countByPlayer.size;
  let maxSharePct = 0;
  for (const c of countByPlayer.values()) {
    const p = totalDenominator > 0 ? (c / totalDenominator) * 100 : 0;
    if (p > maxSharePct) maxSharePct = p;
  }
  return { playersWithActions, maxSharePct };
}

export type PlayerXtAgg = { xtAttack: number; xtDefense: number };

export type PlayerShareRowWithXt = PlayerShareRow & {
  xtAttack: number;
  xtDefense: number;
};

/** Łączy wiersze liczbowe z sumami xT (atak/obrona) per zawodnik. */
export function attachXtToPlayerShareRows(
  rows: PlayerShareRow[],
  xtByPlayer: Map<string, PlayerXtAgg>
): PlayerShareRowWithXt[] {
  return rows.map((row) => {
    const xt = xtByPlayer.get(row.playerId) ?? { xtAttack: 0, xtDefense: 0 };
    return {
      ...row,
      xtAttack: xt.xtAttack,
      xtDefense: xt.xtDefense,
    };
  });
}

export type KpiRegainsLosesPlayersSortCol = "playerName" | "count" | "xtAttack" | "xtDefense" | null;

export type KpiRegainsLosesPlayersSortState = {
  column: KpiRegainsLosesPlayersSortCol;
  dir: "asc" | "desc";
};

/** Sortowanie wierszy modala przechwyty/straty (zawodnik, liczba, xT). */
export function sortKpiRegainsLosesPlayerRows<
  R extends { playerName: string; count: number; xtAttack: number; xtDefense: number },
>(rows: R[], sortState: KpiRegainsLosesPlayersSortState): R[] {
  if (!sortState.column) return rows;
  const dir = sortState.dir;
  return [...rows].sort((a, b) => {
    if (sortState.column === "playerName") {
      const c = a.playerName.localeCompare(b.playerName, "pl");
      return dir === "asc" ? c : -c;
    }
    const va =
      sortState.column === "count"
        ? a.count
        : sortState.column === "xtAttack"
          ? a.xtAttack
          : a.xtDefense;
    const vb =
      sortState.column === "count"
        ? b.count
        : sortState.column === "xtAttack"
          ? b.xtAttack
          : b.xtDefense;
    return dir === "asc" ? va - vb : vb - va;
  });
}
