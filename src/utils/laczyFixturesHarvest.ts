import type { LaczyTeamFixture } from "@/types/trainingMicrocycle";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const TEAM_RE = new RegExp(`/teams/(${UUID})(?:\\?|$)`, "i");
const DICT_RE = new RegExp(`/teams/(${UUID})/play-dictionaries`, "i");
const PLAYED_RE = new RegExp(`/teams/(${UUID})/plays/(${UUID})/played-matches`, "i");
const UPCOMING_RE = new RegExp(`/teams/(${UUID})/plays/(${UUID})/not-played-matches`, "i");

export interface HarvestedApiHit {
  url: string;
  status: number;
  data: unknown;
}

interface RawTeamSide {
  id?: string;
  name?: string;
}

export interface RawLaczyTeamMatch {
  matchId?: string;
  id?: string;
  dateTime?: string;
  state?: string;
  stadium?: string;
  host?: RawTeamSide;
  guest?: RawTeamSide;
  scores?: { final?: string; fullTime?: string };
}

interface RawPlayDictEntry {
  id?: string;
  playId?: string;
  name?: string;
  title?: string;
  seasonName?: string;
  isCurrent?: boolean;
}

/** Endpoint teams/{id} zwraca kopertę { team: { name } }. */
interface RawTeamEnvelope {
  name?: string;
  team?: { name?: string };
}

export interface ParsedLaczyFixturesHarvest {
  teamName?: string;
  plays: Array<{ id: string; name: string }>;
  fixtures: LaczyTeamFixture[];
  matchListStatusOk: boolean;
}

/** Lista z API bywa tablicą albo kopertą `{ data|matches|items }`. */
export function asLaczyList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  const rec = data as Record<string, unknown>;
  for (const key of ["matches", "items", "results", "data"]) {
    if (Array.isArray(rec[key])) return rec[key] as T[];
  }
  return [];
}

function playIdOf(entry: RawPlayDictEntry): string | null {
  const id = entry.playId || entry.id;
  return id && typeof id === "string" ? id : null;
}

function playNameOf(entry: RawPlayDictEntry): string {
  return String(entry.name || entry.title || entry.seasonName || "Rozgrywki").slice(0, 160);
}

/** Host bywa wersjonowany (pro, pro2, …) — łapiemy każdy wariant. */
export function isLaczyCompetitionApiUrl(url: string): boolean {
  return /competition-api-pro\d*\.laczynaspilka\.pl/i.test(url);
}

export function isLaczyMatchListUrl(url: string): boolean {
  return PLAYED_RE.test(url) || UPCOMING_RE.test(url);
}

export function mapRawLaczyMatch(
  raw: RawLaczyTeamMatch,
  playId: string,
  playName: string
): LaczyTeamFixture | null {
  const matchId = raw.matchId || raw.id;
  if (!matchId || !raw.dateTime) return null;
  const hostId = raw.host?.id || "";
  const guestId = raw.guest?.id || "";
  if (!hostId && !guestId) return null;
  return {
    matchId,
    dateTime: raw.dateTime,
    state: raw.state || "",
    playId,
    playName,
    hostId,
    hostName: raw.host?.name || "Gospodarz",
    guestId,
    guestName: raw.guest?.name || "Gość",
    stadium: raw.stadium,
    scoreFinal: raw.scores?.final ?? raw.scores?.fullTime ?? null,
  };
}

/** Składa terminarz z odpowiedzi, które sama strona drużyny ŁNP pobrała w tle. */
export function parseHarvestedLaczyFixtures(
  teamId: string,
  hits: HarvestedApiHit[]
): ParsedLaczyFixturesHarvest {
  const wanted = teamId.toLowerCase();
  const playNames = new Map<string, string>();
  let teamName: string | undefined;
  const fixtures: LaczyTeamFixture[] = [];
  const seen = new Set<string>();
  let matchListStatusOk = false;

  const okHits = hits.filter((h) => h.status === 200);

  for (const hit of okHits) {
    if (DICT_RE.test(hit.url) && hit.url.toLowerCase().includes(wanted)) {
      for (const entry of asLaczyList<RawPlayDictEntry>(hit.data)) {
        const id = playIdOf(entry);
        if (id) playNames.set(id, playNameOf(entry));
      }
    }
  }

  for (const hit of okHits) {
    const teamOnly = hit.url.match(TEAM_RE);
    if (teamOnly && teamOnly[1].toLowerCase() === wanted && !DICT_RE.test(hit.url)) {
      const envelope = hit.data as RawTeamEnvelope | null;
      const name = envelope?.team?.name || envelope?.name;
      if (name && name.trim()) teamName = name.trim().slice(0, 160);
    }

    const playedHit = hit.url.match(PLAYED_RE);
    const upcomingHit = hit.url.match(UPCOMING_RE);
    const listHit = playedHit || upcomingHit;
    if (!listHit || listHit[1].toLowerCase() !== wanted) continue;
    matchListStatusOk = true;
    if (upcomingHit) continue;
    const playId = listHit[2];
    const playName = playNames.get(playId) || "Rozgrywki";
    for (const raw of asLaczyList<RawLaczyTeamMatch>(hit.data)) {
      const mapped = mapRawLaczyMatch(raw, playId, playName);
      if (!mapped || seen.has(mapped.matchId)) continue;
      seen.add(mapped.matchId);
      fixtures.push(mapped);
    }
  }

  for (const hit of okHits) {
    const upcomingHit = hit.url.match(UPCOMING_RE);
    if (!upcomingHit || upcomingHit[1].toLowerCase() !== wanted) continue;
    const playId = upcomingHit[2];
    const playName = playNames.get(playId) || "Rozgrywki";
    for (const raw of asLaczyList<RawLaczyTeamMatch>(hit.data)) {
      const mapped = mapRawLaczyMatch(raw, playId, playName);
      if (!mapped || seen.has(mapped.matchId)) continue;
      seen.add(mapped.matchId);
      fixtures.push(mapped);
    }
  }

  const plays = [...playNames.entries()].map(([id, name]) => ({ id, name }));
  fixtures.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  return { teamName, plays, fixtures, matchListStatusOk };
}

export function harvestMatchListCoverage(
  hits: HarvestedApiHit[],
  teamId: string
): { played: boolean; upcoming: boolean } {
  const wanted = teamId.toLowerCase();
  let played = false;
  let upcoming = false;
  for (const h of hits) {
    if (h.status !== 200 || !h.url.toLowerCase().includes(wanted)) continue;
    if (PLAYED_RE.test(h.url)) played = true;
    if (UPCOMING_RE.test(h.url)) upcoming = true;
  }
  return { played, upcoming };
}

export function harvestHasMatchLists(hits: HarvestedApiHit[], teamId: string): boolean {
  const c = harvestMatchListCoverage(hits, teamId);
  return c.played || c.upcoming;
}

/** Obie listy — inaczej harvest urywa się na samych przyszłych i gubi świeżo rozegrany mecz. */
export function harvestHasCompleteMatchLists(hits: HarvestedApiHit[], teamId: string): boolean {
  const c = harvestMatchListCoverage(hits, teamId);
  return c.played && c.upcoming;
}
