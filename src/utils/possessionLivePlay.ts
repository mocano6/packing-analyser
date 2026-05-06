import type { PossessionSegment } from "@/types";

export type PossessionLivePlaySource = {
  matchId: string;
  matchLabel: string;
  teamName: string;
  opponentName: string;
  date: string;
  competition: string;
  segments: PossessionSegment[];
};

export type PossessionLivePlayBlock = {
  id: string;
  matchId: string;
  matchLabel: string;
  teamName: string;
  opponentName: string;
  date: string;
  competition: string;
  half: 1 | 2;
  startSec: number;
  endSec: number;
  durationSec: number;
  segments: number;
  teamSegments: number;
  opponentSegments: number;
};

export type PossessionLivePlaySummary = {
  count: number;
  totalDuration: number;
  avgDuration: number;
  medianDuration: number;
  p75Duration: number;
  p90Duration: number;
  longest: PossessionLivePlayBlock | null;
};

export type PossessionLivePlayBucket = {
  name: string;
  min: number;
  max: number;
  blocks: number;
};

/** Wiersz pod wykres: liczba bloków + udział procentowy wśród wszystkich bloków płynnej gry. */
export type PossessionLivePlayBucketChartRow = PossessionLivePlayBucket & {
  pctOfBlocks: number;
};

const LIVE_PLAY_BUCKETS = [
  { name: "0-15 s", min: 0, max: 15 },
  { name: "15-30 s", min: 15, max: 30 },
  { name: "30-45 s", min: 30, max: 45 },
  { name: "45-60 s", min: 45, max: 60 },
  { name: "60-90 s", min: 60, max: 90 },
  { name: "90-120 s", min: 90, max: 120 },
  { name: "120+ s", min: 120, max: Infinity },
];

const percentile = (values: number[], pct: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
};

export const buildPossessionLivePlayBlocks = (sources: PossessionLivePlaySource[]): PossessionLivePlayBlock[] => {
  const blocks: PossessionLivePlayBlock[] = [];

  sources.forEach((source) => {
    const sortedSegments = [...source.segments].sort((a, b) => a.half - b.half || a.startSec - b.startSec);
    let current: PossessionLivePlayBlock | null = null;
    let blockNo = 0;

    const flush = () => {
      if (!current) return;
      if (current.durationSec > 0) {
        blocks.push(current);
      }
      current = null;
    };

    sortedSegments.forEach((segment) => {
      if (segment.type === "dead") {
        flush();
        return;
      }

      if (!current || current.half !== segment.half) {
        flush();
        blockNo += 1;
        current = {
          id: `${source.matchId}_${segment.half}_${blockNo}`,
          matchId: source.matchId,
          matchLabel: source.matchLabel,
          teamName: source.teamName,
          opponentName: source.opponentName,
          date: source.date,
          competition: source.competition,
          half: segment.half,
          startSec: segment.startSec,
          endSec: segment.endSec,
          durationSec: Math.max(0, segment.endSec - segment.startSec),
          segments: 1,
          teamSegments: segment.type === "team" ? 1 : 0,
          opponentSegments: segment.type === "opponent" ? 1 : 0,
        };
        return;
      }

      current.endSec = Math.max(current.endSec, segment.endSec);
      current.durationSec = Math.max(0, current.endSec - current.startSec);
      current.segments += 1;
      current.teamSegments += segment.type === "team" ? 1 : 0;
      current.opponentSegments += segment.type === "opponent" ? 1 : 0;
    });

    flush();
  });

  return blocks.sort((a, b) => b.durationSec - a.durationSec);
};

export const summarizePossessionLivePlayBlocks = (
  blocks: PossessionLivePlayBlock[],
): PossessionLivePlaySummary => {
  const totalDuration = blocks.reduce((sum, block) => sum + block.durationSec, 0);
  const longest = blocks.reduce<PossessionLivePlayBlock | null>(
    (best, block) => (!best || block.durationSec > best.durationSec ? block : best),
    null,
  );
  const durations = blocks.map((block) => block.durationSec);

  return {
    count: blocks.length,
    totalDuration,
    avgDuration: blocks.length > 0 ? totalDuration / blocks.length : 0,
    medianDuration: percentile(durations, 50),
    p75Duration: percentile(durations, 75),
    p90Duration: percentile(durations, 90),
    longest,
  };
};

export const buildPossessionLivePlayBuckets = (
  blocks: PossessionLivePlayBlock[],
): PossessionLivePlayBucket[] =>
  LIVE_PLAY_BUCKETS.map((bucket) => ({
    ...bucket,
    blocks: blocks.filter((block) => block.durationSec >= bucket.min && block.durationSec < bucket.max).length,
  }));

/** Rozkład bloków w kubełkach czasu z procentem udziału każdego kubełka (suma ≈ 100%). */
export const buildPossessionLivePlayBucketChartRows = (
  blocks: PossessionLivePlayBlock[],
): PossessionLivePlayBucketChartRow[] => {
  const buckets = buildPossessionLivePlayBuckets(blocks);
  const total = buckets.reduce((sum, bucket) => sum + bucket.blocks, 0);
  return buckets.map((bucket) => ({
    ...bucket,
    pctOfBlocks: total > 0 ? (100 * bucket.blocks) / total : 0,
  }));
};
