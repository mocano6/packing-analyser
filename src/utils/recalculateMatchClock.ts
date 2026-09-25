import type { Acc8sEntry, Action, PKEntry, PossessionSegment, Shot, TeamInfo } from "@/types";
import { sanitizePossessionSegments, POSSESSION_MERGE_EPS } from "@/lib/possessionSegmentsUpsert";
import { normalizeHalfStartTimeSeconds } from "@/utils/normalizeTeamInfoHalfStarts";
import { clampFirstHalfMinute, clampSecondHalfMinute } from "@/utils/matchTimeLimits";
import { formatMMSS, secondsToMinutesDecimal } from "@/utils/timeFormat";

export type MatchHalfStarts = {
  firstHalfStartTime?: number;
  secondHalfStartTime?: number;
};

export type MatchClock = {
  minute: number;
  isSecondHalf: boolean;
};

type TimedEvent = {
  minute: number;
  isSecondHalf?: boolean;
  videoTimestampRaw?: number | null;
};

export type RecalculateMatchRecordingInput = {
  actions_packing?: Action[];
  actions_unpacking?: Action[];
  actions_regain?: Action[];
  actions_loses?: Action[];
  shots?: Shot[];
  pkEntries?: PKEntry[];
  acc8sEntries?: Acc8sEntry[];
  possessionSegments?: PossessionSegment[];
};

export type RecalculateMatchRecordingResult = RecalculateMatchRecordingInput & {
  possession?: NonNullable<TeamInfo["matchData"]>["possession"];
  updatedEvents: number;
  updatedSegments: number;
  skippedWithoutVideoTime: number;
};

