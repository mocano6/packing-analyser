/**
 * Merge segmentów posiadania z Firebase z lokalnym draftem (używane przy Zatwierdź).
 * Wyeksportowane do testów i ponownego użycia w transakcjach Firestore.
 */
import type { PossessionSegment } from "@/types";

export const POSSESSION_MERGE_EPS = 1e-6;

type PossessionMode = PossessionSegment["mode"];
type PossessionType = PossessionSegment["type"];

export function sanitizePossessionSegments(value: unknown): PossessionSegment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((segment): PossessionSegment | null => {
      const raw = segment as Partial<PossessionSegment>;
      const startSec = Number(raw.startSec);
      const endSec = Number(raw.endSec);
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
        return null;
      }
      const mode: PossessionMode =
        raw.mode === "z" || raw.mode === "x" || raw.mode === "c" ? raw.mode : "x";
      const type: PossessionType =
        raw.type === "team" || raw.type === "opponent" || raw.type === "dead"
          ? raw.type
          : mode === "x"
            ? "dead"
            : "team";
      const half: 1 | 2 = raw.half === 2 ? 2 : 1;
      return {
        id: String(raw.id || `pos_${Math.round(startSec * 1000)}_${Math.round(endSec * 1000)}`),
        type,
        mode,
        half,
        startSec,
        endSec,
        durationSec: endSec - startSec,
        startedAtVideoSec: Number.isFinite(Number(raw.startedAtVideoSec))
          ? Number(raw.startedAtVideoSec)
          : startSec,
        endedAtVideoSec: Number.isFinite(Number(raw.endedAtVideoSec))
          ? Number(raw.endedAtVideoSec)
          : endSec,
        createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
      };
    })
    .filter((segment): segment is PossessionSegment => Boolean(segment))
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec);
}

export function trimSegmentsByIntervals(
  segments: PossessionSegment[],
  intervals: Array<[number, number]>
): PossessionSegment[] {
  if (intervals.length === 0) return segments;
  const normalizedIntervals = intervals
    .map(([start, end]) => [Math.min(start, end), Math.max(start, end)] as [number, number])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((a, b) => a[0] - b[0]);

  return segments.flatMap((segment) => {
    let pieces: Array<[number, number]> = [[segment.startSec, segment.endSec]];
    for (const [cutStart, cutEnd] of normalizedIntervals) {
      pieces = pieces.flatMap(([pieceStart, pieceEnd]) => {
        if (pieceEnd <= cutStart || pieceStart >= cutEnd) return [[pieceStart, pieceEnd] as [number, number]];
        const nextPieces: Array<[number, number]> = [];
        if (pieceStart < cutStart) nextPieces.push([pieceStart, cutStart]);
        if (cutEnd < pieceEnd) nextPieces.push([cutEnd, pieceEnd]);
        return nextPieces;
      });
    }

    return pieces
      .filter(([start, end]) => end > start)
      .map(([start, end], index) => ({
        ...segment,
        id:
          start === segment.startSec && end === segment.endSec
            ? segment.id
            : `${segment.id}_part_${index}_${Math.round(start * 1000)}_${Math.round(end * 1000)}`,
        startSec: start,
        endSec: end,
        durationSec: end - start,
        startedAtVideoSec: start,
        endedAtVideoSec: end,
      }));
  });
}

export function upsertPossessionSegments(
  current: PossessionSegment[],
  incoming: PossessionSegment[]
): PossessionSegment[] {
  const sanitizedIncoming = sanitizePossessionSegments(incoming);
  if (sanitizedIncoming.length === 0) return current;

  const intervals = sanitizedIncoming.map(
    (segment) => [segment.startSec, segment.endSec] as [number, number]
  );
  const withoutOverlaps = trimSegmentsByIntervals(current, intervals);
  const sorted = [...withoutOverlaps, ...sanitizedIncoming].sort(
    (a, b) => a.startSec - b.startSec || a.endSec - b.endSec
  );

  return sorted.reduce<PossessionSegment[]>((acc, segment) => {
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
