import type { WyscoutTeamMatch } from "@/types/wyscout";

/** Normalizuje datę LOOKBALL / Wyscout do YYYY-MM-DD (UTC dla ISO). */
export function normalizeWyscoutDateKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function findWyscoutMatchByDate(
  matches: WyscoutTeamMatch[],
  lookballDate: string | undefined | null,
): WyscoutTeamMatch | null {
  const key = normalizeWyscoutDateKey(lookballDate);
  if (!key) return null;
  return (
    matches.find((match) => {
      const utc = normalizeWyscoutDateKey(match.dateutc);
      const local = normalizeWyscoutDateKey(match.date);
      return utc === key || local === key;
    }) ?? null
  );
}

export function sortWyscoutMatchesNewestFirst(matches: WyscoutTeamMatch[]): WyscoutTeamMatch[] {
  return [...matches].sort((a, b) => {
    const aKey = a.dateutc || a.date || "";
    const bKey = b.dateutc || b.date || "";
    return bKey.localeCompare(aKey);
  });
}
