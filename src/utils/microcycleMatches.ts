import type {
  MicrocycleMatch,
  MicrocycleMatchCompetition,
  MicrocycleMatchVenue,
} from "@/types/trainingMicrocycle";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";

const VALID_VENUES = new Set<MicrocycleMatchVenue>(["home", "away"]);
const VALID_COMPETITIONS = new Set<MicrocycleMatchCompetition>(["friendly", "league", "cup"]);

export function createDefaultMicrocycleMatch(dayIndex = 5): MicrocycleMatch {
  return {
    dayIndex,
    kickoffTime: "18:00",
    opponent: "",
    venue: "home",
    competition: "league",
    venueAddress: "",
  };
}

function safeDayIndex(n: unknown, fallback = 5): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  const i = Math.trunc(x);
  if (i < 0 || i > 6) return fallback;
  return i;
}

function safeVenue(v: unknown): MicrocycleMatchVenue {
  const s = String(v ?? "home");
  return VALID_VENUES.has(s as MicrocycleMatchVenue) ? (s as MicrocycleMatchVenue) : "home";
}

function safeCompetition(v: unknown): MicrocycleMatchCompetition {
  const s = String(v ?? "league");
  return VALID_COMPETITIONS.has(s as MicrocycleMatchCompetition)
    ? (s as MicrocycleMatchCompetition)
    : "league";
}

export function sanitizeMicrocycleOptionalTime(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return "";
}

export function sanitizeMicrocycleTime(v: unknown, fallback = "18:00"): string {
  const sanitized = sanitizeMicrocycleOptionalTime(v);
  return sanitized || fallback;
}

function sanitizeKickoffTime(v: unknown): string {
  return sanitizeMicrocycleTime(v, "18:00");
}

export function sanitizeMicrocycleMatch(raw: Record<string, unknown>): MicrocycleMatch {
  return {
    dayIndex: safeDayIndex(raw.dayIndex, 5),
    kickoffTime: sanitizeKickoffTime(raw.kickoffTime),
    opponent: String(raw.opponent ?? "").slice(0, 120),
    venue: safeVenue(raw.venue),
    competition: safeCompetition(raw.competition),
    venueAddress: String(raw.venueAddress ?? "").slice(0, 200),
  };
}

/** Migracja z `matchDays` (legacy) lub normalizacja tablicy meczów. */
export function normalizeMicrocycleMatches(
  matchesRaw: unknown,
  legacyMatchDays?: unknown
): MicrocycleMatch[] {
  if (Array.isArray(matchesRaw) && matchesRaw.length > 0) {
    return (matchesRaw as Record<string, unknown>[])
      .map(sanitizeMicrocycleMatch)
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .slice(0, 2);
  }
  const days = normalizeMatchDaysArray(
    Array.isArray(legacyMatchDays) ? (legacyMatchDays as number[]) : [5]
  );
  return days.map((dayIndex) => createDefaultMicrocycleMatch(dayIndex));
}

export function matchDaysFromMatches(matches: MicrocycleMatch[]): number[] {
  return normalizeMatchDaysArray(matches.map((m) => m.dayIndex));
}

export function updateMicrocycleMatchAt(
  matches: MicrocycleMatch[],
  index: 0 | 1,
  patch: Partial<MicrocycleMatch>
): MicrocycleMatch[] {
  const next = [...matches];
  while (next.length <= index) {
    next.push(createDefaultMicrocycleMatch(next.length === 0 ? 5 : 6));
  }
  next[index] = sanitizeMicrocycleMatch({ ...next[index], ...patch });
  if (index === 1 && patch.dayIndex === undefined && next.length === 2) {
    // keep
  }
  return next
    .slice(0, 2)
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .slice(0, 2);
}

export function setSecondMicrocycleMatch(
  matches: MicrocycleMatch[],
  dayIndex: number | null
): MicrocycleMatch[] {
  const first = matches[0] ?? createDefaultMicrocycleMatch(5);
  if (dayIndex === null) return [first];
  if (dayIndex === first.dayIndex) return [first];
  const second = matches[1]
    ? { ...matches[1], dayIndex }
    : createDefaultMicrocycleMatch(dayIndex);
  return [first, second].sort((a, b) => a.dayIndex - b.dayIndex);
}

export function formatMicrocycleMatchSummary(match: MicrocycleMatch): string {
  const parts: string[] = [];
  if (match.kickoffTime) parts.push(match.kickoffTime);
  if (match.opponent.trim()) {
    parts.push(
      match.venue === "away" ? `@ ${match.opponent.trim()}` : `vs ${match.opponent.trim()}`
    );
  }
  if (match.venueAddress.trim()) parts.push(match.venueAddress.trim());
  return parts.join(" · ");
}
