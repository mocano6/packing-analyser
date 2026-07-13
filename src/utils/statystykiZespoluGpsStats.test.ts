import assert from 'node:assert/strict';
import type { TeamInfo } from '@/types';
import {
  applyGpsNormalization,
  buildGpsHalfCompare,
  buildGpsPlayerRow,
  buildGpsPlayerRows,
  buildGpsPositionBreakdown,
  buildGpsTeamStats,
  buildGpsTopPlayersChartData,
  formatGpsDistance,
  getAvailableGpsPositions,
  getPlayerMinutesInPeriod,
  normalizeGpsPosition,
  parseGpsPeriodMetrics,
  toGpsNum,
} from './statystykiZespoluGpsStats';

const matchInfo = {
  id: 'm1',
  team: 'home',
  opponent: 'away',
  isHome: true,
  competition: 'test',
  date: '2024-01-01',
  playerMinutes: [
    { playerId: 'p1', position: 'CB', startMinute: 1, endMinute: 90 },
    { playerId: 'p2', position: 'LW', startMinute: 46, endMinute: 90 },
    { playerId: 'p3', position: 'ST', startMinute: 1, endMinute: 30 },
  ],
} as TeamInfo;

assert.equal(normalizeGpsPosition('LW'), 'Skrzydłowi');
assert.equal(normalizeGpsPosition('CB'), 'CB');
assert.equal(toGpsNum('12,5'), 12.5);
assert.equal(toGpsNum('12.3 km'), 12.3);

const metrics = parseGpsPeriodMetrics({
  'Total Distance': 10234,
  'Sprint Distance': 420,
  Sprints: 18,
  'Max Speed': 32.4,
  'Distance Per Min': 112.5,
  'High Speed Running (m)': 890,
  'Accelerations Zone 5 (Absolute)': 12,
  'Accelerations Zone 6 (Absolute)': 3,
  'Decelerations Zone 5 (Absolute)': 8,
  'Decelerations Zone 6 (Absolute)': 2,
  'HML Distance': 1200,
  'Duration Of High Intensity Bursts (s)': '2:30',
  'Number Of High Intensity Bursts': 6,
});

assert.equal(metrics.totalDistance, 10234);
assert.equal(metrics.sprintDistance, 420);
assert.equal(metrics.acc56, 15);
assert.equal(metrics.dec56, 10);
assert.equal(metrics.hibSeconds, 150);
assert.equal(metrics.hibCount, 6);

assert.equal(getPlayerMinutesInPeriod('p1', matchInfo.playerMinutes, 'total'), 90);
assert.equal(getPlayerMinutesInPeriod('p1', matchInfo.playerMinutes, 'firstHalf'), 45);
assert.equal(getPlayerMinutesInPeriod('p2', matchInfo.playerMinutes, 'firstHalf'), 0);
assert.equal(getPlayerMinutesInPeriod('p2', matchInfo.playerMinutes, 'secondHalf'), 45);
assert.equal(getPlayerMinutesInPeriod('p3', matchInfo.playerMinutes, 'total'), 30);

const entry = {
  id: 'g1',
  playerId: 'p1',
  playerName: 'Jan Kowalski',
  firstHalf: { 'Total Distance': 5000, 'High Speed Running (m)': 400, Sprints: 8 },
  secondHalf: { 'Total Distance': 5234, 'High Speed Running (m)': 490, Sprints: 10 },
  total: {
    'Total Distance': 10234,
    'Sprint Distance': 420,
    Sprints: 18,
    'Max Speed': 32.4,
    'Distance Per Min': 112.5,
    'High Speed Running (m)': 890,
    'Accelerations Zone 5 (Absolute)': 12,
    'Accelerations Zone 6 (Absolute)': 3,
    'Decelerations Zone 5 (Absolute)': 8,
    'Decelerations Zone 6 (Absolute)': 2,
    'HML Distance': 1200,
    'Duration Of High Intensity Bursts (s)': 150,
    'Number Of High Intensity Bursts': 6,
  },
};

const row = buildGpsPlayerRow(entry, matchInfo, 'total', 'raw');
assert.equal(row.position, 'CB');
assert.equal(row.totalDistance, 10234);
assert.equal(row.sprints, 18);

const perMinRow = buildGpsPlayerRow(entry, matchInfo, 'total', 'perMinute');
assert.equal(perMinRow.sprints, 18 / 90);
assert.equal(applyGpsNormalization('maxSpeed', 32.4, 90, 'perMinute'), 32.4);

const rows = buildGpsPlayerRows([entry], matchInfo, 'total', 'raw', 'all');
assert.equal(rows.length, 1);
assert.equal(buildGpsPlayerRows([entry], matchInfo, 'total', 'raw', 'ST').length, 0);

const teamStats = buildGpsTeamStats(rows);
assert.equal(teamStats.totalDistance, 10234);
assert.equal(teamStats.teamMaxSpeed, 32.4);

const halfCompare = buildGpsHalfCompare([entry], matchInfo, 'all', 'raw');
assert.equal(halfCompare.firstHalf.totalDistance, 5000);
assert.equal(halfCompare.secondHalf.totalDistance, 5234);

const positionBreakdown = buildGpsPositionBreakdown(rows);
assert.equal(positionBreakdown[0]?.position, 'CB');
assert.equal(positionBreakdown[0]?.sharePct, 100);

const chartData = buildGpsTopPlayersChartData(rows, 'totalDistance', 5);
assert.equal(chartData[0]?.value, 10234);

assert.equal(formatGpsDistance(1500), '1.5 km');
assert.equal(formatGpsDistance(450), '450 m');

const positions = getAvailableGpsPositions(matchInfo);
assert.ok(positions.includes('CB'));
assert.ok(positions.includes('Skrzydłowi'));

console.log('statystykiZespoluGpsStats.test.ts: OK');
