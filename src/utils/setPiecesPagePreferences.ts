const STORAGE_KEY = "setPieces_pageSelection";

export interface SetPiecesPageSelection {
  teamId: string;
  matchId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadSetPiecesPageSelection(): SetPiecesPageSelection | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SetPiecesPageSelection>;
    if (!isNonEmptyString(parsed.teamId) || !isNonEmptyString(parsed.matchId)) return null;
    return { teamId: parsed.teamId.trim(), matchId: parsed.matchId.trim() };
  } catch {
    return null;
  }
}

export function saveSetPiecesPageSelection(selection: SetPiecesPageSelection): void {
  if (!canUseLocalStorage()) return;
  if (!isNonEmptyString(selection.teamId) || !isNonEmptyString(selection.matchId)) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        teamId: selection.teamId.trim(),
        matchId: selection.matchId.trim(),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

/** Wybiera matchId: zapisany (gdy pasuje zespół), poprzedni w stanie lub pierwszy z listy. */
export function resolveSetPiecesMatchId(
  matches: { matchId: string }[],
  options: {
    savedSelection: SetPiecesPageSelection | null;
    teamId: string;
    previousMatchId: string;
  },
): string {
  if (matches.length === 0) return "";

  const { savedSelection, teamId, previousMatchId } = options;
  const ids = new Set(matches.map((match) => match.matchId));

  if (
    savedSelection?.teamId === teamId &&
    savedSelection.matchId &&
    ids.has(savedSelection.matchId)
  ) {
    return savedSelection.matchId;
  }

  if (previousMatchId && ids.has(previousMatchId)) {
    return previousMatchId;
  }

  return matches[0]?.matchId ?? "";
}
