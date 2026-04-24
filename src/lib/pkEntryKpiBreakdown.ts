/**
 * Klasyfikacja wejść PK dla rozbicia KPI na stronie statystyk zespołu.
 * Przy dryblingu i podaniu podzbiór „po regain” to isRegain ∧ typ (SFG nie ma tego wymiaru).
 */

export type PkEntryKpiBreakdownLike = {
  entryType?: string;
  actionCategory?: string;
  isRegain?: boolean;
};

export function isPkSfgEntry(e: PkEntryKpiBreakdownLike): boolean {
  return String(e.entryType || e.actionCategory || "").toLowerCase() === "sfg";
}

export function isPkDribbleEntry(e: PkEntryKpiBreakdownLike): boolean {
  return (e.entryType || "pass") === "dribble" && !isPkSfgEntry(e);
}

export function isPkPassEntry(e: PkEntryKpiBreakdownLike): boolean {
  return (e.entryType || "pass") === "pass" && !isPkSfgEntry(e);
}

export type PkEntryKpiBreakdownCounts = {
  total: number;
  sfgCount: number;
  dribbleCount: number;
  dribbleRegainCount: number;
  passCount: number;
  passRegainCount: number;
};

const emptyBreakdown: PkEntryKpiBreakdownCounts = {
  total: 0,
  sfgCount: 0,
  dribbleCount: 0,
  dribbleRegainCount: 0,
  passCount: 0,
  passRegainCount: 0,
};

export function getPkEntryKpiBreakdownCounts(
  entries: readonly PkEntryKpiBreakdownLike[] | null | undefined
): PkEntryKpiBreakdownCounts {
  if (!entries?.length) return { ...emptyBreakdown };

  let total = 0;
  let sfgCount = 0;
  let dribbleCount = 0;
  let dribbleRegainCount = 0;
  let passCount = 0;
  let passRegainCount = 0;

  for (const e of entries) {
    if (!e) continue;
    total += 1;
    const reg = !!e.isRegain;

    if (isPkSfgEntry(e)) {
      sfgCount += 1;
    } else if (isPkDribbleEntry(e)) {
      dribbleCount += 1;
      if (reg) dribbleRegainCount += 1;
    } else if (isPkPassEntry(e)) {
      passCount += 1;
      if (reg) passRegainCount += 1;
    }
  }

  return {
    total,
    sfgCount,
    dribbleCount,
    dribbleRegainCount,
    passCount,
    passRegainCount,
  };
}
