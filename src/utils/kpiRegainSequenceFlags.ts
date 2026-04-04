/**
 * Flagi z adnotacji (nie heurystyka): strzał / wejście w PK powiązane z sekwencją po przechwycie.
 * Używane m.in. przy KPI „8s CA” na stronie statystyk zespołu.
 */

export function isShotFromRegainSequence(shot: unknown): boolean {
  if (!shot || typeof shot !== 'object') return false;
  const s = shot as { actionType?: string; isRegain?: boolean };
  return s.actionType === 'regain' || s.isRegain === true;
}

export function isPkEntryFromRegainSequence(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as {
    isRegain?: boolean;
    entryType?: string;
    actionType?: string;
  };
  if (e.isRegain === true) return true;
  const t = String(e.entryType || e.actionType || '').toLowerCase();
  return t === 'regain';
}

/**
 * Breakdown „8s CA Strzał” vs „8s CA PK”: gdy PK ma isShot (adnotacja PK→strzał),
 * strzał po czasie tego PK nie dokłada drugiego punktu w wierszu strzałów.
 */
export function count8sCaShotForBreakdown(
  validShot: boolean,
  shotTimestamp: number | undefined,
  validPK: boolean,
  pkEntry: unknown,
  pkTimestamp: number | undefined
): boolean {
  if (!validShot || shotTimestamp === undefined) return false;
  if (!validPK || pkTimestamp === undefined) return true;
  if (!pkEntry || typeof pkEntry !== 'object') return true;
  if ((pkEntry as { isShot?: boolean }).isShot !== true) return true;
  return shotTimestamp < pkTimestamp;
}
