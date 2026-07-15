import { sanitizePossessionSegments } from "@/lib/possessionSegmentsUpsert";
import type { PossessionSegment } from "@/types";

export type PossessionHalfFilter = "total" | "firstHalf" | "secondHalf";

export type PossessionMatchTiming = {
  firstHalfStartTime?: number;
  secondHalfStartTime?: number;
};

/**
 * Oś czasu meczu wyliczona z segmentów posiadania.
 * Obie połowy są układane jedna za drugą (bez przerwy w przewie), a doliczony
 * czas każdej połowy wydłuża jej zakres. Dzięki temu wykres pokazuje realny
 * przebieg posiadania na przestrzeni całego meczu (0–90+ min).
 */
export type PossessionTimeline = {
  absolute: boolean;
  firstHalfStartSec: number;
  secondHalfStartSec: number;
  hasFirstHalf: boolean;
  hasSecondHalf: boolean;
  firstHalfDurationMin: number;
  secondHalfDurationMin: number;
  /** Minuta, w której na osi rozpoczyna się druga połowa (= długość 1. połowy). */
  boundaryMin: number;
  /** Koniec osi (granica + długość 2. połowy). */
  endMin: number;
};

export type PossessionCumulativePoint = {
  minute: number;
  label: string;
  teamPct: number;
  opponentPct: number;
  deadPct: number;
  teamSec: number;
  opponentSec: number;
  deadSec: number;
};

export type PossessionMomentumPoint = {
  minute: string;
  minuteValue: number;
  teamSec: number;
  opponentSec: number;
  deadSec: number;
  teamPct: number;
  oppPct: number;
  deadPct: number;
};

const HALF_DURATION_MIN = 45;

export function getPossessionSegmentsFromMatch(matchData: unknown): PossessionSegment[] {
  const nested = (matchData as { possessionSegments?: unknown } | null | undefined)?.possessionSegments;
  if (Array.isArray(nested)) {
    return sanitizePossessionSegments(nested);
  }
  return [];
}

/** Segmenty z analizatora używają absolutnych sekund wideo w startSec/endSec. */
export function usesAbsoluteVideoSeconds(segments: PossessionSegment[], timing?: PossessionMatchTiming): boolean {
  if (timing?.secondHalfStartTime !== undefined && Number.isFinite(timing.secondHalfStartTime)) {
    return true;
  }
  const half2 = segments.filter((segment) => segment.half === 2);
  if (half2.length === 0) return false;
  const minHalf2Start = Math.min(...half2.map((segment) => segment.startSec));
  // Poniżej ~20 min traktujemy jako sekundy względem początku połowy (dane testowe / legacy).
  return minHalf2Start >= 20 * 60;
}

export function resolveFirstHalfStartVideoSec(
  segments: PossessionSegment[],
  timing?: PossessionMatchTiming,
): number {
  if (timing?.firstHalfStartTime !== undefined && Number.isFinite(timing.firstHalfStartTime)) {
    return timing.firstHalfStartTime;
  }
  const half1 = segments.filter((segment) => segment.half === 1);
  if (half1.length === 0) return 0;
  return Math.min(...half1.map((segment) => segment.startSec));
}

export function resolveSecondHalfStartVideoSec(
  segments: PossessionSegment[],
  timing?: PossessionMatchTiming,
): number | null {
  if (timing?.secondHalfStartTime !== undefined && Number.isFinite(timing.secondHalfStartTime)) {
    return timing.secondHalfStartTime;
  }
  const half2 = segments.filter((segment) => segment.half === 2);
  if (half2.length === 0) return null;
  if (!usesAbsoluteVideoSeconds(segments, timing)) return 0;
  return Math.min(...half2.map((segment) => segment.startSec));
}

