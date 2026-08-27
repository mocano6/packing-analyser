/** Parsowanie URL drużyny / meczu z Łączy Nas Piłka (rozgrywki). */

const TEAM_PATH_RE =
  /laczynaspilka\.pl\/rozgrywki\/druzyna\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const MATCH_PATH_RE =
  /laczynaspilka\.pl\/rozgrywki\/mecz\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuidFromPath(input: string, pathRe: RegExp): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const m = raw.match(pathRe);
  if (m?.[1]) return m[1].toLowerCase();
  if (UUID_RE.test(raw)) return raw.toLowerCase();
  return null;
}

export function parseLaczyTeamIdFromUrl(input: string): string | null {
  return parseUuidFromPath(input, TEAM_PATH_RE);
}

/** UUID meczu z URL …/rozgrywki/mecz/{uuid} albo samego UUID. */
export function parseLaczyMatchIdFromUrl(input: string): string | null {
  return parseUuidFromPath(input, MATCH_PATH_RE);
}

/** Kanoniczny URL strony drużyny (zakładka mecze). */
export function buildLaczyTeamPageUrl(teamId: string): string {
  return `https://www.laczynaspilka.pl/rozgrywki/druzyna/${teamId}?tab=tab-mecz`;
}

/** URL zakładki zawodników drużyny ŁNP. */
export function buildLaczyTeamPlayersPageUrl(teamId: string): string {
  return `https://www.laczynaspilka.pl/rozgrywki/druzyna/${teamId}?tab=tab-zawodnicy`;
}

/** Kanoniczny URL strony meczu ŁNP. */
export function buildLaczyMatchPageUrl(matchId: string): string {
  return `https://www.laczynaspilka.pl/rozgrywki/mecz/${matchId}`;
}
