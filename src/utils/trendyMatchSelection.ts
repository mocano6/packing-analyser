export type TrendyMatchIdentity = {
  matchId?: string;
  date?: string;
  opponent?: string;
};

export function getTrendyMatchId(match: TrendyMatchIdentity, index: number): string {
  const matchId = match.matchId?.trim();
  if (matchId) return matchId;
  return `fallback:${match.date ?? ""}:${match.opponent ?? ""}:${index}`;
}

export function toggleExcludedMatchId(excluded: ReadonlySet<string>, matchId: string): Set<string> {
  const next = new Set(excluded);
  if (next.has(matchId)) {
    next.delete(matchId);
  } else {
    next.add(matchId);
  }
  return next;
}

export function isTrendyMatchIncluded(excluded: ReadonlySet<string>, matchId: string): boolean {
  return !excluded.has(matchId);
}

export function filterIncludedMatches<T extends TrendyMatchIdentity>(
  matches: T[],
  excluded: ReadonlySet<string>,
): T[] {
  return matches.filter((match, index) => isTrendyMatchIncluded(excluded, getTrendyMatchId(match, index)));
}

export function trendyMatchCountNoun(count: number): string {
  if (count === 1) return "mecz";
  if (count > 1 && count < 5) return "mecze";
  return "meczów";
}

export function formatTrendyIncludedMatchCount(included: number, total: number): {
  numberLabel: string;
  noun: string;
} {
  if (included === total) {
    return { numberLabel: String(total), noun: trendyMatchCountNoun(total) };
  }
  return {
    numberLabel: `${included} z ${total}`,
    noun: trendyMatchCountNoun(total),
  };
}