/** Elapsed w minutach względem początku połowy danego segmentu (przed dołożeniem offsetu granicy). */
function segmentHalfElapsedMin(
  segment: PossessionSegment,
  timeline: PossessionTimeline,
): { startMin: number; endMin: number } {
  const base = timeline.absolute
    ? segment.half === 2
      ? timeline.secondHalfStartSec
      : timeline.firstHalfStartSec
    : 0;
  const rawStart = Math.max(0, (segment.startSec - base) / 60);
  const rawEnd = Math.max(0, (segment.endSec - base) / 60);
  return {
    startMin: Math.min(rawStart, rawEnd),
    endMin: Math.max(rawStart, rawEnd),
  };
}

export function buildPossessionTimeline(
  segments: PossessionSegment[],
  timing?: PossessionMatchTiming,
): PossessionTimeline {
  const absolute = usesAbsoluteVideoSeconds(segments, timing);
  const half1 = segments.filter((segment) => segment.half === 1);
  const half2 = segments.filter((segment) => segment.half === 2);
  const hasFirstHalf = half1.length > 0;
  const hasSecondHalf = half2.length > 0;

  const firstHalfStartSec = absolute ? resolveFirstHalfStartVideoSec(segments, timing) : 0;
  const secondHalfStartSec = absolute ? (resolveSecondHalfStartVideoSec(segments, timing) ?? 0) : 0;

  const base: PossessionTimeline = {
    absolute,
    firstHalfStartSec,
    secondHalfStartSec,
    hasFirstHalf,
    hasSecondHalf,
    firstHalfDurationMin: 0,
    secondHalfDurationMin: 0,
    boundaryMin: 0,
    endMin: HALF_DURATION_MIN * 2,
  };

  const rawDuration = (half: PossessionSegment[]): number =>
    half.length === 0
      ? 0
      : Math.max(...half.map((segment) => segmentHalfElapsedMin(segment, base).endMin));

  // Doliczony czas wydłuża połowę; brak danych → domyślne 45 min, aby oś objęła cały mecz.
  const firstHalfDurationMin = hasFirstHalf ? Math.max(HALF_DURATION_MIN, Math.round(rawDuration(half1))) : 0;
  const secondHalfDurationMin = hasSecondHalf ? Math.max(HALF_DURATION_MIN, Math.round(rawDuration(half2))) : 0;
  const boundaryMin = firstHalfDurationMin;
  const endMin = boundaryMin + secondHalfDurationMin || HALF_DURATION_MIN * 2;

  return {
    ...base,
    firstHalfDurationMin,
    secondHalfDurationMin,
    boundaryMin,
    endMin,
  };
}

/** Minuty meczu (na osi ciągłej) dla danego segmentu — druga połowa przesunięta o granicę. */
export function segmentToMatchMinutes(
  segment: PossessionSegment,
  timeline: PossessionTimeline,
): { startMin: number; endMin: number } {
  const elapsed = segmentHalfElapsedMin(segment, timeline);
  const offset = segment.half === 2 ? timeline.boundaryMin : 0;
  return {
    startMin: elapsed.startMin + offset,
    endMin: elapsed.endMin + offset,
  };
}

export function filterSegmentsByPeriod(
  segments: PossessionSegment[],
  period: PossessionHalfFilter,
): PossessionSegment[] {
  if (period === "total") return segments;
  const half: 1 | 2 = period === "firstHalf" ? 1 : 2;
  return segments.filter((segment) => segment.half === half);
}

export function getPeriodMinuteRange(
  period: PossessionHalfFilter,
  timeline: PossessionTimeline,
): { start: number; end: number } {
  if (period === "firstHalf") {
    return { start: 0, end: timeline.firstHalfDurationMin || HALF_DURATION_MIN };
  }
  if (period === "secondHalf") {
    const start = timeline.boundaryMin;
    return { start, end: timeline.endMin > start ? timeline.endMin : start + HALF_DURATION_MIN };
  }
  return { start: 0, end: timeline.endMin };
}

export function overlapSeconds(
  segment: PossessionSegment,
  windowStart: number,
  windowEnd: number,
  timeline: PossessionTimeline,
): number {
  const { startMin, endMin } = segmentToMatchMinutes(segment, timeline);
  const overlapStart = Math.max(startMin, windowStart);
  const overlapEnd = Math.min(endMin, windowEnd);
  if (overlapEnd <= overlapStart) return 0;
  return (overlapEnd - overlapStart) * 60;
}

