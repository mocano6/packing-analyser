import type { Action } from "@/types";

export type VideoTimestampSource = {
  videoTimestamp?: number | null;
  videoTimestampRaw?: number | null;
};

/** Sekundy do seek w playerze (YouTube / zewnętrzne okno); null gdy brak znacznika. */
export function getVideoTimestampSeconds(source: VideoTimestampSource): number | null {
  const raw = source.videoTimestamp ?? source.videoTimestampRaw;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n > 1_000_000 ? n / 1000 : n;
}

/** Dla akcji packing/regain/lose — to samo co {@link getVideoTimestampSeconds}. */
export function getActionVideoSeekSeconds(action: Action): number | null {
  return getVideoTimestampSeconds(action);
}
