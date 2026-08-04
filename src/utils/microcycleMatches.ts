import type {
  MicrocycleMatch,
  MicrocycleMatchCompetition,
  MicrocycleMatchSurface,
  MicrocycleMatchVenue,
  MicrocycleWeatherCondition,
} from "@/types/trainingMicrocycle";
import {
  MICROCYCLE_MATCH_SURFACE_LABELS,
  MICROCYCLE_WEATHER_CONDITION_LABELS,
} from "@/types/trainingMicrocycle";
import { normalizeMatchDaysArray } from "@/utils/matchDayLabels";

const VALID_VENUES = new Set<MicrocycleMatchVenue>(["home", "away"]);
const VALID_COMPETITIONS = new Set<MicrocycleMatchCompetition>(["friendly", "league", "cup"]);
const VALID_SURFACES = new Set<MicrocycleMatchSurface>([
  "natural",
  "artificial",
  "hybrid",
  "indoor",
]);
const VALID_WEATHER = new Set<MicrocycleWeatherCondition>([
  "sunny",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "wind",
  "unknown",
]);

export function createDefaultMicrocycleMatch(dayIndex = 5): MicrocycleMatch {
  return {
    dayIndex,
    kickoffTime: "18:00",
    opponent: "",
    venue: "home",
    departureTime: "",
    competition: "league",
    venueAddress: "",
    surface: null,
    weatherCondition: null,
    weatherTempC: null,
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

export function sanitizeMicrocycleMatchSurface(v: unknown): MicrocycleMatchSurface | null {
  if (v == null || v === "") return null;
  const s = String(v);
  return VALID_SURFACES.has(s as MicrocycleMatchSurface) ? (s as MicrocycleMatchSurface) : null;
}

export function sanitizeMicrocycleWeatherCondition(
  v: unknown
): MicrocycleWeatherCondition | null {
  if (v == null || v === "") return null;
  const s = String(v);
  return VALID_WEATHER.has(s as MicrocycleWeatherCondition)
    ? (s as MicrocycleWeatherCondition)
    : null;
}

export function sanitizeMicrocycleWeatherTempC(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < -30 || rounded > 50) return null;
  return rounded;
}

export function sanitizeMicrocycleMatch(raw: Record<string, unknown>): MicrocycleMatch {
  const venue = safeVenue(raw.venue);
  return {
    dayIndex: safeDayIndex(raw.dayIndex, 5),
    kickoffTime: sanitizeKickoffTime(raw.kickoffTime),
    opponent: String(raw.opponent ?? "").slice(0, 120),
    venue,
    // Godzina wyjazdu tylko przy meczu wyjazdowym.
    departureTime:
      venue === "away" ? sanitizeMicrocycleOptionalTime(raw.departureTime) : "",
    competition: safeCompetition(raw.competition),
    venueAddress: String(raw.venueAddress ?? "").slice(0, 200),
    surface: sanitizeMicrocycleMatchSurface(raw.surface),
    weatherCondition: sanitizeMicrocycleWeatherCondition(raw.weatherCondition),
    weatherTempC: sanitizeMicrocycleWeatherTempC(raw.weatherTempC),
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

export function formatMatchSurfaceLabel(surface: MicrocycleMatchSurface | null | undefined): string {
  if (!surface) return "—";
  return MICROCYCLE_MATCH_SURFACE_LABELS[surface] ?? "—";
}

export function formatMatchWeatherLabel(match: MicrocycleMatch): string {
  const parts: string[] = [];
  if (match.weatherCondition) {
    parts.push(MICROCYCLE_WEATHER_CONDITION_LABELS[match.weatherCondition] ?? "");
  }
  if (match.weatherTempC != null) {
    parts.push(`${match.weatherTempC}°C`);
  }
  return parts.filter(Boolean).join(" · ") || "—";
}
