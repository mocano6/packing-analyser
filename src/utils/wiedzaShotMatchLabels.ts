import { TeamInfo } from "@/types";

/** Etykieta meczu do dymki strzału na mapie Wiedzy (wiele meczów w jednej próbie). */
export function formatWiedzaShotMatchLabel(
  match: TeamInfo,
  teamNameById: Map<string, string>,
): string {
  const teamName = teamNameById.get(match.team) ?? match.team;
  const opponentName = teamNameById.get(match.opponent) ?? match.opponent;
  const datePart = match.date ? ` · ${match.date}` : "";
  const compPart = match.competition ? ` · ${match.competition}` : "";
  return `${teamName} vs ${opponentName}${datePart}${compPart}`;
}

export function buildWiedzaShotMatchLabelLookup(
  matches: TeamInfo[],
  teams: Array<{ id: string; name: string }>,
): Map<string, string> {
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const out = new Map<string, string>();

  for (const match of matches) {
    const matchId = match.matchId ?? (match as { id?: string }).id;
    if (!matchId) continue;
    out.set(matchId, formatWiedzaShotMatchLabel(match, teamNameById));
  }

  return out;
}

export function getWiedzaShotMatchLabel(
  shotMatchId: string | undefined,
  lookup: Map<string, string>,
): string | undefined {
  if (!shotMatchId) return undefined;
  return lookup.get(shotMatchId);
}
