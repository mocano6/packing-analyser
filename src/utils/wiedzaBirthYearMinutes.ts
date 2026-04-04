import { Player, PlayerMinutes, TeamInfo } from "../types";

/** Minuty rozegrane z wpisu (0 gdy brak realnej gry). */
export function minutesFromPlayerMinutesEntry(pm: PlayerMinutes): number {
  const s = Number(pm.startMinute) || 0;
  const e = Number(pm.endMinute ?? pm.startMinute) || 0;
  if (e <= s) return 0;
  return e - s + 1;
}

const SKIP_STATUS = new Set<PlayerMinutes["status"]>(["kontuzja", "brak_powolania", "inny_zespol"]);

function shouldSkipEntry(pm: PlayerMinutes): boolean {
  if (pm.status && SKIP_STATUS.has(pm.status)) return true;
  return minutesFromPlayerMinutesEntry(pm) <= 0;
}

export type BirthYearTeamPctRow = {
  /** Rok urodzenia (etykieta osi X). */
  birthYear: number;
  name: string;
};

/** Wynik: wiersze po roku urodzenia + dla każdego teamId pole procentowe `pct_${teamId}`. */
export type BirthYearMinutesChartModel = {
  rows: (BirthYearTeamPctRow & Record<string, number | string>)[];
  teamIds: string[];
  /** Minuty bez przypisanego roku (per teamId). */
  unknownMinutesByTeam: Record<string, number>;
  /** Suma minut z znanym rokiem (per team). */
  knownMinutesTotalByTeam: Record<string, number>;
};

/**
 * Dla każdego zaznaczonego klubu: jaki % rozegranych minut (w meczach z próby) przypada na zawodników
 * z danego roku urodzenia. Porównanie pokazuje, które zespoły częściej stawiają na młodszych (większy udział
 * minut przy wyższym roku urodzenia).
 */
export function buildBirthYearMinutePercentagesByTeam(
  matches: TeamInfo[],
  playersById: Map<string, Pick<Player, "id" | "birthYear">>,
  selectedTeamIds: string[],
): BirthYearMinutesChartModel | null {
  const teamSet = new Set(selectedTeamIds);
  if (teamSet.size === 0) return null;

  const rawMinutes = new Map<string, Map<number, number>>();
  const unknownByTeam = new Map<string, number>();

  for (const tid of selectedTeamIds) {
    rawMinutes.set(tid, new Map());
    unknownByTeam.set(tid, 0);
  }

  for (const m of matches) {
    const tid = m.team;
    if (!teamSet.has(tid)) continue;
    const entries = m.playerMinutes ?? [];
    if (entries.length === 0) continue;

    const perYear = rawMinutes.get(tid)!;
    let unknown = unknownByTeam.get(tid)!;

    for (const pm of entries) {
      if (shouldSkipEntry(pm)) continue;
      const mins = minutesFromPlayerMinutesEntry(pm);
      if (mins <= 0) continue;

      const p = playersById.get(pm.playerId);
      const y = p?.birthYear;
      if (y == null || !Number.isFinite(y)) {
        unknown += mins;
        continue;
      }
      const year = Math.round(y);
      perYear.set(year, (perYear.get(year) ?? 0) + mins);
    }
    unknownByTeam.set(tid, unknown);
  }

  const yearSet = new Set<number>();
  for (const m of rawMinutes.values()) {
    for (const y of m.keys()) yearSet.add(y);
  }
  if (yearSet.size === 0) {
    const anyUnknown = [...unknownByTeam.values()].some((v) => v > 0);
    if (!anyUnknown) return null;
    return {
      rows: [],
      teamIds: [...selectedTeamIds],
      unknownMinutesByTeam: Object.fromEntries(unknownByTeam),
      knownMinutesTotalByTeam: Object.fromEntries(selectedTeamIds.map((id) => [id, 0])),
    };
  }

  const sortedYears = [...yearSet].sort((a, b) => a - b);

  const knownTotals: Record<string, number> = {};
  for (const tid of selectedTeamIds) {
    let sum = 0;
    const m = rawMinutes.get(tid)!;
    for (const y of sortedYears) sum += m.get(y) ?? 0;
    knownTotals[tid] = sum;
  }

  const rows: BirthYearMinutesChartModel["rows"] = sortedYears.map((birthYear) => {
    const row: BirthYearTeamPctRow & Record<string, number | string> = {
      birthYear,
      name: String(birthYear),
    };
    for (const tid of selectedTeamIds) {
      const total = knownTotals[tid] ?? 0;
      const mins = rawMinutes.get(tid)?.get(birthYear) ?? 0;
      const key = `pct_${tid}`;
      row[key] = total > 0 ? (mins / total) * 100 : 0;
    }
    return row;
  });

  return {
    rows,
    teamIds: [...selectedTeamIds],
    unknownMinutesByTeam: Object.fromEntries(unknownByTeam),
    knownMinutesTotalByTeam: knownTotals,
  };
}

/** Średni rok urodzenia zważony minutami (wyżej = młodsi zawodnicy dostają więcej czasu). */
export function weightedMeanBirthYearForTeam(
  matches: TeamInfo[],
  playersById: Map<string, Pick<Player, "id" | "birthYear">>,
  teamId: string,
): number | null {
  let num = 0;
  let den = 0;
  for (const m of matches) {
    if (m.team !== teamId) continue;
    for (const pm of m.playerMinutes ?? []) {
      if (shouldSkipEntry(pm)) continue;
      const mins = minutesFromPlayerMinutesEntry(pm);
      if (mins <= 0) continue;
      const y = playersById.get(pm.playerId)?.birthYear;
      if (y == null || !Number.isFinite(y)) continue;
      num += Math.round(y) * mins;
      den += mins;
    }
  }
  if (den <= 0) return null;
  return num / den;
}
