import type {
  MicrocycleMatch,
  MicrocycleTrainingBlock,
} from "@/types/trainingMicrocycle";
import { MICROCYCLE_MATCH_VENUE_LABELS } from "@/types/trainingMicrocycle";
import { weekdayShortPl } from "@/utils/matchDayLabels";
import { addMinutesToHhmm } from "@/utils/microcycleDaySchedules";
import {
  formatMatchSurfaceLabel,
  formatMatchWeatherLabel,
} from "@/utils/microcycleMatches";

export type PlayerDayKind = "rest" | "match" | "training";

export interface PlayerDayMatch {
  kickoffTime: string;
  opponent: string;
  venueLabel: string;
  address: string;
  weather: string;
  departureTime: string;
  surface: string;
}

export interface PlayerDayCard {
  dayIndex: number;
  weekday: string;
  dateLabel: string;
  mdLabel: string;
  kind: PlayerDayKind;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  matches: PlayerDayMatch[];
}

export interface BuildPlayerDayCardInput {
  dayIndex: number;
  date: Date;
  mdLabel: string;
  isRest: boolean;
  isMatchDay: boolean;
  startTime: string;
  /** Tylko do wyliczenia godziny końca — treść bloków nie trafia do karty. */
  blocks: Pick<MicrocycleTrainingBlock, "minutes">[];
  matches: MicrocycleMatch[];
}

export function formatPlayerDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export function playerDayKindLabel(kind: PlayerDayKind): string {
  if (kind === "rest") return "Wolne";
  if (kind === "match") return "Mecz";
  return "Trening";
}

function sessionMinutes(blocks: Pick<MicrocycleTrainingBlock, "minutes">[]): number {
  return blocks.reduce((sum, b) => {
    const n = Number.isFinite(b.minutes) ? Math.max(0, Math.round(b.minutes)) : 0;
    return sum + n;
  }, 0);
}

function playerMatches(matches: MicrocycleMatch[]): PlayerDayMatch[] {
  return matches.map((m) => {
    const weather = formatMatchWeatherLabel(m);
    const surface = formatMatchSurfaceLabel(m.surface);
    return {
      kickoffTime: m.kickoffTime.trim(),
      opponent: m.opponent.trim(),
      venueLabel: MICROCYCLE_MATCH_VENUE_LABELS[m.venue],
      address: m.venueAddress.trim(),
      weather: weather === "—" ? "" : weather,
      departureTime: m.venue === "away" ? m.departureTime.trim() : "",
      surface: surface === "—" ? "" : surface,
    };
  });
}

/**
 * Karta dnia dla widoku zawodnika: kiedy i gdzie być.
 * Bez tytułu jednostki, bloków, obciążenia i celów.
 */
export function buildPlayerDayCard(input: BuildPlayerDayCardInput): PlayerDayCard {
  const kind: PlayerDayKind = input.isMatchDay
    ? "match"
    : input.isRest
      ? "rest"
      : "training";
  const durationMinutes = kind === "training" ? sessionMinutes(input.blocks) : 0;
  const startTime =
    kind === "training" && input.startTime.trim() ? input.startTime.trim() : null;
  const endTime =
    startTime && durationMinutes > 0 ? addMinutesToHhmm(startTime, durationMinutes) : null;

  return {
    dayIndex: input.dayIndex,
    weekday: weekdayShortPl(input.dayIndex),
    dateLabel: formatPlayerDate(input.date),
    mdLabel: input.mdLabel.trim(),
    kind,
    startTime,
    endTime,
    durationMinutes,
    matches: kind === "match" ? playerMatches(input.matches) : [],
  };
}
