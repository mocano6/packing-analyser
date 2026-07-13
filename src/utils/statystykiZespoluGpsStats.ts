import type { PlayerMinutes, TeamInfo } from '@/types';

export type GpsMatchDayEntry = {
  id: string;
  playerId: string;
  playerName: string;
  firstHalf: Record<string, unknown>;
  secondHalf: Record<string, unknown>;
  total: Record<string, unknown>;
};

export type GpsPeriod = 'total' | 'firstHalf' | 'secondHalf';
export type GpsValueMode = 'raw' | 'perMinute';

export type GpsPlayerMetrics = {
  minutes: number;
  acc56: number;
  dec56: number;
  distance56: number;
  sprintDistance: number;
  sprints: number;
  maxSpeed: number;
  distancePerMin: number;
  hsr: number;
  hibSeconds: number;
  hibCount: number;
  hmlDistance: number;
  totalDistance: number;
};

export type GpsPlayerRow = GpsPlayerMetrics & {
  playerId: string;
  playerName: string;
  position: string;
};

export type GpsTeamStats = GpsPlayerMetrics & {
  playerCount: number;
  avgDistancePerMin: number;
  teamMaxSpeed: number;
};

export type GpsHalfSlice = {
  totalDistance: number;
  hsr: number;
  sprintDistance: number;
  sprints: number;
  hmlDistance: number;
  acc56: number;
  dec56: number;
};

export type GpsPositionBreakdownRow = {
  position: string;
  totalDistance: number;
  hsr: number;
  sprintDistance: number;
  playerCount: number;
  sharePct: number;
};

export type GpsChartMetricKey =
  | 'totalDistance'
  | 'hsr'
  | 'sprintDistance'
  | 'sprints'
  | 'hmlDistance'
  | 'acc56'
  | 'dec56'
  | 'distancePerMin'
  | 'maxSpeed';

export const GPS_CHART_METRICS: Array<{ key: GpsChartMetricKey; label: string; unit: string; perMinuteCapable: boolean }> = [
  { key: 'totalDistance', label: 'Dystans całkowity', unit: 'm', perMinuteCapable: false },
  { key: 'hsr', label: 'HSR', unit: 'm', perMinuteCapable: true },
  { key: 'sprintDistance', label: 'Dystans sprintu', unit: 'm', perMinuteCapable: true },
  { key: 'sprints', label: 'Sprinty', unit: '', perMinuteCapable: true },
  { key: 'hmlDistance', label: 'HML Distance', unit: 'm', perMinuteCapable: true },
  { key: 'acc56', label: 'ACC 5-6', unit: '', perMinuteCapable: true },
  { key: 'dec56', label: 'DCC 5-6', unit: '', perMinuteCapable: true },
  { key: 'distancePerMin', label: 'Dystans / min', unit: 'm/min', perMinuteCapable: false },
  { key: 'maxSpeed', label: 'Max Speed', unit: 'km/h', perMinuteCapable: false },
];

const PER_MINUTE_COLUMNS = new Set<string>([
  'hsr',
  'sprintDistance',
  'sprints',
  'hmlDistance',
  'acc56',
  'dec56',
  'hibSeconds',
  'hibCount',
]);

export function findGpsKey(total: Record<string, unknown>, keys: string[]): string | undefined {
  return keys.find((k) => Object.prototype.hasOwnProperty.call(total, k));
}

export function toGpsNum(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(',', '.');
    const direct = Number(cleaned);
    if (Number.isFinite(direct)) return direct;
    const stripped = Number(cleaned.replace(/[^\d.\-]/g, ''));
    return Number.isFinite(stripped) ? stripped : NaN;
  }
  const coerced = Number(v);
  return Number.isFinite(coerced) ? coerced : NaN;
}

function durationToSeconds(v: unknown): number {
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return toGpsNum(v);
  const s = v.trim();
  if (!s.includes(':')) return toGpsNum(s);
  const parts = s.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || Number.isNaN(Number(p)))) return NaN;
  const nums = parts.map(Number);
  if (nums.length === 2) {
    const [mm, ss] = nums;
    return mm * 60 + ss;
  }
  if (nums.length === 3) {
    const [hh, mm, ss] = nums;
    return hh * 3600 + mm * 60 + ss;
  }
  return NaN;
}

export function normalizeGpsPosition(pos?: string): string {
  if (!pos) return 'Brak';
  if (pos === 'LW' || pos === 'RW') return 'Skrzydłowi';
  return pos;
}

export function getGpsPeriodData(
  entry: Pick<GpsMatchDayEntry, 'firstHalf' | 'secondHalf' | 'total'>,
  period: GpsPeriod,
): Record<string, unknown> {
  if (period === 'firstHalf') return entry.firstHalf ?? {};
  if (period === 'secondHalf') return entry.secondHalf ?? {};
  return entry.total ?? {};
}