function accumulateSecondsToMinute(
  segments: PossessionSegment[],
  periodStart: number,
  minute: number,
  timeline: PossessionTimeline,
): { teamSec: number; opponentSec: number; deadSec: number } {
  return segments.reduce(
    (acc, segment) => {
      const sec = overlapSeconds(segment, periodStart, minute, timeline);
      if (segment.type === "team") acc.teamSec += sec;
      else if (segment.type === "opponent") acc.opponentSec += sec;
      else acc.deadSec += sec;
      return acc;
    },
    { teamSec: 0, opponentSec: 0, deadSec: 0 },
  );
}

function toSharePercents(totals: { teamSec: number; opponentSec: number; deadSec: number }) {
  const totalSec = totals.teamSec + totals.opponentSec + totals.deadSec;
  if (totalSec <= 0) {
    return { teamPct: 0, opponentPct: 0, deadPct: 0 };
  }
  return {
    teamPct: (100 * totals.teamSec) / totalSec,
    opponentPct: (100 * totals.opponentSec) / totalSec,
    deadPct: (100 * totals.deadSec) / totalSec,
  };
}

/** Skumulowany udział posiadania co minutę w wybranym zakresie (0–90+ z doliczonym czasem). */
export function buildCumulativePossessionChartData(
  segments: PossessionSegment[],
  period: PossessionHalfFilter,
  timing?: PossessionMatchTiming,
): PossessionCumulativePoint[] {
  const timeline = buildPossessionTimeline(segments, timing);
  const filtered = filterSegmentsByPeriod(segments, period);
  const { start: periodStart, end: periodEnd } = getPeriodMinuteRange(period, timeline);
  const points: PossessionCumulativePoint[] = [];

  const makePoint = (minute: number): PossessionCumulativePoint => {
    const totals = accumulateSecondsToMinute(filtered, periodStart, minute, timeline);
    return {
      minute,
      label: `${Math.round(minute)}'`,
      ...toSharePercents(totals),
      ...totals,
    };
  };

  for (let minute = periodStart; minute < periodEnd; minute += 1) {
    points.push(makePoint(minute));
  }
  points.push(makePoint(periodEnd));

  return points;
}

/** Interwały 5-minutowe w wybranym zakresie; oś ciągła obejmuje obie połowy i doliczony czas. */
export function buildPossession5MinChartData(
  segments: PossessionSegment[],
  period: PossessionHalfFilter,
  timing?: PossessionMatchTiming,
): PossessionMomentumPoint[] {
  const timeline = buildPossessionTimeline(segments, timing);
  const filtered = filterSegmentsByPeriod(segments, period);
  const { start: periodStart, end: periodEnd } = getPeriodMinuteRange(period, timeline);
  const intervalMin = 5;
  const data: PossessionMomentumPoint[] = [];

  for (let bucketStart = periodStart; bucketStart < periodEnd; bucketStart += intervalMin) {
    const bucketEnd = Math.min(bucketStart + intervalMin, periodEnd);
    const totals = filtered.reduce(
      (acc, segment) => {
        const sec = overlapSeconds(segment, bucketStart, bucketEnd, timeline);
        if (segment.type === "team") acc.teamSec += sec;
        else if (segment.type === "opponent") acc.opponentSec += sec;
        else acc.deadSec += sec;
        return acc;
      },
      { teamSec: 0, opponentSec: 0, deadSec: 0 },
    );
    const bucketTotalSec = totals.teamSec + totals.opponentSec + totals.deadSec;
    const liveSec = totals.teamSec + totals.opponentSec;
    data.push({
      minute: `${Math.round(bucketStart)}'`,
      minuteValue: bucketStart,
      ...totals,
      teamPct: liveSec > 0 ? (100 * totals.teamSec) / liveSec : 0,
      oppPct: liveSec > 0 ? (100 * totals.opponentSec) / liveSec : 0,
      deadPct: bucketTotalSec > 0 ? (100 * totals.deadSec) / bucketTotalSec : 0,
    });
  }

  return data;
}
