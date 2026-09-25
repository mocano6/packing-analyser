import type { WyscoutCareerEntry, WyscoutMatchAdvancedStats, WyscoutSquadPlayer } from "@/types/wyscout";

export interface WyscoutMetricRow {
  key: string;
  label: string;
  team: string;
  opponent: string;
}

export interface WyscoutSideStats {
  teamId: string;
  name: string;
  xg: number | null;
  goals: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  ppda: number | null;
  possessionPercent: number | null;
  progressivePasses: number | null;
  passToFinalThirds: number | null;
  deepCompletedPasses: number | null;
  matchTempo: number | null;
  interceptions: number | null;
  counterAttacks: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function pickWyscoutTeamBlock(
  groups: Record<string, Record<string, unknown>> | undefined,
  teamWyId: number | string,
): Record<string, unknown> | null {
  if (!groups) return null;
  const key = String(teamWyId);
  const direct = groups[key];
  if (direct && typeof direct === "object") return direct;
  const found = Object.entries(groups).find(([k]) => k === key);
  return found && found[1] && typeof found[1] === "object" ? found[1] : null;
}

export function otherWyscoutTeamId(
  groups: Record<string, Record<string, unknown>> | undefined,
  teamWyId: number | string,
): string | null {
  if (!groups) return null;
  const self = String(teamWyId);
  const ids = Object.keys(groups).filter((key) => /^\d+$/.test(key) && key !== self);
  return ids[0] ?? null;
}

export function wyscoutTeamDisplayName(
  stats: WyscoutMatchAdvancedStats,
  teamId: string,
  fallback: string,
): string {
  const fromTeams = stats.teams?.[teamId]?.name;
  if (fromTeams) return fromTeams;
  const teamsData = asRecord(stats.match?.teamsData);
  const side = asRecord(teamsData?.[teamId]);
  const team = asRecord(side?.team);
  if (typeof team?.name === "string" && team.name.trim()) return team.name;
  return fallback;
}

function buildSide(
  stats: WyscoutMatchAdvancedStats,
  teamId: string,
  fallbackName: string,
): WyscoutSideStats {
  const general = pickWyscoutTeamBlock(stats.general, teamId) ?? {};
  const defence = pickWyscoutTeamBlock(stats.defence, teamId) ?? {};
  const passes = pickWyscoutTeamBlock(stats.passes, teamId) ?? {};
  const possession = pickWyscoutTeamBlock(stats.possession, teamId) ?? {};
  const attacks = pickWyscoutTeamBlock(stats.attacks, teamId) ?? {};
  return {
    teamId,
    name: wyscoutTeamDisplayName(stats, teamId, fallbackName),
    xg: asNum(general.xg),
    goals: asNum(general.goals),
    shots: asNum(general.shots),
    shotsOnTarget: asNum(general.shotsOnTarget),
    ppda: asNum(defence.ppda),
    possessionPercent: asNum(possession.possessionPercent),
    progressivePasses: asNum(passes.progressivePasses),
    passToFinalThirds: asNum(passes.passToFinalThirds),
    deepCompletedPasses: asNum(passes.deepCompletedPasses),
    matchTempo: asNum(passes.matchTempo),
    interceptions: asNum(defence.interceptions),
    counterAttacks: asNum(attacks.counterAttacks),
  };
}

export function buildWyscoutMatchSides(
  stats: WyscoutMatchAdvancedStats,
  teamWyId: number,
): { team: WyscoutSideStats; opponent: WyscoutSideStats | null } | null {
  const teamBlock = pickWyscoutTeamBlock(stats.general ?? stats.defence ?? stats.passes, teamWyId);
  if (!teamBlock) return null;
  const oppId = otherWyscoutTeamId(stats.general ?? stats.defence ?? stats.passes, teamWyId);
  return {
    team: buildSide(stats, String(teamWyId), "Nasz zespół"),
    opponent: oppId ? buildSide(stats, oppId, "Przeciwnik") : null,
  };
}

function fmt(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function buildWyscoutMetricRows(sides: {
  team: WyscoutSideStats;
  opponent: WyscoutSideStats | null;
}): WyscoutMetricRow[] {
  const t = sides.team;
  const o = sides.opponent;
  return [
    { key: "xg", label: "xG", team: fmt(t.xg, 2), opponent: fmt(o?.xg ?? null, 2) },
    { key: "goals", label: "Gole", team: fmt(t.goals, 0), opponent: fmt(o?.goals ?? null, 0) },
    { key: "shots", label: "Strzały", team: fmt(t.shots, 0), opponent: fmt(o?.shots ?? null, 0) },
    {
      key: "sot",
      label: "Strzały celne",
      team: fmt(t.shotsOnTarget, 0),
      opponent: fmt(o?.shotsOnTarget ?? null, 0),
    },
    { key: "ppda", label: "PPDA", team: fmt(t.ppda, 1), opponent: fmt(o?.ppda ?? null, 1) },
    {
      key: "poss",
      label: "Posiadanie %",
      team: fmt(t.possessionPercent, 0),
      opponent: fmt(o?.possessionPercent ?? null, 0),
    },
    {
      key: "prog",
      label: "Podania progresywne",
      team: fmt(t.progressivePasses, 0),
      opponent: fmt(o?.progressivePasses ?? null, 0),
    },
    {
      key: "f3",
      label: "Podania do 1/3",
      team: fmt(t.passToFinalThirds, 0),
      opponent: fmt(o?.passToFinalThirds ?? null, 0),
    },
    {
      key: "deep",
      label: "Deep completions",
      team: fmt(t.deepCompletedPasses, 0),
      opponent: fmt(o?.deepCompletedPasses ?? null, 0),
    },
    { key: "tempo", label: "Match tempo", team: fmt(t.matchTempo, 1), opponent: fmt(o?.matchTempo ?? null, 1) },
    {
      key: "int",
      label: "Przechwyty",
      team: fmt(t.interceptions, 0),
      opponent: fmt(o?.interceptions ?? null, 0),
    },
    {
      key: "ca",
      label: "Kontrataki",
      team: fmt(t.counterAttacks, 0),
      opponent: fmt(o?.counterAttacks ?? null, 0),
    },
  ];
}

export function sortWyscoutCareerNewest(entries: WyscoutCareerEntry[]): WyscoutCareerEntry[] {
  return [...entries].sort((a, b) => {
    const aDate = a.season?.startDate || "";
    const bDate = b.season?.startDate || "";
    return bDate.localeCompare(aDate);
  });
}

export function squadPlayerLabel(player: WyscoutSquadPlayer): string {
  const short = player.shortName?.trim();
  if (short) return short;
  const full = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
  return full || `#${player.wyId}`;
}