export function getPlayerMinutesInPeriod(
  playerId: string,
  playerMinutes: PlayerMinutes[] | undefined,
  period: GpsPeriod,
): number {
  const pm = (playerMinutes ?? []).find((p) => p.playerId === playerId);
  if (!pm) return NaN;
  const start = pm.startMinute ?? 0;
  const end = pm.endMinute ?? 0;
  if (start === 0 && end === 0) return 0;

  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
    const s = Math.max(aStart, bStart);
    const e = Math.min(aEnd, bEnd);
    return e >= s ? e - s + 1 : 0;
  };

  if (period === 'firstHalf') return overlap(start, end, 1, 45);
  if (period === 'secondHalf') return overlap(start, end, 46, end);
  return Math.max(0, end - start + 1);
}

export function getPlayerPositionInMatch(
  playerId: string,
  playerMinutes: PlayerMinutes[] | undefined,
): string {
  const pm = (playerMinutes ?? []).find((p) => p.playerId === playerId);
  return normalizeGpsPosition(pm?.position);
}

function getAccDecAbs56(total: Record<string, unknown>): { acc: number; dec: number } {
  const acc5Key = findGpsKey(total, ['Accelerations Zone 5 (Absolute)']);
  const acc6Key = findGpsKey(total, ['Accelerations Zone 6 (Absolute)']);
  const dec5Key = findGpsKey(total, ['Decelerations Zone 5 (Absolute)']);
  const dec6Key = findGpsKey(total, ['Decelerations Zone 6 (Absolute)']);

  const acc5 = acc5Key != null ? toGpsNum(total[acc5Key]) : NaN;
  const acc6 = acc6Key != null ? toGpsNum(total[acc6Key]) : NaN;
  const dec5 = dec5Key != null ? toGpsNum(total[dec5Key]) : NaN;
  const dec6 = dec6Key != null ? toGpsNum(total[dec6Key]) : NaN;

  const hasAcc = Number.isFinite(acc5) || Number.isFinite(acc6);
  const hasDec = Number.isFinite(dec5) || Number.isFinite(dec6);

  const acc = hasAcc ? (Number.isFinite(acc5) ? acc5 : 0) + (Number.isFinite(acc6) ? acc6 : 0) : NaN;
  const dec = hasDec ? (Number.isFinite(dec5) ? dec5 : 0) + (Number.isFinite(dec6) ? dec6 : 0) : NaN;

  return { acc, dec };
}

function getDistance56(total: Record<string, unknown>): number {
  const d5Key = findGpsKey(total, ['Distance Zone 5 (Absolute)']);
  const d6Key = findGpsKey(total, ['Distance Zone 6 (Absolute)']);
  const d5 = d5Key != null ? toGpsNum(total[d5Key]) : NaN;
  const d6 = d6Key != null ? toGpsNum(total[d6Key]) : NaN;
  const hasAny = Number.isFinite(d5) || Number.isFinite(d6);
  return hasAny ? (Number.isFinite(d5) ? d5 : 0) + (Number.isFinite(d6) ? d6 : 0) : NaN;
}

function getHibSeconds(total: Record<string, unknown>): number {
  const k = findGpsKey(total, [
    'Duration Of High Intensity Bursts (s)',
    'Duration Of High Intensity Bursts (Seconds)',
    'Duration Of High Intensity Bursts',
    'Duration of High Intensity Bursts (s)',
    'HIB Duration (s)',
  ]);
  if (!k || total[k] == null) return NaN;
  const v = total[k];
  return typeof v === 'string' && v.includes(':') ? durationToSeconds(v) : toGpsNum(v);
}

function getHibCount(total: Record<string, unknown>): number {
  const k = findGpsKey(total, [
    'Number Of High Intensity Bursts',
    'Number of High Intensity Bursts',
    'High Intensity Bursts',
    'HIB Count',
  ]);
  if (!k || total[k] == null) return NaN;
  return toGpsNum(total[k]);
}

