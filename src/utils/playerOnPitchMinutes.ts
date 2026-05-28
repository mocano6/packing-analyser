import type { PlayerMinutes } from "@/types";

/** Aktywny wpis minut — spójnie z sumą w porównaniu zawodników (end − start). */
export function isActivePlayerMinutesSegment(entry: PlayerMinutes): boolean {
  const start = Number(entry.startMinute) || 0;
  const end = Number(entry.endMinute) || 0;
  if (start === 0 && end === 0) return false;
  return end > start;
}

export function getPlayerMinuteSegmentsForMatch(
  playerMinutes: PlayerMinutes[] | undefined,
  playerId: string,
): PlayerMinutes[] {
  const id = String(playerId ?? "").trim();
  if (!id) return [];
  return (playerMinutes ?? []).filter((entry) => entry.playerId === id && isActivePlayerMinutesSegment(entry));
}

/**
 * Czy zdarzenie w `minute` miało miejsce, gdy zawodnik był na boisku.
 * Przedział [startMinute, endMinute) — ta sama konwencja co suma minut w buildPlayerComparisonRows.
 */
export function isPlayerOnPitchAtMinute(segments: PlayerMinutes[], minute: number): boolean {
  if (!Number.isFinite(minute)) return false;
  const m = Math.trunc(minute);
  return segments.some((segment) => {
    const start = Number(segment.startMinute) || 0;
    const end = Number(segment.endMinute) || 0;
    return end > start && m >= start && m < end;
  });
}

/** Suma minut na boisku w meczu — end − start po segmentach (jak w porównaniu zawodników). */
export function playerOnPitchMinutesInMatch(segments: PlayerMinutes[]): number {
  return segments.reduce((sum, segment) => {
    const start = Number(segment.startMinute) || 0;
    const end = Number(segment.endMinute) || 0;
    if (end <= start) return sum;
    return sum + (end - start);
  }, 0);
}

/**
 * Indeks: minuta meczu → zawodnicy na boisku w tej minucie.
 * Używany do przypisywania xG/PK zespołu do wszystkich graczy obecnych na boisku.
 */
export function buildOnPitchPlayersByMinuteIndex(
  playerMinutes: PlayerMinutes[] | undefined,
  playerIds: ReadonlySet<string>,
): Map<number, Set<string>> {
  const index = new Map<number, Set<string>>();

  for (const entry of playerMinutes ?? []) {
    if (!playerIds.has(entry.playerId)) continue;
    if (!isActivePlayerMinutesSegment(entry)) continue;

    const start = Number(entry.startMinute) || 0;
    const end = Number(entry.endMinute) || 0;
    for (let minute = start; minute < end; minute += 1) {
      const bucket = index.get(minute) ?? new Set<string>();
      bucket.add(entry.playerId);
      index.set(minute, bucket);
    }
  }

  return index;
}

export function getOnPitchPlayerIdsAtMinute(
  index: Map<number, Set<string>>,
  minute: number,
): ReadonlySet<string> | undefined {
  if (!Number.isFinite(minute)) return undefined;
  return index.get(Math.trunc(minute));
}