/** Surowy czas nagrania. Brak `videoTimestampRaw` oznacza, że zdarzenia nie przeliczamy. */
export function readEventVideoSeconds(event: { videoTimestampRaw?: number | null }): number | null {
  const raw = event.videoTimestampRaw;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

/**
 * Minuta meczu i połowa z pozycji na nagraniu — ta sama reguła co przy tagowaniu.
 * `null`, gdy czasu nie da się odnieść do meczu (brak startów albo klatka przed pierwszą połową).
 */
export function matchClockFromVideoSeconds(
  videoSeconds: number,
  timing: MatchHalfStarts
): MatchClock | null {
  if (!Number.isFinite(videoSeconds)) return null;
  const firstHalfStart = normalizeHalfStartTimeSeconds(timing.firstHalfStartTime);
  const secondHalfStart = normalizeHalfStartTimeSeconds(timing.secondHalfStartTime);
  if (firstHalfStart === undefined && secondHalfStart === undefined) return null;

  if (secondHalfStart !== undefined && videoSeconds >= secondHalfStart) {
    const minute = Math.floor((videoSeconds - secondHalfStart) / 60) + 46;
    return { minute: clampSecondHalfMinute(minute), isSecondHalf: true };
  }
  if (firstHalfStart !== undefined && videoSeconds >= firstHalfStart) {
    const minute = Math.floor((videoSeconds - firstHalfStart) / 60) + 1;
    return { minute: clampFirstHalfMinute(minute), isSecondHalf: false };
  }
  if (secondHalfStart !== undefined && videoSeconds < secondHalfStart) {
    const minute = Math.floor(videoSeconds / 60) + 1;
    return { minute: clampFirstHalfMinute(minute), isSecondHalf: false };
  }
  return null;
}

export function applyMatchClockToEvent<T extends TimedEvent>(
  event: T,
  timing: MatchHalfStarts,
  options: { writeHalf: boolean }
): { event: T; status: "updated" | "unchanged" | "skipped" } {
  const videoSeconds = readEventVideoSeconds(event);
  if (videoSeconds === null) return { event, status: "skipped" };
  const clock = matchClockFromVideoSeconds(videoSeconds, timing);
  if (!clock) return { event, status: "unchanged" };

  const minuteSame = event.minute === clock.minute;
  const halfSame = !options.writeHalf || event.isSecondHalf === clock.isSecondHalf;
  if (minuteSame && halfSame) return { event, status: "unchanged" };

  const next: T = { ...event, minute: clock.minute };
  if (options.writeHalf) next.isSecondHalf = clock.isSecondHalf;
  return { event: next, status: "updated" };
}

function mapTimedList<T extends TimedEvent>(
  items: T[] | undefined,
  timing: MatchHalfStarts,
  writeHalf: boolean
): { items: T[] | undefined; updated: number; skipped: number } {
  if (!items) return { items, updated: 0, skipped: 0 };
  let updated = 0;
  let skipped = 0;
  const next = items.map((item) => {
    const applied = applyMatchClockToEvent(item, timing, { writeHalf });
    if (applied.status === "updated") updated += 1;
    if (applied.status === "skipped") skipped += 1;
    return applied.event;
  });
  return { items: next, updated, skipped };
}

function possessionSignature(segments: PossessionSegment[]): string {
  return segments
    .map((segment) => `${segment.half}:${segment.startSec}:${segment.endSec}:${segment.type}:${segment.mode}`)
    .join("|");
}

/**
 * Przypisuje segmentom połówkę według startu II połowy na nagraniu.
 * Sekundy wideo zostają. Segment przecinający granicę jest rozcinany, a stykające się
 * fragmenty tego samego typu są sklejane.
 */
export function reassignPossessionSegmentHalves(
  segments: PossessionSegment[],
  secondHalfStartTime?: number
): PossessionSegment[] {
  const boundary = normalizeHalfStartTimeSeconds(secondHalfStartTime);
  if (boundary === undefined) return segments;

  const sanitized = sanitizePossessionSegments(segments);
  const split = sanitized.flatMap((segment) => {
    const start = segment.startSec;
    const end = segment.endSec;
    const parts: Array<{ half: 1 | 2; start: number; end: number }> = [];
    if (start < boundary && end > boundary) {
      parts.push({ half: 1, start, end: boundary });
      parts.push({ half: 2, start: boundary, end });
    } else if (end <= boundary) {
      parts.push({ half: 1, start, end });
    } else {
      parts.push({ half: 2, start, end });
    }
    return parts.map((part) => ({
      ...segment,
      id:
        parts.length === 1
          ? segment.id
          : `${segment.id}_half${part.half}_${Math.round(part.start * 1000)}_${Math.round(part.end * 1000)}`,
      half: part.half,
      startSec: part.start,
      endSec: part.end,
      durationSec: part.end - part.start,
      startedAtVideoSec: part.start,
      endedAtVideoSec: part.end,
    }));
  });

  return split.reduce<PossessionSegment[]>((acc, segment) => {
    const last = acc[acc.length - 1];
    if (
      last &&
      last.type === segment.type &&
      last.mode === segment.mode &&
      last.half === segment.half &&
      Math.abs(last.endSec - segment.startSec) <= POSSESSION_MERGE_EPS
    ) {
      acc[acc.length - 1] = {
        ...last,
        endSec: segment.endSec,
        durationSec: segment.endSec - last.startSec,
        endedAtVideoSec: segment.endSec,
      };
      return acc;
    }
    acc.push(segment);
    return acc;
  }, []);
}

export function possessionMinutesFromSegments(
  segments: PossessionSegment[]
): NonNullable<NonNullable<TeamInfo["matchData"]>["possession"]> {
  const totals = {
    teamFirstHalf: 0,
    opponentFirstHalf: 0,
    deadFirstHalf: 0,
    teamSecondHalf: 0,
    opponentSecondHalf: 0,
    deadSecondHalf: 0,
  };
  for (const segment of segments) {
    const duration = Number(segment.durationSec);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const halfKey = segment.half === 2 ? "SecondHalf" : "FirstHalf";
    const owner = segment.type === "dead" ? "dead" : segment.type === "team" ? "team" : "opponent";
    const key = `${owner}${halfKey}` as keyof typeof totals;
    totals[key] += duration;
  }
  return {
    teamFirstHalf: secondsToMinutesDecimal(totals.teamFirstHalf),
    opponentFirstHalf: secondsToMinutesDecimal(totals.opponentFirstHalf),
    deadFirstHalf: secondsToMinutesDecimal(totals.deadFirstHalf),
    teamSecondHalf: secondsToMinutesDecimal(totals.teamSecondHalf),
    opponentSecondHalf: secondsToMinutesDecimal(totals.opponentSecondHalf),
    deadSecondHalf: secondsToMinutesDecimal(totals.deadSecondHalf),
  };
}

export function recalculateMatchRecording(
  input: RecalculateMatchRecordingInput,
  timing: MatchHalfStarts
): RecalculateMatchRecordingResult {
  const normalized: MatchHalfStarts = {
    firstHalfStartTime: normalizeHalfStartTimeSeconds(timing.firstHalfStartTime),
    secondHalfStartTime: normalizeHalfStartTimeSeconds(timing.secondHalfStartTime),
  };

  const packing = mapTimedList(input.actions_packing, normalized, true);
  const unpacking = mapTimedList(input.actions_unpacking, normalized, true);
  const regain = mapTimedList(input.actions_regain, normalized, true);
  const loses = mapTimedList(input.actions_loses, normalized, true);
  const shots = mapTimedList(input.shots, normalized, false);
  const pkEntries = mapTimedList(input.pkEntries, normalized, true);
  const acc8sEntries = mapTimedList(input.acc8sEntries, normalized, true);

  const possessionSegments = reassignPossessionSegmentHalves(
    input.possessionSegments ?? [],
    normalized.secondHalfStartTime
  );
  const possessionChanged =
    normalized.secondHalfStartTime !== undefined &&
    possessionSignature(sanitizePossessionSegments(input.possessionSegments ?? [])) !==
      possessionSignature(possessionSegments);
  const updatedSegments = possessionChanged
    ? sanitizePossessionSegments(input.possessionSegments ?? []).filter((segment) => {
        const match = possessionSegments.find((next) => next.id === segment.id);
        return (
          !match ||
          match.half !== segment.half ||
          match.startSec !== segment.startSec ||
          match.endSec !== segment.endSec
        );
      }).length
    : 0;

  return {
    actions_packing: packing.items,
    actions_unpacking: unpacking.items,
    actions_regain: regain.items,
    actions_loses: loses.items,
    shots: shots.items,
    pkEntries: pkEntries.items,
    acc8sEntries: acc8sEntries.items,
    possessionSegments: normalized.secondHalfStartTime !== undefined ? possessionSegments : input.possessionSegments,
    possession: possessionChanged ? possessionMinutesFromSegments(possessionSegments) : undefined,
    updatedEvents:
      packing.updated +
      unpacking.updated +
      regain.updated +
      loses.updated +
      shots.updated +
      pkEntries.updated +
      acc8sEntries.updated,
    updatedSegments,
    skippedWithoutVideoTime:
      packing.skipped +
      unpacking.skipped +
      regain.skipped +
      loses.skipped +
      shots.skipped +
      pkEntries.skipped +
      acc8sEntries.skipped,
  };
}

export type MatchClockChangeRow = {
  id: string;
  kind: string;
  before: string;
  after: string;
  /** Czas nagrania i ewentualnie nazwisko — dopisywane przy pokazie. */
  detail?: string;
  playerId?: string;
  videoSeconds: number;
};

export type MatchClockChangePreview = {
  rows: MatchClockChangeRow[];
  skippedWithoutVideoTime: number;
};

function clockLabel(minute: number, isSecondHalf: boolean): string {
  return `${isSecondHalf ? "P2" : "P1"} ${minute}'`;
}

function videoDetail(videoSeconds: number): string {
  return `nagranie ${formatMMSS(videoSeconds)}`;
}

function actionKind(bucket: "Packing" | "Unpacking", actionType: string | undefined): string {
  const name =
    actionType === "pass" ? "podanie" : actionType === "dribble" ? "drybling" : actionType || "akcja";
  return `${bucket} · ${name}`;
}

function halfFromMinute(minute: number, isSecondHalf?: boolean): boolean {
  if (typeof isSecondHalf === "boolean") return isSecondHalf;
  return minute > 45;
}

function pushEventChange(
  rows: MatchClockChangeRow[],
  field: string,
  event: TimedEvent & { id?: string; playerId?: string; senderId?: string },
  timing: MatchHalfStarts,
  writeHalf: boolean,
  kind: string,
  playerId?: string
): void {
  const applied = applyMatchClockToEvent(event, timing, { writeHalf });
  if (applied.status !== "updated") return;
  const videoSeconds = readEventVideoSeconds(event);
  if (videoSeconds === null) return;
  const beforeHalf = writeHalf ? Boolean(event.isSecondHalf) : halfFromMinute(event.minute);
  const afterHalf = writeHalf ? Boolean(applied.event.isSecondHalf) : applied.event.minute > 45;
  rows.push({
    id: `${field}:${event.id || videoSeconds}`,
    kind,
    before: clockLabel(event.minute, beforeHalf),
    after: clockLabel(applied.event.minute, afterHalf),
    detail: videoDetail(videoSeconds),
    playerId,
    videoSeconds,
  });
}

function possessionRangeLabel(half: 1 | 2, startSec: number, endSec: number): string {
  return `P${half} ${formatMMSS(startSec)}–${formatMMSS(endSec)}`;
}

function possessionKind(type: PossessionSegment["type"]): string {
  if (type === "opponent") return "Posiadanie przeciwnika";
  if (type === "dead") return "Czas martwy";
  return "Posiadanie nasze";
}

function describePossessionChanges(
  segments: PossessionSegment[] | undefined,
  secondHalfStartTime: number | undefined
): MatchClockChangeRow[] {
  if (normalizeHalfStartTimeSeconds(secondHalfStartTime) === undefined) return [];
  const original = sanitizePossessionSegments(segments ?? []);
  const next = reassignPossessionSegmentHalves(original, secondHalfStartTime);
  if (possessionSignature(original) === possessionSignature(next)) return [];

  return original.flatMap((segment) => {
    const pieces = next.filter(
      (item) => item.id === segment.id || item.id.startsWith(`${segment.id}_half`)
    );
    const unchanged =
      pieces.length === 1 &&
      pieces[0].half === segment.half &&
      pieces[0].startSec === segment.startSec &&
      pieces[0].endSec === segment.endSec;
    if (unchanged) return [];

    const before = possessionRangeLabel(segment.half, segment.startSec, segment.endSec);
    let after: string;
    if (pieces.length > 0) {
      after = pieces
        .map((piece) => possessionRangeLabel(piece.half, piece.startSec, piece.endSec))
        .join(" i ");
    } else {
      const host = next.find((item) => item.startSec <= segment.startSec && item.endSec >= segment.endSec);
      after = host
        ? `dołączone do ${possessionRangeLabel(host.half, host.startSec, host.endSec)}`
        : "połączone z sąsiednim fragmentem";
    }
    return [
      {
        id: `possession:${segment.id}`,
        kind: possessionKind(segment.type),
        before,
        after,
        detail: videoDetail(segment.startSec),
        videoSeconds: segment.startSec,
      },
    ];
  });
}

/** Lista zdarzeń, których minuta lub połowa się zmieni — bez zapisu. */
export function describeMatchClockChanges(
  input: RecalculateMatchRecordingInput,
  timing: MatchHalfStarts
): MatchClockChangePreview {
  const normalized: MatchHalfStarts = {
    firstHalfStartTime: normalizeHalfStartTimeSeconds(timing.firstHalfStartTime),
    secondHalfStartTime: normalizeHalfStartTimeSeconds(timing.secondHalfStartTime),
  };
  const rows: MatchClockChangeRow[] = [];
  const totals = recalculateMatchRecording(input, normalized);

  for (const action of input.actions_packing ?? []) {
    pushEventChange(rows, "actions_packing", action, normalized, true, actionKind("Packing", action.actionType), action.senderId);
  }
  for (const action of input.actions_unpacking ?? []) {
    pushEventChange(
      rows,
      "actions_unpacking",
      action,
      normalized,
      true,
      actionKind("Unpacking", action.actionType),
      action.senderId
    );
  }
  for (const action of input.actions_regain ?? []) {
    pushEventChange(rows, "actions_regain", action, normalized, true, "Odbiór", action.senderId);
  }
  for (const action of input.actions_loses ?? []) {
    pushEventChange(rows, "actions_loses", action, normalized, true, "Strata", action.senderId);
  }
  for (const shot of input.shots ?? []) {
    pushEventChange(rows, "shots", shot, normalized, false, shot.isGoal ? "Gol" : "Strzał", shot.playerId);
  }
  for (const entry of input.pkEntries ?? []) {
    pushEventChange(rows, "pkEntries", entry, normalized, true, "Wejście PK", entry.senderId);
  }
  for (const entry of input.acc8sEntries ?? []) {
    pushEventChange(rows, "acc8sEntries", entry, normalized, true, "8s ACC", entry.passingPlayerIds?.[0]);
  }
  rows.push(...describePossessionChanges(input.possessionSegments, normalized.secondHalfStartTime));
  rows.sort((a, b) => a.videoSeconds - b.videoSeconds || a.kind.localeCompare(b.kind, "pl"));

  return {
    rows,
    skippedWithoutVideoTime: totals.skippedWithoutVideoTime,
  };
}
