import type { TeamInfo } from "@/types";

/** Normalizacja nazwy przeciwnika do porównań (bez rozróżniania wielkości liter, zbędnych spacji). */
export function normalizeOpponentNameForLogoLookup(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Zwraca logo przeciwnika z wcześniejszego meczu tego samego zespołu (`team`),
 * jeśli nazwa przeciwnika jest taka sama (po normalizacji). Preferowany jest najnowszy mecz po polu `date`.
 */
export function findSuggestedOpponentLogoFromMatches(
  matches: TeamInfo[],
  teamId: string,
  opponentNameRaw: string,
  options?: { excludeMatchId?: string }
): string | undefined {
  const key = normalizeOpponentNameForLogoLookup(opponentNameRaw);
  if (!key || !teamId) return undefined;

  const ex = options?.excludeMatchId;

  const candidates = matches.filter((m) => {
    if (m.team !== teamId) return false;
    if (ex && m.matchId === ex) return false;
    const logo = m.opponentLogo;
    if (typeof logo !== "string" || !logo.trim()) return false;
    return normalizeOpponentNameForLogoLookup(m.opponent ?? "") === key;
  });

  if (candidates.length === 0) return undefined;

  const sorted = [...candidates].sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return db.localeCompare(da);
    const ma = a.matchId ?? "";
    const mb = b.matchId ?? "";
    return mb.localeCompare(ma);
  });

  return sorted[0].opponentLogo;
}