export function parseGpsPeriodMetrics(total: Record<string, unknown>): GpsPlayerMetrics {
  const { acc, dec } = getAccDecAbs56(total);
  const sprintDistanceKey = findGpsKey(total, ['Sprint Distance', 'Sprint distance']);
  const sprintsKey = findGpsKey(total, ['Sprints', 'Sprint Count']);
  const maxSpeedKey = findGpsKey(total, ['Max Speed', 'Max speed', 'Max Speed (km/h)', 'Max Speed (kph)']);
  const distancePerMinKey = findGpsKey(total, ['Distance Per Min', 'Distance per min']);
  const hsrKey = findGpsKey(total, [
    'High Speed Running (Relative)',
    'High Speed Running (relative)',
    'High Speed Running (m)',
    'High Speed Running',
  ]);
  const hmlDistanceKey = findGpsKey(total, ['HML Distance', 'HML distance']);
  const totalDistanceKey = findGpsKey(total, ['Total Distance', 'Total distance', 'Distance']);

  return {
    minutes: NaN,
    acc56: acc,
    dec56: dec,
    distance56: getDistance56(total),
    sprintDistance: sprintDistanceKey != null && total[sprintDistanceKey] != null ? toGpsNum(total[sprintDistanceKey]) : NaN,
    sprints: sprintsKey != null && total[sprintsKey] != null ? toGpsNum(total[sprintsKey]) : NaN,
    maxSpeed: maxSpeedKey != null && total[maxSpeedKey] != null ? toGpsNum(total[maxSpeedKey]) : NaN,
    distancePerMin: distancePerMinKey != null && total[distancePerMinKey] != null ? toGpsNum(total[distancePerMinKey]) : NaN,
    hsr: hsrKey != null && total[hsrKey] != null ? toGpsNum(total[hsrKey]) : NaN,
    hibSeconds: getHibSeconds(total),
    hibCount: getHibCount(total),
    hmlDistance: hmlDistanceKey != null && total[hmlDistanceKey] != null ? toGpsNum(total[hmlDistanceKey]) : NaN,
    totalDistance: totalDistanceKey != null && total[totalDistanceKey] != null ? toGpsNum(total[totalDistanceKey]) : NaN,
  };
}

export function applyGpsNormalization(
  metric: string,
  raw: number,
  minutes: number,
  valueMode: GpsValueMode,
): number {
  if (!Number.isFinite(raw)) return NaN;
  if (valueMode !== 'perMinute' || !PER_MINUTE_COLUMNS.has(metric)) return raw;
  if (!Number.isFinite(minutes) || minutes <= 0) return NaN;
  return raw / minutes;
}

export function buildGpsPlayerRow(
  entry: GpsMatchDayEntry,
  matchInfo: TeamInfo,
  period: GpsPeriod,
  valueMode: GpsValueMode,
): GpsPlayerRow {
  const periodData = getGpsPeriodData(entry, period);
  const metrics = parseGpsPeriodMetrics(periodData);
  const minutes = getPlayerMinutesInPeriod(entry.playerId, matchInfo.playerMinutes, period);
  const position = getPlayerPositionInMatch(entry.playerId, matchInfo.playerMinutes);

  const normalize = (key: string, raw: number) =>
    applyGpsNormalization(key, raw, minutes, valueMode);

  return {
    playerId: entry.playerId,
    playerName: entry.playerName,
    position,
    minutes,
    acc56: normalize('acc56', metrics.acc56),
    dec56: normalize('dec56', metrics.dec56),
    distance56: metrics.distance56,
    sprintDistance: normalize('sprintDistance', metrics.sprintDistance),
    sprints: normalize('sprints', metrics.sprints),
    maxSpeed: metrics.maxSpeed,
    distancePerMin: metrics.distancePerMin,
    hsr: normalize('hsr', metrics.hsr),
    hibSeconds: normalize('hibSeconds', metrics.hibSeconds),
    hibCount: normalize('hibCount', metrics.hibCount),
    hmlDistance: normalize('hmlDistance', metrics.hmlDistance),
    totalDistance: metrics.totalDistance,
  };
}

function sumFinite(values: number[]): number {
  return values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
}

