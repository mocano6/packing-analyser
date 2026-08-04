/** Parsowanie URL drużyny z Łączy Nas Piłka (rozgrywki). */

const TEAM_PATH_RE =
  /laczynaspilka\.pl\/rozgrywki\/druzyna\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseLaczyTeamIdFromUrl(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw.toLowerCase();
  const m = raw.match(TEAM_PATH_RE);
  return m?.[1] ? m[1].toLowerCase() : null;
}

/** Kanoniczny URL strony drużyny (zakładka mecze). */
export function buildLaczyTeamPageUrl(teamId: string): string {
  return `https://www.laczynaspilka.pl/rozgrywki/druzyna/${teamId}?tab=tab-mecz`;
}