function avgFinite(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return NaN;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function buildGpsPlayerRows(
  entries: GpsMatchDayEntry[],
  matchInfo: TeamInfo,
  period: GpsPeriod,
  valueMode: GpsValueMode,
  positionFilter: string,
): GpsPlayerRow[] {
  return entries
    .filter((e) => positionFilter === 'all' || getPlayerPositionInMatch(e.playerId, matchInfo.playerMinutes) === positionFilter)
    .map((e) => buildGpsPlayerRow(e, matchInfo, period, valueMode));
}

export function buildGpsTeamStats(rows: GpsPlayerRow[]): GpsTeamStats {
  const maxSpeed = rows.reduce((max, r) => (Number.isFinite(r.maxSpeed) ? Math.max(max, r.maxSpeed) : max), 0);
  const totalMinutes = sumFinite(rows.map((r) => r.minutes));
  const totalDistance = sumFinite(rows.map((r) => r.totalDistance));

  return {
    playerCount: rows.length,
    minutes: totalMinutes,
    acc56: sumFinite(rows.map((r) => r.acc56)),
    dec56: sumFinite(rows.map((r) => r.dec56)),
    distance56: sumFinite(rows.map((r) => r.distance56)),
    sprintDistance: sumFinite(rows.map((r) => r.sprintDistance)),
    sprints: sumFinite(rows.map((r) => r.sprints)),
    maxSpeed: maxSpeed > 0 ? maxSpeed : NaN,
    distancePerMin: avgFinite(rows.map((r) => r.distancePerMin)),
    hsr: sumFinite(rows.map((r) => r.hsr)),
    hibSeconds: sumFinite(rows.map((r) => r.hibSeconds)),
    hibCount: sumFinite(rows.map((r) => r.hibCount)),
    hmlDistance: sumFinite(rows.map((r) => r.hmlDistance)),
    totalDistance,
    avgDistancePerMin: totalMinutes > 0 ? totalDistance / totalMinutes : NaN,
    teamMaxSpeed: maxSpeed > 0 ? maxSpeed : NaN,
  };
}

export function buildGpsHalfCompare(
  entries: GpsMatchDayEntry[],
  matchInfo: TeamInfo,
  positionFilter: string,
  valueMode: GpsValueMode,
): { firstHalf: GpsHalfSlice; secondHalf: GpsHalfSlice } {
  const firstRows = buildGpsPlayerRows(entries, matchInfo, 'firstHalf', valueMode, positionFilter);
  const secondRows = buildGpsPlayerRows(entries, matchInfo, 'secondHalf', valueMode, positionFilter);
  const toSlice = (rows: GpsPlayerRow[]): GpsHalfSlice => ({
    totalDistance: sumFinite(rows.map((r) => r.totalDistance)),
    hsr: sumFinite(rows.map((r) => r.hsr)),
    sprintDistance: sumFinite(rows.map((r) => r.sprintDistance)),
    sprints: sumFinite(rows.map((r) => r.sprints)),
    hmlDistance: sumFinite(rows.map((r) => r.hmlDistance)),
    acc56: sumFinite(rows.map((r) => r.acc56)),
    dec56: sumFinite(rows.map((r) => r.dec56)),
  });
  return { firstHalf: toSlice(firstRows), secondHalf: toSlice(secondRows) };
}

export function buildGpsPositionBreakdown(rows: GpsPlayerRow[]): GpsPositionBreakdownRow[] {
  const map = new Map<string, { totalDistance: number; hsr: number; sprintDistance: number; playerCount: number }>();
  rows.forEach((row) => {
    const existing = map.get(row.position) ?? { totalDistance: 0, hsr: 0, sprintDistance: 0, playerCount: 0 };
    existing.totalDistance += Number.isFinite(row.totalDistance) ? row.totalDistance : 0;
    existing.hsr += Number.isFinite(row.hsr) ? row.hsr : 0;
    existing.sprintDistance += Number.isFinite(row.sprintDistance) ? row.sprintDistance : 0;
    existing.playerCount += 1;
    map.set(row.position, existing);
  });
  const totalDist = sumFinite([...map.values()].map((v) => v.totalDistance));
  return [...map.entries()]
    .map(([position, data]) => ({
      position,
      ...data,
      sharePct: totalDist > 0 ? (data.totalDistance / totalDist) * 100 : 0,
    }))
    .sort((a, b) => b.totalDistance - a.totalDistance);
}

export function buildGpsTopPlayersChartData(
  rows: GpsPlayerRow[],
  metric: GpsChartMetricKey,
  limit = 8,
): Array<{ name: string; value: number; playerId: string; position: string }> {
  return [...rows]
    .filter((r) => Number.isFinite(r[metric]) && (r[metric] as number) > 0)
    .sort((a, b) => (b[metric] as number) - (a[metric] as number))
    .slice(0, limit)
    .map((r) => ({
      name: r.playerName.split(' ').pop() ?? r.playerName,
      value: r[metric] as number,
      playerId: r.playerId,
      position: r.position,
    }));
}

export function formatGpsDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—';
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatGpsNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function getGpsMetricSharePct(row: GpsPlayerRow, metric: GpsChartMetricKey, teamTotal: number): number {
  const value = row[metric];
  if (!Number.isFinite(value as number) || !Number.isFinite(teamTotal) || teamTotal <= 0) return 0;
  return Math.min(100, ((value as number) / teamTotal) * 100);
}

export function getAvailableGpsPositions(matchInfo: TeamInfo): string[] {
  const positions = new Set<string>();
  (matchInfo.playerMinutes ?? []).forEach((pm) => {
    const pos = normalizeGpsPosition(pm.position);
    if (pos) positions.add(pos);
  });
  return [...positions].sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
}
